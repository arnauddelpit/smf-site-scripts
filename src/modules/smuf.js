/**
 * Smufs (data-smf-smuf = identifiant de docs/smufs.md) : injecte le SVG inline (smufs/<id>.svg) à l'entrée dans le
 * viewport. Les Smufs sont STATIQUES (décision d'Arnaud : animations de Smufs abandonnées).
 * Une description vide (data-smf-smuf-desc absente ou vide) rend le Smuf décoratif (aria-hidden).
 */
import { onViewport } from '../utils/viewport.js';

const cache = new Map();

function load(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${url}`);
        return response.text();
      }),
    );
  }
  return cache.get(url);
}

export function init(elements, { assetBase }) {
  for (const el of elements) {
    const id = el.getAttribute('data-smf-smuf');
    if (!id) continue;

    onViewport(el, {
      once: true,
      rootMargin: '200px',
      enter: async () => {
        try {
          const markup = await load(`${assetBase}${id}.svg`);
          const wrapper = document.createElement('div');
          wrapper.innerHTML = markup.trim();
          const svg = wrapper.firstElementChild;
          if (!svg || svg.tagName.toLowerCase() !== 'svg') return;

          const label = el.getAttribute('aria-label') || el.getAttribute('data-smf-smuf-desc');
          if (label) {
            svg.setAttribute('role', 'img');
            svg.setAttribute('aria-label', label);
          } else {
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
          }
          el.replaceChildren(svg);
          el.setAttribute('data-smf-smuf-ready', '');
        } catch (error) {
          console.warn(`[smf] Smuf « ${id} » :`, error);
        }
      },
    });
  }
}
