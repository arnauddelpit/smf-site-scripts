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
const DESCENT_BOOST = 0.9; // 0 = vitesse constante ; plus la valeur est grande, plus les descentes sont rapides et les montées lentes
const BODY_TILT = 25; // degrés : inclinaison du corps du Smuf « astro » au repos (tête vers la droite)

/**
 * Courbe lisse (Catmull-Rom) passant par les points de passage, échantillonnée finement. Chaque échantillon reçoit un
 * temps cumulé : la vitesse dépend de la pente (descente = plus rapide, montée = plus lente), y vers le bas.
 */
function buildPath(points, perSegment = 48) {
  const samples = [];
  const last = points.length - 1;
  for (let i = 0; i < last; i += 1) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, last)];
    for (let s = 0; s < perSegment; s += 1) {
      const t = s / perSegment;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      samples.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  samples.push({ ...points[last] });
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
    // Trajectoire calée sur la mise en page : entre par la gauche, au-dessus du titre ; descend sur le flanc gauche du
    // bloc de texte, passe SOUS le texte (titre + intro), remonte un peu au niveau de la vidéo, puis redescend et sort à droite.
    const sr = section.getBoundingClientRect();
    const rel = (node) => {
      const r = node.getBoundingClientRect();
      return { l: r.left - sr.left, r: r.right - sr.left, t: r.top - sr.top, b: r.bottom - sr.top };
    };
    const title = section.querySelector('[data-smf-split-title]');
    const reelEl = section.querySelector('[data-smf-vimeo]');
    const text = rel(title?.parentElement || title || el);
    const reel = reelEl ? rel(reelEl) : { l: W * 0.65, r: W * 0.9, t: H * 0.2, b: H * 0.8 };
    const minY = h / 2 + 12;
    const maxY = H - h / 2 - 12;
    const clampY = (y) => Math.max(minY, Math.min(maxY, y));
    const belowY = clampY(text.b + h * 0.75);
    const centers = [
      { x: -w, y: clampY(text.t - 150) },
      { x: Math.max(w * 0.3, text.l - w * 0.35), y: clampY((text.t + belowY) / 2) },
      { x: (text.l + text.r) / 2, y: belowY },
      { x: reel.l - w * 0.2, y: clampY(reel.t + (reel.b - reel.t) * 0.58) },
      { x: W + w, y: clampY(Math.min(reel.b + h, H)) },
    ];
    const path = buildPath(centers);

    const blobBase = blob ? { x: blob.offsetLeft, y: blob.offsetTop } : null;

    state.p = 0;
    rot = null;
    lastStar = { x: centers[0].x - w / 2, y: centers[0].y - h / 2 };
    gsap.set(el, { autoAlpha: 1 });

    flight = gsap.to(state, {
      p: 1,
      duration: Math.max(7, W / 190),
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
