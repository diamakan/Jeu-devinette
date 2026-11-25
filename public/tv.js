// Écran de la télé : affiche les joueurs, le dessin en direct, les scores et le podium
const $ = (id) => document.getElementById(id);
const canvas = $('tv-feuille'), ctx = canvas.getContext('2d');
let traits = [], etat = null;

const serveur = connecter(recevoir, (api) => api.envoyer({ t: 'tele' }));

// Adresse + QR code à scanner
fetch('/infos').then((r) => r.json()).then(({ adresse }) => {
  $('adresse').textContent = adresse.replace('http://', '');
  if (window.qrcode) {
    const qr = qrcode(0, 'M'); qr.addData(adresse); qr.make();
    $('qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
  }
});

function montrer(id) { document.querySelectorAll('.tv-ecran').forEach((s) => (s.hidden = s.id !== id)); }

function recevoir(m) {
  switch (m.t) {
    case 'trait':
      if (m.etape === 'debut') { const t = { c: m.c, w: m.w, p: [m.p] }; traits.push(t); dessinerTrait(ctx, t); }
      else if (traits.length) { const t = traits[traits.length - 1], n = t.p.length; t.p.push(...m.p); dessinerTrait(ctx, t, n); }
      return;
    case 'traits': traits = m.traits; toutRedessiner(ctx, traits); return;
    case 'effacer': traits = []; toutRedessiner(ctx, traits); return;
    case 'temps': temps(m.restant); return;
    case 'son': jouer(m.nom); return;
    case 'etat': afficher(m); return;
  }
}

function afficher(m) {
  const avant = etat; etat = m;
  const dessinateur = m.joueurs.find((j) => j.id === m.dessinateur);
  if (m.phase === 'accueil') {
    montrer('tv-accueil');
    $('tv-joueurs').innerHTML = m.joueurs.length
      ? m.joueurs.map((j) => `<div class="tv-joueur arrive"><span>${j.avatar}</span>${echapper(j.nom)}</div>`).join('')
      : '<p class="petit">En attente des joueurs…</p>';
    $('tv-reglages').textContent = `Thème : ${m.theme} · ${m.toursParJoueur} tour(s) par joueur`;
    return;
  }
  if (m.phase === 'podium') { montrer('tv-podium'); podium(m); return; }

  montrer('tv-jeu');
  if (avant?.phase === 'accueil' || avant?.phase === 'podium' || !avant) redimensionner();
  $('tv-dessinateur').innerHTML = dessinateur ? `<span class="gros-emoji-petit">${dessinateur.avatar}</span> <b>${echapper(dessinateur.nom)}</b> dessine <small>· manche ${m.tour + 1}/${m.totalTours}</small>` : '';
  $('tv-masque').textContent = m.phase === 'dessin' ? m.masque : '';
  $('tv-masque').dataset.niveau = m.niveau || '';
  $('tv-choix').hidden = m.phase !== 'choix';
  $('tv-choix-avatar').textContent = dessinateur?.avatar || '';
  $('tv-choix-texte').textContent = `${dessinateur?.nom || ''} choisit un mot…`;
  $('tv-revelation').hidden = m.phase !== 'revelation';
  if (m.phase === 'revelation') {
    $('tv-mot').textContent = m.mot;
    const gains = m.joueurs.filter((j) => m.gains[j.id]).sort((a, b) => m.gains[b.id] - m.gains[a.id]);
    $('tv-gains').innerHTML = gains.length
      ? gains.map((j) => `<span class="gain">${j.avatar} ${echapper(j.nom)} <b>+${m.gains[j.id]}</b></span>`).join('')
      : '<span class="gain">Personne n\'a trouvé 😅</span>';
  }
  if (m.phase === 'dessin') temps(m.restant); else temps(null);
  $('tv-scores').innerHTML = [...m.joueurs].sort((a, b) => b.score - a.score).map((j) =>
    `<li class="${j.id === m.dessinateur ? 'dessine' : ''} ${m.trouves.includes(j.id) ? 'trouve' : ''} ${j.connecte ? '' : 'absent'}"><span>${j.avatar} ${echapper(j.nom)}${j.id === m.dessinateur ? ' ✏️' : m.trouves.includes(j.id) ? ' ✅' : ''}</span><b>${j.score}</b></li>`).join('');
  $('tv-fil').innerHTML = m.fil.map((f) => `<li class="${f.type}">${echapper(f.texte)}</li>`).join('');
}

function temps(restant) {
  if (restant == null) { $('tv-temps').textContent = ''; $('arc').style.strokeDashoffset = 0; document.body.classList.remove('urgence'); return; }
  $('tv-temps').textContent = restant;
  const tour = 2 * Math.PI * 16;
  $('arc').style.strokeDasharray = tour;
  $('arc').style.strokeDashoffset = tour * (1 - restant / (etat?.duree || 90));
  document.body.classList.toggle('urgence', restant <= 10);
}

function redimensionner() {
  const z = $('tv-zone');
  ajusterCanvas(canvas, z.clientWidth, z.clientHeight);
  z.style.setProperty('--cw', canvas.style.width); z.style.setProperty('--ch', canvas.style.height);
  toutRedessiner(ctx, traits);
}
window.addEventListener('resize', redimensionner);

// ---- Podium + confettis ----
function podium(m) {
  const tri = [...m.joueurs].sort((a, b) => b.score - a.score);
  const places = [tri[1], tri[0], tri[2]];
  $('podium').innerHTML = places.map((j, i) => j ? `<div class="marche m${[2, 1, 3][i]}"><div class="gros-emoji">${j.avatar}</div><b>${echapper(j.nom)}</b><span>${j.score} pts</span><div class="socle">${['🥈', '🥇', '🥉'][i]}</div></div>` : '<div></div>').join('');
  $('tv-autres').innerHTML = tri.slice(3).map((j, i) => `<li><span>${i + 4}. ${j.avatar} ${echapper(j.nom)}</span><b>${j.score}</b></li>`).join('');
  confettis();
}
function confettis() {
  const c = $('confettis'), x = c.getContext('2d');
  c.width = innerWidth; c.height = innerHeight;
  const parts = Array.from({ length: 180 }, () => ({ x: Math.random() * c.width, y: -Math.random() * c.height, v: 2 + Math.random() * 4, r: Math.random() * 6, c: COULEURS[Math.floor(Math.random() * 9)], a: Math.random() * 6 }));
  let n = 0;
  (function anim() {
    x.clearRect(0, 0, c.width, c.height);
    for (const p of parts) { p.y += p.v; p.a += 0.1; x.fillStyle = p.c; x.fillRect(p.x + Math.sin(p.a) * 10, p.y, 8, 14); }
    if (n++ < 400) requestAnimationFrame(anim); else x.clearRect(0, 0, c.width, c.height);
  })();
}

// ---- Sons (générés, aucun fichier nécessaire) ----
let audio = null;
document.addEventListener('click', () => { audio = audio || new (window.AudioContext || window.webkitAudioContext)(); $('son').hidden = true; });
function bip(freq, duree, debut = 0, type = 'sine', volume = 0.2) {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime + debut;
  o.type = type; o.frequency.value = freq; o.connect(g); g.connect(audio.destination);
  g.gain.setValueAtTime(volume, t); g.gain.exponentialRampToValueAtTime(0.001, t + duree);
  o.start(t); o.stop(t + duree);
}
function jouer(nom) {
  if (nom === 'tic') bip(880, 0.08, 0, 'square', 0.08);
  if (nom === 'trouve') { bip(660, 0.15); bip(990, 0.25, 0.12); }
  if (nom === 'revelation') { [523, 659, 784, 1047].forEach((f, i) => bip(f, 0.3, i * 0.12, 'triangle')); }
  if (nom === 'podium') { [523, 523, 659, 784, 659, 784, 1047].forEach((f, i) => bip(f, 0.35, i * 0.18, 'triangle')); }
}
