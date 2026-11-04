/**
 * Smufs (data-smf-smuf = identifiant de docs/smufs.md) : injecte le SVG inline (smufs/<id>.svg) à l'entrée dans le
 * viewport, puis lui donne un mouvement de repos léger (flottement) tant qu'il est visible.
 * Les timelines propres à chaque Smuf (yeux, paupières, bras…) viennent ensuite, Smuf par Smuf.
 * Une description vide (data-smf-smuf-desc absente ou vide) rend le Smuf décoratif (aria-hidden).
 */
import { onViewport } from '../utils/viewport.js';

const cache = new Map();

/**
 * Mouvements « corps entier » par Smuf (les SVG sont des exports Figma bruts, sans groupes yeux / bras / bouche :
 * des timelines par partie demandent un regroupement manuel de chaque dessin). Chaque effet renvoie une timeline en boucle.
 */
const loop = (gsap, vars = {}) => gsap.timeline({ repeat: -1, ...vars });
const EFFECTS = {
  default: (svg, gsap) => gsap.to(svg, { y: -6, rotation: 1.2, duration: 2.2 + Math.random(), ease: 'sine.inOut', yoyo: true, repeat: -1 }),
  // G12 — Smuf qui se prend en photo : flash blanc à intervalles aléatoires (2 à 6 s)
  photo: (svg, gsap) => {
    let call = null;
    const flash = () => {
      gsap.timeline()
        .to(svg, { filter: 'brightness(3) drop-shadow(0 0 28px #fff)', duration: 0.08 })
        .to(svg, { filter: 'brightness(1) drop-shadow(0 0 0 #fff)', duration: 0.5, ease: 'power2.out' });
      call = gsap.delayedCall(2 + Math.random() * 4, flash);
    };
    // objet pausable, comme une timeline : play() planifie le prochain flash, pause() l'annule
    return {
      play: () => { if (!call) call = gsap.delayedCall(0.6, flash); },
      pause: () => { call?.kill(); call = null; },
    };
  },
  // G14 — Toujours pas convaincu : la bouche tremble, en continu (tremblement léger du corps)
  'not-convinced': (svg, gsap) => loop(gsap, { yoyo: true }).to(svg, { x: 1.5, skewX: 1.5, duration: 0.09, ease: 'sine.inOut' }),
  // G13 — « Qui sont-ce » : la pancarte bouge, petit clin d'œil de corps, pause, boucle
  'who-sign': (svg, gsap) => loop(gsap, { repeatDelay: 1.2 }).to(svg, { rotation: -4, transformOrigin: '50% 100%', duration: 0.5, ease: 'power1.inOut' }).to(svg, { rotation: 3, duration: 0.7, ease: 'power1.inOut' }).to(svg, { rotation: 0, duration: 0.4 }),
  // Pleureurs (S1, H4) : sanglots, petits rebonds
  'crying-sign': (svg, gsap) => loop(gsap).to(svg, { y: 4, scaleY: 0.985, duration: 0.25, ease: 'sine.inOut', yoyo: true, repeat: 3 }).to({}, { duration: 1 }),
  crying: (svg, gsap) => loop(gsap).to(svg, { y: 3, duration: 0.22, ease: 'sine.inOut', yoyo: true, repeat: 3 }).to({}, { duration: 0.9 }),
  // H7 — Ninja qui court en continu
  ninja: (svg, gsap) => loop(gsap, { yoyo: true }).to(svg, { x: 10, y: -3, rotation: 2, duration: 0.35, ease: 'sine.inOut' }),
  'ninja-alt': (svg, gsap) => loop(gsap, { yoyo: true }).to(svg, { x: -10, y: -3, rotation: -2, duration: 0.35, ease: 'sine.inOut' }),
  // A1 — Paillettes : petite pulsation brillante
  glitter: (svg, gsap) => loop(gsap, { yoyo: true }).to(svg, { scale: 1.05, filter: 'brightness(1.2)', duration: 0.8, ease: 'sine.inOut' }),
  // A3 — Smuf satisfait qui bouge son surligneur
  highlighter: (svg, gsap) => loop(gsap, { yoyo: true }).to(svg, { rotation: -3, x: 3, duration: 0.6, ease: 'sine.inOut' }),
  // A2 / E1 — présentation sur tablette : léger balancement
  tablet: (svg, gsap) => loop(gsap, { yoyo: true }).to(svg, { rotation: 2.5, y: -4, duration: 1.1, ease: 'sine.inOut' }),
  // H3 — POV : clin d'œil (petit rebond puis pause de 2 s)
  'pov-wink': (svg, gsap) => loop(gsap, { repeatDelay: 2 }).to(svg, { scale: 1.06, rotation: -3, duration: 0.2, ease: 'back.out(3)' }).to(svg, { scale: 1, rotation: 0, duration: 0.3 }),
  // B2 — suspendu à un fil : balancier
  hanging: (svg, gsap) => loop(gsap, { yoyo: true }).to(svg, { rotation: 4, transformOrigin: '50% 0%', duration: 1.4, ease: 'sine.inOut' }),
};

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

export function init(elements, { gsap, env, assetBase }) {
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

          if (!env.reducedMotion && id !== 'team-cursor') {
            const idle = (EFFECTS[id] || EFFECTS.default)(svg, gsap);
            idle.pause();
            onViewport(el, { enter: () => idle.play(), leave: () => idle.pause() });
          }
        } catch (error) {
          console.warn(`[smf] Smuf « ${id} » :`, error);
        }
      },
    });
  }
}
