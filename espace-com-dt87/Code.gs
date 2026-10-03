/**
 * =====================================================================
 *  CENTRE COM — Application interne de pilotage de la communication
 *  Conçue pour la Croix-Rouge française · Délégation territoriale 87
 *  Réutilisable par toute délégation (Centre Com DT87, DT09, DTXX…)
 * ---------------------------------------------------------------------
 *  LE CODE EST LE MOTEUR. LA CONFIGURATION EST CE QUI CHANGE.
 *  LE DRIVE PARTAGÉ EST LE STOCKAGE. L'ADMINISTRATION GÈRE LE SYSTÈME.
 *
 *  Aucune donnée de la délégation n'est écrite dans ce code :
 *  noms, UL, e-mails, délais, statuts, couleurs, polices, textes, liens,
 *  dossiers Drive, rôles… → Administration > Configuration générale.
 *  Configuration de départ : fichier ConfigInitiale.html.
 *
 *  Ce fichier contient uniquement :
 *    • la STRUCTURE (codes internes qui pilotent les automatismes) ;
 *    • des VALEURS PAR DÉFAUT génériques, utilisées si un réglage manque ;
 *    • la logique : identification, permissions, données, e-mails.
 *
 *  Fichiers du projet : Code.gs · ConfigInitiale.html · Index.html ·
 *  Styles.html · App.html · appsscript.json
 *  Documentation : Documentation technique (livrée avec le code).
 *  Version du code : 3.30.0 — octobre 2026 (fichiers du projet : export / import des 6 fichiers, duplication pour une autre DT ; matériel : galerie de photos, e-mails de réservation au responsable ; performance : connexion en un aller-retour, données compactes, copies gardées ; finalisation : diffusion interne, interconnexion, recherche ; Mon Centre Com personnalisable, thème personnel ; fonctions du quotidien : projets, mentions, modèles, actions groupées, calendrier relié, rappels ; optimisation : administration sans accès Drive inutiles, tableau de bord « inchangé », historique lu par blocs ; import des gros fichiers : envoi direct au Drive, causes nommées ; import débloqué ; Mon Centre Com ; photothèque multimédia : photos et vidéos ; audit final, import fiable ; rôles dynamiques, originaux des photos, logo importé, multi-DT ; performance, fiabilité et finition ; tableau de bord de l'administration, gestion des utilisateurs ; fichiers partout, favoris communs, mode utilisateur ; Mon Centre Com : favoris, brouillons, duplication, personnes associées, agenda ; notifications dans l'application et activité récente ; accueil personnalisé ; import de photos par morceaux, en parallèle et en arrière-plan ; matériel et réservations ; adresse Web App unique ; rapidité et fluidité ; photothèque ; aide et FAQ, recherche globale, accueil guidé ; confort d'utilisation : tableau de bord administrateur, listes et filtres, responsive, accessibilité ; site réel uniquement ; prévisualisation des ressources ; configuration progressive ; Drive partagé, profils, ressources)
 * =====================================================================
 */

const VERSION_CODE = '3.30.0';   // doit être IDENTIQUE à VERSION_APP dans App.html (contrôlé au démarrage)
const VERSION_SCHEMA = 4;          // format de la configuration (export/import) ; 1 = version 2.x, 3 = version 3.3, importables
const FORMAT_EXPORT = 'centre-com-configuration';

// =====================================================================
// 1. STRUCTURE FIXE — codes internes (les LIBELLÉS sont configurables)
// =====================================================================
const TABLES = {
  demandes: { onglet: 'Demandes', cols: ['id', 'cree_le', 'maj_le', 'demandeur_nom', 'demandeur_email', 'telephone', 'ul', 'type', 'titre', 'description', 'details', 'date_action', 'lieu', 'echeance', 'delai', 'priorite', 'statut', 'responsable', 'livrable_url', 'dossier_url', 'cloture_le', 'photographe', 'autorisations', 'credit', 'rappel_envoye', 'selection_url'] },
  historique: { onglet: 'Historique', cols: ['id', 'demande_id', 'date', 'auteur', 'auteur_nom', 'type', 'message', 'interne'] },
  calendrier: { onglet: 'Calendrier', cols: ['id', 'date', 'date_fin', 'categorie', 'titre', 'ul', 'canal', 'responsable', 'statut', 'notes'] },
  // Espaces de projet (3.26) : liens (JSON [{t, id}]) vers des éléments existants ; aucun fichier copié
  // Diffusion interne (3.28) : cible (JSON des groupes), destinataires (JSON des adresses, fixé à l'envoi)
  diffusions: { onglet: 'Diffusions', cols: ['id', 'titre', 'message', 'statut', 'cible', 'email', 'programmee_le', 'envoyee_le', 'nb', 'nb_emails', 'destinataires', 'cree_par', 'cree_le', 'maj_le', 'maj_par'] },
  projets: { onglet: 'Projets', cols: ['id', 'titre', 'description', 'statut', 'responsable', 'echeance', 'ul', 'liens', 'cree_par', 'cree_le', 'maj_le', 'maj_par'] },
  presse: { onglet: 'Presse', cols: ['id', 'recue_le', 'media', 'journaliste', 'contact', 'sujet', 'ul', 'responsable', 'statut', 'echeance', 'reponse', 'retombee_date', 'retombee_url', 'notes', 'maj_le'] },
  // actif : OUI | NON (accès désactivé, réversible) | REVOQUE (accès révoqué)
  utilisateurs: { onglet: 'Utilisateurs', cols: ['email', 'nom', 'role', 'ul', 'actif', 'token', 'cree_le', 'derniere_visite', 'prenom', 'nom_famille', 'fonction', 'telephone', 'cgu_le', 'origine', 'modifie_le', 'motif', 'sessions_avant', 'preferences', 'derniere_activite'] },
  types: { onglet: 'Types de demande', cols: ['code', 'libelle', 'description', 'delai', 'champs', 'obligatoires', 'pole', 'ordre', 'actif'] },
  ul: { onglet: 'Unités locales', cols: ['nom', 'actif'] },
  // type : lien | fichier ; id : identifiant interne stable ; fichier_id : identifiant Drive, écrit uniquement par le serveur
  ressources: { onglet: 'Ressources', cols: ['rubrique', 'titre', 'description', 'url', 'ordre', 'statut', 'version', 'important', 'id', 'type', 'type_lien', 'permission', 'etat', 'fichier_id', 'fichier_nom', 'fichier_mime', 'fichier_taille', 'dossier', 'origine', 'auteur', 'cree_le', 'maj_le'] },
  // FAQ / aide : etat publiee | brouillon (désactivée) | archivee ; lien_vue : page de l'application proposée avec la réponse
  faq: { onglet: 'FAQ', cols: ['id', 'categorie', 'question', 'reponse', 'mots_cles', 'ordre', 'etat', 'lien_vue', 'auteur', 'maj_le'] },
  // Photothèque : statut a_valider | publiee | restreinte | archivee | corbeille ; dossier : clé du dossier Drive du fichier
  phototheque: { onglet: 'Photothèque', cols: ['id', 'fichier_id', 'dossier', 'nom_original', 'mime', 'taille', 'largeur', 'hauteur', 'empreinte', 'titre', 'description', 'date_prise', 'photographe', 'credit', 'evenement', 'lieu', 'ul', 'categorie', 'tags', 'campagne', 'type_contenu', 'utilisation', 'droits', 'droits_note', 'note_interne', 'statut', 'statut_avant', 'evenement_cal', 'demande_id', 'exif', 'lot', 'importe_par', 'importe_le', 'maj_par', 'maj_le', 'genre', 'duree'] },
  photo_vignettes: { onglet: 'Vignettes photos', cols: ['id', 'mini'] },
  albums: { onglet: 'Albums photos', cols: ['id', 'titre', 'description', 'type', 'ul', 'evenement_cal', 'demande_id', 'couverture', 'photos', 'cree_par', 'cree_le', 'maj_le', 'etat'] },
  photo_favoris: { onglet: 'Favoris photos', cols: ['email', 'photo_id', 'le'] },
  photos: { onglet: 'Photos de profil', cols: ['email', 'fichier_id', 'mini', 'maj_le'] },
  // Matériel : etat disponible | indisponible | maintenance (« réservé » est calculé) ; actif OUI | NON ; archive OUI | '' ;
  // validation '' (réglage général) | auto | admin ; responsable : e-mail d'un utilisateur
  materiel: { onglet: 'Matériel', cols: ['id', 'nom', 'categorie', 'description', 'reference', 'localisation', 'responsable', 'etat', 'conditions', 'maintenance', 'maintenance_date', 'actif', 'archive', 'validation', 'ordre', 'cree_le', 'cree_par', 'maj_le', 'maj_par'] },
  materiel_photos: { onglet: 'Photos du matériel', cols: ['id', 'mini'] },
  // Galerie (3.30) : nombre libre de photos par matériel ; ordre 0 = photo principale ; p1…p4 = grande image découpée (limite d'une cellule)
  materiel_galerie: { onglet: 'Galerie du matériel', cols: ['pid', 'materiel_id', 'ordre', 'mini', 'p1', 'p2', 'p3', 'p4', 'largeur', 'hauteur', 'ajoute_le', 'ajoute_par'] },
  // Réservations : statut attente | confirmee | refusee | annulee (« terminée » = confirmée dont la fin est passée) ;
  // debut / fin : AAAA-MM-JJTHH:MM (heure de Paris), fin exclue ; journee OUI = journée(s) entière(s) ; suivi : une ligne par action
  reservations: { onglet: 'Réservations', cols: ['id', 'materiel_id', 'email', 'nom', 'debut', 'fin', 'journee', 'lieu', 'commentaire', 'statut', 'cree_le', 'maj_le', 'decide_par', 'motif', 'suivi'] },
  configuration: { onglet: 'Configuration', cols: ['cle', 'valeur'] },
  journal: { onglet: 'Journal', cols: ['date', 'email', 'evenement', 'detail'] },
  // Fichiers joints (3.16) : un registre commun pour tous les fichiers ajoutés à côté d'un lien (demandes, presse) ; fichier dans le Drive partagé
  pieces: { onglet: 'Pièces jointes', cols: ['id', 'contexte', 'ref', 'usage', 'fichier_id', 'nom', 'mime', 'taille', 'par', 'le', 'etat'] },
  // Notifications dans l'application (3.14) : une ligne par destinataire ; cle regroupe les notifications d'un même sujet (pas de répétition)
  notifications: { onglet: 'Notifications', cols: ['id', 'email', 'date', 'type', 'titre', 'texte', 'lien', 'cle', 'lu', 'perm'] },
};

// Rôles DYNAMIQUES (3.19) : créés, renommés, désactivés ou supprimés dans Administration > Rôles et permissions, sans toucher au code.
// Chaque rôle a un identifiant interne unique et STABLE (jamais modifié par un renommage), un nom affiché unique, une description,
// un état (actif / désactivé) et ses permissions. Seul « admin » est fixe : toujours présent, actif, avec toutes les permissions.
const ROLE_ADMIN = 'admin';
const ROLE_ID_RE = /^[a-z][a-z0-9_]{1,30}$/;
// Repères pour distinguer d'anciens rôles qui porteraient le même nom (ex. trois rôles renommés « Bénévole »)
const ROLES_REPERES = { communication: 'équipe communication', rlcom: 'référent UL', demandeur: 'demandeur', consultation: 'consultation', nouveau: 'nouveau membre' };
let _ROLES_DISTINGUES = [];
const cleNom_ = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const libRole_ = (c, r) => ((c.roles || {})[r] || {}).label || String(r || '');
function rolesCodes_(c) { return Object.keys((c || config_()).roles); }
function roleActif_(c, r) { return !!c.roles[r] && (r === ROLE_ADMIN || c.roles[r].actif !== false); }
// Rôle donné à l'inscription : toujours un rôle existant, actif et différent d'Administrateur
function roleInscription_(c) {
  const S = c.securite || {}, ok = r => r && r !== ROLE_ADMIN && roleActif_(c, r) && ((c.roles[r] || {}).permissions || []).indexOf('admin') === -1;
  if (ok(S.role_defaut)) return S.role_defaut;
  if (ok('demandeur')) return 'demandeur';
  return rolesCodes_(c).find(ok) || '';
}
// Rôle gardé par un administrateur qui renonce à l'administration : « communication » s'il est actif, sinon le rôle actif le plus complet
function roleRepli_(c) {
  if (roleActif_(c, 'communication')) return 'communication';
  return rolesCodes_(c).filter(r => r !== ROLE_ADMIN && roleActif_(c, r)).sort((a, b) => c.roles[b].permissions.length - c.roles[a].permissions.length)[0] || roleInscription_(c);
}
// Forme toujours valide des rôles (lecture) : champs complets, admin présent, noms uniques (les doublons hérités sont distingués et signalés)
function normaliserRoles_(roles) {
  const src = roles && typeof roles === 'object' && !Array.isArray(roles) ? roles : {}, out = {}, vus = {};
  _ROLES_DISTINGUES = [];
  const ids = Object.keys(src).filter(id => ROLE_ID_RE.test(id) && src[id] && typeof src[id] === 'object');
  if (ids.indexOf(ROLE_ADMIN) < 0) ids.unshift(ROLE_ADMIN);
  ids.forEach(id => {
    const x = src[id] || {}, d = CONFIG_DEFAUT.roles[id] || {};
    out[id] = { label: String(x.label || d.label || id).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 50) || id, description: String(x.description == null ? (d.description || '') : x.description).replace(/[<>]/g, '').slice(0, 200),
      actif: id === ROLE_ADMIN ? true : !(x.actif === false || x.actif === 'false' || x.actif === 'NON'),
      permissions: id === ROLE_ADMIN ? PERM_CODES.slice() : (Array.isArray(x.permissions) ? x.permissions : []).filter((p, i, t) => PERM_CODES.indexOf(p) > -1 && p !== 'admin' && t.indexOf(p) === i) };
  });
  Object.keys(out).forEach(id => {
    let n = out[id].label, k = cleNom_(n);
    if (vus[k]) {
      const base = n + ' (' + (ROLES_REPERES[id] || id) + ')'; n = base; let i = 2;
      while (Object.keys(out).some(j => j !== id && cleNom_(out[j].label) === cleNom_(n))) n = base + ' ' + (i++);
      // le premier rôle portant ce nom est aussi précisé, pour que les deux soient reconnaissables
      const premier = vus[k]; if (!_ROLES_DISTINGUES.some(x => x.id === premier)) { const n1 = out[premier].label + ' (' + (ROLES_REPERES[premier] || premier) + ')'; if (!Object.keys(out).some(j => cleNom_(out[j].label) === cleNom_(n1))) { _ROLES_DISTINGUES.push({ id: premier, avant: out[premier].label }); out[premier].label = n1; } }
      _ROLES_DISTINGUES.push({ id: id, avant: out[id].label }); out[id].label = n; k = cleNom_(n);
    }
    vus[k] = id;
  });
  return out;
}
// Les rôles enregistrés remplacent entièrement ceux par défaut (un rôle supprimé ne revient jamais tout seul)
function avecRoles_(stocke) {
  const r = stocke && stocke.roles && typeof stocke.roles === 'object' && Object.keys(stocke.roles).length ? stocke.roles : CONFIG_DEFAUT.roles;
  return JSON.parse(JSON.stringify(r));
}
const ALIAS_ROLES = { equipe: 'communication', referent: 'rlcom' };   // compatibilité version 2
const PERMISSIONS = [
  ['demande_creer', 'Déposer une demande'],
  ['demande_voir_ul', 'Voir les demandes de son UL'],
  ['demande_voir_toutes', 'Voir toutes les demandes'],
  ['demande_traiter', 'Traiter les demandes (statut, attribution, livrable)'],
  ['notes_internes', 'Lire et écrire les notes internes'],
  ['calendrier_voir', 'Voir le calendrier'],
  ['calendrier_modifier', 'Modifier le calendrier'],
  ['image_voir', 'Voir le pôle image'],
  ['image_gerer', 'Gérer le pôle image'],
  ['presse', 'Suivi des sollicitations presse'],
  ['activite', 'Voir l\'activité'],
  ['ressources_voir', 'Voir les ressources'],
  ['ressources_gerer', 'Gérer les ressources (liens, informations, ordre)'],
  ['ressources_importer', 'Importer et remplacer des fichiers de ressources'],
  ['ressources_supprimer', 'Supprimer des ressources'],
  ['faq_gerer', 'Gérer la FAQ (questions, réponses, ordre, publication)'],
  ['phototheque_voir', 'Photothèque : voir les photos et les albums'],
  ['phototheque_importer', 'Photothèque : importer des photos (à valider si pas de droit de modification)'],
  ['phototheque_modifier', 'Photothèque : modifier, valider les photos et gérer les albums'],
  ['phototheque_telecharger', 'Photothèque : télécharger les originaux et les albums'],
  ['phototheque_archiver', 'Photothèque : archiver et désarchiver'],
  ['phototheque_supprimer', 'Photothèque : corbeille, restauration et suppression définitive'],
  ['phototheque_siege', 'Photothèque : lien vers la banque d\'images du siège'],
  ['materiel_voir', 'Matériel : voir le catalogue, les disponibilités et le planning'],
  ['materiel_reserver', 'Matériel : réserver (et annuler ses réservations)'],
  ['materiel_gerer', 'Matériel : gérer le catalogue (créer, modifier, désactiver, archiver)'],
  ['reservations_gerer', 'Matériel : gérer toutes les réservations (valider, refuser, modifier, annuler)'],
  ['projets_voir', 'Projets : voir les espaces de projet (chaque élément reste soumis à ses propres droits)'],
  ['projets_gerer', 'Projets : créer, modifier les projets et y relier des éléments'],
  ['diffusion_envoyer', 'Diffusion interne : écrire, programmer et envoyer des messages aux utilisateurs du Centre Com'],
  ['admin', 'Administration'],
];
const PERM_CODES = PERMISSIONS.map(p => p[0]);

// Statuts : chaque statut configurable appartient à une CLASSE qui décide des automatismes
const CLASSES_STATUT = ['nouvelle', 'en_cours', 'attente', 'a_valider', 'terminee', 'annulee', 'archivee'];
const CLASSES_OBLIGATOIRES = ['nouvelle', 'en_cours', 'attente', 'a_valider', 'terminee', 'annulee'];
const CLASSES_FERMEES = ['terminee', 'annulee', 'archivee'];
const MODELE_PAR_CLASSE = { en_cours: 'prise_en_charge', attente: 'attente', a_valider: 'a_valider', terminee: 'terminee', annulee: 'annulee' };

const PRIORITES_CODES = ['urgente', 'courte', 'normale'];
const POLES_CODES = ['numerique', 'graphique', 'image', 'presse', 'conseil'];
const NAV_CLES = ['accueil', 'demandes', 'projets', 'diffusions', 'calendrier', 'phototheque', 'materiel', 'image', 'presse', 'activite', 'ressources', 'favoris', 'aide'];
const TONS = ['jaune', 'bleu', 'violet', 'orange', 'vert', 'gris', 'rouge'];
const TYPES_CHAMP = ['text', 'textarea', 'date', 'select', 'chips', 'files', 'consent'];
const ICONES = ['home', 'inbox', 'calendar', 'camera', 'megaphone', 'chart', 'folder', 'star', 'book', 'flag', 'users', 'image', 'file', 'mail', 'poster', 'share', 'help', 'pin', 'video', 'message', 'user', 'alert', 'search', 'settings', 'lock', 'shield', 'list', 'palette', 'box'];

// Arborescence du Drive partagé : [clé, nom par défaut, dossier parent, description par défaut, permission nécessaire par défaut]
// Noms, descriptions, état (actif) et permissions sont réglables : Administration > Drive partagé (config.drive_dossiers).
// La permission d'un dossier s'ajoute à celle de chaque ressource : pour voir un fichier rangé dans ce dossier, il faut les deux.
const DOSSIERS = [
  ['racine', 'Centre Com', '', 'Dossier principal du Centre Com dans le Drive partagé.', 'admin'],
  ['application', '01 - Application', 'racine', 'Base de données et fichiers techniques de l\'application.', 'admin'],
  ['fichiers_demandes', 'Fichiers des demandes', 'application', 'Fichiers joints aux demandes et livrables.', 'demande_traiter'],
  ['profils', 'Photos de profil', 'application', 'Photos de profil, servies par l\'application.', 'connecte'],
  ['ressources', '02 - Ressources communication', 'racine', 'Fichiers importés dans la page Ressources.', 'ressources_voir'],
  ['image', '03 - Pôle image', 'racine', 'Photothèque et sélections d\'images.', 'image_voir'],
  ['phototheque', '01 - Photothèque', 'image', 'Photos de la photothèque du Centre Com (originaux rangés par année). Affichées aux utilisateurs par l\'application.', 'phototheque_voir'],
  ['phototheque_archives', '02 - Archives photos', 'image', 'Photos archivées de la photothèque.', 'phototheque_archiver'],
  ['documents', '04 - Documents', 'racine', 'Documents de référence.', 'ressources_voir'],
  ['modeles', '05 - Modèles', 'racine', 'Modèles de documents et de visuels.', 'ressources_voir'],
  ['campagnes', '06 - Campagnes', 'racine', 'Campagnes locales et nationales.', 'ressources_voir'],
  ['presse', '07 - Presse', 'racine', 'Communiqués, dossiers et revues de presse.', 'ressources_voir'],
  ['configurations', '08 - Configurations', 'racine', 'Exports de la configuration.', 'admin'],
  ['sauvegardes', 'Sauvegardes', 'configurations', 'Versions automatiques de la configuration et copies de la base.', 'admin'],
  ['archives', '09 - Archives', 'racine', 'Ressources archivées.', 'ressources_gerer'],
];
const DOSSIERS_ECRITURE = ['fichiers_demandes', 'ressources', 'sauvegardes', 'configurations', 'profils', 'phototheque', 'phototheque_archives'];
const DOSSIERS_PHOTOTHEQUE = ['phototheque', 'phototheque_archives'];   // réservés à la photothèque (jamais proposés pour importer une ressource)
const DOSSIERS_INDISPENSABLES = ['fichiers_demandes', 'sauvegardes'];

// =====================================================================
// 2. VALEURS PAR DÉFAUT GÉNÉRIQUES (remplacées par la configuration)
// =====================================================================
const COULEURS_CLAIR = {
  principale: '#e30613', secondaire: '#1a1a1a', accent: '#44bced', fond: '#f6f5f3', carte: '#ffffff', texte: '#2b2b2b', texte_secondaire: '#5f5f5f',
  titres: '#1a1a1a', bouton: '#e30613', bouton_texte: '#ffffff', lien: '#e30613', bordure: '#e6e4e0', succes: '#1f8a4c', avertissement: '#c26a00',
  info: '#0b5f8a', urgence: '#e30613', actif: '#e30613',
};
const COULEURS_SOMBRE = {
  principale: '#ff3b47', secondaire: '#f2f2f2', accent: '#5cc8f2', fond: '#141416', carte: '#1f1f23', texte: '#e7e7ea', texte_secondaire: '#a4a4ab',
  titres: '#ffffff', bouton: '#e30613', bouton_texte: '#ffffff', lien: '#ff6b73', bordure: '#34343a', succes: '#4cc17e', avertissement: '#f0a53a',
  info: '#5cc8f2', urgence: '#ff3b47', actif: '#ff3b47',
};

const CONFIG_DEFAUT = {
  meta: { version_schema: VERSION_SCHEMA, numero: 0, modifie_le: '', modifie_par: '', commentaire: '' },
  identite: {
    code: 'DTXX', nom_centre: 'Centre Com', nom_structure: 'Croix-Rouge française – Délégation territoriale',
    nom_organisation: 'Croix-Rouge française', territoire: '',
    description: 'L\'espace de la communication départementale : demandes, calendrier, ressources.',
    message_connexion: 'Espace interne de communication',
    public_autorise: 'Accès réservé aux utilisateurs autorisés.',
    logo_url: '', logo_fichier: '', logo_secondaire_url: '', favicon_url: '', image_accueil_url: '', image_connexion_url: '',
  },
  apparence: {
    // Logo (3.19) : position (menu, haut à gauche / au centre / à droite), hauteur et marge en pixels
    logo: { position: 'menu', taille: 40, marge: 12 },
    theme: 'clair',                              // clair | sombre | auto (suit l'appareil)
    couleurs: COULEURS_CLAIR,                    // charte graphique CRF 2023
    couleurs_sombre: COULEURS_SOMBRE,
    typo: { police_principale: 'Poppins', police_titres: 'Poppins', police_secondaire: 'Poppins', police_url: '', taille_base: 14, graisse_texte: 400, graisse_titres: 600, interligne: 1.5, espacement_lettres: 0, casse_titres: 'normale' },
    composants: { rayon_cartes: 12, rayon_boutons: 9, epaisseur_bordure: 1, ombre: 'legere', densite: 'normale', style_navigation: 'clair' },
  },
  animations: { niveau: 'standard', duree_ms: 200, logo_anime: true, chargement: 'spinner' },
  navigation: [
    { cle: 'accueil', libelle: 'Accueil', visible: true, icone: 'home' },
    { cle: 'demandes', libelle: 'Demandes', visible: true, icone: 'inbox' },
    { cle: 'projets', libelle: 'Projets', visible: true, icone: 'flag' },
    { cle: 'diffusions', libelle: 'Diffusion interne', visible: true, icone: 'megaphone' },
    { cle: 'calendrier', libelle: 'Calendrier', visible: true, icone: 'calendar' },
    { cle: 'phototheque', libelle: 'Photothèque', visible: true, icone: 'image' },
    { cle: 'materiel', libelle: 'Matériel', visible: true, icone: 'box' },
    { cle: 'image', libelle: 'Pôle image', visible: true, icone: 'camera' },
    { cle: 'ressources', libelle: 'Ressources', visible: true, icone: 'folder' },
    { cle: 'activite', libelle: 'Activité', visible: true, icone: 'chart' },
    { cle: 'presse', libelle: 'Sollicitations presse', visible: false, icone: 'megaphone' },
    { cle: 'favoris', libelle: 'Mes favoris', visible: true, icone: 'star' },
    { cle: 'aide', libelle: 'Aide', visible: true, icone: 'help' },
  ],
  // Sessions : connexion obligatoire à chaque ouverture ; déconnexion automatique après inactivité (0 = désactivée)
  // mode : google (recommandé) | mixte (Google + lien de secours par e-mail) | lien
  // google_client_id : identifiant OAuth « Google Identity Services » pour les comptes Google hors du domaine Workspace (facultatif)
  // inscription : libre (tout compte Google vérifié peut créer son profil) | domaines (seulement les domaines listés) | liste (ajout par un administrateur)
  // role_defaut : rôle attribué automatiquement à l'inscription (jamais administrateur)
  securite: { mode: 'google', inscription: 'libre', domaines: '', role_defaut: 'demandeur', inactivite_min: 30, avertissement_s: 60, lien_validite_min: 15, duree_max_h: 12, google_client_id: '' },
  // Création de profil (Administration > Utilisateurs > Inscriptions)
  inscription: {
    fonctions: ['Bénévole', 'Référent communication (RLCOM)', 'Responsable d\'unité locale', 'Membre du bureau', 'Salarié(e)', 'Volontaire en service civique', 'Autre'],
    telephone: 'facultatif',      // masque | facultatif | obligatoire
    cgu_titre: 'Conditions d\'utilisation de l\'espace interne',
    cgu_texte: 'L\'Espace Com est un outil interne réservé aux bénévoles et salariés de la Croix-Rouge française.\nJe m\'engage à utiliser les informations et documents qui y figurent uniquement dans le cadre de mes missions, à ne pas les diffuser à l\'extérieur sans accord, et à respecter la charte graphique et les règles de droit à l\'image.\nLes informations de mon profil (nom, adresse e-mail, unité locale, fonction, téléphone) sont utilisées uniquement pour le fonctionnement de l\'espace et le suivi des demandes de communication.\nMon accès peut être modifié, suspendu ou retiré par l\'équipe de la délégation.',
  },
  // Photothèque (Administration > Photothèque) : listes proposées dans les fiches, limites, banque d'images du siège (lien externe)
  phototheque: {
    categories: ['Secourisme', 'Action sociale', 'Formation', 'Événements', 'Vie associative et bénévoles', 'Partenariats', 'Institutionnel', 'Jeunesse', 'Urgence et opérations'],
    types_contenu: ['Photo d\'action', 'Portrait', 'Photo de groupe', 'Lieu ou bâtiment', 'Véhicule ou matériel', 'Visuel ou illustration', 'Archive'],
    utilisations: ['Tous supports (interne et externe)', 'Réseaux sociaux et web', 'Usage interne uniquement', 'Ne pas diffuser (archive)'],
    taille_max_mo: 50, export_max_mo: 25,
    notifier_validation: true, capacite_313: true,
    apercu_qualite: 'pleine',      // grande image des rôles sans téléchargement : « pleine » (résolution de la photo) ou « hd » (2400 px au plus)
    // Vidéos (3.21) : taille maximale d'une vidéo importée ; lecture : « telecharger » (rôles qui peuvent télécharger les originaux) ou « voir »
    video_max_mo: 500, lecture_video: 'telecharger',
    siege: { nom: 'Banque d\'images de la Croix-Rouge française', url: '', description: 'Service externe du siège : connexion avec vos propres identifiants. Le Centre Com n\'y a pas accès.' },
  },
  // Matériel et réservations (Administration > Matériel et réservations) ; le catalogue lui-même est dans l'onglet « Matériel »
  // validation : admin (une personne qui gère les réservations confirme) | auto (confirmation immédiate) ; réglable aussi par matériel
  // annulation : avant_debut (la personne annule tant que la réservation n'a pas commencé) | attente (seulement tant qu'elle n'est pas confirmée)
  materiel: {
    categories: ['Stands et signalétique', 'Audiovisuel', 'Informatique', 'Matériel d\'animation', 'Véhicules', 'Autre'],
    validation: 'admin', annulation: 'avant_debut', duree_max_jours: 14, anticipation_max_jours: 365,
    conditions: 'Le matériel est rendu propre, complet et à l\'heure prévue. Tout problème est signalé au responsable du matériel.',
    notifier: true, emails_gestion: '',
    rappels: true,   // veille de la réservation et jour du retour (3.26)
  },
  // Espaces de projet (3.26)
  projets: { actif: true },
  // Diffusion interne (3.28)
  diffusion: { actif: true },
  // Centre d'aide (Administration > Aide et FAQ) ; les questions elles-mêmes sont dans l'onglet FAQ (permission faq_gerer)
  aide: {
    categories: [
      { nom: 'Premiers pas', icone: 'star' }, { nom: 'Demandes de communication', icone: 'inbox' }, { nom: 'Ressources', icone: 'folder' },
      { nom: 'Photothèque', icone: 'camera' }, { nom: 'Matériel et réservations', icone: 'calendar' }, { nom: 'Communication et réseaux sociaux', icone: 'share' },
      { nom: 'Centre Com', icone: 'home' }, { nom: 'Profil', icone: 'user' }, { nom: 'Problèmes techniques', icone: 'alert' },
    ],
    signalement: true,     // formulaire « Écrire à l'équipe / signaler un problème »
    bienvenue: true,       // carte de bienvenue sur l'accueil des nouveaux utilisateurs
    introduction: 'Une question sur le Centre Com ou la communication de la délégation ? Cherchez ici avant de nous écrire.',
  },
  // Page de connexion (Administration > Identité et design > Page de connexion)
  connexion: {
    titre: '',                     // vide = « Espace Com » + code de la délégation (ex. Espace Com DT87)
    sous_titre: 'Centre de ressources et de coordination communication',
    message: 'Espace interne réservé aux bénévoles et salariés autorisés par la délégation.',
    aide: 'Un problème d\'accès ? Contactez l\'équipe communication de la délégation.',
    mise_en_page: 'scindee',       // scindee (panneau institutionnel + carte) | centree
    fond: 'couleur',               // couleur | degrade | image
    image_url: '', legende: '',
    afficher_points: true,
    points: ['Connexion avec votre compte Google, sans mot de passe à retenir', 'Profil personnel créé en une minute', 'Accès géré par la délégation', 'Documents conservés dans le Drive partagé de la délégation'],
  },
  roles: {
    admin: { label: 'Administrateur', description: 'Accès complet, y compris l\'administration. Toujours présent.', permissions: PERM_CODES.slice() },
    communication: { label: 'Communication', description: 'Équipe communication de la délégation.', permissions: ['demande_creer', 'demande_voir_ul', 'demande_voir_toutes', 'demande_traiter', 'notes_internes', 'calendrier_voir', 'calendrier_modifier', 'image_voir', 'image_gerer', 'presse', 'activite', 'ressources_voir', 'ressources_gerer', 'ressources_importer', 'ressources_supprimer', 'faq_gerer', 'phototheque_voir', 'phototheque_importer', 'phototheque_modifier', 'phototheque_telecharger', 'phototheque_archiver', 'phototheque_supprimer', 'phototheque_siege', 'materiel_voir', 'materiel_reserver', 'materiel_gerer', 'reservations_gerer', 'projets_voir', 'projets_gerer', 'diffusion_envoyer'] },
    rlcom: { label: 'RLCOM (référent communication UL)', description: 'Référent communication d\'une unité locale.', permissions: ['demande_creer', 'demande_voir_ul', 'calendrier_voir', 'ressources_voir', 'phototheque_voir', 'phototheque_importer', 'phototheque_telecharger', 'phototheque_siege', 'materiel_voir', 'materiel_reserver', 'projets_voir'] },
    demandeur: { label: 'Bénévole', description: 'Bénévole qui dépose des demandes à l\'équipe communication.', permissions: ['demande_creer', 'calendrier_voir', 'ressources_voir', 'phototheque_voir', 'phototheque_telecharger', 'phototheque_siege', 'materiel_voir', 'materiel_reserver'] },
    consultation: { label: 'Consultation', description: 'Lecture seule : demandes, calendrier, ressources.', permissions: ['demande_voir_toutes', 'calendrier_voir', 'image_voir', 'activite', 'ressources_voir', 'phototheque_voir', 'phototheque_telecharger', 'phototheque_siege', 'materiel_voir', 'projets_voir'] },
  },
  drive: { racine: '', application: '', fichiers_demandes: '', profils: '', ressources: '', image: '', documents: '', modeles: '', campagnes: '', presse: '', configurations: '', sauvegardes: '', archives: '', phototheque: '', phototheque_archives: '' },
  // Nom, description, actif, permission nécessaire de chaque dossier (Administration > Drive partagé)
  drive_dossiers: DOSSIERS.reduce((o, d) => { o[d[0]] = { nom: d[1], description: d[3], actif: true, permission: d[4] }; return o; }, {}),
  // Profils : ce que chacun peut modifier / ce que les autres voient (Administration > Profils et photos)
  profils: { photo: true, photo_max_ko: 400, visibles: { photo: true, ul: true, fonction: true, email: false, telephone: false } },
  textes: {
    accueil_titre: 'Besoin d\'un coup de main pour communiquer ?',
    accueil_texte: 'Une affiche, une publication, un photographe, un conseil : déposez votre demande en quelques minutes. Vous êtes prévenu(e) à chaque étape.',
    bouton_demande: 'Faire une demande',
    connexion_aide: 'Utilisez le compte autorisé par la délégation. En cas de difficulté, contactez l\'équipe communication.',
    refus_acces: 'Votre compte Google est correctement identifié, mais il ne dispose pas actuellement d\'un accès à {espace}.',
    session_expiree: 'Pour votre sécurité, vous devez vous reconnecter.',
    acces_desactive: 'Votre accès à {espace} a été désactivé. Pour toute question, contactez l\'équipe communication de la délégation.',
    acces_revoque: 'Votre accès à {espace} a été révoqué.',
    refus_aide: 'Si vous pensez que c\'est une erreur, contactez l\'équipe communication de la délégation en indiquant l\'adresse ci-dessus.',
    formulaire_aide: 'Vous hésitez ? Choisissez « Conseil ou accompagnement » : nous vous orienterons.',
    confirmation_texte: 'Vous allez recevoir un e-mail de confirmation. L\'équipe communication prend en charge votre demande et vous tient informé(e) à chaque étape.',
    droit_image_consentement: 'Les personnes reconnaissables sur les photos que je transmets ont donné leur accord, ou je ne transmets aucune photo de personnes.',
    droit_image_aide: 'Aucune photo d\'une personne accompagnée ne peut être diffusée sans son autorisation écrite. En cas de doute, ne transmettez pas la photo et demandez-nous.',
    regles_image: 'Avant la prise de vue. Toute personne reconnaissable signe une autorisation de droit à l\'image. Pour un mineur, ses représentants légaux.\nDignité. Jamais de photo qui expose la détresse ou l\'identité d\'une personne accompagnée. Dans le doute, on photographie les mains, l\'action, les bénévoles.\nNommage. AAAA-MM-JJ_UL_Sujet_NN.jpg — ex. 2026-11-14_UL-Ville_Collecte_07.jpg\nLivraison. Une sélection des meilleures images dans la photothèque, avec le crédit du photographe.',
    presse_bandeau: 'Suivi interne, volontairement léger. Les sujets sensibles sont remontés au siège avant toute réponse.',
    pied_page: '',
    // Information importante en tête de l'accueil (tous les rôles) ; annonce_fin : dernier jour d'affichage (AAAA-MM-JJ), vide = sans limite
    annonce: '', annonce_fin: '',
    contact: '',
  },
  demandes: {
    seuil_urgent: 3,
    telephone: 'facultatif',     // masque | facultatif | obligatoire
    urgence_declaree: true,      // le demandeur peut déclarer une urgence
    urgence_effet: 'courte',     // courte | urgente : priorité minimale d'une urgence déclarée
    charge_max: 0,               // 0 = désactivé ; sinon au-delà de N demandes ouvertes, les délais « justes » passent en délai court
    lien_drive: true,            // champ « lien vers vos documents » proposé
    statuts: [
      { code: 'nouvelle', label: 'Nouvelle', ton: 'jaune', classe: 'nouvelle', notifier: false },
      { code: 'a_analyser', label: 'À analyser', ton: 'jaune', classe: 'nouvelle', notifier: false },
      { code: 'en_cours', label: 'Prise en charge', ton: 'bleu', classe: 'en_cours', notifier: true },
      { code: 'attente', label: 'En attente d\'informations', ton: 'violet', classe: 'attente', notifier: true },
      { code: 'realisation', label: 'En cours de réalisation', ton: 'bleu', classe: 'en_cours', notifier: false },
      { code: 'a_valider', label: 'À valider', ton: 'orange', classe: 'a_valider', notifier: true },
      { code: 'terminee', label: 'Livrée', ton: 'vert', classe: 'terminee', notifier: true },
      { code: 'annulee', label: 'Réorientée', ton: 'gris', classe: 'annulee', notifier: true },
      { code: 'archivee', label: 'Archivée', ton: 'gris', classe: 'archivee', notifier: false },
    ],
    priorites: { urgente: 'Urgent', courte: 'Délai court', normale: 'Dans les délais' },
    poles: { numerique: 'Numérique', graphique: 'Graphisme', image: 'Pôle image', presse: 'Presse', conseil: 'Conseil' },
    champs: {
      objectif_com: { label: 'Objectif de la communication', type: 'textarea', aide: 'Ce que vous voulez obtenir : faire venir du public, recruter, remercier, informer…', options: [] },
      date_action: { label: 'Date de l\'action', type: 'date', aide: '', options: [] },
      lieu: { label: 'Lieu', type: 'text', aide: 'Adresse ou nom du lieu', options: [] },
      public: { label: 'Public visé', type: 'chips', aide: '', options: ['Grand public', 'Futurs bénévoles', 'Bénévoles', 'Personnes accompagnées', 'Partenaires et élus', 'Donateurs', 'Jeunes'] },
      infos: { label: 'Informations à faire figurer', type: 'textarea', aide: 'Horaires, adresse, contact, inscription… exactement comme ils doivent apparaître.', options: [] },
      texte: { label: 'Texte proposé', type: 'textarea', aide: 'Quelques lignes suffisent : nous les retravaillerons si besoin.', options: [] },
      canaux: { label: 'Où publier ?', type: 'chips', aide: '', options: ['Instagram', 'Facebook', 'LinkedIn', 'Story'] },
      formats: { label: 'Formats souhaités', type: 'chips', aide: '', options: ['Affiche A3', 'Affiche A4', 'Flyer A5', 'Post carré', 'Story', 'Bannière web'] },
      horaires: { label: 'Horaires de présence souhaités', type: 'text', aide: 'Ex. : 14 h – 16 h', options: [] },
      contact: { label: 'Contact sur place le jour J', type: 'text', aide: 'Nom et téléphone', options: [] },
      duree: { label: 'Durée souhaitée', type: 'select', aide: '', options: ['Courte (moins de 30 s : story, réel)', 'Moyenne (1 à 2 min)', 'Longue (à discuter)'] },
      usage: { label: 'Utilisation prévue', type: 'chips', aide: '', options: ['Réseaux sociaux', 'Presse', 'Rapport ou présentation', 'Photothèque', 'Site internet'] },
      medias: { label: 'Médias visés', type: 'text', aide: 'Ex. : presse locale, radio, télévision régionale', options: [] },
      objectif: { label: 'Sur quoi avez-vous besoin d\'aide ?', type: 'textarea', aide: '', options: [] },
      fichiers: { label: 'Vos fichiers (logos, photos, textes)', type: 'files', aide: '5 fichiers maximum, 10 Mo chacun.', options: [] },
      droit_image: { label: 'Droit à l\'image', type: 'consent', aide: '', options: [] },
    },
  },
  notifications: {
    emails_equipe: '', repondre_a: '', expediteur: '',
    signature: 'L\'équipe communication',
    inscriptions: true, emails_inscriptions: '',
    internes: true,   // notifications dans l'application (cloche), indépendantes des e-mails
    accuse: true, alerte_equipe: true, changement_statut: true, messages: true, attribution: true,
    mentions: true,   // e-mail aux personnes mentionnées dans un échange (3.26)
    rappels: true, rappel_jours: 2, point_hebdo: true, point_hebdo_jour: 1, heure_routine: 7,
    modeles: {
      accuse: { sujet: '[{numero}] Demande bien reçue', titre: 'Demande bien reçue', texte: 'Bonjour {prenom},\n\nVotre demande « {titre} » est bien enregistrée sous le numéro {numero}. Vous serez prévenu(e) par e-mail à chaque étape.' },
      tardive: { sujet: '', titre: '', texte: 'Votre demande arrive {delai} jour(s) avant l\'échéance, pour un délai conseillé de {delai_conseille} jours. Nous ferons au mieux, sans pouvoir le garantir.' },
      equipe_nouvelle: { sujet: '{priorite_icone} [{numero}] {ul} — {titre}', titre: 'Nouvelle demande', texte: '{demandeur} ({ul}) demande : {type}.' },
      attribution: { sujet: '[{numero}] Demande attribuée : {titre}', titre: 'Une demande vous est attribuée', texte: '{auteur} vous a attribué la demande {numero} ({ul}).' },
      prise_en_charge: { sujet: '[{numero}] {statut}', titre: 'Demande prise en charge', texte: 'Bonjour {prenom},\n\n{responsable} s\'occupe de votre demande « {titre} ». Statut : {statut}.' },
      attente: { sujet: '[{numero}] Une information nous manque', titre: 'Il nous manque une information', texte: 'Bonjour {prenom},\n\nPour avancer sur « {titre} », nous avons besoin d\'une précision. Répondez directement dans le Centre Com : c\'est plus rapide.' },
      a_valider: { sujet: '[{numero}] Proposition à valider', titre: 'Une proposition à valider', texte: 'Bonjour {prenom},\n\nVoici notre proposition pour « {titre} ». Merci de la valider ou de demander une modification dans le Centre Com.' },
      terminee: { sujet: '[{numero}] C\'est prêt', titre: 'Votre demande est prête', texte: 'Bonjour {prenom},\n\nVotre demande « {titre} » est terminée.\n\nAprès l\'action, envoyez-nous vos photos : elles servent à valoriser le travail de votre UL.' },
      annulee: { sujet: '[{numero}] Réponse de l\'équipe communication', titre: 'Réponse à votre demande', texte: 'Bonjour {prenom},\n\nNous ne pouvons pas traiter la demande « {titre} » telle quelle.' },
      message_equipe: { sujet: '[{numero}] Nouveau message', titre: 'Nouveau message', texte: 'Bonjour {prenom},\n\n{auteur} vous a écrit à propos de « {titre} ».' },
      message_demandeur: { sujet: '[{numero}] Réponse de {demandeur}', titre: 'Nouveau message du demandeur', texte: '{demandeur} a écrit sur la demande {numero}.' },
      validation: { sujet: '[{numero}] {decision}', titre: '{decision}', texte: '{demandeur} : {decision} pour « {titre} ».' },
      rappel: { sujet: '⏰ [{numero}] Échéance le {echeance}', titre: 'Échéance proche', texte: 'La demande « {titre} » ({ul}) est attendue le {echeance}. Statut actuel : {statut}.' },
      lien_acces: { sujet: 'Votre lien de connexion au {nom_centre}', titre: 'Votre lien de connexion', texte: 'Bonjour,\n\nVoici votre lien de connexion au {nom_centre}. Il est valable {validite} minutes et ne sert qu\'une seule fois.\n\nSi vous n\'êtes pas à l\'origine de cette demande, ignorez simplement cet e-mail.' },
      point_hebdo: { sujet: 'Point hebdo — {date}', titre: 'Point hebdo', texte: '' },
      presse_attribution: { sujet: 'Sollicitation presse : {media}', titre: 'Sollicitation presse à suivre', texte: '{auteur} vous confie une sollicitation presse.' },
      resa_nouvelle: { sujet: 'Réservation de matériel ({statut}) : {materiel}', titre: 'Nouvelle réservation de matériel', texte: '{demandeur} a réservé « {materiel} » {periode}.\nStatut : {statut}.' },
      resa_recue: { sujet: 'Réservation reçue : {materiel}', titre: 'Demande de réservation reçue', texte: 'Bonjour {prenom},\n\nVotre demande de réservation de « {materiel} » ({periode}) est enregistrée. Elle doit être validée : vous serez prévenu(e) par e-mail.' },
      resa_confirmee: { sujet: 'Réservation confirmée : {materiel}', titre: 'Réservation confirmée', texte: 'Bonjour {prenom},\n\nVotre réservation de « {materiel} » est confirmée : {periode}.' },
      resa_refusee: { sujet: 'Réservation refusée : {materiel}', titre: 'Réservation non acceptée', texte: 'Bonjour {prenom},\n\nVotre demande de réservation de « {materiel} » ({periode}) n\'a pas pu être acceptée.' },
      resa_annulee: { sujet: 'Réservation annulée : {materiel}', titre: 'Réservation annulée', texte: 'La réservation de « {materiel} » ({periode}) au nom de {demandeur} est annulée.' },
      resa_modifiee: { sujet: 'Réservation modifiée : {materiel}', titre: 'Réservation modifiée', texte: 'Bonjour {prenom},\n\nVotre réservation a été modifiée par {auteur} : « {materiel} », {periode}.' },
      diffusion: { sujet: '{titre}', titre: '{titre}', texte: 'Bonjour {prenom},\n\nMessage de {auteur} :' },
      mention: { sujet: '[{numero}] {auteur} vous mentionne', titre: 'Vous êtes mentionné', texte: 'Bonjour {prenom},\n\n{auteur} vous mentionne dans les échanges de la demande « {titre} ».' },
      rappel_validation: { sujet: '[{numero}] Proposition à valider', titre: 'Une proposition attend votre validation', texte: 'Bonjour {prenom},\n\nLa proposition pour « {titre} » attend toujours votre validation. Ouvrez-la, puis validez-la ou demandez une modification.' },
      resa_rappel: { sujet: 'Rappel : réservation demain — {materiel}', titre: 'Votre réservation commence demain', texte: 'Bonjour {prenom},\n\nRappel : vous avez réservé « {materiel} » {periode}.' },
      resa_retour: { sujet: 'Retour du matériel aujourd\'hui — {materiel}', titre: 'Matériel à rendre aujourd\'hui', texte: 'Bonjour {prenom},\n\nLa réservation de « {materiel} » ({periode}) se termine aujourd\'hui : pensez à le rendre propre et complet.' },
      inscription: { sujet: 'Nouveau profil : {prenom_nom} ({ul})', titre: 'Nouveau profil créé', texte: '{prenom_nom} vient de créer son profil sur {nom_centre}. Son accès est ouvert avec le rôle « {role} ». Aucune action n\'est nécessaire ; vous pouvez modifier son rôle ou son accès depuis sa fiche.' },
    },
  },
  calendrier: {
    categories: [
      { nom: 'Campagne nationale', couleur: '#e30613' }, { nom: 'Campagne locale', couleur: '#b8050f' }, { nom: 'Journée thématique', couleur: '#c9a800' },
      { nom: 'Action UL', couleur: '#44bced' }, { nom: 'Événement', couleur: '#0b5f8a' }, { nom: 'Publication', couleur: '#3aa9ad' }, { nom: 'Formation', couleur: '#8f73b8' },
      { nom: 'Échéance', couleur: '#f08a00' }, { nom: 'Institutionnel', couleur: '#6b6b6b' }, { nom: 'Vie bénévole', couleur: '#34a853' },
    ],
    statuts: ['Idée', 'Prévu', 'En préparation', 'Réalisé', 'Annulé'],
    categorie_demandes: 'Action UL',
    recurrents: [
      { titre: 'Journée mondiale de la santé mentale', categorie: 'Journée thématique', regle: 'date', mois: 10, jour: 10 },
      { titre: 'Journée internationale de la réduction des risques de catastrophes', categorie: 'Journée thématique', regle: 'date', mois: 10, jour: 13 },
      { titre: 'Journée mondiale de l\'alimentation', categorie: 'Journée thématique', regle: 'date', mois: 10, jour: 16 },
      { titre: 'Journée mondiale du refus de la misère', categorie: 'Journée thématique', regle: 'date', mois: 10, jour: 17 },
      { titre: 'Journée internationale des droits de l\'enfant', categorie: 'Journée thématique', regle: 'date', mois: 11, jour: 20 },
      { titre: 'Journée internationale pour l\'élimination de la violence à l\'égard des femmes', categorie: 'Journée thématique', regle: 'date', mois: 11, jour: 25 },
      { titre: 'Journée mondiale de lutte contre le sida', categorie: 'Journée thématique', regle: 'date', mois: 12, jour: 1 },
      { titre: 'Journée internationale des personnes handicapées', categorie: 'Journée thématique', regle: 'date', mois: 12, jour: 3 },
      { titre: 'Journée internationale des bénévoles', categorie: 'Journée thématique', regle: 'date', mois: 12, jour: 5 },
      { titre: 'Journée internationale des migrants', categorie: 'Journée thématique', regle: 'date', mois: 12, jour: 18 },
      { titre: 'Journée internationale des droits des femmes', categorie: 'Journée thématique', regle: 'date', mois: 3, jour: 8 },
      { titre: 'Journée mondiale de la santé', categorie: 'Journée thématique', regle: 'date', mois: 4, jour: 7 },
      { titre: 'Journée mondiale de la Croix-Rouge et du Croissant-Rouge', categorie: 'Journée thématique', regle: 'date', mois: 5, jour: 8 },
      { titre: 'Journée mondiale des réfugiés', categorie: 'Journée thématique', regle: 'date', mois: 6, jour: 20 },
      { titre: 'Journée mondiale de l\'aide humanitaire', categorie: 'Journée thématique', regle: 'date', mois: 8, jour: 19 },
      { titre: 'Journée mondiale des premiers secours', categorie: 'Journée thématique', regle: 'nieme', mois: 9, rang: 2, jour_semaine: 6 },
      { titre: 'Journée internationale des personnes âgées', categorie: 'Journée thématique', regle: 'date', mois: 10, jour: 1 },
    ],
  },
  ressources: {
    // dossier : dossier du Drive partagé où sont rangés les fichiers importés dans cette catégorie
    categories: [
      { nom: 'Charte graphique', icone: 'star', dossier: 'ressources' }, { nom: 'Logos', icone: 'image', dossier: 'ressources' }, { nom: 'Modèles', icone: 'poster', dossier: 'modeles' }, { nom: 'Canva', icone: 'poster', dossier: 'modeles' },
      { nom: 'Procédures', icone: 'file', dossier: 'documents' }, { nom: 'Guides', icone: 'book', dossier: 'documents' }, { nom: 'Ressources siège', icone: 'flag', dossier: 'ressources' }, { nom: 'Documents', icone: 'file', dossier: 'documents' },
      { nom: 'Photographie', icone: 'camera', dossier: 'image' }, { nom: 'Vidéo', icone: 'video', dossier: 'image' }, { nom: 'Réseaux sociaux', icone: 'share', dossier: 'campagnes' }, { nom: 'Presse', icone: 'megaphone', dossier: 'presse' },
      { nom: 'Contacts', icone: 'users', dossier: 'ressources' }, { nom: 'Autres', icone: 'folder', dossier: 'ressources' },
    ],
    statuts: ['À jour', 'À mettre à jour', 'Obsolète'],
    types_lien: ['Document', 'Site internet', 'Dossier Drive', 'Modèle Canva', 'Vidéo', 'Formulaire', 'Autre'],
    extensions: 'pdf, doc, docx, xls, xlsx, ppt, pptx, odt, ods, odp, jpg, jpeg, png, webp, gif, zip, txt, csv, mp4, mp3',
    taille_max_mo: 20,             // import ET téléchargement par l'application (fichiers servis sans accès au Drive)
  },
  presse: {
    statuts: [{ nom: 'À traiter', ton: 'jaune', ouvert: true }, { nom: 'En cours', ton: 'bleu', ouvert: true }, { nom: 'Répondu', ton: 'vert', ouvert: false }, { nom: 'Clôturée', ton: 'gris', ouvert: false }],
    types_media: ['Presse écrite', 'Radio', 'Télévision', 'Web / en ligne'],
  },
  pole_image: {
    autorisations: [
      { nom: 'À vérifier', ton: 'jaune', a_regler: true }, { nom: 'Non nécessaires', ton: 'gris', a_regler: false },
      { nom: 'À recueillir sur place', ton: 'orange', a_regler: true }, { nom: 'Recueillies', ton: 'vert', a_regler: false },
    ],
    credit_modele: '© Prénom Nom / Croix-Rouge française',
  },
};

const TYPES_DEFAUT = [
  ['publication', 'Publication réseaux sociaux', 'Un post ou une story sur les comptes de la délégation.', 7, 'canaux,date_action,texte,fichiers,droit_image', '', 'numerique'],
  ['affiche', 'Affiche ou flyer', 'Un support imprimé ou numérique pour annoncer une action.', 21, 'objectif_com,date_action,lieu,public,infos,formats,fichiers,droit_image', 'date_action,infos', 'graphique'],
  ['evenement', 'Communication d\'un événement', 'Un plan complet : visuels, publications, photos.', 30, 'objectif_com,date_action,lieu,public,infos,fichiers', 'date_action,lieu', 'graphique'],
  ['campagne', 'Campagne', 'Une campagne sur plusieurs semaines (recrutement, collecte…).', 30, 'objectif_com,date_action,public,infos,fichiers', 'objectif_com', 'graphique'],
  ['valoriser', 'Valoriser une action réalisée', 'Faire connaître une action qui a déjà eu lieu.', 5, 'date_action,texte,fichiers,droit_image', '', 'numerique'],
  ['photo', 'Reportage photo', 'Un bénévole photographe sur votre action.', 14, 'date_action,lieu,horaires,contact,usage', 'date_action,lieu,contact', 'image'],
  ['video', 'Vidéo', 'Un tournage : story, réel, portrait, reportage.', 30, 'date_action,lieu,duree,usage,contact', 'date_action,lieu', 'image'],
  ['support', 'Support imprimé ou kakémono', 'Un support durable : kakémono, dépliant, carte de visite.', 30, 'objectif_com,public,infos,formats,fichiers', 'infos', 'graphique'],
  ['conseil', 'Conseil ou accompagnement', 'Une question, une relecture, un coup de main.', 7, 'objectif,fichiers', '', 'conseil'],
  ['autre', 'Autre besoin', 'Une demande qui n\'entre dans aucune case.', 7, 'objectif,date_action,fichiers', '', 'conseil'],
];

const RESSOURCES_DEFAUT = [
  ['Charte graphique', 'Charte graphique Croix-Rouge française', 'Couleurs, typographies, règles d\'usage du logo.'],
  ['Logos', 'Logos officiels', 'Logo national et logos des structures. Ne jamais les modifier.'],
  ['Canva', 'Modèles Canva', 'Affiches, posts et stories prêts à personnaliser.'],
  ['Modèles', 'Modèles de documents', 'Courriers, présentations, signatures e-mail.'],
  ['Photographie', 'Photothèque départementale', 'Images validées, classées par année et par action.'],
  ['Photographie', 'Autorisation de droit à l\'image', 'Formulaire à faire signer avant toute prise de vue.'],
  ['Guides', 'Kit communication des UL', 'Fiches pratiques d\'une page pour les référents.'],
  ['Presse', 'Procédure presse et porte-parole', 'Qui répond aux journalistes, validation, remontée au siège.'],
  ['Presse', 'Modèle de communiqué', 'Trame de communiqué de presse de la délégation.'],
  ['Ressources siège', 'Ressources nationales', 'Espace communication du siège.'],
  ['Contacts', 'Équipe communication', 'Qui fait quoi, comment nous joindre.'],
];

// =====================================================================
// 3. CONFIGURATION : lecture, migration, validation, enregistrement, versions
// =====================================================================
let _CFG = null;

function config_() {
  if (_CFG) return _CFG;
  let brut = null;
  try { brut = CacheService.getScriptCache().get('config'); } catch (e) { }
  if (!brut) {
    brut = DB.tout('configuration').filter(r => r.cle === 'config').map(r => r.valeur).join('');
    try { if (brut && brut.length < 90000) CacheService.getScriptCache().put('config', brut, 600); } catch (e) { }
  }
  let stocke = {};
  try { stocke = brut ? JSON.parse(brut) : {}; } catch (e) { console.error('Configuration illisible, valeurs par défaut utilisées.'); }
  const m = migrer_(stocke), roles = avecRoles_(m);
  _CFG = fusion_(CONFIG_DEFAUT, Object.assign({}, m, { roles: {} })); _CFG.roles = roles; normaliser_(_CFG);
  return _CFG;
}

// Fusion profonde : un réglage absent reprend sa valeur par défaut (résilience)
function fusion_(defaut, v) {
  if (Array.isArray(defaut)) return Array.isArray(v) ? v : JSON.parse(JSON.stringify(defaut));
  if (defaut && typeof defaut === 'object') {
    const o = {}, src = (v && typeof v === 'object' && !Array.isArray(v)) ? v : {};
    Object.keys(defaut).forEach(k => o[k] = fusion_(defaut[k], src[k]));
    Object.keys(src).forEach(k => { if (!(k in o)) o[k] = src[k]; });
    return o;
  }
  if (v === undefined || v === null) return defaut;
  if (typeof defaut === 'number') { const n = Number(v); return isNaN(n) ? defaut : n; }
  if (typeof defaut === 'boolean') return v === true || v === 'true' || v === 'OUI';
  return String(v);
}

// Reprise automatique d'une configuration de version 2
function migrer_(s) {
  const versionAvant = Number((s && s.meta && s.meta.version_schema) || 0);
  s = JSON.parse(JSON.stringify(s || {}));
  if (s.couleurs && !s.apparence) {
    s.apparence = { couleurs: { principale: s.couleurs.principale, bouton: s.couleurs.principale, lien: s.couleurs.principale, actif: s.couleurs.principale, urgence: s.couleurs.principale, accent: s.couleurs.accent, titres: s.couleurs.texte, fond: s.couleurs.fond } };
  }
  delete s.couleurs;
  const d = s.demandes || {};
  if (d.statuts && !Array.isArray(d.statuts)) {
    d.statuts = ['nouvelle', 'en_cours', 'attente', 'a_valider', 'terminee', 'annulee'].map(k => ({ code: k, label: (d.statuts[k] || {}).label || k, ton: (d.statuts[k] || {}).ton || 'gris', classe: k, notifier: k !== 'nouvelle' }))
      .concat([{ code: 'archivee', label: 'Archivée', ton: 'gris', classe: 'archivee', notifier: false }]);
  }
  if (s.navigation) s.navigation.forEach(n => { if (!n.icone) n.icone = (CONFIG_DEFAUT.navigation.find(x => x.cle === n.cle) || {}).icone || 'file'; });
  if (s.meta && Number(s.meta.version_schema) < VERSION_SCHEMA) s.meta.version_schema = VERSION_SCHEMA;
  // Ancien texte de refus → nouveau texte ; ancienne image de connexion → page de connexion
  try { if (s.textes && /n'est pas autorisé à accéder au Centre Com\.?$/.test(s.textes.refus_acces || '')) delete s.textes.refus_acces; } catch (e) { }
  try { if (s.identite && s.identite.image_connexion_url && !(s.connexion && s.connexion.image_url)) { s.connexion = Object.assign({}, s.connexion || {}, { image_url: s.identite.image_connexion_url, fond: 'image' }); } } catch (e) { }
  // Inscription : ancien réglage « ouverte » → inscription libre ; ancien rôle par défaut « demandeur » → « Nouveau membre »
  // (une seule fois, configurations antérieures au format 3) : liste blanche → inscription libre ; rôle « demandeur » → « Nouveau membre »
  try { if (s.securite && versionAvant < 3) { if (s.securite.inscription === 'ouverte' || s.securite.inscription === 'liste' || !s.securite.inscription) s.securite.inscription = 'libre'; if (!s.securite.role_defaut || s.securite.role_defaut === 'demandeur') s.securite.role_defaut = 'nouveau'; } } catch (e) { }
  // Version 3.4 (format 4) : les rôles qui géraient les ressources gardent tous leurs droits (import, suppression)
  try { if (versionAvant < 4 && s.roles) Object.keys(s.roles).forEach(r => { const p = s.roles[r] && s.roles[r].permissions; if (Array.isArray(p) && p.indexOf('ressources_gerer') > -1) ['ressources_importer', 'ressources_supprimer'].forEach(x => { if (p.indexOf(x) < 0) p.push(x); }); }); } catch (e) { }
  // Installations 3.x : le dossier « 07 - Sauvegardes » existant garde son nom affiché
  try { if (versionAvant >= 1 && versionAvant < 4 && s.drive && s.drive.sauvegardes) { s.drive_dossiers = s.drive_dossiers || {}; s.drive_dossiers.sauvegardes = Object.assign({ nom: '07 - Sauvegardes' }, s.drive_dossiers.sauvegardes || {}); } } catch (e) { }
  // Version 3.9 : la permission « Gérer la FAQ » est donnée une fois aux rôles qui gèrent les ressources
  // (repère : la section « aide » n'existait pas encore ; un retrait ultérieur par l'administrateur est respecté)
  try { if (!s.aide && s.roles) Object.keys(s.roles).forEach(r => { const p = s.roles[r] && s.roles[r].permissions; if (Array.isArray(p) && p.indexOf('ressources_gerer') > -1 && p.indexOf('faq_gerer') === -1) p.push('faq_gerer'); }); } catch (e) { }
  // Version 3.10 : photothèque — permissions données une fois selon le rôle (repère : la section « phototheque » n'existait pas)
  try {
    if (!s.phototheque && s.roles) {
      const tout = ['phototheque_voir', 'phototheque_importer', 'phototheque_modifier', 'phototheque_telecharger', 'phototheque_archiver', 'phototheque_supprimer', 'phototheque_siege'];
      const parRole = { communication: tout, consultation: ['phototheque_voir', 'phototheque_telecharger', 'phototheque_siege'], rlcom: ['phototheque_voir', 'phototheque_importer', 'phototheque_telecharger', 'phototheque_siege'], demandeur: ['phototheque_voir', 'phototheque_telecharger', 'phototheque_siege'] };
      Object.keys(parRole).forEach(r => { const p = s.roles[r] && s.roles[r].permissions; if (Array.isArray(p)) parRole[r].forEach(x => { if (p.indexOf(x) === -1) p.push(x); }); });
    }
    // Entrée de menu « Photothèque » placée avant « Pôle image » plutôt qu'en fin de menu
    if (Array.isArray(s.navigation) && !s.navigation.some(n => n && n.cle === 'phototheque')) { const i = s.navigation.findIndex(n => n && n.cle === 'image'); s.navigation.splice(i > -1 ? i : s.navigation.length, 0, { cle: 'phototheque', libelle: 'Photothèque', visible: true, icone: 'image' }); }
  } catch (e) { }
  // Version 3.12 : matériel et réservations — permissions données une fois selon le rôle (repère : la section « materiel » n'existait pas)
  try {
    if (!s.materiel && s.roles) {
      const parRole = { communication: ['materiel_voir', 'materiel_reserver', 'materiel_gerer', 'reservations_gerer'], rlcom: ['materiel_voir', 'materiel_reserver'], demandeur: ['materiel_voir', 'materiel_reserver'], consultation: ['materiel_voir'] };
      Object.keys(parRole).forEach(r => { const p = s.roles[r] && s.roles[r].permissions; if (Array.isArray(p)) parRole[r].forEach(x => { if (p.indexOf(x) === -1) p.push(x); }); });
    }
    if (Array.isArray(s.navigation) && !s.navigation.some(n => n && n.cle === 'favoris')) { const i = s.navigation.findIndex(n => n && n.cle === 'aide'); s.navigation.splice(i > -1 ? i : s.navigation.length, 0, { cle: 'favoris', libelle: 'Mes favoris', visible: true, icone: 'star' }); }
    if (Array.isArray(s.navigation) && !s.navigation.some(n => n && n.cle === 'materiel')) { const i = s.navigation.findIndex(n => n && n.cle === 'image'); s.navigation.splice(i > -1 ? i : s.navigation.length, 0, { cle: 'materiel', libelle: 'Matériel', visible: true, icone: 'box' }); }
  } catch (e) { }
  // Version 3.26 : espaces de projet — permissions données une fois selon le rôle (repère : la section « projets » n'existait pas)
  try {
    if (!s.projets && s.roles) {
      const parRole = { communication: ['projets_voir', 'projets_gerer'], rlcom: ['projets_voir'], consultation: ['projets_voir'] };
      Object.keys(parRole).forEach(r => { const p = s.roles[r] && s.roles[r].permissions; if (Array.isArray(p)) parRole[r].forEach(x => { if (p.indexOf(x) === -1) p.push(x); }); });
      Object.keys(s.roles).forEach(r => { const p = s.roles[r] && s.roles[r].permissions; if (Array.isArray(p) && p.indexOf('demande_traiter') > -1) ['projets_voir', 'projets_gerer'].forEach(x => { if (p.indexOf(x) === -1) p.push(x); }); });
    }
    if (Array.isArray(s.navigation) && !s.navigation.some(n => n && n.cle === 'projets')) { const i = s.navigation.findIndex(n => n && n.cle === 'demandes'); s.navigation.splice(i > -1 ? i + 1 : s.navigation.length, 0, { cle: 'projets', libelle: 'Projets', visible: true, icone: 'flag' }); }
  } catch (e) { }
  // Version 3.28 : diffusion interne — permission donnée une fois aux rôles qui traitent les demandes ; menu après « Projets »
  try {
    if (!s.diffusion && s.roles) Object.keys(s.roles).forEach(r => { const p = s.roles[r] && s.roles[r].permissions; if (Array.isArray(p) && p.indexOf('demande_traiter') > -1 && p.indexOf('diffusion_envoyer') === -1) p.push('diffusion_envoyer'); });
    if (Array.isArray(s.navigation) && !s.navigation.some(n => n && n.cle === 'diffusions')) { const i = s.navigation.findIndex(n => n && n.cle === 'projets'); s.navigation.splice(i > -1 ? i + 1 : s.navigation.length, 0, { cle: 'diffusions', libelle: 'Diffusion interne', visible: true, icone: 'megaphone' }); }
  } catch (e) { }
  // Version 3.13 : import par morceaux — l'ancienne limite par défaut (20 Mo) passe à 50 Mo, une seule fois (une valeur choisie est gardée)
  try { if (s.phototheque && !s.phototheque.capacite_313) { if (Number(s.phototheque.taille_max_mo) === 20) s.phototheque.taille_max_mo = 50; s.phototheque.capacite_313 = true; } } catch (e) { }
  // Version 3.7 : le mode démo n'existe plus (l'ancien réglage « mode » est retiré)
  delete s.mode;
  // Le lien personnel permanent de la v2 est remplacé par un lien de connexion à usage unique
  try { const m = s.notifications.modeles.lien_acces; if (m && /favoris|il vous connecte directement/i.test(m.texte || '')) delete s.notifications.modeles.lien_acces; } catch (e) { }
  return s;
}

// Règles toujours vraies, quelle que soit la configuration
function normaliser_(c) {
  c.roles = normaliserRoles_(c.roles);
  c.securite.role_defaut = roleInscription_(c);
  c.navigation.forEach(n => { if (n.cle === 'accueil' || n.cle === 'demandes') n.visible = true; });
  return c;
}

function validerConfig_(entree) {
  const erreurs = [];
  const mig = migrer_(entree || {}), rolesBruts = avecRoles_(mig);
  const cfg = fusion_(CONFIG_DEFAUT, Object.assign({}, mig, { roles: {} })); cfg.roles = JSON.parse(JSON.stringify(rolesBruts)); normaliser_(cfg);
  const hex = v => /^#[0-9a-fA-F]{6}$/.test(v);
  const https = v => !v || /^https:\/\/[^\s<>"']+$/i.test(v);
  const mail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  // Identité
  if (!String(cfg.identite.nom_centre).trim()) erreurs.push('Le nom du centre est obligatoire.');
  if (!/^[A-Za-z0-9_-]{2,12}$/.test(cfg.identite.code)) erreurs.push('Le code de la délégation doit faire 2 à 12 caractères (lettres, chiffres), ex. DT87.');
  ['logo_url', 'logo_secondaire_url', 'favicon_url', 'image_accueil_url', 'image_connexion_url'].forEach(k => { if (!https(cfg.identite[k])) { erreurs.push('Lien invalide (' + k + ') : il doit commencer par https://'); cfg.identite[k] = ''; } });
  delete cfg.identite.logo_src;   // calculé à l'envoi, jamais enregistré
  Object.keys(cfg.identite).forEach(k => cfg.identite[k] = String(cfg.identite[k] || '').slice(0, 500));
  if (cfg.identite.logo_fichier && !/^[-\w]{10,}$/.test(cfg.identite.logo_fichier)) cfg.identite.logo_fichier = '';
  // Apparence
  const A = cfg.apparence;
  if (['clair', 'sombre', 'auto'].indexOf(A.theme) === -1) A.theme = 'clair';
  if (['menu', 'haut_gauche', 'haut_centre', 'haut_droite'].indexOf(A.logo.position) === -1) A.logo.position = 'menu';
  A.logo.taille = borne_(A.logo.taille, 20, 120); A.logo.marge = borne_(A.logo.marge, 0, 48);
  [['couleurs', COULEURS_CLAIR], ['couleurs_sombre', COULEURS_SOMBRE]].forEach(p => Object.keys(p[1]).forEach(k => { if (!hex(A[p[0]][k])) { erreurs.push('Couleur invalide « ' + k + ' » (' + (p[0] === 'couleurs' ? 'thème clair' : 'thème sombre') + ') : format #RRGGBB.'); A[p[0]][k] = p[1][k]; } }));
  const T = A.typo;
  ['police_principale', 'police_titres', 'police_secondaire'].forEach(k => { if (!/^[A-Za-z0-9 \-]{1,40}$/.test(T[k])) { erreurs.push('Nom de police invalide : « ' + T[k] + ' ».'); T[k] = 'Poppins'; } });
  if (T.police_url && !/^https:\/\/[^\s<>"']+$/i.test(T.police_url)) { erreurs.push('Le lien de police personnalisée doit commencer par https://'); T.police_url = ''; }
  T.taille_base = borne_(T.taille_base, 12, 18); T.graisse_texte = borne_(T.graisse_texte, 300, 600); T.graisse_titres = borne_(T.graisse_titres, 400, 800);
  T.interligne = Math.max(1.2, Math.min(1.9, Number(T.interligne) || 1.5)); T.espacement_lettres = Math.max(-0.5, Math.min(2, Number(T.espacement_lettres) || 0));
  if (['normale', 'majuscules'].indexOf(T.casse_titres) === -1) T.casse_titres = 'normale';
  const K = A.composants;
  K.rayon_cartes = borne_(K.rayon_cartes, 0, 28); K.rayon_boutons = borne_(K.rayon_boutons, 0, 28); K.epaisseur_bordure = borne_(K.epaisseur_bordure, 0, 3);
  if (['aucune', 'legere', 'moyenne', 'forte'].indexOf(K.ombre) === -1) K.ombre = 'legere';
  if (['compacte', 'normale', 'aeree'].indexOf(K.densite) === -1) K.densite = 'normale';
  if (['clair', 'couleur', 'sombre'].indexOf(K.style_navigation) === -1) K.style_navigation = 'clair';
  const N = cfg.animations;
  if (['aucune', 'minimale', 'standard', 'dynamique'].indexOf(N.niveau) === -1) N.niveau = 'standard';
  N.duree_ms = borne_(N.duree_ms, 0, 800);
  if (['spinner', 'barre'].indexOf(N.chargement) === -1) N.chargement = 'spinner';
  // Navigation
  const vues = {};
  cfg.navigation = (cfg.navigation || []).filter(n => n && NAV_CLES.indexOf(n.cle) > -1 && !vues[n.cle] && (vues[n.cle] = true))
    .map(n => ({ cle: n.cle, libelle: String(n.libelle || '').slice(0, 40) || n.cle, visible: n.cle === 'accueil' || n.cle === 'demandes' || (n.visible !== false && n.visible !== 'false'), icone: ICONES.indexOf(n.icone) > -1 ? n.icone : 'file' }));
  NAV_CLES.forEach(k => { if (!vues[k]) cfg.navigation.push(JSON.parse(JSON.stringify(CONFIG_DEFAUT.navigation.find(n => n.cle === k)))); });
  // Sécurité
  const S = cfg.securite;
  if (['google', 'lien', 'mixte'].indexOf(S.mode) === -1) S.mode = 'mixte';
  if (S.inscription === 'ouverte') S.inscription = 'libre';
  if (['libre', 'domaines', 'liste'].indexOf(S.inscription) === -1) S.inscription = 'libre';
  S.domaines = String(S.domaines || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase().replace(/^@/, '')).filter(Boolean).join(', ');
  if (S.inscription === 'domaines' && !S.domaines) erreurs.push('Indiquez au moins un domaine autorisé (ex. croix-rouge.fr), ou choisissez « Liste des utilisateurs uniquement ».');
  if (S.domaines.split(', ').some(d => d && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d))) erreurs.push('Domaine invalide dans la liste des domaines autorisés.');
  // Le rôle attribué à l'inscription ne peut JAMAIS être administrateur ni porter la permission d'administration (normaliser_ le garantit)
  if ((entree && entree.securite && entree.securite.role_defaut) && entree.securite.role_defaut !== S.role_defaut && (entree.securite.role_defaut === ROLE_ADMIN || !cfg.roles[entree.securite.role_defaut] || !roleActif_(cfg, entree.securite.role_defaut))) erreurs.push('Le rôle attribué à l\'inscription doit être un rôle actif, autre qu\'Administrateur.');
  if (!S.role_defaut) erreurs.push('Il faut au moins un rôle actif, autre qu\'Administrateur, pour les nouvelles inscriptions.');
  const IN = cfg.inscription;
  IN.fonctions = (Array.isArray(IN.fonctions) ? IN.fonctions : String(IN.fonctions || '').split('\n')).map(x => String(x).trim()).filter(Boolean).slice(0, 30).map(x => x.slice(0, 60));
  if (!IN.fonctions.length) IN.fonctions = CONFIG_DEFAUT.inscription.fonctions.slice();
  if (['masque', 'facultatif', 'obligatoire'].indexOf(IN.telephone) === -1) IN.telephone = 'facultatif';
  IN.cgu_titre = String(IN.cgu_titre || '').slice(0, 120); IN.cgu_texte = String(IN.cgu_texte || '').slice(0, 6000);
  if (!IN.cgu_texte.trim()) erreurs.push('Le texte des conditions d\'utilisation ne peut pas être vide.');
  S.inactivite_min = borne_(S.inactivite_min, 0, 480);
  S.avertissement_s = borne_(S.avertissement_s, 15, 300);
  if (S.inactivite_min > 0 && S.avertissement_s >= S.inactivite_min * 60) S.avertissement_s = Math.max(15, Math.floor(S.inactivite_min * 60 / 3));
  S.lien_validite_min = borne_(S.lien_validite_min, 5, 120);
  S.duree_max_h = borne_(S.duree_max_h, 1, 72);
  S.google_client_id = String(S.google_client_id || '').trim();
  if (S.google_client_id && !/^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(S.google_client_id)) { erreurs.push('Identifiant client Google invalide (forme attendue : 123456-abc….apps.googleusercontent.com).'); S.google_client_id = ''; }
  // Page de connexion
  const X = cfg.connexion;
  ['titre', 'sous_titre', 'message', 'aide', 'legende'].forEach(k => X[k] = String(X[k] || '').slice(0, 300));
  if (['scindee', 'centree'].indexOf(X.mise_en_page) === -1) X.mise_en_page = 'scindee';
  if (['couleur', 'degrade', 'image'].indexOf(X.fond) === -1) X.fond = 'couleur';
  if (!https(X.image_url)) { erreurs.push('Image de la page de connexion : le lien doit commencer par https://'); X.image_url = ''; }
  if (X.fond === 'image' && !X.image_url) X.fond = 'couleur';
  X.points = (Array.isArray(X.points) ? X.points : String(X.points || '').split('\n')).map(x => String(x).trim()).filter(Boolean).slice(0, 4).map(x => x.slice(0, 90));
  // Rôles
  // Rôles : identifiants valides et uniques, noms obligatoires et uniques (contrôlés sur ce qui est ENVOYÉ, avant toute correction automatique)
  const vusR = {};
  Object.keys(rolesBruts).forEach(id => {
    const x = rolesBruts[id] || {}, n = String(x.label || '').trim();
    if (!ROLE_ID_RE.test(id)) { erreurs.push('Identifiant de rôle invalide : « ' + id + ' ».'); return; }
    if (!n) { erreurs.push('Chaque rôle doit avoir un nom (rôle « ' + id + ' »).'); return; }
    const k = cleNom_(n);
    if (vusR[k]) erreurs.push('Deux rôles ne peuvent pas porter le même nom : « ' + n + ' ». Donnez-leur des noms différents.');
    vusR[k] = id;
  });
  if (rolesBruts.admin && (rolesBruts.admin.actif === false || rolesBruts.admin.actif === 'false')) erreurs.push('Le rôle Administrateur ne peut pas être désactivé.');
  // Drive : on garde uniquement l'identifiant ; nom, description, actif, permission de chaque dossier
  Object.keys(cfg.drive).forEach(k => { cfg.drive[k] = idDepuisLien_(cfg.drive[k]); });
  const DD = {};
  DOSSIERS.forEach(d => {
    const x = (cfg.drive_dossiers || {})[d[0]] || {};
    const perm = String(x.permission || d[4]);
    DD[d[0]] = { nom: String(x.nom || '').replace(/[\\/<>]/g, ' ').trim().slice(0, 80) || d[1], description: String(x.description == null ? d[3] : x.description).slice(0, 300),
      actif: DOSSIERS_TOUJOURS_ACTIFS.indexOf(d[0]) > -1 ? true : !(x.actif === false || x.actif === 'false'), permission: perm === 'connecte' || PERM_CODES.indexOf(perm) > -1 ? perm : d[4] };
  });
  cfg.drive_dossiers = DD;
  // Profils
  const PF = cfg.profils;
  PF.photo_max_ko = borne_(PF.photo_max_ko, 50, 2000);
  ['photo', 'ul', 'fonction', 'email', 'telephone'].forEach(k => { PF.visibles[k] = PF.visibles[k] === true || PF.visibles[k] === 'true'; });
  // Demandes
  const D = cfg.demandes;
  D.seuil_urgent = borne_(D.seuil_urgent, 0, 60); D.charge_max = borne_(D.charge_max, 0, 500);
  if (['masque', 'facultatif', 'obligatoire'].indexOf(D.telephone) === -1) D.telephone = 'facultatif';
  if (['courte', 'urgente'].indexOf(D.urgence_effet) === -1) D.urgence_effet = 'courte';
  const codes = {};
  D.statuts = (D.statuts || []).filter(s => s && String(s.label || '').trim()).map(s => {
    let code = String(s.code || '').trim() || slug_(s.label);
    if (!/^[a-z0-9_]{2,30}$/.test(code)) code = slug_(code);
    while (codes[code]) code += '_2';
    codes[code] = true;
    return { code: code, label: String(s.label).slice(0, 40), ton: TONS.indexOf(s.ton) > -1 ? s.ton : 'gris', classe: CLASSES_STATUT.indexOf(s.classe) > -1 ? s.classe : 'en_cours', notifier: s.notifier === true || s.notifier === 'true' };
  });
  CLASSES_OBLIGATOIRES.forEach(k => { if (!D.statuts.some(s => s.classe === k)) erreurs.push('Il faut au moins un statut de type « ' + k + ' » (il déclenche un automatisme).'); });
  PRIORITES_CODES.forEach(k => D.priorites[k] = String(D.priorites[k] || k).slice(0, 40));
  Object.keys(D.champs).forEach(k => {
    const ch = D.champs[k];
    if (TYPES_CHAMP.indexOf(ch.type) === -1) ch.type = 'text';
    ch.options = (Array.isArray(ch.options) ? ch.options : String(ch.options || '').split(',')).map(x => String(x).trim()).filter(Boolean).slice(0, 30);
    if ((ch.type === 'chips' || ch.type === 'select') && !ch.options.length) erreurs.push('La question « ' + ch.label + ' » doit proposer au moins un choix.');
  });
  // Notifications
  const M = cfg.notifications;
  M.internes = M.internes !== false && M.internes !== 'false';
  M.rappel_jours = borne_(M.rappel_jours, 0, 14); M.point_hebdo_jour = borne_(M.point_hebdo_jour, 0, 6); M.heure_routine = borne_(M.heure_routine, 0, 23);
  const mauvais = String(M.emails_equipe || '').split(/[,;\s]+/).filter(x => x && !mail(x));
  if (mauvais.length) erreurs.push('Adresse(s) e-mail invalide(s) dans les destinataires : ' + mauvais.join(', '));
  if (M.repondre_a && !mail(M.repondre_a)) erreurs.push('L\'adresse « répondre à » est invalide.');
  const mauvaisI = String(M.emails_inscriptions || '').split(/[,;\s]+/).filter(x => x && !mail(x));
  if (mauvaisI.length) erreurs.push('Adresse(s) invalide(s) pour les notifications d\'inscription : ' + mauvaisI.join(', '));
  // Calendrier
  cfg.calendrier.categories = (cfg.calendrier.categories || []).filter(x => x && String(x.nom || '').trim()).map(x => ({ nom: String(x.nom).trim().slice(0, 40), couleur: hex(x.couleur) ? x.couleur : '#6b6b6b' }));
  if (!cfg.calendrier.categories.length) erreurs.push('Il faut au moins une catégorie de calendrier.');
  cfg.calendrier.statuts = (cfg.calendrier.statuts || []).map(x => String(x).trim()).filter(Boolean);
  cfg.calendrier.recurrents = (cfg.calendrier.recurrents || []).filter(r => r && String(r.titre || '').trim()).map(r => ({
    titre: String(r.titre).trim().slice(0, 150), categorie: String(r.categorie || ''), regle: r.regle === 'nieme' ? 'nieme' : 'date',
    mois: borne_(r.mois, 1, 12), jour: borne_(r.jour, 1, 31), rang: Number(r.rang) === -1 ? -1 : borne_(r.rang, 1, 5), jour_semaine: borne_(r.jour_semaine, 0, 6),
  }));
  // Ressources
  cfg.ressources.categories = (cfg.ressources.categories || []).filter(x => x && String(x.nom || '').trim()).map(x => ({ nom: String(x.nom).trim().slice(0, 50), icone: ICONES.indexOf(x.icone) > -1 ? x.icone : 'folder', dossier: DOSSIERS.some(d => d[0] === x.dossier) && DOSSIERS_NON_RESSOURCE.indexOf(x.dossier) === -1 ? x.dossier : 'ressources' }));
  cfg.ressources.types_lien = (Array.isArray(cfg.ressources.types_lien) ? cfg.ressources.types_lien : String(cfg.ressources.types_lien || '').split('\n')).map(x => String(x).trim().slice(0, 40)).filter(Boolean).slice(0, 30);
  const ext = String(cfg.ressources.extensions || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase().replace(/^\./, '')).filter(x => /^[a-z0-9]{1,8}$/.test(x));
  const refusees = ext.filter(x => EXTENSIONS_INTERDITES.indexOf(x) > -1);
  if (refusees.length) erreurs.push('Formats de fichiers interdits pour des raisons de sécurité : ' + refusees.join(', ') + '.');
  cfg.ressources.extensions = ext.filter(x => EXTENSIONS_INTERDITES.indexOf(x) === -1).filter((x, i, a) => a.indexOf(x) === i).join(', ');
  cfg.ressources.taille_max_mo = borne_(cfg.ressources.taille_max_mo, 1, 45);
  if (!cfg.ressources.categories.length) erreurs.push('Il faut au moins une catégorie de ressources.');
  cfg.ressources.statuts = (cfg.ressources.statuts || []).map(x => String(x).trim()).filter(Boolean);
  // Photothèque
  const PH = cfg.phototheque, liste = (v, n) => (Array.isArray(v) ? v : String(v || '').split('\n')).map(x => String(x).replace(/[<>]/g, '').trim().slice(0, 60)).filter(Boolean).filter((x, i, t) => t.indexOf(x) === i).slice(0, n);
  PH.categories = liste(PH.categories, 40); PH.types_contenu = liste(PH.types_contenu, 30); PH.utilisations = liste(PH.utilisations, 20);
  if (['pleine', 'hd'].indexOf(PH.apercu_qualite) < 0) PH.apercu_qualite = 'pleine';
  PH.video_max_mo = borne_(PH.video_max_mo, 10, 2000); if (['telecharger', 'voir'].indexOf(PH.lecture_video) < 0) PH.lecture_video = 'telecharger';
  PH.taille_max_mo = borne_(PH.taille_max_mo, 1, 100); PH.export_max_mo = borne_(PH.export_max_mo, 5, 40); PH.notifier_validation = PH.notifier_validation !== false && PH.notifier_validation !== 'false';
  PH.siege = Object.assign({ nom: '', url: '', description: '' }, PH.siege || {});
  PH.siege.nom = String(PH.siege.nom || '').replace(/[<>]/g, '').slice(0, 80); PH.siege.description = String(PH.siege.description || '').replace(/[<>]/g, '').slice(0, 400);
  if (!https(PH.siege.url)) { erreurs.push('Le lien de la banque d\'images du siège doit commencer par https://'); PH.siege.url = ''; }
  // Matériel et réservations
  const MA = cfg.materiel;
  MA.categories = liste(MA.categories, 40);
  if (!MA.categories.length) erreurs.push('Il faut au moins une catégorie de matériel.');
  MA.validation = MA.validation === 'auto' ? 'auto' : 'admin'; MA.annulation = MA.annulation === 'attente' ? 'attente' : 'avant_debut';
  MA.duree_max_jours = borne_(MA.duree_max_jours, 1, 90); MA.anticipation_max_jours = borne_(MA.anticipation_max_jours, 7, 730);
  MA.conditions = String(MA.conditions || '').replace(/[<>]/g, '').slice(0, 2000); MA.notifier = MA.notifier !== false && MA.notifier !== 'false';
  MA.emails_gestion = String(MA.emails_gestion || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x)).join(', ');
  // Aide
  const AI = cfg.aide, vuesCat = {};
  AI.categories = (Array.isArray(AI.categories) ? AI.categories : []).filter(x => x && String(x.nom || '').trim()).map(x => ({ nom: String(x.nom).replace(/[<>]/g, '').trim().slice(0, 60), icone: ICONES.indexOf(x.icone) > -1 ? x.icone : 'help' }))
    .filter(x => !vuesCat[x.nom.toLowerCase()] && (vuesCat[x.nom.toLowerCase()] = true)).slice(0, 30);
  if (!AI.categories.length) erreurs.push('Il faut au moins une catégorie d\'aide.');
  AI.signalement = AI.signalement !== false && AI.signalement !== 'false'; AI.bienvenue = AI.bienvenue !== false && AI.bienvenue !== 'false';
  AI.introduction = String(AI.introduction || '').slice(0, 400);
  // Textes
  Object.keys(cfg.textes).forEach(k => cfg.textes[k] = String(cfg.textes[k] || '').slice(0, 5000));
  cfg.textes.annonce = cfg.textes.annonce.replace(/[<>]/g, '').trim().slice(0, 600);
  if (cfg.textes.annonce_fin && !/^\d{4}-\d{2}-\d{2}$/.test(cfg.textes.annonce_fin)) erreurs.push('Date de fin de l\'information d\'accueil invalide (format AAAA-MM-JJ).');
  return { cfg: cfg, erreurs: erreurs };
}

function borne_(v, min, max) { const n = Math.round(Number(v)); return isNaN(n) ? min : Math.max(min, Math.min(max, n)); }
function slug_(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'element'; }
function idDepuisLien_(v) { v = String(v || '').trim(); if (!v) return ''; const m = v.match(/[-\w]{19,}/); return m ? m[0] : ''; }

function enregistrerConfig_(cfg, auteur, commentaire) {
  const v = validerConfig_(cfg);
  if (v.erreurs.length) throw Oups_('La configuration n\'a pas été enregistrée :\n• ' + v.erreurs.join('\n• '));
  const c = v.cfg;
  // Un statut encore utilisé par des demandes ne peut pas disparaître
  const codes = c.demandes.statuts.map(s => s.code);
  const orphelins = {};
  try { DB.tout('demandes').forEach(d => { if (d.statut && codes.indexOf(d.statut) === -1) orphelins[d.statut] = (orphelins[d.statut] || 0) + 1; }); } catch (e) { }
  const k = Object.keys(orphelins);
  if (k.length) throw Oups_('Statut(s) encore utilisé(s) par des demandes : ' + k.map(x => x + ' (' + orphelins[x] + ')').join(', ') + '. Changez d\'abord le statut de ces demandes, ou gardez ce statut.');
  const precedent = config_();
  // Un rôle encore attribué à des personnes ne peut pas être supprimé : le désactiver, ou leur attribuer un autre rôle d'abord
  const supprimes = Object.keys(precedent.roles).filter(r => !c.roles[r]);
  if (supprimes.length) {
    const n = {}; DB.tout('utilisateurs').forEach(x => { const r = ALIAS_ROLES[x.role] || x.role; if (supprimes.indexOf(r) > -1) n[r] = (n[r] || 0) + 1; });
    const k2 = Object.keys(n);
    if (k2.length) throw Oups_('Rôle(s) encore attribué(s) : ' + k2.map(r => '« ' + libRole_(precedent, r) + ' » (' + n[r] + ' personne' + (n[r] > 1 ? 's' : '') + ')').join(', ') + '. Désactivez ce rôle, ou attribuez d\'abord un autre rôle à ces personnes.');
    if (supprimes.indexOf(ROLE_ADMIN) > -1) throw Oups_('Le rôle Administrateur ne peut pas être supprimé.');
  }
  // Un rôle ne peut pas être désactivé tant que des personnes l'ont : « Désactiver » propose de leur attribuer un autre rôle d'abord
  const desactives = Object.keys(c.roles).filter(r => c.roles[r].actif === false && precedent.roles[r] && precedent.roles[r].actif !== false);
  if (desactives.length) {
    const n = {}; DB.tout('utilisateurs').forEach(x => { const r = ALIAS_ROLES[x.role] || x.role; if (desactives.indexOf(r) > -1) n[r] = (n[r] || 0) + 1; });
    const k3 = Object.keys(n);
    if (k3.length) throw Oups_('Rôle(s) encore attribué(s) : ' + k3.map(r => '« ' + libRole_(c, r) + ' » (' + n[r] + ' personne' + (n[r] > 1 ? 's' : '') + ')').join(', ') + '. Attribuez d\'abord un autre rôle à ces personnes (bouton « Désactiver » du rôle).');
  }
  c.meta = { version_schema: VERSION_SCHEMA, numero: (Number(precedent.meta.numero) || 0) + 1, modifie_le: maintenant_(), modifie_par: auteur || '', commentaire: String(commentaire || '').slice(0, 200) };
  const json = JSON.stringify(c);
  const morceaux = [];
  for (let i = 0; i < json.length; i += 40000) morceaux.push({ cle: 'config', valeur: json.slice(i, i + 40000) });
  // Copie de secours LOCALE de la configuration précédente (dans la base) : retour arrière possible même sans Drive
  const avant = DB.tout('configuration').filter(r => r.cle === 'config').map(r => ({ cle: 'precedente', valeur: r.valeur }));
  const autres = DB.tout('configuration').filter(r => r.cle !== 'config' && r.cle !== 'precedente').map(r => ({ cle: r.cle, valeur: r.valeur }));   // logo (3.19)
  DB.remplacer('configuration', morceaux.concat(avant, autres));
  try { const k = CacheService.getScriptCache(); k.remove('config'); k.remove(CLE_FONCTIONS); } catch (e) { }
  _CFG = null;
  sauvegarderVersion_(commentaire || 'Modification de la configuration', auteur);
  // Nouvelle information importante : notification à tous les comptes actifs (une seule par personne tant qu'elle n'est pas lue)
  try { const a = String(c.textes.annonce || '').trim(); if (a && a !== String((precedent.textes || {}).annonce || '').trim() && (!c.textes.annonce_fin || c.textes.annonce_fin >= aujourdhui_())) notifier_(DB.tout('utilisateurs').map(x => x.email), { type: 'annonce', titre: 'Information importante', texte: a, lien: 'accueil', cle: 'annonce' }, auteur); } catch (e) { console.error(e); }
  return config_();
}

// Chaque enregistrement crée une version (fichier JSON) dans le dossier « Sauvegardes » du Drive
function sauvegarderVersion_(commentaire, auteur) {
  try {
    const cfg = config_();
    const nom = 'config_' + cfg.identite.code + '_v' + cfg.meta.numero + '_' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd_HHmmss') + '.json';
    const f = dossier_('sauvegardes').createFile(nom, JSON.stringify(exporter_(), null, 2), 'application/json');
    f.setDescription(String(commentaire || '') + (auteur ? ' — ' + auteur : ''));
    return f;
  } catch (err) { console.error('Sauvegarde de version impossible : ' + err); return null; }
}

function exporter_() {
  const nettoie = arr => arr.map(o => { const x = Object.assign({}, o); delete x._ligne; return x; });
  return {
    format: FORMAT_EXPORT, version_schema: VERSION_SCHEMA, version_code: VERSION_CODE, exporte_le: maintenant_(), source: config_().identite.code,
    config: config_(),
    tables: {
      types: nettoie(DB.tout('types')), ul: nettoie(DB.tout('ul')), ressources: nettoie(lignesRessources_()),
      utilisateurs: DB.tout('utilisateurs').map(u => ({ email: u.email, nom: u.nom, prenom: u.prenom, nom_famille: u.nom_famille, fonction: u.fonction, role: role_(u.role), ul: u.ul, actif: u.actif })),  // jamais de jeton ni de session
    },
  };
}

// =====================================================================
// 4. POINT D'ENTRÉE WEB
// =====================================================================
function doGet(e) {
  const p = (e && e.parameter) || {};
  let pub = {};
  try { pub = configPublique_(); } catch (err) { pub = { erreur: 'Application non installée.' }; }
  const t = HtmlService.createTemplateFromFile('Index');
  t.boot = JSON.stringify({ version: VERSION_CODE, code: String(p.c || p.t || '').slice(0, 80), demande: String(p.d || '').slice(0, 40), vue: String(p.v || '').slice(0, 20), fiche: String(p.fiche || '').slice(0, 120), public: pub }).replace(/</g, '\\u003c');
  const out = t.evaluate()
    .setTitle((pub.identite && pub.identite.nom_centre) || 'Centre Com')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  try { if (pub.identite && pub.identite.favicon_url) out.setFaviconUrl(pub.identite.favicon_url); } catch (err) { }
  return out;
}

// Seuls les deux fichiers de l'interface peuvent être insérés (la fonction est appelable depuis le navigateur)
function include(nom) { if (['Styles', 'App'].indexOf(nom) === -1) return ''; return HtmlService.createHtmlOutputFromFile(nom).getContent(); }

/**
 * Protection des fonctions « de maintenance » (installer, envoyerMonLien…).
 * Toute fonction Apps Script sans « _ » final peut être appelée depuis un navigateur via google.script.run.
 * Celles-ci ne s'exécutent donc que pour le propriétaire du projet (éditeur Apps Script ou lui-même connecté).
 */
function reserveProprietaire_() {
  let actif = '', proprio = '';
  try { actif = String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { }
  try { proprio = String(Session.getEffectiveUser().getEmail() || '').toLowerCase(); } catch (e) { }
  if (!actif || actif !== proprio) throw new Error('Fonction réservée au propriétaire du projet, depuis l\'éditeur Apps Script.');
}
// Automatismes : au plus une exécution toutes les 20 heures (un appel extérieur ne peut pas déclencher d'envois en série)
function uneFoisParJour_(cle) {
  const c = CacheService.getScriptCache();
  if (c.get(cle)) return false;
  c.put(cle, '1', 20 * 3600);
  return true;
}

// Ce que l'écran de connexion a le droit de voir : apparence et textes publics, AUCUNE donnée interne
function configPublique_() {
  const c = config_();
  let url = urlOfficielle_();
  return {
    identite: { logo_src: logoSrc_(c), nom_centre: c.identite.nom_centre, code: c.identite.code, nom_organisation: c.identite.nom_organisation, territoire: c.identite.territoire, description: c.identite.description, message_connexion: c.identite.message_connexion, public_autorise: c.identite.public_autorise, logo_url: c.identite.logo_url, logo_secondaire_url: c.identite.logo_secondaire_url, favicon_url: c.identite.favicon_url, image_connexion_url: c.identite.image_connexion_url },
    apparence: c.apparence, animations: c.animations, auth: c.securite.mode, url: url, lien_validite_min: c.securite.lien_validite_min,
    connexion: c.connexion, google: infoGooglePublique_(c), inscription: c.securite.inscription,
    textes: { connexion_aide: c.textes.connexion_aide, refus_acces: c.textes.refus_acces, refus_aide: c.textes.refus_aide, session_expiree: c.textes.session_expiree, pied_page: c.textes.pied_page },
  };
}
// Compte Google déjà reconnu par l'environnement Apps Script (Google Workspace) : sert seulement à préparer le bouton ;
// l'identité est de nouveau lue CÔTÉ SERVEUR au moment de la connexion (api_connexionGoogle).
function infoGooglePublique_(c) {
  let email = '';
  if (c.securite.mode !== 'lien') { try { email = String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { } }
  return { detecte: !!email, email: email, client_id: c.securite.mode !== 'lien' ? c.securite.google_client_id : '' };
}

// Erreur « métier » : son message est montré tel quel à l'utilisateur (fonction privée : non appelable depuis le navigateur)
function Oups_(message) { const e = new Error(message); e.utilisateur = true; return e; }

/**
 * Toutes les fonctions appelées par l'interface passent par ici :
 * SESSION valide (ouverte par la page de connexion, non expirée) → compte toujours autorisé (liste blanche, actif)
 * → contrôle de la PERMISSION du rôle → erreurs lisibles.
 * sid : identifiant de session remis par api_connexionGoogle / api_connexionLien.
 * perm : 'connecte' (toute personne autorisée), un code de permission, ou une liste (l'une suffit).
 */
function appel_(sid, perm, fn) {
  let qui = null;
  try {
    const id = identifier_(sid);
    if (id.etat === 'anonyme') return { ok: false, erreur: 'session', message: 'Connectez-vous pour accéder au Centre Com.' };
    if (id.etat === 'expire') return { ok: false, erreur: 'session', expire: true, message: 'Votre session a expiré. Reconnectez-vous.' };
    if (id.etat === 'refuse') return { ok: false, erreur: 'refuse', email: id.email, statut: id.statut, message: messageRefus_(id.statut) };
    const u = id.u; qui = u;
    const liste = perm === 'connecte' ? [] : [].concat(perm);
    if (liste.length && !liste.some(p => peut_(u, p))) {
      journalSecu_(u.email, 'refus_permission', liste.join('|'));
      return { ok: false, erreur: 'droits', message: liste.indexOf('admin') > -1 ? 'Cette action est réservée aux administrateurs.' : 'Votre rôle ne permet pas cette action.' };
    }
    return { ok: true, data: fn(u) };
  } catch (err) {
    if (err && err.utilisateur) return { ok: false, erreur: 'metier', message: err.message };
    const ref = Utilities.formatDate(new Date(), 'Europe/Paris', 'ddHHmmss');
    console.error('[' + ref + '] ' + (err && err.stack || err));
    // Cause exacte (3.24) : inscrite au Journal et montrée aux administrateurs (jamais aux autres rôles)
    const cause = String(err && err.message || err).slice(0, 220);
    try { journalSecu_(qui ? qui.email : '', 'erreur_serveur', ref + ' · ' + cause); } catch (x) { }
    return { ok: false, erreur: 'serveur', message: 'Un problème technique est survenu. Réessayez dans un instant. S\'il se reproduit, prévenez l\'administrateur (référence ' + ref + ').' + (qui && qui.role === 'admin' ? ' Détail : ' + cause : '') };
  }
}

// =====================================================================
// 5. AUTHENTIFICATION ET AUTORISATION
// =====================================================================
// Rôle d'un profil : un rôle qui n'existe plus (fiche modifiée à la main) donne le rôle d'inscription, jamais plus
function role_(r) { r = ALIAS_ROLES[r] || r; const c = config_(); return r && c.roles[r] ? r : (roleInscription_(c) || 'aucun'); }
// Un rôle désactivé ne donne plus aucun droit (les personnes sont réattribuées au moment de la désactivation)
function perms_(u) { if (u.role === ROLE_ADMIN) return PERM_CODES.slice(); const r = config_().roles[u.role]; return r && r.actif !== false ? (r.permissions || []) : []; }
function peut_(u, p) { return u.role === 'admin' || perms_(u).indexOf(p) > -1; }

// État d'accès d'un profil : ok | absent | desactive | revoque
function etatAcces_(u) {
  if (!u) return 'absent';
  const a = String(u.actif || 'OUI').toUpperCase();
  return a === 'REVOQUE' ? 'revoque' : a === 'NON' ? 'desactive' : 'ok';
}
function messageRefus_(statut) {
  const T = config_().textes, c = config_();
  const espace = (c.connexion.titre || '').trim() || ('Espace Com ' + c.identite.code);
  const m = statut === 'revoque' ? T.acces_revoque : statut === 'desactive' ? T.acces_desactive : T.refus_acces;
  return String(m || '').replace(/\{espace\}/g, espace);
}
// Un compte Google vérifié sans profil peut-il en créer un ? (réglage « Qui peut entrer ? »)
function inscriptionPossible_(email) {
  const s = config_().securite;
  if (s.inscription === 'libre') return true;
  if (s.inscription === 'domaines') { const dom = email.split('@')[1] || ''; return s.domaines.split(', ').filter(Boolean).indexOf(dom) > -1; }
  return false;
}

/**
 * SESSIONS (côté serveur)
 * - La page de connexion est obligatoire pour tous les rôles, administrateur compris.
 * - Une session n'est ouverte qu'après vérification du compte : api_connexionGoogle (adresse transmise par Google)
 *   ou api_connexionLien (lien à usage unique reçu par e-mail), selon le mode choisi dans Administration > Connexion et sécurité.
 * - La session est conservée côté serveur (CacheService) : e-mail, mode de connexion, heure de la dernière activité.
 * - Chaque appel vérifie : session existante, inactivité < délai réglé, mode toujours autorisé, compte toujours actif.
 * - Déconnexion : api_fermerSession supprime la session ; la page n'a plus accès à rien.
 */
const PREFIXE_SESSION = 'sess_';
const PREFIXE_CODE = 'code_';
function ttlSession_() { const m = Number(config_().securite.inactivite_min) || 0; return m > 0 ? Math.min(21600, m * 60 + 600) : 21600; }

function identifier_(sid, opts) {
  sid = String(sid || '');
  if (!/^[a-f0-9]{64}$/.test(sid)) return { etat: 'anonyme' };
  const cache = CacheService.getScriptCache(), cle = PREFIXE_SESSION + sid;
  let s = null;
  try { s = JSON.parse(cache.get(cle) || 'null'); } catch (e) { s = null; }
  if (!s || !s.e) return { etat: 'expire' };
  if (s.x) return { etat: 'refuse', email: s.e, statut: s.x };   // accès désactivé ou révoqué pendant la session
  const S = config_().securite, delai = Number(S.inactivite_min) || 0;
  if (Date.now() - Number(s.c) > (Number(S.duree_max_h) || 12) * 3600000) {
    cache.remove(cle); journalSecu_(s.e, 'expiration', 'Durée maximale de session atteinte (' + S.duree_max_h + ' h)');
    return { etat: 'expire' };
  }
  if (delai > 0 && Date.now() - Number(s.t) > (delai * 60 + 120) * 1000) {
    cache.remove(cle); journalSecu_(s.e, 'expiration', 'Session fermée après ' + delai + ' min d\'inactivité');
    return { etat: 'expire' };
  }
  if ((S.mode === 'google' && s.v === 'lien') || (S.mode === 'lien' && s.v === 'google')) { cache.remove(cle); return { etat: 'expire' }; }
  const u = DB.tout('utilisateurs').find(x => x.email === s.e);
  const acces = etatAcces_(u);
  if (acces !== 'ok') { cache.put(cle, JSON.stringify({ e: s.e, x: acces }), 3600); journalRefus_(s.e, acces); return { etat: 'refuse', email: s.e, statut: acces }; }   // session neutralisée : ne donne plus accès à rien
  // Sessions ouvertes avant une désactivation / révocation : invalidées, même si l'accès a été rétabli depuis
  if (u.sessions_avant && Number(s.c) < Number(u.sessions_avant)) { cache.remove(cle); return { etat: 'expire' }; }
  if (!(opts && opts.sansProlonger)) {
    s.t = Date.now();
    // Dernière activité : enregistrée au plus toutes les 10 minutes (limite les écritures dans la base)
    if (!s.a || Date.now() - Number(s.a) > 600000) { s.a = Date.now(); try { DB.modifier('utilisateurs', 'email', u.email, { derniere_activite: maintenant_() }, true); } catch (e) { } }
    cache.put(cle, JSON.stringify(s), ttlSession_());
  }
  const reel = role_(u.role), mode = reel === ROLE_ADMIN && s.m && s.m !== ROLE_ADMIN && config_().roles[s.m] ? s.m : '';
  return { etat: 'ok', u: Object.assign({}, u, { role: mode || reel, role_reel: reel, mode_utilisateur: mode, via: s.v, sid: sid }) };
}

// Le profil existe-t-il et son accès est-il ouvert ? (plus aucune création implicite : la création passe par le formulaire de profil)
function compteAutorise_(email) {
  email = String(email || '').trim().toLowerCase();
  const u = DB.tout('utilisateurs').find(x => x.email === email) || null;
  return etatAcces_(u) === 'ok' ? u : null;
}

function creerSession_(email, via) {
  const sid = nouveauJeton_(), maintenant = Date.now();
  CacheService.getScriptCache().put(PREFIXE_SESSION + sid, JSON.stringify({ e: email, v: via, t: maintenant, c: maintenant }), ttlSession_());
  journalSecu_(email, 'connexion', via === 'google' ? 'Compte Google' : via === 'lien' ? 'Lien de connexion à usage unique' : via);
  try { DB.modifier('utilisateurs', 'email', email, { derniere_visite: maintenant_() }, true); } catch (e) { }
  return sid;
}

/**
 * AUTHENTIFICATION GOOGLE — l'adresse vient TOUJOURS de Google, jamais du navigateur.
 * 1. Google Workspace : l'application tourne dans l'environnement Google ; Session.getActiveUser() donne, côté serveur,
 *    le compte avec lequel Google a authentifié la personne (déploiement « Tout le monde dans [domaine] » : Google
 *    impose lui-même sa page de connexion avant d'afficher l'application).
 * 2. Google Identity Services (comptes hors du domaine) : le navigateur obtient de Google un jeton signé ; le serveur
 *    le fait vérifier par Google (oauth2.googleapis.com/tokeninfo) : destinataire = notre identifiant client,
 *    non expiré, adresse vérifiée. Le navigateur ne transmet jamais une adresse : seulement le jeton de Google.
 * Ensuite : compte autorisé ? actif ? → rôle et permissions lus sur le serveur → session.
 */
// 3.29 : la session ouverte, les données d'ouverture (profil, réglages, tableau de bord) partent dans la MÊME réponse
// (un aller-retour de moins à chaque connexion). Mêmes contrôles que api_demarrage (appelée avec la session créée).
function demarrageJoint_(sid, avecAccueil) {
  if (typeof avecAccueil !== 'boolean') return undefined;
  try { const r = api_demarrage(sid, avecAccueil, true); return r && r.ok ? r.data : undefined; } catch (e) { return undefined; }
}
function api_connexionGoogle(jetonGoogle, avecAccueil) {
  try {
    const S = config_().securite;
    if (S.mode === 'lien') return { ok: false, erreur: 'mode', message: 'La connexion Google est désactivée : utilisez le lien de connexion par e-mail.' };
    let email = '', via = 'google';
    if (jetonGoogle) {
      const v = verifierJetonGoogle_(String(jetonGoogle));
      if (!v.ok) { journalSecu_('', 'refus_google', v.detail); return { ok: false, erreur: 'google_jeton', message: v.message }; }
      email = v.email;
    } else {
      try { email = String(Session.getActiveUser().getEmail() || '').toLowerCase(); } catch (e) { }
    }
    if (!email) return { ok: false, erreur: 'google_inconnu', gis: !!S.google_client_id, message: S.google_client_id
      ? 'Google n\'a pas encore confirmé votre compte. Choisissez votre compte dans la fenêtre Google qui s\'ouvre.'
      : 'Google n\'a pas transmis l\'identité de votre compte. Connectez-vous à Google avec le compte de la délégation (ou choisissez « Utiliser un autre compte »), puis réessayez.' + (S.mode === 'mixte' ? ' Vous pouvez aussi utiliser le lien de secours par e-mail.' : '') };
    const u = DB.tout('utilisateurs').find(x => x.email === email) || null;
    const acces = etatAcces_(u);
    if (acces === 'ok') { const sid = creerSession_(email, via); return { ok: true, data: { sid: sid, existant: true, demarrage: demarrageJoint_(sid, avecAccueil) } }; }
    if (acces !== 'absent') { journalRefus_(email, acces); return { ok: false, erreur: 'refuse', email: email, statut: acces, message: messageRefus_(acces) }; }
    if (!inscriptionPossible_(email)) { journalRefus_(email); return { ok: false, erreur: 'refuse', email: email, statut: 'absent', message: messageRefus_('absent') }; }
    // Aucun profil : l'identité Google vérifiée est mise de côté sur le serveur, le temps de remplir le formulaire
    return { ok: false, erreur: 'profil_absent', email: email, jeton: jetonInscription_(email, via), formulaire: formulaireInscription_() };
  } catch (err) { console.error(err); return { ok: false, erreur: 'serveur', message: 'La connexion a échoué. Réessayez dans un instant.' }; }
}

// =====================================================================
// INSCRIPTION LIBRE — création de profil après authentification Google
// L'adresse vient de l'identité Google vérifiée (conservée sur le serveur) ; le navigateur n'envoie que
// prénom, nom, UL, fonction, téléphone, acceptation des conditions. Le rôle est fixé par le serveur.
// =====================================================================
const PREFIXE_INSCRIPTION = 'insc_';
function jetonInscription_(email, via) {
  const j = nouveauJeton_();
  CacheService.getScriptCache().put(PREFIXE_INSCRIPTION + j, JSON.stringify({ e: email, v: via }), 1800);
  return j;
}
function formulaireInscription_() {
  const c = config_();
  return { ul: DB.tout('ul').filter(x => String(x.actif).toUpperCase() !== 'NON').map(x => x.nom), fonctions: c.inscription.fonctions, telephone: c.inscription.telephone,
    cgu_titre: c.inscription.cgu_titre, cgu_texte: c.inscription.cgu_texte, role: (c.roles[c.securite.role_defaut] || {}).label || '' };
}

function api_creerProfil(jeton, p) {
  try {
    jeton = String(jeton || ''); p = p || {};
    const cache = CacheService.getScriptCache();
    let a = null;
    if (/^[a-f0-9]{64}$/.test(jeton)) { try { a = JSON.parse(cache.get(PREFIXE_INSCRIPTION + jeton) || 'null'); } catch (e) { } }
    if (!a || !a.e) return { ok: false, erreur: 'inscription_expiree', message: 'Le délai de création du profil est dépassé. Reconnectez-vous avec Google pour recommencer.' };
    const email = a.e, S = config_().securite, c = config_();
    if (S.mode === 'lien' || (S.mode === 'google' && a.v === 'lien')) return { ok: false, erreur: 'mode', message: 'La création de profil passe par la connexion Google.' };
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const existant = DB.tout('utilisateurs').find(x => x.email === email) || null;
      const acces = etatAcces_(existant);
      if (acces === 'ok') { cache.remove(PREFIXE_INSCRIPTION + jeton); return { ok: true, data: { sid: creerSession_(email, a.v), existant: true } }; }   // jamais de doublon
      if (acces !== 'absent') return { ok: false, erreur: 'refuse', email: email, statut: acces, message: messageRefus_(acces) };
      if (!inscriptionPossible_(email)) return { ok: false, erreur: 'refuse', email: email, statut: 'absent', message: messageRefus_('absent') };
      const txt = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
      const prenom = txt(p.prenom, 60), nom = txt(p.nom, 60), ul = txt(p.ul, 80), fonction = txt(p.fonction, 80), tel = txt(p.telephone, 30);
      const manque = [];
      if (!prenom) manque.push('le prénom'); if (!nom) manque.push('le nom');
      if (DB.tout('ul').filter(x => String(x.actif).toUpperCase() !== 'NON').map(x => x.nom).indexOf(ul) === -1) manque.push('l\'unité locale ou la délégation');
      if (!fonction) manque.push('la fonction');
      if (c.inscription.telephone === 'obligatoire' && !tel) manque.push('le téléphone');
      if (tel && !/^[+0-9 ().\-]{6,30}$/.test(tel)) manque.push('un numéro de téléphone valide');
      if (p.cgu !== true) manque.push('l\'acceptation des conditions d\'utilisation');
      if (manque.length) return { ok: false, erreur: 'metier', message: 'Il manque ' + manque.join(', ') + '.' };
      const role = roleInscription_(c);   // jamais choisi par le navigateur ; jamais Administrateur
      if (!role) return { ok: false, erreur: 'metier', message: 'Les inscriptions sont momentanément fermées (aucun rôle disponible). Prévenez l\'équipe communication.' };
      const u = { email: email, nom: prenom + ' ' + nom, prenom: prenom, nom_famille: nom, role: role, ul: ul, actif: 'OUI', token: nouveauJeton_(), cree_le: maintenant_(), derniere_visite: '',
        fonction: fonction, telephone: c.inscription.telephone === 'masque' ? '' : tel, cgu_le: maintenant_(), origine: 'inscription', modifie_le: maintenant_(), motif: '', sessions_avant: '' };
      DB.ajouter('utilisateurs', u);
      cache.remove(PREFIXE_INSCRIPTION + jeton);
      journalSecu_(email, 'inscription', 'Profil créé : ' + u.nom + ' · ' + ul + ' · ' + fonction + ' · rôle ' + libRole_(c, role));
      notifierInscription_(u);   // un échec d'envoi n'empêche pas la création (journalisé)
      return { ok: true, data: { sid: creerSession_(email, a.v), nouveau: true } };
    } finally { lock.releaseLock(); }
  } catch (err) { console.error(err); return { ok: false, erreur: 'serveur', message: 'La création du profil a échoué. Réessayez dans un instant.' }; }
}

function notifierInscription_(u) {
  const c = config_();
  // Dans l'application : administrateurs (profil à vérifier), regroupés tant qu'ils ne sont pas lus
  notifier_(DB.tout('utilisateurs').filter(x => role_(x.role) === 'admin').map(x => x.email), { type: 'admin', titre: 'Nouveau profil à vérifier : ' + (u.nom || u.email), texte: [u.ul, u.fonction].filter(Boolean).join(' · '), lien: 'admin:fiche:' + u.email, cle: 'inscriptions', perm: 'admin' }, u.email, true);
  if (!c.notifications.inscriptions) return;
  const liste = String(c.notifications.emails_inscriptions || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase()).filter(x => x.indexOf('@') > 0);
  const dests = liste.length ? liste : DB.tout('utilisateurs').filter(x => role_(x.role) === 'admin' && etatAcces_(x) === 'ok').map(x => x.email);
  const quand = Utilities.formatDate(new Date(), 'Europe/Paris', "dd/MM/yyyy 'à' HH:mm");
  const v = { prenom_nom: u.nom, ul: u.ul, role: libRole_(c, u.role) };
  const bloc = tableau_([['Prénom', u.prenom], ['Nom', u.nom_famille], ['Adresse Google vérifiée', u.email], ['Unité locale / délégation', u.ul], ['Fonction', u.fonction]].concat(u.telephone ? [['Téléphone', u.telephone]] : []).concat([['Créé le', quand], ['Rôle attribué', libRole_(c, u.role)]])) +
    bouton_('Ouvrir la fiche du profil', urlFiche_(u.email));
  const echecs = [];
  dests.forEach(d => { if (!mailModele_(d, 'inscription', v, bloc)) echecs.push(d); });
  if (!dests.length) journalSecu_(u.email, 'notification_echec', 'Inscription : aucun destinataire (aucun administrateur actif ni adresse configurée)');
  else if (echecs.length) journalSecu_(u.email, 'notification_echec', 'Inscription : e-mail non envoyé à ' + echecs.join(', '));
  else journalSecu_(u.email, 'notification_inscription', 'Envoyée à ' + dests.join(', '));
}
function urlFiche_(email) { let url = urlOfficielle_(); return url + '?v=admin&fiche=' + encodeURIComponent(email); }

// Vérification d'un jeton Google (jeton d'accès ou jeton d'identité) par Google lui-même
function verifierJetonGoogle_(jeton) {
  const clientId = config_().securite.google_client_id;
  const refus = (detail) => ({ ok: false, detail: detail, message: 'Google n\'a pas pu confirmer votre identité. Réessayez ; si le problème persiste, contactez l\'administrateur.' });
  if (!clientId) return refus('Aucun identifiant client configuré');
  if (!/^[A-Za-z0-9._\-]{20,4096}$/.test(jeton)) return refus('Jeton mal formé');
  const estJwt = jeton.split('.').length === 3;
  let rep;
  try { rep = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?' + (estJwt ? 'id_token=' : 'access_token=') + encodeURIComponent(jeton), { muteHttpExceptions: true }); }
  catch (e) { return refus('Google injoignable : ' + e); }
  if (rep.getResponseCode() !== 200) return refus('Jeton refusé par Google (' + rep.getResponseCode() + ')');
  let t; try { t = JSON.parse(rep.getContentText()); } catch (e) { return refus('Réponse illisible'); }
  const destinataire = estJwt ? t.aud : (t.aud || t.azp);
  if (destinataire !== clientId && t.azp !== clientId) return refus('Jeton émis pour une autre application');
  if (estJwt && ['accounts.google.com', 'https://accounts.google.com'].indexOf(t.iss) === -1) return refus('Émetteur inconnu');
  const exp = Number(t.exp || 0) * 1000, reste = Number(t.expires_in || 0);
  if ((exp && exp < Date.now()) || (!exp && reste <= 0)) return refus('Jeton expiré');
  if (!(t.email_verified === true || t.email_verified === 'true')) return refus('Adresse non vérifiée par Google');
  const email = String(t.email || '').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return refus('Adresse absente du jeton');
  return { ok: true, email: email };
}

// Lien reçu par e-mail : code aléatoire, à usage unique, valable quelques minutes (réglable)
function api_connexionLien(code, avecAccueil) {
  try {
    const S = config_().securite;
    if (S.mode === 'google') return { ok: false, erreur: 'mode', message: 'La connexion par lien est désactivée : utilisez « Se connecter avec Google ».' };
    code = String(code || '');
    const cache = CacheService.getScriptCache();
    const email = /^[a-f0-9]{64}$/.test(code) ? cache.get(PREFIXE_CODE + code) : null;
    if (!email) return { ok: false, erreur: 'code', message: 'Ce lien de connexion n\'est plus valable (déjà utilisé ou expiré). Demandez-en un nouveau ci-dessous.' };
    cache.remove(PREFIXE_CODE + code);
    const acc = etatAcces_(DB.tout('utilisateurs').find(x => x.email === email) || null);
    if (acc !== 'ok') { journalRefus_(email, acc); return { ok: false, erreur: 'refuse', email: email, statut: acc, message: messageRefus_(acc) }; }
    { const sid = creerSession_(email, 'lien'); return { ok: true, data: { sid: sid, demarrage: demarrageJoint_(sid, avecAccueil) } }; }
  } catch (err) { console.error(err); return { ok: false, erreur: 'serveur', message: 'La connexion a échoué. Réessayez dans un instant.' }; }
}

// Déconnexion : la session est supprimée côté serveur (toute requête ultérieure avec cet identifiant est refusée)
function api_fermerSession(sid) {
  try {
    sid = String(sid || '');
    if (/^[a-f0-9]{64}$/.test(sid)) {
      const cache = CacheService.getScriptCache(), cle = PREFIXE_SESSION + sid;
      let s = null; try { s = JSON.parse(cache.get(cle) || 'null'); } catch (e) { }
      cache.remove(cle);
      if (s && s.e) journalSecu_(s.e, 'deconnexion', '');
    }
  } catch (err) { console.error(err); }
  return { ok: true };
}

// « Rester connecté » et activité de l'utilisateur : prolonge la session
function api_prolongerSession(sid) {
  return appel_(sid, 'connecte', u => ({ inactivite_min: config_().securite.inactivite_min }));
}

// Contrôle périodique (toutes les 2 min) : accès toujours ouvert ? NE prolonge PAS la session (l'inactivité reste mesurée)
function api_verifierSession(sid) {
  try {
    const id = identifier_(sid, { sansProlonger: true });
    if (id.etat === 'ok') return { ok: true, data: true };
    if (id.etat === 'refuse') return { ok: false, erreur: 'refuse', email: id.email, statut: id.statut, message: messageRefus_(id.statut) };
    return { ok: false, erreur: 'session', expire: id.etat === 'expire', message: 'Votre session a expiré. Reconnectez-vous.' };
  } catch (err) { console.error(err); return { ok: false, erreur: 'serveur', message: 'Vérification impossible.' }; }
}

function nouveauCode_(email) {
  const code = nouveauJeton_();
  CacheService.getScriptCache().put(PREFIXE_CODE + code, email, config_().securite.lien_validite_min * 60);
  return code;
}

function journalRefus_(email, statut) {
  const lib = { desactive: 'Accès désactivé', revoque: 'Accès révoqué', absent: 'Aucun profil et inscription non ouverte à ce compte' }[statut] || 'Compte non autorisé ou désactivé';
  try { const c = CacheService.getScriptCache(), k = 'refus_' + (statut || '') + email; if (!c.get(k)) { c.put(k, '1', 3600); journalSecu_(email, 'refus', lib); } } catch (e) { }
}

function api_demanderLien(email) {
  try {
    const S = config_().securite;
    if (S.mode === 'google') return { ok: false, message: 'La connexion par lien est désactivée : utilisez « Se connecter avec Google ».' };
    email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Cette adresse e-mail ne semble pas valide.' };
    const cache = CacheService.getScriptCache(), cle = 'lien_' + email, n = Number(cache.get(cle) || 0);
    if (n >= 3) return { ok: false, message: 'Trois demandes ont déjà été faites pour cette adresse dans l\'heure. Vérifiez vos courriers indésirables.' };
    cache.put(cle, String(n + 1), 3600);
    if (compteAutorise_(email)) {
      mailModele_(email, 'lien_acces', { validite: S.lien_validite_min }, bouton_('Se connecter au ' + config_().identite.nom_centre, urlApp_(nouveauCode_(email))));
      journalSecu_(email, 'lien_envoye', 'Valable ' + S.lien_validite_min + ' min, usage unique');
    } else journalRefus_(email);
    return { ok: true };   // même réponse dans tous les cas : on ne révèle pas quelles adresses sont autorisées
  } catch (err) {
    console.error(err);
    return { ok: false, message: 'L\'envoi n\'a pas pu se faire. Réessayez dans quelques minutes.' };
  }
}

function assurerUtilisateur_(email, nom) {
  email = String(email).trim().toLowerCase();
  let u = DB.tout('utilisateurs').find(x => x.email === email);
  if (!u) {
    u = { email: email, nom: nom || '', role: 'demandeur', ul: '', actif: 'OUI', token: nouveauJeton_(), cree_le: maintenant_(), derniere_visite: '' };
    DB.ajouter('utilisateurs', u);
  } else if (!u.token) {
    u.token = nouveauJeton_();
    DB.modifier('utilisateurs', 'email', email, { token: u.token });
  }
  if (nom && !u.nom) DB.modifier('utilisateurs', 'email', email, { nom: nom });
  return u;
}

function nouveauJeton_() { return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''); }
// Adresse de l'application ; code = lien de connexion à usage unique (facultatif)
// ADRESSE PUBLIQUE UNIQUE : celle du déploiement « Application Web » officiel, gardée dans la propriété du script
// URL_OFFICIELLE (Paramètres du projet > Propriétés du script). Tous les liens envoyés (e-mails, lien de connexion,
// « Utiliser un autre compte Google », fiches) l'utilisent. Sans elle : adresse donnée par Google (getUrl), qui peut
// être l'adresse /dev (réservée aux éditeurs) quand le code s'exécute depuis l'éditeur ou un déclencheur.
const MOTIF_URL_EXEC = /^https:\/\/script\.google\.com\/(a\/macros\/[A-Za-z0-9.-]+\/|macros\/)s\/[A-Za-z0-9_-]{20,}\/exec$/;
function urlProprieteOfficielle_() { try { return String(PropertiesService.getScriptProperties().getProperty('URL_OFFICIELLE') || '').trim().replace(/[?#].*$/, ''); } catch (e) { return ''; } }
function urlOfficielle_() {
  const p = urlProprieteOfficielle_();
  if (MOTIF_URL_EXEC.test(p)) return p;
  let u = ''; try { u = String(ScriptApp.getService().getUrl() || ''); } catch (e) { }
  return u;
}
// Éditeur Apps Script : état du déploiement officiel (aucune modification)
function verifierAdresseOfficielle() {
  reserveProprietaire_();
  const p = urlProprieteOfficielle_(); let g = ''; try { g = String(ScriptApp.getService().getUrl() || ''); } catch (e) { }
  console.log('Propriété URL_OFFICIELLE : ' + (p || '(absente)') + (p && !MOTIF_URL_EXEC.test(p) ? '  → FORMAT INVALIDE (attendu : https://script.google.com/…/s/<ID de déploiement>/exec)' : ''));
  console.log('Adresse donnée par Google (getUrl) : ' + (g || '(aucune)') + (/\/dev$/.test(g) ? '  → adresse /dev : réservée aux éditeurs, à ne jamais partager' : ''));
  console.log('Adresse utilisée dans tous les liens : ' + (urlOfficielle_() || '(aucune)'));
  console.log('Identifiant du déploiement officiel : ' + ((urlOfficielle_().match(/\/s\/([A-Za-z0-9_-]+)\/exec$/) || [])[1] || '(inconnu)') + ' — doit être celui affiché dans Déployer > Gérer les déploiements, et ne jamais changer.');
  return urlOfficielle_();
}
function urlApp_(code, demandeId) {
  let url = urlOfficielle_();
  const p = [];
  if (code && config_().securite.mode !== 'google') p.push('c=' + encodeURIComponent(code));
  if (demandeId) p.push('d=' + encodeURIComponent(demandeId));
  return url + (p.length ? '?' + p.join('&') : '');
}
// Liens des e-mails de notification : aucune information de connexion, la page de connexion reste obligatoire
function lienPour_(email, demandeId) { return urlApp_('', demandeId); }

// ---------- Journal de sécurité (minimal) ----------
function journalSecu_(email, evenement, detail) {
  try { DB.ajouter('journal', { date: maintenant_(), email: email || '', evenement: evenement, detail: String(detail || '').slice(0, 300) }); } catch (e) { console.error('Journal : ' + e); }
}

// =====================================================================
// 6. SESSION
// =====================================================================
function session_(u) {
    const c = config_();
    const users = DB.tout('utilisateurs');
    return {
      mode_utilisateur: u.mode_utilisateur ? { role: u.mode_utilisateur, label: libRole_(c, u.mode_utilisateur) } : null,
      user: { email: u.email, nom: u.nom || '', role: u.role, roleLabel: libRole_(c, u.role), ul: u.ul || '', via: u.via, permissions: perms_(u), photo: miniPhoto_(u.email), preferences: preferences_(u) },
      session: { inactivite_min: c.securite.inactivite_min, avertissement_s: c.securite.avertissement_s, duree_max_h: c.securite.duree_max_h, via: u.via },
      fonctions: fonctionsPubliques_(),
      cfg: {
        identite: Object.assign({}, c.identite, { logo_src: logoSrc_(c) }), apparence: c.apparence, animations: c.animations, navigation: c.navigation, textes: c.textes, auth: c.securite.mode,
        demandes: { seuil_urgent: c.demandes.seuil_urgent, telephone: c.demandes.telephone, urgence_declaree: c.demandes.urgence_declaree, lien_drive: c.demandes.lien_drive, statuts: c.demandes.statuts, priorites: c.demandes.priorites, poles: c.demandes.poles, champs: c.demandes.champs },
        calendrier: { categories: c.calendrier.categories, statuts: c.calendrier.statuts }, ressources: c.ressources, presse: c.presse, pole_image: c.pole_image, profils: { photo: c.profils.photo, visibles: c.profils.visibles },
        roles: rolesCodes_(c).reduce((o, r) => { o[r] = libRole_(c, r); return o; }, {}),
        roles_actifs: rolesCodes_(c).filter(r => roleActif_(c, r)),
        liens: liensDossiers_(u),
        aide: c.aide,
        phototheque: { categories: c.phototheque.categories, types_contenu: c.phototheque.types_contenu, utilisations: c.phototheque.utilisations, taille_max_mo: c.phototheque.taille_max_mo, video_max_mo: c.phototheque.video_max_mo, export_max_mo: c.phototheque.export_max_mo,
          siege: peut_(u, 'phototheque_siege') && c.phototheque.siege.url ? c.phototheque.siege : null },
      },
      types: typesActifs_(),
      ul: DB.tout('ul').filter(x => String(x.actif).toUpperCase() !== 'NON').map(x => x.nom),
      equipe: (function () {
        const eq = users.filter(x => { const r = role_(x.role); return etatAcces_(x) === 'ok' && (r === 'admin' || ((c.roles[r] || {}).permissions || []).indexOf('demande_traiter') > -1); });
        const ph = c.profils.visibles.photo ? photosDe_(eq.map(x => x.email)) : {};
        return eq.map(x => ({ email: x.email, nom: x.nom || x.email, photo: ph[x.email] || '' }));
      })(),
      ressources: peut_(u, 'ressources_voir') ? ressourcesVisibles_(u) : [],
    };
}
function api_session(sid) { return appel_(sid, 'connecte', session_); }

// Liens directs vers les dossiers du Drive : réservés aux rôles de gestion (en principe membres du Drive partagé).
// Les autres personnes accèdent aux fichiers par l'application, sans aucun droit sur le Drive.
function liensDossiers_(u) {
  const o = {};
  [['image', 'image_gerer'], ['ressources', 'ressources_gerer'], ['modeles', 'ressources_gerer'], ['campagnes', 'ressources_gerer'], ['documents', 'ressources_gerer'], ['presse', 'ressources_gerer']].forEach(x => {
    if (peut_(u, x[1]) && infoDossier_(x[0]).actif && peutDossier_(u, x[0])) o[x[0]] = lienDossier_(x[0]);
  });
  return o;
}
function lienDossier_(cle) { const id = idDossier_(cle); return id ? 'https://drive.google.com/drive/folders/' + id : ''; }

function typesActifs_() {
  return DB.tout('types').filter(t => String(t.actif).toUpperCase() !== 'NON')
    .sort((a, b) => Number(a.ordre) - Number(b.ordre))
    .map(t => ({ code: t.code, libelle: t.libelle, description: t.description, delai: Number(t.delai) || 7, pole: t.pole,
      champs: String(t.champs || '').split(',').map(s => s.trim()).filter(Boolean),
      obligatoires: String(t.obligatoires || '').split(',').map(s => s.trim()).filter(Boolean) }));
}

// =====================================================================
// 7. STATUTS (configurables)
// =====================================================================
function statuts_() { return config_().demandes.statuts; }
function statut_(code) { return statuts_().find(s => s.code === code) || { code: code, label: code, ton: 'gris', classe: CLASSES_STATUT.indexOf(code) > -1 ? code : 'en_cours', notifier: false }; }
function classe_(code) { return statut_(code).classe; }
function estFerme_(code) { return CLASSES_FERMEES.indexOf(classe_(code)) > -1; }
function premierStatut_(classe) { const s = statuts_().find(x => x.classe === classe); return s ? s.code : classe; }
function labelStatut_(c) { return statut_(c).label; }

// =====================================================================
// 8. DEMANDES
// =====================================================================
function peutVoir_(u, d) {
  if (peut_(u, 'demande_voir_toutes') || peut_(u, 'demande_traiter')) return true;
  if (d.demandeur_email === u.email) return true;
  if (peut_(u, 'demande_voir_ul') && u.ul && d.ul === u.ul) return true;
  if (participants_(d).indexOf(u.email) > -1) return true;   // personne associée à la demande (3.15)
  return false;
}
// Personnes associées à une demande (suivi partagé) : gardées dans les détails de la demande, jamais fournies par le formulaire
function participants_(d) { try { const p = JSON.parse(d.details || '{}')._participants; return Array.isArray(p) ? p.map(String) : []; } catch (e) { return []; } }
function publicDemande_(d, u) {
  const o = Object.assign({}, d);
  try { o.details = d.details ? JSON.parse(d.details) : {}; } catch (e) { o.details = {}; }
  delete o._ligne; delete o.rappel_envoye;
  // Personnes associées : noms pour tous ceux qui voient la demande ; adresse seulement pour l'équipe
  const pa = Array.isArray(o.details._participants) ? o.details._participants : []; delete o.details._participants;
  if (pa.length || (u && d.demandeur_email === u.email)) o.participants = pa.map(e => ({ nom: nomDe_(e), cle: cleUtilisateur_(e), moi: !!u && e === u.email, email: u && peut_(u, 'demande_traiter') ? e : undefined }));
  if (u) o.associe = pa.indexOf(u.email) > -1;
  if (u && !peut_(u, 'demande_traiter') && d.demandeur_email !== u.email) { o.demandeur_email = ''; o.telephone = ''; }
  return o;
}

// Liste des demandes visibles. Les demandes archivées (souvent les plus nombreuses) ne sont envoyées qu'à la demande
// (onglet « Archivées », recherche générale).
function listeDemandes_(u, archivees) {
  return DB.tout('demandes').filter(d => peutVoir_(u, d) && (classe_(d.statut) === 'archivee') === !!archivees).map(d => publicDemande_(d, u))
    .sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le)));
}
function api_listeDemandes(sid, archivees, compact) { return appel_(sid, 'connecte', u => { const L = listeDemandes_(u, archivees === true); return compact === true ? colonnes_(L) : L; }); }
// Listes envoyées « en colonnes » (noms des champs une seule fois) : 40 à 60 % de données en moins pour les demandes et le
// calendrier ; l'interface reconstruit exactement les mêmes objets (champ absent ≠ champ vide).
const COL_ABSENT = '\u0001';
function colonnes_(L) {
  if (!Array.isArray(L) || !L.length) return L;
  const k = [], vu = {}; L.forEach(o => Object.keys(o).forEach(x => { if (!vu[x]) { vu[x] = true; k.push(x); } }));
  return { _col: 1, k: k, v: L.map(o => k.map(x => Object.prototype.hasOwnProperty.call(o, x) && o[x] !== undefined ? o[x] : COL_ABSENT)) };
}
function accueilCompact_(o) { if (o && o.demandes) o.demandes = colonnes_(o.demandes); if (o && o.calendrier) o.calendrier = colonnes_(o.calendrier); return o; }

// Fiche complète d'une demande (droits vérifiés) ; aussi renvoyée par les actions appelées avec avecFiche = true,
// ce qui évite un second aller-retour pour réafficher la demande après une action.
function avecFiche_(u, id, avecFiche, resultat) { if (avecFiche !== true) return resultat; let f = null; try { f = ficheDemande_(u, id); } catch (e) { } return { resultat: resultat, fiche: f }; }
function api_demande(sid, id) { return appel_(sid, 'connecte', u => ficheDemande_(u, id)); }
function ficheDemande_(u, id) {
  {
    const d = DB.trouver('demandes', 'id', id);
    if (!d || !peutVoir_(u, d)) throw Oups_('Cette demande n\'existe pas ou ne vous est pas accessible.');
    const notes = peut_(u, 'notes_internes');
    // Seuls les échanges de CETTE demande sont lus (colonne demande_id, puis le bloc de lignes concerné), jamais tout l'historique
    const hist = DB.lignesOu('historique', 'demande_id', id).filter(h => notes || String(h.interne).toUpperCase() !== 'OUI')
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return { demande: publicDemande_(d, u), pieces: piecesDe_(u, 'demande', d.id), photos: photosDemande_(u, d), projets: projetsDe_(u, 'demande', d.id), historique: hist.map(h => { const o = Object.assign({}, h); delete o._ligne; if (!peut_(u, 'demande_traiter') && h.auteur !== u.email) o.auteur = ''; return o; }) };
  }
}

function activite_(u) {
    const dem = {}; DB.tout('demandes').filter(d => peutVoir_(u, d)).forEach(d => dem[d.id] = d);
    const notes = peut_(u, 'notes_internes');
    // Les 10 derniers échanges visibles : l'historique est écrit dans l'ordre, les 400 dernières lignes suffisent presque
    // toujours (sinon, lecture complète comme avant)
    const garder = L => L.filter(h => dem[h.demande_id] && (notes || String(h.interne).toUpperCase() !== 'OUI'))
      .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 10);
    const H = DB.dernieres('historique', 400);
    let r = garder(H);
    if (r.length < 10 && H.length >= 400) r = garder(DB.tout('historique'));
    return r.map(h => ({ date: h.date, auteur_nom: h.auteur_nom || nomDe_(h.auteur), type: h.type, message: String(h.message).slice(0, 160), demande_id: h.demande_id, titre: dem[h.demande_id].titre }));
}

function calculPriorite_(echeance, delaiConseille, urgenceDeclaree) {
  const D = config_().demandes;
  const j = joursAvant_(echeance);
  if (j === null) return { delai: '', priorite: 'normale' };
  let p = j < D.seuil_urgent ? 'urgente' : j < delaiConseille ? 'courte' : 'normale';
  if (D.charge_max > 0 && p === 'normale' && j < delaiConseille * 1.5) {
    const ouvertes = DB.tout('demandes').filter(d => !estFerme_(d.statut)).length;
    if (ouvertes >= D.charge_max) p = 'courte';
  }
  if (urgenceDeclaree && D.urgence_declaree) {
    if (D.urgence_effet === 'urgente') p = 'urgente';
    else if (p === 'normale') p = 'courte';
  }
  return { delai: j, priorite: p };
}

function api_creerDemande(sid, p) {
  return appel_(sid, 'demande_creer', u => {
    const c = config_();
    const type = typesActifs_().find(t => t.code === p.type);
    if (!type) throw Oups_('Ce type de demande n\'est plus proposé. Rechargez la page et choisissez-en un autre.');
    const manque = [];
    if (!String(p.titre || '').trim()) manque.push('le titre');
    if (!String(p.ul || '').trim()) manque.push('l\'unité locale');
    if (!String(p.description || '').trim()) manque.push('la description');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.echeance || '')) manque.push('la date de besoin');
    if (c.demandes.telephone === 'obligatoire' && !String(p.telephone || '').trim()) manque.push('le téléphone');
    const details = Object.assign({}, p.details || {}); delete details._participants;
    type.obligatoires.forEach(k => {
      const ch = c.demandes.champs[k]; if (!ch || ch.type === 'files' || ch.type === 'consent') return;
      const v = details[k]; if (v === undefined || v === '' || (Array.isArray(v) && !v.length)) manque.push(ch.label.toLowerCase());
    });
    if (type.champs.indexOf('droit_image') > -1 && details.fichiers_prevus && !details.droit_image) manque.push('la confirmation du droit à l\'image');
    if (manque.length) throw Oups_('Il manque ' + manque.join(', ') + '.');
    if (details.lien && !/^https:\/\//i.test(details.lien)) throw Oups_('Le lien vers vos documents doit commencer par https://');
    if (details.urgence === 'oui' && !String(details.urgence_motif || '').trim()) throw Oups_('Précisez pourquoi la demande est urgente.');

    const nom = String(p.demandeur_nom || u.nom || '').trim().slice(0, 80);
    if (nom && !u.nom) DB.modifier('utilisateurs', 'email', u.email, { nom: nom });
    const pr = calculPriorite_(p.echeance, type.delai, details.urgence === 'oui');
    delete details.fichiers_prevus;
    // Photos de la photothèque choisies par le demandeur : seulement des identifiants qu'il peut voir (aucune copie de fichier)
    if (details.photos !== undefined) { const L = Array.isArray(details.photos) && peut_(u, 'phototheque_voir') ? photosLignes_() : []; details.photos = (Array.isArray(details.photos) ? details.photos : []).map(String).filter((id, i, t) => t.indexOf(id) === i && L.some(p => p.id === id && photoVisible_(u, p) && p.statut !== 'corbeille')).slice(0, 20); if (!details.photos.length) delete details.photos; }

    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    let d;
    try {
      d = {
        id: prochainNumero_(), cree_le: maintenant_(), maj_le: maintenant_(),
        demandeur_nom: nom, demandeur_email: u.email, telephone: String(p.telephone || '').trim().slice(0, 30),
        ul: String(p.ul).slice(0, 80), type: type.code, titre: String(p.titre).trim().slice(0, 150), description: String(p.description).trim().slice(0, 5000),
        details: JSON.stringify(details).slice(0, 20000), date_action: /^\d{4}-\d{2}-\d{2}$/.test(details.date_action || '') ? details.date_action : '', lieu: String(details.lieu || '').slice(0, 150),
        echeance: p.echeance, delai: pr.delai, priorite: pr.priorite, statut: premierStatut_('nouvelle'), responsable: '',
        livrable_url: '', dossier_url: '', cloture_le: '', photographe: '',
        autorisations: type.pole === 'image' ? (c.pole_image.autorisations[0] || {}).nom || '' : '', credit: '', rappel_envoye: '', selection_url: '',
      };
      DB.ajouter('demandes', d);
    } finally { lock.releaseLock(); }
    journal_(d.id, u, 'creation', 'Demande créée.' + (details.urgence === 'oui' ? ' Urgence déclarée : ' + details.urgence_motif : ''), false);

    const v = variablesDemande_(d, { delai: pr.delai, delai_conseille: type.delai, priorite_icone: iconePriorite_(pr.priorite) });
    const infos = tableau_([['Numéro', d.id], ['Type', type.libelle], ['UL / structure', d.ul], ['Pour le', dateFr_(d.echeance)]].concat(d.date_action ? [['Date de l\'action', dateFr_(d.date_action)]] : []));
    if (c.notifications.accuse) {
      const tard = pr.priorite !== 'normale' && details.urgence !== 'oui' ? encadre_(remplir_(c.notifications.modeles.tardive.texte, v), '#f8cbc0') : '';
      mailModele_(u.email, 'accuse', v, tard + infos + bouton_('Suivre ma demande', lienPour_(u.email, d.id)));
    }
    if (c.notifications.alerte_equipe) {
      destinatairesEquipe_().forEach(dest => mailModele_(dest, 'equipe_nouvelle', v,
        infos + tableau_([['Priorité', libellePriorite_(pr.priorite) + (pr.delai !== '' ? ' — ' + pr.delai + ' j pour ' + type.delai + ' j conseillés' : '') + (details.urgence === 'oui' ? ' — urgence déclarée' : '')]]) +
        citation_(d.description) + bouton_('Ouvrir la demande', lienPour_(dest, d.id)), u.email));
    }
    notifier_(destinatairesEquipe_(), { type: 'demande', titre: 'Nouvelle demande : ' + d.titre, texte: [d.id, type.libelle, d.ul, d.echeance ? 'pour le ' + dateFr_(d.echeance) : ''].filter(Boolean).join(' · '), lien: 'demande:' + d.id, cle: 'dem:' + d.id + ':nouvelle' }, u.email);
    if (/^B[0-9a-f]{10}$/.test(String(p.brouillon || ''))) { try { majPrefs_(u, q => { q.brouillons = (q.brouillons || []).filter(y => y.id !== p.brouillon); }); } catch (e) { } }
    return publicDemande_(d, u);
  });
}

function modifierDemande_(u, id, patch) {
    const c = config_();
    const d = DB.trouver('demandes', 'id', id);
    if (!d) throw Oups_('Cette demande n\'existe plus.');
    const traiter = peut_(u, 'demande_traiter');
    const permis = traiter ? ['statut', 'responsable', 'livrable_url', 'echeance', 'photographe', 'autorisations', 'credit', 'selection_url'] : ['photographe', 'autorisations', 'credit', 'selection_url'];
    const maj = {};
    permis.forEach(k => { if (patch[k] !== undefined && String(patch[k]) !== String(d[k])) maj[k] = String(patch[k]).trim().slice(0, 500); });
    const message = traiter ? String(patch.message || '').trim().slice(0, 5000) : '';
    if (!Object.keys(maj).length && !message) return publicDemande_(d, u);

    ['livrable_url', 'selection_url'].forEach(k => { if (maj[k] && !/^https:\/\//i.test(maj[k])) throw Oups_('Les liens doivent commencer par https://'); });
    if (maj.responsable && !DB.trouver('utilisateurs', 'email', maj.responsable)) throw Oups_('Cette personne ne fait pas partie des utilisateurs.');
    if (maj.echeance && !/^\d{4}-\d{2}-\d{2}$/.test(maj.echeance)) throw Oups_('Date d\'échéance invalide.');
    let classeNouv = null;
    if (maj.statut) {
      if (!statuts_().some(s => s.code === maj.statut)) throw Oups_('Ce statut n\'existe pas (ou plus). Rechargez la page.');
      classeNouv = classe_(maj.statut);
      if ((classeNouv === 'attente' || classeNouv === 'annulee') && !message) throw Oups_('Écrivez le message à envoyer au demandeur.');
      if (classeNouv === 'a_valider' && !(maj.livrable_url || d.livrable_url)) throw Oups_('Ajoutez d\'abord la proposition à faire valider (lien ou fichier).');
      const etaitFerme = estFerme_(d.statut), devientFerme = CLASSES_FERMEES.indexOf(classeNouv) > -1;
      if (devientFerme && !etaitFerme) maj.cloture_le = maintenant_();
      if (!devientFerme && etaitFerme) maj.cloture_le = '';
    }
    if (maj.echeance) {
      const t = typesActifs_().find(x => x.code === d.type);
      let urg = false; try { urg = JSON.parse(d.details || '{}').urgence === 'oui'; } catch (e) { }
      Object.assign(maj, calculPriorite_(maj.echeance, t ? t.delai : 7, urg));
      maj.rappel_envoye = '';
    }
    if (maj.responsable === undefined && classeNouv === 'en_cours' && !d.responsable) maj.responsable = u.email;
    maj.maj_le = maintenant_();
    DB.modifier('demandes', 'id', id, maj);
    const n = Object.assign({}, d, maj);

    const libelles = { statut: 'Statut', responsable: 'Pris en charge par', livrable_url: 'Livrable', echeance: 'Échéance', photographe: 'Photographe / vidéaste', autorisations: 'Autorisations', credit: 'Crédit', selection_url: 'Sélection d\'images' };
    Object.keys(maj).filter(k => libelles[k]).forEach(k => {
      let val = maj[k];
      if (k === 'statut') val = labelStatut_(val);
      if (k === 'responsable') val = nomDe_(val) || '—';
      if (k === 'echeance') val = dateFr_(val);
      journal_(id, u, k === 'statut' ? 'statut' : 'modif', libelles[k] + ' : ' + val, false);
    });
    if (message) journal_(id, u, 'message', message, false);

    if (maj.responsable && maj.responsable !== u.email) notifier_([maj.responsable], { type: 'demande', titre: 'Demande qui vous est confiée : ' + d.titre, texte: d.id + ' · par ' + (nomDe_(u.email) || u.email), lien: 'demande:' + id, cle: 'dem:' + id + ':attribution' }, u.email);
    if (maj.responsable && maj.responsable !== u.email && c.notifications.attribution) {
      mailModele_(maj.responsable, 'attribution', variablesDemande_(n, { auteur: nomDe_(u.email) }),
        tableau_([['Titre', d.titre], ['Pour le', dateFr_(n.echeance)]]) + bouton_('Ouvrir la demande', lienPour_(maj.responsable, id)));
    }
    notifierDemandeur_(n, maj.statut, message, u);
    return publicDemande_(n, u);
}
function api_modifierDemande(sid, id, patch, avecFiche) { return appel_(sid, ['demande_traiter', 'image_gerer'], u => avecFiche_(u, id, avecFiche, modifierDemande_(u, id, patch))); }

function notifierDemandeur_(d, codeStatut, message, auteur) {
  const c = config_();
  if (!d.demandeur_email || (!codeStatut && !message)) return;
  // Dans l'application : statut « à prévenir » (réglage de chaque statut) ou message de l'équipe ; indépendant des e-mails
  const sI = codeStatut ? statut_(codeStatut) : null;
  const suiveurs = [d.demandeur_email].concat(participants_(d));
  if (sI && sI.notifier) notifier_(suiveurs, { type: 'statut', titre: 'Votre demande : ' + sI.label, texte: d.titre + (message ? ' — « ' + String(message).slice(0, 140) + ' »' : ''), lien: 'demande:' + d.id, cle: 'dem:' + d.id + ':statut' }, auteur && auteur.email);
  else if (message) notifier_(suiveurs, { type: 'message', titre: 'Message de l\'équipe : ' + d.titre, texte: String(message).slice(0, 200), lien: 'demande:' + d.id, cle: 'dem:' + d.id + ':message' }, auteur && auteur.email);
  let modele = null;
  if (codeStatut) {
    const s = statut_(codeStatut);
    if (!c.notifications.changement_statut || !s.notifier || !MODELE_PAR_CLASSE[s.classe]) { if (!message || !c.notifications.messages) return; modele = 'message_equipe'; }
    else modele = MODELE_PAR_CLASSE[s.classe];
  } else {
    if (!c.notifications.messages) return;
    modele = 'message_equipe';
  }
  const v = variablesDemande_(d, { auteur: nomDe_(auteur.email) || 'L\'équipe communication', message: message });
  const cl = codeStatut ? classe_(codeStatut) : '';
  let extra = message ? citation_(message) : '';
  if ((cl === 'terminee' || cl === 'a_valider') && d.livrable_url) extra += bouton_(cl === 'a_valider' ? 'Voir la proposition' : 'Récupérer le livrable', d.livrable_url);
  mailModele_(d.demandeur_email, modele, v, extra + bouton_('Ouvrir ma demande', lienPour_(d.demandeur_email, d.id)));
}

function messageDemande_(u, id, message, interne, mentions) {
    const d = DB.trouver('demandes', 'id', id);
    if (!d || !peutVoir_(u, d)) throw Oups_('Cette demande n\'existe pas ou ne vous est pas accessible.');
    const traiter = peut_(u, 'demande_traiter');
    if (!traiter && d.demandeur_email !== u.email && participants_(d).indexOf(u.email) < 0 && !(peut_(u, 'demande_voir_ul') && d.ul === u.ul)) throw Oups_('Votre rôle permet de consulter cette demande, pas d\'y écrire.');
    message = String(message || '').trim().slice(0, 5000);
    if (!message) throw Oups_('Le message est vide.');
    const estInterne = interne === true && peut_(u, 'notes_internes');
    journal_(id, u, estInterne ? 'note' : 'message', message, estInterne);
    const maj = { maj_le: maintenant_() };
    if (!traiter && classe_(d.statut) === 'attente') { maj.statut = premierStatut_('en_cours'); journal_(id, u, 'statut', 'Statut : ' + labelStatut_(maj.statut) + ' (réponse reçue)', false); }
    DB.modifier('demandes', 'id', id, maj);
    // Personnes mentionnées (@) : prévenues personnellement, seulement si elles voient la demande (et les notes, pour une note)
    try { notifierMentions_(u, d, mentions, message, estInterne); } catch (e) { console.error('Mentions : ' + e); }
    if (estInterne) return true;
    if (traiter) notifierDemandeur_(d, null, message, u);
    else notifier_((d.responsable ? [d.responsable] : destinatairesEquipe_()).concat([d.demandeur_email], participants_(d)), { type: 'message', titre: 'Réponse sur la demande : ' + d.titre, texte: (u.nom || u.email) + ' : ' + message.slice(0, 180), lien: 'demande:' + id, cle: 'dem:' + id + ':reponse' }, u.email);
    if (!traiter && config_().notifications.messages) {
      const dests = d.responsable ? [d.responsable] : destinatairesEquipe_();
      dests.forEach(dest => mailModele_(dest, 'message_demandeur', variablesDemande_(d, {}), citation_(message) + bouton_('Ouvrir la demande', lienPour_(dest, id)), d.demandeur_email));
    }
    return true;
}
function api_message(sid, id, message, interne, avecFiche, mentions) { return appel_(sid, 'connecte', u => avecFiche_(u, id, avecFiche, messageDemande_(u, id, message, interne, mentions))); }

function decisionValidation_(u, id, decision, message) {
    const d = DB.trouver('demandes', 'id', id);
    if (!d || !peutVoir_(u, d)) throw Oups_('Cette demande n\'existe pas ou ne vous est pas accessible.');
    if (d.demandeur_email !== u.email && !peut_(u, 'demande_traiter')) throw Oups_('Seul le demandeur peut valider la proposition.');
    if (classe_(d.statut) !== 'a_valider') throw Oups_('Cette demande n\'attend plus de validation.');
    message = String(message || '').trim().slice(0, 5000);
    const ok = decision === 'ok';
    if (!ok && !message) throw Oups_('Précisez la modification souhaitée.');
    const maj = ok ? { statut: premierStatut_('terminee'), cloture_le: maintenant_(), maj_le: maintenant_() } : { statut: premierStatut_('en_cours'), maj_le: maintenant_() };
    DB.modifier('demandes', 'id', id, maj);
    journal_(id, u, 'statut', ok ? 'Proposition validée par le demandeur' : 'Modification demandée', false);
    if (message) journal_(id, u, 'message', message, false);
    const dests = d.responsable ? [d.responsable] : destinatairesEquipe_();
    const v = variablesDemande_(d, { decision: ok ? 'Proposition validée ✔' : 'Modification demandée' });
    dests.forEach(dest => mailModele_(dest, 'validation', v, (message ? citation_(message) : '') + bouton_('Ouvrir la demande', lienPour_(dest, id))));
    notifier_(dests, { type: 'demande', titre: (ok ? 'Proposition validée : ' : 'Modification demandée : ') + d.titre, texte: d.id + (message ? ' — « ' + message.slice(0, 140) + ' »' : ''), lien: 'demande:' + id, cle: 'dem:' + id + ':validation' }, u.email);
    if (ok) notifierDemandeur_(Object.assign({}, d, maj), maj.statut, '', u);
    return true;
}
function api_decisionValidation(sid, id, decision, message, avecFiche) { return appel_(sid, 'connecte', u => avecFiche_(u, id, avecFiche, decisionValidation_(u, id, decision, message))); }

// Ancien point d'entrée (formulaire de demande, livrable) : passe désormais par le système commun des fichiers joints
function api_televerser(sid, id, fichier, estLivrable) {
  return appel_(sid, 'connecte', u => {
    const d = DB.trouver('demandes', 'id', id);
    if (!d || !peutVoir_(u, d)) throw Oups_('Cette demande n\'existe pas ou ne vous est pas accessible.');
    const traiter = peut_(u, 'demande_traiter');
    if (!traiter && d.demandeur_email !== u.email && participants_(d).indexOf(u.email) < 0) throw Oups_('Votre rôle ne permet pas d\'ajouter un fichier à cette demande.');
    const r = joindre_(u, 'demande', id, estLivrable && traiter ? 'livrable' : 'joint', fichier);
    const maj = { maj_le: maintenant_() };
    if (r.p.usage === 'livrable') {
      try { r.f.addViewer(d.demandeur_email); } catch (e) { try { r.f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) { } }
      maj.livrable_url = r.f.getUrl();
    }
    DB.modifier('demandes', 'id', id, maj);
    return { nom: r.f.getName(), url: r.f.getUrl(), livrable_url: maj.livrable_url || d.livrable_url, piece: piecePublique_(r.p, u, r.ctx, r.obj) };
  });
}
function nomFichier_(n) { return String(n || 'fichier').replace(/[\\/:*?"<>|]/g, '_').slice(0, 120); }

function dossierDemande_(d) {
  if (d.dossier_url) { const id = idDepuisLien_(d.dossier_url); if (id) { try { return DriveApp.getFolderById(id); } catch (e) { } } }
  const f = dossier_('fichiers_demandes').createFolder(d.id + ' — ' + String(d.titre).slice(0, 60));
  DB.modifier('demandes', 'id', d.id, { dossier_url: f.getUrl() });
  d.dossier_url = f.getUrl();
  return f;
}

// =====================================================================
// 9. CALENDRIER (événements saisis + demandes datées + journées récurrentes)
// =====================================================================
function calendrier_(u) {
    const c = config_();
    const types = {}; typesActifs_().forEach(t => types[t.code] = t.libelle);
    const ev = DB.tout('calendrier').map(x => ({ id: x.id, source: 'calendrier', date: x.date, date_fin: x.date_fin, categorie: x.categorie, titre: x.titre, ul: x.ul, canal: x.canal, responsable: x.responsable, statut: x.statut, notes: x.notes }));
    DB.tout('demandes').filter(d => d.date_action && classe_(d.statut) !== 'annulee').forEach(d => {
      ev.push({ id: d.id, source: 'demande', date: d.date_action, date_fin: '', categorie: c.calendrier.categorie_demandes, titre: d.titre, ul: d.ul, canal: types[d.type] || d.type,
        responsable: d.responsable, statut: labelStatut_(d.statut), notes: '', lisible: peutVoir_(u, d) });
    });
    // Échéances des demandes ouvertes que la personne voit (3.26)
    DB.tout('demandes').filter(d => d.echeance && !estFerme_(d.statut) && d.echeance !== d.date_action && peutVoir_(u, d)).forEach(d => {
      ev.push({ id: d.id, source: 'echeance', date: d.echeance, date_fin: '', categorie: CAT_ECHEANCE_, titre: 'Échéance : ' + d.titre, ul: d.ul, canal: types[d.type] || d.type,
        responsable: d.responsable, statut: labelStatut_(d.statut), notes: '', lisible: true });
    });
    // Réservations de matériel (3.26) : les siennes ; toutes pour qui gère le matériel ou les réservations. Fenêtre : -60 j / +365 j
    if (peut_(u, 'materiel_voir')) {
      try {
        const tout = peut_(u, 'reservations_gerer') || peut_(u, 'materiel_gerer'), noms = nomsMateriel_(), now = minuteActuelle_();
        const du = isoJour_(new Date(Date.now() - 60 * 864e5)), au = isoJour_(new Date(Date.now() + 365 * 864e5)), lib = { attente: 'En attente', confirmee: 'Confirmée', terminee: 'Terminée' };
        reservationsLignes_().filter(r => RESA_BLOQUANTS.concat(['terminee']).indexOf(statutEffectif_(r, now)) > -1 && (tout || r.email === u.email) && String(r.fin).slice(0, 10) >= du && String(r.debut).slice(0, 10) <= au).forEach(r => {
          const fin = r.journee === 'OUI' ? isoJour_(new Date(dateDe_(String(r.fin).slice(0, 10)).getTime() - 864e5)) : String(r.fin).slice(0, 10);
          ev.push({ id: r.id, source: 'reservation', date: String(r.debut).slice(0, 10), date_fin: fin > String(r.debut).slice(0, 10) ? fin : '', categorie: CAT_RESA_, titre: (noms[r.materiel_id] || 'Matériel') + (tout && r.email !== u.email ? ' · ' + (r.nom || r.email) : ''),
            ul: '', canal: '', responsable: '', statut: lib[statutEffectif_(r, now)] || '', notes: periodeTexte_(r) + (r.lieu ? ' · ' + r.lieu : ''), lisible: true });
        });
      } catch (e) { console.error('Calendrier : réservations ' + e); }
    }
    const an = new Date().getFullYear();
    [an - 1, an, an + 1].forEach(a => c.calendrier.recurrents.forEach((r, i) => {
      const d = dateRecurrente_(r, a);
      if (d) ev.push({ id: 'R' + i + '-' + a, source: 'recurrent', date: d, date_fin: '', categorie: r.categorie, titre: r.titre, ul: '', canal: '', responsable: '', statut: '', notes: 'Journée récurrente (Administration > Calendrier).' });
    }));
    return ev;
}
function api_calendrier(sid, compact) { return appel_(sid, 'calendrier_voir', u => { const L = calendrier_(u); return compact === true ? colonnes_(L) : L; }); }
const CAT_ECHEANCE_ = 'Échéance', CAT_RESA_ = 'Réservation de matériel';

function dateRecurrente_(r, an) {
  if (r.regle === 'date') { const d = new Date(an, r.mois - 1, r.jour); return d.getMonth() === r.mois - 1 ? isoJour_(d) : null; }
  if (r.rang === -1) { const d = new Date(an, r.mois, 0); while (d.getDay() !== r.jour_semaine) d.setDate(d.getDate() - 1); return isoJour_(d); }
  const d = new Date(an, r.mois - 1, 1);
  while (d.getDay() !== r.jour_semaine) d.setDate(d.getDate() + 1);
  d.setDate(d.getDate() + 7 * (r.rang - 1));
  return d.getMonth() === r.mois - 1 ? isoJour_(d) : null;
}

function api_enregistrerEvenement(sid, e) {
  return appel_(sid, 'calendrier_modifier', u => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date || '')) throw Oups_('Indiquez une date valide.');
    if (!String(e.titre || '').trim()) throw Oups_('Indiquez un titre.');
    if (e.date_fin && (!/^\d{4}-\d{2}-\d{2}$/.test(e.date_fin) || e.date_fin < e.date)) throw Oups_('La date de fin doit être après la date de début.');
    const o = { date: e.date, date_fin: e.date_fin || '', categorie: String(e.categorie || '').slice(0, 40), titre: String(e.titre).trim().slice(0, 150), ul: String(e.ul || '').slice(0, 80), canal: String(e.canal || '').slice(0, 150), responsable: e.responsable || '', statut: e.statut || 'Prévu', notes: String(e.notes || '').slice(0, 2000) };
    if (e.id) { if (!DB.trouver('calendrier', 'id', e.id)) throw Oups_('Cet élément a été supprimé entre-temps.'); DB.modifier('calendrier', 'id', e.id, o); o.id = e.id; }
    else { o.id = 'C' + Utilities.getUuid().slice(0, 8); DB.ajouter('calendrier', o); }
    return o;
  });
}
function api_supprimerEvenement(sid, id) { return appel_(sid, 'calendrier_modifier', u => { DB.supprimer('calendrier', 'id', id); return true; }); }

// =====================================================================
// 10. SOLLICITATIONS PRESSE (module léger, masqué par défaut)
// =====================================================================
function presse_(u) {
  let P = []; try { P = piecesLignes_().filter(x => x.contexte === 'presse' && x.etat !== 'retiree'); } catch (e) { }
  const ctx = CONTEXTES_PJ.presse;
  return DB.tout('presse').map(p => { const o = Object.assign({}, p); delete o._ligne; o.pieces = P.filter(x => x.ref === p.id).map(x => piecePublique_(x, u, ctx, p)); return o; }).sort((a, b) => String(b.recue_le).localeCompare(String(a.recue_le)));
}
function api_presse(sid) { return appel_(sid, 'presse', presse_); }
// Tableau de bord : toutes les données de l'accueil en UN appel (au lieu de 4 à 6), mêmes règles d'accès que les appels séparés
function accueil_(u, recentes) {
  const o = { demandes: listeDemandes_(u, false), activite: [], le: maintenant_() };
  try { o.activite = activite_(u); } catch (e) { }
  try { const aj = activiteJournal_(u); if (aj.length) o.activite = o.activite.concat(aj).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12); } catch (e) { }
  try { o.notifications = notificationsDe_(u); } catch (e) { o.notifications = null; }
  try { o.favoris = mesFavoris_(u); } catch (e) { o.favoris = []; }
  try { const an = annonceActive_(); if (an) o.annonce_cle = cleAnnonce_(an); } catch (e) { }
  if (peut_(u, 'calendrier_voir')) o.calendrier = calendrier_(u);
  if (peut_(u, 'presse')) o.presse = presse_(u);
  if (peut_(u, 'admin')) { try { o.resume_admin = resumeAdmin_(u); } catch (e) { o.resume_admin = null; } }
  if (peut_(u, 'phototheque_voir')) {
    try { o.resume_phototheque = resumePhototheque_(u); } catch (e) { o.resume_phototheque = null; }
    // « Consultés récemment » (mémoire de l'appareil) : seules les photos encore visibles pour cette personne sont confirmées
    const rp = recentes && Array.isArray(recentes.photos) ? recentes.photos : [];
    if (rp.length) { try { const ids = rp.slice(0, 12).map(String), idx = {}; indexPhotos_().forEach(p => { if (ids.indexOf(p.id) > -1) idx[p.id] = p; }); o.photos_recentes = ids.filter(id => idx[id] && idx[id].statut !== 'corbeille' && photoVisible_(u, idx[id])); } catch (e) { } }
  }
  if (peut_(u, 'materiel_voir')) { try { o.resume_materiel = resumeMateriel_(u); } catch (e) { o.resume_materiel = null; } }
  // Messages de la délégation (3.28) : 4 derniers, joints au tableau de bord (aucun appel séparé)
  try { o.diffusions = resumeDiffusions_(u); } catch (e) { }
  // Projets (3.29) : même liste que api_projets (mêmes contrôles), jointe au tableau de bord pour éviter un appel de plus ;
  // au-delà de 60 Ko, l'interface la demande à part comme avant.
  if (peut_(u, 'projets_voir')) { try { const L = listeProjets_(u); if (JSON.stringify(L).length < 60000) o.projets = L; } catch (e) { } }
  // Demandes consultées récemment (archivées comprises) : seulement celles que la personne peut voir
  const rd = recentes && Array.isArray(recentes.demandes) ? recentes.demandes.slice(0, 12).map(String) : [];
  if (rd.length) o.demandes_recentes = DB.tout('demandes').filter(d => rd.indexOf(d.id) > -1 && peutVoir_(u, d)).map(d => ({ id: d.id, titre: d.titre }));
  return o;
}
// Retour au tableau de bord : si rien n'a changé depuis la dernière réponse (empreinte envoyée par le navigateur), seule
// l'empreinte repart (quelques octets au lieu de toutes les demandes et du calendrier). Le contenu est toujours recalculé
// ici, avec les droits actuels : l'empreinte ne donne jamais accès à rien.
function api_accueil(sid, recentes, empreintePrec, compact) {
  return appel_(sid, 'connecte', u => {
    const o = accueilEmpreinte_(u, recentes);
    if (o.empreinte && typeof empreintePrec === 'string' && empreintePrec === o.empreinte) return { inchange: true, empreinte: o.empreinte, le: o.le };
    return compact === true ? accueilCompact_(o) : o;
  });
}
function accueilEmpreinte_(u, recentes) {
  const o = accueil_(u, recentes), le = o.le; delete o.le;
  let e = ''; try { e = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, JSON.stringify(o)).map(x => ('0' + (x & 255).toString(16)).slice(-2)).join(''); } catch (x) { }
  o.le = le; o.empreinte = e; return o;
}
// Ouverture de l'application : profil, réglages et (si l'accueil s'affiche) ses données, en un seul aller-retour
function api_demarrage(sid, avecAccueil, compact) {
  return appel_(sid, 'connecte', u => { try { diffusionsDues_(); } catch (e) { console.error(e); } let a = null; if (avecAccueil === true) { try { a = accueilEmpreinte_(u); if (compact === true) accueilCompact_(a); } catch (e) { a = null; } } let n = null; if (!a) { try { n = notificationsDe_(u); } catch (e) { } } return { session: session_(u), accueil: a, notifications: a ? a.notifications : n }; });   // accueil indisponible : redemandé par l'interface ; notifications toujours jointes (cloche)
}

function api_enregistrerPresse(sid, p) {
  return appel_(sid, 'presse', u => {
    const c = config_();
    if (!String(p.sujet || '').trim() || !String(p.media || '').trim()) throw Oups_('Le média et le sujet sont obligatoires.');
    if (p.retombee_url && !/^https:\/\//i.test(p.retombee_url)) throw Oups_('Le lien de la retombée doit commencer par https://');
    const cles = TABLES.presse.cols.filter(k => k !== 'id' && k !== 'maj_le' && k !== 'pieces');
    const o = {}; cles.forEach(k => o[k] = String(p[k] == null ? '' : p[k]).trim().slice(0, 3000));
    if (!o.recue_le) o.recue_le = aujourdhui_();
    if (!o.statut) o.statut = (c.presse.statuts[0] || {}).nom || 'À traiter';
    o.maj_le = maintenant_();
    const ancien = p.id ? DB.trouver('presse', 'id', p.id) : null;
    if (p.id) { if (!ancien) throw Oups_('Cette sollicitation a été supprimée entre-temps.'); DB.modifier('presse', 'id', p.id, o); o.id = p.id; }
    else { o.id = 'P' + Utilities.getUuid().slice(0, 8); DB.ajouter('presse', o); }
    o.pieces = piecesDe_(u, 'presse', o.id);
    if (o.responsable && o.responsable !== u.email && (!ancien || ancien.responsable !== o.responsable) && c.notifications.attribution) {
      mailModele_(o.responsable, 'presse_attribution', { media: o.media, auteur: nomDe_(u.email) },
        tableau_([['Média', o.media], ['Journaliste', o.journaliste || '—'], ['Sujet', o.sujet], ['Réponse attendue', o.echeance ? dateFr_(o.echeance) : '—']]) +
        bouton_('Ouvrir le ' + c.identite.nom_centre, lienPour_(o.responsable)));
    }
    return o;
  });
}

// =====================================================================
// 11. PROFIL PERSONNEL (Mon profil) ET PHOTOS DE PROFIL
// Chaque personne ne modifie QUE son propre profil : l'adresse vient de la session (jamais du navigateur),
// le rôle et les permissions ne sont jamais modifiables ici. Photos rangées dans le dossier « Photos de profil »
// du Drive partagé, servies par l'application (aucun accès direct au Drive n'est nécessaire).
// =====================================================================
const PREFS = { theme: ['', 'clair', 'sombre', 'auto'], animations: ['', 'aucune', 'minimale', 'standard', 'dynamique'], densite: ['', 'compacte', 'normale', 'aeree'], taille: ['', 'petite', 'normale', 'grande'],
  ouverture: ['', 'accueil', 'demandes', 'calendrier', 'materiel', 'ressources', 'phototheque', 'nouvelle'] };
const RACCOURCIS_CLES = ['nouvelle', 'demandes', 'ressources', 'phototheque', 'materiel', 'calendrier', 'image', 'aide', 'profil'];
// Disposition personnelle du tableau de bord (3.27) : gardée dans les préférences du compte (même système que le thème,
// les favoris, les brouillons). Strictement individuelle. Les identifiants inconnus sont conservés (un module réservé à une
// permission retirée réapparaît à sa place si la permission revient) ; le navigateur n'affiche que les modules permis.
const TABLEAU_ZONES = ['H', 'P', 'C'];
function nettoyerTableau_(t) {
  if (!t || typeof t !== 'object' || Array.isArray(t)) return null;
  const id = x => /^[a-z_]{1,30}$/.test(String(x || ''));
  const vus = {}, mods = (Array.isArray(t.modules) ? t.modules : []).filter(m => m && id(m.id) && !vus[m.id] && (vus[m.id] = true)).slice(0, 40)
    .map(m => ({ id: m.id, z: TABLEAU_ZONES.indexOf(m.z) > -1 ? m.z : 'C', h: m.h === true }));
  const va = {}, act = (Array.isArray(t.actions) ? t.actions : []).map(String).filter(a => /^[a-z_:]{1,40}$/.test(a) && !va[a] && (va[a] = true)).slice(0, 30);
  const vm = {}, am = (Array.isArray(t.actions_masquees) ? t.actions_masquees : []).map(String).filter(a => /^[a-z_:]{1,40}$/.test(a) && !vm[a] && (vm[a] = true)).slice(0, 30);
  return { v: 1, modules: mods, actions: Array.isArray(t.actions) ? act : null, actions_masquees: am, maj: String(t.maj || '').slice(0, 25) };
}
// Préférences d'affichage modifiées sur place (thème, densité, disposition du tableau de bord) : enregistrées aussitôt,
// seulement pour la personne connectée. tableau = null : retour à la disposition par défaut.
function api_mesPreferences(sid, patch) {
  return appel_(sid, 'connecte', u => {
    patch = patch && typeof patch === 'object' ? patch : {};
    return majPrefs_(u, p => {
      ['theme', 'densite'].forEach(k => { if (patch[k] !== undefined) { const v = String(patch[k] || ''); if (PREFS[k].indexOf(v) < 0) throw Oups_('Valeur non autorisée.'); p[k] = v; } });
      if (patch.tableau !== undefined) { if (patch.tableau === null) delete p.tableau; else { const t = nettoyerTableau_(patch.tableau); if (!t) throw Oups_('Disposition illisible.'); t.maj = maintenant_(); p.tableau = t; } }
      return { theme: p.theme || '', densite: p.densite || '', tableau: nettoyerTableau_(p.tableau) };
    });
  });
}
function preferences_(u) {
  const p = prefsBrutes_(u);
  const o = {}; Object.keys(PREFS).forEach(k => { o[k] = PREFS[k].indexOf(String(p[k] || '')) > -1 ? String(p[k] || '') : ''; });
  o.raccourcis = (Array.isArray(p.raccourcis) ? p.raccourcis : []).filter(k => RACCOURCIS_CLES.indexOf(k) > -1).slice(0, 4);
  o.brouillons = resumeBrouillons_(p);
  o.modeles_demande = resumeModeles_(p);
  o.tableau = nettoyerTableau_(p.tableau);
  o.favoris = (Array.isArray(p.favoris) ? p.favoris : []).filter(f => f && FAVORIS_TYPES.indexOf(f.t) > -1).map(f => ({ t: f.t, id: String(f.id) }));
  return o;
}
function photosTable_() { try { return DB.tout('photos'); } catch (e) { return []; } }
function miniPhoto_(email) { const p = photosTable_().find(x => x.email === email); return p && p.mini ? p.mini : ''; }
function photosDe_(emails) { const t = photosTable_(), o = {}; t.forEach(p => { if (p.mini && emails.indexOf(p.email) > -1) o[p.email] = p.mini; }); return o; }

// Type réel d'une image d'après ses premiers octets (les octets Apps Script sont signés : & 255)
function typeImage_(oct) {
  const b = i => (oct[i] & 255);
  if (!oct || oct.length < 12) return '';
  if (b(0) === 0xFF && b(1) === 0xD8 && b(2) === 0xFF) return 'image/jpeg';
  if (b(0) === 0x89 && b(1) === 0x50 && b(2) === 0x4E && b(3) === 0x47) return 'image/png';
  if (b(0) === 0x52 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x46 && b(8) === 0x57 && b(9) === 0x45 && b(10) === 0x42 && b(11) === 0x50) return 'image/webp';
  return '';
}
function decoder64_(s) { try { return Utilities.base64Decode(String(s || '')); } catch (e) { throw Oups_('Fichier illisible.'); } }

function api_monProfil(sid) {
  return appel_(sid, 'connecte', u => {
    const c = config_();
    return { profil: profilPublic_(u, c), preferences: preferences_(u), photo: miniPhoto_(u.email),
      formulaire: { ul: DB.tout('ul').filter(x => String(x.actif).toUpperCase() !== 'NON').map(x => x.nom), fonctions: c.inscription.fonctions, telephone: c.inscription.telephone, photo: c.profils.photo, photo_max_ko: c.profils.photo_max_ko },
      visibles: c.profils.visibles };
  });
}

function api_enregistrerMonProfil(sid, champs) {
  return appel_(sid, 'connecte', u => {
    const c = config_(); champs = champs || {};
    const txt = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
    const p = { prenom: txt(champs.prenom, 60), nom_famille: txt(champs.nom_famille, 60), ul: txt(champs.ul, 80), fonction: txt(champs.fonction, 80), telephone: txt(champs.telephone, 30) };
    const manque = [];
    if (!p.prenom) manque.push('le prénom'); if (!p.nom_famille) manque.push('le nom'); if (!p.fonction) manque.push('la fonction');
    const ulActives = DB.tout('ul').filter(x => String(x.actif).toUpperCase() !== 'NON').map(x => x.nom);
    if (ulActives.indexOf(p.ul) === -1 && p.ul !== (u.ul || '')) manque.push('une unité locale ou délégation de la liste');
    if (c.inscription.telephone === 'masque') p.telephone = u.telephone || '';
    else { if (c.inscription.telephone === 'obligatoire' && !p.telephone) manque.push('le téléphone'); if (p.telephone && !/^[+0-9 ().\-]{6,30}$/.test(p.telephone)) manque.push('un numéro de téléphone valide'); }
    if (manque.length) throw Oups_('Il manque ' + manque.join(', ') + '.');
    const src = champs.preferences || {}, pr = prefsBrutes_(u);   // favoris et brouillons conservés
    Object.keys(PREFS).forEach(k => { pr[k] = PREFS[k].indexOf(String(src[k] || '')) > -1 ? String(src[k] || '') : ''; });
    pr.raccourcis = (Array.isArray(src.raccourcis) ? src.raccourcis : []).filter((k, i, a) => RACCOURCIS_CLES.indexOf(k) > -1 && a.indexOf(k) === i).slice(0, 4);
    const maj = {}, diff = [];
    Object.keys(p).forEach(k => { if (p[k] !== String(u[k] || '')) { maj[k] = p[k]; diff.push(k); } });
    const prefs = JSON.stringify(pr);
    if (prefs !== (u.preferences || '{}')) { maj.preferences = prefs; diff.push('préférences'); }
    if (!diff.length) return { profil: profilPublic_(u, c), preferences: preferences_(u), change: false };
    if (maj.prenom !== undefined || maj.nom_famille !== undefined) maj.nom = (p.prenom + ' ' + p.nom_famille).trim();
    maj.modifie_le = maintenant_();
    // Rôle, adresse, accès et permissions ne font JAMAIS partie de cette mise à jour
    DB.modifier('utilisateurs', 'email', u.email, maj);
    journalSecu_(u.email, 'profil_modifie', 'Par la personne : ' + diff.join(', '));
    const x = DB.trouver('utilisateurs', 'email', u.email);
    return { profil: profilPublic_(x, c), preferences: preferences_(x), change: true };
  });
}

function api_photoProfil(sid, photo) {
  return appel_(sid, 'connecte', u => {
    const c = config_();
    if (!c.profils.photo) throw Oups_('Les photos de profil sont désactivées par l\'administrateur.');
    exigerFonction_('photos');
    photo = photo || {};
    const oct = decoder64_(photo.data);
    const max = c.profils.photo_max_ko * 1024;
    if (!oct.length) throw Oups_('Image vide.');
    if (oct.length > max) throw Oups_('Photo trop lourde (' + c.profils.photo_max_ko + ' Ko maximum après compression).');
    const type = typeImage_(oct);
    if (!type) throw Oups_('Format non reconnu : JPG, PNG ou WEBP uniquement.');
    const mini = String(photo.mini || '');
    const mm = mini.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!mm || mini.length > 24000 || !typeImage_(decoder64_(mm[2]))) throw Oups_('Miniature invalide.');
    const ext = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[type];
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const ancienne = photosTable_().find(x => x.email === u.email) || null;
      const f = ecritureDrive_('photos', () => dossier_('profils').createFile(Utilities.newBlob(oct, type, 'photo_' + Utilities.getUuid().slice(0, 12) + '.' + ext)));
      f.setDescription(MARQUE_APP + 'photo');
      const ligne = { email: u.email, fichier_id: f.getId(), mini: mini, maj_le: maintenant_() };
      if (ancienne) DB.modifier('photos', 'email', u.email, ligne); else DB.ajouter('photos', ligne);
      // Remplacement : l'ancienne photo part à la corbeille du Drive partagé (aucun fichier orphelin)
      if (ancienne && ancienne.fichier_id && !mettreCorbeille_(ancienne.fichier_id)) journalSecu_(u.email, 'drive_echec', 'Ancienne photo non supprimée : ' + ancienne.fichier_id);
      journalSecu_(u.email, 'photo_modifiee', ancienne ? 'Photo remplacée' : 'Photo ajoutée');
      return { photo: mini };
    } finally { lock.releaseLock(); }
  });
}
function supprimerPhoto_(email, auteur) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    DB.relire();
    const p = photosTable_().find(x => x.email === email);
    if (!p) return false;
    if (p.fichier_id && !mettreCorbeille_(p.fichier_id)) journalSecu_(auteur, 'drive_echec', 'Photo non supprimée du Drive : ' + p.fichier_id);
    DB.supprimer('photos', 'email', email);
    journalSecu_(auteur, 'photo_supprimee', auteur === email ? 'Par la personne' : email);
    return true;
  } finally { lock.releaseLock(); }
}
function api_supprimerPhoto(sid) { return appel_(sid, 'connecte', u => supprimerPhoto_(u.email, u.email)); }
function api_supprimerPhotoUtilisateur(sid, email) {
  return appel_(sid, 'admin', u => { email = String(email || '').toLowerCase(); if (!DB.trouver('utilisateurs', 'email', email)) throw Oups_('Ce profil n\'existe pas.'); return supprimerPhoto_(email, u.email); });
}
// Photo en grand : la personne elle-même, un administrateur, ou tout le monde si les photos sont visibles (réglage)
function api_photo(sid, email) {
  return appel_(sid, 'connecte', u => {
    email = String(email || '').toLowerCase();
    if (email !== u.email && !peut_(u, 'admin') && !config_().profils.visibles.photo) throw Oups_('Photo non visible.');
    const p = photosTable_().find(x => x.email === email);
    if (!p || !p.fichier_id) return '';
    const f = fichierApp_(p.fichier_id);
    if (!f) return p.mini || '';
    const b = f.getBlob();
    return 'data:' + (typeImage_(b.getBytes()) || 'image/jpeg') + ';base64,' + Utilities.base64Encode(b.getBytes());
  });
}
// Carte d'une personne vue par une autre : uniquement les champs rendus visibles dans Administration > Profils
function api_carteProfil(sid, email) {
  return appel_(sid, 'connecte', u => {
    email = String(email || '').toLowerCase();
    const x = DB.trouver('utilisateurs', 'email', email);
    if (!x || etatAcces_(x) !== 'ok') throw Oups_('Profil indisponible.');
    const c = config_(), V = c.profils.visibles, admin = peut_(u, 'admin'), equipe = peut_(u, 'demande_traiter');
    const cible = role_(x.role), cibleEquipe = cible === 'admin' || ((c.roles[cible] || {}).permissions || []).indexOf('demande_traiter') > -1;
    if (!admin && !equipe && !cibleEquipe && email !== u.email) throw Oups_('Profil indisponible.');
    return { nom: x.nom || '', photo: (V.photo || admin || email === u.email) ? miniPhoto_(email) : '', ul: (V.ul || admin || equipe) ? x.ul || '' : '', fonction: (V.fonction || admin || equipe) ? x.fonction || '' : '',
      email: (V.email || admin || equipe) ? x.email : '', telephone: (V.telephone || admin) ? x.telephone || '' : '' };
  });
}

// =====================================================================
// 12. RESSOURCES : LIEN EXTERNE OU FICHIER INTERNE DU DRIVE PARTAGÉ
// - Chaque ressource a un identifiant INTERNE stable (R-xxxxxxxx) ; l'identifiant Drive du fichier est conservé
//   sur le serveur et n'est JAMAIS accepté depuis le navigateur (seulement créé par l'import).
// - Les fichiers sont lus par le compte d'exécution et servis par l'application : l'utilisateur n'a pas besoin
//   d'être membre du Drive partagé ; il n'obtient aucun droit sur le Drive.
// - Chaque accès vérifie : session, permission de la ressource, permission du dossier, état publié, fichier
//   toujours rangé dans un dossier de l'application.
// =====================================================================
const MARQUE_APP = 'centre-com:';
const EXTENSIONS_INTERDITES = ['exe', 'bat', 'cmd', 'com', 'js', 'mjs', 'vbs', 'ps1', 'sh', 'html', 'htm', 'xhtml', 'svg', 'jar', 'msi', 'scr', 'dll', 'php', 'hta', 'lnk', 'app', 'apk', 'reg'];
const TYPES_FICHIER = {
  pdf: ['application/pdf', 'PDF'], doc: ['application/msword', 'OLE'], docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'PK'],
  xls: ['application/vnd.ms-excel', 'OLE'], xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'PK'],
  ppt: ['application/vnd.ms-powerpoint', 'OLE'], pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'PK'],
  odt: ['application/vnd.oasis.opendocument.text', 'PK'], ods: ['application/vnd.oasis.opendocument.spreadsheet', 'PK'], odp: ['application/vnd.oasis.opendocument.presentation', 'PK'],
  zip: ['application/zip', 'PK'], jpg: ['image/jpeg', 'JPG'], jpeg: ['image/jpeg', 'JPG'], png: ['image/png', 'PNG'], webp: ['image/webp', 'WEBP'], gif: ['image/gif', 'GIF'],
  txt: ['text/plain', ''], csv: ['text/csv', ''], mp4: ['video/mp4', ''], mp3: ['audio/mpeg', ''],
};
const ETATS_RESSOURCE = ['publiee', 'brouillon', 'archivee'];
// Dossiers qui ne reçoivent jamais de ressource (données internes de l'application)
const DOSSIERS_NON_RESSOURCE = ['racine', 'application', 'fichiers_demandes', 'profils', 'configurations', 'sauvegardes'];

function signatureOk_(oct, sig) {
  const b = i => (oct[i] & 255);
  if (!sig) return true;
  if (!oct || oct.length < 12) return false;
  if (sig === 'PDF') return b(0) === 0x25 && b(1) === 0x50 && b(2) === 0x44 && b(3) === 0x46;
  if (sig === 'PK') return b(0) === 0x50 && b(1) === 0x4B;
  if (sig === 'OLE') return b(0) === 0xD0 && b(1) === 0xCF && b(2) === 0x11 && b(3) === 0xE0;
  if (sig === 'JPG') return typeImage_(oct) === 'image/jpeg';
  if (sig === 'PNG') return typeImage_(oct) === 'image/png';
  if (sig === 'WEBP') return typeImage_(oct) === 'image/webp';
  if (sig === 'GIF') return b(0) === 0x47 && b(1) === 0x49 && b(2) === 0x46 && b(3) === 0x38;
  return false;
}
function extensionsAutorisees_() { return String(config_().ressources.extensions || '').split(/[,;\s]+/).map(x => x.trim().toLowerCase().replace(/^\./, '')).filter(x => x && EXTENSIONS_INTERDITES.indexOf(x) === -1); }
function extension_(nom) { const m = String(nom || '').toLowerCase().match(/\.([a-z0-9]{1,8})$/); return m ? m[1] : ''; }

// Identifiants internes : attribués une fois aux ressources des versions précédentes (sans rien perdre)
function assurerIdsRessources_() {
  const t = DB.tout('ressources');
  if (!t.some(r => !r.id || !r.type || !r.etat)) return;
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    DB.relire();
    const vus = {};
    DB.remplacer('ressources', DB.tout('ressources').map((r, i) => {
      const o = Object.assign({}, r); delete o._ligne;
      if (!o.id || vus[o.id]) o.id = 'R-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
      vus[o.id] = true;
      if (!o.type) o.type = o.fichier_id ? 'fichier' : 'lien';
      if (!o.etat) o.etat = 'publiee';
      if (!o.permission) o.permission = 'ressources_voir';
      if (!o.ordre) o.ordre = i + 1;
      if (!o.cree_le) o.cree_le = maintenant_();
      return o;
    }));
  } finally { lock.releaseLock(); }
}
function lignesRessources_() { assurerIdsRessources_(); return DB.tout('ressources').slice().sort((a, b) => Number(a.ordre) - Number(b.ordre)); }
function peutDossier_(u, cle) { const d = infoDossier_(cle); if (!d.actif) return false; return d.permission === 'connecte' || peut_(u, d.permission); }
function gereRessources_(u) { return peut_(u, 'ressources_gerer') || peut_(u, 'ressources_importer') || peut_(u, 'ressources_supprimer'); }
// Une ressource est-elle accessible à cette personne ? (règle unique, utilisée pour la liste ET pour chaque fichier)
function ressourceAccessible_(u, r) {
  if (!r) return false;
  if (!peut_(u, 'ressources_voir')) return false;
  if (r.etat && r.etat !== 'publiee' && !gereRessources_(u)) return false;
  if (!peut_(u, r.permission || 'ressources_voir')) return false;
  if ((r.type === 'fichier' || r.fichier_id) && r.dossier && !peutDossier_(u, r.dossier)) return false;
  return true;
}
function ressourcePublique_(r, u, gestion) {
  const o = { id: r.id, type: r.type === 'fichier' ? 'fichier' : 'lien', rubrique: r.rubrique, titre: r.titre, description: r.description, url: r.type === 'fichier' ? '' : r.url,
    type_lien: r.type_lien || '', statut: r.statut || '', version: r.version || '', important: r.important === 'OUI', etat: r.etat || 'publiee', permission: r.permission || 'ressources_voir',
    ordre: Number(r.ordre) || 0, maj_le: r.maj_le || r.cree_le || '' };
  if (o.type === 'fichier' || r.fichier_id) o.fichier = { nom: r.fichier_nom || '', mime: r.fichier_mime || '', taille: Number(r.fichier_taille) || 0, ext: extension_(r.fichier_nom), present: !!r.fichier_id };
  if (gestion) {
    o.auteur = r.auteur || ''; o.auteur_nom = r.auteur ? nomDe_(r.auteur) : ''; o.cree_le = r.cree_le || ''; o.origine = r.origine || '';
    o.dossier = r.dossier || ''; o.emplacement = r.dossier ? infoDossier_(r.dossier).nom : '';
  }
  if (r.type === 'fichier' && r.fichier_id && peut_(u, 'ressources_gerer')) o.drive_url = 'https://drive.google.com/file/d/' + r.fichier_id + '/view';
  return o;
}
function ressourcesVisibles_(u) { return lignesRessources_().filter(r => ressourceAccessible_(u, r)).map(r => ressourcePublique_(r, u, false)); }

// Fichier géré par l'application : existe, pas à la corbeille, rangé (à 6 niveaux au plus) dans un dossier configuré
function idsDossiersApp_() { const d = config_().drive, o = {}; Object.keys(d).forEach(k => { if (d[k]) o[d[k]] = k; }); return o; }
function fichierApp_(id, ressource) {
  if (!id || !/^[-\w]{10,}$/.test(String(id))) return null;
  let f; try { f = DriveApp.getFileById(id); if (f.isTrashed()) return null; } catch (e) { return null; }
  const cle = dossierAppDe_(f);
  if (!cle) return null;
  // Une ressource ne peut JAMAIS désigner un fichier interne (sauvegardes, configurations, photos, fichiers des demandes…)
  if (ressource && DOSSIERS_NON_RESSOURCE.indexOf(cle) > -1) return null;
  return f;
}
// Clé du dossier de l'application le plus proche contenant ce fichier ('' si aucun)
function dossierAppDe_(f) {
  const ids = idsDossiersApp_();
  let niveau = [f];
  for (let i = 0; i < 6 && niveau.length; i++) {
    const suivant = [];
    for (let j = 0; j < niveau.length; j++) { const it = niveau[j].getParents(); while (it.hasNext()) { const p = it.next(); if (ids[p.getId()]) return ids[p.getId()]; suivant.push(p); } }
    niveau = suivant;
  }
  return '';
}
function dansDossiersApp_(f) { return !!dossierAppDe_(f); }
// Mise à la corbeille : UNIQUEMENT un fichier créé par l'application (marque) et rangé dans ses dossiers.
// Un fichier externe, rattaché ou inconnu n'est jamais supprimé.
function mettreCorbeille_(id) {
  try {
    const f = DriveApp.getFileById(id);
    if (f.isTrashed()) return true;
    if (String(f.getDescription() || '').indexOf(MARQUE_APP) !== 0) return false;
    if (!dansDossiersApp_(f)) return false;
    f.setTrashed(true);
    return true;
  } catch (e) { console.error('Corbeille impossible (' + id + ') : ' + e); return false; }
}
function dossiersImport_(u) {
  return DOSSIERS.map(d => d[0]).filter(k => DOSSIERS_NON_RESSOURCE.indexOf(k) === -1 && DOSSIERS_PHOTOTHEQUE.indexOf(k) === -1 && infoDossier_(k).actif && idDossier_(k)).map(k => ({ cle: k, nom: infoDossier_(k).nom }));
}
function dossierCategorie_(rubrique) {
  const cat = (config_().ressources.categories || []).find(x => x.nom === rubrique);
  const k = cat && cat.dossier ? cat.dossier : 'ressources';
  return DOSSIERS_NON_RESSOURCE.indexOf(k) === -1 && DOSSIERS_PHOTOTHEQUE.indexOf(k) === -1 ? k : 'ressources';
}
function metaRessource_(m, u, avant) {
  const c = config_(), txt = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);
  const titre = txt(m.titre, 150);
  if (!titre) throw Oups_('Le titre est obligatoire.');
  const permission = String(m.permission || 'ressources_voir');
  if (PERM_CODES.indexOf(permission) === -1) throw Oups_('Permission inconnue.');
  const etat = ETATS_RESSOURCE.indexOf(m.etat) > -1 ? m.etat : 'publiee';
  const rubrique = txt(m.rubrique, 60) || ((c.ressources.categories[0] || {}).nom || 'Autres');
  return { rubrique: rubrique, titre: titre, description: txt(m.description, 600), type_lien: txt(m.type_lien, 40), statut: txt(m.statut, 40), version: txt(m.version, 20),
    important: m.important === true || m.important === 'OUI' ? 'OUI' : '', etat: etat, permission: permission, maj_le: maintenant_() };
}

function api_ressourcesGestion(sid) {
  return appel_(sid, ['ressources_gerer', 'ressources_importer', 'ressources_supprimer'], u => ({
    liste: lignesRessources_().map(r => ressourcePublique_(r, u, true)),
    visibles: peut_(u, 'ressources_voir') ? ressourcesVisibles_(u) : [],   // liste de consultation à jour (évite un second appel api_session)
    dossiers: dossiersImport_(u), extensions: extensionsAutorisees_(), taille_max_mo: config_().ressources.taille_max_mo,
    droits: { gerer: peut_(u, 'ressources_gerer'), importer: peut_(u, 'ressources_importer'), supprimer: peut_(u, 'ressources_supprimer') },
    permissions: [['ressources_voir', 'Tout le monde']].concat(PERMISSIONS.filter(p => p[0] !== 'ressources_voir').map(p => [p[0], 'Seulement : ' + p[1]])),
  }));
}

// Lien externe (création / modification) ou informations d'un fichier. Les champs « fichier » ne viennent jamais du navigateur.
function api_enregistrerRessource(sid, m) {
  return appel_(sid, 'ressources_gerer', u => {
    m = m || {};
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const t = lignesRessources_();
      const avant = m.id ? t.find(r => r.id === m.id) : null;
      if (m.id && !avant) throw Oups_('Cette ressource a été supprimée entre-temps.');
      const o = metaRessource_(m, u, avant);
      const type = avant ? (avant.type === 'fichier' ? 'fichier' : 'lien') : 'lien';
      if (type === 'lien') {
        const url = String(m.url || '').trim();
        if (url && !/^https:\/\/[^\s<>"']+$/i.test(url)) throw Oups_('Le lien doit commencer par https://');
        o.url = url;
      }
      if (avant) {
        DB.modifier('ressources', 'id', avant.id, o);
        journalSecu_(u.email, 'ressource_modifiee', avant.id + ' · ' + o.titre + (avant.permission !== o.permission ? ' · permission : ' + o.permission : '') + (avant.etat !== o.etat ? ' · état : ' + o.etat : ''));
        return ressourcePublique_(DB.trouver('ressources', 'id', avant.id), u, true);
      }
      const n = Object.assign({ id: 'R-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), type: 'lien', ordre: t.reduce((x, r) => Math.max(x, Number(r.ordre) || 0), 0) + 1, auteur: u.email, cree_le: maintenant_(), origine: '' }, o);
      DB.ajouter('ressources', n);
      journalSecu_(u.email, 'ressource_ajoutee', n.id + ' · lien · ' + n.titre);
      return ressourcePublique_(n, u, true);
    } finally { lock.releaseLock(); }
  });
}

// Import d'un fichier (nouvelle ressource) ou remplacement du fichier d'une ressource existante (même identifiant interne)
function api_importerRessource(sid, m, fichier) {
  return appel_(sid, 'ressources_importer', u => {
    m = m || {}; fichier = fichier || {};
    const c = config_();
    const nom = nomFichier_(fichier.nom), ext = extension_(nom);
    if (!ext) throw Oups_('Le fichier doit avoir une extension (.pdf, .docx…).');
    if (EXTENSIONS_INTERDITES.indexOf(ext) > -1 || extensionsAutorisees_().indexOf(ext) === -1) throw Oups_('Format « .' + ext + ' » non autorisé. Formats acceptés : ' + extensionsAutorisees_().join(', ') + ' (réglables dans Administration > Ressources).');
    const oct = decoder64_(fichier.data);
    if (!oct.length) throw Oups_('Fichier vide.');
    if (oct.length > c.ressources.taille_max_mo * 1024 * 1024) throw Oups_('Fichier trop lourd (' + c.ressources.taille_max_mo + ' Mo maximum).');
    const def = TYPES_FICHIER[ext] || ['application/octet-stream', ''];
    exigerFonction_('ressources_fichiers');
    if (!signatureOk_(oct, def[1])) throw Oups_('Le contenu du fichier ne correspond pas à son extension « .' + ext + ' ».');
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      DB.relire();
      const t = lignesRessources_();
      const avant = m.id ? t.find(r => r.id === m.id) : null;
      if (m.id && !avant) throw Oups_('Cette ressource a été supprimée entre-temps.');
      const lienFichier = !!avant && avant.type !== 'fichier';   // lien + fichier : le lien est conservé, le fichier s'y ajoute
      if (avant && !peut_(u, 'ressources_gerer') && avant.auteur !== u.email) throw Oups_('Vous ne pouvez remplacer que les fichiers que vous avez importés.');
      const meta = metaRessource_(Object.assign({}, avant || {}, m, { important: m.important !== undefined ? m.important : (avant && avant.important) }), u, avant);
      let cle = String(m.dossier || (avant && avant.dossier) || dossierCategorie_(meta.rubrique));
      if (DOSSIERS_NON_RESSOURCE.indexOf(cle) > -1 || !DOSSIERS.some(d => d[0] === cle)) cle = 'ressources';
      const id = avant ? avant.id : 'R-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
      const f = ecritureDrive_('ressources_fichiers', () => dossier_(cle).createFile(Utilities.newBlob(oct, def[0], nom)));
      f.setDescription(MARQUE_APP + 'ressource:' + id);
      const o = Object.assign(meta, { type: lienFichier ? avant.type : 'fichier', url: lienFichier ? avant.url : '', fichier_id: f.getId(), fichier_nom: nom, fichier_mime: def[0], fichier_taille: String(oct.length), dossier: cle, origine: 'import' });
      if (avant) {
        DB.modifier('ressources', 'id', id, o);
        // Ancien fichier : à la corbeille s'il a été importé par l'application ; un fichier rattaché n'est jamais supprimé
        let sort = 'aucun';
        if (avant.fichier_id && avant.fichier_id !== o.fichier_id) sort = avant.origine === 'import' && mettreCorbeille_(avant.fichier_id) ? 'corbeille' : 'conserve';
        journalSecu_(u.email, 'ressource_remplacee', id + ' · ' + nom + ' · ancien fichier : ' + sort);
      } else {
        Object.assign(o, { id: id, ordre: t.reduce((x, r) => Math.max(x, Number(r.ordre) || 0), 0) + 1, auteur: u.email, cree_le: maintenant_() });
        DB.ajouter('ressources', o);
        journalSecu_(u.email, 'ressource_importee', id + ' · ' + nom + ' · ' + Math.round(oct.length / 1024) + ' Ko · ' + infoDossier_(cle).nom);
      }
      return ressourcePublique_(DB.trouver('ressources', 'id', id), u, true);
    } finally { lock.releaseLock(); }
  });
}
// Rattacher un fichier DÉJÀ rangé dans un dossier de l'application (migration) : il n'est jamais supprimé par l'application
function api_rattacherFichier(sid, id, lienDrive) {
  return appel_(sid, 'ressources_importer', u => {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const r = lignesRessources_().find(x => x.id === id);
      if (!r) throw Oups_('Ressource introuvable.');
      const fid = idDepuisLien_(lienDrive);
      const f = fichierApp_(fid, true);
      if (!f) throw Oups_('Fichier refusé : il doit exister et être rangé dans un des dossiers de ressources de l\'application (Administration > Drive partagé). Un fichier situé ailleurs, ou un fichier interne (sauvegardes, configurations, photos, fichiers des demandes), ne peut pas être publié par ce moyen.');
      if (r.fichier_id && r.fichier_id !== fid && r.origine === 'import') mettreCorbeille_(r.fichier_id);
      const cle = dossierAppDe_(f);
      DB.modifier('ressources', 'id', id, { type: 'fichier', url: '', fichier_id: fid, fichier_nom: nomFichier_(f.getName()), fichier_mime: f.getMimeType(), fichier_taille: String(f.getSize()), dossier: cle || r.dossier || 'ressources', origine: 'rattache', maj_le: maintenant_() });
      journalSecu_(u.email, 'ressource_rattachee', id + ' · ' + f.getName());
      return ressourcePublique_(DB.trouver('ressources', 'id', id), u, true);
    } finally { lock.releaseLock(); }
  });
}

function api_supprimerRessource(sid, id, confirmation) {
  return appel_(sid, 'ressources_supprimer', u => {
    if (confirmation !== 'SUPPRIMER') throw Oups_('Confirmation de la suppression manquante.');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const r = lignesRessources_().find(x => x.id === id);
      if (!r) throw Oups_('Cette ressource a déjà été supprimée.');
      let fichier = 'aucun';
      if (r.type === 'fichier' && r.fichier_id) fichier = r.origine === 'import' && mettreCorbeille_(r.fichier_id) ? 'corbeille' : 'conserve';
      DB.supprimer('ressources', 'id', id);
      journalSecu_(u.email, 'ressource_supprimee', id + ' · ' + r.titre + ' · fichier : ' + fichier);
      return { fichier: fichier };
    } finally { lock.releaseLock(); }
  });
}

function api_ordreRessources(sid, ids) {
  return appel_(sid, 'ressources_gerer', u => {
    ids = Array.isArray(ids) ? ids.map(String) : [];
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const t = lignesRessources_(), rang = {};
      ids.forEach((x, i) => { if (rang[x] === undefined) rang[x] = i; });
      const tri = t.slice().sort((a, b) => (rang[a.id] === undefined ? 1e6 + Number(a.ordre) : rang[a.id]) - (rang[b.id] === undefined ? 1e6 + Number(b.ordre) : rang[b.id]));
      DB.remplacer('ressources', tri.map((r, i) => { const o = Object.assign({}, r); delete o._ligne; o.ordre = i + 1; return o; }));
      journalSecu_(u.email, 'ressources_ordre', tri.length + ' ressource(s)');
      return true;
    } finally { lock.releaseLock(); }
  });
}

// Lecture d'un fichier de ressource par son identifiant INTERNE (jamais par un identifiant Drive)
function lireRessource_(u, id) {
  const r = lignesRessources_().find(x => x.id === String(id || ''));
  if (!r || (r.type !== 'fichier' && !r.fichier_id) || !ressourceAccessible_(u, r)) {   // fichier, ou lien accompagné d'un fichier (3.16)
    journalSecu_(u.email, 'refus_ressource', String(id || '').slice(0, 60));
    throw Oups_('Ce fichier n\'existe pas ou ne vous est pas accessible.');
  }
  // Cause précise (fichier supprimé, introuvable, inaccessible, déplacé) : message clair, jamais d'erreur technique
  if (!r.fichier_id) throw Oups_('Aucun fichier n\'est encore associé à cette ressource. Prévenez l\'équipe communication.');
  const x = fichierDisponible_(r.fichier_id), f = x.f;
  if (x.cause) {
    try { const c = CacheService.getScriptCache(), k = 'indispo_' + r.id + x.cause; if (!c.get(k)) { c.put(k, '1', 3600); journalSecu_(u.email, 'fichier_indisponible', r.id + ' · ' + r.titre + ' · ' + x.cause); } } catch (e) { }
    throw Oups_(MESSAGES_FICHIER[x.cause]);
  }
  return { r: r, f: f };
}
function octetsDe_(f) { try { return f.getBlob().getBytes(); } catch (e) { console.error('Lecture Drive : ' + e); throw Oups_('Le Drive partagé n\'a pas répondu. Réessayez dans un instant.'); } }
function api_fichierRessource(sid, id) {
  return appel_(sid, 'ressources_voir', u => {
    const x = lireRessource_(u, id), max = config_().ressources.taille_max_mo * 1024 * 1024, taille = x.f.getSize();
    if (taille > max) return { trop_gros: true, nom: x.r.fichier_nom, taille: taille };
    return { nom: x.r.fichier_nom || x.f.getName(), mime: x.r.fichier_mime || x.f.getMimeType(), taille: taille, data: Utilities.base64Encode(octetsDe_(x.f)) };
  });
}

/**
 * Aperçu visuel (1re page) d'un PDF ou d'un document Office, fabriqué par Google Drive.
 * - Mêmes contrôles d'accès que le fichier (lireRessource_ : identifiant INTERNE, rôle, permission, dossier, état).
 * - L'image est récupérée par le serveur avec le jeton du compte d'exécution (API Drive v3, champ thumbnailLink),
 *   puis renvoyée en données : le lien Google (temporaire) n'est JAMAIS transmis au navigateur.
 * - Secours : vignette DriveApp (petite) ; sinon aucun aperçu visuel (l'interface propose Ouvrir / Télécharger).
 */
function api_apercuRessource(sid, id) {
  return appel_(sid, 'ressources_voir', u => {
    const x = lireRessource_(u, id), cache = CacheService.getScriptCache(), cle = 'apercu_' + x.r.fichier_id;
    try { const deja = cache.get(cle); if (deja) return JSON.parse(deja); } catch (e) { }
    const v = vignetteDrive_(x.r.fichier_id, 1200);   // certain : réponse définitive de Google (mise en cache)
    let oct = v.oct, source = oct ? 'drive' : '', certain = v.certain;
    if (!oct || !typeImage_(oct)) { oct = null; try { const b = x.f.getThumbnail(); if (b) { oct = b.getBytes(); source = 'vignette'; } } catch (e) { } }
    const out = oct && typeImage_(oct) ? { image: 'data:' + typeImage_(oct) + ';base64,' + Utilities.base64Encode(oct), source: source, page: 1 } : { image: '', source: '' };
    // Une panne passagère n'est jamais mise en cache : l'aperçu sera retenté à la prochaine ouverture
    if (certain || out.image) { try { const t = JSON.stringify(out); if (t.length < 95000) cache.put(cle, t, 21600); } catch (e) { } }
    return out;
  });
}
function api_miniatureRessource(sid, id) {
  return appel_(sid, 'ressources_voir', u => {
    const x = lireRessource_(u, id);
    if (!/^image\//.test(x.r.fichier_mime || '')) return '';
    const cle = 'mini_' + x.r.fichier_id, cache = CacheService.getScriptCache();
    const deja = cache.get(cle); if (deja) return deja;
    let b = null; try { b = x.f.getThumbnail(); } catch (e) { b = null; }
    if (!b && x.f.getSize() <= 300 * 1024) b = x.f.getBlob();
    if (!b) return '';
    const oct = b.getBytes(), s = 'data:' + (typeImage_(oct) || 'image/png') + ';base64,' + Utilities.base64Encode(oct);
    if (s.length < 95000) { try { cache.put(cle, s, 21600); } catch (e) { } }
    return s;
  });
}

// Contrôle des références (après une migration) : chaque fichier est-il toujours joignable et rangé dans l'application ?
function controleRessources_() {
  return lignesRessources_().filter(r => r.type === 'fichier' || /drive\.google|docs\.google/.test(r.url || '')).map(r => {
    const o = { id: r.id, titre: r.titre, type: r.type, origine: r.origine || '', etat: 'ok', detail: '' };
    const fid = r.type === 'fichier' ? r.fichier_id : idDepuisLien_(r.url);
    if (!fid) { o.etat = 'absent'; o.detail = r.type === 'fichier' ? 'Aucun fichier associé : réimportez-le.' : 'Lien Drive sans identifiant.'; return o; }
    let f = null; try { f = DriveApp.getFileById(fid); } catch (e) { try { DriveApp.getFolderById(fid); o.detail = 'Dossier Drive (lien).'; return o; } catch (e2) { } }
    if (!f) { o.etat = 'introuvable'; o.detail = 'Introuvable ou non partagé avec le compte de l\'application.'; return o; }
    if (f.isTrashed()) { o.etat = 'corbeille'; o.detail = 'Dans la corbeille du Drive.'; return o; }
    if (r.type === 'fichier' && !fichierApp_(fid, true)) { o.etat = 'hors_app'; o.detail = 'Rangé hors des dossiers de l\'application : non servi aux utilisateurs.'; }
    else if (r.type !== 'fichier') { o.etat = fichierApp_(fid, true) ? 'rattachable' : 'lien'; o.detail = o.etat === 'rattachable' ? 'Lien vers un fichier des dossiers de l\'application : peut devenir un fichier interne (« Rattacher »).' : 'Lien Drive : seules les personnes qui ont accès à ce fichier dans le Drive peuvent l\'ouvrir.'; }
    return o;
  });
}
function api_controleRessources(sid) { return appel_(sid, ['admin', 'ressources_gerer'], u => controleRessources_()); }

// =====================================================================
// 13. DRIVE PARTAGÉ — dossiers configurables (identifiant, nom, description, actif, permission)
// Le compte qui EXÉCUTE l'application (déploiement « Exécuter en tant que : moi ») est le seul à avoir besoin
// d'un accès au Drive partagé. Les droits du site (rôles, permissions) et les droits directs du Drive sont séparés.
// =====================================================================
const LEGACY_DOSSIERS = { fichiers_demandes: 'DOSSIER_FICHIERS', sauvegardes: 'DOSSIER_SAUVEGARDES' };
const DOSSIERS_TOUJOURS_ACTIFS = ['racine', 'application', 'fichiers_demandes', 'sauvegardes', 'configurations'];
function infoDossier_(cle) {
  const d = DOSSIERS.find(x => x[0] === cle) || [cle, cle, 'racine', '', 'admin'];
  let dd = {}; try { dd = (config_().drive_dossiers || {})[cle] || {}; } catch (e) { }
  return { cle: cle, nom: String(dd.nom || d[1]), parent: d[2], description: String(dd.description || d[3]), actif: DOSSIERS_TOUJOURS_ACTIFS.indexOf(cle) > -1 || dd.actif !== false, permission: dd.permission || d[4] };
}
function idDossier_(cle) {
  let id = '';
  try { id = config_().drive[cle] || ''; } catch (e) { }
  if (!id && LEGACY_DOSSIERS[cle]) id = PropertiesService.getScriptProperties().getProperty(LEGACY_DOSSIERS[cle]) || '';
  return id;
}
const DOSSIERS_EXEC = {};   // dossiers déjà ouverts pendant cette exécution (un import groupé n'interroge le Drive qu'une fois)
function dossier_(cle) {
  if (DOSSIERS_EXEC[cle]) return DOSSIERS_EXEC[cle];
  const f0 = dossierBrut_(cle); DOSSIERS_EXEC[cle] = f0; return f0;
}
function dossierBrut_(cle) {
  const id = idDossier_(cle), info = infoDossier_(cle), lib = info.nom;
  if (!info.actif) throw Oups_('Le dossier « ' + lib + ' » est désactivé (Administration > Drive partagé).');
  if (!id) throw Oups_('Le dossier « ' + lib + ' » n\'est pas configuré. Administration > Drive partagé.');
  try { const f = DriveApp.getFolderById(id); if (f.isTrashed()) throw new Error('corbeille'); return f; }
  catch (e) { throw Oups_('Le dossier « ' + lib + ' » est inaccessible (supprimé, déplacé ou non partagé avec le compte de l\'application). Administration > Drive partagé > Vérifier la connexion.'); }
}

const TEST_DOSSIERS_EXEC = {};   // dossiers déjà testés pendant cette exécution (diagnostic + état des fonctions : un seul accès chacun)
function testerDossier_(cle, forcer) {
  if (TEST_DOSSIERS_EXEC[cle]) return TEST_DOSSIERS_EXEC[cle];
  return (TEST_DOSSIERS_EXEC[cle] = testerDossierBrut_(cle, forcer));
}
// Test d'écriture (création d'un fichier de test, mis à la corbeille) : réussi, il n'est refait qu'après 6 h, ou sur demande
// (« Vérifier la connexion », « Relancer le diagnostic »). Ouvrir l'administration ne crée plus 7 fichiers de test à chaque fois.
function testerDossierBrut_(cle, forcer) {
  const info = infoDossier_(cle), id = idDossier_(cle);
  const r = { cle: cle, libelle: info.nom, description: info.description, actif: info.actif, permission: info.permission, id: id, etat: 'ok', nom: '', url: '', detail: '' };
  if (!info.actif) { r.etat = 'inactif'; r.detail = 'Dossier désactivé : non utilisé par l\'application.'; return r; }
  if (!id) { r.etat = 'non_configure'; r.detail = 'Aucun dossier indiqué.'; return r; }
  let f;
  try { f = DriveApp.getFolderById(id); r.nom = f.getName(); r.url = f.getUrl(); }
  catch (e) {
    const m = String(e && e.message || e);
    if (/access|autoris|permission|denied/i.test(m)) { r.etat = 'acces'; r.detail = 'Autorisation insuffisante : ajoutez le compte de l\'application au Drive partagé (Gestionnaire de contenu).'; }
    else { r.etat = 'introuvable'; r.detail = 'Dossier introuvable : identifiant incorrect ou dossier supprimé.'; }
    return r;
  }
  try { if (f.isTrashed()) { r.etat = 'corbeille'; r.detail = 'Le dossier est dans la corbeille.'; return r; } } catch (e) { }
  if (DOSSIERS_ECRITURE.indexOf(cle) > -1) {
    const k = CacheService.getScriptCache(), ck = 'ecriture_ok_' + id;
    let deja = false; if (forcer !== true) { try { deja = k.get(ck) === '1'; } catch (e) { } }
    if (!deja) try { const t = f.createFile('centre-com-test.txt', 'Test d\'écriture du Centre Com — peut être supprimé.'); t.setDescription(MARQUE_APP + 'test'); t.setTrashed(true); try { k.put(ck, '1', 21600); } catch (e) { } }
    catch (e) { try { k.remove(ck); } catch (x) { } r.etat = 'ecriture'; r.detail = 'Lecture possible mais écriture impossible : donnez le rôle « Gestionnaire de contenu » au compte de l\'application.'; }
  }
  return r;
}

function verifierDrive_(forcer) {
  const out = DOSSIERS.map(d => testerDossier_(d[0], forcer));
  let base = null;
  try { const f = DriveApp.getFileById(idBase_()); const p = f.getParents(); base = { nom: f.getName(), url: f.getUrl(), dossier: p.hasNext() ? p.next().getName() : '—' }; } catch (e) { base = { nom: 'Base de données', url: '', dossier: 'inaccessible' }; }
  let compte = ''; try { compte = Session.getEffectiveUser().getEmail(); } catch (e) { }
  return { dossiers: out, base: base, compte: compte, verifie_le: maintenant_() };
}

// Vérification du Drive gardée 10 min (clé : numéro de configuration, donc refaite après tout changement de réglage) :
// ouvrir l'administration ne réinterroge pas chaque dossier. Le bouton « Vérifier » et « Relancer le diagnostic » la refont.
function verifierDriveCache_(forcer) {
  const k = CacheService.getScriptCache(), cle = 'verif_drive_' + (config_().meta.numero || 0);
  if (forcer !== true) { try { const v = k.get(cle); if (v) return JSON.parse(v); } catch (e) { } }
  const r = verifierDrive_(forcer);
  try { k.put(cle, JSON.stringify(r), 1800); } catch (e) { }
  return r;
}
function api_verifierDrive(sid, auto) {
  if (auto === true) return appel_(sid, 'admin', u => verifierDriveCache_(false));   // affichage à l'ouverture : rien d'écrit au journal
  return appel_(sid, 'admin', u => { const r = verifierDriveCache_(true); try { CacheService.getScriptCache().remove(CLE_FONCTIONS); } catch (e) { } journalSecu_(u.email, 'drive_verifie', r.dossiers.filter(x => ['ok', 'inactif'].indexOf(x.etat) === -1).length + ' point(s) à corriger'); return r; });
}

// Test pas à pas d'un dossier : lecture, ou écriture (création → relecture → suppression d'un fichier de test)
function api_testerDossier(sid, cle, test) {
  return appel_(sid, 'admin', u => {
    if (!DOSSIERS.some(d => d[0] === cle)) throw Oups_('Dossier inconnu.');
    const etapes = [], ok = (t, v, d) => { etapes.push({ t: t, ok: v, detail: d || '' }); return v; };
    const id = idDossier_(cle), info = infoDossier_(cle);
    let f = null;
    if (!ok('Identifiant configuré', !!id, id || 'Aucun identifiant')) return { etapes: etapes, ok: false };
    try { f = DriveApp.getFolderById(id); ok('Accès au dossier par le compte de l\'application', !f.isTrashed(), f.getName()); }
    catch (e) { ok('Accès au dossier par le compte de l\'application', false, String(e && e.message || e)); return { etapes: etapes, ok: false }; }
    if (test === 'ecriture') {
      let t = null;
      try { t = f.createFile('centre-com-test-' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyyMMdd-HHmmss') + '.txt', 'Test du Centre Com : ce fichier est supprimé automatiquement.'); t.setDescription(MARQUE_APP + 'test'); ok('Création d\'un fichier de test', true, t.getName()); }
      catch (e) { ok('Création d\'un fichier de test', false, 'Écriture refusée : rôle « Gestionnaire de contenu » nécessaire. ' + (e && e.message || e)); }
      if (t) {
        try { ok('Relecture du fichier', /Centre Com/.test(t.getBlob().getDataAsString()), ''); } catch (e) { ok('Relecture du fichier', false, String(e)); }
        try { t.setTrashed(true); ok('Suppression du fichier de test (corbeille)', t.isTrashed(), ''); } catch (e) { ok('Suppression du fichier de test (corbeille)', false, 'Suppression refusée : rôle « Gestionnaire de contenu » nécessaire. ' + (e && e.message || e)); }
      }
    } else {
      try { let n = 0, s = 0; const it = f.getFiles(); while (it.hasNext() && n < 500) { it.next(); n++; } const it2 = f.getFolders ? f.getFolders() : null; if (it2) while (it2.hasNext() && s < 500) { it2.next(); s++; } ok('Lecture du contenu', true, n + ' fichier(s), ' + s + ' sous-dossier(s)'); }
      catch (e) { ok('Lecture du contenu', false, String(e && e.message || e)); }
    }
    const tout = etapes.every(x => x.ok);
    journalSecu_(u.email, 'drive_test', info.nom + ' · ' + (test === 'ecriture' ? 'écriture' : 'lecture') + ' · ' + (tout ? 'réussi' : 'échec'));
    return { etapes: etapes, ok: tout };
  });
}

/**
 * Créer les dossiers manquants / réparer : pour chaque dossier actif, garde l'identifiant s'il fonctionne ; sinon cherche
 * un dossier portant le nom configuré dans le dossier parent, sinon le crée. Rien n'est supprimé, rien n'est écrasé.
 * nouvelleRacine : si le dossier principal change (migration), les sous-dossiers sont recherchés / créés sous la nouvelle racine.
 */
function reparerDrive_(racineId, auteur, deplacerBase) {
  const cfg = JSON.parse(JSON.stringify(config_()));
  const nouvelleRacine = !!racineId && racineId !== cfg.drive.racine;
  const rid = racineId || cfg.drive.racine;
  if (!rid) throw Oups_('Indiquez d\'abord le dossier principal (lien ou identifiant).');
  let racine;
  try { racine = DriveApp.getFolderById(rid); if (racine.isTrashed()) throw new Error('corbeille'); } catch (e) { throw Oups_('Dossier principal inaccessible. Vérifiez le lien et que le compte de l\'application est membre du Drive partagé (Gestionnaire de contenu).'); }
  const rapport = { conserves: [], relies: [], crees: [] }, dossiers = { racine: racine };
  cfg.drive.racine = racine.getId();
  DOSSIERS.slice(1).forEach(d => {
    const cle = d[0], info = infoDossier_(cle), parent = dossiers[d[2]];
    if (!info.actif) return;
    let f = null;
    if (!nouvelleRacine && cfg.drive[cle]) { try { f = DriveApp.getFolderById(cfg.drive[cle]); if (f.isTrashed()) f = null; } catch (e) { f = null; } }
    if (f) { rapport.conserves.push(info.nom); dossiers[cle] = f; return; }
    if (!parent) return;
    const it = parent.getFoldersByName(info.nom);
    if (it.hasNext()) { f = it.next(); rapport.relies.push(info.nom); } else { f = parent.createFolder(info.nom); try { f.setDescription(info.description); } catch (e) { } rapport.crees.push(info.nom); }
    dossiers[cle] = f; cfg.drive[cle] = f.getId();
  });
  if (deplacerBase && dossiers.application) { try { DriveApp.getFileById(idBase_()).moveTo(dossiers.application); } catch (e) { console.error('Base non déplacée : ' + e); } }
  enregistrerConfig_(cfg, auteur || 'installation', 'Drive : ' + rapport.crees.length + ' dossier(s) créé(s), ' + rapport.relies.length + ' relié(s)');
  return rapport;
}
// Compatibilité : ancien nom
function creerArborescence_(racineId, deplacerBase, auteur) { return reparerDrive_(racineId, auteur, deplacerBase); }

function api_creerArborescence(sid, racine, deplacerBase) {
  return appel_(sid, 'admin', u => {
    const id = idDepuisLien_(racine) || idDossier_('racine');
    if (!id) throw Oups_('Collez le lien du dossier principal (dans le Drive partagé).');
    const rap = reparerDrive_(id, u.email, deplacerBase === true);
    journalSecu_(u.email, 'drive_arborescence', 'Racine ' + id + ' · créés : ' + rap.crees.join(', ') + ' · reliés : ' + rap.relies.join(', '));
    return Object.assign(verifierDrive_(true), { rapport: rap });
  });
}
function api_reparerDrive(sid) {
  return appel_(sid, 'admin', u => {
    const rap = reparerDrive_('', u.email, false);
    journalSecu_(u.email, 'drive_repare', 'créés : ' + (rap.crees.join(', ') || '—') + ' · reliés : ' + (rap.relies.join(', ') || '—'));
    return Object.assign(verifierDrive_(true), { rapport: rap });
  });
}

// =====================================================================
// 14. ADMINISTRATION (chaque fonction vérifie la permission côté serveur)
// =====================================================================
// ---------- Logo importé (3.19) : fichier rangé dans le Drive partagé (01 - Application), image servie par l'application ----------
// Copie de l'image gardée dans la base (onglet Configuration, clé « logo ») : affichée partout, même sur la page de connexion, sans partage public du fichier.
const LOGO_MAX_KO = 450;
function logoSrc_(c) {
  c = c || config_();
  if (!c.identite.logo_fichier) return /^https:\/\//i.test(c.identite.logo_url || '') ? c.identite.logo_url : '';
  let v = null; try { v = CacheService.getScriptCache().get('logo_' + c.identite.logo_fichier); } catch (e) { }
  if (!v) { v = DB.tout('configuration').filter(r => r.cle === 'logo').map(r => r.valeur).join(''); try { if (v && v.length < 95000) CacheService.getScriptCache().put('logo_' + c.identite.logo_fichier, v, 21600); } catch (e) { } }
  return /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+\/=]+$/.test(v || '') ? v : (/^https:\/\//i.test(c.identite.logo_url || '') ? c.identite.logo_url : '');
}
// Version PNG du logo pour les e-mails (les messageries n'affichent ni les images « data: » ni le SVG ni toujours le WebP)
function logoMail_(c) {
  c = c || config_();
  if (!c.identite.logo_fichier) return null;
  let v = null; try { v = CacheService.getScriptCache().get('logomail_' + c.identite.logo_fichier); } catch (e) { }
  if (!v) { v = DB.tout('configuration').filter(r => r.cle === 'logo_mail').map(r => r.valeur).join(''); try { if (v && v.length < 95000) CacheService.getScriptCache().put('logomail_' + c.identite.logo_fichier, v, 21600); } catch (e) { } }
  if (!v || !/^[A-Za-z0-9+\/=]+$/.test(v)) return null;
  try { const o = Utilities.base64Decode(v); return typeImage_(o) === 'image/png' ? Utilities.newBlob(o, 'image/png', 'logo.png') : null; } catch (e) { return null; }
}
// Réattribuer toutes les personnes d'un rôle à un autre, puis désactiver ou supprimer ce rôle (une seule opération, sous verrou, journalisée)
function api_reattribuerRole(sid, role, cible, puis) {
  return appel_(sid, 'admin', u => {
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      DB.relire(); _CFG = null;
      const c = JSON.parse(JSON.stringify(config_()));
      role = String(role || ''); cible = String(cible || '');
      if (!c.roles[role] || role === ROLE_ADMIN) throw Oups_('Rôle inconnu.');
      if (['desactiver', 'supprimer'].indexOf(puis) < 0) throw Oups_('Action inconnue.');
      if (role === c.securite.role_defaut) throw Oups_('« ' + libRole_(c, role) + ' » est le rôle attribué à l\'inscription : choisissez-en d\'abord un autre (Connexion et sécurité).');
      const concernes = DB.tout('utilisateurs').filter(x => (ALIAS_ROLES[x.role] || x.role) === role);
      if (concernes.length) {
        if (!c.roles[cible] || cible === role || cible === ROLE_ADMIN || !roleActif_(c, cible)) throw Oups_('Choisissez un rôle actif (autre qu\'Administrateur) pour ces personnes.');
        concernes.forEach(x => {
          DB.modifier('utilisateurs', 'email', x.email, { role: cible, modifie_le: maintenant_() });
          journalSecu_(u.email, 'role_modifie', x.email + ' — rôle : ' + libRole_(c, role) + ' → ' + libRole_(c, cible) + ' (rôle ' + (puis === 'supprimer' ? 'supprimé' : 'désactivé') + ')');
        });
      }
      if (puis === 'supprimer') delete c.roles[role]; else c.roles[role].actif = false;
      const r = enregistrerConfig_(c, u.email, (puis === 'supprimer' ? 'Rôle supprimé : ' : 'Rôle désactivé : ') + libRole_(config_(), role) + (concernes.length ? ' (' + concernes.length + ' personne(s) passée(s) en « ' + libRole_(c, cible) + ' »)' : ''));
      journalSecu_(u.email, 'configuration', (puis === 'supprimer' ? 'Rôle supprimé' : 'Rôle désactivé') + ' — ' + concernes.length + ' personne(s) réattribuée(s)');
      return { reattribues: concernes.length, numero: r.meta.numero };
    } finally { lock.releaseLock(); }
  });
}
function api_logo(sid, action, f) {
  return appel_(sid, 'admin', u => {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire(); _CFG = null;
      const c = JSON.parse(JSON.stringify(config_())), ancien = c.identite.logo_fichier;
      let src = '', mail = '';
      if (action === 'importer') {
        f = f || {};
        const oct = decoder64_(f.data), svg = f.mime === 'image/svg+xml' && /^\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(Utilities.newBlob(oct).getDataAsString());
        const mime = svg ? 'image/svg+xml' : typeImage_(oct);
        if (!mime) throw Oups_('Ce fichier n\'est pas une image PNG, JPEG, WebP ou SVG.');
        if (oct.length > LOGO_MAX_KO * 1024) throw Oups_('Logo trop lourd (' + Math.round(oct.length / 1024) + ' Ko) : ' + LOGO_MAX_KO + ' Ko au plus.');
        if (svg && /<script|on\w+\s*=|javascript:/i.test(Utilities.newBlob(oct).getDataAsString())) throw Oups_('Ce fichier SVG contient du code : utilisez une image PNG.');
        const nom = 'Logo - ' + String(f.nom || 'logo').replace(/[\\/<>:"|?*]/g, ' ').slice(0, 80);
        const fichier = dossier_('application').createFile(Utilities.newBlob(oct, mime, nom));
        try { fichier.setDescription('Logo du Centre Com (Administration > Apparence). Importé par ' + u.email + ' le ' + maintenant_() + '.'); } catch (e) { }
        c.identite.logo_fichier = fichier.getId();
        src = 'data:' + mime + ';base64,' + Utilities.base64Encode(oct);
        // Version PNG pour les e-mails (fabriquée par le navigateur) : vérifiée, 300 Ko au plus ; sinon le PNG importé lui-même
        let png = ''; try { const op = f.png ? decoder64_(f.png) : null; if (op && typeImage_(op) === 'image/png' && op.length <= 300 * 1024) png = Utilities.base64Encode(op); } catch (e) { }
        if (!png && mime === 'image/png' && oct.length <= 300 * 1024) png = Utilities.base64Encode(oct);
        mail = png;
      } else if (action === 'supprimer') {
        c.identite.logo_fichier = '';
      } else throw Oups_('Action inconnue.');
      // Ligne « logo » de la base remplacée ; configuration enregistrée (version, journal, retour arrière)
      const morceaux = []; for (let i = 0; i < src.length; i += 40000) morceaux.push({ cle: 'logo', valeur: src.slice(i, i + 40000) });
      for (let i = 0; i < mail.length; i += 40000) morceaux.push({ cle: 'logo_mail', valeur: mail.slice(i, i + 40000) });
      DB.remplacer('configuration', DB.tout('configuration').filter(r => r.cle !== 'logo' && r.cle !== 'logo_mail').map(r => ({ cle: r.cle, valeur: r.valeur })).concat(morceaux));
      try { CacheService.getScriptCache().removeAll(['logo_' + ancien, 'logomail_' + ancien]); } catch (e) { }
      const r = enregistrerConfig_(c, u.email, action === 'importer' ? 'Logo importé' : 'Logo supprimé');
      if (ancien && ancien !== c.identite.logo_fichier) { try { DriveApp.getFileById(ancien).setTrashed(true); } catch (e) { } }   // ancien fichier : corbeille du Drive partagé (récupérable)
      journalSecu_(u.email, 'logo', action === 'importer' ? 'Logo importé (' + Math.round(src.length * 0.75 / 1024) + ' Ko)' : 'Logo supprimé');
      return { logo_fichier: r.identite.logo_fichier, logo_src: logoSrc_(r), numero: r.meta.numero };
    } finally { lock.releaseLock(); }
  });
}
function api_admin(sid) {
  return appel_(sid, 'admin', u => ({
    logo_src: logoSrc_(),
    config: config_(),
    defaut: CONFIG_DEFAUT,
    permissions: PERMISSIONS, roles_codes: rolesCodes_(), roles_distingues: _ROLES_DISTINGUES.slice(), dossiers: DOSSIERS, icones: ICONES, classes: CLASSES_STATUT,
    inscriptions: statsInscriptions_(),
    utilisateurs: DB.tout('utilisateurs').map(x => ({ email: x.email, nom: x.nom, role: role_(x.role), ul: x.ul, actif: x.actif || 'OUI', derniere_visite: x.derniere_visite })),
    types: DB.tout('types').map(x => { const o = Object.assign({}, x); delete o._ligne; return o; }),
    ul: DB.tout('ul').map(x => ({ nom: x.nom, actif: x.actif || 'OUI' })),
    technique: infosTechniques_(),
  }));
}

function infosTechniques_() {
  let url = urlOfficielle_();
  let base = ''; try { base = DB.ss().getUrl(); } catch (e) { }   // classeur déjà ouvert par l'appel
  let proprio = ''; try { proprio = Session.getEffectiveUser().getEmail(); } catch (e) { }
  return { base: base, sauvegardes: lienDossier_('sauvegardes'), configurations: lienDossier_('configurations'), fichiers: lienDossier_('fichiers_demandes'), racine: lienDossier_('racine'), url_app: url, version_code: VERSION_CODE, version_schema: VERSION_SCHEMA, compte_execution: proprio };
}

function api_enregistrerConfig(sid, cfg, commentaire) {
  return appel_(sid, 'admin', u => {
    // Une section absente de l'envoi garde sa valeur actuelle (jamais de retour silencieux aux valeurs par défaut)
    cfg = Object.assign({}, JSON.parse(JSON.stringify(config_())), (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) ? cfg : {});
    const r = enregistrerConfig_(cfg, u.email, commentaire); journalSecu_(u.email, 'configuration', commentaire || 'Configuration modifiée (n° ' + r.meta.numero + ')'); return r; });
}

function api_enregistrerTable(sid, table, lignes) {
  return appel_(sid, 'admin', u => {
    // Utilisateurs et ressources se gèrent un par un (fiche / Gérer les ressources) : jamais de remplacement de tableau
    if (['types', 'ul'].indexOf(table) === -1) throw Oups_(table === 'utilisateurs' ? 'Les utilisateurs se gèrent par leur fiche (Administration > Utilisateurs).' : table === 'ressources' ? 'Les ressources se gèrent une par une (Ressources > Gérer les ressources).' : 'Cette liste ne se modifie pas ici.');
    lignes = (lignes || []).filter(l => Object.keys(l).some(k => k.charAt(0) !== '_' && String(l[k] || '').trim()));
    const renommages = [];
    let transfert = false;
    if (table === 'utilisateurs') {
      const anciens = {}; DB.tout('utilisateurs').forEach(x => anciens[x.email] = x);
      const vus = {};
      // Transfert d'administration : l'administrateur peut renoncer à son rôle s'il l'a confirmé et qu'un autre administrateur actif existe
      transfert = lignes.some(l => l._transfert === true && String(l._orig || l.email).toLowerCase() === u.email);
      lignes = lignes.map(l => {
        const email = String(l.email || '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Oups_('Adresse e-mail invalide : « ' + email + ' ».');
        if (vus[email]) throw Oups_('L\'adresse ' + email + ' apparaît deux fois.');
        vus[email] = true;
        const orig = String(l._orig || '').toLowerCase();
        const a = anciens[orig] || anciens[email] || {};
        if (orig && orig !== email && anciens[orig]) renommages.push(['email', orig, email]);
        return { email: email, nom: String(l.nom || '').slice(0, 80), role: role_(l.role), ul: l.ul || '', actif: l.actif === 'NON' ? 'NON' : 'OUI', token: a.token || nouveauJeton_(), cree_le: a.cree_le || maintenant_(), derniere_visite: a.derniere_visite || '' };
      });
      if (!lignes.some(l => l.role === 'admin' && l.actif !== 'NON')) throw Oups_('Il faut garder au moins un administrateur actif.');
      const moi = renommages.find(r => r[1] === u.email) ? renommages.find(r => r[1] === u.email)[2] : u.email;
      if (!transfert && !lignes.some(l => l.email === moi && l.role === 'admin' && l.actif !== 'NON')) throw Oups_('Vous ne pouvez pas retirer vos propres droits d\'administrateur. Donnez d\'abord le rôle à une autre personne, qui pourra ensuite modifier le vôtre.');
    }
    if (table === 'types') {
      const codes = {}, champsValides = Object.keys(config_().demandes.champs);
      lignes.forEach((l, i) => {
        if (!String(l.libelle || '').trim()) throw Oups_('Chaque type de demande doit avoir un libellé.');
        if (!l.code) l.code = slug_(l.libelle).slice(0, 20);
        while (codes[l.code]) l.code += '_2';
        codes[l.code] = true;
        l.delai = Math.max(0, Math.round(Number(l.delai) || 0)); l.ordre = i + 1; l.actif = l.actif === 'NON' ? 'NON' : 'OUI';
        if (POLES_CODES.indexOf(l.pole) === -1) l.pole = 'graphique';
        l.champs = String(l.champs || '').split(',').map(s => s.trim()).filter(s => champsValides.indexOf(s) > -1).join(',');
        l.obligatoires = String(l.obligatoires || '').split(',').map(s => s.trim()).filter(s => l.champs.split(',').indexOf(s) > -1).join(',');
      });
      if (!lignes.some(l => l.actif === 'OUI')) throw Oups_('Il faut au moins un type de demande actif.');
    }
    if (table === 'ul') {
      const vus = {};
      lignes = lignes.map(l => {
        const nom = String(l.nom || '').trim().slice(0, 80);
        if (!nom) throw Oups_('Chaque unité locale doit avoir un nom.');
        if (vus[nom]) throw Oups_('« ' + nom + ' » apparaît deux fois.');
        vus[nom] = true;
        if (l._orig && l._orig !== nom) renommages.push(['ul', l._orig, nom]);
        return { nom: nom, actif: l.actif === 'NON' ? 'NON' : 'OUI' };
      });
      if (!lignes.some(l => l.actif === 'OUI')) throw Oups_('Il faut au moins une unité locale active.');
    }
    DB.remplacer(table, lignes);
    renommages.forEach(r => propager_(r[0], r[1], r[2]));
    journalSecu_(u.email, 'table_' + table, lignes.length + ' ligne(s)' + (renommages.length ? ', ' + renommages.length + ' renommage(s)' : '') + (transfert ? ' — transfert d\'administration' : ''));
    return { renommages: renommages.length };
  });
}

// Un renommage d'UL ou un changement d'adresse est répercuté partout (résilience)
function propager_(quoi, ancien, nouveau) {
  const cibles = quoi === 'ul'
    ? [['demandes', 'ul'], ['calendrier', 'ul'], ['presse', 'ul'], ['utilisateurs', 'ul']]
    : [['demandes', 'responsable'], ['demandes', 'demandeur_email'], ['calendrier', 'responsable'], ['presse', 'responsable'], ['historique', 'auteur']];
  cibles.forEach(c => {
    const col = TABLES[c[0]].cols.indexOf(c[1]) + 1;
    const sh = DB.feuille(c[0]), n = sh.getLastRow() - 1;
    if (n < 1) return;
    const rg = sh.getRange(2, col, n, 1), v = rg.getDisplayValues();
    let change = false;
    v.forEach(r => { if (r[0] === ancien) { r[0] = nouveau; change = true; } });
    if (change) rg.setNumberFormat('@').setValues(v);
    delete DB._cache[c[0]]; if (change) DB.change_(c[0]);
  });
  if (quoi === 'email') {
    const cfg = JSON.parse(JSON.stringify(config_()));
    const liste = String(cfg.notifications.emails_equipe || '').split(/[,;\s]+/).filter(Boolean).map(x => x.toLowerCase() === ancien ? nouveau : x);
    if (liste.join(',') !== String(cfg.notifications.emails_equipe).split(/[,;\s]+/).filter(Boolean).join(',')) { cfg.notifications.emails_equipe = liste.join(', '); enregistrerConfig_(cfg, 'système', 'Adresse ' + ancien + ' remplacée par ' + nouveau); }
  }
}

// ---------- Utilisateurs : profils, fiches, accès ----------
function profilPublic_(x, c) {
  return { email: x.email, nom: x.nom || '', prenom: x.prenom || '', nom_famille: x.nom_famille || '', role: role_(x.role), role_label: (c.roles[role_(x.role)] || {}).label || x.role, ul: x.ul || '',
    fonction: x.fonction || '', telephone: x.telephone || '', acces: etatAcces_(x), cree_le: x.cree_le || '', derniere_visite: x.derniere_visite || '', derniere_activite: x.derniere_activite || '', origine: x.origine || 'ancien', cgu_le: x.cgu_le || '', modifie_le: x.modifie_le || '', motif: x.motif || '' };
}
function statsInscriptions_() {
  const lim = isoJour_(new Date(Date.now() - 7 * 864e5)), lim30 = isoJour_(new Date(Date.now() - 30 * 864e5)), c = config_();
  const ins = DB.tout('utilisateurs').filter(x => x.origine === 'inscription').sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le)));
  return { semaine: ins.filter(x => String(x.cree_le).slice(0, 10) >= lim).length, mois: ins.filter(x => String(x.cree_le).slice(0, 10) >= lim30).length, dernieres: ins.slice(0, 6).map(x => profilPublic_(x, c)) };
}
function api_utilisateurs(sid) {
  return appel_(sid, 'admin', u => { const c = config_(), ph = photosDe_(DB.tout('utilisateurs').map(x => x.email)); return { liste: DB.tout('utilisateurs').map(x => Object.assign(profilPublic_(x, c), { photo: ph[x.email] || '' })), inscriptions: statsInscriptions_(), moi: u.email }; });
}
function api_ficheUtilisateur(sid, email) {
  return appel_(sid, 'admin', u => {
    email = String(email || '').toLowerCase();
    const x = DB.trouver('utilisateurs', 'email', email);
    if (!x) throw Oups_('Ce profil n\'existe pas.');
    const j = DB.tout('journal');
    const connexions = j.filter(e => e.email === email && e.evenement === 'connexion').slice(-10).reverse().map(e => ({ date: e.date, detail: e.detail }));
    const historique = j.filter(e => e.evenement !== 'connexion' && (e.email === email || String(e.detail).indexOf(email) > -1)).slice(-60).reverse().map(e => ({ date: e.date, par: e.email, evenement: e.evenement, detail: e.detail }));
    const demandes = DB.tout('demandes').filter(d => d.demandeur_email === email).length;
    return { profil: Object.assign(profilPublic_(x, config_()), { photo: miniPhoto_(email), preferences: preferences_(x) }), connexions: connexions, historique: historique, demandes: demandes };
  });
}
// Création (ajout par un administrateur) ou modification des informations administratives et du rôle
function api_enregistrerUtilisateur(sid, email, champs, creation) {
  return appel_(sid, 'admin', u => {
    DB.relire();   // décisions sur les comptes et les accès : toujours sur la base elle-même, jamais sur une copie en cache
    const c = config_(); champs = champs || {};
    email = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Oups_('Adresse e-mail invalide.');
    const txt = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
    const ulOk = v => !v || DB.tout('ul').some(x => x.nom === v);
    const x = DB.trouver('utilisateurs', 'email', email);
    const role = champs.role !== undefined ? String(champs.role) : (x ? role_(x.role) : c.securite.role_defaut);
    if (!c.roles[role]) throw Oups_('Rôle inconnu.');
    if (champs.role !== undefined && (!x || role !== role_(x.role)) && !roleActif_(c, role)) throw Oups_('Ce rôle est désactivé : il ne peut plus être attribué.');
    if (champs.ul !== undefined && !ulOk(champs.ul)) throw Oups_('Unité locale inconnue.');
    const p = { prenom: txt(champs.prenom, 60), nom_famille: txt(champs.nom_famille, 60), ul: txt(champs.ul, 80), fonction: txt(champs.fonction, 80), telephone: txt(champs.telephone, 30) };
    if (creation) {
      if (x) throw Oups_('Un profil existe déjà pour cette adresse.');
      DB.ajouter('utilisateurs', Object.assign({ email: email, nom: (p.prenom + ' ' + p.nom_famille).trim(), role: role, actif: 'OUI', token: nouveauJeton_(), cree_le: maintenant_(), derniere_visite: '', cgu_le: '', origine: 'admin', modifie_le: maintenant_(), motif: '', sessions_avant: '' }, p));
      journalSecu_(u.email, 'utilisateur_ajoute', email + ' · rôle ' + libRole_(c, role));
      return true;
    }
    if (!x) throw Oups_('Ce profil n\'existe pas.');
    if (email === u.email && role !== 'admin') throw Oups_('Vous ne pouvez pas retirer vos propres droits ici : utilisez « Transférer l\'administration ».');
    if (role_(x.role) === 'admin' && role !== 'admin' && !DB.tout('utilisateurs').some(y => y.email !== email && role_(y.role) === 'admin' && etatAcces_(y) === 'ok')) throw Oups_('Il faut garder au moins un administrateur actif.');
    const maj = {}, diff = [];
    Object.keys(p).forEach(k => { if (champs[k] !== undefined && p[k] !== String(x[k] || '')) { maj[k] = p[k]; diff.push(k + ' : « ' + (x[k] || '') + ' » → « ' + p[k] + ' »'); } });
    if (role !== role_(x.role)) { maj.role = role; diff.push('rôle : ' + libRole_(c, role_(x.role)) + ' → ' + libRole_(c, role)); }
    if (!diff.length) return false;
    if (maj.prenom !== undefined || maj.nom_famille !== undefined) maj.nom = ((maj.prenom !== undefined ? maj.prenom : x.prenom || '') + ' ' + (maj.nom_famille !== undefined ? maj.nom_famille : x.nom_famille || '')).trim() || x.nom;
    if (maj.ul !== undefined && maj.ul === '' ) { }
    maj.modifie_le = maintenant_();
    DB.modifier('utilisateurs', 'email', email, maj);
    journalSecu_(u.email, maj.role ? 'role_modifie' : 'utilisateur_modifie', email + ' — ' + diff.join(' ; '));
    return true;
  });
}
// Accès : désactiver (réversible), réactiver, révoquer (définitif), annuler une révocation (exceptionnel, confirmé)
function api_changerAcces(sid, email, action, motif, confirmation) {
  return appel_(sid, 'admin', u => {
    DB.relire();   // décisions sur les comptes et les accès : toujours sur la base elle-même, jamais sur une copie en cache
    email = String(email || '').toLowerCase(); motif = String(motif || '').replace(/[<>]/g, '').slice(0, 300);
    const x = DB.trouver('utilisateurs', 'email', email);
    if (!x) throw Oups_('Ce profil n\'existe pas.');
    if (email === u.email) throw Oups_('Vous ne pouvez pas modifier votre propre accès.');
    const avant = etatAcces_(x);
    const adminsRestants = DB.tout('utilisateurs').filter(y => y.email !== email && role_(y.role) === 'admin' && etatAcces_(y) === 'ok').length;
    const maj = { modifie_le: maintenant_() };
    if (action === 'desactiver') {
      if (avant !== 'ok') throw Oups_('Cet accès n\'est pas actif.');
      if (role_(x.role) === 'admin' && !adminsRestants) throw Oups_('Il faut garder au moins un administrateur actif.');
      Object.assign(maj, { actif: 'NON', motif: motif, sessions_avant: String(Date.now()) });
    } else if (action === 'reactiver') {
      if (avant !== 'desactive') throw Oups_(avant === 'revoque' ? 'Cet accès a été révoqué : utilisez « Annuler la révocation ».' : 'Cet accès est déjà actif.');
      Object.assign(maj, { actif: 'OUI', motif: '' });
    } else if (action === 'revoquer') {
      if (confirmation !== 'REVOQUER') throw Oups_('Confirmation de la révocation manquante.');
      if (avant === 'revoque') throw Oups_('Cet accès est déjà révoqué.');
      if (role_(x.role) === 'admin' && !adminsRestants) throw Oups_('Il faut garder au moins un administrateur actif.');
      Object.assign(maj, { actif: 'REVOQUE', motif: motif, sessions_avant: String(Date.now()) });
    } else if (action === 'annuler_revocation') {
      if (confirmation !== 'RETABLIR') throw Oups_('Confirmation manquante.');
      if (avant !== 'revoque') throw Oups_('Cet accès n\'est pas révoqué.');
      Object.assign(maj, { actif: 'NON', motif: 'Révocation annulée — accès à réactiver' });
    } else throw Oups_('Action inconnue.');
    DB.modifier('utilisateurs', 'email', email, maj);
    journalSecu_(u.email, { desactiver: 'acces_desactive', reactiver: 'acces_reactive', revoquer: 'acces_revoque', annuler_revocation: 'revocation_annulee' }[action], email + (motif ? ' — motif : ' + motif : ''));
    return etatAcces_(Object.assign({}, x, maj));
  });
}
// Transfert d'administration : la personne choisie devient administratrice ; l'auteur peut renoncer à son rôle
function api_transfererAdmin(sid, email, renoncer) {
  return appel_(sid, 'admin', u => {
    DB.relire();   // décisions sur les comptes et les accès : toujours sur la base elle-même, jamais sur une copie en cache
    email = String(email || '').toLowerCase();
    const x = DB.trouver('utilisateurs', 'email', email);
    if (!x || etatAcces_(x) !== 'ok') throw Oups_('La personne doit avoir un profil actif.');
    if (email === u.email) throw Oups_('Choisissez une autre personne.');
    DB.modifier('utilisateurs', 'email', email, { role: 'admin', modifie_le: maintenant_() });
    if (renoncer === true) DB.modifier('utilisateurs', 'email', u.email, { role: roleRepli_(config_()), modifie_le: maintenant_() });
    journalSecu_(u.email, 'transfert_admin', email + ' devient administrateur' + (renoncer === true ? ' ; ' + u.email + ' renonce à son rôle (transfert d\'administration)' : ''));
    return true;
  });
}

// ---------- Journal ----------
function api_journal(sid) {
  return appel_(sid, 'admin', u => DB.dernieres('journal', 400).reverse().map(j => ({ date: j.date, email: j.email, evenement: j.evenement, detail: j.detail })));
}

// ---------- Export / import / versions / sauvegardes ----------
function api_exporter(sid) {
  return appel_(sid, 'admin', u => { journalSecu_(u.email, 'export', ''); return { nom: 'configuration_' + config_().identite.code + '_' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd') + '.json', contenu: JSON.stringify(exporter_(), null, 2) }; });
}

function api_exporterDrive(sid) {
  return appel_(sid, 'admin', u => {
    const nom = 'configuration_' + config_().identite.code + '_' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd_HHmm') + '.json';
    exigerFonction_('exports');
    const f = ecritureDrive_('exports', () => dossier_('configurations').createFile(nom, JSON.stringify(exporter_(), null, 2), 'application/json'));
    journalSecu_(u.email, 'export_drive', nom);
    return f.getUrl();
  });
}

function api_sauvegarderMaintenant(sid, commentaire) {
  return appel_(sid, 'admin', u => {
    exigerFonction_('sauvegardes');
    const f = sauvegarderVersion_('Sauvegarde manuelle' + (commentaire ? ' : ' + commentaire : ''), u.email);
    if (!f) throw Oups_('La sauvegarde a échoué : vérifiez le dossier « Sauvegardes » (Administration > Drive partagé).');
    journalSecu_(u.email, 'sauvegarde', f.getName());
    return f.getUrl();
  });
}

function lireExport_(texte) {
  let o;
  try { o = typeof texte === 'string' ? JSON.parse(texte) : texte; } catch (e) { throw Oups_('Ce fichier n\'est pas un fichier de configuration valide (JSON illisible).'); }
  if (!o || o.format !== FORMAT_EXPORT) throw Oups_('Ce fichier n\'est pas une configuration du Centre Com.');
  if (Number(o.version_schema) > VERSION_SCHEMA) throw Oups_('Ce fichier vient d\'une version plus récente de l\'application. Mettez d\'abord le code à jour.');
  if (!o.config || typeof o.config !== 'object') throw Oups_('Le fichier ne contient pas de configuration.');
  return o;
}

const SECTIONS_IMPORT = [
  ['identite', 'Identité (nom, code, logos, textes de connexion)', true],
  ['connexion', 'Page de connexion', false],
  ['apparence', 'Apparence (thème, couleurs, polices, composants)', false],
  ['animations', 'Animations', false],
  ['navigation', 'Navigation', false],
  ['textes', 'Textes et messages', false],
  ['demandes', 'Demandes (statuts, priorités, questions)', false],
  ['notifications', 'Notifications et modèles d\'e-mails', false],
  ['calendrier', 'Calendrier (catégories, journées)', false],
  ['ressources_cfg', 'Catégories de ressources', false],
  ['poles', 'Pôle image et presse', false],
  ['roles', 'Rôles et permissions', true],
  ['securite', 'Sécurité (mode de connexion, domaines)', true],
  ['drive', 'Dossiers du Drive (identifiants, noms, permissions)', true],
  ['profils', 'Profils et photos', false],
  ['materiel', 'Matériel et réservations (catégories, validation, délais)', false],
];

function api_apercuImport(sid, texte) {
  return appel_(sid, 'admin', u => {
    const o = lireExport_(texte);
    const v = validerConfig_(o.config);
    const a = config_();
    const memeDT = String(o.source || '') === String(a.identite.code);
    const val = { connexion: [a.connexion, v.cfg.connexion], identite: [a.identite, v.cfg.identite], apparence: [a.apparence, v.cfg.apparence], animations: [a.animations, v.cfg.animations], navigation: [a.navigation, v.cfg.navigation], textes: [a.textes, v.cfg.textes], demandes: [a.demandes, v.cfg.demandes], notifications: [a.notifications, v.cfg.notifications], calendrier: [a.calendrier, v.cfg.calendrier], ressources_cfg: [a.ressources, v.cfg.ressources], poles: [{ p: a.presse, i: a.pole_image }, { p: v.cfg.presse, i: v.cfg.pole_image }], roles: [a.roles, v.cfg.roles], securite: [a.securite, v.cfg.securite], drive: [{ i: a.drive, d: a.drive_dossiers }, { i: v.cfg.drive, d: v.cfg.drive_dossiers }], profils: [a.profils, v.cfg.profils], materiel: [a.materiel, v.cfg.materiel] };
    const sections = SECTIONS_IMPORT.map(s => { const diff = JSON.stringify(val[s[0]][0]) !== JSON.stringify(val[s[0]][1]); return { cle: s[0], titre: s[1], change: diff, sensible: s[2] && !memeDT, detail: diff ? resumeDiff_(val[s[0]][0], val[s[0]][1]) : 'Identique' }; });
    const t = o.tables || {};
    [['types', 'Types de demande', 'libelle'], ['ul', 'Unités locales', 'nom'], ['ressources', 'Ressources', 'titre'], ['utilisateurs', 'Utilisateurs (ajout / mise à jour, jamais de suppression)', 'email']].forEach(x => {
      if (!Array.isArray(t[x[0]])) return;
      const actuels = DB.tout(x[0]).map(r => r[x[2]]), nouveaux = t[x[0]].map(r => r[x[2]]);
      const plus = nouveaux.filter(n => actuels.indexOf(n) === -1).length, moins = actuels.filter(n => nouveaux.indexOf(n) === -1).length;
      sections.push({ cle: 'table_' + x[0], titre: x[1], change: plus + moins > 0 || x[0] !== 'utilisateurs', sensible: !memeDT && (x[0] === 'ul' || x[0] === 'utilisateurs'), detail: nouveaux.length + ' ligne(s) — ' + plus + ' nouvelle(s)' + (x[0] === 'utilisateurs' ? '' : ', ' + moins + ' retirée(s)') });
    });
    return { source: o.source, meme_dt: memeDT, exporte_le: o.exporte_le, version_code: o.version_code, erreurs: v.erreurs, sections: sections };
  });
}

// Ressource venant d'un fichier de configuration : un identifiant Drive n'est repris que s'il désigne un fichier
// existant rangé dans les dossiers de CETTE application ; sinon la ressource devient un brouillon « fichier à réimporter ».
function ressourceImportee_(x, i, u) {
  const perm = PERM_CODES.indexOf(x.permission) > -1 ? x.permission : 'ressources_voir';
  const o = { id: /^R-[a-z0-9]{6,20}$/i.test(x.id || '') ? x.id : 'R-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), type: x.type === 'fichier' ? 'fichier' : 'lien',
    rubrique: String(x.rubrique || 'Autres').slice(0, 60), titre: String(x.titre || '').slice(0, 150), description: String(x.description || '').slice(0, 600), url: /^https:\/\//i.test(x.url || '') ? x.url : '',
    ordre: i + 1, statut: String(x.statut || '').slice(0, 40), version: String(x.version || '').slice(0, 20), important: x.important === 'OUI' || x.important === true ? 'OUI' : '',
    type_lien: String(x.type_lien || '').slice(0, 40), permission: perm, etat: ETATS_RESSOURCE.indexOf(x.etat) > -1 ? x.etat : 'publiee', auteur: x.auteur || '', cree_le: x.cree_le || maintenant_(), maj_le: maintenant_(), origine: x.origine || '' };
  if (o.type === 'fichier') {
    const f = fichierApp_(x.fichier_id, true);
    if (f) Object.assign(o, { url: '', fichier_id: x.fichier_id, fichier_nom: nomFichier_(x.fichier_nom || f.getName()), fichier_mime: x.fichier_mime || f.getMimeType(), fichier_taille: String(f.getSize()), dossier: DOSSIERS.some(d => d[0] === x.dossier) ? x.dossier : 'ressources', origine: x.origine === 'import' ? 'import' : 'rattache' });
    else Object.assign(o, { url: '', fichier_id: '', fichier_nom: String(x.fichier_nom || '').slice(0, 120), etat: 'brouillon', description: (o.description ? o.description + ' — ' : '') + 'Fichier à réimporter.' });
  }
  return o;
}

function resumeDiff_(a, b) {
  if (a && b && typeof a === 'object' && !Array.isArray(a)) {
    const k = Object.keys(Object.assign({}, a, b)).filter(x => JSON.stringify(a[x]) !== JSON.stringify(b[x]));
    return k.length + ' réglage(s) modifié(s) : ' + k.slice(0, 6).join(', ') + (k.length > 6 ? '…' : '');
  }
  return 'Modifié';
}

function api_importer(sid, texte, sections, commentaire) {
  return appel_(sid, 'admin', u => {
    DB.relire();   // décisions sur les comptes et les accès : toujours sur la base elle-même, jamais sur une copie en cache
    const o = lireExport_(texte);
    sections = sections || [];
    sauvegarderVersion_('Avant import (' + (o.source || '?') + ')', u.email);
    const cfg = JSON.parse(JSON.stringify(config_()));
    const v = validerConfig_(o.config);
    if (v.erreurs.length) throw Oups_('Import refusé, le fichier contient des erreurs :\n• ' + v.erreurs.join('\n• '));
    ['identite', 'connexion', 'apparence', 'animations', 'navigation', 'textes', 'demandes', 'notifications', 'calendrier', 'roles', 'securite', 'drive', 'profils', 'materiel'].forEach(k => { if (sections.indexOf(k) > -1) cfg[k] = v.cfg[k]; });
    if (sections.indexOf('drive') > -1) cfg.drive_dossiers = v.cfg.drive_dossiers;
    if (sections.indexOf('ressources_cfg') > -1) cfg.ressources = v.cfg.ressources;
    if (sections.indexOf('poles') > -1) { cfg.presse = v.cfg.presse; cfg.pole_image = v.cfg.pole_image; }
    enregistrerConfig_(cfg, u.email, commentaire || 'Import de configuration (' + (o.source || '?') + ')');
    const t = o.tables || {};
    if (sections.indexOf('table_types') > -1 && Array.isArray(t.types)) DB.remplacer('types', t.types.map((x, i) => ({ code: x.code, libelle: x.libelle, description: x.description, delai: Number(x.delai) || 7, champs: x.champs || '', obligatoires: x.obligatoires || '', pole: POLES_CODES.indexOf(x.pole) > -1 ? x.pole : 'graphique', ordre: i + 1, actif: x.actif === 'NON' ? 'NON' : 'OUI' })));
    if (sections.indexOf('table_ul') > -1 && Array.isArray(t.ul)) DB.remplacer('ul', t.ul.filter(x => x.nom).map(x => ({ nom: String(x.nom).slice(0, 80), actif: x.actif === 'NON' ? 'NON' : 'OUI' })));
    if (sections.indexOf('table_ressources') > -1 && Array.isArray(t.ressources)) DB.remplacer('ressources', t.ressources.map((x, i) => ressourceImportee_(x, i, u)));
    if (sections.indexOf('table_utilisateurs') > -1 && Array.isArray(t.utilisateurs)) {
      t.utilisateurs.forEach(x => {
        const email = String(x.email || '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
        const role = role_(x.role);
        const ex = DB.trouver('utilisateurs', 'email', email);
        const actif = ['NON', 'REVOQUE'].indexOf(String(x.actif).toUpperCase()) > -1 ? String(x.actif).toUpperCase() : 'OUI';
        if (ex) { if (email !== u.email) DB.modifier('utilisateurs', 'email', email, { nom: x.nom || ex.nom, role: role, ul: x.ul || '', actif: etatAcces_(ex) === 'revoque' ? 'REVOQUE' : actif, modifie_le: maintenant_() }); }
        else DB.ajouter('utilisateurs', { email: email, nom: x.nom || '', prenom: x.prenom || '', nom_famille: x.nom_famille || '', fonction: x.fonction || '', role: role, ul: x.ul || '', actif: actif, token: nouveauJeton_(), cree_le: maintenant_(), derniere_visite: '', origine: 'import', modifie_le: maintenant_() });
      });
    }
    journalSecu_(u.email, /restaur/i.test(commentaire || '') ? 'restauration' : 'import', (commentaire || '') + ' — sections : ' + sections.join(', '));
    return true;
  });
}

function api_versions(sid) {
  return appel_(sid, 'admin', u => {
    if (!fonctionOk_('sauvegardes')) return [];   // non configuré : la liste est simplement vide (état affiché par l'interface)
    const out = [], it = dossier_('sauvegardes').getFiles();
    while (it.hasNext()) { const f = it.next(); if (!/\.json$/i.test(f.getName())) continue; out.push({ id: f.getId(), nom: f.getName(), ts: f.getDateCreated().getTime(), date: Utilities.formatDate(f.getDateCreated(), 'Europe/Paris', "yyyy-MM-dd'T'HH:mm:ss"), description: f.getDescription() || '' }); }
    return out.sort((a, b) => b.ts - a.ts).slice(0, 50);
  });
}

function api_contenuVersion(sid, id) {
  return appel_(sid, 'admin', u => {
    let f; try { f = DriveApp.getFileById(String(id || '')); } catch (e) { throw Oups_('Cette version est introuvable (supprimée ou déplacée).'); }
    const autorises = [idDossier_('sauvegardes'), idDossier_('configurations')];
    let ok = false; const parents = f.getParents(); while (parents.hasNext()) if (autorises.indexOf(parents.next().getId()) > -1) ok = true;
    if (!ok) throw Oups_('Ce fichier n\'est pas une sauvegarde du Centre Com.');
    return f.getBlob().getDataAsString();
  });
}

function api_copieBase(sid) {
  return appel_(sid, 'admin', u => {
    exigerFonction_('sauvegardes');
    const copie = copieBase_();
    journalSecu_(u.email, 'copie_base', copie.getName());
    return copie.getUrl();
  });
}

function api_testEmail(sid, modele) {
  return appel_(sid, 'admin', u => {
    const exemple = { prenom: 'Marie', numero: config_().identite.code + '-2026-001', titre: 'Collecte alimentaire de printemps', type: 'Affiche ou flyer', ul: 'UL exemple', echeance: dateFr_(aujourdhui_()), responsable: nomDe_(u.email) || 'L\'équipe communication', demandeur: 'Marie Exemple', auteur: nomDe_(u.email), message: '', delai: 5, delai_conseille: 21, priorite_icone: '🟠', statut: 'Prise en charge', decision: 'Proposition validée ✔', media: 'Radio locale', date: dateFr_(aujourdhui_()) };
    mailModele_(u.email, modele || 'accuse', exemple, citation_('(Exemple de message)') + bouton_('Bouton d\'exemple', urlApp_('')), '', true);
    return true;
  });
}

// ---------- Diagnostic ----------
// Diagnostic complet (dossiers du Drive, fichiers et liens des ressources) : coûteux, gardé 10 minutes ; « Relancer » le refait
function api_diagnostic(sid, forcer) {
  return appel_(sid, 'admin', u => {
    return diagnosticCache_(u, forcer === true);
  });
}
// Diagnostic gardé 10 min par administrateur et par numéro de configuration (« Relancer le diagnostic » le refait)
function diagnosticCache_(u, forcer) {
  const cache = CacheService.getScriptCache(), cle = 'diag_' + String(u.email).slice(0, 120) + '_' + (config_().meta.numero || 0);
  if (!forcer) { try { const v = cache.get(cle); if (v) return JSON.parse(v); } catch (e) { } }
  const d = diagnostic_(u, forcer);
  try { const j = JSON.stringify(d); if (j.length < 90000) cache.put(cle, j, 1800); } catch (e) { }
  return d;
}

function diagnostic_(u, forcer) {
  const c = config_(), out = [];
  const add = (niveau, titre, detail, section) => out.push({ niveau: niveau, titre: titre, detail: detail || '', section: section || '' });
  let url = urlOfficielle_();
  add(url ? 'ok' : 'bloquant', 'Application déployée', url ? 'Adresse de l\'application disponible.' : 'Première installation seulement : Déployer > Nouveau déploiement > Application Web. Pour une mise à jour : Gérer les déploiements > Modifier > Nouvelle version.', '');
  const urlProp = urlProprieteOfficielle_();
  add(MOTIF_URL_EXEC.test(urlProp) ? 'ok' : 'attention', 'Adresse officielle unique', MOTIF_URL_EXEC.test(urlProp) ? urlProp + ' — utilisée dans tous les liens. Mises à jour : Gérer les déploiements > ce déploiement > Modifier > Nouvelle version (l\'adresse ne change pas).'
    : 'Propriété URL_OFFICIELLE ' + (urlProp ? 'au format invalide' : 'absente') + ' : dans Apps Script, Paramètres du projet > Propriétés du script, ajoutez URL_OFFICIELLE = l\'adresse /exec du déploiement Application Web partagé aux utilisateurs.', '');
  // Version réellement servie par l'adresse utilisée : si elle n'est pas la dernière livrée, le déploiement n'a pas été mis à jour
  add('ok', 'Version en service', 'Code ' + VERSION_CODE + ' — c\'est la version servie par l\'adresse que vous utilisez. Si une mise à jour plus récente a été installée et que ce numéro n\'a pas changé : Déployer > Gérer les déploiements > Modifier > Nouvelle version.', '');
  add(c.identite.code !== 'DTXX' && c.identite.nom_centre !== 'Centre Com' ? 'ok' : 'attention', 'Identité de la délégation', c.identite.nom_centre + ' · ' + c.identite.code, 'identite');
  // Authentification et sessions
  const SE = c.securite;
  const usersTous = DB.tout('utilisateurs'), actifs = usersTous.filter(x => String(x.actif).toUpperCase() !== 'NON');
  add(SE.mode === 'lien' ? 'attention' : 'ok', 'Authentification Google configurée',
    SE.mode === 'lien' ? 'Connexion Google désactivée : seul le lien par e-mail est utilisé. Recommandé : mode « Compte Google ».'
      : 'Comptes du domaine Google Workspace : identité fournie par Google au serveur.' + (SE.google_client_id ? ' Comptes hors domaine : Google Identity Services configuré (jeton vérifié par Google).' : ' Comptes hors domaine : non pris en charge (identifiant client Google Identity Services non renseigné).') + (SE.mode === 'mixte' ? ' Lien de secours par e-mail activé.' : ''), 'securite');
  add('ok', 'Vérification serveur active', 'Page de connexion obligatoire pour tous les rôles ; chaque fonction du serveur vérifie session, compte actif, rôle et permission.', 'securite');
  const risques = ((c.roles[SE.role_defaut] || {}).permissions || []).filter(p => ['demande_voir_toutes', 'demande_traiter', 'notes_internes', 'presse', 'image_gerer', 'ressources_gerer', 'calendrier_modifier'].indexOf(p) > -1);
  add(actifs.length ? 'ok' : 'bloquant', 'Utilisateurs et inscriptions', actifs.length + ' profil(s) actif(s), ' + usersTous.filter(x => etatAcces_(x) === 'desactive').length + ' désactivé(s), ' + usersTous.filter(x => etatAcces_(x) === 'revoque').length + ' révoqué(s) · ' + ({ libre: 'Inscription libre : tout compte Google vérifié peut créer son profil', domaines: 'Inscription réservée aux domaines ' + SE.domaines, liste: 'Pas d\'inscription : profils ajoutés par un administrateur' })[SE.inscription] + ' · Rôle attribué : ' + libRole_(c, SE.role_defaut) + '.', 'utilisateurs');
  if (SE.inscription !== 'liste' && risques.length) add('attention', 'Rôle attribué à l\'inscription', 'Le rôle « ' + libRole_(c, SE.role_defaut) + ' » donne des permissions étendues à toute personne qui s\'inscrit : ' + risques.join(', ') + '. Conseil : un rôle limité (« Nouveau membre »).', 'roles');
  add(c.notifications.inscriptions ? 'ok' : 'attention', 'Notification des inscriptions', c.notifications.inscriptions ? 'Envoyée à ' + (c.notifications.emails_inscriptions || 'tous les administrateurs actifs') + '.' : 'Désactivée : les nouveaux profils ne sont visibles que dans Utilisateurs.', 'notifications');
  const rolesVides = rolesCodes_(c).filter(r => r !== 'admin' && roleActif_(c, r) && !((c.roles[r] || {}).permissions || []).length);
  add(rolesVides.length ? 'attention' : 'ok', 'Rôles configurés', rolesCodes_(c).filter(r => roleActif_(c, r)).length + ' rôles actifs, ' + PERM_CODES.length + ' permissions.' + (rolesVides.length ? ' Sans aucune permission : ' + rolesVides.map(r => libRole_(c, r)).join(', ') + '.' : ''), 'roles');
  if (u) add('ok', 'Session active', 'Vous : ' + u.email + ' (' + libRole_(c, u.role) + '), connecté(e) par ' + (u.via === 'google' ? 'compte Google' : 'lien de connexion') + '. Durée maximale d\'une session : ' + SE.duree_max_h + ' h.', 'securite');
  add(SE.inactivite_min > 0 ? 'ok' : 'attention', 'Déconnexion automatique configurée', SE.inactivite_min > 0 ? 'Après ' + SE.inactivite_min + ' min d\'inactivité, avertissement ' + SE.avertissement_s + ' s avant.' : 'Désactivée : une session inactive n\'est fermée qu\'au bout de 6 heures sans aucune action. Conseillé : 30 minutes.', 'securite');
  const users = actifs;
  const admins = users.filter(x => role_(x.role) === 'admin');
  const traitants = users.filter(x => { const r = role_(x.role); return r === 'admin' || ((c.roles[r] || {}).permissions || []).indexOf('demande_traiter') > -1; });
  add(admins.length >= 2 ? 'ok' : admins.length === 1 ? 'attention' : 'bloquant', 'Administrateurs', admins.length + ' actif(s). Conseil : au moins 2, pour ne jamais perdre l\'accès.', 'utilisateurs');
  add(traitants.length ? 'ok' : 'attention', 'Personnes qui traitent les demandes', traitants.length ? traitants.length + ' personne(s).' : 'Aucune : les demandes seront reçues mais personne ne pourra les traiter (donnez la permission « Traiter les demandes » à un rôle).', 'utilisateurs');
  if (!rolesCodes_(c).filter(r => r !== 'admin' && roleActif_(c, r)).some(r => (c.roles[r].permissions || []).indexOf('demande_creer') > -1)) add('attention', 'Rôles', 'Aucun rôle (hors administrateur) ne peut déposer de demande.', 'roles');
  const dests = destinatairesEquipe_();
  add(dests.length ? 'ok' : 'attention', 'Destinataires des nouvelles demandes', dests.join(', ') || 'Aucun : les demandes restent visibles dans l\'application, sans alerte par e-mail.', 'notifications');
  add(DB.tout('ul').some(x => x.actif !== 'NON') ? 'ok' : 'bloquant', 'Unités locales', DB.tout('ul').filter(x => x.actif !== 'NON').length + ' active(s).', 'ul');
  add(typesActifs_().length ? 'ok' : 'bloquant', 'Types de demande', typesActifs_().length + ' actif(s).', 'types');
  // Drive
  verifierDriveCache_(forcer).dossiers.forEach(d => {
    if (d.etat === 'ok') return;
    if (d.etat === 'inactif') return;
    // Un dossier manquant n'empêche pas d'utiliser l'application : seule la fonction qui en dépend est indisponible
    add('attention', 'Drive : ' + d.libelle, d.detail + (d.etat === 'non_configure' ? ' Fonction concernée indisponible en attendant.' : ''), 'drive');
  });
  let compteExec = ''; try { compteExec = Session.getEffectiveUser().getEmail(); } catch (e) { }
  add('ok', 'Compte d\'exécution (accès au Drive)', (compteExec || 'inconnu') + ' : seul ce compte a besoin d\'être membre du Drive partagé. Les utilisateurs accèdent aux fichiers par l\'application, selon leur rôle.', 'drive');
  const ress = lignesRessources_(), vides = ress.filter(r => r.type !== 'fichier' && !r.url).map(r => r.titre);
  const fichiers = ress.filter(r => r.type === 'fichier'), perdus = fichiers.filter(r => !fichierApp_(r.fichier_id, true)).map(r => r.titre);
  add(perdus.length ? 'attention' : 'ok', 'Fichiers des ressources', fichiers.length + ' fichier(s) interne(s)' + (perdus.length ? ' ; indisponible(s) ou hors des dossiers de l\'application : ' + perdus.slice(0, 6).join(', ') + ' (Drive partagé > Contrôler les références)' : ', tous disponibles.'), 'ressources');
  add(vides.length ? 'attention' : 'ok', 'Liens des ressources', vides.length ? vides.length + ' ressource(s) sans lien : ' + vides.slice(0, 6).join(', ') + (vides.length > 6 ? '…' : '') : 'Tous les liens sont renseignés.', 'ressources');
  const casses = [];
  ress.filter(r => r.type !== 'fichier' && /drive\.google|docs\.google/.test(r.url)).forEach(r => {
    const id = idDepuisLien_(r.url); if (!id) return;
    try { DriveApp.getFileById(id); } catch (e) { try { DriveApp.getFolderById(id); } catch (e2) { casses.push(r.titre); } }
  });
  if (casses.length) add('attention', 'Liens Drive inaccessibles', 'Supprimés, déplacés ou non partagés avec le compte de l\'application : ' + casses.join(', '), 'ressources');
  const declencheur = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'routineQuotidienne');
  add(declencheur ? 'ok' : 'attention', 'Automatismes quotidiens', declencheur ? 'Rappels et point hebdo actifs.' : 'Déclencheur absent : relancez installer() depuis Apps Script.', '');
  let quota = null; try { quota = MailApp.getRemainingDailyQuota(); } catch (e) { }
  if (quota !== null) add(quota > 20 ? 'ok' : 'attention', 'Quota d\'e-mails du jour', quota + ' envoi(s) restant(s).', '');
  const F = etatFonctions_(forcer), nc = Object.keys(F).filter(k => F[k].etat !== 'ok');
  add(nc.length ? 'attention' : 'ok', 'Fonctions disponibles', nc.length ? 'Non configurées (indisponibles en attendant, le reste fonctionne) : ' + nc.map(k => F[k].titre).join(', ') + '.' : 'Toutes les fonctions sont configurées.', nc.length ? F[nc[0]].section : '');
  return out;
}

// =====================================================================
// ÉTAT DE LA CONFIGURATION ET RETOUR ARRIÈRE (Administration > Configuration et retour arrière)
// Configuration progressive : ce qui est configuré fonctionne ; une fonction non configurée est signalée et
// indisponible (etatFonctions_), le reste fonctionne.
// =====================================================================
function api_etatConfiguration(sid) {
  return appel_(sid, 'admin', u => {
    // Diagnostic et état des fonctions déjà calculés (10 min, refaits à chaque changement de configuration) : aucun accès Drive en plus
    const diag = diagnosticCache_(u, false), F = etatFonctions_();
    return { version: VERSION_CODE, fonctions: Object.keys(F).map(k => Object.assign({ cle: k }, F[k])),
      a_completer: diag.filter(d => d.niveau !== 'ok'), precedente: DB.tout('configuration').some(r => r.cle === 'precedente') };
  });
}
// =====================================================================
// AIDE ET FAQ — questions dans l'onglet FAQ ; lecture : toute personne connectée (questions publiées) ;
// écriture : permission faq_gerer (vérifiée ici). Catégories et réglages : configuration (section « aide », administrateur).
// =====================================================================
const FAQ_VUES = ['', 'accueil', 'demandes', 'nouvelle', 'ressources', 'calendrier', 'phototheque', 'materiel', 'image', 'profil', 'aide'];
const FAQ_ETATS = ['publiee', 'brouillon', 'archivee'];
const FAQ_INITIALE = [
  ['Premiers pas', 'À quoi sert le Centre Com ?', 'C\'est l\'espace de la communication de la délégation : vous y déposez vos demandes (affiche, publication, photos, conseil…), vous suivez leur avancement, et vous trouvez les ressources utiles (logos, modèles, guides).', 'présentation, espace com, utilité', 'accueil'],
  ['Premiers pas', 'Je viens de créer mon profil : par quoi commencer ?', 'Complétez votre profil (unité locale, fonction, photo), parcourez les Ressources, puis faites votre première demande si vous avez un projet. Le bouton « Nouvelle demande » est toujours visible.', 'débuter, nouveau, inscription, démarrer', 'profil'],
  ['Premiers pas', 'Qui voit mes demandes ?', 'Vous et l\'équipe communication. Selon leur rôle, le référent communication de votre unité locale (RLCOM) peut aussi les voir. Les notes internes de l\'équipe ne sont jamais visibles des demandeurs.', 'confidentialité, visibilité, rlcom', ''],
  ['Demandes de communication', 'Comment faire une demande ?', 'Cliquez sur « Nouvelle demande », choisissez le type (affiche, publication, photo…), remplissez le formulaire puis vérifiez avant d\'envoyer. Vous recevez un e-mail de confirmation.', 'demander, formulaire, créer, affiche, flyer', 'nouvelle'],
  ['Demandes de communication', 'Quel délai prévoir ?', 'Chaque type de demande a un délai conseillé, affiché sur l\'accueil et au moment de choisir le type. Une demande tardive reste possible : l\'équipe vous dira ce qui est faisable.', 'délai, urgence, temps, date', 'nouvelle'],
  ['Demandes de communication', 'L\'équipe me demande une information : que faire ?', 'La demande passe en « En attente d\'informations » et vous recevez un e-mail. Ouvrez la demande et répondez dans la zone de messages : l\'équipe est prévenue.', 'attente, répondre, message, information', 'demandes'],
  ['Demandes de communication', 'Comment valider une proposition ?', 'Quand une demande est « À valider », ouvrez-la : vous pouvez valider la proposition ou demander une modification en expliquant ce qui ne convient pas.', 'valider, proposition, modification, bat', 'demandes'],
  ['Demandes de communication', 'Puis-je envoyer des photos de personnes ?', 'Seulement si les personnes reconnaissables ont donné leur accord écrit. Aucune photo d\'une personne accompagnée sans autorisation. En cas de doute, ne l\'envoyez pas et demandez conseil à l\'équipe.', 'droit à l\'image, autorisation, photo, consentement', ''],
  ['Ressources', 'Où trouver les logos et les modèles ?', 'Dans la rubrique Ressources. Utilisez la recherche ou les rubriques pour filtrer. Un fichier s\'ouvre en aperçu, puis se télécharge.', 'logo, modèle, charte, gabarit, télécharger', 'ressources'],
  ['Ressources', 'Je n\'arrive pas à ouvrir une ressource', 'Certaines ressources sont réservées à des rôles précis. Si une ressource attendue n\'apparaît pas ou ne s\'ouvre pas, écrivez à l\'équipe communication depuis cette page d\'aide.', 'accès, ouvrir, téléchargement, droits', 'ressources'],
  ['Photothèque', 'Où trouver des photos pour ma communication ?', 'Dans la Photothèque (menu) : recherchez par mot, unité locale, événement ou photographe, ouvrez une photo en grand et téléchargez-la si votre rôle le permet. Respectez toujours les « informations d\'utilisation » indiquées sur la fiche. Pour un besoin précis, faites une demande « Reportage photo ».', 'photo, image, banque d\'images, pôle image, photothèque', 'phototheque'],
  ['Matériel et réservations', 'Comment réserver du matériel ?', 'Menu « Matériel » > « Réserver » : choisissez le matériel, la ou les dates (journée entière ou heures), le lieu ou l\'utilisation. La disponibilité réelle s\'affiche avant de confirmer. Selon les réglages, la réservation est confirmée tout de suite ou après validation de l\'équipe : vous êtes prévenu(e) par e-mail. Retrouvez et annulez vos réservations dans « Mes réservations ».', 'matériel, réserver, réservation, emprunt, prêt, stand, disponibilité', 'materiel'],
  ['Photothèque', 'Comment ajouter mes photos à la photothèque ?', 'Photothèque > « Importer des photos » (si votre rôle le permet) : choisissez une ou plusieurs photos, renseignez les informations communes (événement, unité, photographe…), puis importez. Vos photos sont vérifiées par l\'équipe avant d\'être visibles de tous. N\'importez que des photos dont les personnes reconnaissables ont donné leur accord.', 'importer, ajouter, déposer, photos, droit à l\'image', 'phototheque'],
  ['Communication et réseaux sociaux', 'Puis-je publier au nom de la Croix-Rouge sur les réseaux sociaux ?', 'Les publications institutionnelles passent par l\'équipe communication. Pour valoriser une action de votre unité locale, faites une demande « Publication » : nous vous aidons à la préparer.', 'réseaux sociaux, facebook, instagram, publier, post', 'nouvelle'],
  ['Centre Com', 'Comment retrouver rapidement quelque chose ?', 'Utilisez la recherche en haut du menu (raccourci Ctrl+K ou « / ») : elle retrouve les demandes, ressources, questions d\'aide et pages auxquelles vous avez accès.', 'recherche, trouver, raccourci', ''],
  ['Profil', 'Comment changer ma photo ou mon unité locale ?', 'Ouvrez « Mon profil » (en bas du menu, ou votre photo en haut à droite sur téléphone), modifiez puis enregistrez.', 'photo, profil, ul, unité locale, téléphone', 'profil'],
  ['Profil', 'Puis-je passer en thème sombre ?', 'Oui : dans « Mon profil », réglez le thème (clair, sombre ou automatique), la taille du texte et les animations. Ces préférences ne concernent que vous.', 'thème, sombre, taille, animations, accessibilité', 'profil'],
  ['Problèmes techniques', 'Je suis déconnecté(e) tout seul', 'Par sécurité, la session se ferme après une période d\'inactivité ; un avertissement apparaît avant. Reconnectez-vous avec votre compte Google : rien n\'est perdu de ce qui a été envoyé.', 'déconnexion, session, expirée, inactivité', ''],
  ['Problèmes techniques', 'Un message « Mise à jour incomplète » s\'affiche', 'Le site est en cours de mise à jour. Rechargez la page dans quelques minutes ; si le message reste, prévenez l\'équipe communication.', 'erreur, mise à jour, version, bug', ''],
];
// L'onglet FAQ est créé s'il manque (mise à jour sans relance d'installer()) ; les questions de départ sont posées une seule fois.
function faqLignes_() {
  assurerOnglet_('faq');
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('FAQ_INITIALE') && !DB.tout('faq').length) {
    const t = maintenant_();
    DB.remplacer('faq', FAQ_INITIALE.map((x, i) => ({ id: 'Q-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), categorie: x[0], question: x[1], reponse: x[2], mots_cles: x[3], ordre: i + 1, etat: 'publiee', lien_vue: x[4], auteur: 'installation', maj_le: t })));
  }
  props.setProperty('FAQ_INITIALE', '1');
  // 3.10 : la réponse de départ sur les photos (jamais modifiée depuis l'installation) présente la photothèque
  if (!props.getProperty('FAQ_PHOTOTHEQUE')) {
    const q = DB.tout('faq').find(x => x.auteur === 'installation' && x.question === 'Où trouver des photos pour ma communication ?');
    if (q && /^Les photos de la délégation sont gérées par le pôle image/.test(q.reponse)) DB.modifier('faq', 'id', q.id, { reponse: FAQ_INITIALE.find(x => x[1] === q.question)[2], lien_vue: 'phototheque' });
    const ajout = FAQ_INITIALE.find(x => x[1] === 'Comment ajouter mes photos à la photothèque ?'), L = DB.tout('faq');
    if (q && !L.some(x => x.question === ajout[1])) DB.ajouter('faq', { id: 'Q-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), categorie: ajout[0], question: ajout[1], reponse: ajout[2], mots_cles: ajout[3], ordre: (Number(q.ordre) || L.length) + 0.5, etat: 'publiee', lien_vue: ajout[4], auteur: 'installation', maj_le: maintenant_() });
    props.setProperty('FAQ_PHOTOTHEQUE', '1');
  }
  // 3.12 : question de départ sur la réservation de matériel (ajoutée une seule fois aux installations existantes)
  if (!props.getProperty('FAQ_MATERIEL')) {
    const q = FAQ_INITIALE.find(x => x[0] === 'Matériel et réservations'), L = DB.tout('faq');
    if (L.length && !L.some(x => x.question === q[1])) DB.ajouter('faq', { id: 'Q-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), categorie: q[0], question: q[1], reponse: q[2], mots_cles: q[3], ordre: L.length + 1, etat: 'publiee', lien_vue: q[4], auteur: 'installation', maj_le: maintenant_() });
    props.setProperty('FAQ_MATERIEL', '1');
  }
  return DB.tout('faq').slice().sort((a, b) => Number(a.ordre) - Number(b.ordre));
}
function faqPublique_(q, gestion) {
  const o = { id: q.id, categorie: q.categorie, question: q.question, reponse: q.reponse, mots_cles: q.mots_cles, lien_vue: q.lien_vue || '' };
  if (gestion) Object.assign(o, { etat: FAQ_ETATS.indexOf(q.etat) > -1 ? q.etat : 'publiee', ordre: Number(q.ordre) || 0, auteur_nom: q.auteur ? (q.auteur === 'installation' ? 'Installation' : nomDe_(q.auteur)) : '', maj_le: q.maj_le || '' });
  return o;
}
function api_aide(sid) {
  return appel_(sid, 'connecte', u => {
    const gerer = peut_(u, 'faq_gerer'), L = faqLignes_();
    return { questions: L.filter(q => (q.etat || 'publiee') === 'publiee').map(q => faqPublique_(q, false)), gestion: gerer ? L.map(q => faqPublique_(q, true)) : null };
  });
}
function api_enregistrerFaq(sid, m) {
  return appel_(sid, 'faq_gerer', u => {
    m = m || {};
    const txt = (v, max) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, max);
    const cats = config_().aide.categories.map(c => c.nom);
    const o = { categorie: txt(m.categorie, 60), question: txt(m.question, 200).replace(/\s+/g, ' '), reponse: txt(m.reponse, 4000), mots_cles: txt(m.mots_cles, 200).replace(/\s+/g, ' '),
      etat: FAQ_ETATS.indexOf(m.etat) > -1 ? m.etat : 'publiee', lien_vue: FAQ_VUES.indexOf(m.lien_vue || '') > -1 ? (m.lien_vue || '') : '', auteur: u.email, maj_le: maintenant_() };
    if (cats.indexOf(o.categorie) === -1) throw Oups_('Choisissez une catégorie de la liste (Administration > Aide et FAQ).');
    if (o.question.length < 5) throw Oups_('La question est trop courte.');
    if (!o.reponse) throw Oups_('La réponse est obligatoire.');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const L = faqLignes_();
      if (m.id) {
        if (!L.some(q => q.id === m.id)) throw Oups_('Cette question a été supprimée entre-temps.');
        DB.modifier('faq', 'id', m.id, o); journalSecu_(u.email, 'faq_modifiee', o.question.slice(0, 120) + ' (' + o.etat + ')');
        return m.id;
      }
      const id = 'Q-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
      DB.ajouter('faq', Object.assign({ id: id, ordre: L.reduce((x, q) => Math.max(x, Number(q.ordre) || 0), 0) + 1 }, o));
      journalSecu_(u.email, 'faq_ajoutee', o.question.slice(0, 120));
      return id;
    } finally { lock.releaseLock(); }
  });
}
function api_supprimerFaq(sid, id) {
  return appel_(sid, 'faq_gerer', u => {
    const q = DB.trouver('faq', 'id', String(id || ''));
    if (!q) throw Oups_('Cette question a déjà été supprimée.');
    DB.supprimer('faq', 'id', q.id); journalSecu_(u.email, 'faq_supprimee', String(q.question).slice(0, 120));
    return true;
  });
}
function api_ordreFaq(sid, ids) {
  return appel_(sid, 'faq_gerer', u => {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const L = faqLignes_(); ids = Array.isArray(ids) ? ids.map(String) : [];
      if (ids.length !== L.length || L.some(q => ids.indexOf(q.id) === -1)) throw Oups_('La liste a changé entre-temps : rechargez la page.');
      DB.remplacer('faq', ids.map((id, i) => { const q = Object.assign({}, L.find(x => x.id === id), { ordre: i + 1 }); delete q._ligne; return q; }));
      journalSecu_(u.email, 'faq_ordre', ids.length + ' questions');
      return true;
    } finally { lock.releaseLock(); }
  });
}
// « Écrire à l'équipe / signaler un problème » : question → équipe communication ; problème → administrateurs.
// Limité à 5 messages par heure et par personne ; l'adresse de réponse est celle de la personne (identifiée par le serveur).
function api_signaler(sid, type, message, page) {
  return appel_(sid, 'connecte', u => {
    const c = config_();
    if (!c.aide.signalement) throw Oups_('Le formulaire de contact est désactivé : utilisez les coordonnées indiquées sur la page d\'aide.');
    type = type === 'probleme' ? 'probleme' : 'question';
    message = String(message || '').replace(/\r/g, '').trim().slice(0, 3000);
    page = String(page || '').replace(/[^\w :\-éèàçù]/gi, '').slice(0, 60);
    if (message.length < 10) throw Oups_('Décrivez votre question ou le problème en quelques mots (10 caractères au moins).');
    const cache = CacheService.getScriptCache(), cle = 'signal_' + u.email, n = Number(cache.get(cle) || 0);
    if (n >= 5) throw Oups_('Vous avez déjà envoyé plusieurs messages cette heure-ci. L\'équipe vous répond dès que possible.');
    const admins = DB.tout('utilisateurs').filter(x => role_(x.role) === 'admin' && etatAcces_(x) === 'ok').map(x => x.email);
    const dests = type === 'question' && destinatairesEquipe_().length ? destinatairesEquipe_() : admins;
    if (!dests.length) throw Oups_('Aucun destinataire n\'est configuré. Prévenez un administrateur.');
    const titre = type === 'probleme' ? 'Problème signalé sur le Centre Com' : 'Question posée depuis l\'aide';
    const corps = '<p><b>' + esc_(u.nom || u.email) + '</b> (' + esc_(u.email) + (u.ul ? ' · ' + esc_(u.ul) : '') + ')' + (page ? ' — page : ' + esc_(page) : '') + '</p>' +
      '<p style="white-space:pre-wrap;background:#f6f5f3;padding:12px;border-radius:6px">' + esc_(message) + '</p><p style="color:#6b6b6b;font-size:13px">Répondez directement à cet e-mail pour lui écrire.</p>';
    const ok = dests.filter(d => envoyerMail_(d, '[' + c.identite.code + '] ' + titre, titre, corps, u.email)).length;
    notifier_(dests, { type: 'admin', titre: titre, texte: (u.nom || u.email) + ' : ' + message.slice(0, 200) + ' (réponse par e-mail : ' + u.email + ')', lien: '', cle: '' }, u.email);
    cache.put(cle, String(n + 1), 3600);
    journalSecu_(u.email, 'signalement', (type === 'probleme' ? 'Problème' : 'Question') + (page ? ' (' + page + ')' : '') + ' — envoyé à ' + ok + ' destinataire(s)');
    if (!ok) throw Oups_('Le message n\'a pas pu être envoyé. Réessayez plus tard.');
    return ok;
  });
}
// =====================================================================
// PHOTOTHÈQUE — fichiers dans le Drive partagé (dossiers « phototheque » et « phototheque_archives », configurables
// dans Administration > Drive partagé), fiches dans l'onglet Photothèque, vignettes dans l'onglet « Vignettes photos ».
// Les albums sont des listes d'identifiants : aucun fichier n'est jamais copié. Toutes les règles d'accès sont ici.
// =====================================================================
const PHOTO_STATUTS = ['a_valider', 'publiee', 'restreinte', 'archivee', 'corbeille'];
const ALBUM_TYPES = ['evenement', 'campagne', 'action', 'projet', 'unite', 'autre'];
const PHOTO_EXT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
// Vidéos (3.21) : dans la même photothèque (genre « video ») ; conteneur contrôlé sur le contenu (MP4 / MOV : « ftyp », WebM : EBML)
const VIDEO_EXT = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
function typeVideo_(oct) {
  const b = i => (oct[i] & 255);
  if (!oct || oct.length < 12) return '';
  if (b(4) === 0x66 && b(5) === 0x74 && b(6) === 0x79 && b(7) === 0x70) return (b(8) === 0x71 && b(9) === 0x74) ? 'video/quicktime' : 'video/mp4';
  if (b(0) === 0x1A && b(1) === 0x45 && b(2) === 0xDF && b(3) === 0xA3) return 'video/webm';
  return '';
}
const estVideo_ = p => p && (p.genre === 'video' || /^video\//.test(String(p.mime || '')));
const PHOTO_TXT = { titre: 150, description: 2000, photographe: 100, credit: 150, evenement: 150, lieu: 150, tags: 300, campagne: 120, droits_note: 500, note_interne: 1000 };
const LIMITE_LOT_PHOTOS = 200;

// Onglet créé s'il manque (mise à jour sans relance d'installer()) — même règle que l'onglet FAQ
// Google Sheets refuse toute plage qui dépasse la grille d'un onglet (onglet neuf : 1 000 lignes × 26 colonnes) : « The coordinates
// of the range are outside the dimensions of the sheet ». CAUSE DU BLOCAGE DE L'IMPORT (3.23) : l'onglet Photothèque (35 puis
// 37 colonnes) créé à la volée n'avait que 26 colonnes, donc aucune photo ne pouvait être enregistrée. La grille est agrandie
// avant chaque écriture qui la dépasserait (lignes par paquets de 500), mémorisée pendant l'exécution (aucun appel inutile).
function grille_(sh, lignes, cols) {
  const G = DB._cache.__grilles || (DB._cache.__grilles = {}), k = sh.getName(), g = G[k] || (G[k] = { r: sh.getMaxRows(), c: sh.getMaxColumns() });
  if (lignes > g.r - 20) g.r = sh.getMaxRows();   // près de la limite (ou lignes supprimées entre-temps) : taille réelle relue
  if (lignes > g.r) { const n = Math.max(lignes - g.r, 500); sh.insertRowsAfter(g.r, n); g.r += n; }
  if (cols > g.c) { sh.insertColumnsAfter(g.c, cols - g.c); g.c = cols; }
}
function assurerOnglet_(table) {
  const ss = DB.ss(), t = TABLES[table];
  if (ss.getSheetByName(t.onglet)) return;
  const sh = ss.insertSheet(t.onglet);
  grille_(sh, 1, t.cols.length);
  sh.getRange(1, 1, sh.getMaxRows(), t.cols.length).setNumberFormat('@');
  sh.getRange(1, 1, 1, t.cols.length).setValues([t.cols]).setFontWeight('bold').setBackground('#e30613').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  delete DB._cache[table]; DB.change_(table);   // onglet recréé : aucune copie en cache de l'ancien contenu
}
const ONGLETS_A_LA_VOLEE = ['phototheque', 'photo_vignettes', 'albums', 'photo_favoris', 'faq', 'materiel', 'materiel_photos', 'materiel_galerie', 'reservations', 'notifications', 'pieces'];
// Colonnes ajoutées par une mise à jour (ex. « genre », « duree » en 3.21) : créées à droite, en-têtes compris, sans toucher aux données
function assurerColonnes_(table) {
  const sh = DB.feuille(table), cols = TABLES[table].cols, n = sh.getLastColumn();
  grille_(sh, 1, cols.length);   // onglet resté à 26 colonnes (créé avant cette correction) : élargi
  if (n >= cols.length) return;
  sh.getRange(1, n + 1, 1, cols.length - n).setValues([cols.slice(n)]).setFontWeight('bold').setBackground('#e30613').setFontColor('#ffffff');
}
function onglets_photos_() { const c = CacheService.getScriptCache(); if (c.get('onglets_photos_323')) return; ['phototheque', 'photo_vignettes', 'albums', 'photo_favoris'].forEach(assurerOnglet_); try { assurerColonnes_('phototheque'); } catch (e) { console.error('Colonnes photothèque : ' + e); } try { c.put('onglets_photos_323', '1', 21600); } catch (e) { } }
function photosLignes_() { onglets_photos_(); return DB.tout('phototheque'); }
// Index léger (champs utiles aux listes, filtres et règles d'accès), gardé 5 min en cache serveur et périmé à chaque écriture
const CHAMPS_INDEX_PHOTO = ['id', 'dossier', 'nom_original', 'taille', 'largeur', 'hauteur', 'titre', 'description', 'date_prise', 'photographe', 'credit', 'evenement', 'lieu', 'ul', 'categorie', 'tags', 'campagne', 'type_contenu', 'utilisation', 'droits', 'statut', 'evenement_cal', 'demande_id', 'lot', 'importe_par', 'importe_le', 'genre', 'duree', 'mime'];
function indexPhotos_() {
  onglets_photos_();
  if (DB._cache.idx_photos) return DB._cache.idx_photos;
  if (DB._direct) cacheInvalider_('idx_photos');
  // Copie partagée en colonnes (noms des champs une seule fois) : ~30 % plus petite, donc gardée en cache jusqu'à ~2 300
  // photos au lieu de ~1 600. 30 min ; périmée à chaque écriture dans la photothèque (DB.change_).
  const K = CHAMPS_INDEX_PHOTO;
  const c = cacheLire_('idx_photos', 21600, () => ({ k: K, v: DB.tout('phototheque').map(p => K.map(k => p[k] === '' ? null : k === 'description' ? String(p[k]).slice(0, 300) : p[k])) }));
  if (Array.isArray(c)) return (DB._cache.idx_photos = c);   // copie au format précédent (avant la mise à jour) : utilisable telle quelle
  return (DB._cache.idx_photos = c.v.map(r => { const o = {}; c.k.forEach((k, i) => { if (r[i] !== null && r[i] !== undefined) o[k] = r[i]; }); return o; }));
}
function favorisDe_(u) { onglets_photos_(); const o = {}; DB.tout('photo_favoris').forEach(f => { if (f.email === u.email) o[f.photo_id] = true; }); return o; }
function albumsLignes_() { assurerOnglet_('albums'); return DB.tout('albums'); }

// Qui voit quoi (règle unique : liste, vignette, aperçu, téléchargement, export, albums, recherche, demandes)
function photoVisible_(u, p) {
  if (!p || !peut_(u, 'phototheque_voir')) return false;
  if (p.dossier && !peutDossier_(u, p.dossier)) return false;
  const mod = peut_(u, 'phototheque_modifier');
  switch (p.statut) {
    case 'publiee': return true;
    case 'a_valider': return mod || p.importe_par === u.email;
    case 'restreinte': return mod;
    case 'archivee': return mod || peut_(u, 'phototheque_archiver');
    case 'corbeille': return peut_(u, 'phototheque_supprimer');
    default: return false;
  }
}
function photoEditable_(u, p) { return peut_(u, 'phototheque_modifier') || (p.importe_par === u.email && p.statut === 'a_valider' && peut_(u, 'phototheque_importer')); }
function photoLegere_(p, u, fav) {
  const mod = peut_(u, 'phototheque_modifier');
  const o = { id: p.id, titre: p.titre, nom: p.nom_original, description: String(p.description || '').slice(0, 300), date_prise: p.date_prise, photographe: p.photographe, credit: p.credit,
    evenement: p.evenement, lieu: p.lieu, ul: p.ul, categorie: p.categorie, tags: p.tags, campagne: p.campagne, type_contenu: p.type_contenu, utilisation: p.utilisation, droits: p.droits,
    statut: p.statut, evenement_cal: p.evenement_cal, demande_id: p.demande_id, lot: p.lot, importe_le: p.importe_le, largeur: Number(p.largeur) || 0, hauteur: Number(p.hauteur) || 0,
    taille: Number(p.taille) || 0, a_moi: p.importe_par === u.email, editable: photoEditable_(u, p) };
  if (estVideo_(p)) { o.genre = 'video'; o.duree = Number(p.duree) || 0; o.mime = p.mime; }
  Object.keys(o).forEach(k => { if (o[k] === undefined || o[k] === '' || o[k] === null || o[k] === '[object Object]' || o[k] === 'undefined') delete o[k]; });   // champs vides ou illisibles non transmis
  if (fav && fav[p.id]) o.favori = true;
  if (mod) o.importe_par_nom = p.importe_par ? nomDe_(p.importe_par) : '';
  return o;
}
function photoDe_(u, id, perm) {
  onglets_photos_();
  const p = DB.ligne('phototheque', 'id', String(id || ''));   // fiche, aperçu, téléchargement : une ligne lue, pas toute la table
  if (!p || !photoVisible_(u, p) || (perm && !peut_(u, perm))) { journalSecu_(u.email, 'refus_photo', String(id || '').slice(0, 40)); throw Oups_('Cette photo n\'existe pas ou ne vous est pas accessible.'); }
  return p;
}
// Le fichier Drive est-il disponible ? (même diagnostic que les ressources : supprimé, introuvable, inaccessible, déplacé)
function fichierDisponible_(fichierId) {
  if (!fichierId) return { f: null, cause: 'absent' };
  let f = null, cause = '';
  try { f = DriveApp.getFileById(fichierId); } catch (e) { cause = /access|autoris|permission|denied/i.test(String(e && e.message || e)) ? 'inaccessible' : 'introuvable'; }
  if (f) { try { if (f.isTrashed()) cause = 'supprime'; else if (!fichierApp_(fichierId, true)) cause = 'deplace'; } catch (e) { cause = 'inaccessible'; } }
  return { f: cause ? null : f, cause: cause };
}
const MESSAGES_FICHIER = {
  absent: 'Aucun fichier n\'est associé à cet élément. Prévenez l\'équipe communication.',
  supprime: 'Ce fichier a été supprimé du Drive partagé (il est dans la corbeille). Prévenez l\'équipe communication.',
  introuvable: 'Ce fichier n\'existe plus dans le Drive partagé. Prévenez l\'équipe communication.',
  inaccessible: 'Le Drive partagé refuse pour le moment l\'accès à ce fichier. Prévenez l\'administrateur (Administration > Drive partagé).',
  deplace: 'Ce fichier a été déplacé hors des dossiers du Centre Com : il ne peut plus être affiché. Prévenez l\'équipe communication.',
};
function fichierPhoto_(u, p) {
  const x = fichierDisponible_(p.fichier_id);
  if (x.cause) {
    try { const c = CacheService.getScriptCache(), k = 'indispo_' + p.id + x.cause; if (!c.get(k)) { c.put(k, '1', 3600); journalSecu_(u.email, 'fichier_indisponible', p.id + ' · ' + (p.titre || p.nom_original) + ' · ' + x.cause); } } catch (e) { }
    throw Oups_(MESSAGES_FICHIER[x.cause]);
  }
  return x.f;
}
// Image réduite fabriquée par Google Drive (lien temporaire lu par le serveur, jamais transmis au navigateur)
function vignetteDrive_(fichierId, cote) {
  let oct = null, certain = false;
  try {
    const jeton = ScriptApp.getOAuthToken(), ent = { headers: { Authorization: 'Bearer ' + jeton }, muteHttpExceptions: true };
    // Lien de vignette gardé 50 min (une requête Drive de moins par aperçu, navigation plus rapide) ; relu s'il a expiré
    let cache = null; try { cache = CacheService.getScriptCache(); } catch (e) { }
    const cle = 'tl_' + fichierId, lire = r2 => { if (r2.getResponseCode() === 200) { oct = r2.getBlob().getBytes(); certain = true; } };
    const taille = l => l.replace(/=s\d+(-[a-z0-9-]+)?$/i, '') + '=s' + cote;
    const enCache = cache ? cache.get(cle) : null;
    if (enCache && /^https:\/\/[^\s]+$/.test(enCache)) { lire(UrlFetchApp.fetch(taille(enCache), ent)); if (!oct) try { cache.remove(cle); } catch (e) { } }
    if (!oct) {
      const rep = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fichierId) + '?fields=thumbnailLink&supportsAllDrives=true', ent);
      if (rep.getResponseCode() === 200) {
        const lienV = String(JSON.parse(rep.getContentText()).thumbnailLink || '');
        if (!lienV) certain = true;
        if (/^https:\/\/[^\s]+$/.test(lienV)) { lire(UrlFetchApp.fetch(taille(lienV), ent)); if (oct && cache) try { cache.put(cle, lienV, 3000); } catch (e) { } }
      }
    }
  } catch (e) { console.error('Vignette Drive (' + fichierId + ') : ' + e); }
  return { oct: oct && typeImage_(oct) ? oct : null, certain: certain };
}

// Données techniques lues dans le fichier lui-même (jamais inventées) : dimensions et EXIF des JPEG
function dimensionsImage_(o) {
  const b = i => o[i] & 255, t = typeImage_(o);
  try {
    if (t === 'image/png') return o.length > 24 ? { l: b(16) * 16777216 + (b(17) << 16) + (b(18) << 8) + b(19), h: b(20) * 16777216 + (b(21) << 16) + (b(22) << 8) + b(23) } : null;
    if (t === 'image/jpeg') {
      let i = 2;
      while (i + 9 < o.length) {
        if (b(i) !== 0xFF) return null;
        const m = b(i + 1), len = (b(i + 2) << 8) | b(i + 3);
        if (m >= 0xC0 && m <= 0xCF && [0xC4, 0xC8, 0xCC].indexOf(m) === -1) return { h: (b(i + 5) << 8) | b(i + 6), l: (b(i + 7) << 8) | b(i + 8) };
        if (len < 2) return null;
        i += 2 + len;
      }
      return null;
    }
    if (t === 'image/webp') {
      const fourcc = String.fromCharCode(b(12), b(13), b(14), b(15));
      if (fourcc === 'VP8X') return { l: 1 + b(24) + (b(25) << 8) + (b(26) << 16), h: 1 + b(27) + (b(28) << 8) + (b(29) << 16) };
      if (fourcc === 'VP8 ') return { l: ((b(27) << 8) | b(26)) & 0x3FFF, h: ((b(29) << 8) | b(28)) & 0x3FFF };
      if (fourcc === 'VP8L') { const x = b(21) | (b(22) << 8) | (b(23) << 16) | (b(24) << 24); return { l: (x & 0x3FFF) + 1, h: ((x >> 14) & 0x3FFF) + 1 }; }
    }
  } catch (e) { }
  return null;
}
const TAGS_IFD0 = { 0x010F: 'marque', 0x0110: 'modele', 0x0112: 'orientation', 0x013B: 'auteur', 0x8298: 'copyright', 0x8769: '_exif' };
const TAGS_EXIF = { 0x9003: 'date_prise' };
function lireExif_(o) {
  const b = i => o[i] & 255;
  if (typeImage_(o) !== 'image/jpeg') return {};
  let i = 2;
  try {
    while (i + 10 < o.length && b(i) === 0xFF) {
      const m = b(i + 1), len = (b(i + 2) << 8) | b(i + 3);
      if (m === 0xE1 && b(i + 4) === 0x45 && b(i + 5) === 0x78 && b(i + 6) === 0x69 && b(i + 7) === 0x66) return tiff_(o, i + 10);
      if (m === 0xDA || len < 2) break;
      i += 2 + len;
    }
  } catch (e) { }
  return {};
}
function tiff_(o, t) {
  const b = i => o[i] & 255, le = b(t) === 0x49, out = {};
  const u16 = p => le ? b(p) | (b(p + 1) << 8) : (b(p) << 8) | b(p + 1);
  const u32 = p => le ? b(p) + (b(p + 1) << 8) + (b(p + 2) << 16) + b(p + 3) * 16777216 : b(p) * 16777216 + (b(p + 1) << 16) + (b(p + 2) << 8) + b(p + 3);
  const asc = (p, n) => { let s = ''; for (let k = 0; k < n && p + k < o.length; k++) { const c = b(p + k); if (!c) break; if (c >= 32 && c < 127) s += String.fromCharCode(c); } return s.trim(); };
  const ifd = (p, tags, prof) => {
    if (prof > 2 || !p || t + p + 2 > o.length) return;
    const n = u16(t + p);
    for (let k = 0; k < n && k < 300; k++) {
      const e = t + p + 2 + k * 12; if (e + 12 > o.length) break;
      const tag = u16(e), type = u16(e + 2), cnt = u32(e + 4), nom = tags[tag];
      if (!nom) continue;
      const pos = cnt * ({ 1: 1, 2: 1, 3: 2, 4: 4, 7: 1 }[type] || 8) > 4 ? t + u32(e + 8) : e + 8;
      if (nom === '_exif') ifd(u32(e + 8), TAGS_EXIF, prof + 1);
      else if (type === 2) { const v = asc(pos, Math.min(cnt, 120)); if (v) out[nom] = v; }
      else if (type === 3) out[nom] = u16(pos);
      else if (type === 4) out[nom] = u32(pos);
    }
  };
  ifd(u32(t + 4), TAGS_IFD0, 0);
  const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(out.date_prise || '');
  if (m && m[1] > '1900') out.date_prise = m[1] + '-' + m[2] + '-' + m[3] + (out.date_prise.length >= 19 ? ' ' + out.date_prise.slice(11, 19) : ''); else delete out.date_prise;
  return out;
}
function empreinte_(oct) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, oct).map(x => ('0' + (x & 255).toString(16)).slice(-2)).join(''); }
function sousDossier_(parent, nom) {
  const k0 = parent.getId() + '/' + nom; if (DOSSIERS_EXEC[k0]) return DOSSIERS_EXEC[k0];
  const f1 = sousDossierBrut_(parent, nom); DOSSIERS_EXEC[k0] = f1; return f1;
}
function sousDossierBrut_(parent, nom) {
  const cache = CacheService.getScriptCache(), cle = 'sd_' + parent.getId() + '_' + nom;
  const id = cache.get(cle);
  if (id) { try { const f = DriveApp.getFolderById(id); if (!f.isTrashed()) return f; } catch (e) { } }
  const it = parent.getFoldersByName(nom), f = it.hasNext() ? it.next() : parent.createFolder(nom);
  try { cache.put(cle, f.getId(), 21600); } catch (e) { }
  return f;
}
// Métadonnées : nettoyées et contrôlées par le serveur (listes de la configuration, UL existantes, demande visible…)
function metaPhoto_(m, u, avant, partiel) {
  const c = config_().phototheque, o = {}, txt = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\r/g, '').trim().slice(0, max);
  const a = k => !partiel || Object.prototype.hasOwnProperty.call(m, k);
  Object.keys(PHOTO_TXT).forEach(k => { if (a(k)) o[k] = txt(m[k], PHOTO_TXT[k]); });
  if (a('tags')) o.tags = o.tags.split(/[,;]+/).map(x => x.trim()).filter(Boolean).filter((x, i, t) => t.findIndex(y => y.toLowerCase() === x.toLowerCase()) === i).slice(0, 20).join(', ');
  if (a('note_interne') && !peut_(u, 'phototheque_modifier')) delete o.note_interne;
  if (a('date_prise')) { const d = String(m.date_prise || ''); o.date_prise = /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : ''; }
  if (a('ul')) { const v = txt(m.ul, 80); o.ul = !v || DB.tout('ul').some(x => x.nom === v) ? v : ''; }
  [['categorie', 'categories'], ['type_contenu', 'types_contenu'], ['utilisation', 'utilisations']].forEach(x => { if (a(x[0])) { const v = txt(m[x[0]], 80); o[x[0]] = c[x[1]].indexOf(v) > -1 ? v : ''; } });
  if (a('droits')) { const v = txt(m.droits, 60); o.droits = (config_().pole_image.autorisations || []).some(x => x.nom === v) ? v : ''; }
  if (a('evenement_cal')) { const v = String(m.evenement_cal || ''); o.evenement_cal = /^[a-z_]{2,20}:[-\w]{1,60}$/i.test(v) ? v : ''; }
  if (a('demande_id')) { const v = String(m.demande_id || ''); const d = v ? DB.trouver('demandes', 'id', v) : null; o.demande_id = d && peutVoir_(u, d) ? v : ''; }
  return o;
}
function lignePublique_(p) { const o = Object.assign({}, p); delete o._ligne; return o; }

// ---------- Vignettes : lues par blocs dans l'onglet, gardées en cache (6 h) ----------
function vignettesDe_(ids) {
  const cache = CacheService.getScriptCache(), out = {};
  let deja = {}; try { deja = cache.getAll(ids.map(id => 'vig_' + id)) || {}; } catch (e) { }
  const manque = ids.filter(id => { const v = deja['vig_' + id]; if (v) out[id] = v; return !v; });
  if (!manque.length) return out;
  const sh = DB.feuille('photo_vignettes'), n = sh.getLastRow() - 1;
  if (n < 1) return out;
  const col = sh.getRange(2, 1, n, 1).getDisplayValues(), rang = {};
  col.forEach((r, i) => { rang[r[0]] = i + 2; });
  const lignes = manque.map(id => rang[id]).filter(Boolean).sort((x, y) => x - y);
  if (!lignes.length) return out;
  const lire = (de, a) => sh.getRange(de, 1, a - de + 1, 2).getDisplayValues().forEach(r => { if (manque.indexOf(r[0]) > -1 && r[1]) out[r[0]] = r[1]; });
  if (lignes[lignes.length - 1] - lignes[0] <= 400) lire(lignes[0], lignes[lignes.length - 1]);
  else lignes.forEach(l => lire(l, l));
  const aGarder = {}; manque.forEach(id => { if (out[id] && out[id].length < 95000) aGarder['vig_' + id] = out[id]; });
  try { cache.putAll(aGarder, 21600); } catch (e) { }
  return out;
}
function supprimerLignesPar_(table, cle, valeurs) {
  const sh = DB.feuille(table), n = sh.getLastRow() - 1, j = TABLES[table].cols.indexOf(cle);
  if (n < 1 || !valeurs.length) return 0;
  const col = sh.getRange(2, j + 1, n, 1).getDisplayValues();
  let k = 0;
  for (let i = col.length - 1; i >= 0; i--) if (valeurs.indexOf(col[i][0]) > -1) { sh.deleteRow(i + 2); k++; }
  delete DB._cache[table]; if (k) DB.change_(table);
  return k;
}

// ---------- Lecture ----------
function droitsPhoto_(u) {
  return { importer: peut_(u, 'phototheque_importer'), modifier: peut_(u, 'phototheque_modifier'), telecharger: peut_(u, 'phototheque_telecharger'), archiver: peut_(u, 'phototheque_archiver'),
    supprimer: peut_(u, 'phototheque_supprimer'), ressources: peut_(u, 'ressources_gerer'), import_disponible: fonctionOk_('phototheque'),
    lire_videos: peut_(u, 'phototheque_telecharger') || config_().phototheque.lecture_video === 'voir' };
}
function albumPublic_(a, u, visibles, avecIds) {
  const ids = String(a.photos || '').split(',').filter(Boolean).filter(id => visibles[id]);
  const o = { id: a.id, titre: a.titre, description: a.description, type: a.type, ul: a.ul, evenement_cal: a.evenement_cal, demande_id: a.demande_id,
    couverture: visibles[a.couverture] ? a.couverture : (ids[0] || ''), couverture_auto: !visibles[a.couverture], nb: ids.length, cree_le: a.cree_le, maj_le: a.maj_le, etat: a.etat || 'actif', cree_par_nom: a.cree_par ? nomDe_(a.cree_par) : '' };
  if (avecIds) o.photos = ids;
  return o;
}
function albumsVisibles_(u, visibles) {
  const mod = peut_(u, 'phototheque_modifier');
  return albumsLignes_().map(a => albumPublic_(a, u, visibles, false)).filter(a => (a.etat !== 'archive' || mod) && (a.nb || mod));
}
// Liste paginée côté serveur : seules les photos de la page demandée sont envoyées (avec le total, les valeurs des filtres
// et les compteurs des onglets). R : { vue, album, lot, evcal, q, cat, ul, photographe, evenement, campagne, type, annee, tri, debut, nombre, contexte, vig, connues }
const NORM_ = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function api_photos(sid, R) {
  return appel_(sid, 'phototheque_voir', u => {
    R = R && typeof R === 'object' ? R : {};
    const I = indexPhotos_().filter(p => photoVisible_(u, p)), vis = {}; I.forEach(p => vis[p.id] = p);
    const fav = favorisDe_(u), mod = peut_(u, 'phototheque_modifier');
    const courant = p => ['publiee', 'restreinte', 'a_valider'].indexOf(p.statut) > -1;
    const compteurs = { videos: I.filter(p => courant(p) && estVideo_(p)).length, photos: I.filter(courant).length, valider: I.filter(p => p.statut === 'a_valider').length, archives: I.filter(p => p.statut === 'archivee').length, corbeille: I.filter(p => p.statut === 'corbeille').length, favoris: I.filter(p => fav[p.id] && p.statut !== 'corbeille').length };
    let base, album = null;
    if (R.album) {
      const a = albumsLignes_().find(x => x.id === String(R.album));
      if (!a || (a.etat === 'archive' && !mod)) throw Oups_('Cet album n\'existe plus ou ne vous est pas accessible.');
      album = albumPublic_(a, u, vis, false);
      if (!album.nb && !mod) throw Oups_('Cet album n\'existe plus ou ne vous est pas accessible.');   // même règle que la liste des albums
      base = String(a.photos || '').split(',').map(id => vis[id]).filter(p => p && p.statut !== 'corbeille');
    } else base = I.filter({ favoris: p => fav[p.id] && p.statut !== 'corbeille', valider: p => p.statut === 'a_valider', archives: p => p.statut === 'archivee', corbeille: p => p.statut === 'corbeille' }[R.vue] || courant);
    if (R.lot) base = base.filter(p => p.lot === String(R.lot));
    if (R.genre === 'video') base = base.filter(estVideo_); else if (R.genre === 'photo') base = base.filter(p => !estVideo_(p));
    if (R.evcal) base = base.filter(p => p.evenement_cal === String(R.evcal));
    const dist = k => Array.from(new Set(base.map(p => k === 'annee' ? String(p.date_prise || '').slice(0, 4) : p[k]).filter(Boolean))).sort((a, b) => k === 'annee' ? b.localeCompare(a) : a.localeCompare(b, 'fr')).slice(0, 300);
    const facettes = { categorie: dist('categorie'), ul: dist('ul'), photographe: dist('photographe'), evenement: dist('evenement'), campagne: dist('campagne'), type_contenu: dist('type_contenu'), annee: dist('annee') };
    const mots = NORM_(R.q).split(/[\s,;'’]+/).filter(x => x.length > 1);
    const f = { cat: 'categorie', ul: 'ul', photographe: 'photographe', evenement: 'evenement', campagne: 'campagne', type: 'type_contenu' };
    let L = base.filter(p => Object.keys(f).every(k => !R[k] || p[f[k]] === R[k]) && (!R.annee || String(p.date_prise || '').slice(0, 4) === R.annee) &&
      (!mots.length || (t => mots.every(m => t.indexOf(m) > -1))(NORM_([p.titre, p.nom_original, p.description, p.tags, p.photographe, p.credit, p.evenement, p.lieu, p.ul, p.campagne, p.categorie, p.type_contenu].join(' ')))));
    const titre = p => p.titre || p.nom_original || '';
    const tri = { recentes: (a, b) => String(b.importe_le).localeCompare(String(a.importe_le)), prise_desc: (a, b) => String(b.date_prise || '').localeCompare(String(a.date_prise || '')), prise_asc: (a, b) => String(a.date_prise || '9999').localeCompare(String(b.date_prise || '9999')), titre: (a, b) => titre(a).localeCompare(titre(b), 'fr') }[R.tri];
    if (tri && !(album && R.tri === 'recentes')) L = L.slice().sort(tri);
    const debut = Math.max(0, Number(R.debut) || 0), nombre = Math.min(96, Math.max(1, Number(R.nombre) || 48));
    const page = L.slice(debut, debut + nombre);
    const out = { photos: page.map(p => photoLegere_(p, u, fav)), total: L.length, base: base.length, debut: debut, facettes: facettes, compteurs: compteurs, album: album };
    // Vignettes de la page jointes à la réponse (un aller-retour de moins), sauf celles que le navigateur a déjà
    if (R.vig === true) { const connues = {}; (Array.isArray(R.connues) ? R.connues.slice(0, 3000) : []).forEach(id => connues[String(id)] = true); out.vignettes = vignettesDe_(page.map(p => p.id).filter(id => !connues[id])); }
    if (R.contexte) {
      const listes = k => Array.from(new Set(I.map(p => k === 'tags' ? String(p.tags || '').split(',').map(x => x.trim()) : [p[k]]).reduce((a, b) => a.concat(b), []).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'fr')).slice(0, 300);
      out.albums = albumsVisibles_(u, vis); out.droits = droitsPhoto_(u);
      out.listes = { photographe: listes('photographe'), evenement: listes('evenement'), campagne: listes('campagne'), tags: listes('tags') };
    }
    return out;
  });
}
function resumePhototheque_(u) {
    const L = indexPhotos_().filter(p => photoVisible_(u, p)), vis = {}; L.forEach(p => vis[p.id] = true);
    const pub = L.filter(p => p.statut === 'publiee').sort((a, b) => String(b.importe_le).localeCompare(String(a.importe_le)));
    const albums = albumsVisibles_(u, vis).filter(a => a.etat !== 'archive' && a.nb).sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le))).slice(0, 3);
    return { recentes: pub.slice(0, 8).map(p => photoLegere_(p, u)), albums: albums, total: pub.length, a_valider: peut_(u, 'phototheque_modifier') ? L.filter(p => p.statut === 'a_valider').length : 0 };
}
function api_resumePhototheque(sid) { return appel_(sid, 'phototheque_voir', resumePhototheque_); }
function api_vignettesPhotos(sid, ids) {
  return appel_(sid, 'phototheque_voir', u => {
    ids = (Array.isArray(ids) ? ids : []).map(String).slice(0, 80);
    const vis = {}; indexPhotos_().forEach(p => { if (ids.indexOf(p.id) > -1 && photoVisible_(u, p)) vis[p.id] = true; });
    return vignettesDe_(ids.filter(id => vis[id]));
  });
}
function api_fichePhoto(sid, id) {
  return appel_(sid, 'phototheque_voir', u => {
    const p = photoDe_(u, id), mod = peut_(u, 'phototheque_modifier');
    const o = photoLegere_(p, u);
    o.description = p.description; o.droits_note = p.droits_note; o.mime = p.mime; o.importe_par_nom = p.importe_par ? nomDe_(p.importe_par) : '';
    o.maj_le = p.maj_le; o.exif = (() => { try { return JSON.parse(p.exif || '{}'); } catch (e) { return {}; } })();
    if (mod) o.note_interne = p.note_interne;
    o.albums = albumsLignes_().filter(a => String(a.photos || '').split(',').indexOf(p.id) > -1 && (a.etat !== 'archive' || mod)).map(a => ({ id: a.id, titre: a.titre }));
    const d = p.demande_id ? DB.trouver('demandes', 'id', p.demande_id) : null;
    o.demande = d && peutVoir_(u, d) ? { id: d.id, titre: d.titre } : null;
    o.ressources = lignesRessources_().filter(r => r.type === 'fichier' && r.fichier_id === p.fichier_id && ressourceAccessible_(u, r)).map(r => ({ id: r.id, titre: r.titre }));
    o.favori = DB.tout('photo_favoris').some(f => f.email === u.email && f.photo_id === p.id);
    o.permissions = droitsPhoto_(u);   // actions permises (objet) : distinct de « droits » = droit à l'image (texte)
    return o;
  });
}
// Image d'affichage (aperçu plein écran) : réduite par Google Drive ; jamais l'original sans permission de téléchargement
// cote : taille demandée par l'écran (paliers 1200 / 1600 / 2000 / 2400 px, pour profiter du cache Drive)
function api_apercuPhoto(sid, id, cote) {
  return appel_(sid, 'phototheque_voir', u => {
    const p = photoDe_(u, id), f = fichierPhoto_(u, p);
    const n = Number(cote) || 1600; let palier = n <= 1200 ? 1200 : n <= 1600 ? 1600 : n <= 2000 ? 2000 : 2400;
    // Rôles sans téléchargement : image d'affichage à la pleine résolution de la photo (fabriquée par Drive, pas le fichier), sauf réglage « hd »
    const grand = Math.max(Number(p.largeur) || 0, Number(p.hauteur) || 0);
    if (!peut_(u, 'phototheque_telecharger') && config_().phototheque.apercu_qualite === 'pleine' && grand > palier) palier = Math.min(grand, 8000);
    const v = vignetteDrive_(p.fichier_id, palier);
    if (v.oct) return { image: 'data:' + typeImage_(v.oct) + ';base64,' + Utilities.base64Encode(v.oct), source: 'drive' };
    if (f.getSize() <= 2.5 * 1048576) { const oct = octetsDe_(f); if (typeImage_(oct)) return { image: 'data:' + typeImage_(oct) + ';base64,' + Utilities.base64Encode(oct), source: 'original' }; }
    return { image: '', source: '' };
  });
}
// Original d'une photo pour la grande prévisualisation (3.19) : le FICHIER LUI-MÊME (aucune réduction, aucune recompression),
// lu dans le Drive partagé par morceaux de 8 Mo (requêtes « Range » de l'API Drive) pour rester rapide et sous les limites d'Apps Script.
// Mêmes droits que le téléchargement (photo visible + permission « télécharger les originaux ») ; sinon le navigateur utilise l'aperçu HD.
const MORCEAU_ORIGINAL = 8 * 1048576;
function api_originalPhoto(sid, id, debut) {
  return appel_(sid, 'phototheque_voir', u => {
    // Vidéo : la lire transmet le fichier au navigateur ; permise aux rôles qui téléchargent, ou à tous ceux qui voient si l'administrateur l'a choisi
    const p0 = photoDe_(u, id), lire = estVideo_(p0) && config_().phototheque.lecture_video === 'voir';
    const p = lire ? p0 : photoDe_(u, id, 'phototheque_telecharger');
    debut = Math.max(0, Math.floor(Number(debut) || 0));
    let total = 0, mime = p.mime || '';
    if (!debut) {
      const f = fichierPhoto_(u, p); total = f.getSize(); mime = mime || f.getMimeType();
      if (total <= MORCEAU_ORIGINAL) return { total: total, debut: 0, mime: mime, data: Utilities.base64Encode(octetsDe_(f)) };
    }
    const fin = debut + MORCEAU_ORIGINAL - 1;
    let rep = null;
    try { rep = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(p.fichier_id) + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + debut + '-' + fin }, muteHttpExceptions: true }); } catch (e) { console.error('Original (' + id + ') : ' + e); }
    const code = rep ? rep.getResponseCode() : 0;
    if (code !== 206 && code !== 200) throw Oups_('Le Drive partagé n\'a pas transmis l\'original pour le moment. Réessayez dans un instant.');
    let oct = rep.getBlob().getBytes();
    if (code === 200) oct = oct.slice(debut, fin + 1);   // serveur sans prise en charge des morceaux : découpe ici
    const cr = String((rep.getHeaders() || {})['Content-Range'] || (rep.getHeaders() || {})['content-range'] || '').match(/\/(\d+)$/);
    if (!total) total = cr ? Number(cr[1]) : Number(p.taille) || 0;
    return { total: total, debut: debut, mime: mime, data: Utilities.base64Encode(oct) };
  });
}
function api_telechargerPhoto(sid, id) {
  return appel_(sid, 'phototheque_telecharger', u => {
    const p = photoDe_(u, id, 'phototheque_telecharger'), f = fichierPhoto_(u, p);
    return { nom: p.nom_original || f.getName(), mime: p.mime || f.getMimeType(), taille: f.getSize(), data: Utilities.base64Encode(octetsDe_(f)) };
  });
}
// Plusieurs photos ou un album en un fichier ZIP (taille limitée : Administration > Photothèque)
function api_exporterPhotos(sid, ids, albumId) {
  return appel_(sid, 'phototheque_telecharger', u => {
    const L = photosLignes_(), c = config_().phototheque, max = c.export_max_mo * 1048576;
    let nomZip = 'photos_' + Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd');
    if (albumId) {
      const a = albumsLignes_().find(x => x.id === albumId);
      if (!a) throw Oups_('Cet album n\'existe plus.');
      ids = String(a.photos || '').split(',').filter(Boolean);
      nomZip = 'album_' + nomFichier_(a.titre).replace(/\s+/g, '_').slice(0, 60);
    }
    ids = (Array.isArray(ids) ? ids : []).map(String);
    const choix = ids.map(id => L.find(p => p.id === id)).filter(p => p && photoVisible_(u, p) && p.statut !== 'corbeille');
    if (!choix.length) throw Oups_('Aucune photo à télécharger.');
    if (choix.length > LIMITE_LOT_PHOTOS) throw Oups_('Trop de photos à la fois (' + LIMITE_LOT_PHOTOS + ' au plus).');
    const total = choix.reduce((s, p) => s + (Number(p.taille) || 0), 0);
    if (total > max) throw Oups_('Sélection trop lourde : ' + Math.ceil(total / 1048576) + ' Mo pour ' + c.export_max_mo + ' Mo au plus. Téléchargez en plusieurs fois.');
    const noms = {}, blobs = [];
    choix.forEach(p => {
      const f = fichierPhoto_(u, p);
      let n = nomFichier_(p.nom_original || f.getName()); const base = n.replace(/(\.[^.]+)$/, ''), ext = (n.match(/\.[^.]+$/) || [''])[0];
      let k = 1; while (noms[n.toLowerCase()]) n = base + '_' + (++k) + ext; noms[n.toLowerCase()] = true;
      blobs.push(Utilities.newBlob(octetsDe_(f), p.mime || f.getMimeType(), n));
    });
    const zip = Utilities.zip(blobs, nomZip + '.zip');
    journalSecu_(u.email, 'photos_export', choix.length + ' photo(s)' + (albumId ? ' · album ' + albumId : ''));
    return { nom: nomZip + '.zip', taille: zip.getBytes().length, nombre: choix.length, data: Utilities.base64Encode(zip.getBytes()) };
  });
}

// ---------- Import ----------
// Avant l'envoi : doublons exacts (empreinte SHA-256 du fichier) et noms déjà présents
function api_verifierPhotos(sid, items) {
  return appel_(sid, 'phototheque_importer', u => {
    const L = photosLignes_(), parEmp = {}, noms = {};   // index : une seule lecture de la liste, quel que soit le nombre de photos vérifiées
    L.forEach(p => { if (p.empreinte && !parEmp[p.empreinte]) parEmp[p.empreinte] = p; noms[String(p.nom_original).toLowerCase()] = true; });
    return (Array.isArray(items) ? items : []).slice(0, LIMITE_LOT_PHOTOS).map(x => {
      const d = parEmp[String(x.empreinte || '').toLowerCase()];
      const n = String(x.nom || '').toLowerCase(), meme = !!n && !!noms[n];
      return { doublon: !!d, doublon_titre: d && photoVisible_(u, d) ? (d.titre || d.nom_original) : '', doublon_corbeille: !!d && d.statut === 'corbeille', meme_nom: meme };
    });
  });
}
// ---------- Import (3.13) : envoi par morceaux + enregistrement groupé ----------
// 1. api_photoEnvoi : le fichier arrive par morceaux de 8 Mio (une photo ordinaire = un seul appel). Le serveur contrôle le
//    type réel, les dimensions et l'EXIF dès le premier morceau, calcule lui-même l'empreinte SHA-256 au fil des morceaux et
//    écrit dans le Drive partagé (DriveApp pour un seul morceau ; envoi « reprenable » de l'API Drive au-delà). Aucune fiche
//    n'est créée à ce stade et rien n'est gardé en mémoire d'un appel à l'autre, hormis l'état de l'envoi (cache, 6 h).
// 2. api_enregistrerPhotos : jusqu'à 20 photos envoyées sont enregistrées ensemble, sous verrou (doublons vérifiés sur la
//    colonne des empreintes, lue dans la base), en une écriture par onglet.
// Un fichier envoyé mais jamais enregistré (onglet fermé entre les deux étapes) est retiré par la routine quotidienne.
const MORCEAU_PHOTO = 8 * 1048576;            // multiple de 256 Kio (exigé par l'envoi reprenable de Drive)
const IMPORT_MAX_PHOTOS = 300;                // photos par import (file d'attente côté navigateur)
const CLE_ENVOI = id => 'phenv_' + id;

// SHA-256 incrémental (état gardé entre les morceaux) : même résultat que Utilities.computeDigest sur le fichier entier
const SHA_K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
function shaDebut_() { return { h: [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], r: [], n: 0 }; }
function shaBloc_(h, o, i, w) {
  for (let t = 0; t < 16; t++) w[t] = ((o[i + 4 * t] & 255) << 24) | ((o[i + 4 * t + 1] & 255) << 16) | ((o[i + 4 * t + 2] & 255) << 8) | (o[i + 4 * t + 3] & 255);
  for (let t = 16; t < 64; t++) { const a = w[t - 15], b = w[t - 2]; w[t] = (w[t - 16] + (((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3)) + w[t - 7] + (((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10))) | 0; }
  let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
  for (let t = 0; t < 64; t++) {
    const t1 = (k + (((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7))) + ((e & f) ^ (~e & g)) + SHA_K[t] + w[t]) | 0;
    const t2 = ((((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10))) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + k) | 0;
}
function shaAjout_(s, oct) {
  const w = new Array(64); let o = s.r.concat(Array.prototype.slice.call(oct, 0, Math.max(0, 64 - s.r.length))), i = 0;
  s.n += oct.length;
  if (o.length < 64) { s.r = o; return s; }
  shaBloc_(s.h, o, 0, w); i = 64 - s.r.length;
  for (; i + 64 <= oct.length; i += 64) shaBloc_(s.h, oct, i, w);
  s.r = Array.prototype.slice.call(oct, i).map(x => x & 255);
  return s;
}
function shaFin_(s) {
  const r = s.r.slice(), bits = s.n * 8; r.push(0x80);
  while (r.length % 64 !== 56) r.push(0);
  const hi = Math.floor(bits / 4294967296), lo = bits >>> 0;
  r.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
  const h = s.h.slice(), w = new Array(64);
  for (let i = 0; i < r.length; i += 64) shaBloc_(h, r, i, w);
  return h.map(x => ('0000000' + (x >>> 0).toString(16)).slice(-8)).join('');
}

// Photo déjà importée par cette personne dans ce lot (reprise après coupure, rechargement de la page ou nouvelle sélection)
function dejaImportee_(u, emp, lot) {
  lot = String(lot || ''); if (!lot) return null;
  const emps = DB.colonne('phototheque', 'empreinte'), i = emps.indexOf(emp);
  if (i < 0) return null;
  const p = DB.ligne('phototheque', 'empreinte', emp);
  return p && p.importe_par === u.email && p.lot === lot ? p : null;
}
function lireEnvoi_(id, u) {
  let s = null; try { s = JSON.parse(CacheService.getScriptCache().get(CLE_ENVOI(String(id || ''))) || 'null'); } catch (e) { }
  if (!s || s.email !== u.email) throw Oups_('Cet envoi n\'existe plus (interrompu depuis trop longtemps) : relancez l\'import de cette photo.');
  return s;
}
function ecrireEnvoi_(id, s, suite) {
  const c = CacheService.getScriptCache();
  if (suite) { try { const a = JSON.parse(c.get(CLE_ENVOI(id)) || 'null'); if (a && (a.fini || a.recu > s.recu)) return; } catch (e) { } }   // essai en retard : l'état plus avancé est gardé
  c.put(CLE_ENVOI(id), JSON.stringify(s), 21600);
}
// Colonne des empreintes lue dans la base (sous verrou) : doublons exacts, quelle que soit la copie en cache
function empreintesPhotos_() { const o = {}; DB.colonne('phototheque', 'empreinte').forEach(e => { if (e) o[e] = true; }); return o; }

// Envoi d'une photo, morceau par morceau. x (premier morceau) : { nom, taille, empreinte, date_prise, forcer }
// Contrôles et préparation d'un envoi (3.24), communs à tous les transports : format et contenu (signature, dimensions, EXIF,
// conteneur vidéo), poids maximal, doublon connu (empreinte), dossier de l'année. entete = seuls les premiers octets du fichier
// ont été reçus (envoi direct ou entier : le fichier lui-même passe ailleurs).
function preparerEnvoi_(u, x, oct, entete) {
  const c = config_().phototheque;
  x = x || {};
  const nom = nomFichier_(x.nom), ext = extension_(nom), taille = Math.floor(Number(x.taille) || 0);
  const video = !!VIDEO_EXT[ext];
  if (!PHOTO_EXT[ext] && !video) throw Oups_('Format non accepté : photos JPG, PNG, WEBP ou vidéos MP4, MOV, WEBM.');
  if (!oct.length || taille < 1) throw Oups_('Fichier vide.');
  if (!video && taille > c.taille_max_mo * 1048576) throw Oups_('Photo trop lourde (' + c.taille_max_mo + ' Mo au plus).');
  if (video && taille > c.video_max_mo * 1048576) throw Oups_('Vidéo trop lourde (' + c.video_max_mo + ' Mo au plus).');
  if (entete ? oct.length < Math.min(taille, 4096) : !(oct.length === Math.min(taille, MORCEAU_PHOTO) || (taille > MORCEAU_PHOTO && morceauValide_(oct.length, taille)))) throw Oups_('Envoi incomplet : relancez l\'import de ce fichier.');
  let type, dim, exif = {}, duree = 0;
  if (video) {
    // Conteneur vérifié sur le contenu ; dimensions et durée lues par le navigateur (simples informations, bornées)
    const tv = typeVideo_(oct);
    if (!tv || (ext === 'webm') !== (tv === 'video/webm')) throw Oups_('Le contenu du fichier ne correspond pas à une vidéo ' + ext.toUpperCase() + ' : fichier renommé ou corrompu.');
    type = VIDEO_EXT[ext];
    const n = (v, max) => { v = Math.round(Number(v) || 0); return v > 0 && v <= max ? v : 0; };
    dim = { l: n(x.largeur, 16384), h: n(x.hauteur, 16384) }; duree = Math.min(86400, Math.max(0, Math.round((Number(x.duree) || 0) * 10) / 10));
  } else {
    type = typeImage_(oct);
    if (!type || type !== PHOTO_EXT[ext]) throw Oups_('Le contenu du fichier ne correspond pas à une image ' + ext.toUpperCase() + ' : fichier renommé ou corrompu.');
    dim = dimensionsImage_(oct);
    // Envoi direct ou entier : seuls les premiers octets sont là ; si les dimensions sont plus loin (métadonnées très longues),
    // celles lues par le navigateur (image décodée) sont reprises, bornées
    if ((!dim || !dim.l) && entete) { const n = v => { v = Math.round(Number(v) || 0); return v > 0 && v <= 65535 ? v : 0; }; dim = { l: n(x.largeur), h: n(x.hauteur) }; }
    if (!dim || !dim.l || !dim.h) throw Oups_('Image illisible : le fichier semble endommagé.');
    exif = lireExif_(oct);
  }
  const empC = String(x.empreinte || '').toLowerCase();
  // Doublon exact connu avant d'envoyer le reste (empreinte du navigateur, recalculée par le serveur à la fin).
  // Photo d'un seul morceau : contrôlée à l'enregistrement (aucune lecture de la base ici). Reprise d'un import : la photo
  // déjà importée par la même personne dans le même lot est renvoyée comme « déjà importée » (jamais un doublon, jamais une erreur).
  if (/^[0-9a-f]{64}$/.test(empC) && (taille > MORCEAU_PHOTO || x.reprise === true)) {
    const ex = dejaImportee_(u, empC, x.lot);
    if (ex) return { retour: { envoi: null, recu: taille, fini: true, deja: photoLegere_(ex, u) } };
    if (taille > MORCEAU_PHOTO && empreintesPhotos_()[empC] && !(x.forcer === true && peut_(u, 'phototheque_modifier'))) throw Oups_('Cette photo est déjà dans la photothèque.');
  }
  const dp = /^\d{4}-\d{2}-\d{2}$/.test(String(x.date_prise || '')) ? x.date_prise : '';
  const annee = (dp || exif.date_prise || maintenant_()).slice(0, 4);   // vidéos : date indiquée, sinon année de l'import
  const pid = 'P-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12), id = 'E' + Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  let dossier;
  try { dossier = ecritureDrive_('phototheque', () => sousDossier_(dossier_('phototheque'), annee)); }
  catch (e) { if (e && e.transitoire) return { retour: { envoi: null, recu: 0, fini: false, reessayer: true, message: e.message } }; throw e; }
  const s = { email: u.email, nom: nom, mime: type, taille: taille, recu: 0, pid: pid, dim: dim, exif: exif, emp_client: empC, fini: false, fid: '', emp: '', genre: video ? 'video' : '', duree: duree, dossier_id: dossier.getId() };
  return { id: id, s: s, dossier: dossier, oct: oct };
}
function envoiPhoto_(u, x, data, envoiId, debut, differe) {
  const c = config_().phototheque;
  exigerFonction_('phototheque');
  const oct = typeof data === 'string' ? decoder64_(data) : (data || []);   // octets déjà reçus tels quels (envoi binaire, 3.23)
  if (!envoiId) {
    const p = preparerEnvoi_(u, x, oct, false);
    if (p.retour) return p.retour;
    const id = p.id, s = p.s, dossier = p.dossier, taille = s.taille, type = s.mime, nom = s.nom, pid = s.pid;
    if (taille <= MORCEAU_PHOTO && differe) {
      // Création regroupée (3.23) : tous les fichiers de l'appel sont créés ensemble dans le Drive partagé (voir creerFichiers_)
      const e = { id: id, s: s, oct: oct, dossier: dossier }; differe.push(e); return { _differe: e };
    }
    if (taille <= MORCEAU_PHOTO) {
      let f;
      try { f = ecritureDrive_('phototheque', () => dossier.createFile(Utilities.newBlob(oct, type, nom))); }
      catch (e) { if (e && e.transitoire) return { envoi: null, recu: 0, fini: false, reessayer: true, message: e.message }; throw e; }
      // Marque de l'application indispensable (nettoyage des envois abandonnés) : sans elle, le fichier est retiré et l'envoi recommencé
      try { f.setDescription(MARQUE_APP + 'photo-phototheque:' + pid); }
      catch (e) { try { f.setTrashed(true); } catch (x2) { } return { envoi: null, recu: 0, fini: false, reessayer: true, message: 'Le Drive n\'a pas pu marquer le fichier : nouvel essai.' }; }
      Object.assign(s, { recu: taille, fini: true, fid: f.getId(), emp: empreinte_(oct) });
    } else {
      let uri;
      try { uri = ouvrirSession_(u, s); } catch (e) { if (e && e.transitoire) return { envoi: null, recu: 0, fini: false, reessayer: true, message: e.message }; throw e; }
      s.uri = uri; s.sha = shaDebut_();
      try { envoyerMorceau_(s, oct); }
      catch (e) { if (e && e.transitoire) return { envoi: null, recu: 0, fini: false, reessayer: true, message: e.message }; throw e; }
    }
    ecrireEnvoi_(id, s);
    return { envoi: id, recu: s.recu, fini: s.fini };
  }
  const s = lireEnvoi_(envoiId, u);
  if (s.fini) return { envoi: envoiId, recu: s.recu, fini: true };
  if (Number(debut) !== s.recu) return { envoi: envoiId, recu: s.recu, fini: false, reprise: true };   // reprise : le navigateur repart de là
  if (!oct.length || !(oct.length === Math.min(MORCEAU_PHOTO, s.taille - s.recu) || morceauValide_(oct.length, s.taille - s.recu))) throw Oups_('Morceau incomplet : réessayez.');
  try { envoyerMorceau_(s, oct); }
  catch (e) {
    if (!e || !e.transitoire) throw e;
    // Coupure passagère : on demande au Drive où il en est (l'état enregistré ici n'a pas bougé)
    const s0 = lireEnvoi_(envoiId, u), d = etatEnvoiDrive_(s0);
    if (d.fini) {   // le Drive avait en fait tout reçu : l'envoi est terminé (mêmes contrôles de taille et d'empreinte)
      shaAjout_(s0.sha, oct); terminerEnvoi_(s0, d.j); ecrireEnvoi_(envoiId, s0);
      return { envoi: envoiId, recu: s0.recu, fini: true };
    }
    if (d.recu !== s0.recu) throw Oups_('L\'envoi de cette photo a été interrompu par le Drive : relancez l\'import de cette photo.');
    return { envoi: envoiId, recu: d.recu, fini: false, reessayer: true, message: e.message };
  }
  ecrireEnvoi_(envoiId, s, true);
  return { envoi: envoiId, recu: s.recu, fini: s.fini, reprise: s.partiel || undefined };
}
// Session d'envoi « reprenable » du Drive (API v3) pour un gros fichier, ouverte avec le jeton du compte de l'application. Toute
// anomalie est NOMMÉE (3.24) : coupure → nouvel essai ; refus du Drive → code HTTP et raison renvoyés par Google, visibles sur la
// ligne du fichier et dans le Journal (plus jamais un « problème technique » anonyme).
function ouvrirSession_(u, s) {
  let r;
  try {
    r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true', {
      method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true, followRedirects: false,
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': s.mime, 'X-Upload-Content-Length': String(s.taille) },
      payload: JSON.stringify({ name: s.nom, parents: [s.dossier_id], mimeType: s.mime, description: MARQUE_APP + 'photo-phototheque:' + s.pid }) });
  } catch (e) {
    const m = String(e && e.message || e);
    try { journalSecu_(u.email, 'import_echec', 'Ouverture de la session d\'envoi du Drive : ' + m.slice(0, 220)); } catch (x) { }
    if (ERREUR_PASSAGERE.test(m) || /address unavailable|timeout|timed out|dns|connexion|connection/i.test(m)) throw transitoire_('Connexion au Drive interrompue : nouvel essai.');
    throw Oups_('Le serveur Google refuse l\'ouverture de l\'envoi vers le Drive (' + m.slice(0, 160) + ').');
  }
  const code = r.getResponseCode(), hd = (r.getAllHeaders ? r.getAllHeaders() : r.getHeaders ? r.getHeaders() : {}) || {};
  const uri = hd.Location || hd.location || hd.LOCATION;
  if (code === 200 && uri) return String(uri);
  if (HTTP_TRANSITOIRE(code)) throw transitoire_('Le Drive est momentanément indisponible (HTTP ' + code + ') : nouvel essai.');
  let raison = ''; try { const j = JSON.parse(r.getContentText()); raison = (j.error && (j.error.message || j.error.errors && j.error.errors[0] && j.error.errors[0].reason)) || ''; } catch (x) { raison = String(r.getContentText() || '').slice(0, 120); }
  try { journalSecu_(u.email, 'import_echec', 'Session d\'envoi du Drive refusée : HTTP ' + code + (raison ? ' · ' + raison : '')); } catch (x) { }
  throw Oups_('Le Drive partagé refuse l\'envoi (HTTP ' + code + (raison ? ' : ' + raison : '') + '). Vérifiez l\'accès au dossier « Photothèque » (Administration > Drive partagé).');
}
// Connexion lente (3.22) : le navigateur peut envoyer des morceaux plus petits (1 à 8 Mio, multiples de 256 Kio comme l'exige
// l'envoi « resumable » du Drive), ou le reste du fichier ; jamais plus de 8 Mio par appel
function morceauValide_(n, reste) { return n === reste ? n <= MORCEAU_PHOTO : n >= 1048576 && n < MORCEAU_PHOTO && n < reste && n % 262144 === 0; }
// Création des fichiers d'un appel EN PARALLÈLE (3.23) : une requête Drive « multipart » par fichier (contenu + nom + dossier +
// marque de l'application en une seule fois, au lieu de createFile puis setDescription), toutes lancées ensemble (fetchAll).
// Chaque fichier est contrôlé (taille et MD5 renvoyés par le Drive = octets reçus) ; en cas de refus ou de doute, la méthode
// classique (DriveApp) prend le relais pour ce fichier seulement. Résultat par fichier : { envoi, recu, fini } ou nouvel essai.
function creerFichiers_(L) {
  if (!L.length) return [];
  let rep = [];
  try {
    const tok = ScriptApp.getOAuthToken();
    rep = UrlFetchApp.fetchAll(L.map(e => {
      const b = 'cc' + Utilities.getUuid().replace(/-/g, ''), meta = JSON.stringify({ name: e.s.nom, parents: [e.dossier.getId()], mimeType: e.s.mime, description: MARQUE_APP + 'photo-phototheque:' + e.s.pid });
      const tete = Utilities.newBlob('--' + b + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' + meta + '\r\n--' + b + '\r\nContent-Type: ' + e.s.mime + '\r\n\r\n').getBytes();
      return { url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,size,md5Checksum', method: 'post', contentType: 'multipart/related; boundary=' + b,
        payload: tete.concat(Array.isArray(e.oct) ? e.oct : Array.prototype.slice.call(e.oct), Utilities.newBlob('\r\n--' + b + '--').getBytes()), headers: { Authorization: 'Bearer ' + tok }, muteHttpExceptions: true };
    }));
  } catch (x) { console.warn('Création groupée impossible, méthode classique : ' + (x && x.message)); L.forEach(e => { e.raison = String(x && x.message || x).slice(0, 200); }); rep = []; }
  return L.map((e, i) => {
    let j = null;
    try { if (rep[i] && rep[i].getResponseCode() === 200) j = JSON.parse(rep[i].getContentText()); else if (rep[i]) e.raison = 'HTTP ' + rep[i].getResponseCode() + ' ' + String(rep[i].getContentText() || '').slice(0, 160); } catch (x) { e.raison = String(x && x.message || x).slice(0, 200); }
    const md5 = j && j.md5Checksum ? Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, e.oct).map(v => ('0' + (v & 255).toString(16)).slice(-2)).join('') : '';
    if (j && j.id && Number(j.size) === e.oct.length && (!j.md5Checksum || j.md5Checksum === md5)) {
      Object.assign(e.s, { recu: e.s.taille, fini: true, fid: j.id, emp: empreinte_(e.oct) }); e.voie = 'multipart';
      ecrireEnvoi_(e.id, e.s); return { envoi: e.id, recu: e.s.recu, fini: true };
    }
    e.voie = 'classique'; if (e.raison) console.warn('Création groupée refusée (' + e.s.nom + ') : ' + e.raison);
    if (j && j.id) { try { DriveApp.getFileById(j.id).setTrashed(true); } catch (x) { } }   // fichier incomplet : jamais gardé
    try {
      const f = ecritureDrive_('phototheque', () => e.dossier.createFile(Utilities.newBlob(e.oct, e.s.mime, e.s.nom)));
      try { f.setDescription(MARQUE_APP + 'photo-phototheque:' + e.s.pid); } catch (x) { try { f.setTrashed(true); } catch (x2) { } return { envoi: null, recu: 0, fini: false, reessayer: true, message: 'Le Drive n\'a pas pu marquer le fichier : nouvel essai.' }; }
      Object.assign(e.s, { recu: e.s.taille, fini: true, fid: f.getId(), emp: empreinte_(e.oct) });
      ecrireEnvoi_(e.id, e.s); return { envoi: e.id, recu: e.s.recu, fini: true };
    } catch (x) { if (x && x.transitoire) return { envoi: null, recu: 0, fini: false, reessayer: true, message: x.message }; throw x; }
  });
}
// Erreur passagère du Drive (surcharge, coupure réseau) : le morceau peut être renvoyé
function transitoire_(message) { const e = Oups_(message); e.transitoire = true; return e; }
const HTTP_TRANSITOIRE = c => c === 408 || c === 429 || c >= 500;
// Fin d'octets gardés par le Drive d'après l'en-tête Range d'une réponse 308 (« bytes=0-N ») ; 0 si aucun
function finRange_(r) { const h = r.getHeaders ? r.getHeaders() : {}, m = /bytes=0-(\d+)/.exec(h.Range || h.range || ''); return m ? Number(m[1]) + 1 : 0; }
function envoyerMorceau_(s, oct) {
  const a = s.recu, b = a + oct.length - 1;
  let r;
  try { r = UrlFetchApp.fetch(s.uri, { method: 'put', contentType: s.mime, payload: oct, muteHttpExceptions: true, followRedirects: false, headers: { 'Content-Range': 'bytes ' + a + '-' + b + '/' + s.taille } }); }
  catch (e) { throw transitoire_('Connexion au Drive interrompue : nouvel essai.'); }
  const code = r.getResponseCode();
  if (HTTP_TRANSITOIRE(code)) throw transitoire_('Le Drive est momentanément indisponible (HTTP ' + code + ') : nouvel essai.');
  s.partiel = false;
  if (code === 308) {
    // Le Drive indique ce qu'il a réellement gardé (il peut garder moins que le morceau envoyé) : l'empreinte suit exactement ces octets
    const fin = finRange_(r);
    if (fin < a || fin > b + 1 || (fin - a) % 64 !== 0 && fin !== b + 1) throw Oups_('L\'envoi vers le Drive a été interrompu : relancez l\'import de cette photo.');
    shaAjout_(s.sha, fin === b + 1 ? oct : Array.prototype.slice.call(oct, 0, fin - a));
    s.recu = fin; s.partiel = fin !== b + 1;
    return;
  }
  if (b + 1 < s.taille) throw Oups_('L\'envoi vers le Drive a été interrompu (HTTP ' + code + ') : relancez l\'import de cette photo.');
  if (code !== 200 && code !== 201) throw Oups_('L\'envoi vers le Drive a échoué (HTTP ' + code + ') : relancez l\'import de cette photo.');
  let j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) { }
  shaAjout_(s.sha, oct);
  terminerEnvoi_(s, j);
}
// Fichier complet dans le Drive : contrôles de taille et d'empreinte ; différent de celui du navigateur → retiré, jamais enregistré
function terminerEnvoi_(s, j) {
  if (!j || !j.id) throw Oups_('Réponse du Drive incomplète : relancez l\'import de cette photo.');
  s.recu = s.taille; s.fini = true; s.fid = j.id; s.emp = shaFin_(s.sha); delete s.sha; delete s.uri; delete s.partiel;
  if ((j.size && Number(j.size) !== s.taille) || (s.emp_client && s.emp_client !== s.emp)) {
    try { DriveApp.getFileById(j.id).setTrashed(true); } catch (e) { }
    throw Oups_('Le fichier reçu ne correspond pas au fichier envoyé (transfert altéré) : réessayez.');
  }
}
// État d'une session d'envoi auprès du Drive (requête « bytes */total ») : { recu } ou { fini, j } si le fichier est déjà complet ; recu -1 si inconnu
function etatEnvoiDrive_(s) {
  try {
    const r = UrlFetchApp.fetch(s.uri, { method: 'put', payload: '', muteHttpExceptions: true, followRedirects: false, headers: { 'Content-Range': 'bytes */' + s.taille } });
    const code = r.getResponseCode();
    if (code === 200 || code === 201) { let j = {}; try { j = JSON.parse(r.getContentText()); } catch (e) { } return j.id ? { fini: true, j: j } : { recu: -1 }; }
    return code === 308 ? { recu: finRange_(r) } : { recu: -1 };
  } catch (e) { return { recu: -1 }; }
}
// enreg (facultatif) : { meta, lot, mini, forcer } — dernier morceau d'une photo envoyée seule : enregistrée dans le même appel
// (mêmes contrôles qu'api_enregistrerPhotos). Si l'enregistrement échoue ici, l'envoi reste valable et le navigateur l'enregistre ensuite.
function api_photoEnvoi(sid, x, data, envoiId, debut, enreg) {
  return appel_(sid, 'phototheque_importer', u => {
    const L = [];
    let r = envoiPhoto_(u, x, data, envoiId, debut, L);
    if (r._differe) r = creerFichiers_(L)[0];
    if (r.fini && r.envoi && enreg && typeof enreg === 'object') r.enregistrement = enregistrerUn_(u, r.envoi, enreg);
    return r;
  });
}

// Envoi BINAIRE (3.23) : le navigateur envoie les fichiers tels quels dans un formulaire (pas d'encodage base64, qui ajoute un
// tiers de données à transférer). Mêmes fonctions, mêmes contrôles, mêmes droits : seul le transport change. Champs : sid, op
// (« photo » ou « groupe »), args (JSON) ; fichiers f0, f1… (Blob). Le navigateur revient au base64 si ce transport échoue.
function api_envoiBinaire(f) {
  f = f || {};
  let a = []; try { a = JSON.parse(String(f.args || '[]')); } catch (e) { }
  const octets = k => { const b = f[k]; try { return b && b.getBytes ? b.getBytes() : []; } catch (e) { return []; } };
  if (f.op === 'photo') return api_photoEnvoi(String(f.sid || ''), a[0], octets('f0'), a[1], a[2], a[3]);
  if (f.op === 'entier') return api_envoiEntier_(String(f.sid || ''), a[0], f.f0, octets('f1'), a[1]);
  if (f.op === 'groupe') return api_photosEnvoi(String(f.sid || ''), (Array.isArray(a[0]) ? a[0] : []).map((it, i) => Object.assign({}, it, { data: octets('f' + i) })), a[1], a[2]);
  return { ok: false, erreur: 'metier', message: 'Envoi inconnu.' };
}
// ---------- Gros fichiers (3.24) ----------
// 1) ENVOI DIRECT : le serveur ouvre la session d'envoi du Drive (dossier, nom, marque fixés par lui, jeton jamais transmis) et
//    renvoie son adresse ; le navigateur envoie le fichier DIRECTEMENT au Drive (pas de passage par Apps Script : ni limite de
//    taille d'appel, ni base64, ni temps de traitement par morceau) ; le serveur contrôle ensuite le fichier créé et l'enregistre.
// 2) ENVOI ENTIER (photos ≤ 45 Mo, si l'envoi direct n'est pas possible) : le fichier arrive entier dans un formulaire et est
//    créé tel quel par DriveApp (aucun appel à l'API Drive, aucune copie du fichier en mémoire).
// 3) Sinon : envoi par morceaux relayés par Apps Script (inchangé).
const ENTIER_MAX = 45 * 1048576;
function enregistrerUn_(u, envoi, enreg) {
  if (!enreg || typeof enreg !== 'object') return null;
  try { return enregistrerPhotos_(u, enreg.meta, enreg.lot, [{ envoi: envoi, mini: enreg.mini, forcer: enreg.forcer === true }])[0]; } catch (e) { console.warn('Enregistrement différé : ' + (e && e.message)); return null; }
}
function api_envoiDirect(sid, x) {
  return appel_(sid, 'phototheque_importer', u => {
    exigerFonction_('phototheque');
    x = x || {};
    if (!/^[0-9a-f]{64}$/.test(String(x.empreinte || '').toLowerCase())) throw Oups_('Empreinte du fichier manquante : envoi classique.');
    const p = preparerEnvoi_(u, x, decoder64_(x.tete || ''), true);
    if (p.retour) return p.retour;
    p.s.uri = ouvrirSession_(u, p.s); p.s.mode = 'direct';
    ecrireEnvoi_(p.id, p.s);
    return { envoi: p.id, uri: p.s.uri };
  });
}
// Où en est le Drive pour un envoi direct (après une coupure, ou si le navigateur ne peut pas lire la réponse du Drive)
function api_envoiDirectEtat(sid, envoiId) {
  return appel_(sid, 'phototheque_importer', u => { const s = lireEnvoi_(envoiId, u); if (s.mode !== 'direct') throw Oups_('Envoi inconnu.'); const d = etatEnvoiDrive_(s); return d.fini ? { fini: true, fichier: d.j.id } : { recu: d.recu }; });
}
// Contrôle du fichier réellement créé dans le Drive partagé, puis enregistrement (fiche, vignette) dans le même appel
function verifierFichierDrive_(s, fid) {
  let f; try { f = DriveApp.getFileById(fid); } catch (e) { throw Oups_('Le fichier envoyé est introuvable dans le Drive partagé : relancez l\'import de ce fichier.'); }
  const parents = f.getParents(), dansDossier = parents.hasNext() && parents.next().getId() === s.dossier_id;
  const ok = !f.isTrashed() && f.getSize() === s.taille && f.getDescription() === MARQUE_APP + 'photo-phototheque:' + s.pid && dansDossier;
  let tete = [];
  if (ok) { try { const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(fid) + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=0-262143' }, muteHttpExceptions: true }); if (r.getResponseCode() === 206 || r.getResponseCode() === 200) tete = r.getBlob().getBytes().slice(0, 262144); } catch (e) { } }
  const contenu = s.genre === 'video' ? !!typeVideo_(tete) : typeImage_(tete) === s.mime;
  if (!ok || !contenu) { try { f.setTrashed(true); } catch (e) { } throw Oups_('Le fichier reçu par le Drive ne correspond pas au fichier choisi (transfert altéré ou interrompu) : relancez l\'import de ce fichier.'); }
}
function api_envoiDirectFin(sid, envoiId, fid, enreg) {
  return appel_(sid, 'phototheque_importer', u => {
    const s = lireEnvoi_(envoiId, u);
    if (s.mode !== 'direct') throw Oups_('Envoi inconnu.');
    if (!s.fini) {
      if (!fid) { const d = etatEnvoiDrive_(s); if (!d.fini) return { envoi: envoiId, recu: Math.max(0, d.recu), fini: false }; fid = d.j.id; }
      verifierFichierDrive_(s, String(fid));
      Object.assign(s, { recu: s.taille, fini: true, fid: String(fid), emp: s.emp_client }); delete s.uri;
      ecrireEnvoi_(envoiId, s);
    }
    return { envoi: envoiId, recu: s.taille, fini: true, enregistrement: enregistrerUn_(u, envoiId, enreg) };
  });
}
function api_envoiEntier_(sid, x, blob, tete, enreg) {
  return appel_(sid, 'phototheque_importer', u => {
    exigerFonction_('phototheque');
    x = x || {};
    if (!/^[0-9a-f]{64}$/.test(String(x.empreinte || '').toLowerCase())) throw Oups_('Empreinte du fichier manquante : envoi classique.');
    if (!blob || !blob.getBytes || Number(x.taille) > ENTIER_MAX) throw Oups_('Envoi entier impossible : envoi classique.');
    const p = preparerEnvoi_(u, x, tete || [], true);
    if (p.retour) return p.retour;
    const s = p.s;
    let f;
    try { f = ecritureDrive_('phototheque', () => p.dossier.createFile(blob.setName(s.nom).setContentType(s.mime))); }
    catch (e) { if (e && e.transitoire) return { envoi: null, recu: 0, fini: false, reessayer: true, message: e.message }; throw e; }
    try { f.setDescription(MARQUE_APP + 'photo-phototheque:' + s.pid); } catch (e) { try { f.setTrashed(true); } catch (x2) { } return { envoi: null, recu: 0, fini: false, reessayer: true, message: 'Le Drive n\'a pas pu marquer le fichier : nouvel essai.' }; }
    if (f.getSize() !== s.taille) { try { f.setTrashed(true); } catch (e) { } throw Oups_('Le fichier reçu est incomplet : relancez l\'import de ce fichier.'); }
    Object.assign(s, { recu: s.taille, fini: true, fid: f.getId(), emp: s.emp_client });
    ecrireEnvoi_(p.id, s);
    return { envoi: p.id, recu: s.taille, fini: true, enregistrement: enregistrerUn_(u, p.id, enreg) };
  });
}
// À EXÉCUTER UNE FOIS DANS L'ÉDITEUR (menu Exécuter) si le test d'import indique « You do not have permission to call
// UrlFetchApp.fetch » ou « autorisation » : Google demande alors l'accord du compte qui déploie pour les appels à l'API Drive
// (envoi des gros fichiers, lecture des originaux), puis le Centre Com peut les utiliser. Sans effet sur les données.
function autoriserServicesGoogle() {
  const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  console.log('Appels à l\'API Drive autorisés (HTTP ' + r.getResponseCode() + '). Faites ensuite : Déployer > Gérer les déploiements > Modifier > Nouvelle version.');
  return r.getResponseCode();
}
// ---------- Test de l'import dans l'environnement réel (Administration > Photothèque, 3.24) ----------
// Chaque étape du parcours d'un fichier est exécutée pour de vrai avec un petit fichier de test (supprimé ensuite) ; le résultat
// donne, étape par étape, la durée et le message exact de Google en cas d'échec. Réservé aux administrateurs.
function api_testImport(sid) {
  return appel_(sid, 'admin', u => {
    const etapes = [], tmp = [];
    const etape = (nom, fn) => { const t = Date.now(); try { const d = fn(); etapes.push({ etape: nom, ok: true, ms: Date.now() - t, detail: d || '' }); return true; } catch (e) { etapes.push({ etape: nom, ok: false, ms: Date.now() - t, detail: String(e && e.message || e).slice(0, 300) }); return false; } };
    const octets = n => { const o = new Array(n); for (let i = 0; i < n; i++) o[i] = (i * 31) % 251 - 125; return o; };
    let dossier = null;
    etape('Dossier « Photothèque » du Drive partagé', () => { dossier = sousDossier_(dossier_('phototheque'), maintenant_().slice(0, 4)); return dossier.getName(); });
    if (dossier) {
      etape('Création d\'un fichier (DriveApp) + marque', () => { const f = dossier.createFile(Utilities.newBlob(octets(1024), 'application/octet-stream', 'test-import-centre-com.bin')); tmp.push(f.getId()); f.setDescription(MARQUE_APP + 'test-import'); return f.getSize() + ' octets'; });
      etape('Création groupée (API Drive « multipart »)', () => { const L = [{ id: 'T', s: { nom: 'test-import-centre-com-2.bin', mime: 'application/octet-stream', taille: 2048, pid: 'test' }, oct: octets(2048), dossier: dossier }]; const r = creerFichiers_(L)[0]; if (L[0].s.fid) tmp.push(L[0].s.fid); if (!r.fini) throw new Error(r.message || 'échec'); if (L[0].voie !== 'multipart') throw new Error('refusée, méthode classique utilisée à la place : ' + (L[0].raison || '?')); return 'fichier ' + L[0].s.fid; });
      const s = { email: u.email, nom: 'test-import-centre-com-3.bin', mime: 'application/octet-stream', taille: 786432, pid: 'test', dossier_id: dossier.getId(), recu: 0, sha: shaDebut_() };
      if (etape('Ouverture d\'une session d\'envoi (API Drive « resumable »)', () => { s.uri = ouvrirSession_(u, s); return 'session ouverte'; })) {
        etape('Envoi d\'un morceau relayé par Apps Script (512 Kio, réponse 308)', () => { envoyerMorceau_(s, octets(524288)); return 'reçu ' + s.recu + ' octets'; });
        etape('Envoi du dernier morceau et création du fichier', () => { envoyerMorceau_(s, octets(262144)); tmp.push(s.fid); return 'fichier ' + s.fid + ' · ' + DriveApp.getFileById(s.fid).getSize() + ' octets'; });
        if (s.fid) etape('Lecture partielle d\'un original (API Drive, en-tête Range)', () => { const r = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(s.fid) + '?alt=media&supportsAllDrives=true', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=0-99' }, muteHttpExceptions: true }); if ([200, 206].indexOf(r.getResponseCode()) < 0) throw new Error('HTTP ' + r.getResponseCode()); return 'HTTP ' + r.getResponseCode(); });
      }
    }
    etape('Base : onglet « Photothèque » (colonnes, en-tête)', () => { assurerColonnes_('phototheque'); const sh = DB.feuille('phototheque'); return sh.getMaxColumns() + ' colonnes · en-tête ' + (sh.getRange(1, 1, 1, 1).getDisplayValues()[0][0] === 'id' ? 'présent' : 'ABSENT'); });
    tmp.forEach(id => { try { DriveApp.getFileById(id).setTrashed(true); } catch (e) { } });
    // Session pour l'essai d'envoi DIRECT depuis le navigateur (300 Kio, fichier de test supprimé ensuite)
    let direct = null;
    if (dossier) { try { const id = 'E' + Utilities.getUuid().replace(/-/g, '').slice(0, 16), d = { email: u.email, nom: 'test-envoi-direct.bin', mime: 'application/octet-stream', taille: 307200, pid: 'test', dossier_id: dossier.getId(), recu: 0, mode: 'direct', test: true }; d.uri = ouvrirSession_(u, d); ecrireEnvoi_(id, d); direct = { envoi: id, uri: d.uri, taille: d.taille }; } catch (e) { } }
    return { etapes: etapes, direct: direct };
  });
}
function api_testImportDirect(sid, envoiId) {
  return appel_(sid, 'admin', u => {
    const s = lireEnvoi_(envoiId, u); if (!s.test) throw Oups_('Essai inconnu.');
    const d = etatEnvoiDrive_(s);
    if (d.fini && d.j && d.j.id) { let n = 0; try { const f = DriveApp.getFileById(d.j.id); n = f.getSize(); f.setTrashed(true); } catch (e) { } return { ok: n === s.taille, detail: 'fichier créé par le Drive (' + n + ' octets), supprimé' }; }
    return { ok: false, detail: 'le Drive n\'a pas reçu le fichier (' + Math.max(0, d.recu) + ' octets sur ' + s.taille + ')' };
  });
}
// Plusieurs petites photos en un seul appel (8 Mio au plus en tout), enregistrées dans le même appel : chaque photo est traitée
// à part (une erreur n'arrête pas les autres) ; réponse : un résultat par photo (envoi, enregistrement, nouvel essai ou refus).
function api_photosEnvoi(sid, items, meta, lot) {
  return appel_(sid, 'phototheque_importer', u => {
    items = (Array.isArray(items) ? items : []).slice(0, 8);
    let total = 0; items.forEach(it => { const d = it && it.data; total += typeof d === 'string' ? d.length * 3 / 4 : (d || []).length; });
    if (total > MORCEAU_PHOTO * 1.05) throw Oups_('Envoi groupé trop lourd : réessayez.');
    const L = [], erreur = e => e && e.transitoire ? { reessayer: true, message: e.message } : e && e.utilisateur ? { ok: false, message: e.message, doublon: /déjà dans la photothèque/i.test(e.message || '') } : { reessayer: true, message: 'Erreur passagère : nouvel essai.' };
    const res = items.map(it => {
      try { const r = envoiPhoto_(u, Object.assign({}, it.x || {}, { lot: lot }), it.data, null, 0, L); r.mini = it.mini; r.forcer = !!(it.x && it.x.forcer); return r; }
      catch (e) { return erreur(e); }
    });
    // Tous les fichiers de l'appel créés ensemble (en parallèle) dans le Drive partagé
    let crees = []; try { crees = creerFichiers_(L); } catch (e) { crees = L.map(() => erreur(e)); }
    res.forEach((r, i) => { if (r._differe) { const k = L.indexOf(r._differe); res[i] = Object.assign(crees[k], { mini: r.mini, forcer: r.forcer }); } });
    const aEnregistrer = res.filter(r => r.fini && r.envoi);
    if (aEnregistrer.length) {
      try { const e = enregistrerPhotos_(u, meta, lot, aEnregistrer.map(r => ({ envoi: r.envoi, mini: r.mini, forcer: r.forcer === true }))); e.forEach((v, i) => { aEnregistrer[i].enregistrement = v; }); }
      catch (e) { console.warn('Enregistrement différé : ' + (e && e.message)); }   // enregistrement impossible ici (verrou occupé…) : les envois restent valables, le navigateur les enregistre aussitôt après
    }
    return res.map(r => { delete r.mini; delete r.forcer; return r; });
  });
}
// Enregistrement groupé des photos envoyées (fiches, vignettes, journal) ; un doublon retire son fichier
function enregistrerPhotos_(u, meta, lot, items) {
  meta = meta || {};
  items = (Array.isArray(items) ? items : []).slice(0, 20);
  lot = /^[-\w]{4,40}$/.test(String(lot || '')) ? String(lot) : '';
  const mod = peut_(u, 'phototheque_modifier');
  const statut = mod ? (['publiee', 'restreinte'].indexOf(meta.statut) > -1 ? meta.statut : 'publiee') : 'a_valider';
  const m0 = metaPhoto_(meta, u, null, false);
  const prepares = items.map(it => {
    try {
      const s = lireEnvoi_(it.envoi, u);
      if (!s.fini || !s.fid) throw Oups_('Envoi inachevé : relancez l\'import de cette photo.');
      const mini = String(it.mini || ''), mm = mini.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
      if (!mm || mini.length > 49000 || typeImage_(decoder64_(mm[1])) !== 'image/jpeg') throw Oups_('Vignette invalide : réessayez.');
      return { it: it, s: s, mini: mini };
    } catch (e) { return { it: it, erreur: e }; }
  });
  const lignes = [], vigs = [], jour = [], refus = [], out = [];
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  try {
    DB.relire();
    assurerColonnes_('phototheque');   // en-tête et 37 colonnes vérifiés à chaque enregistrement (jamais une fiche écrite sur l'en-tête)
    // Colonnes lues directement (empreintes, fichiers) : rapide même avec des milliers de photos ; la fiche n'est lue que si besoin
    const deja = empreintesPhotos_(), parFichier = {}, fids = {};
    DB.colonne('phototheque', 'fichier_id').forEach(f => { if (f) fids[f] = true; });
    prepares.forEach(p => {
      if (p.erreur) { out.push({ envoi: p.it.envoi, ok: false, message: p.erreur.message || 'Erreur.' }); return; }
      const s = p.s;
      // Déjà enregistré (réponse perdue, nouvel essai) : même résultat, rien de créé ni de retiré
      const existe = parFichier[s.fid] || (fids[s.fid] ? DB.ligne('phototheque', 'fichier_id', s.fid) : null) || (s.enregistre ? DB.ligne('phototheque', 'id', s.enregistre) : null);
      if (existe) { out.push(existe.importe_par === u.email ? { envoi: p.it.envoi, ok: true, photo: existe, deja: true } : { envoi: p.it.envoi, ok: false, message: 'Envoi déjà utilisé.' }); return; }
      // Même fichier déjà enregistré par cette personne dans ce même import (appel précédent dont la réponse n'est pas arrivée) :
      // c'est la même photo, déjà importée — le double est retiré du Drive, jamais une seconde fiche ni une erreur
      const dejaLot = deja[s.emp] ? dejaImportee_(u, s.emp, lot) : null;
      if (dejaLot) { refus.push(s.fid); out.push({ envoi: p.it.envoi, ok: true, photo: dejaLot, deja: true }); return; }
      if (deja[s.emp] && !(p.it.forcer === true && mod)) { refus.push(s.fid); out.push({ envoi: p.it.envoi, ok: false, doublon: true, message: 'Cette photo est déjà dans la photothèque.' }); return; }
      deja[s.emp] = true;
      const m = Object.assign({}, m0);
      if (!m.date_prise && s.exif && s.exif.date_prise) m.date_prise = s.exif.date_prise.slice(0, 10);
      const ligne = Object.assign({ id: s.pid, fichier_id: s.fid, dossier: 'phototheque', nom_original: s.nom, mime: s.mime, taille: s.taille, largeur: s.dim.l, hauteur: s.dim.h, empreinte: s.emp,
        statut: statut, statut_avant: '', exif: JSON.stringify(s.exif || {}).slice(0, 2000), lot: lot, genre: s.genre || '', duree: s.duree ? String(s.duree) : '', importe_par: u.email, importe_le: maintenant_(), maj_par: u.email, maj_le: maintenant_() }, m);
      lignes.push(ligne); vigs.push({ id: s.pid, mini: p.mini }); parFichier[s.fid] = ligne;   // même envoi deux fois dans le lot : une seule fiche
      jour.push({ date: maintenant_(), email: u.email, evenement: 'photo_importee', detail: (s.pid + ' · ' + s.nom + (statut === 'a_valider' ? ' · à valider' : '')).slice(0, 300) });
      out.push({ envoi: p.it.envoi, ok: true, photo: ligne });
    });
    if (lignes.length) { DB.ajouterPlusieurs('phototheque', lignes); DB.ajouterPlusieurs('photo_vignettes', vigs); try { DB.ajouterPlusieurs('journal', jour); } catch (e) { } }
  } finally { try { SpreadsheetApp.flush(); } catch (e) { } lock.releaseLock(); }
  const cache = CacheService.getScriptCache(), vc = {};
  vigs.forEach(v => { vc['vig_' + v.id] = v.mini; });
  try { if (vigs.length) cache.putAll(vc, 21600); } catch (e) { }
  // L'envoi enregistré reste connu (6 h) comme « enregistré » : un nouvel essai renvoie la même fiche au lieu d'un doublon
  const etats = {};
  prepares.forEach(p => { const o = out.find(x => x.envoi === p.it.envoi); if (p.s && o && o.ok) etats[CLE_ENVOI(p.it.envoi)] = JSON.stringify(Object.assign({}, p.s, { enregistre: o.photo.id })); });
  try { if (Object.keys(etats).length) cache.putAll(etats, 21600); } catch (e) { }
  refus.forEach(fid => { try { DriveApp.getFileById(fid).setTrashed(true); } catch (e) { } });
  return out.map(o => o.ok ? { envoi: o.envoi, ok: true, photo: photoLegere_(o.photo, u) } : o);
}
function api_enregistrerPhotos(sid, meta, lot, items) {
  return appel_(sid, 'phototheque_importer', u => {
    try { return enregistrerPhotos_(u, meta, lot, items); }
    catch (e) { try { journalSecu_(u.email, 'import_echec', 'Enregistrement dans la photothèque : ' + String(e && e.message || e).slice(0, 250)); } catch (x) { } throw e; }   // cause visible dans le journal
  });
}
// Import en un seul appel (une photo de 8 Mio au plus) : mêmes contrôles, mêmes étapes
function api_importerPhoto(sid, meta, fichier, lot, forcer) {
  return appel_(sid, 'phototheque_importer', u => {
    fichier = fichier || {}; meta = meta || {};
    const n = String(fichier.data || '').replace(/=+$/, '').length * 3 / 4 | 0;
    if (n > MORCEAU_PHOTO) throw Oups_('Photo trop lourde pour un envoi en une fois : utilisez l\'import de la photothèque.');
    const e = envoiPhoto_(u, { nom: fichier.nom, taille: n, date_prise: meta.date_prise, forcer: forcer === true }, fichier.data, null, 0);
    let r;
    try { r = enregistrerPhotos_(u, meta, lot, [{ envoi: e.envoi, mini: fichier.mini, forcer: forcer === true }])[0]; }
    catch (err) { try { const s = lireEnvoi_(e.envoi, u); DriveApp.getFileById(s.fid).setTrashed(true); } catch (x) { } throw err; }
    if (!r.ok) { if (!r.doublon) { try { const s = lireEnvoi_(e.envoi, u); DriveApp.getFileById(s.fid).setTrashed(true); } catch (x) { } } throw Oups_(r.message); }
    return r.photo;
  });
}
// Routine quotidienne : fichiers envoyés il y a plus d'un jour sans fiche (import abandonné entre l'envoi et l'enregistrement)
function nettoyerEnvoisPhotos_() {
  const ids = {}; photosLignes_().forEach(p => { ids[p.fichier_id] = true; });
  const avant = new Date(Date.now() - 86400000), depuis = new Date(Date.now() - 4 * 86400000);
  let n = 0;
  // Tous les dossiers d'années (une photo est rangée à l'année de sa prise de vue, parfois ancienne) ; seuls les fichiers créés récemment sont examinés
  const dossiers = []; try { const it = dossier_('phototheque').getFolders(); while (it.hasNext()) dossiers.push(it.next()); } catch (e) { }
  dossiers.forEach(f => {
    try {
      const q = 'createdDate > "' + Utilities.formatDate(depuis, 'UTC', "yyyy-MM-dd'T'HH:mm:ss") + '"';
      const fi = f.searchFiles ? f.searchFiles(q) : f.getFiles();
      while (fi.hasNext()) { const x = fi.next(); const cree = x.getDateCreated(); if (cree < avant && cree > depuis && !ids[x.getId()] && String(x.getDescription() || '').indexOf(MARQUE_APP + 'photo-phototheque:') === 0) { x.setTrashed(true); n++; } }
    } catch (e) { }
  });
  if (n) journalSecu_('', 'photos_orphelines', n + ' fichier(s) envoyé(s) sans fiche retiré(s) (corbeille du Drive)');
  return n;
}
// Fin d'un import : prévient l'équipe s'il y a des photos à valider (une fois par lot, jamais pour un lot vide)
function api_finImportPhotos(sid, lot) {
  return appel_(sid, 'phototheque_importer', u => {
    const L = photosLignes_().filter(p => p.lot === String(lot || '') && p.importe_par === u.email);
    const av = L.filter(p => p.statut === 'a_valider').length;
    const cache = CacheService.getScriptCache(), cle = 'lotfini_' + lot;
    if (!L.length || cache.get(cle)) return { photos: L.length, a_valider: av, prevenus: 0 };
    cache.put(cle, '1', 21600);
    let n = 0;
    if (av) { const c0 = config_(); notifier_(DB.tout('utilisateurs').filter(x => role_(x.role) === 'admin' || ((c0.roles[role_(x.role)] || {}).permissions || []).indexOf('phototheque_modifier') > -1).map(x => x.email),
      { type: 'photos', titre: 'Photos à valider', texte: av + ' photo(s) importée(s) par ' + (u.nom || u.email), lien: 'phototheque:valider', cle: 'photos_a_valider', perm: 'phototheque_modifier' }, u.email); }
    if (av && config_().phototheque.notifier_validation) {
      const c = config_(), dests = DB.tout('utilisateurs').filter(x => etatAcces_(x) === 'ok' && x.email !== u.email && (role_(x.role) === 'admin' || ((c.roles[role_(x.role)] || {}).permissions || []).indexOf('phototheque_modifier') > -1)).map(x => x.email);
      const corps = '<p><b>' + esc_(u.nom || u.email) + '</b> a ajouté ' + av + ' photo(s) à la photothèque. Elles attendent votre validation avant d\'être visibles de tous.</p>' + (urlApp_('', '') ? bouton_('Ouvrir la photothèque', urlApp_('', '') + (urlApp_('', '').indexOf('?') > -1 ? '&' : '?') + 'v=phototheque') : '');
      dests.forEach(d => { if (envoyerMail_(d, '[' + c.identite.code + '] ' + av + ' photo(s) à valider', 'Photos à valider', corps)) n++; });
    }
    return { photos: L.length, a_valider: av, prevenus: n };
  });
}

// ---------- Modification, statuts, suppression ----------
function api_modifierPhotos(sid, ids, champs, ajoutTags) {
  return appel_(sid, ['phototheque_modifier', 'phototheque_importer'], u => {
    ids = (Array.isArray(ids) ? ids : []).map(String).slice(0, LIMITE_LOT_PHOTOS);
    champs = champs && typeof champs === 'object' ? champs : {};
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      DB.relire();
      const L = photosLignes_(), ok = [], refus = [];
      const m = metaPhoto_(champs, u, null, true);
      ids.forEach(id => {
        const p = L.find(x => x.id === id);
        if (!p || !photoVisible_(u, p) || !photoEditable_(u, p)) { refus.push(id); return; }
        const patch = Object.assign({}, m);
        if (ajoutTags && m.tags !== undefined) patch.tags = metaPhoto_({ tags: [p.tags, m.tags].filter(Boolean).join(', ') }, u, null, true).tags;
        if (champs.statut && peut_(u, 'phototheque_modifier') && ['publiee', 'restreinte', 'a_valider'].indexOf(champs.statut) > -1 && ['publiee', 'restreinte', 'a_valider'].indexOf(p.statut) > -1) patch.statut = champs.statut;
        patch.maj_par = u.email; patch.maj_le = maintenant_();
        DB.modifier('phototheque', 'id', id, patch); ok.push(id);
      });
      if (ok.length) journalSecu_(u.email, 'photos_modifiees', ok.length + ' photo(s)' + (ok.length === 1 ? ' · ' + ok[0] : '') + ' · ' + Object.keys(m).join(', '));
      const L2 = photosLignes_();
      return { photos: ok.map(id => photoLegere_(L2.find(x => x.id === id), u)), refus: refus.length };
    } finally { lock.releaseLock(); }
  });
}
const ACTIONS_PHOTO = {
  publier: ['phototheque_modifier', ['a_valider', 'restreinte'], 'publiee'], restreindre: ['phototheque_modifier', ['publiee', 'a_valider'], 'restreinte'],
  archiver: ['phototheque_archiver', ['publiee', 'restreinte', 'a_valider'], 'archivee'], desarchiver: ['phototheque_archiver', ['archivee'], ''],
  corbeille: ['phototheque_supprimer', ['publiee', 'restreinte', 'a_valider', 'archivee'], 'corbeille'], restaurer: ['phototheque_supprimer', ['corbeille'], ''],
};
function api_statutPhotos(sid, ids, action) {
  const A = ACTIONS_PHOTO[action];
  return appel_(sid, A ? A[0] : 'admin', u => {
    if (!A) throw Oups_('Action inconnue.');
    ids = (Array.isArray(ids) ? ids : []).map(String).slice(0, LIMITE_LOT_PHOTOS);
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      DB.relire();
      const L = photosLignes_(), ok = [], erreurs = [];
      ids.forEach(id => {
        const p = L.find(x => x.id === id);
        if (!p || !photoVisible_(u, p) || A[1].indexOf(p.statut) === -1) { erreurs.push(id); return; }
        // statut_avant : état à retrouver en sortant des archives ou de la corbeille
        const avant = ['publiee', 'restreinte', 'a_valider'].concat(action === 'restaurer' ? ['archivee'] : []).indexOf(p.statut_avant) > -1 ? p.statut_avant : 'publiee';
        const cible = A[2] || avant;
        const patch = { statut: cible, statut_avant: A[2] ? p.statut : (cible === 'archivee' ? 'publiee' : ''), maj_par: u.email, maj_le: maintenant_() };
        // Archivage : le fichier rejoint le dossier des archives (s'il est configuré) ; désarchivage : retour dans la photothèque
        try {
          if (action === 'archiver' && idDossier_('phototheque_archives') && infoDossier_('phototheque_archives').actif) { ecritureDrive_('phototheque', () => DriveApp.getFileById(p.fichier_id).moveTo(dossier_('phototheque_archives'))); patch.dossier = 'phototheque_archives'; }
          if (action === 'desarchiver' && p.dossier === 'phototheque_archives') { ecritureDrive_('phototheque', () => DriveApp.getFileById(p.fichier_id).moveTo(sousDossier_(dossier_('phototheque'), String(p.date_prise || p.importe_le).slice(0, 4)))); patch.dossier = 'phototheque'; }
        } catch (e) { erreurs.push(id); return; }
        DB.modifier('phototheque', 'id', id, patch); ok.push(id);
      });
      if (ok.length) journalSecu_(u.email, 'photos_' + action, ok.length + ' photo(s)' + (ok.length === 1 ? ' · ' + ok[0] : ''));
      const L2 = photosLignes_();
      return { photos: ok.map(id => photoLegere_(L2.find(x => x.id === id), u)), erreurs: erreurs.length };
    } finally { lock.releaseLock(); }
  });
}
// Suppression définitive (depuis la corbeille logique seulement) : fichier mis à la corbeille du Drive partagé (récupérable
// 30 jours par un gestionnaire du Drive), fiche, vignette, favoris et présence dans les albums retirés.
function api_supprimerPhotos(sid, ids, confirmation) {
  return appel_(sid, 'phototheque_supprimer', u => {
    if (confirmation !== 'SUPPRIMER') throw Oups_('Confirmation de la suppression manquante.');
    ids = (Array.isArray(ids) ? ids : []).map(String).slice(0, LIMITE_LOT_PHOTOS);
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      DB.relire();
      const L = photosLignes_(), R = lignesRessources_(), ok = [], refus = [];
      ids.forEach(id => {
        const p = L.find(x => x.id === id);
        if (!p || p.statut !== 'corbeille' || !photoVisible_(u, p)) { refus.push({ id: id, motif: 'Seules les photos de la corbeille peuvent être supprimées définitivement.' }); return; }
        const r = R.find(x => x.type === 'fichier' && x.fichier_id === p.fichier_id);
        if (r) { refus.push({ id: id, motif: 'Utilisée par la ressource « ' + r.titre + ' » : retirez d\'abord la ressource.' }); return; }
        if (p.fichier_id && !mettreCorbeille_(p.fichier_id)) { const x = fichierDisponible_(p.fichier_id); if (!x.cause || x.cause === 'inaccessible') { refus.push({ id: id, motif: 'Le Drive partagé a refusé la suppression du fichier.' }); return; } }
        ok.push(id);
      });
      if (ok.length) {
        supprimerLignesPar_('phototheque', 'id', ok); supprimerLignesPar_('photo_vignettes', 'id', ok); supprimerLignesPar_('photo_favoris', 'photo_id', ok);
        albumsLignes_().forEach(a => { const l = String(a.photos || '').split(',').filter(Boolean); const n = l.filter(x => ok.indexOf(x) === -1); if (n.length !== l.length || ok.indexOf(a.couverture) > -1) DB.modifier('albums', 'id', a.id, { photos: n.join(','), couverture: ok.indexOf(a.couverture) > -1 ? '' : a.couverture }); });
        try { CacheService.getScriptCache().removeAll(ok.map(id => 'vig_' + id)); } catch (e) { }
        journalSecu_(u.email, 'photos_supprimees', ok.length + ' photo(s) : ' + ok.join(', ').slice(0, 200));
      }
      return { supprimees: ok.length, refus: refus };
    } finally { lock.releaseLock(); }
  });
}
function api_favoriPhoto(sid, id, oui) {
  return appel_(sid, 'phototheque_voir', u => {
    const p = photoDe_(u, id); assurerOnglet_('photo_favoris');
    const deja = DB.tout('photo_favoris').some(f => f.email === u.email && f.photo_id === p.id);
    if (oui && !deja) DB.ajouter('photo_favoris', { email: u.email, photo_id: p.id, le: maintenant_() });
    if (!oui && deja) { const sh = DB.feuille('photo_favoris'), t = DB.tout('photo_favoris'); for (let i = t.length - 1; i >= 0; i--) if (t[i].email === u.email && t[i].photo_id === p.id) sh.deleteRow(t[i]._ligne); delete DB._cache.photo_favoris; }
    return !!oui;
  });
}

// ---------- Albums (listes d'identifiants, sans copie de fichiers) ----------
function api_enregistrerAlbum(sid, a) {
  return appel_(sid, 'phototheque_modifier', u => {
    a = a || {};
    const txt = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').trim().slice(0, max);
    const titre = txt(a.titre, 120);
    if (!titre) throw Oups_('Le nom de l\'album est obligatoire.');
    const m = metaPhoto_({ ul: a.ul, evenement_cal: a.evenement_cal, demande_id: a.demande_id }, u, null, false);
    const o = { titre: titre, description: txt(a.description, 1000), type: ALBUM_TYPES.indexOf(a.type) > -1 ? a.type : 'autre', ul: m.ul, evenement_cal: m.evenement_cal, demande_id: m.demande_id, etat: a.etat === 'archive' ? 'archive' : 'actif', maj_le: maintenant_() };
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      if (a.id) {
        const av = albumsLignes_().find(x => x.id === a.id);
        if (!av) throw Oups_('Cet album a été supprimé entre-temps.');
        if (a.couverture !== undefined) o.couverture = String(av.photos || '').split(',').indexOf(String(a.couverture)) > -1 ? String(a.couverture) : '';
        DB.modifier('albums', 'id', a.id, o); journalSecu_(u.email, 'album_modifie', a.id + ' · ' + titre);
        return a.id;
      }
      const id = 'A-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
      DB.ajouter('albums', Object.assign({ id: id, photos: '', couverture: '', cree_par: u.email, cree_le: maintenant_() }, o));
      journalSecu_(u.email, 'album_cree', id + ' · ' + titre);
      return id;
    } finally { lock.releaseLock(); }
  });
}
function api_photosAlbum(sid, albumId, ajout, retrait) {
  return appel_(sid, 'phototheque_modifier', u => {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const a = albumsLignes_().find(x => x.id === albumId);
      if (!a) throw Oups_('Cet album n\'existe plus.');
      const L = photosLignes_(), vis = id => { const p = L.find(x => x.id === id); return p && photoVisible_(u, p) && p.statut !== 'corbeille'; };
      let l = String(a.photos || '').split(',').filter(Boolean);
      const plus = (Array.isArray(ajout) ? ajout : []).map(String).filter(id => vis(id) && l.indexOf(id) === -1);
      const moins = (Array.isArray(retrait) ? retrait : []).map(String);
      l = l.filter(id => moins.indexOf(id) === -1).concat(plus);
      if (l.length > 2000) throw Oups_('Un album contient 2 000 photos au plus.');
      DB.modifier('albums', 'id', albumId, { photos: l.join(','), couverture: l.indexOf(a.couverture) > -1 ? a.couverture : '', maj_le: maintenant_() });
      journalSecu_(u.email, 'album_photos', albumId + ' · +' + plus.length + ' / -' + moins.filter(id => String(a.photos).indexOf(id) > -1).length);
      return { ajoutees: plus.length, total: l.length, retirees: moins.length };
    } finally { lock.releaseLock(); }
  });
}
function api_supprimerAlbum(sid, id, confirmation) {
  return appel_(sid, 'phototheque_modifier', u => {
    if (confirmation !== 'SUPPRIMER') throw Oups_('Confirmation manquante.');
    const a = albumsLignes_().find(x => x.id === id);
    if (!a) throw Oups_('Cet album a déjà été supprimé.');
    DB.supprimer('albums', 'id', id); journalSecu_(u.email, 'album_supprime', id + ' · ' + a.titre + ' (photos conservées)');
    return true;
  });
}
// Une photo devient aussi une ressource : même fichier (aucune copie), accès contrôlé par la ressource ET par le dossier
function api_photoVersRessource(sid, id, meta) {
  return appel_(sid, 'ressources_gerer', u => {
    const p = photoDe_(u, id);
    if (p.statut !== 'publiee') throw Oups_('Seule une photo publiée peut devenir une ressource.');
    fichierPhoto_(u, p);
    if (lignesRessources_().some(r => r.fichier_id === p.fichier_id)) throw Oups_('Cette photo est déjà une ressource.');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const m = metaRessource_(Object.assign({ titre: p.titre || p.nom_original, description: p.description, rubrique: (config_().ressources.categories.find(c => c.dossier === 'image') || {}).nom }, meta || {}), u, null);
      const rid = 'R-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), t = lignesRessources_();
      DB.ajouter('ressources', Object.assign({ id: rid, type: 'fichier', url: '', ordre: t.length + 1, fichier_id: p.fichier_id, fichier_nom: p.nom_original, fichier_mime: p.mime, fichier_taille: p.taille,
        dossier: p.dossier, origine: 'phototheque', auteur: u.email, cree_le: maintenant_() }, m));
      journalSecu_(u.email, 'ressource_ajoutee', rid + ' · depuis la photothèque · ' + p.id);
      return rid;
    } finally { lock.releaseLock(); }
  });
}
// Photos rattachées à une demande (photos liées à la demande, ou choisies par le demandeur) — filtrées pour la personne
function photosDemande_(u, d) {
  if (!peut_(u, 'phototheque_voir')) return [];
  let choisies = []; try { choisies = JSON.parse(d.details || '{}').photos || []; } catch (e) { }
  try { return indexPhotos_().filter(p => (p.demande_id === d.id || choisies.indexOf(p.id) > -1) && photoVisible_(u, p) && p.statut !== 'corbeille').map(p => photoLegere_(p, u)); } catch (e) { return []; }
}

// Tableau de bord de l'administrateur (page d'accueil) — lecture seule : aucune écriture, aucun appel au Drive
// (l'état des fonctions vient du cache, recalculé au plus toutes les 10 minutes). Réservé au rôle admin, vérifié ici.
const EVTS_INCIDENTS = ['drive_echec', 'notification_echec', 'refus_permission', 'refus_ressource', 'refus_google', 'refus'];
const EVTS_SANS_INTERET = ['connexion', 'deconnexion', 'expiration', 'drive_verifie', 'notification_inscription', 'lien_envoye'];
function resumeAdmin_(u) {
    const c = config_(), lim7 = isoJour_(new Date(Date.now() - 7 * 864e5));
    const users = DB.tout('utilisateurs').map(x => profilPublic_(x, c));
    const recents = users.filter(x => x.origine === 'inscription' && String(x.cree_le).slice(0, 10) >= lim7).sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le)));
    const desactives = users.filter(x => x.acces === 'desactive');
    const F = etatFonctions_();
    const fonctions = Object.keys(F).filter(k => F[k].etat !== 'ok' && F[k].etat !== 'inactif').map(k => ({ cle: k, titre: F[k].titre, etat: F[k].etat, section: F[k].section }));
    const j = DB.dernieres('journal', 1500).filter(e => String(e.date).slice(0, 10) >= lim7);
    const incidents = j.filter(e => EVTS_INCIDENTS.indexOf(e.evenement) > -1);
    const parType = {}; incidents.forEach(e => { parType[e.evenement] = (parType[e.evenement] || 0) + 1; });
    const actions = j.filter(e => EVTS_INCIDENTS.indexOf(e.evenement) === -1 && EVTS_SANS_INTERET.indexOf(e.evenement) === -1).slice(-8).reverse();
    const R = lignesRessources_();
    const ress = {
      total: R.length,
      brouillons: R.filter(r => r.etat === 'brouillon').length,
      a_revoir: R.filter(r => r.etat !== 'archivee' && /obsol|mettre à jour/i.test(String(r.statut || ''))).length,
      incompletes: R.filter(r => r.etat !== 'archivee' && (r.type === 'fichier' ? !r.fichier_id : !r.url)).length,
    };
    const court = x => ({ email: x.email, nom: x.nom, ul: x.ul, fonction: x.fonction, cree_le: x.cree_le, acces: x.acces, motif: x.motif });
    const ev = e => ({ date: e.date, email: e.email, evenement: e.evenement, detail: String(e.detail || '').slice(0, 140) });
    return {
      inscriptions: { semaine: recents.length, liste: recents.slice(0, 5).map(court) },
      desactives: { total: desactives.length, liste: desactives.slice(0, 5).map(court) },
      fonctions: fonctions,
      incidents: { total: incidents.length, par_type: parType, derniers: incidents.slice(-5).reverse().map(ev) },
      actions: actions.map(ev),
      ressources: ress,
      config: { numero: c.meta.numero || 0, modifie_le: c.meta.modifie_le || '', modifie_par: c.meta.modifie_par || '' },
      pilotage: pilotageAdmin_(u, users, j, lim7, F),
    };
}
// Tableau de bord de l'administration (3.17) : uniquement des comptes réels, lus dans les tables déjà en cache (aucun accès au Drive :
// l'état des dossiers vient de la vérification gardée 10 min). Réservé au rôle admin (api_resumeAdmin / api_accueil).
function pilotageAdmin_(u, users, j, lim7, F) {
  const now = maintenant_(), auj = aujourdhui_(), lim30 = isoJour_(new Date(Date.now() - 30 * 864e5));
  const actifs = users.filter(x => x.acces === 'ok'), vu = x => String(x.derniere_activite || x.derniere_visite || '').slice(0, 10);
  const parRole = {}; actifs.forEach(x => { parRole[x.role] = (parRole[x.role] || 0) + 1; });
  const D = DB.tout('demandes').filter(d => classe_(d.statut) !== 'archivee'), ouv = D.filter(d => !estFerme_(d.statut));
  let resas = { attente: 0, en_cours: 0, semaine: 0 }, mat = { total: 0, indisponibles: [] };
  try {
    const nowM = now.slice(0, 16), sem = isoJour_(new Date(Date.now() + 7 * 864e5)) + 'T23:59', noms = {};
    const M = materielLignes_().filter(m => m.archive !== 'OUI'); M.forEach(m => noms[m.id] = m.nom);
    reservationsLignes_().forEach(r => { if (r.statut === 'attente' && r.fin > nowM) resas.attente++; if (r.statut === 'confirmee' && r.debut <= nowM && r.fin > nowM) resas.en_cours++; if (RESA_BLOQUANTS.indexOf(r.statut) > -1 && r.debut > nowM && r.debut <= sem) resas.semaine++; });
    mat.total = M.filter(m => m.actif !== 'NON').length;
    mat.indisponibles = M.filter(m => m.actif !== 'NON' && m.etat !== 'disponible').map(m => ({ id: m.id, nom: m.nom, etat: m.etat, detail: m.maintenance || '' })).slice(0, 8);
  } catch (e) { }
  const R = lignesRessources_(), nouvelles = R.filter(r => String(r.cree_le || '').slice(0, 10) >= lim7).sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le)));
  let aValider = 0; try { aValider = indexPhotos_().filter(p => p.statut === 'a_valider').length; } catch (e) { }
  const drive = Object.keys(F).filter(k => F[k].section === 'drive').map(k => ({ cle: k, titre: F[k].titre, etat: F[k].etat }));
  const anomalies = {}; j.forEach(e => { if (['drive_echec', 'notification_echec', 'fichier_indisponible', 'refus_permission', 'refus_fichier', 'refus_ressource'].indexOf(e.evenement) > -1) anomalies[e.evenement] = (anomalies[e.evenement] || 0) + 1; });
  return {
    utilisateurs: { actifs: actifs.length, connectes_7j: actifs.filter(x => vu(x) >= lim7).length, jamais: actifs.filter(x => !vu(x)).length, inactifs_30j: actifs.filter(x => vu(x) && vu(x) < lim30).length, par_role: parRole },
    demandes: { en_cours: ouv.length, a_attribuer: ouv.filter(d => !d.responsable).length, en_retard: ouv.filter(d => d.echeance && d.echeance < auj).length, nouvelles_7j: D.filter(d => String(d.cree_le).slice(0, 10) >= lim7).length },
    reservations: resas, materiel: mat,
    ressources: { nouvelles: nouvelles.length, liste: nouvelles.slice(0, 5).map(r => ({ id: r.id, titre: r.titre, rubrique: r.rubrique, cree_le: r.cree_le })) },
    phototheque: { a_valider: aValider },
    drive: { ok: drive.filter(d => d.etat === 'ok').length, total: drive.length, problemes: drive.filter(d => d.etat !== 'ok' && d.etat !== 'inactif') },
    anomalies: anomalies,
  };
}
function api_resumeAdmin(sid) { return appel_(sid, 'admin', resumeAdmin_); }
// ---------- Actions groupées sur les utilisateurs (rôle, désactivation, réactivation) : mêmes règles que la fiche ----------
function api_actionUtilisateurs(sid, emails, action, valeur, motif) {
  return appel_(sid, 'admin', u => {
    emails = (Array.isArray(emails) ? emails : []).map(e => String(e || '').toLowerCase()).filter((e, i, t) => e && t.indexOf(e) === i).slice(0, 100);
    if (!emails.length) throw Oups_('Aucune personne sélectionnée.');
    if (['role', 'desactiver', 'reactiver'].indexOf(action) < 0) throw Oups_('Action inconnue.');
    const c = config_(), ok = [], refus = [];
    if (action === 'role' && !c.roles[String(valeur)]) throw Oups_('Rôle inconnu.');
    if (action === 'role' && !roleActif_(c, String(valeur))) throw Oups_('Ce rôle est désactivé : il ne peut plus être attribué.');
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      DB.relire();
      emails.forEach(email => {
        try {
          const x = DB.trouver('utilisateurs', 'email', email);
          if (!x) throw Oups_('profil introuvable');
          if (email === u.email) throw Oups_('votre propre compte ne se modifie pas ici');
          const admins = DB.tout('utilisateurs').filter(y => y.email !== email && role_(y.role) === 'admin' && etatAcces_(y) === 'ok').length;
          if (action === 'role') {
            const r = String(valeur);
            if (role_(x.role) === r) { ok.push(email); return; }
            if (role_(x.role) === 'admin' && !admins) throw Oups_('il faut garder au moins un administrateur actif');
            DB.modifier('utilisateurs', 'email', email, { role: r, modifie_le: maintenant_() });
            journalSecu_(u.email, 'role_modifie', email + ' — rôle : ' + libRole_(c, role_(x.role)) + ' → ' + libRole_(c, r) + ' (action groupée)');
          } else if (action === 'desactiver') {
            if (etatAcces_(x) !== 'ok') { ok.push(email); return; }
            if (role_(x.role) === 'admin' && !admins) throw Oups_('il faut garder au moins un administrateur actif');
            DB.modifier('utilisateurs', 'email', email, { actif: 'NON', motif: String(motif || '').replace(/[<>]/g, '').slice(0, 300), sessions_avant: String(Date.now()), modifie_le: maintenant_() });
            journalSecu_(u.email, 'acces_desactive', email + (motif ? ' — motif : ' + motif : '') + ' (action groupée)');
          } else {
            const a = etatAcces_(x);
            if (a === 'ok') { ok.push(email); return; }
            if (a === 'revoque') throw Oups_('accès révoqué : à rétablir depuis la fiche');
            DB.modifier('utilisateurs', 'email', email, { actif: 'OUI', motif: '', modifie_le: maintenant_() });
            journalSecu_(u.email, 'acces_reactive', email + ' (action groupée)');
          }
          ok.push(email);
        } catch (e) { refus.push({ email: email, message: (e && e.utilisateur && e.message) || 'erreur' }); }
      });
    } finally { try { SpreadsheetApp.flush(); } catch (e) { } lock.releaseLock(); }
    const ph = photosDe_(ok);
    return { ok: ok, refus: refus, profils: ok.map(e => Object.assign(profilPublic_(DB.trouver('utilisateurs', 'email', e), c), { photo: ph[e] || '' })) };
  });
}
// Retour arrière sans Drive : la configuration précédente est gardée dans la base à chaque enregistrement
function api_restaurerConfigPrecedente(sid, confirmation) {
  return appel_(sid, 'admin', u => {
    if (confirmation !== 'RESTAURER') throw Oups_('Confirmation manquante.');
    const brut = DB.tout('configuration').filter(r => r.cle === 'precedente').map(r => r.valeur).join('');
    if (!brut) throw Oups_('Aucune configuration précédente n\'est disponible.');
    let o; try { o = JSON.parse(brut); } catch (e) { throw Oups_('La configuration précédente est illisible.'); }
    const r = enregistrerConfig_(o, u.email, 'Restauration de la configuration précédente');
    journalSecu_(u.email, 'restauration', 'Configuration précédente (copie locale) — n° ' + r.meta.numero);
    return r.meta.numero;
  });
}
function copieBase_() {
  const base = DriveApp.getFileById(idBase_());
  return ecritureDrive_('sauvegardes', () => base.makeCopy(base.getName() + ' — copie du ' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd-MM-yyyy HH:mm'), dossier_('sauvegardes')));
}

// =====================================================================
// CONFIGURATION PROGRESSIVE — état de chaque fonction qui dépend d'un réglage
// ok | non_configure | indisponible | inactif. Calculé côté serveur, gardé 10 minutes (recalculé à chaque
// enregistrement de la configuration et à chaque vérification du Drive).
// =====================================================================
const CLE_FONCTIONS = 'etat_fonctions';
const FONCTIONS = {
  fichiers_demandes: ['Fichiers joints aux demandes', 'fichiers_demandes', 'drive', 'L\'envoi de fichiers n\'est pas encore disponible. Indiquez plutôt un lien vers vos documents (Drive, WeTransfer…), ou envoyez-les à l\'équipe communication.'],
  ressources_fichiers: ['Import de fichiers dans les ressources', 'ressources', 'drive', 'L\'import de fichiers n\'est pas encore disponible : ajoutez la ressource sous forme de lien.'],
  photos: ['Photos de profil', 'profils', 'drive', 'Les photos de profil ne sont pas encore disponibles.'],
  phototheque: ['Import de photos dans la photothèque', 'phototheque', 'drive', 'L\'import de photos n\'est pas encore disponible : le dossier « Photothèque » du Drive partagé n\'est pas configuré. La consultation des photos existantes reste possible.'],
  sauvegardes: ['Sauvegardes dans le Drive', 'sauvegardes', 'drive', 'Les sauvegardes dans le Drive ne sont pas encore configurées. Le téléchargement de la configuration reste possible.'],
  exports: ['Exports de configuration dans le Drive', 'configurations', 'drive', 'L\'export dans le Drive n\'est pas encore configuré. Le téléchargement reste possible.'],
  fichiers_presse: ['Fichiers des sollicitations presse', 'presse', 'drive', 'L\'ajout de fichiers aux sollicitations presse n\'est pas encore disponible (dossier « Presse » du Drive partagé non configuré) : indiquez un lien.'],
  alertes_equipe: ['Alertes e-mail à l\'équipe', '', 'notifications', 'Personne ne reçoit encore les alertes de nouvelles demandes par e-mail.'],
};
function etatFonctions_(forcer) {
  const cache = CacheService.getScriptCache();
  if (!forcer) { try { const x = cache.get(CLE_FONCTIONS); if (x) return JSON.parse(x); } catch (e) { } }
  const c = config_(), out = {}, vus = {};
  const etatDossier = cle => {
    if (vus[cle]) return vus[cle];
    let e = 'ok';
    if (!infoDossier_(cle).actif) e = 'inactif';
    else if (!idDossier_(cle)) e = 'non_configure';
    else if (TEST_DOSSIERS_EXEC[cle]) e = TEST_DOSSIERS_EXEC[cle].etat === 'ok' || TEST_DOSSIERS_EXEC[cle].etat === 'ecriture' ? 'ok' : 'indisponible';   // déjà testé pendant cet appel
    else { try { if (DriveApp.getFolderById(idDossier_(cle)).isTrashed()) e = 'indisponible'; } catch (err) { e = 'indisponible'; } }
    return (vus[cle] = e);
  };
  Object.keys(FONCTIONS).forEach(k => {
    const f = FONCTIONS[k];
    let etat = f[1] ? etatDossier(f[1]) : 'ok';
    if (k === 'photos' && !c.profils.photo) etat = 'inactif';
    if (k === 'alertes_equipe' && !destinatairesEquipe_().length) etat = 'non_configure';
    out[k] = { titre: f[0], etat: etat, message: f[3], section: f[2] };
  });
  try { cache.put(CLE_FONCTIONS, JSON.stringify(out), 21600); } catch (e) { }   // 30 min : refait à chaque changement de configuration ou vérification du Drive
  return out;
}
function fonctionOk_(cle) { const F = etatFonctions_(); return !!F[cle] && F[cle].etat === 'ok'; }
// Ce que l'interface de chacun a besoin de savoir (aucun identifiant, aucun détail technique)
function fonctionsPubliques_() { const F = etatFonctions_(), o = {}; Object.keys(F).forEach(k => { o[k] = { ok: F[k].etat === 'ok', message: F[k].message }; }); return o; }
// Fonction non configurée → message clair (après une seconde vérification sans cache, si le réglage vient d'être fait)
function exigerFonction_(cle) {
  if (fonctionOk_(cle)) return;
  const F = etatFonctions_(true);
  if (F[cle] && F[cle].etat === 'ok') return;
  if (!F[cle]) throw Oups_('Cette fonction n\'est pas encore configurée.');
  const dos = FONCTIONS[cle][1];
  if (F[cle].etat === 'indisponible' && dos) throw Oups_('Le dossier « ' + infoDossier_(dos).nom + ' » du Drive partagé est inaccessible (supprimé, déplacé ou non partagé avec le compte de l\'application) : ' + F[cle].titre.toLowerCase() + ' indisponible pour le moment. Prévenez l\'administrateur (Administration > Drive partagé).');
  throw Oups_(F[cle].message);
}
// Écriture dans le Drive : une erreur technique devient un message compréhensible (et l'état est recalculé)
// Erreur passagère de Google (délai dépassé, surcharge, service momentanément indisponible) : à réessayer, jamais un échec définitif
const ERREUR_PASSAGERE = /timed? ?out|timeout|d[ée]lai|service error|internal error|erreur (interne|de service)|backend|rate limit|too many|trop de|temporar|momentan|unavailable|indisponible|try again|r[ée]essayez|lock/i;
function ecritureDrive_(cle, fn) {
  try { return fn(); }
  catch (e) {
    if (e && e.utilisateur) throw e;
    if (ERREUR_PASSAGERE.test(String(e && e.message || e))) { console.warn('Écriture Drive passagère (' + cle + ') : ' + (e && e.message || e)); throw transitoire_('Le Drive partagé est momentanément surchargé. Réessayez dans un instant.'); }
    console.error('Écriture Drive (' + cle + ') : ' + (e && e.stack || e));
    try { CacheService.getScriptCache().remove(CLE_FONCTIONS); } catch (x) { }
    try { journalSecu_('', 'drive_echec', (FONCTIONS[cle] || [cle])[0] + ' : ' + String(e && e.message || e).slice(0, 200)); } catch (x) { }
    throw Oups_('L\'enregistrement dans le Drive partagé a échoué (' + ((FONCTIONS[cle] || [cle])[0]).toLowerCase() + '). Le dossier est peut-être inaccessible ou en lecture seule. Réessayez plus tard ; si le problème persiste, prévenez l\'administrateur (Administration > Drive partagé).');
  }
}

// =====================================================================
// 15. AUTOMATISMES (déclencheur quotidien)
// =====================================================================
function routineQuotidienne() {
  if (!uneFoisParJour_('routine_quotidienne')) return;
  const c = config_();
  try { nettoyerEnvoisPhotos_(); } catch (e) { console.error('Nettoyage des envois de photos : ' + e); }
  try { purgerNotifications_(); } catch (e) { console.error('Purge des notifications : ' + e); }
  if (c.notifications.rappels) {
    DB.tout('demandes').filter(d => !estFerme_(d.statut)).filter(d => { const j = joursAvant_(d.echeance); return j !== null && j >= 0 && j <= c.notifications.rappel_jours && !d.rappel_envoye; }).forEach(d => {
      const dests = d.responsable ? [d.responsable] : destinatairesEquipe_();
      dests.forEach(dest => mailModele_(dest, 'rappel', variablesDemande_(d, {}), bouton_('Ouvrir la demande', lienPour_(dest, d.id))));
      DB.modifier('demandes', 'id', d.id, { rappel_envoye: maintenant_() });
    });
  }
  try { rappelsQuotidiens_(); } catch (e) { console.error('Rappels : ' + e); }
  try { diffusionsDues_(); } catch (e) { console.error('Diffusions programmées : ' + e); }
  if (new Date().getDay() === Number(c.notifications.point_hebdo_jour) && c.notifications.point_hebdo) pointHebdo_();
  // Journal limité aux 5 000 derniers événements
  try { const j = DB.tout('journal'); if (j.length > 5000) DB.remplacer('journal', j.slice(-4000)); } catch (e) { }
}

// Envoi manuel du point hebdo depuis l'éditeur (propriétaire uniquement)
function pointHebdo() { reserveProprietaire_(); pointHebdo_(); }
function pointHebdo_() {
  const c = config_();
  const toutes = DB.tout('demandes');
  const ouvertes = toutes.filter(d => !estFerme_(d.statut)).sort((a, b) => String(a.echeance).localeCompare(String(b.echeance)));
  const retard = ouvertes.filter(d => joursAvant_(d.echeance) !== null && joursAvant_(d.echeance) < 0);
  const nonAttribuees = ouvertes.filter(d => !d.responsable && retard.indexOf(d) === -1);
  const autres = ouvertes.filter(d => retard.indexOf(d) === -1 && nonAttribuees.indexOf(d) === -1);
  const semaine = toutes.filter(d => joursDepuis_(d.cree_le) <= 7).length;
  const closes = toutes.filter(d => d.cloture_le && joursDepuis_(d.cloture_le) <= 7).length;
  const presseActive = (c.navigation.find(n => n.cle === 'presse') || {}).visible;
  const ouvertsPresse = c.presse.statuts.filter(s => s.ouvert).map(s => s.nom);
  const presse = presseActive ? DB.tout('presse').filter(p => ouvertsPresse.indexOf(p.statut) > -1) : [];
  const agenda = DB.tout('calendrier').concat(toutes.filter(d => d.date_action && classe_(d.statut) !== 'annulee').map(d => ({ date: d.date_action, titre: d.titre, ul: d.ul, statut: 'Prévu', categorie: c.calendrier.categorie_demandes })))
    .filter(x => { const j = joursAvant_(x.date); return j !== null && j >= 0 && j <= 14 && x.statut !== 'Annulé' && x.statut !== 'Idée'; })
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const li = (arr, f) => arr.length ? '<ul style="padding-left:18px;margin:6px 0">' + arr.map(x => '<li style="margin:3px 0">' + f(x) + '</li>').join('') + '</ul>' : '<p style="color:#6b6b6b;margin:6px 0">Rien à signaler.</p>';
  const ld = d => '<b>' + esc_(d.id) + '</b> · ' + esc_(d.ul) + ' · ' + esc_(d.titre) + ' · pour le ' + dateFr_(d.echeance) + ' · ' + esc_(labelStatut_(d.statut)) + ' · ' + (d.responsable ? esc_(nomDe_(d.responsable)) : '<i>non attribuée</i>');
  const corps = '<p><b>' + semaine + '</b> demande(s) reçue(s) et <b>' + closes + '</b> clôturée(s) ces 7 derniers jours.</p>' +
    h3_('En retard (' + retard.length + ')') + li(retard, ld) + h3_('Non attribuées (' + nonAttribuees.length + ')') + li(nonAttribuees, ld) +
    h3_('Autres demandes en cours (' + autres.length + ')') + li(autres, ld) +
    (presseActive ? h3_('Presse à suivre (' + presse.length + ')') + li(presse, p => esc_(p.media) + ' · ' + esc_(p.sujet) + (p.echeance ? ' · pour le ' + dateFr_(p.echeance) : '')) : '') +
    h3_('Au calendrier dans les 15 jours') + li(agenda, x => '<b>' + dateFr_(x.date) + '</b> · ' + esc_(x.categorie) + ' · ' + esc_(x.titre) + (x.ul ? ' · ' + esc_(x.ul) : ''));
  destinatairesEquipe_().forEach(dest => mailModele_(dest, 'point_hebdo', { date: dateFr_(aujourdhui_()) }, corps + bouton_('Ouvrir le ' + c.identite.nom_centre, lienPour_(dest))));
}

function destinatairesEquipe_() {
  const c = config_();
  const liste = String(c.notifications.emails_equipe || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(s => s.indexOf('@') > 0);
  if (liste.length) return liste;
  return DB.tout('utilisateurs').filter(x => { const r = role_(x.role); return String(x.actif).toUpperCase() !== 'NON' && (r === 'admin' || ((c.roles[r] || {}).permissions || []).indexOf('demande_traiter') > -1); }).map(x => x.email);
}

// =====================================================================
// 16. INSTALLATION ET MISE À JOUR (sans risque si relancée : rien n'est écrasé)
// =====================================================================
function installer() {
  reserveProprietaire_();
  // Maintenance : la base a pu être modifiée à la main (onglets, lignes) → aucune copie en cache n'est réutilisée
  try { DB.relire(); cacheInvalider_('idx_photos'); CacheService.getScriptCache().remove('onglets_photos'); CacheService.getScriptCache().remove('onglets_materiel'); } catch (e) { }
  const props = PropertiesService.getScriptProperties();
  let ss = null;
  const id = props.getProperty('BASE_ID');
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  let initiale = {};
  try { initiale = JSON.parse(HtmlService.createHtmlOutputFromFile('ConfigInitiale').getContent()); } catch (e) { console.log('ConfigInitiale absente ou illisible : valeurs génériques utilisées.'); }
  const nomCentre = ((initiale.config || {}).identite || {}).nom_centre || 'Centre Com';
  const nouvelle = !ss;
  if (!ss) { ss = SpreadsheetApp.create(nomCentre + ' — Base de données'); props.setProperty('BASE_ID', ss.getId()); }
  ss.setSpreadsheetTimeZone('Europe/Paris');
  Object.keys(TABLES).forEach(k => {
    const t = TABLES[k];
    let sh = ss.getSheetByName(t.onglet);
    if (!sh) {
      sh = ss.insertSheet(t.onglet);
      grille_(sh, 1, t.cols.length);
      sh.getRange(1, 1, sh.getMaxRows(), t.cols.length).setNumberFormat('@');
      sh.getRange(1, 1, 1, t.cols.length).setValues([t.cols]).setFontWeight('bold').setBackground('#e30613').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    } else {
      // Mise à jour de structure : ajoute les colonnes nouvelles en fin de tableau (données conservées)
      const ent = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getDisplayValues()[0];
      if (ent.join('|') !== t.cols.join('|') && t.cols.slice(0, ent.length).join('|') === ent.join('|')) {
        grille_(sh, 1, t.cols.length);
        sh.getRange(1, 1, sh.getMaxRows(), t.cols.length).setNumberFormat('@');
        sh.getRange(1, 1, 1, t.cols.length).setValues([t.cols]).setFontWeight('bold').setBackground('#e30613').setFontColor('#ffffff');
      }
    }
  });
  const def = ss.getSheetByName('Feuille 1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) ss.deleteSheet(def);

  // Rôles de la version 2 → version 3
  const us = DB.tout('utilisateurs');
  if (us.some(u => ALIAS_ROLES[u.role])) DB.remplacer('utilisateurs', us.map(u => Object.assign({}, u, { role: role_(u.role) })));

  const t = initiale.tables || {};
  if (!DB.tout('types').length) DB.remplacer('types', (t.types || TYPES_DEFAUT.map(x => ({ code: x[0], libelle: x[1], description: x[2], delai: x[3], champs: x[4], obligatoires: x[5], pole: x[6] }))).map((x, i) => Object.assign({ ordre: i + 1, actif: 'OUI' }, x)));
  if (!DB.tout('ul').length) DB.remplacer('ul', (t.ul || [{ nom: 'Délégation territoriale', actif: 'OUI' }]));
  if (!DB.tout('ressources').length) DB.remplacer('ressources', (t.ressources || RESSOURCES_DEFAUT.map(x => ({ rubrique: x[0], titre: x[1], description: x[2], url: '', statut: 'À jour', version: '', important: '' }))).map((x, i) => Object.assign({ ordre: i + 1, type: 'lien', etat: 'publiee', permission: 'ressources_voir', cree_le: maintenant_() }, x)));
  assurerIdsRessources_();
  try { faqLignes_(); } catch (e) { console.log('FAQ initiale : ' + e); }

  const moi = (Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (moi && !DB.trouver('utilisateurs', 'email', moi)) DB.ajouter('utilisateurs', { email: moi, nom: '', role: 'admin', ul: '', actif: 'OUI', token: nouveauJeton_(), cree_le: maintenant_(), derniere_visite: '' });

  // Configuration : première installation, ou mise à niveau (les nouveaux réglages prennent leur valeur par défaut)
  if (!DB.tout('configuration').length) {
    const ini = initiale.config || {};
    const mi = migrer_(ini), cfg = fusion_(CONFIG_DEFAUT, Object.assign({}, mi, { roles: {} })); cfg.roles = avecRoles_(mi);
    // Dossiers de secours avant l'arborescence (pour que la première sauvegarde réussisse)
    DB.remplacer('configuration', [{ cle: 'config', valeur: JSON.stringify(normaliser_(cfg)) }]); _CFG = null;
  } else {
    _CFG = null;
  }

  // Drive : arborescence standard (dans le dossier indiqué par ConfigInitiale, sinon à côté de la base)
  const cfgActuelle = config_();
  const legacy = PropertiesService.getScriptProperties().getProperty('DOSSIER_SAUVEGARDES');
  if (!cfgActuelle.drive.racine && !legacy) {
    let racineId = idDepuisLien_(((initiale.config || {}).drive || {}).racine);
    if (!racineId) {
      const parents = DriveApp.getFileById(ss.getId()).getParents();
      const parent = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
      const it = parent.getFoldersByName(nomCentre);
      racineId = (it.hasNext() ? it.next() : parent.createFolder(nomCentre)).getId();
    }
    creerArborescence_(racineId, nouvelle, 'installation');
  } else if (!cfgActuelle.drive.fichiers_demandes && legacy) {
    const cfg = JSON.parse(JSON.stringify(cfgActuelle));
    cfg.drive.fichiers_demandes = PropertiesService.getScriptProperties().getProperty('DOSSIER_FICHIERS') || '';
    cfg.drive.sauvegardes = legacy;
    enregistrerConfig_(cfg, 'installation', 'Mise à niveau 3.0 : dossiers de la version 2 repris');
  } else {
    enregistrerConfig_(JSON.parse(JSON.stringify(cfgActuelle)), 'installation', 'Mise à niveau ' + VERSION_CODE);
    // Nouveaux dossiers de la version (ex. « Photos de profil », « 07 - Presse ») : créés s'ils manquent, rien n'est écrasé
    try { if (config_().drive.racine) { const r = reparerDrive_('', 'installation', false); console.log('Drive : créés ' + (r.crees.join(', ') || 'aucun') + ' ; reliés ' + (r.relies.join(', ') || 'aucun')); } } catch (e) { console.log('Drive non complété : ' + (e && e.message || e)); }
  }

  // Migration 3.7 : retrait des anciennes données de démonstration (copie de la base avant, voir section 17)
  try { const m = retirerAncienneDemo_(moi); if (m.retires) console.log('Données de démonstration retirées : ' + m.retires + ' ; copie de la base avant retrait : ' + m.copie); } catch (e) { console.log('Retrait des données de démonstration non effectué : ' + (e && e.message || e)); }

  ScriptApp.getProjectTriggers().forEach(tr => { if (tr.getHandlerFunction() === 'routineQuotidienne') ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger('routineQuotidienne').timeBased().everyDays(1).atHour(Number(config_().notifications.heure_routine) || 7).inTimezone('Europe/Paris').create();
  // 3.11 : modification faite à la main dans la base (Google Sheets) → copie en cache de l'onglet aussitôt périmée
  ScriptApp.getProjectTriggers().forEach(tr => { if (tr.getHandlerFunction() === 'surModificationBase') ScriptApp.deleteTrigger(tr); });
  try { ScriptApp.newTrigger('surModificationBase').forSpreadsheet(ss).onEdit().create(); ScriptApp.newTrigger('surModificationBase').forSpreadsheet(ss).onChange().create(); }
  catch (e) { console.log('Déclencheur de modification de la base non créé : ' + (e && e.message || e)); }
  journalSecu_(moi, 'installation', 'Version ' + VERSION_CODE);

  console.log('Installation terminée. Base de données : ' + ss.getUrl());
  console.log('Dossier principal : ' + lienDossier_('racine'));
  // Étape suivante : mise à jour (déploiement déjà existant) ou toute première installation — jamais un second déploiement
  let dejaDeploye = ''; try { dejaDeploye = urlOfficielle_(); } catch (e) { }
  if (dejaDeploye) console.log('MISE À JOUR — Étape suivante : Déployer > Gérer les déploiements > sélectionnez le déploiement « Application Web » officiel > crayon (Modifier) > Version : « Nouvelle version » > Déployer. L\'adresse ne change pas. N\'utilisez PAS « Nouveau déploiement » (cela créerait une seconde adresse).');
  else console.log('PREMIÈRE INSTALLATION — Étape suivante : Déployer > Nouveau déploiement > Application Web (une seule fois dans la vie du Centre Com), puis Paramètres du projet > Propriétés du script > URL_OFFICIELLE = l\'adresse /exec obtenue, puis exécuter envoyerMonLien().');
}

// Envoie à la personne qui exécute la fonction son lien administrateur (et lui rend le rôle administrateur)
function envoyerMonLien() {
  reserveProprietaire_();
  const moi = Session.getEffectiveUser().getEmail().toLowerCase();
  const u = assurerUtilisateur_(moi, '');
  if (role_(u.role) !== 'admin' || u.actif === 'NON') DB.modifier('utilisateurs', 'email', moi, { role: 'admin', actif: 'OUI' });
  const lien = config_().securite.mode === 'google' ? urlApp_('') : urlApp_(nouveauCode_(moi));
  console.log('Lien de connexion administrateur (usage unique, ' + config_().securite.lien_validite_min + ' min) : ' + lien);
  mailModele_(moi, 'lien_acces', { validite: config_().securite.lien_validite_min }, bouton_('Se connecter au ' + config_().identite.nom_centre, lien));
  journalSecu_(moi, 'acces_administrateur', 'Lien administrateur envoyé depuis l\'éditeur');
}

// Secours : si plus aucun administrateur ne peut se connecter (exécuté par le propriétaire du projet)
function reinitialiserAdministrateur() { envoyerMonLien(); }

// =====================================================================
// 17. MIGRATION 3.7 : retrait des anciennes données de démonstration (une seule fois, par installer())
// Le mode démo n'existe plus. Si des données fictives avaient été chargées dans la base RÉELLE, elles sont
// retirées après une copie complète de la base (récupération possible). Ne sont visées QUE les données créées
// par l'ancienne fonction de démonstration : demandes DEMO-0NN, presse PDEMO…, calendrier CDEMO…, historique
// de ces demandes, comptes @demo.invalid. Les vraies données ne sont jamais touchées.
// =====================================================================
const ANCIENNE_DEMO = {
  demandes: d => /^DEMO-0\d{2}$/.test(d.id), historique: h => /^DEMO-0\d{2}$/.test(h.demande_id), presse: p => /^PDEMO\d+$/.test(p.id),
  calendrier: x => /^CDEMO\d+$/.test(x.id), utilisateurs: x => /@demo\.invalid$/i.test(String(x.email)),
};
function compterAncienneDemo_() { return Object.keys(ANCIENNE_DEMO).reduce((n, t) => n + DB.tout(t).filter(ANCIENNE_DEMO[t]).length, 0); }
function retirerAncienneDemo_(auteur) {
  DB.relire();
  const n = compterAncienneDemo_();
  if (!n) return { retires: 0, copie: '' };
  // 1. Copie complète de la base AVANT toute suppression (dans « Sauvegardes » si disponible, sinon à côté de la base)
  const base = DriveApp.getFileById(idBase_());
  const nom = base.getName() + ' — copie avant retrait des données de démonstration (' + Utilities.formatDate(new Date(), 'Europe/Paris', 'dd-MM-yyyy HH:mm') + ')';
  let copie = null;
  try { if (fonctionOk_('sauvegardes')) copie = base.makeCopy(nom, dossier_('sauvegardes')); } catch (e) { copie = null; }
  if (!copie) { const p = base.getParents(); copie = p.hasNext() ? base.makeCopy(nom, p.next()) : base.makeCopy(nom); }
  // 2. Retrait des seules données de démonstration
  Object.keys(ANCIENNE_DEMO).forEach(t => { const tout = DB.tout(t), garder = tout.filter(x => !ANCIENNE_DEMO[t](x)); if (garder.length !== tout.length) DB.remplacer(t, garder.map(x => { const o = Object.assign({}, x); delete o._ligne; return o; })); });
  DB.relire();
  const reste = compterAncienneDemo_();
  PropertiesService.getScriptProperties().setProperty('MIGRATION_SANS_DEMO', JSON.stringify({ le: maintenant_(), retires: n - reste, copie: copie.getId() }));
  journalSecu_(auteur || '', 'migration', 'Mode démo supprimé : ' + (n - reste) + ' élément(s) de démonstration retiré(s) ; copie de la base avant retrait : ' + copie.getName());
  return { retires: n - reste, copie: copie.getUrl() };
}

/**
 * CONTRÔLE DE L'INSTALLATION RÉELLE — à exécuter depuis l'éditeur Apps Script (propriétaire du projet).
 * Vérifie, DANS Apps Script : version, base, onglets, configuration, déclencheur, Drive, administrateurs,
 * cohérence App.html ↔ Code.gs (chaque fonction appelée par google.script.run existe et est publique),
 * fichiers inclus par Index, absence de données de démonstration. Résultat dans le journal d'exécution.
 */
function controlerInstallation() {
  reserveProprietaire_();
  const R = [], ok = (t, v, d) => { R.push((v ? 'OK      ' : 'À REVOIR') + ' | ' + t + (d ? ' — ' + d : '')); return v; };
  ok('Version du code (Code.gs)', true, VERSION_CODE);
  let url = urlOfficielle_();
  ok('Application web déployée', !!url, url || 'aucun déploiement « Application Web »');
  const urlProp = urlProprieteOfficielle_();
  ok('Adresse officielle unique (propriété URL_OFFICIELLE)', MOTIF_URL_EXEC.test(urlProp), urlProp ? (MOTIF_URL_EXEC.test(urlProp) ? urlProp : 'format invalide : ' + urlProp) : 'absente : Paramètres du projet > Propriétés du script > URL_OFFICIELLE = adresse /exec du déploiement partagé');
  let base = null; try { base = SpreadsheetApp.openById(idBase_()); } catch (e) { }
  if (ok('Base de données accessible', !!base, base ? base.getName() : 'exécutez installer()')) {
    Object.keys(TABLES).forEach(k => { const sh = base.getSheetByName(TABLES[k].onglet); const ent = sh ? sh.getRange(1, 1, 1, TABLES[k].cols.length).getDisplayValues()[0].join('|') : ''; ok('Onglet « ' + TABLES[k].onglet + ' »', ent === TABLES[k].cols.join('|'), sh ? (ent === TABLES[k].cols.join('|') ? '' : 'colonnes à mettre à jour : exécutez installer()') : 'absent : exécutez installer()'); });
  }
  let v = null; try { v = validerConfig_(config_()); } catch (e) { }
  ok('Configuration valide', !!v && !v.erreurs.length, v ? v.erreurs.join(' ; ') : 'illisible');
  ok('Déclencheur quotidien (routineQuotidienne)', ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'routineQuotidienne'), '');
  ok('Déclencheur « modification de la base » (surModificationBase)', ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'surModificationBase'), 'relancer installer() : sans lui, une saisie faite à la main dans la base apparaît sous 2 à 10 minutes');
  const F = etatFonctions_(true); Object.keys(F).forEach(k => ok('Fonction « ' + F[k].titre + ' »', F[k].etat === 'ok', F[k].etat));
  const admins = DB.tout('utilisateurs').filter(x => role_(x.role) === 'admin' && etatAcces_(x) === 'ok').length;
  ok('Administrateurs actifs', admins >= 1, admins + ' (conseil : au moins 2)');
  // Cohérence interface ↔ serveur : exactement ce que fera google.script.run dans l'application déployée
  const app = HtmlService.createHtmlOutputFromFile('App').getContent();
  const vApp = (app.match(/const VERSION_APP = '([^']+)'/) || [])[1] || '';
  ok('Version de l\'interface (App) identique à Code.gs', vApp === VERSION_CODE, 'App ' + (vApp || '?') + ' / Code.gs ' + VERSION_CODE);
  const appels = {};
  (app.match(/api\('(api_\w+)'/g) || []).forEach(m => appels[m.slice(5, -1)] = 1);
  (app.match(/\.(api_\w+)\(/g) || []).forEach(m => appels[m.slice(1, -1)] = 1);
  const global = globalThis;   // V8 : les fonctions des fichiers .gs sont des globales
  const manquantes = Object.keys(appels).filter(f => typeof global[f] !== 'function' || /_$/.test(f));
  ok('Fonctions serveur appelées par l\'interface (' + Object.keys(appels).length + ')', !manquantes.length, manquantes.length ? 'absentes : ' + manquantes.join(', ') : 'toutes présentes');
  const index = HtmlService.createHtmlOutputFromFile('Index').getContent();
  ok('Index inclut Styles et App', /include\('Styles'\)/.test(index) && /include\('App'\)/.test(index), '');
  ok('Fichier ConfigInitiale lisible', (function () { try { JSON.parse(HtmlService.createHtmlOutputFromFile('ConfigInitiale').getContent()); return true; } catch (e) { return false; } })(), '');
  const demo = compterAncienneDemo_();
  ok('Aucune donnée de démonstration', !demo, demo ? demo + ' élément(s) : exécutez installer()' : '');
  console.log('CONTRÔLE DE L\'INSTALLATION — Centre Com ' + VERSION_CODE + '\n' + R.join('\n'));
  return R;
}

// =====================================================================
// 18. COUCHE DE DONNÉES (Google Sheets)
// =====================================================================
function idBase_() {
  const id = PropertiesService.getScriptProperties().getProperty('BASE_ID');
  if (!id) throw Oups_('L\'application n\'est pas encore installée : l\'administrateur doit exécuter installer().');
  return id;
}

// Tables lues très souvent et modifiées rarement : gardées en cache serveur entre deux appels (CacheService, 10 min au
// plus). Toute écriture par ce module change la « version » de la table : une copie périmée n'est jamais relue.
// Une modification relit d'abord la ligne réelle dans la base (jamais d'écriture à partir d'une copie en cache).
// 3.29 : copies gardées plus longtemps — chaque écriture de l'application (DB.change_) et chaque modification à la main dans le
// classeur (déclencheur surModificationBase) les déclarent périmées ; la durée ne sert qu'en dernier recours.
const TABLES_CACHE = { utilisateurs: 1800, types: 21600, ul: 21600, ressources: 21600, faq: 21600, calendrier: 21600, albums: 21600, demandes: 3600, presse: 21600, materiel: 21600, materiel_photos: 21600, reservations: 3600, notifications: 600, pieces: 21600, projets: 21600, diffusions: 21600 };
const CACHE_MAX_OCTETS = 900000, CACHE_MORCEAU = 32000;   // morceaux ≤ 96 Ko même si chaque caractère occupe 3 octets (limite Google : 100 Ko par valeur)
function versionCache_(cle, nouvelle) {
  const c = CacheService.getScriptCache(), k = 'ver_' + cle;
  let v = nouvelle ? '' : c.get(k);
  if (!v) { v = Date.now().toString(36) + Math.random().toString(36).slice(2, 6); try { c.put(k, v, 21600); } catch (e) { } }
  return v;
}
function cacheLire_(cle, ttl, fabrique) {
  const c = CacheService.getScriptCache();
  let v = '';
  try {
    v = versionCache_(cle);
    const n = Number(c.get('cnb_' + cle + '_' + v) || 0);
    if (n > 0) {
      const ks = []; for (let i = 0; i < n; i++) ks.push('cmo_' + cle + '_' + v + '_' + i);
      const m = c.getAll(ks);
      if (ks.every(k => m[k] != null)) return JSON.parse(ks.map(k => m[k]).join(''));
    }
  } catch (e) { }
  const val = fabrique();
  try {
    const t = JSON.stringify(val);
    if (v && t.length <= CACHE_MAX_OCTETS) {
      // Morceaux coupés sans jamais séparer les deux moitiés d'un caractère hors BMP (émoji…)
      const o = {}; let n = 0, i = 0;
      while (i < t.length) { let f = Math.min(t.length, i + CACHE_MORCEAU); const k = t.charCodeAt(f - 1); if (f < t.length && k >= 0xD800 && k <= 0xDBFF) f--; o['cmo_' + cle + '_' + v + '_' + n] = t.slice(i, f); n++; i = f; }
      if (!n) { o['cmo_' + cle + '_' + v + '_0'] = ''; n = 1; }
      c.putAll(o, ttl); c.put('cnb_' + cle + '_' + v, String(n), ttl);
    }
  } catch (e) { }
  return val;
}
function cacheInvalider_(cle) {
  try { versionCache_(cle, true); }
  catch (e) { try { CacheService.getScriptCache().remove('ver_' + cle); } catch (e2) { } }   // sans clé de version, la copie suivante est refaite
}
// Déclencheur (installé par installer()) : une saisie, une suppression de ligne ou d'onglet faite à la main dans la base
// rend aussitôt périmée la copie en cache. Sans effet sur les données (aucune lecture ni écriture de la base).
function surModificationBase(e) {
  if (!e || typeof e !== 'object' || !e.triggerUid) return false;
  // Seul un déclencheur réellement installé dans le projet est accepté (identifiant inconnu du navigateur)
  try { if (!ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'surModificationBase' && String(t.getUniqueId()) === String(e.triggerUid))) return false; } catch (x) { return false; }
  let nom = '';
  try { if (e && e.range && e.changeType === undefined) nom = e.range.getSheet().getName(); } catch (x) { }
  Object.keys(TABLES).forEach(t => { if (!nom || TABLES[t].onglet === nom) DB.change_(t); });
  try { CacheService.getScriptCache().remove('onglets_photos'); CacheService.getScriptCache().remove('onglets_materiel'); } catch (x) { }
  return true;
}

const DB = {
  _ss: null, _cache: {},
  ss() { if (!this._ss) this._ss = SpreadsheetApp.openById(idBase_()); return this._ss; },
  feuille(table) {
    let sh = this.ss().getSheetByName(TABLES[table].onglet);
    // Onglets créés à la volée (photothèque, albums, favoris, FAQ) : recréés s'ils ont été supprimés, même si la
    // vérification mise en cache (6 h) les croyait présents
    if (!sh && ONGLETS_A_LA_VOLEE.indexOf(table) > -1) { assurerOnglet_(table); sh = this.ss().getSheetByName(TABLES[table].onglet); }
    if (!sh) throw Oups_('L\'onglet « ' + TABLES[table].onglet + ' » a été supprimé ou renommé dans la base. L\'administrateur doit relancer installer().');
    return sh;
  },
  lire_(table) {
    const sh = this.feuille(table), cols = TABLES[table].cols, n = sh.getLastRow() - 1;
    if (n < 1) return [];
    const out = [];
    sh.getRange(2, 1, n, cols.length).getDisplayValues().forEach((r, i) => {
      if (!r.some(v => v !== '')) return;
      const o = { _ligne: i + 2 }; cols.forEach((c, j) => o[c] = r[j]); out.push(o);
    });
    return out;
  },
  tout(table) {
    if (this._cache[table]) return this._cache[table];
    if (this._direct && TABLES_CACHE[table]) cacheInvalider_('tbl_' + table);   // relecture demandée : la copie partagée est refaite
    return (this._cache[table] = TABLES_CACHE[table] ? cacheLire_('tbl_' + table, TABLES_CACHE[table], () => this.lire_(table)) : this.lire_(table));
  },
  // Avant une écriture qui s'appuie sur le contenu actuel (sous verrou) : la suite de l'appel relit la base elle-même,
  // jamais la copie en cache (même garantie qu'avant la 3.11, y compris après une saisie faite à la main)
  _direct: false,
  relire() { this._cache = {}; this._direct = true; },
  // Après une écriture : copie de cet appel tenue à jour, copie partagée (cache serveur) déclarée périmée
  change_(table) { if (TABLES_CACHE[table]) cacheInvalider_('tbl_' + table); if (table === 'phototheque') { cacheInvalider_('idx_photos'); delete this._cache.idx_photos; } },
  trouver(table, cle, val) { return this.tout(table).find(o => o[cle] === val) || null; },
  // Une seule colonne lue dans la base (ex. empreintes des photos) : bien plus léger que toute la table
  colonne(table, cle) {
    if (this._cache[table]) return this._cache[table].map(o => o[cle]);
    const sh = this.feuille(table), n = sh.getLastRow() - 1, j = TABLES[table].cols.indexOf(cle);
    return n < 1 || j < 0 ? [] : sh.getRange(2, j + 1, n, 1).getDisplayValues().map(r => r[0]);
  },
  // Lignes d'une même valeur de clé (ex. échanges d'une demande) : la colonne de la clé, puis le seul bloc de lignes concerné
  lignesOu(table, cle, val) {
    if (this._cache[table]) return this._cache[table].filter(o => o[cle] === val);
    const sh = this.feuille(table), cols = TABLES[table].cols, n = sh.getLastRow() - 1, j = cols.indexOf(cle);
    if (n < 1 || j < 0 || val === '' || val == null) return [];
    const col = sh.getRange(2, j + 1, n, 1).getDisplayValues();
    // Lignes trouvées regroupées en blocs proches (écart < 40 lignes) : une demande ancienne commentée récemment ne fait plus
    // lire tout l'intervalle entre ses premiers et ses derniers échanges (3.29). Un accès au classeur compte comme ~2 000
    // cellules : les blocs ne sont lus séparément que s'ils coûtent moins que l'intervalle complet.
    const pos = []; for (let i = 0; i < col.length; i++) if (col[i][0] === val) pos.push(i);
    if (!pos.length) return [];
    let blocs = []; pos.forEach(i => { const z = blocs[blocs.length - 1]; if (z && i - z[1] < 40) z[1] = i; else blocs.push([i, i]); });
    const coutBlocs = blocs.reduce((t, z) => t + 2000 + (z[1] - z[0] + 1) * cols.length, 0), coutTout = 2000 + (pos[pos.length - 1] - pos[0] + 1) * cols.length;
    if (blocs.length > 1 && coutBlocs >= coutTout) blocs = [[pos[0], pos[pos.length - 1]]];
    const out = [];
    blocs.forEach(z => sh.getRange(z[0] + 2, 1, z[1] - z[0] + 1, cols.length).getDisplayValues().forEach((r, k) => { if (r[j] !== val) return; const o = { _ligne: z[0] + k + 2 }; cols.forEach((c, m) => o[c] = r[m]); out.push(o); }));
    return out;
  },
  // Dernières lignes d'une table écrite dans l'ordre (historique) : sans lire toute la table
  dernieres(table, nb) {
    if (this._cache[table]) return this._cache[table].slice(-nb);
    const sh = this.feuille(table), cols = TABLES[table].cols, n = sh.getLastRow() - 1;
    if (n < 1) return [];
    const a = Math.max(0, n - nb), out = [];
    sh.getRange(a + 2, 1, n - a, cols.length).getDisplayValues().forEach((r, k) => { if (!r.some(v => v !== '')) return; const o = { _ligne: a + k + 2 }; cols.forEach((c, m) => o[c] = r[m]); out.push(o); });
    return out;
  },
  // Plusieurs lignes en une écriture
  ajouterPlusieurs(table, objs) {
    if (!objs.length) return;
    const cols = TABLES[table].cols, sh = this.feuille(table), ligne = sh.getLastRow() + 1;
    const lignes = objs.map(o => cols.map(c => o[c] == null ? '' : String(o[c])));
    grille_(sh, ligne + lignes.length - 1, cols.length);
    sh.getRange(ligne, 1, lignes.length, cols.length).setNumberFormat('@').setValues(lignes);
    if (this._cache[table]) lignes.forEach((l, i) => { const o = { _ligne: ligne + i }; cols.forEach((c, k) => o[c] = l[k]); this._cache[table].push(o); });
    this.change_(table);
  },
  // Une seule ligne (colonne de la clé, puis la ligne trouvée) : évite de lire toute une grande table pour consulter une fiche
  ligne(table, cle, val) {
    if (this._cache[table]) return this.trouver(table, cle, val);
    const sh = this.feuille(table), cols = TABLES[table].cols, n = sh.getLastRow() - 1, j = cols.indexOf(cle);
    if (n < 1 || j < 0 || val === '' || val == null) return null;
    const col = sh.getRange(2, j + 1, n, 1).getDisplayValues();
    for (let i = 0; i < col.length; i++) if (col[i][0] === val) { const r = sh.getRange(i + 2, 1, 1, cols.length).getDisplayValues()[0], o = { _ligne: i + 2 }; cols.forEach((c, k) => o[c] = r[k]); return o; }
    return null;
  },
  ajouter(table, obj) {
    const cols = TABLES[table].cols, sh = this.feuille(table), ligne = sh.getLastRow() + 1;
    grille_(sh, ligne, cols.length);
    sh.getRange(ligne, 1, 1, cols.length).setNumberFormat('@').setValues([cols.map(c => obj[c] == null ? '' : String(obj[c]))]);
    if (this._cache[table]) { const o = { _ligne: ligne }; cols.forEach(c => o[c] = obj[c] == null ? '' : String(obj[c])); this._cache[table].push(o); }
    this.change_(table); return obj;
  },
  modifier(table, cle, val, patch, discret) {
    let o = this.trouver(table, cle, val);
    const cols = TABLES[table].cols, sh = this.feuille(table), j = cols.indexOf(cle);
    // Ligne relue dans la base : si elle a bougé (suppression, modification à la main), la table est relue
    let reel = o ? sh.getRange(o._ligne, 1, 1, cols.length).getDisplayValues()[0] : null;
    if (!reel || reel[j] !== String(val)) { delete this._cache[table]; this.change_(table); this._cache[table] = this.lire_(table); o = this.trouver(table, cle, val); reel = o ? cols.map(c => o[c]) : null; }
    if (!o) throw Oups_('Élément introuvable : ' + val + '. Il a peut-être été supprimé.');
    const ligne = cols.map((c, k) => patch[c] !== undefined ? String(patch[c] == null ? '' : patch[c]) : reel[k]);
    sh.getRange(o._ligne, 1, 1, cols.length).setNumberFormat('@').setValues([ligne]);
    // Copie de l'appel : la ligne est REMPLACÉE par un nouvel objet (un objet lu avant l'écriture garde ses anciennes valeurs,
    // comme avant l'optimisation : ex. ancienne photo de profil à mettre à la corbeille après le remplacement)
    const t = this._cache[table], nv = { _ligne: o._ligne }; cols.forEach((c, k) => nv[c] = ligne[k]);
    if (t) { const i = t.indexOf(o); if (i > -1) t[i] = nv; }
    if (!discret) this.change_(table);   // discret : horodatage d'activité seulement (la copie partagée peut l'ignorer)
  },
  supprimer(table, cle, val) {
    const o = this.trouver(table, cle, val); if (!o) return;
    const sh = this.feuille(table), j = TABLES[table].cols.indexOf(cle);
    if (sh.getRange(o._ligne, j + 1).getDisplayValues()[0][0] !== String(val)) { delete this._cache[table]; this.change_(table); const x = this.trouver(table, cle, val); if (x) sh.deleteRow(x._ligne); delete this._cache[table]; this.change_(table); return; }
    sh.deleteRow(o._ligne);
    const t = this._cache[table]; if (t) { t.splice(t.indexOf(o), 1); t.forEach(x => { if (x._ligne > o._ligne) x._ligne--; }); }
    this.change_(table);
  },
  remplacer(table, lignes) {
    const cols = TABLES[table].cols, sh = this.feuille(table), n = sh.getLastRow() - 1;
    grille_(sh, Math.max(n, lignes.length) + 1, cols.length);
    if (n > 0) sh.getRange(2, 1, n, cols.length).clearContent();
    if (lignes.length) sh.getRange(2, 1, lignes.length, cols.length).setNumberFormat('@').setValues(lignes.map(l => cols.map(c => l[c] == null ? '' : String(l[c]))));
    delete this._cache[table]; this.change_(table);
  },
};

// =====================================================================
// 19. OUTILS
// =====================================================================
function prochainNumero_() {
  const props = PropertiesService.getScriptProperties();
  const an = Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy');
  const cle = 'COMPTEUR_' + an;
  const n = Number(props.getProperty(cle) || 0) + 1;
  props.setProperty(cle, String(n));
  return config_().identite.code + '-' + an + '-' + ('000' + n).slice(-3);
}
function journal_(demandeId, u, type, message, interne) {
  DB.ajouter('historique', { id: 'H' + Utilities.getUuid().slice(0, 8), demande_id: demandeId, date: maintenant_(), auteur: u.email, auteur_nom: u.nom || '', type: type, message: message, interne: interne ? 'OUI' : '' });
}
function maintenant_() { return Utilities.formatDate(new Date(), 'Europe/Paris', "yyyy-MM-dd'T'HH:mm:ss"); }
function aujourdhui_() { return Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd'); }
function isoJour_(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
function dateDe_(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
function joursAvant_(s) { const d = dateDe_(s); if (!d) return null; return Math.round((d - dateDe_(aujourdhui_())) / 864e5); }
function joursDepuis_(s) { const j = joursAvant_(s); return j === null ? 9999 : -j; }
function dateFr_(s) { const d = dateDe_(s); return d ? Utilities.formatDate(d, 'Europe/Paris', 'dd/MM/yyyy') : ''; }
function prenom_(nom) { return String(nom || '').trim().split(/\s+/)[0] || ''; }
function iconePriorite_(p) { return p === 'urgente' ? '🔴' : p === 'courte' ? '🟠' : '🟢'; }
function libellePriorite_(p) { return iconePriorite_(p) + ' ' + (config_().demandes.priorites[p] || p); }
function nomDe_(email) { if (!email) return ''; const u = DB.trouver('utilisateurs', 'email', email); return (u && u.nom) || email; }
function esc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\n/g, '<br>'); }

// Variables utilisables dans les modèles d'e-mails : {prenom} {numero} {titre} …
function variablesDemande_(d, extra) {
  const t = typesActifs_().find(x => x.code === d.type);
  return Object.assign({ prenom: prenom_(d.demandeur_nom), numero: d.id, titre: d.titre, type: t ? t.libelle : d.type, ul: d.ul, echeance: dateFr_(d.echeance),
    responsable: nomDe_(d.responsable) || 'L\'équipe communication', demandeur: d.demandeur_nom || d.demandeur_email, statut: labelStatut_(d.statut) }, extra || {});
}
function remplir_(modele, v) {
  const base = { nom_centre: config_().identite.nom_centre, code: config_().identite.code, date: dateFr_(aujourdhui_()) };
  return String(modele || '').replace(/\{(\w+)\}/g, (m, k) => (v && v[k] !== undefined) ? String(v[k]) : (base[k] !== undefined ? base[k] : m));
}

// =====================================================================
// FICHIERS PARTOUT (3.16) : un seul système pour joindre un fichier là où l'on peut mettre un lien
// Registre « Pièces jointes » (identifiant interne J-…) ; fichier rangé dans le Drive partagé (dossier de la demande, dossier Presse) ;
// droits de lecture et d'ajout donnés par le contexte, vérifiés à CHAQUE accès ; le navigateur ne reçoit jamais d'identifiant Drive.
// =====================================================================
const CONTEXTES_PJ = {
  demande: {
    fonction: 'fichiers_demandes', usages: ['joint', 'livrable', 'selection'],
    objet: ref => DB.trouver('demandes', 'id', String(ref || '')),
    voir: (u, d) => !!d && peutVoir_(u, d),
    ajouter: (u, d, usage) => !!d && peutVoir_(u, d) && (peut_(u, 'demande_traiter') || (usage === 'joint' && (d.demandeur_email === u.email || participants_(d).indexOf(u.email) > -1))),
    gerer: (u, d) => peut_(u, 'demande_traiter'),
    dossier: d => dossierDemande_(d),
  },
  diffusion: {
    fonction: 'fichiers_demandes', usages: ['joint'],
    objet: ref => diffusionsLignes_().find(x => x.id === String(ref || '')) || null,
    voir: (u, D) => diffusionVisible_(u, D),
    ajouter: (u, D) => !!D && peut_(u, 'diffusion_envoyer') && ['brouillon', 'programmee'].indexOf(D.statut) > -1,
    gerer: (u, D) => !!D && peut_(u, 'diffusion_envoyer') && ['brouillon', 'programmee'].indexOf(D.statut) > -1,
    dossier: D => sousDossier_(dossier_('fichiers_demandes'), 'Diffusions internes'),
  },
  presse: {
    fonction: 'fichiers_presse', usages: ['retombee', 'joint'],
    objet: ref => DB.trouver('presse', 'id', String(ref || '')),
    voir: (u, p) => !!p && peut_(u, 'presse'),
    ajouter: (u, p) => !!p && peut_(u, 'presse'),
    gerer: (u, p) => peut_(u, 'presse'),
    dossier: p => sousDossier_(dossier_('presse'), 'Retombées et pièces des sollicitations'),
  },
};
function piecesLignes_() { const c = CacheService.getScriptCache(); if (!c.get('onglet_pieces')) { assurerOnglet_('pieces'); try { c.put('onglet_pieces', '1', 21600); } catch (e) { } } return DB.tout('pieces'); }
// Contrôle commun d'un fichier envoyé : extension interdite refusée ; contenu conforme à l'extension pour les formats connus
function validerFichier_(fichier, maxMo) {
  fichier = fichier || {};
  const nom = nomFichier_(fichier.nom), ext = extension_(nom), oct = decoder64_(fichier.data);
  if (!oct.length) throw Oups_('Fichier vide.');
  if (oct.length > maxMo * 1048576) throw Oups_('Fichier trop lourd (' + maxMo + ' Mo maximum).');
  if (!ext || EXTENSIONS_INTERDITES.indexOf(ext) > -1) throw Oups_('Format de fichier non autorisé' + (ext ? ' (.' + ext + ')' : '') + '.');
  const def = TYPES_FICHIER[ext];
  if (def && !signatureOk_(oct, def[1])) throw Oups_('Le contenu du fichier ne correspond pas à son extension « .' + ext + ' ».');
  return { nom: nom, ext: ext, oct: oct, mime: def ? def[0] : (String(fichier.type || '').replace(/[^\w.+\/-]/g, '').slice(0, 100) || 'application/octet-stream') };
}
function piecePublique_(p, u, ctx, obj) {
  return { id: p.id, contexte: p.contexte, ref: p.ref, usage: p.usage, nom: p.nom, mime: p.mime, taille: Number(p.taille) || 0, ext: extension_(p.nom), le: p.le, par_nom: nomDe_(p.par),
    peut_retirer: !!u && (p.par === u.email || (ctx && ctx.gerer(u, obj))) };
}
function piecesDe_(u, contexte, ref) {
  const ctx = CONTEXTES_PJ[contexte], obj = ctx && ctx.objet(ref);
  if (!ctx || !ctx.voir(u, obj)) return [];
  return piecesLignes_().filter(p => p.contexte === contexte && p.ref === String(ref) && p.etat !== 'retiree').map(p => piecePublique_(p, u, ctx, obj));
}
// Cœur commun : enregistre le fichier dans le Drive partagé et dans le registre (droits vérifiés par l'appelant ou ici)
function joindre_(u, contexte, ref, usage, fichier) {
  const ctx = CONTEXTES_PJ[contexte]; if (!ctx) throw Oups_('Emplacement de fichier inconnu.');
  usage = ctx.usages.indexOf(usage) > -1 ? usage : ctx.usages[0];
  const obj = ctx.objet(ref);
  if (!ctx.ajouter(u, obj, usage)) throw Oups_(obj && ctx.voir(u, obj) ? 'Votre rôle ne permet pas d\'ajouter ce fichier ici.' : 'Cet élément n\'existe pas ou ne vous est pas accessible.');
  exigerFonction_(ctx.fonction);
  const v = validerFichier_(fichier, contexte === 'demande' ? 10 : config_().ressources.taille_max_mo);
  const id = 'J-' + Utilities.getUuid().replace(/-/g, '').slice(0, 14);
  const f = ecritureDrive_(ctx.fonction, () => ctx.dossier(obj).createFile(Utilities.newBlob(v.oct, v.mime, v.nom)));
  try { f.setDescription(MARQUE_APP + 'piece:' + id); } catch (e) { }
  const p = { id: id, contexte: contexte, ref: String(ref), usage: usage, fichier_id: f.getId(), nom: v.nom, mime: v.mime, taille: String(v.oct.length), par: u.email, le: maintenant_(), etat: '' };
  piecesLignes_(); DB.ajouter('pieces', p);
  if (contexte === 'demande') journal_(obj.id, u, 'fichier', ({ livrable: 'Livrable déposé : ', selection: 'Sélection d\'images ajoutée : ' }[usage] || 'Fichier ajouté : ') + v.nom, false);
  else journalSecu_(u.email, 'fichier_joint', contexte + ' ' + ref + ' · ' + v.nom);
  return { p: p, f: f, obj: obj, ctx: ctx };
}
function api_joindre(sid, contexte, ref, usage, fichier) {
  return appel_(sid, 'connecte', u => {
    const r = joindre_(u, String(contexte || ''), ref, String(usage || ''), fichier);
    if (r.p.contexte === 'demande') {
      const maj = { maj_le: maintenant_() };
      if (r.p.usage === 'livrable') { try { r.f.addViewer(r.obj.demandeur_email); } catch (e) { } maj.livrable_url = r.f.getUrl(); }
      DB.modifier('demandes', 'id', r.obj.id, maj);
    }
    return piecePublique_(r.p, u, r.ctx, r.obj);
  });
}
// Lecture : identifiant interne seulement ; droits du contexte revérifiés ; fichier encore présent dans le Drive
function lirePiece_(u, id) {
  const p = piecesLignes_().find(x => x.id === String(id || ''));
  const ctx = p && CONTEXTES_PJ[p.contexte], obj = ctx && ctx.objet(p.ref);
  if (!p || p.etat === 'retiree' || !ctx || !ctx.voir(u, obj)) { journalSecu_(u.email, 'refus_fichier', String(id || '').slice(0, 60)); throw Oups_('Ce fichier n\'existe pas ou ne vous est pas accessible.'); }
  let f = null; try { f = DriveApp.getFileById(p.fichier_id); if (f.isTrashed()) f = null; } catch (e) { f = null; }
  if (!f) throw Oups_(MESSAGES_FICHIER.introuvable);
  return { p: p, f: f, ctx: ctx, obj: obj };
}
function api_fichierJoint(sid, id) {
  return appel_(sid, 'connecte', u => {
    const x = lirePiece_(u, id), taille = x.f.getSize(), max = Math.max(config_().ressources.taille_max_mo, 10) * 1048576;
    if (taille > max) return { trop_gros: true, nom: x.p.nom, taille: taille };
    return { nom: x.p.nom, mime: x.p.mime, taille: taille, data: Utilities.base64Encode(octetsDe_(x.f)) };
  });
}
function api_apercuJoint(sid, id) {
  return appel_(sid, 'connecte', u => {
    const x = lirePiece_(u, id), cache = CacheService.getScriptCache(), cle = 'apercu_' + x.p.fichier_id;
    try { const deja = cache.get(cle); if (deja) return JSON.parse(deja); } catch (e) { }
    const v = vignetteDrive_(x.p.fichier_id, 1200);
    let oct = v.oct; if (!oct || !typeImage_(oct)) { oct = null; try { const b = x.f.getThumbnail(); if (b) oct = b.getBytes(); } catch (e) { } }
    const out = oct && typeImage_(oct) ? { image: 'data:' + typeImage_(oct) + ';base64,' + Utilities.base64Encode(oct), page: 1 } : { image: '' };
    if (v.certain || out.image) { try { const t = JSON.stringify(out); if (t.length < 95000) cache.put(cle, t, 21600); } catch (e) { } }
    return out;
  });
}
function api_retirerJoint(sid, id) {
  return appel_(sid, 'connecte', u => {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    let x;
    try {
      DB.relire();
      x = lirePiece_(u, id);
      if (x.p.par !== u.email && !x.ctx.gerer(u, x.obj)) throw Oups_('Seule la personne qui a ajouté ce fichier (ou l\'équipe) peut le retirer.');
      DB.modifier('pieces', 'id', x.p.id, { etat: 'retiree' });
      if (x.p.contexte === 'demande' && x.p.usage === 'livrable' && x.obj.livrable_url === x.f.getUrl()) DB.modifier('demandes', 'id', x.obj.id, { livrable_url: '' });
    } finally { try { SpreadsheetApp.flush(); } catch (e) { } lock.releaseLock(); }
    mettreCorbeille_(x.p.fichier_id);
    if (x.p.contexte === 'demande') journal_(x.obj.id, u, 'fichier', 'Fichier retiré : ' + x.p.nom, false);
    else journalSecu_(u.email, 'fichier_retire', x.p.contexte + ' ' + x.p.ref + ' · ' + x.p.nom);
    return true;
  });
}

// =====================================================================
// MODE UTILISATEUR POUR L'ADMINISTRATEUR (3.16)
// La SESSION (côté serveur) porte le rôle d'affichage : toutes les vérifications de droits s'appliquent à ce rôle, jamais plus.
// Le rôle réel du compte n'est jamais modifié ; seul un compte réellement administrateur peut l'activer ou l'arrêter.
// =====================================================================
function api_modeUtilisateur(sid, role) {
  return appel_(sid, 'connecte', u => {
    if ((u.role_reel || u.role) !== 'admin') throw Oups_('Le mode utilisateur est réservé aux administrateurs.');
    role = String(role || '');
    if (role && (!config_().roles[role] || role === ROLE_ADMIN)) throw Oups_('Rôle inconnu.');
    const cache = CacheService.getScriptCache(), cle = PREFIXE_SESSION + u.sid;
    const s = JSON.parse(cache.get(cle) || 'null'); if (!s) throw Oups_('Session expirée : reconnectez-vous.');
    if (role) s.m = role; else delete s.m;
    cache.put(cle, JSON.stringify(s), ttlSession_());
    journalSecu_(u.email, 'mode_utilisateur', role ? 'Activé : affichage en rôle « ' + libRole_(config_(), role) + ' » (droits réduits, compte inchangé)' : 'Arrêté : retour au mode administrateur');
    const id = identifier_(u.sid, { sansProlonger: true });
    return session_(id.u);
  });
}
// =====================================================================
// MON CENTRE COM (3.15) : favoris, brouillons de demande, préférences, personnes associées
// Tout est rangé dans la colonne « preferences » de la fiche utilisateur existante (JSON) et dans les demandes elles-mêmes.
// =====================================================================
function prefsBrutes_(u) { try { const p = JSON.parse((u && u.preferences) || '{}'); return p && typeof p === 'object' && !Array.isArray(p) ? p : {}; } catch (e) { return {}; } }
// Écriture d'une partie des préférences (sous verrou, relecture de la fiche) : les autres parties sont conservées
function majPrefs_(u, fn) {
  const lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    DB.relire();
    const x = DB.trouver('utilisateurs', 'email', u.email); if (!x) throw Oups_('Profil introuvable.');
    const p = prefsBrutes_(x), r = fn(p);
    const json = JSON.stringify(p);
    if (json.length > 45000) throw Oups_('Trop de brouillons ou de favoris enregistrés : supprimez-en quelques-uns.');
    if (json !== (x.preferences || '')) DB.modifier('utilisateurs', 'email', u.email, { preferences: json });
    u.preferences = json;
    return r;
  } finally { try { SpreadsheetApp.flush(); } catch (e) { } lock.releaseLock(); }
}
// Clé opaque d'un utilisateur (choisir une personne sans voir son adresse e-mail)
function cleUtilisateur_(email) { return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'cc:' + idBase_() + ':' + String(email || '').toLowerCase())).slice(0, 18); }

// ---------- Favoris : demandes, ressources, matériel (les photos gardent leurs favoris existants) ----------
// Architecture commune : un seul point d'entrée (api_favori), une seule liste « Mes favoris » ; les photos restent dans leur onglet
// existant « Favoris photos » (utilisé par la photothèque), les autres éléments dans les préférences du compte.
const FAVORIS_TYPES = ['demande', 'ressource', 'materiel', 'album', 'fichier', 'annonce'];
const FAVORIS_TOUS = FAVORIS_TYPES.concat(['photo']);
const cleAnnonce_ = t => 'A' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(t || '').trim())).slice(0, 12);
function annonceActive_() { const T = config_().textes, a = String(T.annonce || '').trim(); return a && !(T.annonce_fin && T.annonce_fin < aujourdhui_()) ? a : ''; }
const TYPES_FAV_LIB = { demande: 'Demande', ressource: 'Ressource', materiel: 'Matériel', album: 'Album photos', fichier: 'Fichier', annonce: 'Information importante', photo: 'Photo' };
// Contexte de résolution partagé (une seule lecture de chaque table par appel)
function favoriAccessible_(u, t, id, X) {
  X = X || {};
  if (t === 'demande') { const d = DB.trouver('demandes', 'id', id); return d && peutVoir_(u, d) ? { titre: d.titre, sous: d.id + ' · ' + labelStatut_(d.statut) } : null; }
  if (t === 'ressource') { if (!peut_(u, 'ressources_voir')) return null; const r = lignesRessources_().find(x => x.id === id); return r && ressourceAccessible_(u, r) ? { titre: r.titre, sous: r.rubrique + (r.type === 'fichier' ? ' · ' + String(extension_(r.fichier_nom)).toUpperCase() : '') } : null; }
  if (t === 'materiel') { if (!peut_(u, 'materiel_voir')) return null; const m = materielLignes_().find(x => x.id === id); return visibleMateriel_(m, u) ? { titre: m.nom, sous: m.categorie || 'Matériel' } : null; }
  if (t === 'photo') { if (!peut_(u, 'phototheque_voir')) return null; const p = indexPhotos_().find(x => x.id === id); return p && p.statut !== 'corbeille' && photoVisible_(u, p) ? { titre: p.titre || p.nom_original, sous: 'Photo' + (p.evenement ? ' · ' + p.evenement : '') } : null; }
  if (t === 'album') {
    if (!peut_(u, 'phototheque_voir')) return null;
    if (!X.albums) { const vis = {}; indexPhotos_().forEach(p => { if (photoVisible_(u, p)) vis[p.id] = true; }); X.albums = albumsVisibles_(u, vis); }
    const a = X.albums.find(x => x.id === id); return a ? { titre: a.titre, sous: 'Album · ' + a.nb + ' photo(s)' } : null;
  }
  if (t === 'fichier') {
    const p = piecesLignes_().find(x => x.id === id), ctx = p && CONTEXTES_PJ[p.contexte], obj = ctx && ctx.objet(p.ref);
    return p && p.etat !== 'retiree' && ctx.voir(u, obj) ? { titre: p.nom, sous: (p.contexte === 'demande' ? 'Demande ' + p.ref + (obj ? ' · ' + obj.titre : '') : 'Presse · ' + (obj ? obj.media : '')) } : null;
  }
  if (t === 'annonce') { const a = annonceActive_(); return a && cleAnnonce_(a) === id ? { titre: 'Information importante', sous: a.slice(0, 140) } : null; }
  return null;
}
// Favoris résolus : uniquement ce que la personne peut ENCORE voir (droits revérifiés à chaque affichage), du plus récent au plus ancien
function mesFavoris_(u) {
  const X = {}, out = [];
  (prefsBrutes_(u).favoris || []).filter(f => f && FAVORIS_TYPES.indexOf(f.t) > -1).forEach(f => {
    let a = null; try { a = favoriAccessible_(u, f.t, String(f.id), X); } catch (e) { }
    if (a) out.push({ t: f.t, id: String(f.id), titre: a.titre, sous: a.sous, le: f.le || '' });
  });
  if (peut_(u, 'phototheque_voir')) {
    try {
      const F = DB.tout('photo_favoris').filter(f => f.email === u.email), le = {}; F.forEach(f => le[f.photo_id] = f.le || '');
      if (F.length) indexPhotos_().filter(p => le[p.id] !== undefined && p.statut !== 'corbeille' && photoVisible_(u, p)).forEach(p => out.push({ t: 'photo', id: p.id, titre: p.titre || p.nom_original, sous: 'Photo' + (p.evenement ? ' · ' + p.evenement : ''), le: le[p.id] }));
    } catch (e) { }
  }
  return out.sort((a, b) => String(b.le).localeCompare(String(a.le))).slice(0, 100);
}
function api_mesFavoris(sid) { return appel_(sid, 'connecte', mesFavoris_); }
function api_favori(sid, t, id, oui) {
  return appel_(sid, 'connecte', u => {
    t = String(t || ''); id = String(id || '').slice(0, 40);
    if (FAVORIS_TOUS.indexOf(t) < 0) throw Oups_('Type de favori inconnu.');
    if (oui && !favoriAccessible_(u, t, id)) throw Oups_('Cet élément n\'existe pas ou ne vous est pas accessible.');
    if (t === 'photo') {   // onglet existant « Favoris photos » (même stockage que l'étoile de la photothèque)
      onglets_photos_();
      const lock = LockService.getScriptLock(); lock.waitLock(20000);
      try {
        DB.relire();
        const T = DB.tout('photo_favoris'), deja = T.filter(f => f.email === u.email && f.photo_id === id);
        if (oui && !deja.length) DB.ajouter('photo_favoris', { email: u.email, photo_id: id, le: maintenant_() });
        if (!oui && deja.length) { const sh = DB.feuille('photo_favoris'); deja.map(f => f._ligne).sort((a, b) => b - a).forEach(l => sh.deleteRow(l)); delete DB._cache.photo_favoris; DB.change_('photo_favoris'); }
      } finally { try { SpreadsheetApp.flush(); } catch (e) { } lock.releaseLock(); }
    } else majPrefs_(u, p => {
      const l = (Array.isArray(p.favoris) ? p.favoris : []).filter(f => !(f.t === t && String(f.id) === id));
      if (oui) l.unshift({ t: t, id: id, le: maintenant_() });
      p.favoris = l.slice(0, 80);
    });
    return mesFavoris_(u);
  });
}

// ---------- Brouillons de demande (5 au plus, gardés sur le compte : repris sur n'importe quel appareil) ----------
const BROUILLONS_MAX = 5;
function nettoyerBrouillon_(v) {
  const o = {};
  Object.keys(v || {}).slice(0, 40).forEach(k => {
    if (!/^[a-z_]{1,30}$/.test(k)) return;
    const x = v[k];
    if (typeof x === 'boolean') o[k] = x;
    else if (Array.isArray(x)) o[k] = x.slice(0, 20).map(y => String(y).slice(0, 200));
    else if (x != null) o[k] = String(x).replace(/\r/g, '').slice(0, 5000);
  });
  return o;
}
const MODELES_MAX = 10;
function resumeModeles_(p) { return (Array.isArray(p.modeles_demande) ? p.modeles_demande : []).map(b => ({ id: b.id, type: b.type, nom: b.nom || (b.v && b.v.titre) || '', maj: b.maj })); }
function resumeBrouillons_(p) { return (Array.isArray(p.brouillons) ? p.brouillons : []).map(b => ({ id: b.id, type: b.type, titre: (b.v && b.v.titre) || '', maj: b.maj })); }
function api_brouillon(sid, action, b) {
  return appel_(sid, 'demande_creer', u => {
    b = b || {};
    if (action === 'lire') { const x = (prefsBrutes_(u).brouillons || []).find(y => y.id === String(b.id || '')); if (!x) throw Oups_('Ce brouillon n\'existe plus.'); return x; }
    // Modèles personnels (3.26) : comme un brouillon, mais gardés après l'envoi pour être réutilisés
    if (action === 'modele_lire') { const x = (prefsBrutes_(u).modeles_demande || []).find(y => y.id === String(b.id || '')); if (!x) throw Oups_('Ce modèle n\'existe plus.'); return x; }
    if (action === 'modele_enregistrer' || action === 'modele_supprimer') return majPrefs_(u, p => {
      let l = Array.isArray(p.modeles_demande) ? p.modeles_demande : [];
      if (action === 'modele_supprimer') l = l.filter(y => y.id !== String(b.id || ''));
      else {
        if (!typesActifs_().some(t => t.code === b.type)) throw Oups_('Ce type de demande n\'existe plus.');
        const v = nettoyerBrouillon_(b.v); delete v.date_action; delete v.echeance;
        const nom = String(b.nom || v.titre || '').trim().slice(0, 80);
        if (!nom) throw Oups_('Donnez un nom au modèle.');
        if (l.length >= MODELES_MAX) throw Oups_('Vous avez déjà ' + MODELES_MAX + ' modèles : supprimez-en un d\'abord.');
        l = [{ id: 'M' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), type: b.type, nom: nom, v: v, maj: maintenant_() }].concat(l);
      }
      p.modeles_demande = l;
      return { liste: resumeModeles_(p) };
    });
    return majPrefs_(u, p => {
      let l = Array.isArray(p.brouillons) ? p.brouillons : [];
      if (action === 'supprimer') l = l.filter(y => y.id !== String(b.id || ''));
      else if (action === 'enregistrer') {
        if (!typesActifs_().some(t => t.code === b.type)) throw Oups_('Ce type de demande n\'existe plus.');
        const v = nettoyerBrouillon_(b.v);
        if (!String(v.titre || '').trim() && !String(v.description || '').trim()) throw Oups_('Le brouillon est vide : écrivez au moins un titre ou une description.');
        const id = /^B[0-9a-f]{10}$/.test(String(b.id || '')) && l.some(y => y.id === b.id) ? b.id : 'B' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
        if (!l.some(y => y.id === id) && l.length >= BROUILLONS_MAX) throw Oups_('Vous avez déjà ' + BROUILLONS_MAX + ' brouillons : envoyez ou supprimez-en un d\'abord.');
        l = [{ id: id, type: b.type, v: v, maj: maintenant_() }].concat(l.filter(y => y.id !== id));
        p.brouillons = l;
        return { id: id, liste: resumeBrouillons_(p) };
      } else throw Oups_('Action inconnue.');
      p.brouillons = l;
      return { liste: resumeBrouillons_(p) };
    });
  });
}

// ---------- Personnes associées à une demande ----------
// Le demandeur ou l'équipe associe des personnes actives qui peuvent elles-mêmes faire des demandes : elles voient la demande,
// y écrivent et sont prévenues dans l'application. Notes internes jamais visibles (permission notes_internes inchangée).
function associables_(u) {
  const c = config_();
  return DB.tout('utilisateurs').filter(x => etatAcces_(x) === 'ok' && x.email !== u.email && (role_(x.role) === 'admin' || ((c.roles[role_(x.role)] || {}).permissions || []).indexOf('demande_creer') > -1));
}
function api_associables(sid, id) {
  return appel_(sid, 'connecte', u => {
    const d = DB.trouver('demandes', 'id', String(id || ''));
    if (!d || !peutVoir_(u, d) || (d.demandeur_email !== u.email && !peut_(u, 'demande_traiter'))) throw Oups_('Seuls le demandeur et l\'équipe peuvent associer une personne à cette demande.');
    return associables_(u).filter(x => x.email !== d.demandeur_email).map(x => ({ cle: cleUtilisateur_(x.email), nom: x.nom || x.email, ul: x.ul || '' })).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });
}
function api_participants(sid, id, action, cle) {
  return appel_(sid, 'connecte', u => {
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    let d, qui;
    try {
      DB.relire();
      d = DB.trouver('demandes', 'id', String(id || ''));
      if (!d || !peutVoir_(u, d)) throw Oups_('Cette demande n\'existe pas ou ne vous est pas accessible.');
      const pa = participants_(d), gere = d.demandeur_email === u.email || peut_(u, 'demande_traiter');
      if (action === 'ajouter') {
        if (!gere) throw Oups_('Seuls le demandeur et l\'équipe peuvent associer une personne à cette demande.');
        const x = associables_(u).find(y => cleUtilisateur_(y.email) === String(cle || '') && y.email !== d.demandeur_email);
        if (!x) throw Oups_('Cette personne ne peut pas être associée (compte inactif ou rôle sans demandes).');
        if (pa.indexOf(x.email) > -1) return publicDemande_(d, u);
        if (pa.length >= 5) throw Oups_('5 personnes au plus peuvent être associées à une demande.');
        pa.push(x.email); qui = x;
      } else if (action === 'retirer') {
        const e = pa.find(y => cleUtilisateur_(y) === String(cle || ''));
        if (!e) return publicDemande_(d, u);
        if (!gere && e !== u.email) throw Oups_('Vous ne pouvez retirer que vous-même.');
        pa.splice(pa.indexOf(e), 1); qui = { email: e, nom: nomDe_(e) };
      } else throw Oups_('Action inconnue.');
      let det = {}; try { det = JSON.parse(d.details || '{}'); } catch (e) { }
      det._participants = pa;
      DB.modifier('demandes', 'id', d.id, { details: JSON.stringify(det).slice(0, 20000), maj_le: maintenant_() });
      journal_(d.id, u, 'modif', (action === 'ajouter' ? 'Personne associée : ' : 'Personne retirée du suivi : ') + (qui.nom || qui.email), false);
      d = DB.trouver('demandes', 'id', d.id);
    } finally { try { SpreadsheetApp.flush(); } catch (e) { } lock.releaseLock(); }
    if (action === 'ajouter') notifier_([qui.email], { type: 'demande', titre: 'Vous êtes associé(e) à une demande : ' + d.titre, texte: d.id + ' · par ' + (u.nom || u.email), lien: 'demande:' + d.id, cle: 'dem:' + d.id + ':associe' }, u.email);
    return publicDemande_(d, u);
  });
}

// ---------- Notifications dans l'application (cloche) ----------
// Mêmes événements et mêmes destinataires que les e-mails existants (destinatairesEquipe_, destinatairesMateriel_, demandeur,
// responsable, administrateurs). Jamais l'auteur de l'action, seulement des comptes actifs. Une notification non lue sur le
// même sujet (cle) n'est pas répétée : l'affichage regroupe et compte. Réglage : notifications.internes.
const NOTIF_TYPES = ['demande', 'statut', 'message', 'reservation', 'annonce', 'admin', 'photos', 'diffusion'];
function ongletNotifs_() { const c = CacheService.getScriptCache(); if (c.get('onglet_notifs')) return; assurerOnglet_('notifications'); try { c.put('onglet_notifs', '1', 21600); } catch (e) { } }
function notifLignes_() { ongletNotifs_(); return DB.tout('notifications'); }
// n : { type, titre, texte, lien, cle, perm } ; dests : adresses ; auteur : e-mail de la personne qui agit (exclue) ;
// sousVerrou : l'appelant détient déjà le verrou du script (pas de second verrou)
function notifier_(dests, n, auteur, sousVerrou) {
  try {
    if (config_().notifications.internes === false) return 0;
    const actifs = {}; DB.tout('utilisateurs').forEach(x => { if (etatAcces_(x) === 'ok') actifs[String(x.email).toLowerCase()] = true; });
    const liste = Array.from(new Set((dests || []).map(d => String(d || '').trim().toLowerCase()))).filter(d => d && actifs[d] && d !== String(auteur || '').toLowerCase());
    if (!liste.length) return 0;
    ongletNotifs_();
    const lock = sousVerrou ? null : LockService.getScriptLock();
    if (lock && !lock.tryLock(15000)) { console.error('Notifications : verrou indisponible'); return 0; }
    try {
      const now = maintenant_();
      DB.ajouterPlusieurs('notifications', liste.map(e => ({ id: 'N' + Utilities.getUuid().replace(/-/g, '').slice(0, 14), email: e, date: now,
        type: NOTIF_TYPES.indexOf(n.type) > -1 ? n.type : 'admin', titre: String(n.titre || '').replace(/[<>]/g, '').slice(0, 160), texte: String(n.texte || '').replace(/[<>]/g, '').replace(/\s+/g, ' ').slice(0, 280),
        lien: String(n.lien || '').slice(0, 80), cle: String(n.cle || '').slice(0, 80), lu: '', perm: n.perm || '' })));
    } finally { if (lock) { try { SpreadsheetApp.flush(); } catch (e) { } lock.releaseLock(); } }
    return liste.length;
  } catch (e) { console.error('Notification non enregistrée : ' + e); return 0; }
}
// Une notification n'est montrée que si la personne y a encore droit (rôle changé, demande devenue inaccessible…)
function notifVisible_(u, n, demandes) {
  if (n.perm && !peut_(u, n.perm)) return false;
  if (n.type === 'annonce') { const T = config_().textes; if (!String(T.annonce || '').trim() || (T.annonce_fin && T.annonce_fin < aujourdhui_())) return false; }
  const m = /^demande:(.+)$/.exec(n.lien || '');
  if (m) { const d = demandes[m[1]]; return !!d && peutVoir_(u, d); }
  return true;
}
// Liste regroupée par sujet (la plus récente de chaque sujet ; nb = non lues regroupées) : 30 au plus, 90 jours
function notificationsDe_(u) {
  const limite = Utilities.formatDate(new Date(Date.now() - 90 * 86400000), 'Europe/Paris', "yyyy-MM-dd'T'HH:mm:ss");
  const miennes = notifLignes_().filter(n => n.email === u.email && String(n.date) >= limite);
  if (!miennes.length) return { non_lues: 0, liste: [] };
  const dem = {}; if (miennes.some(n => /^demande:/.test(n.lien))) DB.tout('demandes').forEach(d => dem[d.id] = d);
  const groupes = {};
  miennes.filter(n => notifVisible_(u, n, dem)).forEach(n => {
    const k = n.cle || n.id, g = groupes[k];
    if (!g) groupes[k] = { n: n, nb: n.lu === 'OUI' ? 0 : 1 };
    else { if (n.lu !== 'OUI') g.nb++; if (String(n.date) >= String(g.n.date)) g.n = n; }   // à égalité, la ligne la plus récente de l'onglet
  });
  // « Réservation à valider » déjà traitée (par un autre gestionnaire) : plus rien à faire, la notification disparaît
  const resas = {}; if (Object.keys(groupes).some(k => /^resa:/.test(k))) reservationsLignes_().forEach(r => resas[r.id] = r.statut);
  Object.keys(groupes).forEach(k => { const m = /^resa:(.+):nouvelle$/.exec(k); if (m && /^Réservation à valider/.test(groupes[k].n.titre) && resas[m[1]] !== 'attente') delete groupes[k]; });
  const l = Object.keys(groupes).map(k => groupes[k]).sort((a, b) => String(b.n.date).localeCompare(String(a.n.date)));
  return { non_lues: l.filter(g => g.nb).length, liste: l.slice(0, 30).map(g => ({ id: g.n.id, date: g.n.date, type: g.n.type, titre: g.n.titre, texte: g.n.texte, lien: g.n.lien, lu: !g.nb, nb: g.nb })) };
}
// Les diffusions programmées échues partent aussi à la prochaine activité (contrôle presque gratuit : heure en cache)
function api_notifications(sid) { return appel_(sid, 'connecte', u => { try { diffusionsDues_(); } catch (e) { console.error(e); } return notificationsDe_(u); }); }
// Marquer comme lu : ids (sujets entiers) ou 'tout'. Une seule écriture de la colonne « lu ». Uniquement ses propres notifications.
function api_lireNotifications(sid, ids) {
  return appel_(sid, 'connecte', u => {
    ongletNotifs_();
    const tout = ids === 'tout', voulu = {}; (Array.isArray(ids) ? ids : []).slice(0, 100).forEach(i => voulu[String(i)] = true);
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const L = DB.tout('notifications'), cles = {};
      L.forEach(n => { if (n.email === u.email && voulu[n.id]) cles[n.cle || n.id] = true; });
      const cols = TABLES.notifications.cols, j = cols.indexOf('lu'), valeurs = [];
      let n = 0;
      L.forEach(x => { const lire = x.email === u.email && x.lu !== 'OUI' && (tout || cles[x.cle || x.id]); if (lire) n++; valeurs.push([lire ? 'OUI' : String(x.lu || '')]); });
      if (n) { DB.feuille('notifications').getRange(2, j + 1, valeurs.length, 1).setNumberFormat('@').setValues(valeurs); delete DB._cache.notifications; DB.change_('notifications'); }
    } finally { try { SpreadsheetApp.flush(); } catch (e) { } lock.releaseLock(); }
    return notificationsDe_(u);
  });
}
// Routine quotidienne : notifications lues de plus de 60 jours et toutes celles de plus de 120 jours retirées
function purgerNotifications_() {
  ongletNotifs_();
  const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return 0;
  try {
    DB.relire();
    const L = DB.tout('notifications'), j60 = Utilities.formatDate(new Date(Date.now() - 60 * 86400000), 'Europe/Paris', "yyyy-MM-dd'T'HH:mm:ss"), j120 = Utilities.formatDate(new Date(Date.now() - 120 * 86400000), 'Europe/Paris', "yyyy-MM-dd'T'HH:mm:ss");
    const garder = L.filter(n => String(n.date) >= j120 && !(n.lu === 'OUI' && String(n.date) < j60));
    if (garder.length === L.length) return 0;
    DB.remplacer('notifications', garder.map(n => { const o = Object.assign({}, n); delete o._ligne; return o; }));
    return L.length - garder.length;
  } finally { try { SpreadsheetApp.flush(); } catch (e) { } lock.releaseLock(); }
}

// ---------- Activité récente (journal existant), selon les permissions ----------
// Seuls les événements de gestion listés ici, et seulement pour qui détient la permission correspondante ; les administrateurs
// voient aussi les événements d'administration. Jamais les événements de sécurité (connexions, refus) hors administrateurs.
const ACTIVITE_JOURNAL = {
  ressource_ajoutee: ['ressources_gerer', 'Ressource ajoutée', 'folder'], ressource_modifiee: ['ressources_gerer', 'Ressource modifiée', 'folder'], ressource_importee: ['ressources_gerer', 'Fichier de ressource importé', 'folder'],
  ressource_remplacee: ['ressources_gerer', 'Fichier de ressource remplacé', 'folder'], ressource_supprimee: ['ressources_gerer', 'Ressource supprimée', 'folder'],
  faq_ajoutee: ['faq_gerer', 'Question d\'aide ajoutée', 'help'], faq_modifiee: ['faq_gerer', 'Question d\'aide modifiée', 'help'], faq_supprimee: ['faq_gerer', 'Question d\'aide supprimée', 'help'],
  photo_importee: ['phototheque_modifier', 'Photo importée', 'image'], album_cree: ['phototheque_modifier', 'Album créé', 'image'], album_modifie: ['phototheque_modifier', 'Album modifié', 'image'], album_supprime: ['phototheque_modifier', 'Album supprimé', 'image'],
  photos_publier: ['phototheque_modifier', 'Photos publiées', 'image'], photos_archiver: ['phototheque_modifier', 'Photos archivées', 'image'], photos_corbeille: ['phototheque_modifier', 'Photos mises à la corbeille', 'image'],
  reservation_creee: ['reservations_gerer', 'Réservation de matériel', 'box'], reservation_confirmee: ['reservations_gerer', 'Réservation confirmée', 'box'], reservation_refusee: ['reservations_gerer', 'Réservation refusée', 'box'],
  reservation_annulee: ['reservations_gerer', 'Réservation annulée', 'box'], reservation_modifiee: ['reservations_gerer', 'Réservation modifiée', 'box'],
  materiel_desactiver: ['materiel_gerer', 'Matériel désactivé', 'box'], materiel_archiver: ['materiel_gerer', 'Matériel archivé', 'box'], materiel_reactiver: ['materiel_gerer', 'Matériel réactivé', 'box'],
  inscription: ['admin', 'Nouveau profil', 'user'], utilisateur_ajoute: ['admin', 'Utilisateur ajouté', 'user'], configuration: ['admin', 'Configuration modifiée', 'settings'],
  drive_echec: ['admin', 'Échec d\'écriture dans le Drive', 'alert'], notification_echec: ['admin', 'E-mail non envoyé', 'alert'], photos_orphelines: ['admin', 'Envois de photos abandonnés retirés', 'image'],
  sauvegarde: ['admin', 'Sauvegarde', 'database'], restauration: ['admin', 'Restauration', 'database'],
};
function activiteJournal_(u) {
  const perms = {}; Object.keys(ACTIVITE_JOURNAL).forEach(k => { const p = ACTIVITE_JOURNAL[k][0]; if (perms[p] === undefined) perms[p] = peut_(u, p); });
  if (!Object.keys(perms).some(p => perms[p])) return [];
  const J = DB.dernieres('journal', 600), out = [];   // 3.29 : jamais tout le journal (jusqu'à 5 000 lignes) à chaque tableau de bord
  for (let i = J.length - 1; i >= 0 && out.length < 10; i--) {
    const j = J[i], a = ACTIVITE_JOURNAL[j.evenement];
    if (!a || !perms[a[0]]) continue;
    // détail : sans l'identifiant technique en tête (R-…, P-…) ; jamais d'adresse e-mail pour qui n'est pas administrateur
    const adm = peut_(u, 'admin');
    let det = String(j.detail || '').replace(/^[A-Z]{1,2}-?[A-Za-z0-9]{6,}\s·\s/, '');
    if (!adm) det = det.replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '…');
    let qui = j.email ? nomDe_(j.email) : 'Système';
    if (!adm && /@/.test(qui)) qui = 'Un membre';   // compte sans nom : l'adresse n'est montrée qu'aux administrateurs
    out.push({ date: j.date, auteur_nom: qui, type: 'journal', icone: a[2], message: det.slice(0, 160), titre: a[1], evenement: j.evenement });
  }
  return out;
}

// ---------- E-mails ----------
function mailModele_(a, cle, v, blocHtml, repondreA, test) {
  const c = config_();
  const m = c.notifications.modeles[cle] || { sujet: cle, titre: cle, texte: '' };
  const texte = remplir_(m.texte, v);
  const corps = texte ? '<p>' + esc_(texte).replace(/(<br>){2,}/g, '</p><p>') + '</p>' : '';
  return envoyerMail_(a, (test ? '[TEST] ' : '') + remplir_(m.sujet, v), remplir_(m.titre, v), corps + (blocHtml || ''), repondreA);
}

function envoyerMail_(a, sujet, titre, corps, repondreA) {
  a = String(a || '').trim();
  if (!a) return true;
  const c = config_(), coul = c.apparence.couleurs.principale, logoMail = logoMail_(c);   // logo importé : image jointe au message (affichée par les messageries)
  const html =
    '<div style="background:#f4f4f4;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">' +
    '<div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:6px;overflow:hidden">' +
    '<div style="height:6px;background:' + coul + '"></div>' +
    (logoMail ? '<div style="padding:20px 28px 0"><img src="cid:logo" alt="' + esc_(c.identite.nom_organisation) + '" style="height:40px;width:auto"></div>' : c.identite.logo_url ? '<div style="padding:20px 28px 0"><img src="' + esc_(c.identite.logo_url) + '" alt="" style="height:40px"></div>' : '') +
    '<div style="padding:18px 28px 0;font-size:12px;color:#6b6b6b;letter-spacing:.4px;text-transform:uppercase">' + esc_(c.identite.nom_organisation) + ' · ' + esc_(c.identite.nom_centre) + '</div>' +
    '<div style="padding:6px 28px 0;font-size:21px;font-weight:bold;color:#1a1a1a">' + esc_(titre) + '</div>' +
    '<div style="padding:10px 28px 6px;font-size:15px;line-height:1.55;color:#1a1a1a">' + corps + '</div>' +
    '<div style="padding:16px 28px 22px;font-size:13px;color:#6b6b6b;border-top:1px solid #eeeeee">' + esc_(c.notifications.signature) + '<br>' + esc_(c.identite.nom_structure) + '</div>' +
    '</div></div>';
  const o = { to: a, subject: sujet, htmlBody: html, name: c.notifications.expediteur || c.identite.nom_centre };
  if (logoMail) o.inlineImages = { logo: logoMail };
  const rep = repondreA || c.notifications.repondre_a;
  if (rep) o.replyTo = rep;
  try { MailApp.sendEmail(o); return true; } catch (err) { console.error('E-mail non envoyé à ' + a + ' : ' + err); return false; }
}
function couleurPrincipale_() { try { return config_().apparence.couleurs.principale; } catch (e) { return '#e30613'; } }
function tableau_(l) { return '<table style="border-collapse:collapse;width:100%;margin:10px 0;font-size:14px">' + l.map(x => '<tr><td style="padding:5px 12px 5px 0;color:#6b6b6b;width:34%;vertical-align:top">' + esc_(x[0]) + '</td><td style="padding:5px 0;vertical-align:top">' + esc_(x[1]) + '</td></tr>').join('') + '</table>'; }
function bouton_(t, url) { return '<p style="margin:20px 0"><a href="' + esc_(url) + '" style="background:' + couleurPrincipale_() + ';color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold;display:inline-block">' + esc_(t) + '</a></p>'; }
function citation_(t) { return '<div style="border-left:4px solid ' + couleurPrincipale_() + ';background:#f7f7f7;padding:10px 14px;margin:10px 0">' + esc_(t) + '</div>'; }
function encadre_(t, fond) { return '<div style="background:' + fond + ';padding:10px 14px;border-radius:6px;margin:10px 0">' + esc_(t) + '</div>'; }
function h3_(t) { return '<p style="font-weight:bold;color:' + couleurPrincipale_() + ';margin:18px 0 4px">' + esc_(t) + '</p>'; }

// =====================================================================
// 23. MATÉRIEL ET RÉSERVATIONS (3.12)
// Catalogue (onglet « Matériel », photos réduites dans « Photos du matériel ») et réservations (onglet « Réservations »).
// Aucun accès au Drive. Disponibilité et conflits vérifiés UNIQUEMENT ici, sous verrou (LockService) et sur la base
// elle-même (DB.relire) : deux réservations simultanées ne peuvent pas se chevaucher.
// =====================================================================
const MATERIEL_ETATS = ['disponible', 'indisponible', 'maintenance'];   // « réservé » est calculé (réservation en cours)
const RESA_STATUTS = ['attente', 'confirmee', 'refusee', 'annulee', 'terminee'];
const RESA_BLOQUANTS = ['attente', 'confirmee'];                       // une demande en attente bloque déjà le créneau
const MOTIF_DATE_HEURE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MOTIF_JOUR = /^\d{4}-\d{2}-\d{2}$/;

function ongletsMateriel_() { const c = CacheService.getScriptCache(); if (c.get('onglets_materiel')) return; ['materiel', 'materiel_photos', 'materiel_galerie', 'reservations'].forEach(assurerOnglet_); try { c.put('onglets_materiel', '1', 21600); } catch (e) { } }
function materielLignes_() { ongletsMateriel_(); return DB.tout('materiel'); }
function reservationsLignes_() { ongletsMateriel_(); return DB.tout('reservations'); }
function photosMateriel_() { ongletsMateriel_(); const o = {}; DB.tout('materiel_photos').forEach(p => { if (p.mini) o[p.id] = p.mini; }); return o; }
const minuteActuelle_ = () => maintenant_().slice(0, 16);
function statutEffectif_(r, now) { return r.statut === 'confirmee' && r.fin <= (now || minuteActuelle_()) ? 'terminee' : r.statut; }
const chevauche_ = (a1, a2, b1, b2) => a1 < b2 && b1 < a2;
function droitsMateriel_(u) { return { voir: peut_(u, 'materiel_voir'), reserver: peut_(u, 'materiel_reserver'), gerer: peut_(u, 'materiel_gerer'), gerer_resa: peut_(u, 'reservations_gerer') }; }
const visibleMateriel_ = (m, u) => !!m && (peut_(u, 'materiel_gerer') || peut_(u, 'reservations_gerer') || (m.actif !== 'NON' && m.archive !== 'OUI'));
// Le matériel accepte-t-il une nouvelle réservation ? (raison lisible sinon)
function raisonNonReservable_(m) {
  if (!m) return 'Ce matériel n\'existe plus.';
  if (m.archive === 'OUI') return 'Ce matériel est archivé.';
  if (m.actif === 'NON') return 'Ce matériel est désactivé.';
  if (m.etat === 'maintenance') return 'Ce matériel est en maintenance.';
  if (m.etat === 'indisponible') return 'Ce matériel est indisponible.';
  return '';
}
function dateHeure_(s) { const x = MOTIF_DATE_HEURE.exec(String(s || '')); if (!x) return null; const d = new Date(+x[1], +x[2] - 1, +x[3], +x[4], +x[5]); return d.getMonth() === +x[2] - 1 && d.getDate() === +x[3] && +x[4] < 24 && +x[5] < 60 ? d : null; }
function isoMinute_(d) { return isoJour_(d) + 'T' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
// Période texte (e-mails, journal) : « le 12/10/2026 », « du 12/10/2026 au 14/10/2026 », « le 12/10/2026 de 14:00 à 16:00 »
function periodeTexte_(r) {
  const j1 = r.debut.slice(0, 10), h1 = r.debut.slice(11), h2 = r.fin.slice(11);
  if (r.journee === 'OUI') { const d = dateHeure_(r.fin); d.setDate(d.getDate() - 1); const j2 = isoJour_(d); return j1 === j2 ? 'le ' + dateFr_(j1) : 'du ' + dateFr_(j1) + ' au ' + dateFr_(j2); }
  return j1 === r.fin.slice(0, 10) ? 'le ' + dateFr_(j1) + ' de ' + h1 + ' à ' + h2 : 'du ' + dateFr_(j1) + ' ' + h1 + ' au ' + dateFr_(r.fin.slice(0, 10)) + ' ' + h2;
}
// Période demandée : contrôlée ici (format, ordre, passé, durée, anticipation), jamais seulement dans le navigateur
function periode_(p, u) {
  let debut = String(p.debut || ''), fin = String(p.fin || '');
  const journee = p.journee === true || p.journee === 'OUI';
  if (journee) {   // journée(s) entière(s) : de 00:00 le premier jour à 00:00 le lendemain du dernier
    const j1 = debut.slice(0, 10), j2 = (fin || debut).slice(0, 10);
    if (!MOTIF_JOUR.test(j1) || !MOTIF_JOUR.test(j2)) throw Oups_('Dates invalides.');
    debut = j1 + 'T00:00'; const d = dateHeure_(j2 + 'T00:00'); if (!d) throw Oups_('Dates invalides.'); d.setDate(d.getDate() + 1); fin = isoMinute_(d);
  }
  const d1 = dateHeure_(debut), d2 = dateHeure_(fin);
  if (!d1 || !d2) throw Oups_('Dates ou heures invalides.');
  if (fin <= debut) throw Oups_('La fin de la réservation doit être après le début.');
  const c = config_().materiel, gere = peut_(u, 'reservations_gerer');
  if (!gere && debut.slice(0, 10) < aujourdhui_()) throw Oups_('Une réservation ne peut pas commencer dans le passé.');
  if ((d2 - d1) / 86400000 > c.duree_max_jours + 0.001) throw Oups_('Durée maximale d\'une réservation : ' + c.duree_max_jours + ' jour(s).');
  const lim = new Date(); lim.setDate(lim.getDate() + c.anticipation_max_jours);
  if (!gere && debut.slice(0, 10) > isoJour_(lim)) throw Oups_('On ne peut pas réserver plus de ' + c.anticipation_max_jours + ' jours à l\'avance.');
  return { debut: debut, fin: fin, journee: journee ? 'OUI' : '' };
}
function conflits_(materielId, debut, fin, saufId, L) {
  return (L || reservationsLignes_()).filter(r => r.materiel_id === materielId && r.id !== saufId && RESA_BLOQUANTS.indexOf(r.statut) > -1 && chevauche_(debut, fin, r.debut, r.fin));
}
function materielPublic_(m, u, photos, occupe, nbPhotos) {
  const gere = peut_(u, 'materiel_gerer');
  const o = { id: m.id, nom: m.nom, categorie: m.categorie, description: m.description, reference: m.reference, localisation: m.localisation, responsable_nom: m.responsable ? nomDe_(m.responsable) : '',
    etat: MATERIEL_ETATS.indexOf(m.etat) > -1 ? m.etat : 'disponible', conditions: m.conditions, maintenance: m.maintenance, maintenance_date: m.maintenance_date, actif: m.actif !== 'NON', archive: m.archive === 'OUI',
    validation: m.validation || '', photo: (photos || {})[m.id] || '', reserve_maintenant: !!occupe, ordre: Number(m.ordre) || 0 };
  o.nb_photos = nbPhotos != null ? nbPhotos : o.photo ? 1 : 0;   // 3.30 : nombre de photos de la galerie
  o.etat_affiche = !o.actif || o.archive ? 'inactif' : o.etat === 'disponible' && occupe ? 'reserve' : o.etat;
  if (gere) { o.responsable = m.responsable; o.maj_le = m.maj_le; }
  Object.keys(o).forEach(k => { if (o[k] === '' || o[k] === undefined) delete o[k]; });
  return o;
}
function resaPublique_(r, u, noms) {
  const gere = peut_(u, 'reservations_gerer'), moi = r.email === u.email, now = minuteActuelle_(), st = statutEffectif_(r, now);
  const o = { id: r.id, materiel_id: r.materiel_id, materiel_nom: (noms || {})[r.materiel_id] || '', debut: r.debut, fin: r.fin, journee: r.journee === 'OUI', statut: st, a_moi: moi, cree_le: r.cree_le };
  if (gere || moi) {
    Object.assign(o, { nom: r.nom || r.email, lieu: r.lieu, commentaire: r.commentaire, motif: r.motif, decide_par_nom: r.decide_par === 'automatique' ? 'Confirmation automatique' : (r.decide_par ? nomDe_(r.decide_par) : ''),
      suivi: String(r.suivi || '').split('\n').filter(Boolean) });
    if (gere) o.email = r.email;
    o.peut_annuler = RESA_BLOQUANTS.indexOf(st) > -1 && (gere || (moi && (config_().materiel.annulation === 'avant_debut' ? (r.statut === 'attente' || r.debut > now) : r.statut === 'attente')));
    o.peut_decider = gere && st === 'attente';
    o.peut_modifier = gere && RESA_BLOQUANTS.indexOf(st) > -1;
  }
  return o;
}
const nomsMateriel_ = () => { const o = {}; materielLignes_().forEach(m => o[m.id] = m.nom); return o; };
const ligneSuivi_ = (u, action) => maintenant_().slice(0, 16).replace('T', ' ') + ' · ' + (u.nom || u.email) + ' · ' + action;
function ajouterSuivi_(r, u, action) { return (String(r.suivi || '') + '\n' + ligneSuivi_(u, action)).trim().split('\n').slice(-40).join('\n'); }

// ---------- Notifications (modèles d'e-mails existants, Administration > Modèles d'e-mails) ----------
function destinatairesMateriel_(m) {
  const c = config_();
  const liste = String(c.materiel.emails_gestion || '').split(/[,;\s]+/).map(s => s.trim().toLowerCase()).filter(s => s.indexOf('@') > 0);
  // 3.30 : le responsable du matériel est prévenu EN PLUS des adresses de gestion réglées dans l'administration
  const resp = m && m.responsable ? DB.trouver('utilisateurs', 'email', m.responsable) : null;
  const ok = liste.concat(resp && etatAcces_(resp) === 'ok' ? [resp.email] : []);
  if (ok.length) return Array.from(new Set(ok));
  return DB.tout('utilisateurs').filter(x => { const r = role_(x.role); return etatAcces_(x) === 'ok' && (r === 'admin' || ((c.roles[r] || {}).permissions || []).indexOf('reservations_gerer') > -1); }).map(x => x.email);
}
function notifierResa_(modele, dests, r, m, auteur, motif) {
  // Dans l'application (indépendant des e-mails) : jamais pour sa propre action (accusé de sa réservation, confirmation automatique)
  try {
    const nomM = m ? m.nom : '', per = periodeTexte_(r);
    if (modele === 'resa_nouvelle') notifier_(dests, { type: 'reservation', titre: (r.statut === 'attente' ? 'Réservation à valider : ' : 'Nouvelle réservation : ') + nomM, texte: per + ' · ' + (r.nom || r.email) + (r.lieu ? ' · ' + r.lieu : ''), lien: 'materiel:gestion', cle: 'resa:' + r.id + ':nouvelle', perm: 'reservations_gerer' }, auteur && auteur.email);
    else if (auteur && ['resa_confirmee', 'resa_refusee', 'resa_annulee', 'resa_modifiee'].indexOf(modele) > -1) {
      const lib = { resa_confirmee: 'Réservation confirmée', resa_refusee: 'Réservation refusée', resa_annulee: 'Réservation annulée', resa_modifiee: 'Réservation modifiée' }[modele];
      const pourReservant = dests.filter(d => d === r.email), autres = dests.filter(d => d !== r.email);
      const n = { type: 'reservation', titre: lib + ' : ' + nomM, texte: per + (motif ? ' — ' + motif : ''), cle: 'resa:' + r.id + ':suivi' };
      notifier_(pourReservant, Object.assign({}, n, { lien: 'materiel:mes' }), auteur.email);
      notifier_(autres, Object.assign({}, n, { texte: per + ' · ' + (r.nom || r.email) + (motif ? ' — ' + motif : ''), lien: 'materiel:gestion', perm: 'reservations_gerer', cle: 'resa:' + r.id + ':nouvelle' }), auteur.email);   // même sujet que « à valider » : remplace la demande de validation
    }
  } catch (e) { console.error(e); }
  if (!config_().materiel.notifier) return 0;
  const st = { attente: 'en attente de validation', confirmee: 'confirmée', refusee: 'refusée', annulee: 'annulée', terminee: 'terminée' }[statutEffectif_(r)] || r.statut;
  const v = { prenom: prenom_(r.nom), demandeur: r.nom || r.email, materiel: m ? m.nom : '', periode: periodeTexte_(r), lieu: r.lieu || '', statut: st, auteur: auteur ? (auteur.nom || auteur.email) : '', motif: motif || '' };
  const lignes = [['Matériel', v.materiel + (m && m.reference ? ' (réf. ' + m.reference + ')' : '')], ['Période', v.periode], ['Lieu / utilisation', v.lieu || '—'], ['Statut', st]];
  if (modele === 'resa_nouvelle') lignes.splice(1, 0, ['Demandeur', (r.nom || r.email) + (r.nom && r.email && r.nom !== r.email ? ' — ' + r.email : '')]);
  if (m && m.localisation) lignes.push(['Localisation du matériel', m.localisation]);
  lignes.push(['N° de réservation', r.id]);
  const extra = tableau_(lignes) + (motif ? citation_(motif) : '') + (r.commentaire && modele === 'resa_nouvelle' ? citation_(r.commentaire) : '');
  let n = 0;
  Array.from(new Set(dests.filter(Boolean))).filter(d => !auteur || d !== auteur.email || modele !== 'resa_nouvelle').forEach(d => { if (mailModele_(d, modele, v, extra + bouton_('Ouvrir le matériel et les réservations', urlOfficielle_() + '?v=materiel'))) n++; });
  return n;
}

// ---------- Lecture ----------
function api_materiel(sid) {
  return appel_(sid, 'materiel_voir', u => {
    const now = minuteActuelle_(), occ = {};
    reservationsLignes_().forEach(r => { if (r.statut === 'confirmee' && r.debut <= now && r.fin > now) occ[r.materiel_id] = true; });
    const ph = photosMateriel_(), c = config_().materiel, nb = {};
    try { ongletsMateriel_(); DB.colonne('materiel_galerie', 'materiel_id').forEach(x => { if (x) nb[x] = (nb[x] || 0) + 1; }); } catch (e) { console.error('Galerie du matériel : ' + e); }
    const items = materielLignes_().filter(m => visibleMateriel_(m, u)).map(m => materielPublic_(m, u, ph, occ[m.id], nb[m.id] || (ph[m.id] ? 1 : 0)))
      .sort((a, b) => (a.ordre - b.ordre) || String(a.nom).localeCompare(String(b.nom), 'fr'));
    return { items: items, categories: c.categories, validation: c.validation, duree_max_jours: c.duree_max_jours, anticipation_max_jours: c.anticipation_max_jours, annulation: c.annulation, conditions: c.conditions, droits: droitsMateriel_(u) };
  });
}
// Disponibilité réelle d'un matériel : conflits sur la période choisie + occupations d'une fenêtre (62 jours au plus)
function api_disponibilite(sid, materielId, p, du, au) {
  return appel_(sid, 'materiel_voir', u => {
    const m = materielLignes_().find(x => x.id === String(materielId || ''));
    if (!visibleMateriel_(m, u)) throw Oups_('Ce matériel n\'existe pas ou ne vous est pas accessible.');
    const L = reservationsLignes_(), gere = peut_(u, 'reservations_gerer');
    const o = { reservable: !raisonNonReservable_(m), raison: raisonNonReservable_(m), conflits: [], occupations: [] };
    if (p && p.debut) { try { const q = periode_(p, u); o.periode = q; o.conflits = conflits_(m.id, q.debut, q.fin, String(p.sauf || ''), L).map(r => ({ debut: r.debut, fin: r.fin, statut: r.statut, a_moi: r.email === u.email, nom: gere || r.email === u.email ? r.nom : '' })); } catch (e) { o.erreur_periode = e.message; } }
    if (MOTIF_JOUR.test(String(du || '')) && MOTIF_JOUR.test(String(au || ''))) {
      const a = String(du) + 'T00:00', b0 = dateHeure_(String(au) + 'T00:00'); b0.setDate(b0.getDate() + 1); const b = isoMinute_(b0);
      if ((b0 - dateHeure_(a)) / 86400000 <= 63) o.occupations = L.filter(r => r.materiel_id === m.id && ['attente', 'confirmee'].indexOf(r.statut) > -1 && chevauche_(a, b, r.debut, r.fin))
        .sort((x, y) => x.debut.localeCompare(y.debut)).map(r => ({ debut: r.debut, fin: r.fin, journee: r.journee === 'OUI', statut: statutEffectif_(r), a_moi: r.email === u.email, nom: gere || r.email === u.email ? r.nom : '' }));
    }
    o.disponible = o.reservable && !o.conflits.length && !o.erreur_periode && !!o.periode;
    return o;
  });
}
// Mes réservations : à venir (en attente, confirmées non terminées) ou historique ; paginé
function api_mesReservations(sid, R) {
  return appel_(sid, 'materiel_voir', u => {
    R = R || {}; const now = minuteActuelle_(), noms = nomsMateriel_();
    const miennes = reservationsLignes_().filter(r => r.email === u.email);
    const aVenir = r => RESA_BLOQUANTS.indexOf(statutEffectif_(r, now)) > -1;
    let L = R.vue === 'historique' ? miennes.filter(r => !aVenir(r)).sort((a, b) => b.debut.localeCompare(a.debut)) : miennes.filter(aVenir).sort((a, b) => a.debut.localeCompare(b.debut));
    const debut = Math.max(0, Number(R.debut) || 0), nombre = Math.min(50, Math.max(1, Number(R.nombre) || 20));
    return { items: L.slice(debut, debut + nombre).map(r => resaPublique_(r, u, noms)), total: L.length, debut: debut, a_venir: miennes.filter(aVenir).length };
  });
}
// Toutes les réservations (gestion) : filtres matériel / période / personne / statut appliqués ici ; paginé
function api_reservations(sid, R) {
  return appel_(sid, 'reservations_gerer', u => {
    R = R || {}; const now = minuteActuelle_(), noms = nomsMateriel_();
    const all = reservationsLignes_();
    const mots = NORM_(R.q).split(/\s+/).filter(x => x.length > 1);
    const du = MOTIF_JOUR.test(String(R.du || '')) ? R.du + 'T00:00' : '', au = MOTIF_JOUR.test(String(R.au || '')) ? R.au + 'T23:59' : '';
    let L = all.filter(r => (!R.materiel || r.materiel_id === R.materiel) && (!R.statut || statutEffectif_(r, now) === R.statut) && (!du || r.fin > du) && (!au || r.debut <= au) &&
      (!mots.length || (t => mots.every(m => t.indexOf(m) > -1))(NORM_([r.nom, r.email, r.lieu, r.commentaire, noms[r.materiel_id], r.id].join(' ')))));
    L = R.tri === 'recentes' ? L.sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le))) : R.tri === 'debut_desc' ? L.sort((a, b) => b.debut.localeCompare(a.debut)) : L.sort((a, b) => a.debut.localeCompare(b.debut));
    const debut = Math.max(0, Number(R.debut) || 0), nombre = Math.min(50, Math.max(1, Number(R.nombre) || 25));
    return { items: L.slice(debut, debut + nombre).map(r => resaPublique_(r, u, noms)), total: L.length, debut: debut, a_valider: all.filter(r => r.statut === 'attente' && r.fin > now).length };
  });
}
// Planning (calendrier jour / semaine / mois) : seulement la période affichée ; nom et lieu visibles des gestionnaires et du réservant
function api_planning(sid, du, au, materielId) {
  return appel_(sid, 'materiel_voir', u => {
    if (!MOTIF_JOUR.test(String(du || '')) || !MOTIF_JOUR.test(String(au || ''))) throw Oups_('Période invalide.');
    const a = du + 'T00:00', b0 = dateHeure_(au + 'T00:00'); b0.setDate(b0.getDate() + 1); const b = isoMinute_(b0);
    if ((b0 - dateHeure_(a)) / 86400000 > 45) throw Oups_('Période trop longue.');
    const gere = peut_(u, 'reservations_gerer'), vis = {};
    materielLignes_().forEach(m => { if (visibleMateriel_(m, u)) vis[m.id] = m.nom; });
    return reservationsLignes_().filter(r => vis[r.materiel_id] !== undefined && (!materielId || r.materiel_id === materielId) && ['attente', 'confirmee'].indexOf(r.statut) > -1 && chevauche_(a, b, r.debut, r.fin))
      .sort((x, y) => x.debut.localeCompare(y.debut))
      .map(r => { const moi = r.email === u.email; const o = { id: r.id, materiel_id: r.materiel_id, materiel_nom: vis[r.materiel_id], debut: r.debut, fin: r.fin, journee: r.journee === 'OUI', statut: statutEffectif_(r), a_moi: moi }; if (gere || moi) { o.nom = r.nom; o.lieu = r.lieu; } return o; });
  });
}
// Tableau de bord (api_accueil) : prochaine réservation, demandes en attente, réservations à valider (gestionnaires)
function resumeMateriel_(u) {
  const now = minuteActuelle_(), noms = nomsMateriel_(), L = reservationsLignes_();
  const miennes = L.filter(r => r.email === u.email && RESA_BLOQUANTS.indexOf(statutEffectif_(r, now)) > -1).sort((a, b) => a.debut.localeCompare(b.debut));
  // Décisions prises par un gestionnaire sur mes réservations depuis 7 jours (confirmation, refus) : notification d'accueil
  const il_y_a_7j = Utilities.formatDate(new Date(Date.now() - 7 * 86400000), 'Europe/Paris', "yyyy-MM-dd'T'HH:mm:ss");
  // date de la décision : dernière ligne « validation » ou « refus » du suivi (une modification ultérieure ne la fait pas réapparaître)
  const dateDecision = r => { const l = String(r.suivi || '').split('\n').filter(x => / · (validation|refus)( — |$)/.test(x)).pop(); return l ? l.slice(0, 16).replace(' ', 'T') : ''; };
  const decisions = L.filter(r => r.email === u.email && (r.statut === 'confirmee' || r.statut === 'refusee') && r.decide_par && r.decide_par !== 'automatique' && r.decide_par !== u.email && r.fin > now && dateDecision(r) >= il_y_a_7j.slice(0, 16))
    .sort((a, b) => dateDecision(b).localeCompare(dateDecision(a))).slice(0, 3);
  return { prochaine: miennes.find(r => r.statut === 'confirmee') ? resaPublique_(miennes.find(r => r.statut === 'confirmee'), u, noms) : null,
    prochaines: miennes.slice(0, 5).map(r => resaPublique_(r, u, noms)), decisions: decisions.map(r => resaPublique_(r, u, noms)),
    en_attente: miennes.filter(r => r.statut === 'attente').length, a_venir: miennes.length,
    a_valider: peut_(u, 'reservations_gerer') ? L.filter(r => r.statut === 'attente' && r.fin > now).length : 0 };
}

// ---------- Réserver (verrou + relecture de la base : jamais deux réservations sur la même période) ----------
function verrouMateriel_() { const lock = LockService.getScriptLock(); if (!lock.tryLock(25000)) throw Oups_('Le service est très sollicité : réessayez dans un instant.'); return lock; }
function liberer_(lock) { try { SpreadsheetApp.flush(); } catch (e) { } try { lock.releaseLock(); } catch (e) { } }
const txtM_ = (v, max) => String(v == null ? '' : v).replace(/[<>]/g, '').replace(/\r/g, '').trim().slice(0, max);
function api_reserver(sid, r) {
  return appel_(sid, 'materiel_reserver', u => {
    r = r || {};
    let o, m;
    const lock = verrouMateriel_();
    try {
      DB.relire();
      m = materielLignes_().find(x => x.id === String(r.materiel_id || ''));
      if (!visibleMateriel_(m, u)) throw Oups_('Ce matériel n\'existe pas ou ne vous est pas accessible.');
      const raison = raisonNonReservable_(m); if (raison) throw Oups_(raison + ' Il ne peut pas être réservé.');
      const p = periode_(r, u);
      const c = conflits_(m.id, p.debut, p.fin, '');
      if (c.length) throw Oups_('Ce matériel est déjà réservé sur cette période (' + c.map(periodeTexte_).join(' ; ') + '). Choisissez une autre période.');
      const mode = m.validation === 'auto' || m.validation === 'admin' ? m.validation : config_().materiel.validation;
      const statut = mode === 'auto' || peut_(u, 'reservations_gerer') ? 'confirmee' : 'attente';
      o = { id: 'R-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10), materiel_id: m.id, email: u.email, nom: u.nom || u.email, debut: p.debut, fin: p.fin, journee: p.journee,
        lieu: txtM_(r.lieu, 200), commentaire: txtM_(r.commentaire, 1000), statut: statut, cree_le: maintenant_(), maj_le: maintenant_(),
        decide_par: statut === 'confirmee' ? (mode === 'auto' ? 'automatique' : u.email) : '', motif: '', suivi: '' };
      o.suivi = ligneSuivi_(u, statut === 'confirmee' ? 'réservation confirmée' : 'demande de réservation');
      DB.ajouter('reservations', o);
    } finally { liberer_(lock); }
    journalSecu_(u.email, 'reservation_creee', o.id + ' · ' + m.nom + ' · ' + periodeTexte_(o) + ' · ' + o.statut);
    try { if (o.statut === 'attente') notifierResa_('resa_recue', [u.email], o, m, null, ''); else notifierResa_('resa_confirmee', [u.email], o, m, null, ''); notifierResa_('resa_nouvelle', destinatairesMateriel_(m), o, m, u, ''); } catch (e) { console.error(e); }
    return resaPublique_(o, u, { [m.id]: m.nom });
  });
}
// Annuler (réservant si autorisé, gestionnaire), confirmer ou refuser (gestionnaire)
function api_actionReservation(sid, id, action, motif) {
  return appel_(sid, ['materiel_voir', 'reservations_gerer'], u => {
    const gere = peut_(u, 'reservations_gerer');
    if (['annuler', 'confirmer', 'refuser'].indexOf(action) < 0) throw Oups_('Action inconnue.');
    if (action !== 'annuler' && !gere) throw Oups_('Votre rôle ne permet pas de valider ou refuser une réservation.');
    motif = txtM_(motif, 500);
    let r, m, avant;
    const lock = verrouMateriel_();
    try {
      DB.relire();
      r = reservationsLignes_().find(x => x.id === String(id || ''));
      if (!r || (!gere && r.email !== u.email)) throw Oups_('Cette réservation n\'existe pas ou ne vous est pas accessible.');
      const pub = resaPublique_(r, u, {}); avant = pub.statut;
      m = materielLignes_().find(x => x.id === r.materiel_id);
      if (action === 'annuler' && !pub.peut_annuler) throw Oups_(RESA_BLOQUANTS.indexOf(pub.statut) < 0 ? 'Cette réservation est déjà ' + ({ refusee: 'refusée', annulee: 'annulée', terminee: 'terminée' }[pub.statut] || 'close') + '.' : 'Cette réservation a commencé : seule l\'équipe peut l\'annuler.');
      if (action !== 'annuler' && pub.statut !== 'attente') throw Oups_('Cette réservation n\'est plus en attente (état modifié entre-temps).');
      if (action === 'refuser' && !motif) throw Oups_('Indiquez le motif du refus : il est envoyé à la personne.');
      if (action === 'confirmer') {
        const raison = raisonNonReservable_(m); if (raison) throw Oups_(raison + ' La réservation ne peut pas être confirmée.');
        const c = conflits_(r.materiel_id, r.debut, r.fin, r.id).filter(x => x.statut === 'confirmee');
        if (c.length) throw Oups_('Le matériel est déjà réservé (confirmé) sur une partie de cette période.');
      }
      const statut = { annuler: 'annulee', confirmer: 'confirmee', refuser: 'refusee' }[action];
      const patch = { statut: statut, maj_le: maintenant_(), motif: motif || (action === 'confirmer' ? '' : r.motif), suivi: ajouterSuivi_(r, u, { annuler: 'annulation', confirmer: 'validation', refuser: 'refus' }[action] + (motif ? ' — ' + motif : '')) };
      if (action !== 'annuler') patch.decide_par = u.email;
      DB.modifier('reservations', 'id', r.id, patch);
      r = Object.assign({}, r, patch);
    } finally { liberer_(lock); }
    journalSecu_(u.email, 'reservation_' + { annuler: 'annulee', confirmer: 'confirmee', refuser: 'refusee' }[action], r.id + ' · ' + (m ? m.nom : r.materiel_id) + ' · ' + periodeTexte_(r) + (motif ? ' · ' + motif : ''));
    try {
      if (action === 'confirmer') notifierResa_('resa_confirmee', [r.email], r, m, u, motif);
      else if (action === 'refuser') notifierResa_('resa_refusee', [r.email], r, m, u, motif);
      else if (r.email === u.email) notifierResa_('resa_annulee', destinatairesMateriel_(m).filter(d => d !== u.email), r, m, u, motif);
      else notifierResa_('resa_annulee', [r.email], r, m, u, motif);
    } catch (e) { console.error(e); }
    return resaPublique_(r, u, nomsMateriel_());
  });
}
// Modifier une réservation (gestionnaire) : matériel, période, lieu, commentaire — mêmes contrôles qu'une création
function api_modifierReservation(sid, id, champs) {
  return appel_(sid, 'reservations_gerer', u => {
    champs = champs || {};
    let r, m, important = false;
    const lock = verrouMateriel_();
    try {
      DB.relire();
      r = reservationsLignes_().find(x => x.id === String(id || ''));
      if (!r) throw Oups_('Cette réservation n\'existe plus.');
      if (RESA_BLOQUANTS.indexOf(statutEffectif_(r)) < 0) throw Oups_('Seule une réservation en attente ou confirmée (non terminée) peut être modifiée.');
      const mid = champs.materiel_id ? String(champs.materiel_id) : r.materiel_id;
      m = materielLignes_().find(x => x.id === mid);
      if (!m) throw Oups_('Ce matériel n\'existe plus.');
      const p = champs.debut ? periode_(champs, u) : { debut: r.debut, fin: r.fin, journee: r.journee };
      important = mid !== r.materiel_id || p.debut !== r.debut || p.fin !== r.fin;
      if (important) {
        const raison = raisonNonReservable_(m); if (raison) throw Oups_(raison);
        const c = conflits_(mid, p.debut, p.fin, r.id);
        if (c.length) throw Oups_('Ce matériel est déjà réservé sur cette période (' + c.map(periodeTexte_).join(' ; ') + ').');
      }
      const patch = { materiel_id: mid, debut: p.debut, fin: p.fin, journee: p.journee, maj_le: maintenant_() };
      if (champs.lieu !== undefined) patch.lieu = txtM_(champs.lieu, 200);
      if (champs.commentaire !== undefined) patch.commentaire = txtM_(champs.commentaire, 1000);
      patch.suivi = ajouterSuivi_(r, u, 'modification' + (important ? ' : ' + m.nom + ', ' + periodeTexte_(Object.assign({}, r, patch)) : ''));
      DB.modifier('reservations', 'id', r.id, patch);
      r = Object.assign({}, r, patch);
    } finally { liberer_(lock); }
    journalSecu_(u.email, 'reservation_modifiee', r.id + ' · ' + m.nom + ' · ' + periodeTexte_(r));
    if (important && r.email !== u.email) { try { notifierResa_('resa_modifiee', [r.email], r, m, u, txtM_(champs.motif, 500)); } catch (e) { console.error(e); } }
    return resaPublique_(r, u, nomsMateriel_());
  });
}

// ---------- Catalogue (permission materiel_gerer) ----------
function api_enregistrerMateriel(sid, x) {
  return appel_(sid, 'materiel_gerer', u => {
    x = x || {};
    const c = config_().materiel;
    const o = { nom: txtM_(x.nom, 120), categorie: c.categories.indexOf(String(x.categorie || '')) > -1 ? String(x.categorie) : '', description: txtM_(x.description, 2000), reference: txtM_(x.reference, 60),
      localisation: txtM_(x.localisation, 160), etat: MATERIEL_ETATS.indexOf(x.etat) > -1 ? x.etat : 'disponible', conditions: txtM_(x.conditions, 2000), maintenance: txtM_(x.maintenance, 1000),
      maintenance_date: MOTIF_JOUR.test(String(x.maintenance_date || '')) ? String(x.maintenance_date) : '', validation: ['auto', 'admin'].indexOf(x.validation) > -1 ? x.validation : '', ordre: Number(x.ordre) || 0, maj_le: maintenant_(), maj_par: u.email };
    if (!o.nom) throw Oups_('Le nom du matériel est obligatoire.');
    const resp = String(x.responsable || '').trim().toLowerCase();
    if (resp) { const p = DB.trouver('utilisateurs', 'email', resp); if (!p || etatAcces_(p) !== 'ok') throw Oups_('Le responsable doit être un utilisateur actif du Centre Com.'); }
    o.responsable = resp;
    let photo;
    if (x.photo !== undefined) {
      photo = String(x.photo || '');
      if (photo) { const mm = photo.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/); if (!mm || photo.length > 49000 || !typeImage_(decoder64_(mm[2]))) throw Oups_('Photo invalide : choisissez une image JPG, PNG ou WEBP.'); }
    }
    let id = String(x.id || ''), alerte = 0;
    const lock = verrouMateriel_();
    try {
      DB.relire();
      const L = materielLignes_();
      if (o.reference && L.some(m => m.id !== id && m.reference && m.reference.toLowerCase() === o.reference.toLowerCase())) throw Oups_('La référence « ' + o.reference + ' » est déjà utilisée par un autre matériel.');
      if (id) {
        const av = L.find(m => m.id === id);
        if (!av) throw Oups_('Ce matériel a été supprimé entre-temps.');
        DB.modifier('materiel', 'id', id, o);
        if (o.etat !== 'disponible') { const now = minuteActuelle_(); alerte = reservationsLignes_().filter(r => r.materiel_id === id && RESA_BLOQUANTS.indexOf(r.statut) > -1 && r.fin > now).length; }
      } else {
        id = 'M-' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
        DB.ajouter('materiel', Object.assign({ id: id, actif: 'OUI', archive: '', cree_le: maintenant_(), cree_par: u.email }, o));
      }
      if (photo !== undefined && !galIndex_(id).lignes.length) {   // ancienne photo unique (la galerie, si elle existe, décide de la photo principale)
        const ex = DB.tout('materiel_photos').find(p => p.id === id);
        if (photo && ex) DB.modifier('materiel_photos', 'id', id, { mini: photo });
        else if (photo) DB.ajouter('materiel_photos', { id: id, mini: photo });
        else if (ex) DB.supprimer('materiel_photos', 'id', id);
      }
    } finally { liberer_(lock); }
    journalSecu_(u.email, x.id ? 'materiel_modifie' : 'materiel_cree', id + ' · ' + o.nom);
    const m = materielLignes_().find(z => z.id === id);
    return { materiel: materielPublic_(m, u, photosMateriel_(), false, nbPhotosMat_(m.id)), reservations_a_revoir: alerte };
  });
}
// Désactiver / réactiver / archiver / désarchiver. Les réservations à venir sont annulées (et les personnes prévenues)
// seulement après confirmation explicite (confirmation = 'ANNULER').
function api_etatMateriel(sid, id, action, confirmation) {
  return appel_(sid, 'materiel_gerer', u => {
    const A = { desactiver: { actif: 'NON' }, reactiver: { actif: 'OUI' }, archiver: { archive: 'OUI', actif: 'NON' }, desarchiver: { archive: '' } }[action];
    if (!A) throw Oups_('Action inconnue.');
    let m, annulees = [];
    const lock = verrouMateriel_();
    try {
      DB.relire();
      m = materielLignes_().find(x => x.id === String(id || ''));
      if (!m) throw Oups_('Ce matériel n\'existe plus.');
      if (action === 'desactiver' || action === 'archiver') {
        const now = minuteActuelle_();
        const futures = reservationsLignes_().filter(r => r.materiel_id === m.id && RESA_BLOQUANTS.indexOf(r.statut) > -1 && r.fin > now);
        if (futures.length && confirmation !== 'ANNULER') return { besoin_confirmation: true, reservations: futures.length };
        futures.forEach(r => { const patch = { statut: 'annulee', maj_le: maintenant_(), motif: 'Matériel retiré du catalogue', suivi: ajouterSuivi_(r, u, 'annulation (matériel ' + (action === 'archiver' ? 'archivé' : 'désactivé') + ')') }; DB.modifier('reservations', 'id', r.id, patch); annulees.push(Object.assign({}, r, patch)); });
      }
      DB.modifier('materiel', 'id', m.id, Object.assign({ maj_le: maintenant_(), maj_par: u.email }, A));
    } finally { liberer_(lock); }
    journalSecu_(u.email, 'materiel_' + action, m.id + ' · ' + m.nom + (annulees.length ? ' · ' + annulees.length + ' réservation(s) annulée(s)' : ''));
    annulees.forEach(r => { try { notifierResa_('resa_annulee', [r.email], r, m, u, 'Le matériel a été retiré du catalogue.'); } catch (e) { } });
    const n = materielLignes_().find(z => z.id === m.id);
    return { materiel: materielPublic_(n, u, photosMateriel_(), false, nbPhotosMat_(n.id)), annulees: annulees.length };
  });
}

// ---------- Galerie de photos du matériel (3.30) : nombre libre de photos, ordre, photo principale ----------
// Onglet « Galerie du matériel » : une ligne par photo — vignette (≤ 320 px) et grande image découpée en morceaux de
// 48 000 caractères (limite d'une cellule). La PREMIÈRE photo est la photo principale ; sa vignette est recopiée dans
// « Photos du matériel » : le catalogue reste aussi léger qu'avant. Un matériel sans galerie garde son ancienne photo,
// reprise dans la galerie à la première modification. Lecture ciblée : seules les lignes du matériel, et les morceaux
// de la grande image uniquement à l'affichage en grand.
const GAL_MORCEAU = 48000, GAL_MORCEAUX = 4;
const GAL_COLS_LEGERES = [['pid', 'materiel_id', 'ordre', 'mini'], ['largeur', 'hauteur', 'ajoute_le', 'ajoute_par']];
function galIndex_(mid) {
  ongletsMateriel_();
  const sh = DB.feuille('materiel_galerie'), n = sh.getLastRow() - 1, j = TABLES.materiel_galerie.cols.indexOf('materiel_id') + 1, L = [];
  if (n < 1 || !mid) return { sh: sh, lignes: L };
  const col = sh.getRange(2, j, n, 1).getDisplayValues();
  for (let i = 0; i < n; i++) if (col[i][0] === mid) L.push(i + 2);
  return { sh: sh, lignes: L };
}
function galerieLignes_(mid) {
  const X = galIndex_(mid), cols = TABLES.materiel_galerie.cols;
  if (!X.lignes.length) return [];
  const a = X.lignes[0], nb = X.lignes[X.lignes.length - 1] - a + 1;
  const blocs = GAL_COLS_LEGERES.map(g => ({ g: g, v: X.sh.getRange(a, cols.indexOf(g[0]) + 1, nb, g.length).getDisplayValues() }));
  return X.lignes.map(r => { const o = { _ligne: r }; blocs.forEach(b => b.g.forEach((k, i) => o[k] = b.v[r - a][i])); return o; })
    .sort((x, y) => (Number(x.ordre) || 0) - (Number(y.ordre) || 0) || String(x.ajoute_le).localeCompare(String(y.ajoute_le)));
}
// Nombre de photos d'un matériel (galerie, sinon ancienne photo unique)
function nbPhotosMat_(mid) { try { return galIndex_(mid).lignes.length || (photosMateriel_()[mid] ? 1 : 0); } catch (e) { return photosMateriel_()[mid] ? 1 : 0; } }
const galPublique_ = p => ({ pid: p.pid, mini: p.mini, l: Number(p.largeur) || 0, h: Number(p.hauteur) || 0 });
function galerie_(mid) {
  const L = galerieLignes_(mid);
  if (L.length) return L.map(galPublique_);
  const anc = DB.tout('materiel_photos').find(p => p.id === mid);
  return anc && anc.mini ? [{ pid: 'ancienne', mini: anc.mini, l: 0, h: 0 }] : [];
}
// Vignette de la photo principale (première) recopiée pour le catalogue ; aucune photo : vignette retirée
function synchroPrincipale_(mid) {
  const L = galerieLignes_(mid), mini = L.length ? L[0].mini : '';
  const ex = DB.tout('materiel_photos').find(p => p.id === mid);
  if (mini && ex) { if (ex.mini !== mini) DB.modifier('materiel_photos', 'id', mid, { mini: mini }); }
  else if (mini) DB.ajouter('materiel_photos', { id: mid, mini: mini });
  else if (ex) DB.supprimer('materiel_photos', 'id', mid);
}
const nouveauPid_ = () => 'P-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12);
// Ancienne photo unique (avant 3.30) reprise comme première photo de la galerie (rien n'est perdu)
function migrerAncienne_(mid, u) {
  if (galIndex_(mid).lignes.length) return '';
  const anc = DB.tout('materiel_photos').find(p => p.id === mid);
  if (!anc || !anc.mini) return '';
  const pid = nouveauPid_();
  DB.ajouter('materiel_galerie', { pid: pid, materiel_id: mid, ordre: 0, mini: anc.mini, ajoute_le: maintenant_(), ajoute_par: u.email });
  return pid;
}
function imageDataUrl_(s, max) {
  s = String(s || '');
  const m = s.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m || s.length > max || !typeImage_(decoder64_(m[2]))) throw Oups_('Photo invalide : choisissez une image JPG, PNG ou WEBP.');
  return s;
}
function reponseGalerie_(mid, u) {
  const m = materielLignes_().find(x => x.id === mid), ph = galerie_(mid);
  return { photos: ph, materiel: m ? materielPublic_(m, u, photosMateriel_(), false, ph.length) : null };
}
function materielGere_(id) { const m = materielLignes_().find(x => x.id === String(id || '')); if (!m) throw Oups_('Ce matériel n\'existe plus.'); return m; }

// Lecture : vignettes de toutes les photos (ordre, principale en premier), puis une grande image à la demande
function api_photosMateriel(sid, id) {
  return appel_(sid, 'materiel_voir', u => {
    const m = materielLignes_().find(x => x.id === String(id || ''));
    if (!visibleMateriel_(m, u)) throw Oups_('Ce matériel n\'existe pas ou ne vous est pas accessible.');
    return { photos: galerie_(m.id) };
  });
}
function api_photoMateriel(sid, id, pid) {
  return appel_(sid, 'materiel_voir', u => {
    const m = materielLignes_().find(x => x.id === String(id || ''));
    if (!visibleMateriel_(m, u)) throw Oups_('Ce matériel n\'existe pas ou ne vous est pas accessible.');
    pid = String(pid || '');
    if (pid === 'ancienne') { const anc = DB.tout('materiel_photos').find(p => p.id === m.id); return { pid: pid, grande: anc ? anc.mini : '' }; }
    const p = galerieLignes_(m.id).find(x => x.pid === pid);
    if (!p) throw Oups_('Cette photo n\'existe plus.');
    const cols = TABLES.materiel_galerie.cols, g = DB.feuille('materiel_galerie').getRange(p._ligne, cols.indexOf('p1') + 1, 1, GAL_MORCEAUX).getDisplayValues()[0].join('');
    return { pid: pid, grande: g || p.mini };
  });
}
// Ajout d'une photo (en dernière position ; la première ajoutée devient la principale)
function api_ajouterPhotoMateriel(sid, id, ph) {
  return appel_(sid, 'materiel_gerer', u => {
    ph = ph || {};
    const mini = imageDataUrl_(ph.mini, 49000), grande = ph.grande ? imageDataUrl_(ph.grande, GAL_MORCEAU * GAL_MORCEAUX) : '';
    let m;
    const lock = verrouMateriel_();
    try {
      DB.relire();
      m = materielGere_(id);
      migrerAncienne_(m.id, u);
      const L = galerieLignes_(m.id);
      const o = { pid: nouveauPid_(), materiel_id: m.id, ordre: L.length ? Math.max.apply(null, L.map(p => Number(p.ordre) || 0)) + 1 : 0, mini: mini,
        largeur: Math.max(0, Math.round(Number(ph.l) || 0)) || '', hauteur: Math.max(0, Math.round(Number(ph.h) || 0)) || '', ajoute_le: maintenant_(), ajoute_par: u.email };
      for (let i = 0; i < GAL_MORCEAUX; i++) o['p' + (i + 1)] = grande.slice(i * GAL_MORCEAU, (i + 1) * GAL_MORCEAU);
      DB.ajouter('materiel_galerie', o);
      if (!L.length) synchroPrincipale_(m.id);
    } finally { liberer_(lock); }
    journalSecu_(u.email, 'materiel_photos', m.id + ' · ' + m.nom + ' · photo ajoutée');
    return reponseGalerie_(m.id, u);
  });
}
// Nouvel ordre (liste complète des photos) : la première devient la photo principale
function api_organiserPhotosMateriel(sid, id, pids) {
  return appel_(sid, 'materiel_gerer', u => {
    let m;
    const lock = verrouMateriel_();
    try {
      DB.relire();
      m = materielGere_(id);
      const anc = migrerAncienne_(m.id, u);
      pids = (Array.isArray(pids) ? pids : []).map(p => String(p) === 'ancienne' && anc ? anc : String(p));
      const L = galerieLignes_(m.id);
      if (pids.length !== L.length || new Set(pids).size !== pids.length || L.some(p => pids.indexOf(p.pid) < 0)) throw Oups_('Les photos ont été modifiées entre-temps : la galerie a été rechargée, recommencez.');
      const sh = DB.feuille('materiel_galerie'), jo = TABLES.materiel_galerie.cols.indexOf('ordre') + 1;
      L.forEach(p => { const k = String(pids.indexOf(p.pid)); if (k !== String(p.ordre)) sh.getRange(p._ligne, jo).setNumberFormat('@').setValue(k); });
      synchroPrincipale_(m.id);
    } finally { liberer_(lock); }
    return reponseGalerie_(m.id, u);
  });
}
function api_supprimerPhotoMateriel(sid, id, pid) {
  return appel_(sid, 'materiel_gerer', u => {
    let m;
    pid = String(pid || '');
    const lock = verrouMateriel_();
    try {
      DB.relire();
      m = materielGere_(id);
      if (pid === 'ancienne') { if (!galIndex_(m.id).lignes.length && DB.tout('materiel_photos').some(p => p.id === m.id)) DB.supprimer('materiel_photos', 'id', m.id); }
      else {
        const p = galerieLignes_(m.id).find(x => x.pid === pid);
        if (!p) throw Oups_('Cette photo a déjà été supprimée.');
        DB.feuille('materiel_galerie').deleteRow(p._ligne);
        synchroPrincipale_(m.id);
      }
    } finally { liberer_(lock); }
    journalSecu_(u.email, 'materiel_photos', m.id + ' · ' + m.nom + ' · photo supprimée');
    return reponseGalerie_(m.id, u);
  });
}

// =====================================================================
// 25. QUOTIDIEN (3.26) : projets, mentions, modèles de demande, actions groupées, fichiers d'une demande en ZIP,
// calendrier relié (échéances, réservations), rappels. Tout réutilise les tables, droits et notifications existants :
// aucun fichier n'est copié (un projet ne garde que des liens vers des éléments existants, chacun montré selon SES droits).
// =====================================================================
const PROJET_TYPES = ['demande', 'evenement', 'ressource', 'album', 'materiel'];
const PROJET_STATUTS = ['actif', 'termine', 'archive'];
const PROJET_LIENS_MAX = 150;
function projetsLignes_() { const c = CacheService.getScriptCache(); if (!c.get('onglet_projets')) { assurerOnglet_('projets'); try { c.put('onglet_projets', '1', 21600); } catch (e) { } } return DB.tout('projets'); }
function liensProjet_(p) { try { const l = JSON.parse(p.liens || '[]'); return Array.isArray(l) ? l.filter(x => x && PROJET_TYPES.indexOf(x.t) > -1 && x.id).map(x => ({ t: x.t, id: String(x.id) })) : []; } catch (e) { return []; } }
// Un élément de projet tel que CETTE personne peut le voir (null = absent ou non accessible : jamais montré)
function elementProjet_(u, t, id, ctx) {
  if (t === 'demande') { const d = ctx.dem[id]; return d && peutVoir_(u, d) ? { t: t, id: id, titre: d.titre, sous: d.id + ' · ' + labelStatut_(d.statut) + (d.echeance ? ' · pour le ' + dateFr_(d.echeance) : ''), ferme: estFerme_(d.statut), date: d.echeance } : null; }
  if (t === 'evenement') { if (!peut_(u, 'calendrier_voir')) return null; const e = ctx.cal[id]; return e ? { t: t, id: id, titre: e.titre, sous: dateFr_(e.date) + (e.date_fin && e.date_fin !== e.date ? ' → ' + dateFr_(e.date_fin) : '') + ' · ' + e.categorie + (e.ul ? ' · ' + e.ul : ''), date: e.date } : null; }
  if (t === 'ressource') { if (!peut_(u, 'ressources_voir')) return null; const r = ctx.res()[id]; return r ? { t: t, id: id, titre: r.titre, sous: (r.rubrique || r.categorie || '') + (r.type === 'fichier' ? ' · fichier' : ' · lien'), url: r.type !== 'fichier' ? r.url || '' : '' } : null; }
  if (t === 'album') { if (!peut_(u, 'phototheque_voir')) return null; const a = ctx.alb()[id]; return a ? { t: t, id: id, titre: a.titre, sous: pluriel_(a.nb || 0, 'photo', 'photos') } : null; }
  if (t === 'materiel') { if (!peut_(u, 'materiel_voir')) return null; const m = ctx.mat[id]; return m && visibleMateriel_(m, u) ? { t: t, id: id, titre: m.nom, sous: m.categorie || '' } : null; }
  return null;
}
function pluriel_(n, un, plusieurs) { return n + ' ' + (n > 1 ? plusieurs : un); }
function contexteProjet_(u) {
  const ctx = { dem: {}, cal: {}, mat: {} }; let R = null, A = null;
  DB.tout('demandes').forEach(d => ctx.dem[d.id] = d);
  DB.tout('calendrier').forEach(e => ctx.cal[e.id] = e);
  try { materielLignes_().forEach(m => ctx.mat[m.id] = m); } catch (e) { }
  ctx.res = () => { if (!R) { R = {}; try { ressourcesVisibles_(u).forEach(r => R[r.id] = r); } catch (e) { } } return R; };
  ctx.alb = () => { if (!A) { A = {}; try { const vis = {}; indexPhotos_().forEach(p => { if (photoVisible_(u, p)) vis[p.id] = true; }); albumsVisibles_(u, vis).forEach(a => A[a.id] = a); } catch (e) { } } return A; };
  return ctx;
}
function projetPublic_(p, u, ctx, avecElements) {
  const L = liensProjet_(p), el = L.map(x => elementProjet_(u, x.t, x.id, ctx)).filter(Boolean);
  const o = { id: p.id, titre: p.titre, description: p.description, statut: PROJET_STATUTS.indexOf(p.statut) > -1 ? p.statut : 'actif', responsable: p.responsable, responsable_nom: nomDe_(p.responsable), echeance: p.echeance, ul: p.ul,
    cree_le: p.cree_le, maj_le: p.maj_le, nb: el.length, masques: L.length - el.length, compte: {} };
  el.forEach(x => o.compte[x.t] = (o.compte[x.t] || 0) + 1);
  o.demandes_ouvertes = el.filter(x => x.t === 'demande' && !x.ferme).length;
  o.refs = el.map(x => x.t + ':' + x.id);   // éléments VISIBLES seulement (pour retrouver les projets d'un élément)
  if (avecElements) o.elements = el;
  return o;
}
function listeProjets_(u) { const ctx = contexteProjet_(u); return projetsLignes_().map(p => projetPublic_(p, u, ctx, false)).sort((a, b) => String(b.maj_le).localeCompare(String(a.maj_le))); }
function api_projets(sid) {
  return appel_(sid, 'projets_voir', u => { return { projets: listeProjets_(u), gerer: peut_(u, 'projets_gerer') }; });
}
function api_projet(sid, id) {
  return appel_(sid, 'projets_voir', u => {
    const p = projetsLignes_().find(x => x.id === String(id || ''));
    if (!p) throw Oups_('Ce projet n\'existe plus.');
    return Object.assign(projetPublic_(p, u, contexteProjet_(u), true), { gerer: peut_(u, 'projets_gerer') });
  });
}
function api_enregistrerProjet(sid, x) {
  return appel_(sid, 'projets_gerer', u => {
    x = x || {}; projetsLignes_();
    const o = { titre: String(x.titre || '').trim().slice(0, 160), description: String(x.description || '').trim().slice(0, 3000), statut: PROJET_STATUTS.indexOf(x.statut) > -1 ? x.statut : 'actif',
      responsable: String(x.responsable || '').trim().toLowerCase().slice(0, 200), echeance: MOTIF_JOUR.test(String(x.echeance || '')) ? x.echeance : '', ul: String(x.ul || '').slice(0, 120), maj_le: maintenant_(), maj_par: u.email };
    if (!o.titre) throw Oups_('Donnez un nom au projet.');
    if (o.responsable && !DB.trouver('utilisateurs', 'email', o.responsable)) throw Oups_('Cette personne ne fait pas partie des utilisateurs.');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      if (x.id) {
        const p = DB.trouver('projets', 'id', String(x.id)); if (!p) throw Oups_('Ce projet n\'existe plus.');
        DB.modifier('projets', 'id', p.id, o);
        if (o.responsable && o.responsable !== p.responsable && o.responsable !== u.email) notifier_([o.responsable], { type: 'demande', titre: 'Projet qui vous est confié : ' + o.titre, texte: 'par ' + (nomDe_(u.email) || u.email), lien: 'projet:' + p.id, cle: 'projet:' + p.id + ':resp', perm: 'projets_voir' }, u.email, true);
        return { id: p.id };
      }
      const id = 'PJ' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
      DB.ajouter('projets', Object.assign({ id: id, liens: '[]', cree_par: u.email, cree_le: maintenant_() }, o));
      journalSecu_(u.email, 'projet_cree', o.titre);
      if (o.responsable && o.responsable !== u.email) notifier_([o.responsable], { type: 'demande', titre: 'Projet qui vous est confié : ' + o.titre, texte: 'par ' + (nomDe_(u.email) || u.email), lien: 'projet:' + id, cle: 'projet:' + id + ':resp', perm: 'projets_voir' }, u.email, true);
      return { id: id };
    } finally { lock.releaseLock(); }
  });
}
function api_supprimerProjet(sid, id) {
  return appel_(sid, 'projets_gerer', u => {
    projetsLignes_();
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try { DB.relire(); const p = DB.trouver('projets', 'id', String(id || '')); if (!p) throw Oups_('Ce projet n\'existe plus.'); supprimerLignesPar_('projets', 'id', [p.id]); journalSecu_(u.email, 'projet_supprime', p.titre); return true; }
    finally { lock.releaseLock(); }
  });
}
// Lier / retirer un élément : seulement un élément que la personne voit elle-même (jamais un identifiant deviné)
function api_lierProjet(sid, id, t, ref, retirer) {
  return appel_(sid, 'projets_gerer', u => {
    projetsLignes_();
    if (PROJET_TYPES.indexOf(t) < 0) throw Oups_('Type d\'élément inconnu.');
    ref = String(ref || '');
    const lock = LockService.getScriptLock(); lock.waitLock(20000);
    try {
      DB.relire();
      const p = DB.trouver('projets', 'id', String(id || '')); if (!p) throw Oups_('Ce projet n\'existe plus.');
      let L = liensProjet_(p);
      if (retirer === true) L = L.filter(x => !(x.t === t && x.id === ref));
      else {
        if (!elementProjet_(u, t, ref, contexteProjet_(u))) throw Oups_('Cet élément n\'existe pas ou ne vous est pas accessible.');
        if (!L.some(x => x.t === t && x.id === ref)) { if (L.length >= PROJET_LIENS_MAX) throw Oups_('Ce projet a déjà ' + PROJET_LIENS_MAX + ' éléments.'); L.push({ t: t, id: ref }); }
      }
      DB.modifier('projets', 'id', p.id, { liens: JSON.stringify(L), maj_le: maintenant_(), maj_par: u.email });
      return projetPublic_(Object.assign({}, p, { liens: JSON.stringify(L) }), u, contexteProjet_(u), true);
    } finally { lock.releaseLock(); }
  });
}
// Éléments que la personne peut ajouter (recherche) : uniquement ce qu'elle voit déjà dans le Centre Com
function api_candidatsProjet(sid, t, q) {
  return appel_(sid, 'projets_gerer', u => {
    const mots = NORM_(q).split(/\s+/).filter(x => x.length > 1), ok = s => !mots.length || mots.every(m => NORM_(s).indexOf(m) > -1);
    const ctx = contexteProjet_(u); let ids = [];
    if (t === 'demande') ids = DB.tout('demandes').filter(d => peutVoir_(u, d) && ok([d.id, d.titre, d.ul].join(' '))).sort((a, b) => String(b.cree_le).localeCompare(String(a.cree_le))).map(d => d.id);
    else if (t === 'evenement') ids = peut_(u, 'calendrier_voir') ? DB.tout('calendrier').filter(e => ok([e.titre, e.categorie, e.ul, e.date].join(' '))).sort((a, b) => String(b.date).localeCompare(String(a.date))).map(e => e.id) : [];
    else if (t === 'ressource') ids = Object.keys(ctx.res()).filter(k => ok([ctx.res()[k].titre, ctx.res()[k].rubrique].join(' ')));
    else if (t === 'album') ids = Object.keys(ctx.alb()).filter(k => ok(ctx.alb()[k].titre));
    else if (t === 'materiel') ids = Object.keys(ctx.mat).filter(k => ok([ctx.mat[k].nom, ctx.mat[k].categorie].join(' ')));
    else throw Oups_('Type d\'élément inconnu.');
    return ids.slice(0, 60).map(id => elementProjet_(u, t, id, ctx)).filter(Boolean).slice(0, 30);
  });
}
// Projets qui contiennent un élément (fiche d'une demande…) : visibles seulement avec projets_voir
function projetsDe_(u, t, id) {
  if (!peut_(u, 'projets_voir')) return [];
  try { return projetsLignes_().filter(p => liensProjet_(p).some(x => x.t === t && x.id === String(id))).map(p => ({ id: p.id, titre: p.titre, statut: p.statut })); } catch (e) { return []; }
}

// ---------- Mentions dans les échanges d'une demande ----------
// Personnes qui peuvent être mentionnées : celles qui VOIENT la demande (équipe, demandeur, personnes associées) et ont un
// accès actif ; pour une note interne, seulement celles qui lisent les notes internes. Le navigateur n'envoie que des clés.
function mentionnables_(d, interne) {
  const c = config_(), equipe = DB.tout('utilisateurs');
  const cand = {}; [d.demandeur_email, d.responsable].concat(participants_(d)).forEach(e => { if (e) cand[String(e).toLowerCase()] = true; });
  equipe.forEach(x => { const r = role_(x.role); if (r === 'admin' || ((c.roles[r] || {}).permissions || []).indexOf('demande_traiter') > -1) cand[String(x.email).toLowerCase()] = true; });
  return DB.tout('utilisateurs').filter(x => cand[String(x.email).toLowerCase()] && etatAcces_(x) === 'ok').map(x => Object.assign({}, x, { role: role_(x.role) }))
    .filter(x => peutVoir_(x, d) && (!interne || peut_(x, 'notes_internes')));
}
function api_mentionnables(sid, id, interne) {
  return appel_(sid, 'connecte', u => {
    const d = DB.trouver('demandes', 'id', id);
    if (!d || !peutVoir_(u, d)) throw Oups_('Cette demande n\'existe pas ou ne vous est pas accessible.');
    return mentionnables_(d, interne === true && peut_(u, 'notes_internes')).filter(x => x.email !== u.email).map(x => ({ cle: cleUtilisateur_(x.email), nom: x.nom || x.email }))
      .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
  });
}
function notifierMentions_(u, d, cles, message, interne) {
  if (!Array.isArray(cles) || !cles.length) return 0;
  // Pour un message (pas une note), les personnes déjà prévenues par le circuit habituel ne reçoivent rien de plus (aucun doublon)
  const deja = {}; if (!interne) (peut_(u, 'demande_traiter') ? [d.demandeur_email].concat(participants_(d)) : (d.responsable ? [d.responsable] : destinatairesEquipe_())).forEach(e => { if (e) deja[String(e).toLowerCase()] = true; });
  const voulues = cles.slice(0, 10).map(String), dests = mentionnables_(d, interne).filter(x => x.email !== u.email && !deja[String(x.email).toLowerCase()] && voulues.indexOf(cleUtilisateur_(x.email)) > -1).map(x => x.email);
  if (!dests.length) return 0;
  notifier_(dests, { type: 'message', titre: (nomDe_(u.email) || u.email) + ' vous mentionne : ' + d.titre, texte: String(message).slice(0, 200), lien: 'demande:' + d.id, cle: 'mention:' + d.id + ':' + Date.now().toString(36) }, u.email);
  if (config_().notifications.mentions !== false) dests.forEach(e => mailModele_(e, 'mention', variablesDemande_(d, { auteur: nomDe_(u.email) || u.email, prenom: prenom_(nomDe_(e)) }), citation_(message) + bouton_('Ouvrir la demande', lienPour_(e, d.id))));
  return dests.length;
}

// ---------- Actions groupées sur les demandes (équipe) : mêmes règles que pour une demande seule ----------
function api_actionsDemandes(sid, ids, patch) {
  return appel_(sid, 'demande_traiter', u => {
    ids = (Array.isArray(ids) ? ids : []).map(String).slice(0, 100);
    if (!ids.length) throw Oups_('Aucune demande choisie.');
    patch = patch || {}; const p = {};
    ['statut', 'responsable', 'echeance'].forEach(k => { if (patch[k] !== undefined && patch[k] !== null) p[k] = String(patch[k]); });
    if (!Object.keys(p).length) throw Oups_('Aucune modification demandée.');
    if (patch.message) p.message = String(patch.message).slice(0, 5000);
    const ok = [], erreurs = [];
    ids.forEach(id => { try { modifierDemande_(u, id, p); ok.push(id); } catch (e) { erreurs.push({ id: id, message: String((e && e.message) || e) }); } });
    return { ok: ok, erreurs: erreurs, demandes: ok.map(id => { const d = DB.trouver('demandes', 'id', id); return d ? publicDemande_(d, u) : null; }).filter(Boolean) };
  });
}

// ---------- Fichiers d'une demande en un seul ZIP (mêmes droits que chaque fichier) ----------
const ZIP_PIECES_MAX_MO = 25;
function api_piecesZip(sid, id) {
  return appel_(sid, 'connecte', u => {
    const d = DB.trouver('demandes', 'id', String(id || ''));
    if (!d || !peutVoir_(u, d)) throw Oups_('Cette demande n\'existe pas ou ne vous est pas accessible.');
    const P = piecesDe_(u, 'demande', d.id);
    if (!P.length) throw Oups_('Aucun fichier dans cette demande.');
    const noms = {}, blobs = []; let total = 0;
    P.forEach(p => {
      const x = lirePiece_(u, p.id); total += x.f.getSize();
      if (total > ZIP_PIECES_MAX_MO * 1048576) throw Oups_('Fichiers trop lourds pour un seul téléchargement (' + ZIP_PIECES_MAX_MO + ' Mo au plus) : téléchargez-les un par un.');
      let n = nomFichier_(x.p.nom || x.f.getName()); const base = n.replace(/(\.[^.]+)$/, ''), ext = (n.match(/\.[^.]+$/) || [''])[0];
      let k = 1; while (noms[n.toLowerCase()]) n = base + '_' + (++k) + ext; noms[n.toLowerCase()] = true;
      blobs.push(Utilities.newBlob(octetsDe_(x.f), x.p.mime || x.f.getMimeType(), n));
    });
    const nom = 'demande_' + nomFichier_(d.id) + '_fichiers.zip', zip = Utilities.zip(blobs, nom);
    journalSecu_(u.email, 'fichiers_export', d.id + ' · ' + blobs.length + ' fichier(s)');
    return { nom: nom, nombre: blobs.length, taille: zip.getBytes().length, data: Utilities.base64Encode(zip.getBytes()) };
  });
}

// ---------- Rappels quotidiens (routineQuotidienne) : proposition à valider, réservation, retour du matériel ----------
// Sans marqueur à tenir : chaque rappel correspond à un jour précis (la routine ne tourne qu'une fois par jour).
function rappelsQuotidiens_() {
  const c = config_(), auj = aujourdhui_();
  if (c.notifications.rappels !== false) {
    // Proposition en attente de validation depuis 3 jours, puis 7 jours : rappel au demandeur (et personnes associées)
    DB.tout('demandes').filter(d => classe_(d.statut) === 'a_valider' && [3, 7].indexOf(joursDepuis_(String(d.maj_le).slice(0, 10))) > -1).forEach(d => {
      try {
        const dests = [d.demandeur_email].concat(participants_(d)).filter(Boolean);
        notifier_(dests, { type: 'statut', titre: 'Proposition à valider : ' + d.titre, texte: 'La proposition attend votre validation.', lien: 'demande:' + d.id, cle: 'dem:' + d.id + ':rappel_validation' });
        dests.forEach(e => mailModele_(e, 'rappel_validation', variablesDemande_(d, { prenom: prenom_(nomDe_(e)) }), bouton_('Voir et valider la proposition', lienPour_(e, d.id))));
      } catch (e) { console.error('Rappel de validation : ' + e); }
    });
  }
  if (c.materiel.rappels !== false) {
    let R = []; try { R = reservationsLignes_(); } catch (e) { return; }
    const M = {}; try { materielLignes_().forEach(m => M[m.id] = m); } catch (e) { }
    const demain = isoJour_(new Date(dateDe_(auj).getTime() + 864e5));
    R.filter(r => r.statut === 'confirmee').forEach(r => {
      try {
        const m = M[r.materiel_id] || null, nomM = m ? m.nom : 'matériel';
        let modele = null;
        if (String(r.debut).slice(0, 10) === demain) modele = 'resa_rappel';
        else { const finJour = r.journee === 'OUI' ? isoJour_(new Date(dateDe_(String(r.fin).slice(0, 10)).getTime() - 864e5)) : String(r.fin).slice(0, 10); if (finJour === auj && String(r.debut).slice(0, 10) !== auj) modele = 'resa_retour'; }
        if (!modele) return;
        notifier_([r.email], { type: 'reservation', titre: (modele === 'resa_rappel' ? 'Demain : ' : 'À rendre aujourd\'hui : ') + nomM, texte: periodeTexte_(r) + (r.lieu ? ' · ' + r.lieu : ''), lien: 'materiel:mes', cle: 'resa:' + r.id + ':' + modele });
        if (c.materiel.notifier) mailModele_(r.email, modele, { prenom: prenom_(r.nom), demandeur: r.nom || r.email, materiel: nomM, periode: periodeTexte_(r), lieu: r.lieu || '', statut: 'confirmée', auteur: '', motif: '' },
          tableau_([['Matériel', nomM], ['Période', periodeTexte_(r)], ['Lieu / utilisation', r.lieu || '—']]) + (m && m.conditions ? citation_(m.conditions) : '') + bouton_('Mes réservations', urlOfficielle_() + '?v=materiel'));
      } catch (e) { console.error('Rappel de réservation : ' + e); }
    });
  }
}

// =====================================================================
// 26. DIFFUSION INTERNE (3.28) : message de la délégation à des groupes d'utilisateurs du Centre Com.
// Réutilise : notifications (cloche, lien vers le message), e-mails (modèle « diffusion »), pièces jointes (contexte
// « diffusion », Drive partagé), journal. Aucun second système de messagerie : une diffusion ne se répond pas.
// Statuts : brouillon → programmee → envoyee (ou annulee). Permission : diffusion_envoyer (serveur).
// Destinataires calculés AU MOMENT DE L'ENVOI parmi les comptes actifs ; seuls eux (et les gestionnaires) voient le message.
// =====================================================================
const DIFF_STATUTS = ['brouillon', 'programmee', 'envoi', 'envoyee', 'annulee'];
const DIFF_HANDLER = 'envoyerDiffusionsProgrammees';
function diffusionsLignes_() { const c = CacheService.getScriptCache(); if (!c.get('onglet_diffusions')) { assurerOnglet_('diffusions'); try { c.put('onglet_diffusions', '1', 21600); } catch (e) { } } return DB.tout('diffusions'); }
function cibleDiffusion_(x) {
  let c = x; if (typeof c === 'string') { try { c = JSON.parse(c || '{}'); } catch (e) { c = {}; } }
  c = c && typeof c === 'object' ? c : {};
  const ulOk = DB.tout('ul').map(u => u.nom), roles = Object.keys(config_().roles);
  return { tous: c.tous === true, equipe: c.equipe === true, ul: (Array.isArray(c.ul) ? c.ul : []).map(String).filter(v => ulOk.indexOf(v) > -1).slice(0, 60), roles: (Array.isArray(c.roles) ? c.roles : []).map(String).filter(v => roles.indexOf(v) > -1).slice(0, 30) };
}
const cibleVide_ = c => !c.tous && !c.equipe && !c.ul.length && !c.roles.length;
// Destinataires : comptes ACTIFS (jamais un compte désactivé ou révoqué), réunion des groupes choisis, sans l'auteur, sans doublon
function destinatairesDiffusion_(cible, auteurEmail) {
  const c = config_(), vus = {};
  return DB.tout('utilisateurs').filter(x => {
    if (etatAcces_(x) !== 'ok' || !x.email || String(x.email).toLowerCase() === String(auteurEmail || '').toLowerCase()) return false;
    const r = role_(x.role), perms = r === 'admin' ? PERM_CODES : ((c.roles[r] || {}).actif === false ? [] : (c.roles[r] || {}).permissions || []);
    if (r === 'aucun') return false;
    const ok = cible.tous || (cible.ul.indexOf(x.ul) > -1) || (cible.roles.indexOf(r) > -1) || (cible.equipe && perms.indexOf('demande_traiter') > -1);
    const k = String(x.email).toLowerCase(); if (!ok || vus[k]) return false; vus[k] = true; return true;
  });
}
const estDestinataire_ = (u, D) => D.statut === 'envoyee' && (() => { try { return JSON.parse(D.destinataires || '[]').indexOf(u.email) > -1; } catch (e) { return false; } })();
function diffusionVisible_(u, D) { return !!D && (peut_(u, 'diffusion_envoyer') || estDestinataire_(u, D)); }
function resumeCible_(c) {
  const p = [];
  if (c.tous) p.push('Toute la délégation');
  if (c.equipe) p.push('Équipe communication');
  if (c.roles.length) p.push('Rôles : ' + c.roles.map(r => (config_().roles[r] || {}).label || r).join(', '));
  if (c.ul.length) p.push('UL : ' + c.ul.join(', '));
  return p.join(' · ');
}
// Vue d'une diffusion : complète pour les gestionnaires ; message seul pour un destinataire (ni liste ni ciblage)
function diffusionPublique_(D, u, avecPieces) {
  const g = peut_(u, 'diffusion_envoyer');
  const o = { id: D.id, titre: D.titre, message: D.message, statut: D.statut, envoyee_le: D.envoyee_le, auteur_nom: nomDe_(D.cree_par), pieces: avecPieces ? piecesDe_(u, 'diffusion', D.id) : undefined };
  if (g) Object.assign(o, { cible: cibleDiffusion_(D.cible), cible_texte: resumeCible_(cibleDiffusion_(D.cible)), nb: Number(D.nb) || 0, nb_emails: Number(D.nb_emails) || 0, email: D.email === 'OUI', programmee_le: D.programmee_le, cree_le: D.cree_le, maj_le: D.maj_le, cree_par: D.cree_par, gerer: true });
  return o;
}
function api_diffusions(sid) {
  return appel_(sid, 'connecte', u => {
    const L = diffusionsLignes_(), g = peut_(u, 'diffusion_envoyer');
    try { diffusionsDues_(); } catch (e) { console.error(e); }
    const recues = L.filter(D => estDestinataire_(u, D)).sort((a, b) => String(b.envoyee_le).localeCompare(String(a.envoyee_le))).slice(0, 60).map(D => diffusionPublique_(D, u, false));
    const o = { recues: recues, gerer: g };
    if (g) {
      o.toutes = L.slice().sort((a, b) => String(b.maj_le).localeCompare(String(a.maj_le))).slice(0, 200).map(D => diffusionPublique_(D, u, false));
      const c = config_();
      o.groupes = { ul: DB.tout('ul').filter(x => String(x.actif).toUpperCase() !== 'NON').map(x => x.nom), roles: Object.keys(c.roles).filter(k => c.roles[k].actif !== false).map(k => ({ code: k, label: c.roles[k].label || k })) };
      try { o.quota_emails = MailApp.getRemainingDailyQuota(); } catch (e) { o.quota_emails = null; }
    }
    return o;
  });
}
function resumeDiffusions_(u) {
  const L = diffusionsLignes_(), g = peut_(u, 'diffusion_envoyer');
  const l = (g ? L.filter(D => D.statut === 'envoyee') : L.filter(D => estDestinataire_(u, D))).sort((a, b) => String(b.envoyee_le).localeCompare(String(a.envoyee_le))).slice(0, 4);
  return { gerer: g, liste: l.map(D => ({ id: D.id, titre: D.titre, auteur_nom: nomDe_(D.cree_par), envoyee_le: D.envoyee_le })) };
}
function api_diffusion(sid, id) {
  return appel_(sid, 'connecte', u => {
    const D = diffusionsLignes_().find(x => x.id === String(id || ''));
    if (!diffusionVisible_(u, D)) { journalSecu_(u.email, 'refus_diffusion', String(id || '').slice(0, 40)); throw Oups_('Ce message n\'existe pas ou ne vous est pas destiné.'); }
    return diffusionPublique_(D, u, true);
  });
}
// Aperçu : nombre de destinataires et répartition par UL (aucune adresse renvoyée)
function api_apercuDiffusion(sid, cible) {
  return appel_(sid, 'diffusion_envoyer', u => {
    const c = cibleDiffusion_(cible), L = cibleVide_(c) ? [] : destinatairesDiffusion_(c, u.email), parUl = {};
    L.forEach(x => { const k = x.ul || 'Sans UL'; parUl[k] = (parUl[k] || 0) + 1; });
    return { nb: L.length, par_ul: Object.keys(parUl).sort().map(k => [k, parUl[k]]), cible_texte: resumeCible_(c) };
  });
}
// Enregistrer (brouillon), programmer ou envoyer tout de suite
function api_enregistrerDiffusion(sid, x, action) {
  return appel_(sid, 'diffusion_envoyer', u => {
    x = x || {}; diffusionsLignes_();
    if (['brouillon', 'programmer', 'envoyer'].indexOf(action) < 0) throw Oups_('Action inconnue.');
    const c = cibleDiffusion_(x.cible);
    const o = { titre: String(x.titre || '').trim().slice(0, 160), message: String(x.message || '').replace(/\r/g, '').trim().slice(0, 8000), cible: JSON.stringify(c), email: x.email === true ? 'OUI' : '', maj_le: maintenant_(), maj_par: u.email };
    if (!o.titre) throw Oups_('Donnez un titre au message.');
    if (action !== 'brouillon') {
      if (!o.message) throw Oups_('Le message est vide.');
      if (cibleVide_(c)) throw Oups_('Choisissez au moins un groupe de destinataires.');
      if (!destinatairesDiffusion_(c, u.email).length) throw Oups_('Aucun destinataire actif dans les groupes choisis.');
    }
    if (action === 'programmer') {
      const d = dateHeure_(x.programmee_le);
      if (!d) throw Oups_('Date et heure de programmation invalides.');
      if (String(x.programmee_le) <= maintenant_().slice(0, 16)) throw Oups_('Choisissez une date et une heure à venir.');
      if (d.getTime() > Date.now() + 366 * 864e5) throw Oups_('Programmation à un an au plus.');
      o.programmee_le = String(x.programmee_le).slice(0, 16);
    } else o.programmee_le = '';
    o.statut = action === 'programmer' ? 'programmee' : 'brouillon';
    const lock = LockService.getScriptLock(); lock.waitLock(25000);
    let id;
    try {
      DB.relire();
      if (x.id) {
        const D = DB.trouver('diffusions', 'id', String(x.id)); if (!D) throw Oups_('Ce message n\'existe plus.');
        if (['brouillon', 'programmee'].indexOf(D.statut) < 0) throw Oups_('Ce message a déjà été envoyé ou annulé : il ne peut plus être modifié (dupliquez-le).');
        DB.modifier('diffusions', 'id', D.id, o); id = D.id;
      } else {
        id = 'DI' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
        DB.ajouter('diffusions', Object.assign({ id: id, cree_par: u.email, cree_le: maintenant_(), envoyee_le: '', nb: '', nb_emails: '', destinataires: '' }, o));
      }
    } finally { lock.releaseLock(); }
    journalSecu_(u.email, 'diffusion_' + (action === 'programmer' ? 'programmee' : action === 'envoyer' ? 'envoi' : 'brouillon'), o.titre + (o.programmee_le ? ' · ' + o.programmee_le : ''));
    if (action === 'envoyer') envoyerDiffusion_(id, u);
    planifierDiffusions_();
    return diffusionPublique_(DB.trouver('diffusions', 'id', id), u, true);
  });
}
// Annuler une diffusion programmée, ou supprimer un brouillon ; dupliquer une diffusion (nouveau brouillon)
function api_actionDiffusion(sid, id, action) {
  return appel_(sid, 'diffusion_envoyer', u => {
    diffusionsLignes_();
    const lock = LockService.getScriptLock(); lock.waitLock(25000);
    try {
      DB.relire();
      const D = DB.trouver('diffusions', 'id', String(id || '')); if (!D) throw Oups_('Ce message n\'existe plus.');
      if (action === 'annuler') {
        if (D.statut !== 'programmee') throw Oups_('Seul un message programmé peut être annulé.');
        DB.modifier('diffusions', 'id', D.id, { statut: 'annulee', maj_le: maintenant_(), maj_par: u.email });
        journalSecu_(u.email, 'diffusion_annulee', D.titre);
      } else if (action === 'supprimer') {
        if (D.statut !== 'brouillon') throw Oups_('Seul un brouillon peut être supprimé.');
        supprimerLignesPar_('diffusions', 'id', [D.id]);
      } else if (action === 'dupliquer') {
        const n = 'DI' + Utilities.getUuid().replace(/-/g, '').slice(0, 10);
        DB.ajouter('diffusions', { id: n, titre: ('Copie de ' + D.titre).slice(0, 160), message: D.message, cible: D.cible, email: D.email, statut: 'brouillon', programmee_le: '', envoyee_le: '', nb: '', nb_emails: '', destinataires: '', cree_par: u.email, cree_le: maintenant_(), maj_le: maintenant_(), maj_par: u.email });
        return { id: n };
      } else throw Oups_('Action inconnue.');
    } finally { lock.releaseLock(); }
    planifierDiffusions_();
    return { id: String(id) };
  });
}
// Envoi (une seule fois, sous verrou) : notification dans le Centre Com, e-mail si demandé et si le quota le permet
function envoyerDiffusion_(id, auteur) {
  const lock = LockService.getScriptLock(); lock.waitLock(30000);
  let D, dests;
  try {
    DB.relire();
    D = DB.trouver('diffusions', 'id', id);
    if (!D || ['brouillon', 'programmee'].indexOf(D.statut) < 0) return 0;   // déjà envoyée, en cours ou annulée : jamais deux fois
    dests = destinatairesDiffusion_(cibleDiffusion_(D.cible), D.cree_par);
    DB.modifier('diffusions', 'id', D.id, { statut: 'envoi', maj_le: maintenant_() });
    if (dests.length) notifier_(dests.map(x => x.email), { type: 'diffusion', titre: D.titre, texte: String(D.message).replace(/\s+/g, ' ').slice(0, 240), lien: 'diffusion:' + D.id, cle: 'diffusion:' + D.id }, D.cree_par, true);
  } finally { lock.releaseLock(); }
  let mails = 0;
  if (D.email === 'OUI' && dests.length) {
    let quota = 0; try { quota = MailApp.getRemainingDailyQuota(); } catch (e) { }
    const v = { titre: D.titre, auteur: nomDe_(D.cree_par) || D.cree_par };
    const bloc = '<div style="white-space:pre-wrap">' + esc_(D.message) + '</div>' + bouton_('Ouvrir dans le Centre Com', urlOfficielle_() + '?v=diffusions');
    dests.slice(0, Math.max(0, quota - 5)).forEach(x => { try { mailModele_(x.email, 'diffusion', Object.assign({ prenom: prenom_(x.nom) }, v), bloc); mails++; } catch (e) { console.error('Diffusion : e-mail ' + e); } });
  }
  DB.modifier('diffusions', 'id', D.id, { statut: 'envoyee', envoyee_le: maintenant_(), nb: String(dests.length), nb_emails: String(mails), destinataires: JSON.stringify(dests.map(x => x.email)) });
  journalSecu_(auteur ? auteur.email : D.cree_par, 'diffusion_envoyee', D.titre + ' · ' + dests.length + ' destinataire(s)' + (D.email === 'OUI' ? ' · ' + mails + ' e-mail(s)' : ''));
  return dests.length;
}
// Diffusions programmées arrivées à échéance : envoyées par le déclencheur prévu, ou au plus tard à la prochaine activité
function diffusionsDues_() {
  const k = CacheService.getScriptCache(), prochaine = k.get('diff_prochaine');
  if (prochaine === 'aucune') return 0;
  const now = maintenant_().slice(0, 16);
  if (prochaine && prochaine > now) return 0;
  let n = 0;
  diffusionsLignes_().filter(D => D.statut === 'programmee' && D.programmee_le && D.programmee_le <= now).forEach(D => { try { envoyerDiffusion_(D.id, null); n++; } catch (e) { console.error('Diffusion programmée : ' + e); } });
  planifierDiffusions_();
  return n;
}
function envoyerDiffusionsProgrammees() { try { diffusionsDues_(); } catch (e) { console.error(e); } }
// Un seul déclencheur horaire ponctuel, à l'heure de la prochaine diffusion programmée (aucun si rien n'est programmé)
function planifierDiffusions_() {
  DB._cache.diffusions = null;
  const L = diffusionsLignes_().filter(D => D.statut === 'programmee' && D.programmee_le).map(D => D.programmee_le).sort();
  try { CacheService.getScriptCache().put('diff_prochaine', L[0] || 'aucune', 21600); } catch (e) { }
  try {
    ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === DIFF_HANDLER).forEach(t => ScriptApp.deleteTrigger(t));
    if (L[0]) { const d = dateHeure_(L[0]); if (d) ScriptApp.newTrigger(DIFF_HANDLER).timeBased().at(new Date(Math.max(d.getTime(), Date.now() + 60000))).create(); }
  } catch (e) { console.error('Déclencheur des diffusions : ' + e); }
}

// =====================================================================
// 27. FICHIERS DU PROJET (3.30) : export / import des 6 fichiers, duplication pour une autre délégation
// Le CONTENU RÉEL du projet Apps Script est lu et écrit par l'API Apps Script (projects.getContent / updateContent),
// avec le jeton du compte qui exécute l'application. Rien n'est remplacé avant : vérification complète des fichiers
// reçus, confirmation explicite, sauvegarde du projet actuel. Après écriture, le contenu est relu et comparé octet par octet.
// Chaque délégation reste une instance indépendante : sa base, son Drive, ses Propriétés ; seul le code est copié.
// Prérequis (une fois, avec le compte qui exécute l'application) :
//   • https://script.google.com/home/usersettings → « API Google Apps Script » activée ;
//   • appsscript.json → "oauthScopes" contient PROJET_PORTEES (voir Administration > Fichiers du projet).
// =====================================================================
const PROJET_FICHIERS = [
  { nom: 'Code.gs', api: 'Code', type: 'SERVER_JS', mime: 'text/plain' },
  { nom: 'appsscript.json', api: 'appsscript', type: 'JSON', mime: 'application/json' },
  { nom: 'ConfigInitiale.html', api: 'ConfigInitiale', type: 'HTML', mime: 'text/html' },
  { nom: 'Styles.html', api: 'Styles', type: 'HTML', mime: 'text/html' },
  { nom: 'App.html', api: 'App', type: 'HTML', mime: 'text/html' },
  { nom: 'Index.html', api: 'Index', type: 'HTML', mime: 'text/html' },
];
const PROJET_PORTEES = ['https://www.googleapis.com/auth/script.projects', 'https://www.googleapis.com/auth/script.deployments'];
// Portées utilisées par le code (manifeste conseillé quand "oauthScopes" est explicite)
const PROJET_PORTEES_CODE = ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/script.external_request',
  'https://www.googleapis.com/auth/script.send_mail', 'https://www.googleapis.com/auth/script.scriptapp', 'https://www.googleapis.com/auth/userinfo.email'].concat(PROJET_PORTEES);
const PROJET_TAILLE_MAX = 6000000;   // caractères par fichier (Code.gs ≈ 0,5 Mo, App.html ≈ 0,8 Mo)
const defProjet_ = nom => PROJET_FICHIERS.find(d => d.nom === nom) || null;

// ---------- API Apps Script ----------
function projetApi_(methode, chemin, corps) {
  const o = { method: methode, headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  if (corps !== undefined) { o.contentType = 'application/json'; o.payload = JSON.stringify(corps); }
  let r;
  try { r = UrlFetchApp.fetch('https://script.googleapis.com/v1/' + chemin, o); }
  catch (e) { throw Oups_('API Apps Script injoignable : ' + String(e && e.message || e).slice(0, 200)); }
  const code = r.getResponseCode(), txt = r.getContentText();
  if (code >= 200 && code < 300) { try { return txt ? JSON.parse(txt) : {}; } catch (e) { return {}; } }
  throw Oups_(causeApiProjet_(code, txt));
}
function causeApiProjet_(code, txt) {
  let m = ''; try { m = String((JSON.parse(txt).error || {}).message || ''); } catch (e) { m = String(txt || '').slice(0, 200); }
  if (/has not (been )?(used|enabled)|is disabled|not enabled|usersettings/i.test(m)) return 'L\'API Apps Script n\'est pas activée pour le compte qui exécute l\'application. Avec ce compte : https://script.google.com/home/usersettings → activer « API Google Apps Script », puis réessayer (quelques minutes peuvent être nécessaires).';
  if (code === 403 && /scope|insufficient/i.test(m)) return 'Autorisation manquante : ajoutez dans appsscript.json, rubrique "oauthScopes", les portées ' + PROJET_PORTEES.join(' et ') + ', enregistrez, exécutez une fonction depuis l\'éditeur pour autoriser, puis publiez une nouvelle version.';
  if (code === 401) return 'Jeton refusé par l\'API Apps Script (401). Rechargez la page ; si le problème persiste, autorisez à nouveau le projet depuis l\'éditeur.';
  if (code === 403 || code === 404) return 'Le compte qui exécute l\'application n\'a pas accès en modification à ce projet Apps Script (' + code + (m ? ' : ' + m : '') + ').';
  return 'L\'API Apps Script a répondu ' + code + (m ? ' : ' + m : '') + '.';
}
// Déploiement qui sert l'adresse officielle : version figée (n°) ou code enregistré (HEAD, /dev)
function deploiementActuel_() {
  const m = String(urlOfficielle_() || '').match(/\/s\/([A-Za-z0-9_-]+)\/(exec|dev)$/);
  if (!m) return { id: '', head: true, version: null };
  if (m[2] === 'dev') return { id: m[1], head: true, version: null };
  try { const d = projetApi_('get', 'projects/' + ScriptApp.getScriptId() + '/deployments/' + m[1]); const v = Number((d.deploymentConfig || {}).versionNumber) || null; return { id: m[1], head: !v, version: v }; }
  catch (e) { return { id: m[1], head: null, version: null, erreur: e.message }; }
}
// Contenu complet du projet : version en service (par défaut) ou dernière version enregistrée dans l'éditeur
function contenuProjet_(cible) {
  let v = null, dep = null;
  if (cible !== 'editeur') { dep = deploiementActuel_(); v = dep.version; }
  const r = projetApi_('get', 'projects/' + ScriptApp.getScriptId() + '/content' + (v ? '?versionNumber=' + v : ''));
  return { files: (r.files || []).map(f => ({ name: String(f.name || ''), type: String(f.type || ''), source: String(f.source || '') })), version: v, deploiement: dep };
}
// Les 6 fichiers attendus dans la liste du projet (un seul fichier .gs, quel que soit son nom, est reconnu comme Code.gs)
function fichiersAttendus_(files) {
  const out = {}, serveurs = files.filter(f => f.type === 'SERVER_JS');
  PROJET_FICHIERS.forEach(d => {
    let f = files.find(x => x.type === d.type && x.name === d.api) || files.find(x => x.type === d.type && x.name.toLowerCase() === d.api.toLowerCase());
    if (!f && d.type === 'SERVER_JS' && serveurs.length === 1) f = serveurs[0];
    out[d.nom] = f || null;
  });
  return out;
}
const lignesTexte_ = s => s ? String(s).split('\n').length : 0;
function versionFichier_(nom, s) {
  s = String(s || '');
  if (nom === 'Code.gs') return (s.match(/const VERSION_CODE = '([^']+)'/) || [])[1] || '';
  if (nom === 'App.html') return (s.match(/const VERSION_APP = '([^']+)'/) || [])[1] || '';
  if (nom === 'Styles.html') return (s.match(/FIN DE Styles\.html — version ([0-9][\w.-]*)/) || [])[1] || '';
  return '';
}
// Sans l'API : les fichiers HTML restent lisibles tels qu'ils sont en service (HtmlService) ; Code.gs et appsscript.json non
function lectureHtmlService_(d) { if (d.type !== 'HTML') return null; try { return HtmlService.createHtmlOutputFromFile(d.api).getContent(); } catch (e) { return null; } }

// ---------- Reconnaissance et contrôle des fichiers reçus ----------
// « Code.gs », « Code.gs.txt », « App (1).html », « 18dc682f-Code.gs-4.txt »… → nom attendu ; sinon d'après le contenu
function reconnaitreNomProjet_(nom) {
  let n = String(nom || '').split(/[\\/]/).pop().trim().toLowerCase();
  n = n.replace(/\.txt$/, '').replace(/\s*\(\d+\)/g, '');
  const exact = PROJET_FICHIERS.find(d => d.nom.toLowerCase() === n); if (exact) return exact.nom;
  const t = PROJET_FICHIERS.filter(d => new RegExp('(^|[^a-z0-9])' + d.nom.toLowerCase().replace(/\./g, '\\.') + '([^a-z0-9]|$)').test(n));
  return t.length === 1 ? t[0].nom : '';
}
function devinerContenuProjet_(s) {
  s = String(s || '');
  if (/const VERSION_CODE = '/.test(s) && /function doGet\s*\(/.test(s)) return 'Code.gs';
  if (/const VERSION_APP = '/.test(s)) return 'App.html';
  if (/FIN DE Styles\.html/.test(s) || /^\s*<style[\s>]/i.test(s)) return 'Styles.html';
  if (/include\(\s*['"]App['"]\s*\)/.test(s)) return 'Index.html';
  let o = null; try { o = JSON.parse(s); } catch (e) { }
  if (o && typeof o === 'object' && !Array.isArray(o)) {
    if (o.timeZone || o.runtimeVersion || o.webapp || o.oauthScopes || o.exceptionLogging || o.dependencies) return 'appsscript.json';
    if (o.config || o.tables) return 'ConfigInitiale.html';
  }
  return '';
}
function syntaxeJs_(src) {
  try { new Function(src); return ''; }   // compilation seulement : rien n'est exécuté
  catch (e) { if (e instanceof SyntaxError) return e.message; return ''; }   // compilation dynamique indisponible : contrôle ignoré
}
// Contrôle d'un fichier : erreurs (bloquantes) et avertissements
function verifierFichierProjet_(nom, s) {
  const E = [], A = [];
  s = String(s == null ? '' : s);
  if (!s.trim()) E.push('Fichier vide.');
  if (s.length > PROJET_TAILLE_MAX) E.push('Fichier trop volumineux (' + s.length + ' caractères).');
  if (s.indexOf('\u0000') > -1 || s.indexOf('\uFFFD') > -1) E.push('Contenu binaire ou mal encodé (le fichier doit être enregistré en UTF-8).');
  if (E.length) return { erreurs: E, avertissements: A };
  const devine = devinerContenuProjet_(s);
  if (devine && devine !== nom) E.push('Le contenu ressemble à ' + devine + ', pas à ' + nom + ' : fichiers inversés ?');
  if (nom === 'Code.gs') {
    if (/^\s*</.test(s)) E.push('Ce fichier contient du HTML, pas du code Apps Script.');
    if (!/function doGet\s*\(/.test(s)) E.push('Fonction doGet absente : ce n\'est pas le Code.gs du Centre Com.');
    const v = versionFichier_(nom, s), fin = (s.match(/FIN DE Code\.gs — version ([0-9][\w.-]*)/) || [])[1];
    if (!v) E.push('VERSION_CODE absente.');
    if (!fin) E.push('Ligne de fin « FIN DE Code.gs » absente : copie incomplète.'); else if (v && fin !== v) E.push('Ligne de fin (version ' + fin + ') différente de VERSION_CODE (' + v + ') : fichier incohérent.');
    const sx = syntaxeJs_(s); if (sx) E.push('Erreur de syntaxe JavaScript : ' + sx);
  } else if (nom === 'App.html') {
    const v = versionFichier_(nom, s), fin = (s.match(/FIN DE App\.html — version ([0-9][\w.-]*)/) || [])[1];
    if (!/<script[\s>]/i.test(s)) E.push('Balise <script> absente.');
    if (!v) E.push('VERSION_APP absente.');
    if (!fin) E.push('Ligne de fin « FIN DE App.html » absente : copie incomplète.'); else if (v && fin !== v) E.push('Ligne de fin (version ' + fin + ') différente de VERSION_APP (' + v + ').');
    const js = (s.match(/<script>([\s\S]*)<\/script>/) || [])[1];
    if (js) { const sx = syntaxeJs_(js); if (sx) E.push('Erreur de syntaxe JavaScript : ' + sx); }
  } else if (nom === 'Styles.html') {
    if (!/<style[\s>]/i.test(s)) E.push('Balise <style> absente.');
    if (!/FIN DE Styles\.html/.test(s)) A.push('Ligne de fin « FIN DE Styles.html » absente : vérifiez que la copie est complète.');
  } else if (nom === 'Index.html') {
    if (!/include\(\s*['"]Styles['"]\s*\)/.test(s) || !/include\(\s*['"]App['"]\s*\)/.test(s)) E.push('Index doit inclure Styles et App (include(\'Styles\'), include(\'App\')).');
  } else if (nom === 'ConfigInitiale.html') {
    let o = null; try { o = JSON.parse(s); } catch (e) { E.push('JSON illisible : ' + String(e.message).slice(0, 160)); }
    if (o && (typeof o !== 'object' || Array.isArray(o))) E.push('Le contenu doit être un objet JSON.');
    else if (o && !o.config) A.push('Aucune rubrique « config » : valeurs génériques utilisées à l\'installation.');
    else if (o && o.config.identite && !/^[A-Za-z0-9_-]{2,12}$/.test(String(o.config.identite.code || ''))) E.push('Code de la délégation invalide dans config.identite.code (2 à 12 lettres ou chiffres, ex. DT87).');
  } else if (nom === 'appsscript.json') {
    let o = null; try { o = JSON.parse(s); } catch (e) { E.push('JSON illisible : ' + String(e.message).slice(0, 160)); }
    if (o && (typeof o !== 'object' || Array.isArray(o))) E.push('Le manifeste doit être un objet JSON.');
    else if (o) {
      if (o.runtimeVersion && o.runtimeVersion !== 'V8') E.push('runtimeVersion doit être "V8" (le code utilise la syntaxe moderne).');
      if (!o.runtimeVersion) A.push('runtimeVersion absent : ajoutez "runtimeVersion": "V8".');
      if (!o.webapp) A.push('Rubrique "webapp" absente : l\'application Web devra être reconfigurée au déploiement.');
      if (Array.isArray(o.oauthScopes) && PROJET_PORTEES.some(p => o.oauthScopes.indexOf(p) < 0)) A.push('"oauthScopes" ne contient pas ' + PROJET_PORTEES.filter(p => o.oauthScopes.indexOf(p) < 0).join(' ni ') + ' : après import, l\'export / import depuis l\'administration ne fonctionnera plus.');
    }
  }
  return { erreurs: E, avertissements: A };
}
// Fichiers reçus → les 6 emplacements attendus (présents, manquants, doublons, ignorés) et contrôles complets
function analyserProjet_(recus, mode, actuels) {
  recus = (Array.isArray(recus) ? recus : []).slice(0, 40);
  const slots = {}, ignores = [];
  recus.forEach(f => {
    const nomRecu = String((f && f.nom) || '').slice(0, 200), contenu = String((f && f.contenu) == null ? '' : f.contenu);
    if (/^__MACOSX\//.test(nomRecu) || /(^|\/)\.[^/]*$/.test(nomRecu) || /\/$/.test(nomRecu)) return;   // dossiers et fichiers cachés d'une archive
    const parNom = reconnaitreNomProjet_(nomRecu), parContenu = devinerContenuProjet_(contenu), nom = parNom || parContenu;
    if (!nom) { ignores.push({ nom: nomRecu, raison: 'Fichier non reconnu (ni par son nom, ni par son contenu).' }); return; }
    (slots[nom] = slots[nom] || []).push({ nom_recu: nomRecu, contenu: contenu, reconnu: parNom ? 'nom' : 'contenu' });
  });
  const cibles = mode && mode !== 'complet' ? [mode] : PROJET_FICHIERS.map(d => d.nom);
  Object.keys(slots).forEach(n => { if (cibles.indexOf(n) < 0) slots[n].forEach(x => ignores.push({ nom: x.nom_recu, raison: 'Reconnu comme ' + n + ', non concerné par cet import.' })); });
  const fichiers = cibles.map(nom => {
    const L = slots[nom] || [], act = actuels ? actuels[nom] : undefined;
    const o = { nom: nom, statut: L.length ? 'present' : 'manquant', erreurs: [], avertissements: [] };
    if (L.length > 1) { o.erreurs.push('Plusieurs fichiers pour ' + nom + ' : ' + L.map(x => x.nom_recu).join(', ') + '. Gardez-en un seul.'); }
    if (!L.length) return o;
    const x = L[0], v = verifierFichierProjet_(nom, x.contenu);
    Object.assign(o, { nom_recu: x.nom_recu, reconnu: x.reconnu, taille: x.contenu.length, lignes: lignesTexte_(x.contenu), version: versionFichier_(nom, x.contenu) });
    o.erreurs = o.erreurs.concat(v.erreurs); o.avertissements = v.avertissements;
    if (act !== undefined) { o.actuel = act === null ? null : { taille: act.length, lignes: lignesTexte_(act), version: versionFichier_(nom, act) }; o.identique = act !== null && act === x.contenu; }
    o._contenu = x.contenu;
    return o;
  });
  // Cohérence Code.gs ↔ App.html (contrôlée au démarrage de l'application) : avec les fichiers reçus, sinon ceux en place
  const ver = n => { const f = fichiers.find(z => z.nom === n && z.statut === 'present'); return f ? f.version : actuels && actuels[n] ? versionFichier_(n, actuels[n]) : ''; };
  const vc = ver('Code.gs'), va = ver('App.html');
  if (vc && va && vc !== va) {
    const msg = 'Versions différentes : Code.gs ' + vc + ' / App.html ' + va + '. L\'application signalera une mise à jour incomplète tant que les deux ne sont pas identiques.';
    fichiers.filter(f => (f.nom === 'Code.gs' || f.nom === 'App.html') && f.statut === 'present').forEach(f => (mode === 'complet' ? f.erreurs : f.avertissements).push(msg));
  }
  const manquants = fichiers.filter(f => f.statut === 'manquant').map(f => f.nom);
  const bloquant = fichiers.some(f => f.erreurs.length) || (mode === 'complet' ? manquants.length > 0 : !fichiers.length || fichiers[0].statut !== 'present');
  return { mode: mode || 'complet', fichiers: fichiers, presents: fichiers.filter(f => f.statut === 'present').map(f => f.nom), manquants: manquants, ignores: ignores,
    complet: !manquants.length, bloquant: bloquant, identique: fichiers.length > 0 && fichiers.every(f => f.identique === true), version_code: vc, version_app: va };
}
const sansContenu_ = a => Object.assign({}, a, { fichiers: a.fichiers.map(f => { const x = Object.assign({}, f); delete x._contenu; return x; }) });
function sourcesActuelles_(files) { const A = fichiersAttendus_(files), o = {}; PROJET_FICHIERS.forEach(d => o[d.nom] = A[d.nom] ? A[d.nom].source : null); return o; }
function zipProjet_(liste, nomZip) {
  return Utilities.zip(liste.map(x => Utilities.newBlob('', defProjet_(x.nom) ? defProjet_(x.nom).mime : 'text/plain', x.nom).setDataFromString(x.contenu, 'UTF-8')), nomZip);
}
const horodatage_ = () => Utilities.formatDate(new Date(), 'Europe/Paris', 'yyyy-MM-dd_HHmm');

// ---------- API de l'administration ----------
// État : accès à l'API, déploiement, les 6 fichiers (présents, taille, version), autres fichiers du projet
function api_projetEtat(sid) {
  return appel_(sid, 'admin', u => {
    const o = { script_id: '', version_code: VERSION_CODE, api: { ok: false, message: '' }, portees: PROJET_PORTEES, portees_code: PROJET_PORTEES_CODE, fichiers: [], autres: [], deploiement: null, url: urlOfficielle_() };
    try { o.script_id = ScriptApp.getScriptId(); } catch (e) { }
    let C = null;
    try { C = contenuProjet_('service'); o.api.ok = true; o.deploiement = C.deploiement; } catch (e) { o.api.message = e.message || String(e); }
    let E = null; if (C) { try { E = contenuProjet_('editeur'); } catch (e) { } }
    const A = C ? fichiersAttendus_(C.files) : {}, AE = E ? sourcesActuelles_(E.files) : null;
    o.fichiers = PROJET_FICHIERS.map(d => {
      const f = A[d.nom], s = f ? f.source : C ? null : lectureHtmlService_(d);
      return { nom: d.nom, present: s !== null && s !== undefined, lecture: f ? 'api' : s != null ? 'html' : '', taille: s != null ? s.length : 0, lignes: s != null ? lignesTexte_(s) : 0,
        version: s != null ? versionFichier_(d.nom, s) : '', nom_projet: f ? f.name : '', modifie_editeur: !!(AE && s != null && AE[d.nom] !== null && AE[d.nom] !== s) };
    });
    if (C) { const pris = PROJET_FICHIERS.map(d => A[d.nom]).filter(Boolean); o.autres = C.files.filter(f => pris.indexOf(f) < 0).map(f => f.name + ({ SERVER_JS: '.gs', HTML: '.html', JSON: '.json' }[f.type] || '')); }
    return o;
  });
}
// Un fichier, tel quel (nom et extension d'origine) ; cible : 'service' (version en service, par défaut) ou 'editeur'
function api_projetExporter(sid, nom, cible) {
  return appel_(sid, 'admin', u => {
    const d = defProjet_(String(nom || '')); if (!d) throw Oups_('Fichier inconnu.');
    let s = null, lecture = 'api', C = null;
    try { C = contenuProjet_(cible); const f = fichiersAttendus_(C.files)[d.nom]; s = f ? f.source : null; if (s === null) throw Oups_(d.nom + ' est absent du projet Apps Script.'); }
    catch (e) {
      if (e && e.utilisateur && C) throw e;
      s = lectureHtmlService_(d); lecture = 'html';
      if (s === null) throw Oups_('Impossible de lire ' + d.nom + ' : ' + (e.message || e));
    }
    journalSecu_(u.email, 'projet_export', d.nom + ' · ' + s.length + ' caractères' + (lecture === 'html' ? ' (HtmlService)' : C && C.version ? ' (version ' + C.version + ')' : ''));
    return { nom: d.nom, mime: d.mime, contenu: s, taille: s.length, lignes: lignesTexte_(s), version: versionFichier_(d.nom, s), lecture: lecture, version_deploiement: C ? C.version : null };
  });
}
// Les 6 fichiers dans une archive .zip (refusé s'il en manque un : jamais d'export partiel présenté comme complet)
function api_projetExporterTout(sid, cible) {
  return appel_(sid, 'admin', u => {
    const C = contenuProjet_(cible), A = fichiersAttendus_(C.files);
    const manquants = PROJET_FICHIERS.filter(d => !A[d.nom]).map(d => d.nom);
    if (manquants.length) throw Oups_('Export impossible : fichier(s) absent(s) du projet Apps Script : ' + manquants.join(', ') + '.');
    const liste = PROJET_FICHIERS.map(d => ({ nom: d.nom, contenu: A[d.nom].source }));
    const nomZip = 'Projet_' + config_().identite.code + '_v' + VERSION_CODE + '_' + horodatage_() + '.zip', z = zipProjet_(liste, nomZip);
    journalSecu_(u.email, 'projet_export', 'projet complet · ' + nomZip);
    return { nom: nomZip, data: Utilities.base64Encode(z.getBytes()), fichiers: liste.map(x => ({ nom: x.nom, taille: x.contenu.length, lignes: lignesTexte_(x.contenu) })), version_deploiement: C.version };
  });
}
// Archive .zip reçue → fichiers texte (UTF-8), pour l'analyse
function api_projetLireZip(sid, b64) {
  return appel_(sid, 'admin', u => {
    let L;
    try { L = Utilities.unzip(Utilities.newBlob(Utilities.base64Decode(String(b64 || '')), 'application/zip', 'projet.zip')); }
    catch (e) { throw Oups_('Archive .zip illisible.'); }
    return L.filter(b => !/\/$/.test(b.getName())).slice(0, 40).map(b => ({ nom: b.getName(), contenu: b.getDataAsString('UTF-8') }));
  });
}
// Analyse sans rien modifier : présents, manquants, ignorés, contrôles, comparaison avec le projet actuel
function api_projetAnalyser(sid, recus, mode) {
  return appel_(sid, 'admin', u => {
    if (mode && mode !== 'complet' && !defProjet_(mode)) throw Oups_('Fichier inconnu.');
    let actuels = null, acces = '';
    try { actuels = sourcesActuelles_(contenuProjet_('editeur').files); } catch (e) { acces = e.message || String(e); }
    const a = sansContenu_(analyserProjet_(recus, mode, actuels));
    a.api = { ok: !acces, message: acces };
    return a;
  });
}
// Remplacement, après confirmation : analyse refaite ici, sauvegarde du projet actuel, écriture, relecture et comparaison
function api_projetAppliquer(sid, recus, mode, options) {
  return appel_(sid, 'admin', u => {
    options = options || {};
    if (options.confirmation !== 'REMPLACER') throw Oups_('Confirmation manquante.');
    if (mode && mode !== 'complet' && !defProjet_(mode)) throw Oups_('Fichier inconnu.');
    const lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) throw Oups_('Un autre import est en cours. Réessayez dans un instant.');
    try {
      const C = contenuProjet_('editeur'), actuels = sourcesActuelles_(C.files);
      const a = analyserProjet_(recus, mode, actuels);
      if (a.bloquant) throw Oups_('Import refusé : ' + (a.manquants.length && mode === 'complet' ? 'fichier(s) manquant(s) : ' + a.manquants.join(', ') + '. ' : '') + a.fichiers.filter(f => f.erreurs.length).map(f => f.nom + ' — ' + f.erreurs.join(' ')).join(' | '));
      const avert = a.fichiers.filter(f => f.avertissements.length);
      if (avert.length && options.avertissements_acceptes !== true) throw Oups_('Des avertissements doivent être acceptés avant le remplacement.');
      const aEcrire = a.fichiers.filter(f => f.statut === 'present' && !f.identique);
      const rapport = { importes: [], inchanges: a.fichiers.filter(f => f.identique).map(f => f.nom), erreurs: [], sauvegarde: null, publication: null, autres_conserves: [] };
      if (!aEcrire.length) return rapport;
      // 1. Sauvegarde du projet actuel (tous ses fichiers) AVANT toute écriture
      const tout = C.files.map(f => ({ nom: f.name + ({ SERVER_JS: '.gs', HTML: '.html', JSON: '.json' }[f.type] || '.txt'), contenu: f.source }));
      const nomSv = 'Projet_avant-import_' + config_().identite.code + '_v' + VERSION_CODE + '_' + horodatage_() + '.zip';
      try { const fz = ecritureDrive_('sauvegardes', () => dossier_('sauvegardes').createFile(zipProjet_(tout, nomSv))); rapport.sauvegarde = { nom: nomSv, url: fz.getUrl() }; }
      catch (e) { if (options.sauvegarde_locale !== true) throw Oups_('Sauvegarde du projet actuel impossible dans le Drive (' + (e.message || e) + '). Téléchargez d\'abord le projet complet, puis confirmez l\'import avec « sauvegarde téléchargée ».'); rapport.sauvegarde = { nom: '', url: '', locale: true }; }
      // 2. Nouvelle liste : fichiers remplacés à leur place (même nom dans le projet), tous les autres fichiers conservés
      const A = fichiersAttendus_(C.files), files = C.files.map(f => ({ name: f.name, type: f.type, source: f.source }));
      aEcrire.forEach(f => {
        const d = defProjet_(f.nom), ex = A[f.nom], i = ex ? C.files.indexOf(ex) : -1;
        if (i > -1) files[i].source = f._contenu; else files.push({ name: d.api, type: d.type, source: f._contenu });
      });
      rapport.autres_conserves = C.files.filter(f => PROJET_FICHIERS.every(d => A[d.nom] !== f)).map(f => f.name);
      projetApi_('put', 'projects/' + ScriptApp.getScriptId() + '/content', { files: files });
      // 3. Relecture : chaque fichier écrit est comparé au fichier reçu
      const relu = sourcesActuelles_(contenuProjet_('editeur').files);
      aEcrire.forEach(f => { if (relu[f.nom] === f._contenu) rapport.importes.push({ nom: f.nom, taille: f.taille, lignes: f.lignes, version: f.version }); else rapport.erreurs.push(f.nom + ' : le contenu relu diffère du fichier importé.'); });
      journalSecu_(u.email, 'projet_import', rapport.importes.map(f => f.nom).join(', ') + (rapport.erreurs.length ? ' · ERREURS : ' + rapport.erreurs.join(' ; ') : '') + (rapport.sauvegarde && rapport.sauvegarde.nom ? ' · sauvegarde ' + rapport.sauvegarde.nom : ''));
      // 4. Publication facultative sur l'adresse de l'application (nouvelle version du déploiement)
      if (options.publier && !rapport.erreurs.length) {
        try { rapport.publication = publierProjet_('Import ' + rapport.importes.map(f => f.nom).join(', ') + ' par ' + u.email); }
        catch (e) { rapport.publication = { ok: false, message: e.message || String(e) }; }
        journalSecu_(u.email, 'projet_publication', rapport.publication.ok ? 'version ' + (rapport.publication.version || 'HEAD') : 'échec : ' + rapport.publication.message);
      }
      return rapport;
    } finally { try { lock.releaseLock(); } catch (e) { } }
  });
}
function publierProjet_(description) {
  const id = ScriptApp.getScriptId(), dep = deploiementActuel_();
  if (!dep.id) return { ok: false, message: 'Adresse officielle de l\'application inconnue : publiez depuis l\'éditeur (Déployer > Gérer les déploiements > Modifier > Nouvelle version).' };
  if (dep.head) return { ok: true, version: null, message: 'Le déploiement utilise directement le code enregistré : rien à publier.' };
  const v = projetApi_('post', 'projects/' + id + '/versions', { description: String(description).slice(0, 900) });
  const d = projetApi_('get', 'projects/' + id + '/deployments/' + dep.id), c = d.deploymentConfig || {};
  projetApi_('put', 'projects/' + id + '/deployments/' + dep.id, { deploymentConfig: { scriptId: id, versionNumber: v.versionNumber, manifestFileName: c.manifestFileName || 'appsscript', description: String(description).slice(0, 900) } });
  return { ok: true, version: v.versionNumber, message: 'Version ' + v.versionNumber + ' publiée sur l\'adresse de l\'application.' };
}

// ---------- Duplication pour une autre délégation ----------
// ConfigInitiale de la nouvelle DT : réglages génériques conservés ; identité, Drive, adresses, liens et UL de la DT
// d'origine jamais repris (remplacés par les valeurs saisies ou laissés vides, à compléter).
function configInitialeNouvelleDT_(base, p, source) {
  const ini = base && typeof base === 'object' ? base : {};
  const cfg = JSON.parse(JSON.stringify(ini.config || {}));
  const ancien = Object.assign({}, CONFIG_DEFAUT.identite, source || {});
  delete cfg.meta;
  cfg.identite = Object.assign({}, CONFIG_DEFAUT.identite, { code: p.code, nom_centre: p.nom_centre || ('Centre Com ' + p.code), territoire: p.territoire || '',
    nom_structure: p.nom_structure || (CONFIG_DEFAUT.identite.nom_structure + (p.territoire ? ' ' + p.territoire : '')) });
  cfg.drive = { racine: p.drive_racine || '' };
  if (cfg.securite) cfg.securite.google_client_id = '';
  const motsAnciens = [[ancien.nom_centre, cfg.identite.nom_centre], [ancien.nom_structure, cfg.identite.nom_structure], [ancien.territoire, p.territoire], [ancien.code, p.code]].filter(x => x[0] && x[1] && String(x[0]).length > 2 && x[0] !== 'Centre Com');
  const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, LIEN_DRIVE = /https?:\/\/(drive|docs)\.google\.com\/\S*/g;
  const nettoyer = (v, cle) => {
    if (Array.isArray(v)) return v.map(x => nettoyer(x, cle));
    if (v && typeof v === 'object') { const o = {}; Object.keys(v).forEach(k => o[k] = nettoyer(v[k], k)); return o; }
    if (typeof v !== 'string') return v;
    if (/e-?mail|destinataire|repondre/i.test(cle || '') && EMAIL.test(v)) { EMAIL.lastIndex = 0; return ''; }
    EMAIL.lastIndex = 0;
    let s = v.replace(EMAIL, '[adresse à compléter]').replace(LIEN_DRIVE, '');
    motsAnciens.forEach(x => { s = s.split(x[0]).join(x[1]); });
    return s;
  };
  const propre = nettoyer(Object.assign({}, cfg, { identite: undefined, drive: undefined }));
  propre.identite = cfg.identite; propre.drive = cfg.drive;
  const t = ini.tables || {}, ul = (Array.isArray(p.ul) ? p.ul : []).map(x => String(x || '').trim()).filter(Boolean).slice(0, 200);
  const tables = { ul: ul.length ? ul.map(n => ({ nom: n.slice(0, 120), actif: 'OUI' })) : [{ nom: 'Délégation territoriale', actif: 'OUI' }] };
  if (Array.isArray(t.types) && t.types.length) tables.types = nettoyer(t.types);   // types de demande : génériques (délais, champs)
  return {
    _lisez_moi: ['Configuration de départ de la délégation ' + p.code + ' (préparée le ' + dateFr_(aujourdhui_()) + ').',
      'Aucune donnée de la délégation d\'origine : identité, adresses e-mail, liens Drive, unités locales et utilisateurs sont à régler pour ' + p.code + '.',
      'À vérifier ici avant installer() : config.identite (nom, code, territoire), config.drive.racine (lien du dossier du Drive partagé), tables.ul (unités locales).',
      'Les autres réglages se font ensuite dans Administration (identité, logos, notifications, utilisateurs…).'],
    config: propre, tables: tables,
  };
}
function api_projetNouvelleDT(sid, p) {
  return appel_(sid, 'admin', u => {
    p = p || {};
    const q = { code: String(p.code || '').trim(), nom_centre: txtM_(p.nom_centre, 120), territoire: txtM_(p.territoire, 120), nom_structure: txtM_(p.nom_structure, 160), drive_racine: txtM_(p.drive_racine, 300),
      ul: String(p.ul || '').split('\n'), reglages_actuels: p.reglages_actuels === true };
    if (!/^[A-Za-z0-9_-]{2,12}$/.test(q.code)) throw Oups_('Code de la nouvelle délégation invalide : 2 à 12 lettres ou chiffres (ex. DT09).');
    const actuel = config_();
    if (q.code.toLowerCase() === String(actuel.identite.code).toLowerCase()) throw Oups_('Le code doit être celui de la NOUVELLE délégation (différent de ' + actuel.identite.code + ').');
    if (q.drive_racine && !/^https:\/\/drive\.google\.com\//.test(q.drive_racine) && !/^[A-Za-z0-9_-]{15,}$/.test(q.drive_racine)) throw Oups_('Dossier Drive : collez le lien du dossier (https://drive.google.com/…) ou laissez vide.');
    const C = contenuProjet_('service'), A = fichiersAttendus_(C.files);
    const manquants = PROJET_FICHIERS.filter(d => !A[d.nom] && d.nom !== 'ConfigInitiale.html').map(d => d.nom);
    if (manquants.length) throw Oups_('Préparation impossible : fichier(s) absent(s) du projet : ' + manquants.join(', ') + '.');
    let base = {};
    if (q.reglages_actuels) base = { config: JSON.parse(JSON.stringify(actuel)), tables: { types: DB.tout('types').map(x => { const o = Object.assign({}, x); delete o._ligne; return o; }) } };
    else if (A['ConfigInitiale.html']) { try { base = JSON.parse(A['ConfigInitiale.html'].source); } catch (e) { base = {}; } }
    const ci = JSON.stringify(configInitialeNouvelleDT_(base, q, actuel.identite), null, 2);
    const liste = PROJET_FICHIERS.map(d => ({ nom: d.nom, contenu: d.nom === 'ConfigInitiale.html' ? ci : A[d.nom].source }));
    // Mentions restantes de la DT d'origine dans les fichiers de code (signalées, jamais modifiées automatiquement)
    const mentions = [];
    ['Index.html', 'Styles.html', 'App.html', 'ConfigInitiale.html'].forEach(n => { const s = liste.find(x => x.nom === n).contenu, k = actuel.identite.code; const nb = k ? s.split(k).length - 1 : 0; if (nb) mentions.push({ nom: n, nb: nb }); });
    const nomZip = 'Projet_' + q.code + '_depuis_' + actuel.identite.code + '_v' + VERSION_CODE + '_' + horodatage_() + '.zip';
    journalSecu_(u.email, 'projet_export', 'nouvelle délégation ' + q.code + ' · ' + nomZip);
    return { nom: nomZip, data: Utilities.base64Encode(zipProjet_(liste, nomZip).getBytes()), config_initiale: ci, mentions: mentions, code_source: actuel.identite.code };
  });
}

// ===== FIN DE Code.gs — version 3.30.0 — si cette ligne n'apparaît pas tout en bas après collage, la copie est incomplète =====
