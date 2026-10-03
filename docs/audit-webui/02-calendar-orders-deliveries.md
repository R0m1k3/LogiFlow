# Calendrier, Commandes, Livraisons

_58 constats vérifiés — 7 haute, 32 moyenne, 19 basse._

## Pages analysées

### `/calendar (desktop)`

**Rôle :** Vue mensuelle des commandes fournisseurs, des livraisons prévues/reçues et des publicités du magasin sélectionné, avec un panneau de statistiques du mois. C'est le point d'entrée pour planifier et ouvrir la fiche d'une commande ou d'une livraison.

**Tâches principales de l'utilisateur :**
- Voir ce qui est commandé et livré chaque jour du mois
- Passer au mois précédent ou suivant
- Créer une commande ou une livraison à une date
- Ouvrir la fiche d'une commande ou livraison (modifier, valider, supprimer)
- Lire le commentaire d'une livraison
- Consulter les chiffres du mois (commandes, livraisons, palettes, colis)

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/orders?startDate&endDate&storeId | au montage, à chaque changement de mois ou de magasin (fetch() manuel dans queryFn) | server/routes.ts:1343 -> storage.getOrdersByDateRange (storage.ts:725) + loadDeliveriesByOrderIds (storage.ts:522) | Charge chaque commande avec group complet (logo base64 compris), supplier complet, creator, et toutes les livraisons liées, elles-mêmes avec group/supplier/creator complets. Plage limitée à startOfMonth..endOfMonth alors que la grille affiche 42 jours. |
| GET /api/deliveries?startDate&endDate&storeId | au montage, à chaque changement de mois ou de magasin | server/routes.ts:1752 -> storage.getDeliveriesByDateRange (storage.ts:939) + attachOrdersAndCommentCounts (loadOrdersByIds + loadReconciliationCommentCounts en Promise.all) | Pas de N+1 (regroupement en 2 requêtes), mais colonnes lourdes : group.* (logo), order complet imbriqué. |
| GET /api/ad-campaigns?year&storeId(admin seulement) | au montage et au changement d'année ou de magasin | server/routes.ts:4595 -> storage.getPublicities (storage.ts:1502) | Le paramètre groupIds est ignoré côté storage : toute l'année, tous magasins, participations avec group complet. Le filtrage par magasin et par jour se fait en JS, 42 fois par rendu. |
| GET /api/stats/monthly?year&month&storeId | au montage de StatsPanel et au changement de mois | server/routes.ts:4155 -> storage.getMonthlyStats (storage.ts:1222) | 4 requêtes SQL séquentielles. Libellés 'Colis' et 'Palettes' faux. Données fictives si NODE_ENV=development. Clé de cache [statsUrl, storeId] jamais touchée par les invalidations ['/api/stats/monthly']. |
| GET /api/groups | Layout au montage (clé partagée avec les modales) | server/routes.ts:970 -> storage.getGroups (admin, toutes colonnes dont logo) ou user.userGroups | Rechargé à chaque ouverture de modale une fois passé le staleTime de 30 s. |
| GET /api/suppliers, GET /api/orders (complet) | à l'ouverture de CreateOrderModal ou de CreateDeliveryModal | server/routes.ts:1141 -> storage.getSuppliers ; server/routes.ts:1343 -> storage.getOrders (storage.ts:678) | CreateDeliveryModal télécharge tout l'historique des commandes pour remplir une liste déroulante. |

**Lisibilité / simplicité :** La page est dense et difficile à lire. Le mois apparaît deux fois (en-tête et barre de navigation). La légende (bleu primaire, vert foncé, gris) ne correspond pas aux couleurs de la grille (bleu clair, jaune pour 'planifié', vert clair, violet pour les pubs). Les éléments sont écrits en 11 px avec des abréviations (P/C) et des icônes de 8 px. Seuls 2 éléments sont visibles par jour, le reste passe par '+N autres', ce qui ouvre des modales imbriquées. Un clic n'importe où dans une case ouvre 'Création rapide', même pour un utilisateur sans droits. Le bouton '+' n'apparaît qu'au survol. Le panneau de statistiques, fixé en bas à droite, recouvre les dernières cases et affiche des chiffres faux. Un spinner plein écran remplace la grille à chaque changement de mois. Les jours des mois voisins sont affichés mais toujours vides. Le passage au mois suivant saute un mois les 29, 30 et 31. Il n'y a aucun état d'erreur : un échec d'API donne un calendrier vide silencieux.

### `/calendar (mobile)`

**Rôle :** Calendrier mensuel simplifié pour téléphone : des points de couleur indiquent les jours avec des commandes ou des livraisons, et la liste du jour sélectionné s'affiche dessous.

**Tâches principales de l'utilisateur :**
- Voir les jours avec commandes et livraisons
- Voir la liste des événements d'un jour

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/orders?startDate&endDate&storeId | au montage et au changement de mois (enabled: !!user) | server/routes.ts:1343 -> storage.getOrdersByDateRange (storage.ts:725) | Clé ['/api/orders', storeId, 'yyyy-MM'] différente de celle du desktop pour la même donnée. Les erreurs sont avalées (return []). |
| GET /api/deliveries?startDate&endDate&storeId | au montage et au changement de mois | server/routes.ts:1752 -> storage.getDeliveriesByDateRange (storage.ts:939) | Même charge utile lourde que sur desktop pour n'afficher qu'un titre et un statut. |

**Lisibilité / simplicité :** La page est lisible mais en lecture seule : les cartes ne sont pas cliquables, et on ne peut ni ouvrir une fiche, ni valider, ni créer. Le statut s'affiche brut en anglais ('pending', 'planned', 'delivered'). Les titres 'Cmd #12' et 'Liv #34' sont techniques (orderNumber n'existe pas dans le schéma). Les jours des semaines voisines sont affichés sans données. Il n'y a ni état de chargement ni état d'erreur.

### `/orders (desktop)`

**Rôle :** Liste de toutes les commandes fournisseurs du magasin, avec recherche, filtre par statut, pagination, création, modification et suppression.

**Tâches principales de l'utilisateur :**
- Retrouver une commande (fournisseur, statut)
- Créer une commande
- Modifier une commande
- Supprimer une commande
- Voir le détail et les livraisons liées

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/orders?storeId | au montage et au changement de magasin (fetch() manuel, clé [ordersUrl, storeId]) | server/routes.ts:1343 (branche sans dates, 1372/1450) -> storage.getOrders (storage.ts:678) + loadDeliveriesByOrderIds (storage.ts:522) | Tout l'historique sans LIMIT, puis pagination côté client par 20. Pour un admin en 'tous magasins', ce sont toutes les commandes de tous les magasins. |
| GET /api/groups | au montage | server/routes.ts:970 -> storage.getGroups / user.userGroups | Résultat jamais utilisé dans la page. |
| DELETE /api/orders/:id | au clic sur 'Supprimer définitivement' | server/routes.ts:1655 -> storage.getOrder (storage.ts:783, 2 requêtes) + storage.deleteOrder (storage.ts:880) | Après succès, invalidateQueries puis refetchQueries de toutes les variantes /api/orders et /api/deliveries, y compris celles qui sont inactives. |
| PUT /api/orders/:id | à l'enregistrement de EditOrderModal | server/routes.ts:1620 -> storage.getOrder + storage.updateOrder (storage.ts:871) | Jamais atteint : les arguments de apiRequest sont inversés côté client. |
| POST /api/orders, GET /api/suppliers | ouverture et validation de CreateOrderModal | server/routes.ts:1552 -> storage.createOrder ; server/routes.ts:1141 -> storage.getSuppliers | Liste fournisseurs complète, sans recherche. |

**Lisibilité / simplicité :** Structure claire (en-tête, filtres, tableau), mais plusieurs défauts. Le libellé 'Groupe' apparaît alors que la navigation dit 'Magasin'. L'identifiant technique '#id' est affiché. Les boutons d'action sont des icônes sans libellé ni info-bulle. Le tableau est en min-w 700px dans un conteneur overflow-hidden, donc tronqué sans défilement sur petit écran. Les couleurs de statut diffèrent du calendrier. Il n'y a ni tri ni filtre de période. La pagination revient à la page 1 après une suppression. La modification d'une commande échoue systématiquement (bug apiRequest). La suppression d'une commande liée à des livraisons renvoie un message générique. Les hooks sont appelés après un return anticipé. Les logs de debug s'exécutent par ligne à chaque frappe.

### `/orders (mobile)`

**Rôle :** Liste des commandes en cartes avec recherche et onglets Toutes, En attente, Livrées.

**Tâches principales de l'utilisateur :**
- Rechercher une commande
- Filtrer par statut

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/orders?storeId | au montage (enabled: !!user) | server/routes.ts:1343 -> storage.getOrders (storage.ts:678) | Tout l'historique, tout rendu sans pagination ni virtualisation. Erreurs avalées (return []). |

**Lisibilité / simplicité :** Les cartes affichent une flèche '>' mais ne sont pas cliquables, et aucune action n'est possible (icône Plus importée mais jamais utilisée). La date est toujours 'Date inconnue' (champ orderDate inexistant). La recherche par numéro ne fonctionne jamais (orderNumber inexistant). Le statut 'planned' s'affiche brut en anglais. L'accès n'est pas restreint pour les employés, alors que la version desktop les bloque. Une erreur serveur s'affiche comme 'Aucune commande trouvée'.

### `/deliveries (desktop)`

**Rôle :** Liste des livraisons du magasin : planifier, modifier, valider la réception (saisie du n° de BL), marquer le contrôle qualité, supprimer.

**Tâches principales de l'utilisateur :**
- Voir les livraisons à recevoir
- Valider une livraison reçue avec le n° de BL
- Marquer le contrôle comme effectué
- Créer ou modifier une livraison et la lier à une commande
- Supprimer une livraison

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/deliveries?storeId | au montage et au changement de magasin (clé ['/api/deliveries', storeId, user.role]) | server/routes.ts:1752 (branche sans dates 1781/1859) -> storage.getDeliveries (storage.ts:885) + attachOrdersAndCommentCounts | Tout l'historique sans LIMIT, pagination côté client. Filtre withBL fait en JS (routes.ts:1864). |
| GET /api/groups | au montage | server/routes.ts:970 | Résultat jamais utilisé. |
| POST /api/deliveries/:id/validate | ValidateDeliveryModal | server/routes.ts:2604 -> storage.getDelivery (storage.ts:1004 : 4-6 requêtes séquentielles dont getOrder) + validateDelivery + updateOrder | Le contrôle d'accès au magasin n'est fait que pour le rôle manager. |
| PUT /api/deliveries/:id/control | au clic sur l'icône CheckCircle orange, sans confirmation | server/routes.ts:2678 -> storage.getDelivery + markDeliveryControlValidated | Aucun contrôle d'appartenance au magasin. |
| DELETE /api/deliveries/:id | ConfirmDeleteModal | server/routes.ts:2136 -> storage.getDelivery + deleteDelivery | Côté client, /api/orders n'est pas invalidé alors que les commandes embarquent leurs livraisons. |
| POST /api/deliveries, PUT /api/deliveries/:id, GET /api/orders (complet), GET /api/suppliers | modales de création et de modification | server/routes.ts:2072 / 1906 / 1343 -> storage.createDelivery / updateDelivery / getOrders | Tout l'historique des commandes est chargé pour la liste 'Commande liée'. |

**Lisibilité / simplicité :** Le tableau a 8 colonnes, n'est pas responsive (overflow-hidden, en-tête non adapté au mobile) et ses en-têtes ont deux styles différents (xs gris et sm font-black). Jusqu'à 5 icônes d'action sans libellé, dont deux coches proches pour 'valider la livraison' et 'contrôle effectué'. Le contrôle se valide en un clic sans confirmation. Le filtre 'En attente' ne correspond à aucun statut existant (planned/delivered). Les abréviations 'P' et 'C' sont utilisées pour les quantités. Le libellé 'Groupe' est utilisé à la place de 'Magasin'. Le padding est doublé (p-6 imbriqués). On ne peut pas rechercher par n° de BL. Des logs de debug sont présents.

### `/deliveries (mobile)`

**Rôle :** Liste des livraisons en cartes avec recherche et onglets Toutes, En attente, Reçues.

**Tâches principales de l'utilisateur :**
- Voir les livraisons du jour ou en retard
- Filtrer les livraisons reçues

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/deliveries?storeId | au montage | server/routes.ts:1752 -> storage.getDeliveries (storage.ts:885) | Tout l'historique, rendu intégral, erreurs avalées. |

**Lisibilité / simplicité :** La page est inutilisable en l'état. expectedDate et deliveryNumber n'existent pas : toutes les dates affichent 'Date inconnue' et les badges 'Aujourd'hui' ou 'En retard' n'apparaissent jamais. Le statut 'received' n'existe pas : l'onglet 'Reçues' est toujours vide et 'En attente' contient aussi les livraisons livrées. L'icône de statut est toujours générique. Aucune action n'est possible : impossible de valider une réception depuis le téléphone, alors que c'est la tâche principale en magasin.

### `Modales partagées (Calendrier / Commandes / Livraisons)`

**Rôle :** Formulaires de création, modification, validation, détail et confirmation de suppression des commandes et livraisons.

**Tâches principales de l'utilisateur :**
- Créer ou modifier une commande ou une livraison
- Lier une livraison à une commande
- Valider une livraison (n° de BL)
- Consulter une fiche et supprimer

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/suppliers | montage de chaque modale de formulaire | server/routes.ts:1141 -> storage.getSuppliers (storage.ts:467) | Refetch à chaque ouverture après 30 s. |
| GET /api/groups | montage de chaque modale de formulaire | server/routes.ts:970 | Admin : toutes les colonnes, logo compris. |
| GET /api/orders (sans paramètre) | montage de CreateDeliveryModal et EditDeliveryModal (queryFn par défaut) | server/routes.ts:1343 -> storage.getOrders (storage.ts:678) | Tout l'historique pour filtrer en JS par fournisseur, magasin et statut. |
| PUT /api/orders/:id | EditOrderModal et le bouton 'Valider Commande' de OrderDetailModal | server/routes.ts:1620 | Cassé depuis EditOrderModal (arguments inversés). |
| POST /api/deliveries/:id/validate | ValidateDeliveryModal | server/routes.ts:2604 | Le BL est obligatoire. Invalidation de stats inefficace. |

**Lisibilité / simplicité :** Les formulaires sont courts et clairs. En revanche, la liste fournisseurs n'a pas de recherche. Un admin en 'tous magasins' ne peut pas choisir le magasin : le premier est imposé, en lecture seule. Le libellé 'Magasin/Groupe' est ambigu. Les boutons de pied de modale sont alignés tantôt à gauche, tantôt à droite, avec des couleurs incohérentes. La fiche détail utilise un en-tête bleu même pour une livraison, une zone max-h-96 et une modale d'édition empilée par-dessus ; après modification, elle affiche des données périmées. Elle a aussi sa propre confirmation de suppression au lieu de ConfirmDeleteModal. EditDeliveryModal masque la commande liée si celle-ci est livrée. La gestion de session expirée ne fonctionne pas (regex jamais vraie, redirection vers GET /api/login inexistant). Les logs s'exécutent à chaque rendu.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [MOB-01](#mob-01) | haute | ux-simplicite | L | Versions mobiles en lecture seule : impossible d'ouvrir une fiche ou de valider une réception | `client/src/pages/mobile/DeliveriesPage.tsx:163` |
| [MOB-02](#mob-02) | haute | bug | S | Pages mobiles basées sur des champs et statuts inexistants : dates, numéros et filtres cassés | `client/src/pages/mobile/DeliveriesPage.tsx:29` |
| [MOD-01](#mod-01) | haute | perf-api | M | Les modales de livraison téléchargent toutes les commandes pour remplir une liste déroulante | `client/src/components/modals/CreateDeliveryModal.tsx:60` |
| [ORD-01](#ord-01) | haute | bug | S | Modification de commande toujours en échec : arguments de apiRequest inversés | `client/src/components/modals/EditOrderModal.tsx:61` |
| [ORD-02](#ord-02) | haute | perf-api | L | Historique complet chargé sans limite, puis pagination côté navigateur | `client/src/pages/Orders.tsx:73` |
| [SRV-01](#srv-01) | haute | perf-api | S | Logo base64 et configuration SMTP/NocoDB du magasin renvoyés dans chaque ligne de commande ou livraison | `server/storage.ts:693` |
| [SRV-03](#srv-03) | haute | perf-api | S | Aucune compression HTTP, et les assets hashés sont servis sans cache long | `server/index.production.ts:27` |
| [BUNDLE-01](#bundle-01) | moyenne | perf-bundle | M | Toutes les pages, desktop et mobile, sont importées statiquement : bundle initial d'environ 1,5 Mo | `client/src/components/RouterProduction.tsx:5` |
| [CAL-01](#cal-01) | moyenne | bug | S | Le bouton 'mois suivant' saute un mois quand on est le 29, 30 ou 31 | `client/src/pages/Calendar.tsx:171` |
| [CAL-02](#cal-02) | moyenne | perf-client | S | Calculs de debug exécutés en production dans la boucle de rendu | `client/src/components/CalendarGrid.tsx:495` |
| [CAL-03](#cal-03) | moyenne | perf-client | M | Filtrage O(42 × éléments) à chaque rendu, sans mémoïsation | `client/src/components/CalendarGrid.tsx:579` |
| [CAL-04](#cal-04) | moyenne | perf-client | S | Spinner plein écran à chaque changement de mois, et la grille attend les publicités | `client/src/pages/Calendar.tsx:204` |
| [CAL-06](#cal-06) | moyenne | coherence-design | S | La légende ne correspond pas aux couleurs utilisées dans la grille | `client/src/pages/Calendar.tsx:224` |
| [CAL-07](#cal-07) | moyenne | lisibilite | M | Éléments du calendrier illisibles : texte de 11 px, icônes de 8 px, abréviations P/C, statut codé par des points | `client/src/components/CalendarGrid.tsx:75` |
| [CAL-08](#cal-08) | moyenne | ux-simplicite | S | Un clic n'importe où dans une case ouvre 'Création rapide', même sans droits, et le '+' n'est visible qu'au survol | `client/src/pages/Calendar.tsx:181` |
| [CAL-10](#cal-10) | moyenne | ux-simplicite | S | Le panneau de statistiques en position fixe masque le bas du calendrier | `client/src/components/StatsPanel.tsx:54` |
| [CAL-11](#cal-11) | moyenne | bug | M | Panneau 'Statistiques du mois' : chiffres Palettes, Colis et 'en attente' faux | `server/storage.ts:1297` |
| [CAL-15](#cal-15) | moyenne | perf-serveur | S | getPublicities ignore le filtre magasin, charge des groupes complets et regroupe en O(P×N) | `server/storage.ts:1502` |
| [CAL-16](#cal-16) | moyenne | dette-code | M | fetch() manuels dupliqués : aucune gestion du 401 et aucun état d'erreur affiché | `client/src/pages/Calendar.tsx:62` |
| [LIV-01](#liv-01) | moyenne | bug | S | Le filtre 'En attente' des livraisons ne correspond à aucun statut existant | `client/src/pages/Deliveries.tsx:325` |
| [LIV-02](#liv-02) | moyenne | ux-simplicite | S | 'Contrôle effectué' validé en un clic, sans confirmation | `client/src/pages/Deliveries.tsx:484` |
| [MCAL-01](#mcal-01) | moyenne | lisibilite | S | Statuts affichés bruts en anglais et titres techniques 'Cmd #' / 'Liv #' | `client/src/pages/mobile/CalendarPage.tsx:293` |
| [MOB-03](#mob-03) | moyenne | ux-simplicite | S | Les erreurs serveur sont présentées comme 'Aucune commande trouvée' | `client/src/pages/mobile/OrdersPage.tsx:51` |
| [MOD-02](#mod-02) | moyenne | bug | S | Gestion de session expirée inopérante : regex jamais vraie et redirection vers une route inexistante | `client/src/lib/authUtils.ts:2` |
| [MOD-03](#mod-03) | moyenne | ux-simplicite | S | Un admin en 'Tous les magasins' ne peut pas choisir le magasin : le premier est imposé | `client/src/components/modals/CreateOrderModal.tsx:84` |
| [MOD-04](#mod-04) | moyenne | ux-simplicite | M | Choix du fournisseur dans une longue liste sans recherche | `client/src/components/modals/CreateOrderModal.tsx:188` |
| [ORD-03](#ord-03) | moyenne | perf-client | S | Log par ligne à chaque frappe et filtrage sans mémoïsation | `client/src/pages/Orders.tsx:169` |
| [ORD-05](#ord-05) | moyenne | bug | M | Invalidations qui ratent leur cible : clés de cache hétérogènes pour les mêmes données | `client/src/pages/Orders.tsx:76` |
| [ORD-06](#ord-06) | moyenne | perf-client | S | La suppression recharge toutes les variantes en cache, y compris les inactives (invalidate puis refetch) | `client/src/pages/Orders.tsx:141` |
| [ORD-10](#ord-10) | moyenne | accessibilite | S | Actions en icônes seules, sans libellé ni info-bulle, et deux coches ambiguës | `client/src/pages/Deliveries.tsx:453` |
| [ORD-11](#ord-11) | moyenne | ux-simplicite | S | Tableaux tronqués sur écrans étroits : pas de défilement horizontal | `client/src/pages/Orders.tsx:316` |
| [ORD-12](#ord-12) | moyenne | coherence-design | M | Couleurs et libellés de statut différents selon les pages, et couleurs des boutons principaux incohérentes | `client/src/pages/Orders.tsx:190` |
| [ORD-13](#ord-13) | moyenne | ux-simplicite | M | La suppression d'une commande liée à des livraisons échoue avec un message générique | `server/storage.ts:880` |
| [PERM-01](#perm-01) | moyenne | dette-code | M | Deux matrices de permissions divergentes entre client et serveur | `client/src/lib/permissions.ts:1` |
| [SRV-02](#srv-02) | moyenne | perf-api | M | Imbrications redondantes : livraisons complètes dans chaque commande et commande complète dans chaque livraison | `server/storage.ts:522` |
| [SRV-04](#srv-04) | moyenne | perf-serveur | M | Utilisateur et magasins rechargés deux fois par requête API | `server/localAuth.production.ts:195` |
| [SRV-05](#srv-05) | moyenne | perf-serveur | S | Toutes les réponses JSON sont clonées récursivement pour retirer smtpPassword | `server/routes.ts:168` |
| [SRV-07](#srv-07) | moyenne | bug | S | Manager ou directeur multi-magasins sans sélection : seul le premier magasin est renvoyé, en silence | `server/routes.ts:1419` |
| [SRV-08](#srv-08) | moyenne | bug | S | Contrôles d'accès par magasin incomplets (validation, contrôle, lecture, statistiques) | `server/routes.ts:2624` |
| [CAL-05](#cal-05) | basse | bug | S | Les jours des mois voisins sont affichés mais toujours vides | `client/src/pages/Calendar.tsx:33` |
| [CAL-12](#cal-12) | basse | perf-serveur | S | Statistiques mensuelles : 4 requêtes séquentielles, sans cache | `server/storage.ts:1270` |
| [CAL-13](#cal-13) | basse | bug | S | La fenêtre '+X autres' affiche la date de création des commandes au lieu de la date prévue | `client/src/components/CalendarGrid.tsx:324` |
| [CAL-14](#cal-14) | basse | ux-simplicite | M | Seulement 2 éléments par jour, et des modales imbriquées avec des contournements de z-index et d'état | `client/src/components/CalendarGrid.tsx:177` |
| [CAL-17](#cal-17) | basse | perf-client | S | Double chargement au démarrage : les requêtes partent avant la sélection automatique du magasin | `client/src/components/Layout.tsx:70` |
| [MOD-05](#mod-05) | basse | perf-client | S | useEffect et logs exécutés à chaque rendu (dépendance recréée) | `client/src/components/modals/CreateOrderModal.tsx:49` |
| [MOD-06](#mod-06) | basse | perf-client | S | Données de référence rechargées à chaque ouverture de modale | `client/src/lib/queryClient.ts:77` |
| [MOD-07](#mod-07) | basse | dette-code | S | Mutation morte, confirmation de suppression dupliquée et rôles codés en dur | `client/src/components/modals/OrderDetailModal.tsx:70` |
| [MOD-08](#mod-08) | basse | ux-simplicite | M | Modale d'édition empilée sur la fiche, données périmées après modification, contenu limité à 384 px | `client/src/components/modals/OrderDetailModal.tsx:437` |
| [MOD-09](#mod-09) | basse | coherence-design | S | Pieds de modale et boutons d'action incohérents | `client/src/components/modals/CreateOrderModal.tsx:245` |
| [MOD-10](#mod-10) | basse | ux-simplicite | S | Le champ 'Commande liée' disparaît si la commande liée est déjà livrée | `client/src/components/modals/EditDeliveryModal.tsx:191` |
| [ORD-04](#ord-04) | basse | perf-client | S | Requête /api/groups inutilisée | `client/src/pages/Orders.tsx:101` |
| [ORD-07](#ord-07) | basse | bug | S | Hooks appelés après un return anticipé (règle des hooks violée) | `client/src/pages/Orders.tsx:41` |
| [ORD-08](#ord-08) | basse | lisibilite | S | 'Groupe' et 'Magasin/Groupe' au lieu de 'Magasin' | `client/src/pages/Orders.tsx:323` |
| [ORD-09](#ord-09) | basse | lisibilite | S | Identifiants techniques affichés sous des formes différentes selon l'écran | `client/src/components/modals/OrderDetailModal.tsx:209` |
| [ORD-14](#ord-14) | basse | ux-simplicite | S | Retour à la page 1 après chaque suppression, et confirmation fermée avant la fin de l'action | `client/src/components/ui/pagination.tsx:157` |
| [ORD-15](#ord-15) | basse | ux-simplicite | M | Pas de tri, pas de filtre de période, recherche sans n° de BL | `client/src/pages/Deliveries.tsx:176` |
| [SRV-06](#srv-06) | basse | perf-serveur | S | Logs console à chaque appel des chemins chauds | `server/routes.ts:1353` |
| [SRV-09](#srv-09) | basse | perf-serveur | S | Le filtre withBL est appliqué en JavaScript après le chargement complet | `server/routes.ts:1864` |

### MOB-01

**Versions mobiles en lecture seule : impossible d'ouvrir une fiche ou de valider une réception** — ux-simplicite, sévérité haute, effort L

- **Fichier :** `client/src/pages/mobile/DeliveriesPage.tsx:163`
- **Constat :** DeliveriesPage.tsx:163-195 `<Card key={delivery.id}>` sans onClick, mais avec `<ChevronRight>` (192) qui suggère un lien. OrdersPage.tsx:146-177 idem : `Plus` est importé (16) et jamais utilisé, aucun bouton de création. CalendarPage.tsx:266-300 : cartes d'événement non cliquables.
- **Impact :** L'employé qui réceptionne un camion avec son téléphone ne peut ni valider la livraison ni saisir le BL. Il doit passer sur un poste fixe. La flèche affichée trompe l'utilisateur, qui touche sans résultat.
- **Recommandation :** Rendre les cartes cliquables et ouvrir une fiche plein écran (Sheet) qui réutilise OrderDetailModal. Ajouter sur chaque livraison 'planned' un bouton visible 'Valider la réception' qui ouvre ValidateDeliveryModal. Ajouter un bouton flottant '+' pour créer (selon les permissions). Retirer le chevron tant que la carte n'est pas cliquable.

### MOB-02

**Pages mobiles basées sur des champs et statuts inexistants : dates, numéros et filtres cassés** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/mobile/DeliveriesPage.tsx:29`
- **Constat :** DeliveriesPage.tsx:27-35 type `{ deliveryNumber?, expectedDate, status }`, ligne 185 `delivery.expectedDate && ... : 'Date inconnue'`, lignes 41/63-64 filtre `'received'`. OrdersPage.tsx:25-33 `{ orderNumber?, orderDate }`, lignes 167-170 `order.orderDate ... : 'Date inconnue'`. Or shared/schema.ts:121-133 (orders : plannedDate, aucun orderNumber/orderDate) et 136-146 (deliveries : scheduledDate, status 'planned, delivered'). Aucune occurrence de orderNumber, deliveryNumber ou expectedDate côté serveur (grep). CalendarPage.tsx:105/113 `Cmd #${order.orderNumber || order.id}`.
- **Impact :** Sur téléphone, toutes les commandes et livraisons affichent 'Date inconnue'. Les badges 'Aujourd'hui' et 'En retard' n'apparaissent jamais. L'onglet 'Reçues' est toujours vide et 'En attente' inclut les livraisons déjà livrées. La recherche par numéro ne trouve rien. Le statut 'planned' s'affiche brut.
- **Recommandation :** Correction minimale et mécanique : expectedDate→scheduledDate, orderDate→plannedDate, filtre 'received'→'delivered' (et 'pending'→status==='planned' pour les livraisons), ajout d'un badge 'planned' ('Planifiée'), suppression de orderNumber/deliveryNumber (afficher l'id). Mutualiser les libellés avec le desktop est un chantier à part (voir ORD-12).

### MOD-01

**Les modales de livraison téléchargent toutes les commandes pour remplir une liste déroulante** — perf-api, sévérité haute, effort M

- **Fichier :** `client/src/components/modals/CreateDeliveryModal.tsx:60`
- **Constat :** CreateDeliveryModal.tsx:60-62 `useQuery<OrderWithRelations[]>({ queryKey: ['/api/orders'] })` passe par la queryFn par défaut, soit GET /api/orders sans storeId ni dates, donc storage.getOrders() complet avec livraisons imbriquées. Le résultat est ensuite filtré en JS (65-73) par fournisseur, magasin et statut. Même chose dans EditDeliveryModal.tsx:50-61.
- **Impact :** L'ouverture de 'Nouvelle livraison' ou 'Modifier livraison' déclenche le plus gros appel de l'application (toutes les commandes, tous magasins pour un admin). Le formulaire est lent et l'appel est refait à chaque ouverture après 30 s.
- **Recommandation :** Ajouter `GET /api/orders?storeId=&supplierId=&status=pending,planned&light=1` qui renvoie {id, plannedDate, status}. Ne lancer la requête qu'une fois le fournisseur choisi (`enabled: !!formData.supplierId`), avec une clé ['/api/orders', 'open', {storeId, supplierId}].

### ORD-01

**Modification de commande toujours en échec : arguments de apiRequest inversés** — bug, sévérité haute, effort S

- **Fichier :** `client/src/components/modals/EditOrderModal.tsx:61`
- **Constat :** EditOrderModal.tsx:61 `await apiRequest("PUT", `/api/orders/${order?.id}`, data);` alors que queryClient.ts:10-15 définit `apiRequest(url: string, method: string = 'GET', body?)`. Le résultat est fetch('PUT', { method: '/api/orders/12' }), qui lève un TypeError (méthode HTTP invalide). C'est le seul appel de ce type dans client/src (grep).
- **Impact :** Aucune commande ne peut être modifiée, ni depuis la page Commandes ni depuis la fiche ouverte dans le calendrier. L'utilisateur voit seulement 'Impossible de modifier la commande'.
- **Recommandation :** Remplacer par `await apiRequest(`/api/orders/${order?.id}`, 'PUT', data);`. Si l'on type method, utiliser `type HttpMethod = 'GET'|'POST'|'PUT'|'PATCH'|'DELETE'` pour ne casser aucun appelant existant.

### ORD-02

**Historique complet chargé sans limite, puis pagination côté navigateur** — perf-api, sévérité haute, effort L

- **Fichier :** `client/src/pages/Orders.tsx:73`
- **Constat :** Orders.tsx:73 `const ordersUrl = `/api/orders${selectedStoreId ? `?storeId=${selectedStoreId}` : ''}`;` appelle routes.ts:1372/1450 `storage.getOrders(groupIds)` (storage.ts:678-723 : aucun LIMIT, plus toutes les livraisons liées). Ensuite, Orders.tsx:180-188 `usePagination(filteredOrders, 20)`. Même chose pour Deliveries.tsx:80 vers getDeliveries (885-937), et pour OrdersPage.tsx:43-48 et DeliveriesPage.tsx:45-50 sur mobile, qui rendent tout sans pagination.
- **Impact :** Le temps de chargement grandit sans fin avec l'historique. Un admin en 'Tous les magasins' télécharge toutes les commandes de tous les magasins pour n'en voir que 20. La mémoire et le rendu mobile se dégradent.
- **Recommandation :** Créer un endpoint paginé `GET /api/orders?storeId&page&limit&status&search&from&to` qui renvoie { items, total }. Faire le filtre statut, la recherche (ILIKE sur suppliers.name, notes, bl_number) et le tri en SQL, avec par défaut les 3 derniers mois. Côté client : useQuery avec placeholderData: keepPreviousData, ou useInfiniteQuery sur mobile.

### SRV-01

**Logo base64 et configuration SMTP/NocoDB du magasin renvoyés dans chaque ligne de commande ou livraison** — perf-api, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:693`
- **Constat :** storage.ts:693, 740, 913, 967, 553, 599 : `group: groups,` sélectionne toutes les colonnes de groups, dont shared/schema.ts:67 `logo: text("logo"), // Logo en data URI (data:image/png;base64,...)`, smtpHost, smtpUser, smtpSenderEmail, address, phone, nocodb*. Le groupe est répété pour chaque commande (getOrders), pour chaque livraison imbriquée dans une commande (loadDeliveriesByOrderIds:553) et pour chaque commande imbriquée dans une livraison (loadOrdersByIds:599). Même chose pour les participations de getPublicities (1536). Les pages n'utilisent que group.name et group.color, et BLReconciliation.tsx:298-325 utilise nocodbTableName, nocodbConfigId et webhookUrl.
- **Impact :** Avec un logo de quelques dizaines de Ko, la liste des commandes pèse plusieurs Mo, voire des dizaines. Le chargement des pages Calendrier, Commandes et Livraisons, ainsi que des modales de livraison, devient lent, surtout sur mobile. Des données de configuration inutiles sont aussi exposées au navigateur.
- **Recommandation :** Projeter group: {id, name, color, nocodbConfigId, nocodbTableName, webhookUrl} (sans logo ni smtp*) et supplier: {id, name, email, requiresControl, hasDlc, automaticReconciliation}. Créer des types dédiés (GroupSummary, SupplierSummary) dans OrderWithRelations et DeliveryWithRelations, puis vérifier tous les consommateurs (BLReconciliation, ReconciliationModal, Avoirs, CustomerOrders, Dashboard, exports serveur) avant de livrer.

### SRV-03

**Aucune compression HTTP, et les assets hashés sont servis sans cache long** — perf-api, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `server/index.production.ts:27`
- **Constat :** index.production.ts:27-28 n'enregistre que `express.json` et `express.urlencoded`. Aucun middleware compression (absent de package.json) et aucune conf gzip dans le dépôt. Ligne 143 : `app.use('/assets', express.static(join(publicPath, 'assets')));` sans maxAge ni immutable. Le build actuel pèse 1 081 745 octets (index-CCl1yENM.js) + 410 243 octets (vendor-charts) + 120 775 octets de CSS.
- **Impact :** Les JSON de listes (déjà gonflés, voir SRV-01 et SRV-02) et environ 1,7 Mo de JS/CSS transitent non compressés. Les assets sont revalidés à chaque visite. Le premier affichage et chaque navigation sont nettement plus lents, surtout en 4G.
- **Recommandation :** Ajouter `compression` (et @types/compression) aux dépendances et `--external:compression` dans la commande esbuild du Dockerfile, puis `app.use(compression())` avant registerRoutes (index.production.ts et index.ts). Servir /assets avec `{ maxAge: '1y', immutable: true }` et envoyer index.html avec `Cache-Control: no-cache`. Vérifier d'abord la configuration gzip du nginx externe.

### BUNDLE-01

**Toutes les pages, desktop et mobile, sont importées statiquement : bundle initial d'environ 1,5 Mo** — perf-bundle, sévérité moyenne, effort M

- **Fichier :** `client/src/components/RouterProduction.tsx:5`
- **Constat :** RouterProduction.tsx:5-44 : environ 30 imports de pages en tête (Analytics, BackupManager, Utilities, BLReconciliation, DatabaseDebug, NocoDBConfig, pages mobiles…), sans React.lazy. Le build produit dist/public/assets/index-CCl1yENM.js (1 081 745 octets) et vendor-charts-gtSIDI7m.js (410 243 octets, recharts), tous deux chargés avant le premier affichage du Calendrier ou des Commandes.
- **Impact :** Le premier affichage est lent, surtout sur les postes de magasin et en 4G, et aggravé par l'absence de gzip (SRV-03).
- **Recommandation :** React.lazy par route avec <Suspense fallback={<PageSkeleton/>}>, en séparant les arbres desktop et mobile, ET ajouter `window.addEventListener('vite:preloadError', () => window.location.reload())` dans main.tsx, avec index.html servi en no-cache (voir SRV-03).

### CAL-01

**Le bouton 'mois suivant' saute un mois quand on est le 29, 30 ou 31** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Calendar.tsx:171`
- **Constat :** Calendar.tsx:171-179 `const newDate = new Date(currentDate); ... newDate.setMonth(newDate.getMonth() + 1);`. Le 31 octobre, cela donne le 31 novembre, qui n'existe pas, donc le 1er décembre : novembre est sauté. StatsPanel suit le même currentDate. La version mobile utilise correctement addMonths/subMonths (CalendarPage.tsx:148-151).
- **Impact :** Les utilisateurs qui ouvrent le calendrier en fin de mois ne peuvent pas afficher le mois suivant normalement. Les commandes de ce mois semblent absentes.
- **Recommandation :** Remplacer navigateMonth par `setCurrentDate(d => direction === 'prev' ? subMonths(startOfMonth(d), 1) : addMonths(startOfMonth(d), 1))`. Le bouton 'Aujourd'hui' est un ajout produit, à traiter séparément.

### CAL-02

**Calculs de debug exécutés en production dans la boucle de rendu** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/components/CalendarGrid.tsx:495`
- **Constat :** CalendarGrid.tsx:495-506 `console.log('📅 All orders dates:', orders.map(o => ({...})))` et 519-525 / 542-548 (log pour chaque élément trouvé, avec `format(date,'yyyy-MM-dd')`). vite.config.ts:29 retire l'appel console.log (`pure`) mais pas ses arguments. Le bundle prod contient bien `s.length>0&&v.getDate()===1&&(s.length,s[0],s.map(S=>{...plannedDate...}))`. Il reste aussi des console.warn dans les boucles (385, 402, 410, 511, 534), et des console.log non protégés par DEV aux lignes 444 et 452.
- **Impact :** Des tableaux et des formatages de dates sont créés inutilement à chaque rendu de la grille (42 cases). Le navigateur peut être inondé de warnings si une donnée est incomplète. La console est inutilisable pour le support.
- **Recommandation :** Supprimer ces blocs de debug (et ceux de Calendar.tsx:53-60, 71-73, 102-109, 120-122, 146-153, 164-166). Garder au plus un console.warn unique hors boucle.

### CAL-03

**Filtrage O(42 × éléments) à chaque rendu, sans mémoïsation** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/components/CalendarGrid.tsx:579`
- **Constat :** CalendarGrid.tsx:575-580 : dans `paddedDays.map`, `getItemsForDate(date)` parcourt et parse (safeDate) toutes les commandes et toutes les livraisons, et `getPublicitiesForDate(date)` parcourt toutes les publicités de l'année. Aucun useMemo. CalendarGrid n'est pas memo, et l'état des modales est dans Calendar.tsx (26-30), donc l'ouverture de 'Création rapide' ou d'une fiche recalcule toute la grille. Même chose sur mobile : CalendarPage.tsx:139-145 et 224.
- **Impact :** Avec quelques centaines d'éléments par mois, plusieurs dizaines de milliers d'opérations par rendu. L'interface rame à l'ouverture des modales et à la navigation, surtout sur les postes de magasin peu puissants.
- **Recommandation :** Construire une seule fois, avec useMemo, une Map<'yyyy-MM-dd', {orders, deliveries, pubs}> (une passe sur chaque liste). Envelopper CalendarGrid dans React.memo et passer des handlers stables (useCallback).

### CAL-04

**Spinner plein écran à chaque changement de mois, et la grille attend les publicités** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Calendar.tsx:204`
- **Constat :** Calendar.tsx:204 `const isLoading = loadingOrders || loadingDeliveries || loadingPublicities;` puis 282-285 : un spinner remplace toute la grille. Chaque mois a une nouvelle clé (38-41, 87-90), sans placeholderData et sans préchargement des mois voisins.
- **Impact :** La grille disparaît puis réapparaît à chaque clic sur les flèches. L'affichage dépend de la requête la plus lente (publicités, sans rapport avec la logistique), ce qui donne une impression de lenteur.
- **Recommandation :** Ajouter `placeholderData: keepPreviousData` sur les 3 requêtes et afficher la grille avec un indicateur discret (barre fine ou opacité). Ne pas bloquer sur loadingPublicities. Précharger mois-1 et mois+1 avec queryClient.prefetchQuery. Pour le premier chargement, utiliser un squelette de grille plutôt qu'un spinner.

### CAL-06

**La légende ne correspond pas aux couleurs utilisées dans la grille** — coherence-design, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Calendar.tsx:224`
- **Constat :** Calendar.tsx:224-237 : la légende utilise `bg-primary` (bleu vif), `bg-secondary` (vert foncé hsl(120,61%,34%)) et `bg-delivered` (gris). La grille utilise CalendarGrid.tsx:57-61 `bg-gray-400` (livré), `bg-yellow-300` (planifié, absent de la légende), `bg-blue-300` (commande), et 102-105 `bg-green-200` (livraison). Les publicités violettes (658) ne figurent pas dans la légende.
- **Impact :** L'utilisateur ne peut pas décoder le calendrier : il ne sait pas ce que signifient le jaune ou le violet.
- **Recommandation :** Générer la légende à partir des mêmes constantes que la grille et ajouter 'Commande planifiée' (jaune) et 'Publicité' (violet). Voir aussi ORD-12 pour un composant de statut unique.

### CAL-07

**Éléments du calendrier illisibles : texte de 11 px, icônes de 8 px, abréviations P/C, statut codé par des points** — lisibilite, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `client/src/components/CalendarGrid.tsx:75`
- **Constat :** CalendarGrid.tsx:75 `style={{fontSize: '11px', lineHeight: '1.2'}}`. 81-82 `w-4 h-4 ... <Link className="w-2 h-2"`. 50 `${quantity}${unit === 'palettes' ? 'P' : 'C'}`. 85-87 et 148-150 : statut indiqué par un point de 2×2 px avec un simple title. Le mois est affiché deux fois (Calendar.tsx:217-219 et 254-256).
- **Impact :** Des employés non techniciens, sur des écrans de magasin, ne lisent pas les noms de fournisseurs et ne comprennent pas 'P', 'C' ni les pastilles.
- **Recommandation :** Même reco, en corrigeant la preuve : le point de statut fait 8×8 px (w-2 h-2), les icônes de liaison et de commentaire 8 px, et l'icône livré 12 px.

### CAL-08

**Un clic n'importe où dans une case ouvre 'Création rapide', même sans droits, et le '+' n'est visible qu'au survol** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Calendar.tsx:181`
- **Constat :** Calendar.tsx:181-184 `handleDateClick` ouvre QuickCreate sans vérifier de permission, alors que le bouton 'Nouveau' (267) est conditionné. CalendarGrid.tsx:594-603 : onClick sur toute la case. QuickCreateMenu.tsx:67-71 affiche alors 'Vous n'avez pas les permissions…'. CalendarGrid.tsx:644 et 675 `opacity-0 group-hover:opacity-100` pour le bouton '+'.
- **Impact :** Des modales s'ouvrent par erreur au moindre clic, avec un message d'erreur pour les employés. Sur tablette tactile, le bouton '+' est introuvable.
- **Recommandation :** Ne pas rendre la case cliquable pour créer : utiliser un bouton '+' toujours visible, et uniquement si l'utilisateur a orders:create ou deliveries:create. Un clic sur la case peut ouvrir une vue 'jour'.

### CAL-10

**Le panneau de statistiques en position fixe masque le bas du calendrier** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/components/StatsPanel.tsx:54`
- **Constat :** StatsPanel.tsx:54 `<Card className="fixed bottom-6 right-6 min-w-80 shadow-lg border-gray-200">` (et 37 pour le squelette). Il est rendu par Calendar.tsx:335. Il n'est ni repliable ni déplaçable.
- **Impact :** Les cases samedi et dimanche des dernières semaines sont recouvertes : les livraisons qui y figurent ne sont pas visibles.
- **Recommandation :** Intégrer les 4 indicateurs dans un bandeau de KPI sous l'en-tête, ou dans un panneau latéral repliable.

### CAL-11

**Panneau 'Statistiques du mois' : chiffres Palettes, Colis et 'en attente' faux** — bug, sévérité moyenne, effort M

- **Fichier :** `server/storage.ts:1297`
- **Constat :** storage.ts:1297-1313 : `totalPalettes: SUM(CAST(quantity as INTEGER))` sans filtre sur unit, donc palettes et colis sont additionnés. `totalPackages: COUNT(*)`, affiché 'Colis' (StatsPanel.tsx:85-87), est en fait un nombre de livraisons. `.innerJoin(orders, …)` exclut les livraisons sans commande. pendingResult (1281-1290) n'est pas filtré par mois, mais il est affiché sous 'Statistiques du mois' (StatsPanel.tsx:101-105). Les lignes 1230-1240 renvoient des statistiques fictives (12, 8, 45…) si NODE_ENV==='development'.
- **Impact :** Les managers et directeurs lisent des volumes de palettes et de colis erronés. Ils peuvent prendre de mauvaises décisions et perdre confiance dans l'outil.
- **Recommandation :** Calculer `SUM(quantity) FILTER (WHERE unit='palettes')` et `SUM(quantity) FILTER (WHERE unit='colis')` en leftJoin. Filtrer 'en attente' sur le mois, ou le renommer 'Commandes en attente (toutes dates)'. Supprimer le retour de données fictives.

### CAL-15

**getPublicities ignore le filtre magasin, charge des groupes complets et regroupe en O(P×N)** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:1502`
- **Constat :** storage.ts:1502 `async getPublicities(year?: number, groupIds?: number[])`. groupIds n'est jamais utilisé dans la requête (seul `eq(publicities.year, year)`). 1532-1541 : participations avec `group: groups` (logo). 1551-1553 : `participations.filter(p => p.publicityId === publicity.id)` pour chaque publicité. Côté client, Calendar.tsx:137-141 charge l'année entière, puis CalendarGrid.tsx:399-455 filtre en JS, pour chacun des 42 jours.
- **Impact :** Les publicités de toute l'année et de tous les magasins sont transférées et traitées à chaque affichage du calendrier. Le calcul est inutile côté serveur comme côté navigateur.
- **Recommandation :** Filtrer en SQL : `publicities.end_date >= :from AND start_date <= :to` et `EXISTS (participation WHERE group_id IN groupIds)`. Projeter group {id, name, color}. Regrouper les participations avec une Map.

### CAL-16

**fetch() manuels dupliqués : aucune gestion du 401 et aucun état d'erreur affiché** — dette-code, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Calendar.tsx:62`
- **Constat :** Calendar.tsx:62-68 `const response = await fetch(url, ...); if (!response.ok) { throw new Error('Failed to fetch orders'); }`. Le message ne contient pas '401', donc il n'y a pas de redirection et queryClient.ts:79-88 relance 2 fois. Aucun rendu d'erreur : `data: orders = []`, ce qui donne un calendrier vide. Même schéma dans StatsPanel.tsx:22-31, Orders.tsx:78-87 et Deliveries.tsx:84-95. Le mobile (OrdersPage.tsx:51, DeliveriesPage.tsx:53, CalendarPage.tsx:67-69) fait `return []` sur erreur.
- **Impact :** Quand le serveur ou la session échoue, l'utilisateur voit 'Aucune commande trouvée' ou un calendrier vide, sans message ni bouton Réessayer, avec 3 fois plus d'appels.
- **Recommandation :** Utiliser la queryFn par défaut (getQueryFn), en construisant l'URL depuis la clé, ou un helper `fetchJson(url)` commun qui lève 'status: texte'. Ajouter un composant <ErrorState onRetry={refetch}/> sur chaque page.

### LIV-01

**Le filtre 'En attente' des livraisons ne correspond à aucun statut existant** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Deliveries.tsx:325`
- **Constat :** Deliveries.tsx:325 `<SelectItem value="pending">En attente</SelectItem>`. Le schéma deliveries.status vaut 'planned, delivered' (shared/schema.ts:146) et createDelivery force 'planned' (storage.ts:1099-1102). Le badge 'pending' (199) n'est donc jamais utilisé.
- **Impact :** Le filtre renvoie toujours 'Aucune livraison trouvée'. L'utilisateur conclut à tort qu'il n'a rien à recevoir.
- **Recommandation :** Retirer l'option 'pending' du Select de Deliveries.tsx. Renommer 'planned' en 'À recevoir' est un choix de libellé à valider séparément.

### LIV-02

**'Contrôle effectué' validé en un clic, sans confirmation** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Deliveries.tsx:484`
- **Constat :** Deliveries.tsx:480-490 `onClick={() => handleMarkControlValidated(delivery.id)}` lance directement PUT /api/deliveries/:id/control. L'icône CheckCircle se trouve à côté de l'icône Check de validation de livraison (469-478). Il n'y a pas d'annulation possible.
- **Impact :** Un clic involontaire marque le contrôle qualité comme fait, de façon irréversible depuis l'interface. Cela pose un risque de traçabilité.
- **Recommandation :** Utiliser un bouton texte 'Contrôle fait' avec une confirmation courte (ou une annulation via toast avec 'Annuler'), placé dans la colonne Statut à côté du badge 'Contrôle à faire'.

### MCAL-01

**Statuts affichés bruts en anglais et titres techniques 'Cmd #' / 'Liv #'** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/CalendarPage.tsx:293`
- **Constat :** CalendarPage.tsx:288-294 `<Badge ...>{event.status}</Badge>` affiche 'pending', 'planned' ou 'delivered'. Lignes 105 et 113 : `title: `Cmd #${order.orderNumber || order.id}`` et `Liv #…`.
- **Impact :** Des libellés anglais et des abréviations sont présentés à des utilisateurs francophones non techniciens.
- **Recommandation :** Partie automatisable : un helper statusLabel(status) qui renvoie pending→'En attente', planned→'Planifiée', delivered→'Livrée', utilisé dans le Badge, et suppression des références à orderNumber et deliveryNumber. La restructuration titre/sous-titre (fournisseur en titre) est à valider côté produit.

### MOB-03

**Les erreurs serveur sont présentées comme 'Aucune commande trouvée'** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/OrdersPage.tsx:51`
- **Constat :** OrdersPage.tsx:51 `if (!response.ok) return [];`. DeliveriesPage.tsx:53 idem. CalendarPage.tsx:67-69 et 92-94 idem. Le rendu affiche ensuite l'état vide (OrdersPage.tsx:140-144).
- **Impact :** Lors d'une panne ou d'une session expirée, l'employé pense qu'il n'y a aucune livraison prévue.
- **Recommandation :** Lever une erreur, afficher 'Impossible de charger les données' avec un bouton Réessayer, et rediriger vers /auth en cas de 401.

### MOD-02

**Gestion de session expirée inopérante : regex jamais vraie et redirection vers une route inexistante** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/lib/authUtils.ts:2`
- **Constat :** authUtils.ts:2 `return /^401: .*Unauthorized/.test(error.message);` alors que le serveur répond `{ message: "Authentification requise" }` (localAuth.ts:250-254), d'où un message '401: {"message":"Authentification requise"}' qui ne correspond jamais. Par ailleurs `window.location.href = "/api/login"` (CreateOrderModal.tsx:139, EditOrderModal.tsx:81, OrderDetailModal.tsx:58/91/137, CreateDeliveryModal.tsx:170, EditDeliveryModal.tsx:101, ValidateDeliveryModal.tsx:82, Orders.tsx:156, Deliveries.tsx:162) pointe vers une route qui n'existe qu'en POST (localAuth.production.ts:203), et le fallback SPA exclut /api/ (index.production.ts:158-161).
- **Impact :** Quand la session expire, l'utilisateur voit 'Impossible de créer la commande' sans comprendre et peut ressaisir plusieurs fois. Si la branche 401 était atteinte, il tomberait sur la page brute 'Cannot GET /api/login'.
- **Recommandation :** Remplacer la regex par `/^401\b/` ET remplacer les 25 occurrences de "/api/login" par "/auth" (y compris Users.tsx, Suppliers.tsx, Groups.tsx), dans le même changement. Centraliser via MutationCache ensuite.

### MOD-03

**Un admin en 'Tous les magasins' ne peut pas choisir le magasin : le premier est imposé** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/components/modals/CreateOrderModal.tsx:84`
- **Constat :** CreateOrderModal.tsx:79-85 `defaultGroupId = groups[0].id.toString();` quand aucun magasin n'est sélectionné, puis 202-221 : affichage en lecture seule (aucun Select). CreateDeliveryModal.tsx:99-105 et 265-284 : même chose.
- **Impact :** La commande ou la livraison est créée dans le premier magasin alphabétique, sans possibilité de le changer depuis le formulaire. Cela produit des erreurs de saisie difficiles à repérer.
- **Recommandation :** Si l'utilisateur a plusieurs magasins et qu'aucun n'est sélectionné dans l'en-tête, afficher un Select 'Magasin *' obligatoire, sans valeur par défaut. Sinon, afficher le magasin en lecture seule.

### MOD-04

**Choix du fournisseur dans une longue liste sans recherche** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/components/modals/CreateOrderModal.tsx:188`
- **Constat :** CreateOrderModal.tsx:188-199, CreateDeliveryModal.tsx:227-238, EditOrderModal.tsx:132-143 et EditDeliveryModal.tsx:155-166 utilisent un `<Select>` Radix contenant tous les fournisseurs, issus de GET /api/suppliers (routes.ts:1150 `storage.getSuppliers()`).
- **Impact :** Avec des dizaines de fournisseurs, il faut faire défiler une liste longue : la saisie est lente et les erreurs de sélection fréquentes.
- **Recommandation :** Utiliser un Combobox (shadcn Command) avec saisie et filtrage, en affichant d'abord les fournisseurs récents ou fréquents du magasin.

### ORD-03

**Log par ligne à chaque frappe et filtrage sans mémoïsation** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Orders.tsx:169`
- **Constat :** Orders.tsx:169 `console.log('🔍 Filtering order:', order.id, { searchTerm, statusFilter });` dans le `.filter`. En production l'appel est retiré, mais l'objet littéral reste alloué pour chaque commande à chaque rendu. Lignes 93-99 : log à chaque rendu avec `orders?.slice(0, 2)`. 84-85 et 109-130 : autres logs. `searchTerm.toLowerCase()` est recalculé 3 fois par ligne (170-172) et il n'y a pas de useMemo. Deliveries.tsx:86, 92-93, 101-107 et 175 : même chose.
- **Impact :** La saisie dans la recherche devient saccadée quand l'historique est grand, puisque tout l'historique est rechargé côté client (ORD-02).
- **Recommandation :** Supprimer tous les logs. Faire `const q = useDeferredValue(searchTerm.toLowerCase())` puis `const filtered = useMemo(() => …, [orders, q, statusFilter])`.

### ORD-05

**Invalidations qui ratent leur cible : clés de cache hétérogènes pour les mêmes données** — bug, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Orders.tsx:76`
- **Constat :** Orders.tsx:76-77 `queryKey: [ordersUrl, selectedStoreId]` donne ['/api/orders?storeId=3', 3]. Or EditOrderModal.tsx:69, OrderDetailModal.tsx:47/122, ValidateDeliveryModal.tsx:65 et EditDeliveryModal.tsx:89 font `invalidateQueries({ queryKey: ['/api/orders'] })`, qui ne correspond pas à '/api/orders?storeId=3'. StatsPanel.tsx:21 `queryKey: [statsUrl, selectedStoreId]` ('/api/stats/monthly?year=…') n'est jamais touché par `['/api/stats/monthly']` (EditOrderModal:70, EditDeliveryModal:90, ValidateDeliveryModal:66, Deliveries.tsx:152). Deliveries.tsx:126/151 invalide `[deliveriesUrl]`, qui n'existe pas. Deliveries.tsx:83 met user?.role dans la clé. Les clés mobiles (CalendarPage.tsx:53 'yyyy-MM', OrdersPage.tsx:43) diffèrent du desktop. La suppression d'une livraison (Deliveries.tsx:150-152, OrderDetailModal.tsx:123-124) n'invalide pas /api/orders, alors que chaque commande embarque `deliveries`.
- **Impact :** Après une suppression ou une validation depuis la fiche, la liste Commandes reste inchangée quand un magasin est sélectionné. Les statistiques du mois ne se mettent jamais à jour après modification, validation ou suppression. L'icône 'liée à des livraisons' du calendrier reste affichée après suppression de la livraison. L'utilisateur croit que l'action n'a pas marché.
- **Recommandation :** Correction minimale et sûre, en gardant les queryFn personnalisées : Orders.tsx clé ['/api/orders', 'list', selectedStoreId]. StatsPanel clé ['/api/stats/monthly', year, month, selectedStoreId]. Supprimer les invalidations [deliveriesUrl]. Ajouter l'invalidation de ['/api/orders'] et ['/api/stats/monthly'] dans les onSuccess de suppression ou de modification de livraison (Deliveries.tsx, OrderDetailModal.tsx). La fabrique lib/queryKeys.ts peut venir plus tard.

### ORD-06

**La suppression recharge toutes les variantes en cache, y compris les inactives (invalidate puis refetch)** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Orders.tsx:141`
- **Constat :** Orders.tsx:133-146 : `queryClient.invalidateQueries({ predicate: … '/api/orders' || '/api/deliveries' })` suivi de `queryClient.refetchQueries({ predicate: … })` sans `type: 'active'`. Tous les mois du calendrier visités et l'historique complet des livraisons sont donc rechargés en même temps. Lignes 125-127 : `localStorage.setItem('selectedStoreId', …)` est un contournement sans effet ici.
- **Impact :** Une suppression déclenche N gros appels simultanés. Le serveur et le réseau sont saturés juste après l'action.
- **Recommandation :** Garder uniquement invalidateQueries (refetchType 'active' par défaut), ou retirer la ligne avec une mise à jour optimiste (setQueryData). Supprimer le contournement localStorage.

### ORD-10

**Actions en icônes seules, sans libellé ni info-bulle, et deux coches ambiguës** — accessibilite, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Deliveries.tsx:453`
- **Constat :** Orders.tsx:382-406 : boutons Eye, Edit et Trash2 sans title ni aria-label. Deliveries.tsx:453-500 : jusqu'à 5 icônes (Eye, Edit, Check 'valider livraison', CheckCircle orange 'contrôle', Trash2). Seul le bouton contrôle a un title (487).
- **Impact :** Un utilisateur non technicien ne sait pas quelle coche valide la réception ou le contrôle. Les lecteurs d'écran annoncent 'bouton' sans nom.
- **Recommandation :** Partie automatisable : ajouter aria-label et title ('Voir', 'Modifier', 'Valider la réception', 'Marquer le contrôle comme effectué', 'Supprimer') à chaque bouton icône d'Orders.tsx et Deliveries.tsx. Le reste (bouton principal texte, menu) est à valider côté produit.

### ORD-11

**Tableaux tronqués sur écrans étroits : pas de défilement horizontal** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Orders.tsx:316`
- **Constat :** Orders.tsx:314-316 : wrapper `overflow-hidden`, puis `<table className="w-full min-w-[700px]">`, ce qui coupe la colonne Actions. Deliveries.tsx:362-364 : 8 colonnes dans `overflow-hidden`. L'en-tête (281) n'a pas de variantes responsive, contrairement à Orders (234).
- **Impact :** Sur tablette ou petit portable, les boutons Valider et Supprimer sont invisibles.
- **Recommandation :** Utiliser `overflow-x-auto` sur le wrapper et masquer 'Créé par' et 'Magasin' sous lg (`hidden lg:table-cell`). En dessous de md, afficher des cartes.

### ORD-12

**Couleurs et libellés de statut différents selon les pages, et couleurs des boutons principaux incohérentes** — coherence-design, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Orders.tsx:190`
- **Constat :** Orders.tsx:190-201, Deliveries.tsx:196-207 et OrderDetailModal.tsx:170-181 : planned en bleu, delivered en vert, pending en gris. CalendarGrid.tsx:54-63 : planned en jaune, delivered en gris, pending en bleu. Mobile OrdersPage.tsx:75-85 : pending en jaune, 'Livrée'. Boutons 'Nouveau' : orange bg-accent (Calendar.tsx:270), bleu (Orders.tsx:247), vert (Deliveries.tsx:294). En-têtes de tableau mixtes dans Deliveries.tsx:367-391 (text-xs font-medium gray-500 contre text-sm font-black gray-800). Padding doublé (278 et 361).
- **Impact :** Le même statut change de couleur d'un écran à l'autre, ce qui empêche l'utilisateur de se fier aux repères visuels.
- **Recommandation :** Créer un composant unique `<StatusBadge kind="order|delivery" status>` avec des tokens (lib/status.ts) utilisé partout (desktop, mobile, calendrier, légende). Utiliser une seule couleur d'action principale. Uniformiser les en-têtes de tableau.

### ORD-13

**La suppression d'une commande liée à des livraisons échoue avec un message générique** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `server/storage.ts:880`
- **Constat :** storage.ts:880-882 `await db.delete(orders).where(eq(orders.id, id));` ne traite pas les livraisons liées. init.sql:450-451 : `deliveries_order_id_fkey ... ON DELETE NO ACTION`. Le serveur renvoie donc 500 'Failed to delete order' (routes.ts:1683-1686), affiché 'Impossible de supprimer la commande' (Orders.tsx:160-164). ConfirmDeleteModal ne mentionne pas les livraisons liées.
- **Impact :** L'utilisateur ne comprend pas pourquoi la suppression échoue et retente, ou appelle le support.
- **Recommandation :** Côté serveur, compter les livraisons liées et renvoyer 409 avec 'Cette commande a N livraison(s) liée(s). Supprimez-les ou détachez-les d'abord.' Afficher ce message dans le toast et indiquer N dans la confirmation.

### PERM-01

**Deux matrices de permissions divergentes entre client et serveur** — dette-code, sévérité moyenne, effort M

- **Fichier :** `client/src/lib/permissions.ts:1`
- **Constat :** client/src/lib/permissions.ts (utilisée par Calendar.tsx:17, OrderDetailModal.tsx:15 et QuickCreateMenu.tsx:5) : orders.employee ['view'], deliveries.employee ['view'], pas de 'validate'. shared/permissions.ts (utilisée par Orders.tsx:13, Deliveries.tsx:13 et le serveur) : orders.employee [], deliveries avec 'validate'. D'où les rôles codés en dur dans OrderDetailModal.tsx:167 et la page desktop Commandes qui bloque l'employé (Orders.tsx:41-59) alors que le mobile ne le fait pas.
- **Impact :** Les boutons affichés ne correspondent pas aux droits réels : des actions refusées par le serveur sont proposées, d'autres sont masquées à tort.
- **Recommandation :** Supprimer client/src/lib/permissions.ts, importer @shared/permissions partout (desktop et mobile) et centraliser les gardes de page.

### SRV-02

**Imbrications redondantes : livraisons complètes dans chaque commande et commande complète dans chaque livraison** — perf-api, sévérité moyenne, effort M

- **Fichier :** `server/storage.ts:522`
- **Constat :** storage.ts:522-578 (loadDeliveriesByOrderIds) : chaque commande embarque ses livraisons avec 24 colonnes plus supplier, group et creator. storage.ts:584-617 (loadOrdersByIds) : chaque livraison embarque sa commande avec supplier, group et creator (email compris). Le client n'utilise que `deliveries.length`, le statut et les dates (CalendarGrid.tsx:80, OrderDetailModal.tsx:311-328) et `order.id`, plannedDate et status (Deliveries.tsx:436-439, OrderDetailModal.tsx:343-349).
- **Impact :** La charge utile des listes double ou triple sans bénéfice. La sérialisation et le parsing JSON sont plus lents.
- **Recommandation :** Pour les listes, renvoyer des sous-objets légers : deliveries {id, status, scheduledDate, deliveredDate, quantity, unit} et order {id, plannedDate, status}. Réserver le détail complet à GET /api/orders/:id et /api/deliveries/:id.

### SRV-04

**Utilisateur et magasins rechargés deux fois par requête API** — perf-serveur, sévérité moyenne, effort M

- **Fichier :** `server/localAuth.production.ts:195`
- **Constat :** localAuth.production.ts:193-196 : `deserializeUser` appelle déjà `storage.getUserWithGroups(id)` (2 requêtes : users, puis user_groups JOIN groups, storage.ts:371-407). Ensuite, chaque handler refait `storage.getUserWithGroups(req.user.claims ? … : req.user.id)` (routes.ts:1345, 1754, 4157, 4597… 91 occurrences).
- **Impact :** 4 requêtes SQL d'authentification au lieu de 2 sur chaque appel. Le calendrier en fait 4 en parallèle (orders, deliveries, ad-campaigns, stats), soit 16 requêtes d'authentification par changement de mois.
- **Recommandation :** Créer `async function getRequestUser(req) { return req.user?.userGroups ? req.user : storage.getUserWithGroups(req.user?.claims ? req.user.claims.sub : req.user.id); }` et remplacer les 91 appels par ce helper. Le repli couvre le cas où req.user vient d'un login sans groupes, ou d'un ancien format avec claims.

### SRV-05

**Toutes les réponses JSON sont clonées récursivement pour retirer smtpPassword** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:168`
- **Constat :** routes.ts:165-170 `res.json = (body: any) => originalJson(stripSmtpPassword(body));`. sanitize.ts:13-40 parcourt et recopie chaque objet (Object.entries, WeakSet, profondeur jusqu'à 8) de chaque réponse /api, y compris les listes de milliers de commandes avec leurs imbrications.
- **Impact :** Une copie complète supplémentaire, en CPU et en mémoire, avant JSON.stringify, sur les plus grosses réponses. La latence des listes augmente.
- **Recommandation :** Ne jamais sélectionner smtpPassword dans les requêtes (projection, voir SRV-01) et limiter le nettoyage aux routes /api/groups* et /api/users*. Ou appliquer stripSmtpPassword seulement si le body contient un group (vérification à plat).

### SRV-07

**Manager ou directeur multi-magasins sans sélection : seul le premier magasin est renvoyé, en silence** — bug, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:1419`
- **Constat :** routes.ts:1401-1428 `groupIds = [userGroupIds[0]]; // Use first assigned store automatically` (commandes), et 1810-1837 pour les livraisons. À l'inverse, /api/stats/monthly (4173-4180) agrège tous les magasins de l'utilisateur.
- **Impact :** La liste et les statistiques ne portent pas sur le même périmètre, sans que l'écran l'indique. Les données d'un second magasin semblent manquantes.
- **Recommandation :** Choisir une règle unique : soit tous les magasins de l'utilisateur partout, soit une sélection obligatoire côté interface (Layout.tsx:195 affiche déjà un avertissement), en affichant clairement le magasin concerné.

### SRV-08

**Contrôles d'accès par magasin incomplets (validation, contrôle, lecture, statistiques)** — bug, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:2624`
- **Constat :** routes.ts:2624 `if (user.role === 'manager') {` : un directeur peut valider une livraison de n'importe quel magasin via son id. PUT /api/deliveries/:id/control (2678-2705) ne vérifie pas l'appartenance au magasin. GET /api/orders (1343) ne vérifie pas hasPermission('orders','view'), alors que shared/permissions.ts:41 donne `employee: []`. Un employé qui passe un storeId reçoit donc les commandes (et la page mobile OrdersPage ne le bloque pas). /api/stats/monthly : si userGroupIds est vide, `groupIds = []` (4179), et storage.ts:1262 (`groupIds.length > 0`) n'applique aucun filtre, ce qui renvoie les statistiques de tous les magasins.
- **Impact :** Des actions et des données d'autres magasins sont accessibles, et le comportement diffère entre desktop et mobile.
- **Recommandation :** Créer un helper `assertStoreAccess(user, groupId)` et l'appliquer à validate, control, PUT et DELETE. Vérifier hasPermission(module,'view') sur les GET de liste. Traiter groupIds vide comme 'aucun accès', avec une réponse vide.

### CAL-05

**Les jours des mois voisins sont affichés mais toujours vides** — bug, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Calendar.tsx:33`
- **Constat :** Calendar.tsx:33-34 et 38-46 : requête de startOfMonth à endOfMonth. CalendarGrid.tsx:473-489 : grille de 42 jours qui inclut la fin du mois précédent et le début du suivant. Sur mobile : CalendarPage.tsx:55-56 (mois) contre 125-127 (startOfWeek/endOfWeek).
- **Impact :** Une livraison prévue le 1er du mois suivant n'apparaît pas dans la dernière semaine affichée. L'utilisateur peut croire qu'il n'y a rien.
- **Recommandation :** Desktop : calculer la plage comme la grille, from = monthStart - startPadding jours (lundi), to = from + 41 jours. Exposer ces bornes depuis un helper commun à Calendar et CalendarGrid et les utiliser dans les clés et paramètres des requêtes orders et deliveries. Mobile : requêter de startOfWeek(monthStart,{locale: fr}) à endOfWeek(monthEnd,{locale: fr}).

### CAL-12

**Statistiques mensuelles : 4 requêtes séquentielles, sans cache** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/storage.ts:1270`
- **Constat :** storage.ts:1270 `const ordersResult = await db…`, 1276 `const deliveriesResult = await db…`, 1287 `const pendingResult = await db…`, 1297 `const deliveriesStatsResult = await db…` : quatre await successifs et indépendants. server/cache.ts n'est pas utilisé pour ces statistiques.
- **Impact :** La latence du panneau est la somme de 4 allers-retours SQL à chaque affichage ou changement de mois.
- **Recommandation :** Partie automatisable : exécuter les 4 requêtes avec `Promise.all`. Le cache de 60 s par (année, mois, magasin) est à faire séparément, avec une invalidation dans toutes les routes de mutation des commandes et livraisons.

### CAL-13

**La fenêtre '+X autres' affiche la date de création des commandes au lieu de la date prévue** — bug, sévérité basse, effort S

- **Fichier :** `client/src/components/CalendarGrid.tsx:324`
- **Constat :** CalendarGrid.tsx:323-328 `{item.scheduledDate ? ... : item.deliveredDate ? ... : new Date(item.createdAt).toLocaleDateString('fr-FR')}`. Les commandes n'ont pas de scheduledDate mais un plannedDate (schema.ts:125).
- **Impact :** Une date incohérente s'affiche dans la liste du jour.
- **Recommandation :** Utiliser `isOrder ? item.plannedDate : item.scheduledDate` via safeFormat.

### CAL-14

**Seulement 2 éléments par jour, et des modales imbriquées avec des contournements de z-index et d'état** — ux-simplicite, sévérité basse, effort M

- **Fichier :** `client/src/components/CalendarGrid.tsx:177`
- **Constat :** CalendarGrid.tsx:177 `const MAX_VISIBLE_ITEMS = 2;` puis le bouton '+N autres', qui ouvre un Dialog (224, `z-[9999]`), lequel ouvre un CommentModal (15, `z-[99999]`), lequel peut ouvrir OrderDetailModal. Des drapeaux d'état servent à contourner les clics (47, 113-116, 176, 261-268) avec un setTimeout (163, 346).
- **Impact :** Les jours chargés demandent un clic supplémentaire. La superposition de modales désoriente. Le code est fragile (clics fantômes).
- **Recommandation :** Afficher plus d'éléments en mode compact, ou proposer une vue semaine. Ouvrir un panneau latéral 'Journée du JJ/MM' qui liste tout, avec le commentaire en ligne au lieu d'une modale de commentaire.

### CAL-17

**Double chargement au démarrage : les requêtes partent avant la sélection automatique du magasin** — perf-client, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/components/Layout.tsx:70`
- **Constat :** Layout.tsx:70-73 sélectionne automatiquement le magasin après le chargement de /api/groups, et 77 expose `storeInitialized`. Mais les requêtes de Calendar.tsx:37, Orders.tsx:76 et Deliveries.tsx:82 n'ont pas `enabled: storeInitialized`. Le premier appel part sans storeId (le serveur prend alors le 1er magasin, routes.ts:1419-1423), puis un second part avec storeId.
- **Impact :** Deux gros appels au lieu d'un à la première connexion d'un manager ou d'un directeur.
- **Recommandation :** Si l'on corrige : faire passer storeInitialized à true aussi quand /api/groups a répondu avec une liste vide (ou en erreur) dans Layout.tsx, puis ajouter `enabled: !!user && storeInitialized` aux requêtes de Calendar, Orders et Deliveries. Gain faible : à prioriser bas.

### MOD-05

**useEffect et logs exécutés à chaque rendu (dépendance recréée)** — perf-client, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/components/modals/CreateOrderModal.tsx:49`
- **Constat :** CreateOrderModal.tsx:49-53 : `const groups = ... groupsData.filter(...)` crée un nouveau tableau à chaque rendu. Il figure dans les dépendances de useEffect (103), donc l'effet tourne à chaque rendu, avec un console.log et `groups.map` (57-64). CreateDeliveryModal.tsx:53-57 et 76-124 : même chose. Logs aux lignes 107-109, 118 et 151.
- **Impact :** Travail et allocations inutiles à chaque frappe dans le formulaire.
- **Recommandation :** Envelopper groups dans useMemo et supprimer les console.log.

### MOD-06

**Données de référence rechargées à chaque ouverture de modale** — perf-client, sévérité basse, effort S

- **Fichier :** `client/src/lib/queryClient.ts:77`
- **Constat :** queryClient.ts:75-77 `refetchOnMount: true, staleTime: 30 * 1000`. Les modales sont montées conditionnellement (Orders.tsx:433-439, Calendar.tsx:318-332). À chaque ouverture après 30 s, /api/suppliers, /api/groups et /api/orders (modales livraison) sont donc refetchés.
- **Impact :** Les formulaires s'ouvrent avec des listes qui se rechargent, et le serveur reçoit des appels redondants.
- **Recommandation :** Définir `queryClient.setQueryDefaults(['/api/suppliers'], { staleTime: 15*60*1000 })`, et la même chose pour ['/api/groups']. Invalider ces clés seulement après une mutation fournisseur ou magasin.

### MOD-07

**Mutation morte, confirmation de suppression dupliquée et rôles codés en dur** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/components/modals/OrderDetailModal.tsx:70`
- **Constat :** OrderDetailModal.tsx:70-101 : `validateDeliveryMutation` n'est jamais appelée (la validation passe par ValidateDeliveryModal). 405-432 : overlay de confirmation fait maison au lieu de ConfirmDeleteModal. 167-168 `canValidate = (user?.role === 'admin' || user?.role === 'directeur' || user?.role === 'manager')` au lieu de hasPermission.
- **Impact :** Code inutile, et une confirmation visuellement différente du reste de l'application.
- **Recommandation :** Partie automatisable : supprimer validateDeliveryMutation et remplacer le test de rôle par `hasPermission(user?.role || '', 'deliveries', 'validate')` importé de @shared/permissions (en gardant `isDelivery && item.status !== 'delivered'`). Passer à ConfirmDeleteModal est optionnel et visuel.

### MOD-08

**Modale d'édition empilée sur la fiche, données périmées après modification, contenu limité à 384 px** — ux-simplicite, sévérité basse, effort M

- **Fichier :** `client/src/components/modals/OrderDetailModal.tsx:437`
- **Constat :** OrderDetailModal.tsx:437-451 : EditOrderModal et EditDeliveryModal s'ouvrent par-dessus la fiche, qui reste ouverte. La fiche affiche `item`, une copie figée (Calendar.tsx:188 `setSelectedItem({ ...item, type })`), et montre donc les anciennes valeurs après modification. 220 : `overflow-y-auto max-h-96` dans une modale de 90vh. 194 : en-tête dégradé bleu même pour une livraison.
- **Impact :** L'utilisateur croit que sa modification n'a pas été prise en compte. Il doit défiler dans une petite zone.
- **Recommandation :** Passer la fiche en mode édition dans la même modale. Lire l'élément depuis le cache par id (useQuery(['/api/orders', id]) ou select sur la liste). Retirer max-h-96 au profit du scroll de DialogContent. Utiliser des couleurs distinctes pour commande et livraison.

### MOD-09

**Pieds de modale et boutons d'action incohérents** — coherence-design, sévérité basse, effort S

- **Fichier :** `client/src/components/modals/CreateOrderModal.tsx:245`
- **Constat :** CreateOrderModal.tsx:245 et CreateDeliveryModal.tsx:334 : `flex items-center space-x-3`, boutons alignés à gauche. EditOrderModal.tsx:189, EditDeliveryModal.tsx:257 et ValidateDeliveryModal.tsx:160 : `justify-end`. EditDeliveryModal.tsx:264 : bouton bleu `bg-primary` alors que la création de livraison est verte (CreateDeliveryModal.tsx:341). Icônes Check entourées d'une bordure grise (ValidateDeliveryModal.tsx:105/175, OrderDetailModal.tsx:387/397, Deliveries.tsx:477).
- **Impact :** L'utilisateur cherche le bouton de validation à un endroit différent selon la modale.
- **Recommandation :** Utiliser DialogFooter partout ('Annuler' en outline à gauche, action principale à droite), avec une couleur par type d'objet, et retirer les bordures d'icônes.

### MOD-10

**Le champ 'Commande liée' disparaît si la commande liée est déjà livrée** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/components/modals/EditDeliveryModal.tsx:191`
- **Constat :** EditDeliveryModal.tsx:55-61 filtre `order.status !== 'delivered'`, puis 191 `{availableOrders.length > 0 && (...)}`. La commande actuellement liée, si elle est livrée, n'est pas dans la liste et le champ peut être masqué.
- **Impact :** Impossible de voir ou de détacher la commande liée lors de la correction d'une livraison.
- **Recommandation :** Toujours afficher le champ et y inclure la commande actuellement liée (delivery.orderId), quel que soit son statut.

### ORD-04

**Requête /api/groups inutilisée** — perf-client, sévérité basse, effort S

- **Fichier :** `client/src/pages/Orders.tsx:101`
- **Constat :** Orders.tsx:101-105 `const { data: groupsData = [] } = useQuery({ queryKey: ['/api/groups'] }); const groups = …;` : `groups` n'est jamais référencé (grep). Deliveries.tsx:109-113 : même chose.
- **Impact :** Abonnement et refetch inutiles (la liste admin contient les logos).
- **Recommandation :** Supprimer ces deux requêtes. Si besoin, utiliser `stores` du StoreContext.

### ORD-07

**Hooks appelés après un return anticipé (règle des hooks violée)** — bug, sévérité basse, effort S

- **Fichier :** `client/src/pages/Orders.tsx:41`
- **Constat :** Orders.tsx:41-59 `if (user?.role === 'employee') { return (...) }` est placé avant `useState` (61-69), `useQuery` (76, 101), `useMutation` (107) et `usePagination` (180). Deliveries.tsx:46-64, puis useState à partir de 66 : même chose.
- **Impact :** Si le rôle change pendant la session (rechargement de l'utilisateur), React plante avec 'Rendered more/fewer hooks than expected' et l'écran devient blanc.
- **Recommandation :** Extraire le contenu dans un composant OrdersContent et faire le contrôle de rôle dans un wrapper, ou via une garde de route commune.

### ORD-08

**'Groupe' et 'Magasin/Groupe' au lieu de 'Magasin'** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Orders.tsx:323`
- **Constat :** Orders.tsx:323 colonne 'Groupe' et 264 'Rechercher par fournisseur, groupe...'. Deliveries.tsx:371 et 310. CreateOrderModal.tsx:205, EditOrderModal.tsx:147, OrderDetailModal.tsx:261 et CreateDeliveryModal.tsx:268 : 'Magasin/Groupe'. La navigation dit 'Magasins' (Sidebar.tsx:347) et le sélecteur 'Magasin' (Layout.tsx:161).
- **Impact :** Le jargon technique hérité (table groups) est incohérent et ambigu pour l'utilisateur.
- **Recommandation :** Remplacer 'Groupe' et 'Magasin/Groupe' par 'Magasin' aux 10 emplacements, EditDeliveryModal.tsx:170 compris.

### ORD-09

**Identifiants techniques affichés sous des formes différentes selon l'écran** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/components/modals/OrderDetailModal.tsx:209`
- **Constat :** OrderDetailModal.tsx:209 `#{isOrder ? 'CMD' : 'LIV'}-{item.id}`. Orders.tsx:350 et Deliveries.tsx:404 `#{order.id}`. Deliveries.tsx:439 `#{delivery.order.id}`. CreateDeliveryModal.tsx:252 `#{order.id} - {supplier} - date`. EditDeliveryModal.tsx:202 `Commande #…`. Mobile : `Cmd #` et `Liv #` (CalendarPage.tsx:105/113).
- **Impact :** Une même commande apparaît sous 3 notations, ce qui complique la recherche et la communication entre collègues.
- **Recommandation :** Adopter un format unique (CMD-123 / LIV-456) via un helper, et l'utiliser aussi dans la recherche. Dans la colonne 'Commande liée', afficher plutôt la date et le fournisseur.

### ORD-14

**Retour à la page 1 après chaque suppression, et confirmation fermée avant la fin de l'action** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/components/ui/pagination.tsx:157`
- **Constat :** pagination.tsx:157-159 `useEffect(() => { setCurrentPage(1); }, [data.length]);`. Orders.tsx:218-224 `deleteMutation.mutate(...); setShowDeleteModal(false);` : l'état isLoading passé à ConfirmDeleteModal (468) n'est jamais visible. Même chose dans Deliveries.tsx:264-270.
- **Impact :** Après une suppression en page 4, l'utilisateur est renvoyé en page 1 et perd sa place. Il n'a aucun retour visuel pendant la suppression.
- **Recommandation :** Ne réinitialiser la page que si les filtres changent (et borner à totalPages). Fermer la confirmation dans onSuccess.

### ORD-15

**Pas de tri, pas de filtre de période, recherche sans n° de BL** — ux-simplicite, sévérité basse, effort M

- **Fichier :** `client/src/pages/Deliveries.tsx:176`
- **Constat :** Deliveries.tsx:176-178 : la recherche porte sur supplier, group et notes, mais pas sur blNumber. Orders.tsx:170-172 : même chose. L'ordre est celui du serveur, `orderBy(desc(orders.createdAt))` (storage.ts:715) et desc(deliveries.createdAt) (931), et non la date prévue. Aucun en-tête de colonne n'est triable et il n'existe pas de filtre 'cette semaine'.
- **Impact :** Pour trouver les livraisons de demain ou un BL précis, l'utilisateur doit parcourir les pages.
- **Recommandation :** Trier par date prévue par défaut (les prochaines en premier). Ajouter des raccourcis 'Aujourd'hui', 'Cette semaine' et 'En retard'. Inclure blNumber dans la recherche, en SQL (voir ORD-02).

### SRV-06

**Logs console à chaque appel des chemins chauds** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/routes.ts:1353`
- **Constat :** routes.ts:1353 `console.log('Orders API called with:', …)`, 1360-1430 (un log par branche de rôle), 1456 `console.log('Orders returned:', …)`, 1762-1869 (même chose pour les livraisons). storage.ts:719 `getOrders() récupéré…`, 934, 1252 et 1330 (stats), 1519-1522 (publicités, avec la désignation des 3 premières).
- **Impact :** Des E/S synchrones sur stdout à chaque requête et des logs de production illisibles.
- **Recommandation :** Utiliser un logger à niveaux (debug désactivé en production) et ne garder que les erreurs.

### SRV-09

**Le filtre withBL est appliqué en JavaScript après le chargement complet** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:1864`
- **Constat :** routes.ts:1864-1866 `if (withBL === 'true') { deliveries = deliveries.filter((d: any) => d.blNumber && d.status === 'delivered'); }`, exécuté après getDeliveries ou getDeliveriesByDateRange complet.
- **Impact :** Toutes les livraisons sont lues et sérialisées pour n'en renvoyer qu'une partie.
- **Recommandation :** Ajouter à getDeliveries un filtre SQL optionnel (status = 'delivered', voire bl_number IS NOT NULL) exposé par un paramètre de /api/deliveries, et l'utiliser depuis BLReconciliation.tsx, après avoir vérifié que la page n'a pas besoin des livraisons sans BL. Supprimer ou réutiliser le paramètre mort withBL.
