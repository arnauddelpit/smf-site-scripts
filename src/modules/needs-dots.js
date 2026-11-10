/**
 * Puces du carrousel besoins (data-smf-needs-dots sur le <nav>, data-smf-pin-dot=<n> sur chaque bouton).
 * La mise en page (slides sticky, puces sticky) et les animations sont 100 % Webflow (styles + interactions IX3) ; ce petit
 * module ne fait que ce que Webflow ne sait pas faire pour des items CMS : marquer la puce de la slide en cours (aria-current)
 * et faire défiler jusqu'à la slide cliquée. Inactif quand les slides ne sont pas sticky (mobile : puces masquées en CSS).
 */
const READ = 120; // px : une slide est « en cours » dès qu'elle est à moins de 120 px de sa position calée

export function init([nav]) {
  const root = nav.closest('.needs-slider_component') || nav.parentElement;
  const slides = [...root.querySelectorAll('[aria-roledescription="diapositive"]')];
  const dots = [...nav.querySelectorAll('[data-smf-pin-dot]')];
  if (slides.length < 2 || !dots.length) return;
  const sticky = () => getComputedStyle(slides[0]).position === 'sticky';
  const stuckTop = () => parseFloat(getComputedStyle(slides[0]).top) || 0;

  let current = -1;
  const update = () => {
    if (!sticky()) return;
    const limit = stuckTop() + READ;
    let active = 0;
    slides.forEach((slide, i) => {
      if (slide.getBoundingClientRect().top <= limit) active = i;
    });
    if (active === current) return;
    current = active;
    dots.forEach((dot, i) => (i === active ? dot.setAttribute('aria-current', 'true') : dot.removeAttribute('aria-current')));
  };
  let queued = false;
  const onScroll = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      update();
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();

  dots.forEach((dot) => {
    dot.addEventListener('click', (event) => {
      event.preventDefault();
      const index = Number(dot.getAttribute('data-smf-pin-dot'));
      const list = slides[0].parentElement.closest('.needs-slider_list') || slides[0].parentElement;
      const listTop = list.getBoundingClientRect().top + window.scrollY;
      // position naturelle de la slide : haut de la liste + hauteurs (et marges) des slides précédentes
      const before = slides.slice(0, index).reduce((sum, slide) => sum + slide.offsetHeight + (parseFloat(getComputedStyle(slide).marginBottom) || 0), 0);
      window.scrollTo({ top: listTop + before - stuckTop() + 2, behavior: 'smooth' });
    });
  });
}
