/**
 * Filtres de la page Réalisations : [data-smf-filter="cases"] contient les filtres (Tag filtre, data-smf-filter=<slug> ;
 * « all » = tout afficher). Les tuiles sont les [data-smf-filter-item] de la page ; data-smf-tags (slugs séparés par
 * des espaces, champ CMS « Tags filtre ») donne leurs filtres. Un seul filtre actif (aria-pressed).
 * Les tuiles masquées passent en display:none ; les tuiles visibles reçoivent data-smf-even une sur deux pour garder
 * le décalage en quinconce du CSS. Transition : fondu GSAP (instantané en reduced-motion).
 */
export function init(roots, ctx) {
  const items = [...document.querySelectorAll('[data-smf-filter-item]')];
  if (!items.length) return;
  const gsap = ctx.gsap || window.gsap;
  const tagsOf = (item) => (item.getAttribute('data-smf-tags') || '').split(/\s+/).filter(Boolean);

  for (const root of roots) {
    const filters = [...root.querySelectorAll('[data-smf-filter]')];
    if (!filters.length) continue;

    const layout = () => {
      let n = 0;
      for (const item of items) {
        if (item.hidden) { item.removeAttribute('data-smf-even'); continue; }
        if (n % 2 === 1) item.setAttribute('data-smf-even', '');
        else item.removeAttribute('data-smf-even');
        n += 1;
      }
    };

    const apply = (value) => {
      for (const f of filters) f.setAttribute('aria-pressed', String(f.getAttribute('data-smf-filter') === value));
      const show = (item) => value === 'all' || tagsOf(item).includes(value);
      const animate = gsap && !ctx.env.reducedMotion;
      const change = () => {
        for (const item of items) {
          item.hidden = !show(item);
          item.style.display = item.hidden ? 'none' : '';
        }
        layout();
        if (animate) gsap.fromTo(items.filter((i) => !i.hidden), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.06, ease: 'power2.out', clearProps: 'opacity,transform' });
      };
      if (animate) gsap.to(items.filter((i) => !i.hidden), { opacity: 0, duration: 0.15, onComplete: change });
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
