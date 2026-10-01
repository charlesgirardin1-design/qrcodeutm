/**
 * =============================================================================
 *  DÉPLOIEMENT — URL WEB APP UNIQUE ET STABLE
 *
 *  Fichier indépendant : il ne modifie AUCUNE fonctionnalité de l'application.
 *  Il met à jour le déploiement Web App OFFICIEL (nouvelle version) sans jamais
 *  créer de nouveau déploiement : l'ID de déploiement et l'URL restent identiques.
 *
 *  Fonctions à lancer depuis l'éditeur (liste déroulante à côté de « Exécuter ») :
 *    - listerDeploiements()      : affiche tous les déploiements et leur URL
 *    - verifierDeploiement()     : vérifie que le déploiement officiel est intact
 *    - publierNouvelleVersion()  : enregistre une nouvelle version et l'applique
 *                                  au déploiement officiel (même URL)
 * =============================================================================
 */

// =============================================================================
//  ZONE À RENSEIGNER UNE SEULE FOIS
//  (Déployer → Gérer les déploiements → copier l'« ID de déploiement » et l'URL)
// =============================================================================
const DEPLOIEMENT_OFFICIEL = {
  ID: 'AKfycb_COLLEZ_ICI_L_ID_DU_DEPLOIEMENT_OFFICIEL',
  URL: 'https://script.google.com/macros/s/COLLEZ_ICI_L_ID/exec',
};
// =============================================================================

const SCRIPT_API_ = 'https://script.googleapis.com/v1/projects/';

function scriptApi_(method, path, body) {
  const res = UrlFetchApp.fetch(SCRIPT_API_ + ScriptApp.getScriptId() + path, {
    method: method,
    contentType: 'application/json',
    payload: body ? JSON.stringify(body) : undefined,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const text = res.getContentText();
  if (code >= 200 && code < 300) return text ? JSON.parse(text) : {};

  let message = text;
  try { message = JSON.parse(text).error.message; } catch (e) {}
  if (code === 403 && /has not been used|disabled|SERVICE_DISABLED/i.test(message)) {
    throw new Error(
      "L'API Google Apps Script n'est pas activée pour ce projet.\n" +
      '1) https://script.google.com/home/usersettings → « API Google Apps Script » : Activé.\n' +
      '2) Si l\'erreur persiste : Paramètres du projet → Projet Google Cloud → associer un projet standard, ' +
      "puis activer « Apps Script API » dans la console Google Cloud.\n" +
      'En attendant, utilisez la procédure manuelle (Gérer les déploiements → Modifier → Nouvelle version).'
    );
  }
  if (code === 403) {
    throw new Error('Autorisation insuffisante : ajoutez les droits « script.deployments » et « script.projects » dans appsscript.json. Détail : ' + message);
  }
  throw new Error('Erreur API Apps Script (' + code + ') : ' + message);
}

function urlWebApp_(deploiement) {
  const entree = (deploiement.entryPoints || []).filter(function (e) { return e.entryPointType === 'WEB_APP'; })[0];
  return entree && entree.webApp ? entree.webApp.url : '';
}

function controlerConfiguration_() {
  if (!DEPLOIEMENT_OFFICIEL.ID || DEPLOIEMENT_OFFICIEL.ID.indexOf('COLLEZ_ICI') >= 0) {
    throw new Error(
      'Renseignez d\'abord DEPLOIEMENT_OFFICIEL.ID et DEPLOIEMENT_OFFICIEL.URL en haut de Deploiement.gs ' +
      '(lancez listerDeploiements() pour les retrouver). Aucune action effectuée.'
    );
  }
}

/** Affiche tous les déploiements du projet, pour identifier l'officiel. Ne modifie rien. */
function listerDeploiements() {
  const liste = scriptApi_('get', '/deployments?pageSize=50').deployments || [];
  Logger.log(liste.length + ' déploiement(s) :');
  liste.forEach(function (d) {
    const cfg = d.deploymentConfig || {};
    const officiel = d.deploymentId === DEPLOIEMENT_OFFICIEL.ID ? '   ← OFFICIEL' : '';
    Logger.log(
      '• ' + (cfg.description || '(sans description)') +
      ' | version : ' + (cfg.versionNumber || 'HEAD (test)') +
      ' | ID : ' + d.deploymentId +
      ' | URL : ' + (urlWebApp_(d) || '—') + officiel
    );
  });
  return liste;
}

/** Vérifie que le déploiement officiel existe et que son URL n'a pas changé. Ne modifie rien. */
function verifierDeploiement() {
  controlerConfiguration_();
  const d = scriptApi_('get', '/deployments/' + encodeURIComponent(DEPLOIEMENT_OFFICIEL.ID));
  const url = urlWebApp_(d);
  const version = (d.deploymentConfig || {}).versionNumber;
  if (!url) throw new Error('Le déploiement officiel n\'est pas une Application Web. Vérifiez l\'ID renseigné.');
  if (DEPLOIEMENT_OFFICIEL.URL.indexOf('COLLEZ_ICI') < 0 && url !== DEPLOIEMENT_OFFICIEL.URL) {
    throw new Error('ATTENTION : l\'URL du déploiement (' + url + ') ne correspond pas à l\'URL officielle (' + DEPLOIEMENT_OFFICIEL.URL + ').');
  }
  Logger.log('✅ Déploiement officiel OK');
  Logger.log('   ID      : ' + d.deploymentId);
  Logger.log('   Version : ' + version);
  Logger.log('   URL     : ' + url);
  return { id: d.deploymentId, version: version, url: url };
}

/**
 * Publie le code ENREGISTRÉ sur le déploiement officiel, sans en créer un nouveau :
 *  1. vérifie le déploiement officiel (ID + URL) ;
 *  2. crée une nouvelle version du code ;
 *  3. modifie le déploiement officiel pour pointer vers cette version ;
 *  4. revérifie que l'ID et l'URL sont inchangés.
 * En cas de doute, la fonction s'arrête AVANT toute modification.
 */
function publierNouvelleVersion() {
  const avant = verifierDeploiement();
  const actuel = scriptApi_('get', '/deployments/' + encodeURIComponent(DEPLOIEMENT_OFFICIEL.ID));
  const description = 'Mise à jour du ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd/MM/yyyy HH:mm');

  const version = scriptApi_('post', '/versions', { description: description });
  Logger.log('Nouvelle version créée : ' + version.versionNumber);

  scriptApi_('put', '/deployments/' + encodeURIComponent(DEPLOIEMENT_OFFICIEL.ID), {
    deploymentConfig: {
      scriptId: ScriptApp.getScriptId(),
      versionNumber: version.versionNumber,
      manifestFileName: (actuel.deploymentConfig || {}).manifestFileName || 'appsscript',
      description: description,
    },
  });

  const apres = verifierDeploiement();
  if (apres.id !== avant.id || apres.url !== avant.url) {
    throw new Error('ANOMALIE : l\'ID ou l\'URL du déploiement a changé. Avant : ' + avant.url + ' / Après : ' + apres.url);
  }
  Logger.log('✅ Version ' + apres.version + ' publiée. URL inchangée : ' + apres.url);
  return apres;
}
