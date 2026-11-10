/**
 * Smuf astronaute qui traverse l'écran en suivant une courbe de Bézier fluide (data-smf-fly = nom du vol), pivote pour suivre la
 * trajectoire (tête devant) et laisse derrière lui une traînée d'étoiles (etoile.svg, assets Webflow) de tailles variées qui
 * rétrécissent jusqu'à disparaître. Un seul vol par astronaute ; il est mis en pause si la section sort de l'écran.
 *
 *  data-smf-fly="astronaut"       hero : de gauche à droite, au chargement ; le blob lumineux (data-smf-fly-blob) l'accompagne
 *  data-smf-fly="astronaut-back"  « Plot twist » : de droite à gauche, quand la section arrive à l'écran. Comme il avance vers la
 *                                 gauche, sa rotation le fait voler sur le dos (pieds en l'air).
 *
 * reduced-motion : hero → l'astronaute et le blob restent en place dans la page ; Plot twist → l'astronaute reste masqué.
 */
import { onViewport } from '../utils/viewport.js';

const STAR = 'https://cdn.prod.website-files.com/6ae8b90dbeb201293a031771/6af1ddfde3fea74ad80547ae_etoile.svg';
const STAR_SIZES = [10, 14, 18, 24, 32, 42];
const POOL = 48;
const DESCENT_BOOST = 0.3; // 0 = vitesse constante ; plus la valeur est grande, plus les descentes sont rapides et les montées lentes
const BODY_TILT = 25; // degrés : inclinaison du corps du Smuf « astro » au repos (tête vers la droite)
const FIGMA_W = 1920;

/**
 * Trajectoires dessinées dans Figma (calque « trajectoire », repère de la page d'accueil, frame de 1920 px de large) : suites de
 * courbes de Bézier cubiques [[x,y] × 4]. x est proportionnel à la largeur de la page ; y est calé sur un élément repère
 * (anchor) dont la position Figma [haut, bas] est donnée dans anchorFigma.
 */
const FLIGHTS = {
  // Hero : entre en haut à gauche, plonge sous le titre, remonte à hauteur de la vidéo, redescend vers le bas à droite.
  astronaut: {
    dir: 1,
    segments: [
      [[-18, 183.5], [-3.3, 344.4], [155.4, 689], [674.5, 689]],
      [[674.5, 689], [1202, 689], [1207, 576], [1470, 574.5]],
      [[1470, 574.5], [1680.4, 573.3], [1867, 641], [1974.5, 742.5]],
    ],
    anchor: '[data-smf-vimeo]',
    anchorFigma: [184, 682],
    rise: 200, // px : toute la trajectoire est remontée par rapport au calque Figma
    duration: (W) => Math.max(5, W / 280),
    blob: true,
    showWhenStatic: true,
    rootMargin: '0px',
  },
  // Plot twist : part du haut à droite (là où l'astronaute statique se tient), traverse les cartes en diagonale, sort en bas à gauche.
  'astronaut-back': {
    dir: -1,
    segments: [
      [[1916.56, 3605.48], [1646.06, 3672.48], [1244.16, 3697.55], [1029.56, 4115.98]],
      [[1029.56, 4115.98], [830.06, 4504.98], [322.73, 4503.15], [7.06, 4541.98]],
    ],
    anchor: '[data-smf-marquee]', // piste des témoignages : Figma 3821 → 4510
    anchorFigma: [3821, 4510],
    rise: 0,
    duration: (W, length) => Math.min(9, Math.max(5, length / 420)),
    blob: false,
    showWhenStatic: false,
    rootMargin: '0px 0px -30% 0px', // le vol part quand le haut de la section est monté à 30 % de l'écran
  },
};

/**
 * Courbe échantillonnée finement. Chaque échantillon reçoit un temps cumulé : la vitesse dépend un peu de la pente
 * (descente = plus rapide, montée = plus lente), y vers le bas. `length` = longueur réelle de la courbe en px.
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
  let length = 0;
  samples[0].t = 0;
  for (let i = 1; i < samples.length; i += 1) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    const len = Math.hypot(dx, dy) || 1e-6;
    const speed = Math.max(0.3, 1 + DESCENT_BOOST * (dy / len)); // dy/len : +1 en plongée, -1 en montée
    total += len / speed;
    length += len;
    samples[i].t = total;
  }
  return { samples, total, length };
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

export function init(elements, ctx) {
  for (const el of elements) {
    const cfg = FLIGHTS[el.getAttribute('data-smf-fly')];
    if (cfg) setup(el, cfg, ctx);
  }
}

function setup(el, cfg, { gsap, env }) {
  const section = el.closest('section');
  if (!section) return;
  // Blob lumineux (hero) : centré sur l'astronaute pendant tout le vol, il apparaît / disparaît avec lui aux bords de l'écran.
  const blob = cfg.blob ? section.querySelector('[data-smf-fly-blob]') : null;

  // L'astronaute et le blob sont masqués en CSS (pas d'apparition avant l'entrée) : sans animation, le hero les montre en place.
  if (env.reducedMotion) {
    if (cfg.showWhenStatic) gsap.set([el, blob].filter(Boolean), { autoAlpha: 1 });
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
  let done = false;

  function fly() {
    const W = section.clientWidth;
    const H = section.clientHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    if (!el.offsetParent || !W) return;
    const baseLeft = el.offsetLeft;
    const baseTop = el.offsetTop;
    // Trajectoire Figma : x proportionnel à la largeur de la page, y calé sur la hauteur de l'élément repère.
    const sr = section.getBoundingClientRect();
    const anchorEl = section.querySelector(cfg.anchor);
    const rr = anchorEl ? anchorEl.getBoundingClientRect() : null;
    const anchorT = rr ? rr.top - sr.top : H * 0.12;
    const anchorH = rr ? rr.height : H * 0.75;
    const [figmaTop, figmaBottom] = cfg.anchorFigma;
    const toX = (x) => (x / FIGMA_W) * W;
    const toY = (y) => anchorT + ((y - figmaTop) / (figmaBottom - figmaTop)) * anchorH - cfg.rise;
    const segments = cfg.segments.map((seg) => seg.map(([x, y]) => [toX(x), toY(y)]));
    // Approche : l'astronaute arrive de hors écran (côté d'entrée, au-dessus du point de départ) avant de rejoindre la courbe
    const s = cfg.dir;
    const start = segments[0][0];
    const entryX = s > 0 ? -w : W + w;
    segments.unshift([[entryX, start[1] - 90], [entryX + (s > 0 ? w : -w) * 0.5, start[1] - 70], [start[0] - s * 30, start[1] - 25], start]);
    // Sortie : la courbe se prolonge en ligne droite jusqu'à ce que l'astronaute soit entièrement hors de l'écran
    const lastSeg = segments[segments.length - 1];
    const end = lastSeg[3];
    const dirX = end[0] - lastSeg[2][0];
    const dirY = end[1] - lastSeg[2][1];
    const exitX = s > 0 ? W + w : -w;
    if ((s > 0 ? end[0] < exitX && dirX > 0 : end[0] > exitX && dirX < 0)) {
      const k = (exitX - end[0]) / dirX;
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
      duration: cfg.duration(W, path.length),
      ease: 'none', // le rythme (descentes rapides, montées lentes) vient de la trajectoire elle-même
      onUpdate: () => {
        const c = sampleAt(path, state.p);
        const pos = { x: c.x - w / 2, y: c.y - h / 2 };
        const dx = c.dx;
        const dy = c.dy;
        const len = Math.hypot(dx, dy) || 1;
        // Tête devant, pieds derrière : le Smuf est dessiné avec le corps incliné de ~25° vers le bas (tête à droite).
        // Vers la gauche, la même rotation le retourne : il vole sur le dos.
        const target = (Math.atan2(dy, dx) * 180) / Math.PI - BODY_TILT;
        if (rot === null) rot = target;
        else {
          // angle « déroulé » : on choisit l'équivalent de target (à 360° près) le plus proche de la rotation actuelle
          const turns = Math.round((rot - target) / 360);
          rot += (target + turns * 360 - rot) * 0.15;
        }
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

  gsap.set([el, blob].filter(Boolean), { autoAlpha: 0 });
  const stopObserving = onViewport(section, {
    rootMargin: cfg.rootMargin,
    enter: () => {
      if (done) return;
      if (flight) flight.resume();
      else fly();
    },
    leave: () => flight?.pause(),
  });
}
