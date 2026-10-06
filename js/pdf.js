// Выгрузка в PDF: векторный текст со встроенными шрифтами, картинки 300 dpi.
// Режим «дом»: лист ровно A4/A3. Режим «типография»: вылеты 3 мм, TrimBox/BleedBox, метки.

import { FORMATS, IMPOSITION, surface, pageCount, bookletPrint } from './model.js?v=ac7257ed';
import { pageDL } from './layout.js?v=ac7257ed';
import { fontBytes, glyphPath } from './fonts.js?v=ac7257ed';
import { printImage, printSilhouette, ensureLoaded } from './images.js?v=ac7257ed';

const K = 72 / 25.4;

const hex = (h) => {
  const v = parseInt(h.slice(1), 16);
  return PDFLib.rgb(((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255);
};

export async function buildPDF(doc, o) {
  const { PDFDocument, pushGraphicsState, popGraphicsState, concatTransformationMatrix, rectangle, clip, endPath, rgb } = PDFLib;
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(window.fontkit);
  pdf.setTitle(doc.title || 'Зин');
  pdf.setCreator('10 minute zine');

  const fonts = new Map();
  const font = async (key) => {
    if (!fonts.has(key)) fonts.set(key, await pdf.embedFont(fontBytes(key), { subset: true }));
    return fonts.get(key);
  };

  // одна и та же картинка (общий фон обложек рисуется на обеих полосах) встраивается один раз
  const imgs = new Map();
  const imgKey = (it) => JSON.stringify([it.asset, it.w, it.h, it.zoom, it.px, it.py, it.filter, it.grain, it.blur, it.invert, it.color, it.rot, it.fade, it.fadeTo]);
  const embed = async (it, r) => {
    const k = imgKey(it);
    if (!imgs.has(k)) imgs.set(k, r.kind === 'png' ? await pdf.embedPng(r.bytes) : await pdf.embedJpg(r.bytes));
    return imgs.get(k);
  };

  // картинки внутри QR вёрстка читает синхронно — догружаем заранее
  const qrIds = [];
  JSON.stringify(doc, (k, v) => { if (k === 'qrimg' && v) qrIds.push(v); return v; });
  await ensureLoaded(qrIds);

  const F = FORMATS[doc.format];
  const press = o.mode === 'press';
  const bleed = press ? 3 : 0;
  const pad = press && o.marks ? 8 : 0;
  const off = bleed + pad;

  for (let si = 0; si < 2; si++) {
    const side = doc.sides[si];
    if (side.type === 'none' || !o.sides[si]) continue;
    const sf = surface(doc, si);
    // листы PDF этой стороны: зин и постер — один лист; брошюра — дома листы для двусторонней
    // печати (по две страницы, порядок для скрепки), в типографию — постранично с вылетами
    const all = { top: true, bottom: true, left: true, right: true };
    let sheets;
    if (side.type === 'booklet') {
      const n = pageCount(doc, si);
      sheets = press
        ? Array.from({ length: n }, (_, pi) => ({ size: [sf.w, sf.h], slots: [{ pi, x: 0, y: 0, rot: 0, edge: all }] }))
        : (() => { // дома: листы для двусторонней печати, на листе — один или несколько разворотов
          const bp = bookletPrint(doc);
          return bp.sheets.map((p) => ({ size: bp.size, bp, cells: p.cells,
            slots: p.cells.flatMap((c) => c.pages.map((pi, j) => ({ pi, x: c.x + j * sf.w, y: c.y, rot: 0, edge: all }))) }));
        })();
    } else if (side.type === 'poster') sheets = [{ size: [sf.w, sf.h], slots: [{ pi: 0, x: 0, y: 0, rot: 0 }] }];
    else sheets = [{ size: F.sheet, slots: IMPOSITION.map(([pi, c, r, rot]) => ({ pi, x: c * sf.w, y: r * sf.h, rot, edge: { top: r === 0, bottom: r === 1, left: c === 0, right: c === 3 } })) }];
    for (const sheet of sheets) {
    const [SW, SH] = sheet.size;
    const page = pdf.addPage([(SW + 2 * off) * K, (SH + 2 * off) * K]);
    if (press) {
      page.setTrimBox(off * K, off * K, SW * K, SH * K);
      page.setBleedBox(pad * K, pad * K, (SW + 2 * bleed) * K, (SH + 2 * bleed) * K);
    }
    // цвет листа — под вылеты тоже; не печатаем, если выбран режим «цветная бумага»
    if (doc.paperPrint && doc.paper && doc.paper.toLowerCase() !== '#ffffff') {
      page.drawRectangle({ x: 0, y: 0, width: (SW + 2 * off) * K, height: (SH + 2 * off) * K, color: hex(doc.paper) });
    }
    const slots = sheet.slots;

    for (const s of slots) {
      // вылеты фона — только у краёв листа; у перевёрнутых полос края листа меняются местами
      let bleedBox = null;
      if (bleed) {
        const e = s.edge || { top: true, bottom: true, left: true, right: true }; // постер — весь лист
        const v = (on) => (on ? bleed : 0);
        bleedBox = s.rot
          ? { t: v(e.bottom), b: v(e.top), l: v(e.right), r: v(e.left) }
          : { t: v(e.top), b: v(e.bottom), l: v(e.left), r: v(e.right) };
      }
      // брошюра дома — с компенсацией выползания (в типографии её делают при спуске полос)
      const { items } = pageDL(doc, si, s.pi, { print: true, bleed: bleedBox, creep: side.type === 'booklet' && !press });
      const x0 = off + s.x, y0 = off + SH - s.y - sf.h; // низ-лево полосы в мм (PDF: ось Y вверх)
      const m = s.rot ? [-K, 0, 0, -K, (x0 + sf.w) * K, (y0 + sf.h) * K] : [K, 0, 0, K, x0 * K, y0 * K];
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(...m));
      const H = sf.h;
      const draw = async (items) => { for (const it of items) {
        if (it.t === 'text') {
          // типография: текст в кривые — в PDF не остаётся шрифтов, подменять нечего
          const d = press ? glyphPath(it.key, it.s, it.size) : null;
          if (d) page.drawSvgPath(d, { x: it.x, y: H - it.y, color: hex(it.fill) });
          else if (!press || d === null) page.drawText(it.s, { x: it.x, y: H - it.y, size: it.size, font: await font(it.key), color: hex(it.fill) });
        } else if (it.t === 'rect') {
          page.drawRectangle({ x: it.x, y: H - it.y - it.h, width: it.w, height: it.h, color: hex(it.fill), opacity: it.o ?? 1 });
        } else if (it.t === 'path') {
          // drawSvgPath: начало в (x, y), ось Y контура направлена вниз — как в SVG
          page.drawSvgPath(it.d, { x: it.x, y: H - it.y, color: hex(it.fill) });
        } else if (it.t === 'line') {
          page.drawLine({ start: { x: it.x1, y: H - it.y1 }, end: { x: it.x2, y: H - it.y2 }, thickness: it.w, color: hex(it.stroke), dashArray: it.dash });
        } else if (it.t === 'image') {
          const r = imgs.has(imgKey(it)) ? null : await printImage(it);
          const img = await embed(it, r);
          const c = it.clip;
          if (c) page.pushOperators(pushGraphicsState(), rectangle(c.x, H - c.y - c.h, c.w, c.h), clip(), endPath());
          page.drawImage(img, { x: it.x, y: H - it.y - it.h, width: it.w, height: it.h, blendMode: it.blend === 'multiply' ? PDFLib.BlendMode.Multiply : undefined });
          // инверсия после умножения: белый силуэт в режиме Difference инвертирует результат
          if (it.invMul) {
            const sil = await pdf.embedPng(await printSilhouette(it));
            page.drawImage(sil, { x: it.x, y: H - it.y - it.h, width: it.w, height: it.h, blendMode: PDFLib.BlendMode.Difference });
          }
          if (c) page.pushOperators(popGraphicsState());
        } else if (it.t === 'group' && it.m) {
          // повёрнутый блок: матрица задана в координатах страницы (ось Y вниз), а здесь Y вверх —
          // переводим: T = F·M·F⁻¹, где F(x, y) = (x, H − y)
          const [a, b, c, d, e, f] = it.m;
          page.pushOperators(pushGraphicsState(), concatTransformationMatrix(a, -b, -c, d, c * H + e, H - d * H - f));
          await draw(it.items);
          page.pushOperators(popGraphicsState());
        } else if (it.t === 'group') { // часть блока через корешок — обрезаем по краю полосы
          const c = it.clip;
          page.pushOperators(pushGraphicsState(), rectangle(c.x, H - c.y - c.h, c.w, c.h), clip(), endPath());
          await draw(it.items);
          page.pushOperators(popGraphicsState());
        }
      } };
      await draw(items);
      page.pushOperators(popGraphicsState());
    }

    // служебные линии — в мм от низа-лева листа
    const L = (x1, y1, x2, y2, w, c, dash) => page.drawLine({
      start: { x: (off + x1) * K, y: (off + y1) * K }, end: { x: (off + x2) * K, y: (off + y2) * K },
      thickness: w * K, color: c, dashArray: dash?.map((d) => d * K),
    });
    const zine = side.type === 'zine';
    // надрез в центре листа — внутри, наружными метками его не показать, поэтому линия
    // рисуется в обоих режимах (раньше только для дома — в типографском PDF надреза не было)
    if (o.guides && zine) {
      const c = rgb(0.72, 0.72, 0.72);
      L(sf.w, SH / 2, sf.w * 3, SH / 2, 0.15, c, [1.2, 1]); // разрез
      for (const x of [sf.w, sf.w * 3]) { L(x - 1.2, SH / 2, x + 1.2, SH / 2, 0.15, c); L(x, SH / 2 - 1.2, x, SH / 2 + 1.2, 0.15, c); }
    }
    if (press && o.marks) {
      const c = rgb(0, 0, 0), a = bleed + 1, b = off - 1, t = 0.1;
      for (const [x, y, sx, sy] of [[0, 0, -1, -1], [SW, 0, 1, -1], [0, SH, -1, 1], [SW, SH, 1, 1]]) {
        L(x + sx * a, y, x + sx * b, y, t, c);
        L(x, y + sy * a, x, y + sy * b, t, c);
      }
      if (zine) {
        const d = [1, 0.8];
        for (const x of [sf.w, sf.w * 2, sf.w * 3]) { L(x, -a, x, -b, t, c, d); L(x, SH + a, x, SH + b, t, c, d); }
        L(-a, SH / 2, -b, SH / 2, t, c, d); L(SW + a, SH / 2, SW + b, SH / 2, t, c, d);
      }
    }
    // брошюра дома: метки сгиба у каждого разворота, пунктир разреза между разворотами
    if (sheet.bp && o.guides) {
      const c = rgb(0.72, 0.72, 0.72), { cols, rows, page: [pw, ph] } = sheet.bp;
      for (const cell of sheet.cells) {
        const fx = cell.x + pw, top = SH - cell.y, bot = SH - cell.y - ph; // в мм от низа листа
        L(fx, top, fx, top - 3, 0.15, c); L(fx, bot, fx, bot + 3, 0.15, c);
      }
      for (let i = 1; i < cols; i++) L(i * 2 * pw, 0, i * 2 * pw, SH, 0.15, c, [1.2, 1]);
      for (let i = 1; i < rows; i++) L(0, SH - i * ph, SW, SH - i * ph, 0.15, c, [1.2, 1]);
    }
    }
  }
  return pdf.save();
}
