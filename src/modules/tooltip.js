/**
 * Infobulles des logos (data-smf-tooltip) : survol et focus sont gérés en CSS ; ici, tap sur mobile (.is-open)
 * et fermeture à l'Échap ou au tap ailleurs. L'élément doit être focusable (le « i » l'est).
 */
export function init(elements, { env }) {
  const closeAll = (except) => {
    for (const el of elements) if (el !== except) el.classList.remove('is-open');
  };

  for (const el of elements) {
    if (!el.hasAttribute('tabindex') && !['A', 'BUTTON'].includes(el.tagName)) el.tabIndex = 0;
    el.addEventListener('click', (event) => {
      if (!env.touch) return;
      event.preventDefault();
      closeAll(el);
      el.classList.toggle('is-open');
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-smf-tooltip]')) closeAll();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeAll();
  });
}
