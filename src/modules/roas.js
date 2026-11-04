/**
 * E3 — Illustration ROAS (data-smf-roas) : le ratio [data-smf-roas-value] compte de 1:1 à 6:1 à l'entrée dans le
 * viewport ; les logos [data-smf-roas-logo] tournent en orbite autour du centre. Sur bureau, la section est épinglée
 * et le scroll fait repartir le ratio de 6:1 à 13:1 (certains logos grandissent, d'autres rétrécissent).
 * Mobile / reduced-motion : ratio final fixe (6:1), pas d'orbite ni d'épinglage.
 */
import { onViewport } from '../utils/viewport.js';
import { registerPlugins } from '../utils/gsap.js';

export function init(elements, { gsap, env }) {
  const hasScrollTrigger = registerPlugins(gsap, ['ScrollTrigger']).length === 0;

  for (const root of elements) {
    const value = root.querySelector('[data-smf-roas-value]');
    const logos = [...root.querySelectorAll('[data-smf-roas-logo]')];
    if (!value) continue;
    const render = (v) => (value.textContent = `${Math.round(v)}:1`);
    const state = { v: 1 };

    if (env.reducedMotion) continue;
    render(1);

    // Orbite : chaque logo garde son rayon et avance sur son cercle autour du centre de l'illustration
    const box = root.getBoundingClientRect();
    const center = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    const orbit = logos.map((logo) => {
      const r = logo.getBoundingClientRect();
      const dx = r.left + r.width / 2 - center.x;
      const dy = r.top + r.height / 2 - center.y;
      return { logo, radius: Math.hypot(dx, dy), angle: Math.atan2(dy, dx), dx, dy };
    });
    let theta = 0;
    const tick = (_, delta) => {
      theta += delta * 0.00025;
      for (const o of orbit) {
        gsap.set(o.logo, { x: o.radius * Math.cos(o.angle + theta) - o.dx, y: o.radius * Math.sin(o.angle + theta) - o.dy });
      }
    };

    let ticking = false;
    const setTicking = (on) => {
      if (on === ticking) return;
      ticking = on;
      on ? gsap.ticker.add(tick) : gsap.ticker.remove(tick);
    };

    onViewport(root, {
      enter: () => {
        setTicking(!env.mobile);
        if (state.v === 1) gsap.to(state, { v: 6, duration: 2, ease: 'power2.out', onUpdate: () => render(state.v) });
      },
      leave: () => setTicking(false),
    });

    if (hasScrollTrigger && !env.mobile) {
      const section = root.closest('section') || root;
      window.ScrollTrigger.create({
        trigger: section,
        start: 'top 15%',
        end: '+=80%',
        pin: true,
        scrub: 0.5,
        onUpdate: (self) => {
          if (self.progress <= 0) return;
          state.v = 6 + self.progress * 7;
          render(state.v);
          logos.forEach((logo, i) => gsap.set(logo, { scale: i % 2 === 0 ? 1 + self.progress * 0.5 : 1 - self.progress * 0.5, opacity: i % 2 === 0 ? 1 : 1 - self.progress * 0.7 }));
        },
      });
    }
  }
}
