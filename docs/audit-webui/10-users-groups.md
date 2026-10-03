# Utilisateurs & Magasins

_43 constats vérifiés — 7 haute, 20 moyenne, 16 basse._

## Pages analysées

### `/users`

**Rôle :** Page réservée aux administrateurs pour gérer les comptes : créer un utilisateur (identifiant + mot de passe), modifier ses informations, changer son rôle (Administrateur, Directeur, Manager, Employé), l'affecter à un ou plusieurs magasins et le supprimer.

**Tâches principales de l'utilisateur :**
- Retrouver un utilisateur (recherche texte + filtre par rôle)
- Créer un compte avec identifiant, mot de passe, rôle et magasins
- Modifier nom, e-mail, identifiant, mot de passe d'un compte
- Changer le rôle d'un utilisateur (sélecteur rapide dans la ligne ou dans la fenêtre de modification)
- Affecter / retirer un utilisateur d'un magasin
- Supprimer un compte

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/users | au montage (enabled: role admin) et après chaque mutation (invalidateQueries) | server/routes.ts:4268 -> storage.getUsers() (storage.ts:409) puis storage.getUserWithGroups(id) pour CHAQUE utilisateur (storage.ts:371) | N+1 : 1 + 2N requêtes SQL (getUserWithGroups refait un getUser + une jointure par utilisateur). Renvoie la colonne password (hash) de tous les comptes, et l'endpoint est ouvert aux managers/directeurs (routes.ts:4271). |
| GET /api/groups | au montage (enabled: admin) — même clé que Layout.tsx:49, donc déjà en cache | server/routes.ts:970 -> storage.getUserWithGroups(userId) + storage.getGroups() (storage.ts:432, SELECT * ORDER BY name) | SELECT * inclut le logo base64 (jusqu'à 200 Ko par magasin) et toute la config SMTP/NocoDB alors que la page n'utilise que id, name, color. |
| PUT /api/users/:id | au clic (sélecteur rapide de rôle après confirmation, ou bouton « Mettre à jour ») | server/routes.ts:4392 -> storage.updateUser (storage.ts:418) | Recharge getUserWithGroups (2 requêtes) juste pour vérifier le rôle ; renvoie l'utilisateur complet avec le hash du mot de passe (routes.ts:4431) ; aucune protection contre l'auto-rétrogradation ni contre la suppression du dernier admin. |
| POST /api/users | au clic « Créer l'utilisateur » | server/routes.ts:4309 -> hashPasswordSimple + storage.createUser (storage.ts:413) | Renvoie le hash (routes.ts:4356). L'affectation aux magasins est faite ensuite par N appels séparés, sans transaction. |
| POST /api/users/:id/groups | au clic « Assigner » dans la modale de modification, et N fois en parallèle à la création | server/routes.ts:4228 -> storage.assignUserToGroup (storage.ts:1210, INSERT simple) | Aucune contrainte d'unicité (user_id, group_id) : les doublons sont possibles. Une 2e route identique existe en routes.ts:4461 et n'est jamais atteinte. |
| DELETE /api/users/:id/groups/:groupId | au clic « Retirer » dans la modale de modification | server/routes.ts:4249 -> storage.removeUserFromGroup (storage.ts:1215) | Doublon inaccessible en routes.ts:4481. |
| DELETE /api/users/:id | au clic sur la poubelle puis window.confirm | server/routes.ts:4497 -> storage.getUserWithGroups + boucle séquentielle storage.removeUserFromGroup + storage.deleteUser (storage.ts:427) | Boucle d'await séquentielle (1 DELETE par magasin) sans transaction au lieu d'un seul DELETE ... WHERE user_id. |

**Lisibilité / simplicité :** Page fonctionnelle mais confuse pour un non-technicien : le tableau affiche un identifiant technique (« ID: manual_1712_x9… ») au lieu de l'identifiant de connexion, et le rôle apparaît deux fois par ligne (badge + sélecteur rapide). Le filtre et la création ne proposent pas le rôle « Directeur ». Le vocabulaire alterne entre « Groupes » et « Magasins ». Dans la fenêtre de modification, l'affectation aux magasins est enregistrée tout de suite (sans passer par « Mettre à jour », sans être annulable) et le bouton ne change pas d'état après le clic, ce qui pousse à cliquer deux fois et crée des doublons. La confirmation de changement de rôle affiche le code anglais (« employee ») sans nommer la personne. Les messages d'erreur précis du serveur (identifiant déjà utilisé…) ne sont jamais affichés. Plusieurs façons de confirmer cohabitent (window.confirm natif / Dialog). Sur mobile, le tableau est coupé et la colonne Actions devient inaccessible. Il reste des console.log de debug et du code mort.

### `/groups`

**Rôle :** Gestion des magasins (« groupes ») : créer ou modifier un magasin (nom, couleur, coordonnées et logo pour la signature des mails, envoi de mails SMTP propre au magasin, intégration NocoDB pour vérifier les factures, webhook), voir le nombre de commandes et de livraisons de chaque magasin et le supprimer.

**Tâches principales de l'utilisateur :**
- Voir la liste des magasins et leur activité (commandes, livraisons, % livrées)
- Créer un magasin
- Modifier les coordonnées, le logo et la couleur d'un magasin
- Configurer et tester l'envoi de mails (SMTP) du magasin
- Relier le magasin à une table NocoDB (vérification des factures) et à un webhook
- Supprimer un magasin sans activité

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/groups | au montage (pas de enabled ; partagé avec Layout.tsx:49 et une vingtaine de composants) | server/routes.ts:970 -> storage.getUserWithGroups (storage.ts:371, 2 requêtes) puis storage.getGroups (storage.ts:432) pour l'admin, ou user.userGroups[].group (5 colonnes seulement) pour les autres rôles | Admin : SELECT * avec logo base64 + config SMTP/NocoDB pour chaque magasin, sans compression gzip côté Express. Non-admin : objets tronqués {id,name,color,createdAt,updatedAt}, donc le contrat de réponse diffère selon le rôle. |
| GET /api/nocodb-config | au montage, sans condition (même si la modale n'est jamais ouverte) | server/routes.ts:5090 -> storage.getUserWithGroups + storage.getNocodbConfigs (storage.ts:1655, déchiffrement du jeton pour chaque config) | Réservé aux admins : un manager qui ouvre la page reçoit un 403, relancé 2 fois par la politique retry du queryClient (3 requêtes en échec). |
| GET /api/stats/by-group | au montage | server/routes.ts:1485 -> storage.getUserWithGroups + storage.getOrderDeliveryStatsByGroup (storage.ts:1817) | Correct : deux COUNT ... GROUP BY group_id en Promise.all, couverts par idx_orders_group_id et idx_deliveries_group_id (migrations/20260814_add_performance_indexes.sql:21,32). Seul surcoût : le getUserWithGroups redondant. |
| POST /api/groups | au clic « Créer » dans la modale | server/routes.ts:992 -> storage.getUser + insertGroupSchema.parse + storage.createGroup (storage.ts:441) | Une dizaine de console.log par requête, dont le corps avec le logo base64 complet (l.1001) et l'objet validé avec le mot de passe SMTP en clair (l.1038). |
| PUT /api/groups/:id | au clic « Modifier » dans la modale | server/routes.ts:1067 -> storage.getUser + storage.updateGroup (storage.ts:449) | Accepté pour tout manager, sur n'importe quel magasin (aucune vérification d'appartenance). |
| POST /api/groups/:id/test-smtp | au clic « Tester la connexion SMTP » (édition seulement) | server/routes.ts:1092 -> storage.getGroup (storage.ts:436) + verifySmtpConfig | Teste la configuration ENREGISTRÉE et non les valeurs en cours de saisie dans le formulaire. |
| DELETE /api/groups/:id | au clic sur la poubelle puis window.confirm | server/routes.ts:1124 -> storage.deleteGroup (storage.ts:462) | Aucune vérification côté serveur (le contrôle commandes/livraisons n'existe que côté client). Pas de FK ni de nettoyage de user_groups. |

**Lisibilité / simplicité :** La liste en cartes est claire mais montre du bruit technique (« #12 », code couleur hexadécimal avec une icône palette) au lieu d'informations utiles (nombre d'utilisateurs, mails configurés ou non). Le menu dit « Magasins » alors que la page parle de « Groupes/Magasins », « Nouveau Groupe », « Groupe créé ». La fenêtre de création/modification est très lourde : environ 25 champs sur deux colonnes en sm:max-w-4xl, avec un jargon technique (NocoDB, Mapping des colonnes, Webhook, SMTP, STARTTLS, SSL/TLS, Port). Le bouton « 🔍 Tester la configuration NocoDB » n'est pas implémenté (toast « Fonctionnalité à implémenter »). Le champ Webhook est caché tant qu'aucune config NocoDB n'est choisie. Les erreurs du test SMTP s'affichent en JSON brut. Un clic hors de la fenêtre efface toute la saisie sans prévenir. Les composants mélangent select/checkbox natifs, emojis et shadcn/lucide. Le bouton de modification est proposé aux managers alors que l'API leur renvoie des magasins tronqués : enregistrer efface alors la configuration du magasin.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [GROUPS-01](#groups-01) | haute | bug | S | Un manager qui modifie un magasin efface sa configuration (NocoDB, SMTP, coordonnées, logo) | `client/src/pages/Groups.tsx:348` |
| [GROUPS-02](#groups-02) | haute | perf-api | M | GET /api/groups renvoie les logos base64 et toute la configuration à chaque page de l'application | `server/storage.ts:432` |
| [GROUPS-05](#groups-05) | haute | ux-simplicite | M | Fenêtre de création/modification surchargée (environ 25 champs) et pleine de jargon technique | `client/src/pages/Groups.tsx:508` |
| [GROUPS-14](#groups-14) | haute | bug | S | POST /api/groups écrit le mot de passe SMTP en clair et le logo base64 dans les logs | `server/routes.ts:1038` |
| [USERS-01](#users-01) | haute | perf-serveur | S | N+1 sur GET /api/users : 1 + 2N requêtes SQL à chaque chargement | `server/routes.ts:4280` |
| [USERS-02](#users-02) | haute | bug | S | Hash des mots de passe renvoyé au navigateur (GET/POST/PUT /api/users), y compris aux managers | `server/storage.ts:409` |
| [USERS-03](#users-03) | haute | bug | S | Modale de modification : le bouton Assigner/Retirer ne se met pas à jour, ce qui crée des affectations en double | `client/src/pages/Users.tsx:898` |
| [GROUPS-03](#groups-03) | moyenne | bug | S | La réponse de /api/groups change selon le rôle : les non-admins reçoivent des magasins tronqués | `server/routes.ts:982` |
| [GROUPS-04](#groups-04) | moyenne | perf-serveur | S | Chaque handler recharge l'utilisateur et ses magasins, déjà chargés par passport | `server/routes.ts:972` |
| [GROUPS-06](#groups-06) | moyenne | ux-simplicite | S | Le bouton « 🔍 Tester la configuration NocoDB » ne fait rien (TODO) | `client/src/pages/Groups.tsx:704` |
| [GROUPS-07](#groups-07) | moyenne | bug | S | Le champ Webhook n'apparaît que si une configuration NocoDB est choisie | `client/src/pages/Groups.tsx:680` |
| [GROUPS-08](#groups-08) | moyenne | lisibilite | S | Test SMTP : erreur affichée en JSON brut, et test fait sur les valeurs enregistrées et non sur la saisie | `client/src/pages/Groups.tsx:181` |
| [GROUPS-09](#groups-09) | moyenne | bug | M | Suppression d'un magasin : contrôle fait seulement côté client, données orphelines | `server/routes.ts:1131` |
| [GROUPS-11](#groups-11) | moyenne | lisibilite | S | La page Magasins parle de « Groupes » | `client/src/pages/Groups.tsx:358` |
| [GROUPS-13](#groups-13) | moyenne | ux-simplicite | S | Un clic hors de la fenêtre ou la touche Échap efface toute la saisie sans avertir | `client/src/pages/Groups.tsx:502` |
| [PERF-BUNDLE-01](#perf-bundle-01) | moyenne | perf-bundle | S | Pages d'administration (Utilisateurs, Magasins…) chargées par tous les utilisateurs | `client/src/components/RouterProduction.tsx:12` |
| [PERM-01](#perm-01) | moyenne | dette-code | M | Deux matrices de permissions divergentes (client et shared), sans module Utilisateurs ni Magasins | `client/src/lib/permissions.ts:42` |
| [USERS-04](#users-04) | moyenne | bug | S | Les messages d'erreur précis du serveur ne sont jamais affichés | `client/src/pages/Users.tsx:216` |
| [USERS-05](#users-05) | moyenne | perf-api | M | Création avec magasins : N appels séparés, N toasts, 2N rechargements et opération non atomique | `client/src/pages/Users.tsx:411` |
| [USERS-06](#users-06) | moyenne | perf-client | S | Invalidation inutile de /api/groups après chaque affectation | `client/src/pages/Users.tsx:245` |
| [USERS-07](#users-07) | moyenne | ux-simplicite | M | Magasins enregistrés tout de suite dans la modale, contrairement aux autres champs (« Annuler » ne les annule pas) | `client/src/pages/Users.tsx:893` |
| [USERS-08](#users-08) | moyenne | bug | S | Le rôle « Directeur » manque dans le filtre et dans le formulaire de création | `client/src/pages/Users.tsx:631` |
| [USERS-09](#users-09) | moyenne | lisibilite | S | Le tableau affiche un ID technique au lieu de l'identifiant de connexion, qui n'est pas non plus cherchable | `client/src/pages/Users.tsx:712` |
| [USERS-10](#users-10) | moyenne | lisibilite | S | La confirmation de changement de rôle affiche le code anglais et ne dit pas de qui il s'agit | `client/src/pages/Users.tsx:516` |
| [USERS-11](#users-11) | moyenne | bug | S | Deux réglages du rôle avec des règles différentes : la modale permet de modifier son propre rôle sans confirmation | `client/src/pages/Users.tsx:877` |
| [USERS-14](#users-14) | moyenne | ux-simplicite | S | Mobile : tableau coupé, la colonne Actions devient inaccessible | `client/src/pages/Users.tsx:658` |
| [USERS-17](#users-17) | moyenne | lisibilite | S | Vocabulaire incohérent « Groupes » / « Magasins » sur la page Utilisateurs | `client/src/pages/Users.tsx:673` |
| [GROUPS-10](#groups-10) | basse | lisibilite | S | Cartes magasin : informations techniques inutiles, état de configuration absent | `client/src/pages/Groups.tsx:433` |
| [GROUPS-12](#groups-12) | basse | perf-client | S | Configs NocoDB chargées au montage sans condition (403 relancé 2 fois pour un manager) | `client/src/pages/Groups.tsx:84` |
| [GROUPS-15](#groups-15) | basse | coherence-design | S | Composants natifs et emojis mélangés aux composants shadcn et aux icônes lucide | `client/src/pages/Groups.tsx:579` |
| [GROUPS-16](#groups-16) | basse | ux-simplicite | S | Grilles du formulaire non adaptées au mobile | `client/src/pages/Groups.tsx:616` |
| [PERM-02](#perm-02) | basse | perf-serveur | M | Middleware global qui recopie récursivement toutes les réponses JSON pour masquer smtpPassword | `server/routes.ts:168` |
| [USERS-12](#users-12) | basse | ux-simplicite | S | Délai artificiel de 1 seconde avant la fermeture de la modale après enregistrement | `client/src/pages/Users.tsx:159` |
| [USERS-13](#users-13) | basse | coherence-design | S | Confirmations incohérentes : window.confirm natif pour supprimer, Dialog pour le rôle, AlertDialog ailleurs | `client/src/pages/Users.tsx:558` |
| [USERS-15](#users-15) | basse | dette-code | S | console.log de debug dans les mutations des deux pages | `client/src/pages/Users.tsx:227` |
| [USERS-16](#users-16) | basse | dette-code | S | Code mort : gestion 401 jamais déclenchée (répétée 8 fois), états et fonctions inutilisés | `client/src/pages/Users.tsx:100` |
| [USERS-18](#users-18) | basse | bug | S | Le texte d'aide « Minimum 6 caractères » n'est vérifié nulle part | `client/src/pages/Users.tsx:870` |
| [USERS-19](#users-19) | basse | dette-code | S | La clé primaire est générée côté client à partir de l'e-mail (« _1712… » si e-mail vide) | `client/src/pages/Users.tsx:191` |
| [USERS-20](#users-20) | basse | ux-simplicite | S | Aucune explication de ce que permet chaque rôle | `client/src/pages/Users.tsx:1029` |
| [USERS-21](#users-21) | basse | perf-serveur | S | Suppression d'un utilisateur : boucle d'await séquentielle sans transaction | `server/routes.ts:4514` |
| [USERS-22](#users-22) | basse | dette-code | S | Routes en double pour l'affectation utilisateur ↔ magasin (la 2e n'est jamais atteinte) | `server/routes.ts:4461` |
| [USERS-23](#users-23) | basse | accessibilite | S | Boutons à icône seule sans libellé accessible | `client/src/pages/Users.tsx:779` |
| [USERS-24](#users-24) | basse | coherence-design | S | Chargement affiché par un spinner central au lieu d'un squelette de la liste | `client/src/pages/Users.tsx:642` |

### GROUPS-01

**Un manager qui modifie un magasin efface sa configuration (NocoDB, SMTP, coordonnées, logo)** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/Groups.tsx:348`
- **Constat :** Groups.tsx:348 `const canManage = user?.role === 'admin' || user?.role === 'manager';` affiche les boutons Modifier. Pour un non-admin, GET /api/groups renvoie `user.userGroups.map(ug => ug.group)` (routes.ts:982-983), objets réduits à `{id, name, color, createdAt, updatedAt}` (storage.ts:393-399). handleEdit remplit alors le formulaire avec des valeurs vides (`nocodbTableName: group.nocodbTableName || ""`, `address: (group as any).address || ""`, `smtpEnabled: Boolean(undefined)`, l.268-292), et handleSubmit envoie tous ces champs (l.326-330). PUT /api/groups/:id accepte tout manager, sur n'importe quel id (routes.ts:1070), et écrit ces valeurs vides.
- **Impact :** Il suffit qu'un manager (qui peut ouvrir /groups par l'URL, même si le menu le réserve à l'admin, Sidebar.tsx:349) enregistre la fiche pour supprimer la configuration NocoDB, le webhook, l'adresse, le téléphone, le logo et désactiver le SMTP du magasin : perte de données silencieuse. Il peut aussi modifier ou supprimer des magasins qui ne sont pas les siens.
- **Recommandation :** Aligner les droits : `canManage = user?.role === 'admin'` (comme le menu), et utiliser `requireAdmin` (server/permissions.ts:79) sur POST, PUT et DELETE /api/groups. Côté client, n'envoyer que les champs modifiés (comparer avec les valeurs initiales). Si les managers doivent garder un accès, vérifier côté serveur que l'id fait partie de leurs magasins.

### GROUPS-02

**GET /api/groups renvoie les logos base64 et toute la configuration à chaque page de l'application** — perf-api, sévérité haute, effort M

- **Fichier :** `server/storage.ts:432`
- **Constat :** storage.ts:432-434 `return await db.select().from(groups).orderBy(groups.name);` → inclut `logo: text("logo") // Logo en data URI` (schema.ts:65), ainsi que les colonnes SMTP et NocoDB. Groups.tsx:39 autorise jusqu'à `MAX_LOGO_KB = 200` (environ 270 Ko une fois encodé en base64). Cette requête est faite par Layout.tsx:49 sur toutes les pages et par une vingtaine de composants (Orders, Deliveries, modales…), qui n'utilisent que id, name et color. Aucune compression gzip n'est active (`setupCompression` dans server/cache.ts:93 n'est jamais appelé, et le paquet `compression` est absent de package.json).
- **Impact :** Avec 10 magasins ayant un logo, environ 2,7 Mo de JSON non compressé sont téléchargés au chargement de l'app, puis à chaque invalidation (création ou modification de magasin, affectation d'utilisateur, USERS-06). Le premier affichage est nettement plus lent, surtout en 4G sur mobile.
- **Recommandation :** Comme proposé : projection légère sans `logo` ni `smtpPassword` (en gardant webhookUrl, nocodb*, smtpEnabled, address, phone, avec `hasLogo` et `smtpPasswordSet` calculés), et GET /api/groups/:id complet chargé à l'ouverture de la modale de Groups.tsx. Étendre la même projection aux jointures `group: groups` de storage.ts (commandes, livraisons, publicités). Ajouter `compression()` après vérification du proxy.

### GROUPS-05

**Fenêtre de création/modification surchargée (environ 25 champs) et pleine de jargon technique** — ux-simplicite, sévérité haute, effort M

- **Fichier :** `client/src/pages/Groups.tsx:508`
- **Constat :** Groups.tsx:508 `<DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">` avec deux colonnes (l.519). On y trouve : nom, couleur (sélecteur natif + 10 pastilles + code hex, l.536-563), « Configuration NocoDB (Optionnel) » (l.571), « Mapping des colonnes » avec 6 noms de colonnes (l.611-677), « URL Webhook » (l.683), adresse, téléphone, logo, « Envoi de mails (SMTP) » (l.803), « Serveur SMTP », « Port », « Connexion SSL/TLS directe (port 465). Décoché = STARTTLS (port 587). » (l.851), identifiant, mot de passe, adresse et nom de l'expéditeur.
- **Impact :** Pour créer un magasin, l'utilisateur fait face à un formulaire d'intégrateur. Les champs essentiels (nom, adresse, téléphone) sont noyés parmi des réglages techniques, ce qui cause des erreurs de saisie et décourage l'utilisation.
- **Recommandation :** Découper en onglets ou sections repliables : « Informations » (nom, couleur en pastilles seules, adresse, téléphone, logo), ouvert par défaut ; « Envoi des e-mails » (avec préréglages Office 365 / Gmail qui remplissent serveur, port et sécurité) ; « Avancé : vérification des factures (NocoDB) et webhook », replié. Reformuler en langage courant (« Colonne n° de facture » plutôt que « Mapping des colonnes », « Sécurité : SSL / STARTTLS » avec une aide). À la création, ne demander que le nom et proposer de compléter ensuite.

### GROUPS-14

**POST /api/groups écrit le mot de passe SMTP en clair et le logo base64 dans les logs** — bug, sévérité haute, effort S

- **Fichier :** `server/routes.ts:1038`
- **Constat :** routes.ts:1038 `console.log('✅ Group data validation passed:', data);`, où `data = insertGroupSchema.parse(req.body)` n'est pas masqué et contient `smtpPassword`. routes.ts:1001 `console.log('📋 POST /api/groups - Request body:', JSON.stringify(redactBody(req.body), null, 2))` : redactBody (l.9-16) masque le mot de passe mais pas `logo`, d'où jusqu'à environ 270 Ko de base64 par appel. Le handler contient une dizaine d'autres console.log (l.994-1042).
- **Impact :** Le mot de passe de la boîte mail du magasin se retrouve en clair dans les logs serveur et Docker. Les logs grossissent fortement à chaque création.
- **Recommandation :** Supprimer tous les console.log de debug du handler et garder un seul `console.error` en cas d'erreur, avec `redactBody` étendu à `logo` (remplacé par `[logo N Ko]`).

### USERS-01

**N+1 sur GET /api/users : 1 + 2N requêtes SQL à chaque chargement** — perf-serveur, sévérité haute, effort S

- **Fichier :** `server/routes.ts:4280`
- **Constat :** routes.ts:4276-4282 : `const baseUsers = await storage.getUsers(); const usersWithData = await Promise.all(baseUsers.map(async (baseUser) => { const userWithGroups = await storage.getUserWithGroups(baseUser.id);` ; storage.ts:371-373 : `async getUserWithGroups(id) { const user = await this.getUser(id); ... db.execute(sql`SELECT ... FROM user_groups ug INNER JOIN groups g ... WHERE ug.user_id = ${id}`)` → un SELECT users redondant (l'utilisateur est déjà dans baseUsers) + une jointure, par utilisateur. Il faut y ajouter getUserWithGroups pour l'appelant (l.4270) et le deserializeUser de passport (2 requêtes).
- **Impact :** Pour 60 comptes : environ 125 requêtes SQL et autant d'allers-retours vers le pool à chaque affichage de la page Utilisateurs, à chaque mutation (invalidateQueries) et à chaque ouverture de la page Tâches (Tasks.tsx:386 appelle le même endpoint). Le temps de réponse croît linéairement avec le nombre d'utilisateurs.
- **Recommandation :** Ajouter `getUsersWithGroups()` à IStorage, DatabaseStorage et MemStorage (2 requêtes : projection des users sans `password`, puis user_groups JOIN groups, regroupés dans une Map). Garder la forme `{...user, userGroups:[{userId, groupId, group:{id,name,color}}], userRoles:[]}`. Pas de changement côté client.

### USERS-02

**Hash des mots de passe renvoyé au navigateur (GET/POST/PUT /api/users), y compris aux managers** — bug, sévérité haute, effort S

- **Fichier :** `server/storage.ts:409`
- **Constat :** storage.ts:409-411 : `async getUsers() { return await db.select().from(users); }` (la colonne `password` est définie en shared/schema.ts:40), puis routes.ts:4283 `return { ...baseUser, userGroups: ... }` → res.json(usersWithData). routes.ts:4356 `res.json(newUser)` et l.4431 `res.json(updatedUser)` renvoient aussi le hash. Seul le mot de passe SMTP est filtré (sanitize.ts:36). L'accès est ouvert à `['admin', 'directeur', 'manager']` (routes.ts:4271).
- **Impact :** N'importe quel manager ou directeur peut lire dans l'onglet Réseau les hashs scrypt de tous les comptes, administrateurs compris, et tenter de les casser hors ligne. Le payload est aussi alourdi inutilement.
- **Recommandation :** Correction mécanique et locale : ne plus renvoyer `password` dans les 3 routes, via la projection de USERS-01 pour GET et `const { password, ...safeUser } = newUser; res.json(safeUser)` (idem pour updatedUser) pour POST et PUT. Ne pas toucher au type de retour de storage.createUser/updateUser. Restreindre GET /api/users aux admins ou renvoyer une version réduite aux managers est une décision séparée (à traiter avec PERM-01). Tasks.tsx:385 peut aussi être supprimé, puisqu'il n'est pas utilisé.

### USERS-03

**Modale de modification : le bouton Assigner/Retirer ne se met pas à jour, ce qui crée des affectations en double** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/Users.tsx:898`
- **Constat :** Users.tsx:898 `const isAssigned = selectedUser?.userGroups?.some(ug => ug.groupId === group.id)`. `selectedUser` est un état copié à l'ouverture (l.450 `setSelectedUser(userWithNames)`) et n'est jamais remis à jour après assignGroupMutation, qui ne fait que `invalidateQueries(['/api/users'])` (l.243). Côté serveur, storage.ts:1210-1212 fait un INSERT simple, et la table n'a ni clé primaire ni contrainte d'unicité (shared/schema.ts:82-86 : `userGroups = pgTable("user_groups", { userId, groupId, createdAt })`).
- **Impact :** Après un clic sur « Assigner », le bouton reste sur « Assigner ». L'utilisateur clique à nouveau et une 2e ligne identique est insérée. Le tableau affiche alors deux badges identiques (et React signale une clé dupliquée `key={userGroup.groupId}`, l.733). Pour retirer l'affectation, il faut fermer puis rouvrir la modale.
- **Recommandation :** Ne stocker que `selectedUserId` et dériver l'utilisateur depuis la requête : `const selectedUser = users.find(u => u.id === selectedUserId)`. Côté BD, ajouter `primaryKey({ columns: [t.userId, t.groupId] })` (après dédoublonnage des lignes existantes) et utiliser `.onConflictDoNothing()` dans assignUserToGroup.

### GROUPS-03

**La réponse de /api/groups change selon le rôle : les non-admins reçoivent des magasins tronqués** — bug, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:982`
- **Constat :** routes.ts:978-984 : l'admin reçoit `storage.getGroups()` (toutes les colonnes), les autres rôles `(user as any).userGroups?.map((ug: any) => ug.group)`, construit dans storage.ts:393-399 avec seulement id, name, color, createdAt et updatedAt. Or Avoirs.tsx:776-779 fait `const groups = await queryClient.fetchQuery({ queryKey: ['/api/groups'] }); … if (!group?.webhookUrl) { toast({ description: "Aucun webhook configuré pour ce magasin" })`.
- **Impact :** Un directeur, qui a accès aux avoirs, voit « Aucun webhook configuré pour ce magasin » même si le webhook existe. C'est aussi la cause de la perte de données décrite en GROUPS-01.
- **Recommandation :** Pour les non-admins, faire `db.select(<projection légère de GROUPS-02>).from(groups).where(inArray(groups.id, userGroupIds))` afin que tous les rôles reçoivent la même forme de données.

### GROUPS-04

**Chaque handler recharge l'utilisateur et ses magasins, déjà chargés par passport** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:972`
- **Constat :** localAuth.production.ts:193-196 : `passport.deserializeUser(async (id) => { const user = await storage.getUserWithGroups(id); done(null, user); })` (2 requêtes à chaque appel API). Puis routes.ts:972 (GET /api/groups), 1487 (/api/stats/by-group), 4270 (GET /api/users), 4312, 4394, 4499, 5092 (/api/nocodb-config) refont `await storage.getUserWithGroups(...)` (2 requêtes de plus) juste pour lire `user.role`. Les middlewares `requireAdmin` et `requireModulePermission` de server/permissions.ts, qui lisent `req.user.role` sans requête, sont importés (routes.ts:5) mais jamais utilisés.
- **Impact :** 4 requêtes SQL au lieu de 2 par appel API. Rien qu'à l'ouverture de la page Magasins, 3 appels donnent 12 requêtes, dont 6 inutiles.
- **Recommandation :** Correction automatique limitée à remplacer `await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id)` par `req.user` dans ces handlers, en gardant les tests `if (!user || ...)`. La réécriture de getUserWithGroups en LEFT JOIN + json_agg se fait séparément, en conservant exactement la forme `userGroups[{userId, groupId, group:{id,name,color,createdAt,updatedAt}}]`.

### GROUPS-06

**Le bouton « 🔍 Tester la configuration NocoDB » ne fait rien (TODO)** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Groups.tsx:704`
- **Constat :** Groups.tsx:703-709 : `onClick={() => { // TODO: Implémenter le test de configuration\n toast({ title: "Test de configuration", description: "Fonctionnalité à implémenter" }); }}` avec l'aide « Vérifie que la table et les colonnes existent » (l.714).
- **Impact :** L'interface promet une vérification qui n'existe pas. L'utilisateur croit que sa configuration est validée, ou perd confiance dans l'outil.
- **Recommandation :** Retirer le bouton et son texte d'aide. Le branchement sur un vrai endpoint NocoDB est une évolution séparée, non automatique.

### GROUPS-07

**Le champ Webhook n'apparaît que si une configuration NocoDB est choisie** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Groups.tsx:680`
- **Constat :** Groups.tsx:594 `{formData.nocodbConfigId && (<> … ` contient le bloc « Notifications / URL Webhook » (l.680-695). Le webhook est pourtant utilisé seul : BLReconciliation.tsx:564 `if (!selectedDeliveryForInvoice.group?.webhookUrl)` et Avoirs.tsx:779.
- **Impact :** Un magasin sans NocoDB ne peut pas recevoir de webhook depuis l'interface (envoi de factures depuis le rapprochement ou les avoirs impossible). Si l'on retire la config NocoDB, l'URL reste enregistrée mais n'est plus visible ni modifiable.
- **Recommandation :** Sortir le bloc Webhook de la condition `formData.nocodbConfigId` à sa position actuelle. Le déplacement vers une section « Avancé » dépend de GROUPS-05.

### GROUPS-08

**Test SMTP : erreur affichée en JSON brut, et test fait sur les valeurs enregistrées et non sur la saisie** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Groups.tsx:181`
- **Constat :** Groups.tsx:178-182 `description: error?.message || "Impossible de joindre le serveur SMTP"`. apiRequest lève `Error(`${res.status}: ${text}`)` (queryClient.ts:6), d'où un toast « 400: {"success":false,"message":"Configuration incomplète : …"} ». Le test lit `storage.getGroup(id)` (routes.ts:1100), c'est-à-dire la configuration enregistrée et non les champs modifiés, et il n'est proposé qu'en modification (l.904).
- **Impact :** Un message illisible pour un non-technicien. Après avoir corrigé le mot de passe, l'utilisateur relance le test, qui échoue encore puisqu'il porte sur l'ancienne configuration.
- **Recommandation :** Analyser le message JSON (voir le helper ApiError de USERS-04). Accepter les champs du formulaire dans le corps de POST /test-smtp (en reprenant le mot de passe enregistré si le champ est vide), ou au minimum enregistrer puis tester, avec un libellé explicite « Enregistrer et tester ».

### GROUPS-09

**Suppression d'un magasin : contrôle fait seulement côté client, données orphelines** — bug, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:1131`
- **Constat :** Groups.tsx:299 `if (stats.orders > 0 || stats.deliveries > 0)` ne regarde que les commandes et livraisons, et seulement dans le navigateur. Le serveur, routes.ts:1131-1132 `await storage.deleteGroup(id);` puis storage.ts:462-463 `await db.delete(groups).where(eq(groups.id, id))`, ne vérifie rien. Aucune clé étrangère n'existe (init.sql : `"group_id" integer NOT NULL` sans REFERENCES), donc user_groups, DLC, tâches, avoirs, commandes client et SAV ne sont pas nettoyés.
- **Impact :** Un magasin qui n'a que des DLC, tâches ou avoirs peut être supprimé, ce qui laisse des enregistrements orphelins (affichés sans magasin ou en erreur). Un appel API direct contourne le contrôle.
- **Recommandation :** Côté serveur : dans une transaction, supprimer les lignes user_groups du magasin, puis le magasin. Intercepter l'erreur `23503` pour renvoyer un 409 avec un message clair (« Ce magasin a encore des commandes, livraisons, DLC, tâches ou avoirs »), avec éventuellement un comptage préalable pour détailler. Côté client : afficher ce message (helper de USERS-04).

### GROUPS-11

**La page Magasins parle de « Groupes »** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Groups.tsx:358`
- **Constat :** Sidebar.tsx:347 `label: "Magasins"`, mais Groups.tsx:358 « Gestion des Groupes/Magasins », l.361 « N groupes », l.370 « Nouveau Groupe », l.381 « Rechercher un groupe... », l.399 « Aucun groupe », l.107 « Groupe créé avec succès », l.523 « Nom du groupe * », l.511 « Modifier Groupe ».
- **Impact :** Deux mots pour la même chose dans le même écran, alors que les utilisateurs pensent en « magasins ».
- **Recommandation :** Remplacer partout dans l'interface par « Magasin » : « Magasins », « Nouveau magasin », « Rechercher un magasin… », « Magasin créé », « Nom du magasin ».

### GROUPS-13

**Un clic hors de la fenêtre ou la touche Échap efface toute la saisie sans avertir** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Groups.tsx:502`
- **Constat :** Groups.tsx:502-507 : `onOpenChange={() => { setShowCreateModal(false); setShowEditModal(false); setSelectedGroup(null); setFormData({ ...EMPTY_GROUP_FORM, invoiceColumnName: "Ref Facture" }); }}`. Le formulaire est réinitialisé (avec une valeur par défaut « Ref Facture » qui diffère de celle du bouton Annuler, l.937).
- **Impact :** Après avoir rempli 20 champs, un clic à côté de la fenêtre fait tout perdre.
- **Recommandation :** Si le formulaire a été modifié, demander « Abandonner les modifications ? » avant de fermer (ou bloquer la fermeture par clic extérieur avec `onInteractOutside={e => isDirty && e.preventDefault()}`). Utiliser une seule fonction de réinitialisation.

### PERF-BUNDLE-01

**Pages d'administration (Utilisateurs, Magasins…) chargées par tous les utilisateurs** — perf-bundle, sévérité moyenne, effort S

- **Fichier :** `client/src/components/RouterProduction.tsx:12`
- **Constat :** RouterProduction.tsx:7-30 : `import Groups from "@/pages/Groups"; import Users from "@/pages/Users"; import NocoDBConfig …; import DatabaseDebug …; import BackupManager …` en imports statiques. Aucun `lazy(` dans client/src (grep). vite.config.ts:41-46 ne sépare que les dépendances (vendor-*).
- **Impact :** Un employé en magasin télécharge et analyse le code des pages d'administration (plus de 2 100 lignes pour Users et Groups seulement, plus DatabaseDebug, SQLExecutor, etc.) qu'il n'ouvrira jamais, ce qui ralentit le premier affichage, surtout sur mobile.
- **Recommandation :** Supprimer les imports inutilisés NocoDBConfig, DatabaseDebug, BackupManager et WeatherSettings de RouterProduction.tsx. Passer en `lazy(() => import(...))` Users, Groups, Utilities, Analytics et PaymentSchedulePage. Entourer les deux `<Switch>` (mobile et desktop) d'un `<Suspense>` placé à l'intérieur de Layout/MobileApp, avec un fallback simple construit à partir de `ui/skeleton`.

### PERM-01

**Deux matrices de permissions divergentes (client et shared), sans module Utilisateurs ni Magasins** — dette-code, sévérité moyenne, effort M

- **Fichier :** `client/src/lib/permissions.ts:42`
- **Constat :** client/src/lib/permissions.ts:42 `orders: { … employee: ['view'] }` contre shared/permissions.ts:41 `employee: []`. Livraisons : client l.50 `employee: ['view']`, sans 'validate', contre shared l.49 `employee: []` avec 'validate'. Tâches : client l.89 `manager: ['view', 'validate']` contre shared l.88 `manager: ['view', 'create', 'edit', 'validate']`. Calendar.tsx:267, QuickCreateMenu.tsx:22 et OrderDetailModal.tsx:165 utilisent la version client, alors que Orders.tsx, Deliveries.tsx et le serveur (routes.ts:147) utilisent shared. Les droits Utilisateurs et Magasins sont codés en dur et diffèrent : Users.tsx:568 (admin), Groups.tsx:348 (admin|manager), Sidebar.tsx:337/349 (admin), routes.ts:4271 (admin|directeur|manager), routes.ts:1027/1070 (admin|manager).
- **Impact :** Des boutons visibles mènent à des 403 (un employé voit des actions de commande dans le calendrier que le serveur refuse) et les règles d'accès aux pages d'administration sont contradictoires (voir GROUPS-01).
- **Recommandation :** Avant de supprimer client/src/lib/permissions.ts, ajouter dans shared/permissions.ts les modules `backups` (action `manage`), `admin`, `users` et `stores`. Valider avec le produit les divergences (employé : vue commandes/livraisons ; manager : tâches create/edit). Ensuite seulement, réexporter shared côté client et brancher `requireModulePermission` côté serveur.

### USERS-04

**Les messages d'erreur précis du serveur ne sont jamais affichés** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Users.tsx:216`
- **Constat :** Users.tsx:178, 216, 262, 307 : `const errorMessage = error?.response?.data?.message || "Impossible de créer l'utilisateur"`. Or apiRequest (queryClient.ts:3-7) lève `new Error(`${res.status}: ${text}`)`, qui n'a aucune propriété `response`. Le serveur renvoie pourtant des messages clairs : routes.ts:4372 « Un utilisateur avec ce nom d'utilisateur existe déjà. Veuillez choisir un autre nom d'utilisateur. »
- **Impact :** Si l'identifiant ou l'e-mail existe déjà, l'administrateur ne voit que « Impossible de créer l'utilisateur » et ne sait pas quoi corriger.
- **Recommandation :** Sans changer le format de l'erreur levée, ajouter dans queryClient.ts un helper `getApiErrorMessage(error, fallback)` : il extrait le texte après `^\d{3}: `, tente `JSON.parse(...).message` et renvoie fallback en cas d'échec. L'utiliser dans les 4 onError de Users.tsx (et dans le test SMTP de Groups.tsx, cf. GROUPS-08). Une éventuelle classe ApiError avec `status` devra garder `message` au format `${status}: ${text}` ou s'accompagner d'une migration de queryClient.ts:81, useAuthUnified.ts:32, useAuth.ts:8 et authUtils.ts vers `error.status === 401`.

### USERS-05

**Création avec magasins : N appels séparés, N toasts, 2N rechargements et opération non atomique** — perf-api, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Users.tsx:411`
- **Constat :** Users.tsx:407-415 : `const createdUser = await createUserMutation.mutateAsync(newUser); ... await Promise.all(userGroups.map(groupId => assignGroupMutation.mutateAsync({ userId: createdUser.id, groupId })))`. Chaque assignGroupMutation.onSuccess (l.236-246) affiche un toast « Utilisateur assigné au groupe avec succès » et invalide ['/api/users'] et ['/api/groups'], puis l.418 un toast final et l.426 une nouvelle invalidation.
- **Impact :** Pour 3 magasins : 4 POST, 4 toasts superposés et jusqu'à 7 rechargements de /api/users (chacun en N+1, voir USERS-01) et de /api/groups (avec les logos). Si une affectation échoue, le compte est créé mais la modale reste ouverte. Un nouveau clic sur « Créer » renvoie alors 409 (identifiant déjà pris) avec un message générique.
- **Recommandation :** Accepter `groupIds: number[]` dans POST /api/users et faire l'insertion user + user_groups dans une transaction `db.transaction`. Côté client : un seul appel, un seul toast, une seule invalidation de ['/api/users'].

### USERS-06

**Invalidation inutile de /api/groups après chaque affectation** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Users.tsx:245`
- **Constat :** Users.tsx:243-245 et 288-290 : `queryClient.invalidateQueries({ queryKey: ['/api/users'] }); queryClient.invalidateQueries({ queryKey: ['/api/groups'] });`. Pour un admin, /api/groups renvoie tous les magasins (routes.ts:978-980), donc la liste ne dépend pas des affectations. Le changement de rôle (l.96) recharge aussi toute la liste.
- **Impact :** Chaque clic Assigner/Retirer recharge la liste des magasins avec tous les logos base64 (voir GROUPS-02), utilisée par Layout, en plus du N+1 de /api/users.
- **Recommandation :** Supprimer seulement `queryClient.invalidateQueries({ queryKey: ['/api/groups'] })` dans assignGroupMutation et removeGroupMutation. Garder l'invalidation de ['/api/users'], qui devient peu coûteuse après USERS-01. La mise à jour optimiste par setQueryData est à traiter à part.

### USERS-07

**Magasins enregistrés tout de suite dans la modale, contrairement aux autres champs (« Annuler » ne les annule pas)** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Users.tsx:893`
- **Constat :** Users.tsx:908-916 : le bouton `onClick={() => handleToggleGroupInEdit(group.id, isAssigned)}` appelle l'API immédiatement (l.465-477), alors que nom, e-mail, rôle et mot de passe ne partent qu'au clic « Mettre à jour » (l.479-500). Le bouton « Annuler » (l.927-936) ferme sans revenir en arrière. La création utilise des cases à cocher (l.1052) : deux interfaces différentes pour la même donnée. La liste est limitée à `max-h-32` (128 px, environ 3 magasins visibles).
- **Impact :** Un utilisateur non technicien pense que « Annuler » annule tout, alors que les magasins ont déjà été modifiés. Une même action se fait de deux façons différentes selon qu'on crée ou qu'on modifie.
- **Recommandation :** Utiliser les mêmes cases à cocher qu'à la création, garder la sélection dans l'état du formulaire et l'envoyer avec « Enregistrer » (PUT /api/users/:id avec `groupIds`, différence calculée côté serveur dans une transaction). Agrandir la liste (max-h-60).

### USERS-08

**Le rôle « Directeur » manque dans le filtre et dans le formulaire de création** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Users.tsx:631`
- **Constat :** Filtre, Users.tsx:631-634 : `<SelectItem value="all">…<SelectItem value="admin">…<SelectItem value="manager">…<SelectItem value="employee">` (pas de directeur). Création, l.1040-1042 : uniquement employee/manager/admin. Le sélecteur rapide (l.763) et la modale de modification (l.886) proposent pourtant « Directeur », et le serveur l'accepte (routes.ts:4325).
- **Impact :** Impossible de lister les directeurs. Pour créer un directeur, il faut créer un compte avec un autre rôle puis le modifier, ce qui déclenche une 2e confirmation.
- **Recommandation :** Ajouter dans roleUtils.ts un tableau ordonné `ROLE_OPTIONS = ['admin','directeur','manager','employee'].map(v => ({ value: v, label: ROLE_DISPLAY_NAMES[v] }))` et l'utiliser pour le filtre, la création, la modification et le sélecteur rapide. Élargir le type du onValueChange de création à `'directeur'`.

### USERS-09

**Le tableau affiche un ID technique au lieu de l'identifiant de connexion, qui n'est pas non plus cherchable** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Users.tsx:712`
- **Constat :** Users.tsx:711-713 : `<div className="text-sm text-gray-500">ID: {userData.id}</div>` (valeurs du type `manual_1712345678_k3j2h1g0f` ou `jdupont_1712345678`, routes.ts:4343). La recherche (l.348-350) ne porte que sur firstName, lastName et email, pas sur `username`, alors que c'est le seul champ obligatoire et celui utilisé pour se connecter.
- **Impact :** L'administrateur ne voit pas l'identifiant qu'il doit donner à l'employé et ne peut pas retrouver « ff0292 ». Les comptes sans prénom ni nom (champs facultatifs) apparaissent comme « Nom non renseigné » sans autre repère lisible.
- **Recommandation :** Remplacer « ID: … » par « Identifiant : {username} ». Ajouter `u.username` à la recherche (placeholder « Nom, identifiant ou e-mail… »). Calculer `searchTerm.toLowerCase()` une seule fois dans un useMemo.

### USERS-10

**La confirmation de changement de rôle affiche le code anglais et ne dit pas de qui il s'agit** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Users.tsx:516`
- **Constat :** Users.tsx:513-517 : `setPendingRoleChange({ userId, newRoleName, newRoleDisplay: newRoleName })`, puis l.1124 `vers <span>{pendingRoleChange.newRoleDisplay}</span>` → « …changer le rôle de cet utilisateur vers employee ». l.529 : la modale se ferme dès le `mutate`, donc le libellé « Modification... » (l.1147) n'est jamais visible.
- **Impact :** Le texte mélange anglais et français et ne nomme ni l'utilisateur ni l'ancien rôle. Le risque d'erreur augmente sur une action sensible.
- **Recommandation :** `newRoleDisplay: getRoleDisplayName(newRoleName)`. Ajouter l'utilisateur (`users.find(u => u.id === userId)`) et l'ancien rôle dans l'état et le texte. Fermer la modale via `updateUserRoleMutation.mutate(vars, { onSuccess: () => { setShowRoleConfirmModal(false); setPendingRoleChange(null); } })` et la laisser ouverte en cas d'erreur (le toast d'erreur existe déjà).

### USERS-11

**Deux réglages du rôle avec des règles différentes : la modale permet de modifier son propre rôle sans confirmation** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Users.tsx:877`
- **Constat :** Le sélecteur rapide bloque son propre compte (Users.tsx:503 `if (userId === user?.id)` et l.752 `userData.id !== user?.id`) et demande une confirmation. La modale de modification (l.877-890) envoie `role: editForm.role` (l.488) sans confirmation ni contrôle. Côté serveur, PUT /api/users/:id (routes.ts:4392-4431) ne bloque ni l'auto-rétrogradation ni le retrait du dernier administrateur.
- **Impact :** Un admin peut se retirer ses propres droits par erreur depuis sa fiche et perdre l'accès à l'administration. La même donnée s'affiche 3 fois par ligne ou modale (badge, sélecteur rapide, sélecteur de la modale).
- **Recommandation :** Garder un seul point d'édition du rôle (la modale, avec la même confirmation), retirer le sélecteur rapide de la colonne Actions, et ajouter côté serveur : refus si `req.params.id === user.id && role !== user.role`, et refus si cela retire le dernier admin.

### USERS-14

**Mobile : tableau coupé, la colonne Actions devient inaccessible** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Users.tsx:658`
- **Constat :** La route /users est servie telle quelle dans MobileApp (RouterProduction.tsx:120). Users.tsx:658 `<div className="bg-white border … overflow-hidden">` contient un `<table className="w-full">` de 5 colonnes en `whitespace-nowrap` (l.683, 717, 720, 726, 749). Le contenu qui dépasse est masqué au lieu de défiler.
- **Impact :** Sur téléphone, les boutons Modifier et Supprimer ainsi que le sélecteur de rôle sont hors de l'écran et inutilisables.
- **Recommandation :** Correction automatique limitée à remplacer `overflow-hidden` par `overflow-x-auto` (Users.tsx:658). La version en cartes sous `md` est une évolution d'interface à faire séparément (non automatique).

### USERS-17

**Vocabulaire incohérent « Groupes » / « Magasins » sur la page Utilisateurs** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Users.tsx:673`
- **Constat :** Users.tsx:673 en-tête de colonne « Groupes », l.729 « Aucun groupe », l.895 « Magasins/Groupes », l.1048 « Magasins assignés », l.240 toast « assigné au groupe », l.420 « assigné à N magasin(s) », l.921 « Aucun groupe disponible ». Le menu dit « Magasins » (Sidebar.tsx:347).
- **Impact :** L'utilisateur final ne sait pas si un « groupe » et un « magasin » sont la même chose.
- **Recommandation :** Utiliser « Magasin(s) » partout dans l'interface (« Magasins », « Aucun magasin », « Affecté au magasin X »). Garder « group » uniquement dans le code.

### GROUPS-10

**Cartes magasin : informations techniques inutiles, état de configuration absent** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Groups.tsx:433`
- **Constat :** Groups.tsx:433 `<p className="text-sm text-gray-500">#{group.id}</p>` et l.457-466, une ligne entière avec l'icône Palette et le code `{group.color}` (« #1976D2 »), la couleur étant déjà visible dans le carré d'en-tête (l.425-430). L'icône `Users` (personnes) sert à représenter un magasin (l.357, 429).
- **Impact :** Du bruit visuel sans valeur pour un employé ou un manager. On ne voit pas les informations utiles : nombre d'utilisateurs, envoi de mails configuré ou non, factures reliées ou non.
- **Recommandation :** Supprimer l'id et la ligne couleur/hex. Utiliser l'icône `Store` de lucide. Ajouter des badges d'état (« Mails : configurés / à configurer », « Factures NocoDB : reliées », « 3 utilisateurs ») à partir des champs légers de GROUPS-02.

### GROUPS-12

**Configs NocoDB chargées au montage sans condition (403 relancé 2 fois pour un manager)** — perf-client, sévérité basse, effort S

- **Fichier :** `client/src/pages/Groups.tsx:84`
- **Constat :** Groups.tsx:84-86 `useQuery<NocodbConfig[]>({ queryKey: ['/api/nocodb-config'] })` sans `enabled`. Le serveur répond 403 aux non-admins (routes.ts:5093-5094), et la politique `retry: failureCount < 2` (queryClient.ts:84) relance la requête 2 fois.
- **Impact :** Une requête (avec déchiffrement des jetons côté serveur, storage.ts:1657) à chaque ouverture de la page, même si la modale n'est jamais ouverte, et 3 requêtes en erreur pour un manager.
- **Recommandation :** `enabled: user?.role === 'admin', staleTime: 5 * 60 * 1000`. La condition sur l'ouverture de la modale est facultative.

### GROUPS-15

**Composants natifs et emojis mélangés aux composants shadcn et aux icônes lucide** — coherence-design, sévérité basse, effort S

- **Fichier :** `client/src/pages/Groups.tsx:579`
- **Constat :** Groups.tsx:579 `<select id="nocodbConfig" … className="w-full mt-1 p-2 border …">` natif, alors que Users.tsx utilise `Select` shadcn. Groups.tsx:806 et 845 : `<input type="checkbox">` natifs, alors que Users.tsx:1052 utilise `Checkbox`. Emojis dans les boutons : l.711 « 🔍 Tester… », l.915 « ✉️ Tester la connexion SMTP ». Triple sélecteur de couleur (carré + `<Input type="color">` + code hex + 10 pastilles, l.536-563).
- **Impact :** Rendu et comportement clavier différents d'une page à l'autre (et en mode sombre). L'interface paraît moins soignée et la page est plus chargée.
- **Recommandation :** Utiliser `Select`, `Switch` (pour « Activé ») et `Checkbox` de shadcn, des icônes lucide (`Search`, `Mail`) à la place des emojis, et ne garder que les 10 pastilles pour la couleur.

### GROUPS-16

**Grilles du formulaire non adaptées au mobile** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Groups.tsx:616`
- **Constat :** Groups.tsx:616 `<div className="grid grid-cols-2 gap-4">` (6 champs de colonnes NocoDB), l.822 `grid grid-cols-3 gap-3` (serveur/port), l.854 et 882 `grid grid-cols-2`. La route /groups est servie telle quelle sur mobile (RouterProduction.tsx:119). L'en-tête (l.354) `flex items-center justify-between` ne passe pas à la ligne alors qu'il contient un titre en text-2xl et un bouton.
- **Impact :** Sur téléphone, champs très étroits et libellés tronqués (« Colonne Montant TTC », « Adresse expéditeur * »), titre et bouton serrés.
- **Recommandation :** `grid-cols-1 sm:grid-cols-2` (l.616, 854, 882), `grid-cols-1 sm:grid-cols-3` avec `sm:col-span-2` (l.822-823), et `flex flex-wrap gap-3` sur les en-têtes Groups.tsx:354 et Users.tsx:590.

### PERM-02

**Middleware global qui recopie récursivement toutes les réponses JSON pour masquer smtpPassword** — perf-serveur, sévérité basse, effort M

- **Fichier :** `server/routes.ts:168`
- **Constat :** routes.ts:166-170 : `app.use('/api', (req, res, next) => { … res.json = (body) => originalJson(stripSmtpPassword(body)); })`. sanitize.ts:13-43 parcourt chaque objet jusqu'à 8 niveaux et recrée un nouvel objet pour chacun (`const result = {}; for (const [key, entry] of Object.entries(value))`), sur toutes les réponses API (livraisons, commandes, etc.), même sans aucun magasin.
- **Impact :** Coût CPU et mémoire proportionnel à la taille de chaque réponse, sur toutes les routes, pour protéger un seul champ.
- **Recommandation :** D'abord remplacer `group: groups` dans toutes les jointures de storage.ts, ainsi que getGroups/getGroup, par une projection sans `smtpPassword` (ni `logo`), avec `smtpPasswordSet`. Réserver la lecture du mot de passe à emailService via une méthode dédiée (ex. `getGroupSmtpCredentials`). Ne supprimer le middleware qu'ensuite, et ne jamais le restreindre à /api/groups tant qu'une jointure peut encore renvoyer le champ.

### USERS-12

**Délai artificiel de 1 seconde avant la fermeture de la modale après enregistrement** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Users.tsx:159`
- **Constat :** Users.tsx:158-162 : `// Delay modal close to show the updated data\n setTimeout(() => { setShowEditModal(false); setSelectedUser(null); }, 1000);`
- **Impact :** La modale reste ouverte une seconde de plus à chaque modification. Le bouton « Mettre à jour » redevient cliquable pendant ce temps, ce qui permet un double envoi.
- **Recommandation :** Fermer la modale immédiatement dans onSuccess : le toast suffit à confirmer l'enregistrement. Supprimer le setEditForm de la réponse (l.143-150), qui ne sert plus.

### USERS-13

**Confirmations incohérentes : window.confirm natif pour supprimer, Dialog pour le rôle, AlertDialog ailleurs** — coherence-design, sévérité basse, effort S

- **Fichier :** `client/src/pages/Users.tsx:558`
- **Constat :** Users.tsx:558 `if (window.confirm(`Êtes-vous sûr de vouloir supprimer l'utilisateur ${userToDelete.firstName} ${userToDelete.lastName} ?…`))`, Groups.tsx:308 `window.confirm(...)`, contre un Dialog personnalisé pour le rôle (Users.tsx:1104) et un AlertDialog shadcn dans Avoirs.tsx:1603 et DlcPage.tsx:1139.
- **Impact :** La boîte native du navigateur casse l'identité visuelle. Pour un compte sans prénom ni nom (champs facultatifs), le message devient « supprimer l'utilisateur   ? ».
- **Recommandation :** Créer un composant `ConfirmDialog` (AlertDialog shadcn, bouton rouge « Supprimer ») et l'utiliser pour toutes les suppressions, avec le nom affiché ou à défaut l'identifiant (`username`).

### USERS-15

**console.log de debug dans les mutations des deux pages** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/Users.tsx:227`
- **Constat :** Users.tsx:227 `console.log('📤 Assigning group:', data)`, l.233, 237, 248, 273, 278, 282, 293 ; Groups.tsx:99 `console.log('🏪 Frontend: Creating group with data:', data)`, qui affiche le mot de passe SMTP saisi et le logo base64, et l.101.
- **Impact :** Console polluée en production. Le mot de passe SMTP en clair est visible dans la console du navigateur.
- **Recommandation :** Supprimer ces console.log, ou les placer derrière `if (import.meta.env.DEV)` comme dans apiRequest.

### USERS-16

**Code mort : gestion 401 jamais déclenchée (répétée 8 fois), états et fonctions inutilisés** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/Users.tsx:100`
- **Constat :** isUnauthorizedError teste `/^401: .*Unauthorized/` (authUtils.ts:2) alors que le serveur répond « Authentification requise » (localAuth.ts:252). Le bloc ne se déclenche donc jamais et redirigerait vers `/api/login` en GET, route qui n'existe pas (seul POST, localAuth.production.ts:203). Il est copié dans 5 mutations de Users.tsx (l.100, 165, 203, 249, 294) et 3 de Groups.tsx (l.114, 148, 226). Inutilisés : `usePermissions` (Users.tsx:15), `showRoleModal`/`selectedUserForRole` (l.42-43), `safeUsers` (l.84), `handleToggleGroup` (l.540-546), commentaire obsolète « Gestion des Rôles » (l.538).
- **Impact :** Environ 120 lignes sans effet qui rendent les pages difficiles à maintenir. Le 401 est déjà géré globalement (queryClient.ts:57-62).
- **Recommandation :** Supprimer ces blocs et créer un helper `onApiError(toast, fallback)` partagé. Supprimer les états, imports et fonctions inutilisés.

### USERS-18

**Le texte d'aide « Minimum 6 caractères » n'est vérifié nulle part** — bug, sévérité basse, effort S

- **Fichier :** `client/src/pages/Users.tsx:870`
- **Constat :** Users.tsx:869-871 : « Minimum 6 caractères. Laissez vide pour conserver le mot de passe actuel. » Côté client, handleSubmitEdit ne vérifie rien (l.492). Côté serveur : création `password: z.string().min(1, …)` (routes.ts:4323), modification `password: z.string().optional()` (l.4405).
- **Impact :** Un mot de passe d'un seul caractère est accepté alors que l'interface annonce le contraire.
- **Recommandation :** Choisir une règle unique (par exemple 6 caractères minimum), l'appliquer dans les deux schémas zod côté serveur et vérifier côté client avec un message sous le champ, dans la création comme dans la modification.

### USERS-19

**La clé primaire est générée côté client à partir de l'e-mail (« _1712… » si e-mail vide)** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/Users.tsx:191`
- **Constat :** Users.tsx:189-192 : `id: userData.email.split('@')[0] + '_' + Date.now(), // Simple ID generation`, alors que le serveur sait déjà générer un id (routes.ts:4343 `userData.id || `manual_${Date.now()}_…``). Les lignes 195-197 sont aussi redondantes (`payload.password` est déjà dans `...userData`).
- **Impact :** Identifiants techniques peu lisibles (`_1712345678901` quand l'e-mail est vide), affichés dans le tableau (voir USERS-09). Le client choisit la clé primaire.
- **Recommandation :** Ne plus envoyer `id` depuis le client, retirer `id` du createUserSchema côté serveur et laisser le serveur générer un UUID (`crypto.randomUUID()`).

### USERS-20

**Aucune explication de ce que permet chaque rôle** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Users.tsx:1029`
- **Constat :** Les sélecteurs de rôle (Users.tsx:1029-1044, 875-891, 753-767) ne montrent que les libellés « Administrateur / Directeur / Manager / Employé ». Les droits réels sont dans shared/permissions.ts (par ex. rapprochement : directeur oui, manager non, l.53-58 ; avoirs : manager création seule, l.94-99).
- **Impact :** Un administrateur non technicien choisit un rôle sans savoir ce que la personne pourra faire, d'où des erreurs d'attribution et des demandes de support.
- **Recommandation :** Ajouter sous chaque option une ligne de description (« Manager : commandes, livraisons, DLC ; pas de rapprochement ni de suppression »), générée depuis shared/permissions.ts ou écrite dans roleUtils.ts.

### USERS-21

**Suppression d'un utilisateur : boucle d'await séquentielle sans transaction** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/routes.ts:4514`
- **Constat :** routes.ts:4512-4521 : `const userWithGroups = await storage.getUserWithGroups(userToDelete); if (userWithGroups) { for (const userGroup of userWithGroups.userGroups) { await storage.removeUserFromGroup(userToDelete, userGroup.groupId); } } await storage.deleteUser(userToDelete);`
- **Impact :** 2 + N + 1 requêtes à la suite. En cas d'erreur au milieu, l'utilisateur reste en base mais n'est plus dans certains magasins.
- **Recommandation :** `await db.transaction(async tx => { await tx.delete(userGroups).where(eq(userGroups.userId, id)); await tx.delete(users).where(eq(users.id, id)); })`, à encapsuler dans storage.deleteUser.

### USERS-22

**Routes en double pour l'affectation utilisateur ↔ magasin (la 2e n'est jamais atteinte)** — dette-code, sévérité basse, effort S

- **Fichier :** `server/routes.ts:4461`
- **Constat :** routes.ts:4228 `app.post('/api/users/:userId/groups', …)` et routes.ts:4461 `app.post('/api/users/:id/groups', …)`. Même chose pour DELETE en l.4249 et l.4481. Express exécute la première route enregistrée, qui envoie la réponse : les secondes sont du code mort.
- **Impact :** Confusion à la maintenance : une correction faite dans la 2e version n'aurait aucun effet.
- **Recommandation :** Supprimer les routes des lignes 4461-4495.

### USERS-23

**Boutons à icône seule sans libellé accessible** — accessibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Users.tsx:779`
- **Constat :** Users.tsx:779-787 : bouton Supprimer `<Button …><Trash2 className="w-4 h-4" /></Button>` sans `title` ni `aria-label` (Modifier a un `title`, l.773). Le sélecteur rapide de rôle (l.758) n'a pas d'aria-label. Groups.tsx:438-452 : boutons Modifier et Supprimer des cartes sans libellé. Groups.tsx:552-561 : pastilles de couleur avec seulement `title`, sans `aria-pressed` pour la couleur choisie.
- **Impact :** Les lecteurs d'écran annoncent « bouton » sans contexte, et rien au survol ne dit ce que fait la poubelle.
- **Recommandation :** Ajouter `aria-label="Supprimer {nom}"` / `aria-label="Modifier {nom}"` et un `title` équivalent, plus `aria-pressed={formData.color === option.value}` sur les pastilles.

### USERS-24

**Chargement affiché par un spinner central au lieu d'un squelette de la liste** — coherence-design, sévérité basse, effort S

- **Fichier :** `client/src/pages/Users.tsx:642`
- **Constat :** Users.tsx:642-645 et Groups.tsx:391-394 : `<div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>` dans un bloc `h-64`.
- **Impact :** La page change de forme à l'arrivée des données et le chargement semble plus long, surtout que /api/users est lent (USERS-01).
- **Recommandation :** Afficher 5 lignes `Skeleton` (shadcn) avec la même structure que le tableau ou les cartes.
