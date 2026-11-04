/**
 * G2-G4 — Nav principale (data-smf-nav) et méga-menus (data-smf-nav-trigger / data-smf-megamenu).
 * États posés sur la nav : .is-compact (> 80 px), .is-hidden (scroll vers le bas), .is-menu-open, .is-mobile-open.
 * Panneau ouvert : .is-open sur [data-smf-megamenu]. Ouverture au survol (80 ms / fermeture 200 ms) et au
 * clic / Entrée / Espace ; Échap ferme. Mobile (≤ 991 px) : bouton data-smf-nav-toggle, pas de survol.
 * Le morphing Expertises ↔ Agence (Flip) n'est pas implémenté : le passage est instantané.
 */
const COMPACT_AT = 80;
const HIDE_DELTA = 6;

export function init([nav], { env }) {
  const triggers = [...nav.querySelectorAll('[data-smf-nav-trigger]')].filter((t) => t.getAttribute('data-smf-nav-trigger'));
  const panels = [...nav.querySelectorAll('[data-smf-megamenu]')];
  const toggle = nav.querySelector('[data-smf-nav-toggle]');

  let current = null;
  let openTimer;
  let closeTimer;
  let lastY = window.scrollY;

  const panelFor = (key) => panels.find((p) => p.getAttribute('data-smf-megamenu') === key);

  for (const panel of panels) panel.id = panel.id || `smf-megamenu-${panel.getAttribute('data-smf-megamenu')}`;
  for (const t of triggers) {
    const key = t.getAttribute('data-smf-nav-trigger');
    t.setAttribute('role', 'button');
    t.setAttribute('aria-expanded', 'false');
    t.setAttribute('aria-haspopup', 'true');
    if (t.tabIndex < 0 || !t.hasAttribute('tabindex')) t.tabIndex = 0;
    const panel = panelFor(key);
    if (panel) t.setAttribute('aria-controls', panel.id);
  }

  // Passage Expertises ↔ Agence : le panneau se transforme (taille et contenu morphés) au lieu de se fermer / rouvrir.
  function morph(fromPanel, toPanel) {
    const gsap = window.gsap;
    fromPanel.classList.remove('is-open');
    const from = fromPanel.getBoundingClientRect();
    toPanel.classList.add('is-open');
    if (!gsap || env.reducedMotion) return;
    const to = toPanel.getBoundingClientRect();
    gsap.killTweensOf([toPanel, ...toPanel.children]);
    gsap.fromTo(
      toPanel,
      { height: from.height, width: from.width, overflow: 'hidden' },
      { height: to.height, width: to.width, duration: 0.4, ease: 'power2.inOut', clearProps: 'height,width,overflow' },
    );
    gsap.fromTo(
      toPanel.children,
      { opacity: 0, y: 10 },
      { opacity: 1, y: 0, duration: 0.3, delay: 0.15, stagger: 0.04, ease: 'power3.out', clearProps: 'opacity,transform' },
    );
  }

  function setOpen(key) {
    const previous = current;
    current = key;
    const fromPanel = previous && key && previous !== key ? panelFor(previous) : null;
    const toPanel = fromPanel && panelFor(key);
    if (fromPanel && toPanel) {
      morph(fromPanel, toPanel);
      for (const t of triggers) t.setAttribute('aria-expanded', String(t.getAttribute('data-smf-nav-trigger') === key));
      nav.classList.add('is-menu-open');
      nav.classList.remove('is-hidden');
      return;
    }
    for (const p of panels) p.classList.toggle('is-open', p.getAttribute('data-smf-megamenu') === key);
    for (const t of triggers) t.setAttribute('aria-expanded', String(t.getAttribute('data-smf-nav-trigger') === key));
    nav.classList.toggle('is-menu-open', Boolean(key));
    if (key) nav.classList.remove('is-hidden');
  }

  const isDesktop = () => window.innerWidth > 991;
  const scheduleOpen = (key) => {
    clearTimeout(closeTimer);
    clearTimeout(openTimer);
    openTimer = setTimeout(() => setOpen(key), 80);
  };
  const scheduleClose = () => {
    clearTimeout(openTimer);
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => setOpen(null), 200);
  };

  for (const t of triggers) {
    const key = t.getAttribute('data-smf-nav-trigger');
    t.addEventListener('mouseenter', () => isDesktop() && !env.touch && scheduleOpen(key));
    t.addEventListener('mouseleave', () => isDesktop() && !env.touch && scheduleClose());
    t.addEventListener('click', (event) => {
      event.preventDefault();
      clearTimeout(openTimer);
      setOpen(current === key ? null : key);
    });
    t.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setOpen(current === key ? null : key);
      }
    });
  }
  for (const p of panels) {
    p.addEventListener('mouseenter', () => isDesktop() && !env.touch && clearTimeout(closeTimer));
    p.addEventListener('mouseleave', () => isDesktop() && !env.touch && scheduleClose());
  }

  // Clic hors des panneaux (voile) ou Échap : fermeture
  document.addEventListener('click', (event) => {
    if (!current) return;
    if (event.target.closest('[data-smf-megamenu], [data-smf-nav-trigger]')) return;
    setOpen(null);
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (current) {
      const trigger = triggers.find((t) => t.getAttribute('data-smf-nav-trigger') === current);
      setOpen(null);
      trigger?.focus();
    }
    if (nav.classList.contains('is-mobile-open')) setMobile(false);
  });

  // Menu mobile
  function setMobile(open) {
    nav.classList.toggle('is-mobile-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    document.documentElement.style.overflow = open ? 'hidden' : '';
  }
  toggle?.setAttribute('aria-expanded', 'false');
  toggle?.addEventListener('click', () => setMobile(!nav.classList.contains('is-mobile-open')));
  window.addEventListener('resize', () => {
    if (isDesktop() && nav.classList.contains('is-mobile-open')) setMobile(false);
  });

  // Compacte après 80 px ; se masque en descendant, revient en remontant
  function onScroll() {
    const y = Math.max(window.scrollY, 0);
    nav.classList.toggle('is-compact', y > COMPACT_AT);
    const delta = y - lastY;
    if (Math.abs(delta) >= HIDE_DELTA) {
      const locked = current || nav.classList.contains('is-mobile-open') || nav.contains(document.activeElement);
      nav.classList.toggle('is-hidden', delta > 0 && y > COMPACT_AT * 2 && !locked);
      lastY = y;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Le focus clavier dans la nav la fait toujours revenir
  nav.addEventListener('focusin', () => nav.classList.remove('is-hidden'));
}
