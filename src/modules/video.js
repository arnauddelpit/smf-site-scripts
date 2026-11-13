/**
 * Vidéos Vimeo, chargées uniquement à l'usage (jamais au chargement de page) :
 * - G7  tuile d'étude de cas [data-smf-case-tile][data-smf-vimeo] : au survol (tap sur mobile), vidéo muette en boucle
 *       (background) en fondu par-dessus la vignette ; à la sortie elle est retirée.
 * - section contact [data-smf-video-autoplay="viewport"] : lecture muette en boucle à l'entrée dans le viewport, retirée en sortie.
 * - carte témoignage vidéo [data-smf-video-play] : au clic, player avec son dans le parent portant data-smf-vimeo.
 * Les URL sans identifiant (« https://vimeo.com/ », placeholder) sont ignorées. Reduced-motion : aucune lecture automatique.
 */
import { onViewport } from '../utils/viewport.js';

const ID = /vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-z0-9]+))?/i;

export function playerUrl(url, { background }) {
  const match = (url || '').match(ID);
  if (!match) return null;
  const params = new URLSearchParams({ dnt: '1' });
  if (match[2]) params.set('h', match[2]);
  if (background) {
    for (const key of ['background', 'autoplay', 'loop', 'muted']) params.set(key, '1');
  } else {
    params.set('autoplay', '1');
  }
  return `https://player.vimeo.com/video/${match[1]}?${params}`;
}

export function makeFrame(src, { title, cover }) {
  const frame = document.createElement('iframe');
  frame.src = src;
  frame.title = title;
  frame.allow = 'autoplay; fullscreen; picture-in-picture';
  frame.setAttribute('loading', 'lazy');
  frame.setAttribute('data-smf-vimeo-frame', '');
  frame.style.cssText = `border:0;opacity:0;transition:opacity .3s;${
    cover ? 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;' : 'width:100%;aspect-ratio:16/9;'
  }`;
  frame.addEventListener('load', () => (frame.style.opacity = '1'), { once: true });
  return frame;
}

export function init(elements, { env }) {
  for (const el of elements) {
    if (el.hasAttribute('data-smf-case-tile')) tile(el, env);
    else if (el.getAttribute('data-smf-video-autoplay') === 'viewport') autoplay(el, env);
    else if (el.hasAttribute('data-smf-video-play')) player(el);
  }
}

function tile(el, env) {
  // Lien propre à chaque étude de cas : la propriété « Lien » du composant ne peut pas être liée au CMS,
  // on reconstruit donc l'URL à partir du slug de l'item exposé en data-smf-case-slug.
  const slug = (el.getAttribute('data-smf-case-slug') || '').trim();
  if (slug && el.tagName === 'A') el.setAttribute('href', `/etudes-de-cas/${encodeURIComponent(slug)}`);

  if (env.reducedMotion) return;
  const src = playerUrl(el.getAttribute('data-smf-vimeo'), { background: true });
  if (!src) return;
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

  let frame = null;
  const start = () => {
    if (frame) return;
    frame = makeFrame(src, { title: 'Aperçu vidéo de l’étude de cas', cover: true });
    el.append(frame);
  };
  const stop = () => {
    frame?.remove();
    frame = null;
  };

  if (env.touch) {
    el.addEventListener('click', (event) => {
      if (frame) return; // 2e tap : on laisse le lien s'ouvrir
      event.preventDefault();
      start();
    });
  } else {
    el.addEventListener('mouseenter', start);
    el.addEventListener('mouseleave', stop);
    el.addEventListener('focusin', start);
    el.addEventListener('focusout', stop);
  }
}

function autoplay(el, env) {
  // Image d'aperçu introuvable (asset non publié, 403…) : on la masque plutôt que d'afficher l'icône d'image cassée.
  for (const img of el.querySelectorAll('img')) {
    const hide = () => { img.style.visibility = 'hidden'; };
    if (img.complete && img.naturalWidth === 0) hide();
    else img.addEventListener('error', hide, { once: true });
  }
  if (env.reducedMotion) return;
  const target = el.hasAttribute('data-smf-vimeo') ? el : el.querySelector('[data-smf-vimeo]');
  const src = playerUrl(target?.getAttribute('data-smf-vimeo'), { background: true });
  if (!src) return;
  if (getComputedStyle(target).position === 'static') target.style.position = 'relative';

  let frame = null;
  onViewport(el, {
    enter: () => {
      if (frame) return;
      frame = makeFrame(src, { title: 'Vidéo de présentation', cover: true });
      target.append(frame);
    },
    leave: () => {
      frame?.remove();
      frame = null;
    },
  });
}

function player(button) {
  const host = button.closest('[data-smf-vimeo]');
  const src = playerUrl(host?.getAttribute('data-smf-vimeo'), { background: false });
  if (!host || !src) return;

  let frame = null;
  button.addEventListener('click', (event) => {
    event.preventDefault();
    if (frame) return;
    if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
    frame = makeFrame(src, { title: 'Témoignage vidéo', cover: true });
    frame.style.pointerEvents = 'auto';
    host.append(frame);
    onViewport(host, {
      leave: () => {
        frame?.remove();
        frame = null;
      },
    });
  });
}
