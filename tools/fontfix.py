#!/usr/bin/env python3
"""Лечит TTF, у которых пустой глиф стоит в самом конце таблицы glyf, а glyf — последняя в файле.

Так устроены IBM Plex Mono из Google Fonts: пробел — пустой глиф на границе файла, и fontkit
(внутри pdf-lib) при измерении читает за концом буфера и падает («Trying to access beyond
buffer length»). Дописываем в конец файла нули: таблицы и их длины не меняются, а чтение
заголовка пустого глифа попадает в нули (пустой контур).
Запуск: python3 tools/fontfix.py — проверяет и чинит все fonts/*.ttf; fetch-fonts.py зовёт fix().
"""
import pathlib, struct

PAD = 16


def needs_fix(d):
    n = struct.unpack(">H", d[4:6])[0]
    tables = {}
    for i in range(n):
        tag, _, off, ln = struct.unpack(">4sIII", d[12 + 16 * i:28 + 16 * i])
        tables[tag] = (off, ln)
    if b"glyf" not in tables or b"loca" not in tables:
        return False
    goff, glen = tables[b"glyf"]
    if len(d) - (goff + glen) >= 12:  # после glyf хватает байт на заголовок глифа (10) — читать есть куда
        return False
    head = tables[b"head"][0]
    long_loca = struct.unpack(">h", d[head + 50:head + 52])[0] == 1
    loff, llen = tables[b"loca"]
    if long_loca:
        loca = struct.unpack(">%dI" % (llen // 4), d[loff:loff + llen])
    else:
        loca = [v * 2 for v in struct.unpack(">%dH" % (llen // 2), d[loff:loff + llen])]
    # есть пустой глиф, начинающийся ровно на конце таблицы
    return any(a == b == glen for a, b in zip(loca, loca[1:]))


def fix(data):
    return data + b"\0" * PAD if needs_fix(data) else data


if __name__ == "__main__":
    root = pathlib.Path(__file__).resolve().parent.parent / "fonts"
    for p in sorted(root.glob("*.ttf")):
        d = p.read_bytes()
        if needs_fix(d):
            p.write_bytes(fix(d))
            print("исправлен", p.name)
