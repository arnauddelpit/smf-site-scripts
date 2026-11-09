/**
 * Smuf astronaute du hero (data-smf-fly="astronaut") : il traverse l'écran de gauche à droite en suivant une courbe
 * de Bézier fluide, pivote pour suivre la trajectoire (tête devant, pieds derrière) et laisse derrière lui une traînée d'étoiles
 * (etoile.svg, assets Webflow) de tailles variées qui rétrécissent jusqu'à disparaître.
 * Le vol se répète avec une pause hors écran ; il ne tourne que lorsque le hero est visible.
 * reduced-motion : rien ne bouge, l'astronaute reste à sa place dans la page.
 */
import { onViewport } from '../utils/viewport.js';

const STAR = 'https://cdn.prod.website-files.com/6ae8b90dbeb201293a031771/6af1ddfde3fea74ad80547ae_etoile.svg';
const STAR_SIZES = [10, 14, 18, 24, 32, 42];
const POOL = 48;
const PAUSE = 3.5; // secondes entre deux traversées
const BODY_TILT = 25; // degrés : inclinaison du corps du Smuf « astro » au repos (tête vers la droite)

const bezier = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
};

export function init([el], { gsap, env }) {
  if (env.reducedMotion) return;
  const section = el.closest('section');
  if (!section) return;

  // Blob lumineux (data-smf-fly-blob) : centré sur l'astronaute pendant le vol, rattrape sa position en douceur,
  // puis revient à sa place d'origine entre deux traversées. Toujours à l'arrière-plan (z-index géré dans Webflow).
  const blob = section.querySelector('[data-smf-fly-blob]');
  const blobStart = { x: 0, y: 0 };
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
    // Courbe en S : entre à gauche, plonge vers le bas puis remonte et sort à droite
    const p0 = { x: -w - 60, y: H * 0.55 };
    const p1 = { x: W * 0.3, y: H * 0.02 };
    const p2 = { x: W * 0.62, y: H * 0.98 };
    const p3 = { x: W + 60, y: H * 0.32 };

    const blobBase = blob ? { x: blob.offsetLeft, y: blob.offsetTop } : null;
    if (blob) {
      gsap.killTweensOf(blob);
      blobStart.x = Number(gsap.getProperty(blob, 'x')) || 0;
      blobStart.y = Number(gsap.getProperty(blob, 'y')) || 0;
    }

    state.p = 0;
    rot = null;
    lastStar = { x: p0.x, y: p0.y };
    gsap.set(el, { autoAlpha: 1 });

    flight = gsap.to(state, {
      p: 1,
      duration: Math.max(6, W / 220),
      ease: 'sine.inOut',
      onUpdate: () => {
        const pos = bezier(p0, p1, p2, p3, state.p);
        const ahead = bezier(p0, p1, p2, p3, Math.min(1, state.p + 0.01));
        const dx = ahead.x - pos.x;
        const dy = ahead.y - pos.y;
        const len = Math.hypot(dx, dy) || 1;
        // Tête devant, pieds derrière : le Smuf est dessiné avec le corps incliné de ~25° vers le bas (tête à droite)
        const target = (Math.atan2(dy, dx) * 180) / Math.PI - BODY_TILT;
        rot = rot === null ? target : rot + (target - rot) * 0.15;
        gsap.set(el, { x: pos.x - baseLeft, y: pos.y - baseTop, rotation: rot });
        if (blob) {
          // Centré sur l'astronaute ; fondu de raccord sur le début du vol pour éviter un saut depuis la position de repos
          const k = Math.min(1, state.p / 0.12);
          const blend = k * k * (3 - 2 * k);
          gsap.set(blob, {
            x: blobStart.x + (pos.x + w / 2 - blobBase.x - blobStart.x) * blend,
            y: blobStart.y + (pos.y + h / 2 - blobBase.y - blobStart.y) * blend,
          });
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
        gsap.set(el, { autoAlpha: 0 });
        if (blob) gsap.to(blob, { x: 0, y: 0, duration: 1.6, ease: 'power2.inOut' });
        flight = null;
        gsap.delayedCall(PAUSE, () => visible && !flight && fly());
      },
    });
  }

  let visible = false;
  gsap.set(el, { autoAlpha: 0 });
  onViewport(section, {
    enter: () => {
      visible = true;
      if (flight) flight.resume();
      else fly();
    },
    leave: () => {
      visible = false;
      flight?.pause();
    },
  });
}
