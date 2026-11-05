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
    let track = el.firstElementChild; // élément translaté
    let host = track; // élément qui contient les éléments à dupliquer
    if (!track || track.children.length === 0) continue;

    // Listes CMS Webflow : la piste est enveloppée dans des conteneurs `display: contents` (w-dyn-list / w-dyn-items) que
    // transform ne peut pas translater. On duplique alors dans le vrai parent des éléments et on translate l'élément `data-smf-marquee`.
    if (getComputedStyle(track).display === 'contents') {
      const item = el.querySelector('.w-dyn-item') || el.querySelector(':scope > * > *');
      if (!item) continue;
      host = item.parentElement;
      track = getComputedStyle(host).display === 'contents' ? el : host;
    }

    const originals = [...host.children];
    const clones = originals.map((node) => {
      const clone = node.cloneNode(true);
      clone.setAttribute('aria-hidden', 'true');
      for (const focusable of clone.querySelectorAll('a, button, [tabindex]')) focusable.setAttribute('tabindex', '-1');
      host.append(clone);
      return clone;
    });

    // distance d'une boucle = écart entre un élément et sa copie (inclut le gap de la grille flex)
    const distance = () => Math.round(clones[0].offsetLeft - originals[0].offsetLeft) || track.scrollWidth / 2;
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
