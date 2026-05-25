/**
 * ════════════════════════════════════════════════════════════════
 *  KMKS SANTO HIERONIMUS — Service Worker (sw.js)
 *  Versi Cache : kmks-v4.1
 *  Strategi    : Cache-First untuk aset statis,
 *                Network-First untuk request ke Google Apps Script
 * ════════════════════════════════════════════════════════════════
 */

const CACHE_NAME    = 'kmks-v4.2';
const GAS_ORIGIN    = 'https://script.google.com';

// Aset yang langsung di-cache saat install
const ASSETS_PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// ── INSTALL: pre-cache semua aset utama ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_PRECACHE);
    })
  );
  // Langsung aktif tanpa menunggu tab lama ditutup
  self.skipWaiting();
});

// ── ACTIVATE: hapus cache lama ───────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── FETCH: strategi per tipe request ────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Request ke Google Apps Script → Network-First (jangan di-cache)
  if (url.origin === GAS_ORIGIN) {
    event.respondWith(networkOnly(request));
    return;
  }

  // 2. Request ke Google Fonts → Network-First dengan fallback cache
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // 3. Semua aset lokal → Cache-First
  event.respondWith(cacheFirst(request));
});

// ════════════════════════════════════════════════════════════════
//  STRATEGI
// ════════════════════════════════════════════════════════════════

/** Cache-First: cek cache dulu, kalau miss baru ke network */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // Offline & tidak ada di cache → kembalikan halaman utama (SPA fallback)
    return caches.match('./index.html');
  }
}

/** Network-First: coba network, kalau gagal pakai cache */
async function networkFirstWithCache(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || Response.error();
  }
}

/** Network-Only: tidak pernah cache (untuk GAS) */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch {
    return new Response(
      JSON.stringify({ status: 'error', pesan: 'Offline — tidak dapat terhubung ke server.' }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  }
}
