// Écran du téléphone : inscription, dessin, propositions
const $ = (id) => document.getElementById(id);
const AVATARS = ['🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐝', '🐢', '🐧', '🦖', '🐨', '🐵', '🔨', '💡', '🎨', '🚀'];
let monId = localStorage.getItem('croquizz-id');
let avatar = localStorage.getItem('croquizz-avatar') || AVATARS[Math.floor(Math.random() * AVATARS.length)];
let etat = null, inscrit = false;

// ---- Inscription ----
$('nom').value = localStorage.getItem('croquizz-nom') || '';
$('avatars').innerHTML = AVATARS.map((a) => `<button type="button" class="${a === avatar ? 'actif' : ''}">${a}</button>`).join('');
$('avatars').onclick = (e) => {
  if (e.target.tagName !== 'BUTTON') return;
  avatar = e.target.textContent;
  [...$('avatars').children].forEach((b) => b.classList.toggle('actif', b === e.target));
};
const params = new URLSearchParams(location.search);
const codeInvite = (params.get('salon') || '').toUpperCase();
let monSalon = localStorage.getItem('croquizz-salon') || '';
if (codeInvite) {
  $('bloc-rejoindre-code').hidden = false; $('bloc-choix-partie').hidden = true;
  $('code-invite').textContent = codeInvite;
  if (codeInvite !== monSalon) monId = null; // nouvelle partie : nouveau joueur
}
function nomValide() {
  const nom = $('nom').value.trim();
  if (!nom) { $('nom').focus(); $('nom').classList.add('secoue'); setTimeout(() => $('nom').classList.remove('secoue'), 500); return null; }
  localStorage.setItem('croquizz-nom', nom); localStorage.setItem('croquizz-avatar', avatar);
  $('erreur').textContent = '';
  return nom;
}
function entrer(type, salon) {
  const nom = nomValide(); if (!nom) return;
  inscrit = true;
  serveur.envoyer({ t: type, salon, id: type === 'creer' ? null : (salon === monSalon ? monId : null), nom, avatar });
}
$('btn-creer').onclick = () => entrer('creer', '');
$('btn-rejoindre').onclick = () => {
  const code = $('code').value.trim().toUpperCase();
  if (code.length !== 4) { $('erreur').textContent = 'Le code fait 4 lettres, il est affiché sur la télé.'; return; }
  entrer('rejoindre', code);
};
$('btn-rejoindre-invite').onclick = () => entrer('rejoindre', codeInvite);

const serveur = connecter(recevoir, (api) => {
  // reconnexion automatique si on était déjà dans une partie
  const salon = codeInvite || monSalon;
  if (inscrit || (monId && salon && salon === monSalon)) { inscrit = true; api.envoyer({ t: 'rejoindre', salon, id: monId, nom: localStorage.getItem('croquizz-nom'), avatar }); }
});

function montrer(id) { document.querySelectorAll('.ecran').forEach((s) => (s.hidden = s.id !== id)); }

function recevoir(m) {
  if (m.t === 'bienvenue') {
    monId = m.id; monSalon = m.salon;
    localStorage.setItem('croquizz-id', m.id); localStorage.setItem('croquizz-salon', m.salon);
    history.replaceState(null, '', '?salon=' + m.salon); // pour retrouver la partie si on recharge la page
    envoyerCodeTele();
    return;
  }
  if (m.t === 'erreur') { inscrit = false; $('erreur').textContent = m.texte; montrer('ecran-inscription'); return; }
  if (m.t === 'temps') { $('chrono-d').textContent = $('chrono-g').textContent = m.restant; document.body.classList.toggle('urgence', m.restant <= 10); return; }
  if (m.t === 'resultat') { retour(m); return; }
  if (m.t === 'traits') { traits = m.traits; toutRedessiner(ctx, traits); return; }
  if (m.t === 'son') { if (m.nom === 'trouve' && navigator.vibrate) navigator.vibrate(80); return; }
  if (m.t !== 'etat') return;
  if (!inscrit || !m.moi) { montrer('ecran-inscription'); return; }
  const avant = etat; etat = m;
  const moi = m.joueurs.find((j) => j.id === m.moi);
  const jeDessine = m.dessinateur === m.moi;
  const dessinateur = m.joueurs.find((j) => j.id === m.dessinateur);
  const suisHote = m.hote === m.moi;

  if (m.phase === 'accueil') {
    montrer('ecran-accueil');
    $('code-salon').textContent = m.salon;
    $('liste-attente').innerHTML = m.joueurs.map((j) => `<li>${j.avatar} ${echapper(j.nom)}${j.id === m.hote ? ' <small>(hôte)</small>' : ''}${j.id === m.moi ? ' <small>← toi</small>' : ''}</li>`).join('');
    $('reglages').hidden = !suisHote; $('attente-hote').hidden = suisHote;
    if (suisHote) {
      if ($('theme').options.length !== m.themes.length) $('theme').innerHTML = m.themes.map((t) => `<option>${echapper(t)}</option>`).join('');
      $('theme').value = m.theme; $('tours').value = m.toursParJoueur;
      const assez = m.joueurs.filter((j) => j.connecte).length >= 2;
      $('btn-demarrer').disabled = !assez;
      $('aide-demarrer').textContent = assez ? '' : 'Il faut au moins 2 joueurs.';
    }
  }
  else if (m.phase === 'choix') {
    if (jeDessine) {
      montrer('ecran-choix');
      $('cartes').innerHTML = (m.propositions || []).map((p, i) =>
        `<button class="carte ${p.niveau}" data-i="${i}"><span>${NIVEAUX[p.niveau].emoji} ${NIVEAUX[p.niveau].nom}</span><b>${echapper(p.mot)}</b><em>${p.points} pts</em></button>`).join('');
    } else {
      montrer('ecran-patience');
      $('patience-avatar').textContent = dessinateur?.avatar || '🤔';
      $('patience-texte').textContent = `${dessinateur?.nom || '…'} choisit un mot…`;
    }
  }
  else if (m.phase === 'dessin') {
    if (jeDessine) {
      if (avant?.phase !== 'dessin') { montrer('ecran-dessin'); traits = []; requestAnimationFrame(redimensionner); }
      $('mot-a-dessiner').textContent = m.motSecret;
      $('liste-valider').innerHTML = m.joueurs.filter((j) => j.id !== m.moi && j.connecte)
        .map((j) => `<button data-id="${j.id}" class="${m.trouves.includes(j.id) ? 'fait' : ''}">${j.avatar} ${echapper(j.nom)}${m.trouves.includes(j.id) ? ' ✓' : ''}</button>`).join('');
    } else {
      montrer('ecran-deviner');
      if (avant?.phase !== 'dessin') { $('retour').textContent = ''; $('proposition').value = ''; }
      $('qui-dessine').textContent = `${dessinateur?.avatar || ''} ${dessinateur?.nom || ''} dessine`;
      $('masque').textContent = m.masque;
      const trouve = m.trouves.includes(m.moi);
      $('form-proposition').hidden = trouve; $('bravo').hidden = !trouve;
    }
    $('chrono-d').textContent = $('chrono-g').textContent = m.restant;
  }
  else if (m.phase === 'revelation') {
    montrer('ecran-revelation'); document.body.classList.remove('urgence');
    $('mot-revele').textContent = m.mot;
    const g = m.gains[m.moi];
    $('mon-gain').innerHTML = g ? `<span class="plus">+${g} points</span>` : (jeDessine ? 'Personne n\'a trouvé 😅' : 'Pas trouvé cette fois 😅');
    $('classement').innerHTML = classement(m);
    $('btn-suivant').hidden = !(jeDessine || suisHote);
  }
  else if (m.phase === 'podium') {
    montrer('ecran-podium');
    const rang = [...m.joueurs].sort((a, b) => b.score - a.score).findIndex((j) => j.id === m.moi);
    $('ma-place').textContent = ['🥇', '🥈', '🥉'][rang] || '👏';
    $('classement-final').innerHTML = classement(m);
    $('btn-rejouer').hidden = $('btn-retour-accueil').hidden = !suisHote;
  }
}

const classement = (m) => [...m.joueurs].sort((a, b) => b.score - a.score)
  .map((j, i) => `<li class="${j.id === m.moi ? 'moi' : ''}"><span>${i + 1}. ${j.avatar} ${echapper(j.nom)}</span><b>${j.score}${m.gains[j.id] && m.phase === 'revelation' ? ` <small>+${m.gains[j.id]}</small>` : ''}</b></li>`).join('');

// ---- Salle d'attente ----
$('theme').onchange = $('tours').onchange = () => serveur.envoyer({ t: 'reglages', theme: $('theme').value, tours: +$('tours').value });
$('btn-demarrer').onclick = () => serveur.envoyer({ t: 'demarrer', theme: $('theme').value, tours: +$('tours').value });
$('cartes').onclick = (e) => { const c = e.target.closest('.carte'); if (c) serveur.envoyer({ t: 'choisir', idx: +c.dataset.i }); };
$('btn-suivant').onclick = () => serveur.envoyer({ t: 'suivant' });
$('btn-rejouer').onclick = () => serveur.envoyer({ t: 'demarrer' });
$('btn-retour-accueil').onclick = () => serveur.envoyer({ t: 'accueil' });

// ---- Propositions ----
$('form-proposition').onsubmit = (e) => {
  e.preventDefault();
  const texte = $('proposition').value.trim();
  if (!texte) return;
  serveur.envoyer({ t: 'proposition', texte });
  $('proposition').value = '';
};
function retour(m) {
  const r = $('retour');
  r.className = 'retour ' + (m.ok ? 'ok' : m.presque ? 'presque' : 'non');
  r.textContent = m.ok ? 'Trouvé !' : m.presque ? '🔥 Tu chauffes, presque !' : '❌ Non, essaie encore';
  if (!m.ok && navigator.vibrate) navigator.vibrate(m.presque ? [40, 40, 40] : 30);
}

// ---- Dessin ----
const canvas = $('feuille'), ctx = canvas.getContext('2d');
let traits = [], couleur = COULEURS[0], epaisseur = 0.018, enCours = null, enAttente = [];
$('palette').innerHTML = COULEURS.map((c, i) => `<button style="background:${c}" data-c="${c}" class="${i === 0 ? 'actif' : ''}"></button>`).join('');
$('palette').onclick = (e) => {
  if (!e.target.dataset.c) return;
  couleur = e.target.dataset.c;
  [...$('palette').children].forEach((b) => b.classList.toggle('actif', b === e.target));
};
document.querySelectorAll('.taille').forEach((b) => (b.onclick = () => {
  epaisseur = +b.dataset.w;
  document.querySelectorAll('.taille').forEach((x) => x.classList.toggle('actif', x === b));
}));
$('btn-annuler').onclick = () => { traits.pop(); toutRedessiner(ctx, traits); serveur.envoyer({ t: 'annuler' }); };
$('btn-effacer').onclick = () => { if (!traits.length) return; traits = []; toutRedessiner(ctx, traits); serveur.envoyer({ t: 'effacer' }); };
$('btn-fin').onclick = () => { if (confirmerFin()) serveur.envoyer({ t: 'finManche' }); };
function confirmerFin() {
  const b = $('btn-fin');
  if (b.dataset.confirme) { delete b.dataset.confirme; b.textContent = '✋ Fin de manche'; return true; }
  b.dataset.confirme = 1; b.textContent = 'Touchez encore pour révéler le mot';
  setTimeout(() => { delete b.dataset.confirme; b.textContent = '✋ Fin de manche'; }, 3000);
  return false;
}
$('liste-valider').onclick = (e) => { const b = e.target.closest('button'); if (b && !b.classList.contains('fait')) serveur.envoyer({ t: 'valider', id: b.dataset.id }); };

function redimensionner() {
  const z = $('zone-canvas');
  ajusterCanvas(canvas, z.clientWidth, z.clientHeight);
  toutRedessiner(ctx, traits);
}
window.addEventListener('resize', () => { if (!$('ecran-dessin').hidden) redimensionner(); });

const point = (e) => { const r = canvas.getBoundingClientRect(); return [+((e.clientX - r.left) / r.width).toFixed(4), +((e.clientY - r.top) / r.height).toFixed(4)]; };
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault(); canvas.setPointerCapture(e.pointerId);
  const p = point(e);
  enCours = { c: couleur, w: epaisseur, p: [p] };
  traits.push(enCours); dessinerTrait(ctx, enCours);
  serveur.envoyer({ t: 'trait', etape: 'debut', c: couleur, w: epaisseur, p });
});
canvas.addEventListener('pointermove', (e) => {
  if (!enCours) return;
  e.preventDefault();
  const evts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  const n = enCours.p.length;
  for (const ev of evts) { const p = point(ev); enCours.p.push(p); enAttente.push(p); }
  dessinerTrait(ctx, enCours, n);
});
const finTrait = () => { envoyerAttente(); enCours = null; };
canvas.addEventListener('pointerup', finTrait);
canvas.addEventListener('pointercancel', finTrait);
// on envoie les points par paquets (environ 30 fois par seconde) pour rester fluide
function envoyerAttente() { if (enAttente.length) { serveur.envoyer({ t: 'trait', etape: 'suite', p: enAttente }); enAttente = []; } }
setInterval(envoyerAttente, 33);

// ---- Installation (PWA) ----
let invitation = null;
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); invitation = e; $('btn-installer').hidden = false; });
$('btn-installer').onclick = async () => { if (!invitation) return; invitation.prompt(); await invitation.userChoice; invitation = null; $('btn-installer').hidden = true; };
if ('serviceWorker' in navigator && window.isSecureContext) navigator.serviceWorker.register('sw.js');

// ---- Bouton Cast (Chromecast) ----
const ESPACE_CAST = 'urn:x-cast:fr.croquizz';
let adresseJeu = location.origin;
fetch('/infos').then((r) => r.json()).then(({ adresse, castAppId }) => {
  adresseJeu = adresse;
  aideCast();
  if (!castAppId) return;
  window.__onGCastApiAvailable = (dispo) => {
    if (!dispo) return;
    const ctxCast = cast.framework.CastContext.getInstance();
    ctxCast.setOptions({ receiverApplicationId: castAppId, autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
    ctxCast.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (e) => {
      if (e.sessionState === 'SESSION_STARTED' || e.sessionState === 'SESSION_RESUMED') envoyerCodeTele();
    });
    // le bouton n'apparaît que si un Chromecast est trouvé sur le Wi-Fi
    ctxCast.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, aideCast);
    aideCast();
  };
  const sc = document.createElement('script');
  sc.src = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';
  document.head.appendChild(sc);
});
function etatCast() { try { return cast.framework.CastContext.getInstance().getCastState(); } catch (e) { return null; } }
function aideCast() {
  const e = etatCast();
  const dispo = e && e !== 'NO_DEVICES_AVAILABLE';
  $('cast-dispo').hidden = !dispo;
  const lien = adresseJeu.replace(/^https?:\/\//, '') + '/tv?salon=' + (monSalon || '');
  $('cast-aide').innerHTML = e === 'CONNECTED' ? '📺 Le jeu est affiché sur la télé !'
    : dispo ? `Touche le bouton pour envoyer le jeu sur le Chromecast.<br>Sinon, ouvre sur la télé : <b>${echapper(lien)}</b>`
      : `Pour afficher le jeu, ouvre sur la télé : <b>${echapper(lien)}</b>`;
}
function envoyerCodeTele() {
  aideCast();
  try {
    const session = cast.framework.CastContext.getInstance().getCurrentSession();
    if (session && monSalon) session.sendMessage(ESPACE_CAST, { salon: monSalon });
  } catch (e) { /* pas de Chromecast */ }
}
