# Shell applicatif (navigation, layout, auth, design system)

_30 constats vérifiés — 5 haute, 18 moyenne, 7 basse._

## Pages analysées

### `* (shell desktop ≥768px : Layout + Sidebar, entoure toutes les routes desktop)`

**Rôle :** Cadre commun desktop : menu latéral filtré par rôle, en-tête (météo, date, sélecteur de magasin), zone de contenu des pages, déconnexion, envoi BAP.

**Tâches principales de l'utilisateur :**
- Naviguer entre les modules (19 entrées pour un admin, 8 pour un employé)
- Choisir le magasin actif (admin/directeur/manager)
- Réduire/étendre le menu
- Envoyer un BAP (admin)
- Se déconnecter

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user | au montage de RouterProduction, puis à nouveau au montage de Layout (useAuthUnified), de Sidebar (useAuthSimple) et de chaque page/modale qui appelle useAuthUnified | server/localAuth.ts:204 (handler) + passport.deserializeUser server/localAuth.ts:141 -> storage.getUserWithGroups (server/storage.ts:371) appelé 2 fois = 4 requêtes SQL par appel | fetch manuel cache:'no-cache' sans cache partagé en production : 5 appels au premier affichage du tableau de bord |
| GET /api/groups | au montage de Layout, mais seulement après la résolution du /api/user propre à Layout (enabled: !!user) — cascade | server/routes.ts:970 -> storage.getUserWithGroups (redondant avec req.user) + storage.getGroups (admin) | alimente le sélecteur de magasin et StoreContext.stores |
| GET /api/weather/current | au montage de Layout + polling toutes les 30 min (refetchInterval), retry:1 | server/routes.ts:5671 -> storage.getWeatherSettings, storage.getWeatherData x2, weatherService.fetchCurrentWeather (API externe) si absent du cache | 404 si météo non configurée -> réessayé une fois à chaque chargement |
| POST /api/logout | au clic sur Déconnexion (Sidebar) | server/localAuth.ts:200 logoutHandler (req.logout + session.destroy + redirect /auth) | suivi de window.location.href='/auth' (rechargement complet) |
| GET /api/webhook-bap-config puis POST vers webhook externe | au clic Envoyer BAP | server/routes.ts:186 (config) ; envoi direct navigateur -> https://workflow.ffnancy.fr/... (Sidebar.tsx:121,143) | bloqué par CSP connect-src 'self' quand servi par server/index.ts |

**Lisibilité / simplicité :** Menu dense (19 entrées / 5 sections pour un admin) avec sections déséquilibrées (« ANALYSES » = 1 entrée), libellés ambigus (Commandes vs Commandes Client, Échéance, Rapprochement, BAP), icônes dupliquées (BarChart3 pour Tableau de bord et Statistiques). L'accueil « / » n'active aucune entrée. L'en-tête est occupé par la météo et la date (widgets plus hauts que l'en-tête) au lieu du titre de page ; un employé ne voit jamais son magasin. Chargement en 3 temps (spinner plein écran, puis spinner du menu, puis sélecteur qui apparaît). Deux bleus concurrents, contraste du bouton primaire insuffisant, survol des boutons primaires inopérant, coins carrés dans les composants de base mais arrondis dans les pages, 62 !important dans index.css.

### `* (shell mobile <768px : MobileApp + MobileLayout + MobileBottomNav)`

**Rôle :** Cadre mobile : en-tête compact avec magasin, barre de navigation basse (4 onglets + Plus), panneau latéral profil/magasin/déconnexion.

**Tâches principales de l'utilisateur :**
- Accéder rapidement à Accueil, Commandes, Livraisons, Tâches
- Ouvrir « Plus » pour Calendrier, Publicités, Cmd Client, DLC, SAV, Avoirs
- Changer de magasin et se déconnecter via le menu hamburger

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user | au montage de RouterProduction, MobileApp, MobileLayout, MobileBottomNav et de la page (5 appels) | server/localAuth.ts:204 + deserializeUser server/localAuth.ts:141 -> storage.getUserWithGroups x2 | MobileBottomNav récupère user sans jamais l'utiliser |
| GET /api/groups | au montage de MobileApp après son propre /api/user | server/routes.ts:970 -> storage.getUserWithGroups + storage.getGroups | pas d'invalidation au changement de magasin (contrairement au desktop) |
| POST /api/logout | au clic Déconnexion dans le Sheet | server/localAuth.ts:200 logoutHandler | suivi de window.location.href='/auth' |

**Lisibilité / simplicité :** Navigation mobile incomplète : Contacts, Rapprochement, Échéance, Statistiques et toute l'administration sont inaccessibles ; si on y arrive par URL, la page desktop s'affiche sans en-tête ni barre de navigation (impasse). Le bouton hamburger n'ouvre pas de menu de navigation mais seulement profil/magasin/déconnexion. Les onglets Commandes/Livraisons/Avoirs sont montrés à tous les rôles alors que le desktop les cache aux employés. Libellés de 10 px, rôle affiché en anglais (« Employee »), libellés différents du desktop (Accueil/Tableau de bord, Cmd Client/Commandes Client). Une rotation du téléphone en paysage (≥768px) bascule toute l'application en interface desktop.

### `/auth (et premier chargement : index.html, bundle, bootstrap)`

**Rôle :** Connexion et démarrage de l'application : téléchargement du bundle, vérification de session, redirection vers l'accueil.

**Tâches principales de l'utilisateur :**
- Se connecter
- Arriver sur le tableau de bord (ou la page demandée)

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user | au montage de RouterProduction puis de AuthPage (2 appels 401 pour un visiteur non connecté) | server/localAuth.ts:204 | spinner plein écran bloquant pendant le premier appel |
| GET /api/default-credentials-check | au montage de AuthPage | server/localAuth.ts:234 -> storage.getUserByUsername('admin') | la carte « admin / admin » est affichée par défaut avant la réponse |
| POST /api/login | au clic Se connecter | server/localAuth.ts:153 (passport local) | en production : setTimeout 500 ms puis window.location.href='/' (rechargement complet, URL d'origine perdue) |
| GET /assets/*.js (5 fichiers, 1,72 Mo brut / ~436 Ko gzip) + https://replit.com/public/js/replit-dev-banner.js | chargement initial de la page | server/index.production.ts:143-144 express.static sans maxAge ni compression | toutes les pages et recharts sont téléchargées avant même l'écran de connexion |

**Lisibilité / simplicité :** Premier affichage lent : 1,08 Mo de code applicatif + 410 Ko de recharts préchargés avant l'écran de connexion, script tiers replit.com synchrone qui retarde le démarrage, pas de cache long ni de compression côté Node. Après connexion : attente artificielle de 500 ms puis rechargement complet, la page demandée initialement est perdue. Les identifiants par défaut « admin / admin » clignotent à l'écran pour tout visiteur. Langue du document déclarée en anglais et zoom bloqué.

### `(toute URL inconnue) — page 404`

**Rôle :** Page affichée quand l'URL ne correspond à aucune route.

**Tâches principales de l'utilisateur :**
- Comprendre que la page n'existe pas
- Revenir à l'accueil

**Lisibilité / simplicité :** Message en anglais destiné aux développeurs (« 404 Page Not Found / Did you forget to add the page to the router? »), aucun bouton de retour ; min-h-screen alors que la page est rendue dans la zone de contenu du Layout.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [SHELL-01](#shell-01) | haute | perf-api | M | Chaque composant refait son propre GET /api/user en production (aucun cache partagé) | `client/src/hooks/useAuthUnified.ts:148` |
| [SHELL-02](#shell-02) | haute | bug | S | Le tableau de bord lance ses requêtes avant de connaître le rôle : doublons et données non filtrées en cache | `client/src/pages/Dashboard.tsx:79` |
| [SHELL-03](#shell-03) | haute | perf-bundle | M | Toutes les pages importées statiquement : 1,72 Mo de JS avant l'écran de connexion | `client/src/components/RouterProduction.tsx:7` |
| [SHELL-04](#shell-04) | haute | perf-client | S | Script tiers replit.com synchrone livré en production : retarde le démarrage de l'app | `client/index.html:19` |
| [SHELL-10](#shell-10) | haute | ux-simplicite | M | Mobile : 8 modules inaccessibles et pages desktop affichées sans aucune navigation | `client/src/components/RouterProduction.tsx:117` |
| [SHELL-05](#shell-05) | moyenne | perf-serveur | S | Fichiers statiques servis sans compression ni cache long (le middleware « compression » est factice) | `server/index.production.ts:143` |
| [SHELL-06](#shell-06) | moyenne | perf-client | S | Valeur de StoreContext recréée à chaque rendu + re-rendu global à chaque pixel de redimensionnement | `client/src/components/Layout.tsx:86` |
| [SHELL-07](#shell-07) | moyenne | perf-api | S | Changement de magasin : invalidation par prédicat qui double les requêtes | `client/src/components/Layout.tsx:138` |
| [SHELL-08](#shell-08) | moyenne | perf-api | S | Retry systématique sur 403/404/500 et redirections 401 par rechargement complet | `client/src/lib/queryClient.ts:79` |
| [SHELL-09](#shell-09) | moyenne | ux-simplicite | S | Connexion = attente artificielle de 500 ms + rechargement complet, et la page demandée est perdue | `client/src/pages/AuthPage.tsx:68` |
| [SHELL-11](#shell-11) | moyenne | coherence-design | M | Trois sources de vérité différentes pour « qui voit quel module » | `client/src/components/Sidebar.tsx:247` |
| [SHELL-12](#shell-12) | moyenne | lisibilite | S | Menu : sections déséquilibrées, libellés ambigus, icônes dupliquées, libellés différents du mobile | `client/src/components/Sidebar.tsx:225` |
| [SHELL-14](#shell-14) | moyenne | ux-simplicite | M | En-tête occupé par la météo et la date (qui débordent) au lieu du titre de page et du magasin | `client/src/components/Layout.tsx:106` |
| [SHELL-15](#shell-15) | moyenne | ux-simplicite | S | Directeur/manager multi-magasins : alerte rouge bloquante au lieu d'une présélection ; pastilles couleur invalides | `client/src/components/Layout.tsx:195` |
| [SHELL-16](#shell-16) | moyenne | accessibilite | M | Deux bleus concurrents et bouton primaire au contraste insuffisant (3,1:1) | `client/src/index.css:16` |
| [SHELL-17](#shell-17) | moyenne | bug | S | Les modificateurs d'opacité (hover:bg-primary/90...) ne génèrent aucun CSS : pas de retour visuel au survol | `tailwind.config.ts:44` |
| [SHELL-18](#shell-18) | moyenne | coherence-design | M | Coins incohérents : composants de base carrés, pages et mobile arrondis | `client/src/components/ui/button.tsx:8` |
| [SHELL-19](#shell-19) | moyenne | dette-code | M | index.css : 62 !important et règles globales qui écrasent bordures, focus et couleurs d'anneau | `client/src/index.css:280` |
| [SHELL-20](#shell-20) | moyenne | accessibilite | S | Langue déclarée en anglais et zoom bloqué sur mobile | `client/index.html:2` |
| [SHELL-21](#shell-21) | moyenne | accessibilite | S | Boutons icône sans nom accessible et éléments cliquables non focusables | `client/src/pages/mobile/MobileBottomNav.tsx:86` |
| [SHELL-22](#shell-22) | moyenne | lisibilite | S | Tailles de texte trop petites dans la navigation (10-11 px) | `client/src/pages/mobile/MobileBottomNav.tsx:76` |
| [SHELL-25](#shell-25) | moyenne | ux-simplicite | M | Rotation ou redimensionnement : toute l'application est démontée et remontée ; branches mobiles mortes dans Layout/Sidebar | `client/src/components/RouterProduction.tsx:106` |
| [SHELL-28](#shell-28) | moyenne | bug | S | Les identifiants par défaut « admin / admin » s'affichent par défaut sur l'écran de connexion | `client/src/pages/AuthPage.tsx:25` |
| [SHELL-13](#shell-13) | basse | ux-simplicite | S | Sur l'accueil « / » (page d'arrivée après connexion) aucune entrée du menu n'est active | `client/src/components/Sidebar.tsx:219` |
| [SHELL-23](#shell-23) | basse | lisibilite | S | Page 404 en anglais avec message destiné aux développeurs | `client/src/pages/not-found.tsx:11` |
| [SHELL-24](#shell-24) | basse | lisibilite | S | Rôle affiché en anglais sur mobile, libellé recalculé à la main sur desktop | `client/src/pages/mobile/MobileLayout.tsx:136` |
| [SHELL-26](#shell-26) | basse | dette-code | S | Code mort et dupliqué dans le shell (hooks, nav, fichiers .tmp, scripts publics) | `client/src/components/Sidebar.tsx:394` |
| [SHELL-27](#shell-27) | basse | bug | S | Appel de hook dans une fonction asynchrone (forceAuthRefresh) et comportement dev/prod divergent | `client/src/hooks/useAuthUnified.ts:129` |
| [SHELL-29](#shell-29) | basse | dette-code | M | Fonction métier BAP (≈300 lignes) logée dans le menu, avec destinataires et URL codés en dur | `client/src/components/Sidebar.tsx:794` |
| [SHELL-30](#shell-30) | basse | ux-simplicite | S | Un seul ErrorBoundary global : une erreur dans une page efface aussi le menu | `client/src/App.tsx:10` |

### SHELL-01

**Chaque composant refait son propre GET /api/user en production (aucun cache partagé)** — perf-api, sévérité haute, effort M

- **Fichier :** `client/src/hooks/useAuthUnified.ts:148`
- **Constat :** useAuthUnified.ts:8-11 `const isDevelopment = ... (hostname === 'localhost' || ...replit.dev) && import.meta.env.DEV === true;` -> en prod la branche React Query est désactivée (`enabled: isDevelopment`, l.43) et chaque instance exécute son propre `useEffect(() => { ... fetch('/api/user', { credentials: 'include', cache: 'no-cache' ...` (l.148-167) avec un état local `useState(true)` (l.24). 48 fichiers appellent useAuthUnified() (RouterProduction:56, Layout:22, Dashboard:16, AnnouncementCard:101, MobileApp:16, MobileLayout:22, MobileBottomNav:47, toutes les modales...), et Sidebar.tsx:44 utilise en plus useAuthSimple qui refait le même fetch (useAuthSimple.ts:15). Côté serveur, chaque appel coûte 4 requêtes SQL : deserializeUser server/localAuth.ts:141-143 `storage.getUserWithGroups(id)` puis le handler server/localAuth.ts:211 rappelle `storage.getUserWithGroups(userId)` (getUser + jointure, storage.ts:371-388). Conséquence visible : spinner plein écran (RouterProduction.tsx:79-88), puis spinner du menu (Sidebar.tsx:392-445), puis /api/groups qui attend le /api/user propre au Layout (Layout.tsx:48-51 `enabled: !!user`).
- **Impact :** Premier affichage du tableau de bord desktop = 5 appels /api/user (RouterProduction, Layout, Sidebar, Dashboard, AnnouncementCard) = 20 requêtes SQL rien que pour l'authentification ; mobile = 5 appels ; +1 à chaque changement de page et à chaque ouverture de modale. Cascade de 3 états de chargement successifs et sauts de mise en page.
- **Recommandation :** Hook unique basé sur React Query : `useQuery({ queryKey: ['/api/user'], queryFn: fetchUser /* dédié : 401 → return null, SANS redirection */, staleTime: Infinity, retry: false })`, réexporté par useAuthUnified, useAuthSimple, useAuthProduction, useAuth ; supprimer isDevelopment. Après login : `await queryClient.invalidateQueries({ queryKey: ['/api/user'] })` (ou faire renvoyer `userGroups` par /api/login avant d'utiliser setQueryData). Côté serveur : /api/user et /api/groups utilisent `req.user` (déjà chargé par deserializeUser avec userGroups) au lieu de rappeler getUserWithGroups.

### SHELL-02

**Le tableau de bord lance ses requêtes avant de connaître le rôle : doublons et données non filtrées en cache** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:79`
- **Constat :** Dashboard.tsx:16 `const { user } = useAuthUnified();` vaut null au montage en production (état local du hook). Pourtant les requêtes partent tout de suite sans `enabled` : l.79 `const ordersUrl = `/api/orders${selectedStoreId && user?.role === 'admin' ? `?storeId=${selectedStoreId}` : ''}`` (idem l.80-81) -> la clé change quand user arrive => 2 requêtes, la première sans storeId (tous magasins = la plus lourde). Pour /api/stats/monthly (l.29 clé `['/api/stats/monthly', selectedStoreId]`, filtre l.37 `if (selectedStoreId && user?.role === 'admin')`), /api/stats/yearly (l.62) et /api/tasks (l.285) la clé ne contient pas le rôle : la réponse non filtrée est mise en cache sous la clé du magasin sélectionné.
- **Impact :** Pour un admin avec un magasin sélectionné : statistiques et tâches de TOUS les magasins affichées comme si c'étaient celles du magasin (jusqu'au prochain refetch), et 3 grosses requêtes doublées à chaque arrivée sur le tableau de bord.
- **Recommandation :** Ajouter `enabled: !!user` aux useQuery de Dashboard.tsx (stats/monthly l.29, stats/yearly l.55, orders/deliveries/customer-orders l.84-94, announcements/recent, tasks l.282). L'ajout de `user?.role` dans les queryKey est optionnel. Correction définitive via SHELL-01.

### SHELL-03

**Toutes les pages importées statiquement : 1,72 Mo de JS avant l'écran de connexion** — perf-bundle, sévérité haute, effort M — vérification : partiellement confirmé

- **Fichier :** `client/src/components/RouterProduction.tsx:7`
- **Constat :** RouterProduction.tsx:5-44 : 24 pages desktop + 11 pages mobiles en `import X from "@/pages/..."` ; aucun `lazy(`/`<Suspense` dans client/src. Build actuel (dist/public, construit avec la config vite courante) : index-CCl1yENM.js 1 081 745 o (258 Ko gzip), vendor-charts 410 243 o (110 Ko gzip), vendor-react 146 Ko, vendor-icons 44 Ko, vendor-query 40 Ko, et dist/public/index.html précharge tout : `<link rel="modulepreload" ... href="/assets/vendor-charts-gtSIDI7m.js">`. recharts n'est importé que par pages/Analytics.tsx:14 ; jsbarcode que par pages/CustomerOrders.tsx:33. De plus NocoDBConfig, DatabaseDebug, BackupManager, WeatherSettings sont importés (l.17-18, 22, 27) mais jamais utilisés comme composant de route. (framer-motion, react-icons et xlsx ne sont importés nulle part côté client : pas d'impact bundle.)
- **Impact :** Un employé sur le PC du magasin ou en 4G télécharge et parse ~436 Ko gzip (1,72 Mo brut) — dont les graphiques et le code admin qu'il n'utilisera jamais — avant de voir l'écran de connexion.
- **Recommandation :** 1) Corriger manualChunks pour que vendor-charts ne contienne que recharts/d3/victory (forme fonction : `id.includes('node_modules/recharts') || id.includes('victory-vendor') || id.includes('d3-')`), ou retirer l'entrée vendor-charts, et vérifier dans dist/public/index.html que vendor-charts n'est plus en modulepreload. 2) Puis `lazy(() => import(...))` pour toutes les routes sauf AuthPage/Dashboard (et équivalents mobiles), `<Suspense fallback={<PageSkeleton/>}>` dans la zone de contenu du Layout/MobileLayout. 3) Supprimer les 4 imports inutilisés (sans gain de taille tant qu'Utilities les importe).

### SHELL-04

**Script tiers replit.com synchrone livré en production : retarde le démarrage de l'app** — perf-client, sévérité haute, effort S

- **Fichier :** `client/index.html:19`
- **Constat :** client/index.html:19 `<script type="text/javascript" src="https://replit.com/public/js/replit-dev-banner.js"></script>` est recopié tel quel dans dist/public/index.html. Le bundle est un `<script type="module">` (différé) : il ne s'exécute qu'une fois le parsing terminé, donc après téléchargement + exécution de ce script classique bloquant. L'image Docker lance server/index.production.ts qui n'applique pas setupSecurityHeaders (aucun import, l.1-9) : le script est donc réellement téléchargé depuis replit.com. Avec server/index.ts, la CSP `script-src 'self'` (server/security.ts:115) le bloque et génère une erreur console.
- **Impact :** Chaque chargement dépend d'un serveur tiers : si replit.com est lent ou filtré par le pare-feu du magasin, l'application reste blanche jusqu'au timeout réseau. Fuite de l'IP/URL des utilisateurs vers un tiers.
- **Recommandation :** Supprimer les lignes 18-19 de client/index.html (bannière de dev Replit inutile en production).

### SHELL-10

**Mobile : 8 modules inaccessibles et pages desktop affichées sans aucune navigation** — ux-simplicite, sévérité haute, effort M

- **Fichier :** `client/src/components/RouterProduction.tsx:117`
- **Constat :** RouterProduction.tsx:117-129 monte Contacts, Suppliers, Groups, Users, BLReconciliation, Utilities, Analytics, PaymentSchedulePage directement (« Pages sans version mobile - utiliser version desktop ») : ces pages n'utilisent pas MobileLayout (seules les 11 pages de pages/mobile l'importent) -> ni en-tête, ni barre basse. MobileBottomNav.tsx:29-43 ne propose que Accueil, Commandes, Livraisons, Tâches + Calendrier, Publicités, Cmd Client, DLC, SAV, Avoirs. Le bouton hamburger (MobileLayout.tsx:72 `onClick={() => setMenuOpen(true)}`) ouvre un Sheet qui ne contient que profil, sélecteur de magasin et déconnexion (MobileLayout.tsx:129-185), aucun lien.
- **Impact :** Sur téléphone, un directeur ne peut pas atteindre Rapprochement, Échéance, Statistiques ni Contacts ; s'il y arrive par un lien, il reste bloqué sans menu (seul le bouton retour du navigateur fonctionne). L'icône « menu » trompe l'utilisateur.
- **Recommandation :** Mettre dans le Sheet du hamburger la liste complète des modules filtrée par rôle (même configuration que la Sidebar, cf. SHELL-11) et envelopper les pages desktop rendues sur mobile dans `<MobileLayout title=...>` (ou un wrapper générique dans RouterProduction).

### SHELL-05

**Fichiers statiques servis sans compression ni cache long (le middleware « compression » est factice)** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/index.production.ts:143`
- **Constat :** server/index.production.ts:143-144 `app.use('/assets', express.static(join(publicPath, 'assets'))); app.use('/', express.static(publicPath));` -> maxAge par défaut 0 (revalidation des 6 fichiers à chaque visite / rechargement), aucun middleware de compression (le paquet `compression` n'est pas dans package.json). server/cache.ts:92-100 `setupCompression` pose `Content-Encoding: gzip` sans compresser (et n'est appelé nulle part). La compression dépend donc d'un nginx externe (réseau `nginx_default` dans docker-compose.yml:66) dont la config n'est pas versionnée.
- **Impact :** Sans nginx compressant, 1,72 Mo transférés au lieu de ~436 Ko ; dans tous les cas, 6 allers-retours 304 à chaque rechargement complet (et l'app en fait beaucoup, cf. SHELL-09).
- **Recommandation :** Partie automatisable : `/assets` servi avec `express.static(..., { maxAge: '1y', immutable: true })` ; index.html (express.static racine et les deux res.sendFile l.147-169) avec `Cache-Control: no-cache` ; supprimer setupCompression (code mort). Ajout de `compression()` : à décider séparément (nouvelle dépendance, vérifier d'abord si nginx compresse déjà).

### SHELL-06

**Valeur de StoreContext recréée à chaque rendu + re-rendu global à chaque pixel de redimensionnement** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/components/Layout.tsx:86`
- **Constat :** Layout.tsx:86 `<StoreProvider value={{ selectedStoreId, setSelectedStoreId, stores, sidebarCollapsed, ... }}>` (objet littéral) ; MobileApp.tsx:55-64 `const storeContextValue = { ... }` sans useMemo. 35 composants consomment useStore(). use-screen-size.ts:35 `setDimensions({ width, height })` sur chaque événement resize (l.43) et le hook est utilisé par RouterProduction:57, Layout:26 et Sidebar:48 ; Layout et Sidebar ajoutent useIsMobile (matchMedia). Tout changement d'état UI (repli du menu, ouverture du menu mobile) re-rend aussi tous les consommateurs du magasin.
- **Impact :** Redimensionner la fenêtre, replier le menu ou ouvrir un menu re-rend l'arbre complet (Layout + page + toutes les cartes), ce qui rend l'interface saccadée sur les PC de caisse peu puissants.
- **Recommandation :** Automatisable : useMemo sur la valeur du contexte dans Layout et MobileApp avec une constante module `EMPTY_STORES: Group[] = []` comme défaut ; useScreenSize réécrit pour ne stocker que le palier, initialisé de façon synchrone depuis window.innerWidth, avec mise à jour seulement si le palier change ; supprimer use-phone-mode.ts dans le même changement (ou conserver un `dimensions` non stocké en state). Hors auto : séparation du contexte UI.

### SHELL-07

**Changement de magasin : invalidation par prédicat qui double les requêtes** — perf-api, sévérité moyenne, effort S

- **Fichier :** `client/src/components/Layout.tsx:138`
- **Constat :** Layout.tsx:138-146 `queryClient.invalidateQueries({ predicate: (query) => ... includes('/api/orders') || includes('/api/deliveries') || includes('/api/stats/monthly') || includes('/api/tasks') })` est appelé AVANT `setSelectedStoreId(newStoreId)` (l.154). Les requêtes actives portent encore l'ancien storeId (ex. Dashboard.tsx:85 `queryKey: [ordersUrl, selectedStoreId]`) : elles sont refetchées pour l'ancien magasin, puis les nouvelles clés (qui contiennent déjà selectedStoreId) sont chargées. Dashboard.tsx:23-26 invalide aussi `/api/dlc-products` et `/api/dlc-products/stats` à chaque montage. Le mobile (MobileLayout.tsx:40-48) n'invalide rien : comportements divergents.
- **Impact :** Chaque changement de magasin déclenche 2 vagues de requêtes (ancienne + nouvelle), dont une inutile ; chaque retour sur le tableau de bord recharge les DLC même si les données ont 2 secondes.
- **Recommandation :** Automatisable : supprimer l'invalidation par prédicat de Layout.tsx:138-146 et le useEffect Dashboard.tsx:23-26. Hors auto : centraliser `changeStore()` dans StoreContext (desktop et mobile), qui est un refactor.

### SHELL-08

**Retry systématique sur 403/404/500 et redirections 401 par rechargement complet** — perf-api, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/lib/queryClient.ts:79`
- **Constat :** queryClient.ts:79-89 `retry: (failureCount, error) => { if (...'401'...) { window.location.href = '/auth'; return false; } return failureCount < 2; }` -> toute erreur non-401 (403 droit refusé, 404, 500) est retentée 2 fois avec backoff (1 s puis 2 s). getQueryFn l.58-61 fait aussi `window.location.href = '/auth'` sur 401 : avec 10 requêtes actives, 10 redirections concurrentes. WeatherWidget.tsx:121-125 force `retry: 1` sur un endpoint qui répond 404 quand la météo n'est pas configurée (routes.ts:5675-5677).
- **Impact :** Une erreur met ~3 s à s'afficher et coûte 3 requêtes au serveur ; un manager sans droit sur une ressource voit un chargement prolongé au lieu d'un message clair ; une session expirée provoque un rechargement brutal de la page.
- **Recommandation :** Automatisable : `retry: (n, err) => { if (/^401\b/.test(err?.message) || err?.message?.includes('Unauthorized')) { /* conserver la redirection existante */ return false; } if (/^4\d\d\b/.test(err?.message)) return false; return n < 1; }` et `retry: false` dans WeatherWidget. La gestion unifiée du 401 (setQueryData + navigation wouter unique) est à faire avec SHELL-01.

### SHELL-09

**Connexion = attente artificielle de 500 ms + rechargement complet, et la page demandée est perdue** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/AuthPage.tsx:68`
- **Constat :** AuthPage.tsx:68-71 `setTimeout(() => { window.location.href = "/"; }, 500);` après un login réussi. RouterProduction.tsx:47-53 `RedirectToAuth` envoie toute URL vers /auth sans mémoriser l'URL d'origine. RouterProduction.tsx:135 (`window.location.href = '/dashboard'`) et l.185 (`window.location.href = '/'`) déclenchent un rechargement complet pendant le rendu. Layout.tsx:81-83 `handleLogout` (GET /api/logout) n'est jamais utilisé.
- **Impact :** Un employé qui ouvre un lien (ex. /dlc reçu par message) doit se connecter puis renaviguer manuellement ; chaque connexion recharge tout le bundle et relance les 5 appels /api/user (SHELL-01).
- **Recommandation :** Après SHELL-01 : RedirectToAuth ajoute `?next=` (encodeURIComponent du chemin courant) ; après login : `await queryClient.invalidateQueries({ queryKey: ['/api/user'] })` puis `setLocation(next)` seulement si `next` commence par '/' et pas par '//' (sinon '/'). Remplacer les `window.location.href` du rendu par `<Redirect to="/" />`. Supprimer Layout.handleLogout.

### SHELL-11

**Trois sources de vérité différentes pour « qui voit quel module »** — coherence-design, sévérité moyenne, effort M

- **Fichier :** `client/src/components/Sidebar.tsx:247`
- **Constat :** Sidebar.tsx:247-256 Commandes/Livraisons `roles: ["admin", "directeur", "manager"]` (rôles codés en dur) ; MobileBottomNav.tsx:29-43 montre Commandes, Livraisons et Avoirs à tout le monde (`const { user } = useAuthUnified();` l.47 n'est jamais utilisé) ; lib/permissions.ts:38-51 déclare `employee: ['view']` pour orders et deliveries, mais n'est pas utilisé par la navigation. Aucune route n'est protégée : RouterProduction.tsx:158-159 rend /users et /groups pour tout rôle authentifié (seules certaines actions sont désactivées dans les pages, ex. Users.tsx:71 `enabled: user?.role === 'admin'`).
- **Impact :** Un employé voit « Commandes » sur son téléphone mais pas sur le PC ; il peut ouvrir /users par URL et tomber sur une page vide ou partielle. Toute évolution de droits doit être faite à 3 endroits.
- **Recommandation :** Créer NAV_ITEMS unique (path, label, icon, module) partagé par Sidebar, MobileBottomNav et le Sheet mobile, filtré par hasModuleAccess après avoir étendu le type Module et la table PERMISSIONS aux modules manquants ; ajouter `<ProtectedRoute module=...>` avec un message « Accès non autorisé ». Décision produit préalable : l'employé voit-il Commandes/Livraisons/Avoirs ?

### SHELL-12

**Menu : sections déséquilibrées, libellés ambigus, icônes dupliquées, libellés différents du mobile** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/components/Sidebar.tsx:225`
- **Constat :** Sidebar.tsx:225-364 : 19 entrées en 5 sections pour un admin (« GESTION PRINCIPALE » 2 entrées, « ANALYSES » 1 seule entrée l.279-287). Libellés : « Commandes » (l.248) vs « Commandes Client » (l.300), « Échéance » (l.266), « Rapprochement » (l.260), « BAP » (l.359). Même icône BarChart3 pour Tableau de bord (l.232) et Statistiques (l.284) ; « Magasins » avec l'icône Users (l.348) alors que Store sert de logo. Mobile (MobileBottomNav.tsx:30-42) : « Accueil », « Cmd Client », « DLC », icône CheckSquare pour Tâches vs ListTodo sur desktop (l.312).
- **Impact :** Un employé non technicien ne distingue pas commandes fournisseurs et commandes clients ; « Échéance » et « BAP » sont du jargon comptable ; deux icônes identiques ralentissent le repérage ; changer d'appareil oblige à réapprendre les noms.
- **Recommandation :** Regrouper en 3-4 sections métier : « Au quotidien » (Accueil, Tâches, DLC, Commandes clients, SAV), « Fournisseurs » (Commandes fournisseurs, Livraisons, Rapprochement BL / Factures, Avoirs, Échéancier), « Magasin » (Calendrier, Publicités, Contacts, Statistiques), « Administration ». Icônes uniques (LayoutDashboard, LineChart, Store). Mêmes libellés sur mobile via la config partagée de SHELL-11.

### SHELL-14

**En-tête occupé par la météo et la date (qui débordent) au lieu du titre de page et du magasin** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/components/Layout.tsx:106`
- **Constat :** Layout.tsx:106 `<header className={`h-16 ...`}>` (64 px) contient WeatherWidget et DateWidget (l.123-127). WeatherWidget.tsx:157 `<CardContent className="p-4 min-h-[80px]">` : 80 px minimum dans un en-tête de 64 px -> débordement. DateWidget.tsx:19 et WeatherWidget.tsx:156 `shadow-lg hover:shadow-xl transition-all` sur des éléments non cliquables. Le sélecteur de magasin n'est rendu que pour admin/directeur/manager (l.131) : un employé ne voit son magasin nulle part. Aucun titre de page dans l'en-tête ; les pages utilisent des h2 (Orders.tsx:236, Dashboard.tsx:395) et le titre d'onglet ne change jamais.
- **Impact :** La zone la plus visible de l'écran n'indique ni la page courante ni le magasin ; le widget météo (3 colonnes de températures) chevauche le contenu ; l'ombre au survol fait croire à un bouton.
- **Recommandation :** En-tête = titre de la page courante (h1, dérivé de la config de navigation) + badge du magasin (lecture seule pour les employés) + météo compacte (icône + température, détail en infobulle). Retirer les ombres hover des widgets. Mettre à jour document.title par route.

### SHELL-15

**Directeur/manager multi-magasins : alerte rouge bloquante au lieu d'une présélection ; pastilles couleur invalides** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/components/Layout.tsx:195`
- **Constat :** Layout.tsx:70-74 ne présélectionne un magasin que si `stores.length === 1` ; sinon l.195-208 affiche un bandeau rouge « Action requise : Veuillez sélectionner un magasin pour afficher les données. Vos permissions ne permettent pas... » pendant que le sélecteur affiche juste « Magasin » (l.161). Pastille : `style={{ backgroundColor: store.color || '#gray-400' }}` (l.180) et `'#gray'` (MobileLayout.tsx:166) sont des couleurs CSS invalides. Noms tronqués à `max-w-[120px]` (l.182) dans un sélecteur de 256 px (`w-64`, l.159).
- **Impact :** À chaque nouvelle session sur un poste partagé, le directeur tombe sur un écran d'erreur rouge et des pages vides ; les magasins sans couleur n'ont pas de pastille ; les noms longs sont coupés sans raison.
- **Recommandation :** Présélectionner le dernier magasin utilisé ou le premier magasin assigné pour directeur/manager et supprimer le bandeau. Remplacer les fallbacks par `'#9ca3af'`. Retirer `max-w-[120px]` sur desktop.

### SHELL-16

**Deux bleus concurrents et bouton primaire au contraste insuffisant (3,1:1)** — accessibilite, sévérité moyenne, effort M

- **Fichier :** `client/src/index.css:16`
- **Constat :** index.css:16 `--primary: hsl(207, 90%, 54%);` (= #2094F3) utilisé par le bouton shadcn par défaut (button.tsx:12 `bg-primary text-primary-foreground`), alors que le reste de l'interface code en dur blue-600 #2563eb : 26 `bg-blue-600`, 124 `text-blue-600/700` contre 30 `bg-primary` et 11 `text-primary` ; index.html:13 et manifest.json `theme-color #2563EB` ; focus forcé `#2563eb !important` (index.css:321, 342). Contrastes calculés (WCAG) : texte blanc sur --primary = 3,1:1 ; --destructive hsl(0,84%,60%) = 3,6:1 ; --accent = 2,5:1 (minimum AA texte 14 px : 4,5:1). blue-600 sur blanc = 5,17:1.
- **Impact :** Les boutons d'action principaux (« Enregistrer », « Créer ») sont peu lisibles, surtout sur les écrans de magasin en plein jour ; deux bleus différents côte à côte donnent une impression de désordre.
- **Recommandation :** Aligner le token sur blue-600 : `--primary: hsl(221, 83%, 53%)` (contraste 5,17:1) et assombrir --destructive (ex. red-600 hsl(0,72%,51%)). Remplacer progressivement les `bg-blue-600`/`text-blue-600` en dur par `bg-primary`/`text-primary`.

### SHELL-17

**Les modificateurs d'opacité (hover:bg-primary/90...) ne génèrent aucun CSS : pas de retour visuel au survol** — bug, sévérité moyenne, effort S

- **Fichier :** `tailwind.config.ts:44`
- **Constat :** tailwind.config.ts:43-46 `primary: { DEFAULT: "var(--primary)", ... }` sans `<alpha-value>`, et index.css:16 définit le token comme couleur complète `hsl(207, 90%, 54%)`. Tailwind 3.4.17 ne peut alors pas appliquer d'opacité : vérifié en compilant `bg-primary/90 hover:bg-primary/90` -> seule `.bg-primary{background-color:var(--primary)}` est émise ; le CSS de production dist/public/assets/index-8CW9ARss.css ne contient aucune règle `bg-primary\/90` ni `bg-destructive\/90`. Utilisé par button.tsx:12 (`hover:bg-primary/90`) et l.14 (`hover:bg-destructive/90`), toast.tsx:78 (`text-foreground/50`).
- **Impact :** Les boutons principaux et de suppression ne réagissent pas au survol : l'utilisateur n'a aucun indice qu'ils sont cliquables.
- **Recommandation :** Passer les tokens au format canaux (`--primary: 221 83% 53%;`) et `hsl(var(--primary) / <alpha-value>)` dans tailwind.config.ts pour tous les tokens ; dans le même changement, supprimer ou convertir en `hsl(var(--x))` toutes les utilisations directes de `var(--primary|secondary|accent|...)` (index.css:112-221 notamment), puis vérifier visuellement boutons, toasts et dialogues.

### SHELL-18

**Coins incohérents : composants de base carrés, pages et mobile arrondis** — coherence-design, sévérité moyenne, effort M

- **Fichier :** `client/src/components/ui/button.tsx:8`
- **Constat :** Les primitives shadcn ont perdu leur arrondi : button.tsx:8 (aucun `rounded-md`), card.tsx:12 `"border bg-white text-card-foreground shadow-sm"`, input.tsx:10 (pas de rounded), dialog.tsx:41 `... rounded-none`, alors que index.css:25 définit `--radius: 0.5rem` et que les pages utilisent `rounded-lg` 101 fois et `rounded-xl/2xl` 10 fois. Dans le shell : avatar carré (Sidebar.tsx:875 `h-8 w-8 bg-gray-100`) vs entrées de menu `rounded-md` (Sidebar.tsx:595) ; pastille magasin carrée sur desktop (Layout.tsx:178 `w-3 h-3`) mais ronde sur mobile (MobileLayout.tsx:165 `rounded-full`).
- **Impact :** L'interface paraît assemblée de pièces disparates, ce qui nuit à la lisibilité et à la confiance des utilisateurs.
- **Recommandation :** Choisir une règle (recommandé : `rounded-md` partout, `rounded-full` pour pastilles/avatars) ; la rétablir dans button, card, input, select, dialog, puis retirer les arrondis ad hoc des pages.

### SHELL-19

**index.css : 62 !important et règles globales qui écrasent bordures, focus et couleurs d'anneau** — dette-code, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `client/src/index.css:280`
- **Constat :** index.css:280-286 `.bg-blue-600 { border: none !important; outline: none !important; box-shadow: none !important; --tw-ring-color: transparent !important; ... }` supprime bordure et anneau de focus de tout élément bleu ; l.341-343 `* { --tw-ring-color: #2563eb !important; }` force tous les anneaux en bleu (ex. `focus:ring-red-400` de toast.tsx:78 ignoré) ; l.156-164 `html, body { overflow: hidden !important; } #root { overflow: hidden !important; }` ; propriété inexistante `ring: 0 !important;` (l.233, 246, 258) ; ~120 lignes (l.224-349) de surcharges répétées du calendrier ; `.layout-container { transition: all 0.3s }` (l.439-441) ; bloc `.phone-mode` (l.411-498) jamais utilisé (0 occurrence de `phone-mode` dans les .tsx).
- **Impact :** Les navigations au clavier perdent des repères de focus, les états d'erreur rouges deviennent bleus, et chaque correction visuelle future nécessite un nouvel !important.
- **Recommandation :** Supprimer d'abord le code mort sans effet visible (bloc .phone-mode, `ring: 0`) ; puis, avec vérification visuelle (calendrier, boutons bleus, toasts), retirer `.bg-blue-600 {...}` et `* { --tw-ring-color }` au profit du token `--ring` et de la prop `classNames` de components/ui/calendar.tsx.

### SHELL-20

**Langue déclarée en anglais et zoom bloqué sur mobile** — accessibilite, sévérité moyenne, effort S

- **Fichier :** `client/index.html:2`
- **Constat :** client/index.html:2 `<html lang="en">` alors que toute l'interface est en français ; l.5 `<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />` empêche le zoom par pincement (WCAG 1.4.4).
- **Impact :** Les lecteurs d'écran prononcent le français avec une voix anglaise ; un employé qui a du mal à lire les textes de 10-12 px sur téléphone ne peut pas zoomer.
- **Recommandation :** Automatisable : `<html lang="fr">` uniquement. Retirer `maximum-scale=1` seulement après avoir mis tous les champs saisissables mobiles à au moins 16 px (TasksPage.tsx:392, TaskFormUltraSimple.tsx).

### SHELL-21

**Boutons icône sans nom accessible et éléments cliquables non focusables** — accessibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/MobileBottomNav.tsx:86`
- **Constat :** MobileBottomNav.tsx:86-97 le bouton « Plus » est un `<div ... onClick={() => setMoreOpen(true)}>` (non atteignable au clavier, pas de rôle bouton) ; Sidebar.tsx:652-664 l'entrée BAP est un `<div ... onClick={() => { setShowBapModal(true); ...}}>` ; boutons icône seule sans aria-label ni title : repli du menu Sidebar.tsx:544-555 (Chevron seul), hamburger Layout.tsx:111-119, hamburger MobileLayout.tsx:69-76.
- **Impact :** Navigation clavier et lecteur d'écran impossibles sur ces commandes ; au survol, le bouton de repli ne dit pas ce qu'il fait.
- **Recommandation :** Remplacer les div cliquables par `<button type="button">` (ajouter `w-full text-left` sur l'entrée BAP de la Sidebar) ; ajouter `aria-label` + `title` (« Réduire le menu »/« Déplier le menu » selon l'état, « Ouvrir le menu », « Plus de pages », « Envoyer un BAP »).

### SHELL-22

**Tailles de texte trop petites dans la navigation (10-11 px)** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/MobileBottomNav.tsx:76`
- **Constat :** MobileBottomNav.tsx:76 et 93 `text-[10px]` pour les libellés de la barre basse ; Sidebar.tsx:572 et 637 `text-[11px] font-bold text-gray-500 uppercase tracking-widest` pour les titres de section ; MobileLayout.tsx:89 nom du magasin en `text-xs` tronqué à `max-w-[80px]` ; `text-xs` (12 px) utilisé 301 fois dans client/src.
- **Impact :** Public non technicien, souvent debout en magasin : libellés difficiles à lire, nom du magasin actif illisible sur mobile.
- **Recommandation :** Minimum 12 px (`text-xs`) pour les libellés de la barre basse, titres de section en `text-xs font-semibold` sans majuscules forcées, nom du magasin en `text-sm` avec `max-w-[140px]`. Fixer 14 px comme taille de corps minimale pour les données.

### SHELL-25

**Rotation ou redimensionnement : toute l'application est démontée et remontée ; branches mobiles mortes dans Layout/Sidebar** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/components/RouterProduction.tsx:106`
- **Constat :** RouterProduction.tsx:57 `const { isMobile } = useScreenSize();` puis l.106 `if (isMobile) return <MobileApp>...` sinon `<Layout>` : passer le seuil de 768 px (téléphone en paysage ≈ 844 px, fenêtre réduite) remplace un arbre par l'autre (perte des formulaires en cours, 5 nouveaux /api/user, rechargement des données). use-screen-size.ts:18 `useState<ScreenSize>('desktop')` : premier rendu toujours « desktop » avant correction (saut de mise en page sur tablette). Trois systèmes de points de rupture : useIsMobile (<768, matchMedia), useScreenSize (768/1024), use-phone-mode (<400, inutilisé). Layout n'étant rendu que si !isMobile, les branches mobiles de Layout (overlay l.89-94, hamburger l.110-120, init repliée l.40) et de Sidebar (tiroir l.374-377) sont inatteignables.
- **Impact :** Un employé qui tourne son téléphone en saisissant une DLC perd sa saisie et voit l'interface changer complètement (menu latéral desktop sur petit écran).
- **Recommandation :** Décider desktop/mobile une seule fois au démarrage (largeur + `matchMedia('(pointer: coarse)')`) ou au minimum avec hystérésis ; initialiser l'état de façon synchrone depuis window.innerWidth ; supprimer useIsMobile du shell et les branches mobiles mortes de Layout/Sidebar.

### SHELL-28

**Les identifiants par défaut « admin / admin » s'affichent par défaut sur l'écran de connexion** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/AuthPage.tsx:25`
- **Constat :** AuthPage.tsx:25 `const [showDefaultCredentials, setShowDefaultCredentials] = useState(true);` ; la carte l.256-271 affiche « Identifiant : admin / Mot de passe : admin » tant que /api/default-credentials-check n'a pas répondu, et l.38-41 renvoie `{ showDefault: true }` en cas d'erreur réseau.
- **Impact :** Tout visiteur voit brièvement (ou durablement si l'appel échoue) des identifiants administrateur, ce qui est déroutant pour les employés et constitue un risque si le mot de passe n'a pas été changé.
- **Recommandation :** Initialiser à `false` et ne montrer la carte que si la réponse vaut explicitement `showDefault === true` ; en cas d'erreur, ne rien afficher.

### SHELL-13

**Sur l'accueil « / » (page d'arrivée après connexion) aucune entrée du menu n'est active** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/components/Sidebar.tsx:219`
- **Constat :** Sidebar.tsx:219-223 `const isActive = (path) => { if (path === "/" && location === "/") return true; if (path !== "/" && location.startsWith(path)) return true; ... }` mais aucune entrée n'a le chemin « / » : « Tableau de bord » pointe vers /dashboard (l.230). La connexion redirige vers « / » (AuthPage.tsx:70) et RouterProduction.tsx:153 et 191 servent la même page sous deux URLs. Le mobile gère le cas (MobileBottomNav.tsx:51 `if (path === "/dashboard" && (location === "/" || location === "/dashboard"))`).
- **Impact :** Juste après la connexion, l'utilisateur ne sait pas où il se trouve dans le menu.
- **Recommandation :** Dans Sidebar.isActive, ajouter `if (path === "/dashboard" && (location === "/" || location === "/dashboard")) return true;` (même logique que le mobile) ; ne pas changer les URLs.

### SHELL-23

**Page 404 en anglais avec message destiné aux développeurs** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/not-found.tsx:11`
- **Constat :** not-found.tsx:11 `<h1 ...>404 Page Not Found</h1>` et l.14-15 `Did you forget to add the page to the router?` ; aucun bouton de retour ; `min-h-screen` (l.6) alors que la page est rendue dans la zone de contenu du Layout (RouterProduction.tsx:192).
- **Impact :** Un employé qui suit un ancien lien voit un message incompréhensible et ne sait pas comment revenir.
- **Recommandation :** « Page introuvable — Cette page n'existe pas ou a été déplacée » + bouton « Retour à l'accueil » (`<Link href="/">`) ; remplacer `min-h-screen` par `py-16`.

### SHELL-24

**Rôle affiché en anglais sur mobile, libellé recalculé à la main sur desktop** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/mobile/MobileLayout.tsx:136`
- **Constat :** MobileLayout.tsx:136 `<p className="text-sm text-gray-500 capitalize">{user.role}</p>` affiche « Employee », « Admin » ; Sidebar.tsx:885-887 recalcule en ternaires `user?.role === 'admin' ? 'Administrateur' : ...` alors que lib/roleUtils.ts:24 fournit `getRoleDisplayName()`.
- **Impact :** Incohérence de langue et de libellé entre PC et téléphone.
- **Recommandation :** Utiliser `getRoleDisplayName(user.role ?? 'employee')` dans MobileLayout.tsx:136 (retirer `capitalize`) et Sidebar.tsx:885-887.

### SHELL-26

**Code mort et dupliqué dans le shell (hooks, nav, fichiers .tmp, scripts publics)** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/components/Sidebar.tsx:394`
- **Constat :** Jamais importés : hooks/useAuth.ts, hooks/useAuthProduction.ts, hooks/use-phone-mode.ts, components/PhoneBottomNav.tsx, components/ToasterRobust.tsx + hooks/use-toast-robust.ts, components/Responsive{Dashboard,Orders,Deliveries,Tasks,Calendar}.tsx (≈578 lignes au total). 36 fichiers `*.tsx.tmp` versionnés dans components/ui. client/public/nocodb-protection-patch.js et nocodb-urgent-fix.js ne sont référencés nulle part mais copiés dans dist/public et servis publiquement (ils remplacent console.error pour masquer les erreurs). En-tête de la Sidebar dupliqué 3 fois (Sidebar.tsx:394-443, 450-501, 514-558).
- **Impact :** Maintenance plus lente et risques de corriger le mauvais fichier ; les scripts publics peuvent masquer des erreurs si quelqu'un les rebranche.
- **Recommandation :** Supprimer ces fichiers ; extraire l'en-tête de la Sidebar dans un composant `SidebarHeader` réutilisé par les 3 états.

### SHELL-27

**Appel de hook dans une fonction asynchrone (forceAuthRefresh) et comportement dev/prod divergent** — bug, sévérité basse, effort S

- **Fichier :** `client/src/hooks/useAuthUnified.ts:129`
- **Constat :** useAuthUnified.ts:124-130 dans `forceAuthRefresh` (fonction async appelée depuis AuthPage.tsx:112 après login) : `const queryClient = useQueryClient(); queryClient.invalidateQueries(...)` -> violation des règles des hooks (« Invalid hook call » hors rendu). Par ailleurs l.8-11 la détection `isDevelopment` fait tourner React Query en dev (1 seul appel partagé) et des fetch indépendants en prod : les bugs SHELL-01/02 sont invisibles en local.
- **Impact :** Connexion potentiellement cassée en développement ; les problèmes de performance et de données non filtrées ne sont reproductibles qu'en production.
- **Recommandation :** Importer `queryClient` depuis @/lib/queryClient au lieu d'appeler le hook ; à terme, une seule implémentation identique dev/prod (SHELL-01).

### SHELL-29

**Fonction métier BAP (≈300 lignes) logée dans le menu, avec destinataires et URL codés en dur** — dette-code, sévérité basse, effort M

- **Fichier :** `client/src/components/Sidebar.tsx:794`
- **Constat :** Sidebar.tsx:49-187 et 712-868 : état, upload et deux modales BAP dans le composant de navigation ; destinataires figés `<SelectItem value="Laurie">` (l.794) et `<SelectItem value="Jeremy">` (l.802) ; URL de secours codée en dur l.121 `https://workflow.ffnancy.fr/webhook/...` ; envoi direct navigateur -> webhook externe (l.143), bloqué par la CSP `connect-src 'self'` (server/security.ts:117) quand l'app est servie par server/index.ts ; texte « Ou glissez-déposez votre fichier » (l.740) sans aucun gestionnaire onDrop.
- **Impact :** Le menu devient lourd à maintenir ; ajouter un destinataire nécessite un déploiement ; le glisser-déposer annoncé ne fonctionne pas.
- **Recommandation :** Extraire dans components/modals/BapSendModal.tsx chargé à la demande ; faire passer l'envoi par une route serveur (proxy vers le webhook) ; ajouter un champ destinataires à la config webhook BAP (migration de schéma) avant de retirer Laurie et Jeremy du code ; ajouter onDrop/onDragOver ou retirer la mention glisser-déposer.

### SHELL-30

**Un seul ErrorBoundary global : une erreur dans une page efface aussi le menu** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/App.tsx:10`
- **Constat :** App.tsx:10-17 `<ErrorBoundary>` enveloppe tout l'arbre (QueryClientProvider, RouterProduction, Layout). ErrorBoundary.tsx:39 affiche un écran plein (`min-h-screen`) avec un bouton « Réessayer » qui ne fait que `setState({ hasError: false })` (l.27-29) — la même erreur se reproduit immédiatement ; aucun lien vers l'accueil.
- **Impact :** Une erreur dans une seule carte du tableau de bord bloque toute l'application ; l'utilisateur doit recharger la page à la main.
- **Recommandation :** Ajouter un ErrorBoundary par route à l'intérieur de la zone de contenu du Layout/MobileLayout (réinitialisé au changement d'URL via `key={location}`), avec boutons « Réessayer » et « Retour à l'accueil » ; garder le global en dernier recours.
