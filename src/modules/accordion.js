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

  if (opening) {
    const group = groupOf(item);
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

function open(item, trigger, panel, gsap, env) {
  item.classList.add('is-open');
  trigger.setAttribute('aria-expanded', 'true');
  syncPhotos(item);
  if (env.reducedMotion) return;
  gsap.fromTo(panel, { height: 0, overflow: 'hidden' }, {
    height: 'auto',
    duration: 0.4,
    ease: 'power2.out',
    clearProps: 'height,overflow',
  });
}

function close(item, trigger, panel, gsap, env) {
  trigger.setAttribute('aria-expanded', 'false');
  if (env.reducedMotion) {
    item.classList.remove('is-open');
    return;
  }
  gsap.to(panel, {
    height: 0,
    overflow: 'hidden',
    duration: 0.3,
    ease: 'power2.inOut',
    onComplete: () => {
      item.classList.remove('is-open');
      gsap.set(panel, { clearProps: 'height,overflow' });
    },
  });
}
