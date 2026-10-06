#!/usr/bin/env python3
"""Собирает статичные страницы сайта из site-src/ на двух языках.

  /index.html, /contact.html        — английский (основной поисковый трафик)
  /ru/index.html, /ru/contact.html  — русский
  /404.html, /sitemap.xml, /robots.txt

Исходники пишутся по-русски: у элементов с data-i18n текст переводится по словарю js/i18n-en.js
(тот же словарь, что у редактора). Нет перевода — сборка падает, чтобы не выложить полусырое.
Запуск: python3 tools/build-site.py
"""
import html, json, pathlib, re, sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import stamp as js_stamp  # метка версии в адресах модулей

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "site-src"
SITE = "https://10minutezine.com"
# страница проекта на Boosty, например "https://boosty.to/10minutezine"; пусто — сборка предупредит
BOOSTY_URL = "https://boosty.to/cirocular/donate"
LANGS = ("en", "ru")


def load_dict():
    js = (ROOT / "js/i18n-en.js").read_text(encoding="utf-8")
    s = r"'((?:[^'\\]|\\.)*)'"
    unq = lambda v: re.sub(r"\\(.)", r"\1", v)
    return {unq(k): unq(v) for k, v in re.findall(s + r"\s*:\s*" + s, js)}


EN = load_dict()


def tr(text, lang):
    if lang == "ru":
        return text
    if text not in EN:
        sys.exit(f"нет перевода: {text!r}")
    return EN[text]


I18N = re.compile(r"<(\w+)([^>]*?)\sdata-i18n(\s[^>]*)?>(.*?)</\1>", re.S)


def translate(page, lang):
    return I18N.sub(lambda m: f"<{m[1]}{m[2]}{m[3] or ''}>{tr(m[4].strip(), lang)}</{m[1]}>", page)


# Страницы: адрес по языку, заголовок и описание для поисковиков
PAGES = {
    "landing": {
        "path": {"en": "/", "ru": "/ru/"},
        "out": {"en": "index.html", "ru": "ru/index.html"},
        "title": {
            "en": "Make a Zine Online Free — One Page Zine Template | 10 minute zine",
            "ru": "Сделать зин онлайн бесплатно — шаблон зина из одного листа | 10 minute zine",
        },
        "desc": {
            "en": "Make a zine online for free in 10 minutes. One page zine template and maker for an 8-page mini zine: "
                  "print-ready PDF for A4 or US Letter — print, fold, cut. No sign-up, no ads.",
            "ru": "Сделай зин онлайн бесплатно за 10 минут. Шаблон и конструктор мини-зина на 8 страниц: "
                  "PDF для печати на A4 или US Letter — распечатай, сложи, разрежь. Без регистрации.",
        },
    },
    "contact": {
        "path": {"en": "/contact.html", "ru": "/ru/contact.html"},
        "out": {"en": "contact.html", "ru": "ru/contact.html"},
        "title": {"en": "Contact · 10 minute zine", "ru": "Контакты · 10 minute zine"},
        "desc": {
            "en": "Questions about 10 minute zine or want to share your zine? Get in touch with Daniil Vlasenko.",
            "ru": "Вопросы о 10 minute zine или хочешь показать свой зин? Напиши Даниилу Власенко.",
        },
    },
}

ALT = {
    "sheet": {
        "en": "One page zine template: eight pages laid out on one sheet, top row upside down, ready to print and fold",
        "ru": "Шаблон зина из одного листа: восемь страниц на одном листе, верхний ряд вверх ногами — готово к печати и складыванию",
    },
    "fold": {
        "en": "How the eight pages sit on the sheet: fold lines and the cut across the middle two panels",
        "ru": "Как восемь страниц лежат на листе: линии сгибов и разрез по двум средним панелям",
    },
}


def head(page, lang):
    p = PAGES[page]
    url = SITE + p["path"][lang]
    alt = {l: SITE + p["path"][l] for l in LANGS}
    e = lambda v: html.escape(v, quote=True)
    og_img = f"{SITE}/img/og-{lang}.png"
    lines = [
        '<meta charset="utf-8">',
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{e(p['title'][lang])}</title>",
        f'<meta name="description" content="{e(p["desc"][lang])}">',
        f'<link rel="canonical" href="{url}">',
        f'<link rel="alternate" hreflang="en" href="{alt["en"]}">',
        f'<link rel="alternate" hreflang="ru" href="{alt["ru"]}">',
        f'<link rel="alternate" hreflang="x-default" href="{alt["en"]}">',
        '<meta property="og:type" content="website">',
        '<meta property="og:site_name" content="10 minute zine">',
        f'<meta property="og:title" content="{e(p["title"][lang])}">',
        f'<meta property="og:description" content="{e(p["desc"][lang])}">',
        f'<meta property="og:url" content="{url}">',
        f'<meta property="og:image" content="{og_img}">',
        '<meta property="og:image:width" content="1200">',
        '<meta property="og:image:height" content="630">',
        f'<meta property="og:image:alt" content="{e(ALT["sheet"][lang])}">',
        f'<meta property="og:locale" content="{"en_US" if lang == "en" else "ru_RU"}">',
        f'<meta property="og:locale:alternate" content="{"ru_RU" if lang == "en" else "en_US"}">',
        '<meta name="twitter:card" content="summary_large_image">',
        '<meta name="theme-color" content="#ffffff">',
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        '<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">',
        '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
        f'<link rel="stylesheet" href="/css/landing.css?v={JSV}">',
    ]
    if page == "landing":
        ld = {
            "@context": "https://schema.org",
            "@type": "WebApplication",
            "name": "10 minute zine",
            "alternateName": "Free online zine maker" if lang == "en" else "Бесплатный онлайн-конструктор зинов",
            "url": SITE + "/",
            "description": PAGES["landing"]["desc"][lang],
            "applicationCategory": "DesignApplication",
            "operatingSystem": "Any (web browser)",
            "browserRequirements": "Requires JavaScript",
            "inLanguage": ["en", "ru"],
            "isAccessibleForFree": True,
            "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
            "image": og_img,
            "author": {"@type": "Person", "name": "Daniil Vlasenko",
                       "url": "https://github.com/Cirocular-Vlasenko-Daniil"},
        }
        lines.append('<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + "</script>")
        lines.append("{{FAQ_LD}}")
    return "\n".join(lines)


def faq_ld(page_html, lang):
    """FAQPage из уже переведённых пар dt/dd — разметка всегда совпадает с видимым текстом."""
    text = lambda s: html.unescape(re.sub(r"<[^>]+>", "", s)).strip()
    qa = re.findall(r"<dt[^>]*>(.*?)</dt>\s*<dd[^>]*>(.*?)</dd>", page_html, re.S)
    if not qa:
        return ""
    ld = {"@context": "https://schema.org", "@type": "FAQPage", "inLanguage": lang,
          "mainEntity": [{"@type": "Question", "name": text(q),
                          "acceptedAnswer": {"@type": "Answer", "text": text(a)}} for q, a in qa]}
    return '<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False) + "</script>"


def lang_switch(page, lang):
    p = PAGES[page]["path"]
    on = ' class="on" aria-current="page"'
    a = lambda l, label: f'<a href="{p[l]}" hreflang="{l}" data-lang="{l}"{on if l == lang else ""}>{label}</a>'
    return f'<nav class="lang" aria-label="Language">{a("ru", "RU")}{a("en", "EN")}</nav>'


def scripts(page, lang):
    other = PAGES[page]["path"]["ru"]
    # Выбор языка общий с редактором (localStorage 'zine-lang'). На английской странице посетителя
    # с русским браузером, который ещё не выбирал язык, отправляем на русскую версию.
    # Поисковый робот ходит с английским браузером — его это не касается.
    redirect = (f"if (!pref && /^ru\\b/i.test(navigator.language || '')) {{ location.replace('{other}'); return; }}"
                if lang == "en" else "")
    return f"""<script>
(function () {{
  var pref = null;
  try {{ pref = localStorage.getItem('zine-lang'); }} catch (e) {{}}
  {redirect}
  try {{ localStorage.setItem('zine-lang', '{lang}'); }} catch (e) {{}}
  document.addEventListener('click', function (e) {{
    var a = e.target.closest && e.target.closest('[data-lang]');
    if (a) try {{ localStorage.setItem('zine-lang', a.dataset.lang); }} catch (err) {{}}
  }});
}})();
</script>
<script type="module">
  import {{ initAnalytics }} from '/js/analytics.js?v={JSV}';
  initAnalytics();
</script>"""


def build():
    global JSV
    JSV = js_stamp.stamp()
    print(f"js version {JSV} · files updated: {js_stamp.apply(JSV)}")
    if not BOOSTY_URL:
        print("!! BOOSTY_URL не задан — кнопка поддержки ведёт на главную boosty.to")
    for page in PAGES:
        src = (SRC / f"{page}.html").read_text(encoding="utf-8")
        for lang in LANGS:
            out = src
            for k, v in {
                "{{LANG}}": lang,
                "{{HEAD}}": head(page, lang),
                "{{HOME}}": PAGES["landing"]["path"][lang],
                "{{LANG_SWITCH}}": lang_switch(page, lang),
                "{{SCRIPTS}}": scripts(page, lang),
                "{{SHEET_IMG}}": f"/img/sheet-{lang}.jpg",
                "{{SHEET_ALT}}": html.escape(ALT["sheet"][lang], quote=True),
                "{{FOLD_ALT}}": html.escape(ALT["fold"][lang], quote=True),
                "{{BOOSTY_URL}}": BOOSTY_URL or "https://boosty.to",
                # Boosty: российские карты и иностранные Visa/Mastercard с 3-D Secure; PayPal с 16.02.2024 не работает
                "{{SUPPORT_NOTE}}": ('<p class="note-sm">Boosty accepts international Visa and Mastercard cards '
                                     'with 3-D Secure. PayPal isn’t available.</p>' if lang == "en" else ""),
            }.items():
                out = out.replace(k, v)
            out = translate(out, lang)
            out = out.replace("{{FAQ_LD}}", faq_ld(out, lang))
            left = re.findall(r"\{\{\w+\}\}", out)
            if left:
                sys.exit(f"{page}/{lang}: не подставлено {left}")
            dest = ROOT / PAGES[page]["out"][lang]
            dest.parent.mkdir(exist_ok=True)
            dest.write_text("<!-- собрано tools/build-site.py из site-src/ — правь исходник -->\n" + out, encoding="utf-8")
            print("ok", dest.relative_to(ROOT))

    (ROOT / "404.html").write_text(js_stamp.CSS_LINK.sub(rf"\1?v={JSV}\3", (SRC / "404.html").read_text(encoding="utf-8")), encoding="utf-8")
    print("ok 404.html")

    urls = [(PAGES[p]["path"], p) for p in PAGES] + [({"en": "/editor.html"}, "editor")]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for paths, _ in urls:
        for lang, path in paths.items():
            sm.append("  <url>")
            sm.append(f"    <loc>{SITE}{path}</loc>")
            if len(paths) > 1:
                for l2, p2 in paths.items():
                    sm.append(f'    <xhtml:link rel="alternate" hreflang="{l2}" href="{SITE}{p2}"/>')
            sm.append("  </url>")
    sm.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(sm) + "\n", encoding="utf-8")
    print("ok sitemap.xml")

    (ROOT / "robots.txt").write_text(
        "User-agent: *\nDisallow: /tools/\nDisallow: /site-src/\n\n" f"Sitemap: {SITE}/sitemap.xml\n", encoding="utf-8")
    print("ok robots.txt")


if __name__ == "__main__":
    build()
