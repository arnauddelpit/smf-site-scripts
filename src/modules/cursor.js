/**
 * G5 — Curseur main (data-smf-cursor) : sur les zones data-smf-cursor-zone et les blocs data-smf-team, le curseur
 * natif est masqué et la main suit la souris (lerp 0,2) ; léger « clic » (scale 0,9) au mousedown.
 * Désactivé sur tactile et en reduced-motion.
 */
export function init([cursor], { gsap, env }) {
  if (env.touch || env.reducedMotion) {
    cursor.style.display = 'none';
    return;
  }

  const zones = [...document.querySelectorAll('[data-smf-cursor-zone], [data-smf-team]')];
  if (!zones.length) return;

  cursor.setAttribute('aria-hidden', 'true');
  Object.assign(cursor.style, { position: 'fixed', left: '0', top: '0', pointerEvents: 'none', zIndex: '9999' });
  gsap.set(cursor, { opacity: 0, xPercent: -20, yPercent: -10 });

  const x = gsap.quickTo(cursor, 'x', { duration: 0.2, ease: 'power3.out' });
  const y = gsap.quickTo(cursor, 'y', { duration: 0.2, ease: 'power3.out' });
  let inside = 0;

  const show = (visible) => gsap.to(cursor, { opacity: visible ? 1 : 0, duration: 0.2 });

  for (const zone of zones) {
    zone.addEventListener('mouseenter', (event) => {
      inside += 1;
      zone.style.cursor = 'none';
      for (const child of zone.querySelectorAll('a, button, [role="button"], [data-smf-card]')) child.style.cursor = 'none';
      x(event.clientX);
      y(event.clientY);
      show(true);
    });
    zone.addEventListener('mousemove', (event) => {
      x(event.clientX);
      y(event.clientY);
    });
    zone.addEventListener('mouseleave', () => {
      inside = Math.max(0, inside - 1);
      if (!inside) show(false);
    });
    zone.addEventListener('mousedown', () => gsap.to(cursor, { scale: 0.9, duration: 0.1 }));
    zone.addEventListener('mouseup', () => gsap.to(cursor, { scale: 1, duration: 0.15 }));
  }
}
