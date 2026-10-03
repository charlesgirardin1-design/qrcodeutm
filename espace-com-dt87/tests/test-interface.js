/* Tests de bout en bout dans Chromium : vraie interface (App.html, Styles.html) + vrai Code.gs (simulé par fake-gas.js).
   node tests/harness-build.js && node tests/test-interface.js [dossier-captures] */
'use strict';
const { chromium } = require(process.env.PLAYWRIGHT || '/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const CAP = process.argv[2] || path.join(__dirname, 'captures'); fs.mkdirSync(CAP, { recursive: true });
const URL0 = 'file://' + path.join(__dirname, 'harness/index.html');
const FICHIERS = JSON.parse(fs.readFileSync(path.join(__dirname, 'harness/fichiers.json'), 'utf8'));
const z = vm.createContext({ TextEncoder, TextDecoder }); vm.runInContext(fs.readFileSync(path.join(__dirname, 'fake-gas.js'), 'utf8'), z);
const unzip = buf => z.Utilities.unzip(z.Utilities.newBlob(Array.from(buf), 'application/zip')).map(b => ({ nom: b.getName(), contenu: b.getDataAsString() }));

let ok = 0, ko = 0;
async function test(nom, fn) { try { await fn(); ok++; console.log('  ✓ ' + nom); } catch (e) { ko++; console.log('  ✗ ' + nom + '\n      ' + String(e && e.stack || e).split('\n').slice(0, 5).join('\n      ')); } }

(async () => {
  const nav = await chromium.launch();
  const ouvrir = async (qui, vp) => {
    const ctx = await nav.newContext({ viewport: vp || { width: 1280, height: 900 }, acceptDownloads: true });
    const p = await ctx.newPage(); p.erreurs = [];
    p.on('pageerror', e => p.erreurs.push(e.message)); p.on('console', m => { if (m.type() === 'error' && !/ERR_CERT|Failed to load resource/.test(m.text())) p.erreurs.push(m.text().slice(0, 300)); });
    p.on('dialog', d => d.accept());
    await p.goto(URL0 + '?qui=' + (qui || 'admin')); await p.waitForSelector('.coque, nav, aside', { timeout: 20000 }); await p.waitForTimeout(800);
    return p;
  };
  const aller = async (p, vue) => { await p.evaluate(v => window.CentreCom.go(v), vue); await p.waitForTimeout(700); };
  const pasDeDebord = async p => { const d = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); assert(d[0] <= d[1] + 1, 'défilement horizontal : ' + d.join(' > ')); };
  const telecharger = async (p, clic) => { const [d] = await Promise.all([p.waitForEvent('download'), clic()]); const f = await d.path(); return { nom: d.suggestedFilename(), buf: fs.readFileSync(f) }; };
  const imageFichier = async (p, n, coul, l, h) => { const d = await p.evaluate(a => window.imageTest(a[0], a[2], a[3], a[1]), [n, coul, l || 1200, h || 900]); return { name: 'photo-' + n + '.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(d.split(',')[1], 'base64') }; };

  console.log('\n1. Connexion et navigation (non-régression)');
  const p = await ouvrir('admin');
  await test('connexion administrateur, tableau de bord affiché', async () => { assert(/Bonjour Ada/.test(await p.innerText('#app'))); await p.screenshot({ path: path.join(CAP, '01-accueil.png') }); });
  for (const v of ['demandes', 'nouvelle', 'calendrier', 'phototheque', 'ressources', 'projets', 'diffusions', 'favoris', 'aide', 'activite', 'image']) {
    await test('vue « ' + v + ' » sans erreur', async () => { const avant = p.erreurs.length; await aller(p, v); assert.strictEqual(p.erreurs.slice(avant).join(' | '), ''); assert((await p.innerText('#vue')).length > 20); });
  }
  await test('photothèque : fenêtre d\'import ouverte (inchangée)', async () => {
    await aller(p, 'phototheque'); const b = p.locator('button:has-text("Importer")').first();
    if (await b.count()) { await b.click(); await p.waitForTimeout(500); await p.screenshot({ path: path.join(CAP, '02-phototheque-import.png') }); await p.keyboard.press('Escape'); }
    assert.strictEqual(p.erreurs.join(' | '), '');
  });

  console.log('\n2. Matériel : catalogue, fiche, galerie, visionneuse');
  await test('catalogue : photo principale et nombre de photos', async () => {
    await aller(p, 'materiel'); await p.waitForSelector('.mat-carte');
    const t = await p.locator('.mat-carte:has-text("Tente pliante") .mat-nb-photos').innerText(); assert.strictEqual(t.trim(), '3');
    assert.strictEqual(await p.locator('.mat-carte:has-text("Kakemono") .mat-nb-photos').count(), 0);
    await p.screenshot({ path: path.join(CAP, '03-catalogue.png') });
  });
  await test('fiche : grande photo, miniatures, compteur, navigation', async () => {
    await p.click('.mat-carte:has-text("Tente pliante")'); await p.waitForSelector('.mg-miniatures .mg-mini:nth-child(3)');
    assert.strictEqual((await p.innerText('.mg-compteur')).trim(), '1 / 3');
    await p.waitForFunction(() => /^data:image\/jpeg/.test(document.querySelector('.mg-principale img').src) && document.querySelector('.mg-principale img').naturalWidth >= 1600, null, { timeout: 5000 });
    await p.click('.mg-nav.suiv'); assert.strictEqual((await p.innerText('.mg-compteur')).trim(), '2 / 3');
    await p.click('.mg-mini[data-k="2"]'); assert.strictEqual((await p.innerText('.mg-compteur')).trim(), '3 / 3');
    await p.click('.mg-nav.suiv'); assert.strictEqual((await p.innerText('.mg-compteur')).trim(), '1 / 3');
    assert(/Tente rouge/.test(await p.innerText('.mat-fiche-infos'))); assert(await p.locator('#mf-res').isVisible());
    await p.screenshot({ path: path.join(CAP, '04-fiche-materiel.png') });
  });
  await test('clic sur la photo : visionneuse plein écran, flèches, clavier, Échap', async () => {
    await p.click('.mg-principale'); await p.waitForSelector('.mat-visionneuse');
    await p.waitForFunction(() => document.querySelector('.mv-scene img').naturalWidth >= 1600);
    assert(/1 \/ 3/.test(await p.innerText('.mv-titre')));
    await p.keyboard.press('ArrowRight'); assert(/2 \/ 3/.test(await p.innerText('.mv-titre')));
    await p.click('.mv-nav.prec'); assert(/1 \/ 3/.test(await p.innerText('.mv-titre')));
    await p.click('.mv-mini[data-mv="2"]'); assert(/3 \/ 3/.test(await p.innerText('.mv-titre')));
    await p.screenshot({ path: path.join(CAP, '05-visionneuse.png') });
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    assert.strictEqual(await p.locator('.mat-visionneuse').count(), 0); assert(await p.locator('.modale-mat').isVisible(), 'la fiche reste ouverte');
    assert.strictEqual((await p.innerText('.mg-compteur')).trim(), '3 / 3', 'la fiche suit la photo vue');
  });
  await test('ancienne photo unique et matériel sans photo', async () => {
    await p.keyboard.press('Escape'); await p.click('.mat-carte:has-text("Kakemono")'); await p.waitForSelector('.mg-principale img');
    assert.strictEqual(await p.locator('.mg-compteur').count(), 0); await p.keyboard.press('Escape');
    await p.click('.mat-carte:has-text("Micro")'); await p.waitForSelector('.mat-galerie .mat-vig'); await p.keyboard.press('Escape');
  });
  await test('« Réserver » depuis la fiche : réservation créée, e-mails au demandeur, à la gestion et au responsable', async () => {
    await p.evaluate(() => { window.__GAS.mails.length = 0; });
    await p.click('.mat-carte:has-text("Tente pliante")'); await p.click('#mf-res'); await p.waitForSelector('#mr-mat');
    assert.strictEqual(await p.inputValue('#mr-mat'), await p.evaluate(() => window.__M1));
    const j = await p.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 6); return d.toISOString().slice(0, 10); });
    await p.fill('#mr-j1', j); await p.dispatchEvent('#mr-j1', 'change'); await p.fill('#mr-j2', j); await p.dispatchEvent('#mr-j2', 'change');
    await p.fill('#mr-lieu', 'Forum des associations'); await p.dispatchEvent('#mr-lieu', 'input'); await p.waitForTimeout(600);
    if (await p.locator('#mr-cond-ok').count()) await p.check('#mr-cond-ok');
    await p.waitForSelector('#mr-ok:not([disabled])', { timeout: 8000 }); await p.click('#mr-ok'); await p.waitForTimeout(1200);
    const d = (await p.evaluate(() => window.__GAS.mails.map(m => m.to))).sort();
    assert.strictEqual(JSON.stringify(d), JSON.stringify(['admin@dt87.test', 'gestion87@dt87.test', 'resp@dt87.test']), 'demandeur + gestion + responsable : ' + d);
    assert(/confirmée/i.test(await p.evaluate(() => window.__GAS.mails.find(m => m.to === 'admin@dt87.test').subject)));
  });

  console.log('\n3. Matériel : gestion des photos (administration)');
  const ouvrirForm = async nom => { await p.evaluate(() => { window.CentreCom.S.ui.mat.onglet = 'catalogue'; }); await aller(p, 'materiel'); await p.click('.mat-carte:has-text("' + nom + '")'); await p.click('#mf-modif'); await p.waitForSelector('#fm-gal .mga-liste'); await p.waitForTimeout(500); };
  await test('modifier : 3 photos listées, ajout de 2 photos (sélection multiple)', async () => {
    await ouvrirForm('Tente pliante'); await p.waitForSelector('.mga-item:nth-child(3)');
    await p.setInputFiles('.mga-fic', [await imageFichier(p, 4, '#f39c12', 4000, 3000), await imageFichier(p, 5, '#16a085')]);
    await p.waitForSelector('.mga-item:nth-child(5)', { timeout: 15000 }); await p.waitForFunction(() => !document.querySelector('.mat-gal-admin.occupe'));
    assert.strictEqual((await p.innerText('.mga-nb')).trim(), '5 photos');
    const g = await p.evaluate(() => { const r = window.api_photosMateriel(sessionStorage.getItem('centrecom_session'), window.__M1).data.photos; return window.api_photoMateriel(sessionStorage.getItem('centrecom_session'), window.__M1, r[3].pid).data.grande; });
    const dim = await p.evaluate(src => new Promise(ok => { const i = new Image(); i.onload = () => ok([i.naturalWidth, i.naturalHeight]); i.src = src; }), g);
    assert(g.length <= 190000 && dim[0] === 1600 && dim[1] === 1200, 'grande image réduite à 1600 px : ' + dim + ' / ' + g.length);
    await p.screenshot({ path: path.join(CAP, '06-gestion-photos.png') });
  });
  await test('choisir la photo principale, réordonner, supprimer (confirmation)', async () => {
    const mini4 = await p.getAttribute('.mga-item[data-k="3"] img', 'src');
    await p.click('.mga-item[data-k="3"] [data-a="principale"]'); await p.waitForFunction(m => document.querySelector('.mga-item[data-k="0"] img').src === m, mini4);
    assert(await p.locator('.mga-item[data-k="0"] .mga-badge').isVisible());
    const m1 = await p.getAttribute('.mga-item[data-k="1"] img', 'src');
    await p.click('.mga-item[data-k="1"] [data-a="droite"]'); await p.waitForFunction(m => document.querySelector('.mga-item[data-k="2"] img').src === m, m1);
    await p.click('.mga-item[data-k="4"] [data-a="suppr"]'); await p.waitForFunction(() => document.querySelectorAll('.mga-item').length === 4);
    const cat = await p.evaluate(() => window.CentreCom.S.mat.items.find(m => m.id === window.__M1));
    assert.strictEqual(cat.photo, mini4, 'catalogue : nouvelle photo principale'); assert.strictEqual(cat.nb_photos, 4);
    await p.click('#fm-ok'); await p.waitForTimeout(800);
    assert.strictEqual(await p.locator('.mat-carte:has-text("Tente pliante") .mat-nb-photos').innerText(), '4');
  });
  await test('nouveau matériel avec 2 photos : enregistrées après « Ajouter »', async () => {
    await aller(p, 'materiel'); await p.evaluate(() => { const F = window.CentreCom.S.ui.mat; F.onglet = 'gestion'; F.g = 'catalogue'; }); await aller(p, 'materiel');
    await p.click('#gc-ajout'); await p.waitForSelector('#fm-nom');
    await p.fill('#fm-nom', 'Écran LED'); await p.setInputFiles('.mga-fic', [await imageFichier(p, 'A', '#34495e'), await imageFichier(p, 'B', '#d35400')]);
    await p.waitForSelector('.mga-item:nth-child(2)'); await p.click('.mga-item[data-k="1"] [data-a="principale"]');
    await p.click('#fm-ok'); await p.waitForFunction(() => !document.querySelector('#fm-nom'), null, { timeout: 15000 });
    const it = await p.evaluate(() => window.CentreCom.S.mat.items.find(m => m.nom === 'Écran LED'));
    assert.strictEqual(it.nb_photos, 2);
    const ph = await p.evaluate(id => window.api_photosMateriel(sessionStorage.getItem('centrecom_session'), id).data.photos.length, it.id); assert.strictEqual(ph, 2);
  });

  console.log('\n4. Administration : fichiers du projet');
  const ouvrirProjet = async () => { await p.evaluate(() => { window.CentreCom.S.ui.admin = 'projet'; }); await aller(p, 'admin'); await p.waitForSelector('.proj-table [data-pf]', { timeout: 15000 }); };
  await test('section : 6 fichiers présents, actions export et import pour chacun', async () => {
    await ouvrirProjet();
    assert.strictEqual(await p.locator('.proj-table [data-pf]').count(), 6);
    for (const n of ['Code.gs', 'appsscript.json', 'ConfigInitiale.html', 'Styles.html', 'App.html', 'Index.html']) { assert(await p.locator('[data-pf="' + n + '"] .pastille.ton-vert').isVisible(), n); assert(await p.locator('[data-pe="' + n + '"]').isEnabled()); assert(await p.locator('[data-pi="' + n + '"]').isEnabled()); }
    await p.screenshot({ path: path.join(CAP, '07-admin-fichiers-projet.png'), fullPage: true });
  });
  await test('export de chaque fichier : nom, extension et contenu exacts', async () => {
    for (const n of Object.keys(FICHIERS)) { const f = await telecharger(p, () => p.click('[data-pe="' + n + '"]')); assert.strictEqual(f.nom, n); assert.strictEqual(f.buf.toString('utf8'), FICHIERS[n], n); }
  });
  let ZIP;
  await test('export du projet complet : .zip avec les 6 fichiers exacts', async () => {
    ZIP = await telecharger(p, () => p.click('#pj-export-tout'));
    assert(/^Projet_DT87_v3\.30\.0_.*\.zip$/.test(ZIP.nom), ZIP.nom);
    const L = unzip(ZIP.buf); assert.strictEqual(L.length, 6); L.forEach(f => assert.strictEqual(f.contenu, FICHIERS[f.nom], f.nom));
  });
  await test('import complet incomplet (4 fichiers) : présents / manquants affichés, remplacement impossible', async () => {
    await p.click('#pj-import-tout'); await p.waitForSelector('#pji-fic', { state: 'attached' });
    await p.setInputFiles('#pji-fic', ['Code.gs', 'appsscript.json', 'Styles.html', 'App.html'].map(n => ({ name: n, mimeType: 'text/plain', buffer: Buffer.from(FICHIERS[n]) })));
    await p.waitForSelector('#pji-res table'); const t = await p.innerText('#pji-res');
    assert(/Import incomplet : 4 \/ 6/.test(t) && /ConfigInitiale\.html/.test(t) && /Index\.html/.test(t), t.slice(0, 300));
    assert(await p.locator('#pji-go').isDisabled());
    await p.screenshot({ path: path.join(CAP, '08-import-incomplet.png') });
    // Ajout des 2 manquants : 6 / 6, tous identiques → rien à remplacer
    await p.setInputFiles('#pji-fic', ['ConfigInitiale.html', 'Index.html'].map(n => ({ name: n, mimeType: 'text/plain', buffer: Buffer.from(FICHIERS[n]) })));
    await p.waitForFunction(() => /6 \/ 6/.test(document.querySelector('#pji-res').innerText));
    assert(/identiques/.test(await p.innerText('#pji-res'))); assert(await p.locator('#pji-go').isDisabled());
    await p.keyboard.press('Escape');
  });
  await test('import complet depuis l\'archive .zip modifiée : confirmation, remplacement, rapport, publication', async () => {
    const L = unzip(ZIP.buf).map(f => f.nom === 'Styles.html' ? Object.assign(f, { contenu: f.contenu.replace('</style>', '.import-test { color: red; }\n</style>') }) : f);
    const zb = z.Utilities.zip(L.map(f => z.Utilities.newBlob(f.contenu, 'text/plain', f.nom)), 'p.zip').getBytes();
    await p.click('#pj-import-tout'); await p.setInputFiles('#pji-fic', { name: 'Projet_modifie.zip', mimeType: 'application/zip', buffer: Buffer.from(zb.map(x => x & 255)) });
    await p.waitForFunction(() => /6 \/ 6 fichiers présents/.test(document.querySelector('#pji-res').innerText));
    const t = await p.innerText('#pji-res'); assert(/À remplacer/.test(t) && /Contrôles réussis/.test(t), t.slice(0, 400));
    assert(await p.locator('#pji-go').isDisabled(), 'confirmation obligatoire');
    await p.check('#pji-ok'); assert(await p.locator('#pji-go').isEnabled()); assert(await p.locator('#pji-pub').isChecked());
    await p.screenshot({ path: path.join(CAP, '09-import-confirmation.png') });
    await p.click('#pji-go'); await p.waitForSelector('#pjr-recharger', { timeout: 15000 });
    const r = await p.innerText('#modale-racine'); assert(/Styles\.html/.test(r) && /Version 2 publiée/.test(r) && /Projet_avant-import/.test(r), r.slice(0, 500));
    await p.screenshot({ path: path.join(CAP, '10-import-rapport.png') });
    const head = await p.evaluate(() => window.__GAS.projet.head.find(f => f.name === 'Styles').source); assert(/import-test/.test(head));
    assert.strictEqual(await p.evaluate(() => window.__GAS.fichiersDrive.filter(f => /^Projet_avant-import/.test(f.nom)).length), 1);
    await p.click('[data-fermer]');
  });
  await test('import d\'un seul fichier (App.html) : nom tolérant, erreur bloquante si contenu inversé', async () => {
    await ouvrirProjet(); await p.click('[data-pi="Index.html"]');
    await p.setInputFiles('#pji-fic', { name: 'Index.html', mimeType: 'text/html', buffer: Buffer.from(FICHIERS['App.html']) });
    await p.waitForSelector('#pji-res table'); assert(/ressemble à App\.html/.test(await p.innerText('#pji-res'))); assert(await p.locator('#pji-conf').isHidden());
    await p.keyboard.press('Escape');
    await p.click('[data-pi="App.html"]');
    await p.setInputFiles('#pji-fic', { name: '533aa5cb-App.html.txt', mimeType: 'text/plain', buffer: Buffer.from(FICHIERS['App.html'].replace("const VERSION_APP = '3.30.0';", "const VERSION_APP = '3.30.0'; /* v2 */")) });
    await p.waitForSelector('#pji-res .pastille.ton-vert'); await p.check('#pji-ok'); await p.click('#pji-go'); await p.waitForSelector('#pjr-recharger', { timeout: 15000 });
    assert(/v2/.test(await p.evaluate(() => window.__GAS.projet.head.find(f => f.name === 'App').source)));
    await p.click('[data-fermer]');
  });
  await test('préparer le projet pour une nouvelle DT : archive 6 fichiers, ConfigInitiale DT09 sans donnée DT87', async () => {
    await ouvrirProjet(); await p.click('#pj-dt'); await p.fill('#nd-code', 'DT09'); await p.fill('#nd-nom', 'Espace Com DT09'); await p.fill('#nd-ul', 'UL de Foix\nUL de Pamiers');
    const f = await telecharger(p, () => p.click('#nd-ok')); assert(/^Projet_DT09_depuis_DT87/.test(f.nom));
    const L = unzip(f.buf); assert.strictEqual(L.length, 6); const ci = L.find(x => x.nom === 'ConfigInitiale.html').contenu, o = JSON.parse(ci);
    assert.strictEqual(o.config.identite.code, 'DT09'); assert(!/87|croix-rouge\.fr/.test(ci), ci.slice(0, 300)); assert.strictEqual(o.tables.ul.length, 2);
    await p.waitForSelector('#nd-copier'); await p.screenshot({ path: path.join(CAP, '11-nouvelle-dt.png') }); await p.click('.pied [data-fermer]');
  });
  await test('API Apps Script désactivée : explication claire, HTML toujours exportables', async () => {
    await p.evaluate(() => { window.__GAS.projet.actif = false; }); await ouvrirProjet();
    const t = await p.textContent('#a-corps'); assert(/usersettings/.test(t) && /oauthScopes/.test(t) && /script\.projects/.test(t), t.slice(0, 300));
    assert(await p.locator('[data-pe="App.html"]').isEnabled()); assert(await p.locator('[data-pe="Code.gs"]').isDisabled()); assert(await p.locator('#pj-import-tout').isDisabled());
    await p.click('.proj-aide summary'); await p.screenshot({ path: path.join(CAP, '12-api-inactive.png'), fullPage: true });
    await p.evaluate(() => { window.__GAS.projet.actif = true; });
  });
  await test('sauvegarde : lien vers la section Fichiers du projet', async () => {
    await p.evaluate(() => { window.CentreCom.S.ui.admin = 'sauvegarde'; }); await aller(p, 'admin'); await p.click('#s-projet'); await p.waitForSelector('.proj-table');
  });
  await test('aucune erreur JavaScript pendant le parcours administrateur', async () => { assert.strictEqual(p.erreurs.join(' | '), ''); });

  console.log('\n5. Bénévole et affichage mobile (responsive)');
  const m = await ouvrir('benevole', { width: 390, height: 844 });
  await test('bénévole : pas d\'administration, catalogue et fiche avec galerie', async () => {
    assert.strictEqual(await m.locator('text=Administration').count(), 0);
    await aller(m, 'materiel'); await m.waitForSelector('.mat-carte'); await pasDeDebord(m);
    await m.screenshot({ path: path.join(CAP, '13-mobile-catalogue.png') });
    await m.click('.mat-carte:has-text("Tente pliante")'); await m.waitForSelector('.mg-miniatures');
    assert.strictEqual(await m.locator('#mf-modif').count(), 0); assert(await m.locator('#mf-res').isVisible());
    await pasDeDebord(m); await m.waitForTimeout(500); await m.screenshot({ path: path.join(CAP, '14-mobile-fiche.png') });
  });
  await test('mobile : balayage et visionneuse plein écran', async () => {
    const c0 = await m.innerText('.mg-compteur');
    await m.evaluate(() => { const el = document.querySelector('.mat-galerie'); const t = (type, x) => { const e = new Event(type, { bubbles: true }); e.touches = [{ clientX: x, clientY: 100 }]; e.changedTouches = [{ clientX: x, clientY: 100 }]; el.dispatchEvent(e); }; t('touchstart', 300); t('touchend', 120); });
    assert.notStrictEqual(await m.innerText('.mg-compteur'), c0, 'balayage');
    await m.click('.mg-principale'); await m.waitForSelector('.mat-visionneuse'); await m.waitForTimeout(300);
    const r = await m.evaluate(() => { const b = document.querySelector('.mv-scene img').getBoundingClientRect(); return [b.width, window.innerWidth]; }); assert(r[0] > 300 && r[0] <= r[1], 'image plein écran ' + r);
    await m.screenshot({ path: path.join(CAP, '15-mobile-visionneuse.png') }); await m.click('[data-mv="fermer"]');
  });
  await test('mobile : réservations et aucune erreur JavaScript', async () => {
    await m.keyboard.press('Escape'); await m.evaluate(() => { window.CentreCom.S.ui.mat.onglet = 'mes'; }); await aller(m, 'materiel'); await pasDeDebord(m);
    assert.strictEqual(m.erreurs.join(' | '), '');
  });
  const a = await ouvrir('admin', { width: 390, height: 844 });
  await test('mobile administrateur : fichiers du projet et gestion des photos lisibles', async () => {
    await a.evaluate(() => { window.CentreCom.S.ui.admin = 'projet'; }); await aller(a, 'admin'); await a.waitForSelector('.proj-table'); await pasDeDebord(a);
    for (const b of await a.locator('[data-pe], [data-pi], #pj-dt').all()) { const r = await b.boundingBox(); assert(r && r.x >= 0 && r.x + r.width <= 391, 'bouton hors écran'); }
    await a.screenshot({ path: path.join(CAP, '16-mobile-admin-projet.png'), fullPage: true });
    await aller(a, 'materiel'); await a.click('.mat-carte:has-text("Tente pliante")'); await a.click('#mf-modif'); await a.waitForSelector('.mga-item:nth-child(3)'); await pasDeDebord(a); await a.waitForTimeout(500);
    await a.screenshot({ path: path.join(CAP, '17-mobile-gestion-photos.png') });
    assert.strictEqual(a.erreurs.join(' | '), '');
  });

  await nav.close();
  console.log('\n' + ok + ' test(s) réussi(s), ' + ko + ' échec(s). Captures : ' + CAP);
  process.exit(ko ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
