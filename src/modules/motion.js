/**
 * Micro-interactions et animations « éditoriales » inspirées des pages produit Apple (scrub au scroll, révélations
 * mot à mot, médias qui s'élargissent, profondeur, boutons magnétiques). Tout est piloté par des attributs :
 *
 *  data-smf-split-title   h1/h2 : les mots montent d'un masque, en cascade, au chargement / à l'entrée dans le viewport
 *  data-smf-scrub-text    paragraphe : les mots passent de 18 % à 100 % d'opacité au fil du scroll
 *  data-smf-scale-in      média : part à 88 % et angles plus arrondis, s'élargit à 100 % en entrant (scrub)
 *  data-smf-depth="N"     décor : se décale de N px (négatif = plus lent) sur la traversée de l'écran (scrub)
 *  data-smf-magnetic      bouton : suit légèrement le pointeur, s'enfonce au clic (désactivé au tactile)
 *  data-smf-card / data-smf-case-tile   cartes équipe et tuiles de cas : soulèvement + inclinaison 3D au survol
 *
 * reduced-motion : rien n'est animé, le contenu reste à son état final.
 */
import { registerPlugins } from '../utils/gsap.js';

/** Enveloppe chaque mot des nœuds texte de `root` dans un <span> ; renvoie les spans (ordre de lecture). */
function splitWords(root, { clip = false } = {}) {
  const words = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const node of nodes) {
    if (!node.nodeValue.trim()) continue;
    const frag = document.createDocumentFragment();
    for (const part of node.nodeValue.split(/(\s+)/)) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        frag.append(part);
        continue;
      }
      const word = document.createElement('span');
      word.className = 'smf-word';
      word.style.display = 'inline-block';
      word.textContent = part;
      if (clip) {
        const mask = document.createElement('span');
        mask.className = 'smf-word-mask';
        mask.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:0.08em;margin-bottom:-0.08em';
        mask.append(word);
        frag.append(mask);
      } else {
        frag.append(word);
      }
      words.push(word);
    }
    node.replaceWith(frag);
  }
  return words;
}

export function init(elements, { gsap, env }) {
  if (env.reducedMotion) return;
  const missing = registerPlugins(gsap, ['ScrollTrigger']);
  if (missing.length) {
    console.warn('[smf] motion : plugin ScrollTrigger absent.');
    return;
  }

  const pick = (attr) => elements.filter((el) => el.hasAttribute(attr));

  // Titres : mots qui montent du masque
  for (const el of pick('data-smf-split-title')) {
    const label = el.textContent.trim();
    const words = splitWords(el, { clip: true });
    if (!words.length) continue;
    el.setAttribute('aria-label', label);
    words.forEach((w) => w.setAttribute('aria-hidden', 'true'));
    gsap.set(words, { yPercent: 110, rotate: 4, transformOrigin: '0% 100%' });
    gsap.to(words, {
      yPercent: 0,
      rotate: 0,
      duration: 0.9,
      ease: 'power4.out',
      stagger: 0.06,
      delay: 0.15,
      scrollTrigger: { trigger: el, start: 'top 92%', once: true },
    });
  }

  // Paragraphes : opacité mot à mot liée au scroll
  for (const el of pick('data-smf-scrub-text')) {
    const words = splitWords(el);
    if (!words.length) continue;
    gsap.set(words, { opacity: 0.18 });
    gsap.to(words, {
      opacity: 1,
      ease: 'none',
      stagger: 0.12,
      scrollTrigger: { trigger: el, start: 'top 88%', end: 'bottom 52%', scrub: 0.4 },
    });
  }

  const media = gsap.matchMedia();
  media.add('(min-width: 768px)', () => {
    // Médias qui s'élargissent
    for (const el of pick('data-smf-scale-in')) {
      // clip-path plutôt que border-radius (compositing) ; scale + clip uniquement (skill scroll-experience : transform/opacity/clip-path)
      gsap.fromTo(
        el,
        { scale: 0.88, clipPath: 'inset(0% round 2.5rem)', transformOrigin: '50% 100%' },
        { scale: 1, clipPath: 'inset(0% round 0rem)', ease: 'none', scrollTrigger: { trigger: el, start: 'top 92%', end: 'top 25%', scrub: 0.5 } },
      );
    }

    // Profondeur
    for (const el of pick('data-smf-depth')) {
      const depth = Number(el.getAttribute('data-smf-depth')) || 0;
      if (!depth) continue;
      gsap.fromTo(
        el,
        { y: -depth / 2 },
        { y: depth / 2, ease: 'none', scrollTrigger: { trigger: el.closest('section') || el, start: 'top bottom', end: 'bottom top', scrub: 0.6 } },
      );
    }
  });

  // Cartes (équipe, tuiles d'études de cas) : léger soulèvement et inclinaison vers le pointeur, retour en ressort
  if (!env.touch) {
    // (cartes du mini-jeu exclues : le jeu pilote leurs transformations ; pas de `y` sur les tuiles : parallaxe G8)
    for (const el of elements.filter((e) => (e.hasAttribute('data-smf-card') && !e.closest('[data-smf-team="game"]')) || e.hasAttribute('data-smf-case-tile'))) {
      const big = el.hasAttribute('data-smf-case-tile');
      const rx = gsap.quickTo(el, 'rotationX', { duration: 0.5, ease: 'power3.out' });
      const ry = gsap.quickTo(el, 'rotationY', { duration: 0.5, ease: 'power3.out' });
      gsap.set(el, { transformPerspective: 900 });
      el.addEventListener('mouseenter', () => gsap.to(el, { scale: big ? 1.015 : 1.05, duration: 0.4, ease: 'power3.out' }));
      el.addEventListener('mousemove', (event) => {
        const r = el.getBoundingClientRect();
        const px = (event.clientX - r.left) / r.width - 0.5;
        const py = (event.clientY - r.top) / r.height - 0.5;
        ry(px * (big ? 5 : 9));
        rx(-py * (big ? 5 : 9));
      });
      el.addEventListener('mouseleave', () => {
        rx(0);
        ry(0);
        gsap.to(el, { scale: 1, duration: 0.7, ease: 'elastic.out(1, 0.55)' });
      });
    }
  }

  // Boutons magnétiques (pas au tactile)
  if (!env.touch) {
    for (const el of pick('data-smf-magnetic')) {
      const x = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      const y = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('mousemove', (event) => {
        const r = el.getBoundingClientRect();
        x((event.clientX - (r.left + r.width / 2)) * 0.28);
        y((event.clientY - (r.top + r.height / 2)) * 0.4);
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, scale: 1, duration: 0.8, ease: 'elastic.out(1, 0.45)', overwrite: 'auto' });
      });
      el.addEventListener('mouseenter', () => gsap.to(el, { scale: 1.03, duration: 0.25, ease: 'expo.out' }));
      el.addEventListener('mousedown', () => gsap.to(el, { scale: 0.96, duration: 0.1, ease: 'power2.out', overwrite: 'auto' }));
      el.addEventListener('mouseup', () => gsap.to(el, { scale: 1.03, duration: 0.45, ease: 'back.out(3)' }));
    }
  }

  // Retour d'appui instantané (100 ms) sur les filtres et contrôles, y compris au tactile
  for (const el of pick('data-smf-press')) {
    const down = () => gsap.to(el, { scale: 0.95, duration: 0.1, ease: 'power2.out', overwrite: 'auto' });
    const up = () => gsap.to(el, { scale: 1, duration: 0.45, ease: 'back.out(3)', overwrite: 'auto' });
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointerleave', up);
    el.addEventListener('pointercancel', up);
  }
}
