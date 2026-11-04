/**
 * smf-consent — bandeau et préférences cookies (docs/integrations.md).
 * Éléments : [smf-consent-element] = root | banner | preferences | allow | deny | submit | open-preferences | close ;
 * cases [smf-consent-checkbox] = analytics | marketing ; scripts bloqués : <script type="smf-consent" smf-consent-category="…">.
 * Choix stocké 6 mois dans le cookie smf_consent (JSON {analytics, marketing}) ; Consent Mode v2 mis à jour
 * (gtag) + événement dataLayer smf_consent_update. « Tout accepter » et « Tout refuser » ont le même poids.
 * Le <head> (head-consent-gtm.js) rejoue le choix enregistré avant le chargement de GTM.
 */
const COOKIE = 'smf_consent';
const MAX_AGE = 60 * 60 * 24 * 183; // ≈ 6 mois
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

function readConsent() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=([^;]*)`));
  if (!match) return null;
  try {
    const value = JSON.parse(decodeURIComponent(match[1]));
    return { analytics: Boolean(value.analytics), marketing: Boolean(value.marketing) };
  } catch {
    return null;
  }
}

function writeConsent(choice) {
  const value = encodeURIComponent(JSON.stringify(choice));
  document.cookie = `${COOKIE}=${value}; max-age=${MAX_AGE}; path=/; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}

function applyConsent(choice) {
  const marketing = choice.marketing ? 'granted' : 'denied';
  window.dataLayer = window.dataLayer || [];
  const gtag = window.gtag || function () { window.dataLayer.push(arguments); };
  gtag('consent', 'update', {
    analytics_storage: choice.analytics ? 'granted' : 'denied',
    ad_storage: marketing,
    ad_user_data: marketing,
    ad_personalization: marketing,
  });
  window.dataLayer.push({ event: 'smf_consent_update', smf_consent: { analytics: choice.analytics, marketing: choice.marketing } });
  unblockScripts(choice);
}

function unblockScripts(choice) {
  for (const blocked of document.querySelectorAll('script[type="smf-consent"]')) {
    const category = blocked.getAttribute('smf-consent-category');
    if (!choice[category]) continue;
    const script = document.createElement('script');
    for (const { name, value } of blocked.attributes) {
      if (name !== 'type' && name !== 'smf-consent-category') script.setAttribute(name, value);
    }
    script.text = blocked.text;
    blocked.replaceWith(script);
  }
}

export function init([root]) {
  const q = (name) => document.querySelector(`[smf-consent-element="${name}"]`);
  const all = (name) => [...document.querySelectorAll(`[smf-consent-element="${name}"]`)];
  const banner = q('banner');
  const preferences = q('preferences');
  if (!banner || !preferences) return;

  banner.setAttribute('role', 'region');
  banner.setAttribute('aria-label', 'Cookies');
  preferences.setAttribute('role', 'dialog');
  preferences.setAttribute('aria-modal', 'true');
  preferences.setAttribute('aria-label', 'Préférences de cookies');

  const checkboxes = {
    analytics: root.querySelector('[smf-consent-checkbox="analytics"]') || document.querySelector('[smf-consent-checkbox="analytics"]'),
    marketing: root.querySelector('[smf-consent-checkbox="marketing"]') || document.querySelector('[smf-consent-checkbox="marketing"]'),
  };
  const input = (box) => (box?.matches('input') ? box : box?.querySelector('input'));

  let lastFocus = null;
  const closePreferences = () => {
    preferences.classList.remove('is-open');
    document.removeEventListener('keydown', onKeydown, true);
    lastFocus?.focus?.();
  };
  const onKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePreferences();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = [...preferences.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };
  const openPreferences = () => {
    lastFocus = document.activeElement;
    const current = readConsent() || { analytics: false, marketing: false };
    for (const key of ['analytics', 'marketing']) {
      const el = input(checkboxes[key]);
      if (el) el.checked = current[key];
    }
    preferences.classList.add('is-open');
    (preferences.querySelector(FOCUSABLE))?.focus();
    document.addEventListener('keydown', onKeydown, true);
  };

  const save = (choice) => {
    writeConsent(choice);
    applyConsent(choice);
    banner.classList.remove('is-open');
    preferences.classList.remove('is-open');
    document.removeEventListener('keydown', onKeydown, true);
    window.dispatchEvent(new CustomEvent('smf:consent', { detail: choice }));
  };

  const bind = (name, handler) => {
    for (const el of all(name)) {
      el.addEventListener('click', (event) => {
        event.preventDefault();
        handler();
      });
    }
  };
  bind('allow', () => save({ analytics: true, marketing: true }));
  bind('deny', () => save({ analytics: false, marketing: false }));
  bind('submit', () =>
    save({ analytics: Boolean(input(checkboxes.analytics)?.checked), marketing: Boolean(input(checkboxes.marketing)?.checked) }),
  );
  bind('open-preferences', openPreferences);
  bind('close', closePreferences);
  // Réouverture depuis le footer (« Gestion des cookies »)
  for (const el of document.querySelectorAll('[data-smf-consent-open]')) {
    el.addEventListener('click', (event) => {
      event.preventDefault();
      openPreferences();
    });
  }

  const saved = readConsent();
  if (saved) unblockScripts(saved);
  else banner.classList.add('is-open');
}
