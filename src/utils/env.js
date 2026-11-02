/** Environnement partagé par les modules (breakpoints Webflow, préférences utilisateur). */
const mq = (query) => window.matchMedia(query);

const reducedMotion = mq('(prefers-reduced-motion: reduce)');
const touch = mq('(hover: none), (pointer: coarse)');

export const breakpoints = { tablet: 991, mobileLandscape: 767, mobilePortrait: 478 };

export const env = {
  /** true si l'utilisateur demande moins d'animations (valeur à jour à chaque lecture). */
  get reducedMotion() {
    return reducedMotion.matches;
  },
  /** true sur écran tactile sans survol. */
  get touch() {
    return touch.matches;
  },
  /** true à 767 px et en dessous (règles mobiles CLAUDE.md §8). */
  get mobile() {
    return mq(`(max-width: ${breakpoints.mobileLandscape}px)`).matches;
  },
  /** Journal détaillé avec ?smf-debug dans l'URL. */
  debug: new URLSearchParams(window.location.search).has('smf-debug'),
  /** Abonnement aux changements de prefers-reduced-motion. */
  onReducedMotionChange(callback) {
    reducedMotion.addEventListener('change', () => callback(reducedMotion.matches));
  },
};
