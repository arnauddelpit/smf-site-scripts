/**
 * Formulaire de contact (data-smf-form="contact") — docs/integrations.md.
 * - champs cachés data-smf-form-field : page (URL d'origine) et utm_source / utm_medium / utm_campaign
 *   (lus dans l'URL, mémorisés pour la session) ;
 * - sur une page Besoin (/besoins/<slug>), présélectionne la liste « besoin » ;
 * - en cas d'erreur de validation, le focus va au premier champ invalide (message natif en français via lang="fr") ;
 * - l'envoi lui-même est géré par Webflow (notification e-mail conservée) ; le webhook vers Make part côté Webflow.
 */
const NEEDS = {
  'gagner-en-visibilite': 'visibilite',
  'ameliorer-mon-engagement': 'engagement',
  'augmenter-mon-trafic': 'trafic',
  'capter-plus-de-leads': 'leads',
  'booster-mes-ventes': 'ventes',
};
const UTM = ['utm_source', 'utm_medium', 'utm_campaign'];
// Placeholders de la maquette (l'API Webflow ne permet pas de les poser sur les champs) et libellé de l'upload en français.
const PLACEHOLDERS = {
  entreprise: 'Nom de l’entreprise',
  nom: 'Nom',
  prenom: 'Prénom',
  email: 'E-mail',
  telephone: 'Téléphone',
  message: 'Commentaires',
};

function remembered(key, fromUrl) {
  try {
    if (fromUrl) sessionStorage.setItem(`smf_${key}`, fromUrl);
    return fromUrl || sessionStorage.getItem(`smf_${key}`) || '';
  } catch {
    return fromUrl || '';
  }
}

export function init(forms) {
  const params = new URLSearchParams(location.search);

  for (const form of forms) {
    const field = (name) => form.querySelector(`[data-smf-form-field="${name}"]`);

    for (const [name, text] of Object.entries(PLACEHOLDERS)) {
      const el = form.querySelector(`[name="${name}"]`);
      if (el) el.setAttribute('placeholder', text);
    }
    // Libellé du bouton d'envoi de fichiers : Webflow le pose dans .w-file-upload-label > div (« Upload File » par défaut)
    const upload = form.querySelector('.w-file-upload-label .w-inline-block, .w-file-upload-text');
    if (upload) upload.textContent = 'Sélectionnez des fichiers…';

    const page = field('page');
    if (page) page.value = location.origin + location.pathname;
    for (const key of UTM) {
      const el = field(key);
      if (el) el.value = remembered(key, params.get(key));
    }

    const need = location.pathname.match(/^\/besoins\/([^/]+)/);
    const select = field('besoin');
    if (need && select && NEEDS[need[1]]) select.value = NEEDS[need[1]];

    // Focus sur le premier champ en erreur (l'événement « invalid » ne remonte pas : capture)
    let focused = false;
    form.addEventListener(
      'invalid',
      (event) => {
        if (focused) return;
        focused = true;
        event.target.focus();
        setTimeout(() => (focused = false), 0);
      },
      true,
    );
  }
}
