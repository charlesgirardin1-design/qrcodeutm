# Tests de l'Espace Com (hors Google)

- `node tests/test-serveur.js` : charge le vrai `Code.gs` avec le simulateur `fake-gas.js` (classeur, cache, e-mails, API Apps Script) — fichiers du projet, duplication, galerie du matériel, réservations et e-mails, non-régression.
- `node tests/harness-build.js && node tests/test-interface.js` : vraie interface (App.html + Styles.html) dans Chromium (Playwright), branchée sur le vrai `Code.gs` simulé — clics, téléchargements, imports, responsive (captures dans `tests/captures/`).

Ces fichiers ne sont pas à copier dans Apps Script.
