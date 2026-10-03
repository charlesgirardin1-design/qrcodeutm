/* Simulateur minimal des services Google Apps Script — pour tester Code.gs hors de Google (Node ou navigateur).
   Classeur en mémoire, cache, propriétés, verrous, e-mails enregistrés, Drive minimal, API Apps Script simulée
   (projects.getContent / updateContent / versions / deployments), zip « stocké » (sans compression). */
(function (racine) {
  'use strict';
  const G = racine;
  const etat = G.__GAS = { mails: [], api: [], fichiersDrive: [], projet: null };
  const pad = n => ('0' + n).slice(-2);
  // ---------- octets / UTF-8 / base64 ----------
  const enc = s => Array.from(new TextEncoder().encode(String(s)));
  const dec = b => new TextDecoder('utf-8').decode(new Uint8Array(b.map(x => x & 255)));
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64e(b) { let s = ''; for (let i = 0; i < b.length; i += 3) { const n = ((b[i] & 255) << 16) | (((b[i + 1] || 0) & 255) << 8) | ((b[i + 2] || 0) & 255); s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '='); } return s; }
  function b64d(s) { s = String(s).replace(/[^A-Za-z0-9+/]/g, ''); const o = []; for (let i = 0; i < s.length; i += 4) { const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | ((B64.indexOf(s[i + 2]) & 63) << 6) | (B64.indexOf(s[i + 3]) & 63); o.push((n >> 16) & 255); if (s[i + 2] !== undefined && s[i + 2] !== '=') o.push((n >> 8) & 255); if (s[i + 3] !== undefined && s[i + 3] !== '=') o.push(n & 255); } return o.map(x => x > 127 ? x - 256 : x); }
  const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = b => { let c = 0xFFFFFFFF; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  // ---------- Blob ----------
  function Blob_(bytes, mime, name) { this._b = (bytes || []).map(x => x & 255); this._m = mime || 'application/octet-stream'; this._n = name || ''; }
  Blob_.prototype = {
    getBytes() { return this._b.map(x => x > 127 ? x - 256 : x); }, getDataAsString(cs) { return dec(this._b); }, getName() { return this._n; }, setName(n) { this._n = n; return this; },
    getContentType() { return this._m; }, setContentType(m) { this._m = m; return this; }, setDataFromString(s) { this._b = enc(s); return this; }, setBytes(b) { this._b = b.map(x => x & 255); return this; }, copyBlob() { return new Blob_(this._b.slice(), this._m, this._n); }, getBlob() { return this; },
  };
  function zip(blobs, nom) {
    const out = [], central = []; let off = 0;
    const u16 = n => [n & 255, (n >> 8) & 255], u32 = n => [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >>> 24) & 255];
    blobs.forEach(b => {
      const n = enc(b.getName()), d = b._b, c = crc32(d);
      const loc = [].concat(u32(0x04034b50), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(c), u32(d.length), u32(d.length), u16(n.length), u16(0), n);
      central.push([].concat(u32(0x02014b50), u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0), u32(c), u32(d.length), u32(d.length), u16(n.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(off), n));
      loc.concat(d).forEach(x => out.push(x)); off += loc.length + d.length;
    });
    const cd = [].concat.apply([], central);
    const fin = [].concat(u32(0x06054b50), u16(0), u16(0), u16(blobs.length), u16(blobs.length), u32(cd.length), u32(off), u16(0));
    return new Blob_(out.concat(cd, fin), 'application/zip', nom || 'archive.zip');
  }
  function unzip(blob) {
    const b = blob._b, L = []; let i = 0;
    const r16 = k => b[k] | (b[k + 1] << 8), r32 = k => (b[k] | (b[k + 1] << 8) | (b[k + 2] << 16) | (b[k + 3] << 24)) >>> 0;
    while (i + 30 <= b.length && r32(i) === 0x04034b50) {
      const meth = r16(i + 8), taille = r32(i + 18), ln = r16(i + 26), le = r16(i + 28);
      if (meth !== 0) throw new Error('Méthode de compression non simulée');
      const nom = dec(b.slice(i + 30, i + 30 + ln)), d = b.slice(i + 30 + ln + le, i + 30 + ln + le + taille);
      L.push(new Blob_(d, 'application/octet-stream', nom)); i += 30 + ln + le + taille;
    }
    if (!L.length) throw new Error('Archive invalide');
    return L;
  }
  G.Utilities = {
    formatDate(d, tz, f) {
      d = new Date(d); const v = { yyyy: d.getFullYear(), MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()), ss: pad(d.getSeconds()), EEE: ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'][d.getDay()] };
      return String(f).split(/('[^']*')/).map(p => /^'.*'$/.test(p) ? p.slice(1, -1) : p.replace(/yyyy|MM|dd|HH|mm|ss|EEE/g, k => v[k])).join('');
    },
    getUuid() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); },
    base64Encode(x) { return b64e(typeof x === 'string' ? enc(x) : x); }, base64Decode(s) { return b64d(s); },
    base64EncodeWebSafe(x) { return this.base64Encode(x).replace(/\+/g, '-').replace(/\//g, '_'); }, base64DecodeWebSafe(s) { return b64d(String(s).replace(/-/g, '+').replace(/_/g, '/')); },
    newBlob(data, mime, name) { return new Blob_(typeof data === 'string' ? enc(data) : (data || []), mime, name); },
    zip: zip, unzip: unzip, sleep() { },
    computeDigest(a, s) { const b = typeof s === 'string' ? enc(s) : s; let h = 0; const o = []; for (let i = 0; i < 32; i++) { h = (h * 31 + (b[i % (b.length || 1)] || 0) + i) & 255; o.push(h > 127 ? h - 256 : h); } return o; },
    computeHmacSha256Signature(v, k) { return this.computeDigest(0, String(v) + String(k)); },
    DigestAlgorithm: { SHA_256: 'SHA_256', MD5: 'MD5' }, Charset: { UTF_8: 'UTF-8' },
    parseCsv(s) { return String(s).split('\n').map(l => l.split(',')); },
  };
  // ---------- Cache / propriétés / verrous ----------
  function Cache_() { this.m = new Map(); }
  Cache_.prototype = { get(k) { return this.m.has(k) ? this.m.get(k) : null; }, put(k, v) { this.m.set(k, String(v)); }, putAll(o) { Object.keys(o).forEach(k => this.m.set(k, String(o[k]))); }, getAll(ks) { const o = {}; ks.forEach(k => { if (this.m.has(k)) o[k] = this.m.get(k); }); return o; }, remove(k) { this.m.delete(k); }, removeAll(ks) { ks.forEach(k => this.m.delete(k)); } };
  const caches = { s: new Cache_(), u: new Cache_(), d: new Cache_() };
  G.CacheService = { getScriptCache: () => caches.s, getUserCache: () => caches.u, getDocumentCache: () => caches.d };
  function Props_() { this.o = {}; }
  Props_.prototype = { getProperty(k) { return k in this.o ? this.o[k] : null; }, setProperty(k, v) { this.o[k] = String(v); return this; }, deleteProperty(k) { delete this.o[k]; return this; }, getProperties() { return Object.assign({}, this.o); }, setProperties(p) { Object.assign(this.o, p); return this; }, getKeys() { return Object.keys(this.o); } };
  const props = { s: new Props_(), u: new Props_(), d: new Props_() };
  G.PropertiesService = { getScriptProperties: () => props.s, getUserProperties: () => props.u, getDocumentProperties: () => props.d };
  const Lock_ = () => ({ tryLock: () => true, waitLock() { }, releaseLock() { }, hasLock: () => true });
  G.LockService = { getScriptLock: Lock_, getUserLock: Lock_, getDocumentLock: Lock_ };
  // ---------- Classeur ----------
  function Range_(sh, r, c, nr, nc) { this.sh = sh; this.r = r; this.c = c; this.nr = nr || 1; this.nc = nc || 1; }
  Range_.prototype = {
    _chk() { if (this.r + this.nr - 1 > this.sh.maxR || this.c + this.nc - 1 > this.sh.maxC) throw new Error('The coordinates of the range are outside the dimensions of the sheet.'); },
    getDisplayValues() { this._chk(); const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) { const v = (this.sh.d[this.r - 1 + i] || [])[this.c - 1 + j]; row.push(v == null ? '' : String(v)); } o.push(row); } return o; },
    getValues() { return this.getDisplayValues(); }, getDisplayValue() { return this.getDisplayValues()[0][0]; }, getValue() { return this.getDisplayValue(); },
    setValues(v) { this._chk(); if (v.length !== this.nr || v.some(x => x.length !== this.nc)) throw new Error('Dimensions incorrectes'); v.forEach((row, i) => { const R = this.sh.d[this.r - 1 + i] || (this.sh.d[this.r - 1 + i] = []); row.forEach((x, j) => { const s = x == null ? '' : String(x); if (s.length > 50000) throw new Error('Your input contains more than the maximum of 50000 characters in a single cell.'); R[this.c - 1 + j] = s; }); }); return this; },
    setValue(x) { return this.setValues([[x]]); },
    clearContent() { for (let i = 0; i < this.nr; i++) { const R = this.sh.d[this.r - 1 + i]; if (R) for (let j = 0; j < this.nc; j++) R[this.c - 1 + j] = ''; } return this; },
    setNumberFormat() { return this; }, setFontWeight() { return this; }, setBackground() { return this; }, setFontColor() { return this; }, setWrap() { return this; }, getRow() { return this.r; }, getSheet() { return this.sh; },
  };
  function Sheet_(nom) { this.nom = nom; this.d = []; this.maxR = 1000; this.maxC = 26; }
  Sheet_.prototype = {
    getName() { return this.nom; }, setName(n) { this.nom = n; return this; },
    getRange(r, c, nr, nc) { if (typeof r === 'string') throw new Error('A1 non simulé'); return new Range_(this, r, c, nr, nc); },
    getLastRow() { for (let i = this.d.length - 1; i >= 0; i--) if (this.d[i] && this.d[i].some(x => x !== '' && x != null)) return i + 1; return 0; },
    getLastColumn() { let m = 0; this.d.forEach(R => { if (R) for (let j = R.length - 1; j >= 0; j--) if (R[j] !== '' && R[j] != null) { m = Math.max(m, j + 1); break; } }); return m; },
    getMaxRows() { return this.maxR; }, getMaxColumns() { return this.maxC; },
    insertRowsAfter(a, n) { this.maxR += n; this.d.splice(a, 0, ...Array.from({ length: Math.max(0, Math.min(n, this.d.length - a)) }, () => [])); return this; },
    insertColumnsAfter(a, n) { this.maxC += n; return this; },
    deleteRow(r) { this.d.splice(r - 1, 1); this.maxR--; return this; },
    setFrozenRows() { return this; }, autoResizeColumns() { return this; }, getSheetId() { return 1; },
  };
  function Classeur_(id, nom) { this.id = id; this.nom = nom; this.feuilles = [new Sheet_('Feuille 1')]; }
  Classeur_.prototype = {
    getId() { return this.id; }, getUrl() { return 'https://docs.google.com/spreadsheets/d/' + this.id; }, getName() { return this.nom; },
    getSheetByName(n) { return this.feuilles.find(s => s.nom === n) || null; }, getSheets() { return this.feuilles.slice(); },
    insertSheet(n) { if (this.getSheetByName(n)) throw new Error('Feuille existante : ' + n); const s = new Sheet_(n); this.feuilles.push(s); return s; },
    deleteSheet(s) { this.feuilles = this.feuilles.filter(x => x !== s); }, setSpreadsheetTimeZone() { }, getSpreadsheetTimeZone() { return 'Europe/Paris'; }, copy(n) { return new Classeur_('copie' + Date.now(), n); },
  };
  const classeurs = {};
  G.SpreadsheetApp = {
    openById(id) { if (!classeurs[id]) throw new Error('Classeur introuvable ' + id); return classeurs[id]; },
    create(n) { const id = 'base' + Object.keys(classeurs).length; return (classeurs[id] = new Classeur_(id, n)); }, flush() { },
  };
  // ---------- Session, e-mails, déclencheurs ----------
  etat.utilisateur = 'admin@dt87.test';
  G.Session = { getActiveUser: () => ({ getEmail: () => etat.utilisateur }), getEffectiveUser: () => ({ getEmail: () => 'proprietaire@dt87.test' }), getScriptTimeZone: () => 'Europe/Paris', getTemporaryActiveUserKey: () => 'k' };
  G.MailApp = { sendEmail(o) { etat.mails.push(o); }, getRemainingDailyQuota: () => 1500 };
  G.GmailApp = G.MailApp;
  const chaine = () => { const c = { timeBased: () => c, everyDays: () => c, atHour: () => c, inTimezone: () => c, at: () => c, forSpreadsheet: () => c, onEdit: () => c, onChange: () => c, everyHours: () => c, create: () => ({ getHandlerFunction: () => '', getUniqueId: () => '1' }) }; return c; };
  G.ScriptApp = {
    getScriptId: () => 'SCRIPT_ID_TEST', getOAuthToken: () => 'jeton', getProjectTriggers: () => [], deleteTrigger() { }, newTrigger: chaine,
    getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/' + etat.deploiementId + '/exec' }),
  };
  etat.deploiementId = 'AKfycbDEPLOIEMENT0000000000000000000000';
  // ---------- Drive minimal ----------
  function Dossier_(id, nom) { this.id = id; this.nom = nom; }
  Dossier_.prototype = { getId() { return this.id; }, getName() { return this.nom; }, isTrashed: () => false, getUrl() { return 'https://drive.google.com/drive/folders/' + this.id; },
    createFile(a, b, c) { const blob = typeof a === 'string' ? new Blob_(enc(b), c, a) : a; const f = { id: 'f' + etat.fichiersDrive.length, nom: blob.getName(), blob: blob, dossier: this.id }; etat.fichiersDrive.push(f); return { getId: () => f.id, getUrl: () => 'https://drive.google.com/file/d/' + f.id, getName: () => f.nom, setDescription() { return this; } }; },
    getFiles() { return { hasNext: () => false }; }, getFolders() { return { hasNext: () => false }; } };
  etat.dossiers = {};
  G.DriveApp = { getFolderById(id) { if (!etat.dossiers[id]) throw new Error('introuvable'); return etat.dossiers[id]; }, getFileById() { throw new Error('non simulé'); }, getRootFolder: () => new Dossier_('racine', 'Mon Drive') };
  etat.ajouterDossier = (id, nom) => (etat.dossiers[id] = new Dossier_(id, nom));
  // ---------- API Apps Script simulée ----------
  // etat.projet = { head: [{name,type,source}], versions: {n: files}, deploiements: {id: {versionNumber}}, actif: true, portees: true }
  const reponse = (code, o) => ({ getResponseCode: () => code, getContentText: () => typeof o === 'string' ? o : JSON.stringify(o), getBlob: () => new Blob_(enc(JSON.stringify(o))) });
  G.UrlFetchApp = {
    fetch(url, o) {
      o = o || {}; const m = String(url).match(/^https:\/\/script\.googleapis\.com\/v1\/projects\/([^/]+)\/(content|versions|deployments)(?:\/([^?]+))?(?:\?versionNumber=(\d+))?$/);
      etat.api.push({ url: url, method: o.method || 'get' });
      const P = etat.projet;
      if (!m || !P) return reponse(404, { error: { message: 'Not found' } });
      if (!P.actif) return reponse(403, { error: { message: 'User has not enabled the Apps Script API. Enable it by visiting https://script.google.com/home/usersettings then retry.' } });
      if (!P.portees) return reponse(403, { error: { message: 'Request had insufficient authentication scopes.' } });
      const meth = String(o.method || 'get').toLowerCase(), corps = o.payload ? JSON.parse(o.payload) : null, copie = f => f.map(x => Object.assign({}, x));
      if (m[2] === 'content' && meth === 'get') { const v = m[4] ? P.versions[m[4]] : P.head; if (!v) return reponse(404, { error: { message: 'version' } }); return reponse(200, { scriptId: m[1], files: copie(v).map(f => Object.assign({ lastModifyUser: {}, functionSet: {} }, f)) }); }
      if (m[2] === 'content' && meth === 'put') { if (!corps.files.some(f => f.name === 'appsscript' && f.type === 'JSON')) return reponse(400, { error: { message: 'manifest file missing' } }); P.head = copie(corps.files.map(f => ({ name: f.name, type: f.type, source: f.source }))); return reponse(200, { files: P.head }); }
      if (m[2] === 'versions' && meth === 'post') { const n = Object.keys(P.versions).length + 1; P.versions[n] = copie(P.head); return reponse(200, { versionNumber: n, description: corps.description }); }
      if (m[2] === 'deployments' && m[3]) { const d = P.deploiements[m[3]]; if (!d) return reponse(404, { error: { message: 'deployment' } }); if (meth === 'get') return reponse(200, { deploymentId: m[3], deploymentConfig: Object.assign({ scriptId: m[1], manifestFileName: 'appsscript' }, d) }); if (meth === 'put') { Object.assign(d, { versionNumber: corps.deploymentConfig.versionNumber }); return reponse(200, { deploymentId: m[3], deploymentConfig: corps.deploymentConfig }); } }
      return reponse(400, { error: { message: 'non simulé' } });
    },
  };
  // HtmlService : fichiers HTML de la version en service
  const servis = () => { const P = etat.projet; if (!P) return []; const d = P.deploiements[etat.deploiementId]; return d && d.versionNumber ? P.versions[d.versionNumber] : P.head; };
  G.HtmlService = {
    createHtmlOutputFromFile(n) { const f = servis().find(x => x.name === n && x.type === 'HTML'); if (!f) throw new Error('No HTML file named ' + n + ' was found.'); return { getContent: () => f.source }; },
    createHtmlOutput(s) { return { getContent: () => String(s || ''), setTitle() { return this; } }; },
    XFrameOptionsMode: { ALLOWALL: 1 },
  };
  G.ContentService = { createTextOutput: s => ({ setMimeType() { return this; }, getContent: () => s }), MimeType: { JSON: 'json' } };
  G.console = G.console || console;
})(typeof globalThis !== 'undefined' ? globalThis : window);
