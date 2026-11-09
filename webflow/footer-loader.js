/* SMF — chargeur du bundle (footer du site, script inline Webflow).
   Webflow refuse type="module" sur les scripts enregistrés : on injecte la balise.
   À chaque release : mettre à jour V et SRI, puis update_registered_script. */
(function () {
  var V = 'v0.9.9';
  var SRI = 'sha384-HPITyZ3HmUA4woWyY8qo+eSQ3fe2qp6qIsqNJS0MQX7XRrQgD6CM/vY/iIj5wdjS';
  var s = document.createElement('script');
  s.type = 'module';
  s.src = 'https://cdn.jsdelivr.net/gh/arnauddelpit/smf-site-scripts@' + V + '/dist/smf.js';
  s.integrity = SRI;
  s.crossOrigin = 'anonymous';
  document.body.appendChild(s);
})();
