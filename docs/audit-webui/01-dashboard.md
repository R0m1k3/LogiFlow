# Tableau de bord

_46 constats vérifiés — 9 haute, 23 moyenne, 14 basse._

## Pages analysées

### `/ et /dashboard (desktop, largeur >= 768px)`

**Rôle :** Page d'accueil après connexion. Elle donne une vue d'ensemble du magasin : alertes DLC, 4 compteurs (livraisons du mois, commandes en attente, délai moyen, palettes), commandes en attente, livraisons prévues, publicités à venir, informations internes et tâches à faire.

**Tâches principales de l'utilisateur :**
- Voir ce qu'il faut traiter aujourd'hui (produits DLC expirés ou proches, commandes en retard, livraisons attendues)
- Lire les informations / annonces publiées par l'administration
- (Admin) créer, modifier ou supprimer une information
- Marquer un produit DLC comme 'stock épuisé' depuis la fenêtre d'alerte, ou reporter l'alerte de 2 h
- Consulter les tâches ouvertes du magasin

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user (x5 : RouterProduction, Layout, Sidebar via useAuthSimple, Dashboard, AnnouncementCard) | au montage de chaque composant (fetch dans un useEffect, cache: 'no-cache', non partagé) | server/localAuth.ts:204 (dev) / server/localAuth.production.ts:246 ; req.user vient de deserializeUser -> storage.getUserWithGroups (storage.ts:371) | 5 appels identiques. En production, chaque instance démarre avec user=null, ce qui fausse les requêtes du Dashboard lancées au montage. |
| GET /api/groups | au montage du Layout (enabled: !!user) | server/routes.ts:970 -> storage.getUserWithGroups + storage.getGroups (storage.ts:432) | Renvoie toutes les colonnes de groups (logo base64, config NocoDB/SMTP). |
| GET /api/weather/current | au montage du WeatherWidget (en-tête), puis refetchInterval de 30 min | server/routes.ts:5671 -> getWeatherSettings (storage.ts:2891), getWeatherData x2 (storage.ts:2910), puis API Visual Crossing si la donnée manque | Lectures BD et appels externes séquentiels, sans timeout. Rien n'est mis en cache quand l'historique N-1 échoue. |
| GET /api/stats/monthly?year&month[&storeId si admin] | au montage | server/routes.ts:4155 -> storage.getMonthlyStats (storage.ts:1222), 4 requêtes séquentielles | Résultat 'stats' jamais affiché : requête inutile. |
| GET /api/stats/yearly?year[&storeId si admin] | au montage | server/routes.ts:4192 -> storage.getYearlyStats (storage.ts:1364), 4 requêtes séquentielles | Seul averageDeliveryTime est utilisé. Au montage, la requête part sans storeId (user=null) et le résultat reste en cache. |
| GET /api/orders[?storeId si admin] | au montage, puis une 2e fois quand user est chargé (admin avec magasin sélectionné : la clé change) | server/routes.ts:1343 -> storage.getOrders (storage.ts:678) + loadDeliveriesByOrderIds (storage.ts:522) | Tout l'historique, sans limite, avec les livraisons imbriquées et les objets supplier/group complets. |
| GET /api/deliveries[?storeId si admin] | au montage, puis une 2e fois (même cas que /api/orders) | server/routes.ts:1752 -> storage.getDeliveries (storage.ts:885) + attachOrdersAndCommentCounts | Tout l'historique, alors que la page n'affiche que 2 compteurs et 4 lignes. |
| GET /api/customer-orders[?storeId si admin] | au montage | server/routes.ts:3486 -> storage.getCustomerOrders (storage.ts:1868) | customerOrderStats est calculé mais jamais affiché : requête inutile. |
| GET /api/announcements?recent=true[&storeId] | au montage, après le /api/user propre au Dashboard (enabled: !!user) | server/routes.ts:5770 (requête Drizzle inline + N+1 sur users/groups, l. 5815-5866) | Paramètre 'recent' ignoré par le serveur. Filtre de 2 jours fait côté client. |
| GET /api/announcements[?storeId] | au montage d'AnnouncementCard, après son propre /api/user | server/routes.ts:5770 | Doublon de l'appel précédent sous une autre queryKey. |
| GET /api/ad-campaigns?year=N-1, N, N+1 | au montage, 3 appels séquentiels (boucle for + await) | server/routes.ts:4595 -> storage.getPublicities (storage.ts:1502) | Télécharge 3 années complètes pour en garder 3 lignes ; groupIds est ignoré côté storage. |
| GET /api/dlc-products/stats?storeId | au montage, plus une invalidation forcée à chaque montage (useEffect) | server/routes.ts:2831 -> storage.getDlcStats (storage.ts:2224) | Agrégat SQL correct, mais définitions incohérentes avec la liste. |
| GET /api/dlc-products?status=expires\|expires_soon&storeId | à l'ouverture de la modale DLC (enabled: isOpen && compteur > 0) | server/routes.ts:2797 -> storage.getDlcProducts (storage.ts:1976) | Liste complète sans LIMIT alors que 8 lignes sont affichées. |
| GET /api/tasks[?storeId si admin] | au montage | server/routes.ts:3193 -> storage.getTasks (storage.ts:2267) | Renvoie [] pour tout non-admin sans storeId (routes.ts:3237-3249). Historique complet, tâches terminées comprises. |
| PUT /api/dlc-products/:id/stock-epuise | au clic sur 'Stock épuisé' dans la modale DLC | server/routes.ts:3023 | Invalide /api/dlc-products et /api/dlc-products/stats. |
| POST/PUT/DELETE /api/announcements[/:id] | au clic (admin) dans AnnouncementCard | server/routes.ts:5895 / 5976 / 6027 | La suppression part sans confirmation. L'invalidation ['/api/announcements'] ne touche pas la clé '/api/announcements/recent'. |

**Lisibilité / simplicité :** Page dense : 2 bandeaux DLC, 4 compteurs, 5 cartes et jusqu'à 2 modales automatiques. Rien n'est cliquable : ni compteurs, ni lignes, ni bandeaux, alors que les cartes ont un effet d'ombre au survol. Il n'y a ni état de chargement ni état d'erreur : pendant le chargement, l'utilisateur voit '0', 'Aucune commande en attente' ou 'Toutes les tâches sont terminées', ce qui est faux. Du texte de debug est visible ('(API: NOT_ARRAY)', '(N livraisons totales)'). Certains libellés sont ambigus ('Total palettes', délai calculé sur l'année sans le dire, numéro de publicité affiché à la place de sa désignation). Le badge de jours en attente peut être négatif. Les badges de priorité ont tous la même couleur. La bordure colorée des lignes est invisible (classe border-l-3 inexistante). La modale DLC ne peut pas se fermer avec la croix : elle se rouvre aussitôt. Elle peut aussi s'empiler sur la modale d'annonce. Pour les managers et directeurs, les données ne suivent pas le magasin sélectionné : tâches toujours vides, commandes du 1er magasin, statistiques agrégées sur tous leurs magasins.

### `/ et /dashboard (mobile, largeur < 768px)`

**Rôle :** Accueil simplifié sur téléphone : salutation et date, 4 compteurs (commandes, livraisons, tâches en cours, tâches urgentes), accès rapides et 3 tâches à faire.

**Tâches principales de l'utilisateur :**
- Voir d'un coup d'œil l'activité du jour
- Aller vite aux commandes, livraisons, tâches ou au calendrier
- Voir les prochaines tâches à faire

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user (x5 : RouterProduction, MobileApp, DashboardPage, MobileLayout, MobileBottomNav) | au montage, puis 3 de plus à chaque navigation (MobileLayout et MobileBottomNav sont remontés par chaque page) | server/localAuth.ts:204 / localAuth.production.ts:246 -> getUserWithGroups | Les requêtes de la page attendent le /api/user de leur propre instance (enabled: !!user) : une cascade de plus. |
| GET /api/groups | au montage de MobileApp | server/routes.ts:970 | OK |
| GET /api/stats/dashboard?storeId | au montage | aucun : la route n'existe pas dans server/routes.ts, réponse 404 | Appel mort ; 'stats' et 'isLoading' ne sont jamais utilisés. |
| GET /api/tasks?storeId | au montage | server/routes.ts:3193 -> storage.getTasks (storage.ts:2267) | Même queryKey ['/api/tasks', storeId] que le Dashboard desktop et la page Tâches, mais pas la même URL. |
| GET /api/orders?storeId&date=yyyy-MM-dd | au montage | server/routes.ts:1343 (ne lit que startDate/endDate, l. 1351) -> getOrders (storage.ts:678) | Paramètre 'date' ignoré : tout l'historique est téléchargé et affiché comme 'Commandes'. |
| GET /api/deliveries?storeId&date=yyyy-MM-dd | au montage | server/routes.ts:1752 (date ignorée) -> getDeliveries (storage.ts:885) | Idem : total historique affiché comme 'Livraisons'. |

**Lisibilité / simplicité :** Écran simple et lisible : salutation, grosses tuiles, accès rapides. Mais les chiffres 'Commandes' et 'Livraisons' sont des totaux historiques présentés comme l'activité du jour. Il n'y a pas d'état de chargement : '0' s'affiche d'abord. Il n'y a aucune alerte DLC ni information, contrairement au desktop, alors que les employés sur téléphone en ont besoin. Les accès rapides reprennent 3 des 4 boutons de la barre du bas. Leurs libellés au singulier ('Commande', 'Tâche') laissent croire à une création. 'Agenda' s'appelle 'Calendrier' dans la barre du bas. Les liens <a href> rechargent toute l'application.

### `En-tête desktop (toutes les routes) : WeatherWidget + DateWidget`

**Rôle :** Affiche dans l'en-tête la ville, la météo du jour comparée à la même date l'an dernier, et la date du jour.

**Tâches principales de l'utilisateur :**
- Comparer la météo du jour à celle de l'an dernier (prévision d'affluence)
- Voir la date du jour

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/weather/current | au montage du Layout, puis polling toutes les 30 min ; retry: 1 | server/routes.ts:5671 -> getWeatherSettings / getWeatherData / getNearestWeatherData (storage.ts:2891-2941) + weatherService.fetchCurrentWeather / fetchPreviousYearWeather (weatherService.ts:24, 45) | Répond 404 si le service n'est pas configuré, ce qui déclenche un retry inutile. Appels BD et externes séquentiels, sans timeout. |

**Lisibilité / simplicité :** Bloc compact, mais 3 colonnes (Aujourd'hui / Année dernière / Différence) prennent beaucoup de place dans l'en-tête. Le texte 'Chargement météo...' apparaît puis disparaît si le service n'est pas configuré, ce qui décale l'en-tête. La date est calculée au rendu et n'est jamais rafraîchie après minuit. La traduction des conditions météo est faite deux fois (client et serveur).

### `/calendar (StatsPanel)`

**Rôle :** Panneau flottant 'Statistiques du mois' sur le calendrier : commandes, livraisons, palettes, colis, délai moyen.

**Tâches principales de l'utilisateur :**
- Voir les volumes du mois affiché dans le calendrier

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/stats/monthly?year&month&storeId | au montage et à chaque changement de mois | server/routes.ts:4155 -> storage.getMonthlyStats (storage.ts:1222) | queryKey [statsUrl, storeId] différente de celle du Dashboard ['/api/stats/monthly', storeId] pour la même donnée. Sans placeholderData, un squelette s'affiche à chaque changement de mois. |

**Lisibilité / simplicité :** Panneau fixé en bas à droite (min-w-80), qu'on ne peut pas replier : il masque une partie du calendrier, surtout sur tablette. Les valeurs 'Palettes' et 'Colis' sont fausses (somme de toutes les unités, et nombre de livraisons). 'Commandes en attente' est un total historique affiché sous le titre 'Statistiques du mois'.

### `(non routé) RecentTasksCard, ResponsiveDashboard`

**Rôle :** Composants prévus pour le tableau de bord mais importés nulle part : code mort.

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/tasks?storeId | jamais : le composant n'est pas monté | server/routes.ts:3193 | fetch sans credentials ni contrôle res.ok. |

**Lisibilité / simplicité :** Pas visible par l'utilisateur. Il entretient seulement de la confusion pour les développeurs : troisième tri et troisième mise en forme des priorités de tâches.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [DASH-01](#dash-01) | haute | bug | S | Pour les non-admins, le magasin sélectionné n'est pas envoyé : tâches toujours vides, données d'un autre magasin | `client/src/pages/Dashboard.tsx:285` |
| [DASH-02](#dash-02) | haute | bug | S | La fenêtre d'alerte DLC se rouvre aussitôt qu'on la ferme (croix, Échap, clic à l'extérieur) | `client/src/pages/Dashboard.tsx:273` |
| [DASH-03](#dash-03) | haute | bug | M | En production, user vaut null au montage du Dashboard : requêtes envoyées avec le mauvais périmètre puis téléchargées deux fois | `client/src/hooks/useAuthUnified.ts:23` |
| [DASH-05](#dash-05) | haute | perf-api | L | L'historique complet des commandes et livraisons est téléchargé pour afficher 4 compteurs et 2 courtes listes | `client/src/pages/Dashboard.tsx:84` |
| [DASH-07](#dash-07) | haute | perf-serveur | M | Chaque ligne embarque l'objet magasin complet, logo base64 et configuration NocoDB/SMTP compris | `server/storage.ts:693` |
| [DASH-08](#dash-08) | haute | perf-serveur | S | Pas de compression HTTP ni de cache long sur les assets, et le middleware de compression maison est faux et inutilisé | `server/index.production.ts:143` |
| [DASH-22](#dash-22) | haute | ux-simplicite | M | Aucun état de chargement ni d'erreur : l'écran affiche de fausses informations pendant le chargement | `client/src/pages/Dashboard.tsx:435` |
| [DASH-28](#dash-28) | haute | bug | S | Mobile : 'Commandes' et 'Livraisons' affichent des totaux historiques (paramètre date ignoré), et un appel part vers une route inexistante | `client/src/pages/mobile/DashboardPage.tsx:101` |
| [DASH-32](#dash-32) | haute | perf-bundle | M | Aucun découpage du code : les 30+ pages desktop et mobile et recharts sont chargées dès l'accueil | `client/src/components/RouterProduction.tsx:5` |
| [DASH-04](#dash-04) | moyenne | perf-api | M | /api/user appelé 5 fois au chargement du tableau de bord, et 3 fois de plus à chaque navigation mobile | `client/src/hooks/useAuthUnified.ts:160` |
| [DASH-06](#dash-06) | moyenne | perf-api | S | Deux requêtes dont le résultat n'est jamais affiché : /api/stats/monthly et /api/customer-orders | `client/src/pages/Dashboard.tsx:28` |
| [DASH-09](#dash-09) | moyenne | perf-serveur | M | Chaque route relit l'utilisateur et ses magasins (2 requêtes) déjà chargés par passport | `server/routes.ts:1345` |
| [DASH-10](#dash-10) | moyenne | perf-serveur | S | Statistiques mensuelles et annuelles : 4 requêtes SQL séquentielles, non mises en cache | `server/storage.ts:1270` |
| [DASH-11](#dash-11) | moyenne | perf-api | S | Publicités à venir : 3 appels séquentiels qui téléchargent 3 années complètes pour en afficher 3 | `client/src/pages/Dashboard.tsx:205` |
| [DASH-12](#dash-12) | moyenne | perf-serveur | S | Informations : requête N+1 (auteur et magasin chargés un par un) et contenu complet écrit dans les logs | `server/routes.ts:5815` |
| [DASH-13](#dash-13) | moyenne | bug | S | Les non-admins voient les informations de tous les magasins, et le paramètre 'recent' est ignoré | `server/routes.ts:5797` |
| [DASH-15](#dash-15) | moyenne | perf-client | S | Changer de magasin relance d'abord les requêtes de l'ancien magasin, puis affiche des zéros | `client/src/components/Layout.tsx:138` |
| [DASH-17](#dash-17) | moyenne | perf-client | S | Calculs lourds refaits à chaque rendu, sans useMemo, et tri qui modifie le cache React Query | `client/src/pages/Dashboard.tsx:293` |
| [DASH-18](#dash-18) | moyenne | bug | S | Le badge 'jours en attente' affiche des valeurs négatives et n'a pas de légende | `client/src/pages/Dashboard.tsx:506` |
| [DASH-19](#dash-19) | moyenne | coherence-design | S | Badges de priorité des tâches : le variant est passé dans className, donc toutes les priorités ont la même couleur | `client/src/pages/Dashboard.tsx:687` |
| [DASH-21](#dash-21) | moyenne | lisibilite | S | Texte de debug technique visible par les utilisateurs | `client/src/pages/Dashboard.tsx:642` |
| [DASH-23](#dash-23) | moyenne | ux-simplicite | M | Rien n'est cliquable alors que tout réagit au survol | `client/src/pages/Dashboard.tsx:430` |
| [DASH-24](#dash-24) | moyenne | ux-simplicite | M | Alertes DLC affichées en double (bandeaux + fenêtre), et deux fenêtres automatiques peuvent s'empiler | `client/src/pages/Dashboard.tsx:409` |
| [DASH-25](#dash-25) | moyenne | lisibilite | S | Libellés ambigus, majuscules à l'anglaise, et numéro de publicité affiché à la place de la désignation | `client/src/pages/Dashboard.tsx:476` |
| [DASH-26](#dash-26) | moyenne | bug | S | Statistiques 'Palettes' et 'Colis' fausses : unités mélangées et nombre de livraisons présenté comme nombre de colis | `server/storage.ts:1310` |
| [DASH-27](#dash-27) | moyenne | bug | S | Compteurs DLC incohérents avec la liste de la fenêtre : produits du jour comptés deux fois, 'stock épuisé' traités différemment | `server/storage.ts:2245` |
| [DASH-29](#dash-29) | moyenne | perf-client | M | Chaque page mobile remonte l'en-tête et la barre du bas, ce qui relance /api/user à chaque navigation | `client/src/pages/mobile/DashboardPage.tsx:136` |
| [DASH-30](#dash-30) | moyenne | perf-client | S | Les liens 'Accès rapide' et le bouton de la fenêtre DLC rechargent toute l'application | `client/src/pages/mobile/DashboardPage.tsx:187` |
| [DASH-31](#dash-31) | moyenne | ux-simplicite | M | Mobile : les accès rapides doublonnent la barre du bas, avec des libellés trompeurs, et les alertes utiles manquent | `client/src/pages/mobile/DashboardPage.tsx:179` |
| [DASH-35](#dash-35) | moyenne | perf-serveur | S | Météo : appels séquentiels sans timeout, et l'API externe est rappelée à chaque requête si l'historique échoue | `server/routes.ts:5683` |
| [DASH-37](#dash-37) | moyenne | ux-simplicite | S | Informations : suppression sans confirmation avec une icône 'X', boutons de 24 px sans libellé, texte non tronqué | `client/src/components/AnnouncementCard.tsx:356` |
| [DASH-38](#dash-38) | moyenne | bug | M | Mêmes queryKeys pour des URL différentes (et l'inverse) : les données affichées dépendent de la page visitée en premier | `client/src/pages/Dashboard.tsx:282` |
| [DASH-14](#dash-14) | basse | perf-api | S | Les informations sont récupérées deux fois sous deux clés différentes, qui ne s'invalident pas ensemble | `client/src/pages/Dashboard.tsx:97` |
| [DASH-16](#dash-16) | basse | perf-client | S | Les requêtes DLC sont invalidées à chaque montage du tableau de bord, ce qui annule le cache | `client/src/pages/Dashboard.tsx:23` |
| [DASH-20](#dash-20) | basse | coherence-design | S | La classe 'border-l-3' n'existe pas dans Tailwind 3 : la barre colorée à gauche des lignes est invisible | `client/src/pages/Dashboard.tsx:510` |
| [DASH-33](#dash-33) | basse | perf-client | S | Script de bannière Replit (domaine tiers) chargé en production | `client/index.html:19` |
| [DASH-34](#dash-34) | basse | accessibilite | S | Page déclarée en anglais et zoom bloqué sur mobile | `client/index.html:5` |
| [DASH-36](#dash-36) | basse | ux-simplicite | S | Météo non configurée : retry inutile puis disparition du bloc, avec décalage de l'en-tête | `client/src/components/WeatherWidget.tsx:121` |
| [DASH-39](#dash-39) | basse | lisibilite | S | Fenêtre DLC : formulations techniques ou alarmistes, et '0 jour(s)' | `client/src/components/DlcAlertModal.tsx:178` |
| [DASH-40](#dash-40) | basse | ux-simplicite | S | 'Livraisons à venir' inclut les livraisons en retard, et les tâches sont triées différemment sur chaque écran | `client/src/pages/Dashboard.tsx:310` |
| [DASH-41](#dash-41) | basse | accessibilite | S | Textes secondaires en gris clair 'text-gray-400' de petite taille, sous le seuil de contraste | `client/src/pages/Dashboard.tsx:568` |
| [DASH-42](#dash-42) | basse | ux-simplicite | S | Panneau de statistiques fixe et non repliable qui masque le calendrier | `client/src/components/StatsPanel.tsx:54` |
| [DASH-43](#dash-43) | basse | bug | S | La date de l'en-tête n'est jamais rafraîchie | `client/src/components/DateWidget.tsx:16` |
| [DASH-44](#dash-44) | basse | perf-serveur | S | Logs volumineux à chaque appel dans les chemins les plus sollicités | `server/routes.ts:3263` |
| [DASH-45](#dash-45) | basse | dette-code | S | Code mort : RecentTasksCard, ResponsiveDashboard, server/cache.ts, imports et variables inutilisés | `client/src/components/tasks/RecentTasksCard.tsx:25` |
| [DASH-46](#dash-46) | basse | dette-code | S | Configurations de priorités et de types d'information dupliquées, avec des correspondances contre-intuitives | `client/src/pages/Dashboard.tsx:139` |

### DASH-01

**Pour les non-admins, le magasin sélectionné n'est pas envoyé : tâches toujours vides, données d'un autre magasin** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:285`
- **Constat :** Dashboard.tsx:285 'if (selectedStoreId && user?.role === 'admin') params.append("storeId", ...)'. Même condition l. 37, 62, 79-81. Côté serveur, routes.ts:3237-3249 : non-admin sans storeId -> 'returning empty result' (res.json([])). routes.ts:1410-1420 : manager/directeur sans storeId -> 'groupIds = [userGroupIds[0]]'. routes.ts:4170-4178 : stats -> 'groupIds = userGroupIds' (tous les magasins). Les pages Commandes et Livraisons envoient storeId pour tous les rôles (Orders.tsx:72-73 'CRITICAL FIX').
- **Impact :** Un manager ou un directeur voit toujours 'Aucune tâche en cours / Toutes les tâches sont terminées'. Les commandes et livraisons affichées sont celles de son 1er magasin, quel que soit le magasin choisi, et les statistiques sont agrégées sur tous ses magasins. L'alerte DLC, elle, suit le magasin sélectionné : la page mélange 3 périmètres différents.
- **Recommandation :** Envoyer storeId pour tous les rôles dès qu'un magasin est sélectionné, comme dans Orders.tsx et Tasks.tsx. Centraliser la construction des URL dans un hook (ex. useStoreScopedUrl('/api/orders')) utilisé par toutes les pages, pour éviter de nouvelles divergences.

### DASH-02

**La fenêtre d'alerte DLC se rouvre aussitôt qu'on la ferme (croix, Échap, clic à l'extérieur)** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:273`
- **Constat :** Dashboard.tsx:276-278 'handleCloseDlcAlertModal = () => setShowDlcAlertModal(false)'. L'effet l. 244-273 dépend de showDlcAlertModal : 'if (shouldShowDlcModal && !showDlcAlertModal) { ... } else { setShowDlcAlertModal(true); }' tant qu'aucun snooze n'est présent dans localStorage. Seul 'Traiter plus tard (2h)' (DlcAlertModal.tsx:106-112) écrit ce snooze.
- **Impact :** Un employé ou un manager ne peut pas fermer la fenêtre normalement : elle revient instantanément. Il est bloqué jusqu'à trouver le bouton 'Traiter plus tard (2h)', ce qui est vécu comme un bug.
- **Recommandation :** À la fermeture, mémoriser un rejet pour la session (sessionStorage 'dlcAlertDismissed' ou snooze court). Déclencher l'ouverture automatique une seule fois par chargement (useRef 'alreadyShown'), sans dépendre de showDlcAlertModal.

### DASH-03

**En production, user vaut null au montage du Dashboard : requêtes envoyées avec le mauvais périmètre puis téléchargées deux fois** — bug, sévérité haute, effort M

- **Fichier :** `client/src/hooks/useAuthUnified.ts:23`
- **Constat :** useAuthUnified.ts:23-24 'const [productionUser, setProductionUser] = useState<any>(null)' : chaque instance refait son fetch('/api/user') (l. 160). Au montage, Dashboard.tsx:79 construit ordersUrl sans storeId car user?.role est undefined, puis avec storeId une fois user chargé : la clé change et l'historique complet est retéléchargé. Pour /api/stats/yearly (l. 55) et /api/tasks (l. 282), la queryKey ne contient pas le rôle : le résultat 'tous magasins' obtenu avec user=null reste en cache sous la clé du magasin sélectionné.
- **Impact :** Pour un admin avec un magasin sélectionné, l'historique de tous les magasins (commandes, livraisons, commandes clients) est téléchargé puis jeté. Le délai moyen et la liste des tâches affichent les chiffres de tous les magasins au lieu du magasin choisi.
- **Recommandation :** Faire de useAuthUnified un simple useQuery(['/api/user'], { staleTime: Infinity }) partagé par le cache, ou un AuthContext fourni par RouterProduction. user est alors disponible dès le 1er rendu. Ajouter 'enabled: !!user' aux requêtes du Dashboard qui dépendent du rôle.

### DASH-05

**L'historique complet des commandes et livraisons est téléchargé pour afficher 4 compteurs et 2 courtes listes** — perf-api, sévérité haute, effort L

- **Fichier :** `client/src/pages/Dashboard.tsx:84`
- **Constat :** Dashboard.tsx:84-90 'useQuery({ queryKey: [ordersUrl, selectedStoreId] })' sur '/api/orders' et '/api/deliveries' sans filtre de date. Ils servent à calculer côté client deliveredThisMonth (l. 318), totalPalettes (l. 328), pendingOrders (l. 302) et upcomingDeliveries (.slice(0, 4), l. 313). Côté serveur, storage.getOrders (storage.ts:678-723) : pas de LIMIT, livraisons imbriquées via loadDeliveriesByOrderIds. storage.getDeliveries (885-926) : pas de LIMIT, commande imbriquée et nombre de commentaires. getTasks (storage.ts:2267) renvoie aussi toutes les tâches, terminées comprises, pour en afficher 5.
- **Impact :** Le temps de chargement et la mémoire grandissent avec l'historique (des Mo de JSON après quelques années), surtout sur réseau magasin ou 4G. Le serveur sérialise des milliers de lignes à chaque ouverture du tableau de bord.
- **Recommandation :** Créer GET /api/dashboard/summary?storeId=. Il renverrait, calculés en SQL (COUNT/SUM avec WHERE et LIMIT) et lancés en parallèle (Promise.all) : nombre de commandes en attente, livraisons et palettes reçues ce mois, délai moyen, les 10 commandes en attente les plus anciennes, les 4 prochaines livraisons planifiées, les 3 prochaines publicités, les 5 tâches ouvertes prioritaires, les compteurs DLC et la dernière information. Une seule requête légère au lieu de 11.

### DASH-07

**Chaque ligne embarque l'objet magasin complet, logo base64 et configuration NocoDB/SMTP compris** — perf-serveur, sévérité haute, effort M — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:693`
- **Constat :** storage.ts:692-693 'supplier: suppliers, group: groups,' dans getOrders. Même chose dans loadDeliveriesByOrderIds (l. 552-553), getDeliveries (l. 912-913), loadOrdersByIds, getCustomerOrders (l. 1868), getDlcProducts (l. 1980), getTasks (l. 2271) et getPublicities (l. 1536). Or shared/schema.ts:67 'logo: text("logo"), // Logo en data URI (data:image/png;base64,...)', l. 63 webhookUrl, l. 74 smtpPassword. Pour masquer smtpPassword, routes.ts:168 copie en profondeur chaque réponse : 'res.json = (body) => originalJson(stripSmtpPassword(body))'.
- **Impact :** Le logo base64 (souvent 10 à 100 Ko) est répété dans chaque commande, chaque livraison imbriquée et chaque produit DLC : la taille des réponses est multipliée et le parse JSON côté navigateur ralentit. Le serveur reparcourt et recopie tout le JSON à chaque réponse. La configuration interne (webhook, NocoDB, hôte et utilisateur SMTP) est exposée à tous les utilisateurs.
- **Recommandation :** Définir des projections par usage. Pour les listes (commandes, tâches, DLC, commandes clients, publicités) : { id, name, color }. Pour les livraisons et avoirs utilisés en rapprochement : ajouter webhookUrl, nocodbConfigId et nocodbTableName. Ne jamais sélectionner logo ni smtp*. Vérifier chaque appelant client par grep sur `.group?.` avant de changer une projection. Garder stripSmtpPassword global comme filet de sécurité. Son coût baissera de lui-même avec des objets plus petits.

### DASH-08

**Pas de compression HTTP ni de cache long sur les assets, et le middleware de compression maison est faux et inutilisé** — perf-serveur, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `server/index.production.ts:143`
- **Constat :** server/index.production.ts:27-28 : express.json et urlencoded, aucun middleware compression. l. 143 'app.use('/assets', express.static(join(publicPath, 'assets')))' sans maxAge ni immutable. server/cache.ts:93-100 : setupCompression pose 'Content-Encoding: gzip' sans rien compresser, et n'est importé nulle part (grep vide). Aucun nginx/gzip dans le dépôt. Assets dist/public/assets : index 1,08 Mo + vendor-charts 410 Ko + vendor-react 146 Ko + CSS 121 Ko servis bruts.
- **Impact :** Environ 1,8 Mo de JS/CSS non compressé au premier chargement (environ 450 Ko en gzip). Les assets sont revalidés à chaque visite, et les grosses réponses JSON (commandes, livraisons) circulent 5 à 10 fois plus lourdes que nécessaire.
- **Recommandation :** (1) Mécanique : servir /assets avec express.static(..., { maxAge: '1y', immutable: true }) dans index.production.ts:143, sans toucher au static '/' ni à index.html. Supprimer setupCompression de server/cache.ts, voire tout le fichier (DASH-45). (2) Ajouter la dépendance compression et @types/compression, puis app.use(compression()) avant registerProductionRoutes dans index.production.ts et dans index.ts. Vérifier au préalable la configuration gzip du nginx externe (réseau nginx_default).

### DASH-22

**Aucun état de chargement ni d'erreur : l'écran affiche de fausses informations pendant le chargement** — ux-simplicite, sévérité haute, effort M

- **Fichier :** `client/src/pages/Dashboard.tsx:435`
- **Constat :** Dashboard.tsx ne lit jamais isLoading ni isError (grep vide). Pendant le chargement : l. 435 '{deliveredThisMonth}' = 0, l. 533 'Aucune commande en attente', l. 701-702 'Aucune tâche en cours / Toutes les tâches sont terminées'. mobile/DashboardPage.tsx:63 récupère isLoading sans s'en servir. Les queryFn qui échouent renvoient [] ou null en silence (DashboardPage.tsx:88, 106, 124).
- **Impact :** L'utilisateur peut croire que tout est traité alors que les données ne sont pas encore arrivées ou que le serveur est en erreur. C'est risqué pour des décisions opérationnelles (DLC, retards).
- **Recommandation :** Afficher un squelette (Skeleton shadcn) par carte tant que isLoading est vrai. En cas d'erreur, afficher un message clair dans la carte ('Impossible de charger les commandes' + bouton 'Réessayer'). Ne montrer les messages d'état vide qu'après un chargement réussi.

### DASH-28

**Mobile : 'Commandes' et 'Livraisons' affichent des totaux historiques (paramètre date ignoré), et un appel part vers une route inexistante** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/mobile/DashboardPage.tsx:101`
- **Constat :** DashboardPage.tsx:101 'params.append('date', format(new Date(), 'yyyy-MM-dd'))' puis 'fetch(`/api/orders?${params}`)'. Le serveur ne lit que startDate/endDate : routes.ts:1351 'const { startDate, endDate, storeId } = req.query;'. Même chose pour /api/deliveries (l. 119-121). DashboardPage.tsx:69 'fetch(`/api/stats/dashboard?...`)' : aucune route de ce nom dans server/routes.ts (404), et 'stats' n'est jamais utilisé.
- **Impact :** Sur téléphone, l'employé voit par exemple '1 254 Commandes' en pensant que c'est l'activité du jour. L'application télécharge tout l'historique juste pour compter les lignes (.length), ce qui est lent en 4G, et fait un appel 404 inutile.
- **Recommandation :** Supprimer l'appel /api/stats/dashboard. Utiliser 'startDate=endDate=aujourd'hui', ou mieux l'endpoint de synthèse (DASH-05) qui renvoie directement les compteurs. Libeller 'Commandes du jour' et 'Livraisons du jour'.

### DASH-32

**Aucun découpage du code : les 30+ pages desktop et mobile et recharts sont chargées dès l'accueil** — perf-bundle, sévérité haute, effort M — vérification : partiellement confirmé

- **Fichier :** `client/src/components/RouterProduction.tsx:5`
- **Constat :** RouterProduction.tsx:5-44 : imports statiques de toutes les pages (Analytics, BLReconciliation, Avoirs, DatabaseDebug… et les 11 pages mobiles). Aucun React.lazy dans client/src (grep vide). vite.config.ts:41-46 : manualChunks 'vendor-charts': ['recharts'], que index.html précharge (modulepreload). Build : dist/public/assets/index-*.js = 1 081 745 octets, vendor-charts = 410 243 octets.
- **Impact :** Environ 1,7 Mo de JS à télécharger, parser et exécuter avant d'afficher l'accueil, alors que le tableau de bord n'utilise ni graphiques ni la plupart des pages. Premier affichage lent sur les PC de caisse et sur mobile.
- **Recommandation :** Charger les pages secondaires avec React.lazy dans un <Suspense fallback={<PageSkeleton/>}>, en gardant Dashboard, AuthPage et la page mobile d'accueil en import direct. Ajouter un gestionnaire d'erreur de chargement de chunk (rechargement unique de la page). Retirer 'vendor-charts' de manualChunks, ou passer à une fonction manualChunks qui n'y place que node_modules/recharts et d3-*. Vérifier après le build que index.html ne précharge plus ce chunk.

### DASH-04

**/api/user appelé 5 fois au chargement du tableau de bord, et 3 fois de plus à chaque navigation mobile** — perf-api, sévérité moyenne, effort M

- **Fichier :** `client/src/hooks/useAuthUnified.ts:160`
- **Constat :** useAuthUnified.ts:160 'const response = await fetch('/api/user', { credentials: 'include', cache: 'no-cache', ...' dans un useEffect propre à chaque instance. Instances sur le desktop : RouterProduction, Layout, Dashboard, AnnouncementCard, plus useAuthSimple dans Sidebar.tsx:44. Sur mobile : RouterProduction, MobileApp, DashboardPage, MobileLayout, MobileBottomNav. Côté serveur, chaque appel coûte la session + getUserWithGroups dans deserializeUser (localAuth.production.ts:193-196) + de nouveau getUserWithGroups dans localAuth.ts:211.
- **Impact :** Environ 5 allers-retours et 20 à 25 requêtes SQL de plus à chaque ouverture. Sur mobile, les requêtes de la page attendent le /api/user de leur propre instance, ce qui ajoute une étape à la cascade et retarde l'affichage.
- **Recommandation :** Une seule source d'auth (useQuery partagé ou contexte), comme pour DASH-03. Supprimer useAuthSimple au profit du même hook.

### DASH-06

**Deux requêtes dont le résultat n'est jamais affiché : /api/stats/monthly et /api/customer-orders** — perf-api, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:28`
- **Constat :** Dashboard.tsx:28 'const { data: stats } = useQuery({ queryKey: ['/api/stats/monthly', ...' : 'stats' n'est utilisé nulle part dans le JSX. Dashboard.tsx:92 'const { data: customerOrders = [] } = useQuery(...)' : il ne sert qu'à customerOrderStats (l. 380-387), jamais rendu. recentOrders (l. 293-299) et ordersByStatus (l. 372-377) ne sont pas utilisés non plus.
- **Impact :** 2 requêtes HTTP de plus, dont l'historique complet des commandes clients (storage.ts:1868, sans LIMIT), plus 4 requêtes SQL séquentielles pour les stats mensuelles, pour rien.
- **Recommandation :** Supprimer ces deux useQuery et les variables mortes recentOrders, ordersByStatus et customerOrderStats.

### DASH-09

**Chaque route relit l'utilisateur et ses magasins (2 requêtes) déjà chargés par passport** — perf-serveur, sévérité moyenne, effort M

- **Fichier :** `server/routes.ts:1345`
- **Constat :** routes.ts:1345 'const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);', répété l. 1754, 2799, 2833, 3195, 3488, 4157, 4194, 4597 et 5775. Or localAuth.production.ts:193-196 'passport.deserializeUser(async (id) => { const user = await storage.getUserWithGroups(id); ...' : req.user est déjà un UserWithGroups. Et getUserWithGroups (storage.ts:371-405) fait 2 requêtes séquentielles (getUser puis user_groups JOIN groups).
- **Impact :** Par requête API : session + 2 + 2 requêtes SQL séquentielles avant la logique métier. Sur le tableau de bord (environ 20 appels), cela fait environ 80 requêtes SQL inutiles et autant de latence ajoutée.
- **Recommandation :** Introduire un helper `getCurrentUser(req): UserWithGroups` qui renvoie req.user. L'appliquer d'abord aux routes chaudes du tableau de bord (orders, deliveries, tasks, stats, dlc stats, ad-campaigns, announcements), puis progressivement. Réécrire getUserWithGroups en une requête (users LEFT JOIN user_groups LEFT JOIN groups) en conservant exactement le format { ...user, userGroups: [{ userId, groupId, group: { id, name, color, createdAt, updatedAt } }] }.

### DASH-10

**Statistiques mensuelles et annuelles : 4 requêtes SQL séquentielles, non mises en cache** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:1270`
- **Constat :** storage.ts:1270 'const ordersResult = await db...', l. 1276 'const deliveriesResult = await db...', l. 1287 'const pendingResult = await db...', l. 1308 'const deliveriesStatsResult = await db...' : 4 await successifs indépendants. Même schéma dans getYearlyStats (l. 1409, 1415, 1426, 1446), dont le Dashboard n'utilise que averageDeliveryTime (Dashboard.tsx:317).
- **Impact :** La latence de l'endpoint vaut la somme de 4 allers-retours BD au lieu du plus long. Les statistiques annuelles, qui bougent peu, sont recalculées à chaque ouverture.
- **Recommandation :** Auto : seulement Promise.all sur les 4 requêtes de getMonthlyStats et de getYearlyStats. Le cache mémoire est à décider séparément, avec invalidation sur création, modification ou validation de commande et de livraison.

### DASH-11

**Publicités à venir : 3 appels séquentiels qui téléchargent 3 années complètes pour en afficher 3** — perf-api, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:205`
- **Constat :** Dashboard.tsx:202-219 'const years = [currentYear - 1, currentYear, currentYear + 1]; for (const year of years) { ... const response = await fetch(`/api/ad-campaigns?${params}`) ...' puis un filtre et un tri côté client (l. 222-224), et '.slice(0, 3)' au rendu (l. 584). Côté serveur, getPublicities (storage.ts:1502-1560) ignore groupIds et associe les participations par 'participations.filter((p) => p.publicityId === publicity.id)' (l. 1552-1553), soit O(n×m).
- **Impact :** 3 allers-retours en cascade (l'année N-1 ne peut pas contenir de publicité future), et des centaines de publicités avec leurs participations (et le magasin complet, cf. DASH-07) transférées pour 3 lignes.
- **Recommandation :** Ajouter GET /api/ad-campaigns/upcoming?limit=3 : WHERE start_date > CURRENT_DATE ORDER BY start_date LIMIT 3 (l'index idx_publicities_start_date existe déjà, migrations/0000_flashy_blur.sql:260). En attendant, faire les appels N et N+1 en Promise.all et supprimer N-1. Côté storage, grouper les participations dans une Map.

### DASH-12

**Informations : requête N+1 (auteur et magasin chargés un par un) et contenu complet écrit dans les logs** — perf-serveur, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:5815`
- **Constat :** routes.ts:5815 'messages.map(async (message) => { ... const [userResult] = await db.select({...}).from(users).where(eq(users.username, message.createdBy));' (l. 5821) puis 'const [groupResult] = await db.select().from(groups).where(eq(groups.id, message.storeId));' (l. 5852). l. 5811 : 'console.log('🔍 [PRODUCTION] Raw messages from DB:', messages.length, 'items:', messages);'.
- **Impact :** Jusqu'à 10 requêtes SQL de plus par appel, et cet appel est fait 2 fois par ouverture (DASH-14). Le select().from(groups) ramène aussi le logo base64. Les logs contiennent le texte intégral des annonces.
- **Recommandation :** Une requête dashboardMessages LEFT JOIN users ON users.username = created_by LEFT JOIN groups ON groups.id = store_id. Sélectionner users.id, username, firstName, lastName, name et groups.id, name. Recalculer `author` (même logique de displayName et même repli) et `group` ({ id, name } ou null), pour garder exactement le format de réponse actuel. Supprimer les console.log l.5773, 5779, 5811, 5820, 5827 et 5865.

### DASH-13

**Les non-admins voient les informations de tous les magasins, et le paramètre 'recent' est ignoré** — bug, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:5797`
- **Constat :** routes.ts:5797 'if (user.role === 'admin' && req.query.storeId) { query = query.where(or(eq(dashboardMessages.storeId, storeId), isNull(dashboardMessages.storeId))) }' : aucun filtre pour les autres rôles. Le Dashboard envoie 'recent=true' (Dashboard.tsx:104), que le serveur ne lit jamais, et refiltre sur 2 jours côté client (l. 117-124).
- **Impact :** Un employé du magasin A voit les informations destinées au magasin B, ce qui crée de la confusion sur les consignes à appliquer. Avec la limite de 5, des informations globales peuvent aussi être évincées par celles d'autres magasins.
- **Recommandation :** Pour les non-admins, filtrer 'store_id IS NULL OR store_id IN (userGroupIds)', ou sur le magasin sélectionné s'il est autorisé. Gérer 'recent' côté SQL (created_at >= now() - interval '2 days') ou retirer ce paramètre.

### DASH-15

**Changer de magasin relance d'abord les requêtes de l'ancien magasin, puis affiche des zéros** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/components/Layout.tsx:138`
- **Constat :** Layout.tsx:138-146 'queryClient.invalidateQueries({ predicate: ... includes('/api/orders') || ... '/api/deliveries' || '/api/stats/monthly' || '/api/tasks' })' est appelé avant 'setSelectedStoreId(newStoreId)' (l. 154). Les requêtes encore actives, qui portent la clé de l'ancien magasin, sont donc refetchées. Toutes ces clés contiennent déjà selectedStoreId, et aucune requête du Dashboard n'a de placeholderData.
- **Impact :** À chaque changement de magasin, l'historique complet des commandes et livraisons de l'ancien magasin est retéléchargé pour rien. Ensuite, l'écran affiche '0' et 'Aucune...' le temps du nouveau chargement.
- **Recommandation :** Auto : supprimer seulement l'appel invalidateQueries de Layout.tsx:138-146. L'ajout de placeholderData: keepPreviousData, avec un indicateur 'Mise à jour…', est à traiter séparément comme décision produit.

### DASH-17

**Calculs lourds refaits à chaque rendu, sans useMemo, et tri qui modifie le cache React Query** — perf-client, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Dashboard.tsx:293`
- **Constat :** Dashboard.tsx:293-294 'const recentOrders = Array.isArray(allOrders) ? allOrders.sort(...)' : .sort() trie sur place le tableau stocké dans le cache, partagé avec la page Commandes pour l'admin. Puis 4 passes .filter sur allOrders (l. 302, 316, 373-375), 2 sur allDeliveries (l. 318, 328) et 5 sur customerOrders (l. 381-385), avec safeDate() à chaque comparaison. Le composant est re-rendu à chaque fin d'une des environ 12 requêtes.
- **Impact :** Sur un historique de plusieurs milliers de lignes, des dizaines de millisecondes de calcul par rendu, répétées une douzaine de fois au chargement : interface saccadée sur les PC de magasin modestes. La mutation du cache peut aussi changer l'ordre d'une autre page.
- **Recommandation :** Regrouper les dérivations dans un useMemo([allOrders, allDeliveries]) en une seule passe, et copier avant de trier ('[...allOrders].sort'). Mieux : déplacer ces agrégats côté serveur (DASH-05).

### DASH-18

**Le badge 'jours en attente' affiche des valeurs négatives et n'a pas de légende** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:506`
- **Constat :** Dashboard.tsx:505-507 'const orderDate = safeDate(order.plannedDate); const daysPending = Math.floor((new Date().getTime() - orderDate.getTime()) / (1000*60*60*24)); const isOverdue = daysPending > 10;' puis l. 524 '{daysPending} jour{daysPending > 1 ? 's' : ''}'. Une commande 'pending' a généralement une date prévue future.
- **Impact :** L'utilisateur lit '-4 jour' ou '3 jours' sans savoir s'il s'agit d'un retard ou d'un délai restant. Le rouge n'apparaît qu'au-delà de 10 jours, de façon arbitraire, donc une commande en retard d'un jour reste orange.
- **Recommandation :** Si la date prévue est passée, afficher 'En retard de X j' en rouge. Sinon, afficher 'Prévue le 12 oct.' en neutre. Trier les retards en premier et limiter la liste à 5-10 lignes avec un lien 'Voir toutes les commandes en attente'.

### DASH-19

**Badges de priorité des tâches : le variant est passé dans className, donc toutes les priorités ont la même couleur** — coherence-design, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:687`
- **Constat :** Dashboard.tsx:686-688 '<Badge className={`text-xs flex items-center gap-1 ${priorityConfig.color}`}>' alors que getPriorityConfig (l. 341-368) renvoie color: 'destructive' | 'default' | 'secondary', qui sont des noms de variant et non des classes CSS. RecentTasksCard.tsx:152 fait correctement 'variant={priorityConfig.color}'.
- **Impact :** 'Élevée', 'Moyenne' et 'Faible' s'affichent tous en bleu primaire : l'urgence ne se voit pas d'un coup d'œil.
- **Recommandation :** Remplacer par `<Badge variant={priorityConfig.color} className="text-xs flex items-center gap-1">`, puis partager la configuration via DASH-46 (et non DASH-34).

### DASH-21

**Texte de debug technique visible par les utilisateurs** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:642`
- **Constat :** Dashboard.tsx:642 '<p className="text-xs text-gray-400 mt-1">(API: {Array.isArray(upcomingPublicities) ? upcomingPublicities.length : 'NOT_ARRAY'})</p>'. l. 568 '({Array.isArray(allDeliveries) ? allDeliveries.length : 0} livraisons totales)'. Aussi un console.log dans le queryFn (l. 217).
- **Impact :** Des mentions comme '(API: 0)' ou '(API: NOT_ARRAY)' font croire à une panne et nuisent à la confiance dans l'outil.
- **Recommandation :** Auto : supprimer seulement les deux <p> de debug (l.568 et l.642) en gardant les messages 'Aucune livraison programmée' et 'Aucune publicité à venir'. L'ajout d'un lien d'action est à traiter avec DASH-23.

### DASH-23

**Rien n'est cliquable alors que tout réagit au survol** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Dashboard.tsx:430`
- **Constat :** Dashboard.tsx:430 '<Card className="... shadow-lg hover:shadow-xl transition-shadow">' sur les 4 compteurs et les 5 cartes. Les lignes ont 'hover:bg-orange-100' (l. 510), mais il n'y a aucun Link ni onClick (grep 'Link|navigate|href' vide). Les bandeaux DLC (l. 409-425) ne mènent pas non plus à /dlc.
- **Impact :** L'utilisateur voit '12 commandes en attente' mais doit passer par le menu, puis chercher et filtrer lui-même. L'effet de survol laisse croire à un clic qui ne fait rien.
- **Recommandation :** Rendre chaque compteur et chaque ligne cliquables : /orders?status=pending, /deliveries?status=planned, /dlc?status=expires, /tasks, /publicities. Ajouter un lien 'Tout voir' en pied de carte. Retirer l'effet hover-shadow sur ce qui n'est pas cliquable.

### DASH-24

**Alertes DLC affichées en double (bandeaux + fenêtre), et deux fenêtres automatiques peuvent s'empiler** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Dashboard.tsx:409`
- **Constat :** Dashboard.tsx:409-425 : bandeaux jaune et rouge DLC. l. 244-273 : ouverture automatique de DlcAlertModal avec les mêmes chiffres. l. 174-182 : ouverture automatique de la fenêtre 'Nouvelle Annonce'. Les deux Dialog (l. 710 et 773) sont indépendants : rien n'empêche open=true sur les deux à la fois pour un non-admin.
- **Impact :** À la connexion, un employé peut recevoir deux fenêtres superposées en plus de deux bandeaux : surcharge et confusion sur ce qu'il faut faire en premier.
- **Recommandation :** Créer un seul bloc 'À traiter aujourd'hui' en haut de page (DLC expirés, DLC proches, commandes en retard), avec un bouton d'action chacun. Afficher au plus une fenêtre automatique par session, avec une file : l'information d'abord, l'alerte DLC ensuite.

### DASH-25

**Libellés ambigus, majuscules à l'anglaise, et numéro de publicité affiché à la place de la désignation** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:476`
- **Constat :** l. 476 'Total palettes' : en réalité les palettes livrées ce mois (l. 328-338). l. 462 'Délai commande → livraison' : en réalité la moyenne annuelle (yearlyStats). l. 595-596 : '{publicity.pubNumber}' en gras et '{publicity.designation}' tronquée à max-w-40 (160 px). Titres 'Tableau de Bord', 'Commandes en Attente', 'Livraisons à Venir', 'Publicités à Venir' à côté de 'Tâches à faire'. Sous-titre générique l. 400 'Vue d'ensemble des performances et statistiques'.
- **Impact :** Un employé ne sait pas sur quelle période portent les chiffres, et ne reconnaît pas une opération publicitaire à son numéro interne.
- **Recommandation :** Renommer en 'Palettes reçues ce mois', 'Délai moyen commande → livraison (2026)', 'Livraisons ce mois'. Pour les publicités, afficher la désignation en premier, puis 'Pub n° 2541 · du 12 au 18 oct.'. Écrire les titres en casse française ('Commandes en attente').

### DASH-26

**Statistiques 'Palettes' et 'Colis' fausses : unités mélangées et nombre de livraisons présenté comme nombre de colis** — bug, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:1310`
- **Constat :** storage.ts:1310-1311 'totalPalettes: sql`COALESCE(SUM(CAST(${deliveries.quantity} as INTEGER)), 0)`, totalPackages: sql`COALESCE(COUNT(*), 0)`' sans condition sur deliveries.unit (même chose l. 1448-1449). Affiché dans StatsPanel.tsx:79-87 comme 'Palettes' et 'Colis'. StatsPanel.tsx:101-104 affiche aussi pendingOrdersCount, qui couvre tout l'historique, sous le titre 'Statistiques du mois'.
- **Impact :** Les volumes mensuels sont faux (colis comptés comme palettes, 'Colis' = nombre de livraisons) et peuvent fausser le pilotage du magasin.
- **Recommandation :** Utiliser SUM(CASE WHEN unit='palettes' THEN quantity ELSE 0 END) et SUM(CASE WHEN unit='colis' THEN quantity ELSE 0 END), calculés sans innerJoin orders : seul le délai moyen a besoin de la jointure. Libeller pendingOrdersCount 'Commandes en attente (toutes dates)'.

### DASH-27

**Compteurs DLC incohérents avec la liste de la fenêtre : produits du jour comptés deux fois, 'stock épuisé' traités différemment** — bug, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:2245`
- **Constat :** storage.ts:2245 'expiryDate BETWEEN today AND alertDate' (expiringSoon) et l. 2251 'expiryDate <= today' (expired) : un produit qui expire aujourd'hui est compté dans les deux. Les stats excluent stockEpuise=true, mais la liste 'expires' (l. 2019-2028) ne filtre pas stockEpuise, et DlcAlertModal.tsx:196-199 affiche alors un badge 'Stock épuisé'. La date est calculée en UTC : 'today.toISOString().split('T')[0]'.
- **Impact :** Le titre 'Produits Expirés (3)' ne correspond pas au nombre de lignes affichées. Les bandeaux additionnent deux fois les produits du jour. Entre minuit et 2 h, heure de Paris, c'est la date de la veille qui est utilisée.
- **Recommandation :** Définir une seule fois les conditions SQL (expiré : expiry_date < aujourd'hui ; bientôt : entre aujourd'hui et aujourd'hui + 15 ; mêmes exclusions status != 'valides', processed_until_expiry et stock_epuise) et les réutiliser pour les stats et les listes. Pour 'aujourd'hui', utiliser `(now() AT TIME ZONE 'Europe/Paris')::date` plutôt que CURRENT_DATE nu ou toISOString.

### DASH-29

**Chaque page mobile remonte l'en-tête et la barre du bas, ce qui relance /api/user à chaque navigation** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/mobile/DashboardPage.tsx:136`
- **Constat :** DashboardPage.tsx:136 '<MobileLayout>' est rendu dans la page : 10 pages mobiles font de même (grep '<MobileLayout'). MobileLayout.tsx:22 et MobileBottomNav.tsx:47 appellent chacun useAuthUnified(), qui fait un fetch('/api/user') au montage (useAuthUnified.ts:160).
- **Impact :** À chaque tap dans la barre du bas, l'en-tête et la navigation sont démontés puis remontés (perte d'état, petit clignotement), avec 3 appels /api/user. Le contenu attend la réponse avant de charger (enabled: !!user).
- **Recommandation :** Déplacer MobileLayout dans MobileApp, autour du <Switch> de RouterProduction.tsx:108-143. Passer le titre de page par contexte ou par prop de route. Utiliser une auth partagée (DASH-04).

### DASH-30

**Les liens 'Accès rapide' et le bouton de la fenêtre DLC rechargent toute l'application** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/DashboardPage.tsx:187`
- **Constat :** DashboardPage.tsx:187-191 '<a key={item.path} href={item.path} ...>' (lien HTML natif, pas le <Link> de wouter). DlcAlertModal.tsx:141-143 'const handleViewDlcModule = () => { window.location.href = '/dlc'; };'.
- **Impact :** Chaque clic recharge le JS (environ 1,7 Mo non compressé, cf. DASH-08), refait l'authentification et vide le cache React Query. Sur mobile, cela représente plusieurs secondes d'attente pour une simple navigation interne.
- **Recommandation :** Remplacer par '<Link href={item.path}>' (wouter) dans DashboardPage, et par 'const [, navigate] = useLocation(); navigate('/dlc'); onClose();' dans DlcAlertModal.

### DASH-31

**Mobile : les accès rapides doublonnent la barre du bas, avec des libellés trompeurs, et les alertes utiles manquent** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/mobile/DashboardPage.tsx:179`
- **Constat :** DashboardPage.tsx:179-184 '{ label: "Commande", path: "/orders" }, { label: "Livraison", ... }, { label: "Tâche", ... }, { label: "Agenda", path: "/calendar" }'. MobileBottomNav.tsx:30-34 contient déjà Commandes, Livraisons et Tâches, et l. 37 nomme '/calendar' 'Calendrier'. La page mobile n'a ni alerte DLC ni informations, contrairement au desktop (Dashboard.tsx:409-425, 652).
- **Impact :** La place précieuse sur téléphone répète la navigation. 'Commande' au singulier laisse croire à un bouton 'Créer', le même écran porte deux noms, et l'employé en rayon ne voit pas les produits DLC à retirer.
- **Recommandation :** Remplacer les accès rapides par un bloc 'À traiter' : DLC expirés et proches (lien /dlc), information du jour, commandes clients à appeler. Ou proposer de vraies actions de création ('+ Nouvelle livraison'). Utiliser le même nom partout ('Calendrier').

### DASH-35

**Météo : appels séquentiels sans timeout, et l'API externe est rappelée à chaque requête si l'historique échoue** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:5683`
- **Constat :** routes.ts:5673 'const settings = await storage.getWeatherSettings();', l. 5683 'let currentYearData = await storage.getWeatherData(today, true);', l. 5684 'let previousYearData = await ...' : séquentiel. Puis fetchCurrentWeather et fetchPreviousYearWeather, aussi séquentiels (l. 5687-5720). weatherService.ts:27 et 51 : 'await fetch(url)' sans AbortSignal ni timeout. En cas d'échec de l'historique (quota, 401), rien n'est enregistré : chaque appel suivant rappelle Visual Crossing.
- **Impact :** Si l'API météo est lente, la requête bloque une des 6 connexions HTTP/1.1 du navigateur pendant tout le chargement. Le quota API s'épuise vite, ce qui entretient les échecs.
- **Recommandation :** Auto : paralléliser les deux lectures BD, puis les deux fetch externes (Promise.all), et ajouter `signal: AbortSignal.timeout(3000)` aux deux fetch de weatherService.ts. Le cache mémoire de 30 min et le cache négatif de la journée sont à valider séparément : ils empêchent de réessayer après une panne transitoire.

### DASH-37

**Informations : suppression sans confirmation avec une icône 'X', boutons de 24 px sans libellé, texte non tronqué** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/components/AnnouncementCard.tsx:356`
- **Constat :** AnnouncementCard.tsx:352-360 '<Button variant="ghost" size="sm" className="h-6 w-6 p-0 ..." onClick={() => deleteMutation.mutate(announcement.id)}><X className="h-3 w-3" /></Button>' : pas d'AlertDialog, pas d'aria-label. l. 324 '<p className="... whitespace-pre-wrap break-words">{announcement.content}</p>' : contenu entier. Vocabulaire mélangé : titre 'Informations' (l. 275), bouton 'Nouvelle' (l. 294), fenêtre du Dashboard 'Nouvelle Annonce' (Dashboard.tsx:715), état vide 'Créez la première annonce' (l. 308).
- **Impact :** Un admin qui veut 'fermer' une information la supprime définitivement en un clic. Les cibles de 24 px sont difficiles à viser. Une information longue étire la carte et pousse les tâches hors de l'écran.
- **Recommandation :** Utiliser l'icône Trash2 avec un AlertDialog 'Supprimer cette information ?', des boutons d'au moins 36 px avec aria-label 'Modifier' et 'Supprimer', et line-clamp-3 avec 'Lire la suite'. Choisir un seul terme ('Information') partout.

### DASH-38

**Mêmes queryKeys pour des URL différentes (et l'inverse) : les données affichées dépendent de la page visitée en premier** — bug, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Dashboard.tsx:282`
- **Constat :** ['/api/tasks', selectedStoreId] : Dashboard.tsx:282-285 n'envoie storeId que pour l'admin, Tasks.tsx:327-333 et mobile/DashboardPage.tsx:80-83 l'envoient pour tous. ['/api/dlc-products/stats', selectedStoreId] : DlcPage.tsx:96-99 n'envoie storeId que pour l'admin, Dashboard.tsx:236 pour tous. Inversement, '/api/stats/monthly' est rangé sous ['/api/stats/monthly', id] (Dashboard.tsx:29) et sous [statsUrl, id] (StatsPanel.tsx:21).
- **Impact :** Après un passage par la page Tâches, l'accueil d'un manager affiche ses tâches pendant 30 s, puis la liste se vide au refetch. Les compteurs DLC peuvent différer entre l'accueil et la page DLC selon l'ordre de visite. La même statistique est téléchargée deux fois.
- **Recommandation :** Centraliser les requêtes dans un module (ex. client/src/lib/queries.ts : tasksQuery(storeId), dlcStatsQuery(storeId)…). La queryKey doit être exactement l'URL appelée, construite par une seule fonction partagée par toutes les pages.

### DASH-14

**Les informations sont récupérées deux fois sous deux clés différentes, qui ne s'invalident pas ensemble** — perf-api, sévérité basse, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:97`
- **Constat :** Dashboard.tsx:98 'queryKey: ['/api/announcements/recent', selectedStoreId]' appelle '/api/announcements?...&recent=true'. AnnouncementCard.tsx:134 'queryKey: ['/api/announcements', selectedStoreId, user?.role]' appelle la même route. Après création ou suppression, AnnouncementCard.tsx:192 et 226 n'invalident que ['/api/announcements'], préfixe qui ne couvre pas '/api/announcements/recent'.
- **Impact :** Une requête en double (avec son N+1 serveur) à chaque ouverture. Une information supprimée peut encore surgir dans la fenêtre 'Nouvelle Annonce' tant que le cache n'est pas périmé.
- **Recommandation :** Dans Dashboard, utiliser exactement la clé ['/api/announcements', selectedStoreId, user?.role] avec le même queryFn que AnnouncementCard, extrait dans une fonction partagée (même URL, renvoie le tableau). Calculer l'annonce récente (moins de 2 jours, la plus récente) via l'option `select` ou un useMemo. Les invalidations existantes couvriront alors les deux usages.

### DASH-16

**Les requêtes DLC sont invalidées à chaque montage du tableau de bord, ce qui annule le cache** — perf-client, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Dashboard.tsx:23`
- **Constat :** Dashboard.tsx:23-26 'useEffect(() => { queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"] }); queryClient.invalidateQueries({ queryKey: ["/api/dlc-products/stats"] }); }, [selectedStoreId, queryClient]);'. Même effet dans DlcAlertModal.tsx:45-47. Les clés contiennent déjà selectedStoreId (l. 232).
- **Impact :** Chaque retour sur l'accueil relance les stats DLC (et marque comme périmées les listes DLC de la page DLC), même si elles datent de quelques secondes.
- **Recommandation :** Corriger d'abord DASH-38 : une clé égale à l'URL réellement appelée, construite par une fonction partagée entre Dashboard et DlcPage. Supprimer ensuite les deux useEffect d'invalidation.

### DASH-20

**La classe 'border-l-3' n'existe pas dans Tailwind 3 : la barre colorée à gauche des lignes est invisible** — coherence-design, sévérité basse, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:510`
- **Constat :** Dashboard.tsx:510, 548, 590, 676 et AnnouncementCard.tsx:316 utilisent 'border-l-3 border-orange-500' (etc.). tailwind.config.ts n'étend pas borderWidth et index.css ne définit pas .border-l-3. Tailwind 3.4 ne fournit que border-l, -0, -2, -4 et -8.
- **Impact :** Le code couleur prévu (orange en attente, rouge en retard, vert livraisons, violet publicités) n'apparaît pas : les lignes se ressemblent toutes et la lecture rapide en souffre.
- **Recommandation :** Remplacer par 'border-l-4' ou 'border-l-[3px]'. Pour les informations, adapter la couleur au type (rouge Important, orange Attention…).

### DASH-33

**Script de bannière Replit (domaine tiers) chargé en production** — perf-client, sévérité basse, effort S

- **Fichier :** `client/index.html:19`
- **Constat :** client/index.html:18-19 '<!-- This is a replit script ... development mode --> <script type="text/javascript" src="https://replit.com/public/js/replit-dev-banner.js"></script>', présent aussi dans le build dist/public/index.html.
- **Impact :** Une requête DNS + TLS vers un domaine tiers à chaque chargement, avec un script bloquant en fin de body. Exécution de code externe inutile sur un outil interne.
- **Recommandation :** Supprimer cette balise, ou l'injecter seulement en dev via un plugin Vite conditionnel.

### DASH-34

**Page déclarée en anglais et zoom bloqué sur mobile** — accessibilite, sévérité basse, effort S

- **Fichier :** `client/index.html:5`
- **Constat :** client/index.html:2 '<html lang="en">' alors que toute l'interface est en français. l. 5 '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1" />'.
- **Impact :** Chrome propose de 'traduire la page', les lecteurs d'écran prononcent le français avec une voix anglaise, et les utilisateurs malvoyants ne peuvent pas zoomer sur téléphone (WCAG 1.4.4).
- **Recommandation :** Auto : passer seulement à <html lang="fr">. Retirer maximum-scale=1 après avoir vérifié (grep) que les champs (input, select, textarea) affichés sous 768 px ont tous une police d'au moins 16 px.

### DASH-36

**Météo non configurée : retry inutile puis disparition du bloc, avec décalage de l'en-tête** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/components/WeatherWidget.tsx:121`
- **Constat :** WeatherWidget.tsx:121-125 'useQuery({ queryKey: ['/api/weather/current'], refetchInterval: 30*60*1000, retry: 1 })'. routes.ts:5675-5677 renvoie 404 'Weather service not configured'. Pendant l'essai et le nouvel essai, l. 137 affiche 'Chargement météo...', puis l. 144-146 'return null'. WeatherWidget.tsx:27-54 retraduit aussi en français des conditions déjà traduites par le serveur (lang=fr, weatherService.translateConditionToFrench).
- **Impact :** Sur chaque ouverture de l'application sans météo configurée, un texte de chargement apparaît environ 1 s puis disparaît, ce qui fait bouger le sélecteur de magasin. Une requête en double est envoyée.
- **Recommandation :** Côté serveur, répondre 200 { configured: false }. Côté client, mettre 'retry: false' et 'staleTime: 30 min', et réserver une largeur fixe ou un squelette discret. Supprimer translateToFrench côté client.

### DASH-39

**Fenêtre DLC : formulations techniques ou alarmistes, et '0 jour(s)'** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/components/DlcAlertModal.tsx:178`
- **Constat :** DlcAlertModal.tsx:151 'Alerte Produits DLC - Action Requise'. l. 178 'Expiré depuis {Math.abs(getDaysUntilExpiry(product.expiryDate))} jour(s)' donne 'Expiré depuis 0 jour(s)' le jour même. l. 244 '{daysLeft <= 3 ? 'URGENT' : `${daysLeft}j`}'. Toasts avec emojis (l. 80 '✅ Produit marqué', l. 89 '❌ Erreur'). l. 285 '💡 Conseil : Ce modal réapparaîtra…'. Le terme 'modal' est un anglicisme technique.
- **Impact :** Les messages paraissent techniques ou anxiogènes. 'Expiré depuis 0 jour(s)' est déroutant et '5j' est peu lisible.
- **Recommandation :** Écrire 'Expire aujourd'hui' ou 'Expiré depuis 2 jours' (fonction de pluriel), 'Dans 5 jours', et 'Urgent' plutôt que 'URGENT'. Titre : 'Produits à retirer ou à surveiller'. Remplacer 'Ce modal' par 'Cette fenêtre'. Retirer les emojis des toasts pour rester cohérent avec les autres pages.

### DASH-40

**'Livraisons à venir' inclut les livraisons en retard, et les tâches sont triées différemment sur chaque écran** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:310`
- **Constat :** Dashboard.tsx:310-313 '.filter((d) => d.status === 'planned').sort(... scheduledDate ...).slice(0, 4)' : une livraison planifiée à une date passée s'affiche en tête sans signalement. Tâches : Dashboard.tsx:665-669 trie par createdAt croissant (les plus anciennes d'abord). mobile/DashboardPage.tsx:205-207 prend les 3 premières de l'ordre serveur (createdAt décroissant). RecentTasksCard.tsx:59-73 trie par priorité puis échéance.
- **Impact :** Une livraison en retard est présentée comme 'à venir'. Les tâches les plus urgentes ou en retard peuvent ne pas apparaître dans le top 5, et l'ordre change d'un écran à l'autre.
- **Recommandation :** Ajouter un badge rouge 'En retard' aux livraisons planifiées dans le passé, ou une section dédiée. Trier les tâches partout de la même façon : en retard, puis priorité haute, puis échéance la plus proche.

### DASH-41

**Textes secondaires en gris clair 'text-gray-400' de petite taille, sous le seuil de contraste** — accessibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:568`
- **Constat :** Dashboard.tsx:568 et 642 '<p className="text-xs text-gray-400 mt-1">', l. 702 'text-xs text-gray-400', AnnouncementCard.tsx:307 'text-xs text-gray-400'. #9ca3af sur fond blanc donne un ratio d'environ 2,5:1 (WCAG AA exige 4,5:1).
- **Impact :** Peu lisible sur les écrans de magasin en pleine lumière et pour les utilisateurs âgés.
- **Recommandation :** Utiliser au minimum text-gray-600 pour tout texte informatif, et réserver gray-400 aux éléments décoratifs.

### DASH-42

**Panneau de statistiques fixe et non repliable qui masque le calendrier** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/components/StatsPanel.tsx:54`
- **Constat :** StatsPanel.tsx:54 '<Card className="fixed bottom-6 right-6 min-w-80 shadow-lg border-gray-200">'. Même chose pour le squelette (l. 37). Aucun bouton pour replier ou fermer.
- **Impact :** Sur tablette ou petit écran, le panneau de 320 px recouvre les derniers jours du mois et leurs livraisons.
- **Recommandation :** L'intégrer dans le flux de la page (bandeau de 4 compteurs au-dessus du calendrier), ou le rendre repliable avec mémorisation de l'état. Ajouter 'placeholderData: keepPreviousData' pour éviter le squelette à chaque changement de mois.

### DASH-43

**La date de l'en-tête n'est jamais rafraîchie** — bug, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/components/DateWidget.tsx:16`
- **Constat :** DateWidget.tsx:16 'const now = new Date();' est calculé seulement au rendu, sans timer. Le Layout reste monté d'une page à l'autre.
- **Impact :** Sur un poste laissé ouvert la nuit (poste de réception, caisse), l'en-tête affiche encore la date de la veille le matin.
- **Recommandation :** Utiliser un petit hook useToday() qui programme un setTimeout jusqu'à minuit et se réarme.

### DASH-44

**Logs volumineux à chaque appel dans les chemins les plus sollicités** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/routes.ts:3263`
- **Constat :** routes.ts:1353 'console.log('Orders API called with:', ...)' (plus 'Fetching all orders' et 'Orders returned'). l. 3263-3269 : 'taskGroups: tasks.map(t => ({ id, title, groupId })).slice(0, 3)', qui parcourt toute la liste juste pour un log. storage.ts:721 (getOrders), 1250 (stats), 2303-2313 (getTasks sampleTasks), routes.ts:5811 (contenu des annonces).
- **Impact :** Du CPU et de l'I/O synchrone (stdout) consommés à chaque requête, des logs illisibles qui noient les vraies erreurs, et du contenu métier écrit dans les logs.
- **Recommandation :** Supprimer ces console.log ou les placer derrière un logger à niveau (DEBUG=logiflow:*). Ne garder que les erreurs et le log d'accès existant (index.production.ts:30-38).

### DASH-45

**Code mort : RecentTasksCard, ResponsiveDashboard, server/cache.ts, imports et variables inutilisés** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/components/tasks/RecentTasksCard.tsx:25`
- **Constat :** grep : RecentTasksCard et ResponsiveDashboard ne sont importés nulle part. RecentTasksCard.tsx:38 'fetch(`/api/tasks?...`).then(res => res.json())' sans credentials ni contrôle res.ok. server/cache.ts (cacheMiddleware, setupCompression) n'est importé nulle part. Dashboard.tsx:9 importe ShoppingCart, TrendingUp, MapPin, CheckCircle, FileText et Shield, et l. 5 CardDescription, sans les utiliser. Variables recentOrders, ordersByStatus et customerOrderStats inutilisées. Commentaire trompeur l. 649 'Section Rapprochement BL' au-dessus des informations et des tâches.
- **Impact :** Confusion lors de la maintenance (trois implémentations de la carte des tâches), et risque de réutiliser par erreur un composant défectueux.
- **Recommandation :** Supprimer RecentTasksCard.tsx, ResponsiveDashboard.tsx et server/cache.ts (ou le réécrire proprement), ainsi que les imports, variables et commentaires obsolètes du Dashboard.

### DASH-46

**Configurations de priorités et de types d'information dupliquées, avec des correspondances contre-intuitives** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:139`
- **Constat :** Dashboard.tsx:139-171 getAnnouncementPriorityConfig est un copier-coller d'AnnouncementCard.tsx:66-98 ('error' -> 'Nouveauté' violet, 'success' -> 'Important' rouge). getPriorityConfig est dupliqué dans Dashboard.tsx:341-368 et RecentTasksCard.tsx:76-103 (commentaire 'identique au module Tasks').
- **Impact :** Toute évolution des couleurs ou libellés doit être faite à 3 ou 4 endroits, d'où des incohérences visuelles entre pages. Les correspondances type -> libellé ('error' = Nouveauté) induisent les développeurs en erreur.
- **Recommandation :** Auto : extraire dans client/src/lib/statusConfig.ts les configurations identiques (types d'annonce : Dashboard et AnnouncementCard ; priorités de tâches avec variante Badge : Dashboard, Tasks.tsx, RecentTasksCard s'il est conservé), sans modifier aucun libellé, couleur ni valeur. Ne pas fusionner la variante mobile (classes CSS) et ne pas faire de migration des valeurs de type.
