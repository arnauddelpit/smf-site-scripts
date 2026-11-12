/**
 * Mini-jeu « Qui est-ce ? » (data-smf-team="game") — docs/interactions.md.
 *
 * Règle : l'indice décrit la team ; on retourne les cartes de celles et ceux qui NE correspondent PAS. Chaque page a 3 indices
 * (src/data/team-game.json, export du CMS « Indices du jeu »), disjoints : ce qui reste à la fin est l'équipe de la page.
 *
 * Structure Webflow (composant « Équipe « Qui est-ce ? » », variante Jeu) — repères data-smf-* :
 *   team-bar > team-clue : carte indice COLLANTE (toujours visible) = pastilles d'étapes, compteur, indice courant (team-hint),
 *   règle, « coup de pouce » (team-help), « Passer » (team-skip) ; team-feedback = bulle de retour (jamais à la place de l'indice) ;
 *   team-react = stickers (Smufs) de réaction ; team-stage = scène finale (dialog natif Webflow, voir team-game-stage.js).
 *
 * Erreur du joueur : la carte tremble + « × » rose, la carte indice vibre et se surligne, une bulle rose explique (« X coche l'indice »),
 * un Smuf réagit ; dès la 2e faute sur un indice le « coup de pouce » apparaît, à la 3e une carte à retourner se met à briller.
 * Bonne réponse : retournement élastique, confettis, bulle verte, séries (3, 4, 5…), pastille de progression ; indice complet → l'indice suivant
 * se retourne (rotation X) et son texte est surligné au marqueur.
 *
 * Accessibilité : cartes = boutons (tabindex itinérant, flèches), bulle et indice en aria-live, reduced-motion = aucun mouvement.
 * Mobile (≤ 767 px) : la carte indice se compacte quand elle est collée. Débogage : ?smf-debug expose window.__smfGame.
 */
import data from '../data/team-game.json';
import { cluesFor } from './team-game-clues.js';
import { GAME_CSS } from './team-game-css.js';
import { createFx } from './team-game-fx.js';
import { createStage } from './team-game-stage.js';

const GENERIC_LINKEDIN = /^https?:\/\/(www\.)?linkedin\.com\/?$/i;
const SR_ONLY = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0';
const IDLE_MS = 14000;

function pageKey() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'besoins' || parts[0] === 'secteurs') return `${parts[0]}/${parts[1]}`;
  return parts[parts.length - 1] || 'home';
}

/** Tirage sans répétition immédiate. */
function shuffler(list) {
  let last = -1;
  return () => {
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === last) i = (i + 1) % list.length;
    last = i;
    return list[i];
  };
}

const okLine = shuffler(['Bien vu !', 'Dans le mille.', 'Œil de lynx.', 'Ça, c’est fait.', 'On ne vous la fait pas.', 'Là, c’est du propre.']);
const koLine = shuffler([
  (n) => `Raté : ${n} coche l’indice, on le garde.`,
  (n) => `Aïe. ${n} correspond bien à l’indice.`,
  (n) => `Pas ${n} ! Relisez l’indice.`,
  (n) => `${n} reste en jeu : l’indice lui va comme un gant.`,
]);
const clueDoneLine = shuffler(['Indice validé !', 'Un de moins, plus que deux.', 'Et hop, indice suivant.']);

const listNames = (names) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} et ${names[names.length - 1]}` : names[0] || '');

function readMember(card) {
  const text = (key) => card.querySelector(`[data-smf-member-${key}]`)?.textContent.trim() || '';
  const slug = card.getAttribute('data-smf-card');
  const label = text('name');
  const surname = text('surname');
  // Selon l'instance, le prénom contient déjà l'initiale (« Antoine P. ») : on la retire pour ne pas la répéter.
  const first = surname && label.endsWith(` ${surname}`) ? label.slice(0, -surname.length - 1).trim() : label;
  const href = card.querySelector('[data-smf-member-linkedin]')?.getAttribute('href') || '';
  return {
    slug,
    label,
    first,
    surname,
    full: surname ? `${first} ${surname}` : first,
    role: text('role'),
    bio: text('bio'),
    linkedin: href && !GENERIC_LINKEDIN.test(href) ? href : '',
  };
}

function injectCss() {
  if (document.head.querySelector('style[data-smf-game]')) return;
  const style = document.createElement('style');
  style.setAttribute('data-smf-game', '');
  style.textContent = GAME_CSS;
  document.head.append(style);
}

export function initGame(root, { gsap, env }) {
  const q = (selector) => root.querySelector(selector);
  const bar = q('[data-smf-team-bar]');
  const clueBox = q('[data-smf-team-clue]');
  const hint = q('[data-smf-team-hint]');
  const stepsEl = q('[data-smf-team-steps]');
  const stepLabel = q('[data-smf-team-step-label]');
  const countEl = q('[data-smf-team-count]');
  const dotsEl = q('[data-smf-team-dots]');
  const feedback = q('[data-smf-team-feedback]');
  const helpBtn = q('[data-smf-team-help]');
  const skip = q('[data-smf-team-skip]')?.querySelector('a, button');
  const ruleEl = q('[data-smf-team-rule]');
  const ruleText = ruleEl?.textContent.trim() || '';
  const stageEl = q('[data-smf-team-stage]');
  const cards = [...root.querySelectorAll('[data-smf-card]')];
  if (!cards.length || !hint) return;

  const slugOf = (card) => card.getAttribute('data-smf-card');
  // Indices rédigés pour la page, sinon indices génériques construits sur l'équipe dédiée du CMS, sinon repli (voir team-game-clues.js)
  const { clues, source } = cluesFor(data, pageKey(), cards.map(slugOf));
  if (!clues?.length) return;
  injectCss();

  const bySlug = new Map(cards.map((card) => [slugOf(card), card]));
  const members = new Map(cards.map((card) => [slugOf(card), readMember(card)]));
  const nameOf = (card) => members.get(slugOf(card))?.label || slugOf(card);
  const flipped = (card) => card.classList.contains('is-flipped');
  const live = () => cards.filter((card) => !flipped(card));
  const skipLabel = skip?.textContent.trim() || 'Passer';
  const helpLabel = helpBtn?.textContent.trim() || 'Un coup de pouce ?';
  const wait = (ms) => (env.reducedMotion ? 0 : ms);

  const fx = createFx({ gsap, env });
  const pageFx = fx.layer(document.body);
  const reactions = fx.reactions(q('[data-smf-team-react]'));
  const vibrate = (pattern) => {
    if (!env.reducedMotion && navigator.vibrate) navigator.vibrate(pattern);
  };

  /* ───────────── état et minuteries (sans course : tout est annulé à chaque reset / saut) ───────────── */

  const state = { step: 0, phase: 'play', errors: 0, helps: 0, streak: 0, stepErrors: 0, skipped: false };
  let epoch = 0;
  let nudges = 0;
  let lastActivity = performance.now();
  let inView = true;
  let helpMode = 'tip'; // tip | review
  let markEl = null;
  let clueTl = null;
  let toastTl = null;
  const timers = new Set();

  function later(fn, ms) {
    const mine = epoch;
    const id = setTimeout(() => {
      timers.delete(id);
      if (mine === epoch) fn();
    }, ms);
    timers.add(id);
    return id;
  }

  function abortPending() {
    epoch += 1;
    timers.forEach(clearTimeout);
    timers.clear();
    clueTl?.kill();
    toastTl?.kill();
    gsap.killTweensOf([hint, feedback, clueBox, markEl, ...cards].filter(Boolean));
    gsap.set(hint, { clearProps: 'transform,opacity' });
    if (feedback) gsap.set(feedback, { opacity: 0 });
    reactions.hideAll();
  }

  /* ───────────── carte indice : pastilles, compteur, texte ───────────── */

  function takeTemplate(kind) {
    const tpl = q(`[data-smf-template="${kind}"]`);
    if (!tpl) return null;
    const proto = tpl.cloneNode(true);
    proto.removeAttribute('data-smf-template');
    proto.setAttribute(`data-smf-${kind}`, '');
    tpl.remove();
    return proto;
  }
  const pipProto = takeTemplate('pip');
  const dotProto = takeTemplate('dot');
  let pips = [];
  let dots = [];

  function buildPips() {
    if (!stepsEl || !pipProto) return;
    stepsEl.replaceChildren();
    pips = clues.map(() => stepsEl.appendChild(pipProto.cloneNode(true)));
  }

  function buildDots() {
    if (!dotsEl || !dotProto) return;
    dotsEl.replaceChildren();
    dots = clues[Math.min(state.step, clues.length - 1)].out.map(() => dotsEl.appendChild(dotProto.cloneNode(true)));
  }

  function renderMeta({ pop = false } = {}) {
    const done = state.phase === 'done';
    const out = clues[Math.min(state.step, clues.length - 1)].out;
    const left = out.filter((slug) => !flipped(bySlug.get(slug))).length;
    pips.forEach((pip, i) => {
      const wasDone = pip.classList.contains('is-done');
      const nowDone = done || i < state.step || (state.phase === 'locked' && i === state.step);
      pip.classList.toggle('is-done', nowDone);
      pip.classList.toggle('is-current', !done && state.phase !== 'locked' && i === state.step);
      if (pop && nowDone && !wasDone) fx.pop(pip, 2.2);
    });
    dots.forEach((dot, i) => {
      const wasDone = dot.classList.contains('is-done');
      const nowDone = done || i < out.length - left;
      dot.classList.toggle('is-done', nowDone);
      if (pop && nowDone && !wasDone) fx.pop(dot, 2);
    });
    if (stepLabel) stepLabel.textContent = done ? 'Terminé' : `Indice ${state.step + 1}/${clues.length}`;
    if (countEl) countEl.textContent = done ? 'Équipe trouvée' : left ? `Encore ${left} à retourner` : 'Indice validé';
    clueBox?.classList.toggle('is-done', done);
  }

  function writeClue() {
    const sr = document.createElement('span');
    sr.style.cssText = SR_ONLY;
    sr.textContent = `Indice ${state.step + 1} sur ${clues.length} : `;
    markEl = document.createElement('span');
    markEl.setAttribute('data-smf-mark', '');
    markEl.textContent = clues[state.step].text;
    hint.replaceChildren(sr, markEl);
  }

  /** Le surlignage se redessine (nouvel indice, rappel après une faute). */
  function sweepMark(delay = 0.15) {
    if (!markEl || env.reducedMotion) return;
    gsap.killTweensOf(markEl);
    gsap.fromTo(markEl, { '--mark': '0%' }, { '--mark': '100%', duration: 0.7, ease: 'power2.out', delay });
  }

  function swapClue() {
    clueTl?.kill();
    if (env.reducedMotion) {
      writeClue();
      buildDots();
      renderMeta();
      return;
    }
    const mine = epoch;
    gsap.set(hint, { transformPerspective: 700 });
    clueTl = gsap
      .timeline()
      .to(hint, { rotationX: -90, opacity: 0, duration: 0.22, ease: 'power2.in', transformOrigin: '50% 100%' })
      .add(() => {
        if (mine !== epoch) return;
        writeClue();
        buildDots();
        renderMeta();
      })
      .fromTo(hint, { rotationX: 90, opacity: 0, transformOrigin: '50% 0%' }, { rotationX: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.6)' })
      .add(() => sweepMark(0), '-=0.35');
  }

  /* ───────────── bulle de retour, carte indice, stickers ───────────── */

  /** La bulle est séparée de l'indice : elle ne le remplace jamais. */
  function toast(text, tone = 'ok', hold = 2.4) {
    if (!feedback) return;
    feedback.textContent = text;
    feedback.classList.remove('is-ok', 'is-ko', 'is-tip');
    feedback.classList.add(`is-${tone}`);
    toastTl?.kill();
    gsap.killTweensOf(feedback);
    if (env.reducedMotion) {
      gsap.set(feedback, { opacity: 1, y: 0, scale: 1 });
      toastTl = gsap.timeline().to(feedback, { opacity: 0, duration: 0.2, delay: hold });
      return;
    }
    toastTl = gsap
      .timeline()
      .fromTo(feedback, { opacity: 0, y: -10, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'back.out(2.4)' })
      .to(feedback, { opacity: 0, y: -4, duration: 0.3, ease: 'power1.in' }, `+=${hold}`);
  }

  function flashClue(kind) {
    if (!clueBox) return;
    clueBox.classList.remove('is-ok', 'is-ko');
    void clueBox.offsetWidth;
    clueBox.classList.add(`is-${kind}`);
    later(() => clueBox.classList.remove(`is-${kind}`), 900);
    if (kind === 'ko' && !env.reducedMotion) gsap.fromTo(clueBox, { x: -8 }, { x: 0, duration: 0.7, ease: 'elastic.out(1, 0.25)', overwrite: 'auto' });
  }

  const rectOf = (el) => el.getBoundingClientRect();
  const centerOf = (el) => {
    const r = rectOf(el);
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: r };
  };
  /** Sticker de réaction ; il évite la zone de la bulle de retour (sous la carte indice collante). */
  const react = (kind, rect, opts = {}) => reactions.show(kind, rect, { ...opts, minTop: (bar ? rectOf(bar).bottom : 0) + 52 });

  /* ───────────── cartes du plateau ───────────── */

  function labelFor(card) {
    return `${nameOf(card)}, ${flipped(card) ? 'carte retournée' : 'carte à retourner'}`;
  }

  function refreshTabs(preferred) {
    const open = live();
    const keep = preferred && open.includes(preferred) ? preferred : open.find((card) => card.tabIndex === 0) || open[0];
    for (const card of cards) {
      card.tabIndex = card === keep ? 0 : -1;
      card.setAttribute('aria-label', labelFor(card));
      card.setAttribute('aria-disabled', String(flipped(card)));
    }
  }

  function focusCard(card) {
    if (!card) return;
    refreshTabs(card);
    card.focus();
  }

  /** Carte voisine (flèches) : ← → suivent l'ordre du DOM, ↑ ↓ cherchent la rangée au-dessus / au-dessous. */
  function neighbor(from, key) {
    const open = live();
    const index = open.indexOf(from);
    if (key === 'ArrowRight') return open[index + 1];
    if (key === 'ArrowLeft') return open[index - 1];
    if (key === 'Home') return open[0];
    if (key === 'End') return open[open.length - 1];
    const here = centerOf(from);
    const dir = key === 'ArrowDown' ? 1 : -1;
    const candidates = open
      .filter((card) => card !== from)
      .map((card) => ({ card, c: centerOf(card) }))
      .filter(({ c }) => (c.y - here.y) * dir > rectOf(from).height * 0.5);
    if (!candidates.length) return null;
    const nearestRow = Math.min(...candidates.map(({ c }) => Math.abs(c.y - here.y)));
    return candidates
      .filter(({ c }) => Math.abs(c.y - here.y) < nearestRow + rectOf(from).height * 0.4)
      .sort((a, b) => Math.abs(a.c.x - here.x) - Math.abs(b.c.x - here.x))[0].card;
  }

  function wireCard(card) {
    card.setAttribute('role', 'button');
    card.addEventListener('click', () => onPick(card));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPick(card);
        return;
      }
      if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        const next = neighbor(card, event.key);
        event.preventDefault();
        if (next) focusCard(next);
      }
    });
    if (env.touch) return;
    // Survol : soulèvement, inclinaison 3D vers le pointeur et reflet qui suit la souris
    // (gsap.to + overwrite plutôt que quickTo : les autres animations de la carte, remises à zéro à chaque partie, ne cassent rien)
    gsap.set(card, { transformPerspective: 900 });
    const tilt = (rotationX, rotationY) => gsap.to(card, { rotationX, rotationY, duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    card.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse' || flipped(card) || env.reducedMotion) return;
      gsap.to(card, { scale: 1.05, y: -4, duration: 0.4, ease: 'power3.out', overwrite: 'auto' });
    });
    card.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' || flipped(card)) return;
      const r = rectOf(card);
      const px = (event.clientX - r.left) / r.width;
      const py = (event.clientY - r.top) / r.height;
      card.style.setProperty('--gx', `${px * 100}%`);
      card.style.setProperty('--gy', `${py * 100}%`);
      if (!env.reducedMotion) tilt(-(py - 0.5) * 12, (px - 0.5) * 12);
    });
    card.addEventListener('pointerleave', () => {
      if (env.reducedMotion) return;
      gsap.to(card, { scale: 1, y: 0, rotationX: 0, rotationY: 0, duration: 0.7, ease: 'elastic.out(1, 0.55)', overwrite: 'auto' });
    });
  }

  /* ───────────── logique d'une réponse ───────────── */

  const targetsLeft = () => clues[state.step].out.map((slug) => bySlug.get(slug)).filter((card) => card && !flipped(card));

  function clearHints() {
    for (const card of cards) card.classList.remove('is-hint');
  }

  function onPick(card) {
    lastActivity = performance.now();
    if (state.phase === 'done') {
      if (card.classList.contains('is-winner')) openStage(slugOf(card));
      return;
    }
    if (state.phase !== 'play' || flipped(card)) return;
    if (clues[state.step].out.includes(slugOf(card))) good(card);
    else bad(card);
  }

  function good(card) {
    const wasFocused = document.activeElement === card;
    // carte voisine choisie AVANT le retournement (après, la carte n'est plus dans la liste des cartes vivantes)
    const nextFocus = wasFocused ? neighbor(card, 'ArrowRight') || neighbor(card, 'ArrowLeft') : null;
    card.classList.add('is-flipped');
    card.classList.remove('is-hint');
    clearHints();
    if (!env.reducedMotion) gsap.to(card, { scale: 1, y: 0, rotationX: 0, rotationY: 0, duration: 0.3, overwrite: 'auto' });
    state.streak += 1;
    const left = targetsLeft();
    renderMeta({ pop: true });
    const { x, y, rect } = centerOf(card);
    fx.burst(pageFx, x, y, { count: left.length ? 14 : 22, power: left.length ? 1 : 1.35 });
    vibrate(15);
    if (wasFocused) focusCard(nextFocus || live()[0]);
    else refreshTabs();

    if (left.length) {
      const streakLine = state.streak >= 5 ? `Série de ${state.streak} ! Le Sherlock du social media.` : state.streak === 4 ? 'Série de 4 ! On ne vous arrête plus.' : state.streak === 3 ? 'Série de 3 ! Vous avez le rythme.' : '';
      toast(streakLine || okLine(), 'ok');
      if (state.streak === 3 || state.streak === 5 || (state.streak > 5 && state.streak % 2 === 1)) react('happy', rect);
      return;
    }
    completeClue(rect);
  }

  function completeClue(rect) {
    state.phase = 'locked';
    const last = state.step === clues.length - 1;
    renderMeta({ pop: true });
    flashClue('ok');
    toast(last ? 'Équipe trouvée !' : clueDoneLine(), 'ok', 1.6);
    react('happy', rect);
    if (clueBox) {
      const c = centerOf(clueBox);
      fx.burst(pageFx, c.x, c.y, { count: 24, power: 1.5 });
    }
    vibrate([20, 30, 20]);
    later(() => (last ? finish() : nextClue()), wait(last ? 950 : 900));
  }

  function nextClue() {
    state.step += 1;
    state.stepErrors = 0;
    nudges = 0;
    state.phase = 'play';
    showHelp(false);
    swapClue();
    refreshTabs();
    armIdle();
  }

  function bad(card) {
    const name = nameOf(card);
    state.errors += 1;
    state.stepErrors += 1;
    state.streak = 0;
    card.classList.remove('is-wrong');
    void card.offsetWidth;
    card.classList.add('is-wrong');
    later(() => card.classList.remove('is-wrong'), 900);
    if (!env.reducedMotion) gsap.fromTo(card, { x: -11, rotation: -4 }, { x: 0, rotation: 0, duration: 0.8, ease: 'elastic.out(1, 0.26)', overwrite: 'auto' });
    flashClue('ko');
    sweepMark(0);
    vibrate([30, 40, 30]);
    const { rect } = centerOf(card);

    if (state.stepErrors >= 3) {
      toast(`${name}, encore ? On vous montre une carte qui brille.`, 'ko', 2.8);
      react('cry', rect, { hold: 1.4 });
      later(() => giveHint({ manual: false }), wait(700));
    } else if (state.stepErrors === 2) {
      toast(`${name} coche l’indice, lui aussi. Un coup de pouce ?`, 'ko', 2.8);
      react('sad', rect);
    } else {
      toast(koLine()(name), 'ko', 2.6);
      react('sad', rect);
    }
    if (state.stepErrors >= 2) showHelp(true);
  }

  /* ───────────── coup de pouce, relance ───────────── */

  function showHelp(on, mode = 'tip') {
    if (!helpBtn) return;
    helpMode = mode;
    helpBtn.textContent = mode === 'review' ? 'Revoir ma team' : helpLabel;
    helpBtn.classList.toggle('is-on', on);
    helpBtn.setAttribute('aria-hidden', String(!on));
    helpBtn.tabIndex = on ? 0 : -1;
  }

  function giveHint({ manual = true, quiet = false } = {}) {
    if (state.phase !== 'play') return;
    const open = targetsLeft();
    if (!open.length) return;
    const barBottom = bar ? rectOf(bar).bottom + 8 : 0;
    const visible = open.filter((card) => {
      const r = rectOf(card);
      return r.top >= barBottom && r.bottom <= window.innerHeight - 8;
    });
    if (quiet && !visible.length) return;
    const pool = visible.length ? visible : open;
    const mid = window.innerHeight / 2;
    const target = pool.sort((a, b) => Math.abs(rectOf(a).top - mid) - Math.abs(rectOf(b).top - mid))[0];
    clearHints();
    target.classList.add('is-hint');
    if (!visible.length) target.scrollIntoView({ block: 'center', behavior: env.reducedMotion ? 'auto' : 'smooth' });
    if (!env.reducedMotion) gsap.fromTo(target, { rotation: -5 }, { rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.3)', overwrite: 'auto' });
    if (!quiet) {
      if (manual) state.helps += 1;
      toast('Coup de pouce : cette carte brille, elle ne coche pas l’indice.', 'tip', 3);
      later(() => react('help', rectOf(target)), wait(manual ? 250 : 500));
    }
    later(() => target.classList.remove('is-hint'), 6500);
  }

  function armIdle() {
    if (state.phase !== 'play') return;
    const mine = epoch;
    const check = () => {
      if (mine !== epoch || state.phase !== 'play') return;
      const idle = performance.now() - lastActivity;
      if (idle < IDLE_MS) {
        later(check, IDLE_MS - idle + 50);
        return;
      }
      if (inView && !document.hidden && nudges < 2) {
        nudges += 1;
        giveHint({ manual: false, quiet: true });
      }
      lastActivity = performance.now();
      if (nudges < 2) later(check, IDLE_MS);
    };
    later(check, IDLE_MS);
  }

  /* ───────────── fin de partie, scène finale ───────────── */

  const finalSlugs = () => {
    const out = new Set(clues.flatMap((clue) => clue.out));
    return cards.map(slugOf).filter((slug) => !out.has(slug));
  };

  function finish() {
    state.phase = 'done';
    clearHints();
    const keep = new Set(finalSlugs());
    const toFlip = cards.filter((card) => !keep.has(slugOf(card)) && !flipped(card));
    toFlip.forEach((card, i) => later(() => card.classList.add('is-flipped'), wait(i * 70)));
    const winners = cards.filter((card) => keep.has(slugOf(card)));
    winners.forEach((card) => card.classList.add('is-winner'));
    later(() => refreshTabs(winners[0]), wait(toFlip.length * 70 + 50));

    hint.textContent = `Bravo ! Voici votre team : ${listNames(winners.map(nameOf))}.`;
    if (ruleEl) ruleEl.textContent = 'Cliquez sur une carte gagnante pour lire sa fiche.';
    markEl = null;
    renderMeta();
    if (skip) skip.textContent = 'Rejouer';
    showHelp(true, 'review');
    for (const card of winners) card.tabIndex = 0;
    later(() => openStage(), wait(toFlip.length * 70 + 850));
  }

  function summary() {
    const { errors, helps, skipped } = state;
    let score = '';
    if (!skipped) {
      if (!errors && !helps) score = 'Sans faute !';
      else if (!errors) score = `Sans faute, avec ${helps} coup${helps > 1 ? 's' : ''} de pouce.`;
      else if (errors === 1) score = '1 faute, on ferme les yeux.';
      else score = `${errors} fautes, mais on a fini en beauté.`;
    }
    return { title: 'Voici votre team !', sub: 'Cliquez sur une carte pour faire connaissance.', score };
  }

  let replaying = false;
  // dernière modalité d'entrée : le focus ne fait « lever » une carte de l'éventail qu'au clavier
  let keyboardModality = false;
  document.addEventListener('keydown', () => (keyboardModality = true), true);
  document.addEventListener('pointerdown', () => (keyboardModality = false), true);
  const stage = stageEl
    ? createStage({
        stage: stageEl,
        gsap,
        env,
        fx,
        members,
        keyboard: () => keyboardModality,
        onReplay: () => replay(),
        onClosed: () => {
          if (replaying) return;
          (helpBtn?.classList.contains('is-on') ? helpBtn : cards.find((card) => card.classList.contains('is-winner')))?.focus({ preventScroll: true });
        },
      })
    : null;

  function openStage(detail = null) {
    if (!stage || state.phase !== 'done') return;
    const winners = cards.filter((card) => card.classList.contains('is-winner')).map((el) => ({ slug: slugOf(el), el }));
    stage.open({ winners, summary: summary(), detail });
  }

  /* ───────────── passer / rejouer ───────────── */

  function skipToEnd() {
    if (state.phase === 'done') return;
    abortPending();
    state.skipped = true;
    state.step = clues.length - 1;
    showHelp(false);
    finish();
  }

  function replay() {
    replaying = true;
    abortPending();
    stage?.reset();
    replaying = false;
    Object.assign(state, { step: 0, phase: 'play', errors: 0, helps: 0, streak: 0, stepErrors: 0, skipped: false });
    nudges = 0;
    lastActivity = performance.now();
    cards.forEach((card, i) => {
      gsap.set(card, { clearProps: 'transform,opacity' });
      gsap.set(card, { transformPerspective: 900 });
      card.classList.remove('is-wrong', 'is-hint', 'is-winner');
      card.style.visibility = '';
      if (flipped(card)) later(() => card.classList.remove('is-flipped'), wait(i * 40));
    });
    later(() => refreshTabs(cards[0]), wait(cards.length * 40 + 20));
    if (skip) skip.textContent = skipLabel;
    if (ruleEl) ruleEl.textContent = ruleText;
    showHelp(false);
    writeClue();
    buildDots();
    renderMeta();
    sweepMark(0.4);
    if (!env.reducedMotion) gsap.fromTo(hint, { y: 8, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' });
    toast('C’est reparti !', 'tip', 1.4);
    armIdle();
    cards[0].focus({ preventScroll: true });
  }

  /* ───────────── câblage ───────────── */

  cards.forEach(wireCard);
  if (skip) {
    skip.setAttribute('role', 'button');
    skip.addEventListener('click', (event) => {
      event.preventDefault();
      if (state.phase === 'done') replay();
      else skipToEnd();
    });
  }
  if (helpBtn) {
    helpBtn.setAttribute('role', 'button');
    helpBtn.addEventListener('click', (event) => {
      event.preventDefault();
      lastActivity = performance.now();
      if (helpMode === 'review') openStage();
      else giveHint({ manual: true });
    });
    helpBtn.addEventListener('keydown', (event) => {
      if (event.key === ' ') {
        event.preventDefault();
        helpBtn.click();
      }
    });
  }
  for (const type of ['pointerdown', 'keydown']) root.addEventListener(type, () => (lastActivity = performance.now()), { passive: true });

  if ('IntersectionObserver' in window) new IntersectionObserver(([entry]) => (inView = entry.isIntersecting), { threshold: 0.05 }).observe(root);

  // État « collée » de la carte indice (ombre renforcée, version compacte sur mobile)
  if (bar) {
    let queued = false;
    const check = () => {
      queued = false;
      const limit = parseFloat(getComputedStyle(bar).top) || 0;
      bar.classList.toggle('is-stuck', rectOf(bar).top <= limit + 1);
    };
    const schedule = () => {
      if (!queued) {
        queued = true;
        requestAnimationFrame(check);
      }
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    check();
  }

  buildPips();
  writeClue();
  buildDots();
  renderMeta();
  refreshTabs(cards[0]);
  showHelp(false);
  if (feedback) gsap.set(feedback, { opacity: 0 });
  sweepMark(0.5);
  armIdle();

  if (env.debug) {
    window.__smfGame = {
      state,
      clues,
      source,
      cards,
      members,
      stage,
      pick: (slug) => onPick(bySlug.get(slug)),
      skip: skipToEnd,
      replay,
      openStage,
      help: () => giveHint({ manual: true }),
    };
  }
}
