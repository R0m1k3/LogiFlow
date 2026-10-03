# Tâches

_36 constats vérifiés — 6 haute, 25 moyenne, 5 basse._

## Pages analysées

### `/tasks (desktop et tablette, largeur >= 768px)`

**Rôle :** Lister, filtrer, créer, modifier, terminer et supprimer les tâches du magasin sélectionné (liste paginée ou vue Kanban), avec des dates de début (visibilité programmée) et d'échéance.

**Tâches principales de l'utilisateur :**
- Voir les tâches à faire aujourd'hui ou en retard
- Marquer une tâche comme terminée
- Créer une tâche (titre, priorité, dates, personne assignée)
- Modifier ou supprimer une tâche
- Filtrer par statut, priorité, échéance et rechercher
- Basculer entre Liste et Kanban

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user | au montage, une fois par composant qui appelle useAuthUnified/useAuthSimple (RouterProduction, Layout, Sidebar, Tasks), soit 4 appels, sans cache partagé (cache: 'no-cache') | server/localAuth.production.ts:246 (req.user déjà chargé par deserializeUser l.193-195 → storage.getUserWithGroups storage.ts:371, 2 requêtes SQL) | La requête des tâches attend la fin de l'appel /api/user propre à Tasks (enabled: !!user) : chargement en cascade. |
| GET /api/tasks?storeId=X | au montage (enabled: !!user) + invalidation forcée par useEffect au montage et à chaque changement de magasin (Tasks.tsx:299-308) + invalidation par le sélecteur de magasin de Layout (Layout.tsx:138-146) | server/routes.ts:3193 → storage.getUserWithGroups (storage.ts:371, 2 requêtes) + storage.getTasks (storage.ts:2267, LEFT JOIN groups sur toutes les colonnes) | Aucune limite ni pagination. Chaque tâche embarque la ligne magasin complète, logo base64 compris. Renvoie [] pour un non-admin sans storeId. 6 console.log par appel. |
| GET /api/users | au montage pour admin/manager/directeur (Tasks.tsx:385-396), résultat jamais utilisé | server/routes.ts:4268 → storage.getUsers (storage.ts:409, SELECT * avec password) + N x storage.getUserWithGroups (2 requêtes par utilisateur) | Requête inutile en N+1 qui renvoie aussi les hash de mots de passe au navigateur. |
| POST /api/tasks | au clic sur Créer (fetch manuel dans TaskFormInline) puis window.location.reload() | server/routes.ts:3277 → storage.getUserWithGroups + storage.createTask (storage.ts:2365) | Pas de validation zod (insertTaskSchema inutilisé). Groupe 1 par défaut. Corps complet loggé. |
| PUT /api/tasks/:id | au clic sur Modifier (fetch manuel) puis window.location.reload() | server/routes.ts:3340 → getUserWithGroups + storage.getTask (storage.ts:2348, jointure groups complète) + storage.updateTask (storage.ts:2392) | Pas de contrôle hasPermission (seule l'appartenance au magasin est vérifiée). |
| DELETE /api/tasks/:id | au clic sur Supprimer dans la modale de confirmation | server/routes.ts:3425 → getUserWithGroups + storage.getTask + storage.deleteTask (storage.ts:2470) | Pas de hasPermission : un manager ou un employé peut supprimer. Le client attend le rechargement complet de la liste avant de fermer la modale. |
| POST /api/tasks/:id/complete | au clic sur l'icône Terminer | server/routes.ts:3455 → getUserWithGroups + storage.getTask + storage.completeTask (storage.ts:2474) | Renvoie un simple message, pas la tâche mise à jour : le client doit recharger toute la liste. |

**Lisibilité / simplicité :** Page lourde et dense : chaque carte empile jusqu'à 7 informations (priorité, badge Future, '(Programmée)', 'Visible en avance (directeur)', badge début '📅 Active' avec texte, badge échéance '⏰', 'Créée le' avec l'heure, 'Assigné à: Non assigné'). Emojis et icônes lucide se doublent dans les mêmes badges. Sur desktop, les actions sont des icônes sans libellé ni infobulle. Un bug de date affiche 'En retard de 0 jour' pour les tâches dues aujourd'hui et 'Dans 0 jour' pour celles de demain. Les compteurs 'Tâches en cours (n)' ne portent que sur la page courante. Les tâches terminées sont presque illisibles (opacité 60 %, gris 400, texte barré). Sur tablette (768-1023 px), la recherche et les filtres sont inaccessibles et l'onglet Kanban est vide. Les modales sont faites à la main (pas d'Échap ni de focus) et le formulaire mélange styles inline et Tailwind. L'assignation est un champ texte libre, et un admin en vue 'Tous les magasins' crée la tâche dans le magasin 1 sans le savoir. Les erreurs réseau s'affichent comme 'Aucune tâche trouvée avec les filtres sélectionnés'. Après chaque création ou modification, la page entière est rechargée. Un employé sur desktop ne voit aucune tâche (pas de magasin sélectionné ni sélectionnable). Les droits affichés (supprimer, terminer) ne respectent pas la matrice de permissions.

### `/tasks (mobile, largeur < 768px)`

**Rôle :** Version mobile de la liste des tâches : onglets Actives/Faites/Toutes, recherche, bouton flottant de création, formulaire plein écran, suppression par feuille du bas.

**Tâches principales de l'utilisateur :**
- Voir les tâches actives du magasin
- Terminer une tâche
- Créer ou modifier une tâche depuis le téléphone
- Rechercher une tâche par titre
- Supprimer une tâche

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user | au montage, 5 fois (RouterProduction, MobileApp, MobileLayout, MobileBottomNav, TasksPage), chacun avec son propre fetch | server/localAuth.production.ts:246 | La requête des tâches attend l'appel propre à TasksPage (enabled: !!user). |
| GET /api/tasks?storeId=X | au montage (enabled: !!user) | server/routes.ts:3193 → storage.getTasks (storage.ts:2267) | Même payload sans limite, avec la ligne magasin complète par tâche. Tout est rendu sans pagination (onglets Faites/Toutes). |
| POST /api/tasks et PUT /api/tasks/:id | à la soumission du formulaire plein écran puis window.location.reload() | server/routes.ts:3277 / 3340 | Le formulaire mobile n'a ni date de début ni statut. |
| POST /api/tasks/:id/complete | au clic sur Terminer (visible pour tous les rôles) | server/routes.ts:3455 | response.ok n'est pas vérifié : un toast de succès s'affiche même en cas d'erreur 403 ou 500. |
| DELETE /api/tasks/:id | au clic sur Supprimer dans la feuille du bas | server/routes.ts:3425 | response.ok n'est pas vérifié non plus. |

**Lisibilité / simplicité :** Plus simple et plus lisible que le desktop (cartes compactes, gros boutons, onglets). Plusieurs écarts : vocabulaire différent ('Actives/Faites' contre 'En cours/Terminées'), couleurs de priorité différentes (rouge/jaune/vert contre rouge/bleu/gris), recherche sur le titre seulement (titre + description sur desktop). Les tâches programmées ne sont pas distinguées et peuvent être 'terminées'. 'Terminer' est proposé à tous les rôles alors que le desktop le réserve aux managers et plus. Le formulaire n'a pas de date de début. Les boutons icône (modifier, supprimer, +) n'ont pas de libellé accessible. Le toast de succès s'affiche même si l'API échoue. Spinner pendant le chargement, page entière rechargée après enregistrement, double marge horizontale (p-3 puis px-3).

### `(aucune route : code mort) client/src/components/tasks/* et client/src/components/ResponsiveTasks.tsx`

**Rôle :** Six variantes successives du formulaire de tâche, une carte 'tâches récentes' et un wrapper responsive. Aucun n'est importé par l'application (vérifié par grep sur tout le dépôt).

**Tâches principales de l'utilisateur :**
- Aucune : composants non montés

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/groups, POST /api/tasks, PUT/PATCH /api/tasks/:id, GET /api/tasks | jamais (composants non importés) | server/routes.ts:3277 / 3340 (aucune route PATCH /api/tasks/:id n'existe) | TaskFormClean, SimpleTaskFormClean, TaskFormProduction et TaskFormUltraSimple appellent PATCH, qui renverrait une erreur. groupId 1 et createdBy 'admin' sont codés en dur. 2030 lignes au total. |

**Lisibilité / simplicité :** Sans effet sur l'utilisateur aujourd'hui. C'est de la dette : six formulaires divergents (alert() natif, PATCH inexistant, magasin 1 codé en dur), alors que le formulaire réellement utilisé est encore un septième, écrit en ligne dans Tasks.tsx, plus un huitième dans la page mobile.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [TASKS-01](#tasks-01) | haute | perf-api | S | Chaque tâche embarque la ligne magasin complète (logo base64, config NocoDB/SMTP) | `server/storage.ts:2271` |
| [TASKS-02](#tasks-02) | haute | bug | S | Un employé sur desktop ne voit jamais aucune tâche | `client/src/components/Layout.tsx:69` |
| [TASKS-03](#tasks-03) | haute | perf-client | S | Rechargement complet de la page après chaque création ou modification | `client/src/pages/Tasks.tsx:120` |
| [TASKS-07](#tasks-07) | haute | perf-api | S | Requête /api/users inutile (jamais utilisée), en N+1 côté serveur, qui expose les mots de passe hashés | `client/src/pages/Tasks.tsx:385` |
| [TASKS-09](#tasks-09) | haute | bug | S | Sur tablette, la recherche et les filtres sont inaccessibles et le Kanban est vide | `client/src/pages/Tasks.tsx:697` |
| [TASKS-13](#tasks-13) | haute | bug | S | Droits incohérents entre la matrice de permissions, l'interface et l'API (supprimer, terminer, modifier) | `server/routes.ts:3425` |
| [TASKS-04](#tasks-04) | moyenne | perf-api | S | Utilisateur et magasins rechargés en base à chaque requête alors que req.user les contient déjà | `server/routes.ts:3195` |
| [TASKS-05](#tasks-05) | moyenne | perf-client | S | Invalidation forcée au montage et au changement de magasin : 2 à 3 requêtes /api/tasks au lieu d'une | `client/src/pages/Tasks.tsx:299` |
| [TASKS-06](#tasks-06) | moyenne | bug | S | Même queryKey ['/api/tasks', storeId] pour deux URL différentes (Dashboard et Tasks) | `client/src/pages/Dashboard.tsx:282` |
| [TASKS-08](#tasks-08) | moyenne | perf-client | M | Chargement en cascade /api/user puis /api/tasks, avec un faux 'Aucune tâche' affiché pendant l'attente | `client/src/hooks/useAuthUnified.ts:146` |
| [TASKS-10](#tasks-10) | moyenne | perf-client | M | Toute la liste est rendue deux fois (version tablette et version desktop montées, l'une cachée en CSS) | `client/src/pages/Tasks.tsx:851` |
| [TASKS-11](#tasks-11) | moyenne | bug | S | Les filtres 'Aujourd'hui', 'Cette semaine' et 'En retard' incluent les tâches sans échéance | `client/src/pages/Tasks.tsx:491` |
| [TASKS-12](#tasks-12) | moyenne | bug | S | Une tâche due aujourd'hui s'affiche 'En retard de 0 jour', une tâche due demain 'Dans 0 jour' | `client/src/pages/Tasks.tsx:580` |
| [TASKS-14](#tasks-14) | moyenne | ux-simplicite | S | Compteurs 'Tâches en cours (n)' et 'Tâches terminées (n)' calculés sur la page courante seulement | `client/src/pages/Tasks.tsx:1189` |
| [TASKS-15](#tasks-15) | moyenne | accessibilite | S | Actions en icônes seules sans libellé, infobulle ni aria-label | `client/src/pages/Tasks.tsx:1296` |
| [TASKS-16](#tasks-16) | moyenne | accessibilite | S | Modales faites à la main au lieu du Dialog shadcn importé (pas d'Échap, pas de focus, pas de rôle) | `client/src/pages/Tasks.tsx:732` |
| [TASKS-17](#tasks-17) | moyenne | coherence-design | M | Formulaire mêlant styles inline (angles carrés, fond blanc forcé) et classes Tailwind arrondies avec mode sombre | `client/src/pages/Tasks.tsx:135` |
| [TASKS-18](#tasks-18) | moyenne | coherence-design | S | Couleurs de priorité, vocabulaire et icônes différents entre desktop et mobile | `client/src/pages/Tasks.tsx:544` |
| [TASKS-19](#tasks-19) | moyenne | lisibilite | M | Cartes surchargées : jusqu'à 7 informations redondantes par tâche, avec le rôle technique affiché | `client/src/pages/Tasks.tsx:1212` |
| [TASKS-20](#tasks-20) | moyenne | accessibilite | S | Tâches terminées quasi illisibles (opacité 60 % + gris 400 + texte barré) | `client/src/pages/Tasks.tsx:1350` |
| [TASKS-21](#tasks-21) | moyenne | ux-simplicite | M | Formulaire : assignation en texte libre, magasin implicite (magasin 1 pour un admin) et aucune vérification des dates | `client/src/pages/Tasks.tsx:90` |
| [TASKS-22](#tasks-22) | moyenne | ux-simplicite | S | Erreurs de chargement et absence de magasin affichées comme 'Aucune tâche trouvée avec les filtres sélectionnés' | `client/src/pages/Tasks.tsx:326` |
| [TASKS-23](#tasks-23) | moyenne | perf-client | S | Spinner plein écran à chaque changement de magasin, faute de placeholderData et de squelette | `client/src/pages/Tasks.tsx:670` |
| [TASKS-24](#tasks-24) | moyenne | perf-client | M | Terminer et Supprimer passent par des fetch manuels qui attendent le rechargement complet de la liste avant tout retour visuel | `client/src/pages/Tasks.tsx:405` |
| [TASKS-25](#tasks-25) | moyenne | bug | S | Mobile : 'Tâche terminée' ou 'Tâche supprimée' affiché même quand l'API refuse ou échoue | `client/src/pages/mobile/TasksPage.tsx:334` |
| [TASKS-26](#tasks-26) | moyenne | ux-simplicite | S | Mobile : tâches programmées non signalées et 'Terminer' proposé alors que le desktop l'interdit | `client/src/pages/mobile/TasksPage.tsx:215` |
| [TASKS-27](#tasks-27) | moyenne | perf-api | M | GET /api/tasks sans limite : tout l'historique des tâches terminées (et tous les magasins pour un admin) à chaque chargement | `server/storage.ts:2301` |
| [TASKS-28](#tasks-28) | moyenne | perf-serveur | S | console.log volumineux dans tous les handlers tâches (corps complets, parcours de toute la liste) | `server/routes.ts:3252` |
| [TASKS-29](#tasks-29) | moyenne | perf-serveur | S | Index de la table tasks déclarés dans un fichier SQL jamais exécuté, et absents de schema.ts | `server/migrations.ts:112` |
| [TASKS-31](#tasks-31) | moyenne | dette-code | L | Tasks.tsx (1633 lignes) duplique 6 fois le balisage des cartes et 2 fois les filtres, et le mobile réimplémente tout | `client/src/pages/Tasks.tsx:874` |
| [TASKS-32](#tasks-32) | moyenne | dette-code | S | Huit composants de formulaire ou de carte de tâche et ResponsiveTasks jamais importés (2030 lignes), dont plusieurs appellent une route PATCH inexistante | `client/src/components/tasks/TaskFormUltraSimple.tsx:38` |
| [TASKS-30](#tasks-30) | basse | perf-api | S | PUT, DELETE et complete : contrôle d'accès en lecture préalable avec jointure magasin complète, puis écriture (3 à 4 allers-retours) | `server/storage.ts:2348` |
| [TASKS-33](#tasks-33) | basse | dette-code | S | console.log de debug dans le rendu et le queryFn, imports et variables inutilisés | `client/src/pages/Tasks.tsx:285` |
| [TASKS-34](#tasks-34) | basse | perf-client | S | Filtrage et tri recalculés à chaque rendu sans useMemo, et sous-filtres répétés dans le JSX | `client/src/pages/Tasks.tsx:472` |
| [TASKS-35](#tasks-35) | basse | perf-bundle | S | Pages Tâches desktop et mobile importées statiquement dans le bundle principal | `client/src/components/RouterProduction.tsx:24` |
| [TASKS-36](#tasks-36) | basse | bug | S | Avec server/index.ts (dev et `npm start`), les apostrophes des titres de tâches sont stockées échappées en HTML (&#x27;) | `server/security.ts:202` |

### TASKS-01

**Chaque tâche embarque la ligne magasin complète (logo base64, config NocoDB/SMTP)** — perf-api, sévérité haute, effort S

- **Fichier :** `server/storage.ts:2271`
- **Constat :** storage.ts:2271-2277 `db.select({ task: tasks, group: groups }).from(tasks).leftJoin(groups, ...)`. Or shared/schema.ts:67 `logo: text("logo"), // Logo en data URI (data:image/png;base64,...)` et l.53-76 (nocodb*, webhookUrl, smtp*). Côté client, task.group n'est lu nulle part, sauf dans un console.log (Tasks.tsx:364 `hasGroup: !!data[0].group`). En plus, stripSmtpPassword (routes.ts:168) parcourt récursivement chaque objet group.
- **Impact :** Le logo du magasin (souvent des dizaines de Ko) est répété dans le JSON autant de fois qu'il y a de tâches. Pour 200 tâches, cela fait plusieurs Mo à télécharger et à parser, en desktop comme en mobile (et sur le Dashboard, qui appelle le même endpoint). Aucun gzip n'est actif : server/cache.ts:96 ne fait que poser l'en-tête.
- **Recommandation :** Partie automatisable : projeter les colonnes dans getTasks et getTask (`group: { id: groups.id, name: groups.name, color: groups.color }`), en gardant la forme `{...task, group, isFutureTask}` renvoyée au client. Ajouter `compression` dans index.production.ts est une étape séparée : nouvelle dépendance npm, et il faut vérifier qu'aucun reverse proxy ne compresse déjà. Ne pas réutiliser setupCompression de cache.ts, qui est défectueux.

### TASKS-02

**Un employé sur desktop ne voit jamais aucune tâche** — bug, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/components/Layout.tsx:69`
- **Constat :** Layout.tsx:69 : la sélection automatique du magasin n'existe que pour `(user.role === 'directeur' || user.role === 'manager') && !selectedStoreId && stores.length === 1`. Layout.tsx:131 : le sélecteur de magasin n'est affiché que pour `admin || directeur || manager`. Côté serveur, routes.ts:3237-3248, sans storeId pour un non-admin : `return res.json([]);`
- **Impact :** Sans selectedStoreId déjà en localStorage, un employé arrive sur 'Aucune tâche trouvée avec les filtres sélectionnés' et n'a aucun moyen d'en sortir. Il ne voit pas les tâches qu'on lui a assignées.
- **Recommandation :** Corriger côté client uniquement : dans Layout.tsx et MobileApp.tsx, auto-sélectionner l'unique magasin pour tout rôle non-admin (employee compris), et afficher le sélecteur aux employés qui ont plusieurs magasins. Garder le comportement serveur actuel et afficher un état vide explicite « Choisissez un magasin » quand selectedStoreId est null.

### TASKS-03

**Rechargement complet de la page après chaque création ou modification** — perf-client, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Tasks.tsx:120`
- **Constat :** Tasks.tsx:116-120 `toast({ title: "Succès", ... }); window.location.reload();`. Même chose dans mobile/TasksPage.tsx:83-87.
- **Impact :** Chaque enregistrement recharge tout le bundle JS, refait les 4 ou 5 appels /api/user, /api/groups, /api/tasks, etc. L'écran devient blanc 1 à 3 s et le toast de succès disparaît immédiatement. La position de pagination, les filtres et la recherche sont perdus.
- **Recommandation :** Dans TaskFormInline et MobileTaskForm, remplacer `window.location.reload()` par `await queryClient.invalidateQueries({ queryKey: ['/api/tasks'] }); onClose();` (useQueryClient), puis réactiver le bouton en cas d'erreur, comme aujourd'hui. Pas de setQueryData à partir de la réponse du POST ou du PUT.

### TASKS-07

**Requête /api/users inutile (jamais utilisée), en N+1 côté serveur, qui expose les mots de passe hashés** — perf-api, sévérité haute, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:385`
- **Constat :** Tasks.tsx:385 `const { data: users = [] } = useQuery({ queryKey: ["/api/users"], ... enabled: !!user && (admin||manager||directeur) })`. `users` n'est utilisé nulle part dans le fichier (vérifié par grep). Côté serveur, routes.ts:4276-4282 `const baseUsers = await storage.getUsers(); ... baseUsers.map(async (baseUser) => { const userWithGroups = await storage.getUserWithGroups(baseUser.id);`, soit 2 requêtes par utilisateur. Et storage.ts:409 `db.select().from(users)` inclut la colonne password (schema.ts:40).
- **Impact :** Chaque ouverture de la page Tâches par un manager lance 2N+3 requêtes SQL pour rien et envoie au navigateur la liste de tous les utilisateurs avec leurs hash de mot de passe.
- **Recommandation :** Partie automatisable : supprimer la useQuery '/api/users' de Tasks.tsx (aucun lecteur). Retirer `password` de la réponse de GET /api/users est une correction de sécurité à part, à traiter hors du périmètre tâches. Remplacer la boucle N+1 par une jointure demande une réécriture manuelle.

### TASKS-09

**Sur tablette, la recherche et les filtres sont inaccessibles et le Kanban est vide** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:697`
- **Constat :** Tasks.tsx:697 : le bouton Filtres a `className="sm:hidden ..."`, il est donc caché dès 640 px. l.761 `${filtersOpen ? 'block' : 'hidden'} lg:hidden` : filtersOpen ne peut jamais passer à true. l.852-1089 : la zone tablette `block lg:hidden` ne contient que `<TabsContent value="list">`, alors que l'onglet Kanban (l.712) reste cliquable. Le routeur envoie vers cette page toute largeur >= 768 px (RouterProduction.tsx:107, use-screen-size.ts mobile: 768).
- **Impact :** Sur une tablette de magasin (iPad 768-1024 px), l'utilisateur ne peut ni chercher ni filtrer. S'il clique sur 'Kanban', l'écran devient vide.
- **Recommandation :** Remplacer `sm:hidden` par `lg:hidden` sur le bouton Filtres (ou afficher les filtres en ligne au-dessus de la liste en dessous de lg), et ajouter le TabsContent kanban dans la zone tablette. Mieux : un seul rendu (voir TASKS-10).

### TASKS-13

**Droits incohérents entre la matrice de permissions, l'interface et l'API (supprimer, terminer, modifier)** — bug, sévérité haute, effort S

- **Fichier :** `server/routes.ts:3425`
- **Constat :** shared/permissions.ts:85-90 : `manager: ['view','create','edit','validate']` (pas de delete), `employee: ['view']`. Pourtant Tasks.tsx:668 `canEditTasks = admin||manager||directeur` affiche Supprimer aux managers. Tasks.tsx:1385-1394 : le bouton Supprimer des tâches terminées n'est conditionné par aucun droit (visible pour les employés). mobile/TasksPage.tsx:254 : 'Terminer' est affiché à tous (`{!isCompleted && (`). Côté serveur, PUT (routes.ts:3340), DELETE (3425) et complete (3455) ne vérifient que l'appartenance au magasin, jamais `hasPermission(user.role, 'tasks', ...)`. Seul le POST le fait (l.3285).
- **Impact :** Un employé peut supprimer des tâches terminées depuis le desktop, terminer n'importe quelle tâche depuis le mobile et modifier des tâches via l'API. Un manager peut supprimer. Le comportement change selon l'appareil utilisé.
- **Recommandation :** Côté serveur, ajouter `hasPermission(user.role,'tasks','edit'|'delete'|'validate')` dans PUT, DELETE et complete. Côté client, dériver canCreate, canEdit, canDelete et canComplete de `hasPermission` (shared/permissions.ts) dans les deux pages, et décider avec le métier si l'employé peut 'Terminer' (permission 'validate').

### TASKS-04

**Utilisateur et magasins rechargés en base à chaque requête alors que req.user les contient déjà** — perf-api, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:3195`
- **Constat :** localAuth.production.ts:193-195 : deserializeUser fait déjà `await storage.getUserWithGroups(id)`. Chaque handler tâches le refait : routes.ts:3195, 3279, 3342, 3427, 3457 `const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);`. getUserWithGroups (storage.ts:371-388) enchaîne lui-même 2 requêtes : getUser puis user_groups JOIN groups.
- **Impact :** 4 allers-retours SQL séquentiels avant la vraie requête, sur chaque appel tâches. Cela ajoute plusieurs dizaines de ms de latence à chaque chargement et à chaque clic Terminer ou Supprimer.
- **Recommandation :** Dans les 5 handlers tâches, remplacer l'appel par `const user = req.user as UserWithGroups;` (la donnée est identique, chargée par localAuth.ts:141-144 pour la même requête). Ne pas mettre en cache l'utilisateur ni ses permissions. La fusion de getUser et user_groups en une seule requête est une optimisation distincte, à faire à la main.

### TASKS-05

**Invalidation forcée au montage et au changement de magasin : 2 à 3 requêtes /api/tasks au lieu d'une** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:299`
- **Constat :** Tasks.tsx:299-308 `useEffect(() => { if (user && (directeur||manager) && selectedStoreId) { ... queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); } }, [selectedStoreId, user, queryClient]);`. La queryKey contient déjà selectedStoreId (l.327). Layout.tsx:138-146 invalide aussi '/api/tasks' (l'ancien magasin, encore actif) avant setSelectedStoreId.
- **Impact :** Pour un directeur ou un manager, chaque visite ignore le cache encore frais (staleTime de 30 s) : la requête initiale est annulée (cancelRefetch par défaut) puis relancée. Un changement de magasin produit un refetch de l'ancien magasin, un fetch du nouveau et un fetch annulé puis relancé, chacun avec le gros payload décrit en TASKS-01.
- **Recommandation :** Supprimer ce useEffect : le changement de queryKey suffit. Dans Layout, ne pas invalider les clés de l'ancien magasin (le changement de clé déclenche le fetch). Corriger d'abord la collision de clé avec le Dashboard (TASKS-06), qui est probablement à l'origine de ce contournement.

### TASKS-06

**Même queryKey ['/api/tasks', storeId] pour deux URL différentes (Dashboard et Tasks)** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:282`
- **Constat :** Dashboard.tsx:282-286 `queryKey: ["/api/tasks", selectedStoreId], ... if (selectedStoreId && user?.role === 'admin') params.append("storeId", ...)`. Pour un non-admin, l'appel part donc sans storeId et le serveur renvoie [] (routes.ts:3248). Tasks.tsx:327-333 utilise la même clé mais envoie toujours storeId.
- **Impact :** Un directeur ou un manager qui passe du Dashboard aux Tâches dans les 30 s reçoit la liste vide mise en cache par le Dashboard. Le 'FORCE REFRESH' de Tasks.tsx:299 masque ce bug au prix de requêtes en double (TASKS-05).
- **Recommandation :** Créer un hook partagé `useTasks(storeId)` (client/src/hooks/useTasks.ts) avec une seule queryFn qui envoie toujours storeId. L'utiliser dans Dashboard, mobile/DashboardPage, Tasks et mobile/TasksPage, puis supprimer l'invalidation forcée.

### TASKS-08

**Chargement en cascade /api/user puis /api/tasks, avec un faux 'Aucune tâche' affiché pendant l'attente** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/hooks/useAuthUnified.ts:146`
- **Constat :** useAuthUnified.ts:23-24 et 146-217 : en production, chaque instance du hook a son propre useState et fait `fetch('/api/user', { cache: 'no-cache' })` au montage. Tasks.tsx:381 `enabled: !!user`. Quand la query est désactivée, isLoading vaut false, donc Tasks.tsx:670 ne montre pas le spinner et la page affiche '0 tâche trouvée' (l.689) puis 'Aucune tâche trouvée avec les filtres sélectionnés' (l.855-864 / 1176-1185).
- **Impact :** Chaque visite paie un aller-retour /api/user supplémentaire (4 en desktop, 5 en mobile) avant que les tâches ne soient demandées. L'utilisateur voit brièvement 'Aucune tâche', ce qui peut l'inquiéter, puis la liste apparaît.
- **Recommandation :** Faire de useAuthUnified une fine couche au-dessus d'une seule useQuery(['/api/user'], staleTime 5 min) partagée par tous les composants : le user est alors disponible immédiatement à la navigation. Dans Tasks, afficher le squelette tant que `!user || isPending`.

### TASKS-10

**Toute la liste est rendue deux fois (version tablette et version desktop montées, l'une cachée en CSS)** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Tasks.tsx:851`
- **Constat :** Tasks.tsx:851 `<div className="block lg:hidden">` et l.1093 `<div className="hidden lg:flex gap-6">` : les deux sous-arbres (cartes, filtres, deux champs de recherche liés au même état) sont montés en permanence. Seul le CSS cache l'un des deux.
- **Impact :** Deux fois plus de nœuds DOM et de calcul à chaque frappe dans la recherche. Les deux copies des cartes appellent format() et les helpers de date. Cela se ressent sur des PC de magasin modestes.
- **Recommandation :** Utiliser useScreenSize() (déjà présent) pour ne rendre qu'une seule variante, ou mieux, un seul composant responsive <TaskCard> et un seul <TaskFilters>.

### TASKS-11

**Les filtres 'Aujourd'hui', 'Cette semaine' et 'En retard' incluent les tâches sans échéance** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:491`
- **Constat :** Tasks.tsx:491-509 `if (dueDateFilter !== "all" && task.dueDate) { switch ... } else if (dueDateFilter === "no_due_date" && task.dueDate) { return false; }`. Une tâche avec dueDate null et le filtre 'overdue' passe les deux branches et arrive à `return true`. De plus, l.498 `isThisWeek(dueDate)` est appelé sans `{ weekStartsOn: 1 }`, donc la semaine commence le dimanche.
- **Impact :** En choisissant 'En retard', le manager voit aussi toutes les tâches sans date, ce qui lui fait croire à du retard. 'Cette semaine' est décalé d'un jour par rapport à la semaine française.
- **Recommandation :** Au début du bloc : `if (dueDateFilter !== 'all') { if (dueDateFilter === 'no_due_date') return !task.dueDate; if (!task.dueDate) return false; ... }`. Utiliser `isThisWeek(d, { weekStartsOn: 1 })`.

### TASKS-12

**Une tâche due aujourd'hui s'affiche 'En retard de 0 jour', une tâche due demain 'Dans 0 jour'** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:580`
- **Constat :** schema.ts:312 `dueDate: date("due_date")` renvoie '2026-10-02'. `new Date('2026-10-02')` donne minuit UTC, soit 02:00 à Paris. Tasks.tsx:580 teste `if (isPast(due))` avant `else if (isToday(due))` (l.588) : dès 2 h du matin, la branche 'Aujourd'hui' est inatteignable et le libellé devient `En retard de ${Math.abs(daysDiff)} jour` avec daysDiff = 0. l.578 `differenceInDays(due, now)` tronque : demain 02:00 moins aujourd'hui 15:00 donne 0, d'où 'Dans 0 jour' / '0j'. Le filtre 'overdue' (l.501) range aussi les tâches du jour en retard. Mobile : TasksPage.tsx:203-210, même problème pour 'Dans 0j'.
- **Impact :** Des badges rouges 'En retard' s'affichent à tort tous les jours et les libellés sont absurdes. Cela détruit la confiance dans l'indicateur principal de la page.
- **Recommandation :** Parser la date en local avec `parseISO(task.dueDate)` (date-fns), qui donne minuit local, et comparer en jours calendaires : `differenceInCalendarDays(startOfDay(due), startOfDay(new Date()))`, < 0 pour en retard, 0 pour aujourd'hui, 1 pour demain. Mutualiser cette logique dans un helper partagé desktop et mobile.

### TASKS-14

**Compteurs 'Tâches en cours (n)' et 'Tâches terminées (n)' calculés sur la page courante seulement** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:1189`
- **Constat :** Tasks.tsx:1189-1192 `paginatedTasks.filter(task => task.status === 'pending').length` (idem l.868-871, 1027-1030, 1337-1340). La pagination fait 10 éléments (l.542) sur une liste triée avec les tâches en cours d'abord, donc les terminées n'apparaissent qu'aux dernières pages. usePagination (pagination.tsx:157-159) revient à la page 1 dès que `data.length` change, par exemple après une suppression en page 3.
- **Impact :** Le titre affiche 'Tâches en cours (10)' alors qu'il y en a 45. Le manager sous-estime la charge. Après chaque suppression, il est renvoyé en page 1.
- **Recommandation :** Calculer les totaux sur filteredTasks (`pendingCount`, `completedCount`) et les afficher dans le titre ou dans des onglets 'À faire (45) / Terminées (120)'. Paginer chaque section séparément, ou n'afficher les terminées que sur demande. Ne réinitialiser la page que lorsque les filtres changent.

### TASKS-15

**Actions en icônes seules sans libellé, infobulle ni aria-label** — accessibilite, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Tasks.tsx:1296`
- **Constat :** Tasks.tsx:1296-1325 `<Button size="sm" variant="outline" onClick={() => handleCompleteTask(task.id)} ...><CheckCircle className="w-4 h-4" /></Button>`, même chose pour Edit et Trash2. Kanban l.1471-1494 en h-7 (28 px). Mobile : TasksPage.tsx:267-272 (modifier, supprimer) et le FAB l.449-454 `<Plus />` sans texte.
- **Impact :** Un employé non technicien doit deviner l'icône. Le coche vert 'Terminer' se confond facilement avec 'Modifier'. Les boutons Kanban de 28 px sont difficiles à viser sur écran tactile. Les lecteurs d'écran annoncent 'bouton' sans nom.
- **Recommandation :** Partie automatisable : ajouter seulement `aria-label` et `title` ('Terminer la tâche', 'Modifier', 'Supprimer', 'Nouvelle tâche') sur les boutons icône desktop, Kanban et mobile (FAB compris). Libellés visibles, menu « ... » et hauteur de 36 à 44 px : à valider côté design.

### TASKS-16

**Modales faites à la main au lieu du Dialog shadcn importé (pas d'Échap, pas de focus, pas de rôle)** — accessibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:732`
- **Constat :** Tasks.tsx:12 importe `Dialog, DialogContent, ...`, jamais utilisés. Les modales sont des `<div className="fixed inset-0 bg-black bg-opacity-50 z-[1000] ...">` (l.732, 1568, 1599) avec un bouton `✕` sans aria-label (l.738-744, 1574-1582). Mobile : TasksPage.tsx:96 et 469, même schéma.
- **Impact :** Échap et le clic sur le fond ne ferment rien. Le focus clavier reste derrière la modale et le scroll de la page n'est pas bloqué. Le style diffère des autres pages qui utilisent Dialog.
- **Recommandation :** Utiliser `<Dialog open onOpenChange>` + DialogContent/DialogHeader/DialogTitle pour la création et l'édition, AlertDialog pour la suppression (comme les autres pages), et Sheet (side="bottom") en mobile.

### TASKS-17

**Formulaire mêlant styles inline (angles carrés, fond blanc forcé) et classes Tailwind arrondies avec mode sombre** — coherence-design, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Tasks.tsx:135`
- **Constat :** Tasks.tsx:135 `<div style={{ padding: '24px', backgroundColor: 'white' }}>`. Titre et description : l.155-161 `style={{ ... borderRadius: '0px', fontSize: '14px' }}`. Priorité et dates : l.194 `className="w-full p-3 border ... rounded-md text-base min-h-[44px] ... dark:bg-gray-800"`. Champs HTML natifs au lieu de Input, Select et Textarea shadcn. Bouton de soumission désactivé via `submitBtn.textContent = "..."` (l.70-72).
- **Impact :** Dans une même modale, des champs carrés de 36 px côtoient des champs arrondis de 44 px, et le fond reste blanc en mode sombre. L'ensemble paraît bricolé et ne ressemble pas aux autres formulaires de l'application.
- **Recommandation :** Réécrire le formulaire avec les composants UI existants (Input, Textarea, Select, Label, Button), react-hook-form + zod (insertTaskSchema) et un état isPending de useMutation pour le bouton.

### TASKS-18

**Couleurs de priorité, vocabulaire et icônes différents entre desktop et mobile** — coherence-design, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:544`
- **Constat :** Desktop, Tasks.tsx:546-563 : high donne `destructive` (rouge plein), medium `default` (bleu primaire plein), low `secondary` (gris). Mobile, TasksPage.tsx:193-195 : rouge, jaune et vert pâles. Onglets mobiles l.404-420 '⏳ Actives / ✅ Faites / 📋 Toutes' contre desktop 'En cours / Terminées / Toutes'. Badges desktop avec icône lucide et emoji en double : l.934-935 `<startDateStatus.icon /> 📅 {startDateStatus.text}`, l.951-952 `<DueDateIcon /> ⏰`.
- **Impact :** La priorité 'Moyenne' (bleu plein) attire davantage l'œil que 'Faible' et entre en concurrence avec le bouton principal. Un utilisateur qui passe du PC au téléphone ne retrouve ni les couleurs ni les mots.
- **Recommandation :** Créer un module partagé `taskUi.ts` (libellés, couleurs, icônes de priorité et de statut) utilisé par les deux pages : Élevée rouge, Moyenne ambre, Faible gris ou vert. Un seul vocabulaire ('À faire' / 'Terminées'). Une seule icône par badge, sans emoji.

### TASKS-19

**Cartes surchargées : jusqu'à 7 informations redondantes par tâche, avec le rôle technique affiché** — lisibilite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Tasks.tsx:1212`
- **Constat :** Pour une tâche programmée (l.1212-1294) : titre suivi de ' (Programmée)', badge priorité, badge 'Future', '📅 +3j' plus 'Démarre dans 3 jours (05/10/2026)', '⏰ ...', 'Assigné à: Non assigné', 'Créée: 02/10/2026 14:37', et l.1290-1293 `Visible en avance ({user?.role})` qui affiche par exemple 'Visible en avance (directeur)'. Pour une tâche déjà démarrée, l.625-632 affiche un badge '📅 Active' et le texte 'Démarrée (dd/MM/yyyy)' sur chaque carte. Kanban l.1439/1517 : `cursor-pointer` sans onClick.
- **Impact :** L'œil ne trouve pas l'essentiel (quoi, pour quand, qui). La même notion 'programmée' apparaît trois fois, et 'Active' ou 'Créée à HH:mm' n'apportent rien au quotidien. Les cartes Kanban semblent cliquables mais ne réagissent pas.
- **Recommandation :** Garder sur la carte : titre, échéance colorée (seulement si proche ou dépassée), priorité (seulement si Élevée), personne assignée (si renseignée). Pour les tâches programmées, un seul badge 'Visible le 05/10'. Mettre la description et la date de création dans le détail ou la modale. Retirer `cursor-pointer`, ou rendre la carte cliquable pour ouvrir l'édition.

### TASKS-20

**Tâches terminées quasi illisibles (opacité 60 % + gris 400 + texte barré)** — accessibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:1350`
- **Constat :** Tasks.tsx:1350 `<Card key={task.id} className="opacity-60 bg-gray-50">`, l.1355 `text-gray-500 truncate line-through`, l.1365 `<p className="text-sm text-gray-400 mb-2 line-clamp-2 line-through">{task.description}</p>`. Tâches futures, l.1205-1212 : `opacity-75` + `italic text-gray-600`. Mobile, TasksPage.tsx:221 : `opacity-60`.
- **Impact :** Contraste bien inférieur au minimum WCAG de 4,5:1 : la description d'une tâche terminée est pratiquement invisible sur les écrans de magasin. L'opacité appliquée aux boutons (l.997, 1311) donne l'impression qu'ils sont désactivés alors qu'ils fonctionnent.
- **Recommandation :** Ne pas baisser l'opacité de toute la carte : un fond vert très pâle avec une coche 'Terminée' et un texte gray-600 non barré suffisent. Pour les tâches futures, un simple badge 'Programmée', sans italique ni opacité.

### TASKS-21

**Formulaire : assignation en texte libre, magasin implicite (magasin 1 pour un admin) et aucune vérification des dates** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Tasks.tsx:90`
- **Constat :** Tasks.tsx:248-254 : `<input name="assignedTo" type="text" placeholder="Nom de la personne assignée">`. l.80 enregistre la chaîne 'Non assigné' si le champ est vide. l.90 `groupId = selectedStoreId ? parseInt(...) : 1` : en vue 'Tous les magasins', l'admin crée dans le magasin 1 sans aucune indication. Le serveur fait de même (routes.ts:3303-3305). Seul le titre est validé (l.60-67) : on peut saisir une échéance antérieure à la date de début. Le formulaire mobile (TasksPage.tsx:142-160) n'a pas de date de début.
- **Impact :** Les fautes de frappe dans les noms empêchent toute recherche par personne. Des tâches peuvent être créées dans le mauvais magasin. Des incohérences de dates passent sans avertissement, et une tâche programmée ne peut pas être créée depuis un téléphone.
- **Recommandation :** Proposer un champ assigné en liste (utilisateurs du magasin, via un endpoint léger) avec 'Non assigné' comme valeur vide (null). Afficher le magasin cible dans la modale et l'imposer quand selectedStoreId est null. Valider `dueDate >= startDate`. Ajouter la date de début au formulaire mobile.

### TASKS-22

**Erreurs de chargement et absence de magasin affichées comme 'Aucune tâche trouvée avec les filtres sélectionnés'** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:326`
- **Constat :** Tasks.tsx:326 `const { data: tasks = [], isLoading, error } = useQuery(...)` : `error` n'est jamais rendu. l.855-864 et 1176-1185 affichent le même message vide dans tous les cas. Côté serveur, routes.ts:3273 `res.status(500).json([])` et l.3248 `return res.json([])` quand aucun magasin n'est sélectionné. Mobile, TasksPage.tsx:295 ne récupère même pas `error`.
- **Impact :** En cas de panne réseau, d'erreur 500 ou de magasin non choisi, l'utilisateur pense qu'il n'a rien à faire et peut manquer des tâches urgentes.
- **Recommandation :** Distinguer trois états : erreur ('Impossible de charger les tâches', bouton Réessayer → refetch), aucun magasin ('Choisissez un magasin en haut de l'écran') et liste vide réelle (avec un bouton 'Créer une tâche' si l'utilisateur en a le droit). Côté serveur, renvoyer `{ message }` avec le code 500, pas un tableau vide.

### TASKS-23

**Spinner plein écran à chaque changement de magasin, faute de placeholderData et de squelette** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:670`
- **Constat :** Tasks.tsx:670-676 `if (isLoading) { return (<div className="flex-1 flex items-center justify-center"><div className="animate-spin ..."/></div>); }`. La queryKey (l.327) change avec selectedStoreId, sans `placeholderData: keepPreviousData`. Mobile, TasksPage.tsx:362-370 : même comportement.
- **Impact :** Chaque changement de magasin fait disparaître en-tête, filtres et recherche au profit d'un spinner, puis tout réapparaît. La page clignote et paraît plus lente qu'elle ne l'est.
- **Recommandation :** Ajouter `placeholderData: keepPreviousData` (TanStack v5) et un indicateur discret (isFetching) dans l'en-tête. Garder en-tête et filtres affichés et ne remplacer que la liste par 3 à 5 cartes squelette au premier chargement.

### TASKS-24

**Terminer et Supprimer passent par des fetch manuels qui attendent le rechargement complet de la liste avant tout retour visuel** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Tasks.tsx:405`
- **Constat :** Tasks.tsx:405-424 `await fetch(`/api/tasks/${taskId}/complete`, ...); await queryClient.invalidateQueries({ queryKey: ["/api/tasks"] }); toast(...)`. l.440-460 : la modale de suppression ne se ferme qu'après `await queryClient.invalidateQueries(...)`. Aucun état pending, donc les doubles clics sont possibles. Le serveur ne renvoie pas la tâche mise à jour (routes.ts:3478 `res.json({ message: "Task completed successfully" })`).
- **Impact :** Après un clic sur Terminer, rien ne bouge pendant tout le refetch du gros payload (TASKS-01). L'utilisateur reclique, ce qui envoie plusieurs requêtes, et la modale de suppression reste ouverte plusieurs centaines de ms.
- **Recommandation :** Utiliser useMutation avec mise à jour optimiste (`onMutate` : setQueryData pour passer la tâche en completed ou la retirer, rollback en onError), boutons désactivés pendant `isPending`, et fermeture de la modale immédiatement. Côté serveur, renvoyer la tâche mise à jour (`.returning()`) depuis completeTask.

### TASKS-25

**Mobile : 'Tâche terminée' ou 'Tâche supprimée' affiché même quand l'API refuse ou échoue** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/TasksPage.tsx:334`
- **Constat :** TasksPage.tsx:334-341 `await fetch(`/api/tasks/${taskId}/complete`, {...}); queryClient.invalidateQueries(...); toast({ title: "✅ Tâche terminée" });`, sans vérifier `response.ok`. l.350-352, même chose pour DELETE. fetch ne lève pas d'erreur sur 403 ou 500, donc le catch n'est jamais atteint.
- **Impact :** Un employé sans droit (403), ou n'importe qui lors d'une erreur serveur, voit un message de succès alors que rien n'a changé, ce qui le désoriente.
- **Recommandation :** Vérifier `if (!res.ok) throw new Error(...)`, ou utiliser apiRequest (queryClient.ts:10), qui lève déjà une erreur sur les statuts non-OK, et afficher le message d'erreur du serveur.

### TASKS-26

**Mobile : tâches programmées non signalées et 'Terminer' proposé alors que le desktop l'interdit** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/TasksPage.tsx:215`
- **Constat :** La carte TaskCard (TasksPage.tsx:178-279) n'utilise jamais `task.isFutureTask` ni `startDate`. Pour un directeur ou un admin, getTasks renvoie les tâches futures (storage.ts:2295). Desktop : Tasks.tsx:980 `{canEditTasks && !isFuture && (` masque Terminer pour une tâche future. Mobile : l.254 `{!isCompleted && (` l'affiche.
- **Impact :** Sur téléphone, un directeur voit les tâches de la semaine prochaine mêlées à celles du jour et peut les clôturer avant qu'elles ne soient visibles des équipes.
- **Recommandation :** Ajouter un badge 'Programmée le dd/MM' et masquer ou désactiver 'Terminer' pour `isFutureTask`, via le helper partagé de TASKS-18 et TASKS-31.

### TASKS-27

**GET /api/tasks sans limite : tout l'historique des tâches terminées (et tous les magasins pour un admin) à chaque chargement** — perf-api, sévérité moyenne, effort M

- **Fichier :** `server/storage.ts:2301`
- **Constat :** storage.ts:2301 `const results = await query.orderBy(desc(tasks.createdAt));`, sans limit ni filtre de statut ou de date. routes.ts:3205 `groupIds = storeId ? [...] : undefined`, donc un admin en 'Tous les magasins' reçoit toutes les tâches de la base. La pagination est faite côté client (Tasks.tsx:534-542, 10 par page). Le mobile n'en a aucune et rend toute la liste (TasksPage.tsx:434).
- **Impact :** Le volume grandit indéfiniment, car les tâches terminées ne sont jamais purgées. Combiné à TASKS-01, chaque visite télécharge des Mo pour en afficher 10 lignes.
- **Recommandation :** Ajouter des paramètres `status` et `completedSince` (par défaut, tâches en cours + terminées des 30 derniers jours) ou une pagination serveur (`limit`/`offset` + total). Charger les terminées plus anciennes à la demande ('Voir l'historique').

### TASKS-28

**console.log volumineux dans tous les handlers tâches (corps complets, parcours de toute la liste)** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:3252`
- **Constat :** routes.ts:3252-3269 : à chaque GET, `console.log('🔍 Tasks API called with:', ...)` puis `taskGroups: tasks.map(t => ({ id: t.id, title: t.title, groupId: t.groupId })).slice(0, 3)` (map sur toutes les tâches avant le slice). Plus les l.3206, 3220, 3228 et 3242. POST l.3294-3300 `originalBody: req.body, processedData: data`. PUT l.3354-3365 et 3391-3399. storage.ts:2303-2313, 2366-2371, 2382-2387, 2393-2399, 2436-2455. Le serveur de production (index.production.ts) ne neutralise pas console.log.
- **Impact :** Des E/S synchrones sur stdout à chaque requête, des logs Docker qui gonflent (descriptions complètes des tâches) et une allocation O(n) inutile sur le chemin le plus fréquent.
- **Recommandation :** Supprimer ces logs, ou les placer derrière `if (process.env.DEBUG_TASKS)`. Garder seulement les console.error dans les catch, sans réexposer req.body.

### TASKS-29

**Index de la table tasks déclarés dans un fichier SQL jamais exécuté, et absents de schema.ts** — perf-serveur, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/migrations.ts:112`
- **Constat :** migrations/20260814_add_performance_indexes.sql:62-65 `CREATE INDEX IF NOT EXISTS idx_tasks_group_id ON tasks (group_id); ... idx_tasks_group_status ...`. Mais server/migrations.ts:112-114 indique `// Ignorer les fichiers de migrations ... const allMigrations = hardcodedMigrations;`, et ce fichier ne figure pas dans la liste en dur (l.40-89). shared/schema.ts:307-322 ne déclare aucun index sur tasks. Rien ne couvre non plus `ORDER BY created_at DESC` filtré par group_id.
- **Impact :** Selon l'environnement, getTasks fait un parcours complet de la table plus un tri, à chaque appel du Dashboard comme des Tâches. Le coût grandit avec l'historique.
- **Recommandation :** Ajouter `CREATE INDEX IF NOT EXISTS idx_tasks_group_created ON tasks (group_id, created_at DESC); CREATE INDEX IF NOT EXISTS idx_tasks_group_status ON tasks (group_id, status);` dans server/migrations.production.ts (runProductionMigrations), et déclarer les index dans shared/schema.ts (3e argument de pgTable) pour `drizzle-kit push` en dev. À décider : soit supprimer migrations.ts et migrate.js, qui sont morts, soit les rebrancher. Ce DDL s'exécute au démarrage sur la base de production : à valider avant de l'appliquer.

### TASKS-31

**Tasks.tsx (1633 lignes) duplique 6 fois le balisage des cartes et 2 fois les filtres, et le mobile réimplémente tout** — dette-code, sévérité moyenne, effort L

- **Fichier :** `client/src/pages/Tasks.tsx:874`
- **Constat :** Cartes en cours : l.874-1021 (tablette), 1195-1331 (desktop), 1432-1501 (Kanban). Cartes terminées : l.1033-1068, 1343-1399, 1512-1556. Filtres : l.777-846 et 1100-1165. Mobile : TasksPage.tsx a son propre formulaire (l.36-175), sa propre config de priorité (l.191-198) et son propre filtre, avec une recherche limitée au titre (l.318) alors que le desktop cherche aussi dans la description (Tasks.tsx:475-476). Les actions sur les tâches terminées divergent : aucune sur tablette (l.1039-1066), Supprimer seul en liste desktop (l.1385-1394), Modifier + Supprimer en Kanban (l.1532-1551), aucun 'Rouvrir' nulle part. La date affichée est updatedAt sur tablette (l.1062) et completedAt ailleurs (l.1377).
- **Impact :** Chaque correction doit être faite 3 à 6 fois, d'où les bugs ci-dessus qui n'existent que dans une variante. L'utilisateur trouve des actions différentes selon la vue ou l'appareil.
- **Recommandation :** Extraire `useTasks` (query + mutations), `taskUi.ts` (helpers de date et de priorité), `<TaskCard variant>`, `<TaskFilters>` et `<TaskFormDialog>`, utilisés par le desktop et le mobile. Définir un seul jeu d'actions par statut (À faire : Terminer, Modifier, Supprimer ; Terminée : Rouvrir, Supprimer) et toujours afficher completedAt.

### TASKS-32

**Huit composants de formulaire ou de carte de tâche et ResponsiveTasks jamais importés (2030 lignes), dont plusieurs appellent une route PATCH inexistante** — dette-code, sévérité moyenne, effort S

- **Fichier :** `client/src/components/tasks/TaskFormUltraSimple.tsx:38`
- **Constat :** Un grep sur tout le dépôt ne trouve aucun import de NewTaskForm, TaskFormClean, SimpleTaskFormClean, TaskFormProduction, TaskFormUltraSimple, TaskForm, SimpleTaskForm, RecentTasksCard ni ResponsiveTasks (RouterProduction.tsx:24/39 importe directement Tasks et MobileTasksPage). TaskFormUltraSimple.tsx:38 `const method = task ? 'PATCH' : 'POST';` et l.41-42 `groupId = 1; createdBy = 'admin'`. TaskFormClean.tsx:136 et SimpleTaskFormClean.tsx:137 utilisent aussi `"PATCH"`, alors que le serveur n'expose que `app.put('/api/tasks/:id'` (routes.ts:3340). Tasks.tsx:35 commente : `// TaskForm inline pour éviter les problèmes d'import en production`.
- **Impact :** Brouille la lecture : on ne sait pas quel formulaire est le bon. Si quelqu'un en rebranche un, les modifications échoueront (PATCH en 404) et les tâches seront créées dans le magasin 1.
- **Recommandation :** Supprimer client/src/components/tasks/{NewTaskForm,TaskFormClean,SimpleTaskFormClean,TaskFormProduction,TaskFormUltraSimple,TaskForm,SimpleTaskForm,RecentTasksCard}.tsx et client/src/components/ResponsiveTasks.tsx. Recréer ensuite un seul TaskFormDialog (TASKS-31).

### TASKS-30

**PUT, DELETE et complete : contrôle d'accès en lecture préalable avec jointure magasin complète, puis écriture (3 à 4 allers-retours)** — perf-api, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:2348`
- **Constat :** routes.ts:3348, 3433 et 3463 `const task = await storage.getTask(id);` seulement pour lire task.groupId. storage.ts:2349-2356 `select({ task: tasks, group: groups })...leftJoin(groups, ...)` charge logo et config du magasin. Ensuite updateTask, deleteTask ou completeTask font une requête séparée.
- **Impact :** Latence ajoutée à chaque action utilisateur, et le logo du magasin est lu inutilement à chaque clic.
- **Recommandation :** Partie automatisable : supprimer la jointure groups dans DatabaseStorage.getTask (`db.select().from(tasks).where(eq(tasks.id, id))`), car ses seuls appelants (routes.ts:3348, 3433, 3463) n'utilisent pas `group`. La requête conditionnelle unique est à reporter au chantier des permissions (TASKS-13).

### TASKS-33

**console.log de debug dans le rendu et le queryFn, imports et variables inutilisés** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:285`
- **Constat :** Tasks.tsx:285-296 `const isQueryEnabled = ...; console.log('🔍 TASK QUERY ENABLEMENT DEBUG:', {... timestamp: new Date().toISOString() })`, exécuté à chaque rendu et à chaque frappe. isQueryEnabled n'est utilisé nulle part (la query utilise `enabled: !!user`). Autres logs l.301, 335-344, 356-366, 94-100 et 108. Imports inutilisés : l.12 `Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger`. storeInitialized n'est lu que dans des logs.
- **Impact :** Retirés du bundle Docker grâce à esbuild.pure (vite.config.ts:29), mais ils polluent la console en dev et en `npm start`, et nuisent à la lisibilité du code. console.error et console.warn restent actifs en production.
- **Recommandation :** Supprimer seulement les logs, la variable isQueryEnabled, la lecture de storeInitialized et les imports Dialog. Ne pas brancher isQueryEnabled sur `enabled` dans la même passe : cela changerait le comportement de chargement selon le rôle, et relève de TASKS-02/05.

### TASKS-34

**Filtrage et tri recalculés à chaque rendu sans useMemo, et sous-filtres répétés dans le JSX** — perf-client, sévérité basse, effort S

- **Fichier :** `client/src/pages/Tasks.tsx:472`
- **Constat :** Tasks.tsx:472-531 `const filteredTasks = tasks.filter(...).sort(...)` dans le corps du composant, avec `searchTerm.toLowerCase()` recalculé pour chaque tâche et `new Date(...)` dans le comparateur du tri. l.868, 871 et 874 : `paginatedTasks.filter(task => task.status === 'pending')` évalué 3 fois par section, deux fois (tablette et desktop). Kanban l.1429-1432 et 1509-1512 : même chose sur filteredTasks. Mobile, TasksPage.tsx:311-329 : pas de useMemo non plus.
- **Impact :** Avec quelques centaines de tâches (TASKS-27), chaque frappe dans la recherche refait N filtres, un tri en N log N et 12 parcours de liste. Le champ de recherche devient perceptiblement lent sur les PC de magasin.
- **Recommandation :** Envelopper le filtrage et le tri dans `useMemo` (dépendances : tasks, searchTerm, filtres), précalculer `pendingTasks`/`completedTasks` une seule fois, et utiliser `useDeferredValue(searchTerm)` pour la recherche.

### TASKS-35

**Pages Tâches desktop et mobile importées statiquement dans le bundle principal** — perf-bundle, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/components/RouterProduction.tsx:24`
- **Constat :** RouterProduction.tsx:24 `import Tasks from "@/pages/Tasks";` et l.39 `import MobileTasksPage from "@/pages/mobile/TasksPage";`, sans React.lazy. Les deux variantes, ainsi que toutes les autres pages (l.5-44), partent dans le chunk initial, même si un appareil n'en utilise qu'une.
- **Impact :** Le premier chargement télécharge et parse le code des deux versions (environ 2100 lignes rien que pour les tâches) et de toutes les autres pages, ce qui retarde l'affichage du tableau de bord sur mobile.
- **Recommandation :** Passer les pages en lazy avec un `<Suspense fallback={<PageSkeleton/>}>` et un ErrorBoundary qui recharge la page en cas d'échec de chargement d'un chunk. À tester sur un redéploiement réel, à la main et pour toutes les routes à la fois.

### TASKS-36

**Avec server/index.ts (dev et `npm start`), les apostrophes des titres de tâches sont stockées échappées en HTML (&#x27;)** — bug, sévérité basse, effort S

- **Fichier :** `server/security.ts:202`
- **Constat :** server/index.ts:37 `setupInputSanitization(app);`, puis security.ts:310 `req.body = sanitizeInput(req.body);`, puis l.202 `sanitized = validator.escape(sanitized);`. Un titre comme « Ranger l'entrepôt » est stocké « Ranger l&#x27;entrepôt », et React l'affiche tel quel puisqu'il échappe le texte. Le Dockerfile (l.41) compile index.production.ts, qui n'appelle pas ce middleware. En revanche, package.json:9 `start` lance dist/server/index.js, compilé depuis index.ts.
- **Impact :** Selon le mode de démarrage, les titres et descriptions en français (très riches en apostrophes et guillemets) s'affichent avec des entités HTML, et la recherche sur « l'entrepôt » ne trouve plus rien.
- **Recommandation :** Ne pas échapper en HTML à l'entrée (React protège déjà à l'affichage). Limiter le middleware à la suppression des octets nuls, ou l'appliquer seulement aux champs destinés à du HTML (e-mails). Aligner le comportement de index.ts et de index.production.ts.
