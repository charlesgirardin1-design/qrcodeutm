/* Tests de Code.gs hors de Google : node tests/test-serveur.js (depuis le dossier espace-com-dt87).
   Charge le VRAI Code.gs dans un contexte isolé avec le simulateur fake-gas.js. */
'use strict';
process.env.TZ = 'Europe/Paris';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const DIR = path.join(__dirname, '..');
const lire = n => fs.readFileSync(path.join(DIR, n), 'utf8');
const CODE = lire('Code.gs'), APP = lire('App.html'), STYLES = lire('Styles.html');
const INDEX = '<!DOCTYPE html>\n<html><head><base target="_top"><meta charset="utf-8"><?!= include(\'Styles\'); ?></head>\n<body><div id="app"></div><div id="modale-racine"></div><div id="toasts"></div>\n<script>window.BOOT = <?!= boot ?>;</script>\n<?!= include(\'App\'); ?></body></html>\n';
const MANIFESTE = JSON.stringify({ timeZone: 'Europe/Paris', runtimeVersion: 'V8', exceptionLogging: 'STACKDRIVER', webapp: { executeAs: 'USER_DEPLOYING', access: 'ANYONE' },
  oauthScopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/script.external_request', 'https://www.googleapis.com/auth/script.send_mail', 'https://www.googleapis.com/auth/script.scriptapp', 'https://www.googleapis.com/auth/userinfo.email', 'https://www.googleapis.com/auth/script.projects', 'https://www.googleapis.com/auth/script.deployments'] }, null, 2);
const CONFIG_INI = JSON.stringify({ config: { identite: { code: 'DT87', nom_centre: 'Espace Com DT87', territoire: 'Haute-Vienne', nom_structure: 'Croix-Rouge française – Délégation territoriale de la Haute-Vienne', logo_url: 'https://drive.google.com/uc?id=LOGO87' },
  drive: { racine: 'https://drive.google.com/drive/folders/RACINE87' }, notifications: { emails_equipe: 'com87@croix-rouge.fr, dircom87@croix-rouge.fr', signature: 'L\'équipe com DT87 — contact : com87@croix-rouge.fr' },
  materiel: { emails_gestion: 'materiel87@croix-rouge.fr', categories: ['Stands', 'Audiovisuel'] }, securite: { mode: 'google', google_client_id: '123-abc.apps.googleusercontent.com', domaines: 'croix-rouge.fr' } },
  tables: { ul: [{ nom: 'UL de Limoges', actif: 'OUI' }, { nom: 'UL de Saint-Junien', actif: 'OUI' }], ressources: [{ titre: 'Charte', url: 'https://drive.google.com/file/d/CHARTE87' }] } }, null, 2);

const ctx = vm.createContext({ console: { log() { }, warn() { }, error() { }, info() { } }, TextEncoder, TextDecoder, Date, Math, JSON });
vm.runInContext(fs.readFileSync(path.join(__dirname, 'fake-gas.js'), 'utf8'), ctx, { filename: 'fake-gas.js' });
vm.runInContext(CODE, ctx, { filename: 'Code.gs' });
const R = s => vm.runInContext(s, ctx);
const GAS = ctx.__GAS;

let ok = 0, ko = 0;
function test(nom, fn) { try { fn(); ok++; console.log('  ✓ ' + nom); } catch (e) { ko++; console.log('  ✗ ' + nom + '\n      ' + (e && e.stack || e).split('\n').slice(0, 4).join('\n      ')); } }
const appel = r => { if (!r || !r.ok) throw new Error('Appel refusé : ' + JSON.stringify(r).slice(0, 400)); return r.data; };
const eq = (a, b, msg) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), msg);
const refuse = (r, motif) => { assert(r && !r.ok, 'aurait dû être refusé : ' + JSON.stringify(r).slice(0, 200)); if (motif) assert(motif.test(r.message), 'message inattendu : ' + r.message); return r.message; };

// ---------- Installation simulée ----------
const fichiersProjet = () => [
  { name: 'appsscript', type: 'JSON', source: MANIFESTE }, { name: 'Code', type: 'SERVER_JS', source: CODE }, { name: 'ConfigInitiale', type: 'HTML', source: CONFIG_INI },
  { name: 'Styles', type: 'HTML', source: STYLES }, { name: 'App', type: 'HTML', source: APP }, { name: 'Index', type: 'HTML', source: INDEX }, { name: 'Documentation', type: 'HTML', source: '<p>Guide</p>' }];
function reinitProjet() { GAS.projet = { head: fichiersProjet(), versions: { 1: fichiersProjet() }, deploiements: { [GAS.deploiementId]: { versionNumber: 1 } }, actif: true, portees: true }; }
reinitProjet();
const ss = ctx.SpreadsheetApp.create('Base'); ctx.PropertiesService.getScriptProperties().setProperty('BASE_ID', ss.getId());
R(`Object.keys(TABLES).forEach(assurerOnglet_);`);
GAS.ajouterDossier('DOSSIER_SV', 'Sauvegardes');
R(`DB.remplacer('configuration', [{ cle: 'config', valeur: JSON.stringify({ identite: { code: 'DT87', nom_centre: 'Espace Com DT87', territoire: 'Haute-Vienne' }, drive: { sauvegardes: 'DOSSIER_SV' }, materiel: { emails_gestion: 'gestion87@dt87.test' } }) }]); _CFG = null; CacheService.getScriptCache().remove('config');`);
R(`DB.ajouterPlusieurs('utilisateurs', [
  { email: 'admin@dt87.test', nom: 'Ada Admin', role: 'admin', actif: 'OUI', token: nouveauJeton_() },
  { email: 'benevole@dt87.test', nom: 'Bob Bénévole', role: 'demandeur', actif: 'OUI', token: nouveauJeton_() },
  { email: 'resp@dt87.test', nom: 'Rita Responsable', role: 'communication', actif: 'OUI', token: nouveauJeton_() }]);`);
R(`DB.remplacer('types', TYPES_DEFAUT.map((x, i) => ({ code: x[0], libelle: x[1], ordre: i + 1, actif: 'OUI' })));`);
const SID = { admin: R(`creerSession_('admin@dt87.test', 'google')`), benevole: R(`creerSession_('benevole@dt87.test', 'google')`), resp: R(`creerSession_('resp@dt87.test', 'google')`) };
const api = (qui, fn, ...args) => ctx[fn](SID[qui], ...args);

// =====================================================================
console.log('\n1. Fichiers du projet — reconnaissance et contrôles');
test('noms reconnus (y compris copies renommées)', () => {
  const cas = { 'Code.gs': 'Code.gs', 'code.gs.txt': 'Code.gs', '18dc682f-Code.gs-4.txt': 'Code.gs', 'App (1).html': 'App.html', '533aa5cb-App.html.txt': 'App.html', 'Styles.html': 'Styles.html', 'appsscript.json': 'appsscript.json',
    'Projet/ConfigInitiale.html': 'ConfigInitiale.html', 'INDEX.HTML': 'Index.html', 'photo.jpg': '', 'Code': '', 'MonApp.html': '' };
  Object.keys(cas).forEach(n => assert.strictEqual(ctx.reconnaitreNomProjet_(n), cas[n], n));
});
test('contenus reconnus sans nom', () => {
  assert.strictEqual(ctx.devinerContenuProjet_(CODE), 'Code.gs'); assert.strictEqual(ctx.devinerContenuProjet_(APP), 'App.html'); assert.strictEqual(ctx.devinerContenuProjet_(STYLES), 'Styles.html');
  assert.strictEqual(ctx.devinerContenuProjet_(INDEX), 'Index.html'); assert.strictEqual(ctx.devinerContenuProjet_(MANIFESTE), 'appsscript.json'); assert.strictEqual(ctx.devinerContenuProjet_(CONFIG_INI), 'ConfigInitiale.html');
});
test('les 6 fichiers réels passent les contrôles (syntaxe JS de Code.gs et App.html comprise)', () => {
  [['Code.gs', CODE], ['App.html', APP], ['Styles.html', STYLES], ['Index.html', INDEX], ['appsscript.json', MANIFESTE], ['ConfigInitiale.html', CONFIG_INI]].forEach(x => {
    const v = ctx.verifierFichierProjet_(x[0], x[1]); eq(Array.from(v.erreurs), [], x[0] + ' : ' + v.erreurs.join(' | ')); });
});
test('erreurs détectées : syntaxe, copie tronquée, JSON, fichiers inversés, Index sans include', () => {
  assert(ctx.verifierFichierProjet_('Code.gs', CODE.replace('function doGet(e) {', 'function doGet(e) { if (')).erreurs.some(e => /syntaxe/i.test(e)));
  assert(ctx.verifierFichierProjet_('Code.gs', CODE.slice(0, CODE.length - 300)).erreurs.some(e => /FIN DE Code\.gs/.test(e)));
  assert(ctx.verifierFichierProjet_('App.html', APP.slice(0, 200000)).erreurs.length > 0);
  assert(ctx.verifierFichierProjet_('appsscript.json', '{ "timeZone": ').erreurs.some(e => /JSON/.test(e)));
  assert(ctx.verifierFichierProjet_('Styles.html', APP).erreurs.some(e => /ressemble à App\.html/.test(e)));
  assert(ctx.verifierFichierProjet_('Index.html', '<html><body>vide</body></html>').erreurs.some(e => /include/.test(e)));
  assert(ctx.verifierFichierProjet_('ConfigInitiale.html', '').erreurs.some(e => /vide/i.test(e)));
  assert(ctx.verifierFichierProjet_('appsscript.json', JSON.stringify({ timeZone: 'Europe/Paris', runtimeVersion: 'V8', webapp: {}, oauthScopes: ['x'] })).avertissements.some(e => /script\.projects/.test(e)));
});

console.log('\n2. Export (contenu réel et complet)');
test('état : accès API, 6 fichiers présents, version en service n° 1, autres fichiers listés', () => {
  const E = appel(api('admin', 'api_projetEtat'));
  assert(E.api.ok); assert.strictEqual(E.fichiers.length, 6); assert(E.fichiers.every(f => f.present && f.lecture === 'api'));
  assert.strictEqual(E.deploiement.version, 1); eq(Array.from(E.autres), ['Documentation.html']);
  assert.strictEqual(E.fichiers.find(f => f.nom === 'Code.gs').version, '3.30.0'); assert.strictEqual(E.fichiers.find(f => f.nom === 'App.html').taille, APP.length);
});
test('export de chaque fichier : nom, extension et contenu identiques au caractère près', () => {
  const att = { 'Code.gs': CODE, 'appsscript.json': MANIFESTE, 'ConfigInitiale.html': CONFIG_INI, 'Styles.html': STYLES, 'App.html': APP, 'Index.html': INDEX };
  Object.keys(att).forEach(n => { const r = appel(api('admin', 'api_projetExporter', n, 'service')); assert.strictEqual(r.nom, n); assert.strictEqual(r.contenu, att[n], n); assert.strictEqual(r.taille, att[n].length); });
});
test('export du projet complet : archive .zip avec exactement les 6 fichiers, contenus identiques', () => {
  const z = appel(api('admin', 'api_projetExporterTout', 'service'));
  assert(/^Projet_DT87_v3\.30\.0_.*\.zip$/.test(z.nom), z.nom);
  const L = ctx.Utilities.unzip(ctx.Utilities.newBlob(ctx.Utilities.base64Decode(z.data), 'application/zip'));
  eq(L.map(b => b.getName()).sort(), ['App.html', 'Code.gs', 'ConfigInitiale.html', 'Index.html', 'Styles.html', 'appsscript.json']);
  assert.strictEqual(L.find(b => b.getName() === 'Code.gs').getDataAsString(), CODE);
  assert.strictEqual(L.find(b => b.getName() === 'App.html').getDataAsString(), APP);
});
test('export « version en service » ≠ « éditeur » quand l\'éditeur contient des modifications non publiées', () => {
  GAS.projet.head.find(f => f.name === 'Styles').source = STYLES.replace('</style>', '.essai{}\n</style>');
  const E = appel(api('admin', 'api_projetEtat')); assert(E.fichiers.find(f => f.nom === 'Styles.html').modifie_editeur);
  assert.strictEqual(appel(api('admin', 'api_projetExporter', 'Styles.html', 'service')).contenu, STYLES);
  assert(/\.essai\{\}/.test(appel(api('admin', 'api_projetExporter', 'Styles.html', 'editeur')).contenu));
  reinitProjet();
});
test('réservé aux administrateurs', () => { refuse(api('benevole', 'api_projetEtat'), /administrateurs/); refuse(api('resp', 'api_projetExporterTout'), /administrateurs/); });
test('API non activée : message précis ; HTML exportables (HtmlService), Code.gs non', () => {
  GAS.projet.actif = false;
  const E = appel(api('admin', 'api_projetEtat')); assert(!E.api.ok && /usersettings/.test(E.api.message));
  assert(E.fichiers.find(f => f.nom === 'App.html').present && E.fichiers.find(f => f.nom === 'App.html').lecture === 'html'); assert(!E.fichiers.find(f => f.nom === 'Code.gs').present);
  assert.strictEqual(appel(api('admin', 'api_projetExporter', 'App.html')).contenu, APP);
  refuse(api('admin', 'api_projetExporter', 'Code.gs'), /Impossible de lire Code\.gs/); refuse(api('admin', 'api_projetExporterTout'), /usersettings/);
  GAS.projet.actif = true; GAS.projet.portees = false;
  assert(/oauthScopes/.test(appel(api('admin', 'api_projetEtat')).api.message));
  GAS.projet.portees = true;
});

console.log('\n3. Import (vérification, confirmation, sauvegarde, remplacement, relecture)');
const six = () => [{ nom: 'Code.gs', contenu: CODE }, { nom: 'appsscript.json', contenu: MANIFESTE }, { nom: 'ConfigInitiale.html', contenu: CONFIG_INI }, { nom: 'Styles.html', contenu: STYLES }, { nom: 'App.html', contenu: APP }, { nom: 'Index.html', contenu: INDEX }];
test('analyse d\'un projet complet identique : 6/6 présents, rien à remplacer', () => {
  const A = appel(api('admin', 'api_projetAnalyser', six(), 'complet'));
  assert(A.complet && !A.bloquant && A.identique); assert.strictEqual(A.presents.length, 6); assert(A.fichiers.every(f => f._contenu === undefined));
});
test('archive .zip relue puis analysée', () => {
  const z = appel(api('admin', 'api_projetExporterTout'));
  const L = appel(api('admin', 'api_projetLireZip', z.data)); assert.strictEqual(L.length, 6);
  assert(appel(api('admin', 'api_projetAnalyser', L, 'complet')).complet);
});
test('fichiers manquants : listés, import complet refusé (rien n\'est modifié)', () => {
  const A = appel(api('admin', 'api_projetAnalyser', six().slice(0, 4), 'complet'));
  assert(!A.complet && A.bloquant); eq(Array.from(A.manquants), ['App.html', 'Index.html']);
  const avant = JSON.stringify(GAS.projet.head);
  refuse(api('admin', 'api_projetAppliquer', six().slice(0, 4), 'complet', { confirmation: 'REMPLACER' }), /manquant/);
  assert.strictEqual(JSON.stringify(GAS.projet.head), avant);
});
test('doublons et fichiers non reconnus signalés', () => {
  const A = appel(api('admin', 'api_projetAnalyser', six().concat([{ nom: 'App (1).html', contenu: APP }, { nom: 'notes.txt', contenu: 'bonjour' }]), 'complet'));
  assert(A.bloquant && A.fichiers.find(f => f.nom === 'App.html').erreurs.some(e => /Plusieurs/.test(e))); assert(A.ignores.some(x => x.nom === 'notes.txt'));
});
test('sans confirmation explicite : refusé', () => { refuse(api('admin', 'api_projetAppliquer', six(), 'complet', {}), /Confirmation/); });
const APP2 = APP.replace("const VERSION_APP = '3.30.0';", "const VERSION_APP = '3.30.0'; // import de test");
test('import d\'un seul fichier : sauvegarde Drive, remplacement, relecture identique, autres fichiers conservés, publication', () => {
  GAS.fichiersDrive.length = 0;
  const Rp = appel(api('admin', 'api_projetAppliquer', [{ nom: 'App.html', contenu: APP2 }], 'App.html', { confirmation: 'REMPLACER', publier: true }));
  eq(Rp.importes.map(f => f.nom), ['App.html']); eq(Array.from(Rp.erreurs), []);
  assert(Rp.sauvegarde && /^Projet_avant-import_DT87/.test(Rp.sauvegarde.nom));
  const sv = GAS.fichiersDrive[0]; const L = ctx.Utilities.unzip(sv.blob); assert.strictEqual(L.length, 7); assert.strictEqual(L.find(b => b.getName() === 'App.html').getDataAsString(), APP);
  assert.strictEqual(GAS.projet.head.find(f => f.name === 'App').source, APP2); assert.strictEqual(GAS.projet.head.find(f => f.name === 'Code').source, CODE);
  assert(GAS.projet.head.some(f => f.name === 'Documentation')); eq(Array.from(Rp.autres_conserves), ['Documentation']);
  assert(Rp.publication.ok && Rp.publication.version === 2); assert.strictEqual(GAS.projet.deploiements[GAS.deploiementId].versionNumber, 2);
  assert.strictEqual(ctx.HtmlService.createHtmlOutputFromFile('App').getContent(), APP2);
});
test('import complet : les fichiers identiques ne sont pas réécrits', () => {
  const Rp = appel(api('admin', 'api_projetAppliquer', six(), 'complet', { confirmation: 'REMPLACER' }));
  eq(Rp.importes.map(f => f.nom), ['App.html']); assert.strictEqual(Rp.inchanges.length, 5);
  assert.strictEqual(GAS.projet.head.find(f => f.name === 'App').source, APP);
});
test('versions Code.gs / App.html différentes : avertissement à accepter', () => {
  const APP9 = APP.replace("const VERSION_APP = '3.30.0';", "const VERSION_APP = '9.9.9';").replace('FIN DE App.html — version 3.30.0', 'FIN DE App.html — version 9.9.9');
  const A = appel(api('admin', 'api_projetAnalyser', [{ nom: 'App.html', contenu: APP9 }], 'App.html'));
  assert(!A.bloquant && A.fichiers[0].avertissements.some(e => /Versions différentes/.test(e)));
  refuse(api('admin', 'api_projetAppliquer', [{ nom: 'App.html', contenu: APP9 }], 'App.html', { confirmation: 'REMPLACER' }), /avertissements/);
  assert(appel(api('admin', 'api_projetAnalyser', six().map(f => f.nom === 'App.html' ? { nom: 'App.html', contenu: APP9 } : f), 'complet')).bloquant, 'bloquant en import complet');
});
test('fichier inversé ou erroné : import refusé', () => {
  refuse(api('admin', 'api_projetAppliquer', [{ nom: 'Styles.html', contenu: APP }], 'Styles.html', { confirmation: 'REMPLACER' }), /refusé/);
  refuse(api('admin', 'api_projetAppliquer', [{ nom: 'Code.gs', contenu: CODE.replace('function doGet(e) {', 'function doGet(e) { if (') }], 'Code.gs', { confirmation: 'REMPLACER' }), /syntaxe/);
});
test('Drive indisponible : refus sans sauvegarde locale, accepté après téléchargement du projet', () => {
  R(`DB.remplacer('configuration', [{ cle: 'config', valeur: JSON.stringify({ identite: { code: 'DT87', nom_centre: 'Espace Com DT87', territoire: 'Haute-Vienne' }, drive: { sauvegardes: 'ABSENT' }, materiel: { emails_gestion: 'gestion87@dt87.test' } }) }]); _CFG = null; CacheService.getScriptCache().remove('config'); for (const k in DOSSIERS_EXEC) delete DOSSIERS_EXEC[k];`);
  refuse(api('admin', 'api_projetAppliquer', [{ nom: 'App.html', contenu: APP2 }], 'App.html', { confirmation: 'REMPLACER' }), /Sauvegarde du projet actuel impossible/);
  assert.strictEqual(GAS.projet.head.find(f => f.name === 'App').source, APP);
  const Rp = appel(api('admin', 'api_projetAppliquer', [{ nom: 'App.html', contenu: APP2 }], 'App.html', { confirmation: 'REMPLACER', sauvegarde_locale: true }));
  assert(Rp.sauvegarde.locale && Rp.importes.length === 1);
  R(`DB.remplacer('configuration', [{ cle: 'config', valeur: JSON.stringify({ identite: { code: 'DT87', nom_centre: 'Espace Com DT87', territoire: 'Haute-Vienne' }, drive: { sauvegardes: 'DOSSIER_SV' }, materiel: { emails_gestion: 'gestion87@dt87.test' } }) }]); _CFG = null; CacheService.getScriptCache().remove('config'); for (const k in DOSSIERS_EXEC) delete DOSSIERS_EXEC[k];`);
  reinitProjet();
});
test('Code.gs sous un autre nom dans le projet (fichier .gs unique) : remplacé à sa place, sans doublon', () => {
  GAS.projet.head.find(f => f.name === 'Code').name = 'Principal';
  const CODE2 = CODE.replace("const VERSION_SCHEMA = 4;", "const VERSION_SCHEMA = 4; // test");
  appel(api('admin', 'api_projetAppliquer', [{ nom: 'Code.gs', contenu: CODE2 }], 'Code.gs', { confirmation: 'REMPLACER' }));
  const srv = GAS.projet.head.filter(f => f.type === 'SERVER_JS'); assert.strictEqual(srv.length, 1); assert.strictEqual(srv[0].name, 'Principal'); assert.strictEqual(srv[0].source, CODE2);
  reinitProjet();
});

console.log('\n4. Duplication pour une autre délégation');
test('projet préparé pour DT09 : 6 fichiers, code identique, ConfigInitiale sans données DT87', () => {
  const r = appel(api('admin', 'api_projetNouvelleDT', { code: 'DT09', nom_centre: 'Espace Com DT09', territoire: 'Ariège', ul: 'UL de Foix\nUL de Pamiers\n', drive_racine: 'https://drive.google.com/drive/folders/RACINE09' }));
  const L = ctx.Utilities.unzip(ctx.Utilities.newBlob(ctx.Utilities.base64Decode(r.data)));
  eq(L.map(b => b.getName()).sort(), ['App.html', 'Code.gs', 'ConfigInitiale.html', 'Index.html', 'Styles.html', 'appsscript.json']);
  ['Code.gs', 'App.html', 'Styles.html', 'Index.html', 'appsscript.json'].forEach(n => assert.strictEqual(L.find(b => b.getName() === n).getDataAsString(), { 'Code.gs': CODE, 'App.html': APP, 'Styles.html': STYLES, 'Index.html': INDEX, 'appsscript.json': MANIFESTE }[n], n));
  const ci = L.find(b => b.getName() === 'ConfigInitiale.html').getDataAsString(), o = JSON.parse(ci);
  assert.strictEqual(o.config.identite.code, 'DT09'); assert.strictEqual(o.config.identite.nom_centre, 'Espace Com DT09'); assert.strictEqual(o.config.drive.racine, 'https://drive.google.com/drive/folders/RACINE09');
  eq(o.tables.ul.map(x => x.nom), ['UL de Foix', 'UL de Pamiers']); assert(!o.tables.ressources && !o.tables.utilisateurs);
  assert(!/87/.test(ci), 'mention de 87 restante : ' + ci.split('\n').filter(l => /87/.test(l)).join(' / ')); assert(!/Limoges|Haute-Vienne|RACINE87|CHARTE87|LOGO87/.test(ci)); assert(!/@croix-rouge\.fr/.test(ci));
  assert.strictEqual(o.config.securite.google_client_id, ''); assert.strictEqual(o.config.securite.domaines, 'croix-rouge.fr');
  assert.strictEqual(o.config.materiel.emails_gestion, ''); eq(o.config.materiel.categories, ['Stands', 'Audiovisuel']);
  assert(/\[adresse à compléter\]/.test(o.config.notifications.signature));
  eq(Array.from(ctx.verifierFichierProjet_('ConfigInitiale.html', ci).erreurs), []);
});
test('reprise des réglages actuels : toujours sans identité ni Drive DT87', () => {
  const r = appel(api('admin', 'api_projetNouvelleDT', { code: 'DT09', reglages_actuels: true }));
  const o = JSON.parse(r.config_initiale); assert.strictEqual(o.config.identite.code, 'DT09'); assert.strictEqual(o.config.drive.racine, ''); assert(!/DOSSIER_SV|gestion87/.test(r.config_initiale));
  assert(o.tables.types && o.tables.types.length > 0);
});
test('code invalide ou identique à la DT actuelle : refusé', () => {
  refuse(api('admin', 'api_projetNouvelleDT', { code: 'x' }), /invalide/); refuse(api('admin', 'api_projetNouvelleDT', { code: 'dt87' }), /NOUVELLE/);
});

console.log('\n5. Matériel : galerie de photos');
const jpeg = n => 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ' + 'A'.repeat(Math.max(0, n - 41));
let MID;
test('création du matériel avec une ancienne photo unique (format avant 3.30)', () => {
  const r = appel(api('admin', 'api_enregistrerMateriel', { nom: 'Tente 3x3', categorie: 'Stands et signalétique', responsable: 'resp@dt87.test', photo: jpeg(3000) }));
  MID = r.materiel.id; assert.strictEqual(r.materiel.nb_photos, 1);
  const P = appel(api('benevole', 'api_photosMateriel', MID)).photos; assert.strictEqual(P.length, 1); assert.strictEqual(P[0].pid, 'ancienne');
  assert.strictEqual(appel(api('benevole', 'api_photoMateriel', MID, 'ancienne')).grande, jpeg(3000));
});
let P1, P2;
test('ajout d\'une photo : l\'ancienne est reprise en principale, la nouvelle ajoutée (grande image > 1 cellule)', () => {
  const g = jpeg(150000), r = appel(api('admin', 'api_ajouterPhotoMateriel', MID, { mini: jpeg(20000), grande: g, l: 1600, h: 1200 }));
  assert.strictEqual(r.photos.length, 2); assert.strictEqual(r.photos[0].mini, jpeg(3000)); assert.strictEqual(r.photos[1].mini, jpeg(20000)); assert.strictEqual(r.materiel.nb_photos, 2);
  P1 = r.photos[0].pid; P2 = r.photos[1].pid; assert(P1 !== 'ancienne');
  assert.strictEqual(appel(api('benevole', 'api_photoMateriel', MID, P2)).grande, g, 'grande image reconstituée');
  assert.strictEqual(appel(api('benevole', 'api_photoMateriel', MID, P1)).grande, jpeg(3000), 'sans grande image : vignette');
});
test('choisir la photo principale (réordonner) : catalogue mis à jour', () => {
  const r = appel(api('admin', 'api_organiserPhotosMateriel', MID, [P2, P1]));
  eq(r.photos.map(p => p.pid), [P2, P1]); assert.strictEqual(r.materiel.photo, jpeg(20000));
  const it = appel(api('benevole', 'api_materiel')).items.find(m => m.id === MID); assert.strictEqual(it.photo, jpeg(20000)); assert.strictEqual(it.nb_photos, 2);
});
test('nombre libre de photos (12) et ordre conservé', () => {
  for (let k = 0; k < 10; k++) appel(api('admin', 'api_ajouterPhotoMateriel', MID, { mini: jpeg(1000 + k), grande: jpeg(60000 + k) }));
  const P = appel(api('benevole', 'api_photosMateriel', MID)).photos; assert.strictEqual(P.length, 12); assert.strictEqual(P[2].mini, jpeg(1000)); assert.strictEqual(P[11].mini, jpeg(1009));
  const inv = P.map(p => p.pid).reverse(); const r = appel(api('admin', 'api_organiserPhotosMateriel', MID, inv));
  eq(r.photos.map(p => p.pid), inv); assert.strictEqual(r.materiel.photo, jpeg(1009));
  assert.strictEqual(appel(api('benevole', 'api_materiel')).items.find(m => m.id === MID).nb_photos, 12);
});
test('liste périmée refusée (aucune modification)', () => { refuse(api('admin', 'api_organiserPhotosMateriel', MID, [P1, P2]), /modifiées entre-temps/); });
test('suppression : la suivante devient principale ; toutes supprimées → plus de photo', () => {
  let P = appel(api('benevole', 'api_photosMateriel', MID)).photos;
  const r = appel(api('admin', 'api_supprimerPhotoMateriel', MID, P[0].pid)); assert.strictEqual(r.photos.length, 11); assert.strictEqual(r.materiel.photo, P[1].mini);
  refuse(api('admin', 'api_supprimerPhotoMateriel', MID, P[0].pid), /déjà été supprimée/);
  r.photos.forEach(p => appel(api('admin', 'api_supprimerPhotoMateriel', MID, p.pid)));
  const it = appel(api('benevole', 'api_materiel')).items.find(m => m.id === MID); assert(!it.photo); assert.strictEqual(it.nb_photos, 0);
  assert.strictEqual(appel(api('benevole', 'api_photosMateriel', MID)).photos.length, 0);
});
test('contrôles : image invalide, droits, matériel inconnu ; deux matériels indépendants', () => {
  refuse(api('admin', 'api_ajouterPhotoMateriel', MID, { mini: 'data:image/gif;base64,R0lGODlh' }), /Photo invalide/);
  refuse(api('admin', 'api_ajouterPhotoMateriel', MID, { mini: 'data:image/jpeg;base64,' + 'A'.repeat(500) }), /Photo invalide/);
  refuse(api('benevole', 'api_ajouterPhotoMateriel', MID, { mini: jpeg(500) }), /rôle/);
  refuse(api('admin', 'api_ajouterPhotoMateriel', 'M-inconnu', { mini: jpeg(500) }), /n'existe plus/);
  const m2 = appel(api('admin', 'api_enregistrerMateriel', { nom: 'Vidéoprojecteur' })).materiel.id;
  appel(api('admin', 'api_ajouterPhotoMateriel', m2, { mini: jpeg(700) })); appel(api('admin', 'api_ajouterPhotoMateriel', MID, { mini: jpeg(800) }));
  assert.strictEqual(appel(api('benevole', 'api_photosMateriel', m2)).photos.length, 1); assert.strictEqual(appel(api('benevole', 'api_photosMateriel', MID)).photos[0].mini, jpeg(800));
});
test('enregistrer la fiche sans toucher aux photos les conserve', () => {
  const avant = appel(api('benevole', 'api_photosMateriel', MID)).photos.length;
  const e = appel(api('admin', 'api_enregistrerMateriel', { id: MID, nom: 'Tente 3x3 (rouge)', responsable: 'resp@dt87.test' }));
  assert.strictEqual(e.materiel.nb_photos, avant, 'nombre de photos renvoyé après enregistrement');
  assert.strictEqual(appel(api('admin', 'api_etatMateriel', MID, 'desactiver', '')).materiel.nb_photos, avant); appel(api('admin', 'api_etatMateriel', MID, 'reactiver', ''));
  assert.strictEqual(appel(api('benevole', 'api_photosMateriel', MID)).photos.length, avant);
});

console.log('\n6. Réservations et e-mails');
const jour = d => { const x = new Date(); x.setDate(x.getDate() + d); return ctx.Utilities.formatDate(x, '', 'yyyy-MM-dd'); };
let RID;
test('création : e-mail au demandeur + e-mail à la gestion ET au responsable du matériel', () => {
  GAS.mails.length = 0;
  const r = appel(api('benevole', 'api_reserver', { materiel_id: MID, journee: true, debut: jour(3), fin: jour(4), lieu: 'Forum des associations', commentaire: 'Merci' }));
  RID = r.id; assert.strictEqual(r.statut, 'attente');
  const a = GAS.mails.map(m => m.to).sort(); eq(a, ['benevole@dt87.test', 'gestion87@dt87.test', 'resp@dt87.test']);
  const g = GAS.mails.find(m => m.to === 'resp@dt87.test'); assert(/Demandeur/.test(g.htmlBody) && /benevole@dt87\.test/.test(g.htmlBody) && /N° de réservation/.test(g.htmlBody) && /Merci/.test(g.htmlBody));
  assert(/reçue/i.test(GAS.mails.find(m => m.to === 'benevole@dt87.test').subject));
});
test('validation, modification, annulation : e-mails existants conservés', () => {
  GAS.mails.length = 0; appel(api('admin', 'api_actionReservation', RID, 'confirmer', ''));
  eq(GAS.mails.map(m => m.to), ['benevole@dt87.test']); assert(/confirmée/i.test(GAS.mails[0].subject));
  GAS.mails.length = 0; appel(api('admin', 'api_modifierReservation', RID, { journee: true, debut: jour(5), fin: jour(5) }));
  eq(GAS.mails.map(m => m.to), ['benevole@dt87.test']); assert(/modifiée/i.test(GAS.mails[0].subject));
  GAS.mails.length = 0; appel(api('benevole', 'api_actionReservation', RID, 'annuler', ''));
  eq(GAS.mails.map(m => m.to).sort(), ['gestion87@dt87.test', 'resp@dt87.test']); assert(/annulée/i.test(GAS.mails[0].subject));
});
test('refus : motif obligatoire, e-mail au demandeur', () => {
  const r = appel(api('benevole', 'api_reserver', { materiel_id: MID, journee: true, debut: jour(8), fin: jour(8), lieu: 'Collecte' }));
  refuse(api('admin', 'api_actionReservation', r.id, 'refuser', ''), /motif/);
  GAS.mails.length = 0; appel(api('admin', 'api_actionReservation', r.id, 'refuser', 'Déjà prêtée'));
  eq(GAS.mails.map(m => m.to), ['benevole@dt87.test']); assert(/Déjà prêtée/.test(GAS.mails[0].htmlBody));
});
test('sans destinataires réglés ni responsable : les gestionnaires sont prévenus', () => {
  R(`DB.remplacer('configuration', [{ cle: 'config', valeur: JSON.stringify({ identite: { code: 'DT87' }, drive: { sauvegardes: 'DOSSIER_SV' } }) }]); _CFG = null; CacheService.getScriptCache().remove('config');`);
  const m3 = appel(api('admin', 'api_enregistrerMateriel', { nom: 'Kakemono' })).materiel.id;
  GAS.mails.length = 0; appel(api('benevole', 'api_reserver', { materiel_id: m3, journee: true, debut: jour(2), fin: jour(2), lieu: 'Salon' }));
  const d = GAS.mails.map(m => m.to).sort(); assert(d.indexOf('admin@dt87.test') > -1 && d.indexOf('resp@dt87.test') > -1 && d.indexOf('benevole@dt87.test') > -1, d.join(','));
});
test('conflit de période toujours refusé', () => {
  const r = appel(api('benevole', 'api_reserver', { materiel_id: MID, journee: true, debut: jour(10), fin: jour(11), lieu: 'A' }));
  refuse(api('resp', 'api_reserver', { materiel_id: MID, journee: true, debut: jour(11), fin: jour(12), lieu: 'B' }), /déjà réservé/);
  appel(api('benevole', 'api_actionReservation', r.id, 'annuler', ''));
});

console.log('\n7. Non-régression : interface ↔ serveur, lectures principales');
test('toutes les fonctions serveur appelées par App.html existent dans Code.gs', () => {
  const appels = {}; (APP.match(/api\('(api_\w+)'/g) || []).forEach(m => appels[m.slice(5, -1)] = 1); (APP.match(/\.(api_\w+)\(/g) || []).forEach(m => appels[m.slice(1, -1)] = 1);
  const manquantes = Object.keys(appels).filter(f => typeof ctx[f] !== 'function'); eq(manquantes, []);
  ['api_projetEtat', 'api_projetExporter', 'api_projetExporterTout', 'api_projetLireZip', 'api_projetAnalyser', 'api_projetAppliquer', 'api_projetNouvelleDT', 'api_photosMateriel', 'api_photoMateriel', 'api_ajouterPhotoMateriel', 'api_organiserPhotosMateriel', 'api_supprimerPhotoMateriel'].forEach(f => assert(appels[f], f + ' non appelée par l\'interface'));
});
test('versions identiques (Code.gs, App.html, Styles.html)', () => {
  assert.strictEqual(R('VERSION_CODE'), '3.30.0'); assert(/const VERSION_APP = '3\.30\.0'/.test(APP)); assert(/FIN DE App\.html — version 3\.30\.0/.test(APP)); assert(/FIN DE Styles\.html — version 3\.30\.0/.test(STYLES)); assert(/FIN DE Code\.gs — version 3\.30\.0/.test(CODE));
});
test('connexion, tableau de bord, administration, matériel, réservations : lectures sans erreur', () => {
  ['admin', 'benevole', 'resp'].forEach(q => { appel(api(q, 'api_session')); appel(api(q, 'api_demarrage', true)); appel(api(q, 'api_materiel')); appel(api(q, 'api_mesReservations', {})); appel(api(q, 'api_planning', jour(0), jour(20), '')); });
  appel(api('admin', 'api_admin')); appel(api('admin', 'api_reservations', {})); appel(api('admin', 'api_journal'));
});
test('journal : export, import, publication et photos tracés', () => {
  const J = appel(api('admin', 'api_journal')).map(j => j.evenement);
  ['projet_export', 'projet_import', 'projet_publication', 'materiel_photos', 'reservation_creee'].forEach(e => assert(J.indexOf(e) > -1, e));
});
test('onglet « Galerie du matériel » créé à la volée s\'il manque', () => {
  const s2 = ctx.SpreadsheetApp.openById(ctx.PropertiesService.getScriptProperties().getProperty('BASE_ID')); s2.deleteSheet(s2.getSheetByName('Galerie du matériel'));
  assert.strictEqual(appel(api('benevole', 'api_photosMateriel', MID)).photos.length, 1, 'repli sur la photo du catalogue'); assert(s2.getSheetByName('Galerie du matériel'));
});

console.log('\n' + ok + ' test(s) réussi(s), ' + ko + ' échec(s).');
process.exit(ko ? 1 : 0);
