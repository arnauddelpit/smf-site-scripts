/**
 * Attend l'intégration GSAP native de Webflow (window.gsap) sans jamais l'importer.
 * Les plugins (ScrollTrigger, SplitText, DrawSVG, MorphSVG, Flip) sont activés dans les réglages du site.
 */
export function whenGsap({ timeout = 8000, nativeWait = 1500 } = {}) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    let fallbackStarted = false;
    let fallbackReady = false;
    (function check() {
      if (window.gsap && (!fallbackStarted || fallbackReady)) return resolve(window.gsap);
      const elapsed = performance.now() - started;
      // Repli temporaire : si l'intégration native Webflow n'est pas activée, on charge GSAP épinglé (SRI).
      if (elapsed > nativeWait && !fallbackStarted) {
        fallbackStarted = true;
        console.warn('[smf] intégration GSAP de Webflow absente : repli sur GSAP 3.13.0 (jsDelivr). À activer dans les réglages du site.');
        loadFallback()
          .then(() => (fallbackReady = true))
          .catch((error) => console.error('[smf] repli GSAP :', error));
      }
      if (elapsed > timeout) {
        return reject(new Error('GSAP introuvable : activer l’intégration GSAP dans les réglages Webflow.'));
      }
      requestAnimationFrame(check);
    })();
  });
}

const FALLBACK = [
  ['https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js', 'sha384-HOvlOYPIs/zjoIkWUGXkVmXsjr8GuZLV+Q+rcPwmJOVZVpvTSXQChiN4t9Euv9Vc'],
  ['https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/ScrollTrigger.min.js', 'sha384-P8VzCVnT9NBUkMrpcIZrJbA7EBjJvh/fJS6PmP+4nLIM284DtsImIv8D0fFjIkeh'],
];

function inject([src, integrity]) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.integrity = integrity;
    script.crossOrigin = 'anonymous';
    script.onload = resolve;
    script.onerror = () => reject(new Error(`chargement impossible : ${src}`));
    document.head.append(script);
  });
}

async function loadFallback() {
  await inject(FALLBACK[0]); // gsap d'abord (ScrollTrigger s'enregistre dessus)
  await inject(FALLBACK[1]);
}

/** Enregistre les plugins disponibles parmi ceux demandés et renvoie ceux qui manquent. */
export function registerPlugins(gsap, names) {
  const missing = [];
  for (const name of names) {
    const plugin = window[name];
    if (plugin) gsap.registerPlugin(plugin);
    else missing.push(name);
  }
  return missing;
}
