/**
 * =============================================================================
 *  PHOTOTHÈQUE — Croix-Rouge française, UL Boulogne-Billancourt
 *  Google Apps Script : Code.gs (serveur)
 *
 *  Stockage : Google Drive (originaux conservés OCTET POUR OCTET)
 *  Base     : Google Sheets (créée automatiquement par setup())
 *
 *  Fichiers du projet : Code.gs (UN SEUL fichier, interface incluse) + appsscript.json.
 *  Installation : exécuter une fois setup(), puis
 *  Déployer > Nouveau déploiement > Application Web.
 * =============================================================================
 */

const CONFIG = {
  TIMEZONE: 'Europe/Paris',
  // Taille des morceaux d'envoi : multiple de 256 Ko (exigence de l'API Drive).
  CHUNK_SIZE: 8 * 1024 * 1024,
  DOWNLOAD_CHUNK_SIZE: 8 * 1024 * 1024,
  MAX_UPLOAD_BYTES: 4 * 1024 * 1024 * 1024,
  SESSION_HOURS: { USER: 168, ADMIN: 12 },
  PAGE_MAX: 120,
  THUMB_SIZE: 360,
  PREVIEW_SIZE: 1600,
  // Mots de passe initiaux : copiés dans les Propriétés du script par setup().
  // Ensuite, modifiez-les UNIQUEMENT dans Paramètres du projet > Propriétés du script.
  DEFAULT_USER_PASSWORD: '9205',
  DEFAULT_ADMIN_PASSWORD: 'Com9205*',
};

const SHEETS = {
  Media: [
    'id', 'originalFilename', 'extension', 'mimeType', 'mediaType', 'fileSize', 'driveFileId', 'md5',
    'thumbFileId', 'previewFileId', 'width', 'height', 'durationSec', 'captureDate', 'captureDateSource',
    'uploadedAt', 'photographer', 'categoryId', 'categoryName', 'activityId', 'activityName', 'status',
    'sortedAt', 'sortedBy', 'uploadedBy', 'state', 'thumbAttempts',
  ],
  Categories: ['id', 'name', 'description', 'active', 'displayOrder'],
  Activities: ['id', 'categoryId', 'name', 'active', 'displayOrder'],
  Journal: ['date', 'actor', 'role', 'action', 'count', 'details'],
};

const NUMERIC = ['fileSize', 'width', 'height', 'durationSec', 'displayOrder', 'count', 'thumbAttempts'];
const BOOLEAN = ['active'];

const INITIAL_CATALOG = [
  { name: 'US', description: 'Urgence et secourisme', activities: ['Poste de secours', 'DPS', 'Autre'] },
  { name: 'AS', description: 'Action sociale', activities: ['Maraude', 'EBP', 'Saintaniste', 'DALO', 'ALSO', 'Autre'] },
  { name: 'Activité de transfert', description: '', activities: ['JM', 'Muguet', 'Forme activité', 'Banque alimentaire', 'Autre'] },
  { name: 'Autre', description: '', activities: ['Formation', 'Autre'] },
];

const PHOTO_EXT = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jpe: 'image/jpeg', png: 'image/png', heic: 'image/heic', heif: 'image/heif',
  hif: 'image/heif', webp: 'image/webp', gif: 'image/gif', tif: 'image/tiff', tiff: 'image/tiff', bmp: 'image/bmp',
  avif: 'image/avif', dng: 'image/x-adobe-dng', cr2: 'image/x-canon-cr2', cr3: 'image/x-canon-cr3',
  nef: 'image/x-nikon-nef', arw: 'image/x-sony-arw', orf: 'image/x-olympus-orf', rw2: 'image/x-panasonic-rw2',
  raf: 'image/x-fuji-raf',
};
const VIDEO_EXT = {
  mp4: 'video/mp4', m4v: 'video/x-m4v', mov: 'video/quicktime', qt: 'video/quicktime', avi: 'video/x-msvideo',
  mkv: 'video/x-matroska', webm: 'video/webm', '3gp': 'video/3gpp', '3g2': 'video/3gpp2', mts: 'video/mp2t',
  m2ts: 'video/mp2t', mpg: 'video/mpeg', mpeg: 'video/mpeg', wmv: 'video/x-ms-wmv',
};

// =============================================================================
//  Point d'entrée Web
// =============================================================================

/**
 * Installation automatique : si setup() n'a jamais été exécutée (ou a échoué),
 * elle est lancée à la première ouverture / connexion. L'application Web
 * s'exécute avec le compte du propriétaire, qui a déjà donné les autorisations.
 */
function ensureInstalled_() {
  const p = props_();
  const ok = ['AUTH_SECRET', 'USER_PASSWORD', 'ADMIN_PASSWORD', 'SPREADSHEET_ID', 'ROOT_FOLDER_ID', 'ORIGINALS_FOLDER_ID', 'THUMBS_FOLDER_ID']
    .every(function (k) { return p[k]; });
  if (ok) return;
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    setup();
  } finally {
    _props = null;
    lock.releaseLock();
  }
}

function doGet() {
  try {
    ensureInstalled_();
  } catch (e) {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:sans-serif;padding:24px">Installation impossible : ' + String(e && e.message || e) +
      '<br><br>Dans l\'éditeur Apps Script, choisissez la fonction <b>setup</b>, cliquez sur <b>Exécuter</b> et acceptez les autorisations.</p>'
    );
  }
  // L'interface est intégrée dans ce même fichier (fonction indexHtml_, tout en bas).
  if (typeof indexHtml_ !== 'function') {
    return HtmlService.createHtmlOutput(
      '<p style="font-family:sans-serif;padding:24px">Le fichier Code.gs est incomplet (la fin manque). ' +
      'Recopiez-le en entier : la dernière ligne doit être « // FIN DU FICHIER ». Enregistrez, puis redéployez une nouvelle version.</p>'
    );
  }
  const html = indexHtml_();
  return HtmlService.createHtmlOutput(html)
    .setTitle('Photothèque — Croix-Rouge Boulogne-Billancourt')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setFaviconUrl('https://upload.wikimedia.org/wikipedia/commons/thumb/a/a7/Flag_of_the_Red_Cross.svg/64px-Flag_of_the_Red_Cross.svg.png');
}

// =============================================================================
//  Installation (à exécuter une fois depuis l'éditeur ; ré-exécutable sans risque)
// =============================================================================

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('AUTH_SECRET')) props.setProperty('AUTH_SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!props.getProperty('USER_PASSWORD')) props.setProperty('USER_PASSWORD', CONFIG.DEFAULT_USER_PASSWORD);
  if (!props.getProperty('ADMIN_PASSWORD')) props.setProperty('ADMIN_PASSWORD', CONFIG.DEFAULT_ADMIN_PASSWORD);

  // Dossiers Drive
  let root = folderFromProp_('ROOT_FOLDER_ID');
  if (!root) {
    root = DriveApp.createFolder('Photothèque Croix-Rouge Boulogne-Billancourt');
    props.setProperty('ROOT_FOLDER_ID', root.getId());
  }
  if (!folderFromProp_('ORIGINALS_FOLDER_ID')) props.setProperty('ORIGINALS_FOLDER_ID', root.createFolder('Originaux').getId());
  if (!folderFromProp_('THUMBS_FOLDER_ID')) props.setProperty('THUMBS_FOLDER_ID', root.createFolder('Miniatures (affichage uniquement)').getId());

  // Base de données (Google Sheets)
  let ss = null;
  const ssId = props.getProperty('SPREADSHEET_ID');
  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch (e) { ss = null; }
  }
  if (!ss) {
    ss = SpreadsheetApp.create('Photothèque CRF — Base de données');
    DriveApp.getFileById(ss.getId()).moveTo(root);
    props.setProperty('SPREADSHEET_ID', ss.getId());
  }
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    const headers = SHEETS[name];
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  });
  const defaultSheet = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (defaultSheet && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);

  // Catégories initiales : uniquement si la table est vide
  _ss = ss;
  if (readAll_('Categories').length === 0) {
    INITIAL_CATALOG.forEach(function (cat, i) {
      const catId = newId_('c');
      append_('Categories', { id: catId, name: cat.name, description: cat.description, active: true, displayOrder: i });
      cat.activities.forEach(function (a, j) {
        append_('Activities', { id: newId_('a'), categoryId: catId, name: a, active: true, displayOrder: j });
      });
    });
  }

  Logger.log('Installation terminée.');
  Logger.log('Base : ' + ss.getUrl());
  Logger.log('Dossier Drive : ' + root.getUrl());
}

function folderFromProp_(key) {
  const id = PropertiesService.getScriptProperties().getProperty(key);
  if (!id) return null;
  try { return DriveApp.getFolderById(id); } catch (e) { return null; }
}

// =============================================================================
//  Base de données (Google Sheets)
// =============================================================================

let _ss = null;

let _props = null;

/** Propriétés du script lues une seule fois par appel (beaucoup plus rapide). */
function props_() {
  if (!_props) _props = PropertiesService.getScriptProperties().getProperties();
  return _props;
}

function prop_(key) {
  const value = props_()[key];
  if (!value) throw new Error("Application non installée : exécutez la fonction setup() dans l'éditeur Apps Script.");
  return value;
}

function db_() {
  if (!_ss) _ss = SpreadsheetApp.openById(prop_('SPREADSHEET_ID'));
  return _ss;
}

function sheet_(name) {
  return db_().getSheetByName(name);
}

function parseCell_(key, v) {
  if (v instanceof Date) return v.toISOString();
  if (NUMERIC.indexOf(key) >= 0) return v === '' || v === null ? null : Number(v);
  if (BOOLEAN.indexOf(key) >= 0) return v === true || String(v).toLowerCase() === 'true';
  return v === null || v === undefined ? '' : String(v);
}

function toRow_(name, obj) {
  return SHEETS[name].map(function (k) {
    const v = obj[k];
    return v === null || v === undefined ? '' : String(v);
  });
}

function rowToObj_(name, values, rowIndex) {
  const o = { _row: rowIndex };
  SHEETS[name].forEach(function (k, j) { o[k] = parseCell_(k, values[j]); });
  return o;
}

function readAll_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, SHEETS[name].length).getValues();
  const out = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === '') continue;
    out.push(rowToObj_(name, values[i], i + 2));
  }
  return out;
}

function findById_(name, id) {
  if (!id) return null;
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return null;
  const cell = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(id)).matchEntireCell(true).findNext();
  if (!cell) return null;
  const row = cell.getRow();
  return rowToObj_(name, sh.getRange(row, 1, 1, SHEETS[name].length).getValues()[0], row);
}

function append_(name, obj) {
  sheet_(name).appendRow(toRow_(name, obj));
}

function update_(name, obj) {
  sheet_(name).getRange(obj._row, 1, 1, SHEETS[name].length).setValues([toRow_(name, obj)]);
}

function deleteRow_(name, obj) {
  sheet_(name).deleteRow(obj._row);
}

/** Toute écriture passe par un verrou ; les lignes sont relues par id sous verrou. */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Le serveur est occupé. Veuillez réessayer.');
  try {
    return fn();
  } finally {
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

function newId_(prefix) {
  return (prefix || 'm') + Date.now().toString(36) + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
}

function nowIso_() {
  return new Date().toISOString();
}

function dayKey_(iso) {
  return iso ? Utilities.formatDate(new Date(iso), CONFIG.TIMEZONE, 'yyyy-MM-dd') : '';
}

// =============================================================================
//  Authentification & autorisation
// =============================================================================

function hash_(text) {
  return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8));
}

function passwordVersion_(role) {
  const pw = String(props_()[role === 'ADMIN' ? 'ADMIN_PASSWORD' : 'USER_PASSWORD'] || '').trim();
  return hash_(prop_('AUTH_SECRET') + ':' + role + ':' + pw).slice(0, 16);
}

function signToken_(payload) {
  const body = Utilities.base64EncodeWebSafe(JSON.stringify(payload), Utilities.Charset.UTF_8);
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(body, prop_('AUTH_SECRET')));
  return body + '.' + sig;
}

function verifyToken_(token) {
  if (!token || typeof token !== 'string' || token.indexOf('.') < 0) return null;
  const parts = token.split('.');
  const expected = Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(parts[0], prop_('AUTH_SECRET')));
  if (expected !== parts[1]) return null;
  let p;
  try {
    p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString('UTF-8'));
  } catch (e) {
    return null;
  }
  if (!p || (p.r !== 'USER' && p.r !== 'ADMIN') || !p.exp || p.exp < Date.now()) return null;
  if (p.pv !== passwordVersion_(p.r)) return null; // mot de passe changé → session invalide
  return { role: p.r, name: p.n, exp: p.exp };
}

/**
 * Vérification CÔTÉ SERVEUR de chaque appel.
 * level 'USER'  : tout utilisateur connecté (importation)
 * level 'ADMIN' : administrateur uniquement
 */
function auth_(token, level) {
  const session = verifyToken_(token);
  if (!session) throw new Error('SESSION: Session expirée. Veuillez vous reconnecter.');
  if (level === 'ADMIN' && session.role !== 'ADMIN') {
    throw new Error("Accès refusé : action réservée à l'administrateur.");
  }
  return session;
}

function login(password) {
  const cache = CacheService.getScriptCache();
  const fails = JSON.parse(cache.get('loginFails') || '[]').filter(function (t) { return t > Date.now() - 15 * 60000; });
  if (fails.length >= 20) throw new Error('Trop de tentatives. Réessayez dans quelques minutes.');

  ensureInstalled_();
  const pw = String(password || '').trim();
  const props = props_();
  const isAdmin = hash_(pw) === hash_(String(props.ADMIN_PASSWORD || '\u0000').trim());
  const isUser = hash_(pw) === hash_(String(props.USER_PASSWORD || '\u0000').trim());
  const role = isAdmin ? 'ADMIN' : isUser ? 'USER' : null;

  if (!role) {
    fails.push(Date.now());
    cache.put('loginFails', JSON.stringify(fails), 900);
    Utilities.sleep(800);
    throw new Error('Mot de passe incorrect.');
  }
  const name = role === 'ADMIN' ? 'Administrateur' : 'Bénévole';
  const token = signToken_({ r: role, n: name, exp: Date.now() + CONFIG.SESSION_HOURS[role] * 3600000, pv: passwordVersion_(role) });
  return { token: token, role: role, name: name };
}

function getSession(token) {
  const s = auth_(token, 'USER');
  return { role: s.role, name: s.name };
}

/** Nom affiché (historique « trié par ») — comptes partagés. */
function setDisplayName(token, name) {
  const s = auth_(token, 'USER');
  const clean = String(name || '').trim().slice(0, 60);
  if (!clean) throw new Error('Le nom affiché est obligatoire.');
  return {
    token: signToken_({ r: s.role, n: clean, exp: s.exp, pv: passwordVersion_(s.role) }),
    name: clean,
  };
}

// =============================================================================
//  Journal d'activité
// =============================================================================

function journal_(session, action, details, count) {
  try {
    append_('Journal', { date: nowIso_(), actor: session.name, role: session.role, action: action, count: count || 1, details: details || '' });
  } catch (e) {
    console.error(e);
  }
}

function journalUpload_(session, details) {
  const sh = sheet_('Journal');
  const last = sh.getLastRow();
  if (last >= 2) {
    const prev = rowToObj_('Journal', sh.getRange(last, 1, 1, SHEETS.Journal.length).getValues()[0], last);
    if (prev.action === 'UPLOAD' && prev.actor === session.name && new Date(prev.date).getTime() > Date.now() - 15 * 60000) {
      prev.count = (prev.count || 1) + 1;
      prev.details = details;
      update_('Journal', prev);
      return;
    }
  }
  journal_(session, 'UPLOAD', details, 1);
}

// =============================================================================
//  Catégories & activités
// =============================================================================

function catalog_(onlyActive) {
  const cats = readAll_('Categories').sort(function (a, b) { return a.displayOrder - b.displayOrder || a.name.localeCompare(b.name); });
  const acts = readAll_('Activities').sort(function (a, b) { return a.displayOrder - b.displayOrder || a.name.localeCompare(b.name); });
  return cats
    .filter(function (c) { return !onlyActive || c.active; })
    .map(function (c) {
      return {
        id: c.id, name: c.name, description: c.description, active: c.active, displayOrder: c.displayOrder,
        activities: acts
          .filter(function (a) { return a.categoryId === c.id && (!onlyActive || a.active); })
          .map(function (a) { return { id: a.id, name: a.name, active: a.active, displayOrder: a.displayOrder }; }),
      };
    });
}

/** Catalogue : actif pour tous (formulaire d'importation), complet + compteurs pour ADMIN. */
function getCatalog(token, includeInactive) {
  const s = auth_(token, includeInactive ? 'ADMIN' : 'USER');
  const result = catalog_(!includeInactive);
  if (includeInactive && s.role === 'ADMIN') {
    const counts = {};
    readAll_('Media').forEach(function (m) {
      counts[m.categoryId] = (counts[m.categoryId] || 0) + 1;
      counts[m.activityId] = (counts[m.activityId] || 0) + 1;
    });
    result.forEach(function (c) {
      c.mediaCount = counts[c.id] || 0;
      c.activities.forEach(function (a) { a.mediaCount = counts[a.id] || 0; });
    });
  }
  return result;
}

function cleanName_(name, label) {
  const v = String(name || '').trim();
  if (!v) throw new Error(label + ' est obligatoire.');
  if (v.length > 80) throw new Error(label + ' : 80 caractères maximum.');
  return v;
}

function saveCategory(token, data) {
  const s = auth_(token, 'ADMIN');
  return withLock_(function () {
    const all = readAll_('Categories');
    if (data.id) {
      const cat = findById_('Categories', data.id);
      if (!cat) throw new Error('Catégorie introuvable.');
      if (data.name !== undefined) {
        const name = cleanName_(data.name, 'Le nom de la catégorie');
        if (all.some(function (c) { return c.id !== cat.id && c.name.toLowerCase() === name.toLowerCase(); })) throw new Error('Une catégorie porte déjà ce nom.');
        cat.name = name;
      }
      if (data.description !== undefined) cat.description = String(data.description || '').slice(0, 300);
      if (data.active !== undefined) cat.active = Boolean(data.active);
      update_('Categories', cat);
      journal_(s, data.active === false ? 'CATEGORY_DISABLE' : data.active === true ? 'CATEGORY_ENABLE' : 'CATEGORY_UPDATE', cat.name);
      return true;
    }
    const name = cleanName_(data.name, 'Le nom de la catégorie');
    if (all.some(function (c) { return c.name.toLowerCase() === name.toLowerCase(); })) throw new Error('Une catégorie porte déjà ce nom.');
    const order = all.reduce(function (m, c) { return Math.max(m, c.displayOrder || 0); }, -1) + 1;
    append_('Categories', { id: newId_('c'), name: name, description: String(data.description || ''), active: true, displayOrder: order });
    journal_(s, 'CATEGORY_CREATE', name);
    return true;
  });
}

function deleteCategory(token, id) {
  const s = auth_(token, 'ADMIN');
  return withLock_(function () {
    const cat = findById_('Categories', id);
    if (!cat) throw new Error('Catégorie introuvable.');
    const used = readAll_('Media').filter(function (m) { return m.categoryId === id; }).length;
    if (used) throw new Error('Impossible de supprimer « ' + cat.name + ' » : ' + used + " média(s) y sont rattachés. Désactivez-la plutôt pour conserver l'historique.");
    readAll_('Activities').filter(function (a) { return a.categoryId === id; }).reverse().forEach(function (a) { deleteRow_('Activities', a); });
    deleteRow_('Categories', findById_('Categories', id));
    journal_(s, 'CATEGORY_DELETE', cat.name);
    return true;
  });
}

function reorderCategories(token, ids) {
  auth_(token, 'ADMIN');
  return withLock_(function () {
    (ids || []).forEach(function (id, i) {
      const c = findById_('Categories', id);
      if (c) { c.displayOrder = i; update_('Categories', c); }
    });
    return true;
  });
}

function saveActivity(token, data) {
  const s = auth_(token, 'ADMIN');
  return withLock_(function () {
    if (data.id) {
      const act = findById_('Activities', data.id);
      if (!act) throw new Error('Activité introuvable.');
      if (data.name !== undefined) {
        const name = cleanName_(data.name, "Le nom de l'activité");
        const dup = readAll_('Activities').some(function (a) { return a.id !== act.id && a.categoryId === act.categoryId && a.name.toLowerCase() === name.toLowerCase(); });
        if (dup) throw new Error('Cette activité existe déjà dans la catégorie.');
        act.name = name; // les médias existants gardent leur nom historique
      }
      if (data.active !== undefined) act.active = Boolean(data.active);
      update_('Activities', act);
      journal_(s, data.active === false ? 'ACTIVITY_DISABLE' : data.active === true ? 'ACTIVITY_ENABLE' : 'ACTIVITY_UPDATE', act.name);
      return true;
    }
    const cat = findById_('Categories', data.categoryId);
    if (!cat) throw new Error('Catégorie introuvable.');
    const name = cleanName_(data.name, "Le nom de l'activité");
    const siblings = readAll_('Activities').filter(function (a) { return a.categoryId === cat.id; });
    if (siblings.some(function (a) { return a.name.toLowerCase() === name.toLowerCase(); })) throw new Error('Cette activité existe déjà dans la catégorie.');
    const order = siblings.reduce(function (m, a) { return Math.max(m, a.displayOrder || 0); }, -1) + 1;
    append_('Activities', { id: newId_('a'), categoryId: cat.id, name: name, active: true, displayOrder: order });
    journal_(s, 'ACTIVITY_CREATE', cat.name + ' → ' + name);
    return true;
  });
}

function deleteActivity(token, id) {
  const s = auth_(token, 'ADMIN');
  return withLock_(function () {
    const act = findById_('Activities', id);
    if (!act) throw new Error('Activité introuvable.');
    const used = readAll_('Media').filter(function (m) { return m.activityId === id; }).length;
    if (used) throw new Error('Impossible de supprimer « ' + act.name + ' » : ' + used + " média(s) l'utilisent. Désactivez-la plutôt pour conserver l'historique.");
    deleteRow_('Activities', act);
    journal_(s, 'ACTIVITY_DELETE', act.name);
    return true;
  });
}

function reorderActivities(token, ids) {
  auth_(token, 'ADMIN');
  return withLock_(function () {
    (ids || []).forEach(function (id, i) {
      const a = findById_('Activities', id);
      if (a) { a.displayOrder = i; update_('Activities', a); }
    });
    return true;
  });
}

function resolveCatActivity_(categoryId, activityId, requireActive) {
  const act = findById_('Activities', activityId);
  const cat = findById_('Categories', categoryId);
  if (!act || !cat || act.categoryId !== cat.id) throw new Error("L'activité choisie n'appartient pas à cette catégorie.");
  if (requireActive && (!act.active || !cat.active)) throw new Error("Cette catégorie ou activité n'est plus disponible.");
  return { categoryName: cat.name, activityName: act.name };
}

// =============================================================================
//  Google Drive (API REST) — les originaux ne sont jamais modifiés
// =============================================================================

function driveHeaders_() {
  return { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() };
}

function driveGet_(fileId, fields) {
  const res = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?supportsAllDrives=true&fields=' + encodeURIComponent(fields),
    { headers: driveHeaders_(), muteHttpExceptions: true }
  );
  if (res.getResponseCode() === 404) return null;
  if (res.getResponseCode() !== 200) throw new Error('Drive : ' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText());
}

/** Suppression DÉFINITIVE (pas de corbeille). Un fichier déjà absent n'est pas une erreur. */
function driveDelete_(fileId) {
  if (!fileId) return;
  const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fileId) + '?supportsAllDrives=true', {
    method: 'delete', headers: driveHeaders_(), muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 204 && code !== 200 && code !== 404) throw new Error('Drive : suppression impossible (' + code + ').');
}

/** Identifiant du dossier mensuel des originaux (mis en cache : évite une recherche Drive par fichier). */
function monthFolderId_(isoDate) {
  const name = Utilities.formatDate(new Date(isoDate), CONFIG.TIMEZONE, 'yyyy-MM');
  const cache = CacheService.getScriptCache();
  const cached = cache.get('mf_' + name);
  if (cached) return cached;
  const parent = DriveApp.getFolderById(prop_('ORIGINALS_FOLDER_ID'));
  const it = parent.getFoldersByName(name);
  const id = (it.hasNext() ? it.next() : parent.createFolder(name)).getId();
  cache.put('mf_' + name, id, 21600);
  return id;
}

/** Session d'envoi « resumable » : les octets reçus sont écrits tels quels par Drive. */
function createResumableSession_(name, mimeType, size, parentId) {
  const headers = driveHeaders_();
  headers['X-Upload-Content-Type'] = mimeType;
  headers['X-Upload-Content-Length'] = String(size);
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,size,md5Checksum', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    payload: JSON.stringify({ name: name, mimeType: mimeType, parents: [parentId] }),
    headers: headers,
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error("L'importation a échoué pour ce fichier (Drive " + res.getResponseCode() + ').');
  const h = res.getAllHeaders();
  return h.Location || h.location;
}

/** Miniature/aperçu générés par Drive (utile pour HEIC, RAW, vidéos). Nouveau fichier séparé. */
function driveThumbnailBlob_(fileId, size) {
  const meta = driveGet_(fileId, 'thumbnailLink');
  if (!meta || !meta.thumbnailLink) return null;
  const url = meta.thumbnailLink.replace(/=s\d+$/, '') + '=s' + size;
  const res = UrlFetchApp.fetch(url, { headers: driveHeaders_(), muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) return null;
  return res.getBlob();
}

function ensureDerivatives_(media) {
  if (!media.driveFileId) return false;
  let changed = false;
  const folder = DriveApp.getFolderById(prop_('THUMBS_FOLDER_ID'));
  if (!media.thumbFileId) {
    const blob = driveThumbnailBlob_(media.driveFileId, CONFIG.THUMB_SIZE);
    if (blob) {
      media.thumbFileId = folder.createFile(blob.setName(media.id + '_thumb.jpg')).getId();
      changed = true;
    }
  }
  if (!media.previewFileId && media.thumbFileId) {
    const blob = driveThumbnailBlob_(media.driveFileId, CONFIG.PREVIEW_SIZE);
    if (blob) {
      media.previewFileId = folder.createFile(blob.setName(media.id + '_preview.jpg')).getId();
      changed = true;
    }
  }
  return changed;
}

// =============================================================================
//  Importation
// =============================================================================

function detectFormat_(filename, mime) {
  const m = /\.([^.\/\\]+)$/.exec(filename || '');
  const ext = m ? m[1].toLowerCase() : '';
  mime = String(mime || '').toLowerCase();
  if (PHOTO_EXT[ext]) return { kind: 'PHOTO', ext: ext, mime: mime.indexOf('image/') === 0 ? mime : PHOTO_EXT[ext] };
  if (VIDEO_EXT[ext]) return { kind: 'VIDEO', ext: ext, mime: mime.indexOf('video/') === 0 ? mime : VIDEO_EXT[ext] };
  return null;
}

/**
 * Étape 1 : validation + création de l'enregistrement (PENDING, À TRIER)
 * + ouverture d'une session d'envoi Drive.
 */
function startUpload(token, meta) {
  const s = auth_(token, 'USER');
  meta = meta || {};
  const filename = String(meta.filename || '').trim();
  if (!filename || filename.length > 255) throw new Error('Nom de fichier invalide.');
  const format = detectFormat_(filename, meta.mimeType);
  if (!format) throw new Error("Ce fichier n'est pas compatible.");
  const size = Number(meta.size);
  if (!(size > 0)) throw new Error('Le fichier est vide.');
  if (size > CONFIG.MAX_UPLOAD_BYTES) throw new Error('Ce fichier dépasse la taille maximale autorisée.');
  const photographer = String(meta.photographer || '').trim().slice(0, 120);
  if (!photographer) throw new Error('Le nom du photographe est obligatoire.');
  const capture = new Date(meta.captureDate);
  if (isNaN(capture.getTime()) || capture.getTime() > Date.now() + 86400000 || capture.getFullYear() < 1990) {
    throw new Error('La date de prise de vue est invalide.');
  }
  const names = resolveCatActivity_(meta.categoryId, meta.activityId, true);

  const id = newId_('m');
  const sessionUri = createResumableSession_(filename, format.mime, size, monthFolderId_(capture.toISOString()));
  CacheService.getScriptCache().put('up_' + id, JSON.stringify({ uri: sessionUri, next: 0, size: size, fileId: null }), 21600);

  withLock_(function () {
    append_('Media', {
      id: id, originalFilename: filename, extension: format.ext, mimeType: format.mime, mediaType: format.kind,
      fileSize: size, driveFileId: '', md5: '', thumbFileId: '', previewFileId: '',
      width: meta.width || '', height: meta.height || '', durationSec: meta.durationSec || '',
      captureDate: capture.toISOString(), captureDateSource: ['EXIF', 'VIDEO_METADATA', 'FILE_DATE', 'MANUAL'].indexOf(meta.captureDateSource) >= 0 ? meta.captureDateSource : 'MANUAL',
      uploadedAt: nowIso_(), photographer: photographer, categoryId: meta.categoryId, categoryName: names.categoryName,
      activityId: meta.activityId, activityName: names.activityName, status: 'TO_SORT', sortedAt: '', sortedBy: '',
      uploadedBy: s.name, state: 'PENDING', thumbAttempts: 0,
    });
  });
  return { mediaId: id, chunkSize: CONFIG.CHUNK_SIZE };
}

/** Étape 2 : morceaux de l'ORIGINAL (base64 des octets bruts, aucune transformation). */
function uploadChunk(token, mediaId, offset, base64) {
  auth_(token, 'USER');
  const cache = CacheService.getScriptCache();
  const st = JSON.parse(cache.get('up_' + mediaId) || 'null');
  if (!st) throw new Error("Session d'envoi expirée. Réessayez ce fichier.");
  if (Number(offset) !== st.next) throw new Error('Envoi désynchronisé. Réessayez ce fichier.');
  const bytes = Utilities.base64Decode(base64);
  if (!bytes.length) throw new Error('Morceau vide.');
  const end = st.next + bytes.length - 1;
  if (end >= st.size) throw new Error('Le fichier reçu dépasse la taille annoncée.');

  const res = UrlFetchApp.fetch(st.uri, {
    method: 'put',
    payload: bytes,
    contentType: 'application/octet-stream',
    headers: { 'Content-Range': 'bytes ' + st.next + '-' + end + '/' + st.size },
    muteHttpExceptions: true,
    followRedirects: false,
  });
  const code = res.getResponseCode();
  if (code === 308) {
    const range = res.getAllHeaders().Range || res.getAllHeaders().range;
    st.next = range ? Number(String(range).split('-')[1]) + 1 : end + 1;
  } else if (code === 200 || code === 201) {
    st.next = st.size;
    st.fileId = JSON.parse(res.getContentText()).id;
  } else {
    throw new Error("L'importation a échoué pour ce fichier (Drive " + code + ').');
  }
  cache.put('up_' + mediaId, JSON.stringify(st), 21600);
  return { next: st.next, done: Boolean(st.fileId) };
}

/** Miniature / aperçu générés par le navigateur : fichiers SÉPARÉS de l'original. */
function uploadDerivative(token, mediaId, kind, base64, mimeType) {
  auth_(token, 'USER');
  if (kind !== 'thumb' && kind !== 'preview') throw new Error('Type de dérivé inconnu.');
  if (mimeType !== 'image/jpeg' && mimeType !== 'image/webp') throw new Error('Format de miniature invalide.');
  if (base64.length > 8 * 1024 * 1024) throw new Error('Miniature trop volumineuse.');
  const blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, mediaId + '_' + kind + (mimeType === 'image/webp' ? '.webp' : '.jpg'));
  const fileId = DriveApp.getFolderById(prop_('THUMBS_FOLDER_ID')).createFile(blob).getId();
  withLock_(function () {
    const m = findById_('Media', mediaId);
    if (!m || m.state !== 'PENDING') { driveDelete_(fileId); throw new Error('Importation introuvable.'); }
    if (kind === 'thumb') m.thumbFileId = fileId; else m.previewFileId = fileId;
    update_('Media', m);
  });
  return true;
}

/** Étape 3 : vérification de l'original (taille exacte) puis publication (READY). */
function finishUpload(token, mediaId, derivs) {
  const s = auth_(token, 'USER');
  const cache = CacheService.getScriptCache();
  const st = JSON.parse(cache.get('up_' + mediaId) || 'null');
  if (!st || !st.fileId) throw new Error("L'importation a échoué pour ce fichier : original non reçu.");
  const info = driveGet_(st.fileId, 'id,size,md5Checksum,imageMediaMetadata(width,height,rotation),videoMediaMetadata(width,height,durationMillis)');
  const media = findById_('Media', mediaId);
  if (!media) throw new Error('Importation introuvable.');
  if (!info || Number(info.size) !== Number(media.fileSize)) {
    driveDelete_(st.fileId);
    throw new Error("L'importation a échoué pour ce fichier : taille reçue incorrecte. Veuillez réessayer.");
  }

  // Miniature + aperçu générés par le navigateur, envoyés avec la finalisation.
  const clientDerivs = {};
  if (derivs && (derivs.mime === 'image/jpeg' || derivs.mime === 'image/webp')) {
    const folder = DriveApp.getFolderById(prop_('THUMBS_FOLDER_ID'));
    const ext = derivs.mime === 'image/webp' ? '.webp' : '.jpg';
    ['thumb', 'preview'].forEach(function (kind) {
      const data = derivs[kind];
      if (!data || data.length > 8 * 1024 * 1024) return;
      try {
        clientDerivs[kind] = folder.createFile(Utilities.newBlob(Utilities.base64Decode(data), derivs.mime, mediaId + '_' + kind + ext)).getId();
      } catch (e) { console.warn(e); }
    });
  }
  // Sans miniature du navigateur (HEIC sous Chrome, RAW, certaines vidéos), elle
  // sera générée plus tard en arrière-plan : l'importation n'attend pas.
  const derivatives = { thumbFileId: clientDerivs.thumb || '', previewFileId: clientDerivs.preview || '' };

  withLock_(function () {
    const m = findById_('Media', mediaId);
    m.driveFileId = st.fileId;
    m.md5 = info.md5Checksum || '';
    if (derivatives.thumbFileId) m.thumbFileId = derivatives.thumbFileId;
    if (derivatives.previewFileId) m.previewFileId = derivatives.previewFileId;
    const im = info.imageMediaMetadata, vm = info.videoMediaMetadata;
    if (!m.width && im && im.width) { const rot = im.rotation === 1 || im.rotation === 3; m.width = rot ? im.height : im.width; m.height = rot ? im.width : im.height; }
    if (!m.width && vm && vm.width) { m.width = vm.width; m.height = vm.height; }
    if (!m.durationSec && vm && vm.durationMillis) m.durationSec = Number(vm.durationMillis) / 1000;
    m.state = 'READY';
    m.uploadedAt = nowIso_();
    update_('Media', m);
    journalUpload_(s, m.categoryName + ' → ' + m.activityName);
  });
  cache.remove('up_' + mediaId);
  return { mediaId: mediaId };
}

/** Annulation d'une importation inachevée : nettoie fichiers et enregistrement. */
function abortUpload(token, mediaId) {
  auth_(token, 'USER');
  const cache = CacheService.getScriptCache();
  const st = JSON.parse(cache.get('up_' + mediaId) || 'null');
  const m = findById_('Media', mediaId);
  if (!m || m.state !== 'PENDING') return true;
  [st && st.fileId, m.thumbFileId, m.previewFileId].forEach(function (id) { try { driveDelete_(id); } catch (e) {} });
  withLock_(function () {
    const row = findById_('Media', mediaId);
    if (row && row.state === 'PENDING') deleteRow_('Media', row);
  });
  cache.remove('up_' + mediaId);
  return true;
}

// =============================================================================
//  Photothèque (ADMIN)
// =============================================================================

function dto_(m) {
  return {
    id: m.id, originalFilename: m.originalFilename, extension: m.extension, mimeType: m.mimeType, mediaType: m.mediaType,
    fileSize: m.fileSize, md5: m.md5, width: m.width, height: m.height, durationSec: m.durationSec,
    captureDate: m.captureDate, captureDateSource: m.captureDateSource, uploadedAt: m.uploadedAt,
    photographer: m.photographer, categoryId: m.categoryId, categoryName: m.categoryName,
    activityId: m.activityId, activityName: m.activityName, status: m.status, sortedAt: m.sortedAt,
    sortedBy: m.sortedBy, uploadedBy: m.uploadedBy, hasThumb: Boolean(m.thumbFileId), hasPreview: Boolean(m.previewFileId),
  };
}

function filterMedia_(rows, f) {
  f = f || {};
  const words = String(f.q || '').toLowerCase().trim().split(/\s+/).filter(String).slice(0, 8);
  const photographer = String(f.photographer || '').toLowerCase().trim();
  const field = f.dateField === 'upload' ? 'uploadedAt' : 'captureDate';
  const out = rows.filter(function (m) {
    if (m.state !== 'READY') return false;
    if (f.status && m.status !== f.status) return false;
    if (f.type && m.mediaType !== f.type) return false;
    if (f.category && m.categoryId !== f.category) return false;
    if (f.activity && m.activityId !== f.activity) return false;
    if (photographer && m.photographer.toLowerCase().indexOf(photographer) < 0) return false;
    if (words.length) {
      const hay = (m.originalFilename + ' ' + m.photographer + ' ' + m.categoryName + ' ' + m.activityName).toLowerCase();
      for (let i = 0; i < words.length; i++) if (hay.indexOf(words[i]) < 0) return false;
    }
    if (f.dateMode) {
      const key = dayKey_(m[field]);
      if (f.dateMode === 'date' && f.date && key !== f.date) return false;
      if (f.dateMode === 'range' && f.from && key < f.from) return false;
      if (f.dateMode === 'range' && f.to && key > f.to) return false;
      if (f.dateMode === 'month' && f.month && key.slice(0, 7) !== f.month) return false;
      if (f.dateMode === 'year' && f.year && key.slice(0, 4) !== String(f.year)) return false;
    }
    return true;
  });
  const sort = f.sort || 'capture_desc';
  const cmp = {
    capture_desc: function (a, b) { return b.captureDate.localeCompare(a.captureDate) || b.id.localeCompare(a.id); },
    capture_asc: function (a, b) { return a.captureDate.localeCompare(b.captureDate) || a.id.localeCompare(b.id); },
    upload_desc: function (a, b) { return b.uploadedAt.localeCompare(a.uploadedAt) || b.id.localeCompare(a.id); },
    upload_asc: function (a, b) { return a.uploadedAt.localeCompare(b.uploadedAt) || a.id.localeCompare(b.id); },
    name_asc: function (a, b) { return a.originalFilename.localeCompare(b.originalFilename, 'fr'); },
    name_desc: function (a, b) { return b.originalFilename.localeCompare(a.originalFilename, 'fr'); },
  }[sort] || function () { return 0; };
  return out.sort(cmp);
}

/** Liste paginée (défilement infini) : métadonnées uniquement, jamais les originaux. */
function listMedia(token, filters, offset, limit) {
  auth_(token, 'ADMIN');
  const rows = filterMedia_(readAll_('Media'), filters);
  const start = Math.max(0, Number(offset) || 0);
  const size = Math.min(Math.max(Number(limit) || 60, 1), CONFIG.PAGE_MAX);
  return { items: rows.slice(start, start + size).map(dto_), total: rows.length };
}

/** « Tout sélectionner » : identifiants de tous les résultats filtrés. */
function listMediaIds(token, filters) {
  auth_(token, 'ADMIN');
  return filterMedia_(readAll_('Media'), filters).slice(0, 10000).map(function (m) { return m.id; });
}

/**
 * Miniatures (data URL). Rapide : une seule lecture de la base, cache, puis
 * téléchargements Drive EN PARALLÈLE (UrlFetchApp.fetchAll).
 */
function getThumbnails(token, ids) {
  auth_(token, 'ADMIN');
  const wanted = (ids || []).slice(0, 120);
  const byId = {};
  readAll_('Media').forEach(function (m) { byId[m.id] = m; });
  const cache = CacheService.getScriptCache();
  const out = {};
  const keys = [];
  wanted.forEach(function (id) {
    const m = byId[id];
    if (!m || m.state !== 'READY' || !m.thumbFileId) { out[id] = null; return; }
    keys.push('th_' + m.thumbFileId);
  });
  const cached = keys.length ? cache.getAll(keys) : {};
  const toFetch = [];
  wanted.forEach(function (id) {
    const m = byId[id];
    if (!m || !m.thumbFileId) return;
    const hit = cached['th_' + m.thumbFileId];
    if (hit) out[id] = hit; else toFetch.push(m);
  });
  if (toFetch.length) {
    const headers = driveHeaders_();
    const responses = UrlFetchApp.fetchAll(toFetch.map(function (m) {
      return { url: 'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(m.thumbFileId) + '?alt=media&supportsAllDrives=true', headers: headers, muteHttpExceptions: true };
    }));
    const toCache = {};
    responses.forEach(function (res, i) {
      const m = toFetch[i];
      if (res.getResponseCode() !== 200) { out[m.id] = null; return; }
      const type = (res.getHeaders()['Content-Type'] || 'image/jpeg').split(';')[0];
      const url = 'data:' + type + ';base64,' + Utilities.base64Encode(res.getContent());
      out[m.id] = url;
      if (url.length < 95000) toCache['th_' + m.thumbFileId] = url;
    });
    if (Object.keys(toCache).length) cache.putAll(toCache, 21600);
  }
  return out;
}

/**
 * Génère, en arrière-plan, les miniatures manquantes (HEIC, RAW, vidéos…)
 * à partir des aperçus calculés par Google Drive. Appelée séparément par
 * l'interface pour ne jamais ralentir l'affichage de la grille.
 */
function generateMissingThumbnails(token, ids) {
  auth_(token, 'ADMIN');
  const byId = {};
  readAll_('Media').forEach(function (m) { byId[m.id] = m; });
  const done = {};
  const started = Date.now();
  (ids || []).slice(0, 10).forEach(function (id) {
    const m = byId[id];
    if (!m || m.state !== 'READY' || m.thumbFileId || (m.thumbAttempts || 0) >= 5) return;
    if (Date.now() - started > 60000) return;
    try { ensureDerivatives_(m); } catch (e) { console.warn(e); }
    const thumb = m.thumbFileId, preview = m.previewFileId;
    withLock_(function () {
      const row = findById_('Media', id);
      if (!row) return;
      row.thumbFileId = row.thumbFileId || thumb;
      row.previewFileId = row.previewFileId || preview;
      if (!row.thumbFileId) row.thumbAttempts = (row.thumbAttempts || 0) + 1;
      update_('Media', row);
    });
    if (thumb) done[id] = true;
  });
  return done;
}

/** Aperçu grand format pour la fiche détaillée (fichier dérivé, pas l'original). */
function getPreview(token, id) {
  auth_(token, 'ADMIN');
  const m = findById_('Media', id);
  if (!m || m.state !== 'READY') throw new Error("Ce média n'existe plus.");
  const fileId = m.previewFileId || m.thumbFileId;
  if (!fileId) return null;
  const blob = DriveApp.getFileById(fileId).getBlob();
  return 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
}

/**
 * Téléchargement de l'ORIGINAL par morceaux (octets bruts lus dans Drive).
 * Le navigateur réassemble le fichier exact, sous son nom d'origine.
 */
function downloadChunk(token, id, offset) {
  auth_(token, 'ADMIN');
  const m = findById_('Media', id);
  if (!m || m.state !== 'READY' || !m.driveFileId) throw new Error("Ce média n'existe plus.");
  const start = Number(offset) || 0;
  const end = Math.min(start + CONFIG.DOWNLOAD_CHUNK_SIZE, m.fileSize) - 1;
  const headers = driveHeaders_();
  headers.Range = 'bytes=' + start + '-' + end;
  const res = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(m.driveFileId) + '?alt=media&supportsAllDrives=true', {
    headers: headers, muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code === 404) throw new Error('Le fichier original est introuvable dans Google Drive.');
  if (code !== 200 && code !== 206) throw new Error('Téléchargement impossible (Drive ' + code + ').');
  const bytes = res.getContent();
  return { data: Utilities.base64Encode(bytes), next: start + bytes.length, size: m.fileSize };
}

/** Changement de statut / correction des métadonnées. */
function updateMedia(token, id, patch) {
  const s = auth_(token, 'ADMIN');
  patch = patch || {};
  let names = null;
  if (patch.categoryId || patch.activityId) names = resolveCatActivity_(patch.categoryId, patch.activityId, false);
  return withLock_(function () {
    const m = findById_('Media', id);
    if (!m || m.state !== 'READY') throw new Error("Ce média n'existe plus.");
    if (patch.status && patch.status !== m.status) {
      if (patch.status !== 'SORTED' && patch.status !== 'TO_SORT') throw new Error('Statut invalide.');
      m.status = patch.status;
      m.sortedAt = patch.status === 'SORTED' ? nowIso_() : '';
      m.sortedBy = patch.status === 'SORTED' ? s.name : '';
      journal_(s, patch.status === 'SORTED' ? 'SORT' : 'UNSORT', m.originalFilename, 1);
    }
    let edited = false;
    if (patch.photographer !== undefined) {
      const p = String(patch.photographer).trim().slice(0, 120);
      if (!p) throw new Error('Le nom du photographe est obligatoire.');
      m.photographer = p; edited = true;
    }
    if (patch.captureDate) {
      const d = new Date(patch.captureDate);
      if (isNaN(d.getTime())) throw new Error('Date invalide.');
      m.captureDate = d.toISOString(); m.captureDateSource = 'MANUAL'; edited = true;
    }
    if (names && (patch.categoryId !== m.categoryId || patch.activityId !== m.activityId)) {
      m.categoryId = patch.categoryId; m.activityId = patch.activityId;
      m.categoryName = names.categoryName; m.activityName = names.activityName; edited = true;
    }
    update_('Media', m);
    if (edited) journal_(s, 'UPDATE', m.originalFilename, 1);
    return dto_(m);
  });
}

function bulkStatus(token, ids, status) {
  const s = auth_(token, 'ADMIN');
  if (status !== 'SORTED' && status !== 'TO_SORT') throw new Error('Statut invalide.');
  return withLock_(function () {
    let count = 0;
    const wanted = {};
    (ids || []).forEach(function (id) { wanted[id] = true; });
    const sh = sheet_('Media');
    readAll_('Media').forEach(function (m) {
      if (!wanted[m.id] || m.state !== 'READY' || m.status === status) return;
      m.status = status;
      m.sortedAt = status === 'SORTED' ? nowIso_() : '';
      m.sortedBy = status === 'SORTED' ? s.name : '';
      update_('Media', m);
      count++;
    });
    if (count) journal_(s, status === 'SORTED' ? 'SORT' : 'UNSORT', '', count);
    return { updated: count };
  });
}

/**
 * Suppression DÉFINITIVE (ADMIN) — original + miniatures + enregistrement.
 * 1. état DELETING (masqué) ; 2. suppression Drive (sans corbeille) ;
 *    échec → état restauré, rien n'est perdu ; 3. suppression de la ligne.
 */
function deleteOne_(id) {
  const m = withLock_(function () {
    const row = findById_('Media', id);
    if (!row) return null;
    const previous = row.state;
    row.state = 'DELETING';
    update_('Media', row);
    row._previous = previous;
    return row;
  });
  if (!m) return { id: id, ok: false, error: "Ce média n'existe plus." };

  try {
    driveDelete_(m.thumbFileId);
    driveDelete_(m.previewFileId);
    driveDelete_(m.driveFileId);
  } catch (e) {
    withLock_(function () {
      const row = findById_('Media', id);
      if (row) { row.state = m._previous; update_('Media', row); }
    });
    return { id: id, ok: false, error: 'Impossible de supprimer ce média. Veuillez réessayer.' };
  }
  try {
    withLock_(function () {
      const row = findById_('Media', id);
      if (row) deleteRow_('Media', row);
    });
  } catch (e) {
    return { id: id, ok: false, error: "Fichiers supprimés mais l'enregistrement n'a pas pu être effacé. Relancez le nettoyage dans Paramètres." };
  }
  return { id: id, ok: true, name: m.originalFilename };
}

function deleteMedia(token, ids) {
  const s = auth_(token, 'ADMIN');
  const unique = (ids || []).filter(function (id, i, arr) { return id && arr.indexOf(id) === i; });
  if (!unique.length) throw new Error('Aucun média sélectionné.');
  const deleted = [], failed = [];
  const started = Date.now();
  unique.forEach(function (id) {
    if (Date.now() - started > 300000) { failed.push({ id: id, error: 'Temps dépassé : relancez la suppression pour les médias restants.' }); return; }
    const r = deleteOne_(id);
    if (r.ok) deleted.push(r); else failed.push({ id: id, error: r.error });
  });
  if (deleted.length) {
    const names = deleted.slice(0, 5).map(function (r) { return r.name; }).join(', ');
    journal_(s, 'DELETE', deleted.length > 5 ? names + '…' : names, deleted.length);
  }
  return { deleted: deleted.map(function (r) { return r.id; }), failed: failed };
}

// =============================================================================
//  Tableau de bord (ADMIN) — chiffres calculés depuis la base
// =============================================================================

function getDashboard(token) {
  const s = auth_(token, 'ADMIN');
  const ready = readAll_('Media').filter(function (m) { return m.state === 'READY'; });
  const now = new Date();
  const dow = Number(Utilities.formatDate(now, CONFIG.TIMEZONE, 'u')); // 1 = lundi
  const weekStart = Utilities.formatDate(new Date(now.getTime() - (dow - 1) * 86400000), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  const monthKey = Utilities.formatDate(now, CONFIG.TIMEZONE, 'yyyy-MM');

  const stats = { total: ready.length, toSort: 0, sorted: 0, photos: 0, videos: 0, thisWeek: 0, thisMonth: 0, totalBytes: 0 };
  const byCategory = {};
  ready.forEach(function (m) {
    if (m.status === 'TO_SORT') stats.toSort++; else stats.sorted++;
    if (m.mediaType === 'VIDEO') stats.videos++; else stats.photos++;
    const k = dayKey_(m.uploadedAt);
    if (k >= weekStart) stats.thisWeek++;
    if (k.slice(0, 7) === monthKey) stats.thisMonth++;
    stats.totalBytes += m.fileSize || 0;
    byCategory[m.categoryId] = (byCategory[m.categoryId] || 0) + 1;
  });

  const catNames = {};
  readAll_('Categories').forEach(function (c) { catNames[c.id] = c.name; });
  const breakdown = Object.keys(byCategory).map(function (id) {
    return { id: id, name: catNames[id] || 'Sans catégorie', count: byCategory[id] };
  }).sort(function (a, b) { return b.count - a.count; });

  const recent = ready.slice().sort(function (a, b) { return b.uploadedAt.localeCompare(a.uploadedAt); }).slice(0, 12).map(dto_);
  const toSort = ready.filter(function (m) { return m.status === 'TO_SORT'; })
    .sort(function (a, b) { return a.uploadedAt.localeCompare(b.uploadedAt); }).slice(0, 6).map(dto_);

  const jsh = sheet_('Journal');
  const last = jsh.getLastRow();
  let journal = [];
  if (last >= 2) {
    const from = Math.max(2, last - 14);
    journal = jsh.getRange(from, 1, last - from + 1, SHEETS.Journal.length).getValues()
      .map(function (r, i) { return rowToObj_('Journal', r, from + i); }).reverse();
  }
  return { name: s.name, stats: stats, breakdown: breakdown, recent: recent, toSort: toSort, journal: journal };
}

// =============================================================================
//  Paramètres & maintenance (ADMIN)
// =============================================================================

function getSettings(token) {
  const s = auth_(token, 'ADMIN');
  const rows = readAll_('Media');
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  return {
    name: s.name,
    stalePending: rows.filter(function (m) { return m.state === 'PENDING' && m.uploadedAt < dayAgo; }).length,
    deleting: rows.filter(function (m) { return m.state === 'DELETING'; }).length,
    spreadsheetUrl: db_().getUrl(),
    folderUrl: DriveApp.getFolderById(prop_('ROOT_FOLDER_ID')).getUrl(),
    maxUploadMb: Math.round(CONFIG.MAX_UPLOAD_BYTES / 1048576),
  };
}

/** Nettoie les importations interrompues (> 24 h) et relance les suppressions inachevées. */
function cleanup(token) {
  const s = auth_(token, 'ADMIN');
  const dayAgo = new Date(Date.now() - 86400000).toISOString();
  const targets = readAll_('Media').filter(function (m) {
    return m.state === 'DELETING' || (m.state === 'PENDING' && m.uploadedAt < dayAgo);
  });
  let cleaned = 0, failed = 0;
  targets.slice(0, 200).forEach(function (m) {
    const r = deleteOne_(m.id);
    if (r.ok) cleaned++; else failed++;
  });
  if (cleaned) journal_(s, 'MAINTENANCE', cleaned + ' élément(s) nettoyé(s)', cleaned);
  return { cleaned: cleaned, failed: failed };
}
