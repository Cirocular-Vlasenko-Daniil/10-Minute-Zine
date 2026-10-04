#!/usr/bin/env python3
"""Метка версии в адресах JS-модулей и стилей: './md.js' -> './md.js?v=3f9a1c2e'.

Зачем: браузеры (особенно Safari) держат модули в кэше, и после обновления сайта
у посетителя могут смешаться старые и новые файлы. Метка считается по содержимому
всех js/*.js — код поменялся, поменялись адреса, старый файл из кэша не возьмётся.

Запускается из tools/build-site.py; можно и отдельно: python3 tools/stamp.py
"""
import hashlib, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
JS = sorted((ROOT / "js").glob("*.js"))

IMPORT = re.compile(r"""(from\s+'\./[\w-]+\.js)(\?v=[0-9a-f]+)?(')""")
MAIN = re.compile(r'(src="js/main\.js)(\?v=[0-9a-f]+)?(")')
CSS_LINK = re.compile(r'(href="/?css/[\w-]+\.css)(\?v=[0-9a-f]+)?(")')
CSS = sorted((ROOT / "css").glob("*.css"))


def stamp():
    # хэш по коду без самих меток — иначе метка зависела бы сама от себя
    h = hashlib.sha1()
    for f in JS:
        h.update(IMPORT.sub(r"\1\3", f.read_text(encoding="utf-8")).encode())
    for f in CSS:  # стили тоже: поменялась вёрстка — поменялась метка
        h.update(f.read_bytes())
    return h.hexdigest()[:8]


def apply(v):
    changed = 0
    for f in JS:
        s = f.read_text(encoding="utf-8")
        n = IMPORT.sub(rf"\1?v={v}\3", s)
        if n != s:
            f.write_text(n, encoding="utf-8")
            changed += 1
    ed = ROOT / "editor.html"
    s = ed.read_text(encoding="utf-8")
    n = CSS_LINK.sub(rf"\1?v={v}\3", MAIN.sub(rf"\1?v={v}\3", s))
    if n != s:
        ed.write_text(n, encoding="utf-8")
        changed += 1
    return changed


if __name__ == "__main__":
    v = stamp()
    print("js version", v, "· files updated:", apply(v))
