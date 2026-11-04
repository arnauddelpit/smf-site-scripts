/**
 * G1 — Apparitions au scroll (data-smf-reveal = stagger | fade-up | none).
 * fade + translation 24 px, 0,8 s ; stagger 0,08 s dans l'ordre DOM.
 * Jamais dans les heros (ils portent data-smf-reveal="none"). Reduced-motion : rien n'est caché.
 */
import { onViewport } from '../utils/viewport.js';

export function init(elements, { gsap, env }) {
  if (env.reducedMotion) return;

  for (const el of elements) {
    const mode = el.getAttribute('data-smf-reveal');
    if (mode === 'none') continue;

    let targets = [el];
    if (mode === 'stagger') {
      const items = [...el.querySelectorAll('[data-smf-reveal-item]')];
      targets = items.length ? items : [...el.children];
    }
    if (!targets.length) continue;

    gsap.set(targets, { opacity: 0, y: 24 });
    onViewport(el, {
      once: true,
      rootMargin: '0px 0px -8% 0px',
      enter: () =>
        gsap.to(targets, {
          opacity: 1,
          y: 0,
          duration: 0.8,
          ease: 'power3.out',
          stagger: mode === 'stagger' ? 0.08 : 0,
          clearProps: 'opacity,transform',
        }),
    });
  }
}
