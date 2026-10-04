#!/usr/bin/env python3
"""Готовит сайт к загрузке на сервер: dist/10minutezine/ + dist/10minutezine.zip.

1. Пересобирает страницы и метки версий (tools/build-site.py).
2. Копирует только то, что нужно сайту (белый список) — без tools/, site-src/, тестовых файлов.
3. Кладёт настройки кэша и типов файлов для Netlify / Cloudflare Pages (_headers) и Apache (.htaccess).
Запуск: python3 tools/package.py
"""
import pathlib, shutil, subprocess, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
OUT = DIST / "10minutezine"

FILES = ["index.html", "editor.html", "contact.html", "404.html", "favicon.svg", "favicon-32.png",
         "apple-touch-icon.png", "sitemap.xml", "robots.txt", "LICENSES.md"]
DIRS = ["ru", "css", "js", "fonts", "vendor", "img", "samples"]
SKIP = {".DS_Store"}

# Кэш: HTML и данные примера — всегда свежие; JS/CSS — навсегда (в адресе метка версии ?v=…);
# шрифты, библиотеки и картинки меняются редко — неделя.
HEADERS = """/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/*.html
  Cache-Control: no-cache
/
  Cache-Control: no-cache
/ru/
  Cache-Control: no-cache

/js/*
  Cache-Control: public, max-age=31536000, immutable
/css/*
  Cache-Control: public, max-age=31536000, immutable

/fonts/fonts.json
  Cache-Control: no-cache
/fonts/*
  Cache-Control: public, max-age=604800
/vendor/*
  Cache-Control: public, max-age=604800
/img/*
  Cache-Control: public, max-age=604800

/samples/*
  Cache-Control: no-cache
  Content-Type: application/json; charset=utf-8

/LICENSES.md
  Content-Type: text/plain; charset=utf-8
"""

HTACCESS = """# 10 minute zine — Apache
ErrorDocument 404 /404.html
AddDefaultCharset utf-8
AddType application/json .zine
AddType font/ttf .ttf
AddType image/svg+xml .svg
AddType text/plain .md
Options -Indexes

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  <FilesMatch "\\.(html|zine|json)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "\\.(js|css)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
  <FilesMatch "\\.(ttf|png|jpg|svg)$">
    Header set Cache-Control "public, max-age=604800"
  </FilesMatch>
</IfModule>
"""


def main():
    subprocess.run([sys.executable, str(ROOT / "tools/build-site.py")], check=True)
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    for f in FILES:
        shutil.copy2(ROOT / f, OUT / f)
    for d in DIRS:
        shutil.copytree(ROOT / d, OUT / d, ignore=shutil.ignore_patterns(*SKIP))
    (OUT / "_headers").write_text(HEADERS, encoding="utf-8")
    (OUT / ".htaccess").write_text(HTACCESS, encoding="utf-8")

    z = DIST / "10minutezine.zip"
    if z.exists():
        z.unlink()
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in sorted(OUT.rglob("*")):
            if p.is_file():
                zf.write(p, p.relative_to(OUT))
    files = [p for p in OUT.rglob("*") if p.is_file()]
    size = sum(p.stat().st_size for p in files)
    print(f"dist/10minutezine/: {len(files)} файлов, {size / 1024 / 1024:.1f} МБ · архив {z.stat().st_size / 1024 / 1024:.1f} МБ")


if __name__ == "__main__":
    main()
