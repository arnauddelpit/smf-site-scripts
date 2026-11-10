/**
 * H4 — Carrousel besoins épinglé (data-smf-pin-slider) : la section est épinglée, chaque cran de scroll = slide suivante.
 * Le CSS global gère l'affichage via .is-pinned (racine) et .is-active (slide) ; les puces [data-smf-pin-dot] sont
 * cliquables (aria-current). L'en-tête de la section (titre + texte) est épinglé avec le carrousel. La carte texte et la tuile
 * d'étude de cas entrent / sortent par le bas / le haut en même temps (la carte plus vite : elle est moins haute), avec un léger rebond.
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
  // Ce bloc est ce qu'on épingle : il contient aussi l'en-tête de section (titre + texte), qui précède le carrousel, pour que
  // titre, texte et slider restent visibles ensemble. Hauteur = écran ; le carrousel prend la place restante.
  const wrap = document.createElement('div');
  wrap.setAttribute('data-smf-pin-wrap', '');
  wrap.style.cssText = 'width:100%;height:100vh;height:100svh;position:relative;display:flex;flex-direction:column;gap:1.5rem;padding-top:4.5rem;padding-bottom:1.5rem;box-sizing:border-box';
  const head = root.previousElementSibling;
  root.before(wrap);
  if (head) wrap.append(head);
  wrap.append(root);
  // Le carrousel remplit la hauteur restante ; les slides sortantes / entrantes sont rognées en haut et en bas (pas sur les côtés)
  root.style.minHeight = '0';
  root.style.flex = '1 1 0';
  root.style.clipPath = 'inset(0 -100vw 0 -100vw)';

  // Texte géant « OUIN » (data-smf-ouin) : STATIQUE. Il est seulement déplacé dans le bloc épinglé pour rester
  // derrière le carrousel pendant l'épinglage (aucune animation).
  const section = wrap.closest('section');
  const ouins = section ? [...section.querySelectorAll('[data-smf-ouin]')] : [];
  ouins.forEach((el) => wrap.prepend(el));

  const parts = (slide) => [slide.firstElementChild, slide.querySelector('[data-slot="need-tile"]')].filter(Boolean);
  const reset = (slide) => {
    const p = parts(slide);
    gsap.killTweensOf(p);
    gsap.set(p, { clearProps: 'transform' });
    slide.style.visibility = '';
    slide.style.opacity = '';
  };

  /** Position (haut) et hauteur d'un élément dans le carrousel, hors translation GSAP en cours. */
  const geom = (el) => {
    const y = Number(gsap.getProperty(el, 'y')) || 0;
    const r = el.getBoundingClientRect();
    return { top: r.top - root.getBoundingClientRect().top - y, h: r.height };
  };
  /**
   * Distance à parcourir pour entrer (depuis le bas) ou sortir (par le haut) du carrousel. La carte est moins haute que la tuile :
   * pour arriver / partir en même temps (même durée), elle parcourt une distance plus grande dans le rapport des hauteurs,
   * donc elle va plus vite.
   */
  const travel = (slide, mode) => {
    const [card, tile] = parts(slide);
    const main = tile || card;
    const g = geom(main);
    const base = mode === 'in' ? root.clientHeight - g.top : g.top + g.h;
    const ratio = tile ? Math.max(1, g.h / geom(card).h) : 1;
    return { card: base * ratio, tile: base };
  };

  /**
   * Transition entre slides, sensible au sens du scroll : la sortante quitte le carrousel (par le haut en descendant, par le bas en
   * remontant) avec un petit recul avant de partir ; la suivante arrive du sens opposé avec un léger rebond à l'arrivée.
   * Aucun fondu, aucune rotation. Les deux restent empilées dans la même cellule de grille ; la sortante est maintenue
   * visible en style inline pendant son départ.
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
      const dist = travel(prev, 'out');
      gsap.killTweensOf(out);
      prev.style.visibility = 'visible';
      prev.style.opacity = '1';
      out.forEach((part, i) => {
        gsap.to(part, {
          y: -dir * (i === 0 ? dist.card : dist.tile),
          duration: 0.7,
          ease: 'back.in(1.2)',
          overwrite: true,
          onComplete: i === 0 ? () => reset(prev) : undefined,
        });
      });
    }

    reset(next);
    if (!prev) return; // première slide : en place, sans animation
    const dist = travel(next, 'in');
    const [card, tile] = parts(next);
    const delay = 0.25;
    gsap.fromTo(card, { y: dist.card * dir }, { y: 0, duration: 1, delay, ease: 'back.out(1.3)' });
    if (tile) gsap.fromTo(tile, { y: dist.tile * dir }, { y: 0, duration: 1, delay, ease: 'back.out(1.3)' });
  };

  const trigger = window.ScrollTrigger.create({
    trigger: wrap,
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
    root.style.minHeight = '';
    root.style.flex = '';
    root.style.clipPath = '';
    if (wrap.parentNode) {
      if (head) wrap.before(head);
      wrap.before(root);
      wrap.remove();
    }
    root.classList.remove('is-pinned');
    slides.forEach((slide) => slide.classList.remove('is-active'));
    dots.forEach((dot) => dot.removeAttribute('aria-current'));
    current = -1;
  };
}
