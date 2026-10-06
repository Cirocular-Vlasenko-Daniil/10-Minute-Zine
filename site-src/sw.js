// Офлайн-режим приложения (PWA). При установке кладёт в кэш всё, что нужно редактору:
// страницу, код, стили, шрифты, библиотеки, примеры. Дальше файлы отдаются из кэша, страница —
// сначала из сети (свежая версия), без сети — из кэша. Версия и список файлов подставляются
// при сборке (tools/package.py): вышла новая версия — новый кэш, старый удаляется.
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = 'zine-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('zine-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return; // счётчик и прочее чужое — мимо
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).catch(() =>
      caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match('/editor.html'))));
    return;
  }
  e.respondWith(caches.match(r).then((m) => m || fetch(r)));
});
