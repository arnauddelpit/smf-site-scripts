/**
 * Smuf astronaute du hero (data-smf-fly="astronaut") : il traverse l'écran de gauche à droite en suivant une courbe
 * de Bézier fluide, pivote pour suivre la trajectoire (tête devant, pieds derrière) et laisse derrière lui une traînée d'étoiles
 * (etoile.svg, assets Webflow) de tailles variées qui rétrécissent jusqu'à disparaître.
 * Le blob lumineux (data-smf-fly-blob) l'accompagne : il entre et sort de l'écran en même temps que lui.
 * Un seul vol, au chargement de la page (l'astronaute et le blob sont masqués en CSS avant d'entrer par la gauche) ;
 * il est mis en pause si le hero sort de l'écran.
 * reduced-motion : rien ne bouge, l'astronaute et le blob restent à leur place dans la page.
 */
import { onViewport } from '../utils/viewport.js';

const STAR = 'https://cdn.prod.website-files.com/6ae8b90dbeb201293a031771/6af1ddfde3fea74ad80547ae_etoile.svg';
const STAR_SIZES = [10, 14, 18, 24, 32, 42];
const POOL = 48;
const RISE = 200; // px : toute la trajectoire est remontée de cette valeur par rapport au calque Figma
const SPEED = 280; // px d'écran par seconde d'animation : durée du vol = largeur de la page / SPEED (5 s minimum)
const DESCENT_BOOST = 0.3; // 0 = vitesse constante ; plus la valeur est grande, plus les descentes sont rapides et les montées lentes
const BODY_TILT = 25; // degrés : inclinaison du corps du Smuf « astro » au repos (tête vers la droite)

/**
 * Trajectoire dessinée dans Figma (calque « trajectoire » de la page d'accueil, frame 1920 px de large, repère du frame) :
 * entre en haut à gauche, plonge sous le titre, remonte légèrement à hauteur de la vidéo, puis redescend vers le bas à droite.
 * x est proportionnel à la largeur de la page ; y est calé sur la vidéo (haut de la vidéo = 184, bas = 682 dans Figma).
 */
const TRAJECTORY = [
  [[-18, 183.5], [-3.3, 344.4], [155.4, 689], [674.5, 689]],
  [[674.5, 689], [1202, 689], [1207, 576], [1470, 574.5]],
  [[1470, 574.5], [1680.4, 573.3], [1867, 641], [1974.5, 742.5]],
];
const FIGMA_W = 1920;
const FIGMA_REEL = [184, 682];

/**
 * Courbe échantillonnée finement. Chaque échantillon reçoit un temps cumulé : la vitesse dépend un peu de la pente
 * (descente = plus rapide, montée = plus lente), y vers le bas.
 */
function buildPath(segments, perSegment = 60) {
  // segments : courbes de Bézier cubiques [[x,y] × 4] mises bout à bout
  const samples = [];
  for (const [a, b, c, d] of segments) {
    for (let s = 0; s < perSegment; s += 1) {
      const t = s / perSegment;
      const u = 1 - t;
      const f = (i) => u * u * u * a[i] + 3 * u * u * t * b[i] + 3 * u * t * t * c[i] + t * t * t * d[i];
      samples.push({ x: f(0), y: f(1) });
    }
  }
  const end = segments[segments.length - 1][3];
  samples.push({ x: end[0], y: end[1] });
  let total = 0;
  samples[0].t = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    const len = Math.hypot(dx, dy) || 1e-6;
    const speed = Math.max(0.3, 1 + DESCENT_BOOST * (dy / len)); // dy/len : +1 en plongée, -1 en montée
    total += len / speed;
    samples[i].t = total;
  }
  return { samples, total };
}

/** Position (centre) et direction à l'instant normalisé u ∈ [0, 1] du vol. */
function sampleAt({ samples, total }, u) {
  const target = u * total;
  let lo = 0;
  let hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= target) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[hi];
  const k = b.t === a.t ? 0 : (target - a.t) / (b.t - a.t);
  const ahead = samples[Math.min(samples.length - 1, hi + 4)];
  const behind = samples[Math.max(0, lo - 4)];
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, dx: ahead.x - behind.x, dy: ahead.y - behind.y };
}

export function init([el], { gsap, env }) {
  const section = el.closest('section');
  if (!section) return;
  // Blob lumineux : centré sur l'astronaute pendant tout le vol, il apparaît / disparaît avec lui aux bords de l'écran.
  const blob = section.querySelector('[data-smf-fly-blob]');

  // L'astronaute et le blob sont masqués en CSS (pas d'apparition avant l'entrée) : sans animation, on les montre en place.
  if (env.reducedMotion) {
    gsap.set([el, blob].filter(Boolean), { autoAlpha: 1 });
    return;
  }

  // section_hero est un contexte d'empilement (isolation) : -1 = derrière tout le contenu du hero, bulles comprises
  if (blob) blob.style.zIndex = '-1';

  // Couche des étoiles, sous l'astronaute (même z-index, placée avant dans le DOM)
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:1';
  section.prepend(layer);
  const free = [];
  for (let i = 0; i < POOL; i += 1) {
    const star = document.createElement('img');
    star.src = STAR;
    star.alt = '';
    star.decoding = 'async';
    star.style.cssText = 'position:absolute;left:0;top:0;display:none;max-width:none;will-change:transform,opacity';
    layer.append(star);
    free.push(star);
  }

  function spawnStar(x, y, dirX, dirY) {
    const star = free.pop();
    if (!star) return;
    const size = STAR_SIZES[Math.floor(Math.random() * STAR_SIZES.length)];
    const life = 0.9 + Math.random() * 0.9;
    star.style.display = 'block';
    star.style.width = `${size}px`;
    star.style.height = `${size}px`;
    gsap.fromTo(
      star,
      { x: x - size / 2, y: y - size / 2, scale: 1, opacity: 1, rotation: Math.random() * 90 - 45 },
      {
        x: x - size / 2 - dirX * (20 + Math.random() * 30) + (Math.random() - 0.5) * 24,
        y: y - size / 2 - dirY * (20 + Math.random() * 30) + (Math.random() - 0.5) * 24,
        scale: 0,
        opacity: 0,
        rotation: `+=${Math.random() * 120 - 60}`,
        duration: life,
        ease: 'power1.in',
        onComplete: () => {
          star.style.display = 'none';
          free.push(star);
        },
      },
    );
  }

  const state = { p: 0 };
  let flight = null;
  let rot = null;
  let lastStar = { x: 0, y: 0 };

  function fly() {
    const W = section.clientWidth;
    const H = section.clientHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!el.offsetParent || !W) return;
    const baseLeft = el.offsetLeft;
    const baseTop = el.offsetTop;
    // Trajectoire du calque Figma « trajectoire » : x proportionnel à la largeur de la page, y calé sur la hauteur de la vidéo.
    const sr = section.getBoundingClientRect();
    const reelEl = section.querySelector('[data-smf-vimeo]');
    const rr = reelEl ? reelEl.getBoundingClientRect() : null;
    const reelT = rr ? rr.top - sr.top : H * 0.12;
    const reelH = rr ? rr.height : H * 0.75;
    const toX = (x) => (x / FIGMA_W) * W;
    const toY = (y) => reelT + ((y - FIGMA_REEL[0]) / (FIGMA_REEL[1] - FIGMA_REEL[0])) * reelH - RISE;
    const segments = TRAJECTORY.map((seg) => seg.map(([x, y]) => [toX(x), toY(y)]));
    // Approche : le Smuf arrive de hors écran (à gauche, au-dessus du point de départ) avant de rejoindre la courbe
    const start = segments[0][0];
    segments.unshift([[-w, start[1] - 90], [-w * 0.5, start[1] - 70], [start[0] - 30, start[1] - 25], start]);
    // Sortie : la courbe se prolonge en ligne droite jusqu'à ce que le Smuf soit entièrement hors de l'écran
    const lastSeg = segments[segments.length - 1];
    const end = lastSeg[3];
    const dirX = end[0] - lastSeg[2][0];
    const dirY = end[1] - lastSeg[2][1];
    if (end[0] < W + w && dirX > 0) {
      const k = (W + w - end[0]) / dirX;
      const tail = [end[0] + dirX * k, end[1] + dirY * k];
      segments.push([end, [end[0] + (tail[0] - end[0]) / 3, end[1] + (tail[1] - end[1]) / 3], [end[0] + ((tail[0] - end[0]) * 2) / 3, end[1] + ((tail[1] - end[1]) * 2) / 3], tail]);
    }
    const path = buildPath(segments);

    const blobBase = blob ? { x: blob.offsetLeft, y: blob.offsetTop } : null;

    state.p = 0;
    rot = null;
    lastStar = { x: segments[0][0][0] - w / 2, y: segments[0][0][1] - h / 2 };
    gsap.set(el, { autoAlpha: 1 });

    flight = gsap.to(state, {
      p: 1,
      duration: Math.max(5, W / SPEED),
      ease: 'none', // le rythme (descentes rapides, montées lentes) vient de la trajectoire elle-même
      onUpdate: () => {
        const c = sampleAt(path, state.p);
        const pos = { x: c.x - w / 2, y: c.y - h / 2 };
        const dx = c.dx;
        const dy = c.dy;
        const len = Math.hypot(dx, dy) || 1;
        // Tête devant, pieds derrière : le Smuf est dessiné avec le corps incliné de ~25° vers le bas (tête à droite)
        const target = (Math.atan2(dy, dx) * 180) / Math.PI - BODY_TILT;
        rot = rot === null ? target : rot + (target - rot) * 0.15;
        gsap.set(el, { x: pos.x - baseLeft, y: pos.y - baseTop, rotation: rot });
        if (blob) {
          // Centré sur l'astronaute ; opaque dès qu'il est à ~220 px du bord, invisible quand son centre touche le bord
          const cx = pos.x + w / 2;
          const edge = Math.max(0, Math.min(1, Math.min(cx, W - cx) / 220));
          gsap.set(blob, { x: cx - blobBase.x, y: pos.y + h / 2 - blobBase.y, autoAlpha: edge });
        }

        // Étoiles : une toutes les ~26 px parcourues, derrière l'astronaute, légèrement décalées
        if (Math.hypot(pos.x - lastStar.x, pos.y - lastStar.y) > 26) {
          lastStar = { x: pos.x, y: pos.y };
          const ux = dx / len;
          const uy = dy / len;
          const cx = pos.x + w / 2 - ux * w * 0.3;
          const cy = pos.y + h / 2 - uy * h * 0.3;
          const spread = (Math.random() - 0.5) * h * 0.5;
          spawnStar(cx - uy * spread, cy + ux * spread, ux, uy);
        }
      },
      onComplete: () => {
        // Un seul vol : l'astronaute et le blob ne reviennent pas
        gsap.set([el, blob].filter(Boolean), { autoAlpha: 0 });
        flight = null;
        done = true;
        stopObserving();
      },
    });
  }

  let done = false;
  gsap.set([el, blob].filter(Boolean), { autoAlpha: 0 });
  const stopObserving = onViewport(section, {
    enter: () => {
      if (done) return;
      if (flight) flight.resume();
      else fly();
    },
    leave: () => flight?.pause(),
  });
}
