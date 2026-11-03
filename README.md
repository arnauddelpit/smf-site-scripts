# smf-site-scripts

JS custom du site Social Media Family (Webflow). ES modules bundlés avec esbuild, servis par jsDelivr.

- `src/index.js` : chargeur — importe un module seulement si son attribut `data-smf-*` est présent dans la page.
- `webflow/head-consent-gtm.js` : script inline `<head>` (Consent Mode v2 + GTM), enregistré dans Webflow (`smf_consent_mode_gtm`).
- `webflow/footer-loader.js` : script inline footer (`smf_loader`). Webflow refuse `type="module"` sur les scripts enregistrés : ce loader injecte `<script type="module" integrity=… crossorigin>`.

## Release

1. `npm run build`, commit de `dist/`.
2. `git tag vX.Y.Z && git push origin main vX.Y.Z`.
3. SRI : `curl -s https://cdn.jsdelivr.net/gh/arnauddelpit/smf-site-scripts@vX.Y.Z/dist/smf.js | openssl dgst -sha384 -binary | openssl base64 -A`.
4. Mettre `V` et `SRI` à jour dans `webflow/footer-loader.js`, puis `update_registered_script` (`smf_loader`, nouvelle version) et l'appliquer au site.

Jamais d'URL `@latest`. Les chunks (`dist/chunks/`) sont chargés en relatif depuis le même tag.
