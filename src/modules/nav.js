/**
 * G2-G4 — Nav principale (data-smf-nav) et méga-menus.
 *
 * Les méga-menus sont des éléments Popover natifs de Webflow (popover=auto, top layer) ouverts par des <button popovertarget>
 * (data-smf-nav-trigger) : ouverture / fermeture au clic ou au clavier, clic extérieur, Échap et retour du focus sont gérés par le
 * navigateur, l'animation d'entrée / de sortie et le voile par le CSS (head du site). Ce module n'ajoute que :
 *   - l'ouverture au survol (80 ms) / fermeture (200 ms) sur bureau avec souris, le pointeur pouvant passer du bouton au panneau ;
 *   - le morphing Expertises ↔ Agence : le panneau se transforme (taille et contenu) au lieu de se fermer / rouvrir ;
 *   - aria-expanded / aria-haspopup / aria-controls sur les boutons ;
 *   - l'état de la barre : .is-compact (> 80 px de scroll) et .is-hidden (scroll vers le bas, jamais panneau ouvert) ;
 *   - le menu mobile (≤ 991 px) : bouton data-smf-nav-toggle → .is-mobile-open.
 */
const COMPACT_AT = 80;
const HIDE_DELTA = 6;

export function init([nav], { env }) {
  const triggers = [...nav.querySelectorAll('[data-smf-nav-trigger]')].filter((t) => t.getAttribute('data-smf-nav-trigger') && t.getAttribute('popovertarget'));
  const toggle = nav.querySelector('[data-smf-nav-toggle]');
  const panelOf = (trigger) => document.getElementById(trigger.getAttribute('popovertarget'));
  const panels = triggers.map(panelOf).filter(Boolean);
  const supported = typeof HTMLElement.prototype.showPopover === 'function';

  let openTimer;
  let closeTimer;
  let lastY = window.scrollY;

  const isDesktop = () => window.innerWidth > 991;
  const hover = () => isDesktop() && !env.touch;
  const openPanel = () => panels.find((p) => p.matches(':popover-open'));

  for (const t of triggers) {
    t.setAttribute('aria-haspopup', 'true');
    t.setAttribute('aria-expanded', 'false');
    const panel = panelOf(t);
    if (panel) t.setAttribute('aria-controls', panel.id);
  }
  // aria-expanded suit l'état réel du popover, quelle que soit la façon dont il s'ouvre (clic, survol, clavier, Échap, clic extérieur)
  for (const panel of panels) {
    panel.addEventListener('toggle', (event) => {
      const open = event.newState === 'open';
      for (const t of triggers) if (panelOf(t) === panel) t.setAttribute('aria-expanded', String(open));
      if (open) nav.classList.remove('is-hidden');
    });
  }

  // Passage Expertises ↔ Agence : le panneau se transforme (taille et contenu morphés) au lieu de se fermer / rouvrir.
  function morph(from, to) {
    const gsap = window.gsap;
    if (!gsap || env.reducedMotion) {
      to.showPopover();
      return;
    }
    const fromBox = from.firstElementChild;
    const toBox = to.firstElementChild;
    const start = fromBox.getBoundingClientRect(); // à mesurer avant que le panneau se ferme
    // Pas de fondu pendant le morphing : l'ancien panneau disparaît net, le nouveau est tout de suite opaque.
    from.style.transition = 'none';
    to.style.transition = 'none';
    to.showPopover(); // popover=auto : ferme l'autre
    requestAnimationFrame(() => { from.style.transition = ''; });
    const end = toBox.getBoundingClientRect();
    gsap.killTweensOf([toBox, ...toBox.children]);
    gsap.fromTo(
      toBox,
      { width: start.width, height: start.height, overflow: 'hidden' },
      { width: end.width, height: end.height, duration: 0.4, ease: 'power2.inOut', clearProps: 'width,height,overflow', onComplete: () => { to.style.transition = ''; } },
    );
    gsap.fromTo(
      toBox.children,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.3, delay: 0.15, stagger: 0.04, ease: 'power3.out', clearProps: 'opacity,transform' },
    );
  }

  function show(panel) {
    if (panel.matches(':popover-open')) return;
    const other = openPanel();
    if (other && other !== panel) morph(other, panel);
    else panel.showPopover();
  }
  function hide(panel) {
    if (panel.matches(':popover-open')) panel.hidePopover();
  }
  const scheduleOpen = (panel) => {
    clearTimeout(closeTimer);
    clearTimeout(openTimer);
    openTimer = setTimeout(() => show(panel), 80);
  };
  const scheduleClose = (panel) => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => hide(panel), 200);
  };

  if (supported) {
    for (const t of triggers) {
      const panel = panelOf(t);
      if (!panel) continue;
      t.addEventListener('mouseenter', () => hover() && scheduleOpen(panel));
      t.addEventListener('mouseleave', () => hover() && scheduleClose(panel));
      panel.addEventListener('mouseenter', () => hover() && clearTimeout(closeTimer));
      panel.addEventListener('mouseleave', () => hover() && scheduleClose(panel));
      t.addEventListener('click', (event) => {
        // Souris sur bureau : le survol a déjà ouvert le panneau, le clic ne doit pas le refermer (bascule native).
        // Clavier (detail = 0), tactile et mobile : bascule native du popover.
        if (hover() && event.detail > 0) {
          event.preventDefault();
          clearTimeout(openTimer);
          show(panel);
        }
      });
    }
  }

  // Menu mobile
  function setMobile(open) {
    nav.classList.toggle('is-mobile-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.addEventListener('click', () => setMobile(!nav.classList.contains('is-mobile-open')));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-mobile-open') && !openPanel()) setMobile(false);
  });
  window.addEventListener('resize', () => {
    if (isDesktop() && nav.classList.contains('is-mobile-open')) setMobile(false);
  });

  // Compacte après 80 px ; se masque en descendant, revient en remontant
  function onScroll() {
    const y = Math.max(window.scrollY, 0);
    nav.classList.toggle('is-compact', y > COMPACT_AT);
    const delta = y - lastY;
    if (Math.abs(delta) >= HIDE_DELTA) {
      const locked = openPanel() || nav.classList.contains('is-mobile-open') || nav.contains(document.activeElement);
      nav.classList.toggle('is-hidden', delta > 0 && y > COMPACT_AT * 2 && !locked);
      lastY = y;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Le focus clavier dans la nav la fait toujours revenir
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
}
