/**
 * Attend l'intégration GSAP native de Webflow (window.gsap) sans jamais l'importer.
 * Les plugins (ScrollTrigger, SplitText, DrawSVG, MorphSVG, Flip) sont activés dans les réglages du site.
 */
export function whenGsap({ timeout = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const started = performance.now();
    (function check() {
      if (window.gsap) return resolve(window.gsap);
      if (performance.now() - started > timeout) {
        return reject(new Error('GSAP introuvable : activer l’intégration GSAP dans les réglages Webflow.'));
      }
      requestAnimationFrame(check);
    })();
  });
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
