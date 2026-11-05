/**
 * G11 — Bento chiffres clés (data-smf-bento = accueil | ads) et anneau du taux de renouvellement (data-smf-bento-ring).
 * Tuiles : apparition en stagger rapide (0,05 s) ; les chiffres sont comptés par le module « count ».
 * Anneau : l'image SVG est révélée par un masque conique animé (--smf-p : 0 → 100), car le tracé est une <img>.
 * Reduced-motion : tout reste visible, anneau complet.
 */
import { onViewport } from '../utils/viewport.js';

/**
 * Les chiffres ne passent pas à la ligne (white-space: nowrap) : un chiffre long (« 12 M€ ») déborde de sa tuile.
 * On réduit sa taille de police pour que chiffre + unité tiennent dans la largeur de la tuile.
 */
function fitNumbers(root) {
  const fit = () => {
    for (const num of root.querySelectorAll('[data-smf-count]')) {
      const figure = num.parentElement;
      const body = figure?.parentElement;
      if (!body) continue;
      num.style.fontSize = '';
      const gap = parseFloat(getComputedStyle(figure).columnGap) || 0;
      const needed = [...figure.children].reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) + gap * (figure.children.length - 1);
      const available = body.clientWidth;
      if (needed > available && available > 0) {
        const size = parseFloat(getComputedStyle(num).fontSize);
        num.style.fontSize = `${Math.floor(size * (available / needed) * 0.97)}px`;
      }
    }
  };
  fit();
  let timer;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(fit, 150);
  });
  document.fonts?.ready.then(fit);
}

export function init(elements, { gsap, env }) {
  for (const el of elements) if (!el.hasAttribute('data-smf-bento-ring')) fitNumbers(el);
  if (env.reducedMotion) return;

  for (const el of elements) {
    if (el.hasAttribute('data-smf-bento-ring')) ring(el, gsap);
    else tiles(el, gsap);
  }
}

function tiles(root, gsap) {
  let items = [...root.children];
  if (items.length < 3 && items[0]) items = [...items[0].children]; // grille imbriquée
  if (!items.length) return;
  gsap.set(items, { opacity: 0, y: 24, scale: 0.96 });
  onViewport(root, {
    once: true,
    rootMargin: '0px 0px -10% 0px',
    enter: () => gsap.to(items, { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: 'power3.out', stagger: 0.05, clearProps: 'opacity,transform' }),
  });
}

function ring(el, gsap) {
  const mask = 'conic-gradient(from 0deg, #000 calc(var(--smf-p) * 1%), transparent calc(var(--smf-p) * 1%))';
  el.style.setProperty('--smf-p', '0');
  el.style.maskImage = mask;
  el.style.webkitMaskImage = mask;
  onViewport(el, {
    once: true,
    enter: () =>
      gsap.to(el, {
        '--smf-p': 100,
        duration: 1.6,
        ease: 'power2.out',
        onComplete: () => {
          el.style.maskImage = '';
          el.style.webkitMaskImage = '';
        },
      }),
  });
}
