/**
 * Compteurs animés (data-smf-count). Le nombre cible est lu dans le texte de l'élément (ex. « +110% », « 3 Millions »,
 * « x4,2 ») ; le préfixe, le suffixe et le nombre de décimales sont conservés. Reduced-motion : texte tel quel.
 */
import { onViewport } from '../utils/viewport.js';

const NUMBER = /(\d[\d\s ]*(?:[.,]\d+)?)/;

export function init(elements, { gsap, env }) {
  if (env.reducedMotion) return;

  for (const el of elements) {
    const text = el.textContent;
    const match = text.match(NUMBER);
    if (!match) continue;

    const raw = match[1];
    const decimals = (raw.split(/[.,]/)[1] || '').length;
    const target = parseFloat(raw.replace(/[\s ]/g, '').replace(',', '.'));
    if (!Number.isFinite(target)) continue;

    const before = text.slice(0, match.index);
    const after = text.slice(match.index + raw.length);
    const format = (value) =>
      before + value.toLocaleString('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + after;

    el.setAttribute('aria-label', text.trim());
    el.textContent = format(0);
    const state = { value: 0 };

    onViewport(el, {
      once: true,
      enter: () =>
        gsap.to(state, {
          value: target,
          duration: 1.6,
          ease: 'power2.out',
          onUpdate: () => (el.textContent = format(state.value)),
          onComplete: () => (el.textContent = text),
        }),
    });
  }
}
