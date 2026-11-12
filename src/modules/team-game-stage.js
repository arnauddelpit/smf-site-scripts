/**
 * Scène finale du « Qui est-ce ? » : un <dialog> natif Webflow (élément Modal) en plein écran.
 *  - « éventail » : les cartes gagnantes (copies des cartes du plateau) s'envolent de leur place dans la grille vers le premier plan,
 *    groupées comme une main de cartes ; survol / focus = la carte se dégage ;
 *  - « fiche » : un clic (ou Entrée) sur une carte l'agrandit, la fiche (rôle, prénom + nom, anecdote, LinkedIn) s'affiche à côté, les autres
 *    cartes passent en vignettes ; flèches ← / → (ou boutons, ou balayage) pour passer d'une carte à l'autre ;
 *  - Échap : revient à l'éventail, puis ferme ; le plateau (cartes gagnantes à leur place) reste visible dessous.
 * Les repères sont des attributs data-smf-stage-* / data-smf-sheet-* posés dans le composant Webflow « Équipe « Qui est-ce ? » ».
 * Les états visuels (.is-open, .is-on, .is-detail, .is-active, .has-hand) sont stylés dans team-game-css.js.
 */
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
const SPRING = 'back.out(1.15)';

export function createStage({ stage, gsap, env, fx, members, onReplay, onClosed, keyboard = () => false }) {
  const q = (selector) => stage.querySelector(selector);
  const deck = q('[data-smf-stage-deck]');
  if (!deck || typeof stage.showModal !== 'function') return null;

  const sheet = q('[data-smf-stage-sheet]');
  const titleEl = q('[data-smf-stage-title]');
  const subEl = q('[data-smf-stage-sub]');
  const scoreEl = q('[data-smf-stage-score]');
  const smufEl = q('[data-smf-stage-smuf]');
  const sRole = q('[data-smf-sheet-role]');
  const sName = q('[data-smf-sheet-name]');
  const sBio = q('[data-smf-sheet-bio]');
  const sLink = q('[data-smf-sheet-link]');
  const sCount = q('[data-smf-sheet-count]');
  const sPrev = q('[data-smf-sheet-prev]');
  const sNext = q('[data-smf-sheet-next]');
  const replay = q('[data-smf-stage-replay] a') || q('[data-smf-stage-replay]');
  const closers = [...stage.querySelectorAll('[data-smf-stage-close]')];

  let isOpen = false;
  let mode = 'fan'; // fan | detail
  let current = 0;
  let items = []; // { slug, el (carte du plateau), m (membre), wrap (copie dans la scène) }
  let geo = null;
  let busy = false;
  let fxLayer = null;
  let cursorHome = null;
  let resizeTimer = 0;
  let sheetTl = null;
  let mainTl = null;

  const reduced = () => env.reducedMotion;

  /* ───────────── construction ───────────── */

  function clear() {
    for (const it of items) {
      gsap.killTweensOf(it.wrap);
      it.wrap.remove();
    }
    items = [];
    fxLayer?.remove();
    fxLayer = null;
  }

  function build(winners) {
    clear();
    items = winners.map(({ slug, el }, i) => {
      const m = members.get(slug);
      const wrap = document.createElement('div');
      wrap.className = 'team_deck-card';
      wrap.setAttribute('data-smf-deck-card', slug);
      wrap.setAttribute('role', 'button');
      wrap.tabIndex = 0;
      wrap.setAttribute('aria-label', `${m.full}, ${m.role}. Ouvrir la fiche.`);
      const copy = el.cloneNode(true);
      for (const attr of ['data-smf-card', 'role', 'tabindex', 'aria-label', 'style']) copy.removeAttribute(attr);
      copy.classList.remove('is-flipped', 'is-winner', 'is-wrong', 'is-hint');
      copy.querySelectorAll('img').forEach((img) => {
        img.loading = 'eager';
        img.decoding = 'async';
      });
      wrap.append(copy);
      deck.append(wrap);
      wire(wrap, copy, i);
      return { slug, el, m, wrap, copy };
    });
  }

  /* ───────────── géométrie ───────────── */

  function measure() {
    const r = deck.getBoundingClientRect();
    return { w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  /** Remplit la fiche pour le membre i (texte seulement). */
  function fill(i) {
    const it = items[i];
    if (!it || !sheet) return;
    const { m } = it;
    if (sRole) sRole.textContent = m.role;
    if (sName) sName.textContent = m.full;
    if (sBio) sBio.textContent = m.bio || 'Pas encore d’anecdote. On y travaille (en buvant des cafés).';
    if (sLink) {
      sLink.classList.toggle('is-on', Boolean(m.linkedin));
      if (m.linkedin) sLink.setAttribute('href', m.linkedin);
    }
    if (sCount) sCount.textContent = `${i + 1} / ${items.length}`;
  }

  /** Hauteur maximale de la fiche parmi les membres (pour réserver la place sur petit écran). */
  function maxSheetHeight(width) {
    if (!sheet) return 0;
    const keep = current;
    Object.assign(sheet.style, { width: `${width}px`, visibility: 'hidden', display: 'flex', left: '0px', top: '0px' });
    let max = 0;
    for (let i = 0; i < items.length; i += 1) {
      fill(i);
      max = Math.max(max, sheet.offsetHeight);
    }
    Object.assign(sheet.style, { visibility: '', display: '' });
    fill(keep);
    return max;
  }

  function layout() {
    const m = measure();
    const n = items.length;
    const wide = m.w >= 900;
    const sheetW = wide ? clamp(m.w * 0.34, 340, 440) : Math.min(m.w - 8, 520);
    const sheetH = maxSheetHeight(sheetW);
    const thumbW = clamp(Math.min(wide ? m.h * 0.12 : 64, (m.w - 16 - (n - 1) * 10) / Math.max(n, 1)), 44, 84);
    const thumbH = thumbW * 1.2;
    const gap = 18;
    const bigW = wide
      ? clamp(Math.min((m.h - thumbH - gap - 16) / 1.2, m.w * 0.3), 150, 380)
      : clamp(Math.min((m.h - sheetH - thumbH - gap * 2 - 8) / 1.2, m.w * 0.6), 96, 260);
    const fanW = clamp(Math.min((m.h * 0.7) / 1.2, m.w * (wide ? 0.26 : 0.5)), 110, 300);
    const cw = Math.max(bigW, fanW);
    geo = { m, wide, n, cw, bigW, fanW, thumbW, thumbH, sheetW, sheetH, gap };
    deck.style.setProperty('--cw', `${cw}px`);
    return geo;
  }

  function fanTargets() {
    const { n, cw, fanW, m } = geo;
    const ch = fanW * 1.2;
    const R = ch * 1.5;
    const chordRoom = n > 1 ? (m.w - 24 - fanW) / (n - 1) : 0;
    const step = n > 1 ? Math.min(15, (chordRoom / R) * (180 / Math.PI)) : 0;
    const maxAngle = ((n - 1) / 2) * step;
    const yBase = -0.5 * R * (1 - Math.cos((maxAngle * Math.PI) / 180));
    return items.map((_, i) => {
      const a = (i - (n - 1) / 2) * step;
      const rad = (a * Math.PI) / 180;
      return { x: R * Math.sin(rad), y: R * (1 - Math.cos(rad)) + yBase, rotation: a, scale: fanW / cw, opacity: 1, z: i + 1 };
    });
  }

  function detailTargets(active) {
    const { n, cw, bigW, thumbW, thumbH, sheetW, sheetH, gap, m, wide } = geo;
    const bigH = bigW * 1.2;
    let cardX;
    let cardY; // centre de la grande carte, relatif au centre du paquet
    let thumbY;
    let sheetLeft;
    let sheetTop;
    if (wide) {
      const groupW = bigW + 56 + sheetW;
      const blockH = bigH + gap + thumbH;
      cardX = -groupW / 2 + bigW / 2;
      cardY = -blockH / 2 + bigH / 2;
      thumbY = cardY + bigH / 2 + gap + thumbH / 2;
      sheetLeft = m.w / 2 - groupW / 2 + bigW + 56;
      sheetTop = m.h / 2 + cardY - sheetH / 2;
    } else {
      const sheetFromTop = m.h - sheetH;
      const thumbFromTop = sheetFromTop - gap - thumbH / 2;
      const cardRegion = thumbFromTop - thumbH / 2 - gap;
      cardX = 0;
      cardY = cardRegion / 2 - m.h / 2;
      thumbY = thumbFromTop - m.h / 2;
      sheetLeft = (m.w - sheetW) / 2;
      sheetTop = sheetFromTop;
    }
    const others = items.map((_, i) => i).filter((i) => i !== active);
    const rowW = others.length * thumbW + (others.length - 1) * 10;
    const targets = items.map((_, i) => {
      if (i === active) return { x: cardX, y: cardY, rotation: 0, scale: bigW / cw, opacity: 1, z: 50 };
      const slot = others.indexOf(i);
      return { x: -rowW / 2 + thumbW / 2 + slot * (thumbW + 10), y: thumbY, rotation: 0, scale: thumbW / cw, opacity: 0.9, z: 10 + slot };
    });
    return { targets, sheetLeft, sheetTop, n };
  }

  /**
   * La hauteur du paquet change quand l'en-tête se réduit (mode fiche) ou revient (éventail) : on recalcule la géométrie et on
   * décale les cartes de la même quantité pour qu'elles ne sautent pas à l'écran (les animations qui suivent repartent d'où elles sont).
   */
  function relayout() {
    const prev = geo.m;
    layout();
    const dx = prev.cx - geo.m.cx;
    const dy = prev.cy - geo.m.cy;
    if (dx || dy) items.forEach(({ wrap }) => gsap.set(wrap, { x: `+=${dx}`, y: `+=${dy}` }));
  }

  function placeSheet(sheetLeft, sheetTop) {
    if (!sheet) return;
    Object.assign(sheet.style, { width: `${geo.sheetW}px`, left: `${sheetLeft}px`, top: `${sheetTop}px` });
  }

  /* ───────────── interactions sur les cartes ───────────── */

  let fanBase = [];
  let hoverIdx = -1;

  /**
   * Survol / focus. La carte « levée » est la copie interne : le conteneur (zone de clic) ne bouge pas, ce qui évite le
   * scintillement quand les cartes se chevauchent. Dans l'éventail la carte se dégage et se redresse ; en mode fiche, les
   * vignettes grossissent légèrement.
   */
  function lift(i, on) {
    const it = items[i];
    if (!it || busy) return;
    hoverIdx = on ? i : hoverIdx === i ? -1 : hoverIdx;
    const { wrap, copy } = it;
    if (mode === 'fan') {
      const t = fanBase[i];
      if (!t) return;
      wrap.style.zIndex = on ? 100 : t.z;
      wrap.style.setProperty('--glare', on ? '1' : '0');
      gsap.to(copy, on
        ? { y: -geo.cw * 0.17, scale: 1.09, rotation: -t.rotation * 0.5, duration: 0.35, ease: 'back.out(2.2)', overwrite: 'auto' }
        : { y: 0, scale: 1, rotation: 0, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    } else if (i !== current) {
      // (les unités sont celles de la carte avant réduction : la vignette est environ 4 fois plus petite)
      gsap.to(copy, on ? { y: -geo.cw * 0.06, scale: 1.12, duration: 0.25, ease: 'power2.out', overwrite: 'auto' } : { y: 0, scale: 1, duration: 0.35, ease: 'power3.out', overwrite: 'auto' });
    }
  }

  function wire(wrap, copy, i) {
    gsap.set(copy, { transformPerspective: 900 });
    const rx = gsap.quickTo(copy, 'rotationX', { duration: 0.45, ease: 'power3.out' });
    const ry = gsap.quickTo(copy, 'rotationY', { duration: 0.45, ease: 'power3.out' });

    wrap.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') lift(i, true);
    });
    wrap.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || busy) return;
      if (hoverIdx !== i) lift(i, true);
      const r = wrap.getBoundingClientRect();
      const px = clamp((event.clientX - r.left) / r.width, 0, 1);
      const py = clamp((event.clientY - r.top) / r.height, 0, 1);
      wrap.style.setProperty('--gx', `${px * 100}%`);
      wrap.style.setProperty('--gy', `${py * 100}%`);
      wrap.style.setProperty('--glare', '1');
      if (!reduced()) {
        ry((px - 0.5) * 16);
        rx(-(py - 0.5) * 16);
      }
    });
    wrap.addEventListener('pointerleave', (event) => {
      if (event.pointerType !== 'mouse') return;
      rx(0);
      ry(0);
      wrap.style.setProperty('--glare', '0');
      lift(i, false);
    });
    // le focus ne « lève » la carte qu'au clavier : un focus donné par le script après un clic ne doit pas ressembler à un survol
    wrap.addEventListener('focus', () => {
      if (keyboard()) lift(i, true);
    });
    wrap.addEventListener('blur', () => lift(i, false));
    wrap.addEventListener('click', () => {
      if (busy && mode === 'fan') return;
      if (mode === 'fan') openDetail(i);
      else if (i === current) backToFan();
      else go(i);
    });
    wrap.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        wrap.click();
      }
    });
  }

  /* ───────────── éventail ↔ fiche ───────────── */

  /** Variables GSAP d'une cible (le z-index n'est pas animé : appliqué tout de suite). */
  const tween = ({ z, ...rest }) => rest;

  function apply(targets, { duration = 0.7, ease = 'power3.inOut', stagger = 0 } = {}) {
    items.forEach(({ wrap, copy }, i) => {
      wrap.style.zIndex = targets[i].z;
      gsap.to(copy, { y: 0, scale: 1, rotation: 0, duration: duration <= 0 || reduced() ? 0 : 0.3, overwrite: 'auto' });
      if (duration <= 0 || reduced()) gsap.set(wrap, tween(targets[i]));
      else gsap.to(wrap, { ...tween(targets[i]), duration, ease, delay: i * stagger, overwrite: 'auto' });
    });
    hoverIdx = -1;
  }

  function showFan({ animate = true } = {}) {
    const wasDetail = mode === 'detail';
    mode = 'fan';
    stage.classList.remove('is-detail');
    if (wasDetail) relayout();
    items.forEach(({ wrap }) => wrap.classList.remove('is-active'));
    fanBase = fanTargets();
    sheetTl?.kill();
    if (sheet && sheet.classList.contains('is-open')) {
      if (animate && !reduced()) gsap.to(sheet, { opacity: 0, y: 16, duration: 0.25, ease: 'power2.in', onComplete: () => sheet.classList.remove('is-open') });
      else sheet.classList.remove('is-open');
    }
    apply(fanBase, { duration: animate ? 0.8 : 0, ease: SPRING, stagger: 0.03 });
  }

  function backToFan() {
    if (mode !== 'detail') return;
    showFan();
    items[current]?.wrap.focus({ preventScroll: true });
  }

  function openDetail(i, { animate = true } = {}) {
    if (!items[i]) return;
    const first = mode !== 'detail';
    mode = 'detail';
    current = i;
    stage.classList.add('is-detail');
    if (first) relayout();
    items.forEach(({ wrap }, j) => wrap.classList.toggle('is-active', j === i));
    const { targets, sheetLeft, sheetTop } = detailTargets(i);
    apply(targets, { duration: animate ? 0.75 : 0, ease: 'power3.inOut' });
    items.forEach(({ wrap }) => {
      wrap.style.setProperty('--glare', '0');
    });
    if (sheet) {
      sheetTl?.kill();
      if (first) {
        fill(i);
        placeSheet(sheetLeft, sheetTop);
        sheet.classList.add('is-open');
        if (animate && !reduced()) {
          sheetTl = gsap.fromTo(sheet, { opacity: 0, x: geo.wide ? 56 : 0, y: geo.wide ? 0 : 40 }, { opacity: 1, x: 0, y: 0, duration: 0.6, delay: 0.15, ease: 'power3.out' });
        } else gsap.set(sheet, { opacity: 1, x: 0, y: 0 });
      } else if (animate && !reduced()) {
        sheetTl = gsap
          .timeline()
          .to(sheet, { opacity: 0, y: 10, duration: 0.12, ease: 'power1.in' })
          .add(() => fill(i))
          .to(sheet, { opacity: 1, y: 0, duration: 0.32, ease: 'power3.out' });
      } else fill(i);
    }
    items[i].wrap.focus({ preventScroll: true });
  }

  function go(to) {
    if (!items.length) return;
    const n = items.length;
    openDetail(((to % n) + n) % n);
  }

  /* ───────────── curseur main (zone du jeu) ───────────── */

  function adoptCursor() {
    if (env.touch || env.reducedMotion || cursorHome) return;
    const cursor = document.querySelector('[data-smf-cursor]');
    if (!cursor || getComputedStyle(cursor).display === 'none') return;
    cursorHome = { cursor, parent: cursor.parentNode, next: cursor.nextSibling };
    stage.append(cursor);
    stage.classList.add('has-hand');
  }

  function releaseCursor() {
    if (!cursorHome) return;
    const { cursor, parent, next } = cursorHome;
    parent.insertBefore(cursor, next && next.parentNode === parent ? next : null);
    stage.classList.remove('has-hand');
    cursorHome = null;
  }

  /* ───────────── ouverture / fermeture ───────────── */

  function setHeads({ title, sub, score }) {
    if (titleEl && title) titleEl.textContent = title;
    if (subEl && sub) subEl.textContent = sub;
    if (scoreEl) {
      scoreEl.textContent = score || '';
      scoreEl.style.display = score ? '' : 'none';
    }
  }

  /**
   * winners : [{ slug, el }] (cartes gagnantes du plateau) ; summary : { title, sub, score } ; detail : slug à ouvrir directement.
   */
  function open({ winners, summary = {}, detail = null }) {
    if (isOpen || !winners.length) return;
    if (!items.length || items.length !== winners.length || items.some((it, i) => it.slug !== winners[i].slug)) build(winners);
    setHeads(summary);
    stage.showModal();
    isOpen = true;
    adoptCursor();
    stage.classList.remove('is-detail');
    mode = 'fan';
    current = 0;
    sheet?.classList.remove('is-open');
    layout();
    fanBase = fanTargets();
    const from = items.map((it) => it.el.getBoundingClientRect());
    const { m, cw } = geo;
    mainTl?.kill();
    fxLayer ||= fx.layer(stage, { fixed: false });

    items.forEach(({ wrap, copy, el }, i) => {
      wrap.classList.remove('is-active');
      const r = from[i];
      wrap.style.zIndex = i + 1;
      gsap.set(copy, { y: 0, scale: 1, rotation: 0, rotationX: 0, rotationY: 0 });
      gsap.set(wrap, { x: r.left + r.width / 2 - m.cx, y: r.top + r.height / 2 - m.cy, scale: r.width / cw, rotation: 0, opacity: 1, '--edge': reduced() ? 1 : 0, '--glare': 0 });
      el.style.visibility = 'hidden';
    });

    const heads = [smufEl, titleEl, subEl, scoreEl].filter((el) => el && el.style.display !== 'none');
    if (reduced()) {
      gsap.set(stage, { '--stage-fade': 1 });
      gsap.set(heads, { opacity: 1, y: 0, scale: 1, rotation: 0 });
      apply(fanBase, { duration: 0 });
      busy = false;
      if (detail) openDetail(Math.max(0, items.findIndex((it) => it.slug === detail)), { animate: false });
      else items[0].wrap.focus({ preventScroll: true });
      return;
    }

    busy = true;
    gsap.set(stage, { '--stage-fade': 0 });
    mainTl = gsap.timeline({
      onComplete: () => {
        busy = false;
        if (detail) openDetail(Math.max(0, items.findIndex((it) => it.slug === detail)));
        else items[0]?.wrap.focus({ preventScroll: true });
      },
    });
    mainTl.to(stage, { '--stage-fade': 1, duration: 0.6, ease: 'power2.out' }, 0);
    items.forEach(({ wrap }, i) => {
      mainTl.to(wrap, { ...tween(fanBase[i]), '--edge': 1, duration: 1, ease: SPRING }, 0.1 + i * 0.08);
    });
    gsap.set(heads, { opacity: 0 });
    mainTl.fromTo(heads, { y: 28, opacity: 0, scale: 0.9 }, { y: 0, opacity: 1, scale: 1, duration: 0.65, ease: 'back.out(1.7)', stagger: 0.09 }, 0.5);
    if (smufEl) mainTl.fromTo(smufEl, { rotation: -16 }, { rotation: 0, duration: 0.8, ease: 'elastic.out(1,0.45)' }, 0.5);
    mainTl.add(() => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      fx.cannon(fxLayer, w * 0.05, h * 0.96, { angle: -58, spread: 22, count: 56, power: 1.3 });
      fx.cannon(fxLayer, w * 0.95, h * 0.96, { angle: -122, spread: 22, count: 56, power: 1.3, delay: 0.1 });
      fx.burst(fxLayer, w / 2, h * 0.2, { count: 36, power: 1.8 });
    }, 0.55);
  }

  function restoreBoard() {
    for (const it of items) it.el.style.visibility = '';
    releaseCursor();
  }

  function finishClose() {
    gsap.killTweensOf(stage);
    if (stage.open) stage.close();
    isOpen = false;
    busy = false;
    mode = 'fan';
    stage.classList.remove('is-detail');
    sheet?.classList.remove('is-open');
    restoreBoard();
    onClosed?.();
  }

  function close({ immediate = false } = {}) {
    if (!isOpen) return;
    mainTl?.kill();
    sheetTl?.kill();
    if (immediate || reduced()) {
      items.forEach(({ wrap }) => gsap.killTweensOf(wrap));
      finishClose();
      return;
    }
    busy = true;
    const wasDetail = mode === 'detail';
    mode = 'fan';
    stage.classList.remove('is-detail');
    const tl = gsap.timeline({ onComplete: finishClose });
    if (sheet && wasDetail) tl.to(sheet, { opacity: 0, y: 14, duration: 0.2, ease: 'power2.in' }, 0);
    tl.to([smufEl, titleEl, subEl, scoreEl].filter(Boolean), { opacity: 0, y: -12, duration: 0.25, ease: 'power2.in' }, 0);
    items.forEach(({ wrap, el }, i) => {
      const r = el.getBoundingClientRect();
      tl.to(wrap, { x: r.left + r.width / 2 - geo.m.cx, y: r.top + r.height / 2 - geo.m.cy, scale: r.width / geo.cw, rotation: 0, opacity: 1, '--edge': 0, duration: 0.65, ease: 'power3.inOut' }, 0.05 + i * 0.05);
    });
    tl.to(stage, { '--stage-fade': 0, duration: 0.5, ease: 'power2.in' }, 0.3);
  }

  /** Remise à zéro (rejouer) : fermeture immédiate, copies supprimées. */
  function reset() {
    mainTl?.kill();
    sheetTl?.kill();
    if (isOpen) finishClose();
    clear();
  }

  /* ───────────── événements de la scène ───────────── */

  stage.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (mode === 'detail') backToFan();
    else close();
  });
  // (l'événement « close » arrive après coup : s'il date d'une fermeture précédente et que la scène a été rouverte entre-temps, on l'ignore)
  stage.addEventListener('close', () => {
    if (isOpen && !stage.open) finishClose();
  });
  stage.addEventListener('keydown', (event) => {
    if (!isOpen || busy) return;
    if (mode === 'detail' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      event.preventDefault();
      go(current + (event.key === 'ArrowRight' ? 1 : -1));
    } else if (mode === 'fan' && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
      const index = items.findIndex((it) => it.wrap === document.activeElement);
      const next = clamp((index < 0 ? 0 : index) + (event.key === 'ArrowRight' ? 1 : -1), 0, items.length - 1);
      event.preventDefault();
      items[next]?.wrap.focus({ preventScroll: true });
    }
  });
  for (const el of closers) {
    el.setAttribute('role', 'button');
    el.addEventListener('click', (event) => {
      event.preventDefault();
      close();
    });
  }
  for (const [el, step] of [[sPrev, -1], [sNext, 1]]) {
    if (!el) continue;
    el.setAttribute('role', 'button');
    el.addEventListener('click', (event) => {
      event.preventDefault();
      go(current + step);
    });
    el.addEventListener('keydown', (event) => {
      if (event.key === ' ') {
        event.preventDefault();
        el.click();
      }
    });
  }
  if (replay) {
    replay.setAttribute('role', 'button');
    replay.addEventListener('click', (event) => {
      event.preventDefault();
      onReplay?.();
    });
  }
  // clic dans le vide : retour à l'éventail ; balayage horizontal (tactile) : carte précédente / suivante
  deck.addEventListener('click', (event) => {
    if (mode === 'detail' && event.target === deck) backToFan();
  });
  let swipeX = null;
  deck.addEventListener('pointerdown', (event) => {
    swipeX = event.pointerType === 'touch' ? event.clientX : null;
  });
  deck.addEventListener('pointerup', (event) => {
    if (swipeX === null || mode !== 'detail') return;
    const dx = event.clientX - swipeX;
    swipeX = null;
    if (Math.abs(dx) > 50) go(current + (dx < 0 ? 1 : -1));
  });
  window.addEventListener('resize', () => {
    if (!isOpen) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!isOpen) return;
      layout();
      fanBase = fanTargets();
      if (mode === 'detail') {
        const { targets, sheetLeft, sheetTop } = detailTargets(current);
        apply(targets, { duration: 0 });
        placeSheet(sheetLeft, sheetTop);
      } else apply(fanBase, { duration: 0 });
    }, 120);
  });

  return {
    open,
    close,
    reset,
    isOpen: () => isOpen,
    mode: () => mode,
    current: () => current,
    items: () => items,
    openDetail,
  };
}
