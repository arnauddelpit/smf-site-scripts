/**
 * A2 — Parcours « Du scroll au chiffre d'affaires » (data-smf-steps) : les étapes [data-smf-step] et leurs liaisons
 * [data-smf-step-connector] apparaissent de haut en bas, pilotées par le scroll (scrub). À 767 px et en dessous
 * (ou sans ScrollTrigger), simple apparition en séquence à l'entrée dans le viewport. Reduced-motion : tout visible.
 */
import { onViewport } from '../utils/viewport.js';
import { registerPlugins } from '../utils/gsap.js';

const order = (a, b) => Number(a.getAttribute('data-smf-step') || a.getAttribute('data-smf-step-connector')) - Number(b.getAttribute('data-smf-step') || b.getAttribute('data-smf-step-connector'));

export function init(elements, { gsap, env }) {
  if (env.reducedMotion) return;
  const scrub = registerPlugins(gsap, ['ScrollTrigger']).length === 0 && !env.mobile;

  for (const root of elements) {
    const steps = [...root.querySelectorAll('[data-smf-step]')].sort(order);
    const connectors = [...root.querySelectorAll('[data-smf-step-connector]')].sort(order);
    if (!steps.length) continue;

    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power2.out' } });
    steps.forEach((step, i) => {
      tl.fromTo(step, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1 }, i * 1.2);
      const connector = connectors[i];
      if (connector) tl.fromTo(connector, { opacity: 0, scaleY: 0, transformOrigin: 'top center' }, { opacity: 1, scaleY: 1, duration: 0.8 }, i * 1.2 + 0.7);
    });

    if (scrub) {
      window.ScrollTrigger.create({ trigger: root, start: 'top 75%', end: 'bottom 55%', scrub: 0.6, animation: tl });
    } else {
      tl.timeScale(1.6);
      onViewport(root, { once: true, enter: () => tl.play() });
    }
  }
}
