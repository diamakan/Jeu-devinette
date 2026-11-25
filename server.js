// Serveur du jeu : sert les pages et relie les téléphones à la télé en temps réel.
// Aucune installation nécessaire : lancez simplement  node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const MOTS = require('./mots.js');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DUREE_MANCHE = 90;              // secondes pour dessiner
const POINTS = { facile: 100, moyen: 200, difficile: 300 };
const BONUS_PREMIER = 50;

// ---------- Pages ----------
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };

const server = http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0]);
  if (url === '/') url = '/index.html';
  if (url === '/tv') url = '/tv.html';
  if (url === '/infos') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ adresse: adresseLocale(), themes: Object.keys(MOTS) })); }
  const file = path.normalize(path.join(PUBLIC, url));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Page introuvable'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

function adresseLocale() {
  for (const list of Object.values(os.networkInterfaces()))
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal) return `http://${i.address}:${PORT}`;
  return `http://localhost:${PORT}`;
}

// ---------- WebSocket minimal (sans dépendance) ----------
server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) return socket.destroy();
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  const client = { socket, send: (obj) => envoyerTrame(socket, JSON.stringify(obj)) };
  let buf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f, masque = buf[1] & 0x80;
      let len = buf[1] & 0x7f, pos = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); pos = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); pos = 10; }
      const total = pos + (masque ? 4 : 0) + len;
      if (buf.length < total) return;
      let data = buf.slice(pos + (masque ? 4 : 0), total);
      if (masque) { const m = buf.slice(pos, pos + 4); data = Buffer.from(data.map((b, i) => b ^ m[i % 4])); }
      buf = buf.slice(total);
      if (op === 8) { socket.end(); return; }
      if (op === 9) { const pong = Buffer.concat([Buffer.from([0x8a, data.length]), data]); socket.write(pong); continue; }
      if (op === 1) { try { recevoir(client, JSON.parse(data.toString())); } catch (e) { console.error('Message invalide', e.message); } }
    }
  });
  socket.on('close', () => deconnexion(client));
  socket.on('error', () => {});
});

function envoyerTrame(socket, texte) {
  if (socket.destroyed) return;
  const data = Buffer.from(texte);
  let entete;
  if (data.length < 126) entete = Buffer.from([0x81, data.length]);
  else if (data.length < 65536) { entete = Buffer.alloc(4); entete[0] = 0x81; entete[1] = 126; entete.writeUInt16BE(data.length, 2); }
  else { entete = Buffer.alloc(10); entete[0] = 0x81; entete[1] = 127; entete.writeBigUInt64BE(BigInt(data.length), 2); }
  socket.write(Buffer.concat([entete, data]));
}

// ---------- Jeu ----------
const joueurs = new Map();   // id -> {id, nom, avatar, score, client, connecte}
const teles = new Set();
const jeu = {
  phase: 'accueil',          // accueil | choix | dessin | revelation | podium
  theme: 'Maison & Bricolage', toursParJoueur: 1,
  ordre: [], tour: 0, dessinateur: null,
  propositions: [], mot: null, niveau: null,
  finAt: 0, trouves: [], gains: {}, traits: [], indices: [], fil: []
};
let minuteur = null;

const normaliser = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/œ/g, 'oe').replace(/[^a-z0-9]/g, '');
function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
const melanger = (t) => { t = [...t]; for (let i = t.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [t[i], t[j]] = [t[j], t[i]]; } return t; };
const hote = () => [...joueurs.values()].find((j) => j.connecte);

function masque() {
  if (!jeu.mot) return '';
  return [...jeu.mot].map((c, i) => (/[a-zA-Zà-üœ]/i.test(c) ? (jeu.indices.includes(i) ? c : '_') : c)).join('');
}

function etatPublic() {
  return {
    t: 'etat', phase: jeu.phase, theme: jeu.theme, themes: Object.keys(MOTS), toursParJoueur: jeu.toursParJoueur,
    hote: hote()?.id || null, dessinateur: jeu.dessinateur, niveau: jeu.niveau, points: POINTS,
    tour: jeu.tour, totalTours: jeu.ordre.length,
    masque: jeu.phase === 'dessin' ? masque() : null,
    mot: ['revelation', 'podium'].includes(jeu.phase) ? jeu.mot : null,
    restant: jeu.phase === 'dessin' ? Math.max(0, Math.round((jeu.finAt - Date.now()) / 1000)) : 0,
    duree: DUREE_MANCHE, trouves: jeu.trouves, gains: jeu.gains, fil: jeu.fil.slice(-8),
    joueurs: [...joueurs.values()].map(({ id, nom, avatar, score, connecte }) => ({ id, nom, avatar, score, connecte }))
  };
}

function diffuser() {
  const etat = etatPublic();
  for (const t of teles) t.send(etat);
  for (const j of joueurs.values()) if (j.client) {
    const perso = { ...etat, moi: j.id };
    if (j.id === jeu.dessinateur) { perso.motSecret = jeu.mot; if (jeu.phase === 'choix') perso.propositions = jeu.propositions; }
    j.client.send(perso);
  }
}
const versTeles = (msg) => { for (const t of teles) t.send(msg); };
const versTous = (msg) => { versTeles(msg); for (const j of joueurs.values()) j.client?.send(msg); };

function demarrer(theme, tours) {
  const ids = [...joueurs.values()].filter((j) => j.connecte).map((j) => j.id);
  if (ids.length < 2) return;
  jeu.theme = MOTS[theme] ? theme : jeu.theme;
  jeu.toursParJoueur = Math.min(3, Math.max(1, tours | 0 || 1));
  for (const j of joueurs.values()) j.score = 0;
  jeu.ordre = [];
  for (let r = 0; r < jeu.toursParJoueur; r++) jeu.ordre.push(...melanger(ids));
  jeu.tour = 0; jeu.dejaVus = new Set();
  nouvelleManche();
}

function nouvelleManche() {
  clearInterval(minuteur);
  // on saute les joueurs partis
  while (jeu.tour < jeu.ordre.length && !joueurs.get(jeu.ordre[jeu.tour])?.connecte) jeu.tour++;
  if (jeu.tour >= jeu.ordre.length) { jeu.phase = 'podium'; jeu.mot = null; diffuser(); versTous({ t: 'son', nom: 'podium' }); return; }
  jeu.dessinateur = jeu.ordre[jeu.tour];
  const liste = MOTS[jeu.theme];
  jeu.propositions = ['facile', 'moyen', 'difficile'].map((niveau) => {
    const dispo = liste[niveau].filter((m) => !jeu.dejaVus.has(m));
    const mot = (dispo.length ? dispo : liste[niveau])[Math.floor(Math.random() * (dispo.length || liste[niveau].length))];
    return { niveau, mot, points: POINTS[niveau] };
  });
  Object.assign(jeu, { phase: 'choix', mot: null, niveau: null, trouves: [], gains: {}, traits: [], indices: [], fil: [] });
  versTeles({ t: 'effacer' });
  diffuser();
}

function choisir(idx) {
  const p = jeu.propositions[idx];
  if (!p) return;
  jeu.mot = p.mot; jeu.niveau = p.niveau; jeu.dejaVus.add(p.mot);
  jeu.phase = 'dessin'; jeu.finAt = Date.now() + DUREE_MANCHE * 1000;
  const lettres = [...jeu.mot].map((c, i) => (/[a-zà-üœ]/i.test(c) ? i : -1)).filter((i) => i >= 0);
  const ordreIndices = melanger(lettres);
  let indicesDonnes = 0;
  minuteur = setInterval(() => {
    const restant = (jeu.finAt - Date.now()) / 1000;
    // Indices : une lettre à mi-temps, une autre à 25 s de la fin (si le mot est assez long)
    const voulu = restant < DUREE_MANCHE / 2 ? (restant < 25 && lettres.length > 5 ? 2 : 1) : 0;
    if (voulu > indicesDonnes && lettres.length > 3) { jeu.indices.push(ordreIndices[indicesDonnes++]); jeu.fil.push({ type: 'indice', texte: '💡 Indice : une lettre est révélée !' }); diffuser(); }
    if (restant <= 10 && restant > 0) versTeles({ t: 'son', nom: 'tic' });
    if (restant <= 0) finManche();
    else versTous({ t: 'temps', restant: Math.round(restant) });
  }, 1000);
  diffuser();
}

function attribuer(id) {
  const j = joueurs.get(id);
  if (!j || id === jeu.dessinateur || jeu.trouves.includes(id) || jeu.phase !== 'dessin') return;
  const base = POINTS[jeu.niveau];
  const rapidite = Math.max(0, (jeu.finAt - Date.now()) / (DUREE_MANCHE * 1000));
  let gain = base + Math.round(rapidite * 100);
  const premier = jeu.trouves.length === 0;
  if (premier) gain += BONUS_PREMIER;
  jeu.trouves.push(id);
  jeu.gains[id] = gain; j.score += gain;
  const d = joueurs.get(jeu.dessinateur);
  const gainDessin = Math.round(base / 2);
  if (d) { d.score += gainDessin; jeu.gains[d.id] = (jeu.gains[d.id] || 0) + gainDessin; }
  jeu.fil.push({ type: 'trouve', texte: `✅ ${j.avatar} ${j.nom} a trouvé !${premier ? ' (1er : +' + BONUS_PREMIER + ')' : ''}` });
  versTous({ t: 'son', nom: 'trouve' });
  const devineurs = [...joueurs.values()].filter((x) => x.connecte && x.id !== jeu.dessinateur);
  if (devineurs.every((x) => jeu.trouves.includes(x.id))) return finManche();
  diffuser();
}

function finManche() {
  if (jeu.phase !== 'dessin') return;
  clearInterval(minuteur);
  jeu.phase = 'revelation';
  versTous({ t: 'son', nom: 'revelation' });
  diffuser();
}

function recevoir(client, m) {
  if (m.t === 'tele') { client.role = 'tele'; teles.add(client); client.send(etatPublic()); client.send({ t: 'traits', traits: jeu.traits }); return; }

  if (m.t === 'rejoindre') {
    let j = m.id && joueurs.get(m.id);
    if (!j) {
      const nom = String(m.nom || '').trim().slice(0, 14) || 'Joueur';
      j = { id: crypto.randomUUID(), nom, avatar: String(m.avatar || '🙂').slice(0, 4), score: 0 };
      joueurs.set(j.id, j);
      if (jeu.phase !== 'accueil' && jeu.phase !== 'podium') jeu.ordre.push(j.id); // arrivé en cours : il dessinera plus tard
    }
    if (j.client && j.client !== client) j.client.socket.destroy();
    j.client = client; j.connecte = true; client.joueur = j;
    client.send({ t: 'bienvenue', id: j.id });
    diffuser();
    if (jeu.phase === 'dessin' && j.id === jeu.dessinateur) client.send({ t: 'traits', traits: jeu.traits });
    return;
  }

  const j = client.joueur;
  if (!j) return;
  const estDessinateur = j.id === jeu.dessinateur;
  const estHote = hote()?.id === j.id;

  switch (m.t) {
    case 'reglages': if (estHote && jeu.phase === 'accueil') { if (MOTS[m.theme]) jeu.theme = m.theme; jeu.toursParJoueur = Math.min(3, Math.max(1, m.tours | 0)); diffuser(); } break;
    case 'demarrer': if (estHote && (jeu.phase === 'accueil' || jeu.phase === 'podium')) demarrer(m.theme || jeu.theme, m.tours || jeu.toursParJoueur); break;
    case 'choisir': if (estDessinateur && jeu.phase === 'choix') choisir(m.idx); break;
    case 'trait': if (estDessinateur && jeu.phase === 'dessin') {
      // m.etape: 'debut' {c, w, p:[x,y]} | 'suite' {p:[[x,y]...]}
      if (m.etape === 'debut') jeu.traits.push({ c: m.c, w: m.w, p: [m.p] });
      else if (m.etape === 'suite' && jeu.traits.length) jeu.traits[jeu.traits.length - 1].p.push(...m.p);
      versTeles(m);
    } break;
    case 'annuler': if (estDessinateur) { jeu.traits.pop(); versTeles({ t: 'traits', traits: jeu.traits }); } break;
    case 'effacer': if (estDessinateur) { jeu.traits = []; versTeles({ t: 'effacer' }); } break;
    case 'proposition': if (jeu.phase === 'dessin' && !estDessinateur && !jeu.trouves.includes(j.id)) {
      const essai = String(m.texte || '').slice(0, 40).trim();
      if (!essai) break;
      const a = normaliser(essai), b = normaliser(jeu.mot);
      if (a === b) { client.send({ t: 'resultat', ok: true }); attribuer(j.id); }
      else {
        const presque = b.length >= 4 && distance(a, b) <= (b.length > 7 ? 2 : 1);
        client.send({ t: 'resultat', ok: false, presque });
        jeu.fil.push({ type: 'essai', texte: `${j.avatar} ${j.nom} : ${essai}` });
        diffuser();
      }
    } break;
    case 'valider': if (estDessinateur) attribuer(m.id); break;            // le dessinateur valide à la main (réponse dite à voix haute)
    case 'finManche': if (estDessinateur) finManche(); break;              // bouton « Fin de manche »
    case 'suivant': if ((estDessinateur || estHote) && jeu.phase === 'revelation') { jeu.tour++; nouvelleManche(); } break;
    case 'accueil': if (estHote && jeu.phase === 'podium') { jeu.phase = 'accueil'; diffuser(); } break;
  }
}

function deconnexion(client) {
  teles.delete(client);
  const j = client.joueur;
  if (!j || j.client !== client) return;
  j.client = null; j.connecte = false;
  if (jeu.phase === 'accueil') joueurs.delete(j.id);
  // tout le monde est parti : on remet le jeu à zéro
  if (![...joueurs.values()].some((x) => x.connecte)) { clearInterval(minuteur); joueurs.clear(); jeu.phase = 'accueil'; jeu.dessinateur = null; jeu.traits = []; diffuser(); return; }
  if (j.id === jeu.dessinateur && jeu.phase === 'choix') { jeu.tour++; nouvelleManche(); return; }
  if (j.id === jeu.dessinateur && jeu.phase === 'dessin') { finManche(); return; }
  diffuser();
}

server.listen(PORT, () => {
  const a = adresseLocale();
  console.log('\n  🎨  Le jeu est lancé !\n');
  console.log('  📺  Sur la télé (ou l\'ordinateur branché à la télé) ouvrez :  ' + a + '/tv');
  console.log('  📱  Sur chaque téléphone (même Wi-Fi) ouvrez :              ' + a + '\n');
});
