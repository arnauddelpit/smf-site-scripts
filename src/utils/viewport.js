/**
 * Lance/arrête une animation à l'entrée/sortie du viewport (CLAUDE.md §6 : pause hors écran).
 * Renvoie une fonction de nettoyage.
 */
export function onViewport(element, { enter, leave, rootMargin = '0px', once = false } = {}) {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          enter?.(entry);
          if (once) observer.disconnect();
        } else {
          leave?.(entry);
        }
      }
    },
    { rootMargin },
  );
  observer.observe(element);
  return () => observer.disconnect();
}
