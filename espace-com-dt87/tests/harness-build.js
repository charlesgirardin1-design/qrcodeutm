/* Construit tests/harness/index.html : Styles.html + fake-gas.js + Code.gs + données + App.html, comme Index.html. */
'use strict';
const fs = require('fs'), path = require('path');
const DIR = path.join(__dirname, '..'), OUT = path.join(__dirname, 'harness');
const lire = n => fs.readFileSync(path.join(DIR, n), 'utf8');
fs.mkdirSync(OUT, { recursive: true });
const INDEX = '<!DOCTYPE html>\n<html><head><base target="_top"><meta charset="utf-8"><?!= include(\'Styles\'); ?></head>\n<body><div id="app"></div><div id="modale-racine"></div><div id="toasts"></div>\n<script>window.BOOT = <?!= boot ?>;</script>\n<?!= include(\'App\'); ?></body></html>\n';
const MANIFESTE = JSON.stringify({ timeZone: 'Europe/Paris', runtimeVersion: 'V8', exceptionLogging: 'STACKDRIVER', webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE' }, oauthScopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/script.external_request', 'https://www.googleapis.com/auth/script.send_mail', 'https://www.googleapis.com/auth/script.scriptapp', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/script.projects', 'https://www.googleapis.com/auth/script.deployments'] }, null, 2);
const CONFIG_INI = JSON.stringify({ config: { identite: { code: 'DT87', nom_centre: 'Espace Com DT87', territoire: 'Haute-Vienne' }, notifications: { signature: 'Équipe com DT87 — com87@croix-rouge.fr' } }, tables: { ul: [{ nom: 'UL de Limoges', actif: 'OUI' }] } }, null, 2);
const FICHIERS = { 'Code.gs': lire('Code.gs'), 'appsscript.json': MANIFESTE, 'ConfigInitiale.html': CONFIG_INI, 'Styles.html': lire('Styles.html'), 'App.html': lire('App.html'), 'Index.html': INDEX };
fs.writeFileSync(path.join(OUT, 'fichiers.json'), JSON.stringify(FICHIERS));
fs.writeFileSync(path.join(OUT, 'fichiers.js'), 'window.__FICHIERS = ' + JSON.stringify(FICHIERS).replace(/<\/script/gi, '<\\/script') + ';');
fs.copyFileSync(path.join(__dirname, 'fake-gas.js'), path.join(OUT, 'fake-gas.js'));
fs.copyFileSync(path.join(__dirname, 'harness-setup.js'), path.join(OUT, 'setup.js'));
fs.writeFileSync(path.join(OUT, 'code.js'), FICHIERS['Code.gs']);
fs.writeFileSync(path.join(OUT, 'index.html'), '<!DOCTYPE html>\n<html><head><base target="_top"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Banc d\'essai</title>' + FICHIERS['Styles.html'] +
  '</head>\n<body><div id="app"></div><div id="modale-racine"></div><div id="toasts"></div>\n<script src="fake-gas.js"></script><script src="fichiers.js"></script><script src="code.js"></script><script src="setup.js"></script>\n' + FICHIERS['App.html'] + '</body></html>\n');
console.log('Banc d\'essai prêt : ' + path.join(OUT, 'index.html'));
