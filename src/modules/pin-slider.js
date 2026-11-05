/**
 * H4 — Carrousel besoins épinglé (data-smf-pin-slider) : la section est épinglée, chaque cran de scroll = slide suivante.
 * Le CSS global gère l'affichage via .is-pinned (racine) et .is-active (slide) ; les puces [data-smf-pin-dot] sont
 * cliquables (aria-current). La carte texte et la tuile d'étude de cas bougent de façon différente, la tuile avec 0,1 s de retard.
 * À 767 px et en dessous, ou en reduced-motion : rien n'est épinglé, les slides restent empilées.
 */
import { registerPlugins } from '../utils/gsap.js';

export function init(elements, { gsap }) {
  if (registerPlugins(gsap, ['ScrollTrigger']).length) {
    console.warn('[smf] pin-slider : plugin ScrollTrigger absent (réglages GSAP du site).');
    return;
  }

  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px) and (prefers-reduced-motion: no-preference)', () => {
    const cleanups = elements.map(setup).filter(Boolean);
    return () => cleanups.forEach((fn) => fn());
  });
}

function setup(root) {
  const gsap = window.gsap;
  const slides = [...root.querySelectorAll('[aria-roledescription="diapositive"]')];
  const dots = [...root.querySelectorAll('[data-smf-pin-dot]')];
  if (slides.length < 2) return null;

  root.classList.add('is-pinned');
  let current = -1;

  // ScrollTrigger n'ajoute pas l'espace de scroll quand le parent est un conteneur flex (ici la pile `is-stack`) :
  // le contenu suivant remontait par-dessus le carrousel épinglé. On enveloppe donc la racine dans un bloc normal.
  const wrap = document.createElement('div');
  wrap.setAttribute('data-smf-pin-wrap', '');
  wrap.style.width = '100%';
  root.before(wrap);
  wrap.append(root);

  // Texte géant « OUIN » (data-smf-ouin) : STATIQUE. Il est seulement déplacé dans la racine épinglée pour rester
  // derrière le carrousel pendant l'épinglage (aucune animation).
  const section = wrap.closest('section');
  const ouins = section ? [...section.querySelectorAll('[data-smf-ouin]')] : [];
  ouins.forEach((el) => root.prepend(el));

  const parts = (slide) => [slide.firstElementChild, slide.querySelector('[data-slot="need-tile"]')].filter(Boolean);
  const reset = (slide) => {
    const p = parts(slide);
    gsap.killTweensOf(p);
    gsap.set(p, { clearProps: 'opacity,transform' });
    slide.style.visibility = '';
    slide.style.opacity = '';
  };

  /**
   * Transition entre slides, sensible au sens du scroll : la slide sortante monte (ou descend) en s'effaçant vite
   * (carte puis tuile), la suivante arrive du sens opposé avec un léger retard, en expo.out. Les deux restent
   * empilées dans la même cellule de grille pendant le fondu ; la sortante est maintenue visible en style inline.
   */
  const show = (index) => {
    if (index === current) return;
    const prevIndex = current;
    const dir = prevIndex < 0 || index > prevIndex ? 1 : -1;
    current = index;
    const next = slides[index];
    const prev = prevIndex >= 0 ? slides[prevIndex] : null;

    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
      if (slide !== next && slide !== prev) reset(slide);
    });
    dots.forEach((dot, i) => (i === index ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current')));

    if (prev) {
      const out = parts(prev);
      gsap.killTweensOf(out);
      prev.style.visibility = 'visible';
      prev.style.opacity = '1';
      gsap.to(out, {
        opacity: 0,
        y: -34 * dir,
        duration: 0.3,
        ease: 'power2.in',
        stagger: 0.04,
        overwrite: true,
        onComplete: () => reset(prev),
      });
    }

    reset(next);
    const [card, tile] = parts(next);
    const delay = prev ? 0.22 : 0;
    gsap.fromTo(card, { opacity: 0, y: 56 * dir }, { opacity: 1, y: 0, duration: 0.85, delay, ease: 'expo.out' });
    if (tile) gsap.fromTo(tile, { opacity: 0, y: 80 * dir, rotation: 3 * dir, scale: 0.97 }, { opacity: 1, y: 0, rotation: 0, scale: 1, duration: 0.95, delay: delay + 0.1, ease: 'expo.out' });
  };

  const trigger = window.ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: () => `+=${Math.round(slides.length * window.innerHeight * 0.6)}`,
    pin: true,
    invalidateOnRefresh: true,
    // aimante doucement le scroll au centre de la slide la plus proche une fois arrêté (pas de scroll-jacking)
    snap: { snapTo: (v) => (Math.min(slides.length - 1, Math.floor(v * slides.length)) + 0.5) / slides.length, duration: { min: 0.25, max: 0.7 }, delay: 0.12, ease: 'power2.inOut' },
    onUpdate: (self) => show(Math.min(slides.length - 1, Math.floor(self.progress * slides.length))),
  });
  show(0);

  const goTo = (index) => {
    const top = trigger.start + ((index + 0.5) / slides.length) * (trigger.end - trigger.start);
    window.scrollTo({ top, behavior: 'smooth' });
  };
  const handlers = dots.map((dot, index) => {
    const onClick = (event) => {
      event.preventDefault();
      goTo(index);
    };
    dot.addEventListener('click', onClick);
    return [dot, onClick];
  });

  return () => {
    handlers.forEach(([dot, fn]) => dot.removeEventListener('click', fn));
    trigger.kill();
    ouins.forEach((el) => section.prepend(el));
    slides.forEach(reset);
    if (wrap.parentNode) {
      wrap.before(root);
      wrap.remove();
    }
    root.classList.remove('is-pinned');
    slides.forEach((slide) => slide.classList.remove('is-active'));
    dots.forEach((dot) => dot.removeAttribute('aria-current'));
    current = -1;
  };
}
