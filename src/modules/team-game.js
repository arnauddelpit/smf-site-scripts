/**
 * Mini-jeu « Qui est-ce ? » (data-smf-team="game") — docs/interactions.md.
 * 1. 16 cartes face visible, indice 1 dans [data-smf-team-hint] (aria-live).
 * 2. Clic (ou Entrée / Espace) sur une carte : bonne réponse (membre éliminé par l'indice courant) → la carte se retourne
 *    (.is-flipped) ; mauvaise → shake horizontal + flash rose (.is-wrong), la carte reste visible.
 * 3. Quand toutes les cartes de l'indice sont retournées → indice suivant (transition de texte).
 * 4. Après le dernier indice : il ne reste que l'équipe de la page, mise en avant (.is-featured : mini-bio + LinkedIn),
 *    plus grande, en éventail. « Passer » saute à cet état ; le même bouton devient « Rejouer ».
 * Les indices viennent de src/data/team-game.json (export du CMS « Indices du jeu »), clés = chemin de la page.
 * Mobile (≤ 767 px) : pas d'éventail (cartes mises en avant à plat). Reduced-motion : aucun mouvement, états immédiats.
 */
import data from '../data/team-game.json';

function pageKey() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'besoins' || parts[0] === 'secteurs') return `${parts[0]}/${parts[1]}`;
  return parts[parts.length - 1] || 'home';
}

const ACCENTS = { valerie: 'Valérie', lea: 'Léa', theo: 'Théo', chloe: 'Chloé' };

/** Prénom affiché à partir du slug (« antoine-p » → « Antoine P. »). */
function displayName(slug) {
  if (ACCENTS[slug]) return ACCENTS[slug];
  return slug
    .split('-')
    .map((part) => (part.length === 1 ? `${part.toUpperCase()}.` : part[0].toUpperCase() + part.slice(1)))
    .join(' ');
}

export function initGame(root, { gsap, env }) {
  const clues = data.pages[pageKey()];
  if (!clues) return; // pas d'indices pour cette page : les cartes restent simplement visibles

  const hint = root.querySelector('[data-smf-team-hint]');
  const skipHost = root.querySelector('[data-smf-team-skip]');
  const skip = skipHost?.querySelector('a, button');
  const cards = [...root.querySelectorAll('[data-smf-card]')];
  const bySlug = new Map(cards.map((card) => [card.getAttribute('data-smf-card'), card]));
  const label = (card) => displayName(card.getAttribute('data-smf-card'));
  const firstText = skip?.textContent.trim() || 'Passer';

  let step = 0;
  let finished = false;

  const say = (text, { instant = false } = {}) => {
    if (!hint) return;
    if (instant || env.reducedMotion) {
      hint.textContent = text;
      return;
    }
    gsap.to(hint, {
      opacity: 0,
      y: -6,
      duration: 0.15,
      onComplete: () => {
        hint.textContent = text;
        gsap.fromTo(hint, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.25 });
      },
    });
  };

  const clueText = () => `${step === 0 ? 'Premier indice' : `Indice ${step + 1}`} : ${clues[step].text}`;
  const remaining = () => cards.filter((card) => !card.classList.contains('is-flipped'));
  const finalSlugs = () => {
    const eliminated = new Set(clues.flatMap((clue) => clue.out));
    return cards.map((card) => card.getAttribute('data-smf-card')).filter((slug) => !eliminated.has(slug));
  };

  function setSkipLabel(text) {
    if (skip) skip.textContent = text;
  }

  function finish(announce = true) {
    finished = true;
    const keep = new Set(finalSlugs());
    cards.forEach((card) => card.classList.toggle('is-flipped', !keep.has(card.getAttribute('data-smf-card'))));
    const team = remaining();
    team.forEach((card) => card.classList.add('is-featured'));
    if (announce) say(`C’était vous qui cherchiez ? Voici votre équipe : ${team.map(label).join(', ')}.`);
    else say('Voici votre équipe.');
    setSkipLabel('Rejouer');

    if (!env.reducedMotion && !env.mobile) {
      const n = team.length;
      team.forEach((card, i) => {
        const offset = i - (n - 1) / 2;
        gsap.to(card, { rotation: offset * 9, y: Math.abs(offset) * 14 - 16, scale: 1.18, zIndex: 10 + i, duration: 0.7, ease: 'back.out(1.4)' });
      });
    } else if (!env.reducedMotion) {
      gsap.to(team, { scale: 1.08, duration: 0.4 });
    }
  }

  function reset() {
    finished = false;
    step = 0;
    gsap.set(cards, { clearProps: 'transform,zIndex' });
    for (const card of cards) card.classList.remove('is-flipped', 'is-featured', 'is-wrong');
    setSkipLabel(firstText);
    say(clueText(), { instant: true });
  }

  function onPick(card) {
    if (finished || card.classList.contains('is-flipped')) return;
    const slug = card.getAttribute('data-smf-card');
    const current = clues[step];

    if (current.out.includes(slug)) {
      card.classList.add('is-flipped');
      const left = current.out.filter((s) => !bySlug.get(s)?.classList.contains('is-flipped'));
      if (left.length) {
        say(`Bien vu, ${label(card)} n’est pas dans l’équipe. Encore ${left.length}.`);
        return;
      }
      if (step === clues.length - 1) {
        setTimeout(() => finish(), env.reducedMotion ? 0 : 600);
      } else {
        step += 1;
        setTimeout(() => say(clueText()), env.reducedMotion ? 0 : 500);
      }
    } else {
      card.classList.add('is-wrong');
      say(`Raté : ${label(card)} ne correspond pas à cet indice.`);
      if (!env.reducedMotion) gsap.fromTo(card, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.25)' });
      setTimeout(() => card.classList.remove('is-wrong'), 700);
    }
  }

  for (const card of cards) {
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.setAttribute('aria-label', `${label(card)}, carte à retourner`);
    card.addEventListener('click', () => onPick(card));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onPick(card);
      }
    });
  }

  if (skip) {
    skip.setAttribute('role', 'button');
    skip.addEventListener('click', (event) => {
      event.preventDefault();
      if (finished) reset();
      else finish(false);
    });
  }

  say(clueText(), { instant: true });
}
