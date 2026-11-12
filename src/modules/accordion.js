/**
 * G9 — Accordéons (FAQ, services) : data-smf-accordion sur l'item, data-smf-accordion-trigger (bouton)
 * et data-smf-accordion-panel (région). État = classe .is-open sur l'item (le CSS global affiche le panneau).
 * Un seul item ouvert à la fois dans un groupe : [data-smf-faq] ou [data-smf-accordion-group="single"].
 */
let uid = 0;

export function init(items, { gsap, env }) {
  for (const item of items) {
    const trigger = item.querySelector('[data-smf-accordion-trigger]');
    const panel = item.querySelector('[data-smf-accordion-panel]');
    if (!trigger || !panel) continue;

    const key = `smf-acc-${++uid}`;
    panel.id = panel.id || `${key}-panel`;
    trigger.id = trigger.id || `${key}-trigger`;
    trigger.setAttribute('aria-controls', panel.id);
    trigger.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-labelledby', trigger.id);

    trigger.addEventListener('click', () => toggle(item, trigger, panel, gsap, env));
  }

  // Accordéons « un seul ouvert » (services) : le premier est ouvert au chargement, avec sa photo (Figma).
  const done = new Set();
  for (const item of items) {
    const group = item.closest('[data-smf-accordion-group="single"]');
    if (!group || done.has(group)) continue;
    done.add(group);
    if (group.querySelector('[data-smf-accordion].is-open')) continue;
    const first = group.querySelector('[data-smf-accordion]');
    const t = first?.querySelector('[data-smf-accordion-trigger]');
    if (!first || !t) continue;
    first.classList.add('is-open');
    t.setAttribute('aria-expanded', 'true');
    syncPhotos(first);
  }
}

/** Photos associées (data-smf-accordion-photo="i") : la photo de l'item ouvert passe en .is-active. */
function syncPhotos(item) {
  const group = item.closest('[data-smf-accordion-group="single"]');
  if (!group) return;
  const index = [...group.querySelectorAll('[data-smf-accordion]')].indexOf(item);
  for (const photo of group.querySelectorAll('[data-smf-accordion-photo]')) {
    photo.classList.toggle('is-active', Number(photo.getAttribute('data-smf-accordion-photo')) === index);
  }
}

function groupOf(item) {
  return item.closest('[data-smf-faq], [data-smf-accordion-group="single"]');
}

function toggle(item, trigger, panel, gsap, env) {
  const opening = !item.classList.contains('is-open');
  const group = groupOf(item);
  lockHeight(group);

  if (opening) {
    if (group) {
      for (const other of group.querySelectorAll('[data-smf-accordion].is-open')) {
        if (other === item) continue;
        const t = other.querySelector('[data-smf-accordion-trigger]');
        const p = other.querySelector('[data-smf-accordion-panel]');
        if (t && p) close(other, t, p, gsap, env);
      }
    }
    open(item, trigger, panel, gsap, env);
  } else {
    close(item, trigger, panel, gsap, env);
  }
}

/**
 * Fige la hauteur du groupe pendant les animations : sans cela la somme (panneau qui se ferme + panneau qui s'ouvre)
 * passe brièvement par un minimum et les photos (object-fit: cover, 100 % de hauteur) se redimensionnent
 * (« scale down puis up »). La hauteur est recalculée à chaque clic et libérée au redimensionnement.
 */
function lockHeight(group) {
  if (!group || !group.matches('[data-smf-accordion-group="single"]')) return;
  group.style.minHeight = '';
  group.style.minHeight = `${Math.round(group.getBoundingClientRect().height)}px`;
  if (!group._smfResize) {
    group._smfResize = true;
    window.addEventListener('resize', () => { group.style.minHeight = ''; }, { passive: true });
  }
}

const DURATION = 0.4;
const EASE = 'power2.inOut';

function open(item, trigger, panel, gsap, env) {
  item.classList.add('is-open');
  trigger.setAttribute('aria-expanded', 'true');
  syncPhotos(item);
  gsap.killTweensOf(panel);
  gsap.set(panel, { clearProps: 'height,overflow,display,paddingTop,paddingBottom' });
  if (env.reducedMotion) return;
  // Hauteur finale mesurée en px (et non 'auto') : avec box-sizing border-box, GSAP mesurait 'auto' sans le padding
  // (déjà ramené à 0), l'animation finissait donc trop courte et le panneau « sautait » au retrait des styles inline.
  const cs = getComputedStyle(panel);
  const { paddingTop, paddingBottom } = cs;
  const full = panel.getBoundingClientRect().height;
  const target = cs.boxSizing === 'border-box' ? full : full - parseFloat(paddingTop) - parseFloat(paddingBottom);
  gsap.fromTo(panel, { height: 0, paddingTop: 0, paddingBottom: 0, overflow: 'hidden' }, {
    height: target,
    paddingTop,
    paddingBottom,
    duration: DURATION,
    ease: EASE,
    clearProps: 'height,overflow,paddingTop,paddingBottom',
  });
}

function close(item, trigger, panel, gsap, env) {
  // L'état logique change tout de suite (clics rapides, clavier) ; le panneau reste affiché le temps de l'animation.
  const shown = getComputedStyle(panel).display;
  item.classList.remove('is-open');
  trigger.setAttribute('aria-expanded', 'false');
  gsap.killTweensOf(panel);
  if (env.reducedMotion) {
    gsap.set(panel, { clearProps: 'height,overflow,display,paddingTop,paddingBottom' });
    return;
  }
  gsap.set(panel, { display: shown === 'none' ? 'block' : shown, overflow: 'hidden' });
  gsap.to(panel, {
    height: 0,
    paddingTop: 0,
    paddingBottom: 0,
    duration: DURATION,
    ease: EASE,
    onComplete: () => gsap.set(panel, { clearProps: 'height,overflow,display,paddingTop,paddingBottom' }),
  });
}
