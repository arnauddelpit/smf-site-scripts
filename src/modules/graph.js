/**
 * E2 — Graphique « Nous créons des publicités » (data-smf-graph-videos).
 *
 * La courbe bleue est tracée par le script à partir de la position des points [data-smf-graph-dot] posés dans Webflow
 * (classes graph_dot + is-…) : elle arrive à plat depuis le bord gauche de l'écran, passe par chaque point et se termine par
 * une flèche. Chaque point marque une accélération (la pente augmente après lui) ; déplacer un point dans le Designer suffit
 * à redessiner la courbe. Le conteneur [data-smf-graph-line] reçoit le SVG (l'ancien tracé de l'embed est remplacé).
 *
 * Animation (une fois, à l'entrée dans le viewport) : la ligne se dessine ; au moment où elle atteint un point, le point
 * « pope » et sa vignette [data-smf-graph-thumb] (même rang de gauche à droite) apparaît au-dessus.
 * Survol / focus d'une vignette : elle s'agrandit et joue sa vidéo Vimeo (data-smf-vimeo, muette, en boucle) ; à la sortie elle
 * se réduit et la vidéo est retirée. Tactile : 1er tap = agrandir + lire, 2e tap = suivre le lien.
 * Mobile (points masqués) : pas de courbe, vignettes en rang. Reduced-motion : état final, ni agrandissement ni lecture.
 */
import { onViewport } from '../utils/viewport.js';
import { makeFrame, playerUrl } from './video.js';

const NS = 'http://www.w3.org/2000/svg';
const GROW = 1.9;

export function init(elements, { gsap, env }) {
  for (const root of elements) setup(root, gsap, env);
}

function setup(root, gsap, env) {
  const host = root.querySelector('[data-smf-graph-line]');
  const byX = (a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left;
  const dots = [...root.querySelectorAll('[data-smf-graph-dot]')].filter((d) => getComputedStyle(d).display !== 'none').sort(byX);
  const thumbs = [...root.querySelectorAll('[data-smf-graph-thumb]')].sort(byX);
  const hasCurve = Boolean(host) && dots.length >= 2;

  wireThumbs(thumbs, gsap, env);
  if (!hasCurve) return;

  // Le script pilote la taille des points : on fixe leur centrage (le CSS les centre par translate(-50%, -50%))
  gsap.set(dots, { xPercent: -50, yPercent: -50, x: 0, y: 0 });
  Object.assign(host.style, { position: 'absolute', left: '0', top: '0', width: '100%', height: '100%', pointerEvents: 'none' });

  let line = null;
  let arrow = null;
  let stops = []; // part de la longueur de la courbe à laquelle chaque point est atteint (0 → 1)
  let played = false;
  let tl = null;

  function draw() {
    const box = root.getBoundingClientRect();
    const pts = dots.map((dot) => {
      const r = dot.getBoundingClientRect();
      return { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
    });
    const first = pts[0];
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    // départ à plat depuis le bord gauche de l'écran ; fin : la pente du dernier segment, accentuée, jusqu'au bord droit du bloc
    const start = { x: -box.left - 24, y: first.y };
    const slope = ((prev.y - last.y) / Math.max(1, last.x - prev.x)) * 1.35;
    const endX = Math.min(box.width - 6, last.x + box.width * 0.15);
    const end = { x: endX, y: Math.max(10, last.y - (endX - last.x) * slope) };
    const all = [start, ...pts, end];

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${box.width} ${box.height}`);
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible';
    const color = getComputedStyle(dots[0]).backgroundColor;
    const stroke = Math.max(2, box.width * 0.0022);
    const mk = (d) => {
      const path = document.createElementNS(NS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      path.setAttribute('stroke-width', String(stroke));
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      svg.append(path);
      return path;
    };
    line = mk(all.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(''));
    line.setAttribute('data-smf-graph-path', 'line');
    // pointe de flèche orientée comme le dernier segment
    const angle = Math.atan2(end.y - last.y, end.x - last.x);
    const head = box.width * 0.013;
    const wing = (delta) => `${(end.x - head * Math.cos(angle + delta)).toFixed(1)} ${(end.y - head * Math.sin(angle + delta)).toFixed(1)}`;
    arrow = mk(`M${wing(0.55)}L${end.x.toFixed(1)} ${end.y.toFixed(1)}L${wing(-0.55)}`);
    arrow.setAttribute('data-smf-graph-path', 'arrow');
    host.replaceChildren(svg);

    const seg = all.slice(1).map((p, i) => Math.hypot(p.x - all[i].x, p.y - all[i].y));
    const total = seg.reduce((a, b) => a + b, 0);
    let run = 0;
    stops = pts.map((_, i) => {
      run += seg[i];
      return run / total;
    });
    return total;
  }

  function finalState() {
    gsap.set(dots, { scale: 1, opacity: 1 });
    gsap.set(thumbs, { scale: 1, opacity: 1 });
    if (line) gsap.set(line, { strokeDasharray: 'none', strokeDashoffset: 0 });
    if (arrow) gsap.set(arrow, { opacity: 1 });
  }

  function prepare() {
    tl?.kill();
    const total = draw();
    if (env.reducedMotion || played) {
      finalState();
      return;
    }
    const duration = 2.6;
    gsap.set(line, { strokeDasharray: total, strokeDashoffset: total });
    gsap.set(arrow, { opacity: 0 });
    gsap.set(dots, { scale: 0 });
    gsap.set(thumbs, { scale: 0, opacity: 0 });
    tl = gsap.timeline({ paused: true, onComplete: () => (played = true) });
    tl.to(line, { strokeDashoffset: 0, duration, ease: 'none' }, 0);
    dots.forEach((dot, i) => {
      const at = stops[i] * duration;
      tl.to(dot, { scale: 1, duration: 0.45, ease: 'back.out(3)' }, at - 0.05);
      if (thumbs[i]) tl.to(thumbs[i], { scale: 1, opacity: 1, duration: 0.6, ease: 'back.out(1.8)' }, at + 0.05);
    });
    tl.to(arrow, { opacity: 1, duration: 0.25 }, duration - 0.1);
  }

  prepare();
  if (!env.reducedMotion) onViewport(root, { once: true, rootMargin: '0px 0px -25% 0px', enter: () => tl?.play() });

  let timer = 0;
  let width = root.getBoundingClientRect().width;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const now = root.getBoundingClientRect().width;
      if (Math.abs(now - width) < 1) return;
      width = now;
      const running = tl?.isActive();
      if (running) played = true; // un redimensionnement pendant le tracé : on passe à l'état final
      prepare();
    }, 150);
  });
}

/** Survol / focus : la vignette s'agrandit (depuis son pied) et joue sa vidéo. */
function wireThumbs(thumbs, gsap, env) {
  if (env.reducedMotion) return;
  let open = null;
  for (const thumb of thumbs) {
    const src = playerUrl(thumb.getAttribute('data-smf-vimeo'), { background: true });
    let frame = null;
    const grow = () => {
      if (open && open !== thumb) open.__smfShrink?.();
      open = thumb;
      gsap.to(thumb, { scale: GROW, zIndex: 6, duration: 0.45, ease: 'back.out(1.6)', overwrite: 'auto' });
      if (src && !frame) {
        frame = makeFrame(src, { title: 'Aperçu vidéo', cover: true });
        thumb.append(frame);
      }
    };
    const shrink = () => {
      if (open === thumb) open = null;
      gsap.to(thumb, { scale: 1, zIndex: 1, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
      frame?.remove();
      frame = null;
    };
    thumb.__smfShrink = shrink;
    if (env.touch) {
      thumb.addEventListener('click', (event) => {
        if (open === thumb) return; // 2e tap : le lien s'ouvre
        event.preventDefault();
        grow();
      });
    } else {
      thumb.addEventListener('mouseenter', grow);
      thumb.addEventListener('mouseleave', shrink);
      thumb.addEventListener('focusin', grow);
      thumb.addEventListener('focusout', shrink);
    }
  }
  if (env.touch) document.addEventListener('click', (event) => {
    if (open && !open.contains(event.target)) open.__smfShrink?.();
  });
}
