#!/usr/bin/env python3
"""Архив редактора для itch.io: dist/10minutezine-itch.zip.

itch встраивает HTML-проект во фрейм и открывает index.html из корня архива, поэтому:
  * editor.html становится index.html, лендинга и страниц сайта в архиве нет;
  * логотип ведёт на сайт в новой вкладке (внутри фрейма сайт открывать незачем);
  * абсолютные ссылки на иконки убраны — во фрейме они смотрели бы в корень itch.
Перед сборкой пересобирается сайт (tools/package.py) — метки версий и код те же.
Запуск: python3 tools/package-itch.py
"""
import pathlib, re, shutil, subprocess, sys, zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / "dist" / "10minutezine"
OUT = ROOT / "dist" / "itch"
ZIP = ROOT / "dist" / "10minutezine-itch.zip"
DIRS = ["css", "js", "fonts", "vendor", "samples"]

subprocess.run([sys.executable, str(ROOT / "tools/package.py")], check=True)
if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
for d in DIRS:
    shutil.copytree(SITE / d, OUT / d)
shutil.copy2(SITE / "LICENSES.md", OUT / "LICENSES.md")

html = (SITE / "editor.html").read_text(encoding="utf-8")
n = 0
html, k = re.subn(r'<a class="logo" href="\./"', '<a class="logo" href="https://10minutezine.com/" target="_blank" rel="noopener"', html); n += k
html, k = re.subn(r'\s*<link rel="(icon|apple-touch-icon|manifest)"[^>]*>', "", html); n += k  # приложение (PWA) — только на сайте
assert 'href="https://10minutezine.com/" target="_blank"' in html, "логотип не найден — поменялась разметка editor.html?"
(OUT / "index.html").write_text(html, encoding="utf-8")

if ZIP.exists():
    ZIP.unlink()
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
    for p in sorted(OUT.rglob("*")):
        if p.is_file():
            zf.write(p, p.relative_to(OUT))
files = [p for p in OUT.rglob("*") if p.is_file()]
print(f"dist/10minutezine-itch.zip: {len(files)} файлов, {ZIP.stat().st_size / 1024 / 1024:.1f} МБ (правок в index.html: {n})")
