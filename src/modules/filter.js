/**
 * Filtres de la page Réalisations : [data-smf-filter="cases"] contient les filtres (Tag filtre, data-smf-filter=<slug> ;
 * « all » = tout afficher). Les tuiles sont les [data-smf-filter-item] de la page ; data-smf-tags (slugs séparés par
 * des espaces, champ CMS « Tags filtre ») donne leurs filtres. Un seul filtre actif (aria-pressed, style dans le head).
 *
 * Webflow ne sait pas filtrer une liste CMS côté navigateur : seul ce tri reste en code. Le décalage en quinconce est
 * un style natif (`case-grid_cell:nth-child(even)` sur l'élément CMS, marqué data-smf-filter-cell) : on masque la
 * cellule et on la renvoie en fin de liste, pour que la parité des cellules visibles reste juste.
 * Transition : fondu GSAP (instantané en reduced-motion).
 */
export function init(roots, ctx) {
  const items = [...document.querySelectorAll('[data-smf-filter-item]')];
  if (!items.length) return;
  const gsap = ctx.gsap || window.gsap;
  const tagsOf = (item) => (item.getAttribute('data-smf-tags') || '').split(/\s+/).filter(Boolean);
  const cellOf = (item) => item.closest('[data-smf-filter-cell]') || item;
  // ordre d'origine des cellules, pour le restaurer
  const cells = items.map(cellOf);

  for (const root of roots) {
    const filters = [...root.querySelectorAll('[data-smf-filter]')];
    if (!filters.length) continue;

    const apply = (value) => {
      for (const f of filters) f.setAttribute('aria-pressed', String(f.getAttribute('data-smf-filter') === value));
      const show = (item) => value === 'all' || tagsOf(item).includes(value);
      const visible = () => cells.filter((c) => !c.hidden);
      // on anime la tuile (pas la cellule) : le transform natif de la cellule (quinconce) n'est pas écrasé
      const shown = () => items.filter((_, i) => !cells[i].hidden);
      const animate = gsap && !ctx.env.reducedMotion;
      const change = () => {
        items.forEach((item, i) => {
          const cell = cells[i];
          cell.hidden = !show(item);
          cell.style.display = cell.hidden ? 'none' : '';
        });
        // visibles d'abord (ordre d'origine), masquées ensuite : nth-child(even) ne compte que les visibles en tête
        for (const cell of [...visible(), ...cells.filter((c) => c.hidden)]) cell.parentElement.append(cell);
        if (animate) gsap.fromTo(shown(), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'opacity,transform' });
      };
      if (animate) gsap.to(shown(), { opacity: 0, duration: 0.15, onComplete: change });
      else change();
    };

    for (const f of filters) {
      if (!['A', 'BUTTON'].includes(f.tagName)) { f.setAttribute('role', 'button'); f.tabIndex = 0; }
      f.addEventListener('click', (event) => { event.preventDefault(); apply(f.getAttribute('data-smf-filter')); });
      f.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); apply(f.getAttribute('data-smf-filter')); }
      });
    }
    const initial = filters.find((f) => f.getAttribute('aria-pressed') === 'true') || filters[0];
    apply(initial.getAttribute('data-smf-filter'));
  }
}
