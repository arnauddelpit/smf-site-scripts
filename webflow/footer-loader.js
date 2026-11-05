/* SMF — chargeur du bundle (footer du site, script inline Webflow).
   Webflow refuse type="module" sur les scripts enregistrés : on injecte la balise.
   À chaque release : mettre à jour V et SRI, puis update_registered_script. */
(function () {
  var V = 'v0.7.5';
  var SRI = 'sha384-LCjyuW4qGpM1TOo5V3pafdQDRfwhlgCigYnbxyikHgUykcGI1hr3AVSKphMa9TQF';
  var s = document.createElement('script');
  s.type = 'module';
  s.src = 'https://cdn.jsdelivr.net/gh/arnauddelpit/smf-site-scripts@' + V + '/dist/smf.js';
  s.integrity = SRI;
  s.crossOrigin = 'anonymous';
  document.body.appendChild(s);
})();
