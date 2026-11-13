/**
 * E3 — Illustration ROAS (data-smf-roas), template Secteur.
 *
 * Structure Webflow : [data-smf-roas-track] (piste haute) > scène collante (CSS sticky, 100vh) > [data-smf-roas-layout] >
 * textes [data-smf-roas-text="1"] / ["2"] (superposés) + composant « Illustration ROAS » ([data-smf-roas] : anneau, ratio
 * [data-smf-roas-value], logos [data-smf-roas-logo], dont [data-smf-roas-win] pour les leviers « gagnants »).
 *
 * - Les logos sont répartis sur l'anneau par le script (ordre ORDER, puis ordre du DOM) et tournent en orbite tant que le bloc est visible.
 * - À l'arrivée : le ratio compte de 1:1 à la valeur de data-smf-roas-value (6:1), texte 1 affiché (« Nous pilotons… »).
 * - Au scroll dans la piste (ScrollTrigger scrub, réversible) : le texte 1 s'efface au profit du texte 2 (« Nous maximisons… »),
 *   les logos gagnants grossissent, les autres rétrécissent, se grisent et deviennent plus transparents. En remontant, tout revient.
 * - Reduced-motion : pas d'orbite ni de scroll piloté ; les deux textes sont empilés, ratio final, logos répartis.
 * - Sans piste (composant posé seul) : orbite + compteur uniquement.
 */
import { onViewport } from '../utils/viewport.js';
import { registerPlugins } from '../utils/gsap.js';

const ORDER = ['chatgpt', 'google-ads', 'instagram', 'snapchat', 'linkedin', 'tiktok', 'facebook', 'meta'];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => v * v * (3 - 2 * v);

export function init(elements, { gsap, env }) {
  const hasScrollTrigger = registerPlugins(gsap, ['ScrollTrigger']).length === 0;

  for (const root of elements) {
    const value = root.querySelector('[data-smf-roas-value]');
    if (!value) continue;
    const rank = (logo) => {
      const i = ORDER.indexOf(logo.getAttribute('data-smf-roas-logo'));
      return i < 0 ? ORDER.length : i;
    };
    const logos = [...root.querySelectorAll('[data-smf-roas-logo]')].sort((a, b) => rank(a) - rank(b));
    const track = root.closest('[data-smf-roas-track]');
    const text1 = track?.querySelector('[data-smf-roas-text="1"]');
    const text2 = track?.querySelector('[data-smf-roas-text="2"]');
    const target = Number(value.getAttribute('data-smf-roas-value')) || 6;
    const render = (v) => (value.textContent = `${Math.round(v)}:1`);

    // Répartition sur l'anneau (rayon = demi-hauteur du composant : l'anneau occupe toute la hauteur)
    let theta = 0;
    const place = () => {
      const radius = root.offsetHeight / 2;
      logos.forEach((logo, i) => {
        const a = -Math.PI / 2 + (i / logos.length) * Math.PI * 2 + theta;
        gsap.set(logo, { left: '50%', top: '50%', xPercent: -50, yPercent: -50, x: radius * Math.cos(a), y: radius * Math.sin(a) });
      });
    };
    place();
    window.addEventListener('resize', place);

    if (env.reducedMotion) {
      render(target);
      if (track) {
        track.style.height = 'auto';
        const sticky = track.firstElementChild;
        if (sticky) Object.assign(sticky.style, { position: 'static', height: 'auto' });
        if (text2) Object.assign(text2.style, { gridRowStart: '2', marginTop: '1.5rem' });
      }
      continue;
    }

    // Orbite
    const tick = (_, delta) => {
      theta += delta * 0.00022;
      place();
    };
    let ticking = false;
    const setTicking = (on) => {
      if (on === ticking) return;
      ticking = on;
      if (on) gsap.ticker.add(tick);
      else gsap.ticker.remove(tick);
    };

    // Compteur 1:1 → 6:1 à la première arrivée
    const state = { v: 1, counted: false };
    render(1);
    onViewport(root, {
      rootMargin: '0px 0px -20% 0px',
      enter: () => {
        setTicking(true);
        if (state.counted) return;
        state.counted = true;
        gsap.to(state, { v: target, duration: 2, ease: 'power2.out', onUpdate: () => render(state.v) });
      },
      leave: () => setTicking(false),
    });

    // Passage « pilotons » → « maximisons » lié au scroll (réversible)
    const apply = (progress) => {
      const t = smooth(clamp01((progress - 0.28) / 0.4));
      if (text1) gsap.set(text1, { opacity: 1 - clamp01(t * 2), y: -28 * t });
      if (text2) gsap.set(text2, { opacity: clamp01(t * 2 - 1), y: 28 * (1 - t) });
      for (const logo of logos) {
        if (logo.hasAttribute('data-smf-roas-win')) gsap.set(logo, { scale: 1 + 0.74 * t, zIndex: 2 });
        else gsap.set(logo, { scale: 1 - 0.12 * t, opacity: 1 - 0.5 * t, filter: `grayscale(${t})` });
      }
    };
    apply(0);
    if (track && hasScrollTrigger) {
      window.ScrollTrigger.create({ trigger: track, start: 'top top', end: 'bottom bottom', scrub: 0.5, onUpdate: (self) => apply(self.progress) });
    }
  }
}
