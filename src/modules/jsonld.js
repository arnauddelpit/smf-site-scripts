/**
 * Données structurées JSON-LD (docs/seo-redirections.md), générées à partir de la page affichée :
 * Organization + WebSite partout ; ProfessionalService (accueil) ; Service (offres, besoins, secteurs) ;
 * CreativeWork (études de cas) ; AboutPage (qui sommes-nous / nous rejoindre) ; BreadcrumbList ; FAQPage
 * (à partir des items [data-smf-accordion] d'un bloc [data-smf-faq], donc de la FAQ réellement affichée).
 * Les URL utilisent le domaine définitif (SITE) quel que soit l'hôte (staging inclus).
 */
const SITE = 'https://www.socialmediafamily.fr';
const ORG_ID = `${SITE}/#organization`;

const SECTION_LABELS = {
  offre: 'Offre',
  besoins: 'Besoins',
  secteurs: 'Secteurs',
  'etudes-de-cas': 'Études de cas',
  agence: 'L’agence',
};
const OFFER_PATHS = ['/offre/agence-ads', '/offre/agence-social-media', '/offre/studio-creatif', '/agence-ads', '/agence-social-media', '/studio-creatif'];

const text = (el) => (el?.textContent || '').replace(/\s+/g, ' ').trim();
const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || undefined;

function organization() {
  const socials = [...document.querySelectorAll('a[href]')]
    .map((a) => a.href)
    .filter((href) => /(?:linkedin|instagram|facebook|tiktok|youtube)\.com/.test(href));
  return {
    '@type': 'Organization',
    '@id': ORG_ID,
    name: 'Social Media Family',
    alternateName: 'SMF',
    url: `${SITE}/`,
    ...(socials.length ? { sameAs: [...new Set(socials)] } : {}),
  };
}

function breadcrumb(path, title) {
  const parts = path.split('/').filter(Boolean);
  const items = [{ name: 'Accueil', url: `${SITE}/` }];
  let acc = '';
  parts.forEach((part, index) => {
    acc += `/${part}`;
    const last = index === parts.length - 1;
    items.push({ name: last ? title : SECTION_LABELS[part] || part, url: `${SITE}${acc}` });
  });
  return {
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({ '@type': 'ListItem', position: i + 1, name: item.name, item: item.url })),
  };
}

function faq() {
  const entries = [];
  for (const item of document.querySelectorAll('[data-smf-faq] [data-smf-accordion]')) {
    const question = text(item.querySelector('[data-smf-accordion-trigger]'));
    const answer = text(item.querySelector('[data-smf-accordion-panel]'));
    if (question && answer) entries.push({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } });
  }
  return entries.length ? { '@type': 'FAQPage', mainEntity: entries } : null;
}

export function init() {
  const path = location.pathname.replace(/\/+$/, '') || '/';

  // Pages techniques : noindex (le réglage de page Webflow n'est pas exposé à l'API)
  if (['/trou-noir', '/styleguide'].includes(path) && !document.querySelector('meta[name="robots"]')) {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.append(robots);
  }
  const h1 = text(document.querySelector('h1'));
  const title = h1 || document.title;
  const description = meta('description');
  const url = `${SITE}${path === '/' ? '/' : path}`;
  const graph = [
    organization(),
    { '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: 'Social Media Family', inLanguage: 'fr-FR', publisher: { '@id': ORG_ID } },
  ];

  if (path === '/') {
    graph.push({
      '@type': 'ProfessionalService',
      '@id': `${SITE}/#localbusiness`,
      name: 'Social Media Family',
      url: `${SITE}/`,
      description,
      address: { '@type': 'PostalAddress', streetAddress: '116 rue Ronsard', postalCode: '37100', addressLocality: 'Tours', addressCountry: 'FR' },
      areaServed: 'France',
      parentOrganization: { '@id': ORG_ID },
    });
  } else {
    const isService = OFFER_PATHS.includes(path) || /^\/(besoins|secteurs)\//.test(path);
    if (isService) {
      graph.push({ '@type': 'Service', name: title, description, url, provider: { '@id': ORG_ID }, areaServed: { '@type': 'Country', name: 'France' } });
    } else if (/^\/etudes-de-cas\//.test(path)) {
      graph.push({ '@type': 'CreativeWork', name: title, description, url, creator: { '@id': ORG_ID }, inLanguage: 'fr-FR' });
    } else if (/(qui-sommes-nous|nous-rejoindre)$/.test(path)) {
      graph.push({ '@type': 'AboutPage', name: title, description, url, about: { '@id': ORG_ID }, inLanguage: 'fr-FR' });
    }
    graph.push(breadcrumb(path, title));
  }

  const faqPage = faq();
  if (faqPage) graph.push(faqPage);

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-smf-jsonld', '');
  script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph.filter(Boolean) });
  document.head.append(script);
}
