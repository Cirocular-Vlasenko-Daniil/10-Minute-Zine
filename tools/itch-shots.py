#!/usr/bin/env python3
"""Скриншоты для itch.io (1920×1080) через Chrome без окна.

Chrome управляется по протоколу DevTools через pipe (--remote-debugging-pipe) — без сторонних
библиотек. Сценарии кадров — в tools/itch-shots.html; скрипт ждёт, пока сценарий поставит
заголовок «ready», и снимает. У каждого кадра чистый профиль: грузится английский пример,
черновики в вашем браузере не затрагиваются. Нужен запущенный tools/serve.py (порт 8765).

  python3 tools/itch-shots.py                 # все кадры в dist/itch-page/
  python3 tools/itch-shots.py palette:seed=3  # один кадр (параметры — через запятую)
"""
import base64, json, os, pathlib, subprocess, sys, tempfile, time

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "itch-page"
SHOTS = ["editor", "sheet", "caption", "palette", "poster", "export"]  # порядок — как на странице itch
W, H, SCALE = 1440, 810, 4 / 3  # снимок 1920×1080


class Chrome:
    def __init__(self, profile):
        r_in, w_in = os.pipe()    # мы пишем → Chrome читает (fd 3)
        r_out, w_out = os.pipe()  # Chrome пишет (fd 4) → мы читаем
        # close_fds=False: иначе подпроцесс закроет 3 и 4 уже после dup2 в preexec_fn
        def fds():
            os.dup2(r_in, 3); os.dup2(w_out, 4)
        self.p = subprocess.Popen(
            [CHROME, "--headless=new", "--remote-debugging-pipe", "--disable-gpu", "--hide-scrollbars",
             "--no-first-run", "--no-default-browser-check", f"--user-data-dir={profile}", "about:blank"],
            preexec_fn=fds, close_fds=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        os.close(r_in); os.close(w_out)
        self.w = os.fdopen(w_in, "wb", buffering=0)
        self.r = os.fdopen(r_out, "rb", buffering=0)
        self.buf = b""
        self.n = 0

    def send(self, method, params=None, session=None):
        self.n += 1
        msg = {"id": self.n, "method": method, "params": params or {}}
        if session:
            msg["sessionId"] = session
        self.w.write(json.dumps(msg).encode() + b"\0")
        while True:  # ответы разделены нулевым байтом; события пропускаем
            while b"\0" not in self.buf:
                chunk = self.r.read(1 << 16)
                if not chunk:
                    raise RuntimeError("Chrome закрылся")
                self.buf += chunk
            raw, self.buf = self.buf.split(b"\0", 1)
            m = json.loads(raw)
            if m.get("id") == self.n:
                if "error" in m:
                    raise RuntimeError(f"{method}: {m['error']}")
                return m.get("result", {})

    def close(self):
        try:
            self.send("Browser.close")
        except Exception:
            pass
        self.p.wait(timeout=10)


def shoot(name, query=""):
    with tempfile.TemporaryDirectory() as prof:
        c = Chrome(prof)
        try:
            tid = c.send("Target.createTarget", {"url": "about:blank"})["targetId"]
            s = c.send("Target.attachToTarget", {"targetId": tid, "flatten": True})["sessionId"]
            scale = float(dict(kv.split("=") for kv in query.split("&") if "=" in kv).get("scale", SCALE))
            c.send("Emulation.setDeviceMetricsOverride", {"width": W, "height": H, "deviceScaleFactor": scale, "mobile": False}, s)
            c.send("Page.enable", {}, s)
            url = f"http://localhost:8765/tools/itch-shots.html?shot={name}" + (f"&{query}" if query else "")
            c.send("Page.navigate", {"url": url}, s)
            t0 = time.time()
            while True:
                title = c.send("Runtime.evaluate", {"expression": "document.title", "returnByValue": True}, s)["result"].get("value")
                if title == "ready":
                    break
                if time.time() - t0 > 40:
                    raise RuntimeError(f"{name}: сценарий не дошёл до конца (заголовок «{title}»)")
                time.sleep(0.3)
            png = base64.b64decode(c.send("Page.captureScreenshot", {"format": "png"}, s)["data"])
            meta = c.send("Runtime.evaluate", {"expression": "document.body.dataset.page || ''", "returnByValue": True}, s)["result"].get("value")
            if meta: print("page rect:", meta)
        finally:
            c.close()
    num = SHOTS.index(name) + 1 if name in SHOTS else 0  # номер — порядок на странице itch
    path = OUT / (f"{num:02d}-{name}.png" if num else f"shot-{name}.png")
    path.write_bytes(png)
    print(f"{name}: {path.relative_to(ROOT)} ({len(png) // 1024} КБ)")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for arg in sys.argv[1:] or SHOTS:
        name, _, q = arg.partition(":")
        shoot(name, q.replace(",", "&"))
