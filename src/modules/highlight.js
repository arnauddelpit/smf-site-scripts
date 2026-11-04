/**
 * A3 — Surlignage dessiné des titres de cartes (data-smf-highlight) : background-size 0 → 100 %,
 * un titre après l'autre. Le dégradé par ligne est défini dans head-global.css.
 */
import { onViewport } from '../utils/viewport.js';

export function init(elements, { gsap, env }) {
  if (env.reducedMotion) return;

  elements.forEach((el, index) => {
    gsap.set(el, { backgroundSize: '0% 100%' });
    onViewport(el, {
      once: true,
      rootMargin: '0px 0px -10% 0px',
      enter: () =>
        gsap.to(el, {
          backgroundSize: '100% 100%',
          duration: 0.7,
          delay: (index % 4) * 0.15,
          ease: 'power2.out',
        }),
    });
  });
}
