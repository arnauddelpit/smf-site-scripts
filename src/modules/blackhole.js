/**
 * H10 — Trou noir (data-smf-blackhole, data-smf-blackhole-hole, data-smf-blackhole-astronaut).
 *
 * Bureau : l'astronaute souriant (data-smf-blackhole-face="smile") suit le curseur avec inertie, la tête dans le sens de la
 * trajectoire, en laissant une traînée d'étoiles (comme les vols du hero). Il est déplacé dans <body> en position fixe :
 * il reste visible par-dessus les sections voisines tant que la section du trou noir est à l'écran. Au repos il se tient à
 * son emplacement Figma (clone invisible laissé dans la section). La première fois qu'il rejoint le curseur, il arrive depuis
 * l'angle haut gauche de l'écran.
 * À moins de FEAR_RADIUS du trou noir, son visage est remplacé par celui de l'astronaute qui a peur (face "scared").
 * Dans le trou noir : aspiration (spirale, rétrécissement, distorsion SVG), puis le trou noir grossit jusqu'à remplir tout
 * le viewport (disque noir fixe qui part de l'ellipse), et redirection vers /trou-noir (page à fond noir).
 *
 * État exposé : data-smf-blackhole-state = idle | sucked, événement document « smf:blackhole ».
 * Reduced-motion : l'astronaute reste en place (souriant). Tactile : va-et-vient automatique près du trou noir, sans redirection.
 * Avec ?smf-debug dans l'URL la redirection est désactivée : le trou noir se rétracte et l'état repasse à idle (tests).
 */
import { onViewport } from '../utils/viewport.js';

const FILTER_ID = 'smf-warp';
const STAR = 'https://cdn.prod.website-files.com/6ae8b90dbeb201293a031771/6af1ddfde3fea74ad80547ae_etoile.svg';
const STAR_SIZES = [10, 14, 18, 24, 32, 42];
const POOL = 40;
const STAR_STEP = 26; // px parcourus entre deux étoiles
const BODY_TILT = 25; // degrés : inclinaison du corps du Smuf « astro » au repos (tête vers la droite)
const FEAR_RADIUS = 300; // px autour du centre du trou noir
const FOLLOW_RATE = 5.5; // plus grand = suit le curseur de plus près

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
  const smile = astronaut.querySelector('[data-smf-blackhole-face="smile"]');
  const scared = astronaut.querySelector('[data-smf-blackhole-face="scared"]');
  let fear = false;
  function setFear(value) {
    if (value === fear) return;
    fear = value;
    if (smile) gsap.to(smile, { opacity: value ? 0 : 1, duration: 0.15, overwrite: 'auto' });
    if (scared) gsap.to(scared, { opacity: value ? 1 : 0, duration: 0.15, overwrite: 'auto' });
  }

  const holeCenter = () => {
    const r = hole.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
  };

  // ── Reduced-motion : l'astronaute souriant reste à sa place dans la page
  if (env.reducedMotion) return;

  // ── Tactile : va-et-vient automatique près du trou noir (l'astronaute reste dans la section), pas de redirection
  if (env.touch) {
    const loop = gsap.timeline({ repeat: -1, repeatDelay: 1.5, paused: true });
    const reach = () => {
      const h = holeCenter();
      const a = astronaut.getBoundingClientRect();
      const base = { x: a.left - (gsap.getProperty(astronaut, 'x') || 0), y: a.top - (gsap.getProperty(astronaut, 'y') || 0) };
      return { x: (h.x - a.width / 2 - base.x) * 0.7, y: (h.y - a.height / 2 - base.y) * 0.7 };
    };
    loop.to(astronaut, { x: () => reach().x, y: () => reach().y, rotation: 15, duration: 2.2, ease: 'power2.inOut' });
    loop.call(() => setFear(true));
    loop.to(astronaut, { x: 0, y: 0, rotation: 0, duration: 2, ease: 'power2.inOut' });
    loop.call(() => setFear(false), null, '>-1.2');
    onViewport(root, { enter: () => loop.play(), leave: () => loop.pause() });
    return;
  }

  // ── Bureau : astronaute fixe plein écran, qui suit le curseur ────────────────────────────────────────────────
  // Emplacement de repos : clone vide (même classe → même position / responsive) laissé dans la section.
  const slot = astronaut.cloneNode(false);
  slot.removeAttribute('data-smf-blackhole-astronaut');
  slot.setAttribute('aria-hidden', 'true');
  slot.style.visibility = 'hidden';
  astronaut.before(slot);

  document.body.append(astronaut);
  Object.assign(astronaut.style, { position: 'fixed', left: '0', top: '0', right: 'auto', bottom: 'auto', margin: '0', zIndex: '60', willChange: 'transform' });
  gsap.set(astronaut, { autoAlpha: 0, x: 0, y: 0, rotation: 0, scale: 1 });

  // Étoiles (sous l'astronaute)
  const layer = document.createElement('div');
  layer.setAttribute('aria-hidden', 'true');
  layer.style.cssText = 'position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:59';
  document.body.append(layer);
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
        duration: 0.9 + Math.random() * 0.9,
        ease: 'power1.in',
        onComplete: () => {
          star.style.display = 'none';
          free.push(star);
        },
      },
    );
  }

  const size = { w: astronaut.offsetWidth, h: astronaut.offsetHeight };
  new ResizeObserver(() => {
    size.w = astronaut.offsetWidth;
    size.h = astronaut.offsetHeight;
  }).observe(astronaut);
  const slotCenter = () => {
    const r = slot.getBoundingClientRect();
    return { x: r.left + size.w / 2, y: r.top + size.h / 2 };
  };

  const cursor = { x: 0, y: 0, moved: false };
  window.addEventListener('mousemove', (event) => {
    cursor.x = event.clientX;
    cursor.y = event.clientY;
    cursor.moved = true;
  }, { passive: true });

  const pos = slotCenter();
  let heading = 0;
  let walked = 0;
  let visible = false;
  let sucked = false;
  let overlay = null;
  let arrived = false; // la première fois qu'il rejoint le curseur, l'astronaute arrive depuis l'angle haut gauche de l'écran

  function tick(time, deltaMs) {
    const dt = Math.min(deltaMs, 64) / 1000 || 0.016;
    if (!arrived && cursor.moved) {
      arrived = true;
      pos.x = -size.w;
      pos.y = -size.h;
      heading = 0;
    }
    const rest = slotCenter();
    const tx = cursor.moved ? cursor.x : rest.x;
    const ty = cursor.moved ? cursor.y : rest.y;
    const k = 1 - Math.exp(-dt * FOLLOW_RATE);
    const px = pos.x;
    const py = pos.y;
    pos.x += (tx - pos.x) * k;
    pos.y += (ty - pos.y) * k;
    const dx = pos.x - px;
    const dy = pos.y - py;
    const dist = Math.hypot(dx, dy);
    const speed = dist / dt;

    // Tête devant : le Smuf est dessiné avec le corps incliné de ~25° vers le bas (tête à droite) ; l'angle est « déroulé »
    // pour tourner par le chemin le plus court. Vers la gauche il vole sur le dos, comme dans les vols du hero.
    if (speed > 35) {
      const target = (Math.atan2(dy, dx) * 180) / Math.PI - BODY_TILT;
      const turns = Math.round((heading - target) / 360);
      heading += (target + 360 * turns - heading) * (1 - Math.exp(-dt * 9));
    }

    // Traînée d'étoiles
    if (speed > 60) {
      walked += dist;
      while (walked > STAR_STEP) {
        walked -= STAR_STEP;
        spawnStar(pos.x - (dx / dist) * size.w * 0.22, pos.y - (dy / dist) * size.h * 0.18, dx / dist, dy / dist);
      }
    } else {
      walked = 0;
    }

    // Peur à l'approche du trou noir
    const h = holeCenter();
    const hx = pos.x - h.x;
    const hy = pos.y - h.y;
    const near = Math.hypot(hx, hy) < FEAR_RADIUS;
    setFear(near);
    const wobble = near ? Math.sin(time * 38) * 4 : 0;
    gsap.set(astronaut, { x: pos.x - size.w / 2, y: pos.y - size.h / 2, rotation: heading + wobble, scale: near ? 1.08 : 1 });

    // Zone de chute (l'ellipse est plate, la tolérance verticale est donc plus large que le trou lui-même). Il faut que l'astronaute
    // soit dans la zone ET que le curseur la survole (un peu élargie) : un astronaute qui ne fait que traverser pour rejoindre le
    // curseur (arrivée depuis l'angle de l'écran, mouvement rapide) ne tombe pas.
    const inZone = (x, y, k) => ((x - h.x) / (h.w * 0.65 * k)) ** 2 + ((y - h.y) / (Math.max(h.h * 3.5, 56) * k)) ** 2 < 1;
    if (cursor.moved && inZone(pos.x, pos.y, 1) && inZone(cursor.x, cursor.y, 1.35)) suck();
  }

  // ── Chute : l'astronaute plonge, puis le trou noir remplit le viewport
  const keys = new Set([' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End']);
  const block = (event) => event.preventDefault();
  const blockKey = (event) => { if (keys.has(event.key)) event.preventDefault(); };
  function lockScroll(on) {
    const method = on ? 'addEventListener' : 'removeEventListener';
    window[method]('wheel', block, { passive: false });
    window[method]('touchmove', block, { passive: false });
    window[method]('keydown', blockKey);
  }

  function suck() {
    if (sucked) return;
    sucked = true;
    gsap.ticker.remove(tick);
    root.setAttribute('data-smf-blackhole-state', 'sucked');
    lockScroll(true);
    setFear(true);
    const warp = ensureFilter();
    const turbulence = warp.querySelector('feTurbulence');
    const displacement = warp.querySelector('feDisplacementMap');
    astronaut.style.filter = `url(#${FILTER_ID})`;

    // Chute en spirale : l'astronaute tourne autour du centre du trou (3 tours dans le sens inverse des aiguilles d'une montre,
    // élargissement puis resserrement du rayon, vu un peu de côté : rayon vertical réduit) tout en rétrécissant ; sa rotation
    // sur lui-même suit le même sens.
    const h = holeCenter();
    const startRotation = heading;
    const dx0 = pos.x - h.x;
    const dy0 = pos.y - h.y;
    const r0 = Math.hypot(dx0, dy0);
    const a0 = Math.atan2(dy0, dx0);
    const swing = Math.max(120, r0 * 1.6); // amplitude de la spirale (px)
    const FALL = 2.4; // durée de la chute (s)
    const spin = { p: 0 };
    const tl = gsap.timeline({ onComplete: finish });
    tl.to(spin, {
      p: 1,
      duration: FALL,
      ease: 'power1.in',
      onUpdate: () => {
        const p = spin.p;
        const angle = a0 - p * Math.PI * 2 * 3; // sens inverse des aiguilles d'une montre
        const radius = r0 * (1 - p) + swing * Math.sin(Math.PI * p) * (1 - p * 0.5) * (1 - p);
        gsap.set(astronaut, {
          x: h.x + Math.cos(angle) * radius - size.w / 2,
          y: h.y + Math.sin(angle) * radius * 0.6 - size.h / 2,
          rotation: startRotation - p * 900,
          scale: 1.08 - 1.04 * p ** 1.3,
        });
      },
    }, 0);
    tl.fromTo(displacement, { attr: { scale: 0 } }, { attr: { scale: 90 }, duration: FALL, ease: 'power2.in' }, 0);
    tl.fromTo(turbulence, { attr: { baseFrequency: 0.01 } }, { attr: { baseFrequency: 0.06 }, duration: FALL }, 0);
    const GROW_AT = 1.7; // le trou noir ne grossit que lorsque l'astronaute est déjà presque englouti
    // Le trou noir est remplacé par un disque noir fixe, de même forme, qui grossit jusqu'à couvrir tout le viewport.
    tl.add(() => {
      const r = hole.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      overlay = document.createElement('div');
      overlay.setAttribute('aria-hidden', 'true');
      overlay.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;border-radius:50%;background:${getComputedStyle(hole).backgroundColor};z-index:10000;pointer-events:none;will-change:transform`;
      document.body.append(overlay);
      hole.style.visibility = 'hidden';
      // échelle pour que l'ellipse couvre les quatre coins du viewport
      const far = [[0, 0], [innerWidth, 0], [0, innerHeight], [innerWidth, innerHeight]].map(([x, y]) => Math.hypot((x - cx) / (r.width / 2), (y - cy) / (r.height / 2)));
      gsap.to(overlay, { scale: Math.max(...far) * 1.05, duration: 1.3, ease: 'power3.in' });
    }, GROW_AT);
    tl.to({}, { duration: 1.3 }, GROW_AT);
    tl.to({}, { duration: 0.15 });
  }

  function finish() {
    document.dispatchEvent(new CustomEvent('smf:blackhole'));
    if (env.debug) {
      setTimeout(reset, 600);
      return;
    }
    location.assign('/trou-noir');
  }

  function reset() {
    overlay?.remove();
    overlay = null;
    hole.style.visibility = '';
    astronaut.style.filter = '';
    lockScroll(false);
    const rest = slotCenter();
    pos.x = rest.x;
    pos.y = rest.y;
    heading = 0;
    sucked = false;
    setFear(false);
    gsap.set(astronaut, { x: pos.x - size.w / 2, y: pos.y - size.h / 2, rotation: 0, scale: 1 });
    root.setAttribute('data-smf-blackhole-state', 'idle');
    if (visible) gsap.ticker.add(tick);
  }

  // Retour arrière (bfcache) depuis /trou-noir : la page est restaurée telle quelle, trou noir plein écran compris.
  window.addEventListener('pageshow', (event) => { if (event.persisted && sucked) reset(); });

  onViewport(root, {
    enter: () => {
      visible = true;
      if (sucked) return;
      const rest = slotCenter();
      pos.x = rest.x;
      pos.y = rest.y;
      if (cursor.moved && !arrived) {
        // le curseur a déjà bougé avant l'arrivée dans la section : première arrivée depuis l'angle haut gauche
        arrived = true;
        pos.x = -size.w;
        pos.y = -size.h;
      }
      gsap.set(astronaut, { x: pos.x - size.w / 2, y: pos.y - size.h / 2 });
      gsap.to(astronaut, { autoAlpha: 1, duration: 0.3, overwrite: 'auto' });
      gsap.ticker.add(tick);
    },
    leave: () => {
      visible = false;
      if (sucked) return;
      gsap.ticker.remove(tick);
      gsap.to(astronaut, { autoAlpha: 0, duration: 0.2, overwrite: 'auto' });
    },
  });
}
