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

  const show = (index) => {
    if (index === current) return;
    current = index;
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
    dots.forEach((dot, i) => (i === index ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current')));

    const slide = slides[index];
    const card = slide.firstElementChild;
    const tile = slide.querySelector('[data-slot="need-tile"]');
    gsap.fromTo(card, { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'power3.out', overwrite: 'auto' });
    if (tile) gsap.fromTo(tile, { y: 60, rotation: 4, opacity: 0 }, { y: 0, rotation: 0, opacity: 1, duration: 0.7, delay: 0.1, ease: 'power3.out', overwrite: 'auto' });
  };

  const trigger = window.ScrollTrigger.create({
    trigger: root,
    start: 'top top',
    end: () => `+=${Math.round(slides.length * window.innerHeight * 0.6)}`,
    pin: true,
    invalidateOnRefresh: true,
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
