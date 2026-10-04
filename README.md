# 10 minute zine

Редактор зинов из одного листа: 8 страниц на A4 / A3 / US Letter, постер или второй зин на обороте,
вёрстка блоками по сетке, PDF для дома и типографии, PNG для веба. Сайт — https://10minutezine.com

Всё работает в браузере, без сервера и сборщика: чистый JS (ES-модули), pdf-lib + fontkit, qrcode-generator.

## Разработка

```bash
python3 tools/serve.py          # http://localhost:8765/editor.html (без кэша)
python3 tools/stamp.py          # метки версий ?v=<хэш> в импортах — после правок JS/CSS
```

## Сборка и выкладка

```bash
python3 tools/package.py        # сайт -> dist/10minutezine/ и dist/10minutezine.zip
tools/deploy.sh                 # собрать и выложить на сервер (ssh-хост «zine»)
tools/deploy.sh --rollback      # вернуть предыдущую версию
python3 tools/package-itch.py   # архив редактора для itch.io
```

## Структура

- `js/` — редактор: модель (`model.js`), вёрстка (`layout.js`), SVG / PDF / PNG (`render.js`, `pdf.js`, `raster.js`), картинки (`images.js`), шрифты (`fonts.js`)
- `site-src/` — шаблоны лендинга и страниц; `tools/build-site.py` собирает из них `index.html`, `ru/`, `contact.html`, `404.html`, sitemap
- `fonts/`, `vendor/` — шрифты (OFL) и библиотеки с лицензиями, см. `LICENSES.md`
- `samples/` — пример зина (RU / EN)
