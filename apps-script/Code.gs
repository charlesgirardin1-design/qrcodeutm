/**
 * =============================================================================
 *  PHOTOTHÈQUE — Croix-Rouge française, UL Boulogne-Billancourt
 *  Google Apps Script : Code.gs (serveur)
 *
 *  Stockage : Google Drive (originaux conservés OCTET POUR OCTET)
 *  Base     : Google Sheets (créée automatiquement par setup())
 *
 *  Installation : coller ce fichier dans Code.gs (aucun autre fichier n'est
 *  nécessaire en dehors de appsscript.json), exécuter une fois setup(), puis
 *  Déployer > Nouveau déploiement > Application Web.
 * =============================================================================
 */

const CONFIG = {
  TIMEZONE: 'Europe/Paris',
  // Taille des morceaux d'envoi : multiple de 256 Ko (exigence de l'API Drive).
  CHUNK_SIZE: 5 * 1024 * 1024,
  DOWNLOAD_CHUNK_SIZE: 6 * 1024 * 1024,
  MAX_UPLOAD_BYTES: 4 * 1024 * 1024 * 1024,
  SESSION_HOURS: { USER: 168, ADMIN: 12 },
  PAGE_MAX: 120,
  THUMB_SIZE: 480,
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
 * L'interface (Index.html) est intégrée dans ce fichier, encodée en base64 dans
 * INDEX_HTML_B64 tout en bas : un seul fichier à copier, pas de fichier HTML
 * séparé à nommer. Elle est générée depuis Index.html par build.mjs.
 */
function doGet() {
  const html = Utilities.newBlob(Utilities.base64Decode(INDEX_HTML_B64.join(''))).getDataAsString('UTF-8');
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

function prop_(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
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
  const pw = PropertiesService.getScriptProperties().getProperty(role === 'ADMIN' ? 'ADMIN_PASSWORD' : 'USER_PASSWORD') || '';
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

  const pw = String(password || '');
  const props = PropertiesService.getScriptProperties();
  const isAdmin = hash_(pw) === hash_(props.getProperty('ADMIN_PASSWORD') || '\u0000');
  const isUser = hash_(pw) === hash_(props.getProperty('USER_PASSWORD') || '\u0000');
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

function monthFolder_(isoDate) {
  const parent = DriveApp.getFolderById(prop_('ORIGINALS_FOLDER_ID'));
  const name = Utilities.formatDate(new Date(isoDate), CONFIG.TIMEZONE, 'yyyy-MM');
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
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
  const sessionUri = createResumableSession_(filename, format.mime, size, monthFolder_(capture.toISOString()).getId());
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
function finishUpload(token, mediaId) {
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

  const derivatives = {};
  if (!media.thumbFileId) {
    media.driveFileId = st.fileId;
    try { ensureDerivatives_(media); } catch (e) { console.warn(e); }
    derivatives.thumbFileId = media.thumbFileId;
    derivatives.previewFileId = media.previewFileId;
  }

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

/** Miniatures (data URL) — avec génération différée via Drive si absentes. */
function getThumbnails(token, ids) {
  auth_(token, 'ADMIN');
  const cache = CacheService.getScriptCache();
  const out = {};
  let generated = 0;
  (ids || []).slice(0, 120).forEach(function (id) {
    let m = findById_('Media', id);
    if (!m || m.state !== 'READY') return;
    if (!m.thumbFileId && (m.thumbAttempts || 0) < 5 && generated < 4) {
      generated++;
      try { ensureDerivatives_(m); } catch (e) { console.warn(e); }
      const thumb = m.thumbFileId, preview = m.previewFileId;
      withLock_(function () {
        const row = findById_('Media', id);
        if (!row) return;
        row.thumbFileId = row.thumbFileId || thumb;
        row.previewFileId = row.previewFileId || preview;
        if (!row.thumbFileId) row.thumbAttempts = (row.thumbAttempts || 0) + 1;
        update_('Media', row);
        m = row;
      });
    }
    if (!m.thumbFileId) { out[id] = null; return; }
    const cached = cache.get('th_' + m.thumbFileId);
    if (cached) { out[id] = cached; return; }
    try {
      const blob = DriveApp.getFileById(m.thumbFileId).getBlob();
      const url = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
      if (url.length < 95000) cache.put('th_' + m.thumbFileId, url, 21600);
      out[id] = url;
    } catch (e) {
      out[id] = null;
    }
  });
  return out;
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

// ==== INTERFACE INTÉGRÉE (générée depuis Index.html — ne pas modifier) ====
const INDEX_HTML_B64 = [
  'PCFET0NUWVBFIGh0bWw+CjxodG1sIGxhbmc9ImZyIj4KPGhlYWQ+CjxiYXNlIHRhcmdldD0iX3RvcCI+CjxtZXRhIGNoYXJzZXQ9InV0Zi04Ij4KPHNjcmlwdCBzcmM9Imh0dHBzOi8vY2RuLmpzZGVsaXZyLm5ldC9ucG0vZXhpZnJANy4xLjMvZGlzdC9saXRlLnVtZC5qcyI+PC9zY3JpcHQ+CjxzdHlsZT4KOnJvb3R7LS1yZWQ6I0UzMDAwRjstLXJlZC1kOiNiODAwMGM7LS1yZWQtc29mdDojZmRlY2VjOy0tZ3JlZW46IzE1ODAzZDstLWdyZWVuLXNvZnQ6I2VjZmRmMzstLWZnOiMxMTE4Mjc7LS1tdXRlZDojNmI3MjgwOy0tYm9yZGVyOiNlNWU3ZWI7LS1iZzojZjhmOWZiOy0tY2FyZDojZmZmOy0tcmFkaXVzOjEycHh9Cip7Ym94LXNpemluZzpib3JkZXItYm94fWh0bWwsYm9keXttYXJnaW46MDtwYWRkaW5nOjB9CmJvZHl7Zm9udC1mYW1pbHk6SW50ZXIsdWktc2Fucy1zZXJpZixzeXN0ZW0tdWksLWFwcGxlLXN5c3RlbSwiU2Vnb2UgVUkiLFJvYm90byxBcmlhbCxzYW5zLXNlcmlmO2NvbG9yOnZhcigtLWZnKTtiYWNrZ3JvdW5kOnZhcigtLWJnKTtmb250LXNpemU6MTRweDstd2Via2l0LWZvbnQtc21vb3RoaW5nOmFudGlhbGlhc2VkfQpidXR0b24saW5wdXQsc2VsZWN0e2ZvbnQ6aW5oZXJpdDtjb2xvcjppbmhlcml0fQpoMXtmb250LXNpemU6MjRweDttYXJnaW46MCAwIDRweDtsZXR0ZXItc3BhY2luZzotLjAyZW19aDJ7Zm9udC1zaXplOjE1cHg7bWFyZ2luOjB9Ci5tdXRlZHtjb2xvcjp2YXIoLS1tdXRlZCl9LnNt',
  'YWxse2ZvbnQtc2l6ZToxMnB4fS5oaWRkZW57ZGlzcGxheTpub25lIWltcG9ydGFudH0KLmJ0bntkaXNwbGF5OmlubGluZS1mbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2dhcDo2cHg7aGVpZ2h0OjM4cHg7cGFkZGluZzowIDE0cHg7Ym9yZGVyLXJhZGl1czo4cHg7Ym9yZGVyOjFweCBzb2xpZCB0cmFuc3BhcmVudDtmb250LXdlaWdodDo2MDA7Y3Vyc29yOnBvaW50ZXI7d2hpdGUtc3BhY2U6bm93cmFwO2JhY2tncm91bmQ6I2ZmZn0KLmJ0bjpkaXNhYmxlZHtvcGFjaXR5Oi41O2N1cnNvcjpub3QtYWxsb3dlZH0KLmJ0bi1wcmltYXJ5e2JhY2tncm91bmQ6dmFyKC0tcmVkKTtjb2xvcjojZmZmfS5idG4tcHJpbWFyeTpob3Zlcjpub3QoOmRpc2FibGVkKXtiYWNrZ3JvdW5kOnZhcigtLXJlZC1kKX0KLmJ0bi1zdWNjZXNze2JhY2tncm91bmQ6dmFyKC0tZ3JlZW4pO2NvbG9yOiNmZmZ9Ci5idG4tb3V0bGluZXtib3JkZXItY29sb3I6dmFyKC0tYm9yZGVyKTtiYWNrZ3JvdW5kOiNmZmZ9LmJ0bi1vdXRsaW5lOmhvdmVyOm5vdCg6ZGlzYWJsZWQpe2JhY2tncm91bmQ6I2YzZjRmNn0KLmJ0bi1naG9zdHtiYWNrZ3JvdW5kOnRyYW5zcGFyZW50fS5idG4tZ2hvc3Q6aG92ZXI6bm90KDpkaXNhYmxlZCl7YmFja2dyb3VuZDojZjNmNGY2fQouYnRuLWRhbmdlcntiYWNrZ3JvdW5kOnZhcigtLXJlZCk7Y29sb3I6I2ZmZn0KLmJ0bi1kYW5nZXItb3V0bGluZXtib3JkZXItY29sb3I6I2ZlY2FjYTtj',
  'b2xvcjp2YXIoLS1yZWQpO2JhY2tncm91bmQ6I2ZmZn0uYnRuLWRhbmdlci1vdXRsaW5lOmhvdmVye2JhY2tncm91bmQ6dmFyKC0tcmVkLXNvZnQpfQouYnRuLXNte2hlaWdodDozMnB4O3BhZGRpbmc6MCAxMHB4O2ZvbnQtc2l6ZToxM3B4fS5idG4tYmxvY2t7d2lkdGg6MTAwJX0KLmlucHV0LC5zZWxlY3R7aGVpZ2h0OjM4cHg7d2lkdGg6MTAwJTtib3JkZXI6MXB4IHNvbGlkICNkMWQ1ZGI7Ym9yZGVyLXJhZGl1czo4cHg7cGFkZGluZzowIDEwcHg7YmFja2dyb3VuZDojZmZmfQouaW5wdXQ6Zm9jdXMsLnNlbGVjdDpmb2N1c3tvdXRsaW5lOjJweCBzb2xpZCAjOWNhM2FmO291dGxpbmUtb2Zmc2V0OjB9CmxhYmVsLmxibHtkaXNwbGF5OmJsb2NrO2ZvbnQtd2VpZ2h0OjYwMDtmb250LXNpemU6MTNweDttYXJnaW4tYm90dG9tOjZweH0KLmNhcmR7YmFja2dyb3VuZDp2YXIoLS1jYXJkKTtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czp2YXIoLS1yYWRpdXMpO2JveC1zaGFkb3c6MCAxcHggMnB4IHJnYmEoMCwwLDAsLjA0KX0KLmJhZGdle2Rpc3BsYXk6aW5saW5lLWZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2JvcmRlci1yYWRpdXM6OTk5cHg7cGFkZGluZzoycHggOHB4O2ZvbnQtc2l6ZToxMXB4O2ZvbnQtd2VpZ2h0OjcwMDt0ZXh0LXRyYW5zZm9ybTp1cHBlcmNhc2U7bGV0dGVyLXNwYWNpbmc6LjAzZW19Ci5iYWRnZS10b2Rve2JhY2tncm91bmQ6dmFyKC0tcmVkLXNvZnQpO2NvbG9yOiNi',
  'OTFjMWM7Ym94LXNoYWRvdzppbnNldCAwIDAgMCAxcHggI2ZlY2FjYX0KLmJhZGdlLWRvbmV7YmFja2dyb3VuZDp2YXIoLS1ncmVlbi1zb2Z0KTtjb2xvcjojMTU4MDNkO2JveC1zaGFkb3c6aW5zZXQgMCAwIDAgMXB4ICNiYmY3ZDB9Ci5iYWRnZS1kYXJre2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuNyk7Y29sb3I6I2ZmZn0KLnNwaW57d2lkdGg6MTZweDtoZWlnaHQ6MTZweDtib3JkZXI6MnB4IHNvbGlkIGN1cnJlbnRDb2xvcjtib3JkZXItcmlnaHQtY29sb3I6dHJhbnNwYXJlbnQ7Ym9yZGVyLXJhZGl1czo1MCU7YW5pbWF0aW9uOnNwaW4gLjdzIGxpbmVhciBpbmZpbml0ZTtkaXNwbGF5OmlubGluZS1ibG9ja30KQGtleWZyYW1lcyBzcGlue3Rve3RyYW5zZm9ybTpyb3RhdGUoMzYwZGVnKX19Ci5jcm9zc3t3aWR0aDoyOHB4O2hlaWdodDoyOHB4O2ZsZXg6bm9uZX0KLyogQ29ubmV4aW9uICovCi5sb2dpbnttaW4taGVpZ2h0OjEwMHZoO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtwYWRkaW5nOjI0cHg7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoI2Y5ZmFmYiwjZmZmKX0KLmxvZ2luIC5ib3h7d2lkdGg6MTAwJTttYXgtd2lkdGg6MzYwcHg7dGV4dC1hbGlnbjpjZW50ZXJ9Ci5sb2dpbiAubG9nb3t3aWR0aDo2NHB4O2hlaWdodDo2NHB4O21hcmdpbjowIGF1dG8gMTZweDtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czoxNnB4O2Jh',
  'Y2tncm91bmQ6I2ZmZjtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXJ9Ci5wd3twb3NpdGlvbjpyZWxhdGl2ZX0ucHcgLmlucHV0e2hlaWdodDo0NHB4O3BhZGRpbmctcmlnaHQ6NDRweDtmb250LXNpemU6MTZweH0KLnB3IGJ1dHRvbntwb3NpdGlvbjphYnNvbHV0ZTtyaWdodDo2cHg7dG9wOjZweDtoZWlnaHQ6MzJweDt3aWR0aDozMnB4O2JvcmRlcjowO2JhY2tncm91bmQ6bm9uZTtjdXJzb3I6cG9pbnRlcjtjb2xvcjp2YXIoLS1tdXRlZCl9Ci5hbGVydHtiYWNrZ3JvdW5kOnZhcigtLXJlZC1zb2Z0KTtjb2xvcjojYjkxYzFjO2JvcmRlci1yYWRpdXM6OHB4O3BhZGRpbmc6OHB4IDEycHg7Zm9udC1zaXplOjEzcHg7dGV4dC1hbGlnbjpsZWZ0fQovKiBNaXNlIGVuIHBhZ2UgKi8KLnNoZWxse2Rpc3BsYXk6ZmxleDttaW4taGVpZ2h0OjEwMHZofQouc2lkZXt3aWR0aDoyNDBweDtmbGV4Om5vbmU7YmFja2dyb3VuZDojZmZmO2JvcmRlci1yaWdodDoxcHggc29saWQgdmFyKC0tYm9yZGVyKTtwYWRkaW5nOjIwcHggMTJweDtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO3Bvc2l0aW9uOnN0aWNreTt0b3A6MDtoZWlnaHQ6MTAwdmh9Ci5icmFuZHtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDoxMHB4O3BhZGRpbmc6MCA4cHg7bWFyZ2luLWJvdHRvbToyOHB4fQouYnJhbmQgYntkaXNwbGF5OmJsb2NrO2ZvbnQtc2l6ZToxNHB4fS5icmFuZCBz',
  'cGFue2ZvbnQtc2l6ZToxMXB4O2NvbG9yOnZhcigtLW11dGVkKX0KLm5hdiBhe2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7Z2FwOjEwcHg7cGFkZGluZzoxMHB4IDEycHg7Ym9yZGVyLXJhZGl1czo4cHg7Y29sb3I6dmFyKC0tbXV0ZWQpO2ZvbnQtd2VpZ2h0OjUwMDt0ZXh0LWRlY29yYXRpb246bm9uZTtjdXJzb3I6cG9pbnRlcn0KLm5hdiBhOmhvdmVye2JhY2tncm91bmQ6I2YzZjRmNjtjb2xvcjp2YXIoLS1mZyl9Lm5hdiBhLmFjdGl2ZXtiYWNrZ3JvdW5kOiNmM2Y0ZjY7Y29sb3I6dmFyKC0tZmcpfS5uYXYgYS5hY3RpdmUgLmlje2NvbG9yOnZhcigtLXJlZCl9Ci5tYWlue2ZsZXg6MTttaW4td2lkdGg6MDtwYWRkaW5nOjI4cHggMzJweCA0MHB4fQoudG9wYmFye2Rpc3BsYXk6bm9uZX0KLmJvdHRvbW5hdntkaXNwbGF5Om5vbmV9Ci51c2VyaGVhZHtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyLWJvdHRvbToxcHggc29saWQgdmFyKC0tYm9yZGVyKTtwb3NpdGlvbjpzdGlja3k7dG9wOjA7ei1pbmRleDoyMH0KLnVzZXJoZWFkIC5pbnttYXgtd2lkdGg6MTAwMHB4O21hcmdpbjowIGF1dG87aGVpZ2h0OjU2cHg7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjtwYWRkaW5nOjAgMTZweH0KLnVzZXJtYWlue21heC13aWR0aDoxMDAwcHg7bWFyZ2luOjAgYXV0bztwYWRkaW5nOjI0cHggMTZweH0KQG1lZGlhIChtYXgtd2lkdGg6MTAyM3B4KXsKICAuc2lk',
  'ZXtkaXNwbGF5Om5vbmV9Lm1haW57cGFkZGluZzoxNnB4IDE2cHggOTZweH0KICAudG9wYmFye2Rpc3BsYXk6ZmxleDtwb3NpdGlvbjpzdGlja3k7dG9wOjA7ei1pbmRleDoyMDtoZWlnaHQ6NTZweDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OnNwYWNlLWJldHdlZW47cGFkZGluZzowIDE2cHg7YmFja2dyb3VuZDojZmZmO2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWJvcmRlcil9CiAgLmJvdHRvbW5hdntkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOnJlcGVhdCg1LDFmcik7cG9zaXRpb246Zml4ZWQ7Ym90dG9tOjA7bGVmdDowO3JpZ2h0OjA7ei1pbmRleDozMDtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tYm9yZGVyKTtwYWRkaW5nLWJvdHRvbTplbnYoc2FmZS1hcmVhLWluc2V0LWJvdHRvbSl9CiAgLmJvdHRvbW5hdiBhe2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47YWxpZ24taXRlbXM6Y2VudGVyO2dhcDozcHg7cGFkZGluZzo5cHggMDtmb250LXNpemU6MTFweDtjb2xvcjp2YXIoLS1tdXRlZCk7dGV4dC1kZWNvcmF0aW9uOm5vbmU7Y3Vyc29yOnBvaW50ZXJ9CiAgLmJvdHRvbW5hdiBhLmFjdGl2ZXtjb2xvcjp2YXIoLS1yZWQpfQp9Ci5pY3t3aWR0aDoxOHB4O2hlaWdodDoxOHB4O2ZsZXg6bm9uZX0KLnJvd3tkaXNwbGF5OmZsZXg7Z2FwOjhweDthbGlnbi1pdGVtczpjZW50ZXI7ZmxleC13cmFwOndyYXB9Ci5iZXR3ZWVu',
  'e2Rpc3BsYXk6ZmxleDtqdXN0aWZ5LWNvbnRlbnQ6c3BhY2UtYmV0d2VlbjthbGlnbi1pdGVtczpmbGV4LWVuZDtnYXA6MTJweDtmbGV4LXdyYXA6d3JhcH0KLmdyaWQze2Rpc3BsYXk6Z3JpZDtnYXA6MTZweDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsMWZyKX0KQG1lZGlhIChtYXgtd2lkdGg6NzYwcHgpey5ncmlkM3tncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfX0KLnNlY3Rpb257bWFyZ2luLXRvcDoyMHB4fQovKiBJbXBvcnQgKi8KLmRyb3B7Ym9yZGVyOjJweCBkYXNoZWQgI2QxZDVkYjtib3JkZXItcmFkaXVzOnZhcigtLXJhZGl1cyk7YmFja2dyb3VuZDojZmZmO3BhZGRpbmc6MzZweCAxNnB4O3RleHQtYWxpZ246Y2VudGVyfQouZHJvcC5kcmFne2JvcmRlci1jb2xvcjp2YXIoLS1yZWQpO2JhY2tncm91bmQ6I2ZmZjdmN30KLmZpbGVsaXN0e2xpc3Qtc3R5bGU6bm9uZTttYXJnaW46MDtwYWRkaW5nOjB9Ci5maWxlbGlzdCBsaXtkaXNwbGF5OmZsZXg7Z2FwOjEycHg7YWxpZ24taXRlbXM6Y2VudGVyO3BhZGRpbmc6MTJweCAxNnB4O2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7ZmxleC13cmFwOndyYXB9Ci5mdGh1bWJ7d2lkdGg6NjBweDtoZWlnaHQ6NjBweDtib3JkZXItcmFkaXVzOjhweDtiYWNrZ3JvdW5kOiNmM2Y0ZjY7ZmxleDpub25lO292ZXJmbG93OmhpZGRlbjtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7cG9zaXRpb246',
  'cmVsYXRpdmU7Zm9udC1zaXplOjEwcHg7Zm9udC13ZWlnaHQ6NzAwO2NvbG9yOnZhcigtLW11dGVkKX0KLmZ0aHVtYiBpbWd7d2lkdGg6MTAwJTtoZWlnaHQ6MTAwJTtvYmplY3QtZml0OmNvdmVyfQouZmluZm97ZmxleDoxO21pbi13aWR0aDoxNjBweH0uZmluZm8gLm5hbWV7Zm9udC13ZWlnaHQ6NjAwO292ZXJmbG93OmhpZGRlbjt0ZXh0LW92ZXJmbG93OmVsbGlwc2lzO3doaXRlLXNwYWNlOm5vd3JhcH0KLmJhcntoZWlnaHQ6NHB4O2JhY2tncm91bmQ6I2YzZjRmNjtib3JkZXItcmFkaXVzOjRweDtvdmVyZmxvdzpoaWRkZW47bWFyZ2luLXRvcDo2cHh9LmJhcj5kaXZ7aGVpZ2h0OjEwMCU7YmFja2dyb3VuZDp2YXIoLS1yZWQpO3RyYW5zaXRpb246d2lkdGggLjJzfQouYmFyLm9rPmRpdntiYWNrZ3JvdW5kOnZhcigtLWdyZWVuKX0KLmVycntjb2xvcjp2YXIoLS1yZWQpO2ZvbnQtc2l6ZToxMnB4O2ZvbnQtd2VpZ2h0OjYwMDttYXJnaW4tdG9wOjRweH0KLndhcm57Y29sb3I6I2I0NTMwOX0KLyogUGhvdG90aMOocXVlICovCi5zZWd7ZGlzcGxheTppbmxpbmUtZmxleDtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7YmFja2dyb3VuZDojZjlmYWZiO2JvcmRlci1yYWRpdXM6OXB4O3BhZGRpbmc6MnB4fQouc2VnIGJ1dHRvbntib3JkZXI6MDtiYWNrZ3JvdW5kOm5vbmU7cGFkZGluZzo2cHggMTJweDtib3JkZXItcmFkaXVzOjdweDtjb2xvcjp2YXIoLS1tdXRlZCk7Zm9udC13ZWlnaHQ6NTAwO2N1cnNvcjpwb2lu',
  'dGVyfQouc2VnIGJ1dHRvbi5vbntiYWNrZ3JvdW5kOiNmZmY7Y29sb3I6dmFyKC0tZmcpO2JveC1zaGFkb3c6MCAxcHggMnB4IHJnYmEoMCwwLDAsLjA4KX0KLm1ncmlke2Rpc3BsYXk6Z3JpZDtnYXA6MTRweDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KGF1dG8tZmlsbCxtaW5tYXgoMTgwcHgsMWZyKSk7bWFyZ2luLXRvcDoxNHB4fQpAbWVkaWEgKG1heC13aWR0aDo1MjBweCl7Lm1ncmlke2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoMiwxZnIpO2dhcDoxMHB4fX0KLm1jYXJke2JhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czp2YXIoLS1yYWRpdXMpO292ZXJmbG93OmhpZGRlbjtwb3NpdGlvbjpyZWxhdGl2ZX0KLm1jYXJkLnNlbHtvdXRsaW5lOjJweCBzb2xpZCB2YXIoLS1mZyk7b3V0bGluZS1vZmZzZXQ6MnB4fQoubWNhcmQgLnBoe2FzcGVjdC1yYXRpbzoxO2JhY2tncm91bmQ6I2YzZjRmNjtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Y3Vyc29yOnBvaW50ZXI7cG9zaXRpb246cmVsYXRpdmU7b3ZlcmZsb3c6aGlkZGVuO3dpZHRoOjEwMCU7Ym9yZGVyOjA7cGFkZGluZzowfQoubWNhcmQgLnBoIGltZ3t3aWR0aDoxMDAlO2hlaWdodDoxMDAlO29iamVjdC1maXQ6Y292ZXJ9Ci5tY2FyZCAubWV0YXtwYWRkaW5nOjlweCAxMHB4fS5tY2FyZCAubWV0YSBkaXZ7d2hpdGUtc3BhY2U6bm93cmFw',
  'O292ZXJmbG93OmhpZGRlbjt0ZXh0LW92ZXJmbG93OmVsbGlwc2lzfQoubWNhcmQgLnN0e3Bvc2l0aW9uOmFic29sdXRlO3RvcDo4cHg7cmlnaHQ6OHB4fQoubWNhcmQgLnZke3Bvc2l0aW9uOmFic29sdXRlO2JvdHRvbTo4cHg7bGVmdDo4cHh9Ci5tY2FyZCAucGxheXtwb3NpdGlvbjphYnNvbHV0ZTtpbnNldDowO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcn0KLm1jYXJkIC5wbGF5IHNwYW57d2lkdGg6NDJweDtoZWlnaHQ6NDJweDtib3JkZXItcmFkaXVzOjUwJTtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjU1KTtkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXI7Y29sb3I6I2ZmZn0KLmNoa3t3aWR0aDoyMHB4O2hlaWdodDoyMHB4O2JvcmRlci1yYWRpdXM6NnB4O2JvcmRlcjoycHggc29saWQgI2QxZDVkYjtiYWNrZ3JvdW5kOnJnYmEoMjU1LDI1NSwyNTUsLjk1KTtkaXNwbGF5OmlubGluZS1mbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2N1cnNvcjpwb2ludGVyO2ZsZXg6bm9uZTtwYWRkaW5nOjB9Ci5jaGsub257YmFja2dyb3VuZDp2YXIoLS1mZyk7Ym9yZGVyLWNvbG9yOnZhcigtLWZnKTtjb2xvcjojZmZmfQoubWNhcmQgLmNoa3twb3NpdGlvbjphYnNvbHV0ZTt0b3A6OHB4O2xlZnQ6OHB4O3otaW5kZXg6Mn0KLnNlbGJhcntwb3NpdGlvbjpmaXhlZDtsZWZ0OjA7cmlnaHQ6MDti',
  'b3R0b206MjBweDt6LWluZGV4OjQwO3BhZGRpbmc6MCAxMnB4fQpAbWVkaWEgKG1pbi13aWR0aDoxMDI0cHgpey5zZWxiYXJ7bGVmdDoyNDBweH19CkBtZWRpYSAobWF4LXdpZHRoOjEwMjNweCl7LnNlbGJhcntib3R0b206NzJweH19Ci5zZWxiYXIgLmlue21heC13aWR0aDo5MDBweDttYXJnaW46MCBhdXRvO2JhY2tncm91bmQ6I2ZmZjtib3JkZXI6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7Ym9yZGVyLXJhZGl1czoxNnB4O2JveC1zaGFkb3c6MCAxMHB4IDMwcHggcmdiYSgwLDAsMCwuMTUpO3BhZGRpbmc6MTBweDtkaXNwbGF5OmZsZXg7Z2FwOjhweDthbGlnbi1pdGVtczpjZW50ZXI7ZmxleC13cmFwOndyYXB9Ci5maWx0ZXJze2Rpc3BsYXk6Z3JpZDtnYXA6MTRweDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDQsMWZyKTtwYWRkaW5nOjE2cHg7bWFyZ2luLXRvcDoxMnB4fQpAbWVkaWEgKG1heC13aWR0aDo5MDBweCl7LmZpbHRlcnN7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjFmciAxZnJ9fUBtZWRpYSAobWF4LXdpZHRoOjUyMHB4KXsuZmlsdGVyc3tncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyfX0KLnNrZWx7YXNwZWN0LXJhdGlvOjE7YmFja2dyb3VuZDpsaW5lYXItZ3JhZGllbnQoOTBkZWcsI2YzZjRmNiwjZTllYWVlLCNmM2Y0ZjYpO2JhY2tncm91bmQtc2l6ZToyMDAlIDEwMCU7YW5pbWF0aW9uOnNoIDEuMnMgaW5maW5pdGU7Ym9yZGVyLXJhZGl1czp2YXIoLS1yYWRpdXMpfQpAa2V5ZnJhbWVzIHNoe3Rv',
  'e2JhY2tncm91bmQtcG9zaXRpb246LTIwMCUgMH19Ci8qIE1vZGFsZSAqLwoub3ZlcmxheXtwb3NpdGlvbjpmaXhlZDtpbnNldDowO2JhY2tncm91bmQ6cmdiYSgwLDAsMCwuOCk7ei1pbmRleDo1MDtkaXNwbGF5OmZsZXh9Ci5kZXRhaWx7YmFja2dyb3VuZDojZmZmO21hcmdpbjoyNHB4O2JvcmRlci1yYWRpdXM6MTZweDtvdmVyZmxvdzpoaWRkZW47ZGlzcGxheTpmbGV4O2ZsZXg6MX0KLnZpZXdlcntmbGV4OjE7YmFja2dyb3VuZDojMGEwYTBhO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtwb3NpdGlvbjpyZWxhdGl2ZTttaW4taGVpZ2h0OjQwdmh9Ci52aWV3ZXIgaW1nLC52aWV3ZXIgdmlkZW97bWF4LXdpZHRoOjEwMCU7bWF4LWhlaWdodDoxMDAlO29iamVjdC1maXQ6Y29udGFpbn0KLnZpZXdlciAubnZ7cG9zaXRpb246YWJzb2x1dGU7dG9wOjUwJTt0cmFuc2Zvcm06dHJhbnNsYXRlWSgtNTAlKTt3aWR0aDo0MHB4O2hlaWdodDo0MHB4O2JvcmRlci1yYWRpdXM6NTAlO2JvcmRlcjowO2JhY2tncm91bmQ6cmdiYSgyNTUsMjU1LDI1NSwuMTIpO2NvbG9yOiNmZmY7Zm9udC1zaXplOjIycHg7Y3Vyc29yOnBvaW50ZXJ9Ci5pbmZve3dpZHRoOjM4MHB4O2ZsZXg6bm9uZTtkaXNwbGF5OmZsZXg7ZmxleC1kaXJlY3Rpb246Y29sdW1uO292ZXJmbG93LXk6YXV0bztib3JkZXItbGVmdDoxcHggc29saWQgdmFyKC0tYm9yZGVyKX0KLmluZm8gZGx7ZGlzcGxheTpncmlkO2dy',
  'aWQtdGVtcGxhdGUtY29sdW1uczphdXRvIDFmcjtnYXA6MTBweCAxNnB4O3BhZGRpbmc6MjBweDttYXJnaW46MH0KLmluZm8gZHR7Y29sb3I6dmFyKC0tbXV0ZWQpfS5pbmZvIGRke21hcmdpbjowfQpAbWVkaWEgKG1heC13aWR0aDoxMDIzcHgpey5kZXRhaWx7bWFyZ2luOjA7Ym9yZGVyLXJhZGl1czowO2ZsZXgtZGlyZWN0aW9uOmNvbHVtbjtvdmVyZmxvdy15OmF1dG99LmluZm97d2lkdGg6MTAwJTtib3JkZXItbGVmdDowO2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7b3ZlcmZsb3c6dmlzaWJsZX0udmlld2Vye21pbi1oZWlnaHQ6NDV2aDtmbGV4Om5vbmU7aGVpZ2h0OjQ1dmh9fQoubW9kYWx7cG9zaXRpb246Zml4ZWQ7aW5zZXQ6MDtiYWNrZ3JvdW5kOnJnYmEoMCwwLDAsLjYpO3otaW5kZXg6NjA7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO3BhZGRpbmc6MTZweH0KLm1vZGFsIC5ib3h7YmFja2dyb3VuZDojZmZmO2JvcmRlci1yYWRpdXM6MTRweDttYXgtd2lkdGg6NDQwcHg7d2lkdGg6MTAwJTtwYWRkaW5nOjIycHh9Ci5tb2RhbCAuaWNvbnt3aWR0aDo0MHB4O2hlaWdodDo0MHB4O2JvcmRlci1yYWRpdXM6NTAlO2JhY2tncm91bmQ6dmFyKC0tcmVkLXNvZnQpO2Rpc3BsYXk6ZmxleDthbGlnbi1pdGVtczpjZW50ZXI7anVzdGlmeS1jb250ZW50OmNlbnRlcjtjb2xvcjp2YXIoLS1yZWQpO2ZvbnQtd2VpZ2h0OjgwMDttYXJnaW4tYm90dG9tOjEy',
  'cHh9Ci8qIFRhYmxlYXUgZGUgYm9yZCAqLwouc3RhdHN7ZGlzcGxheTpncmlkO2dhcDoxMnB4O2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNywxZnIpfQpAbWVkaWEgKG1heC13aWR0aDoxMjgwcHgpey5zdGF0c3tncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDQsMWZyKX19QG1lZGlhIChtYXgtd2lkdGg6NjAwcHgpey5zdGF0c3tncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDIsMWZyKX19Ci5zdGF0e3BhZGRpbmc6MTRweDtjdXJzb3I6cG9pbnRlcn0uc3RhdCAudntmb250LXNpemU6MjhweDtmb250LXdlaWdodDo3MDA7bWFyZ2luLXRvcDo2cHg7Zm9udC12YXJpYW50LW51bWVyaWM6dGFidWxhci1udW1zfQouZGFzaHtkaXNwbGF5OmdyaWQ7Z2FwOjI0cHg7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOjJmciAxZnI7bWFyZ2luLXRvcDoyNHB4fQpAbWVkaWEgKG1heC13aWR0aDoxMTAwcHgpey5kYXNoe2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9fQoucmVjZW50e2Rpc3BsYXk6Z3JpZDtnYXA6OHB4O2dyaWQtdGVtcGxhdGUtY29sdW1uczpyZXBlYXQoNiwxZnIpfQpAbWVkaWEgKG1heC13aWR0aDo3MDBweCl7LnJlY2VudHtncmlkLXRlbXBsYXRlLWNvbHVtbnM6cmVwZWF0KDMsMWZyKX19Ci5yZWNlbnQgZGl2e2FzcGVjdC1yYXRpbzoxO2JvcmRlci1yYWRpdXM6OHB4O2JhY2tncm91bmQ6I2YzZjRmNjtvdmVyZmxvdzpoaWRkZW47cG9zaXRpb246cmVsYXRpdmU7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1z',
  'OmNlbnRlcjtqdXN0aWZ5LWNvbnRlbnQ6Y2VudGVyO2ZvbnQtc2l6ZToxMHB4O2ZvbnQtd2VpZ2h0OjcwMDtjb2xvcjp2YXIoLS1tdXRlZCl9Ci5yZWNlbnQgaW1ne3dpZHRoOjEwMCU7aGVpZ2h0OjEwMCU7b2JqZWN0LWZpdDpjb3Zlcn0KLmRvdHtwb3NpdGlvbjphYnNvbHV0ZTt0b3A6NXB4O3JpZ2h0OjVweDt3aWR0aDoxMHB4O2hlaWdodDoxMHB4O2JvcmRlci1yYWRpdXM6NTAlO2JveC1zaGFkb3c6MCAwIDAgMnB4ICNmZmZ9Ci5saXN0e2xpc3Qtc3R5bGU6bm9uZTttYXJnaW46MDtwYWRkaW5nOjB9Lmxpc3QgbGl7cGFkZGluZzoxMHB4IDE0cHg7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tYm9yZGVyKX0ubGlzdCBsaTpmaXJzdC1jaGlsZHtib3JkZXItdG9wOjB9Ci5jYXRze2Rpc3BsYXk6Z3JpZDtnYXA6MTZweDtncmlkLXRlbXBsYXRlLWNvbHVtbnM6MWZyIDFmcjttYXJnaW4tdG9wOjE2cHh9QG1lZGlhIChtYXgtd2lkdGg6OTAwcHgpey5jYXRze2dyaWQtdGVtcGxhdGUtY29sdW1uczoxZnJ9fQouY2F0IGhlYWRlcntkaXNwbGF5OmZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2dhcDo0cHg7cGFkZGluZzoxMHB4IDEycHggMTBweCAxNnB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWJvcmRlcil9Ci5jYXQgbGl7ZGlzcGxheTpmbGV4O2FsaWduLWl0ZW1zOmNlbnRlcjtnYXA6NHB4O3BhZGRpbmc6NHB4IDEycHggNHB4IDE2cHg7Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tYm9yZGVyKX0KLmljb25i',
  'dG57d2lkdGg6MzBweDtoZWlnaHQ6MzBweDtib3JkZXI6MDtiYWNrZ3JvdW5kOm5vbmU7Ym9yZGVyLXJhZGl1czo2cHg7Y3Vyc29yOnBvaW50ZXI7Y29sb3I6dmFyKC0tbXV0ZWQpO2Rpc3BsYXk6aW5saW5lLWZsZXg7YWxpZ24taXRlbXM6Y2VudGVyO2p1c3RpZnktY29udGVudDpjZW50ZXJ9Ci5pY29uYnRuOmhvdmVyOm5vdCg6ZGlzYWJsZWQpe2JhY2tncm91bmQ6I2YzZjRmNjtjb2xvcjp2YXIoLS1mZyl9Lmljb25idG46ZGlzYWJsZWR7b3BhY2l0eTouMztjdXJzb3I6ZGVmYXVsdH0KLnN0cmlrZXt0ZXh0LWRlY29yYXRpb246bGluZS10aHJvdWdoO2NvbG9yOnZhcigtLW11dGVkKX0KI3RvYXN0c3twb3NpdGlvbjpmaXhlZDtyaWdodDoyMHB4O2JvdHRvbToyMHB4O3otaW5kZXg6MTAwO2Rpc3BsYXk6ZmxleDtmbGV4LWRpcmVjdGlvbjpjb2x1bW47Z2FwOjhweDttYXgtd2lkdGg6MzYwcHh9CkBtZWRpYSAobWF4LXdpZHRoOjEwMjNweCl7I3RvYXN0c3tsZWZ0OjE2cHg7cmlnaHQ6MTZweDtib3R0b206ODBweDttYXgtd2lkdGg6bm9uZX19Ci50b2FzdHtiYWNrZ3JvdW5kOiNmZmY7Ym9yZGVyOjFweCBzb2xpZCB2YXIoLS1ib3JkZXIpO2JvcmRlci1sZWZ0OjRweCBzb2xpZCB2YXIoLS1ncmVlbik7Ym9yZGVyLXJhZGl1czoxMHB4O3BhZGRpbmc6MTBweCAxMnB4O2JveC1zaGFkb3c6MCA4cHggMjRweCByZ2JhKDAsMCwwLC4xMil9Ci50b2FzdC5lcnJvcntib3JkZXItbGVmdC1jb2xvcjp2YXIoLS1yZWQpfQo8L3N0eWxl',
  'Pgo8L2hlYWQ+Cjxib2R5Pgo8ZGl2IGlkPSJhcHAiPjwvZGl2Pgo8ZGl2IGlkPSJtb2RhbC1yb290Ij48L2Rpdj4KPGRpdiBpZD0idG9hc3RzIj48L2Rpdj4KCjxzY3JpcHQ+Ci8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0KICAgUGhvdG90aMOocXVlIENyb2l4LVJvdWdlIOKAlCBpbnRlcmZhY2UgKEluZGV4Lmh0bWwpCiAgIFRvdXRlcyBsZXMgcGVybWlzc2lvbnMgc29udCB2w6lyaWZpw6llcyBjw7R0w6kgc2VydmV1ciAoQ29kZS5ncykgOyBsJ2ludGVyZmFjZQogICBuZSBmYWl0IHF1ZSBtYXNxdWVyIGNlIHF1aSBuJ2VzdCBwYXMgYXV0b3Jpc8OpLgogICA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovCgovLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHV0aWxpdGFpcmVzCmNvbnN0IFBIT1RPX0VYVCA9IFsnanBnJywnanBlZycsJ2pwZScsJ3BuZycsJ2hlaWMnLCdoZWlmJywnaGlmJywnd2VicCcsJ2dpZicsJ3RpZicsJ3RpZmYnLCdibXAnLCdhdmlmJywnZG5nJywnY3IyJywnY3IzJywnbmVmJywnYXJ3Jywnb3JmJywncncyJywncmFmJ107CmNvbnN0IFZJREVPX0VYVCA9IFsnbXA0JywnbTR2JywnbW92JywncXQnLCdhdmknLCdta3YnLCd3ZWJtJywnM2dwJywn',
  'M2cyJywnbXRzJywnbTJ0cycsJ21wZycsJ21wZWcnLCd3bXYnXTsKY29uc3QgQUNDRVBUID0gJ2ltYWdlLyosdmlkZW8vKiwnICsgUEhPVE9fRVhULmNvbmNhdChWSURFT19FWFQpLm1hcChlID0+ICcuJyArIGUpLmpvaW4oJywnKTsKY29uc3QgVFogPSAnRXVyb3BlL1BhcmlzJzsKCmNvbnN0IGVzYyA9IHMgPT4gU3RyaW5nKHMgPT0gbnVsbCA/ICcnIDogcykucmVwbGFjZSgvWyY8PiInXS9nLCBjID0+ICh7JyYnOicmYW1wOycsJzwnOicmbHQ7JywnPic6JyZndDsnLCciJzonJnF1b3Q7JywiJyI6JyYjMzk7J31bY10pKTsKY29uc3QgJCA9IHNlbCA9PiBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKHNlbCk7CmNvbnN0IGV4dCA9IG5hbWUgPT4gKC9cLihbXi4vXFxdKykkLy5leGVjKG5hbWUpIHx8IFssJyddKVsxXS50b0xvd2VyQ2FzZSgpOwpjb25zdCBraW5kT2YgPSBuYW1lID0+IFBIT1RPX0VYVC5pbmNsdWRlcyhleHQobmFtZSkpID8gJ1BIT1RPJyA6IFZJREVPX0VYVC5pbmNsdWRlcyhleHQobmFtZSkpID8gJ1ZJREVPJyA6IG51bGw7CmNvbnN0IG5mID0gbiA9PiBuZXcgSW50bC5OdW1iZXJGb3JtYXQoJ2ZyLUZSJykuZm9ybWF0KG4gfHwgMCk7CmNvbnN0IHBsdXJhbCA9IChuLCBzLCBwKSA9PiBuZihuKSArICcgJyArIChuID4gMSA/IChwIHx8IHMgKyAncycpIDogcyk7CmZ1bmN0aW9uIGZtdEJ5dGVzKGIpeyBpZighYikgcmV0dXJuICcwIG8nOyBjb25zdCB1PVsnbycsJ0tvJywnTW8nLCdHbycsJ1RvJ107IGNvbnN0',
  'IGU9TWF0aC5taW4oTWF0aC5mbG9vcihNYXRoLmxvZyhiKS9NYXRoLmxvZygxMDI0KSksNCk7IHJldHVybiAoYi9NYXRoLnBvdygxMDI0LGUpKS50b0xvY2FsZVN0cmluZygnZnItRlInLHttYXhpbXVtRnJhY3Rpb25EaWdpdHM6ZT8xOjB9KSsnICcrdVtlXTsgfQpmdW5jdGlvbiBmbXREYXRlKGlzbywgdGltZSl7IGlmKCFpc28pIHJldHVybiAn4oCUJzsgcmV0dXJuIG5ldyBJbnRsLkRhdGVUaW1lRm9ybWF0KCdmci1GUicsIE9iamVjdC5hc3NpZ24oe2RhdGVTdHlsZTonbWVkaXVtJywgdGltZVpvbmU6VFp9LCB0aW1lP3t0aW1lU3R5bGU6J3Nob3J0J306e30pKS5mb3JtYXQobmV3IERhdGUoaXNvKSk7IH0KZnVuY3Rpb24gZm10RHVyKHMpeyBpZighcykgcmV0dXJuICcnOyBzPU1hdGgucm91bmQocyk7IGNvbnN0IG09TWF0aC5mbG9vcihzLzYwKSwgcj1zJTYwOyByZXR1cm4gbSsnOicrU3RyaW5nKHIpLnBhZFN0YXJ0KDIsJzAnKTsgfQpmdW5jdGlvbiB0b0xvY2FsSW5wdXQoZCl7IGNvbnN0IHA9bj0+U3RyaW5nKG4pLnBhZFN0YXJ0KDIsJzAnKTsgcmV0dXJuIGQuZ2V0RnVsbFllYXIoKSsnLScrcChkLmdldE1vbnRoKCkrMSkrJy0nK3AoZC5nZXREYXRlKCkpKydUJytwKGQuZ2V0SG91cnMoKSkrJzonK3AoZC5nZXRNaW51dGVzKCkpOyB9CmNvbnN0IENST1NTID0gJzxzdmcgY2xhc3M9ImNyb3NzIiB2aWV3Qm94PSIwIDAgMzIgMzIiIGFyaWEtaGlkZGVuPSJ0cnVlIj48cGF0aCBmaWxsPSIjRTMwMDBGIiBkPSJNMTEg',
  'MmgxMHY5aDl2MTBoLTl2OUgxMXYtOUgyVjExaDl6Ii8+PC9zdmc+JzsKY29uc3QgSSA9IHsKICBkYXNoOic8c3ZnIGNsYXNzPSJpYyIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iNyIgaGVpZ2h0PSI5IiByeD0iMSIvPjxyZWN0IHg9IjE0IiB5PSIzIiB3aWR0aD0iNyIgaGVpZ2h0PSI1IiByeD0iMSIvPjxyZWN0IHg9IjE0IiB5PSIxMiIgd2lkdGg9IjciIGhlaWdodD0iOSIgcng9IjEiLz48cmVjdCB4PSIzIiB5PSIxNiIgd2lkdGg9IjciIGhlaWdodD0iNSIgcng9IjEiLz48L3N2Zz4nLAogIHBob3RvczonPHN2ZyBjbGFzcz0iaWMiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIvPjxjaXJjbGUgY3g9IjkiIGN5PSI5IiByPSIyIi8+PHBhdGggZD0ibTIxIDE1LTMuMS0zLjFhMiAyIDAgMCAwLTIuOCAwTDYgMjEiLz48L3N2Zz4nLAogIHVwbG9hZDonPHN2ZyBjbGFzcz0iaWMiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTIxIDE1djRhMiAyIDAgMCAxLTIgMkg1YTIgMiAwIDAgMS0yLTJ2LTQiLz48cGF0aCBkPSJtMTcgOC01LTUt',
  'NSA1Ii8+PHBhdGggZD0iTTEyIDN2MTIiLz48L3N2Zz4nLAogIGNhdHM6JzxzdmcgY2xhc3M9ImljIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiPjxwYXRoIGQ9Ik0zIDZoMThNMyAxMmgxMk0zIDE4aDciLz48L3N2Zz4nLAogIGdlYXI6JzxzdmcgY2xhc3M9ImljIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiLz48cGF0aCBkPSJNMTkuNCAxNWExLjcgMS43IDAgMCAwIC4zIDEuOGwuMS4xYTIgMiAwIDEgMS0yLjggMi44bC0uMS0uMWExLjcgMS43IDAgMCAwLTEuOC0uMyAxLjcgMS43IDAgMCAwLTEgMS41VjIxYTIgMiAwIDEgMS00IDB2LS4xYTEuNyAxLjcgMCAwIDAtMS4xLTEuNSAxLjcgMS43IDAgMCAwLTEuOC4zbC0uMS4xYTIgMiAwIDEgMS0yLjgtMi44bC4xLS4xYTEuNyAxLjcgMCAwIDAgLjMtMS44IDEuNyAxLjcgMCAwIDAtMS41LTFIM2EyIDIgMCAxIDEgMC00aC4xYTEuNyAxLjcgMCAwIDAgMS41LTEuMSAxLjcgMS43IDAgMCAwLS4zLTEuOGwtLjEtLjFhMiAyIDAgMSAxIDIuOC0yLjhsLjEuMWExLjcgMS43IDAgMCAwIDEuOC4zSDlhMS43IDEuNyAwIDAgMCAxLTEuNVYzYTIgMiAwIDEgMSA0IDB2LjFhMS43IDEuNyAwIDAgMCAxIDEuNSAxLjcgMS43IDAgMCAwIDEuOC0uM2wuMS0uMWEyIDIgMCAx',
  'IDEgMi44IDIuOGwtLjEuMWExLjcgMS43IDAgMCAwLS4zIDEuOFY5YTEuNyAxLjcgMCAwIDAgMS41IDFIMjFhMiAyIDAgMSAxIDAgNGgtLjFhMS43IDEuNyAwIDAgMC0xLjUgMXoiLz48L3N2Zz4nLAogIG91dDonPHN2ZyBjbGFzcz0iaWMiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTkgMjFINWEyIDIgMCAwIDEtMi0yVjVhMiAyIDAgMCAxIDItMmg0Ii8+PHBhdGggZD0ibTE2IDE3IDUtNS01LTUiLz48cGF0aCBkPSJNMjEgMTJIOSIvPjwvc3ZnPicsCiAgZXllOic8c3ZnIGNsYXNzPSJpYyIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMiAxMnMzLTcgMTAtNyAxMCA3IDEwIDctMyA3LTEwIDdTMiAxMiAyIDEyeiIvPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjMiLz48L3N2Zz4nLAogIGNoZWNrOic8c3ZnIHdpZHRoPSIxMiIgaGVpZ2h0PSIxMiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSI0Ij48cGF0aCBkPSJNMjAgNiA5IDE3bC01LTUiLz48L3N2Zz4nLAogIHBsYXk6Jzxzdmcgd2lkdGg9IjIwIiBoZWlnaHQ9IjIwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9ImN1cnJlbnRDb2xvciI+PHBhdGggZD0iTTggNXYxNGwxMS03eiIvPjwv',
  'c3ZnPicsCn07CgovLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIGFwcGVscyBzZXJ2ZXVyCmZ1bmN0aW9uIGNhbGwoZm4sIC4uLmFyZ3MpIHsKICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4gewogICAgZ29vZ2xlLnNjcmlwdC5ydW4KICAgICAgLndpdGhTdWNjZXNzSGFuZGxlcihyZXNvbHZlKQogICAgICAud2l0aEZhaWx1cmVIYW5kbGVyKGVyciA9PiB7CiAgICAgICAgY29uc3QgbXNnID0gKGVyciAmJiBlcnIubWVzc2FnZSkgfHwgU3RyaW5nKGVycik7CiAgICAgICAgaWYgKG1zZy5pbmRleE9mKCdTRVNTSU9OOicpID49IDApIHsgbG9nb3V0KHRydWUpOyByZXR1cm4gcmVqZWN0KG5ldyBFcnJvcihtc2cucmVwbGFjZSgvLipTRVNTSU9OOlxzKi8sICcnKSkpOyB9CiAgICAgICAgcmVqZWN0KG5ldyBFcnJvcihtc2cucmVwbGFjZSgvXkV4Y2VwdGlvbjpccyovLCAnJykucmVwbGFjZSgvXkVycm9yOlxzKi8sICcnKSkpOwogICAgICB9KVtmbl0oLi4uYXJncyk7CiAgfSk7Cn0KY29uc3QgYXBpID0gKGZuLCAuLi5hcmdzKSA9PiBjYWxsKGZuLCBzdGF0ZS50b2tlbiwgLi4uYXJncyk7CgpmdW5jdGlvbiB0b2FzdChtZXNzYWdlLCBraW5kKSB7CiAgY29uc3QgZWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTsKICBlbC5jbGFzc05hbWUgPSAndG9hc3QnICsgKGtpbmQgPT09ICdlcnJvcicgPyAnIGVycm9yJyA6',
  'ICcnKTsKICBlbC50ZXh0Q29udGVudCA9IG1lc3NhZ2U7CiAgJCgnI3RvYXN0cycpLmFwcGVuZENoaWxkKGVsKTsKICBzZXRUaW1lb3V0KCgpID0+IGVsLnJlbW92ZSgpLCBraW5kID09PSAnZXJyb3InID8gNzAwMCA6IDQwMDApOwp9CgovLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIMOpdGF0IGdsb2JhbApjb25zdCBzdG9yZSA9IHsgZ2V0KGspeyB0cnkgeyByZXR1cm4gbG9jYWxTdG9yYWdlLmdldEl0ZW0oayk7IH0gY2F0Y2goZSl7IHJldHVybiBudWxsOyB9IH0sIHNldChrLHYpeyB0cnkgeyB2PT1udWxsP2xvY2FsU3RvcmFnZS5yZW1vdmVJdGVtKGspOmxvY2FsU3RvcmFnZS5zZXRJdGVtKGssdik7IH0gY2F0Y2goZSl7fSB9IH07CmNvbnN0IHN0YXRlID0geyB0b2tlbjogc3RvcmUuZ2V0KCdjcmZfdG9rZW4nKSwgcm9sZTogbnVsbCwgbmFtZTogJycsIHZpZXc6ICdsb2dpbicgfTsKCmZ1bmN0aW9uIGxvZ291dChleHBpcmVkKSB7CiAgaWYgKHN0YXRlLnRva2VuKSBzdG9yZS5zZXQoJ2NyZl90b2tlbicsIG51bGwpOwogIHN0YXRlLnRva2VuID0gbnVsbDsgc3RhdGUucm9sZSA9IG51bGw7IHN0YXRlLnZpZXcgPSAnbG9naW4nOwogIGNsb3NlTW9kYWwoKTsgY2xvc2VEZXRhaWwoKTsKICByZW5kZXIoKTsKICBpZiAoZXhwaXJlZCkgdG9hc3QoJ1Nlc3Npb24gZXhwaXLDqWUuIFZldWlsbGV6IHZvdXMgcmVjb25uZWN0ZXIuJywgJ2Vycm9yJyk7',
  'Cn0KCmZ1bmN0aW9uIGdvKHZpZXcpIHsKICBpZiAoc3RhdGUucm9sZSAhPT0gJ0FETUlOJyAmJiB2aWV3ICE9PSAnaW1wb3J0JykgdmlldyA9ICdpbXBvcnQnOwogIHN0YXRlLnZpZXcgPSB2aWV3OwogIGNsb3NlRGV0YWlsKCk7CiAgcmVuZGVyKCk7CiAgd2luZG93LnNjcm9sbFRvKDAsIDApOwp9CgovLyAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tIHJlbmR1CmNvbnN0IE5BViA9IFsKICBbJ2Rhc2hib2FyZCcsICdUYWJsZWF1IGRlIGJvcmQnLCAnQWNjdWVpbCcsICdkYXNoJ10sCiAgWydsaWJyYXJ5JywgJ1Bob3RvdGjDqHF1ZScsICdQaG90b3MnLCAncGhvdG9zJ10sCiAgWydpbXBvcnQnLCAnSW1wb3J0ZXIgZGVzIG3DqWRpYXMnLCAnSW1wb3J0ZXInLCAndXBsb2FkJ10sCiAgWydjYXRlZ29yaWVzJywgJ0NhdMOpZ29yaWVzICYgYWN0aXZpdMOpcycsICdDYXTDqWdvcmllcycsICdjYXRzJ10sCiAgWydzZXR0aW5ncycsICdQYXJhbcOodHJlcycsICdSw6lnbGFnZXMnLCAnZ2VhciddLApdOwoKZnVuY3Rpb24gcmVuZGVyKCkgewogIGNvbnN0IGFwcCA9ICQoJyNhcHAnKTsKICBpZiAoIXN0YXRlLnRva2VuIHx8ICFzdGF0ZS5yb2xlKSB7IGFwcC5pbm5lckhUTUwgPSBsb2dpblZpZXcoKTsgYmluZExvZ2luKCk7IHJldHVybjsgfQogIGNvbnN0IGNvbnRlbnQgPSAnPGRpdiBpZD0idmlldyI+PC9kaXY+JzsKICBpZiAoc3RhdGUucm9sZSAhPT0gJ0FE',
  'TUlOJykgewogICAgYXBwLmlubmVySFRNTCA9IGA8aGVhZGVyIGNsYXNzPSJ1c2VyaGVhZCI+PGRpdiBjbGFzcz0iaW4iPjxkaXYgY2xhc3M9ImJyYW5kIiBzdHlsZT0ibWFyZ2luOjAiPiR7Q1JPU1N9PGRpdj48Yj5QaG90b3Row6hxdWU8L2I+PHNwYW4+Q3JvaXgtUm91Z2UgwrcgQm91bG9nbmUtQmlsbGFuY291cnQ8L3NwYW4+PC9kaXY+PC9kaXY+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBidG4tZ2hvc3QiIG9uY2xpY2s9ImxvZ291dCgpIj4ke0kub3V0fTxzcGFuPkTDqWNvbm5leGlvbjwvc3Bhbj48L2J1dHRvbj48L2Rpdj48L2hlYWRlcj48bWFpbiBjbGFzcz0idXNlcm1haW4iPiR7Y29udGVudH08L21haW4+YDsKICB9IGVsc2UgewogICAgY29uc3QgbGlua3MgPSBOQVYubWFwKG4gPT4gYDxhIGNsYXNzPSIke3N0YXRlLnZpZXc9PT1uWzBdPydhY3RpdmUnOicnfSIgb25jbGljaz0iZ28oJyR7blswXX0nKSI+JHtJW25bM11dLnJlcGxhY2UoJ2NsYXNzPSJpYyInLCdjbGFzcz0iaWMiJyl9JHtuWzFdfTwvYT5gKS5qb2luKCcnKTsKICAgIGNvbnN0IGJvdHRvbSA9IE5BVi5tYXAobiA9PiBgPGEgY2xhc3M9IiR7c3RhdGUudmlldz09PW5bMF0/J2FjdGl2ZSc6Jyd9IiBvbmNsaWNrPSJnbygnJHtuWzBdfScpIj4ke0lbblszXV19JHtuWzJdfTwvYT5gKS5qb2luKCcnKTsKICAgIGFwcC5pbm5lckhUTUwgPSBgPGRpdiBjbGFzcz0ic2hlbGwiPjxhc2lkZSBjbGFzcz0ic2lkZSI+PGRpdiBjbGFzcz0iYnJhbmQiPiR7',
  'Q1JPU1N9PGRpdj48Yj5QaG90b3Row6hxdWU8L2I+PHNwYW4+Q3JvaXgtUm91Z2UgwrcgQm91bG9nbmUtQmlsbGFuY291cnQ8L3NwYW4+PC9kaXY+PC9kaXY+CiAgICAgIDxuYXYgY2xhc3M9Im5hdiI+JHtsaW5rc308L25hdj48ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOmF1dG87Ym9yZGVyLXRvcDoxcHggc29saWQgdmFyKC0tYm9yZGVyKTtwYWRkaW5nLXRvcDoxNHB4Ij4KICAgICAgPGRpdiBzdHlsZT0icGFkZGluZzowIDEycHggMTBweCI+PGI+JHtlc2Moc3RhdGUubmFtZSl9PC9iPjxkaXYgY2xhc3M9InNtYWxsIG11dGVkIj5BZG1pbmlzdHJhdGV1cjwvZGl2PjwvZGl2PgogICAgICA8bmF2IGNsYXNzPSJuYXYiPjxhIG9uY2xpY2s9ImxvZ291dCgpIj4ke0kub3V0fUTDqWNvbm5leGlvbjwvYT48L25hdj48L2Rpdj48L2FzaWRlPgogICAgICA8ZGl2IHN0eWxlPSJmbGV4OjE7bWluLXdpZHRoOjAiPjxkaXYgY2xhc3M9InRvcGJhciI+PGRpdiBjbGFzcz0iYnJhbmQiIHN0eWxlPSJtYXJnaW46MCI+JHtDUk9TU308ZGl2PjxiPlBob3RvdGjDqHF1ZTwvYj48c3Bhbj5Dcm9peC1Sb3VnZSDCtyBCb3Vsb2duZS1CaWxsYW5jb3VydDwvc3Bhbj48L2Rpdj48L2Rpdj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iaWNvbmJ0biIgb25jbGljaz0ibG9nb3V0KCkiIGFyaWEtbGFiZWw9IkTDqWNvbm5leGlvbiI+JHtJLm91dH08L2J1dHRvbj48L2Rpdj4KICAgICAgPG1haW4gY2xhc3M9Im1haW4iPiR7Y29udGVudH08L21haW4+PC9kaXY+',
  'PC9kaXY+PG5hdiBjbGFzcz0iYm90dG9tbmF2Ij4ke2JvdHRvbX08L25hdj5gOwogIH0KICAoeyBpbXBvcnQ6IHJlbmRlckltcG9ydCwgZGFzaGJvYXJkOiByZW5kZXJEYXNoYm9hcmQsIGxpYnJhcnk6IHJlbmRlckxpYnJhcnksIGNhdGVnb3JpZXM6IHJlbmRlckNhdGVnb3JpZXMsIHNldHRpbmdzOiByZW5kZXJTZXR0aW5ncyB9W3N0YXRlLnZpZXddIHx8IHJlbmRlckltcG9ydCkoKTsKfQoKLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBDT05ORVhJT04KZnVuY3Rpb24gbG9naW5WaWV3KCkgewogIHJldHVybiBgPGRpdiBjbGFzcz0ibG9naW4iPjxkaXYgY2xhc3M9ImJveCI+CiAgICA8ZGl2IGNsYXNzPSJsb2dvIj4ke0NST1NTLnJlcGxhY2UoJ2NsYXNzPSJjcm9zcyInLCdzdHlsZT0id2lkdGg6NDBweDtoZWlnaHQ6NDBweCInKX08L2Rpdj4KICAgIDxoMT5QaG90b3Row6hxdWU8L2gxPjxwIGNsYXNzPSJtdXRlZCIgc3R5bGU9Im1hcmdpbjowIDAgMjRweCI+Q3JvaXgtUm91Z2UgZnJhbsOnYWlzZTxicj5Vbml0w6kgbG9jYWxlIGRlIEJvdWxvZ25lLUJpbGxhbmNvdXJ0PC9wPgogICAgPGZvcm0gaWQ9ImxvZ2luLWZvcm0iIGNsYXNzPSJjYXJkIiBzdHlsZT0icGFkZGluZzoyMnB4O3RleHQtYWxpZ246bGVmdCI+CiAgICAgIDxsYWJlbCBjbGFzcz0ibGJsIiBmb3I9InB3Ij5Nb3QgZGUgcGFzc2U8L2xhYmVsPgogICAgICA8ZGl2IGNsYXNzPSJw',
  'dyI+PGlucHV0IGlkPSJwdyIgY2xhc3M9ImlucHV0IiB0eXBlPSJwYXNzd29yZCIgYXV0b2NvbXBsZXRlPSJjdXJyZW50LXBhc3N3b3JkIiByZXF1aXJlZCBhdXRvZm9jdXM+CiAgICAgICAgPGJ1dHRvbiB0eXBlPSJidXR0b24iIGlkPSJwdy10b2dnbGUiIGFyaWEtbGFiZWw9IkFmZmljaGVyIGxlIG1vdCBkZSBwYXNzZSI+JHtJLmV5ZX08L2J1dHRvbj48L2Rpdj4KICAgICAgPGRpdiBpZD0ibG9naW4tZXJyIiBjbGFzcz0iYWxlcnQgaGlkZGVuIiBzdHlsZT0ibWFyZ2luLXRvcDoxMnB4Ij48L2Rpdj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1wcmltYXJ5IGJ0bi1ibG9jayIgc3R5bGU9ImhlaWdodDo0NHB4O21hcmdpbi10b3A6MTZweCIgaWQ9ImxvZ2luLWJ0biI+U2UgY29ubmVjdGVyPC9idXR0b24+CiAgICA8L2Zvcm0+PHAgY2xhc3M9InNtYWxsIG11dGVkIiBzdHlsZT0ibWFyZ2luLXRvcDoyMHB4Ij5BY2PDqHMgcsOpc2VydsOpIGF1eCBiw6luw6l2b2xlcyBkZSBsJ3VuaXTDqSBsb2NhbGUuPC9wPjwvZGl2PjwvZGl2PmA7Cn0KCmZ1bmN0aW9uIGJpbmRMb2dpbigpIHsKICBjb25zdCBwdyA9ICQoJyNwdycpOwogICQoJyNwdy10b2dnbGUnKS5vbmNsaWNrID0gKCkgPT4gewogICAgcHcudHlwZSA9IHB3LnR5cGUgPT09ICdwYXNzd29yZCcgPyAndGV4dCcgOiAncGFzc3dvcmQnOwogICAgJCgnI3B3LXRvZ2dsZScpLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIHB3LnR5cGUgPT09ICdwYXNzd29yZCcg',
  'PyAnQWZmaWNoZXIgbGUgbW90IGRlIHBhc3NlJyA6ICdNYXNxdWVyIGxlIG1vdCBkZSBwYXNzZScpOwogIH07CiAgJCgnI2xvZ2luLWZvcm0nKS5vbnN1Ym1pdCA9IGFzeW5jIGUgPT4gewogICAgZS5wcmV2ZW50RGVmYXVsdCgpOwogICAgY29uc3QgYnRuID0gJCgnI2xvZ2luLWJ0bicpOyBidG4uZGlzYWJsZWQgPSB0cnVlOyBidG4uaW5uZXJIVE1MID0gJzxzcGFuIGNsYXNzPSJzcGluIj48L3NwYW4+IENvbm5leGlvbuKApic7CiAgICAkKCcjbG9naW4tZXJyJykuY2xhc3NMaXN0LmFkZCgnaGlkZGVuJyk7CiAgICB0cnkgewogICAgICBjb25zdCByID0gYXdhaXQgY2FsbCgnbG9naW4nLCBwdy52YWx1ZSk7CiAgICAgIHN0YXRlLnRva2VuID0gci50b2tlbjsgc3RhdGUucm9sZSA9IHIucm9sZTsgc3RhdGUubmFtZSA9IHIubmFtZTsKICAgICAgc3RvcmUuc2V0KCdjcmZfdG9rZW4nLCByLnRva2VuKTsKICAgICAgZ28oci5yb2xlID09PSAnQURNSU4nID8gJ2Rhc2hib2FyZCcgOiAnaW1wb3J0Jyk7CiAgICB9IGNhdGNoIChlcnIpIHsKICAgICAgJCgnI2xvZ2luLWVycicpLnRleHRDb250ZW50ID0gZXJyLm1lc3NhZ2U7ICQoJyNsb2dpbi1lcnInKS5jbGFzc0xpc3QucmVtb3ZlKCdoaWRkZW4nKTsKICAgICAgcHcudmFsdWUgPSAnJzsgYnRuLmRpc2FibGVkID0gZmFsc2U7IGJ0bi50ZXh0Q29udGVudCA9ICdTZSBjb25uZWN0ZXInOwogICAgfQogIH07Cn0KCi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09',
  'PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gQ0FUQUxPR1VFIChjYWNoZSkKbGV0IGNhdGFsb2dDYWNoZSA9IHsgYWN0aXZlOiBudWxsLCBhbGw6IG51bGwgfTsKYXN5bmMgZnVuY3Rpb24gbG9hZENhdGFsb2coYWxsLCBmb3JjZSkgewogIGNvbnN0IGtleSA9IGFsbCA/ICdhbGwnIDogJ2FjdGl2ZSc7CiAgaWYgKCFjYXRhbG9nQ2FjaGVba2V5XSB8fCBmb3JjZSkgY2F0YWxvZ0NhY2hlW2tleV0gPSBhd2FpdCBhcGkoJ2dldENhdGFsb2cnLCBCb29sZWFuKGFsbCkpOwogIHJldHVybiBjYXRhbG9nQ2FjaGVba2V5XTsKfQoKLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBJTVBPUlRBVElPTgpjb25zdCBpbXAgPSB7IGl0ZW1zOiBbXSwgcmVqZWN0ZWQ6IFtdLCBydW5uaW5nOiBmYWxzZSwgcGhvdG9ncmFwaGVyOiBzdG9yZS5nZXQoJ2NyZl9waG90b2dyYXBoZXInKSB8fCAnJywgY2F0ZWdvcnlJZDogJycsIGFjdGl2aXR5SWQ6ICcnLCBlcnJvcjogJycgfTsKbGV0IGltcFNlcSA9IDA7Cgphc3luYyBmdW5jdGlvbiByZW5kZXJJbXBvcnQoKSB7CiAgY29uc3QgdiA9ICQoJyN2aWV3Jyk7CiAgdi5pbm5lckhUTUwgPSBgPGgxPkltcG9ydGVyIGRlcyBtw6lkaWFzPC9oMT4KICAgIDxwIGNsYXNzPSJtdXRlZCIgc3R5bGU9Im1hcmdpbjowIj5QaG90b3MgZXQgdmlkw6lvcyBzb250IGNvbnNlcnbDqWVzIGRhbnMgbGV1ciBmb3JtYXQgZXQgbGV1',
  'ciBxdWFsaXTDqSBkJ29yaWdpbmUuIENoYXF1ZSBtw6lkaWEgaW1wb3J0w6kgZXN0IGVucmVnaXN0csOpIMKrIMOAIHRyaWVyIMK7LjwvcD4KICAgIDxkaXYgY2xhc3M9ImNhcmQgc2VjdGlvbiIgc3R5bGU9InBhZGRpbmc6MThweCI+CiAgICAgIDxkaXYgY2xhc3M9InNtYWxsIG11dGVkIiBzdHlsZT0iZm9udC13ZWlnaHQ6NzAwO2xldHRlci1zcGFjaW5nOi4wNWVtO21hcmdpbi1ib3R0b206MTRweCI+SU5GT1JNQVRJT05TPC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9ImdyaWQzIj4KICAgICAgICA8ZGl2PjxsYWJlbCBjbGFzcz0ibGJsIiBmb3I9InBoIj5QaG90b2dyYXBoZSAqPC9sYWJlbD48aW5wdXQgaWQ9InBoIiBjbGFzcz0iaW5wdXQiIHBsYWNlaG9sZGVyPSJQcsOpbm9tIE5vbSIgdmFsdWU9IiR7ZXNjKGltcC5waG90b2dyYXBoZXIpfSI+PC9kaXY+CiAgICAgICAgPGRpdj48bGFiZWwgY2xhc3M9ImxibCIgZm9yPSJjYXQiPkNhdMOpZ29yaWUgKjwvbGFiZWw+PHNlbGVjdCBpZD0iY2F0IiBjbGFzcz0ic2VsZWN0Ij48b3B0aW9uIHZhbHVlPSIiPkNoYXJnZW1lbnTigKY8L29wdGlvbj48L3NlbGVjdD48L2Rpdj4KICAgICAgICA8ZGl2PjxsYWJlbCBjbGFzcz0ibGJsIiBmb3I9ImFjdCI+QWN0aXZpdMOpICo8L2xhYmVsPjxzZWxlY3QgaWQ9ImFjdCIgY2xhc3M9InNlbGVjdCIgZGlzYWJsZWQ+PG9wdGlvbiB2YWx1ZT0iIj5DaG9pc2lzc2V6IGQnYWJvcmQgdW5lIGNhdMOpZ29yaWU8L29wdGlvbj48L3NlbGVjdD48',
  'L2Rpdj4KICAgICAgPC9kaXY+PC9kaXY+CiAgICA8ZGl2IGlkPSJkcm9wIiBjbGFzcz0iZHJvcCBzZWN0aW9uIj4KICAgICAgPGRpdiBzdHlsZT0iZm9udC1zaXplOjMycHgiPvCflrzvuI88L2Rpdj4KICAgICAgPHAgc3R5bGU9ImZvbnQtd2VpZ2h0OjYwMDttYXJnaW46OHB4IDAgMnB4Ij5HbGlzc2V6LWTDqXBvc2V6IHZvcyBwaG90b3MgZXQgdmlkw6lvcyBpY2k8L3A+CiAgICAgIDxwIGNsYXNzPSJzbWFsbCBtdXRlZCIgc3R5bGU9Im1hcmdpbjowIj5KUEcsIFBORywgSEVJQywgSEVJRiwgV0VCUCwgUkFX4oCmIMK3IE1QNCwgTU9WLCBBVkksIE1LVuKApjwvcD4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1vdXRsaW5lIiBzdHlsZT0ibWFyZ2luLXRvcDoxNHB4IiBpZD0icGljayI+JHtJLnVwbG9hZH0gU8OpbGVjdGlvbm5lciBkZXMgZmljaGllcnM8L2J1dHRvbj4KICAgICAgPGlucHV0IHR5cGU9ImZpbGUiIGlkPSJmaWxlIiBtdWx0aXBsZSBhY2NlcHQ9IiR7QUNDRVBUfSIgY2xhc3M9ImhpZGRlbiI+CiAgICA8L2Rpdj4KICAgIDxkaXYgaWQ9InJlamVjdGVkIj48L2Rpdj48ZGl2IGlkPSJxdWV1ZSI+PC9kaXY+YDsKCiAgJCgnI3BoJykub25pbnB1dCA9IGUgPT4geyBpbXAucGhvdG9ncmFwaGVyID0gZS50YXJnZXQudmFsdWU7IH07CiAgJCgnI3BpY2snKS5vbmNsaWNrID0gKCkgPT4gJCgnI2ZpbGUnKS5jbGljaygpOwogICQoJyNmaWxlJykub25jaGFuZ2UgPSBlID0+IHsgYWRkRmlsZXMoZS50YXJnZXQu',
  'ZmlsZXMpOyBlLnRhcmdldC52YWx1ZSA9ICcnOyB9OwogIGNvbnN0IGRyb3AgPSAkKCcjZHJvcCcpOwogIGRyb3Aub25kcmFnb3ZlciA9IGUgPT4geyBlLnByZXZlbnREZWZhdWx0KCk7IGRyb3AuY2xhc3NMaXN0LmFkZCgnZHJhZycpOyB9OwogIGRyb3Aub25kcmFnbGVhdmUgPSAoKSA9PiBkcm9wLmNsYXNzTGlzdC5yZW1vdmUoJ2RyYWcnKTsKICBkcm9wLm9uZHJvcCA9IGUgPT4geyBlLnByZXZlbnREZWZhdWx0KCk7IGRyb3AuY2xhc3NMaXN0LnJlbW92ZSgnZHJhZycpOyBpZiAoIWltcC5ydW5uaW5nKSBhZGRGaWxlcyhlLmRhdGFUcmFuc2Zlci5maWxlcyk7IH07CgogIHRyeSB7CiAgICBjb25zdCBjYXRzID0gYXdhaXQgbG9hZENhdGFsb2coZmFsc2UsIHRydWUpOwogICAgY29uc3Qgc2VsID0gJCgnI2NhdCcpOyBpZiAoIXNlbCkgcmV0dXJuOwogICAgc2VsLmlubmVySFRNTCA9ICc8b3B0aW9uIHZhbHVlPSIiPkNob2lzaXIgdW5lIGNhdMOpZ29yaWU8L29wdGlvbj4nICsgY2F0cy5tYXAoYyA9PiBgPG9wdGlvbiB2YWx1ZT0iJHtjLmlkfSIgJHtjLmlkPT09aW1wLmNhdGVnb3J5SWQ/J3NlbGVjdGVkJzonJ30+JHtlc2MoYy5uYW1lKX08L29wdGlvbj5gKS5qb2luKCcnKTsKICAgIGNvbnN0IGZpbGxBY3RzID0gKCkgPT4gewogICAgICBjb25zdCBjID0gY2F0cy5maW5kKHggPT4geC5pZCA9PT0gaW1wLmNhdGVnb3J5SWQpOwogICAgICBjb25zdCBhID0gJCgnI2FjdCcpOwogICAgICBhLmRpc2FibGVkID0gIWM7CiAg',
  'ICAgIGEuaW5uZXJIVE1MID0gYyA/ICc8b3B0aW9uIHZhbHVlPSIiPkNob2lzaXIgdW5lIGFjdGl2aXTDqTwvb3B0aW9uPicgKyBjLmFjdGl2aXRpZXMubWFwKHggPT4gYDxvcHRpb24gdmFsdWU9IiR7eC5pZH0iICR7eC5pZD09PWltcC5hY3Rpdml0eUlkPydzZWxlY3RlZCc6Jyd9PiR7ZXNjKHgubmFtZSl9PC9vcHRpb24+YCkuam9pbignJykKICAgICAgICAgICAgICAgICAgICAgIDogJzxvcHRpb24gdmFsdWU9IiI+Q2hvaXNpc3NleiBkXCdhYm9yZCB1bmUgY2F0w6lnb3JpZTwvb3B0aW9uPic7CiAgICB9OwogICAgc2VsLm9uY2hhbmdlID0gKCkgPT4geyBpbXAuY2F0ZWdvcnlJZCA9IHNlbC52YWx1ZTsgaW1wLmFjdGl2aXR5SWQgPSAnJzsgZmlsbEFjdHMoKTsgfTsKICAgICQoJyNhY3QnKS5vbmNoYW5nZSA9IGUgPT4geyBpbXAuYWN0aXZpdHlJZCA9IGUudGFyZ2V0LnZhbHVlOyB9OwogICAgZmlsbEFjdHMoKTsKICB9IGNhdGNoIChlcnIpIHsgdG9hc3QoJ0ltcG9zc2libGUgZGUgY2hhcmdlciBsZXMgY2F0w6lnb3JpZXMgOiAnICsgZXJyLm1lc3NhZ2UsICdlcnJvcicpOyB9CiAgcmVuZGVyUXVldWUoKTsKfQoKZnVuY3Rpb24gYWRkRmlsZXMobGlzdCkgewogIGNvbnN0IGtub3duID0gbmV3IFNldChpbXAuaXRlbXMubWFwKGkgPT4gaS5maWxlLm5hbWUgKyBpLmZpbGUuc2l6ZSArIGkuZmlsZS5sYXN0TW9kaWZpZWQpKTsKICBjb25zdCBhZGRlZCA9IFtdOwogIEFycmF5LmZyb20obGlzdCkuZm9yRWFjaChmaWxl',
  'ID0+IHsKICAgIGNvbnN0IGtleSA9IGZpbGUubmFtZSArIGZpbGUuc2l6ZSArIGZpbGUubGFzdE1vZGlmaWVkOwogICAgaWYgKGtub3duLmhhcyhrZXkpKSByZXR1cm47IGtub3duLmFkZChrZXkpOwogICAgY29uc3Qga2luZCA9IGtpbmRPZihmaWxlLm5hbWUpOwogICAgaWYgKCFraW5kKSB7IGltcC5yZWplY3RlZC51bnNoaWZ0KHsgbmFtZTogZmlsZS5uYW1lLCByZWFzb246ICJDZSBmaWNoaWVyIG4nZXN0IHBhcyBjb21wYXRpYmxlLiIgfSk7IHJldHVybjsgfQogICAgaWYgKCFmaWxlLnNpemUpIHsgaW1wLnJlamVjdGVkLnVuc2hpZnQoeyBuYW1lOiBmaWxlLm5hbWUsIHJlYXNvbjogJ0xlIGZpY2hpZXIgZXN0IHZpZGUuJyB9KTsgcmV0dXJuOyB9CiAgICBhZGRlZC5wdXNoKHsga2V5OiAnZicgKyAoKytpbXBTZXEpLCBmaWxlLCBraW5kLCBzdGF0ZTogJ2FuYWx5emluZycsIHByb2dyZXNzOiAwIH0pOwogIH0pOwogIGltcC5pdGVtcyA9IGltcC5pdGVtcy5maWx0ZXIoaSA9PiBpLnN0YXRlICE9PSAnZG9uZScpLmNvbmNhdChhZGRlZCk7CiAgcmVuZGVyUXVldWUoKTsKICBhbmFseXplKGFkZGVkKTsKfQoKYXN5bmMgZnVuY3Rpb24gYW5hbHl6ZShpdGVtcykgewogIGNvbnN0IHF1ZXVlID0gaXRlbXMuc2xpY2UoKTsKICBjb25zdCB3b3JrZXIgPSBhc3luYyAoKSA9PiB7CiAgICB3aGlsZSAocXVldWUubGVuZ3RoKSB7CiAgICAgIGNvbnN0IGl0ID0gcXVldWUuc2hpZnQoKTsKICAgICAgdHJ5IHsKICAgICAgICBjb25z',
  'dCBbaW5mbywgZGVyaXZdID0gYXdhaXQgUHJvbWlzZS5hbGwoW2V4dHJhY3REYXRlKGl0LmZpbGUsIGl0LmtpbmQpLCBtYWtlRGVyaXZhdGl2ZXMoaXQuZmlsZSwgaXQua2luZCkuY2F0Y2goKCkgPT4gbnVsbCldKTsKICAgICAgICBpdC5jYXB0dXJlRGF0ZSA9IGluZm8uZGF0ZTsgaXQuZGF0ZVNvdXJjZSA9IGluZm8uc291cmNlOyBpdC5kZXJpdiA9IGRlcml2OwogICAgICAgIGlmIChkZXJpdikgaXQucHJldmlldyA9IFVSTC5jcmVhdGVPYmplY3RVUkwoZGVyaXYudGh1bWIpOwogICAgICB9IGNhdGNoIChlKSB7IGl0LmNhcHR1cmVEYXRlID0gbmV3IERhdGUoaXQuZmlsZS5sYXN0TW9kaWZpZWQgfHwgRGF0ZS5ub3coKSk7IGl0LmRhdGVTb3VyY2UgPSAnRklMRV9EQVRFJzsgfQogICAgICBpZiAoaXQuc3RhdGUgPT09ICdhbmFseXppbmcnKSBpdC5zdGF0ZSA9ICdyZWFkeSc7CiAgICAgIHJlbmRlclF1ZXVlKCk7CiAgICB9CiAgfTsKICBhd2FpdCBQcm9taXNlLmFsbChbd29ya2VyKCksIHdvcmtlcigpXSk7Cn0KCmNvbnN0IFNSQ19MQUJFTCA9IHsgRVhJRjogJ0RhdGUgRVhJRicsIFZJREVPX01FVEFEQVRBOiAnRGF0ZSBkZSBsYSB2aWTDqW8nLCBGSUxFX0RBVEU6ICdEYXRlIGR1IGZpY2hpZXIg4oCUIMOgIHbDqXJpZmllcicsIE1BTlVBTDogJ0RhdGUgbW9kaWZpw6llJyB9OwoKZnVuY3Rpb24gcmVuZGVyUXVldWUoKSB7CiAgY29uc3QgcmogPSAkKCcjcmVqZWN0ZWQnKSwgcSA9ICQoJyNxdWV1ZScpOyBpZiAoIXEp',
  'IHJldHVybjsKICByai5pbm5lckhUTUwgPSBpbXAucmVqZWN0ZWQubGVuZ3RoID8gYDxkaXYgY2xhc3M9ImNhcmQgc2VjdGlvbiIgc3R5bGU9InBhZGRpbmc6MTRweDtib3JkZXItY29sb3I6I2ZlY2FjYTtiYWNrZ3JvdW5kOiNmZmY3ZjciPgogICAgICA8ZGl2IGNsYXNzPSJiZXR3ZWVuIj48YiBzdHlsZT0iY29sb3I6I2I5MWMxYyI+RmljaGllcnMgcmVmdXPDqXM8L2I+PGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1naG9zdCBidG4tc20iIG9uY2xpY2s9ImltcC5yZWplY3RlZD1bXTtyZW5kZXJRdWV1ZSgpIj5NYXNxdWVyPC9idXR0b24+PC9kaXY+CiAgICAgICR7aW1wLnJlamVjdGVkLnNsaWNlKDAsIDMwKS5tYXAociA9PiBgPGRpdiBzdHlsZT0iY29sb3I6I2I5MWMxYzttYXJnaW4tdG9wOjRweCI+4pqgIDxiPiR7ZXNjKHIubmFtZSl9PC9iPiDigJQgJHtlc2Moci5yZWFzb24pfTwvZGl2PmApLmpvaW4oJycpfTwvZGl2PmAgOiAnJzsKICBpZiAoIWltcC5pdGVtcy5sZW5ndGgpIHsgcS5pbm5lckhUTUwgPSAnJzsgcmV0dXJuOyB9CgogIGNvbnN0IGl0ZW1zID0gaW1wLml0ZW1zOwogIGNvbnN0IHBlbmRpbmcgPSBpdGVtcy5maWx0ZXIoaSA9PiBpLnN0YXRlID09PSAncmVhZHknIHx8IGkuc3RhdGUgPT09ICdlcnJvcicpOwogIGNvbnN0IGZhaWxlZCA9IGl0ZW1zLmZpbHRlcihpID0+IGkuc3RhdGUgPT09ICdlcnJvcicpOwogIGNvbnN0IGFuYWx5emluZyA9IGl0ZW1zLmZpbHRlcihpID0+IGkuc3RhdGUgPT09ICdhbmFs',
  'eXppbmcnKS5sZW5ndGg7CiAgY29uc3QgZG9uZSA9IGl0ZW1zLmZpbHRlcihpID0+IGkuc3RhdGUgPT09ICdkb25lJykubGVuZ3RoOwogIGNvbnN0IHRvdGFsID0gaXRlbXMuZmlsdGVyKGkgPT4gaS5zdGF0ZSAhPT0gJ2FuYWx5emluZycpLmxlbmd0aDsKICBjb25zdCBmaW5pc2hlZCA9ICFpbXAucnVubmluZyAmJiB0b3RhbCA+IDAgJiYgZG9uZSA9PT0gdG90YWw7CiAgY29uc3Qgb3ZlcmFsbCA9IHRvdGFsID8gaXRlbXMucmVkdWNlKChzLCBpKSA9PiBzICsgKGkuc3RhdGUgPT09ICdkb25lJyA/IDEgOiBpLnN0YXRlID09PSAndXBsb2FkaW5nJyA/IGkucHJvZ3Jlc3MgOiAwKSwgMCkgLyB0b3RhbCA6IDA7CgogIGNvbnN0IGhlYWQgPSBpbXAucnVubmluZyA/IGBJbXBvcnRhdGlvbiA6ICR7ZG9uZX0gLyAke3RvdGFsfWAgOiBmaW5pc2hlZCA/ICc8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JlZW4pIj5JbXBvcnRhdGlvbiB0ZXJtaW7DqWUg4pyTPC9zcGFuPicgOiBwbHVyYWwoaXRlbXMubGVuZ3RoLCAnZmljaGllciBzw6lsZWN0aW9ubsOpJywgJ2ZpY2hpZXJzIHPDqWxlY3Rpb25uw6lzJyk7CiAgcS5pbm5lckhUTUwgPSBgPGRpdiBjbGFzcz0iY2FyZCBzZWN0aW9uIj4KICAgIDxkaXYgY2xhc3M9ImJldHdlZW4iIHN0eWxlPSJwYWRkaW5nOjE0cHggMTZweDthbGlnbi1pdGVtczpjZW50ZXIiPgogICAgICA8ZGl2PjxiPiR7aGVhZH08L2I+PGRpdiBjbGFzcz0ic21hbGwgbXV0ZWQiPiR7Zm10Qnl0ZXMoaXRlbXMu',
  'cmVkdWNlKChzLCBpKSA9PiBzICsgaS5maWxlLnNpemUsIDApKX0ke2FuYWx5emluZyA/ICcgwrcgYW5hbHlzZSBkZSAnICsgYW5hbHl6aW5nICsgJyBmaWNoaWVyKHMp4oCmJyA6ICcnfTwvZGl2PjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJyb3ciPgogICAgICAgICR7IWltcC5ydW5uaW5nICYmIHBlbmRpbmcubGVuZ3RoID8gYDxpbnB1dCB0eXBlPSJkYXRldGltZS1sb2NhbCIgaWQ9ImJ1bGtkYXRlIiBjbGFzcz0iaW5wdXQiIHN0eWxlPSJ3aWR0aDoyMDBweCI+PGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1vdXRsaW5lIGJ0bi1zbSIgc3R5bGU9ImhlaWdodDozOHB4IiBvbmNsaWNrPSJhcHBseUJ1bGtEYXRlKCkiPkFwcGxpcXVlciDDoCB0b3VzPC9idXR0b24+YCA6ICcnfQogICAgICAgICR7ZmluaXNoZWQgPyAnPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1vdXRsaW5lIiBvbmNsaWNrPSJpbXAuaXRlbXM9W107cmVuZGVyUXVldWUoKSI+Tm91dmVsbGUgaW1wb3J0YXRpb248L2J1dHRvbj4nIDogJyd9CiAgICAgICAgJHshaW1wLnJ1bm5pbmcgJiYgZmFpbGVkLmxlbmd0aCAmJiBmYWlsZWQubGVuZ3RoIDwgcGVuZGluZy5sZW5ndGggPyBgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1vdXRsaW5lIiBvbmNsaWNrPSJzdGFydEltcG9ydCh0cnVlKSI+4oa7IFLDqWVzc2F5ZXIgbGVzIMOpY2hlY3MgKCR7ZmFpbGVkLmxlbmd0aH0pPC9idXR0b24+YCA6ICcnfQogICAgICAgICR7cGVuZGluZy5sZW5ndGggPyBgPGJ1dHRvbiBjbGFz',
  'cz0iYnRuIGJ0bi1wcmltYXJ5IiBvbmNsaWNrPSJzdGFydEltcG9ydChmYWxzZSkiICR7aW1wLnJ1bm5pbmcgfHwgYW5hbHl6aW5nID8gJ2Rpc2FibGVkJyA6ICcnfT4ke2ltcC5ydW5uaW5nID8gJzxzcGFuIGNsYXNzPSJzcGluIj48L3NwYW4+JyA6ICcnfSR7ZmFpbGVkLmxlbmd0aCA9PT0gcGVuZGluZy5sZW5ndGggPyAn4oa7IFLDqWVzc2F5ZXIgKCcgKyBmYWlsZWQubGVuZ3RoICsgJyknIDogJ0ltcG9ydGVyICcgKyBwbHVyYWwocGVuZGluZy5sZW5ndGgsICdmaWNoaWVyJyl9PC9idXR0b24+YCA6ICcnfQogICAgICA8L2Rpdj48L2Rpdj4KICAgICR7aW1wLnJ1bm5pbmcgfHwgZG9uZSA/IGA8ZGl2IGNsYXNzPSJiYXIgJHtmaW5pc2hlZCA/ICdvaycgOiAnJ30iIHN0eWxlPSJtYXJnaW46MDtib3JkZXItcmFkaXVzOjAiPjxkaXYgc3R5bGU9IndpZHRoOiR7TWF0aC5yb3VuZChvdmVyYWxsICogMTAwKX0lIj48L2Rpdj48L2Rpdj5gIDogJyd9CiAgICAke2ltcC5lcnJvciA/IGA8ZGl2IGNsYXNzPSJhbGVydCIgc3R5bGU9Im1hcmdpbjoxMnB4IDE2cHgiPiR7ZXNjKGltcC5lcnJvcil9PC9kaXY+YCA6ICcnfQogICAgPHVsIGNsYXNzPSJmaWxlbGlzdCI+JHtpdGVtcy5tYXAoaXRlbVJvdykuam9pbignJyl9PC91bD48L2Rpdj5gOwp9CgpmdW5jdGlvbiBpdGVtUm93KGl0KSB7CiAgY29uc3QgdGh1bWIgPSBpdC5wcmV2aWV3ID8gYDxpbWcgc3JjPSIke2l0LnByZXZpZXd9IiBhbHQ9IiI+YCA6IGl0LnN0YXRlID09PSAn',
  'YW5hbHl6aW5nJyA/ICc8c3BhbiBjbGFzcz0ic3BpbiI+PC9zcGFuPicgOiAoaXQua2luZCA9PT0gJ1ZJREVPJyA/ICfwn46sJyA6IGV4dChpdC5maWxlLm5hbWUpLnRvVXBwZXJDYXNlKCkpOwogIGxldCByaWdodCA9ICcnOwogIGlmIChpdC5zdGF0ZSA9PT0gJ2RvbmUnKSByaWdodCA9ICc8c3BhbiBzdHlsZT0iY29sb3I6dmFyKC0tZ3JlZW4pO2ZvbnQtd2VpZ2h0OjcwMCI+4pyTPC9zcGFuPic7CiAgZWxzZSBpZiAoaXQuc3RhdGUgPT09ICd1cGxvYWRpbmcnKSByaWdodCA9IGA8c3BhbiBjbGFzcz0ic21hbGwgbXV0ZWQiPiR7TWF0aC5yb3VuZChpdC5wcm9ncmVzcyAqIDEwMCl9ICU8L3NwYW4+YDsKICBlbHNlIHJpZ2h0ID0gYDxidXR0b24gY2xhc3M9Imljb25idG4iICR7aW1wLnJ1bm5pbmcgPyAnZGlzYWJsZWQnIDogJyd9IG9uY2xpY2s9InJlbW92ZUl0ZW0oJyR7aXQua2V5fScpIiBhcmlhLWxhYmVsPSJSZXRpcmVyIj7inJU8L2J1dHRvbj5gOwogIGNvbnN0IGRhdGUgPSBpdC5jYXB0dXJlRGF0ZSAmJiBpdC5zdGF0ZSAhPT0gJ2RvbmUnID8gYDxkaXY+PGlucHV0IHR5cGU9ImRhdGV0aW1lLWxvY2FsIiBjbGFzcz0iaW5wdXQiIHN0eWxlPSJ3aWR0aDoyMDBweCIgdmFsdWU9IiR7dG9Mb2NhbElucHV0KGl0LmNhcHR1cmVEYXRlKX0iICR7aXQuc3RhdGUgPT09ICd1cGxvYWRpbmcnID8gJ2Rpc2FibGVkJyA6ICcnfSBvbmNoYW5nZT0ic2V0SXRlbURhdGUoJyR7aXQua2V5fScsIHRoaXMudmFsdWUpIj4KICAgICAg',
  'PGRpdiBjbGFzcz0ic21hbGwgJHtpdC5kYXRlU291cmNlID09PSAnRklMRV9EQVRFJyA/ICd3YXJuJyA6ICdtdXRlZCd9Ij4ke1NSQ19MQUJFTFtpdC5kYXRlU291cmNlXSB8fCAnJ308L2Rpdj48L2Rpdj5gIDogJyc7CiAgcmV0dXJuIGA8bGk+PGRpdiBjbGFzcz0iZnRodW1iIj4ke3RodW1ifTwvZGl2PgogICAgPGRpdiBjbGFzcz0iZmluZm8iPjxkaXYgY2xhc3M9Im5hbWUiIHRpdGxlPSIke2VzYyhpdC5maWxlLm5hbWUpfSI+JHtlc2MoaXQuZmlsZS5uYW1lKX08L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ic21hbGwgbXV0ZWQiPiR7aXQua2luZCA9PT0gJ1ZJREVPJyA/ICdWaWTDqW8nIDogJ1Bob3RvJ30gwrcgJHtmbXRCeXRlcyhpdC5maWxlLnNpemUpfTwvZGl2PgogICAgICAke2l0LnN0YXRlID09PSAndXBsb2FkaW5nJyA/IGA8ZGl2IGNsYXNzPSJiYXIiIHN0eWxlPSJtYXgtd2lkdGg6MjgwcHgiPjxkaXYgc3R5bGU9IndpZHRoOiR7TWF0aC5yb3VuZChpdC5wcm9ncmVzcyAqIDEwMCl9JSI+PC9kaXY+PC9kaXY+YCA6ICcnfQogICAgICAke2l0LnN0YXRlID09PSAnZXJyb3InID8gYDxkaXYgY2xhc3M9ImVyciI+JHtlc2MoaXQuZXJyb3IpfTwvZGl2PmAgOiAnJ308L2Rpdj4KICAgICR7ZGF0ZX08ZGl2IHN0eWxlPSJ3aWR0aDo0MHB4O3RleHQtYWxpZ246cmlnaHQiPiR7cmlnaHR9PC9kaXY+PC9saT5gOwp9CgpmdW5jdGlvbiByZW1vdmVJdGVtKGtleSkgeyBjb25zdCBpdCA9IGltcC5pdGVtcy5maW5kKGkgPT4g',
  'aS5rZXkgPT09IGtleSk7IGlmIChpdCAmJiBpdC5wcmV2aWV3KSBVUkwucmV2b2tlT2JqZWN0VVJMKGl0LnByZXZpZXcpOyBpbXAuaXRlbXMgPSBpbXAuaXRlbXMuZmlsdGVyKGkgPT4gaS5rZXkgIT09IGtleSk7IHJlbmRlclF1ZXVlKCk7IH0KZnVuY3Rpb24gc2V0SXRlbURhdGUoa2V5LCB2YWx1ZSkgeyBjb25zdCBpdCA9IGltcC5pdGVtcy5maW5kKGkgPT4gaS5rZXkgPT09IGtleSk7IGNvbnN0IGQgPSBuZXcgRGF0ZSh2YWx1ZSk7IGlmIChpdCAmJiAhaXNOYU4oZCkpIHsgaXQuY2FwdHVyZURhdGUgPSBkOyBpdC5kYXRlU291cmNlID0gJ01BTlVBTCc7IHJlbmRlclF1ZXVlKCk7IH0gfQpmdW5jdGlvbiBhcHBseUJ1bGtEYXRlKCkgeyBjb25zdCBkID0gbmV3IERhdGUoJCgnI2J1bGtkYXRlJykudmFsdWUpOyBpZiAoaXNOYU4oZCkpIHJldHVybjsgaW1wLml0ZW1zLmZvckVhY2goaSA9PiB7IGlmIChpLnN0YXRlID09PSAncmVhZHknIHx8IGkuc3RhdGUgPT09ICdlcnJvcicpIHsgaS5jYXB0dXJlRGF0ZSA9IGQ7IGkuZGF0ZVNvdXJjZSA9ICdNQU5VQUwnOyB9IH0pOyByZW5kZXJRdWV1ZSgpOyB9CgpsZXQgcmVuZGVyVGltZXIgPSBudWxsOwpmdW5jdGlvbiByZW5kZXJRdWV1ZVNvb24oKSB7IGlmICghcmVuZGVyVGltZXIpIHJlbmRlclRpbWVyID0gc2V0VGltZW91dCgoKSA9PiB7IHJlbmRlclRpbWVyID0gbnVsbDsgcmVuZGVyUXVldWUoKTsgfSwgMTUwKTsgfQoKYXN5bmMgZnVuY3Rpb24gc3RhcnRJbXBvcnQob25s',
  'eUZhaWxlZCkgewogIGltcC5lcnJvciA9ICcnOwogIGltcC5waG90b2dyYXBoZXIgPSAoJCgnI3BoJykgJiYgJCgnI3BoJykudmFsdWUgfHwgaW1wLnBob3RvZ3JhcGhlcikudHJpbSgpOwogIGlmICghaW1wLnBob3RvZ3JhcGhlcikgaW1wLmVycm9yID0gJ1ZldWlsbGV6IHJlbnNlaWduZXIgbGUgbm9tIGR1IHBob3RvZ3JhcGhlLic7CiAgZWxzZSBpZiAoIWltcC5jYXRlZ29yeUlkKSBpbXAuZXJyb3IgPSAnVmV1aWxsZXogY2hvaXNpciB1bmUgY2F0w6lnb3JpZS4nOwogIGVsc2UgaWYgKCFpbXAuYWN0aXZpdHlJZCkgaW1wLmVycm9yID0gJ1ZldWlsbGV6IGNob2lzaXIgdW5lIGFjdGl2aXTDqS4nOwogIGlmIChpbXAuZXJyb3IpIHJldHVybiByZW5kZXJRdWV1ZSgpOwogIHN0b3JlLnNldCgnY3JmX3Bob3RvZ3JhcGhlcicsIGltcC5waG90b2dyYXBoZXIpOwoKICBjb25zdCBxdWV1ZSA9IGltcC5pdGVtcy5maWx0ZXIoaSA9PiBvbmx5RmFpbGVkID8gaS5zdGF0ZSA9PT0gJ2Vycm9yJyA6IChpLnN0YXRlID09PSAncmVhZHknIHx8IGkuc3RhdGUgPT09ICdlcnJvcicpKTsKICBpZiAoIXF1ZXVlLmxlbmd0aCkgcmV0dXJuOwogIGltcC5ydW5uaW5nID0gdHJ1ZTsKICBxdWV1ZS5mb3JFYWNoKGkgPT4geyBpLnN0YXRlID0gJ3VwbG9hZGluZyc7IGkucHJvZ3Jlc3MgPSAwOyBpLmVycm9yID0gJyc7IH0pOwogIHJlbmRlclF1ZXVlKCk7CiAgbGV0IG9rID0gMCwga28gPSAwOwogIGNvbnN0IHdvcmtlciA9IGFzeW5jICgpID0+',
  'IHsKICAgIHdoaWxlIChxdWV1ZS5sZW5ndGgpIHsKICAgICAgY29uc3QgaXQgPSBxdWV1ZS5zaGlmdCgpOwogICAgICB0cnkgeyBhd2FpdCB1cGxvYWRJdGVtKGl0KTsgaXQuc3RhdGUgPSAnZG9uZSc7IGl0LnByb2dyZXNzID0gMTsgb2srKzsgfQogICAgICBjYXRjaCAoZSkgeyBpdC5zdGF0ZSA9ICdlcnJvcic7IGl0LnByb2dyZXNzID0gMDsgaXQuZXJyb3IgPSBlLm1lc3NhZ2UgfHwgIkwnaW1wb3J0YXRpb24gYSDDqWNob3XDqSBwb3VyIGNlIGZpY2hpZXIuIjsga28rKzsgfQogICAgICByZW5kZXJRdWV1ZSgpOwogICAgfQogIH07CiAgYXdhaXQgUHJvbWlzZS5hbGwoW3dvcmtlcigpLCB3b3JrZXIoKV0pOwogIGltcC5ydW5uaW5nID0gZmFsc2U7CiAgcmVuZGVyUXVldWUoKTsKICBpZiAoIWtvKSB0b2FzdCgnSW1wb3J0YXRpb24gdGVybWluw6llIOKckyDigJQgJyArIHBsdXJhbChvaywgJ2ZpY2hpZXIgZW5yZWdpc3Ryw6knLCAnZmljaGllcnMgZW5yZWdpc3Ryw6lzJykgKyAnLicpOwogIGVsc2UgdG9hc3QocGx1cmFsKGtvLCAnZmljaGllcicpICsgJyBlbiDDqWNoZWMuIFZvdXMgcG91dmV6IHLDqWVzc2F5ZXIuJywgJ2Vycm9yJyk7Cn0KCmZ1bmN0aW9uIHJlYWRCNjQoYmxvYikgewogIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7CiAgICBjb25zdCByID0gbmV3IEZpbGVSZWFkZXIoKTsKICAgIHIub25sb2FkID0gKCkgPT4gcmVzb2x2ZShTdHJpbmcoci5yZXN1bHQpLnNwbGl0KCcs',
  'JylbMV0gfHwgJycpOwogICAgci5vbmVycm9yID0gKCkgPT4gcmVqZWN0KG5ldyBFcnJvcignTGVjdHVyZSBkdSBmaWNoaWVyIGltcG9zc2libGUuJykpOwogICAgci5yZWFkQXNEYXRhVVJMKGJsb2IpOwogIH0pOwp9CgovKiogRW52b2kgZGUgbCdPUklHSU5BTCBpbmNoYW5nw6ksIHBhciBtb3JjZWF1eCwgcHVpcyBkZXMgbWluaWF0dXJlcyBzw6lwYXLDqWVzLiAqLwphc3luYyBmdW5jdGlvbiB1cGxvYWRJdGVtKGl0KSB7CiAgY29uc3QgZiA9IGl0LmZpbGU7CiAgY29uc3QgaW5pdCA9IGF3YWl0IGFwaSgnc3RhcnRVcGxvYWQnLCB7CiAgICBmaWxlbmFtZTogZi5uYW1lLCBtaW1lVHlwZTogZi50eXBlLCBzaXplOiBmLnNpemUsIGNhcHR1cmVEYXRlOiBpdC5jYXB0dXJlRGF0ZS50b0lTT1N0cmluZygpLCBjYXB0dXJlRGF0ZVNvdXJjZTogaXQuZGF0ZVNvdXJjZSwKICAgIHBob3RvZ3JhcGhlcjogaW1wLnBob3RvZ3JhcGhlciwgY2F0ZWdvcnlJZDogaW1wLmNhdGVnb3J5SWQsIGFjdGl2aXR5SWQ6IGltcC5hY3Rpdml0eUlkLAogICAgd2lkdGg6IGl0LmRlcml2ICYmIGl0LmRlcml2LndpZHRoLCBoZWlnaHQ6IGl0LmRlcml2ICYmIGl0LmRlcml2LmhlaWdodCwgZHVyYXRpb25TZWM6IGl0LmRlcml2ICYmIGl0LmRlcml2LmR1cmF0aW9uLAogIH0pOwogIHRyeSB7CiAgICBsZXQgb2Zmc2V0ID0gMDsKICAgIHdoaWxlIChvZmZzZXQgPCBmLnNpemUpIHsKICAgICAgY29uc3QgZW5kID0gTWF0aC5taW4ob2Zmc2V0ICsgaW5p',
  'dC5jaHVua1NpemUsIGYuc2l6ZSk7CiAgICAgIGNvbnN0IHIgPSBhd2FpdCBhcGkoJ3VwbG9hZENodW5rJywgaW5pdC5tZWRpYUlkLCBvZmZzZXQsIGF3YWl0IHJlYWRCNjQoZi5zbGljZShvZmZzZXQsIGVuZCkpKTsKICAgICAgb2Zmc2V0ID0gci5uZXh0OwogICAgICBpdC5wcm9ncmVzcyA9IE1hdGgubWluKDAuOTcsIG9mZnNldCAvIGYuc2l6ZSk7CiAgICAgIHJlbmRlclF1ZXVlU29vbigpOwogICAgfQogICAgaWYgKGl0LmRlcml2KSB7CiAgICAgIGF3YWl0IGFwaSgndXBsb2FkRGVyaXZhdGl2ZScsIGluaXQubWVkaWFJZCwgJ3RodW1iJywgYXdhaXQgcmVhZEI2NChpdC5kZXJpdi50aHVtYiksIGl0LmRlcml2LnRodW1iLnR5cGUpLmNhdGNoKCgpID0+IG51bGwpOwogICAgICBhd2FpdCBhcGkoJ3VwbG9hZERlcml2YXRpdmUnLCBpbml0Lm1lZGlhSWQsICdwcmV2aWV3JywgYXdhaXQgcmVhZEI2NChpdC5kZXJpdi5wcmV2aWV3KSwgaXQuZGVyaXYucHJldmlldy50eXBlKS5jYXRjaCgoKSA9PiBudWxsKTsKICAgIH0KICAgIGF3YWl0IGFwaSgnZmluaXNoVXBsb2FkJywgaW5pdC5tZWRpYUlkKTsKICB9IGNhdGNoIChlKSB7CiAgICBhcGkoJ2Fib3J0VXBsb2FkJywgaW5pdC5tZWRpYUlkKS5jYXRjaCgoKSA9PiBudWxsKTsKICAgIHRocm93IGU7CiAgfQp9CgovLyAtLS0tLS0tLS0tIG3DqXRhZG9ubsOpZXMgKGxlY3R1cmUgc2V1bGUgOiBsJ29yaWdpbmFsIG4nZXN0IGphbWFpcyBtb2RpZmnDqSkKYXN5bmMgZnVuY3Rp',
  'b24gZXh0cmFjdERhdGUoZmlsZSwga2luZCkgewogIGlmIChraW5kID09PSAnUEhPVE8nICYmIHdpbmRvdy5leGlmcikgewogICAgdHJ5IHsKICAgICAgY29uc3QgZCA9IGF3YWl0IGV4aWZyLnBhcnNlKGZpbGUsIHsgcGljazogWydEYXRlVGltZU9yaWdpbmFsJywgJ0NyZWF0ZURhdGUnLCAnRGF0ZVRpbWVEaWdpdGl6ZWQnXSB9KTsKICAgICAgY29uc3QgdiA9IGQgJiYgKGQuRGF0ZVRpbWVPcmlnaW5hbCB8fCBkLkNyZWF0ZURhdGUgfHwgZC5EYXRlVGltZURpZ2l0aXplZCk7CiAgICAgIGlmICh2IGluc3RhbmNlb2YgRGF0ZSAmJiAhaXNOYU4odikpIHJldHVybiB7IGRhdGU6IHYsIHNvdXJjZTogJ0VYSUYnIH07CiAgICB9IGNhdGNoIChlKSB7fQogIH0KICBpZiAoa2luZCA9PT0gJ1ZJREVPJykgeyBjb25zdCBkID0gYXdhaXQgcXVpY2tUaW1lRGF0ZShmaWxlKTsgaWYgKGQpIHJldHVybiB7IGRhdGU6IGQsIHNvdXJjZTogJ1ZJREVPX01FVEFEQVRBJyB9OyB9CiAgcmV0dXJuIHsgZGF0ZTogbmV3IERhdGUoZmlsZS5sYXN0TW9kaWZpZWQgfHwgRGF0ZS5ub3coKSksIHNvdXJjZTogJ0ZJTEVfREFURScgfTsKfQoKLyoqIERhdGUgZGUgY3LDqWF0aW9uIE1QNC9NT1YgKGF0b21lIG12aGQpLCBsdWUgcGFyIHRyYW5jaGVzLiAqLwphc3luYyBmdW5jdGlvbiBxdWlja1RpbWVEYXRlKGZpbGUpIHsKICBjb25zdCBzbGljZSA9IGFzeW5jIChzLCBsKSA9PiBuZXcgRGF0YVZpZXcoYXdhaXQgZmlsZS5zbGljZShzLCBNYXRoLm1p',
  'bihzICsgbCwgZmlsZS5zaXplKSkuYXJyYXlCdWZmZXIoKSk7CiAgYXN5bmMgZnVuY3Rpb24gZmluZChzdGFydCwgZW5kLCB0eXBlKSB7CiAgICBsZXQgb2ZmID0gc3RhcnQsIGd1YXJkID0gMDsKICAgIHdoaWxlIChvZmYgKyA4IDw9IGVuZCAmJiBndWFyZCsrIDwgMTAwMDApIHsKICAgICAgY29uc3QgdiA9IGF3YWl0IHNsaWNlKG9mZiwgMTYpOyBpZiAodi5ieXRlTGVuZ3RoIDwgOCkgcmV0dXJuIG51bGw7CiAgICAgIGxldCBzaXplID0gdi5nZXRVaW50MzIoMCksIGhlYWQgPSA4OwogICAgICBjb25zdCBuYW1lID0gU3RyaW5nLmZyb21DaGFyQ29kZSh2LmdldFVpbnQ4KDQpLCB2LmdldFVpbnQ4KDUpLCB2LmdldFVpbnQ4KDYpLCB2LmdldFVpbnQ4KDcpKTsKICAgICAgaWYgKHNpemUgPT09IDEgJiYgdi5ieXRlTGVuZ3RoID49IDE2KSB7IHNpemUgPSBOdW1iZXIodi5nZXRCaWdVaW50NjQoOCkpOyBoZWFkID0gMTY7IH0gZWxzZSBpZiAoc2l6ZSA9PT0gMCkgc2l6ZSA9IGVuZCAtIG9mZjsKICAgICAgaWYgKHNpemUgPCBoZWFkKSByZXR1cm4gbnVsbDsKICAgICAgaWYgKG5hbWUgPT09IHR5cGUpIHJldHVybiB7IHN0YXJ0OiBvZmYsIHNpemUsIGhlYWQgfTsKICAgICAgb2ZmICs9IHNpemU7CiAgICB9CiAgICByZXR1cm4gbnVsbDsKICB9CiAgdHJ5IHsKICAgIGNvbnN0IG1vb3YgPSBhd2FpdCBmaW5kKDAsIGZpbGUuc2l6ZSwgJ21vb3YnKTsgaWYgKCFtb292KSByZXR1cm4gbnVsbDsKICAgIGNvbnN0IG12aGQgPSBh',
  'd2FpdCBmaW5kKG1vb3Yuc3RhcnQgKyBtb292LmhlYWQsIG1vb3Yuc3RhcnQgKyBtb292LnNpemUsICdtdmhkJyk7IGlmICghbXZoZCkgcmV0dXJuIG51bGw7CiAgICBjb25zdCB2ID0gYXdhaXQgc2xpY2UobXZoZC5zdGFydCArIG12aGQuaGVhZCwgMjApOwogICAgY29uc3Qgc2VjcyA9IHYuZ2V0VWludDgoMCkgPT09IDEgPyBOdW1iZXIodi5nZXRCaWdVaW50NjQoNCkpIDogdi5nZXRVaW50MzIoNCk7CiAgICBpZiAoIXNlY3MpIHJldHVybiBudWxsOwogICAgY29uc3QgZCA9IG5ldyBEYXRlKChzZWNzIC0gMjA4Mjg0NDgwMCkgKiAxMDAwKTsKICAgIHJldHVybiBkLmdldEZ1bGxZZWFyKCkgPiAxOTkwICYmIGQgPCBuZXcgRGF0ZShEYXRlLm5vdygpICsgODY0MDAwMDApID8gZCA6IG51bGw7CiAgfSBjYXRjaCAoZSkgeyByZXR1cm4gbnVsbDsgfQp9CgovLyAtLS0tLS0tLS0tIG1pbmlhdHVyZXMgKGNvcGllIGTDqWNvZMOpZSDihpIgY2FudmFzIDsgZmljaGllcnMgc8OpcGFyw6lzKQpmdW5jdGlvbiB0b0Jsb2IoY2FudmFzLCBxKSB7CiAgcmV0dXJuIG5ldyBQcm9taXNlKHJlcyA9PiBjYW52YXMudG9CbG9iKGIgPT4gewogICAgaWYgKGIgJiYgYi50eXBlID09PSAnaW1hZ2Uvd2VicCcpIHJldHVybiByZXMoYik7CiAgICBjYW52YXMudG9CbG9iKGogPT4gcmVzKGopLCAnaW1hZ2UvanBlZycsIHEpOwogIH0sICdpbWFnZS93ZWJwJywgcSkpOwp9CmFzeW5jIGZ1bmN0aW9uIHJlbmRlclZhcmlhbnRzKHNyYywgdywgaCkg',
  'ewogIGNvbnN0IGRyYXcgPSBhc3luYyAobWF4LCBxKSA9PiB7CiAgICBjb25zdCBzID0gTWF0aC5taW4oMSwgbWF4IC8gTWF0aC5tYXgodywgaCkpOwogICAgY29uc3QgYyA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2NhbnZhcycpOyBjLndpZHRoID0gTWF0aC5yb3VuZCh3ICogcyk7IGMuaGVpZ2h0ID0gTWF0aC5yb3VuZChoICogcyk7CiAgICBjb25zdCBjdHggPSBjLmdldENvbnRleHQoJzJkJyk7IGN0eC5maWxsU3R5bGUgPSAnI2ZmZic7IGN0eC5maWxsUmVjdCgwLCAwLCBjLndpZHRoLCBjLmhlaWdodCk7IGN0eC5kcmF3SW1hZ2Uoc3JjLCAwLCAwLCBjLndpZHRoLCBjLmhlaWdodCk7CiAgICByZXR1cm4gdG9CbG9iKGMsIHEpOwogIH07CiAgcmV0dXJuIHsgdGh1bWI6IGF3YWl0IGRyYXcoNDgwLCAwLjc4KSwgcHJldmlldzogYXdhaXQgZHJhdygxNjAwLCAwLjg1KSwgd2lkdGg6IHcsIGhlaWdodDogaCB9Owp9CmFzeW5jIGZ1bmN0aW9uIG1ha2VEZXJpdmF0aXZlcyhmaWxlLCBraW5kKSB7CiAgY29uc3QgdXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChmaWxlKTsKICB0cnkgewogICAgaWYgKGtpbmQgPT09ICdQSE9UTycpIHsKICAgICAgY29uc3QgaW1nID0gYXdhaXQgbmV3IFByb21pc2UoKHJlcywgcmVqKSA9PiB7IGNvbnN0IGkgPSBuZXcgSW1hZ2UoKTsgaS5vbmxvYWQgPSAoKSA9PiByZXMoaSk7IGkub25lcnJvciA9IHJlajsgaS5zcmMgPSB1cmw7IH0pOwogICAgICBpZiAoIWltZy5uYXR1cmFsV2lkdGgp',
  'IHJldHVybiBudWxsOwogICAgICByZXR1cm4gYXdhaXQgcmVuZGVyVmFyaWFudHMoaW1nLCBpbWcubmF0dXJhbFdpZHRoLCBpbWcubmF0dXJhbEhlaWdodCk7CiAgICB9CiAgICBjb25zdCB2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgndmlkZW8nKTsgdi5tdXRlZCA9IHRydWU7IHYucGxheXNJbmxpbmUgPSB0cnVlOyB2LnByZWxvYWQgPSAnbWV0YWRhdGEnOyB2LnNyYyA9IHVybDsKICAgIGF3YWl0IG5ldyBQcm9taXNlKChyZXMsIHJlaikgPT4geyBjb25zdCB0ID0gc2V0VGltZW91dChyZWosIDE1MDAwKTsgdi5vbmxvYWRlZG1ldGFkYXRhID0gKCkgPT4geyBjbGVhclRpbWVvdXQodCk7IHJlcygpOyB9OyB2Lm9uZXJyb3IgPSAoKSA9PiB7IGNsZWFyVGltZW91dCh0KTsgcmVqKCk7IH07IH0pOwogICAgY29uc3QgZHVyYXRpb24gPSBpc0Zpbml0ZSh2LmR1cmF0aW9uKSA/IHYuZHVyYXRpb24gOiBudWxsOwogICAgYXdhaXQgbmV3IFByb21pc2UoKHJlcywgcmVqKSA9PiB7IGNvbnN0IHQgPSBzZXRUaW1lb3V0KHJlaiwgMTUwMDApOyB2Lm9uc2Vla2VkID0gKCkgPT4geyBjbGVhclRpbWVvdXQodCk7IHJlcygpOyB9OyB2LmN1cnJlbnRUaW1lID0gZHVyYXRpb24gPyBNYXRoLm1pbigxLCBkdXJhdGlvbiAvIDEwKSA6IDAuMDE7IH0pOwogICAgaWYgKCF2LnZpZGVvV2lkdGgpIHJldHVybiBudWxsOwogICAgY29uc3Qgb3V0ID0gYXdhaXQgcmVuZGVyVmFyaWFudHModiwgdi52aWRlb1dpZHRoLCB2LnZpZGVvSGVpZ2h0',
  'KTsgb3V0LmR1cmF0aW9uID0gZHVyYXRpb247CiAgICByZXR1cm4gb3V0OwogIH0gY2F0Y2ggKGUpIHsgcmV0dXJuIG51bGw7IH0gICAvLyBOYXZpZ2F0ZXVyIGluY2FwYWJsZSBkZSBkw6ljb2RlciAoSEVJQyBzb3VzIENocm9tZeKApikg4oaSIG1pbmlhdHVyZSBnw6luw6lyw6llIHBhciBEcml2ZQogIGZpbmFsbHkgeyBVUkwucmV2b2tlT2JqZWN0VVJMKHVybCk7IH0KfQoKLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBUw4lMw4lDSEFSR0VNRU5UUyAob3JpZ2luYXV4KQphc3luYyBmdW5jdGlvbiBmZXRjaE9yaWdpbmFsKG0sIG9uUHJvZ3Jlc3MpIHsKICBjb25zdCBwYXJ0cyA9IFtdOyBsZXQgb2Zmc2V0ID0gMDsKICB3aGlsZSAob2Zmc2V0IDwgbS5maWxlU2l6ZSkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnZG93bmxvYWRDaHVuaycsIG0uaWQsIG9mZnNldCk7CiAgICBjb25zdCBiaW4gPSBhdG9iKHIuZGF0YSk7IGNvbnN0IGJ5dGVzID0gbmV3IFVpbnQ4QXJyYXkoYmluLmxlbmd0aCk7CiAgICBmb3IgKGxldCBpID0gMDsgaSA8IGJpbi5sZW5ndGg7IGkrKykgYnl0ZXNbaV0gPSBiaW4uY2hhckNvZGVBdChpKTsKICAgIHBhcnRzLnB1c2goYnl0ZXMpOyBvZmZzZXQgPSByLm5leHQ7CiAgICBpZiAob25Qcm9ncmVzcykgb25Qcm9ncmVzcyhvZmZzZXQgLyBtLmZpbGVTaXplKTsKICAgIGlmICghYnl0ZXMubGVuZ3RoKSBicmVhazsKICB9',
  'CiAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKHBhcnRzLCB7IHR5cGU6IG0ubWltZVR5cGUgfSk7CiAgaWYgKGJsb2Iuc2l6ZSAhPT0gbS5maWxlU2l6ZSkgdGhyb3cgbmV3IEVycm9yKCdUw6lsw6ljaGFyZ2VtZW50IGluY29tcGxldC4gVmV1aWxsZXogcsOpZXNzYXllci4nKTsKICByZXR1cm4gYmxvYjsKfQpmdW5jdGlvbiBzYXZlQmxvYihibG9iLCBuYW1lKSB7CiAgY29uc3QgYSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2EnKTsgYS5ocmVmID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTsgYS5kb3dubG9hZCA9IG5hbWU7CiAgZG9jdW1lbnQuYm9keS5hcHBlbmRDaGlsZChhKTsgYS5jbGljaygpOyBhLnJlbW92ZSgpOwogIHNldFRpbWVvdXQoKCkgPT4gVVJMLnJldm9rZU9iamVjdFVSTChhLmhyZWYpLCA2MDAwMCk7Cn0KYXN5bmMgZnVuY3Rpb24gZG93bmxvYWRPbmUobSkgewogIHRvYXN0KCdUw6lsw6ljaGFyZ2VtZW50IGRlIMKrICcgKyBtLm9yaWdpbmFsRmlsZW5hbWUgKyAnIMK74oCmJywgJ2luZm8nKTsKICB0cnkgeyBzYXZlQmxvYihhd2FpdCBmZXRjaE9yaWdpbmFsKG0pLCBtLm9yaWdpbmFsRmlsZW5hbWUpOyB9CiAgY2F0Y2ggKGUpIHsgdG9hc3QoZS5tZXNzYWdlLCAnZXJyb3InKTsgfQp9Ci8qKiBaSVAgZGVzIE9SSUdJTkFVWCwgc2FucyBjb21wcmVzc2lvbiAobcOpdGhvZGUgU1RPUkUpLCBzYW5zIG1pbmlhdHVyZXMuICovCmFzeW5jIGZ1bmN0aW9uIGRvd25sb2FkWmlwKGlkcykgewogIGNvbnN0',
  'IG1lZGlhcyA9IFtdOyBjb25zdCBrbm93biA9IG5ldyBNYXAobGliLml0ZW1zLm1hcChtID0+IFttLmlkLCBtXSkpOwogIGNvbnN0IG1pc3NpbmcgPSBpZHMuZmlsdGVyKGlkID0+ICFrbm93bi5oYXMoaWQpKTsKICAvLyBTw6lsZWN0aW9uIHBsdXMgbGFyZ2UgcXVlIGxhIHBhZ2UgY2hhcmfDqWUgOiBvbiByw6ljdXDDqHJlIGxlcyBtw6l0YWRvbm7DqWVzIG1hbnF1YW50ZXMgcGFnZSBwYXIgcGFnZS4KICBmb3IgKGxldCBvZmYgPSAwOyBpZHMuc29tZShpZCA9PiAha25vd24uaGFzKGlkKSk7IG9mZiArPSAxMjApIHsKICAgIGNvbnN0IHIgPSBhd2FpdCBhcGkoJ2xpc3RNZWRpYScsIE9iamVjdC5hc3NpZ24oe30sIGxpYi5maWx0ZXJzKSwgb2ZmLCAxMjApLmNhdGNoKCgpID0+ICh7IGl0ZW1zOiBbXSwgdG90YWw6IDAgfSkpOwogICAgci5pdGVtcy5mb3JFYWNoKG0gPT4ga25vd24uc2V0KG0uaWQsIG0pKTsKICAgIGlmICghci5pdGVtcy5sZW5ndGggfHwgb2ZmICsgMTIwID49IHIudG90YWwpIGJyZWFrOwogIH0KICBpZHMuZm9yRWFjaChpZCA9PiBrbm93bi5nZXQoaWQpICYmIG1lZGlhcy5wdXNoKGtub3duLmdldChpZCkpKTsKICBpZiAoIW1lZGlhcy5sZW5ndGgpIHJldHVybjsKICBjb25zdCB7IGRvd25sb2FkWmlwOiB6aXAgfSA9IGF3YWl0IGltcG9ydCgnaHR0cHM6Ly9jZG4uanNkZWxpdnIubmV0L25wbS9jbGllbnQtemlwQDIuNS4wL2luZGV4LmpzJyk7CiAgY29uc3QgdXNlZCA9IG5ldyBTZXQoKTsgY29uc3Qg',
  'ZmlsZXMgPSBbXTsKICBmb3IgKGxldCBpID0gMDsgaSA8IG1lZGlhcy5sZW5ndGg7IGkrKykgewogICAgY29uc3QgbSA9IG1lZGlhc1tpXTsKICAgIHRvYXN0KGBaSVAgOiAke2kgKyAxfSAvICR7bWVkaWFzLmxlbmd0aH0g4oCUICR7bS5vcmlnaW5hbEZpbGVuYW1lfWAsICdpbmZvJyk7CiAgICBsZXQgbmFtZSA9IG0ub3JpZ2luYWxGaWxlbmFtZSwgbiA9IDI7CiAgICB3aGlsZSAodXNlZC5oYXMobmFtZS50b0xvd2VyQ2FzZSgpKSkgeyBjb25zdCBkID0gbS5vcmlnaW5hbEZpbGVuYW1lLmxhc3RJbmRleE9mKCcuJyk7IG5hbWUgPSBkID4gMCA/IG0ub3JpZ2luYWxGaWxlbmFtZS5zbGljZSgwLCBkKSArICcgKCcgKyAobisrKSArICcpJyArIG0ub3JpZ2luYWxGaWxlbmFtZS5zbGljZShkKSA6IG0ub3JpZ2luYWxGaWxlbmFtZSArICcgKCcgKyAobisrKSArICcpJzsgfQogICAgdXNlZC5hZGQobmFtZS50b0xvd2VyQ2FzZSgpKTsKICAgIHRyeSB7IGZpbGVzLnB1c2goeyBuYW1lLCBsYXN0TW9kaWZpZWQ6IG5ldyBEYXRlKG0uY2FwdHVyZURhdGUpLCBpbnB1dDogYXdhaXQgZmV0Y2hPcmlnaW5hbChtKSB9KTsgfQogICAgY2F0Y2ggKGUpIHsgdG9hc3QobS5vcmlnaW5hbEZpbGVuYW1lICsgJyA6ICcgKyBlLm1lc3NhZ2UsICdlcnJvcicpOyB9CiAgfQogIGNvbnN0IGJsb2IgPSBhd2FpdCB6aXAoZmlsZXMpLmJsb2IoKTsKICBzYXZlQmxvYihibG9iLCAncGhvdG90aGVxdWUtJyArIG5ldyBEYXRlKCkudG9JU09TdHJpbmco',
  'KS5zbGljZSgwLCAxMCkgKyAnLScgKyBmaWxlcy5sZW5ndGggKyAnLW1lZGlhcy56aXAnKTsKICB0b2FzdCgnQXJjaGl2ZSBaSVAgcHLDqnRlICgnICsgZmlsZXMubGVuZ3RoICsgJyBvcmlnaW5hdXgpLicpOwp9CgovLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IFRBQkxFQVUgREUgQk9SRApjb25zdCBKTEFCRUwgPSB7IFVQTE9BRDogJ2EgaW1wb3J0w6knLCBTT1JUOiAnYSBtYXJxdcOpIGNvbW1lIHRyacOpKHMpJywgVU5TT1JUOiAnYSByZW1pcyDCqyDDgCB0cmllciDCuycsIERFTEVURTogJ2Egc3VwcHJpbcOpIGTDqWZpbml0aXZlbWVudCcsIFVQREFURTogJ2EgbW9kaWZpw6knLAogIENBVEVHT1JZX0NSRUFURTogJ2EgY3LDqcOpIGxhIGNhdMOpZ29yaWUnLCBDQVRFR09SWV9VUERBVEU6ICdhIG1vZGlmacOpIGxhIGNhdMOpZ29yaWUnLCBDQVRFR09SWV9ESVNBQkxFOiAnYSBkw6lzYWN0aXbDqSBsYSBjYXTDqWdvcmllJywgQ0FURUdPUllfRU5BQkxFOiAnYSByw6lhY3RpdsOpIGxhIGNhdMOpZ29yaWUnLCBDQVRFR09SWV9ERUxFVEU6ICdhIHN1cHByaW3DqSBsYSBjYXTDqWdvcmllJywKICBBQ1RJVklUWV9DUkVBVEU6ICJhIGNyw6nDqSBsJ2FjdGl2aXTDqSIsIEFDVElWSVRZX1VQREFURTogImEgbW9kaWZpw6kgbCdhY3Rpdml0w6kiLCBBQ1RJVklUWV9ESVNBQkxFOiAiYSBkw6lzYWN0aXbDqSBsJ2FjdGl2aXTDqSIsIEFDVElWSVRZX0VO',
  'QUJMRTogImEgcsOpYWN0aXbDqSBsJ2FjdGl2aXTDqSIsIEFDVElWSVRZX0RFTEVURTogImEgc3VwcHJpbcOpIGwnYWN0aXZpdMOpIiwgTUFJTlRFTkFOQ0U6ICdhIGxhbmPDqSB1biBuZXR0b3lhZ2UnIH07CmNvbnN0IENPVU5URUQgPSBbJ1VQTE9BRCcsICdTT1JUJywgJ1VOU09SVCcsICdERUxFVEUnXTsKCmFzeW5jIGZ1bmN0aW9uIHJlbmRlckRhc2hib2FyZCgpIHsKICBjb25zdCB2ID0gJCgnI3ZpZXcnKTsKICB2LmlubmVySFRNTCA9ICc8aDE+VGFibGVhdSBkZSBib3JkPC9oMT48cCBjbGFzcz0ibXV0ZWQiPjxzcGFuIGNsYXNzPSJzcGluIj48L3NwYW4+IENoYXJnZW1lbnTigKY8L3A+JzsKICBsZXQgZDsKICB0cnkgeyBkID0gYXdhaXQgYXBpKCdnZXREYXNoYm9hcmQnKTsgfSBjYXRjaCAoZSkgeyB2LmlubmVySFRNTCA9ICc8aDE+VGFibGVhdSBkZSBib3JkPC9oMT48ZGl2IGNsYXNzPSJhbGVydCI+JyArIGVzYyhlLm1lc3NhZ2UpICsgJzwvZGl2Pic7IHJldHVybjsgfQogIGlmIChzdGF0ZS52aWV3ICE9PSAnZGFzaGJvYXJkJykgcmV0dXJuOwogIGNvbnN0IHMgPSBkLnN0YXRzOwogIGNvbnN0IGNhcmQgPSAobGFiZWwsIHZhbCwgY29sb3IsIGFjdGlvbikgPT4gYDxkaXYgY2xhc3M9ImNhcmQgc3RhdCIgb25jbGljaz0iJHthY3Rpb259Ij48ZGl2IGNsYXNzPSJzbWFsbCBtdXRlZCI+JHtsYWJlbH08L2Rpdj48ZGl2IGNsYXNzPSJ2IiBzdHlsZT0iJHtjb2xvciA/ICdjb2xvcjonICsgY29sb3IgOiAnJ30iPiR7',
  'bmYodmFsKX08L2Rpdj48L2Rpdj5gOwogIGNvbnN0IG1heENhdCA9IE1hdGgubWF4KDEsIC4uLmQuYnJlYWtkb3duLm1hcChiID0+IGIuY291bnQpKTsKICB2LmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPSJiZXR3ZWVuIj48ZGl2PjxoMT5UYWJsZWF1IGRlIGJvcmQ8L2gxPjxwIGNsYXNzPSJtdXRlZCIgc3R5bGU9Im1hcmdpbjowIj5Cb25qb3VyICR7ZXNjKHN0YXRlLm5hbWUpfSDCtyAke2ZtdEJ5dGVzKHMudG90YWxCeXRlcyl9IGQnb3JpZ2luYXV4IGNvbnNlcnbDqXM8L3A+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciPjxidXR0b24gY2xhc3M9ImJ0biBidG4tb3V0bGluZSIgb25jbGljaz0iZ28oJ2ltcG9ydCcpIj4ke0kudXBsb2FkfSBJbXBvcnRlcjwvYnV0dG9uPgogICAgJHtzLnRvU29ydCA/IGA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLXByaW1hcnkiIG9uY2xpY2s9Im9wZW5MaWJyYXJ5KHtzdGF0dXM6J1RPX1NPUlQnLHNvcnQ6J3VwbG9hZF9hc2MnfSkiPiR7cGx1cmFsKHMudG9Tb3J0LCAnbcOpZGlhJyl9IMOgIHRyaWVyIOKGkjwvYnV0dG9uPmAgOiAnPHNwYW4gY2xhc3M9ImJhZGdlIGJhZGdlLWRvbmUiIHN0eWxlPSJoZWlnaHQ6MzhweDtwYWRkaW5nOjAgMTJweCI+VG91dCBlc3QgdHJpw6k8L3NwYW4+J308L2Rpdj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9InN0YXRzIHNlY3Rpb24iPgogICAgICAke2NhcmQoJ1RvdGFsIGRlcyBtw6lkaWFzJywgcy50b3RhbCwgJycsICJvcGVuTGlicmFyeSh7fSkiKX0K',
  'ICAgICAgJHtjYXJkKCfDgCB0cmllcicsIHMudG9Tb3J0LCBzLnRvU29ydCA/ICd2YXIoLS1yZWQpJyA6ICcnLCAib3BlbkxpYnJhcnkoe3N0YXR1czonVE9fU09SVCd9KSIpfQogICAgICAke2NhcmQoJ1RyacOpcycsIHMuc29ydGVkLCAndmFyKC0tZ3JlZW4pJywgIm9wZW5MaWJyYXJ5KHtzdGF0dXM6J1NPUlRFRCd9KSIpfQogICAgICAke2NhcmQoJ1Bob3RvcycsIHMucGhvdG9zLCAnJywgIm9wZW5MaWJyYXJ5KHt0eXBlOidQSE9UTyd9KSIpfQogICAgICAke2NhcmQoJ1ZpZMOpb3MnLCBzLnZpZGVvcywgJycsICJvcGVuTGlicmFyeSh7dHlwZTonVklERU8nfSkiKX0KICAgICAgJHtjYXJkKCdJbXBvcnTDqXMgY2V0dGUgc2VtYWluZScsIHMudGhpc1dlZWssICcnLCAib3BlbkxpYnJhcnkoe3NvcnQ6J3VwbG9hZF9kZXNjJ30pIil9CiAgICAgICR7Y2FyZCgnSW1wb3J0w6lzIGNlIG1vaXMnLCBzLnRoaXNNb250aCwgJycsICJvcGVuTGlicmFyeSh7c29ydDondXBsb2FkX2Rlc2MnfSkiKX0KICAgIDwvZGl2PgogICAgPGRpdiBjbGFzcz0iZGFzaCI+PGRpdj4KICAgICAgPGRpdiBjbGFzcz0iYmV0d2VlbiI+PGgyPkRlcm5pZXJzIG3DqWRpYXMgaW1wb3J0w6lzPC9oMj48YSBjbGFzcz0ic21hbGwgbXV0ZWQiIHN0eWxlPSJjdXJzb3I6cG9pbnRlciIgb25jbGljaz0ib3BlbkxpYnJhcnkoe3NvcnQ6J3VwbG9hZF9kZXNjJ30pIj5Ub3V0IHZvaXIg4oaSPC9hPjwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJyZWNlbnQgc2Vj',
  'dGlvbiIgaWQ9InJlY2VudCI+JHtkLnJlY2VudC5sZW5ndGggPyBkLnJlY2VudC5tYXAobSA9PiBgPGRpdiBkYXRhLXRodW1iPSIke20uaWR9IiB0aXRsZT0iJHtlc2MobS5vcmlnaW5hbEZpbGVuYW1lKX0iPiR7ZXNjKG0uZXh0ZW5zaW9uLnRvVXBwZXJDYXNlKCkpfTxzcGFuIGNsYXNzPSJkb3QiIHN0eWxlPSJiYWNrZ3JvdW5kOiR7bS5zdGF0dXMgPT09ICdTT1JURUQnID8gJ3ZhcigtLWdyZWVuKScgOiAndmFyKC0tcmVkKSd9Ij48L3NwYW4+PC9kaXY+YCkuam9pbignJykgOiAnPHAgY2xhc3M9Im11dGVkIj5BdWN1biBtw6lkaWEgcG91ciBsZSBtb21lbnQuPC9wPid9PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9ImJldHdlZW4gc2VjdGlvbiI+PGgyPk3DqWRpYXMgbsOpY2Vzc2l0YW50IHVuZSBhY3Rpb248L2gyPiR7cy50b1NvcnQgPyBgPGEgY2xhc3M9InNtYWxsIG11dGVkIiBzdHlsZT0iY3Vyc29yOnBvaW50ZXIiIG9uY2xpY2s9Im9wZW5MaWJyYXJ5KHtzdGF0dXM6J1RPX1NPUlQnLHNvcnQ6J3VwbG9hZF9hc2MnfSkiPlRyaWVyIOKGkjwvYT5gIDogJyd9PC9kaXY+CiAgICAgIDxkaXYgY2xhc3M9ImNhcmQgc2VjdGlvbiI+PHVsIGNsYXNzPSJsaXN0Ij4ke2QudG9Tb3J0Lmxlbmd0aCA/IGQudG9Tb3J0Lm1hcChtID0+IGA8bGkgY2xhc3M9InJvdyIgc3R5bGU9ImZsZXgtd3JhcDpub3dyYXAiPjxkaXYgc3R5bGU9ImZsZXg6MTttaW4td2lkdGg6MCI+PGRpdiBzdHlsZT0iZm9udC13ZWlnaHQ6NjAwO292ZXJmbG93',
  'OmhpZGRlbjt0ZXh0LW92ZXJmbG93OmVsbGlwc2lzO3doaXRlLXNwYWNlOm5vd3JhcCI+JHtlc2MobS5vcmlnaW5hbEZpbGVuYW1lKX08L2Rpdj48ZGl2IGNsYXNzPSJzbWFsbCBtdXRlZCI+JHtlc2MobS5jYXRlZ29yeU5hbWUpfSDCtyAke2VzYyhtLmFjdGl2aXR5TmFtZSl9IMK3IGltcG9ydMOpIGxlICR7Zm10RGF0ZShtLnVwbG9hZGVkQXQpfTwvZGl2PjwvZGl2PjxzcGFuIGNsYXNzPSJiYWRnZSBiYWRnZS10b2RvIj7DgCB0cmllcjwvc3Bhbj48L2xpPmApLmpvaW4oJycpIDogJzxsaSBjbGFzcz0ibXV0ZWQiPkF1Y3VuIG3DqWRpYSBlbiBhdHRlbnRlIGRlIHRyaS48L2xpPid9PC91bD48L2Rpdj4KICAgIDwvZGl2PjxkaXY+CiAgICAgIDxoMj5BY3Rpdml0w6kgZGUgbGEgcGhvdG90aMOocXVlPC9oMj4KICAgICAgPGRpdiBjbGFzcz0iY2FyZCBzZWN0aW9uIj48dWwgY2xhc3M9Imxpc3QiPiR7ZC5qb3VybmFsLmxlbmd0aCA/IGQuam91cm5hbC5tYXAoaiA9PiBgPGxpPjxkaXY+PGI+JHtlc2Moai5hY3Rvcil9PC9iPiAke0pMQUJFTFtqLmFjdGlvbl0gfHwgZXNjKGouYWN0aW9uKX0gJHtDT1VOVEVELmluY2x1ZGVzKGouYWN0aW9uKSA/ICc8Yj4nICsgcGx1cmFsKGouY291bnQsICdtw6lkaWEnKSArICc8L2I+JyA6IChqLmRldGFpbHMgPyAnwqsgJyArIGVzYyhqLmRldGFpbHMpICsgJyDCuycgOiAnJyl9PC9kaXY+PGRpdiBjbGFzcz0ic21hbGwgbXV0ZWQiPiR7Zm10RGF0ZShqLmRhdGUsIHRydWUpfSR7Q09VTlRF',
  'RC5pbmNsdWRlcyhqLmFjdGlvbikgJiYgai5kZXRhaWxzID8gJyDCtyAnICsgZXNjKGouZGV0YWlscykgOiAnJ308L2Rpdj48L2xpPmApLmpvaW4oJycpIDogJzxsaSBjbGFzcz0ibXV0ZWQiPkF1Y3VuZSBhY3Rpdml0w6kgcsOpY2VudGUuPC9saT4nfTwvdWw+PC9kaXY+CiAgICAgIDxoMiBjbGFzcz0ic2VjdGlvbiI+UsOpcGFydGl0aW9uIHBhciBjYXTDqWdvcmllPC9oMj4KICAgICAgPGRpdiBjbGFzcz0iY2FyZCBzZWN0aW9uIiBzdHlsZT0icGFkZGluZzoxNHB4Ij4ke2QuYnJlYWtkb3duLmxlbmd0aCA/IGQuYnJlYWtkb3duLm1hcChiID0+IGA8ZGl2IHN0eWxlPSJtYXJnaW4tYm90dG9tOjEwcHg7Y3Vyc29yOnBvaW50ZXIiIG9uY2xpY2s9Im9wZW5MaWJyYXJ5KHtjYXRlZ29yeTonJHtiLmlkfSd9KSI+PGRpdiBjbGFzcz0iYmV0d2VlbiIgc3R5bGU9ImFsaWduLWl0ZW1zOmNlbnRlciI+PHNwYW4+JHtlc2MoYi5uYW1lKX08L3NwYW4+PHNwYW4gY2xhc3M9Im11dGVkIj4ke25mKGIuY291bnQpfTwvc3Bhbj48L2Rpdj48ZGl2IGNsYXNzPSJiYXIiPjxkaXYgc3R5bGU9IndpZHRoOiR7Yi5jb3VudCAvIG1heENhdCAqIDEwMH0lO2JhY2tncm91bmQ6IzM3NDE1MSI+PC9kaXY+PC9kaXY+PC9kaXY+YCkuam9pbignJykgOiAnPHNwYW4gY2xhc3M9Im11dGVkIj7igJQ8L3NwYW4+J308L2Rpdj4KICAgIDwvZGl2PjwvZGl2PmA7CiAgbG9hZFRodW1icyhkLnJlY2VudC5tYXAobSA9PiBtLmlkKSwgJyNyZWNlbnQnKTsKfQoK',
  'YXN5bmMgZnVuY3Rpb24gbG9hZFRodW1icyhpZHMsIHNjb3BlKSB7CiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpZHMubGVuZ3RoOyBpICs9IDI0KSB7CiAgICBjb25zdCBtYXAgPSBhd2FpdCBhcGkoJ2dldFRodW1ibmFpbHMnLCBpZHMuc2xpY2UoaSwgaSArIDI0KSkuY2F0Y2goKCkgPT4gKHt9KSk7CiAgICBPYmplY3Qua2V5cyhtYXApLmZvckVhY2goaWQgPT4gewogICAgICB0aHVtYkNhY2hlW2lkXSA9IG1hcFtpZF07CiAgICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoKHNjb3BlIHx8ICcnKSArICcgW2RhdGEtdGh1bWI9IicgKyBpZCArICciXScpLmZvckVhY2goZWwgPT4geyBpZiAobWFwW2lkXSkgZWwuaW5uZXJIVE1MID0gJzxpbWcgc3JjPSInICsgbWFwW2lkXSArICciIGFsdD0iIiBsb2FkaW5nPSJsYXp5Ij4nICsgKGVsLnF1ZXJ5U2VsZWN0b3IoJy5kb3QnKSA/IGVsLnF1ZXJ5U2VsZWN0b3IoJy5kb3QnKS5vdXRlckhUTUwgOiAnJykgKyBBcnJheS5mcm9tKGVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5wbGF5LC52ZCcpKS5tYXAoeCA9PiB4Lm91dGVySFRNTCkuam9pbignJyk7IH0pOwogICAgfSk7CiAgfQp9CmNvbnN0IHRodW1iQ2FjaGUgPSB7fTsKCi8vID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT0gUEhPVE9USMOIUVVFCmNvbnN0IEVNUFRZX0ZJTFRFUlMgPSB7IHE6ICcnLCBzdGF0dXM6ICcnLCB0eXBlOiAnJywgY2F0ZWdvcnk6ICcn',
  'LCBhY3Rpdml0eTogJycsIHBob3RvZ3JhcGhlcjogJycsIGRhdGVNb2RlOiAnJywgZGF0ZUZpZWxkOiAnY2FwdHVyZScsIGRhdGU6ICcnLCBmcm9tOiAnJywgdG86ICcnLCBtb250aDogJycsIHllYXI6ICcnLCBzb3J0OiAnY2FwdHVyZV9kZXNjJyB9Owpjb25zdCBsaWIgPSB7IGZpbHRlcnM6IE9iamVjdC5hc3NpZ24oe30sIEVNUFRZX0ZJTFRFUlMpLCBpdGVtczogW10sIHRvdGFsOiBudWxsLCBsb2FkaW5nOiBmYWxzZSwgZG9uZTogZmFsc2UsIHNlbGVjdGVkOiBuZXcgU2V0KCksIHNob3dGaWx0ZXJzOiBmYWxzZSwgb3BlbklkOiBudWxsLCByZXFJZDogMCwgY2F0YWxvZzogW10gfTsKY29uc3QgUEFHRSA9IDYwOwoKZnVuY3Rpb24gb3BlbkxpYnJhcnkoZikgeyBsaWIuZmlsdGVycyA9IE9iamVjdC5hc3NpZ24oe30sIEVNUFRZX0ZJTFRFUlMsIGYpOyBnbygnbGlicmFyeScpOyB9Cgphc3luYyBmdW5jdGlvbiByZW5kZXJMaWJyYXJ5KCkgewogIGNvbnN0IHYgPSAkKCcjdmlldycpOwogIGxpYi5jYXRhbG9nID0gYXdhaXQgbG9hZENhdGFsb2codHJ1ZSkuY2F0Y2goKCkgPT4gW10pOwogIGlmIChzdGF0ZS52aWV3ICE9PSAnbGlicmFyeScpIHJldHVybjsKICBjb25zdCBmID0gbGliLmZpbHRlcnM7CiAgY29uc3Qgc2VnID0gKGtleSwgb3B0cykgPT4gYDxkaXYgY2xhc3M9InNlZyI+JHtvcHRzLm1hcChvID0+IGA8YnV0dG9uIGNsYXNzPSIke2Zba2V5XSA9PT0gb1swXSA/ICdvbicgOiAnJ30iIG9uY2xpY2s9InNldEZp',
  'bHRlcignJHtrZXl9JywnJHtvWzBdfScpIj4ke29bMV19PC9idXR0b24+YCkuam9pbignJyl9PC9kaXY+YDsKICBjb25zdCBjYXQgPSBsaWIuY2F0YWxvZy5maW5kKGMgPT4gYy5pZCA9PT0gZi5jYXRlZ29yeSk7CiAgY29uc3QgYWN0aXZlQ291bnQgPSBbJ3N0YXR1cycsICd0eXBlJywgJ2NhdGVnb3J5JywgJ2FjdGl2aXR5JywgJ3Bob3RvZ3JhcGhlcicsICdkYXRlTW9kZSddLmZpbHRlcihrID0+IGZba10pLmxlbmd0aDsKICBjb25zdCB5ZWFycyA9IFtdOyBmb3IgKGxldCB5ID0gbmV3IERhdGUoKS5nZXRGdWxsWWVhcigpOyB5ID49IDIwMTA7IHktLSkgeWVhcnMucHVzaCh5KTsKICB2LmlubmVySFRNTCA9IGA8aDE+UGhvdG90aMOocXVlPC9oMT48cCBjbGFzcz0ibXV0ZWQiIGlkPSJjb3VudCIgc3R5bGU9Im1hcmdpbjowIj5DaGFyZ2VtZW504oCmPC9wPgogICAgPGRpdiBjbGFzcz0icm93IHNlY3Rpb24iIHN0eWxlPSJmbGV4LXdyYXA6bm93cmFwIj4KICAgICAgPGlucHV0IGlkPSJxIiBjbGFzcz0iaW5wdXQiIHR5cGU9InNlYXJjaCIgcGxhY2Vob2xkZXI9IlJlY2hlcmNoZXIgdW4gZmljaGllciwgdW4gcGhvdG9ncmFwaGUsIHVuZSBhY3Rpdml0w6ksIHVuZSBjYXTDqWdvcmll4oCmIiB2YWx1ZT0iJHtlc2MoZi5xKX0iIHN0eWxlPSJmbGV4OjE7aGVpZ2h0OjQwcHgiPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLW91dGxpbmUiIHN0eWxlPSJoZWlnaHQ6NDBweCIgb25jbGljaz0ibGliLnNob3dGaWx0ZXJz',
  'PSFsaWIuc2hvd0ZpbHRlcnM7cmVuZGVyTGlicmFyeSgpIj5GaWx0cmVzJHthY3RpdmVDb3VudCA/ICcgPHNwYW4gY2xhc3M9ImJhZGdlIGJhZGdlLWRhcmsiPicgKyBhY3RpdmVDb3VudCArICc8L3NwYW4+JyA6ICcnfTwvYnV0dG9uPgogICAgPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3ciIHN0eWxlPSJtYXJnaW4tdG9wOjEwcHgiPgogICAgICAke3NlZygnc3RhdHVzJywgW1snJywgJ1RvdXMnXSwgWydUT19TT1JUJywgJ8OAIHRyaWVyJ10sIFsnU09SVEVEJywgJ1RyacOpZXMnXV0pfQogICAgICAke3NlZygndHlwZScsIFtbJycsICdUb3VzJ10sIFsnUEhPVE8nLCAnUGhvdG9zJ10sIFsnVklERU8nLCAnVmlkw6lvcyddXSl9CiAgICAgIDxzZWxlY3QgY2xhc3M9InNlbGVjdCIgc3R5bGU9IndpZHRoOmF1dG8iIG9uY2hhbmdlPSJzZXRGaWx0ZXIoJ3NvcnQnLHRoaXMudmFsdWUpIj4KICAgICAgICAke1tbJ2NhcHR1cmVfZGVzYycsICdQcmlzZSBkZSB2dWUgOiByw6ljZW50ZXMnXSwgWydjYXB0dXJlX2FzYycsICdQcmlzZSBkZSB2dWUgOiBhbmNpZW5uZXMnXSwgWyd1cGxvYWRfZGVzYycsICdJbXBvcnRhdGlvbiA6IHLDqWNlbnRlcyddLCBbJ3VwbG9hZF9hc2MnLCAnSW1wb3J0YXRpb24gOiBhbmNpZW5uZXMnXSwgWyduYW1lX2FzYycsICdOb20gOiBBIOKGkiBaJ10sIFsnbmFtZV9kZXNjJywgJ05vbSA6IFog4oaSIEEnXV0ubWFwKG8gPT4gYDxvcHRpb24gdmFsdWU9IiR7b1swXX0iICR7Zi5zb3J0ID09PSBvWzBd',
  'ID8gJ3NlbGVjdGVkJyA6ICcnfT4ke29bMV19PC9vcHRpb24+YCkuam9pbignJyl9CiAgICAgIDwvc2VsZWN0PgogICAgICAke2FjdGl2ZUNvdW50ID8gYDxidXR0b24gY2xhc3M9ImJ0biBidG4tZ2hvc3QgYnRuLXNtIiBvbmNsaWNrPSJsaWIuZmlsdGVycz1PYmplY3QuYXNzaWduKHt9LEVNUFRZX0ZJTFRFUlMse3E6bGliLmZpbHRlcnMucSxzb3J0OmxpYi5maWx0ZXJzLnNvcnR9KTtyZW5kZXJMaWJyYXJ5KCkiPuKGuiBSw6lpbml0aWFsaXNlcjwvYnV0dG9uPmAgOiAnJ30KICAgIDwvZGl2PgogICAgPGRpdiBjbGFzcz0iY2FyZCBmaWx0ZXJzICR7bGliLnNob3dGaWx0ZXJzID8gJycgOiAnaGlkZGVuJ30iPgogICAgICA8ZGl2PjxsYWJlbCBjbGFzcz0ibGJsIj5DYXTDqWdvcmllPC9sYWJlbD48c2VsZWN0IGNsYXNzPSJzZWxlY3QiIG9uY2hhbmdlPSJsaWIuZmlsdGVycy5hY3Rpdml0eT0nJztzZXRGaWx0ZXIoJ2NhdGVnb3J5Jyx0aGlzLnZhbHVlKSI+PG9wdGlvbiB2YWx1ZT0iIj5Ub3V0ZXM8L29wdGlvbj4ke2xpYi5jYXRhbG9nLm1hcChjID0+IGA8b3B0aW9uIHZhbHVlPSIke2MuaWR9IiAke2MuaWQgPT09IGYuY2F0ZWdvcnkgPyAnc2VsZWN0ZWQnIDogJyd9PiR7ZXNjKGMubmFtZSl9JHtjLmFjdGl2ZSA/ICcnIDogJyAoZMOpc2FjdGl2w6llKSd9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+PC9kaXY+CiAgICAgIDxkaXY+PGxhYmVsIGNsYXNzPSJsYmwiPkFjdGl2aXTDqTwvbGFiZWw+PHNlbGVjdCBj',
  'bGFzcz0ic2VsZWN0IiAke2NhdCA/ICcnIDogJ2Rpc2FibGVkJ30gb25jaGFuZ2U9InNldEZpbHRlcignYWN0aXZpdHknLHRoaXMudmFsdWUpIj48b3B0aW9uIHZhbHVlPSIiPiR7Y2F0ID8gJ1RvdXRlcycgOiAnQ2hvaXNpc3NleiB1bmUgY2F0w6lnb3JpZSd9PC9vcHRpb24+JHtjYXQgPyBjYXQuYWN0aXZpdGllcy5tYXAoYSA9PiBgPG9wdGlvbiB2YWx1ZT0iJHthLmlkfSIgJHthLmlkID09PSBmLmFjdGl2aXR5ID8gJ3NlbGVjdGVkJyA6ICcnfT4ke2VzYyhhLm5hbWUpfSR7YS5hY3RpdmUgPyAnJyA6ICcgKGTDqXNhY3RpdsOpZSknfTwvb3B0aW9uPmApLmpvaW4oJycpIDogJyd9PC9zZWxlY3Q+PC9kaXY+CiAgICAgIDxkaXY+PGxhYmVsIGNsYXNzPSJsYmwiPlBob3RvZ3JhcGhlPC9sYWJlbD48aW5wdXQgaWQ9ImZwaCIgY2xhc3M9ImlucHV0IiBwbGFjZWhvbGRlcj0iTm9tIGR1IHBob3RvZ3JhcGhlIiB2YWx1ZT0iJHtlc2MoZi5waG90b2dyYXBoZXIpfSI+PC9kaXY+CiAgICAgIDxkaXY+PGxhYmVsIGNsYXNzPSJsYmwiPkRhdGU8L2xhYmVsPjxkaXYgY2xhc3M9InJvdyIgc3R5bGU9ImZsZXgtd3JhcDpub3dyYXAiPgogICAgICAgIDxzZWxlY3QgY2xhc3M9InNlbGVjdCIgb25jaGFuZ2U9InNldEZpbHRlcignZGF0ZU1vZGUnLHRoaXMudmFsdWUpIj4ke1tbJycsICdUb3V0ZXMgbGVzIGRhdGVzJ10sIFsnZGF0ZScsICdEYXRlIHByw6ljaXNlJ10sIFsncmFuZ2UnLCAnUMOpcmlvZGUnXSwgWydtb250aCcsICdNb2lz',
  'J10sIFsneWVhcicsICdBbm7DqWUnXV0ubWFwKG8gPT4gYDxvcHRpb24gdmFsdWU9IiR7b1swXX0iICR7Zi5kYXRlTW9kZSA9PT0gb1swXSA/ICdzZWxlY3RlZCcgOiAnJ30+JHtvWzFdfTwvb3B0aW9uPmApLmpvaW4oJycpfTwvc2VsZWN0PgogICAgICAgICR7Zi5kYXRlTW9kZSA/IGA8c2VsZWN0IGNsYXNzPSJzZWxlY3QiIHN0eWxlPSJ3aWR0aDoxMzBweCIgb25jaGFuZ2U9InNldEZpbHRlcignZGF0ZUZpZWxkJyx0aGlzLnZhbHVlKSI+PG9wdGlvbiB2YWx1ZT0iY2FwdHVyZSIgJHtmLmRhdGVGaWVsZCA9PT0gJ2NhcHR1cmUnID8gJ3NlbGVjdGVkJyA6ICcnfT5QcmlzZSBkZSB2dWU8L29wdGlvbj48b3B0aW9uIHZhbHVlPSJ1cGxvYWQiICR7Zi5kYXRlRmllbGQgPT09ICd1cGxvYWQnID8gJ3NlbGVjdGVkJyA6ICcnfT5JbXBvcnRhdGlvbjwvb3B0aW9uPjwvc2VsZWN0PmAgOiAnJ308L2Rpdj4KICAgICAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOjZweCI+CiAgICAgICAgJHtmLmRhdGVNb2RlID09PSAnZGF0ZScgPyBgPGlucHV0IHR5cGU9ImRhdGUiIGNsYXNzPSJpbnB1dCIgdmFsdWU9IiR7Zi5kYXRlfSIgb25jaGFuZ2U9InNldEZpbHRlcignZGF0ZScsdGhpcy52YWx1ZSkiPmAgOiAnJ30KICAgICAgICAke2YuZGF0ZU1vZGUgPT09ICdyYW5nZScgPyBgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0iZmxleC13cmFwOm5vd3JhcCI+PGlucHV0IHR5cGU9ImRhdGUiIGNsYXNzPSJpbnB1dCIgdmFsdWU9IiR7Zi5mcm9t',
  'fSIgb25jaGFuZ2U9InNldEZpbHRlcignZnJvbScsdGhpcy52YWx1ZSkiPjxzcGFuIGNsYXNzPSJzbWFsbCBtdXRlZCI+YXU8L3NwYW4+PGlucHV0IHR5cGU9ImRhdGUiIGNsYXNzPSJpbnB1dCIgdmFsdWU9IiR7Zi50b30iIG9uY2hhbmdlPSJzZXRGaWx0ZXIoJ3RvJyx0aGlzLnZhbHVlKSI+PC9kaXY+YCA6ICcnfQogICAgICAgICR7Zi5kYXRlTW9kZSA9PT0gJ21vbnRoJyA/IGA8aW5wdXQgdHlwZT0ibW9udGgiIGNsYXNzPSJpbnB1dCIgdmFsdWU9IiR7Zi5tb250aH0iIG9uY2hhbmdlPSJzZXRGaWx0ZXIoJ21vbnRoJyx0aGlzLnZhbHVlKSI+YCA6ICcnfQogICAgICAgICR7Zi5kYXRlTW9kZSA9PT0gJ3llYXInID8gYDxzZWxlY3QgY2xhc3M9InNlbGVjdCIgb25jaGFuZ2U9InNldEZpbHRlcigneWVhcicsdGhpcy52YWx1ZSkiPjxvcHRpb24gdmFsdWU9IiI+Q2hvaXNpcuKApjwvb3B0aW9uPiR7eWVhcnMubWFwKHkgPT4gYDxvcHRpb24gJHtTdHJpbmcoeSkgPT09IFN0cmluZyhmLnllYXIpID8gJ3NlbGVjdGVkJyA6ICcnfT4ke3l9PC9vcHRpb24+YCkuam9pbignJyl9PC9zZWxlY3Q+YCA6ICcnfQogICAgICAgIDwvZGl2PjwvZGl2PgogICAgPC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJyb3cgc2VjdGlvbiIgaWQ9InNlbHJvdyI+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJtZ3JpZCIgaWQ9ImdyaWQiPjwvZGl2PgogICAgPGRpdiBpZD0ic2VudGluZWwiIHN0eWxlPSJoZWlnaHQ6MXB4Ij48L2Rpdj4KICAgIDxkaXYgaWQ9',
  'InNlbGJhciI+PC9kaXY+YDsKCiAgbGV0IHQxLCB0MjsKICAkKCcjcScpLm9uaW5wdXQgPSBlID0+IHsgY2xlYXJUaW1lb3V0KHQxKTsgdDEgPSBzZXRUaW1lb3V0KCgpID0+IHsgbGliLmZpbHRlcnMucSA9IGUudGFyZ2V0LnZhbHVlOyByZWxvYWRMaWJyYXJ5KCk7IH0sIDM1MCk7IH07CiAgJCgnI2ZwaCcpLm9uaW5wdXQgPSBlID0+IHsgY2xlYXJUaW1lb3V0KHQyKTsgdDIgPSBzZXRUaW1lb3V0KCgpID0+IHsgbGliLmZpbHRlcnMucGhvdG9ncmFwaGVyID0gZS50YXJnZXQudmFsdWU7IHJlbG9hZExpYnJhcnkoKTsgfSwgMzUwKTsgfTsKICBjb25zdCBpbyA9IG5ldyBJbnRlcnNlY3Rpb25PYnNlcnZlcihlbiA9PiB7IGlmIChlblswXS5pc0ludGVyc2VjdGluZykgbG9hZE1vcmUoKTsgfSwgeyByb290TWFyZ2luOiAnODAwcHgnIH0pOwogIGlvLm9ic2VydmUoJCgnI3NlbnRpbmVsJykpOwogIHJlbG9hZExpYnJhcnkoKTsKfQoKZnVuY3Rpb24gc2V0RmlsdGVyKGtleSwgdmFsdWUpIHsgbGliLmZpbHRlcnNba2V5XSA9IHZhbHVlOyByZW5kZXJMaWJyYXJ5KCk7IH0KCmZ1bmN0aW9uIHJlbG9hZExpYnJhcnkoKSB7CiAgbGliLml0ZW1zID0gW107IGxpYi50b3RhbCA9IG51bGw7IGxpYi5kb25lID0gZmFsc2U7IGxpYi5sb2FkaW5nID0gZmFsc2U7IGxpYi5zZWxlY3RlZCA9IG5ldyBTZXQoKTsKICBsaWIucmVxSWQrKzsKICAkKCcjZ3JpZCcpLmlubmVySFRNTCA9ICcnOwogIHJlbmRlclNlbGVjdGlvbigpOwogIGxvYWRN',
  'b3JlKCk7Cn0KCmFzeW5jIGZ1bmN0aW9uIGxvYWRNb3JlKCkgewogIGlmIChsaWIubG9hZGluZyB8fCBsaWIuZG9uZSB8fCBzdGF0ZS52aWV3ICE9PSAnbGlicmFyeScpIHJldHVybjsKICBsaWIubG9hZGluZyA9IHRydWU7CiAgY29uc3QgcmVxID0gbGliLnJlcUlkOwogIGNvbnN0IGdyaWQgPSAkKCcjZ3JpZCcpOwogIGdyaWQuaW5zZXJ0QWRqYWNlbnRIVE1MKCdiZWZvcmVlbmQnLCBBcnJheShsaWIuaXRlbXMubGVuZ3RoID8gNiA6IDEyKS5maWxsKCc8ZGl2IGNsYXNzPSJza2VsIj48L2Rpdj4nKS5qb2luKCcnKSk7CiAgdHJ5IHsKICAgIGNvbnN0IHIgPSBhd2FpdCBhcGkoJ2xpc3RNZWRpYScsIGxpYi5maWx0ZXJzLCBsaWIuaXRlbXMubGVuZ3RoLCBQQUdFKTsKICAgIGlmIChyZXEgIT09IGxpYi5yZXFJZCkgcmV0dXJuOwogICAgZ3JpZC5xdWVyeVNlbGVjdG9yQWxsKCcuc2tlbCcpLmZvckVhY2gocyA9PiBzLnJlbW92ZSgpKTsKICAgIGxpYi50b3RhbCA9IHIudG90YWw7CiAgICBsaWIuaXRlbXMgPSBsaWIuaXRlbXMuY29uY2F0KHIuaXRlbXMpOwogICAgbGliLmRvbmUgPSBsaWIuaXRlbXMubGVuZ3RoID49IHIudG90YWwgfHwgIXIuaXRlbXMubGVuZ3RoOwogICAgZ3JpZC5pbnNlcnRBZGphY2VudEhUTUwoJ2JlZm9yZWVuZCcsIHIuaXRlbXMubWFwKGNhcmRIdG1sKS5qb2luKCcnKSk7CiAgICAkKCcjY291bnQnKS50ZXh0Q29udGVudCA9IHIudG90YWwgPyBwbHVyYWwoci50b3RhbCwgJ23DqWRpYScpIDogJ0F1',
  'Y3VuIG3DqWRpYSc7CiAgICBpZiAoIWxpYi5pdGVtcy5sZW5ndGgpIGdyaWQuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9ImNhcmQiIHN0eWxlPSJncmlkLWNvbHVtbjoxLy0xO3BhZGRpbmc6NjBweDt0ZXh0LWFsaWduOmNlbnRlciI+PGI+QXVjdW4gbcOpZGlhIG5lIGNvcnJlc3BvbmQgw6AgY2VzIGNyaXTDqHJlczwvYj48cCBjbGFzcz0ibXV0ZWQiPk1vZGlmaWV6IGxhIHJlY2hlcmNoZSBvdSBsZXMgZmlsdHJlcy48L3A+PC9kaXY+JzsKICAgIHJlbmRlclNlbGVjdGlvbigpOwogICAgY29uc3QgbmVlZCA9IHIuaXRlbXMuZmlsdGVyKG0gPT4gdGh1bWJDYWNoZVttLmlkXSA9PT0gdW5kZWZpbmVkKS5tYXAobSA9PiBtLmlkKTsKICAgIHIuaXRlbXMuZm9yRWFjaChtID0+IHsgaWYgKHRodW1iQ2FjaGVbbS5pZF0pIHNldENhcmRUaHVtYihtLmlkLCB0aHVtYkNhY2hlW20uaWRdKTsgfSk7CiAgICBpZiAobmVlZC5sZW5ndGgpIGxvYWRUaHVtYnMobmVlZCwgJyNncmlkJyk7CiAgfSBjYXRjaCAoZSkgewogICAgZ3JpZC5xdWVyeVNlbGVjdG9yQWxsKCcuc2tlbCcpLmZvckVhY2gocyA9PiBzLnJlbW92ZSgpKTsKICAgIHRvYXN0KGUubWVzc2FnZSwgJ2Vycm9yJyk7CiAgfSBmaW5hbGx5IHsgaWYgKHJlcSA9PT0gbGliLnJlcUlkKSBsaWIubG9hZGluZyA9IGZhbHNlOyB9Cn0KCmZ1bmN0aW9uIHNldENhcmRUaHVtYihpZCwgdXJsKSB7CiAgY29uc3QgZWwgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKCcjZ3JpZCBbZGF0YS10',
  'aHVtYj0iJyArIGlkICsgJyJdJyk7CiAgaWYgKGVsICYmIHVybCkgZWwuaW5uZXJIVE1MID0gJzxpbWcgc3JjPSInICsgdXJsICsgJyIgYWx0PSIiIGxvYWRpbmc9ImxhenkiPicgKyBBcnJheS5mcm9tKGVsLnF1ZXJ5U2VsZWN0b3JBbGwoJy5wbGF5LC52ZCcpKS5tYXAoeCA9PiB4Lm91dGVySFRNTCkuam9pbignJyk7Cn0KCmZ1bmN0aW9uIGNhcmRIdG1sKG0pIHsKICBjb25zdCBzZWwgPSBsaWIuc2VsZWN0ZWQuaGFzKG0uaWQpOwogIGNvbnN0IHZpZGVvID0gbS5tZWRpYVR5cGUgPT09ICdWSURFTyc7CiAgcmV0dXJuIGA8YXJ0aWNsZSBjbGFzcz0ibWNhcmQgJHtzZWwgPyAnc2VsJyA6ICcnfSIgaWQ9ImNhcmQtJHttLmlkfSI+CiAgICA8YnV0dG9uIGNsYXNzPSJjaGsgJHtzZWwgPyAnb24nIDogJyd9IiBvbmNsaWNrPSJ0b2dnbGVTZWwoJyR7bS5pZH0nKSIgYXJpYS1sYWJlbD0iU8OpbGVjdGlvbm5lciI+JHtzZWwgPyBJLmNoZWNrIDogJyd9PC9idXR0b24+CiAgICA8YnV0dG9uIGNsYXNzPSJwaCIgZGF0YS10aHVtYj0iJHttLmlkfSIgb25jbGljaz0iY2FyZENsaWNrKGV2ZW50LCcke20uaWR9JykiPiR7dmlkZW8gPyAnJyA6IGA8YiBjbGFzcz0ibXV0ZWQiPiR7ZXNjKG0uZXh0ZW5zaW9uLnRvVXBwZXJDYXNlKCkpfTwvYj5gfSR7dmlkZW8gPyBgPHNwYW4gY2xhc3M9InBsYXkiPjxzcGFuPiR7SS5wbGF5fTwvc3Bhbj48L3NwYW4+PHNwYW4gY2xhc3M9ImJhZGdlIGJhZGdlLWRhcmsgdmQiPlZpZMOpbyR7bS5kdXJh',
  'dGlvblNlYyA/ICcgwrcgJyArIGZtdER1cihtLmR1cmF0aW9uU2VjKSA6ICcnfTwvc3Bhbj5gIDogJyd9PC9idXR0b24+CiAgICA8c3BhbiBjbGFzcz0iYmFkZ2UgJHttLnN0YXR1cyA9PT0gJ1NPUlRFRCcgPyAnYmFkZ2UtZG9uZScgOiAnYmFkZ2UtdG9kbyd9IHN0IiBzdHlsZT0iYmFja2dyb3VuZDojZmZmIj4ke20uc3RhdHVzID09PSAnU09SVEVEJyA/ICdUcmnDqWUnIDogJ8OAIHRyaWVyJ308L3NwYW4+CiAgICA8ZGl2IGNsYXNzPSJtZXRhIj48ZGl2IHN0eWxlPSJmb250LXdlaWdodDo2MDA7Zm9udC1zaXplOjEzcHgiIHRpdGxlPSIke2VzYyhtLm9yaWdpbmFsRmlsZW5hbWUpfSI+JHtlc2MobS5vcmlnaW5hbEZpbGVuYW1lKX08L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0ic21hbGwgbXV0ZWQiPiR7ZXNjKG0uY2F0ZWdvcnlOYW1lKX0gwrcgJHtlc2MobS5hY3Rpdml0eU5hbWUpfTwvZGl2PgogICAgICA8ZGl2IGNsYXNzPSJzbWFsbCBtdXRlZCI+JHtmbXREYXRlKG0uY2FwdHVyZURhdGUpfSDCtyAke2VzYyhtLnBob3RvZ3JhcGhlcil9PC9kaXY+PC9kaXY+PC9hcnRpY2xlPmA7Cn0KCmZ1bmN0aW9uIGNhcmRDbGljayhlLCBpZCkgeyBpZiAobGliLnNlbGVjdGVkLnNpemUgfHwgZS5jdHJsS2V5IHx8IGUubWV0YUtleSB8fCBlLnNoaWZ0S2V5KSB0b2dnbGVTZWwoaWQpOyBlbHNlIG9wZW5EZXRhaWwoaWQpOyB9CgpmdW5jdGlvbiB0b2dnbGVTZWwoaWQpIHsKICBpZiAobGliLnNlbGVjdGVkLmhhcyhpZCkpIGxpYi5z',
  'ZWxlY3RlZC5kZWxldGUoaWQpOyBlbHNlIGxpYi5zZWxlY3RlZC5hZGQoaWQpOwogIHJlZnJlc2hDYXJkKGlkKTsgcmVuZGVyU2VsZWN0aW9uKCk7Cn0KZnVuY3Rpb24gcmVmcmVzaENhcmQoaWQpIHsKICBjb25zdCBtID0gbGliLml0ZW1zLmZpbmQoeCA9PiB4LmlkID09PSBpZCk7IGNvbnN0IGVsID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2NhcmQtJyArIGlkKTsKICBpZiAoIW0gfHwgIWVsKSByZXR1cm47CiAgZWwub3V0ZXJIVE1MID0gY2FyZEh0bWwobSk7CiAgaWYgKHRodW1iQ2FjaGVbaWRdKSBzZXRDYXJkVGh1bWIoaWQsIHRodW1iQ2FjaGVbaWRdKTsKfQoKZnVuY3Rpb24gcmVuZGVyU2VsZWN0aW9uKCkgewogIGNvbnN0IG4gPSBsaWIuc2VsZWN0ZWQuc2l6ZTsKICBjb25zdCByb3cgPSAkKCcjc2Vscm93Jyk7IGlmICghcm93KSByZXR1cm47CiAgY29uc3QgYWxsID0gbGliLml0ZW1zLmxlbmd0aCAmJiBsaWIuaXRlbXMuZXZlcnkobSA9PiBsaWIuc2VsZWN0ZWQuaGFzKG0uaWQpKTsKICByb3cuaW5uZXJIVE1MID0gYDxidXR0b24gY2xhc3M9ImNoayAke2FsbCA/ICdvbicgOiAnJ30iIG9uY2xpY2s9IiR7YWxsID8gJ2NsZWFyU2VsKCknIDogJ3NlbGVjdEFsbCgpJ30iIGFyaWEtbGFiZWw9IlRvdXQgc8OpbGVjdGlvbm5lciI+JHthbGwgPyBJLmNoZWNrIDogJyd9PC9idXR0b24+CiAgICA8YSBzdHlsZT0iY3Vyc29yOnBvaW50ZXI7Zm9udC13ZWlnaHQ6NjAwIiBvbmNsaWNrPSJzZWxlY3RBbGwoKSI+VG91',
  'dCBzw6lsZWN0aW9ubmVyJHtsaWIudG90YWwgPyAnICgnICsgbmYobGliLnRvdGFsKSArICcpJyA6ICcnfTwvYT4KICAgICR7biA/IGA8c3BhbiBjbGFzcz0ibXV0ZWQiPsK3PC9zcGFuPjxhIHN0eWxlPSJjdXJzb3I6cG9pbnRlcjtmb250LXdlaWdodDo2MDAiIG9uY2xpY2s9ImNsZWFyU2VsKCkiPlRvdXQgZMOpc8OpbGVjdGlvbm5lcjwvYT48c3BhbiBjbGFzcz0iYmFkZ2UgYmFkZ2UtZGFyayI+JHtwbHVyYWwobiwgJ23DqWRpYSBzw6lsZWN0aW9ubsOpJywgJ23DqWRpYXMgc8OpbGVjdGlvbm7DqXMnKX08L3NwYW4+YCA6ICcnfWA7CiAgJCgnI3NlbGJhcicpLmlubmVySFRNTCA9IG4gPyBgPGRpdiBjbGFzcz0ic2VsYmFyIj48ZGl2IGNsYXNzPSJpbiI+PGIgc3R5bGU9InBhZGRpbmc6MCA4cHgiPiR7cGx1cmFsKG4sICdtw6lkaWEgc8OpbGVjdGlvbm7DqScsICdtw6lkaWFzIHPDqWxlY3Rpb25uw6lzJyl9PC9iPgogICAgPGRpdiBjbGFzcz0icm93IiBzdHlsZT0ibWFyZ2luLWxlZnQ6YXV0byI+CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBidG4tb3V0bGluZSBidG4tc20iIG9uY2xpY2s9ImRvd25sb2FkWmlwKFsuLi5saWIuc2VsZWN0ZWRdKSI+4qyHIFTDqWzDqWNoYXJnZXIgbGEgc8OpbGVjdGlvbjwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLXN1Y2Nlc3MgYnRuLXNtIiBvbmNsaWNrPSJidWxrU3RhdHVzKCdTT1JURUQnKSI+4pyTIE1hcnF1ZXIgY29tbWUgdHJpw6llczwvYnV0dG9uPgog',
  'ICAgICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLW91dGxpbmUgYnRuLXNtIiBvbmNsaWNrPSJidWxrU3RhdHVzKCdUT19TT1JUJykiPk1hcnF1ZXIgY29tbWUgw6AgdHJpZXI8L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1kYW5nZXItb3V0bGluZSBidG4tc20iIG9uY2xpY2s9ImNvbmZpcm1CdWxrRGVsZXRlKCkiPvCfl5EgU3VwcHJpbWVyIGxhIHPDqWxlY3Rpb248L2J1dHRvbj4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1naG9zdCBidG4tc20iIG9uY2xpY2s9ImNsZWFyU2VsKCkiPuKclSBEw6lzw6lsZWN0aW9ubmVyPC9idXR0b24+PC9kaXY+PC9kaXY+PC9kaXY+YCA6ICcnOwp9CmFzeW5jIGZ1bmN0aW9uIHNlbGVjdEFsbCgpIHsKICB0cnkgeyAoYXdhaXQgYXBpKCdsaXN0TWVkaWFJZHMnLCBsaWIuZmlsdGVycykpLmZvckVhY2goaWQgPT4gbGliLnNlbGVjdGVkLmFkZChpZCkpOyB9CiAgY2F0Y2ggKGUpIHsgbGliLml0ZW1zLmZvckVhY2gobSA9PiBsaWIuc2VsZWN0ZWQuYWRkKG0uaWQpKTsgfQogIGxpYi5pdGVtcy5mb3JFYWNoKG0gPT4gcmVmcmVzaENhcmQobS5pZCkpOyByZW5kZXJTZWxlY3Rpb24oKTsKfQpmdW5jdGlvbiBjbGVhclNlbCgpIHsgY29uc3QgaWRzID0gWy4uLmxpYi5zZWxlY3RlZF07IGxpYi5zZWxlY3RlZCA9IG5ldyBTZXQoKTsgaWRzLmZvckVhY2gocmVmcmVzaENhcmQpOyByZW5kZXJTZWxlY3Rpb24oKTsgfQoKZnVuY3Rpb24gcmVtb3ZlRnJvbUxpYnJhcnko',
  'aWRzKSB7CiAgY29uc3Qgc2V0ID0gbmV3IFNldChpZHMpOwogIGxpYi5pdGVtcyA9IGxpYi5pdGVtcy5maWx0ZXIobSA9PiAhc2V0LmhhcyhtLmlkKSk7CiAgaWRzLmZvckVhY2goaWQgPT4geyBsaWIuc2VsZWN0ZWQuZGVsZXRlKGlkKTsgY29uc3QgZWwgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnY2FyZC0nICsgaWQpOyBpZiAoZWwpIGVsLnJlbW92ZSgpOyB9KTsKICBpZiAobGliLnRvdGFsICE9IG51bGwpIHsgbGliLnRvdGFsID0gTWF0aC5tYXgoMCwgbGliLnRvdGFsIC0gaWRzLmxlbmd0aCk7ICQoJyNjb3VudCcpLnRleHRDb250ZW50ID0gbGliLnRvdGFsID8gcGx1cmFsKGxpYi50b3RhbCwgJ23DqWRpYScpIDogJ0F1Y3VuIG3DqWRpYSc7IH0KICByZW5kZXJTZWxlY3Rpb24oKTsKfQoKYXN5bmMgZnVuY3Rpb24gYnVsa1N0YXR1cyhzdGF0dXMpIHsKICBjb25zdCBpZHMgPSBbLi4ubGliLnNlbGVjdGVkXTsKICB0cnkgewogICAgY29uc3QgciA9IGF3YWl0IGFwaSgnYnVsa1N0YXR1cycsIGlkcywgc3RhdHVzKTsKICAgIHRvYXN0KHBsdXJhbChyLnVwZGF0ZWQsICdtw6lkaWEnKSArIChzdGF0dXMgPT09ICdTT1JURUQnID8gJyBtYXJxdcOpKHMpIGNvbW1lIHRyacOpKHMpLicgOiAnIHJlbWlzIMKrIMOAIHRyaWVyIMK7LicpKTsKICAgIGlmIChsaWIuZmlsdGVycy5zdGF0dXMgJiYgbGliLmZpbHRlcnMuc3RhdHVzICE9PSBzdGF0dXMpIHJlbW92ZUZyb21MaWJyYXJ5KGlkcyk7CiAgICBlbHNlIHsgbGliLml0',
  'ZW1zLmZvckVhY2gobSA9PiB7IGlmIChsaWIuc2VsZWN0ZWQuaGFzKG0uaWQpKSBtLnN0YXR1cyA9IHN0YXR1czsgfSk7IGNsZWFyU2VsKCk7IH0KICB9IGNhdGNoIChlKSB7IHRvYXN0KGUubWVzc2FnZSwgJ2Vycm9yJyk7IH0KfQoKZnVuY3Rpb24gY29uZmlybUJ1bGtEZWxldGUoKSB7CiAgY29uc3QgaWRzID0gWy4uLmxpYi5zZWxlY3RlZF07CiAgY29uZmlybU1vZGFsKCdTdXBwcmltZXIgZMOpZmluaXRpdmVtZW50ICcgKyBwbHVyYWwoaWRzLmxlbmd0aCwgJ23DqWRpYScpICsgJyA/JywgJ0NldHRlIGFjdGlvbiBlc3QgaXJyw6l2ZXJzaWJsZS4gTGVzIGZpY2hpZXJzIG9yaWdpbmF1eCBldCBsZXVycyBkb25uw6llcyBhc3NvY2nDqWVzIHNlcm9udCBzdXBwcmltw6lzLicsIGFzeW5jICgpID0+IHsKICAgIGNvbnN0IHIgPSBhd2FpdCBhcGkoJ2RlbGV0ZU1lZGlhJywgaWRzKTsKICAgIHJlbW92ZUZyb21MaWJyYXJ5KHIuZGVsZXRlZCk7CiAgICBpZiAoci5mYWlsZWQubGVuZ3RoKSB0b2FzdChwbHVyYWwoci5kZWxldGVkLmxlbmd0aCwgJ23DqWRpYScpICsgJyBzdXBwcmltw6kocykuICcgKyByLmZhaWxlZC5sZW5ndGggKyAnIGVuIMOpY2hlYyA6ICcgKyByLmZhaWxlZFswXS5lcnJvciwgJ2Vycm9yJyk7CiAgICBlbHNlIHRvYXN0KHBsdXJhbChyLmRlbGV0ZWQubGVuZ3RoLCAnbcOpZGlhJykgKyAnIHN1cHByaW3DqShzKSBkw6lmaW5pdGl2ZW1lbnQuJyk7CiAgfSk7Cn0KCi8vIC0tLS0tLS0tLS0gZmljaGUgZMOp',
  'dGFpbGzDqWUKbGV0IGRldGFpbEJsb2JVcmwgPSBudWxsOwpmdW5jdGlvbiBjbG9zZURldGFpbCgpIHsgbGliLm9wZW5JZCA9IG51bGw7IGNvbnN0IG8gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnZGV0YWlsJyk7IGlmIChvKSBvLnJlbW92ZSgpOyBpZiAoZGV0YWlsQmxvYlVybCkgeyBVUkwucmV2b2tlT2JqZWN0VVJMKGRldGFpbEJsb2JVcmwpOyBkZXRhaWxCbG9iVXJsID0gbnVsbDsgfSBkb2N1bWVudC5vbmtleWRvd24gPSBudWxsOyB9CgpmdW5jdGlvbiBvcGVuRGV0YWlsKGlkLCBlZGl0aW5nKSB7CiAgY2xvc2VEZXRhaWwoKTsKICBjb25zdCBpZHggPSBsaWIuaXRlbXMuZmluZEluZGV4KG0gPT4gbS5pZCA9PT0gaWQpOyBjb25zdCBtID0gbGliLml0ZW1zW2lkeF07IGlmICghbSkgcmV0dXJuOwogIGxpYi5vcGVuSWQgPSBpZDsKICBjb25zdCBwcmV2ID0gbGliLml0ZW1zW2lkeCAtIDFdLCBuZXh0ID0gbGliLml0ZW1zW2lkeCArIDFdOwogIGNvbnN0IFNSQyA9IHsgRVhJRjogJ0VYSUYnLCBWSURFT19NRVRBREFUQTogJ23DqXRhZG9ubsOpZXMgdmlkw6lvJywgRklMRV9EQVRFOiAnZGF0ZSBkdSBmaWNoaWVyJywgTUFOVUFMOiAnc2Fpc2llIG1hbnVlbGxlJyB9OwogIGNvbnN0IGNhdHMgPSBsaWIuY2F0YWxvZzsKICBjb25zdCBlZGl0Rm9ybSA9IGA8Zm9ybSBpZD0iZWRpdGYiIHN0eWxlPSJwYWRkaW5nOjIwcHg7ZGlzcGxheTpncmlkO2dhcDoxMnB4Ij4KICAgICAgPGRpdj48bGFiZWwgY2xhc3M9ImxibCI+',
  'UGhvdG9ncmFwaGU8L2xhYmVsPjxpbnB1dCBjbGFzcz0iaW5wdXQiIG5hbWU9InBob3RvZ3JhcGhlciIgdmFsdWU9IiR7ZXNjKG0ucGhvdG9ncmFwaGVyKX0iIHJlcXVpcmVkPjwvZGl2PgogICAgICA8ZGl2PjxsYWJlbCBjbGFzcz0ibGJsIj5EYXRlIGRlIHByaXNlIGRlIHZ1ZTwvbGFiZWw+PGlucHV0IGNsYXNzPSJpbnB1dCIgdHlwZT0iZGF0ZXRpbWUtbG9jYWwiIG5hbWU9ImNhcHR1cmVEYXRlIiB2YWx1ZT0iJHt0b0xvY2FsSW5wdXQobmV3IERhdGUobS5jYXB0dXJlRGF0ZSkpfSIgcmVxdWlyZWQ+PC9kaXY+CiAgICAgIDxkaXY+PGxhYmVsIGNsYXNzPSJsYmwiPkNhdMOpZ29yaWU8L2xhYmVsPjxzZWxlY3QgY2xhc3M9InNlbGVjdCIgbmFtZT0iY2F0ZWdvcnlJZCIgaWQ9ImVjYXQiPiR7Y2F0cy5maWx0ZXIoYyA9PiBjLmFjdGl2ZSB8fCBjLmlkID09PSBtLmNhdGVnb3J5SWQpLm1hcChjID0+IGA8b3B0aW9uIHZhbHVlPSIke2MuaWR9IiAke2MuaWQgPT09IG0uY2F0ZWdvcnlJZCA/ICdzZWxlY3RlZCcgOiAnJ30+JHtlc2MoYy5uYW1lKX08L29wdGlvbj5gKS5qb2luKCcnKX08L3NlbGVjdD48L2Rpdj4KICAgICAgPGRpdj48bGFiZWwgY2xhc3M9ImxibCI+QWN0aXZpdMOpPC9sYWJlbD48c2VsZWN0IGNsYXNzPSJzZWxlY3QiIG5hbWU9ImFjdGl2aXR5SWQiIGlkPSJlYWN0Ij48L3NlbGVjdD48L2Rpdj4KICAgICAgPGRpdiBjbGFzcz0icm93Ij48YnV0dG9uIHR5cGU9ImJ1dHRvbiIgY2xhc3M9ImJ0biBidG4tb3V0',
  'bGluZSIgc3R5bGU9ImZsZXg6MSIgb25jbGljaz0ib3BlbkRldGFpbCgnJHttLmlkfScpIj5Bbm51bGVyPC9idXR0b24+PGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1zdWNjZXNzIiBzdHlsZT0iZmxleDoxIj5FbnJlZ2lzdHJlcjwvYnV0dG9uPjwvZGl2PjwvZm9ybT5gOwogIGNvbnN0IGluZm9zID0gYDxkbD48ZHQ+UHJpc2UgZGUgdnVlPC9kdD48ZGQ+JHtmbXREYXRlKG0uY2FwdHVyZURhdGUsIHRydWUpfTxkaXYgY2xhc3M9InNtYWxsIG11dGVkIj5zb3VyY2UgOiAke1NSQ1ttLmNhcHR1cmVEYXRlU291cmNlXSB8fCAn4oCUJ308L2Rpdj48L2RkPgogICAgICA8ZHQ+UGhvdG9ncmFwaGU8L2R0PjxkZD4ke2VzYyhtLnBob3RvZ3JhcGhlcil9PC9kZD48ZHQ+Q2F0w6lnb3JpZTwvZHQ+PGRkPiR7ZXNjKG0uY2F0ZWdvcnlOYW1lKX08L2RkPjxkdD5BY3Rpdml0w6k8L2R0PjxkZD4ke2VzYyhtLmFjdGl2aXR5TmFtZSl9PC9kZD4KICAgICAgJHttLndpZHRoID8gYDxkdD5EaW1lbnNpb25zPC9kdD48ZGQ+JHttLndpZHRofSDDlyAke20uaGVpZ2h0fSBweCR7bS5kdXJhdGlvblNlYyA/ICcgwrcgJyArIGZtdER1cihtLmR1cmF0aW9uU2VjKSA6ICcnfTwvZGQ+YCA6ICcnfQogICAgICA8ZHQ+SW1wb3J0w6kgbGU8L2R0PjxkZD4ke2ZtdERhdGUobS51cGxvYWRlZEF0LCB0cnVlKX0ke20udXBsb2FkZWRCeSA/ICc8ZGl2IGNsYXNzPSJzbWFsbCBtdXRlZCI+cGFyICcgKyBlc2MobS51cGxvYWRlZEJ5KSArICc8L2Rpdj4nIDogJyd9',
  'PC9kZD4KICAgICAgJHttLnN0YXR1cyA9PT0gJ1NPUlRFRCcgJiYgbS5zb3J0ZWRBdCA/IGA8ZHQ+VHJpw6kgbGU8L2R0PjxkZD4ke2ZtdERhdGUobS5zb3J0ZWRBdCwgdHJ1ZSl9JHttLnNvcnRlZEJ5ID8gJzxkaXYgY2xhc3M9InNtYWxsIG11dGVkIj5wYXIgJyArIGVzYyhtLnNvcnRlZEJ5KSArICc8L2Rpdj4nIDogJyd9PC9kZD5gIDogJyd9CiAgICAgICR7bS5tZDUgPyBgPGR0PkVtcHJlaW50ZTwvZHQ+PGRkIGNsYXNzPSJzbWFsbCBtdXRlZCIgc3R5bGU9IndvcmQtYnJlYWs6YnJlYWstYWxsIj5NRDUgJHtlc2MobS5tZDUpfTwvZGQ+YCA6ICcnfTwvZGw+CiAgICA8ZGl2IHN0eWxlPSJtYXJnaW4tdG9wOmF1dG87cGFkZGluZzoyMHB4O2JvcmRlci10b3A6MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7ZGlzcGxheTpncmlkO2dhcDo4cHgiPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLW91dGxpbmUgYnRuLWJsb2NrIiBzdHlsZT0iaGVpZ2h0OjQ0cHgiIG9uY2xpY2s9ImRvd25sb2FkT25lKGxpYi5pdGVtcy5maW5kKHg9PnguaWQ9PT0nJHttLmlkfScpKSI+4qyHIFTDqWzDqWNoYXJnZXIgbCdvcmlnaW5hbDwvYnV0dG9uPgogICAgICAke20uc3RhdHVzID09PSAnVE9fU09SVCcgPyBgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1zdWNjZXNzIGJ0bi1ibG9jayIgc3R5bGU9ImhlaWdodDo0NHB4IiBvbmNsaWNrPSJzZXRTdGF0dXMoJyR7bS5pZH0nLCdTT1JURUQnKSI+4pyTIE1hcnF1ZXIgY29tbWUgdHJpw6llPC9i',
  'dXR0b24+YCA6IGA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLW91dGxpbmUgYnRuLWJsb2NrIiBzdHlsZT0iaGVpZ2h0OjQ0cHgiIG9uY2xpY2s9InNldFN0YXR1cygnJHttLmlkfScsJ1RPX1NPUlQnKSI+UmVtZXR0cmUgwqsgw4AgdHJpZXIgwrs8L2J1dHRvbj5gfQogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLWdob3N0IGJ0bi1ibG9jayIgb25jbGljaz0ib3BlbkRldGFpbCgnJHttLmlkfScsIHRydWUpIj7inI4gTW9kaWZpZXIgbGVzIGluZm9ybWF0aW9uczwvYnV0dG9uPgogICAgICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLWRhbmdlci1vdXRsaW5lIGJ0bi1ibG9jayIgc3R5bGU9Im1hcmdpbi10b3A6MTJweCIgb25jbGljaz0iY29uZmlybURlbGV0ZSgnJHttLmlkfScpIj7wn5eRIFN1cHByaW1lcjwvYnV0dG9uPjwvZGl2PmA7CgogIGRvY3VtZW50LmJvZHkuaW5zZXJ0QWRqYWNlbnRIVE1MKCdiZWZvcmVlbmQnLCBgPGRpdiBjbGFzcz0ib3ZlcmxheSIgaWQ9ImRldGFpbCI+PGRpdiBjbGFzcz0iZGV0YWlsIj4KICAgIDxkaXYgY2xhc3M9InZpZXdlciIgaWQ9InZpZXdlciI+PHNwYW4gY2xhc3M9InNwaW4iIHN0eWxlPSJjb2xvcjojZmZmIj48L3NwYW4+CiAgICAgICR7cHJldiA/IGA8YnV0dG9uIGNsYXNzPSJudiIgc3R5bGU9ImxlZnQ6MTBweCIgb25jbGljaz0ib3BlbkRldGFpbCgnJHtwcmV2LmlkfScpIiBhcmlhLWxhYmVsPSJQcsOpY8OpZGVudCI+4oC5PC9idXR0b24+YCA6ICcnfQogICAgICAke25leHQg',
  'PyBgPGJ1dHRvbiBjbGFzcz0ibnYiIHN0eWxlPSJyaWdodDoxMHB4IiBvbmNsaWNrPSJvcGVuRGV0YWlsKCcke25leHQuaWR9Jyk7aWYoJHtpZHh9KzU+PWxpYi5pdGVtcy5sZW5ndGgpbG9hZE1vcmUoKSIgYXJpYS1sYWJlbD0iU3VpdmFudCI+4oC6PC9idXR0b24+YCA6ICcnfTwvZGl2PgogICAgPGFzaWRlIGNsYXNzPSJpbmZvIj48ZGl2IGNsYXNzPSJiZXR3ZWVuIiBzdHlsZT0icGFkZGluZzoyMHB4O2JvcmRlci1ib3R0b206MXB4IHNvbGlkIHZhcigtLWJvcmRlcik7YWxpZ24taXRlbXM6ZmxleC1zdGFydDtmbGV4LXdyYXA6bm93cmFwIj4KICAgICAgPGRpdiBzdHlsZT0ibWluLXdpZHRoOjAiPjxiIHN0eWxlPSJmb250LXNpemU6MTZweDt3b3JkLWJyZWFrOmJyZWFrLWFsbCI+JHtlc2MobS5vcmlnaW5hbEZpbGVuYW1lKX08L2I+CiAgICAgIDxkaXYgY2xhc3M9InJvdyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4Ij48c3BhbiBjbGFzcz0iYmFkZ2UgJHttLnN0YXR1cyA9PT0gJ1NPUlRFRCcgPyAnYmFkZ2UtZG9uZScgOiAnYmFkZ2UtdG9kbyd9Ij4ke20uc3RhdHVzID09PSAnU09SVEVEJyA/ICdUcmnDqWUnIDogJ8OAIHRyaWVyJ308L3NwYW4+CiAgICAgIDxzcGFuIGNsYXNzPSJzbWFsbCBtdXRlZCI+JHttLm1lZGlhVHlwZSA9PT0gJ1ZJREVPJyA/ICdWaWTDqW8nIDogJ1Bob3RvJ30gwrcgJHtlc2MobS5leHRlbnNpb24udG9VcHBlckNhc2UoKSl9IMK3ICR7Zm10Qnl0ZXMobS5maWxlU2l6ZSl9PC9zcGFuPjwvZGl2',
  'PjwvZGl2PgogICAgICA8YnV0dG9uIGNsYXNzPSJpY29uYnRuIiBvbmNsaWNrPSJjbG9zZURldGFpbCgpIiBhcmlhLWxhYmVsPSJGZXJtZXIiPuKclTwvYnV0dG9uPjwvZGl2PgogICAgICAke2VkaXRpbmcgPyBlZGl0Rm9ybSA6IGluZm9zfTwvYXNpZGU+PC9kaXY+PC9kaXY+YCk7CgogIGRvY3VtZW50Lm9ua2V5ZG93biA9IGUgPT4geyBpZiAoZWRpdGluZyB8fCBlLnRhcmdldC50YWdOYW1lID09PSAnSU5QVVQnKSByZXR1cm47IGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIGNsb3NlRGV0YWlsKCk7IGlmIChlLmtleSA9PT0gJ0Fycm93TGVmdCcgJiYgcHJldikgb3BlbkRldGFpbChwcmV2LmlkKTsgaWYgKGUua2V5ID09PSAnQXJyb3dSaWdodCcgJiYgbmV4dCkgb3BlbkRldGFpbChuZXh0LmlkKTsgfTsKCiAgaWYgKGVkaXRpbmcpIHsKICAgIGNvbnN0IGZpbGwgPSAoKSA9PiB7IGNvbnN0IGMgPSBjYXRzLmZpbmQoeCA9PiB4LmlkID09PSAkKCcjZWNhdCcpLnZhbHVlKTsgJCgnI2VhY3QnKS5pbm5lckhUTUwgPSAoYyA/IGMuYWN0aXZpdGllcy5maWx0ZXIoYSA9PiBhLmFjdGl2ZSB8fCBhLmlkID09PSBtLmFjdGl2aXR5SWQpIDogW10pLm1hcChhID0+IGA8b3B0aW9uIHZhbHVlPSIke2EuaWR9IiAke2EuaWQgPT09IG0uYWN0aXZpdHlJZCA/ICdzZWxlY3RlZCcgOiAnJ30+JHtlc2MoYS5uYW1lKX08L29wdGlvbj5gKS5qb2luKCcnKTsgfTsKICAgICQoJyNlY2F0Jykub25jaGFuZ2UgPSBmaWxsOyBmaWxsKCk7CiAgICAk',
  'KCcjZWRpdGYnKS5vbnN1Ym1pdCA9IGFzeW5jIGUgPT4gewogICAgICBlLnByZXZlbnREZWZhdWx0KCk7IGNvbnN0IGZkID0gbmV3IEZvcm1EYXRhKGUudGFyZ2V0KTsKICAgICAgY29uc3QgZCA9IG5ldyBEYXRlKGZkLmdldCgnY2FwdHVyZURhdGUnKSk7IGlmIChpc05hTihkKSkgcmV0dXJuIHRvYXN0KCdEYXRlIGludmFsaWRlLicsICdlcnJvcicpOwogICAgICB0cnkgewogICAgICAgIGNvbnN0IHVwZCA9IGF3YWl0IGFwaSgndXBkYXRlTWVkaWEnLCBtLmlkLCB7IHBob3RvZ3JhcGhlcjogZmQuZ2V0KCdwaG90b2dyYXBoZXInKSwgY2FwdHVyZURhdGU6IGQudG9JU09TdHJpbmcoKSwgY2F0ZWdvcnlJZDogZmQuZ2V0KCdjYXRlZ29yeUlkJyksIGFjdGl2aXR5SWQ6IGZkLmdldCgnYWN0aXZpdHlJZCcpIH0pOwogICAgICAgIE9iamVjdC5hc3NpZ24obSwgdXBkKTsgcmVmcmVzaENhcmQobS5pZCk7IHRvYXN0KCdJbmZvcm1hdGlvbnMgbWlzZXMgw6Agam91ci4nKTsgb3BlbkRldGFpbChtLmlkKTsKICAgICAgfSBjYXRjaCAoZXJyKSB7IHRvYXN0KGVyci5tZXNzYWdlLCAnZXJyb3InKTsgfQogICAgfTsKICB9CgogIC8vIFZpc2lvbm5ldXNlIDogYXBlcsOndSAoZMOpcml2w6kpIHBvdXIgbGVzIHBob3RvcyA7IGxlY3R1cmUgZGUgbCdvcmlnaW5hbCBwb3VyIGxlcyB2aWTDqW9zCiAgY29uc3Qgdmlld2VyID0gJCgnI3ZpZXdlcicpOwogIGNvbnN0IHNldFZpZXcgPSBodG1sID0+IHsgY29uc3Qgc3BpbiA9IHZpZXdlci5x',
  'dWVyeVNlbGVjdG9yKCcuc3BpbicpOyBpZiAoc3Bpbikgc3Bpbi5vdXRlckhUTUwgPSBodG1sOyBlbHNlIHZpZXdlci5pbnNlcnRBZGphY2VudEhUTUwoJ2FmdGVyYmVnaW4nLCBodG1sKTsgfTsKICBpZiAobS5tZWRpYVR5cGUgPT09ICdWSURFTycpIHsKICAgIHNldFZpZXcoYDxkaXYgc3R5bGU9InRleHQtYWxpZ246Y2VudGVyO2NvbG9yOiNmZmYiPiR7dGh1bWJDYWNoZVttLmlkXSA/IGA8aW1nIHNyYz0iJHt0aHVtYkNhY2hlW20uaWRdfSIgc3R5bGU9Im1heC1oZWlnaHQ6NDB2aDtkaXNwbGF5OmJsb2NrO21hcmdpbjowIGF1dG8gMTRweDtvcGFjaXR5Oi42Ij5gIDogJyd9CiAgICAgIDxidXR0b24gY2xhc3M9ImJ0biBidG4tb3V0bGluZSIgaWQ9InBsYXlidG4iPiR7SS5wbGF5fSBMaXJlIGxhIHZpZMOpbyAoJHtmbXRCeXRlcyhtLmZpbGVTaXplKX0pPC9idXR0b24+PGRpdiBjbGFzcz0ic21hbGwiIGlkPSJwbGF5cHJvZyIgc3R5bGU9Im1hcmdpbi10b3A6OHB4O29wYWNpdHk6LjciPjwvZGl2PjwvZGl2PmApOwogICAgJCgnI3BsYXlidG4nKS5vbmNsaWNrID0gYXN5bmMgKCkgPT4gewogICAgICAkKCcjcGxheWJ0bicpLmRpc2FibGVkID0gdHJ1ZTsKICAgICAgdHJ5IHsKICAgICAgICBjb25zdCBibG9iID0gYXdhaXQgZmV0Y2hPcmlnaW5hbChtLCBwID0+IHsgY29uc3QgZWwgPSAkKCcjcGxheXByb2cnKTsgaWYgKGVsKSBlbC50ZXh0Q29udGVudCA9ICdDaGFyZ2VtZW50ICcgKyBNYXRoLnJvdW5kKHAgKiAxMDAp',
  'ICsgJyAlJzsgfSk7CiAgICAgICAgaWYgKGxpYi5vcGVuSWQgIT09IG0uaWQpIHJldHVybjsKICAgICAgICBkZXRhaWxCbG9iVXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChibG9iKTsKICAgICAgICB2aWV3ZXIucXVlcnlTZWxlY3RvcignZGl2Jykub3V0ZXJIVE1MID0gYDx2aWRlbyBjb250cm9scyBhdXRvcGxheSBwbGF5c2lubGluZSBzcmM9IiR7ZGV0YWlsQmxvYlVybH0iPjxwIHN0eWxlPSJjb2xvcjojZmZmIj5Gb3JtYXQgbm9uIGxpc2libGUgZGFucyBsZSBuYXZpZ2F0ZXVyIDogdMOpbMOpY2hhcmdleiBsJ29yaWdpbmFsLjwvcD48L3ZpZGVvPmA7CiAgICAgIH0gY2F0Y2ggKGUpIHsgdG9hc3QoZS5tZXNzYWdlLCAnZXJyb3InKTsgfQogICAgfTsKICB9IGVsc2UgewogICAgYXBpKCdnZXRQcmV2aWV3JywgbS5pZCkudGhlbih1cmwgPT4gewogICAgICBpZiAobGliLm9wZW5JZCAhPT0gbS5pZCkgcmV0dXJuOwogICAgICBzZXRWaWV3KHVybCA/IGA8aW1nIHNyYz0iJHt1cmx9IiBhbHQ9IiR7ZXNjKG0ub3JpZ2luYWxGaWxlbmFtZSl9Ij5gIDogYDxkaXYgc3R5bGU9ImNvbG9yOiNkZGQ7dGV4dC1hbGlnbjpjZW50ZXI7cGFkZGluZzoyMHB4Ij5BcGVyw6d1IGluZGlzcG9uaWJsZSBwb3VyIGNlIGZvcm1hdCAoJHtlc2MobS5leHRlbnNpb24udG9VcHBlckNhc2UoKSl9KS48YnI+TCdvcmlnaW5hbCBlc3QgaW50YWN0IGV0IHTDqWzDqWNoYXJnZWFibGUuPC9kaXY+YCk7CiAgICB9KS5jYXRjaChlID0+IHNldFZpZXco',
  'JzxkaXYgc3R5bGU9ImNvbG9yOiNkZGQiPicgKyBlc2MoZS5tZXNzYWdlKSArICc8L2Rpdj4nKSk7CiAgfQp9Cgphc3luYyBmdW5jdGlvbiBzZXRTdGF0dXMoaWQsIHN0YXR1cykgewogIHRyeSB7CiAgICBjb25zdCBtID0gbGliLml0ZW1zLmZpbmQoeCA9PiB4LmlkID09PSBpZCk7CiAgICBjb25zdCB1cGQgPSBhd2FpdCBhcGkoJ3VwZGF0ZU1lZGlhJywgaWQsIHsgc3RhdHVzIH0pOwogICAgT2JqZWN0LmFzc2lnbihtLCB1cGQpOwogICAgdG9hc3Qoc3RhdHVzID09PSAnU09SVEVEJyA/ICdNw6lkaWEgbWFycXXDqSBjb21tZSB0cmnDqS4nIDogJ03DqWRpYSByZW1pcyDCqyDDgCB0cmllciDCuy4nKTsKICAgIGlmIChsaWIuZmlsdGVycy5zdGF0dXMgJiYgbGliLmZpbHRlcnMuc3RhdHVzICE9PSBzdGF0dXMpIHsKICAgICAgY29uc3QgaWR4ID0gbGliLml0ZW1zLmZpbmRJbmRleCh4ID0+IHguaWQgPT09IGlkKTsgY29uc3QgbmV4dCA9IGxpYi5pdGVtc1tpZHggKyAxXSB8fCBsaWIuaXRlbXNbaWR4IC0gMV07CiAgICAgIHJlbW92ZUZyb21MaWJyYXJ5KFtpZF0pOwogICAgICBuZXh0ID8gb3BlbkRldGFpbChuZXh0LmlkKSA6IGNsb3NlRGV0YWlsKCk7CiAgICB9IGVsc2UgeyByZWZyZXNoQ2FyZChpZCk7IG9wZW5EZXRhaWwoaWQpOyB9CiAgfSBjYXRjaCAoZSkgeyB0b2FzdChlLm1lc3NhZ2UsICdlcnJvcicpOyB9Cn0KCmZ1bmN0aW9uIGNvbmZpcm1EZWxldGUoaWQpIHsKICBjb25zdCBtID0gbGliLml0ZW1zLmZpbmQo',
  'eCA9PiB4LmlkID09PSBpZCk7CiAgY29uZmlybU1vZGFsKCdTdXBwcmltZXIgZMOpZmluaXRpdmVtZW50IGNlIG3DqWRpYSA/JywgJ0NldHRlIGFjdGlvbiBlc3QgaXJyw6l2ZXJzaWJsZS4gTGUgZmljaGllciBvcmlnaW5hbCBldCBzZXMgZG9ubsOpZXMgYXNzb2Npw6llcyBzZXJvbnQgc3VwcHJpbcOpcy48YnI+PGIgc3R5bGU9IndvcmQtYnJlYWs6YnJlYWstYWxsIj4nICsgZXNjKG0ub3JpZ2luYWxGaWxlbmFtZSkgKyAnPC9iPicsIGFzeW5jICgpID0+IHsKICAgIGNvbnN0IHIgPSBhd2FpdCBhcGkoJ2RlbGV0ZU1lZGlhJywgW2lkXSk7CiAgICBpZiAoci5mYWlsZWQubGVuZ3RoICYmIHIuZmFpbGVkWzBdLmVycm9yICE9PSAiQ2UgbcOpZGlhIG4nZXhpc3RlIHBsdXMuIikgdGhyb3cgbmV3IEVycm9yKHIuZmFpbGVkWzBdLmVycm9yKTsKICAgIGNvbnN0IGlkeCA9IGxpYi5pdGVtcy5maW5kSW5kZXgoeCA9PiB4LmlkID09PSBpZCk7IGNvbnN0IG5leHQgPSBsaWIuaXRlbXNbaWR4ICsgMV0gfHwgbGliLml0ZW1zW2lkeCAtIDFdOwogICAgcmVtb3ZlRnJvbUxpYnJhcnkoW2lkXSk7CiAgICBuZXh0ID8gb3BlbkRldGFpbChuZXh0LmlkKSA6IGNsb3NlRGV0YWlsKCk7CiAgICB0b2FzdCgnTGUgbcOpZGlhIGEgw6l0w6kgc3VwcHJpbcOpIGTDqWZpbml0aXZlbWVudC4nKTsKICB9KTsKfQoKLy8gLS0tLS0tLS0tLSBjb25maXJtYXRpb24KZnVuY3Rpb24gY2xvc2VNb2RhbCgpIHsgJCgnI21vZGFsLXJvb3QnKS5pbm5lckhU',
  'TUwgPSAnJzsgfQpmdW5jdGlvbiBjb25maXJtTW9kYWwodGl0bGUsIGh0bWwsIG9uQ29uZmlybSwgbGFiZWwpIHsKICAkKCcjbW9kYWwtcm9vdCcpLmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPSJtb2RhbCI+PGRpdiBjbGFzcz0iYm94Ij48ZGl2IGNsYXNzPSJpY29uIj4hPC9kaXY+PGgyIHN0eWxlPSJmb250LXNpemU6MThweCI+JHtlc2ModGl0bGUpfTwvaDI+CiAgICA8cCBjbGFzcz0ibXV0ZWQiPiR7aHRtbH08L3A+PGRpdiBjbGFzcz0icm93IiBzdHlsZT0ianVzdGlmeS1jb250ZW50OmZsZXgtZW5kO21hcmdpbi10b3A6MThweCI+CiAgICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLW91dGxpbmUiIGlkPSJtY2FuY2VsIj5Bbm51bGVyPC9idXR0b24+PGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1kYW5nZXIiIGlkPSJtb2siPiR7bGFiZWwgfHwgJ1N1cHByaW1lciBkw6lmaW5pdGl2ZW1lbnQnfTwvYnV0dG9uPjwvZGl2PjwvZGl2PjwvZGl2PmA7CiAgJCgnI21jYW5jZWwnKS5vbmNsaWNrID0gY2xvc2VNb2RhbDsKICAkKCcjbW9rJykub25jbGljayA9IGFzeW5jICgpID0+IHsKICAgICQoJyNtb2snKS5kaXNhYmxlZCA9IHRydWU7ICQoJyNtY2FuY2VsJykuZGlzYWJsZWQgPSB0cnVlOyAkKCcjbW9rJykuaW5uZXJIVE1MID0gJzxzcGFuIGNsYXNzPSJzcGluIj48L3NwYW4+ICcgKyAobGFiZWwgfHwgJ1N1cHByaW1lciBkw6lmaW5pdGl2ZW1lbnQnKTsKICAgIHRyeSB7IGF3YWl0IG9uQ29uZmlybSgpOyBjbG9zZU1vZGFsKCk7',
  'IH0KICAgIGNhdGNoIChlKSB7IHRvYXN0KGUubWVzc2FnZSB8fCAnSW1wb3NzaWJsZSBkZSBzdXBwcmltZXIgY2UgbcOpZGlhLiBWZXVpbGxleiByw6llc3NheWVyLicsICdlcnJvcicpOyBjbG9zZU1vZGFsKCk7IH0KICB9Owp9CgovLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IENBVMOJR09SSUVTICYgQUNUSVZJVMOJUwphc3luYyBmdW5jdGlvbiByZW5kZXJDYXRlZ29yaWVzKCkgewogIGNvbnN0IHYgPSAkKCcjdmlldycpOwogIGlmICghdi5xdWVyeVNlbGVjdG9yKCcuY2F0cycpKSB2LmlubmVySFRNTCA9ICc8aDE+Q2F0w6lnb3JpZXMgJiBhY3Rpdml0w6lzPC9oMT48cCBjbGFzcz0ibXV0ZWQiPjxzcGFuIGNsYXNzPSJzcGluIj48L3NwYW4+IENoYXJnZW1lbnTigKY8L3A+JzsKICBsZXQgY2F0czsKICB0cnkgeyBjYXRzID0gYXdhaXQgbG9hZENhdGFsb2codHJ1ZSwgdHJ1ZSk7IH0gY2F0Y2ggKGUpIHsgdi5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz0iYWxlcnQiPicgKyBlc2MoZS5tZXNzYWdlKSArICc8L2Rpdj4nOyByZXR1cm47IH0KICBpZiAoc3RhdGUudmlldyAhPT0gJ2NhdGVnb3JpZXMnKSByZXR1cm47CiAgY29uc3QgaWIgPSAobGFiZWwsIGFjdGlvbiwgaHRtbCwgZGlzYWJsZWQsIHJlZCkgPT4gYDxidXR0b24gY2xhc3M9Imljb25idG4iIHRpdGxlPSIke2xhYmVsfSIgYXJpYS1sYWJlbD0iJHtsYWJlbH0iICR7ZGlzYWJsZWQgPyAn',
  'ZGlzYWJsZWQnIDogJyd9IHN0eWxlPSIke3JlZCA/ICdjb2xvcjp2YXIoLS1yZWQpJyA6ICcnfSIgb25jbGljaz0iJHthY3Rpb259Ij4ke2h0bWx9PC9idXR0b24+YDsKICB2LmlubmVySFRNTCA9IGA8ZGl2IGNsYXNzPSJiZXR3ZWVuIj48ZGl2PjxoMT5DYXTDqWdvcmllcyAmIGFjdGl2aXTDqXM8L2gxPgogICAgPHAgY2xhc3M9Im11dGVkIiBzdHlsZT0ibWFyZ2luOjA7bWF4LXdpZHRoOjY4MHB4Ij5MZXMgbW9kaWZpY2F0aW9ucyBzJ2FwcGxpcXVlbnQgaW1tw6lkaWF0ZW1lbnQgYXUgZm9ybXVsYWlyZSBkJ2ltcG9ydGF0aW9uLiBMZXMgbcOpZGlhcyBleGlzdGFudHMgY29uc2VydmVudCBsZSBub20gZGUgY2F0w6lnb3JpZSBldCBkJ2FjdGl2aXTDqSBlbnJlZ2lzdHLDqSBsb3JzIGRlIGxldXIgaW1wb3J0YXRpb24uIFVuIMOpbMOpbWVudCB1dGlsaXPDqSBuZSBwZXV0IHBhcyDDqnRyZSBzdXBwcmltw6kgOiBkw6lzYWN0aXZlei1sZS48L3A+PC9kaXY+CiAgICA8YnV0dG9uIGNsYXNzPSJidG4gYnRuLXByaW1hcnkiIG9uY2xpY2s9InByb21wdENhdCgpIj4rIE5vdXZlbGxlIGNhdMOpZ29yaWU8L2J1dHRvbj48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImNhdHMiPiR7Y2F0cy5tYXAoKGMsIGkpID0+IGA8c2VjdGlvbiBjbGFzcz0iY2FyZCBjYXQiIHN0eWxlPSIke2MuYWN0aXZlID8gJycgOiAnYmFja2dyb3VuZDojZjlmYWZiJ30iPgogICAgICA8aGVhZGVyPjxkaXYgc3R5bGU9ImZsZXg6MTttaW4td2lkdGg6MCI+PGIg',
  'Y2xhc3M9IiR7Yy5hY3RpdmUgPyAnJyA6ICdzdHJpa2UnfSI+JHtlc2MoYy5uYW1lKX08L2I+PGRpdiBjbGFzcz0ic21hbGwgbXV0ZWQiPiR7cGx1cmFsKGMubWVkaWFDb3VudCB8fCAwLCAnbcOpZGlhJyl9JHtjLmFjdGl2ZSA/ICcnIDogJyDCtyBkw6lzYWN0aXbDqWUnfTwvZGl2PjwvZGl2PgogICAgICAgICR7aWIoJ01vbnRlcicsIGBtb3ZlQ2F0KCR7aX0sLTEpYCwgJ+KGkScsIGkgPT09IDApfSR7aWIoJ0Rlc2NlbmRyZScsIGBtb3ZlQ2F0KCR7aX0sMSlgLCAn4oaTJywgaSA9PT0gY2F0cy5sZW5ndGggLSAxKX0KICAgICAgICAke2liKCdSZW5vbW1lcicsIGBwcm9tcHRDYXQoJyR7Yy5pZH0nKWAsICfinI4nKX0ke2liKGMuYWN0aXZlID8gJ0TDqXNhY3RpdmVyJyA6ICdSw6lhY3RpdmVyJywgYGNhdGFsb2dPcCgnc2F2ZUNhdGVnb3J5Jyx7aWQ6JyR7Yy5pZH0nLGFjdGl2ZTokeyFjLmFjdGl2ZX19LCcke2MuYWN0aXZlID8gJ0NhdMOpZ29yaWUgZMOpc2FjdGl2w6llLicgOiAnQ2F0w6lnb3JpZSByw6lhY3RpdsOpZS4nfScpYCwgYy5hY3RpdmUgPyAn4peQJyA6ICfil48nKX0KICAgICAgICAke2liKGMubWVkaWFDb3VudCA/ICdVdGlsaXPDqWUgOiBkw6lzYWN0aXZlei1sYSBwbHV0w7R0JyA6ICdTdXBwcmltZXInLCBgZGVsQ2F0KCcke2MuaWR9JylgLCAn8J+XkScsIGMubWVkaWFDb3VudCwgdHJ1ZSl9PC9oZWFkZXI+CiAgICAgIDx1bCBjbGFzcz0ibGlzdCI+JHtjLmFjdGl2aXRpZXMubWFwKChhLCBqKSA9PiBg',
  'PGxpPjxzcGFuIHN0eWxlPSJmbGV4OjEiPjxzcGFuIGNsYXNzPSIke2EuYWN0aXZlID8gJycgOiAnc3RyaWtlJ30iPiR7ZXNjKGEubmFtZSl9PC9zcGFuPiA8c3BhbiBjbGFzcz0ic21hbGwgbXV0ZWQiPiR7bmYoYS5tZWRpYUNvdW50IHx8IDApfSR7YS5hY3RpdmUgPyAnJyA6ICcgwrcgZMOpc2FjdGl2w6llJ308L3NwYW4+PC9zcGFuPgogICAgICAgICR7aWIoJ01vbnRlcicsIGBtb3ZlQWN0KCcke2MuaWR9Jywke2p9LC0xKWAsICfihpEnLCBqID09PSAwKX0ke2liKCdEZXNjZW5kcmUnLCBgbW92ZUFjdCgnJHtjLmlkfScsJHtqfSwxKWAsICfihpMnLCBqID09PSBjLmFjdGl2aXRpZXMubGVuZ3RoIC0gMSl9CiAgICAgICAgJHtpYignUmVub21tZXInLCBgcHJvbXB0QWN0KCcke2MuaWR9JywnJHthLmlkfScpYCwgJ+KcjicpfSR7aWIoYS5hY3RpdmUgPyAnRMOpc2FjdGl2ZXInIDogJ1LDqWFjdGl2ZXInLCBgY2F0YWxvZ09wKCdzYXZlQWN0aXZpdHknLHtpZDonJHthLmlkfScsYWN0aXZlOiR7IWEuYWN0aXZlfX0sJyR7YS5hY3RpdmUgPyAnQWN0aXZpdMOpIGTDqXNhY3RpdsOpZS4nIDogJ0FjdGl2aXTDqSByw6lhY3RpdsOpZS4nfScpYCwgYS5hY3RpdmUgPyAn4peQJyA6ICfil48nKX0KICAgICAgICAke2liKGEubWVkaWFDb3VudCA/ICdVdGlsaXPDqWUgOiBkw6lzYWN0aXZlei1sYSBwbHV0w7R0JyA6ICdTdXBwcmltZXInLCBgZGVsQWN0KCcke2EuaWR9JylgLCAn8J+XkScsIGEubWVkaWFDb3VudCwgdHJ1ZSl9PC9s',
  'aT5gKS5qb2luKCcnKX0KICAgICAgICA8bGk+PGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1naG9zdCBidG4tc20iIG9uY2xpY2s9InByb21wdEFjdCgnJHtjLmlkfScpIj4rIEFqb3V0ZXIgdW5lIGFjdGl2aXTDqTwvYnV0dG9uPjwvbGk+PC91bD48L3NlY3Rpb24+YCkuam9pbignJyl9PC9kaXY+YDsKfQphc3luYyBmdW5jdGlvbiBjYXRhbG9nT3AoZm4sIGFyZywgbXNnKSB7CiAgdHJ5IHsgYXdhaXQgYXBpKGZuLCBhcmcpOyBjYXRhbG9nQ2FjaGUgPSB7IGFjdGl2ZTogbnVsbCwgYWxsOiBudWxsIH07IHRvYXN0KG1zZyk7IHJlbmRlckNhdGVnb3JpZXMoKTsgfQogIGNhdGNoIChlKSB7IHRvYXN0KGUubWVzc2FnZSwgJ2Vycm9yJyk7IH0KfQpmdW5jdGlvbiBwcm9tcHRDYXQoaWQpIHsKICBjb25zdCBjID0gaWQgJiYgY2F0YWxvZ0NhY2hlLmFsbC5maW5kKHggPT4geC5pZCA9PT0gaWQpOwogIGNvbnN0IG5hbWUgPSBwcm9tcHQoYyA/ICdOb3V2ZWF1IG5vbSBkZSBsYSBjYXTDqWdvcmllIDonIDogJ05vbSBkZSBsYSBub3V2ZWxsZSBjYXTDqWdvcmllIDonLCBjID8gYy5uYW1lIDogJycpOwogIGlmIChuYW1lICYmIG5hbWUudHJpbSgpKSBjYXRhbG9nT3AoJ3NhdmVDYXRlZ29yeScsIGMgPyB7IGlkLCBuYW1lIH0gOiB7IG5hbWUgfSwgYyA/ICdDYXTDqWdvcmllIHJlbm9tbcOpZS4nIDogJ0NhdMOpZ29yaWUgwqsgJyArIG5hbWUudHJpbSgpICsgJyDCuyBjcsOpw6llLicpOwp9CmZ1bmN0aW9uIHByb21wdEFjdChjYXRJZCwg',
  'aWQpIHsKICBjb25zdCBjID0gY2F0YWxvZ0NhY2hlLmFsbC5maW5kKHggPT4geC5pZCA9PT0gY2F0SWQpOyBjb25zdCBhID0gaWQgJiYgYy5hY3Rpdml0aWVzLmZpbmQoeCA9PiB4LmlkID09PSBpZCk7CiAgY29uc3QgbmFtZSA9IHByb21wdChhID8gIk5vdXZlYXUgbm9tIGRlIGwnYWN0aXZpdMOpIDoiIDogJ05vbSBkZSBsYSBub3V2ZWxsZSBhY3Rpdml0w6kgKCcgKyBjLm5hbWUgKyAnKSA6JywgYSA/IGEubmFtZSA6ICcnKTsKICBpZiAobmFtZSAmJiBuYW1lLnRyaW0oKSkgY2F0YWxvZ09wKCdzYXZlQWN0aXZpdHknLCBhID8geyBpZCwgbmFtZSB9IDogeyBjYXRlZ29yeUlkOiBjYXRJZCwgbmFtZSB9LCBhID8gJ0FjdGl2aXTDqSByZW5vbW3DqWUuJyA6ICdBY3Rpdml0w6kgwqsgJyArIG5hbWUudHJpbSgpICsgJyDCuyBham91dMOpZS4nKTsKfQpmdW5jdGlvbiBkZWxDYXQoaWQpIHsgY29uc3QgYyA9IGNhdGFsb2dDYWNoZS5hbGwuZmluZCh4ID0+IHguaWQgPT09IGlkKTsgY29uZmlybU1vZGFsKCdTdXBwcmltZXIgbGEgY2F0w6lnb3JpZSDCqyAnICsgYy5uYW1lICsgJyDCuyA/JywgIkxhIGNhdMOpZ29yaWUgZXQgc2VzIGFjdGl2aXTDqXMgc2Vyb250IHN1cHByaW3DqWVzLiBBdWN1biBtw6lkaWEgbid5IGVzdCByYXR0YWNow6kuIiwgYXN5bmMgKCkgPT4geyBhd2FpdCBhcGkoJ2RlbGV0ZUNhdGVnb3J5JywgaWQpOyBjYXRhbG9nQ2FjaGUgPSB7IGFjdGl2ZTogbnVsbCwgYWxsOiBudWxsIH07IHRvYXN0KCdDYXTD',
  'qWdvcmllIHN1cHByaW3DqWUuJyk7IHJlbmRlckNhdGVnb3JpZXMoKTsgfSwgJ1N1cHByaW1lcicpOyB9CmZ1bmN0aW9uIGRlbEFjdChpZCkgeyBjb25maXJtTW9kYWwoIlN1cHByaW1lciBjZXR0ZSBhY3Rpdml0w6kgPyIsICJBdWN1biBtw6lkaWEgbid1dGlsaXNlIGNldHRlIGFjdGl2aXTDqS4iLCBhc3luYyAoKSA9PiB7IGF3YWl0IGFwaSgnZGVsZXRlQWN0aXZpdHknLCBpZCk7IGNhdGFsb2dDYWNoZSA9IHsgYWN0aXZlOiBudWxsLCBhbGw6IG51bGwgfTsgdG9hc3QoJ0FjdGl2aXTDqSBzdXBwcmltw6llLicpOyByZW5kZXJDYXRlZ29yaWVzKCk7IH0sICdTdXBwcmltZXInKTsgfQphc3luYyBmdW5jdGlvbiBtb3ZlQ2F0KGksIGQpIHsgY29uc3QgaWRzID0gY2F0YWxvZ0NhY2hlLmFsbC5tYXAoYyA9PiBjLmlkKTsgY29uc3QgW3hdID0gaWRzLnNwbGljZShpLCAxKTsgaWRzLnNwbGljZShpICsgZCwgMCwgeCk7IGF3YWl0IGNhdGFsb2dPcCgncmVvcmRlckNhdGVnb3JpZXMnLCBpZHMsICdPcmRyZSBtaXMgw6Agam91ci4nKTsgfQphc3luYyBmdW5jdGlvbiBtb3ZlQWN0KGNhdElkLCBqLCBkKSB7IGNvbnN0IGMgPSBjYXRhbG9nQ2FjaGUuYWxsLmZpbmQoeCA9PiB4LmlkID09PSBjYXRJZCk7IGNvbnN0IGlkcyA9IGMuYWN0aXZpdGllcy5tYXAoYSA9PiBhLmlkKTsgY29uc3QgW3hdID0gaWRzLnNwbGljZShqLCAxKTsgaWRzLnNwbGljZShqICsgZCwgMCwgeCk7IGF3YWl0IGNhdGFsb2dPcCgncmVvcmRlckFjdGl2aXRp',
  'ZXMnLCBpZHMsICdPcmRyZSBtaXMgw6Agam91ci4nKTsgfQoKLy8gPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSBQQVJBTcOIVFJFUwphc3luYyBmdW5jdGlvbiByZW5kZXJTZXR0aW5ncygpIHsKICBjb25zdCB2ID0gJCgnI3ZpZXcnKTsKICB2LmlubmVySFRNTCA9ICc8aDE+UGFyYW3DqHRyZXM8L2gxPjxwIGNsYXNzPSJtdXRlZCI+PHNwYW4gY2xhc3M9InNwaW4iPjwvc3Bhbj4gQ2hhcmdlbWVudOKApjwvcD4nOwogIGxldCBzOyB0cnkgeyBzID0gYXdhaXQgYXBpKCdnZXRTZXR0aW5ncycpOyB9IGNhdGNoIChlKSB7IHYuaW5uZXJIVE1MID0gJzxkaXYgY2xhc3M9ImFsZXJ0Ij4nICsgZXNjKGUubWVzc2FnZSkgKyAnPC9kaXY+JzsgcmV0dXJuOyB9CiAgaWYgKHN0YXRlLnZpZXcgIT09ICdzZXR0aW5ncycpIHJldHVybjsKICB2LmlubmVySFRNTCA9IGA8ZGl2IHN0eWxlPSJtYXgtd2lkdGg6NzYwcHgiPjxoMT5QYXJhbcOodHJlczwvaDE+PHAgY2xhc3M9Im11dGVkIj5Db25maWd1cmF0aW9uIGRlIGxhIHNlc3Npb24gZXQgbWFpbnRlbmFuY2UgZGUgbGEgcGhvdG90aMOocXVlLjwvcD4KICAgIDxkaXYgY2xhc3M9ImNhcmQgc2VjdGlvbiIgc3R5bGU9InBhZGRpbmc6MjBweCI+PGgyPk5vbSBhZmZpY2jDqTwvaDI+CiAgICAgIDxmb3JtIGlkPSJuYW1lZiIgY2xhc3M9InJvdyBzZWN0aW9uIiBzdHlsZT0iZmxleC13cmFwOm5vd3JhcCI+PGlucHV0IGNs',
  'YXNzPSJpbnB1dCIgaWQ9ImRuYW1lIiB2YWx1ZT0iJHtlc2Moc3RhdGUubmFtZSl9IiBtYXhsZW5ndGg9IjYwIiByZXF1aXJlZD48YnV0dG9uIGNsYXNzPSJidG4gYnRuLXByaW1hcnkiPkVucmVnaXN0cmVyPC9idXR0b24+PC9mb3JtPgogICAgICA8cCBjbGFzcz0ic21hbGwgbXV0ZWQiPkxlIGNvbXB0ZSBhZG1pbmlzdHJhdGV1ciDDqXRhbnQgcGFydGFnw6ksIGluZGlxdWV6IHZvdHJlIHByw6lub20gcG91ciBxdWUgwqsgdHJpw6kgcGFyIMK7IGlkZW50aWZpZSBsYSBib25uZSBwZXJzb25uZS48L3A+PC9kaXY+CiAgICA8ZGl2IGNsYXNzPSJjYXJkIHNlY3Rpb24iIHN0eWxlPSJwYWRkaW5nOjIwcHgiPjxoMj5TdG9ja2FnZTwvaDI+PGRsIHN0eWxlPSJkaXNwbGF5OmdyaWQ7Z3JpZC10ZW1wbGF0ZS1jb2x1bW5zOmF1dG8gMWZyO2dhcDo4cHggMjBweDttYXJnaW46MTRweCAwIDAiPgogICAgICA8ZHQgY2xhc3M9Im11dGVkIj5GaWNoaWVyczwvZHQ+PGRkIHN0eWxlPSJtYXJnaW46MCI+PGEgaHJlZj0iJHtlc2Mocy5mb2xkZXJVcmwpfSIgdGFyZ2V0PSJfYmxhbmsiPkRvc3NpZXIgR29vZ2xlIERyaXZlPC9hPjwvZGQ+CiAgICAgIDxkdCBjbGFzcz0ibXV0ZWQiPkJhc2UgZGUgZG9ubsOpZXM8L2R0PjxkZCBzdHlsZT0ibWFyZ2luOjAiPjxhIGhyZWY9IiR7ZXNjKHMuc3ByZWFkc2hlZXRVcmwpfSIgdGFyZ2V0PSJfYmxhbmsiPkdvb2dsZSBTaGVldHM8L2E+PC9kZD4KICAgICAgPGR0IGNsYXNzPSJtdXRlZCI+VGFpbGxl',
  'IG1heC4gcGFyIGZpY2hpZXI8L2R0PjxkZCBzdHlsZT0ibWFyZ2luOjAiPiR7bmYocy5tYXhVcGxvYWRNYil9IE1vPC9kZD4KICAgICAgPGR0IGNsYXNzPSJtdXRlZCI+T3JpZ2luYXV4PC9kdD48ZGQgc3R5bGU9Im1hcmdpbjowIj5Db25zZXJ2w6lzIMOgIGwnaWRlbnRpcXVlIChmb3JtYXQsIHLDqXNvbHV0aW9uLCBxdWFsaXTDqSwgZXh0ZW5zaW9uKTwvZGQ+PC9kbD48L2Rpdj4KICAgIDxkaXYgY2xhc3M9ImNhcmQgc2VjdGlvbiIgc3R5bGU9InBhZGRpbmc6MjBweCI+PGgyPk1haW50ZW5hbmNlPC9oMj4KICAgICAgPHA+PGI+JHtzLnN0YWxlUGVuZGluZ308L2I+IGltcG9ydGF0aW9uKHMpIGludGVycm9tcHVlKHMpIGRlcHVpcyBwbHVzIGRlIDI0IGggwrcgPGI+JHtzLmRlbGV0aW5nfTwvYj4gc3VwcHJlc3Npb24ocykgaW5hY2hldsOpZShzKTwvcD4KICAgICAgPGJ1dHRvbiBjbGFzcz0iYnRuIGJ0bi1vdXRsaW5lIiBpZD0iY2xlYW5idG4iICR7cy5zdGFsZVBlbmRpbmcgKyBzLmRlbGV0aW5nID8gJycgOiAnZGlzYWJsZWQnfT5OZXR0b3llcjwvYnV0dG9uPjwvZGl2PgogICAgPGRpdiBjbGFzcz0iY2FyZCBzZWN0aW9uIiBzdHlsZT0icGFkZGluZzoyMHB4Ij48aDI+U8OpY3VyaXTDqTwvaDI+PHVsIGNsYXNzPSJtdXRlZCIgc3R5bGU9Im1hcmdpbjoxMHB4IDAgMDtwYWRkaW5nLWxlZnQ6MThweDtsaW5lLWhlaWdodDoxLjciPgogICAgICA8bGk+TGVzIG1vdHMgZGUgcGFzc2Ugc29udCBzdG9ja8OpcyBkYW5zIGxl',
  'cyBQcm9wcmnDqXTDqXMgZHUgc2NyaXB0IGV0IG5lIHNvbnQgamFtYWlzIHRyYW5zbWlzIGF1IG5hdmlnYXRldXIuPC9saT4KICAgICAgPGxpPk1vZGlmaWVyIHVuIG1vdCBkZSBwYXNzZSBkw6ljb25uZWN0ZSBhdXRvbWF0aXF1ZW1lbnQgdG91dGVzIGxlcyBzZXNzaW9ucyBjb3JyZXNwb25kYW50ZXMuPC9saT4KICAgICAgPGxpPlRvdXRlcyBsZXMgYWN0aW9ucyBkJ2FkbWluaXN0cmF0aW9uIHNvbnQgdsOpcmlmacOpZXMgY8O0dMOpIHNlcnZldXIuPC9saT48L3VsPjwvZGl2PjwvZGl2PmA7CiAgJCgnI25hbWVmJykub25zdWJtaXQgPSBhc3luYyBlID0+IHsKICAgIGUucHJldmVudERlZmF1bHQoKTsKICAgIHRyeSB7IGNvbnN0IHIgPSBhd2FpdCBhcGkoJ3NldERpc3BsYXlOYW1lJywgJCgnI2RuYW1lJykudmFsdWUpOyBzdGF0ZS50b2tlbiA9IHIudG9rZW47IHN0YXRlLm5hbWUgPSByLm5hbWU7IHN0b3JlLnNldCgnY3JmX3Rva2VuJywgci50b2tlbik7IHRvYXN0KCdOb20gYWZmaWNow6kgbWlzIMOgIGpvdXIuJyk7IHJlbmRlcigpOyB9CiAgICBjYXRjaCAoZXJyKSB7IHRvYXN0KGVyci5tZXNzYWdlLCAnZXJyb3InKTsgfQogIH07CiAgJCgnI2NsZWFuYnRuJykub25jbGljayA9IGFzeW5jICgpID0+IHsKICAgICQoJyNjbGVhbmJ0bicpLmRpc2FibGVkID0gdHJ1ZTsKICAgIHRyeSB7IGNvbnN0IHIgPSBhd2FpdCBhcGkoJ2NsZWFudXAnKTsgdG9hc3Qoci5jbGVhbmVkICsgJyDDqWzDqW1lbnQocykgbmV0dG95w6ko',
  'cyknICsgKHIuZmFpbGVkID8gJywgJyArIHIuZmFpbGVkICsgJyBlbiDDqWNoZWMnIDogJycpICsgJy4nLCByLmZhaWxlZCA/ICdlcnJvcicgOiAnJyk7IHJlbmRlclNldHRpbmdzKCk7IH0KICAgIGNhdGNoIChlKSB7IHRvYXN0KGUubWVzc2FnZSwgJ2Vycm9yJyk7IH0KICB9Owp9CgovLyA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09IETDiU1BUlJBR0UKKGFzeW5jIGZ1bmN0aW9uIGJvb3QoKSB7CiAgaWYgKCFzdGF0ZS50b2tlbikgcmV0dXJuIHJlbmRlcigpOwogIGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKCdhcHAnKS5pbm5lckhUTUwgPSAnPGRpdiBjbGFzcz0ibG9naW4iPjxzcGFuIGNsYXNzPSJzcGluIj48L3NwYW4+PC9kaXY+JzsKICB0cnkgewogICAgY29uc3QgcyA9IGF3YWl0IGNhbGwoJ2dldFNlc3Npb24nLCBzdGF0ZS50b2tlbik7CiAgICBzdGF0ZS5yb2xlID0gcy5yb2xlOyBzdGF0ZS5uYW1lID0gcy5uYW1lOwogICAgc3RhdGUudmlldyA9IHMucm9sZSA9PT0gJ0FETUlOJyA/ICdkYXNoYm9hcmQnIDogJ2ltcG9ydCc7CiAgfSBjYXRjaCAoZSkgeyBzdGF0ZS50b2tlbiA9IG51bGw7IHN0b3JlLnNldCgnY3JmX3Rva2VuJywgbnVsbCk7IH0KICByZW5kZXIoKTsKfSkoKTsKPC9zY3JpcHQ+CjwvYm9keT4KPC9odG1sPgo=',
];
