/**
 * G8 — Colonnes décalées (data-smf-parallax-cols) : la colonne de droite (tuiles paires) se déplace plus vite
 * que la gauche au scroll (écart ≈ 15 % de la hauteur de la grille). Les tuiles paires portent déjà un décalage CSS
 * de 204 px ; le JS ajoute un `y` relatif. Désactivé en reduced-motion et à 767 px et moins (1 colonne).
 */
import { registerPlugins } from '../utils/gsap.js';

export function init(elements, { gsap, env }) {
  if (env.reducedMotion) return;
  const missing = registerPlugins(gsap, ['ScrollTrigger']);
  if (missing.length) {
    console.warn('[smf] parallax : plugin ScrollTrigger absent (réglages GSAP du site).');
    return;
  }

  const media = gsap.matchMedia();
  media.add('(min-width: 768px)', () => {
    for (const grid of elements) {
      const evens = [...grid.querySelectorAll('[data-smf-case-tile]')].filter((_, i) => i % 2 === 1);
      if (!evens.length) continue;
      gsap.to(evens, {
        y: () => -grid.offsetHeight * 0.15,
        ease: 'none',
        scrollTrigger: { trigger: grid, start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true },
      });
    }
  });
}
