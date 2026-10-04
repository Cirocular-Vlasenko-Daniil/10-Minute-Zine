#!/usr/bin/env python3
"""Скачивает TTF из Google Fonts в ./fonts, их лицензии в ./fonts/licenses и пишет fonts/fonts.json.

Список шрифтов — FONTS ниже. Добавить шрифт: вписать строку и перезапустить.
Старый User-Agent заставляет Google Fonts отдавать TTF (нужен для встраивания в PDF).
"""
import json, re, pathlib, urllib.request
from fontfix import fix  # пустой глиф на границе файла ломает fontkit

FONTS = [
    # id,              Google-имя,          роль-подсказка
    ("ibm-plex-sans",  "IBM Plex Sans",     "body"),
    ("ibm-plex-serif", "IBM Plex Serif",    "body"),
    ("ibm-plex-mono",  "IBM Plex Mono",     "body"),
    ("pt-serif",       "PT Serif",          "body"),
    ("inter",          "Inter",             "body"),
    ("onest",          "Onest",             "body"),
    ("unbounded",      "Unbounded",         "heading"),
    ("rubik",          "Rubik",             "heading"),
    ("pixelify-sans",  "Pixelify Sans",     "heading"),
    ("press-start",    "Press Start 2P",    "heading"),
    ("jetbrains-mono", "JetBrains Mono",    "body"),
]
STYLES = {"400": "r", "700": "b", "400i": "i", "700i": "bi"}

root = pathlib.Path(__file__).resolve().parent.parent / "fonts"
root.mkdir(exist_ok=True)
UA = {"User-Agent": "Mozilla/4.0"}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA)).read()

registry = []
for fid, gname, role in FONTS:
    css = get("https://fonts.googleapis.com/css?family=%s:%s&subset=latin,cyrillic"
              % (gname.replace(" ", "+"), ",".join(STYLES))).decode()
    files = {}
    for block in re.findall(r"@font-face\s*{(.*?)}", css, re.S):
        style = re.search(r"font-style:\s*(\w+)", block).group(1)
        weight = re.search(r"font-weight:\s*(\d+)", block).group(1)
        key = weight + ("i" if style == "italic" else "")
        if key not in STYLES:
            continue
        url = re.search(r"url\((.*?)\)", block).group(1)
        name = "%s-%s.ttf" % (fid, STYLES[key])
        (root / name).write_bytes(fix(get(url)))
        files[STYLES[key]] = name
    # лицензия: шрифты раздаём вместе с её текстом (требование OFL)
    folder = "".join(ch for ch in gname.lower() if ch.isalnum())
    lic = None
    for kind, fname in (("ofl", "OFL.txt"), ("apache", "LICENSE.txt"), ("ufl", "UFL.txt")):
        try:
            data = get("https://raw.githubusercontent.com/google/fonts/main/%s/%s/%s" % (kind, folder, fname))
            lic = "%s-%s" % (fid, fname)
            (root / "licenses").mkdir(exist_ok=True)
            (root / "licenses" / lic).write_bytes(data)
            break
        except Exception:
            continue
    if not lic:
        print("  !! лицензия не найдена — добавь вручную в fonts/licenses/ и в LICENSES.md")
    registry.append({"id": fid, "name": gname, "role": role, "files": files, "license": lic})
    print(fid, sorted(files))

(root / "fonts.json").write_text(json.dumps(registry, ensure_ascii=False, indent=1))
