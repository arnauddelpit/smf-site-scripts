/**
 * Cartes équipe (data-smf-team = filters | game).
 *
 * Mode filters (accueil) : [data-smf-filter] = filtre (aria-pressed, un seul actif, « tout » = tous les talents),
 * [data-smf-card] = carte ; data-smf-tags (liste séparée par des espaces) sur la carte ou son item CMS parent donne ses filtres.
 * Les cartes qui ne correspondent pas se retournent (.is-flipped, le flip 3D est en CSS) avec un léger stagger.
 *
 * Mode game (« Qui est-ce ? ») : pas encore implémenté (voir build-log : indices du jeu non exposés au DOM).
 */
export function init(elements, { env }) {
  for (const root of elements) {
    if (root.getAttribute('data-smf-team') === 'filters') initFilters(root, env);
  }
}

function initFilters(root, env) {
  const filters = [...root.querySelectorAll('[data-smf-filter]')];
  const cards = [...root.querySelectorAll('[data-smf-card]')];
  if (!filters.length || !cards.length) return;

  // data-smf-tags est posé sur l'item CMS qui contient la carte (liste séparée par des espaces, slugs des filtres)
  const tagsOf = (card) => (card.closest('[data-smf-tags]')?.getAttribute('data-smf-tags') || '').split(/\s+/).filter(Boolean);
  const tagged = cards.some((card) => tagsOf(card).length > 0);
  if (!tagged) console.warn('[smf] team filters : aucune carte ne porte data-smf-tags, les filtres sont sans effet.');

  const apply = (value) => {
    for (const f of filters) f.setAttribute('aria-pressed', String(f.getAttribute('data-smf-filter') === value));
    cards.forEach((card, index) => {
      const tags = tagsOf(card);
      const match = value === 'tout' || !tagged || tags.includes(value);
      const flip = () => card.classList.toggle('is-flipped', !match);
      if (env.reducedMotion) flip();
      else setTimeout(flip, index * 25);
    });
  };

  const initial = filters.find((f) => f.getAttribute('aria-pressed') === 'true') || filters[0];
  for (const f of filters) {
    if (!['A', 'BUTTON'].includes(f.tagName)) {
      f.setAttribute('role', 'button');
      f.tabIndex = 0;
    }
    f.addEventListener('click', (event) => {
      event.preventDefault();
      apply(f.getAttribute('data-smf-filter'));
    });
    f.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        apply(f.getAttribute('data-smf-filter'));
      }
    });
  }
  apply(initial.getAttribute('data-smf-filter'));
}
