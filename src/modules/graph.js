/**
 * E2 — Graphique « Nous créons des publicités » (data-smf-graph-videos) : la courbe bleue se dessine de gauche à
 * droite ([data-smf-graph-path="line"] puis "arrow"), les vignettes [data-smf-graph-thumb] « popent » une à une ;
 * survol / focus d'une vignette : elle grandit, à la sortie elle se réduit. Reduced-motion : état final immédiat.
 */
import { onViewport } from '../utils/viewport.js';

export function init(elements, { gsap, env }) {
  for (const root of elements) {
    const line = root.querySelector('[data-smf-graph-path="line"]');
    const arrow = root.querySelector('[data-smf-graph-path="arrow"]');
    const thumbs = [...root.querySelectorAll('[data-smf-graph-thumb]')];

    for (const thumb of thumbs) {
      const grow = () => !env.reducedMotion && gsap.to(thumb, { scale: 1.3, zIndex: 5, duration: 0.3, ease: 'power2.out', overwrite: 'auto' });
      const shrink = () => !env.reducedMotion && gsap.to(thumb, { scale: 1, zIndex: 1, duration: 0.3, ease: 'power2.inOut', overwrite: 'auto' });
      thumb.addEventListener('mouseenter', grow);
      thumb.addEventListener('mouseleave', shrink);
      thumb.addEventListener('focusin', grow);
      thumb.addEventListener('focusout', shrink);
    }
    if (env.reducedMotion) continue;

    const length = line?.getTotalLength?.();
    if (line && length) gsap.set(line, { strokeDasharray: length, strokeDashoffset: length });
    if (arrow) gsap.set(arrow, { opacity: 0 });
    gsap.set(thumbs, { scale: 0, opacity: 0 });

    const tl = gsap.timeline({ paused: true });
    if (line && length) tl.to(line, { strokeDashoffset: 0, duration: 1.8, ease: 'power1.inOut' });
    if (arrow) tl.to(arrow, { opacity: 1, duration: 0.3 }, '>-0.2');
    tl.to(thumbs, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2)', stagger: 0.3, clearProps: 'opacity' }, 0.5);
    onViewport(root, { once: true, rootMargin: '0px 0px -15% 0px', enter: () => tl.play() });
  }
}
