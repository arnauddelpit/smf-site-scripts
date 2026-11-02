/**
 * Point d'entrée du JS custom du site Social Media Family.
 *
 * Règles (CLAUDE.md §7) :
 * - le JS ne s'accroche qu'à des attributs data-smf-*, jamais à des classes ;
 * - GSAP vient de l'intégration native Webflow (window.gsap), jamais importé ici ;
 * - chaque module n'est téléchargé que si son attribut est présent dans la page.
 */
import { env } from './utils/env.js';
import { whenGsap } from './utils/gsap.js';

/**
 * Registre des modules : sélecteur déclencheur → module chargé à la demande.
 * Chaque module exporte `init(elements, ctx)` et peut renvoyer une fonction de nettoyage.
 * `gsap: true` attend que l'intégration GSAP de Webflow soit prête.
 * Liste des attributs : smf-kit/docs/interactions.md.
 */
const registry = [
  // Les modules sont ajoutés ici au fil de la phase 5, par exemple :
  // { name: 'reveal', selector: '[data-smf-reveal]:not([data-smf-reveal="none"])', gsap: true, load: () => import('./modules/reveal.js') },
];

const state = { version: __SMF_VERSION__, loaded: [], failed: [] };

async function boot() {
  const ctx = { env, debug: env.debug };

  await Promise.all(
    registry.map(async ({ name, selector, gsap, load }) => {
      const elements = [...document.querySelectorAll(selector)];
      if (!elements.length) return;
      try {
        if (gsap) ctx.gsap = await whenGsap();
        const mod = await load();
        await mod.init(elements, ctx);
        state.loaded.push(name);
      } catch (error) {
        state.failed.push(name);
        console.error(`[smf] module « ${name} » :`, error);
      }
    }),
  );

  if (env.debug) console.info(`[smf] v${state.version}`, state);
  document.documentElement.setAttribute('data-smf-ready', '');
  document.dispatchEvent(new CustomEvent('smf:ready', { detail: state }));
}

window.SMF = state;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
