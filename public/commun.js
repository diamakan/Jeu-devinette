// Outils partagés entre le téléphone et la télé
const COULEURS = ['#1d1d1f', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#6d4c41', '#ec407a', '#ffffff'];
const RATIO = 1; // largeur / hauteur de la feuille de dessin (carré : idéal sur téléphone et télé)

function connecter(onMessage, onOuvert) {
  let ws, essais = 0;
  const api = { envoyer: (o) => ws && ws.readyState === 1 && ws.send(JSON.stringify(o)) };
  (function ouvrir() {
    ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
    ws.onopen = () => { essais = 0; document.body.classList.remove('hors-ligne'); onOuvert && onOuvert(api); };
    ws.onmessage = (e) => onMessage(JSON.parse(e.data));
    ws.onclose = () => { document.body.classList.add('hors-ligne'); setTimeout(ouvrir, Math.min(4000, 500 * ++essais)); };
  })();
  return api;
}

// Dessine un trait (coordonnées de 0 à 1) sur un canvas
function dessinerTrait(ctx, trait, depuis = 0) {
  const W = ctx.canvas.width, H = ctx.canvas.height, p = trait.p;
  ctx.strokeStyle = trait.c; ctx.fillStyle = trait.c;
  ctx.lineWidth = trait.w * W; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (p.length === 1) { ctx.beginPath(); ctx.arc(p[0][0] * W, p[0][1] * H, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); return; }
  ctx.beginPath();
  const i0 = Math.max(0, depuis - 1);
  ctx.moveTo(p[i0][0] * W, p[i0][1] * H);
  for (let i = i0 + 1; i < p.length; i++) ctx.lineTo(p[i][0] * W, p[i][1] * H);
  ctx.stroke();
}
function toutRedessiner(ctx, traits) {
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const t of traits) dessinerTrait(ctx, t);
}
// Ajuste la taille du canvas pour qu'il tienne dans son parent en gardant le format
function ajusterCanvas(canvas, maxW, maxH) {
  let w = maxW, h = w / RATIO;
  if (h > maxH) { h = maxH; w = h * RATIO; }
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
}
const echapper = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NIVEAUX = { facile: { nom: 'Facile', emoji: '🟢' }, moyen: { nom: 'Moyen', emoji: '🟠' }, difficile: { nom: 'Difficile', emoji: '🔴' } };
