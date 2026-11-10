/**
 * H4 — Carrousel besoins empilé (data-smf-pin-slider) : les slides sont sticky en haut de l'écran, sous l'en-tête de la
 * section (titre + texte, sticky lui aussi). Quand la slide suivante remonte par-dessus la précédente, celle-ci rétrécit
 * légèrement et s'efface (animation liée au scroll). Les puces [data-smf-pin-dot] sont cliquables (aria-current).
 * Aucun épinglage ScrollTrigger : le scroll de la page reste naturel.
 * À 767 px et en dessous, ou en reduced-motion : rien n'est sticky, les slides restent empilées.
 */
import { registerPlugins } from '../utils/gsap.js';

const HEAD_TOP = 72; // px : décalage de l'en-tête sticky (sous la barre de navigation compacte de 60 px)
const HEAD_GAP = 24; // px : espace entre l'en-tête et les slides
const SCALE_DOWN = 0.93; // échelle finale de la slide recouverte
const OUIN_DURATION = 7; // s : traversée de l'écran par chaque « oin »
// Smuf qui pleure : position sur la carte (Figma : centre à 67,5 % de la largeur, pieds 3 px sous le bord haut ;
// feet = 3 px + 25 px de marge transparente sous les pieds dans le Lottie)
const SMUF = { left: 'calc(67.5% - 93px)', feet: 28, width: 187 };
const HOLD = 0.3; // part de la hauteur d'écran où chaque slide reste seule et nette avant que la suivante ne remonte

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
  const ScrollTrigger = window.ScrollTrigger;
  const list = root.querySelector('.needs-slider_list');
  const slides = [...root.querySelectorAll('[aria-roledescription="diapositive"]')];
  const dotsNav = root.querySelector('nav');
  const dots = [...root.querySelectorAll('[data-smf-pin-dot]')];
  if (!list || slides.length < 2) return null;

  // L'en-tête de la section (titre + texte) précède le carrousel : il reste sticky pendant toute la traversée.
  const head = root.previousElementSibling;
  if (head) {
    head.style.position = 'sticky';
    head.style.top = `${HEAD_TOP}px`;
    head.style.zIndex = '6';
  }

  // Puces : déplacées avant la liste pour pouvoir être sticky (centrées en hauteur), sans prendre de place dans le flux.
  const dotsParent = dotsNav ? dotsNav.parentNode : null;
  const dotsNext = dotsNav ? dotsNav.nextSibling : null;
  if (dotsNav) {
    root.prepend(dotsNav);
    dotsNav.style.cssText = 'display:flex;position:sticky;top:50svh;align-self:flex-end;z-index:6;transform:none;right:auto';
  }

  // Texte géant « OUIN » (data-smf-ouin) : STATIQUE, positionné par rapport au haut de l'écran. Il est placé dans un calque
  // sticky (hauteur nulle) derrière les slides, pour rester en place pendant toute la traversée.
  const section = root.closest('section');
  const ouins = section ? [...section.querySelectorAll('[data-smf-ouin]')] : [];
  let holder = null;
  if (ouins.length) {
    holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.style.cssText = 'position:sticky;top:0;align-self:stretch;height:0;z-index:0;pointer-events:none';
    root.prepend(holder);
    ouins.forEach((el) => holder.append(el));
  }

  // Smuf qui pleure (data-smf-needs-smuf) : posé sur le haut de la carte de la première slide (pieds sur la carte, comme dans Figma).
  const smuf = section ? section.querySelector('[data-smf-needs-smuf]') : null;
  const firstCard = slides[0].firstElementChild;
  const smufHome = smuf ? { parent: smuf.parentNode, next: smuf.nextSibling, style: smuf.getAttribute('style') } : null;
  if (smuf && firstCard) {
    firstCard.style.position = 'relative';
    smuf.style.cssText = `position:absolute;left:${SMUF.left};top:auto;right:auto;bottom:calc(100% - ${SMUF.feet}px);width:${SMUF.width}px;z-index:2;pointer-events:none`;
    firstCard.append(smuf);
  }

  // « oin » géants : celui du haut traverse l'écran de droite à gauche, celui du bas de gauche à droite, une seule fois, quand
  // le carrousel arrive dans l'écran. Avant, ils attendent hors écran.
  const ouinSpan = (el) => {
    const x = Number(gsap.getProperty(el, 'x')) || 0;
    const r = el.getBoundingClientRect();
    return { left: r.left - x, right: r.right - x, width: window.innerWidth };
  };
  const ouinEnds = (el) => {
    const { left, right, width } = ouinSpan(el);
    const rtl = el.getAttribute('data-smf-ouin') === '1';
    return rtl ? [width - left, -right] : [-right, width - left];
  };
  ouins.forEach((el) => gsap.set(el, { x: ouinEnds(el)[0] }));
  let ouinTween = null;
  const ouinTrigger = ouins.length
    ? ScrollTrigger.create({
        trigger: root,
        start: 'top 80%',
        once: true,
        onEnter: () => {
          ouinTween = gsap.to(
            ouins,
            { x: (i, el) => ouinEnds(el)[1], duration: OUIN_DURATION, ease: 'none' },
          );
        },
      })
    : null;

  list.style.rowGap = '0px';
  let stickyTop = HEAD_TOP;
  const layout = () => {
    stickyTop = head ? HEAD_TOP + head.offsetHeight + HEAD_GAP : HEAD_TOP;
    slides.forEach((slide) => {
      slide.style.position = 'sticky';
      slide.style.top = `${stickyTop}px`;
      // chaque slide occupe la hauteur restante de l'écran : la suivante démarre juste sous le bord bas
      slide.style.minHeight = `${Math.max(0, window.innerHeight - stickyTop)}px`;
      slide.style.transformOrigin = '50% 0%';
    });
    // temps de lecture : la slide reste seule et nette sur cette distance de scroll avant que la suivante n'apparaisse
    // Dernière slide : une slide sticky ne reste calée que si son conteneur se prolonge sous elle, d'où le padding de la liste
    // (une marge sur la dernière slide ne suffit pas : elle repartirait dès qu'elle est calée).
    const hold = `${Math.round(window.innerHeight * HOLD)}px`;
    slides.forEach((slide, i) => {
      slide.style.marginBottom = i < slides.length - 1 ? hold : '';
    });
    list.style.paddingBottom = hold;
    if (dotsNav) dotsNav.style.marginBottom = `-${dotsNav.offsetHeight}px`;
  };
  layout();
  ScrollTrigger.addEventListener('refreshInit', layout);

  let current = -1;
  const setActive = (index) => {
    const i = Math.max(0, Math.min(slides.length - 1, index));
    if (i === current) return;
    current = i;
    dots.forEach((dot, k) => (k === i ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current')));
  };
  setActive(0);

  const triggers = [];
  const tweens = [];
  slides.forEach((slide, i) => {
    if (i > 0) {
      // La slide précédente se réduit légèrement et s'efface pendant que celle-ci remonte par-dessus.
      const tween = gsap.to(slides[i - 1], {
        scale: SCALE_DOWN,
        opacity: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: slide,
          start: 'top 95%',
          end: () => `top ${stickyTop}px`,
          scrub: 0.3,
          invalidateOnRefresh: true,
        },
      });
      tweens.push(tween);
    }
    triggers.push(
      ScrollTrigger.create({
        trigger: slide,
        start: () => `top ${stickyTop + 120}px`,
        onEnter: () => setActive(i),
        onLeaveBack: () => setActive(i - 1),
      }),
    );
  });

  const goTo = (index) => {
    const listTop = list.getBoundingClientRect().top + window.scrollY;
    const before = slides.slice(0, index).reduce((sum, slide) => sum + slide.offsetHeight + (parseFloat(slide.style.marginBottom) || 0), 0);
    window.scrollTo({ top: listTop + before - stickyTop + 2, behavior: 'smooth' });
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
    ScrollTrigger.removeEventListener('refreshInit', layout);
    triggers.forEach((t) => t.kill());
    tweens.forEach((tween) => {
      tween.scrollTrigger?.kill();
      tween.kill();
    });
    slides.forEach((slide) => {
      gsap.set(slide, { clearProps: 'transform,opacity' });
      slide.style.position = '';
      slide.style.top = '';
      slide.style.minHeight = '';
      slide.style.marginBottom = '';
      slide.style.transformOrigin = '';
    });
    list.style.rowGap = '';
    list.style.paddingBottom = '';
    ouinTrigger?.kill();
    ouinTween?.kill();
    ouins.forEach((el) => gsap.set(el, { clearProps: 'transform' }));
    if (smuf && smufHome) {
      if (smufHome.style === null) smuf.removeAttribute('style');
      else smuf.setAttribute('style', smufHome.style);
      smufHome.parent.insertBefore(smuf, smufHome.next);
      if (firstCard) firstCard.style.position = '';
    }
    if (holder) {
      ouins.forEach((el) => section.prepend(el));
      holder.remove();
    }
    if (head) {
      head.style.position = '';
      head.style.top = '';
      head.style.zIndex = '';
    }
    if (dotsNav) {
      dotsNav.style.cssText = '';
      if (dotsParent) dotsParent.insertBefore(dotsNav, dotsNext);
    }
    dots.forEach((dot) => dot.removeAttribute('aria-current'));
    current = -1;
  };
}
