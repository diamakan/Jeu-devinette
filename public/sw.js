// Service worker : permet d'installer l'appli et garde les fichiers en mémoire.
// Le jeu a besoin du serveur pour jouer, mais l'appli s'ouvre plus vite.
const VERSION = 'croquizz-v1';
const FICHIERS = ['/', '/index.html', '/style.css', '/commun.js', '/telephone.js', '/manifest.webmanifest', '/icons/logo.svg', '/icons/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS))); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== VERSION).map((n) => caches.delete(n))))); self.clients.claim(); });
// Réseau d'abord (pour toujours avoir la dernière version), mémoire si pas de réseau
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => { const copie = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copie)); return r; }).catch(() => caches.match(e.request)));
});
