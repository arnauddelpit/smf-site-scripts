/**
 * Cartes issues du CMS dont le lien ne peut pas être lié à l'item (la propriété « Lien » des composants Bouton /
 * Méga-menu Carte n'accepte pas de lien vers une page de collection). Le conteneur porte :
 *   data-smf-need-slug   slug de l'item CMS ;
 *   data-smf-link-base   chemin de la collection (défaut /besoins/ ; /secteurs/ pour les secteurs).
 * Le premier lien du conteneur pointe alors vers <base><slug>. Sur une page Besoin, la tuile du besoin courant est
 * retirée de la liste « Vous savez, on a tous des problèmes ».
 */
export function init(items) {
  const current = location.pathname.replace(/\/+$/, '').split('/').pop();
  for (const item of items) {
    const slug = (item.getAttribute('data-smf-need-slug') || '').trim();
    if (!slug) continue;
    const base = item.getAttribute('data-smf-link-base') || '/besoins/';
    if (base === '/besoins/' && location.pathname.startsWith('/besoins/') && slug === current && item.matches('.needs-grid_item')) {
      item.remove();
      continue;
    }
    const link = item.matches('a') ? item : item.querySelector('a');
    if (link) link.setAttribute('href', `${base}${encodeURIComponent(slug)}`);
  }
}
