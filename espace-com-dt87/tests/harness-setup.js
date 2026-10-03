/* Banc d'essai navigateur : données de départ + pont google.script.run → fonctions de Code.gs (exécuté dans la page).
   Chargé APRÈS fake-gas.js et Code.gs, AVANT App.html. window.__FICHIERS : contenu des 6 fichiers du projet. */
(function () {
  const F = window.__FICHIERS, GAS = window.__GAS;
  const projet = () => [{ name: 'appsscript', type: 'JSON', source: F['appsscript.json'] }, { name: 'Code', type: 'SERVER_JS', source: F['Code.gs'] }, { name: 'ConfigInitiale', type: 'HTML', source: F['ConfigInitiale.html'] },
    { name: 'Styles', type: 'HTML', source: F['Styles.html'] }, { name: 'App', type: 'HTML', source: F['App.html'] }, { name: 'Index', type: 'HTML', source: F['Index.html'] }];
  GAS.projet = { head: projet(), versions: { 1: projet() }, deploiements: { [GAS.deploiementId]: { versionNumber: 1 } }, actif: true, portees: true };
  const ss = SpreadsheetApp.create('Base'); PropertiesService.getScriptProperties().setProperty('BASE_ID', ss.getId());
  Object.keys(TABLES).forEach(assurerOnglet_);
  GAS.ajouterDossier('DOSSIER_SV', 'Sauvegardes');
  DB.remplacer('configuration', [{ cle: 'config', valeur: JSON.stringify({ identite: { code: 'DT87', nom_centre: 'Espace Com DT87', territoire: 'Haute-Vienne' }, drive: { sauvegardes: 'DOSSIER_SV' }, materiel: { emails_gestion: 'gestion87@dt87.test' }, securite: { inactivite_min: 0 } }) }]);
  DB.remplacer('types', TYPES_DEFAUT.map((x, i) => ({ code: x[0], libelle: x[1], description: x[2], delai: x[3], champs: x[4], obligatoires: x[5], pole: x[6], ordre: i + 1, actif: 'OUI' })));
  DB.remplacer('ul', [{ nom: 'UL de Limoges', actif: 'OUI' }]);
  DB.ajouterPlusieurs('utilisateurs', [
    { email: 'admin@dt87.test', nom: 'Ada Admin', prenom: 'Ada', nom_famille: 'Admin', role: 'admin', actif: 'OUI', token: nouveauJeton_(), cgu_le: maintenant_() },
    { email: 'benevole@dt87.test', nom: 'Bob Bénévole', prenom: 'Bob', nom_famille: 'Bénévole', role: 'demandeur', actif: 'OUI', token: nouveauJeton_(), cgu_le: maintenant_() },
    { email: 'resp@dt87.test', nom: 'Rita Responsable', prenom: 'Rita', nom_famille: 'Responsable', role: 'communication', actif: 'OUI', token: nouveauJeton_(), cgu_le: maintenant_() }]);
  // Images de test (canvas) : grande image + vignette, couleur et numéro différents
  window.imageTest = (n, l, h, coul) => {
    const c = document.createElement('canvas'); c.width = l; c.height = h; const x = c.getContext('2d');
    x.fillStyle = coul; x.fillRect(0, 0, l, h); x.fillStyle = '#fff'; x.font = 'bold ' + Math.round(h / 3) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), l / 2, h / 2);
    return c.toDataURL('image/jpeg', .8);
  };
  const vign = d => { const i = new Image(); return d; };
  const qui = { admin: creerSession_('admin@dt87.test', 'google'), benevole: creerSession_('benevole@dt87.test', 'google') };
  const R = r => { if (!r.ok) throw new Error(r.message); return r.data; };
  const m1 = R(api_enregistrerMateriel(qui.admin, { nom: 'Tente pliante 3x3', categorie: 'Stands et signalétique', reference: 'TEN-01', localisation: 'Local de Limoges', responsable: 'resp@dt87.test', description: 'Tente rouge avec 4 murs et lestage.' })).materiel.id;
  [['#c0392b', 1], ['#2980b9', 2], ['#27ae60', 3]].forEach(x => R(api_ajouterPhotoMateriel(qui.admin, m1, { mini: imageTest(x[1], 320, 240, x[0]), grande: imageTest(x[1], 1600, 1200, x[0]), l: 1600, h: 1200 })));
  R(api_enregistrerMateriel(qui.admin, { nom: 'Kakemono', categorie: 'Stands et signalétique', photo: imageTest('K', 240, 320, '#8e44ad') }));   // ancienne photo unique
  R(api_enregistrerMateriel(qui.admin, { nom: 'Micro sans fil', categorie: 'Audiovisuel' }));   // sans photo
  window.__M1 = m1;
  // Pont google.script.run : appel asynchrone, données sérialisées (comme Google), fonctions privées (_) non exposées
  const run = (ok, ko) => new Proxy({}, { get(t, k) {
    if (k === 'withSuccessHandler') return f => run(f, ko); if (k === 'withFailureHandler') return f => run(ok, f); if (k === 'withUserObject') return () => run(ok, ko);
    if (typeof k !== 'string' || /_$/.test(k) || typeof window[k] !== 'function') return undefined;
    return function () { const a = JSON.parse(JSON.stringify(Array.from(arguments))); setTimeout(() => { let r; try { r = window[k].apply(null, a); } catch (e) { console.error('[serveur] ' + k + ' : ' + (e && e.stack || e)); return ko && ko(e); } setTimeout(() => ok && ok(r === undefined ? null : JSON.parse(JSON.stringify(r))), 5); }, 5); };
  } });
  window.google = { script: { run: run(null, null), host: { close() { } } } };
  window.BOOT = { version: VERSION_CODE, code: '', demande: '', vue: '', fiche: '', public: configPublique_() };
  const role = new URLSearchParams(location.search).get('qui') || 'admin';
  sessionStorage.setItem('centrecom_session', qui[role]);
})();
