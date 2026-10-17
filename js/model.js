// Модель документа, форматы и геометрия. Все размеры — в миллиметрах.

import { t, getLang } from './i18n.js?v=407f23c4';

export const PT = 25.4 / 72; // мм в одном пункте

// page — размер полосы зина (1/8 листа), margin — поля полосы.
// 5 мм на A4 — с запасом под непропечатываемый край лазерного принтера (~4.2 мм).
// s — множитель типографской шкалы.
// booklet — брошюра на скрепке: лист складывается пополам, страница — его половина
// (A4 -> A5, A3 -> A4, Letter -> ½ Letter); поля шире — до скрепки и обреза
export const FORMATS = {
  A4: { sheet: [297, 210], page: [74.25, 105], margin: 5, s: 1, poster: { margin: 10, s: 1.6 }, booklet: { margin: 12, s: 1.25, name: 'A5' } },
  A3: { sheet: [420, 297], page: [105, 148.5], margin: 7, s: 1.3, poster: { margin: 14, s: 2.1 }, booklet: { margin: 15, s: 1.45, name: 'A4' } },
  // US Letter 8.5×11": в США и Канаде печатают на нём, а не на A4
  Letter: { sheet: [279.4, 215.9], page: [69.85, 107.95], margin: 5, s: 1, poster: { margin: 10, s: 1.6 }, booklet: { margin: 12, s: 1.25, name: '½ Letter' } },
};

// Брошюра: страниц кратно 4 (на листе брошюры 4 страницы — по 2 с каждой стороны)
export const BOOKLET_PAGES = { min: 8, max: 64, def: 8 };

// Брошюра: размер страницы и как развороты ложатся на печатный лист (cols × rows разворотов).
// Больше одного разворота — после печати лист режется на части, каждая — лист брошюры.
// A4/A5 — разворот во весь лист A3/A4; A6 — два на A4 (книжный), A7 — четыре на A4 (альбомный).
export const BOOKLET_SIZES = {
  A4: { name: 'A4', page: [210, 297], paper: 'A3', cols: 1, rows: 1, margin: 15, s: 1.45 },
  A5: { name: 'A5', page: [148.5, 210], paper: 'A4', cols: 1, rows: 1, margin: 12, s: 1.25 },
  A6: { name: 'A6', page: [105, 148.5], paper: 'A4', cols: 1, rows: 2, margin: 8, s: 1.1 },
  A7: { name: 'A7', page: [74.25, 105], paper: 'A4', cols: 2, rows: 2, margin: 6, s: 1 },
  HL: { name: '½ Letter', page: [139.7, 215.9], paper: 'Letter', cols: 1, rows: 1, margin: 12, s: 1.25 },
  QL: { name: '¼ Letter', page: [107.95, 139.7], paper: 'Letter', cols: 1, rows: 2, margin: 8, s: 1.1 },
};
export const bookletSize = (doc) => BOOKLET_SIZES[doc.booklet] || BOOKLET_SIZES.A5;

// Бумага брошюры: толщина листа, мм — от неё зависят поле у корешка и выползание.
// Толщины — типичные для офисной/мелованной бумаги этой плотности.
export const STOCKS = { 80: 0.10, 100: 0.12, 120: 0.14, 150: 0.17 };
export const stockT = (doc) => STOCKS[doc.stock] || STOCKS[80];

// Поле у корешка (мм сверх обычного поля). Брошюра на скобе раскрывается не до конца, и тем хуже,
// чем она толще: 2% ширины страницы + толщина блока (листов × толщина бумаги), шаг 0,5 мм.
// A5 на 8 страниц — 3 мм, на 64 — 4,5; A4 на 64 — 6. doc.gutter — ручное значение (null — авто)
export function autoGutter(doc) {
  return Math.round((bookletSize(doc).page[0] * 0.02 + (pageCount(doc, 0) / 4) * stockT(doc)) * 2) / 2;
}
export const gutterOf = (doc) => (doc.gutter == null ? autoGutter(doc) : doc.gutter);

// Выползание: при сложении внутренние листы выступают наружу; центральный — на (листов × толщина)
// (общепринятая оценка «страниц / 4 × толщина»). Компенсация — сдвиг листа i (0 — внешний,
// с обложками) к корешку, линейно от 0 до этой величины. В PDF и для дома, и для типографии
// (цифровая печать обычно печатает как есть, без своей компенсации).
export function creepOf(doc, si, pi) {
  const n = pageCount(doc, si), S = n / 4;
  if (S < 2) return 0;
  const i = Math.floor(Math.min(pi, n - 1 - pi) / 2);
  return (S * stockT(doc) * i) / (S - 1);
}

// Импозиция 8-полосного зина на альбомном листе 4×2:
// [индекс полосы, колонка, ряд, повёрнута на 180°]
//   5↻ 4↻ 3↻ 2↻
//   6  7  8  1
export const IMPOSITION = [
  [4, 0, 0, 1], [3, 1, 0, 1], [2, 2, 0, 1], [1, 3, 0, 1],
  [5, 0, 1, 0], [6, 1, 1, 0], [7, 2, 1, 0], [0, 3, 1, 0],
];
export const SPREADS = [[0], [1, 2], [3, 4], [5, 6], [7]];
// «Обложки вместе»: на листе задняя (8) и передняя (1) лежат рядом в одном ряду и не повёрнуты —
// после сгиба это одна поверхность, фон может переходить с одной на другую без шва
export const SPREADS_JOINED = [[7, 0], [1, 2], [3, 4], [5, 6]];

// Сетки [колонки, ряды]; первая в списке после стандарта — по возрастанию плотности
export const GRIDS = {
  zine: [[2, 3], [2, 4], [3, 4], [3, 6], [4, 4], [4, 6], [3, 8], [4, 8], [3, 10], [4, 10]],
  booklet: [[2, 4], [3, 6], [4, 6], [4, 8], [3, 10], [4, 10], [6, 10], [6, 12]],
  square: [[2, 2], [2, 3], [3, 3], [3, 4], [4, 4], [4, 5], [5, 5], [6, 6]],
  poster: [[2, 4], [3, 6], [3, 8], [4, 8], [3, 10], [4, 10], [6, 8]],
};
export const GRID_DEF = { zine: [3, 6], poster: [3, 8], booklet: [4, 8], square: [3, 3] };

// Кегль подстраивается под плотность сетки: реже сетка — крупнее шрифт.
// Нижняя граница 0.9 — основной текст на A7 не мельче ~7.2 pt.
function typeK(kind, cols, rows) {
  const [c0, r0] = GRID_DEF[kind];
  return Math.max(0.9, Math.min(1.35, Math.sqrt(r0 / rows) * Math.pow(c0 / cols, 0.25)));
}

// Краски: ризограф-цвета — зин в две краски выглядит как напечатанный на ризо
export const INKS = [
  ['#000000', 'чёрный'], ['#0078bf', 'синий'], ['#ff48b0', 'флуо-розовый'], ['#f15060', 'красный'],
  ['#00a95c', 'зелёный'], ['#ff6c2f', 'оранжевый'], ['#ffe800', 'жёлтый'], ['#00838a', 'бирюзовый'],
  ['#765ba7', 'фиолетовый'], ['#914e72', 'бордовый'],
];

// Системная краска: серые плюс те же ризо-цвета
export const META_INKS = [['#6b6b6b', 'серый'], ['#9a9a9a', 'светло-серый'], ...INKS];

// Оттенки бумаги для фона листа
export const PAPERS = [
  ['#ffffff', 'белая'], ['#f4efe3', 'кремовая'], ['#e8e7e3', 'серая'], ['#d9c4a0', 'крафт'],
  ['#f7ecb5', 'жёлтая'], ['#f6d9d5', 'розовая'], ['#d7e3ee', 'голубая'], ['#dde8d6', 'мятная'],
];

// Размеры в ячейках сетки (99 = на всю ширину/высоту): w/h — по умолчанию, minW/minH — минимум, maxH — максимум по высоте
export const BLOCKS = {
  heading:  { name: 'Заголовок', w: 99, h: 1, minW: 1, minH: 1, maxH: 3, def: () => ({ text: t('Заголовок'), size: 'L', align: 'left' }) },
  text:     { name: 'Текст', w: 99, h: 2, minW: 1, minH: 1, maxH: 99, def: () => ({ text: '', text2: '', text3: '', size: 'body', cols: 1 }) },
  // повёрнутые на 90° против часовой: читаются снизу вверх, строки идут слева направо
  vheading: { name: 'Вертикальный заголовок', w: 1, h: 4, minW: 1, minH: 2, maxH: 99, def: () => ({ text: t('Заголовок'), size: 'L', align: 'left' }) },
  vtext:    { name: 'Вертикальный текст', w: 2, h: 4, minW: 1, minH: 2, maxH: 99, def: () => ({ text: '', size: 'body' }) },
  quote:    { name: 'Цитата', w: 99, h: 2, minW: 2, minH: 1, maxH: 4, def: () => ({ text: '', by: '' }) },
  image:    { name: 'Картинка', w: 99, h: 3, minW: 1, minH: 1, maxH: 99, def: () => ({ asset: null, zoom: 1, px: 0.5, py: 0.5, filter: 'gray', grain: 0.4 }) },
  imagecap: { name: 'Картинка с подписью', w: 99, h: 3, minW: 1, minH: 2, maxH: 99, def: () => ({ asset: null, zoom: 1, px: 0.5, py: 0.5, filter: 'gray', grain: 0.4, caption: '' }) },
  divider:  { name: 'Разделитель', w: 99, h: 1, minW: 1, minH: 1, maxH: 1, def: () => ({ style: 'squares' }) },
  qr:       { name: 'QR-код', w: 99, h: 2, minW: 1, minH: 1, maxH: 3, def: () => ({ url: 'https://', caption: '' }) },
};

export const uid = () => Math.random().toString(36).slice(2, 9);

// g — прямоугольник на сетке {x, y, w, h}
export function mkBlock(type, g = {}, props = {}) {
  const d = BLOCKS[type];
  return { id: uid(), type, x: 0, y: 0, w: Math.min(d.w, 3), h: d.h, ...g, ...d.def(), ...props };
}

// ---------- сетка ----------

const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export function canRect(page, sf, r, exceptId) {
  return r.x >= 0 && r.y >= 0 && r.x + r.w <= sf.cols && r.y + r.h <= sf.rows
    && !page.blocks.some((b) => b.id !== exceptId && hit(b, r));
}

// Варианты размера от желаемого вниз до минимума, крупные первыми
function sizes(type, sf, pw, ph) {
  const d = BLOCKS[type], out = [];
  for (let h = d.minH; h <= Math.min(ph, d.maxH, sf.rows); h++)
    for (let w = d.minW; w <= Math.min(pw, sf.cols); w++) out.push({ w, h });
  return out.sort((a, b) => b.w * b.h - a.w * a.h || b.w - a.w);
}

// Прямоугольник, накрывающий ячейку (cx, cy): сначала желаемый размер, потом меньше
export function placeAt(page, sf, type, pw, ph, cx, cy, exceptId) {
  for (const s of sizes(type, sf, pw, ph))
    for (let dy = 0; dy < s.h; dy++)
      for (let dx = 0; dx < s.w; dx++) {
        const r = { x: cx - dx, y: cy - dy, ...s };
        if (canRect(page, sf, r, exceptId)) return r;
      }
  return null;
}

// Первое свободное место в порядке чтения
export function placeFree(page, sf, type, pw, ph, exceptId) {
  for (const s of sizes(type, sf, pw, ph))
    for (let y = 0; y < sf.rows; y++)
      for (let x = 0; x < sf.cols; x++) {
        const r = { x, y, ...s };
        if (canRect(page, sf, r, exceptId)) return r;
      }
  return null;
}

// Раздвигание при перетаскивании: поставить прямоугольник r ровно туда, куда бросили, а блоки,
// которые мешают, сдвинуть каскадом вниз (или вверх — если внизу не хватает места). Пустые ряды
// не схлопываем: двигается только то, что задето. Последний вариант — уплотнить блоки к верху.
// Возвращает {id: y} для сдвинутых блоков или null, если в сетку не помещается.
const hitR = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function cascade(items, r, rows, dir) {
  const placed = [r];
  const order = [...items].sort((a, b) => dir * (a.y - b.y) || a.x - b.x);
  for (const it of order) {
    for (let c; (c = placed.find((p) => hitR(p, it)));) it.y = dir > 0 ? c.y + c.h : c.y - it.h;
    if (it.y < 0 || it.y + it.h > rows) return false;
    placed.push(it);
  }
  return true;
}
export function pushPlan(page, sf, r, exceptId) {
  const base = page.blocks.filter((b) => b.id !== exceptId);
  const plans = [];
  for (const dir of [1, -1]) {
    const items = base.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h }));
    if (cascade(items, r, sf.rows, dir)) plans.push(items);
  }
  if (!plans.length) { // уплотнить к верху всё, кроме нового места
    const items = base.map((b) => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h })).sort((a, b) => a.y - b.y || a.x - b.x);
    const placed = [r];
    for (const it of items) {
      it.y = 0;
      for (let c; (c = placed.find((p) => hitR(p, it)));) it.y = c.y + c.h;
      if (it.y + it.h > sf.rows) return null;
      placed.push(it);
    }
    plans.push(items);
  }
  // из годных вариантов — где блоки сдвинулись меньше всего
  const cost = (items) => items.reduce((a, it) => a + Math.abs(it.y - base.find((b) => b.id === it.id).y), 0);
  const best = plans.sort((a, b) => cost(a) - cost(b))[0];
  const out = {};
  for (const it of best) if (it.y !== base.find((b) => b.id === it.id).y) out[it.id] = it.y;
  return out;
}

// Прилипание краёв (b.ex = {t, r, b, l}): край блока перешагивает промежуток сетки и встаёт
// вплотную к краю соседнего ряда/колонки (к соседнему блоку). Ячейки при этом не занимает.
// Нельзя у края сетки и если тот же промежуток уже занят встречным краем соседа.
export const EDGES = ['t', 'r', 'b', 'l'];
const OPP = { t: 'b', b: 't', l: 'r', r: 'l' };
export function exValid(page, sf, b, e) {
  if (e === 't' && b.y <= 0) return false;
  if (e === 'b' && b.y + b.h >= sf.rows) return false;
  if (e === 'l' && b.x <= 0) return false;
  if (e === 'r' && b.x + b.w >= sf.cols) return false;
  const overX = (o) => o.x < b.x + b.w && o.x + o.w > b.x, overY = (o) => o.y < b.y + b.h && o.y + o.h > b.y;
  return !page.blocks.some((o) => o.id !== b.id && o.ex?.[OPP[e]] && (
    (e === 't' && o.y + o.h === b.y && overX(o)) || (e === 'b' && o.y === b.y + b.h && overX(o)) ||
    (e === 'l' && o.x + o.w === b.x && overY(o)) || (e === 'r' && o.x === b.x + b.w && overY(o))));
}
// Убрать ставшие невозможными прилипания (после переноса, смены размера); пустое ex — удалить
export function fixEx(page, sf, b) {
  if (!b.ex) return;
  for (const e of EDGES) if (!b.ex[e] || !exValid(page, sf, b, e)) delete b.ex[e];
  if (!EDGES.some((e) => b.ex[e])) delete b.ex;
}

export const sortBlocks = (page) => page.blocks.sort((a, b) => a.y - b.y || a.x - b.x);

const emptyPages = () => Array.from({ length: 8 }, () => ({ blocks: [] }));
const mkSide = (type) => ({ type, pages: emptyPages(), poster: { orient: 'portrait', blocks: [] } });

// Letter — для браузеров из США, Канады, Мексики и Филиппин, иначе A4
const defaultFormat = () =>
  (/-(US|CA|MX|PH)$/i.test((typeof navigator !== 'undefined' && navigator.language) || '') ? 'Letter' : 'A4');

export function blankDoc() {
  return {
    v: 1,
    title: t('Без названия'),
    format: defaultFormat(),
    fonts: { heading: 'unbounded', body: 'ibm-plex-sans' },
    colors: { ink: '#000000', accent: '#ff48b0', meta: '#6b6b6b' }, // основная, акцентная и системная краска
    paper: '#ffffff',   // цвет листа
    paperPrint: true,   // false — цвет только в превью (печать на цветной бумаге)
    hf: {
      header: { on: false, left: '{title}', center: '', right: '' },
      footer: { on: true, left: '{title}', center: '', right: '{nn}' },
      skipCovers: true,
      mirror: true, // зеркально на разворотах
      rule: false,
    },
    sides: [mkSide('zine'), mkSide('none')],
  };
}

// Новая брошюра на скрепке: n страниц (кратно 4), лист format складывается пополам
export function blankBooklet(size, n = BOOKLET_PAGES.def) {
  const d = blankDoc();
  d.booklet = size;
  d.format = BOOKLET_SIZES[size].paper; // формат бумаги — для зина, если переключиться обратно
  d.sides[0] = { ...mkSide('booklet'), pages: Array.from({ length: n }, () => ({ blocks: [] })) };
  return d;
}

// Сменить вид страниц зина (классическая / квадратная): страницы без своей сетки получают сетку
// по умолчанию нового вида, блоки пересчитываются; если не влезают — остаётся прежняя сетка
export function setShape(doc, shape) {
  const before = doc.sides.map((s, si) => (s.type === 'zine' ? s.pages.map((_, pi) => pageSf(doc, si, pi)) : null));
  doc.shape = shape;
  doc.sides.forEach((s, si) => {
    if (s.type !== 'zine') return;
    s.pages.forEach((p, pi) => {
      if (p.grid) return;
      const from = before[si][pi], to = pageSf(doc, si, pi);
      if (from.cols === to.cols && from.rows === to.rows) return;
      const blocks = remapGrid(p, from, to);
      if (blocks) p.blocks = blocks; else p.grid = [from.cols, from.rows];
    });
  });
}

// Брошюра: перестроить число страниц (новые встают перед задней обложкой, лишние — с конца, кроме неё)
export function setBookletPages(doc, n) {
  const s = doc.sides[0], last = s.pages[s.pages.length - 1];
  const inner = s.pages.slice(1, -1);
  while (inner.length < n - 2) inner.push({ blocks: [] });
  inner.length = n - 2;
  s.pages = [s.pages[0], ...inner, last];
  s.spreadBg = {}; s.spreadGrid = {}; // развороты сдвинулись — общие фоны и сетки сбрасываем
}

// Дописывает недостающие поля (старые сохранения, импорт)
export function normalize(d) {
  const b = blankDoc();
  const doc = { ...b, ...d, fonts: { ...b.fonts, ...d.fonts }, colors: { ...b.colors, ...d.colors }, hf: { ...b.hf, ...d.hf } };
  doc.hf.header = { ...b.hf.header, ...(d.hf?.header || {}) };
  doc.hf.footer = { ...b.hf.footer, ...(d.hf?.footer || {}) };
  // системная краска раньше хранилась как 'gray' | 'ink' | 'accent'
  const m = doc.colors.meta;
  if (!/^#/.test(m || '')) doc.colors.meta = m === 'ink' ? doc.colors.ink : m === 'accent' ? doc.colors.accent : '#6b6b6b';
  delete doc.hf.color;
  doc.sides = [0, 1].map((i) => {
    const s = { ...b.sides[i], ...(d.sides?.[i] || {}) };
    // у зина всегда 8 страниц, у брошюры — сколько сохранено (кратно 4)
    const n = s.type === 'booklet' ? Math.max(BOOKLET_PAGES.min, Math.ceil((s.pages?.length || 0) / 4) * 4) : 8;
    s.pages = Array.from({ length: n }, (_, k) => s.pages?.[k] || { blocks: [] });
    s.poster = { orient: 'portrait', blocks: [], ...(s.poster || {}) };
    [...s.pages, s.poster].forEach(migratePage);
    // общий фон обложек раньше лежал в coverBg — теперь это фон разворота 8–1
    s.spreadBg = { ...(s.spreadBg || {}) };
    s.spreadGrid = { ...(s.spreadGrid || {}) };
    if (s.coverBg) { s.spreadBg[7] ||= s.coverBg; delete s.coverBg; }
    return s;
  });
  // ранние бета-брошюры: размер задавался листом (A4 → A5, A3 → A4, Letter → ½ Letter)
  if (doc.sides[0].type === 'booklet' && !BOOKLET_SIZES[doc.booklet]) doc.booklet = { A4: 'A5', A3: 'A4', Letter: 'HL' }[doc.format] || 'A5';
  return doc;
}

// v1: блоки стопкой на всю ширину с полем rows, «пустое место» — отдельный блок.
// Переводим на сетку: стопка -> x=0, w=3, spacer -> пустые ячейки.
function migratePage(page) {
  let y = 0;
  const out = [];
  for (const b of page.blocks) {
    if (b.x !== undefined) { out.push(b); continue; }
    const { rows, ...rest } = b;
    if (b.type !== 'spacer') out.push({ ...rest, x: 0, y, w: 3, h: rows || 1 });
    y += rows || 1;
  }
  // раньше колонки текста были перетеканием одного текста; теперь у каждой своё поле —
  // старые блоки без text2 возвращаем в одну колонку, чтобы текст не обрезался
  for (const b of out) if (b.type === 'text' && b.cols > 1 && b.text2 === undefined) b.cols = 1;
  page.blocks = out.filter((b) => BLOCKS[b.type]);
}

// Квадратный зин из одного листа (doc.shape = 'square'): та же схема 4 × 2 и один надрез,
// но страница — квадрат со стороной в четверть длинной стороны листа (A4 — 74,25 мм, A3 — 105).
// Ряды прижаты к верхнему краю, нижняя полоса листа отрезается перед сгибом и выбрасывается.
export const isSquare = (doc) => doc.shape === 'square' && doc.sides.some((s) => s.type === 'zine');
export const squareSide = (doc) => FORMATS[doc.format].sheet[0] / 4;
// Рабочая часть листа квадратного зина (без отрезаемой полосы)
export const squareArea = (doc) => [FORMATS[doc.format].sheet[0], squareSide(doc) * 2];

export function surface(doc, si) {
  const F = FORMATS[doc.format];
  const side = doc.sides[si];
  if (side.type === 'poster') {
    // постер на обороте квадратного зина — по рабочей части листа (альбомный), иначе его разрежет отрез
    if (isSquare(doc)) { const [w, h] = squareArea(doc); return { kind: 'poster', w, h, margin: F.poster.margin, s: F.poster.s }; }
    const [a, b] = F.sheet;
    const [w, h] = side.poster.orient === 'landscape' ? [a, b] : [b, a];
    return { kind: 'poster', w, h, margin: F.poster.margin, s: F.poster.s };
  }
  if (isSquare(doc) && side.type === 'zine') { const q = squareSide(doc); return { kind: 'square', w: q, h: q, margin: F.margin, s: F.s }; }
  if (side.type === 'booklet') { const b = bookletSize(doc); return { kind: 'booklet', w: b.page[0], h: b.page[1], margin: b.margin, s: b.s }; }
  return { kind: 'zine', w: F.page[0], h: F.page[1], margin: F.margin, s: F.s };
}

// Параметры конкретной полосы: сетка, лимит блоков, множитель кегля
export function pageSf(doc, si, pi) {
  const base = surface(doc, si);
  const [cols, rows] = getPage(doc, si, pi).grid || GRID_DEF[base.kind];
  const cells = cols * rows;
  const maxBlocks = base.kind === 'poster' ? Math.max(6, Math.ceil(cells / 2)) : Math.max(base.kind === 'booklet' ? 6 : 4, Math.ceil(cells / 3));
  return { ...base, cols, rows, maxBlocks, k: typeK(base.kind, cols, rows) };
}

// Перенос блоков на другую сетку: пропорционально, с досадкой в свободные места.
// null — если какой-то блок не помещается (сетка слишком мелкая для содержимого).
export function remapGrid(page, from, to) {
  const out = { blocks: [] };
  const sx = to.cols / from.cols, sy = to.rows / from.rows;
  const order = [...page.blocks].sort((a, b) => b.w * b.h - a.w * a.h);
  for (const b of order) {
    const d = BLOCKS[b.type];
    const w = Math.max(d.minW, Math.min(to.cols, Math.round(b.w * sx)));
    const h = Math.max(d.minH, Math.min(d.maxH, to.rows, Math.round(b.h * sy)));
    const r = { x: Math.min(to.cols - w, Math.round(b.x * sx)), y: Math.min(to.rows - h, Math.round(b.y * sy)), w, h };
    const got = canRect(out, to, r) ? r
      : placeAt(out, to, b.type, w, h, r.x, r.y) || placeFree(out, to, b.type, w, h);
    if (!got) return null;
    out.blocks.push({ ...b, ...got });
  }
  sortBlocks(out);
  return out.blocks;
}

export const getPage = (doc, si, pi) =>
  doc.sides[si].type === 'poster' ? doc.sides[si].poster : doc.sides[si].pages[pi];

// Многостраничные стороны: зин (8 страниц) и брошюра (сколько угодно, кратно 4)
export const isPaged = (doc, si) => doc.sides[si].type === 'zine' || doc.sides[si].type === 'booklet';
// Обложки показаны разворотом (у зина и брошюры)
export const coversJoined = (doc, si) => isPaged(doc, si) && !!doc.sides[si].joinCovers;
// Обложки — первая и последняя страница
export const isCover = (doc, si, pi) => pi === 0 || pi === pageCount(doc, si) - 1;
export const lastPage = (doc, si) => pageCount(doc, si) - 1;
// Развороты: обложка, пары внутренних страниц, задняя обложка (или обе обложки вместе)
export function spreads(doc, si) {
  if (doc.sides[si].type === 'zine') return coversJoined(doc, si) ? SPREADS_JOINED : SPREADS;
  const n = pageCount(doc, si), inner = [];
  for (let p = 1; p < n - 1; p += 2) inner.push([p, p + 1]);
  return coversJoined(doc, si) ? [[n - 1, 0], ...inner] : [[0], ...inner, [n - 1]];
}

// Брошюра: раскладка на листы для домашней печати (двусторонней, переворот по короткому краю).
// Лист i: лицо — [n−1−2i | 2i], оборот — [2i+1 | n−2−2i]. Сложенные стопкой и сшитые по сгибу,
// листы дают страницы по порядку.
// Печатные листы брошюры для дома: на стороне листа — cols × rows разворотов (листов брошюры).
// Оборот зеркалится по горизонтали: при двусторонней печати лист переворачивается вокруг
// вертикальной оси (альбомный — по короткому краю, книжный — по длинному).
export function bookletPrint(doc) {
  const b = bookletSize(doc), n = pageCount(doc, 0), [pw, ph] = b.page;
  const SW = b.cols * 2 * pw, SH = b.rows * ph, per = b.cols * b.rows;
  const bs = bookletSheets(n), count = n / 4, out = [];
  for (let j = 0; j < Math.ceil(count / per); j++) for (const back of [false, true]) {
    const cells = [];
    for (let k = 0; k < per && j * per + k < count; k++) {
      const i = j * per + k, c = k % b.cols, r = Math.floor(k / b.cols);
      const x = back ? SW - (c + 1) * 2 * pw : c * 2 * pw;
      cells.push({ sheet: i, x, y: r * ph, pages: bs[i * 2 + (back ? 1 : 0)].pages });
    }
    out.push({ phys: j, back, cells });
  }
  return { sheets: out, size: [SW, SH], page: [pw, ph], per, cols: b.cols, rows: b.rows, flip: SW > SH ? 'short' : 'long', paper: b.paper };
}

export function bookletSheets(n) {
  const out = [];
  for (let i = 0; i < n / 4; i++) {
    out.push({ sheet: i, back: false, pages: [n - 1 - 2 * i, 2 * i] });
    out.push({ sheet: i, back: true, pages: [2 * i + 1, n - 2 - 2 * i] });
  }
  return out;
}

// Разворот, в котором сейчас стоит полоса: [левая, правая] или null.
// Внутренние развороты — всегда; обложки — только в режиме «вместе».
// На листе обе полосы любого такого разворота лежат рядом и повёрнуты одинаково — фон идёт без шва.
export function pairOf(doc, si, pi) {
  if (!isPaged(doc, si)) return null;
  const sp = spreads(doc, si).find((s) => s.includes(pi));
  return sp && sp.length === 2 ? sp : null;
}

// Общая сетка разворота (опция side.spreadGrid[левая полоса]): пара [левая, правая] или null.
// Блоки такого разворота лежат на левой полосе, x — в колонках обеих полос (0 … 2·cols−1).
export function spreadGridOf(doc, si, pi) {
  const p = pairOf(doc, si, pi);
  return p && doc.sides[si].spreadGrid?.[p[0]] ? p : null;
}

// Включить общую сетку: правая полоса получает сетку левой, её блоки переезжают вправо.
// false — если блоки правой полосы не помещаются в сетку левой.
export function joinSpreadGrid(doc, si, pair) {
  const [l, r] = pair, side = doc.sides[si];
  const A = pageSf(doc, si, l), B = pageSf(doc, si, r);
  const right = side.pages[r];
  const blocks = A.cols === B.cols && A.rows === B.rows ? right.blocks : remapGrid(right, B, A);
  if (!blocks) return false;
  side.pages[l].blocks.push(...blocks.map((b) => ({ ...b, x: b.x + A.cols })));
  sortBlocks(side.pages[l]);
  right.blocks = [];
  right.grid = [A.cols, A.rows];
  (side.spreadGrid ||= {})[l] = true;
  return true;
}

// Выключить общую сетку: блоки правой половины возвращаются на правую полосу;
// блок через корешок остаётся на той полосе, где его больше, и обрезается по ней.
export function splitSpreadGrid(doc, si, pair) {
  const [l, r] = pair, side = doc.sides[si];
  const c = pageSf(doc, si, l).cols;
  const L = side.pages[l], R = side.pages[r];
  const cross = [], keep = [], lost = [];
  for (const b of L.blocks) {
    if (b.x >= c) R.blocks.push({ ...b, x: b.x - c });
    else if (b.x + b.w <= c) keep.push(b);
    else cross.push(b);
  }
  L.blocks = keep;
  for (const b of cross) {
    const inL = c - b.x, inR = b.x + b.w - c, min = BLOCKS[b.type].minW;
    const toR = inR > inL;
    const pg = toR ? R : L, w = Math.max(min, toR ? inR : inL);
    const want = { x: toR ? 0 : c - w, y: b.y, w, h: b.h };
    const sf = { cols: c, rows: pageSf(doc, si, l).rows };
    const got = canRect(pg, sf, want) ? want : placeAt(pg, sf, b.type, w, b.h, want.x, want.y) || placeFree(pg, sf, b.type, w, b.h);
    if (got) pg.blocks.push({ ...b, ...got });
    else lost.push(b);
  }
  sortBlocks(L); sortBlocks(R);
  delete side.spreadGrid[l];
  return lost; // блоки, которым не нашлось места (полосы заполнены)
}

// Общий фон разворота (side.spreadBg[левая полоса]) или null
export function spreadBgOf(doc, si, pi) {
  const p = pairOf(doc, si, pi);
  return p ? doc.sides[si].spreadBg?.[p[0]] || null : null;
}

// Какой фон редактируется на полосе: у обложек «вместе» — всегда общий; во внутреннем
// развороте — общий, если он задан (или его сейчас загружают: want === 'spread'), иначе — фон страницы
export function bgHost(doc, si, pi, want) {
  const p = pairOf(doc, si, pi), s = doc.sides[si];
  if (p && (isCover(doc, si, pi) || s.spreadBg?.[p[0]] || want === 'spread')) return { obj: (s.spreadBg ||= {}), key: String(p[0]), spread: true };
  return { obj: getPage(doc, si, pi), key: 'bg', spread: false };
}

export const pageCount = (doc, si) =>
  doc.sides[si].type === 'booklet' ? doc.sides[si].pages.length : ({ zine: 8, poster: 1, none: 0 })[doc.sides[si].type];

export function findBlock(doc, id) {
  for (let si = 0; si < 2; si++) {
    const side = doc.sides[si];
    const lists = side.type === 'poster' ? [side.poster] : side.type === 'zine' || side.type === 'booklet' ? side.pages : [];
    for (let pi = 0; pi < lists.length; pi++) {
      const idx = lists[pi].blocks.findIndex((b) => b.id === id);
      if (idx >= 0) return { si, pi, idx, page: lists[pi], block: lists[pi].blocks[idx] };
    }
  }
  return null;
}

export function pageLabel(doc, si, pi) {
  if (doc.sides[si].type === 'poster') return t('Постер');
  if (pi === 0) return t('1 · обложка');
  if (pi === lastPage(doc, si)) return t('{n} · задняя обложка', { n: pi + 1 });
  return String(pi + 1);
}

// Пример-зин: объясняет сам себя. Текст на языке интерфейса.
export function sampleDoc(sampleAsset, lang = getLang()) {
  const L = (ru, en) => (lang === 'en' ? en : ru);
  const d = blankDoc();
  d.title = '10 minute zine';
  const P = d.sides[0].pages;
  const img = sampleAsset ? { asset: sampleAsset, filter: 'dither', grain: 0.35 } : {};
  const G = (x, y, w, h) => ({ x, y, w, h });
  P[0].blocks = [
    mkBlock('heading', G(0, 0, 3, 2), { text: L('Зин за десять минут', 'A zine in ten minutes'), size: 'L' }),
    mkBlock('image', G(0, 2, 3, 3), img),
    mkBlock('text', G(0, 5, 2, 1), { text: L('Выпуск №1\nосень 2026', 'Issue #1\nautumn 2026'), size: 'small' }),
  ];
  P[1].blocks = [
    mkBlock('heading', G(0, 0, 2, 1), { text: L('Что это', 'What is it'), size: 'M' }),
    mkBlock('image', G(2, 0, 1, 1), { ...img, px: 0.8, zoom: 1.6 }),
    mkBlock('text', G(0, 1, 3, 5), {
      text: L(
        'Зин — маленький самодельный журнал. Один лист бумаги, восемь страниц, никаких правил.\n\n' +
        'Здесь он собирается из готовых блоков: **заголовок**, текст, картинка, цитата. ' +
        'Размеры шрифтов уже подобраны под печать — просто наполняй.',
        'A zine is a tiny self-made magazine. One sheet of paper, eight pages, no rules.\n\n' +
        'Here you build it from ready-made blocks: **heading**, text, image, quote. ' +
        'Type sizes are already tuned for print — just fill it in.'),
    }),
  ];
  P[2].blocks = [
    mkBlock('quote', G(0, 0, 3, 2), { text: L('Сделано — лучше, чем идеально.', 'Done is better than perfect.'), by: L('правило зинов', 'the zine rule') }),
    mkBlock('text', G(0, 2, 2, 4), {
      text: L(
        'Страница — сетка 3 × 6. Блок занимает прямоугольник из ячеек, пустые ячейки просто остаются воздухом.\n\n' +
        'В углу блока видно, сколько знаков в него *рекомендуется* поставить.',
        'A page is a 3 × 6 grid. A block takes a rectangle of cells; empty cells simply stay as air.\n\n' +
        'The corner of each block shows how many characters it *should* hold.'),
    }),
  ];
  P[3].blocks = [
    mkBlock('heading', G(0, 0, 3, 1), { text: L('Как собрать', 'How to make it'), size: 'M' }),
    mkBlock('text', G(0, 1, 3, 4), {
      text: L(
        '1. Перетащи блоки из левой панели.\n2. Вставь текст — можно сразу Markdown.\n3. Брось картинку на страницу.\n' +
        '4. Проверь лист целиком во вкладке «Лист».\n5. Скачай PDF и печатай.',
        '1. Drag blocks from the left panel.\n2. Paste text — Markdown works too.\n3. Drop an image onto the page.\n' +
        '4. Check the whole sheet in the “Sheet” tab.\n5. Download the PDF and print.'),
    }),
  ];
  P[4].blocks = [
    mkBlock('imagecap', G(0, 0, 3, 6), { ...img, px: 0.3, caption: L(
      'Растр превращает любое фото в графику, которую хорошо печатает лазерный принтер.',
      'Dithering turns any photo into graphics a laser printer handles well.') }),
  ];
  P[5].blocks = [
    mkBlock('heading', G(0, 0, 3, 1), { text: L('Как сложить', 'How to fold'), size: 'S' }),
    mkBlock('text', G(0, 1, 3, 4), {
      text: L(
        '- Сложи лист пополам по длинной стороне.\n- Разверни, сложи пополам по короткой, потом ещё раз.\n' +
        '- Разрежь по пунктиру в центре.\n- Сложи по длине и сдвинь концы навстречу.\n- Сплющи в книжку.',
        '- Fold the sheet in half lengthwise.\n- Unfold, fold in half widthwise, then once more.\n' +
        '- Cut along the dashed line in the middle.\n- Fold lengthwise and push the ends together.\n- Flatten into a booklet.'),
    }),
    mkBlock('divider', G(0, 5, 3, 1), { style: 'squares' }),
  ];
  P[6].blocks = [
    mkBlock('heading', G(0, 0, 3, 1), { text: L('Печать', 'Printing'), size: 'M' }),
    mkBlock('text', G(0, 1, 3, 4), {
      text: L(
        '**Дома:** A4 или US Letter, масштаб 100%, без «подгонки по размеру». Поля 5 мм сделаны с запасом для лазерного принтера.\n\n' +
        '**В типографии:** режим «Типография» добавит вылеты и метки реза.',
        '**At home:** A4 or US Letter, 100% scale, no “fit to page”. The 5 mm margins leave room for a laser printer.\n\n' +
        '**At a print shop:** the “Print shop” mode adds bleed and crop marks.'),
    }),
  ];
  P[7].blocks = [
    mkBlock('qr', G(0, 3, 3, 2), { url: 'https://10minutezine.com', caption: L('Сделано в 10 minute zine', 'Made with 10 minute zine') }),
    mkBlock('text', G(0, 5, 3, 1), { text: L('Приложение сделал Даниил Власенко\nШрифты — Google Fonts, лицензия OFL.', 'Application made by Daniil Vlasenko\nFonts — Google Fonts, OFL license.'), size: 'small' }),
  ];
  d.sides[1].poster.blocks = [
    mkBlock('heading', G(0, 0, 3, 2), { text: L('Постер на обороте', 'A poster on the back'), size: 'XL' }),
    mkBlock('image', G(0, 2, 2, 4), img),
    mkBlock('text', G(2, 2, 1, 4), { text: L(
      'Разверни зин — и на обороте окажется плакат.\n\nБлоки на постере так же встают на сетку 3 × 8.',
      'Unfold the zine and there is a poster on the back.\n\nPoster blocks snap to a 3 × 8 grid the same way.') }),
  ];
  return d;
}
