/**
 * Autres besoins (pages Besoin) : chaque tuile issue du CMS porte data-smf-need-slug (slug de l'item).
 * - le bouton de la tuile pointe vers /besoins/<slug> (la propriété « Lien » du composant Bouton ne peut pas être liée
 *   au CMS) ;
 * - la tuile du besoin de la page courante est retirée de la liste.
 */
export function init(items) {
  const current = location.pathname.replace(/\/+$/, '').split('/').pop();
  for (const item of items) {
    const slug = (item.getAttribute('data-smf-need-slug') || '').trim();
    if (!slug) continue;
    if (slug === current) {
      item.remove();
      continue;
    }
    const link = item.querySelector('a');
    if (link) link.setAttribute('href', `/besoins/${encodeURIComponent(slug)}`);
  }
}
