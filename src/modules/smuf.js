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

/**
 * Les exports Figma réutilisent les mêmes id (clip0_0_1, paint0_linear_0_1…) d'un SVG à l'autre : une fois inlinés
 * dans la même page, le premier SVG « gagne » et les masques / dégradés des suivants pointent au mauvais endroit
 * (le Smuf apparaît vide ou tronqué). On préfixe donc chaque id et ses références par un identifiant unique.
 */
let uid = 0;
function uniquifyIds(markup) {
  uid += 1;
  const prefix = `s${uid}-`;
  return markup
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`)
    .replace(/(xlink:href|href)="#([^"]+)"/g, (_, attr, id) => `${attr}="#${prefix}${id}"`);
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
          wrapper.innerHTML = uniquifyIds(markup.trim());
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
