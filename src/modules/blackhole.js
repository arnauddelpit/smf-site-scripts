/**
 * H10 — Trou noir (data-smf-blackhole, data-smf-blackhole-hole, data-smf-blackhole-astronaut).
 * L'astronaute suit le curseur avec un décalage (lerp plus rapide quand le curseur est loin, plus lent à l'approche).
 * Sous un rayon critique autour du trou noir : aspiration (spirale, rétrécissement, distorsion SVG feTurbulence /
 * feDisplacementMap), rebond élastique du trou noir, puis redirection vers /trou-noir.
 * État exposé : data-smf-blackhole-state = idle | sucked, événement document « smf:blackhole ».
 * Tactile et reduced-motion : pas de suivi ni de redirection, passage automatique près du trou noir.
 * Avec ?smf-debug dans l'URL la redirection est désactivée (tests).
 */
import { onViewport } from '../utils/viewport.js';

const FILTER_ID = 'smf-warp';

function ensureFilter() {
  if (document.getElementById(FILTER_ID)) return document.getElementById(FILTER_ID);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.position = 'absolute';
  svg.innerHTML = `<filter id="${FILTER_ID}" x="-30%" y="-30%" width="160%" height="160%">
    <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="2" result="noise"/>
    <feDisplacementMap in="SourceGraphic" in2="noise" scale="0" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`;
  document.body.append(svg);
  return svg.querySelector('filter');
}

export function init([root], { gsap, env }) {
  const hole = root.querySelector('[data-smf-blackhole-hole]');
  const astronaut = root.querySelector('[data-smf-blackhole-astronaut]');
  if (!hole || !astronaut) return;

  root.setAttribute('data-smf-blackhole-state', 'idle');
  const center = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  };
  const pos = { x: 0, y: 0 };
  const target = { x: 0, y: 0 };
  let sucked = false;
  let visible = false;

  const base = () => {
    const c = center(astronaut);
    return { x: c.x - pos.x, y: c.y - pos.y }; // centre « naturel » (sans décalage)
  };

  function suck() {
    if (sucked) return;
    sucked = true;
    gsap.ticker.remove(tick);
    root.setAttribute('data-smf-blackhole-state', 'sucked');
    const warp = ensureFilter();
    const turbulence = warp.querySelector('feTurbulence');
    const displacement = warp.querySelector('feDisplacementMap');
    astronaut.style.filter = `url(#${FILTER_ID})`;

    const h = center(hole);
    const b = base();
    const tl = gsap.timeline({
      onComplete: () => {
        document.dispatchEvent(new CustomEvent('smf:blackhole'));
        if (!env.debug) location.assign('/trou-noir');
      },
    });
    tl.to(astronaut, { x: h.x - b.x, y: h.y - b.y, rotation: 720, scale: 0.05, duration: 1.2, ease: 'power3.in' }, 0);
    tl.fromTo(displacement, { attr: { scale: 0 } }, { attr: { scale: 90 }, duration: 1.2, ease: 'power2.in' }, 0);
    tl.fromTo(turbulence, { attr: { baseFrequency: 0.01 } }, { attr: { baseFrequency: 0.06 }, duration: 1.2 }, 0);
    tl.to(hole, { scale: 1.25, duration: 0.25, ease: 'power2.out' }, 0.9);
    tl.to(hole, { scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.3)' }, 1.15);
  }

  function tick() {
    if (!visible || sucked) return;
    const dist = Math.hypot(target.x - pos.x, target.y - pos.y);
    const k = Math.min(0.15, 0.03 + (dist / 1800) * 0.12); // vite quand c'est loin, lent à l'approche
    pos.x += (target.x - pos.x) * k;
    pos.y += (target.y - pos.y) * k;
    gsap.set(astronaut, { x: pos.x, y: pos.y, rotation: Math.max(-20, Math.min(20, (target.x - pos.x) * 0.03)) });

    const b = base();
    const h = center(hole);
    if (Math.hypot(b.x + pos.x - h.x, b.y + pos.y - h.y) < h.w * 0.32) suck();
  }

  onViewport(root, {
    enter: () => {
      visible = true;
      if (!autoMode) gsap.ticker.add(tick);
    },
    leave: () => {
      visible = false;
      gsap.ticker.remove(tick);
    },
  });

  const autoMode = env.touch || env.reducedMotion;
  if (autoMode) {
    if (env.reducedMotion) return; // rien ne bouge
    // Tactile : l'astronaute passe près du trou noir puis repart, en boucle
    const loop = gsap.timeline({ repeat: -1, repeatDelay: 1.5, paused: true });
    const reach = () => {
      const h = center(hole);
      const b = base();
      return { x: (h.x - b.x) * 0.7, y: (h.y - b.y) * 0.7 };
    };
    loop.to(astronaut, { x: () => reach().x, y: () => reach().y, rotation: 15, duration: 2.2, ease: 'power2.inOut' });
    loop.to(astronaut, { x: 0, y: 0, rotation: 0, duration: 2, ease: 'power2.inOut' });
    onViewport(root, { enter: () => loop.play(), leave: () => loop.pause() });
    return;
  }

  window.addEventListener('mousemove', (event) => {
    const b = base();
    target.x = event.clientX - b.x;
    target.y = event.clientY - b.y;
  });
}
