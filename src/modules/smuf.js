/**
 * Smufs (data-smf-smuf = identifiant de docs/smufs.md) : injecte le SVG inline (smufs/<id>.svg) à l'entrée dans le
 * viewport. Les Smufs sont STATIQUES (décision d'Arnaud : animations de Smufs abandonnées).
 * Une description vide (data-smf-smuf-desc absente ou vide) rend le Smuf décoratif (aria-hidden).
 */
import { onViewport } from '../utils/viewport.js';

const cache = new Map();

function load(url) {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${url}`);
        return response.text();
      }),
    );
  }
  return cache.get(url);
}

/**
 * Les exports Figma réutilisent les mêmes id (clip0_0_1, paint0_linear_0_1…) d'un SVG à l'autre : une fois inlinés
 * dans la même page, le premier SVG « gagne » et les masques / dégradés des suivants pointent au mauvais endroit
 * (le Smuf apparaît vide ou tronqué). On préfixe donc chaque id et ses références par un identifiant unique.
 */
let uid = 0;
function uniquifyIds(markup) {
  uid += 1;
  const prefix = `s${uid}-`;
  return markup
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${prefix}${id}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${prefix}${id})`)
    .replace(/(xlink:href|href)="#([^"]+)"/g, (_, attr, id) => `${attr}="#${prefix}${id}"`);
}

/**
 * Smufs animés (Lottie / dotLottie), uploadés par Arnaud dans les assets Webflow. Identifiant « lottie-… » posé sur le
 * composant Smuf (méga-menu Expertises) ; le fichier est servi par le CDN Webflow (CORS ouvert). Le lecteur
 * @lottiefiles/dotlottie-web n'est téléchargé que si un de ces Smufs est présent, et l'animation ne tourne que
 * lorsque le Smuf est visible (méga-menu ouvert). Reduced-motion : première image fixe.
 * ratio = largeur / hauteur de la composition.
 */
const SITE_ASSETS = 'https://cdn.prod.website-files.com/6ae8b90dbeb201293a031771/';
const LOTTIES = {
  'lottie-likes': { src: `${SITE_ASSETS}6af1997726a2402e32b5c58b_smuf%20likes.lottie`, ratio: '175 / 160' },
  'lottie-roi': { src: `${SITE_ASSETS}6af1ab5a9965380aa0967f86_smuf%20roi.lottie`, ratio: '148 / 162' },
  'lottie-cadreur': { src: `${SITE_ASSETS}6af1ab96704eee5b05b5f45d_smuf%20cadreur.lottie`, ratio: '168 / 219' },
  'lottie-qui-pleure': { src: `${SITE_ASSETS}6af1985b34937b400d9c3e3f_smuf%20qui%20pleure.lottie`, ratio: '187 / 149' },
  'lottie-coeur': { src: `${SITE_ASSETS}6af1985b26a2402e32b559df_smuf%20coeur.lottie`, ratio: '164 / 167' },
  // Agence Ads : hero (Smuf + gerbe de paillettes, le Smuf est en bas à droite du cadre), Smuf selfie des études de cas
  'lottie-paillettes': { src: `${SITE_ASSETS}6af1ac3c6504eafc30052367_smuf%20paillettes.lottie`, ratio: '882 / 706' },
  'lottie-selfie': { src: `${SITE_ASSETS}6af1985ba32c0bc9b4b493a8_smuf%20selfie.lottie`, ratio: '356 / 310' },
  'lottie-emu': { src: `${SITE_ASSETS}6af1985bfb9ac805f0132a9b_smuf%20emu.lottie`, ratio: '115 / 137' },
  'lottie-ninja': { src: `${SITE_ASSETS}6af1abd305c838ac381b9060_smuf%20ninja.lottie`, ratio: '178 / 185' },
  'lottie-looser': { src: `${SITE_ASSETS}6af198cac6de60a5e19e99d8_smuf%20looser.lottie`, ratio: '215 / 240' },
  'lottie-fan': { src: `${SITE_ASSETS}6af1989aed84a0f9d5ef1e94_smuf%20fan.lottie`, ratio: '215 / 211' },
};
const DOTLOTTIE = 'https://cdn.jsdelivr.net/npm/@lottiefiles/dotlottie-web@0.38.2/+esm';

function playLottie(el, { src, ratio }, env) {
  el.style.aspectRatio = ratio;
  let player = null;
  let started = false;

  const start = async () => {
    if (started) {
      player?.play();
      return;
    }
    started = true;
    try {
      const { DotLottie } = await import(/* webpackIgnore: true */ DOTLOTTIE);
      const canvas = document.createElement('canvas');
      canvas.style.cssText = 'display:block;width:100%;height:100%';
      const label = el.getAttribute('aria-label') || el.getAttribute('data-smf-smuf-desc');
      if (label) {
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', label);
      } else {
        canvas.setAttribute('aria-hidden', 'true');
      }
      el.replaceChildren(canvas);
      const rect = el.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      player = new DotLottie({ canvas, src, loop: true, autoplay: !env.reducedMotion });
      el.setAttribute('data-smf-smuf-ready', '');
    } catch (error) {
      started = false;
      console.warn('[smf] Smuf Lottie :', error);
    }
  };

  onViewport(el, {
    rootMargin: '100px',
    enter: start,
    leave: () => player?.pause(),
  });
}

/** SVG d'un Smuf : depuis le fichier JSON regroupé hébergé dans Webflow (smufsUrl), sinon depuis smufs/<id>.svg (jsDelivr). */
async function markupOf(id, { assetBase, smufsUrl }) {
  if (smufsUrl) {
    const map = JSON.parse(await load(smufsUrl));
    if (!map[id]) throw new Error(`Smuf inconnu : ${id}`);
    return map[id];
  }
  return load(`${assetBase}${id}.svg`);
}

export function init(elements, { assetBase, smufsUrl, env }) {
  for (const el of elements) {
    const id = el.getAttribute('data-smf-smuf');
    if (!id) continue;

    if (LOTTIES[id]) {
      playLottie(el, LOTTIES[id], env);
      continue;
    }

    onViewport(el, {
      once: true,
      rootMargin: '200px',
      enter: async () => {
        try {
          const markup = await markupOf(id, { assetBase, smufsUrl });
          const wrapper = document.createElement('div');
          wrapper.innerHTML = uniquifyIds(markup.trim());
          const svg = wrapper.firstElementChild;
          if (!svg || svg.tagName.toLowerCase() !== 'svg') return;

          const label = el.getAttribute('aria-label') || el.getAttribute('data-smf-smuf-desc');
          if (label) {
            svg.setAttribute('role', 'img');
            svg.setAttribute('aria-label', label);
          } else {
            svg.setAttribute('aria-hidden', 'true');
            svg.setAttribute('focusable', 'false');
          }
          el.replaceChildren(svg);
          el.setAttribute('data-smf-smuf-ready', '');
        } catch (error) {
          console.warn(`[smf] Smuf « ${id} » :`, error);
        }
      },
    });
  }
}
