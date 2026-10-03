# Administration, Utilitaires & Connexion

_48 constats vérifiés — 4 haute, 25 moyenne, 19 basse._

## Pages analysées

### `/utilities (+ routes de compatibilité /backup, /nocodb-config, /database-debug, /weather-settings ; aussi exposée sur mobile)`

**Rôle :** Conteneur d'administration (admin uniquement) qui regroupe en 6 onglets : sauvegardes, configuration NocoDB, debug base de données, météo, webhook BAP, exécution SQL.

**Tâches principales de l'utilisateur :**
- Choisir un outil d'administration via les onglets
- Accéder directement à un onglet via une ancienne URL (/backup, /nocodb-config...)

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user | au montage (useAuthUnified : état local par instance, fetch cache:'no-cache') | server/localAuth.ts:204 → storage.getUserWithGroups (server/storage.ts:371) ; + passport.deserializeUser localAuth.ts:141 → getUserWithGroups | Refait aussi par RouterProduction, Layout, Sidebar (useAuthSimple) et chaque onglet monté : ≥5 appels par affichage, 4 requêtes SQL chacun. Tant qu'il n'a pas répondu, user=null → carte « Accès refusé » affichée. |

**Lisibilité / simplicité :** Six onglets plats (grid-cols-6 fixe) mélangent outils quotidiens (sauvegardes, météo) et outils dangereux pour développeur (SQL brut, scan de schéma), avec des libellés jargon (NocoDB, BAP, Debug). Inutilisable sur téléphone (6 colonnes forcées). Double en-tête de page (Utilitaires + titre de chaque onglet), largeurs/titres/états de chargement différents d'un onglet à l'autre, onglet actif non reflété dans l'URL. Flash « Accès refusé » à chaque ouverture à cause du hook d'auth non partagé. Tous les onglets sont importés statiquement dans le bundle principal téléchargé par tous les employés.

### `/utilities › onglet Sauvegardes`

**Rôle :** Voir les sauvegardes de la base, en créer une manuellement, les télécharger ou les supprimer, activer/désactiver la sauvegarde automatique nocturne.

**Tâches principales de l'utilisateur :**
- Vérifier que la dernière sauvegarde est récente et réussie
- Lancer une sauvegarde manuelle
- Télécharger une sauvegarde
- Supprimer une sauvegarde
- Activer/désactiver la sauvegarde automatique

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/backups | au montage (enabled après le /api/user propre au composant) + polling toutes les 30 s | server/routes.ts:5173 → backupService.getBackupList (server/backupService.ts:159, ORDER BY created_at DESC LIMIT 10) | Requête légère mais précédée de getUserWithGroups (2 requêtes) en plus de la désérialisation ; polling inconditionnel. |
| GET /api/utilities | au montage | server/routes.ts:333 → storage.getUser + storage.getUtilities (server/storage.ts:3015) | Lu pour l'interrupteur et la carte « Statut Système ». |
| POST /api/utilities | clic sur l'interrupteur sauvegarde automatique | server/routes.ts:354 → getUtilities puis updateUtilities/createUtilities (server/storage.ts:3020-3031) | La réponse (config à jour) n'est pas réutilisée : invalidation + refetch ; toast calculé sur l'ancienne valeur. |
| POST /api/backups | clic « Sauvegarde Manuelle » | server/routes.ts:5188 → backupService.createBackup (server/backupService.ts:98) | Requête HTTP ouverte pendant tout le pg_dump ; lecture synchrone du dump complet (readFileSync) pour compter les tables ; un échec laisse le statut « creating ». |
| GET /api/backups/:filename/download | clic « Télécharger » (lien <a> créé dynamiquement) | server/routes.ts:5203 → backupService.downloadBackup (server/backupService.ts:202) | Nom de fichier non validé (path.join avec le paramètre). |
| DELETE /api/backups/:filename | clic sur l'icône corbeille (sans confirmation) | server/routes.ts:5225 → backupService.deleteBackup (server/backupService.ts:173) | Suppression physique immédiate du fichier + enregistrement. |
| GET /api/user | au montage (useAuthUnified) | server/localAuth.ts:204 | Bloque les deux requêtes ci-dessus (enabled: canManageBackups) → cascade. |

**Lisibilité / simplicité :** Information répétée trois fois (sous-titre, carte interrupteur, carte « Statut Système »), nom de fichier technique en titre de chaque ligne, unités anglaises (Bytes), description serveur franglaise (« Manuel backup du… »). Suppression en un clic sans confirmation via un bouton icône sans libellé. Ligne de liste non responsive (pas de flex-wrap ni troncature) coupée par l'overflow-x-hidden du Layout. Bouton principal orange alors que les autres onglets utilisent le bleu. Sauvegardes ratées affichées « En cours » à vie et comptées comme « Dernière sauvegarde ». Pas de restauration proposée (à décider côté produit).

### `/utilities › onglet Configuration NocoDB`

**Rôle :** Gérer les connexions à la base NocoDB externe utilisée pour vérifier les factures lors du rapprochement BL/factures.

**Tâches principales de l'utilisateur :**
- Créer une configuration NocoDB
- Modifier une configuration (URL, jeton, projet, actif)
- Supprimer une configuration
- Afficher le jeton API

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/nocodb-config | au montage (enabled: user?.role === 'admin', donc après le /api/user propre au composant) | server/routes.ts:5090 → storage.getUserWithGroups + storage.getNocodbConfigs (server/storage.ts:1655) | Renvoie le jeton API déchiffré au navigateur. Même queryKey réutilisée par Groups.tsx:85. |
| POST /api/nocodb-config | soumission de la modale de création | server/routes.ts:5105 → storage.createNocodbConfig (server/storage.ts:1682) | Aucune contrainte « une seule config active ». |
| PUT /api/nocodb-config/:id | soumission de la modale d'édition | server/routes.ts:5124 → storage.updateNocodbConfig (server/storage.ts:1688) | Le jeton en clair est renvoyé dans le formulaire puis ré-envoyé. |
| DELETE /api/nocodb-config/:id | confirmation dans la modale de suppression | server/routes.ts:5141 → storage.deleteNocodbConfig (server/storage.ts:1701) | Pas de vérification des magasins (groups.nocodb_config_id) qui l'utilisent. |
| GET /api/user | au montage (useAuthUnified) | server/localAuth.ts:204 | Flash « Accès restreint » tant qu'il n'a pas répondu. |

**Lisibilité / simplicité :** Libellés anglais/jargon (« Personal API Token », placeholders xc-token / your-nocodb-instance), pas d'aide ni de bouton « Tester la connexion » (présent sur Météo et BAP). Jeton visible en clair avec un bouton œil. Plusieurs configurations peuvent être « Actif » sans indiquer laquelle sert réellement. Boutons Modifier/Supprimer icône seule, sans libellé ni style destructif ; suppression sans avertissement sur les magasins liés. Spinner géant (128 px) au chargement, h1 text-3xl dans un conteneur différent des autres onglets. Formulaire de création non réinitialisé, formulaires création/édition dupliqués, console.log de debug à chaque rendu.

### `/utilities › onglet Debug Base de Données`

**Rôle :** Outil développeur : scanner le schéma de la base de production, l'écrire dans les logs serveur et télécharger un rapport texte.

**Tâches principales de l'utilisateur :**
- Lancer le scan du schéma
- Télécharger le rapport

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/debug/log-schema | clic « Démarrer le Scan du Schéma » (fetch manuel) | server/routes.ts:4776 → pool.query en boucle (colonnes + COUNT(*) par table, l.4813-4846) | N+1 séquentiel, COUNT(*) en scan complet, centaines de lignes console ; refuse de fonctionner hors production. |
| GET /api/debug/download-schema | clic « Télécharger » (window.open dans un nouvel onglet) | server/routes.ts:4904 → même balayage complet (l.4971, 4984) | Refait intégralement le travail du scan précédent. |
| GET /api/user | au montage (useAuthUnified) | server/localAuth.ts:204 | Flash « Accès refusé » tant qu'il n'a pas répondu. |

**Lisibilité / simplicité :** Page entièrement orientée développeur (« logs de votre application Node.js », « Relations FK », marqueur de log à chercher), émojis dans les textes, fonctionne uniquement en production, parcours en deux temps (scan puis téléchargement qui relance le scan). N'a pas sa place au même niveau que les Sauvegardes pour un admin non technicien.

### `/utilities › onglet Météo`

**Rôle :** Configurer la clé API Visual Crossing et la ville du widget météo affiché dans l'en-tête de toutes les pages.

**Tâches principales de l'utilisateur :**
- Saisir la clé API et la ville
- Détecter la ville par géolocalisation
- Tester la connexion
- Activer/désactiver le widget

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/weather/settings | au montage | server/routes.ts:5596 → storage.getWeatherSettings (server/storage.ts:2891) | Renvoie la clé API en clair (mise en defaultValue d'un champ password). |
| PUT /api/weather/settings/:id (POST si aucun réglage) | soumission du formulaire (fetch manuel) | server/routes.ts:5630 / 5611 → storage.updateWeatherSettings (server/storage.ts:2901) / createWeatherSettings (2896) | Ne vide pas le cache météo même si la ville change ; le client n'invalide pas /api/weather/current. |
| POST /api/weather/test-connection | clic « Tester la connexion » (fetch manuel) | server/routes.ts:5650 → weatherService.testApiConnection (server/weatherService.ts:220) | Messages serveur en français ; erreur client en anglais « Test connection failed ». |
| POST /api/weather/geolocation | clic sur le bouton localisation | server/routes.ts:6094 → weatherService.getCityFromCoordinates + storage.updateWeatherSettings + storage.clearWeatherCache | Aucun contrôle de rôle admin ; le client met à jour l'input par manipulation DOM. |
| GET /api/weather/current | WeatherWidget du Layout : montage + toutes les 30 min (non rafraîchi par cette page) | server/routes.ts:5671 → getWeatherSettings + getWeatherData×2 séquentiels (server/storage.ts:2910) + getNearestWeatherData (2930) + API externe si absent | Cache BD indexé par date seulement (pas par ville) ; pas de cache mémoire ; console.log à chaque appel. |

**Lisibilité / simplicité :** Formulaire simple et plutôt clair, mais : après changement manuel de ville le widget continue d'afficher l'ancienne ville jusqu'au lendemain (cache non vidé), messages d'erreur en anglais, champs non contrôlés manipulés via document.getElementById / querySelector('form'), largeur max-w-2xl incohérente avec les autres onglets, texte « À propos » inexact (le widget est à gauche, le sélecteur de magasin à droite).

### `/utilities › onglet Configuration BAP`

**Rôle :** Configurer l'URL du webhook n8n qui reçoit les PDF « BAP » envoyés depuis le bouton BAP de la barre latérale.

**Tâches principales de l'utilisateur :**
- Saisir/modifier l'URL du webhook
- Tester le webhook
- Activer/désactiver l'envoi
- Sauvegarder

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/webhook-bap-config | au montage | server/routes.ts:186 → storage.getUser + storage.getWebhookBapConfig (server/storage.ts:2992) | Si la table manque, renvoie une config factice avec l'URL de production codée en dur. |
| POST /api/webhook-bap-config | clic « Sauvegarder » | server/routes.ts:222 → getWebhookBapConfig puis updateWebhookBapConfig/createWebhookBapConfig (server/storage.ts:2997-3012) | Erreur de validation Zod renvoyée en 500. |
| POST /api/webhook-bap-config/test | clic « Tester le Webhook » (fetch manuel) | server/routes.ts:264 → fetch POST vers l'URL saisie (timeout 10 s) | Teste l'URL saisie, pas celle enregistrée. |

**Lisibilité / simplicité :** Jargon (webhook, n8n, BAP non expliqué) et prénoms codés en dur (« Laurie et Jeremy ») ; interrupteur « Configuration active » sans explication de l'effet. Bouton Sauvegarder isolé en bas après la carte de test, statut « Connexion réussie » qui reste affiché après modification de l'URL, pas d'indication de modifications non enregistrées. Bouton copier icône seule. Pas de titre de section cohérent avec les autres onglets.

### `/utilities › onglet Exécution SQL`

**Rôle :** Exécuter du SQL brut sur la base de production (collage ou fichier .sql).

**Tâches principales de l'utilisateur :**
- Coller ou charger un script SQL
- Exécuter
- Lire les résultats/logs

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| POST /api/admin/execute-sql | clic « Exécuter SQL » (fetch manuel dans useMutation) | server/routes.ts:6151 → storage.getUser + db.execute(sql.raw(sqlQuery)) (l.6178) | Aucune transaction ni mode lecture seule ; renvoie toutes les lignes (results: result.rows) + un échantillon dupliqué dans logs. |

**Lisibilité / simplicité :** Outil extrêmement dangereux exposé à un clic, sans confirmation ni sauvegarde préalable. Résultats non bornés rendus comme un bloc JSON géant sans retour à la ligne (whitespace non préservé) dans une zone sans hauteur max. Bouton obsolète « SQL Webhook BAP » qui écrase l'éditeur et contient une URL de production. Message « Début de l'exécution » effacé aussitôt.

### `/auth (et toute URL quand l'utilisateur n'est pas connecté)`

**Rôle :** Écran de connexion (identifiant + mot de passe) avec visuel de présentation sur grand écran.

**Tâches principales de l'utilisateur :**
- Se connecter
- Voir les identifiants par défaut lors de la première installation

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user | au montage, deux fois (RouterProduction puis AuthPage, chacun via useAuthUnified) | server/localAuth.ts:204 → storage.getUserWithGroups (server/storage.ts:371) | Renvoie 401 pour un visiteur ; provoque deux spinners plein écran successifs. |
| GET /api/default-credentials-check | au montage | server/localAuth.ts:234 → storage.getUserByUsername('admin') (server/storage.ts:351) | Endpoint public ; carte admin/admin affichée par défaut avant la réponse. |
| POST /api/login | soumission du formulaire (fetch manuel en « production », useMutation sinon) | server/localAuth.ts:153 → LocalStrategy (getUserByUsername + scrypt) puis await backupService.checkAndPerformDailyBackup (server/backupService.ts:240) | Peut attendre un pg_dump complet avant de répondre ; puis côté client attente artificielle de 500 ms + rechargement complet. |

**Lisibilité / simplicité :** Formulaire simple et lisible, mais : deux spinners avant l'affichage, chargement initial lourd (~1,7 Mo JS non compressé + script tiers replit.com bloquant, lang=en déclenchant la traduction Chrome, zoom mobile désactivé), champs sans autoComplete/autoCapitalize (majuscule automatique sur mobile → échec de connexion, comparaison sensible à la casse), identifiants admin/admin affichés par défaut, messages d'erreur trompeurs en cas de blocage (rate-limit) ou de CSRF, anglicisme « across tous vos magasins », 500 ms d'attente + rechargement complet après connexion, sessions en mémoire perdues à chaque redémarrage.

### `(aucune — page non routée) Landing`

**Rôle :** Ancienne page d'accueil marketing (héritage Replit Auth), jamais importée.

**Tâches principales de l'utilisateur :**
- Aucune (code mort)

**Lisibilité / simplicité :** Code mort : non importée par le routeur, ses boutons redirigent vers GET /api/login qui n'existe pas (seul POST existe). Branding « La Foir'Fouille » codé en dur, classes Tailwind personnalisées. À supprimer.

### `* (404, desktop dans Layout et mobile dans MobileApp)`

**Rôle :** Page affichée pour une URL inconnue quand l'utilisateur est connecté.

**Tâches principales de l'utilisateur :**
- Comprendre que la page n'existe pas et revenir à l'application

**Lisibilité / simplicité :** Message de développeur en anglais (« 404 Page Not Found », « Did you forget to add the page to the router? »), aucun bouton de retour, min-h-screen à l'intérieur du Layout (double hauteur d'écran).

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [ADMIN-01](#admin-01) | haute | bug | M | Hook d'auth non partagé : flash « Accès refusé » et cascade de /api/user à chaque onglet | `client/src/hooks/useAuthUnified.ts:23` |
| [AUTH-01](#auth-01) | haute | perf-bundle | S | Script tiers replit.com bloquant en production, lang="en" et zoom désactivé | `client/index.html:19` |
| [BACKUP-01](#backup-01) | haute | ux-simplicite | S | Suppression d'une sauvegarde en un clic, sans confirmation | `client/src/pages/BackupManager.tsx:142` |
| [SQL-01](#sql-01) | haute | ux-simplicite | M | Exécution de SQL brut en production sans confirmation ni filet de sécurité | `client/src/pages/SQLExecutor.tsx:97` |
| [ADMIN-02](#admin-02) | moyenne | perf-api | S | /api/user exécute 4 requêtes SQL alors que req.user est déjà chargé | `server/localAuth.ts:210` |
| [AUTH-02](#auth-02) | moyenne | perf-serveur | S | Fichiers statiques servis sans compression ni cache long | `server/index.production.ts:143` |
| [AUTH-03](#auth-03) | moyenne | perf-client | M | Double vérification d'auth, double spinner, puis 500 ms d'attente et rechargement complet | `client/src/pages/AuthPage.tsx:69` |
| [AUTH-04](#auth-04) | moyenne | bug | S | Identifiants admin/admin affichés par défaut avant (et sans) vérification | `client/src/pages/AuthPage.tsx:25` |
| [AUTH-05](#auth-05) | moyenne | accessibilite | S | Champs de connexion sans autoComplete/autoCapitalize (échecs sur mobile) | `client/src/pages/AuthPage.tsx:224` |
| [AUTH-06](#auth-06) | moyenne | bug | S | Sessions stockées en mémoire en production (fichier d'auth PostgreSQL jamais utilisé) | `server/routes.ts:119` |
| [AUTH-07](#auth-07) | moyenne | bug | S | CSRF activé en production (npm start) mais jamais envoyé par le client | `server/index.ts:40` |
| [BACKUP-02](#backup-02) | moyenne | bug | S | Une sauvegarde ratée reste « En cours » indéfiniment | `server/backupService.ts:153` |
| [BACKUP-03](#backup-03) | moyenne | perf-serveur | S | Le dump complet est relu en mémoire de façon synchrone pour compter les tables | `server/backupService.ts:134` |
| [BACKUP-04](#backup-04) | moyenne | perf-api | S | La connexion attend la vérification (voire l'exécution) de la sauvegarde quotidienne | `server/localAuth.ts:165` |
| [BACKUP-06](#backup-06) | moyenne | lisibilite | S | Informations répétées trois fois et libellés techniques | `client/src/pages/BackupManager.tsx:205` |
| [BACKUP-07](#backup-07) | moyenne | accessibilite | S | Ligne de sauvegarde non responsive et bouton supprimer sans nom accessible | `client/src/pages/BackupManager.tsx:366` |
| [BACKUP-09](#backup-09) | moyenne | bug | S | Téléchargement de sauvegarde vulnérable au path traversal | `server/backupService.ts:203` |
| [BAP-01](#bap-01) | moyenne | lisibilite | S | Jargon technique et prénoms codés en dur | `client/src/pages/WebhookBAPConfig.tsx:166` |
| [DEBUG-01](#debug-01) | moyenne | perf-serveur | S | Scan de schéma en N+1 avec COUNT(*) complet, refait pour le téléchargement | `server/routes.ts:4831` |
| [DEBUG-02](#debug-02) | moyenne | ux-simplicite | S | Outil développeur incompréhensible pour un admin non technicien | `client/src/pages/DatabaseDebug.tsx:73` |
| [ERR-01](#err-01) | moyenne | lisibilite | M | Messages d'erreur bruts (code HTTP + JSON, en anglais) affichés dans les toasts | `client/src/lib/queryClient.ts:6` |
| [NF-01](#nf-01) | moyenne | lisibilite | S | Page 404 en anglais avec message de développeur et sans retour | `client/src/pages/not-found.tsx:11` |
| [NOCO-01](#noco-01) | moyenne | bug | S | Jeton API NocoDB déchiffré envoyé au navigateur et affiché en clair | `server/storage.ts:1657` |
| [NOCO-03](#noco-03) | moyenne | ux-simplicite | M | Plusieurs configurations « Actif » possibles, une seule utilisée au hasard | `server/storage.ts:1665` |
| [SQL-02](#sql-02) | moyenne | perf-api | S | Résultats SQL non bornés, dupliqués et rendus en un bloc illisible | `server/routes.ts:6197` |
| [UTIL-01](#util-01) | moyenne | ux-simplicite | M | Six onglets plats mêlant outils quotidiens et outils dangereux, inutilisables sur mobile | `client/src/pages/Utilities.tsx:81` |
| [UTIL-03](#util-03) | moyenne | perf-bundle | M | Pages admin importées statiquement dans le bundle principal de tous les utilisateurs | `client/src/components/RouterProduction.tsx:17` |
| [WEATHER-01](#weather-01) | moyenne | bug | S | Changer la ville ne met pas à jour le widget météo (cache non vidé, requête non invalidée) | `server/routes.ts:5639` |
| [WEATHER-02](#weather-02) | moyenne | bug | S | Géolocalisation météo modifiable par n'importe quel utilisateur connecté | `server/routes.ts:6096` |
| [ADMIN-03](#admin-03) | basse | perf-serveur | S | Chaque handler admin relit l'utilisateur en BD pour vérifier le rôle | `server/routes.ts:5175` |
| [AUTH-08](#auth-08) | basse | bug | S | Limite de 5 connexions/15 min par IP et message d'erreur trompeur | `client/src/pages/AuthPage.tsx:76` |
| [AUTH-09](#auth-09) | basse | dette-code | S | Deux implémentations de connexion, hook appelé hors rendu, double soumission | `client/src/pages/AuthPage.tsx:171` |
| [BACKUP-05](#backup-05) | basse | perf-client | S | Polling 30 s inconditionnel de la liste des sauvegardes | `client/src/pages/BackupManager.tsx:61` |
| [BACKUP-08](#backup-08) | basse | bug | S | Toast de l'interrupteur calculé sur l'ancienne valeur et bascule différée | `client/src/pages/BackupManager.tsx:78` |
| [BACKUP-10](#backup-10) | basse | coherence-design | S | Double en-tête de page et bouton principal orange | `client/src/pages/BackupManager.tsx:196` |
| [BAP-02](#bap-02) | basse | ux-simplicite | S | Bouton Sauvegarder isolé et statut de test périmé | `client/src/pages/WebhookBAPConfig.tsx:251` |
| [BAP-03](#bap-03) | basse | bug | S | Validation renvoyée en 500 et configuration factice avec URL de production | `server/routes.ts:236` |
| [LAND-01](#land-01) | basse | dette-code | S | Page Landing morte qui pointe vers une route inexistante | `client/src/pages/Landing.tsx:7` |
| [NOCO-02](#noco-02) | basse | dette-code | S | Log de debug à chaque rendu et code défensif opaque | `client/src/pages/NocoDBConfig.tsx:66` |
| [NOCO-04](#noco-04) | basse | accessibilite | S | Boutons Modifier/Supprimer icône seule et suppression sans avertissement d'impact | `client/src/pages/NocoDBConfig.tsx:300` |
| [NOCO-05](#noco-05) | basse | bug | S | Formulaire de création non réinitialisé après succès | `client/src/pages/NocoDBConfig.tsx:84` |
| [NOCO-06](#noco-06) | basse | dette-code | S | Formulaires de création et d'édition dupliqués | `client/src/pages/NocoDBConfig.tsx:371` |
| [NOCO-07](#noco-07) | basse | lisibilite | M | Libellés anglais/jargon et aucun test de connexion | `client/src/pages/NocoDBConfig.tsx:406` |
| [SQL-03](#sql-03) | basse | dette-code | S | Bouton « SQL Webhook BAP » obsolète, état dupliqué et log de démarrage effacé | `client/src/pages/SQLExecutor.tsx:100` |
| [UTIL-02](#util-02) | basse | ux-simplicite | S | Onglet actif non reflété dans l'URL | `client/src/pages/Utilities.tsx:28` |
| [UTIL-04](#util-04) | basse | coherence-design | M | Conteneurs, titres et états de chargement différents dans chaque onglet | `client/src/pages/NocoDBConfig.tsx:231` |
| [WEATHER-03](#weather-03) | basse | dette-code | S | Formulaire non contrôlé manipulé via le DOM, fetch manuels et erreurs en anglais | `client/src/pages/WeatherSettings.tsx:318` |
| [WEATHER-04](#weather-04) | basse | perf-serveur | S | /api/weather/current recalculé à chaque appel sans cache mémoire | `server/routes.ts:5683` |

### ADMIN-01

**Hook d'auth non partagé : flash « Accès refusé » et cascade de /api/user à chaque onglet** — bug, sévérité haute, effort M

- **Fichier :** `client/src/hooks/useAuthUnified.ts:23`
- **Constat :** useAuthUnified.ts:23-24 `const [productionUser, setProductionUser] = useState<any>(null); const [productionLoading, setProductionLoading] = useState(true);` + useEffect l.148-167 `fetch('/api/user', { credentials: 'include', cache: 'no-cache' ...})` : état local par instance. Utilities.tsx:26 `const { user } = useAuthUnified();` puis l.45 `if (!canManageBackups && !canManageNocoDB && ...) return (... Accès refusé ...)` sans tenir compte d'isLoading ; même schéma BackupManager.tsx:48/54/177, NocoDBConfig.tsx:45/211 (« Accès restreint »), DatabaseDebug.tsx:8/41. Les requêtes attendent ce second appel : BackupManager.tsx:60 `enabled: canManageBackups`, NocoDBConfig.tsx:58 `enabled: user?.role === 'admin'`.
- **Impact :** À l'ouverture de /utilities, l'admin voit une carte « Accès refusé » (Utilities), puis une seconde (onglet), puis un spinner : 3 allers-retours séquentiels (/api/user → /api/user → /api/backups) avant la liste. /api/user est appelé ≥5 fois par affichage (RouterProduction, Layout, Sidebar via useAuthSimple, Utilities, onglet) et de nouveau à chaque changement d'onglet.
- **Recommandation :** Source unique : `useQuery({ queryKey: ['/api/user'], queryFn: getQueryFn({ on401: 'returnNull' }) sans redirection, staleTime: 5*60_000, retry: false })`. Attention : le queryFn par défaut (queryClient.ts:56-61) fait `window.location.href = '/auth'` sur un 401, ce qui changerait le comportement de RouterProduction (il affiche aujourd'hui AuthPage directement sur '/'). Il faut donc un queryFn dédié qui renvoie null sans rediriger. Garder la même forme de retour { user, isLoading, isAuthenticated, refreshAuth, forceAuthRefresh } pour les ~15 appelants, et faire de useAuthSimple un alias. Dans Utilities, afficher un skeleton tant que isLoading. Les contrôles de rôle dans les onglets peuvent ensuite être retirés (Utilities est le seul point d'entrée de ces pages).

### AUTH-01

**Script tiers replit.com bloquant en production, lang="en" et zoom désactivé** — perf-bundle, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `client/index.html:19`
- **Constat :** client/index.html:18-19 `<script type="text/javascript" src="https://replit.com/public/js/replit-dev-banner.js"></script>` (classique, sans async/defer) présent aussi dans dist/public/index.html ; l.2 `<html lang="en">` ; l.5 `content="width=device-width, initial-scale=1.0, maximum-scale=1"`.
- **Impact :** Le module de l'application (différé) ne s'exécute qu'après le téléchargement de ce script tiers : si replit.com est lent ou filtré par le réseau du magasin, l'écran reste blanc jusqu'au timeout. Chrome propose de « traduire depuis l'anglais » une interface française ; zoom bloqué sur mobile (malvoyants).
- **Recommandation :** Partie mécanique : supprimer la balise replit (l.18-19) et passer `lang="fr"`. Le retrait de `maximum-scale=1` est souhaitable pour l'accessibilité, mais il faut d'abord vérifier que les champs natifs ont une police d'au moins 16px sur mobile. À traiter séparément.

### BACKUP-01

**Suppression d'une sauvegarde en un clic, sans confirmation** — ux-simplicite, sévérité haute, effort S

- **Fichier :** `client/src/pages/BackupManager.tsx:142`
- **Constat :** l.142-145 `const handleDelete = (filename: string) => { setDeletingBackup(filename); deleteBackupMutation.mutate(filename); };` appelé directement par l.388-391 `<Button variant="outline" size="sm" onClick={() => handleDelete(backup.filename)} ... className="text-red-600 hover:text-red-700">` (icône Trash2 seule). Côté serveur backupService.ts:186-193 `fs.unlinkSync(filepath)` puis suppression de l'enregistrement.
- **Impact :** Un clic accidentel (bouton sans libellé collé à « Télécharger ») détruit définitivement une sauvegarde, potentiellement la seule récente. Incohérent avec NocoDBConfig qui demande confirmation (l.631-662).
- **Recommandation :** AlertDialog « Supprimer la sauvegarde du 02/10/2026 à 02:00 ? Cette action est définitive. » avec bouton destructif « Supprimer » ; aria-label/title « Supprimer » sur l'icône ; interdire la suppression de la dernière sauvegarde terminée.

### SQL-01

**Exécution de SQL brut en production sans confirmation ni filet de sécurité** — ux-simplicite, sévérité haute, effort M

- **Fichier :** `client/src/pages/SQLExecutor.tsx:97`
- **Constat :** SQLExecutor.tsx:86-97 `handleExecuteSQL` → `executeMutation.mutate(sqlContent);` sans confirmation ; serveur routes.ts:6178 `const result = await db.execute(sql.raw(sqlQuery));` hors transaction, sans mode lecture seule ; seul garde-fou : le texte d'avertissement l.144-155.
- **Impact :** Un clic sur « Exécuter SQL » applique immédiatement un DROP/DELETE/UPDATE sur la base de production, sans retour arrière ni sauvegarde préalable ; risque majeur de perte de données (script collé par erreur, admin non technicien).
- **Recommandation :** Masquer l'onglet par défaut (variable d'env `ENABLE_SQL_EXECUTOR`) ; sinon détecter les mots-clés destructifs (DROP, DELETE, UPDATE, TRUNCATE, ALTER) → AlertDialog exigeant de taper « EXÉCUTER », sauvegarde automatique avant exécution, option « lecture seule » exécutée dans `BEGIN TRANSACTION READ ONLY`.

### ADMIN-02

**/api/user exécute 4 requêtes SQL alors que req.user est déjà chargé** — perf-api, sévérité moyenne, effort S

- **Fichier :** `server/localAuth.ts:210`
- **Constat :** localAuth.ts:141-143 `passport.deserializeUser(async (id) => { const user = await storage.getUserWithGroups(id); done(null, user); })` puis dans GET /api/user l.210-211 `const userId = (req.user as SelectUser).id; const userWithGroups = await storage.getUserWithGroups(userId);`. storage.ts:371-388 : `const user = await this.getUser(id);` puis un second `db.execute(sql`SELECT ... FROM user_groups ug INNER JOIN groups g ...`)` en série.
- **Impact :** Chaque /api/user = 2 requêtes (désérialisation) + 2 requêtes (handler) séquentielles ; multiplié par ≥5 appels par navigation (ADMIN-01) ≈ 20 allers-retours BD rien que pour l'authentification à chaque page.
- **Recommandation :** Seule la partie 1 est mécanique : dans GET /api/user, construire la réponse à partir de `req.user` (déjà un UserWithGroups fourni par deserializeUser) avec exactement les mêmes champs, `userGroups: req.user.userGroups || []`. La branche 404 disparaît : un utilisateur supprimé donne alors 401 via isAuthenticated(), ce qui reste acceptable. La réécriture de getUserWithGroups en json_agg (partie 2) est à traiter à part. La fonction est appelée ~106 fois dans routes.ts, et json_agg renvoie createdAt/updatedAt en chaînes au lieu d'objets Date. MemStorage (storage.ts:3606) doit aussi garder la même forme.

### AUTH-02

**Fichiers statiques servis sans compression ni cache long** — perf-serveur, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/index.production.ts:143`
- **Constat :** index.production.ts:143-144 `app.use('/assets', express.static(join(publicPath, 'assets'))); app.use('/', express.static(publicPath));` sans maxAge/immutable ni compression ; server/vite.ts:79 `app.use(express.static(distPath));` idem ; `setupCompression` (server/cache.ts:93-100) n'est appelé nulle part et ne ferait que poser `Content-Encoding: gzip` sans compresser.
- **Impact :** ~1,7 Mo de JS + 120 Ko de CSS transférés non compressés au premier affichage de /auth (≈ 4-5× plus qu'en gzip), puis revalidés à chaque ouverture alors que les noms de fichiers sont hachés.
- **Recommandation :** Partie sûre : `app.use('/assets', express.static(assetsPath, { maxAge: '1y', immutable: true }))` dans index.production.ts et dans serveStatic (vite.ts), et `Cache-Control: no-cache` sur l'envoi d'index.html. Pour la compression : d'abord vérifier la configuration nginx. Sinon, ajouter la dépendance `compression`, la déclarer `--external:compression` dans le Dockerfile et l'installer en production. Supprimer setupCompression.

### AUTH-03

**Double vérification d'auth, double spinner, puis 500 ms d'attente et rechargement complet** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/AuthPage.tsx:69`
- **Constat :** RouterProduction.tsx:56 appelle useAuthUnified (fetch /api/user) et affiche un spinner l.79-88 ; AuthPage.tsx:23 rappelle useAuthUnified (nouveau fetch, état local) et affiche un second spinner plein écran l.180-189 ; après succès l.68-71 `setTimeout(() => { window.location.href = "/"; }, 500);` alors que POST /api/login renvoie déjà l'utilisateur (localAuth.ts:174-182).
- **Impact :** Deux spinners successifs avant le formulaire ; après validation, 500 ms d'attente artificielle + rechargement complet de l'application (revalidation des 1,7 Mo, nouvelle cascade de /api/user) avant le tableau de bord.
- **Recommandation :** Lire l'état d'auth depuis la source partagée (ADMIN-01) sans nouveau fetch ; après login : `queryClient.setQueryData(['/api/user'], user)` puis `setLocation('/')`, sans reload ni délai.

### AUTH-04

**Identifiants admin/admin affichés par défaut avant (et sans) vérification** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/AuthPage.tsx:25`
- **Constat :** l.25 `const [showDefaultCredentials, setShowDefaultCredentials] = useState(true);` ; l.41-45 en cas d'erreur `return { showDefault: true };` ; l.256-273 « Identifiant : admin / Mot de passe : admin » ; endpoint public localAuth.ts:234-241 `res.json({ showDefault: !!showDefault })` sans authentification.
- **Impact :** Les identifiants par défaut s'affichent à chaque ouverture de l'écran de connexion le temps de la requête (en permanence si elle échoue), même après changement du mot de passe ; un visiteur peut savoir si le compte admin a toujours son mot de passe d'origine.
- **Recommandation :** Valeur initiale `false`, afficher seulement si la réponse vaut `true`, `false` en cas d'erreur ; à terme limiter l'endpoint au premier démarrage.

### AUTH-05

**Champs de connexion sans autoComplete/autoCapitalize (échecs sur mobile)** — accessibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/AuthPage.tsx:224`
- **Constat :** l.224-231 `<Input id="login-username" type="text" value={loginData.username} ... required placeholder="Votre identifiant" />` et l.234-242 champ mot de passe, sans autoComplete, autoCapitalize, autoCorrect ni spellCheck ; serveur storage.ts:351-353 `db.select().from(users).where(eq(users.username, username))` : comparaison sensible à la casse, sans trim.
- **Impact :** Sur téléphone/tablette, le clavier met une majuscule (« Admin ») ou un espace final → « Identifiant ou mot de passe incorrect » alors que l'utilisateur a bien tapé ; gestionnaires de mots de passe mal détectés.
- **Recommandation :** Partie automatisable : `autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false}` sur l'identifiant, `autoComplete="current-password"` sur le mot de passe, et `username.trim()` avant envoi. La comparaison `lower(username)` côté serveur est une décision séparée (risque de doublons de casse existants en base).

### AUTH-06

**Sessions stockées en mémoire en production (fichier d'auth PostgreSQL jamais utilisé)** — bug, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:119`
- **Constat :** routes.ts:4 `import { setupLocalAuth, requireAuth } from "./localAuth";`, l.119 `const setupAuth = setupLocalAuth;`, l.183 `await setupAuth(app);` → localAuth.ts:96-110 `console.log('🔧 Using memory session store for development'); ... app.use(session(sessionSettings));` sans `store`, cookie `maxAge: 24 * 60 * 60 * 1000` (l.106). index.production.ts:8 importe localAuth.production.js (store PostgreSQL l.142-147) mais n'appelle jamais son setupLocalAuth.
- **Impact :** Chaque redémarrage/déploiement déconnecte tous les magasins ; MemoryStore fuit en mémoire ; reconnexion obligatoire chaque jour.
- **Recommandation :** Utiliser connect-pg-simple (déjà importé à localAuth.ts:9) quand DATABASE_URL est défini. Pour `secure: true` derrière le proxy nginx, ajouter aussi `app.set('trust proxy', 1)` (présent seulement dans localAuth.production.ts:161), sinon le cookie n'est pas émis et la connexion casse. Supprimer localAuth.production.ts seulement après avoir retiré l'import à index.production.ts:8.

### AUTH-07

**CSRF activé en production (npm start) mais jamais envoyé par le client** — bug, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/index.ts:40`
- **Constat :** index.ts:39-42 `if (process.env.NODE_ENV === 'production') { setupCsrfProtection(app); }` ; security.ts:59-70 rejette tout POST/PUT/DELETE dont l'en-tête `x-csrf-token` ne correspond pas au cookie ; aucune occurrence de « csrf » dans client/src (AuthPage.tsx:53-60 `fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, ...})`). L'exemption security.ts:50-53 `'/api/webhook'` testée par `startsWith` exempte aussi `/api/webhook-bap-config`.
- **Impact :** Avec le script `start` de package.json (`node dist/server/index.js`), la connexion échoue en 403 avec le message anglais « Request rejected due to security validation failure », ainsi que toutes les mutations des autres pages.
- **Recommandation :** Centraliser l'envoi de `x-csrf-token` (lu dans le cookie `csrf_token`) dans apiRequest, et faire passer par lui les fetch d'écriture (AuthPage, WeatherSettings, SQLExecutor, WebhookBAPConfig…). Corriger l'exemption en `/api/webhook/`. Décider ensuite si index.production.ts doit appliquer les mêmes middlewares de sécurité qu'index.ts.

### BACKUP-02

**Une sauvegarde ratée reste « En cours » indéfiniment** — bug, sévérité moyenne, effort S

- **Fichier :** `server/backupService.ts:153`
- **Constat :** backupService.ts:106-115 insère d'abord `status: 'creating'` ; en cas d'échec de pg_dump, l.153-156 `} catch (error) { console.error('❌ Backup failed:', error); throw new Error(`Backup failed: ...`) }` sans mise à jour du statut. BackupManager.tsx:170-171 prévoit `case 'failed': return <Badge variant="destructive">Échec</Badge>;` jamais atteint ; l.286-294 « Dernière Sauvegarde » affiche `backups[0]` quel que soit son statut.
- **Impact :** Une sauvegarde échouée est affichée « En cours » pour toujours, présentée comme « Dernière sauvegarde » et occupe une des 10 places : l'admin croit la base protégée alors qu'elle ne l'est pas.
- **Recommandation :** Sortir `id` et `filepath` du try (ils sont déclarés dedans, donc inaccessibles dans le catch). Dans le catch : `await db.update(databaseBackups).set({ status: 'failed' }).where(eq(databaseBackups.id, id))` et supprimer le fichier partiel s'il existe. Dans les deux vérifications quotidiennes, ne considérer que `status = 'completed'`, pour qu'un échec soit retenté. Côté client : « Dernière sauvegarde » = premier élément `completed`, et un bandeau si la dernière tentative a échoué.

### BACKUP-03

**Le dump complet est relu en mémoire de façon synchrone pour compter les tables** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/backupService.ts:134`
- **Constat :** backupService.ts:131 `await execAsync(command, { env });` puis l.133-135 `const stats = fs.statSync(filepath); const sqlContent = fs.readFileSync(filepath, 'utf8'); const tablesCount = (sqlContent.match(/CREATE TABLE/g) || []).length;`. routes.ts:5195-5196 `const backup = await backupService.createBackup('manual', user.id); res.json(backup);`.
- **Impact :** Le fichier de dump (dizaines/centaines de Mo si la base contient logos/PDF en base64) est chargé en mémoire et parcouru par regex sur le thread principal : toutes les requêtes API des magasins sont gelées pendant ce temps (sauvegarde nocturne, manuelle ou déclenchée au login) ; pic mémoire du process.
- **Recommandation :** Remplacer par `const stats = await fs.promises.stat(filepath)` et un comptage SQL qui reste proche de ce que pg_dump inclut (toutes les tables utilisateur, pas seulement public) : `SELECT count(*) FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog','information_schema')`. Ainsi le nombre de tables affiché ne change pas sensiblement.

### BACKUP-04

**La connexion attend la vérification (voire l'exécution) de la sauvegarde quotidienne** — perf-api, sévérité moyenne, effort S

- **Fichier :** `server/localAuth.ts:165`
- **Constat :** localAuth.ts:160-172 `req.login(user, async (err) => { ... const backupResult = await backupService.checkAndPerformDailyBackup(user.id); ... res.json({...})`. backupService.ts:240-285 : 2 requêtes (utilities, database_backups) puis, si aucune sauvegarde automatique n'existe pour la date UTC du jour, `await this.createBackup('automatic', resolvedUserId);` (pg_dump complet), sans verrou.
- **Impact :** Chaque connexion paie 2 requêtes supplémentaires ; la première connexion du jour sans sauvegarde (serveur redémarré, avant 2h, échec nocturne) reste bloquée sur « Connexion... » pendant tout le pg_dump ; deux connexions simultanées peuvent lancer deux dumps.
- **Recommandation :** Ne plus attendre : `setImmediate(() => backupService.checkAndPerformDailyBackup(user.id).catch(console.error))`, puis `res.json(...)` immédiatement (même corps de réponse). Ajouter dans BackupService une promesse « en cours » (`if (this.running) return this.running`) partagée par checkAndPerformDailyBackup et scheduleAutomaticBackup. Supprimer l'appel au login est une décision produit séparée.

### BACKUP-06

**Informations répétées trois fois et libellés techniques** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/BackupManager.tsx:205`
- **Constat :** Même état répété : en-tête l.205 « Sauvegarde automatique quotidienne à 2h00 - Maximum 10 fichiers conservés », carte l.232-247 « Configuration des Sauvegardes Automatiques… Les sauvegardes automatiques sont actives », carte l.302-317 « Statut Système… Actif / Sauvegarde automatique 2h00 ». Titre de ligne = nom de fichier l.360-361 `{backup.filename}` (ex. backup_automatic_2026-10-02T00-00-01-123Z.sql), « PostgreSQL » l.328, unités anglaises l.148 `['Bytes', 'KB', 'MB', 'GB']`, description serveur franglaise backupService.ts:108 `${type === 'manual' ? 'Manuel' : 'Automatique'} backup du ...`.
- **Impact :** Page dense et technique ; l'information utile (« ma dernière sauvegarde est-elle récente et réussie ? ») est noyée pour un admin non informaticien.
- **Recommandation :** Fusionner interrupteur + statut en une carte (« Sauvegarde automatique chaque nuit : Activée — dernière réussie cette nuit à 02:00 »). Ligne : titre « Sauvegarde automatique — jeu. 2 oct. 2026, 02:00 », sous-titre « 12,4 Mo », nom de fichier en infobulle. Unités o/Ko/Mo/Go ; description « Sauvegarde manuelle du … ».

### BACKUP-07

**Ligne de sauvegarde non responsive et bouton supprimer sans nom accessible** — accessibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/BackupManager.tsx:366`
- **Constat :** l.349-353 `<div className="flex items-center justify-between p-4 border rounded-lg"><div className="flex items-center space-x-4">` et l.366 `<div className="text-sm text-gray-500 flex items-center space-x-4 mt-1">` (date + taille + tables + 2 badges) sans flex-wrap ; nom de fichier l.360 sans truncate ; bouton l.388-400 icône seule sans aria-label. Conteneur parent Layout.tsx:211 `overflow-x-hidden` ; route /utilities exposée sur mobile (RouterProduction.tsx:125).
- **Impact :** Sur tablette, sidebar ouverte ou téléphone, la ligne déborde et les boutons Télécharger/Supprimer sont coupés ; lecteur d'écran : bouton « sans nom ».
- **Recommandation :** Remplacer `space-x-4` par `flex-wrap gap-x-4 gap-y-1`, ajouter `min-w-0 truncate` sur le nom, `flex-col sm:flex-row` pour empiler les actions, `aria-label="Supprimer la sauvegarde"` + `title`.

### BACKUP-09

**Téléchargement de sauvegarde vulnérable au path traversal** — bug, sévérité moyenne, effort S

- **Fichier :** `server/backupService.ts:203`
- **Constat :** backupService.ts:202-209 `async downloadBackup(filename: string) { const filepath = path.join(this.backupDir, filename); if (!fs.existsSync(filepath)) throw ...; return filepath; }` appelé par routes.ts:5210-5213 `const { filename } = req.params; const filepath = await backupService.downloadBackup(filename); res.download(filepath, filename, ...)` sans vérifier l'existence en BD (contrairement à deleteBackup l.175-183).
- **Impact :** `/api/backups/..%2F..%2F.env/download` (paramètre décodé par Express) permet de lire des fichiers hors du dossier de sauvegarde (.env avec DATABASE_URL, SESSION_SECRET) depuis une session admin.
- **Recommandation :** Dans downloadBackup (et deleteBackup) : rejeter si `!/^backup_(manual|automatic)_[\w-]+\.sql$/.test(filename)`, puis vérifier `path.resolve(filepath).startsWith(path.resolve(this.backupDir) + path.sep)`. Le format actuel `backup_${type}_${ISO avec : et . remplacés par -}.sql` passe la regex.

### BAP-01

**Jargon technique et prénoms codés en dur** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/WebhookBAPConfig.tsx:166`
- **Constat :** l.163 « Configuration Webhook BAP », l.166 « Configurez l'URL du webhook n8n pour l'envoi des fichiers BAP vers Laurie et Jeremy », l.181 « URL du Webhook n8n * », l.195 « URL complète du webhook n8n qui recevra les fichiers PDF BAP », l.246 « Tester le Webhook », l.216 interrupteur « Configuration active » sans explication.
- **Impact :** Jargon (webhook, n8n) et sigle BAP non expliqué ; prénoms qui deviendront faux au prochain changement d'équipe ; l'admin ne sait pas ce que fait l'interrupteur.
- **Recommandation :** Titre « Envoi automatique des BAP (bons à payer) », champ « Adresse de réception (fournie par votre informaticien) », description sans prénoms (ou destinataires configurables), aide sous l'interrupteur : « Désactivé : le bouton BAP n'enverra plus de fichiers ».

### DEBUG-01

**Scan de schéma en N+1 avec COUNT(*) complet, refait pour le téléchargement** — perf-serveur, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:4831`
- **Constat :** routes.ts:4813-4846 `for (const tableRow of tablesResult.rows) { ... const columnsResult = await pool.query(columnsQuery, [tableName]); ... const countQuery = `SELECT COUNT(*) as total FROM "${tableName}"`; await pool.query(countQuery); }` ; /api/debug/download-schema refait le même balayage (l.4971 et 4984) ; DatabaseDebug.tsx:104-113 n'affiche « Télécharger » qu'après le scan.
- **Impact :** ≈ 2 requêtes séquentielles par table (dont un COUNT(*) en scan complet sur les grosses tables), exécutées deux fois pour obtenir le fichier, plus des centaines de lignes de log.
- **Recommandation :** Priorité basse. Une seule requête information_schema.columns regroupée en JS, des comptes exacts en Promise.all (ou n_live_tup en l'indiquant « ≈ » dans le rapport), et un endpoint unique qui renvoie directement le fichier.

### DEBUG-02

**Outil développeur incompréhensible pour un admin non technicien** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/DatabaseDebug.tsx:73`
- **Constat :** l.73-75 « scanner votre base de données de production et logger toutes les tables, colonnes et relations dans les logs du serveur », l.80-81 « ne marche qu'en production sur votre serveur privé », l.129 « Relations FK », l.155-157 « logs de votre application Node.js… "🔍 ===== DÉBUT SCAN SCHÉMA BASE DE DONNÉES =====" », émojis l.80/126/132/135 ; parcours en 2 temps puis `window.open('/api/debug/download-schema', '_blank')` l.106.
- **Impact :** Onglet inutilisable sans accès aux logs Docker ; sa présence au même niveau que « Sauvegardes » alourdit la page et inquiète l'utilisateur.
- **Recommandation :** Retirer de l'interface standard ou le placer dans « Outils avancés » sous forme d'un bouton unique « Télécharger le rapport technique » (lien `<a href download>` au lieu de window.open).

### ERR-01

**Messages d'erreur bruts (code HTTP + JSON, en anglais) affichés dans les toasts** — lisibilite, sévérité moyenne, effort M

- **Fichier :** `client/src/lib/queryClient.ts:6`
- **Constat :** queryClient.ts:3-7 `const text = (await res.text()) || res.statusText; throw new Error(`${res.status}: ${text}`);` affiché tel quel par BackupManager.tsx:86/105/125 `description: error.message || ...`, NocoDBConfig.tsx:95/116/137, WebhookBAPConfig.tsx:86 ; messages serveur en anglais routes.ts:5177 `{ message: "Access denied" }`, 5199 `"Failed to create backup"`, 5120 `'Failed to create configuration'`.
- **Impact :** L'utilisateur voit par ex. « 500: {"message":"Failed to create backup"} » : JSON brut, code HTTP et anglais, incompréhensible pour un non-technicien.
- **Recommandation :** Si on lève `Object.assign(new Error(body.message || body.error || défaut), { status })`, il faut adapter TOUTES les détections de 401 basées sur le texte, pas seulement queryClient.ts:81. Sont aussi concernés useAuthUnified.ts:32 et useAuth.ts:8 (`error?.message?.includes('401')`). Utiliser `error.status === 401` partout, et garder `${status}` dans le message en transition. Le changement touche toute l'application et doit être testé.

### NF-01

**Page 404 en anglais avec message de développeur et sans retour** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/not-found.tsx:11`
- **Constat :** l.11 `<h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>`, l.15 « Did you forget to add the page to the router? », aucun lien ; l.6 `min-h-screen` alors que la page est rendue dans Layout (RouterProduction.tsx:192) et MobileApp (l.142).
- **Impact :** Un employé qui suit un ancien lien ou fait une faute de frappe voit un message technique en anglais sans moyen évident de revenir ; hauteur d'écran doublée sous l'en-tête.
- **Recommandation :** « Page introuvable — Cette page n'existe pas ou a été déplacée. » + bouton « Retour au tableau de bord » (`<Link href="/">`) ; remplacer `min-h-screen` par `py-16`.

### NOCO-01

**Jeton API NocoDB déchiffré envoyé au navigateur et affiché en clair** — bug, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:1657`
- **Constat :** storage.ts:1655-1658 `getNocodbConfigs() { const configs = await db.select()...; return configs.map((c) => this.decryptNocodbConfig(c)); }` → routes.ts:5097-5098 `res.json(configs)`. NocoDBConfig.tsx:340 `{formatToken(config.apiToken, showTokens[config.id])}` + bouton œil l.342-352 ; l.183 réinjecte le jeton dans le formulaire d'édition ; l.66-78 `console.log('🔍 NocoDBConfig Debug:', { rawConfigs, ... })` à chaque rendu (non conditionné à DEV dans le source).
- **Impact :** Le chiffrement au repos est contourné : le jeton d'accès aux factures de tous les magasins transite, reste dans le cache React Query et la console, et s'affiche d'un clic (également chargé par Groups.tsx:85).
- **Recommandation :** En plus de la recommandation (renvoyer `apiToken` masqué + `apiTokenSet: true`, champ vide en édition = conserver le jeton, ce qui implique de ne pas passer apiToken à updateNocodbConfig s'il est vide) : restreindre ou supprimer GET /api/nocodb-config/active. Le client ne l'appelle pas (aucune occurrence dans client/src), et invoiceVerification passe par storage directement. Vérifier Groups.tsx:84-86, qui lit la même queryKey mais n'utilise pas apiToken.

### NOCO-03

**Plusieurs configurations « Actif » possibles, une seule utilisée au hasard** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `server/storage.ts:1665`
- **Constat :** storage.ts:1665-1671 `db.select().from(nocodbConfig).where(eq(nocodbConfig.isActive, true)).limit(1)` sans ORDER BY, utilisé par invoiceVerification.ts:360 et 734 ; createNocodbConfig (storage.ts:1682-1686) et l'interrupteur « Configuration active » (NocoDBConfig.tsx:454-473) n'empêchent pas plusieurs actives ; badge « Actif » sur chaque carte (l.284-290).
- **Impact :** Avec deux configurations actives, la vérification des factures utilise l'une ou l'autre de façon non déterministe ; l'admin ne sait pas laquelle sert ni quels magasins (groups.nocodb_config_id) en dépendent.
- **Recommandation :** Garantir une seule config active (activer l'une désactive les autres dans une transaction) ou utiliser `groups.nocodbConfigId` par magasin ; afficher sur chaque carte « Utilisée par : Magasin A, Magasin B » et un badge « Utilisée pour la vérification des factures ».

### SQL-02

**Résultats SQL non bornés, dupliqués et rendus en un bloc illisible** — perf-api, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:6197`
- **Constat :** routes.ts:6185-6189 place déjà un échantillon JSON de 10 lignes dans `logs`, puis l.6194-6198 `res.json({ success: true, logs, results: result.rows, rowCount })` renvoie toutes les lignes ; client SQLExecutor.tsx:42 `setLogs(prev => [...prev, `📊 Résultats: ${JSON.stringify(result.results, null, 2)}`])`, rendu l.224-228 `<div key={index} className="mb-1">{log}</div>` sans whitespace-pre (indentation perdue) dans un conteneur l.220 `min-h-[300px] ... overflow-auto` sans hauteur max.
- **Impact :** Un `SELECT * FROM deliveries` renvoie des milliers de lignes sérialisées deux fois puis rendues comme un texte géant sur une seule ligne logique : navigateur figé, résultat illisible, page qui s'allonge indéfiniment.
- **Recommandation :** Serveur : `results: rows.slice(0, 200), truncated: rows.length > 200` et ne plus dupliquer l'échantillon dans logs. Client : tableau (colonnes = clés) dans `max-h-[60vh] overflow-auto`, logs en `whitespace-pre-wrap`.

### UTIL-01

**Six onglets plats mêlant outils quotidiens et outils dangereux, inutilisables sur mobile** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Utilities.tsx:81`
- **Constat :** l.81 `<TabsList className="grid w-full grid-cols-6 mb-6">` avec « Sauvegardes », « Configuration NocoDB », « Debug Base de Données », « Météo », « Configuration BAP », « Exécution SQL » (l.83-116) au même niveau ; la page est servie telle quelle sur mobile (RouterProduction.tsx:125 `<Route path="/utilities" component={Utilities} />`).
- **Impact :** Outils de tous les jours (sauvegardes, météo) côte à côte avec SQL brut et scan de schéma ; libellés jargon (NocoDB, BAP, Debug) ; sur téléphone, 6 colonnes forcées ≈ 55 px chacune : libellés tronqués/superposés.
- **Recommandation :** Regrouper : « Sauvegardes », « Météo », « Connexions externes » (NocoDB + envoi BAP) et « Outils avancés » (Debug + SQL) replié derrière un avertissement ; libellés en français simple ; `TabsList` en `flex overflow-x-auto` (ou Select sur mobile).

### UTIL-03

**Pages admin importées statiquement dans le bundle principal de tous les utilisateurs** — perf-bundle, sévérité moyenne, effort M

- **Fichier :** `client/src/components/RouterProduction.tsx:17`
- **Constat :** RouterProduction.tsx:5-44 importe statiquement toutes les pages (dont NocoDBConfig, DatabaseDebug, BackupManager, Utilities l.17-23) ; Utilities.tsx:18-23 importe les 6 onglets ; aucun `lazy(`/`Suspense` dans client/src. Build : dist/public/assets/index-CCl1yENM.js = 1 081 745 octets, vendor-charts-gtSIDI7m.js = 410 243 octets préchargé par `<link rel="modulepreload" ... vendor-charts-gtSIDI7m.js>` dans dist/public/index.html dès la page de connexion.
- **Impact :** Les employés (qui n'accèdent jamais aux utilitaires) et l'écran de connexion téléchargent et parsent ~1,7 Mo de JS (non compressé, cf. AUTH-02) avant le premier affichage : démarrage lent sur PC de caisse et mobiles.
- **Recommandation :** Commencer par `lazy()` sur Analytics (gain recharts) et Utilities (admin), avec `<Suspense fallback={<PageSkeleton/>}>` autour du Switch desktop et mobile. Supprimer les imports statiques inutilisés de RouterProduction.tsx:17-27. Généraliser ensuite par route, en ajoutant une gestion des erreurs de chargement de chunk : après un déploiement, `emptyOutDir` supprime les anciens chunks, et un onglet resté ouvert planterait à la navigation. Il faut un error boundary qui recharge la page. Ce n'est pas purement mécanique, d'où auto=false.

### WEATHER-01

**Changer la ville ne met pas à jour le widget météo (cache non vidé, requête non invalidée)** — bug, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:5639`
- **Constat :** PUT routes.ts:5637-5640 `const settings = await storage.updateWeatherSettings(id, data); res.json(settings);` sans `clearWeatherCache()` (contrairement à la géolocalisation l.6130) ; storage.ts:2910-2918 `getWeatherData` filtre `eq(weatherData.date, date), eq(weatherData.isCurrentYear, isCurrentYear)` sans la ville ; client WeatherSettings.tsx:54 et 94 n'invalident que `['/api/weather/settings']` alors que le widget lit `['/api/weather/current']` (WeatherWidget.tsx:121-123, refetch 30 min).
- **Impact :** Après avoir remplacé « Nancy » par « Metz » et sauvegardé, l'en-tête affiche la météo de l'ancienne ville jusqu'au lendemain (et jusqu'à 30 min après une géolocalisation) : l'admin pense que le réglage n'a pas fonctionné.
- **Recommandation :** Serveur : lire l'ancienne config (`getWeatherSettings()`) avant la mise à jour, et appeler `storage.clearWeatherCache()` seulement si `data.location` est défini et différent. Attention : clearWeatherCache supprime aussi l'historique N-1, comme le fait déjà la géolocalisation. Client : ajouter `queryClient.invalidateQueries({ queryKey: ['/api/weather/current'] })` dans les deux onSuccess.

### WEATHER-02

**Géolocalisation météo modifiable par n'importe quel utilisateur connecté** — bug, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:6096`
- **Constat :** routes.ts:6094-6099 `app.post('/api/weather/geolocation', isAuthenticated, ...) { const user = await storage.getUserWithGroups(...); if (!user) return res.status(404)...` sans contrôle de rôle, alors que GET/POST/PUT /api/weather/settings exigent `user.role !== 'admin'` (l.5599, 5614, 5633) ; le handler modifie la config globale l.6125-6127 et purge le cache l.6130.
- **Impact :** Un employé peut changer la ville météo affichée dans tous les magasins et vider le cache (nouveaux appels facturés à l'API Visual Crossing).
- **Recommandation :** Ajouter `requireAdmin` (server/permissions.ts:78) sur la route.

### ADMIN-03

**Chaque handler admin relit l'utilisateur en BD pour vérifier le rôle** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:5175`
- **Constat :** routes.ts:5175 `const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id); if (!user || user.role !== 'admin')` répété l.4778, 4906, 5092, 5107, 5126, 5143, 5190, 5205, 5227, 5598, 5613, 5632, 5652 ; routes.ts:194, 215, 251, 340, 361, 6159 `await storage.getUser(userId)`. Or server/permissions.ts:78-94 `requireAdmin` lit déjà `req.user?.role` sans requête.
- **Impact :** +1 à 2 requêtes SQL séquentielles avant chaque réponse admin (dont le polling /api/backups toutes les 30 s) et ~20 blocs de code dupliqués.
- **Recommandation :** Remplacer route par route : requireAdmin seulement là où le contrôle actuel est `role !== 'admin'`, et requireAdminOrDirecteur (permissions.ts:97) pour /api/utilities et /api/payment-schedule. Remplacer chaque usage ultérieur de `user` par `req.user` (id, username). Vérifier que le client n'affiche pas `error.error` sur ces 403. À faire handler par handler, avec relecture.

### AUTH-08

**Limite de 5 connexions/15 min par IP et message d'erreur trompeur** — bug, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/AuthPage.tsx:76`
- **Constat :** security.ts:153-161 `const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, message: { error: 'Trop de tentatives de connexion...' } })` appliqué l.185 à `/api/login`, sans `skipSuccessfulRequests` ; AuthPage.tsx:73-77 n'affiche que `errorData.message || "Identifiant ou mot de passe incorrect"`.
- **Impact :** (server/index.ts) Dans un magasin où tous les postes sortent par la même IP, la 6e connexion en 15 min — même si les précédentes ont réussi — est refusée et l'employé lit « Identifiant ou mot de passe incorrect » ; il réessaie et prolonge le blocage.
- **Recommandation :** Côté client (valable partout) : `errorData.message || errorData.error`, et un message dédié pour le statut 429. Côté serveur : `skipSuccessfulRequests: true` et un `max` adapté aux magasins derrière une IP partagée. À coordonner avec la décision d'activer ou non security.ts dans index.production.ts (voir AUTH-07).

### AUTH-09

**Deux implémentations de connexion, hook appelé hors rendu, double soumission** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/AuthPage.tsx:171`
- **Constat :** AuthPage.tsx:15-19 `getEnvironment()` (hostname seul) choisit l.171-177 entre `handleProductionLogin` (fetch, l.50-89) et `loginMutation` (l.92-139), alors que useAuthUnified.ts:8-11 combine hostname et `import.meta.env.DEV` ; useAuthUnified.ts:129 `const queryClient = useQueryClient();` dans une fonction async (violation des règles des hooks) ; l.86-88 `finally { setIsSubmitting(false); }` réactive le bouton pendant les 500 ms avant redirection ; l.287 « … across tous vos magasins ».
- **Impact :** Comportement de connexion différent selon l'URL (un build de prod servi sur localhost prend le chemin « dev » qui plante sur le hook) ; double soumission possible ; anglicisme visible sur l'écran d'accueil.
- **Recommandation :** Une seule implémentation (useMutation + apiRequest), bouton désactivé jusqu'à la navigation, supprimer getEnvironment et l'appel de hook hors rendu ; corriger « dans tous vos magasins ».

### BACKUP-05

**Polling 30 s inconditionnel de la liste des sauvegardes** — perf-client, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/BackupManager.tsx:61`
- **Constat :** l.57-62 `useQuery({ queryKey: ['/api/backups'], queryFn: () => apiRequest('/api/backups'), enabled: canManageBackups, refetchInterval: 30000 })` alors que la liste ne change qu'à la sauvegarde nocturne ou après une action déjà suivie d'un `invalidateQueries` (l.100, 119).
- **Impact :** Tant que l'onglet est ouvert : une requête toutes les 30 s (~5 requêtes SQL côté serveur) inutile ; inversement l'état « En cours » d'une sauvegarde n'est rafraîchi qu'au mieux toutes les 30 s.
- **Recommandation :** Supprimer le polling (`refetchInterval` absent) et le queryFn explicite. Les invalidations après action et refetchOnMount suffisent. Le polling conditionnel sur 'creating' ne doit être ajouté qu'après BACKUP-02, avec une durée maximale.

### BACKUP-08

**Toast de l'interrupteur calculé sur l'ancienne valeur et bascule différée** — bug, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/BackupManager.tsx:78`
- **Constat :** l.74-81 `onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/utilities'] }); toast({ ..., description: config?.automaticBackupsEnabled ? "Sauvegardes automatiques désactivées" : "Sauvegardes automatiques activées" })` alors que l'interrupteur l.252 affiche `checked={config?.automaticBackupsEnabled !== false}`. POST /api/utilities renvoie déjà la config (routes.ts:381 `res.json(config)`).
- **Impact :** Si aucune ligne utilities n'existe (config null), l'interrupteur paraît activé ; le désactiver affiche « Sauvegardes automatiques activées » (l'inverse). L'interrupteur ne bascule qu'après un refetch supplémentaire.
- **Recommandation :** `onSuccess: (data, enabled) => { queryClient.setQueryData(['/api/utilities'], data); toast({ title: 'Configuration mise à jour', description: enabled ? 'Sauvegardes automatiques activées' : 'Sauvegardes automatiques désactivées' }); }`

### BACKUP-10

**Double en-tête de page et bouton principal orange** — coherence-design, sévérité basse, effort S

- **Fichier :** `client/src/pages/BackupManager.tsx:196`
- **Constat :** Utilities.tsx:64-76 en-tête « Utilitaires d'Administration » (icône w-8 h-8, h2 text-2xl), puis BackupManager.tsx:196-223 second en-tête blanc « Gestion des Sauvegardes » (icône w-8 h-8, h2 text-2xl) ; bouton l.213 `className="bg-accent hover:bg-orange-600 text-white"` alors que NocoDBConfig.tsx:250 utilise la variante par défaut (bleue) pour l'action principale.
- **Impact :** ~200 px perdus avant le contenu, deux titres de même niveau empilés + onglet qui répète le nom ; couleur d'action principale différente selon l'onglet.
- **Recommandation :** Un seul en-tête (Utilities) ; dans l'onglet, une ligne titre + action ; bouton principal en variante par défaut, libellé « Créer une sauvegarde maintenant ».

### BAP-02

**Bouton Sauvegarder isolé et statut de test périmé** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/WebhookBAPConfig.tsx:251`
- **Constat :** Bouton « Sauvegarder » seul en bas de page l.268-286, après la carte de test ; l.251-263 `{testMutation.isSuccess && (... Connexion réussie ...)}` reste affiché après modification de l'URL (aucun `testMutation.reset()` dans le onChange l.186) ; aucune indication de modifications non enregistrées.
- **Impact :** L'admin peut tester une URL, voir « Connexion réussie », la modifier et quitter sans sauvegarder en pensant que tout est en ordre.
- **Recommandation :** Regrouper Tester + Sauvegarder dans le pied d'une même carte, `testMutation.reset()` à chaque changement d'URL, désactiver « Sauvegarder » si rien n'a changé et afficher « Modifications non enregistrées ».

### BAP-03

**Validation renvoyée en 500 et configuration factice avec URL de production** — bug, sévérité basse, effort S

- **Fichier :** `server/routes.ts:236`
- **Constat :** routes.ts:236 `const validatedData = insertWebhookBapConfigSchema.parse(req.body);` dans un try dont le catch l.258-261 renvoie toujours `res.status(500).json({ error: 'Erreur serveur', details: error.message })` ; GET l.206-215 renvoie, si la table manque, `{ id: 1, ..., webhookUrl: "https://workflow.ffnancy.fr/webhook/a3d03176-...", needsTableCreation: true }` (needsTableCreation non exploité par l'UI).
- **Impact :** Une saisie invalide s'affiche comme « 500: {"error":"Erreur serveur","details":"[...zod...]"} » ; le formulaire peut être pré-rempli avec une URL que l'admin n'a jamais saisie.
- **Recommandation :** `if (error instanceof z.ZodError) return res.status(400).json({ message: 'URL ou champs invalides' })` ; supprimer la configuration factice (renvoyer null).

### LAND-01

**Page Landing morte qui pointe vers une route inexistante** — dette-code, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Landing.tsx:7`
- **Constat :** Aucun import de Landing dans client/src ; l.6-8 `const handleLogin = () => { window.location.href = "/api/login"; };` alors que /api/login n'existe qu'en POST (localAuth.ts:153) ; classes `bg-surface`, `bg-delivered` et branding « La Foir'Fouille » codé en dur.
- **Impact :** Code mort qui entretient la confusion (deux écrans d'accueil) ; réactivée, ses trois boutons mèneraient à une erreur.
- **Recommandation :** Supprimer client/src/pages/Landing.tsx. Pour localAuth.production.ts : retirer d'abord l'import inutilisé à server/index.production.ts:8, puis supprimer le fichier, en le traitant avec AUTH-06 car il contient la configuration PG store et trust proxy à reprendre.

### NOCO-02

**Log de debug à chaque rendu et code défensif opaque** — dette-code, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/NocoDBConfig.tsx:66`
- **Constat :** l.61-78 `// Protection quadruple couche pour éviter les erreurs TypeError  const configs = rawConfigs || []; const safeConfigs = Array.isArray(configs) ? configs : []; console.log('🔍 NocoDBConfig Debug:', { rawConfigs, ..., environment: window.location.hostname });` ; la variable `error` (l.56) n'est jamais rendue.
- **Impact :** Bruit console en dev (retiré au build prod par esbuild.pure, vite.config.ts:31) ; si l'API renvoie une erreur, la page affiche « Aucune configuration » au lieu d'un message d'erreur.
- **Recommandation :** Supprimer le console.log. Typer `useQuery<NocodbConfig[] | null>` et écrire `const configs = rawConfigs ?? []`, pas une valeur par défaut de déstructuration. Puis remplacer safeConfigs par configs.

### NOCO-04

**Boutons Modifier/Supprimer icône seule et suppression sans avertissement d'impact** — accessibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/NocoDBConfig.tsx:300`
- **Constat :** l.300-313 deux `<Button variant="outline" size="sm">` avec seulement `<Edit />` / `<Trash2 />`, sans aria-label ni title, même style ; modale l.640-643 « Cette action est irréversible » sans mentionner les magasins liés ; storage.ts:1701-1703 `await db.delete(nocodbConfig).where(eq(nocodbConfig.id, id));` sans vérifier groups.nocodb_config_id.
- **Impact :** Boutons ambigus (lecteurs d'écran, utilisateurs) ; suppression possible d'une configuration encore utilisée → vérification des factures cassée sans prévenir.
- **Recommandation :** aria-label/title « Modifier » / « Supprimer », style destructif sur Supprimer ; avant suppression, compter les magasins liés et bloquer ou avertir (« 3 magasins utilisent cette configuration »).

### NOCO-05

**Formulaire de création non réinitialisé après succès** — bug, sévérité basse, effort S

- **Fichier :** `client/src/pages/NocoDBConfig.tsx:84`
- **Constat :** l.84-86 `onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/nocodb-config'] }); setShowCreateModal(false); ...` sans `createForm.reset()` ; `createForm` (l.144-154) conserve les valeurs, jeton compris.
- **Impact :** En rouvrant « Nouvelle Configuration », la configuration précédente est pré-remplie : risque de créer un doublon par erreur.
- **Recommandation :** Appeler `createForm.reset()` dans onSuccess uniquement. Réinitialiser aussi à la fermeture (Annuler) ferait perdre une saisie fermée par erreur, c'est un choix produit.

### NOCO-06

**Formulaires de création et d'édition dupliqués** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/NocoDBConfig.tsx:371`
- **Constat :** Création l.371-492 et édition l.505-626 : les 6 FormField sont copiés à l'identique (~120 lignes chacun), ex. `<FormLabel>Personal API Token</FormLabel>` l.406 et l.540.
- **Impact :** Toute correction de libellé ou de validation doit être faite deux fois ; risque de divergence.
- **Recommandation :** Extraire `<NocodbConfigFormFields control={form.control} />` réutilisé par les deux modales.

### NOCO-07

**Libellés anglais/jargon et aucun test de connexion** — lisibilite, sévérité basse, effort M

- **Fichier :** `client/src/pages/NocoDBConfig.tsx:406`
- **Constat :** l.406 `<FormLabel>Personal API Token</FormLabel>`, placeholders l.394 `https://your-nocodb-instance.com`, l.410 `xc-token-xxxxxxxxxxxxxx`, l.427 `p_xxxxxxxxxxxxxx` ; sous-titre l.247 « connexions aux bases de données NocoDB externes » ; aucun bouton « Tester la connexion » alors que WeatherSettings.tsx:334 et WebhookBAPConfig.tsx:246 en proposent un.
- **Impact :** Un admin non développeur ne sait ni quoi saisir ni si la configuration fonctionne avant de l'utiliser dans le rapprochement.
- **Recommandation :** Libellés FR (« Adresse du serveur NocoDB », « Jeton d'accès personnel », « Identifiant de la base (commence par p_) ») avec texte d'aide ; ajouter un bouton « Tester la connexion ».

### SQL-03

**Bouton « SQL Webhook BAP » obsolète, état dupliqué et log de démarrage effacé** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/SQLExecutor.tsx:100`
- **Constat :** l.100-135 `handleCopyWebhookSQL` écrase l'éditeur sans confirmation, contient l'URL de production l.116 `'https://workflow.ffnancy.fr/webhook/a3d03176-...'` alors que la table est créée par init.sql, migrations/20250903141000_create_webhook_bap_config.sql et server/createWebhookTable.ts ; l.129 `navigator.clipboard.writeText(webhookSQL);` sans try/catch. l.14 `isExecuting` duplique `executeMutation.isPending` ; l.19 `setLogs([])` dans mutationFn efface le message posé l.96 `setLogs([`🔄 Début de l'exécution SQL...`])`.
- **Impact :** Bouton obscur qui peut écraser un script en cours ; en HTTP non sécurisé, navigator.clipboard est indéfini → exception, aucun retour ; message « Début de l'exécution » jamais visible.
- **Recommandation :** Supprimer le bouton et le script embarqué ; utiliser `executeMutation.isPending` ; retirer `setLogs([])` du mutationFn.

### UTIL-02

**Onglet actif non reflété dans l'URL** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Utilities.tsx:28`
- **Constat :** l.28-35 `useState(() => { const path = window.location.pathname; if (path === '/backup') return 'backups'; ... return 'backups'; })` et l.80 `onValueChange={setActiveTab}` ne touche pas l'URL ; aucune route pour 'webhookbap' ni 'sql' (RouterProduction.tsx:173-176).
- **Impact :** F5 ou lien partagé ramène toujours sur « Sauvegardes » ; bouton Précédent inopérant entre onglets.
- **Recommandation :** Stocker l'onglet dans l'URL (`/utilities?tab=meteo` via `useSearch`/`setLocation` de wouter) et rediriger les anciennes routes vers ce format.

### UTIL-04

**Conteneurs, titres et états de chargement différents dans chaque onglet** — coherence-design, sévérité basse, effort M

- **Fichier :** `client/src/pages/NocoDBConfig.tsx:231`
- **Constat :** NocoDBConfig.tsx:238-242 `container mx-auto px-4 py-8` + `<h1 className="text-3xl ...">` ; WeatherSettings.tsx:220-223 `container mx-auto p-6 max-w-2xl` + h1 text-2xl ; DatabaseDebug.tsx:56-60 `p-6` + h1 ; SQLExecutor.tsx:141 h1 sans padding ; WebhookBAPConfig.tsx:158-167 aucun titre de page. Chargement : NocoDBConfig.tsx:231 spinner `h-32 w-32`, WeatherSettings.tsx:205-213 skeleton, WebhookBAPConfig.tsx:150-153 texte « Chargement de la configuration... », BackupManager.tsx:333-334 Loader2 dans la carte.
- **Impact :** Impression d'outils assemblés ; h1 imbriqués sous le h2 de Utilities (hiérarchie inversée pour lecteurs d'écran) ; le contenu change de largeur et de style à chaque onglet.
- **Recommandation :** Composant commun `<AdminSection title description actions>` (titre h3 text-lg, sans container/max-w propre) et `<SectionSkeleton />` partagé ; supprimer les grands titres redondants avec le libellé d'onglet.

### WEATHER-03

**Formulaire non contrôlé manipulé via le DOM, fetch manuels et erreurs en anglais** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/WeatherSettings.tsx:318`
- **Constat :** l.318 `new FormData(document.querySelector('form') as HTMLFormElement)` (premier formulaire du document), l.97-100 `const locationInput = document.getElementById('location') as HTMLInputElement; locationInput.value = data.location.fullLocation;`, champs `defaultValue` l.245/268/297, trois `fetch` manuels l.39, 72, 161 au lieu d'apiRequest, messages anglais l.48 `throw new Error('Failed to save settings')` et l.170 `throw new Error('Test connection failed')` affichés à l'utilisateur.
- **Impact :** Fragile (un autre formulaire dans le Layout ferait tester les mauvais champs), état hors React, messages d'erreur en anglais.
- **Recommandation :** Champs contrôlés (useState ou react-hook-form comme NocoDBConfig), lecture via `e.currentTarget.form`, apiRequest et messages FR (« Impossible d'enregistrer les réglages météo »).

### WEATHER-04

**/api/weather/current recalculé à chaque appel sans cache mémoire** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:5683`
- **Constat :** routes.ts:5673 `await storage.getWeatherSettings()`, l.5683-5684 `let currentYearData = await storage.getWeatherData(today, true); let previousYearData = await storage.getWeatherData(previousYearDate, false);` séquentiels, l.5755 `console.log('🌤️ [RESPONSE] Weather data prepared:', ...)` à chaque appel ; appelé par WeatherWidget (Layout, toutes les pages) avec `refetchInterval: 30 * 60 * 1000`.
- **Impact :** Pour une donnée qui change une fois par jour, chaque ouverture de l'application par chaque employé coûte 3 requêtes métier + 2 de désérialisation et une ligne de log.
- **Recommandation :** Se limiter à `Promise.all` pour les deux lectures et à la suppression du log de réponse. Le cache mémoire n'est utile qu'après avoir corrigé WEATHER-01, et doit alors être invalidé explicitement dans POST/PUT settings et géolocalisation.
