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
  { name: 'reveal', selector: '[data-smf-reveal]:not([data-smf-reveal="none"])', gsap: true, load: () => import('./modules/reveal.js') },
  { name: 'nav', selector: '[data-smf-nav]', load: () => import('./modules/nav.js') },
  { name: 'accordion', selector: '[data-smf-accordion]', gsap: true, load: () => import('./modules/accordion.js') },
  { name: 'marquee', selector: '[data-smf-marquee]', gsap: true, load: () => import('./modules/marquee.js') },
  { name: 'tooltip', selector: '[data-smf-tooltip]', load: () => import('./modules/tooltip.js') },
  { name: 'count', selector: '[data-smf-count]', gsap: true, load: () => import('./modules/count.js') },
  { name: 'highlight', selector: '[data-smf-highlight]', gsap: true, load: () => import('./modules/highlight.js') },
  { name: 'team', selector: '[data-smf-team]', gsap: true, load: () => import('./modules/team.js') },
  { name: 'cursor', selector: '[data-smf-cursor]', gsap: true, load: () => import('./modules/cursor.js') },
  { name: 'video', selector: '[data-smf-case-tile], [data-smf-video-autoplay], [data-smf-video-play]', load: () => import('./modules/video.js') },
  { name: 'consent', selector: '[smf-consent-element="root"]', load: () => import('./modules/consent.js') },
  { name: 'jsonld', selector: 'body', load: () => import('./modules/jsonld.js') },
  { name: 'form', selector: '[data-smf-form="contact"]', load: () => import('./modules/form.js') },
  { name: 'bento', selector: '[data-smf-bento], [data-smf-bento-ring]', gsap: true, load: () => import('./modules/bento.js') },
  { name: 'steps', selector: '[data-smf-steps]', gsap: true, load: () => import('./modules/steps.js') },
  { name: 'graph', selector: '[data-smf-graph-videos]', gsap: true, load: () => import('./modules/graph.js') },
  { name: 'roas', selector: '[data-smf-roas]', gsap: true, load: () => import('./modules/roas.js') },
  { name: 'blackhole', selector: '[data-smf-blackhole]', gsap: true, load: () => import('./modules/blackhole.js') },
  { name: 'pin-slider', selector: '[data-smf-pin-slider]', gsap: true, load: () => import('./modules/pin-slider.js') },
  { name: 'parallax', selector: '[data-smf-parallax-cols]', gsap: true, load: () => import('./modules/parallax.js') },
  { name: 'smuf', selector: '[data-smf-smuf]', load: () => import('./modules/smuf.js') },
];

// Les SVG des Smufs sont servis à côté du bundle (dist/smf.js → ../smufs/), au même tag.
const assetBase = new URL('../smufs/', import.meta.url).href;

const state = { version: __SMF_VERSION__, loaded: [], failed: [] };

async function boot() {
  const ctx = { env, debug: env.debug, assetBase };

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
