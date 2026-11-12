/**
 * Effets du jeu « Qui est-ce ? » : confettis / étoiles, canons à confettis, stickers de réaction (Smufs).
 * Rien ne bouge en reduced-motion (toutes les fonctions deviennent des no-op).
 * Les couleurs viennent des variables Webflow (palette de la marque), avec un repli en dur.
 */
const STAR = 'polygon(50% 0%,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)';
const PALETTE = [
  ['--_palette---color--accent--lime', '#dbfa0a'],
  ['--_palette---color--brand--pink', '#f65469'],
  ['--_palette---color--brand--blue', '#3953a0'],
  ['--_palette---color--accent--yellow', '#fcc028'],
  ['--_palette---color--accent--cyan', '#75f1f8'],
  ['--_palette---color--brand--electric', '#0048ff'],
];

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

export function createFx({ gsap, env }) {
  let colors = null;
  const palette = () => {
    if (!colors) {
      const cs = getComputedStyle(document.documentElement);
      colors = PALETTE.map(([name, fallback]) => cs.getPropertyValue(name).trim() || fallback);
    }
    return colors;
  };

  /** Couche d'effets sans interaction. fixed : plein viewport (page) ; sinon : plein parent (scène). */
  function layer(parent, { fixed = true } = {}) {
    const el = document.createElement('div');
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('data-smf-fx', '');
    el.style.cssText = `position:${fixed ? 'fixed' : 'absolute'};inset:0;pointer-events:none;overflow:hidden;z-index:${fixed ? 62 : 70}`;
    parent.append(el);
    return el;
  }

  function piece(host) {
    const el = document.createElement('i');
    const roll = Math.random();
    const size = rand(6, 13);
    const colorList = palette();
    const color = colorList[Math.floor(Math.random() * colorList.length)];
    let shape = 'border-radius:2px;';
    let w = size;
    let h = size * rand(0.4, 0.8);
    if (roll < 0.2) {
      shape = 'border-radius:50%;';
      h = w;
    } else if (roll < 0.34) {
      shape = `clip-path:${STAR};`;
      w = size * 1.7;
      h = w;
    }
    el.style.cssText = `position:absolute;left:0;top:0;display:block;width:${w}px;height:${h}px;background:${color};${shape}will-change:transform`;
    host.append(el);
    return el;
  }

  /** Gerbe de pièces autour d'un point (x, y en pixels de la couche). */
  function burst(host, x, y, { count = 14, power = 1 } = {}) {
    if (env.reducedMotion || !host) return;
    for (let i = 0; i < count; i += 1) {
      const el = piece(host);
      const angle = rand(0, Math.PI * 2);
      const dist = rand(40, 110) * power;
      gsap.set(el, { x, y, scale: 0, rotation: rand(0, 360) });
      gsap
        .timeline({ onComplete: () => el.remove() })
        .to(el, { x: x + Math.cos(angle) * dist, y: y + Math.sin(angle) * dist - 36 * power, scale: 1, rotation: `+=${rand(-300, 300)}`, duration: 0.42, ease: 'power3.out' })
        .to(el, { y: `+=${rand(50, 120)}`, x: `+=${rand(-24, 24)}`, rotation: `+=${rand(-200, 200)}`, opacity: 0, duration: rand(0.5, 0.8), ease: 'power1.in' });
    }
  }

  /** Canon à confettis : jet dans une direction (angle en degrés, -90 = vers le haut), puis chute. */
  function cannon(host, x, y, { angle = -90, spread = 38, count = 36, power = 1, delay = 0 } = {}) {
    if (env.reducedMotion || !host) return;
    for (let i = 0; i < count; i += 1) {
      const el = piece(host);
      const a = ((angle + rand(-spread, spread)) * Math.PI) / 180;
      const dist = rand(0.45, 1) * 520 * power;
      const peakX = x + Math.cos(a) * dist;
      const peakY = y + Math.sin(a) * dist;
      gsap.set(el, { x, y, scale: 0, rotation: rand(0, 360) });
      gsap
        .timeline({ delay: delay + rand(0, 0.12), onComplete: () => el.remove() })
        .to(el, { x: peakX, y: peakY, scale: 1, rotation: `+=${rand(-420, 420)}`, duration: rand(0.55, 0.85), ease: 'power2.out' })
        .to(el, { x: `+=${rand(-80, 80)}`, y: `+=${rand(260, 520)}`, rotation: `+=${rand(-540, 540)}`, opacity: 0, duration: rand(1.1, 1.8), ease: 'power1.in' });
    }
  }

  /** Petit « pop » élastique (pastille, compteur…). Le transform est rendu au CSS à la fin. */
  function pop(el, from = 1.8) {
    if (!el || env.reducedMotion) return;
    gsap.killTweensOf(el);
    gsap.fromTo(el, { scale: from }, { scale: 1, duration: 0.55, ease: 'back.out(3)', clearProps: 'transform' });
  }

  /**
   * Stickers de réaction : un Smuf (data-smf-react = happy | sad | cry | help) apparaît au coin d'une carte,
   * se dandine puis s'envole. Le conteneur est déplacé dans <body> (position fixe, hors transform d'ancêtre).
   */
  function reactions(box) {
    if (!box) return { show() {}, hideAll() {} };
    document.body.append(box);
    Object.assign(box.style, { position: 'fixed', left: '0', top: '0', width: '0', height: '0', zIndex: '60', pointerEvents: 'none' });
    const items = new Map([...box.querySelectorAll('[data-smf-react]')].map((el) => [el.getAttribute('data-smf-react'), el]));
    items.forEach((el) => gsap.set(el, { opacity: 0, scale: 0 }));

    /** minTop : en dessous de cette ordonnée le sticker passe au coin bas de la carte (évite la bulle de retour sous la carte indice). */
    function show(kind, rect, { hold = 1.1, minTop = 0 } = {}) {
      const el = items.get(kind);
      if (!el || env.reducedMotion || !rect) return;
      const size = el.offsetWidth || 88;
      const x = clamp(rect.right - size * 0.4, 8, window.innerWidth - size - 8);
      let top = rect.top - size * 0.6;
      if (top < minTop) top = rect.bottom - size * 0.45;
      const y = clamp(top, 8, window.innerHeight - size - 8);
      const tilt = kind === 'sad' || kind === 'cry' ? -9 : 8;
      gsap.killTweensOf(el);
      gsap.set(el, { x, y, rotation: tilt, scale: 0, opacity: 1, transformOrigin: '50% 100%' });
      gsap
        .timeline()
        .to(el, { scale: 1, duration: 0.5, ease: 'back.out(2.6)' })
        .to(el, { rotation: tilt * -1, duration: 0.14, repeat: 3, yoyo: true, ease: 'sine.inOut' }, '<0.25')
        .to(el, { y: y - 18, opacity: 0, scale: 0.8, duration: 0.32, ease: 'power2.in' }, `+=${hold}`);
    }

    function hideAll() {
      items.forEach((el) => {
        gsap.killTweensOf(el);
        gsap.set(el, { opacity: 0, scale: 0 });
      });
    }

    return { show, hideAll };
  }

  return { layer, burst, cannon, pop, reactions };
}
