// SMF — Consent Mode v2 (tout refusé par défaut) puis GTM. Script inline Webflow, <head>.
// Renseigner GTM_ID quand Arnaud l'a fourni ; vide = GTM non chargé.
(function (w, d) {
  var GTM_ID = '';
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () { w.dataLayer.push(arguments); };
  w.gtag('consent', 'default', {
    ad_storage: 'denied',
    analytics_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  w.gtag('set', 'ads_data_redaction', true);
  w.gtag('set', 'url_passthrough', true);
  // Rejoue le choix enregistré par smf-consent (cookie smf_consent, JSON encodé).
  var m = d.cookie.match(/(?:^|; )smf_consent=([^;]*)/);
  if (m) {
    try {
      var c = JSON.parse(decodeURIComponent(m[1]));
      var mk = c.marketing ? 'granted' : 'denied';
      w.gtag('consent', 'update', {
        analytics_storage: c.analytics ? 'granted' : 'denied',
        ad_storage: mk, ad_user_data: mk, ad_personalization: mk
      });
    } catch (e) {}
  }
  if (!/^GTM-[A-Z0-9]+$/.test(GTM_ID)) return;
  w.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  var s = d.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtm.js?id=' + GTM_ID;
  d.head.appendChild(s);
})(window, document);
