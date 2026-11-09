/**
 * Micro-interactions et animations « éditoriales » inspirées des pages produit Apple (scrub au scroll, révélations
 * mot à mot, médias qui s'élargissent, profondeur, boutons magnétiques). Tout est piloté par des attributs :
 *
 *  data-smf-split-title   h1/h2 : les mots montent d'un masque, en cascade, au chargement / à l'entrée dans le viewport
 *  data-smf-scrub-text    paragraphe : les mots passent de 18 % à 100 % d'opacité au fil du scroll
 *  data-smf-scale-in      média : part à 88 % et angles plus arrondis, s'élargit à 100 % en entrant (scrub)
 *  data-smf-drift="far|mid|near"   logos flottants : dérive continue de droite à gauche sur 3 plans (vitesse, flou, opacité)
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
    for (const part of node.nodeValue.split(/([ \t\r\n]+)/)) {
      if (!part) continue;
      if (/^[ \t\r\n]+$/.test(part)) {
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

  // Logos flottants du hero : dérive continue de droite à gauche sur trois plans (far / mid / near).
  // Plus le plan est proche, plus l'élément est net, opaque et rapide ; il ressort à droite après être sorti à gauche.
  const drifters = pick('data-smf-drift');
  if (drifters.length) {
    // size = largeur absolue en px ; z : seul le premier plan passe devant le texte et la vidéo
    // Écart marqué entre les plans : taille, opacité, flou, vitesse, amplitude et rythme du mouvement vertical
    const layers = {
      far: { speed: 8, opacity: 0.2, blur: 4.5, bob: 5, freq: 0.45, size: 36, z: '' },
      mid: { speed: 20, opacity: 0.55, blur: 1.8, bob: 12, freq: 0.7, size: 56, z: '' },
      near: { speed: 70, opacity: 1, blur: 0, bob: 38, freq: 1.25, size: 80, z: '3' },
    };
    const applyPlane = (item, name) => {
      const cfg = layers[name];
      item.plane = name;
      item.cfg = cfg;
      item.el.style.width = `${cfg.size}px`;
      item.el.style.zIndex = cfg.z;
      gsap.set(item.el, { opacity: cfg.opacity, filter: cfg.blur ? `blur(${cfg.blur}px)` : 'none' });
    };
    const items = drifters.map((el, i) => {
      // Bulles dupliquées : position de départ (left en %, top en rem) donnée par data-smf-drift-pos="left,top"
      const at = el.getAttribute('data-smf-drift-pos');
      if (at) {
        const [left, top] = at.split(',').map(Number);
        el.style.left = `${left}%`;
        el.style.top = `${top}rem`;
      }
      const item = { el, net: el.getAttribute('data-smf-drift-net') || `n${i}`, x: 0, phase: i * 1.7 };
      applyPlane(item, layers[el.getAttribute('data-smf-drift')] ? el.getAttribute('data-smf-drift') : 'mid');
      gsap.set(el, { willChange: 'transform' });
      return item;
    });
    // À chaque passage de la gauche vers la droite, la bulle change de plan : elle prend, parmi les deux autres,
    // celui qui compte le moins de bulles (les trois plans restent équilibrés). Deux bulles du même réseau
    // (data-smf-drift-net) ne sont jamais sur le même plan.
    const nextPlane = (item) => {
      const count = (name) => items.filter((it) => it.plane === name).length;
      const taken = new Set(items.filter((it) => it !== item && it.net === item.net).map((it) => it.plane));
      let others = Object.keys(layers).filter((name) => name !== item.plane && !taken.has(name));
      if (!others.length) others = Object.keys(layers).filter((name) => name !== item.plane);
      const min = Math.min(...others.map(count));
      const pool = others.filter((name) => count(name) === min);
      return pool[Math.floor(Math.random() * pool.length)];
    };
    let running = false;
    const tick = (time, deltaTime) => {
      // gsap.ticker : time en secondes, deltaTime en millisecondes
      const dt = Math.min(0.05, deltaTime / 1000);
      for (const item of items) {
        const parent = item.el.offsetParent;
        if (!parent) continue;
        const width = parent.clientWidth;
        const left = item.el.offsetLeft;
        let w = item.el.offsetWidth;
        item.x -= item.cfg.speed * dt;
        if (left + item.x + w < -24) {
          // sortie à gauche : nouveau plan (taille, opacité, flou, vitesse), puis retour par la droite
          applyPlane(item, nextPlane(item));
          w = item.el.offsetWidth;
          item.x += width + w + 48;
        }
        // Mouvement vertical : sinusoïde + harmonique, plus ample et plus vive au premier plan
        const t = time * item.cfg.freq + item.phase;
        gsap.set(item.el, { x: item.x, y: (Math.sin(t) + 0.35 * Math.sin(t * 2.3 + 1)) * item.cfg.bob });
      }
    };
    const start = () => { if (!running) { running = true; gsap.ticker.add(tick); } };
    const stop = () => { if (running) { running = false; gsap.ticker.remove(tick); } };
    const drift = window.ScrollTrigger.create({
      trigger: drifters[0].closest('section') || drifters[0],
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? start() : stop()),
      onRefresh: (self) => (self.isActive ? start() : stop()),
    });
    if (drift.isActive) start();
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
