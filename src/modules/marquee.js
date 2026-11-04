/**
 * G6 / H5 — Défilements continus (data-smf-marquee = logos | text | testimonials).
 * La piste est le premier enfant : son contenu est dupliqué (copies aria-hidden) puis translaté de moitié en boucle.
 * Pause hors viewport ; pause au survol pour les logos. Reduced-motion : aucune duplication, aucun mouvement.
 */
import { onViewport } from '../utils/viewport.js';

const SPEED = { logos: 40, text: 80, testimonials: 40 }; // px/s

export function init(elements, { gsap, env }) {
  if (env.reducedMotion) return;

  for (const el of elements) {
    const kind = el.getAttribute('data-smf-marquee');
    const track = el.firstElementChild;
    if (!track || track.children.length === 0) continue;

    const originals = [...track.children];
    for (const node of originals) {
      const clone = node.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      for (const focusable of clone.querySelectorAll('a, button, [tabindex]')) focusable.setAttribute('tabindex', '-1');
      track.append(clone);
    }

    const distance = () => track.scrollWidth / 2;
    const tween = gsap.to(track, {
      x: () => -distance(),
      duration: () => distance() / (SPEED[kind] || 40),
      ease: 'none',
      repeat: -1,
      paused: true,
    });

    window.addEventListener('resize', () => tween.invalidate(), { passive: true });
    onViewport(el, { enter: () => tween.play(), leave: () => tween.pause() });

    if (kind === 'logos') {
      el.addEventListener('mouseenter', () => tween.pause());
      el.addEventListener('mouseleave', () => tween.play());
      el.addEventListener('focusin', () => tween.pause());
      el.addEventListener('focusout', () => tween.play());
    }
  }
}
