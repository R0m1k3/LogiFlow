# Base de données

_36 constats vérifiés — 8 haute, 13 moyenne, 15 basse._

## Pages analysées

### `transverse : authentification (chaque appel /api/*)`

**Rôle :** Identifier l'utilisateur et ses magasins avant de servir n'importe quelle donnée.

**Tâches principales de l'utilisateur :**
- Se connecter
- Naviguer entre les pages (chaque page déclenche 3 à 10 appels API)

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| (middleware) session + deserializeUser | chaque requête API | server/localAuth.production.ts:193 passport.deserializeUser -> storage.getUserWithGroups (server/storage.ts:371) | SELECT session + UPDATE session (touch) + getUser + jointure user_groups/groups = 4 allers-retours avant la route. |
| (dans 91 routes) storage.getUserWithGroups(req.user.id) | chaque requête API | server/routes.ts (106 appels, ex. 1345, 1754, 2799, 3195) | Recharge exactement ce que deserializeUser vient de charger : +2 requêtes séquentielles par appel. |

**Lisibilité / simplicité :** Invisible pour l'utilisateur mais coûte ~6 requêtes BD par appel API avant toute donnée métier ; le tableau de bord (~10 appels) génère ~60 requêtes d'authentification. C'est une latence fixe ajoutée à chaque écran.

### `/ et /dashboard (desktop)`

**Rôle :** Vue d'ensemble du magasin : commandes, livraisons, commandes clients, stats du mois/de l'année, DLC, tâches, annonce récente, publicités à venir.

**Tâches principales de l'utilisateur :**
- Voir les compteurs du jour/mois
- Voir les commandes récentes et livraisons à venir
- Lire l'annonce récente

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/orders[?storeId] | au montage | server/routes.ts:1343 -> storage.getOrders (server/storage.ts:678) | Aucune borne de date (commentaire Dashboard.tsx:78) : tout l'historique + livraisons imbriquées + groupe complet (logo) par ligne, juste pour compter par statut. |
| /api/deliveries[?storeId] | au montage | server/routes.ts:1752 -> storage.getDeliveries (server/storage.ts:885) | Tout l'historique pour calculer 'livrées ce mois' et palettes côté client. |
| /api/customer-orders[?storeId] | au montage | server/routes.ts:3486 -> storage.getCustomerOrders (server/storage.ts:1868) | Tout l'historique pour 6 compteurs par statut. |
| /api/stats/monthly et /api/stats/yearly | au montage | server/routes.ts:4155/4192 -> getMonthlyStats (storage.ts:1222) / getYearlyStats (storage.ts:1364) | 4 requêtes séquentielles chacune ; filtre delivered_date non indexé. |
| /api/announcements?recent=true | au montage | server/routes.ts:5770 (requête inline + N+1) | Paramètre recent ignoré côté serveur, filtre 2 jours fait côté client ; 1 + 2×5 requêtes. |
| /api/ad-campaigns?year=N (×3) | au montage, 3 appels séquentiels (Dashboard.tsx:205) | server/routes.ts:4595 -> storage.getPublicities (server/storage.ts:1502) | Participations avec groupe complet (logo) ; groupIds ignoré. |
| /api/dlc-products/stats | au montage | server/routes.ts:2831 -> getDlcStats (storage.ts:2224) | Agrégat en base : correct. |
| /api/tasks | au montage | server/routes.ts:3193 -> getTasks (storage.ts:2267) | Liste non bornée. |

**Lisibilité / simplicité :** Page d'accueil la plus lente : elle télécharge l'historique complet de 3 tables (avec relations et logos magasin répétés) pour n'afficher que des compteurs et 5 lignes récentes. Le temps d'affichage croît avec l'ancienneté du magasin.

### `/ et /dashboard (mobile)`

**Rôle :** Résumé du jour sur téléphone : commandes, livraisons et tâches du jour.

**Tâches principales de l'utilisateur :**
- Voir combien de commandes/livraisons sont prévues aujourd'hui
- Voir les tâches en cours

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/stats/dashboard | au montage | aucune route serveur (grep négatif dans server/routes.ts) | Appel vers un endpoint inexistant. |
| /api/orders?storeId&date=AAAA-MM-JJ | au montage | server/routes.ts:1343 (lit seulement startDate/endDate/storeId, l.1350) -> storage.getOrders | date ignoré : historique complet chargé, compteur 'Commandes' = total historique. |
| /api/deliveries?storeId&date=AAAA-MM-JJ | au montage | server/routes.ts:1752 -> storage.getDeliveries | Même problème. |
| /api/tasks | au montage | server/routes.ts:3193 -> getTasks | Liste non bornée. |

**Lisibilité / simplicité :** Sur réseau mobile, l'écran d'accueil télécharge tout l'historique pour afficher deux nombres, et ces nombres sont faux (total historique au lieu du jour).

### `/orders`

**Rôle :** Lister et gérer les commandes fournisseurs du magasin.

**Tâches principales de l'utilisateur :**
- Rechercher une commande
- Créer/modifier/supprimer une commande

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/orders?storeId | au montage | server/routes.ts:1343 -> storage.getOrders (storage.ts:678, loadDeliveriesByOrderIds storage.ts:522) | 3 requêtes (N+1 déjà corrigé) mais sans LIMIT ; inArray de tous les ids de commandes ; groupe complet ×2 par commande. |
| /api/groups | au montage | server/routes.ts:970 -> storage.getGroups (storage.ts:432) pour admin | Admin : lignes complètes avec logo et config SMTP/NocoDB. |

**Lisibilité / simplicité :** Liste sans pagination : chargement de plus en plus long au fil des mois, poids JSON gonflé par le logo du magasin répété dans chaque commande et chaque livraison imbriquée.

### `/deliveries (+ modales Créer/Modifier livraison)`

**Rôle :** Lister les livraisons, les valider, les lier à une commande.

**Tâches principales de l'utilisateur :**
- Valider une livraison avec son BL
- Créer une livraison liée à une commande

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/deliveries?storeId | au montage | server/routes.ts:1752 -> storage.getDeliveries (storage.ts:885) + attachOrdersAndCommentCounts (storage.ts:643) | Historique complet, sans LIMIT. |
| /api/orders (sans paramètre) | à l'ouverture des modales | server/routes.ts:1343 -> storage.getOrders() tous magasins (admin) / [] (employé, l.1442) | Toutes les commandes de tous les magasins pour filtrer côté client fournisseur+magasin+non livrée ; employé : liste vide. |
| /api/deliveries/:id | au clic | server/routes.ts:1877 -> storage.getDelivery (storage.ts:1004) | 5 requêtes séquentielles. |

**Lisibilité / simplicité :** Ouvrir la modale de création de livraison télécharge tout l'historique des commandes (admin) ou rien du tout (employé : impossible de lier une commande).

### `/calendar`

**Rôle :** Calendrier mensuel des commandes et livraisons.

**Tâches principales de l'utilisateur :**
- Voir les livraisons du mois
- Naviguer de mois en mois

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/orders?startDate&endDate&storeId | au montage / changement de mois | server/routes.ts:1343 -> storage.getOrdersByDateRange (storage.ts:725) | Bonne borne de date ; s'appuie sur idx_orders_group_planned_date (si appliqué). |
| /api/deliveries?startDate&endDate&storeId | au montage / changement de mois | server/routes.ts:1752 -> storage.getDeliveriesByDateRange (storage.ts:939) | Idem, idx_deliveries_group_scheduled_date ; groupe complet (logo) par ligne. |

**Lisibilité / simplicité :** Seule vue correctement bornée par date ; reste alourdie par les objets magasin complets et par l'absence probable des index en production.

### `/bl-reconciliation`

**Rôle :** Rapprocher BL et factures fournisseurs, commenter, relancer les fournisseurs.

**Tâches principales de l'utilisateur :**
- Voir les livraisons livrées à rapprocher
- Vérifier une facture dans NocoDB
- Commenter / envoyer un mail fournisseur

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/deliveries?storeId | au montage, staleTime 0 | server/routes.ts:1752 -> storage.getDeliveries | Tous statuts, tout l'historique ; filtre status==='delivered' côté client (BLReconciliation.tsx:371). |
| /api/deliveries/:id/verify-invoice | automatique, file de 3 en parallèle | server/routes.ts (~2470) -> storage.getDelivery + invoiceVerificationService.verifyInvoice (getGroup complet à chaque appel) | getDelivery 5 requêtes + relecture du groupe (logo) par vérification. |
| /api/deliveries/:id/reconciliation-comments | à l'ouverture des commentaires | server/routes.ts:2175 -> getDelivery + getReconciliationComments (storage.ts:3035) | author: users complet (hash du mot de passe). |
| /api/supplier-mail-logs | au montage | server/routes.ts:2439 -> getSupplierMailLogs (storage.ts:2974) | LIMIT 500, OK ; index composite manquant pour le tri. |

**Lisibilité / simplicité :** La page charge tout l'historique des livraisons, puis déclenche des vérifications en rafale qui relisent chacune la fiche magasin complète : temps de chargement long et sensation de page qui 'mouline'.

### `/payment-schedule`

**Rôle :** Échéancier des paiements fournisseurs d'un magasin (admin/directeur) et export Excel.

**Tâches principales de l'utilisateur :**
- Voir les échéances du mois
- Exporter l'échéancier

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/payment-schedule?groupId | au montage / changement de magasin | server/routes.ts:390 -> storage.getDeliveries() SANS filtre (l.430) puis boucles verifyInvoice/updateDelivery séquentielles (l.444, 491) | Toutes les livraisons de tous les magasins chargées puis filtrées en JS. |
| POST /api/payment-schedule/export | au clic Exporter | server/routes.ts:548 -> storage.getDeliveries() sans filtre (l.596) | Même chargement complet. |

**Lisibilité / simplicité :** Page potentiellement la plus lente de l'application : temps proportionnel à la taille de toute la base (tous magasins) plus un appel NocoDB séquentiel par facture sans échéance.

### `/users`

**Rôle :** Gérer les utilisateurs, leurs rôles et leurs magasins.

**Tâches principales de l'utilisateur :**
- Créer/modifier un utilisateur
- Affecter un utilisateur à un magasin

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/users | au montage (aussi utilisé par la page Tâches) | server/routes.ts:4268 -> storage.getUsers + Promise.all(getUserWithGroups) (l.4279-4282) | 2N+1 requêtes ; renvoie le champ password (hash) de chaque utilisateur. |
| /api/groups | au montage | server/routes.ts:970 -> getGroups | Lignes complètes avec logo. |

**Lisibilité / simplicité :** Chargement qui croît avec le nombre d'utilisateurs ; données sensibles inutiles dans la réponse.

### `/sav`

**Rôle :** Suivi des tickets SAV.

**Tâches principales de l'utilisateur :**
- Créer un ticket
- Suivre le statut des tickets

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/sav/tickets | au montage / filtre | server/routes.ts:5242 -> storage.getSavTickets (storage.ts:2656) | creator: users complet (hash), group complet (logo), Promise.all d'historique vide, sans LIMIT. |
| /api/sav/stats | au montage | server/routes.ts:5524 -> getSavTicketStats (storage.ts:2818) | 3 requêtes séquentielles remplaçables par une seule. |

**Lisibilité / simplicité :** Liste lourde (objets utilisateur et magasin complets par ticket), compteurs en 3 allers-retours.

### `/publicities`

**Rôle :** Planning des publicités et participation des magasins.

**Tâches principales de l'utilisateur :**
- Voir les publicités de l'année
- Cocher la participation d'un magasin

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/ad-campaigns?year&storeId | au montage / changement d'année | server/routes.ts:4595 -> storage.getPublicities (storage.ts:1502) | groupIds ignoré ; chaque participation embarque la ligne groups complète (logo) alors que seul group.name est lu. |

**Lisibilité / simplicité :** Le poids de la réponse explose dès que les magasins ont un logo (publicités × magasins participants × logo).

### `/tasks`

**Rôle :** Tâches du magasin.

**Tâches principales de l'utilisateur :**
- Voir les tâches à faire
- Marquer une tâche terminée

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/tasks?storeId | au montage | server/routes.ts:3193 -> getTasks (storage.ts:2267) | Toutes les tâches y compris terminées depuis toujours, group complet. |
| /api/users | au montage | server/routes.ts:4268 | N+1 et hash de mot de passe. |

**Lisibilité / simplicité :** Liste qui grossit indéfiniment avec les tâches terminées.

### `/dlc`

**Rôle :** Suivi des dates limites de consommation.

**Tâches principales de l'utilisateur :**
- Voir les produits qui expirent bientôt
- Rechercher un produit

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/dlc-products?storeId&status&supplierId&search | au montage / filtre / recherche (debounce) | server/routes.ts:2797 -> getDlcProducts (storage.ts:1976) | Filtres poussés en SQL (bien) ; LIKE '%..%' non indexable ; pas de LIMIT ; group complet. |
| /api/dlc-products/stats | au montage | server/routes.ts:2831 -> getDlcStats (storage.ts:2224) | Une requête agrégée : bon modèle. |

**Lisibilité / simplicité :** Page plutôt bien conçue côté requêtes ; la recherche texte et l'absence d'index composite (group_id, expiry_date) la ralentiront avec le volume.

### `/customer-orders`

**Rôle :** Commandes clients et appels à passer.

**Tâches principales de l'utilisateur :**
- Saisir une commande client
- Voir les clients à appeler

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/customer-orders[?storeId] | au montage | server/routes.ts:3486 -> getCustomerOrders (storage.ts:1868) | Historique complet, group complet. |
| /api/customer-orders/pending-calls | au montage | server/routes.ts:3638 -> getPendingClientCalls (storage.ts:1931) | Filtre customer_notified=false non indexé. |

**Lisibilité / simplicité :** Liste non paginée ; reste acceptable tant que le volume est faible.

### `/avoirs`

**Rôle :** Suivi des avoirs fournisseurs.

**Tâches principales de l'utilisateur :**
- Créer un avoir
- Suivre son statut

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/avoirs[?storeId] | au montage | server/routes.ts:3711 -> getAvoirs (storage.ts:2528) | Une requête avec JOIN (bien) ; group complet (logo) ; sans LIMIT. |

**Lisibilité / simplicité :** Requête correcte, poids gonflé par l'objet magasin complet.

### `/analytics`

**Rôle :** Statistiques commandes/livraisons par période, fournisseur et magasin.

**Tâches principales de l'utilisateur :**
- Choisir une période
- Comparer fournisseurs et magasins

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| /api/analytics/summary | au montage / changement de filtres | server/routes.ts:6218 -> getAnalyticsSummary (storage.ts:3166) | 4 requêtes séquentielles ; top magasins = produit cartésien orders×deliveries. |
| /api/analytics/timeseries | idem | server/routes.ts:6250 -> getAnalyticsTimeseries (storage.ts:3285) | 2 requêtes séquentielles. |
| /api/analytics/by-supplier | idem | server/routes.ts:6281 -> getAnalyticsBySupplier (storage.ts:3361) | Une requête agrégée. |
| /api/analytics/by-store | idem | server/routes.ts:6310 -> getAnalyticsByStore (storage.ts:3400) | Sous-requêtes agrégées : bon modèle à réutiliser. |

**Lisibilité / simplicité :** Le bloc 'top magasins' devient très lent avec le volume (jointure multiplicative) et ne respecte pas la période choisie.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [DB-01](#db-01) | haute | perf-serveur | S | Les index de performance ne sont jamais créés automatiquement en production | `Dockerfile:119` |
| [DB-03](#db-03) | haute | perf-api | S | Le logo base64 du magasin et sa config SMTP/NocoDB sont recopiés dans chaque ligne de chaque liste | `server/storage.ts:553` |
| [DB-04](#db-04) | haute | bug | S | La ligne users complète, hash du mot de passe compris, est renvoyée au navigateur | `server/storage.ts:2669` |
| [DB-06](#db-06) | haute | perf-serveur | M | L'utilisateur et ses magasins sont rechargés deux fois à chaque appel API (6 allers-retours BD avant les données) | `server/routes.ts:1345` |
| [DB-07](#db-07) | haute | perf-serveur | M | L'échéancier charge toutes les livraisons de tous les magasins puis filtre en JavaScript | `server/routes.ts:430` |
| [DB-08](#db-08) | haute | perf-api | M | Le tableau de bord télécharge l'historique complet de 3 tables pour afficher des compteurs | `client/src/pages/Dashboard.tsx:78` |
| [DB-09](#db-09) | haute | bug | S | Le paramètre `date=` du tableau de bord mobile est ignoré : tout l'historique est chargé et les compteurs sont faux | `client/src/pages/mobile/DashboardPage.tsx:101` |
| [DB-16](#db-16) | haute | perf-serveur | S | Top magasins d'Analytics : jointure multiplicative orders × deliveries par magasin | `server/storage.ts:3242` |
| [DB-02](#db-02) | moyenne | dette-code | M | Index absents du schéma Drizzle : `npm run db:push` les supprimerait, et l'auto-migration ne crée jamais un nouvel index | `shared/schema.ts:28` |
| [DB-05](#db-05) | moyenne | perf-serveur | S | N+1 sur /api/users : 2 requêtes par utilisateur lancées toutes en même temps | `server/routes.ts:4279` |
| [DB-10](#db-10) | moyenne | perf-api | M | Le rapprochement charge toutes les livraisons (tous statuts, tout l'historique) puis filtre côté client | `client/src/pages/BLReconciliation.tsx:357` |
| [DB-11](#db-11) | moyenne | perf-api | M | Les modales de livraison téléchargent toutes les commandes pour en garder quelques-unes (et rien pour un employé) | `client/src/components/modals/CreateDeliveryModal.tsx:61` |
| [DB-12](#db-12) | moyenne | perf-serveur | S | getDelivery enchaîne 5 requêtes séquentielles et sert surtout à des contrôles d'accès | `server/storage.ts:1041` |
| [DB-13](#db-13) | moyenne | perf-serveur | S | Statistiques mensuelles et annuelles : 4 requêtes indépendantes exécutées l'une après l'autre | `server/storage.ts:1270` |
| [DB-14](#db-14) | moyenne | perf-serveur | S | Aucun index sur deliveries.delivered_date alors que les stats filtrent dessus | `server/storage.ts:1295` |
| [DB-18](#db-18) | moyenne | perf-serveur | S | Annonces : N+1 (auteur + magasin par message) alors qu'une version avec JOIN existe déjà | `server/routes.ts:5815` |
| [DB-19](#db-19) | moyenne | perf-serveur | S | updateExistingReconciledCaches : chargement de toutes les livraisons puis 2 à 4 requêtes par livraison | `server/invoiceVerification.ts:216` |
| [DB-21](#db-21) | moyenne | perf-serveur | S | La purge périodique du cache de vérification des factures ne tourne pas en production | `server/index.production.ts:62` |
| [DB-24](#db-24) | moyenne | perf-api | L | Aucune liste n'est paginée ; les relations sont ensuite chargées via des IN de milliers d'identifiants | `server/storage.ts:711` |
| [DB-36](#db-36) | moyenne | perf-api | M | /api/groups renvoie à l'admin la ligne magasin complète (logo, SMTP, NocoDB) à 24 composants | `server/routes.ts:979` |
| [DB-37](#db-37) | moyenne | perf-serveur | S | Synthèse de la couverture d'index par table (colonnes lues dans storage.ts) | `migrations/20260814_add_performance_indexes.sql:15` |
| [DB-15](#db-15) | basse | perf-serveur | S | Index (group_id, status) absent sur orders et deliveries, alors qu'il existe pour les autres tables | `server/storage.ts:1282` |
| [DB-17](#db-17) | basse | perf-serveur | S | Série temporelle Analytics : 2 requêtes indépendantes séquentielles | `server/storage.ts:3333` |
| [DB-20](#db-20) | basse | bug | S | Diagnostic du cache : toutes les livraisons chargées pour compter, et clé de cache erronée | `server/routes.ts:2735` |
| [DB-23](#db-23) | basse | dette-code | S | user_groups n'a ni clé primaire ni contrainte d'unicité (user_id, group_id) | `shared/schema.ts:82` |
| [DB-25](#db-25) | basse | perf-serveur | S | Statistiques SAV : 3 requêtes séquentielles, plus une requête morte | `server/storage.ts:2832` |
| [DB-26](#db-26) | basse | dette-code | S | getSavTickets attend un historique par ticket qui renvoie toujours un tableau vide | `server/storage.ts:2704` |
| [DB-27](#db-27) | basse | perf-serveur | S | Numérotation des tickets SAV : filtre non indexable et risque de doublon | `server/storage.ts:2753` |
| [DB-28](#db-28) | basse | perf-serveur | S | La synchronisation des statuts charge toutes les commandes et livraisons, puis met à jour une par une | `server/routes.ts:1700` |
| [DB-29](#db-29) | basse | perf-api | S | getPublicities ignore groupIds, groupe les participations en O(P×N) et trie deux fois ; le tableau de bord l'appelle 3 fois de suite | `server/storage.ts:1502` |
| [DB-30](#db-30) | basse | perf-serveur | S | Météo : deux lectures indépendantes séquentielles et recherche « date la plus proche » non indexable | `server/routes.ts:5683` |
| [DB-31](#db-31) | basse | perf-serveur | S | Chaque vérification de facture relit la fiche magasin complète (logo) et la configuration NocoDB | `server/invoiceVerification.ts:285` |
| [DB-32](#db-32) | basse | dette-code | S | server/cache.ts n'est importé nulle part et son middleware de compression est piégeux | `server/cache.ts:96` |
| [DB-33](#db-33) | basse | perf-serveur | S | Suppression d'utilisateur : un DELETE par magasin dans une boucle | `server/routes.ts:4514` |
| [DB-34](#db-34) | basse | perf-serveur | S | DLC : pas d'index composite magasin+date, recherche texte non indexable | `server/storage.ts:2052` |
| [DB-35](#db-35) | basse | perf-serveur | S | Index complémentaires : appels clients en attente et historique des mails fournisseurs | `server/storage.ts:1933` |

### DB-01

**Les index de performance ne sont jamais créés automatiquement en production** — perf-serveur, sévérité haute, effort S

- **Fichier :** `Dockerfile:119`
- **Constat :** Dockerfile:119 `CMD ["sh", "-c", "... CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ...; node dist/index.js"]` et aucun ENTRYPOINT : scripts/docker-entrypoint.sh:53-60 (seul appelant de scripts/auto-migrate-production.sh, où sont les CREATE INDEX CONCURRENTLY) n'est jamais exécuté. server/migrations.ts:112-114 `// Ignorer les fichiers de migrations ... const allMigrations = hardcodedMigrations;` ignore migrations/20260814_add_performance_indexes.sql. server/migrations.production.ts (seul code lancé au démarrage, index.production.ts:53) ne crée aucun de ces index. init.sql (index group_id partiels, l.511-546) n'est joué par l'image postgres que si le volume postgres_data est vide (docker-compose.yml:50). docker-compose.override.yml cible un service `app` qui n'existe pas (le service s'appelle `logiflow`).
- **Impact :** Sauf application manuelle, orders/deliveries/user_groups/tasks/... n'ont que leurs clés primaires : chaque liste filtrée par magasin, chaque jointure deliveries.order_id et le chargement de l'utilisateur à chaque requête font un parcours séquentiel complet. C'est la dégradation progressive décrite dans le commit 753b301, toujours active.
- **Recommandation :** Dans server/migrations.production.ts, ajouter une fonction ensurePerformanceIndexes(client). 1) Purger les index invalides, comme le DO $$ de auto-migrate-production.sh:129-145 (`DROP INDEX IF EXISTS` sur les `idx_%` avec `NOT indisvalid`). 2) Exécuter un `await client.query('CREATE INDEX CONCURRENTLY IF NOT EXISTS ...')` par index, chacun dans son propre try/catch pour qu'un échec (table absente, etc.) n'interrompe ni les suivants ni le chiffrement des secrets. Liste : celle de migrations/20260814_add_performance_indexes.sql, plus idx_deliveries_group_delivered_date, idx_orders_group_status, idx_deliveries_group_status, idx_dlc_products_group_expiry, idx_customer_orders_pending_calls, idx_supplier_mail_logs_group_created. Exclure idx_session_expire, pg_trgm et l'index unique user_groups. 3) Faire ANALYZE des tables concernées. Lancer ensureIndexes sans bloquer le démarrage, par exemple après listen ou sans await, avec un .catch qui journalise.

### DB-03

**Le logo base64 du magasin et sa config SMTP/NocoDB sont recopiés dans chaque ligne de chaque liste** — perf-api, sévérité haute, effort S

- **Fichier :** `server/storage.ts:553`
- **Constat :** shared/schema.ts:66 `logo: text("logo"), // Logo en data URI (data:image/png;base64,...)` (jusqu'à 200 Ko, Groups.tsx:39 `MAX_LOGO_KB = 200`, soit ~270 Ko en base64). Les listes sélectionnent la ligne groups entière : storage.ts:553 et 599 (`group: groups` dans loadDeliveriesByOrderIds/loadOrdersByIds), 693 (getOrders), 740, 913 (getDeliveries), 967, 1536 (participations publicités), 1873 (getCustomerOrders), 1945, 1981 (getDlcProducts), 2274 (getTasks), 2547 (getAvoirs), 2668 (getSavTickets), 3047 (getReconciliationComments). getOrders imbrique deliveries[] qui ont chacune leur propre `group` : 2 copies par livraison. Le client ne lit que group.name (22×), color (7×), webhookUrl, nocodbTableName, nocodbConfigId (5× chacun). Toute la réponse est ensuite recopiée récursivement par stripSmtpPassword (routes.ts:168).
- **Impact :** Avec un logo de 150 Ko, 500 commandes ayant chacune une livraison font ~150 Mo de JSON ; même sans logo, ~25 colonnes inutiles par ligne (smtp_host, smtp_user, colonnes NocoDB...). Pages Commandes, Livraisons, Rapprochement, Publicités, Tableau de bord directement ralenties.
- **Recommandation :** Comme proposé : `const groupSummary = { id: groups.id, name: groups.name, color: groups.color, nocodbConfigId: groups.nocodbConfigId, nocodbTableName: groups.nocodbTableName, webhookUrl: groups.webhookUrl }` à la place de `group: groups` dans les select listés, sans toucher getGroup ni getGroups. Ajuster les types (Pick<Group, ...>) pour que tsc reste propre.

### DB-04

**La ligne users complète, hash du mot de passe compris, est renvoyée au navigateur** — bug, sévérité haute, effort S

- **Fichier :** `server/storage.ts:2669`
- **Constat :** storage.ts:2669 `creator: users,` (getSavTickets) et 2726 (getSavTicket) ; storage.ts:3046 `author: users,` (getReconciliationComments) et 3099 ; routes.ts:4276-4285 `const baseUsers = await storage.getUsers(); ... return { ...baseUser, userGroups: ...` avec getUsers = `db.select().from(users)` (storage.ts:410). sanitize.ts:36 ne retire que `smtpPassword`.
- **Impact :** Tout employé qui ouvre la page SAV ou les commentaires de rapprochement reçoit le hash scrypt des créateurs/auteurs ; la page Utilisateurs (et Tâches qui l'appelle) reçoit le hash de tous les comptes. Octets inutiles en plus du risque de sécurité.
- **Recommandation :** Remplacer `creator: users` et `author: users` par `{ id: users.id, firstName: users.firstName, lastName: users.lastName, username: users.username, email: users.email }` aux lignes 2669, 2726, 3046 et 3099. Dans GET /api/users, retirer le hash dans le map : `const { password, ...safeUser } = baseUser;` (ou via la méthode de DB-05).

### DB-06

**L'utilisateur et ses magasins sont rechargés deux fois à chaque appel API (6 allers-retours BD avant les données)** — perf-serveur, sévérité haute, effort M — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:1345`
- **Constat :** localAuth.production.ts:193-196 `passport.deserializeUser(async (id) => { const user = await storage.getUserWithGroups(id);` : req.user est déjà un UserWithGroups. Puis 91 routes refont `const user = await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id);` (ex. routes.ts:1345, 1754, 2799, 3195 ; 106 appels au total, plus 24 `await storage.getUser(`). getUserWithGroups enchaîne 2 requêtes séquentielles (storage.ts:372 puis 376). connect-pg-simple ajoute un SELECT de session et un `UPDATE ... SET expire` (node_modules/connect-pg-simple/index.js:435) à chaque requête.
- **Impact :** Latence fixe sur chaque appel ; le tableau de bord desktop (~10 appels) consomme ~60 requêtes rien que pour l'authentification.
- **Recommandation :** 1) Ajouter `const getCurrentUser = (req: any) => req.user as UserWithGroups;` et ne remplacer que les appels dont l'argument est exactement l'identifiant de l'utilisateur courant (`storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id)`, ou une variable userId tirée de req.user), en gardant le `if (!user)` existant. Ne pas toucher aux appels portant sur un autre utilisateur (ex. routes.ts:4511 userToDelete). 2) Réécrire getUserWithGroups en une seule requête avec le query builder drizzle (`db.select({ user: users, group: { id: groups.id, name: groups.name, color: groups.color, createdAt: groups.createdAt, updatedAt: groups.updatedAt } }).from(users).leftJoin(userGroups, ...).leftJoin(groups, ...).where(eq(users.id, id))`), en filtrant les group null et en gardant le format userGroups actuel. Abandonner le point 3 (pas de PostgresSessionStore en production).

### DB-07

**L'échéancier charge toutes les livraisons de tous les magasins puis filtre en JavaScript** — perf-serveur, sévérité haute, effort M

- **Fichier :** `server/routes.ts:430`
- **Constat :** routes.ts:430-431 `const allDeliveries = await storage.getDeliveries(); const groupDeliveries = allDeliveries.filter((d: any) => d.groupId === groupId && d.invoiceReference);` ; même chose dans l'export routes.ts:596-600. Puis boucles séquentielles routes.ts:444 `for (const delivery of deliveriesWithoutDueDate) { const result = await verificationService.verifyInvoice(...)` + `await storage.updateDelivery(...)`, et 491 pour le TTC ; routes.ts:519 relit encore tous les fournisseurs.
- **Impact :** Temps de réponse proportionnel à toute la base (tous magasins, relations, logos) + un appel NocoDB et une écriture BD l'un après l'autre par facture.
- **Recommandation :** Auto-implémentable : remplacer `storage.getDeliveries()` par `storage.getDeliveries([groupId])` à la l.430 et `storage.getDeliveries([validatedGroupId])` à la l.596, en gardant les filtres JS existants. La requête dédiée et la file NocoDB à concurrence limitée relèvent d'un chantier séparé.

### DB-08

**Le tableau de bord télécharge l'historique complet de 3 tables pour afficher des compteurs** — perf-api, sévérité haute, effort M — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Dashboard.tsx:78`
- **Constat :** Dashboard.tsx:78 `// Construire les URLs pour récupérer toutes les données (pas de filtrage par date)`, 79-81 `/api/orders`, `/api/deliveries`, `/api/customer-orders` sans borne ; puis 316 `allOrders.filter((order: any) => order.status === 'pending').length`, 373-376 comptages par statut, 381-386 comptages commandes clients, 318-328 livrées ce mois / palettes. Côté serveur getOrders (storage.ts:711) et getDeliveries (931) n'ont ni LIMIT ni filtre.
- **Impact :** Page d'accueil de tous les utilisateurs : plusieurs Mo à plusieurs dizaines de Mo selon l'ancienneté du magasin, juste pour une dizaine de nombres et 5 lignes récentes.
- **Recommandation :** Créer GET /api/stats/dashboard en respectant le filtrage par magasin et par rôle de /api/orders. Requêtes : `SELECT status, count(*) FROM orders WHERE group_id = ANY($1) GROUP BY status` ; idem customer_orders ; et pour deliveries : `SELECT count(*) AS total, count(*) FILTER (WHERE status='delivered' AND coalesce(delivered_date, created_at) >= date_trunc('month', now()) AND coalesce(delivered_date, created_at) < date_trunc('month', now()) + interval '1 month') AS delivered_this_month, coalesce(sum(quantity) FILTER (WHERE status='delivered' AND unit='palettes' AND coalesce(delivered_date, created_at) >= date_trunc('month', now()) AND coalesce(delivered_date, created_at) < date_trunc('month', now()) + interval '1 month'),0) AS palettes FROM deliveries WHERE group_id = ANY($1)`. Ajouter les listes `orders WHERE status='pending' ORDER BY created_at DESC` (limite à décider : la page affiche tout aujourd'hui) et `deliveries WHERE status='planned' ORDER BY scheduled_date LIMIT 4`. Les éventuelles limites sont une décision produit.

### DB-09

**Le paramètre `date=` du tableau de bord mobile est ignoré : tout l'historique est chargé et les compteurs sont faux** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/mobile/DashboardPage.tsx:101`
- **Constat :** DashboardPage.tsx:101 `params.append('date', format(new Date(), 'yyyy-MM-dd'));` (idem l.119 pour les livraisons) ; le serveur ne lit que `const { startDate, endDate, storeId } = req.query;` (routes.ts:1350 et 1759) et retombe sur getOrders/getDeliveries complets. L'écran affiche `value={orders.length}` (l.152) et `value={deliveries.length}` (l.158) sous le libellé « Commandes »/« Livraisons » du jour.
- **Impact :** Sur téléphone (réseau mobile), téléchargement de tout l'historique à chaque ouverture, et nombres affichés = total historique au lieu du jour.
- **Recommandation :** Envoyer `startDate` et `endDate` égaux à la date du jour (routes existantes getOrdersByDateRange/getDeliveriesByDateRange, servies par idx_orders_group_planned_date et idx_deliveries_group_scheduled_date), ou utiliser le futur /api/stats/dashboard (DB-08).

### DB-16

**Top magasins d'Analytics : jointure multiplicative orders × deliveries par magasin** — perf-serveur, sévérité haute, effort S

- **Fichier :** `server/storage.ts:3242`
- **Constat :** storage.ts:3242-3258 `.from(groups).leftJoin(orders, eq(groups.id, orders.groupId)).leftJoin(deliveries, eq(groups.id, deliveries.groupId))` avec `COUNT(DISTINCT ${orders.id})` / `COUNT(DISTINCT ${deliveries.id})` : pour un magasin à 3 000 commandes et 3 000 livraisons, 9 millions de lignes intermédiaires. Seul groupIds est appliqué (3252-3254), pas les dates/fournisseurs. Les 4 requêtes du résumé (3213, 3223, 3236, 3255) sont séquentielles.
- **Impact :** La page Analytics devient très lente puis tombe en timeout quand l'historique grossit ; le « top magasins » ignore la période choisie.
- **Recommandation :** Comme proposé. Garder les clés de sortie id, name, orders et deliveries (alias explicites `g.id AS id, g.name AS name`), passer groupIds en paramètre lié (pas de sql.raw), et regrouper les 4 requêtes dans un Promise.all.

### DB-02

**Index absents du schéma Drizzle : `npm run db:push` les supprimerait, et l'auto-migration ne crée jamais un nouvel index** — dette-code, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `shared/schema.ts:28`
- **Constat :** shared/schema.ts ne déclare qu'un index : l.28 `(table) => [index("IDX_session_expire").on(table.expire)]` (sur la table morte `sessions`). drizzle-kit calcule les index « supprimés » et génère des DROP INDEX (node_modules/drizzle-kit/bin.cjs:30084-30089 `prepareDropIndexesJson(it.name, it.schema, it.deletedIndexes || {})`) ; README.md:65 recommande `npm run db:push`. Par ailleurs scripts/auto-migrate-production.sh:125 ne crée les index que si `idx_deliveries_order_id` n'existe pas : tout index ajouté plus tard à ce bloc ne sera jamais créé sur une base déjà migrée.
- **Impact :** Un `db:push` sur la base de prod effacerait silencieusement tous les index de performance ; les futurs index proposés ici ne seraient pas appliqués par le script actuel.
- **Recommandation :** D'abord arrêter une liste canonique d'index (noms et définitions), en réconciliant init.sql et la migration 20260814. Ensuite seulement, la déclarer dans pgTable (`index('...').on(t.col.desc())`, `.where(sql`invoice_reference IS NOT NULL`)` pour l'index partiel). En attendant, mettre un avertissement dans le README : ne jamais lancer db:push sur la base de production.

### DB-05

**N+1 sur /api/users : 2 requêtes par utilisateur lancées toutes en même temps** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:4279`
- **Constat :** routes.ts:4279-4282 `const usersWithData = await Promise.all(baseUsers.map(async (baseUser) => { ... const userWithGroups = await storage.getUserWithGroups(baseUser.id);` ; getUserWithGroups = `await this.getUser(id)` (storage.ts:372) puis la jointure user_groups/groups (storage.ts:376-388). Soit 2N+1 requêtes, toutes émises simultanément sur un pool limité à 25 connexions (server/db.ts `max: 25`).
- **Impact :** Avec 60 utilisateurs : 121 requêtes et saturation du pool, qui ralentit aussi les autres utilisateurs pendant ce temps.
- **Recommandation :** Créer storage.getUsersWithGroups() avec le query builder drizzle (pour garder le camelCase) : `db.select({ user: { id: users.id, username: users.username, email: users.email, name: users.name, firstName: users.firstName, lastName: users.lastName, profileImageUrl: users.profileImageUrl, role: users.role, passwordChanged: users.passwordChanged, createdAt: users.createdAt, updatedAt: users.updatedAt }, groupId: userGroups.groupId, group: { id: groups.id, name: groups.name, color: groups.color, createdAt: groups.createdAt, updatedAt: groups.updatedAt } }).from(users).leftJoin(userGroups, eq(userGroups.userId, users.id)).leftJoin(groups, eq(groups.id, userGroups.groupId))`. Regrouper ensuite dans une Map par user.id, en n'ajoutant à userGroups que les lignes où group.id n'est pas null (même sémantique que l'INNER JOIN), au format `{ userId, groupId, group }`. Garder `userRoles: []`, ne pas ajouter d'ORDER BY et ne jamais exposer password. Ajouter la méthode à IStorage et à MemStorage.

### DB-10

**Le rapprochement charge toutes les livraisons (tous statuts, tout l'historique) puis filtre côté client** — perf-api, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/BLReconciliation.tsx:357`
- **Constat :** BLReconciliation.tsx:352-357 `const params = new URLSearchParams({}); ... fetch(`/api/deliveries?${params.toString()}`` sans date ni statut, puis l.371 `deliveries.filter((d: any) => d.status === 'delivered')`, avec `staleTime: 0` (l.376). Le filtre serveur `withBL` est lui aussi fait en JS après chargement complet : routes.ts:1864-1866 `if (withBL === 'true') { deliveries = deliveries.filter((d: any) => d.blNumber && d.status === 'delivered'); }`.
- **Impact :** Les livraisons planifiées (inutiles ici) et des années d'historique sont transférées et rechargées à chaque visite.
- **Recommandation :** Ajouter un paramètre optionnel `status` à getDeliveries(groupIds, { status }) dans DatabaseStorage et MemStorage (condition `eq(deliveries.status, status)` combinée par and avec le filtre magasin). Le lire dans GET /api/deliveries sans toucher au contrôle d'accès par rôle, et l'envoyer depuis BLReconciliation (`params.append('status','delivered')`), en gardant le filtre client par sécurité. Ne pas borner la période sans décision produit. L'index (group_id, status) passe par la migration de DB-01.

### DB-11

**Les modales de livraison téléchargent toutes les commandes pour en garder quelques-unes (et rien pour un employé)** — perf-api, sévérité moyenne, effort M

- **Fichier :** `client/src/components/modals/CreateDeliveryModal.tsx:61`
- **Constat :** CreateDeliveryModal.tsx:60-62 `const { data: allOrders = [] } = useQuery<OrderWithRelations[]>({ queryKey: ['/api/orders'] });` et EditDeliveryModal.tsx:50-52, puis filtre client par supplierId, groupId et `status !== 'delivered'`. queryFn par défaut = fetch(queryKey[0]) donc aucun paramètre : admin -> storage.getOrders() de TOUS les magasins avec livraisons imbriquées ; employé sans storeId -> `return res.json([]);` (routes.ts:1442).
- **Impact :** Ouverture de la modale lente pour l'admin ; un employé ne peut jamais lier une livraison à une commande (liste vide).
- **Recommandation :** Appeler `/api/orders?storeId=${groupId}&supplierId=${supplierId}&status=pending,planned` et exécuter côté serveur `SELECT id, planned_date, status, quantity, unit FROM orders WHERE group_id = $1 AND supplier_id = $2 AND status <> 'delivered' ORDER BY planned_date DESC LIMIT 50` (sans livraisons imbriquées). Index : `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_group_supplier_status ON orders (group_id, supplier_id, status);`.

### DB-12

**getDelivery enchaîne 5 requêtes séquentielles et sert surtout à des contrôles d'accès** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:1041`
- **Constat :** storage.ts:1005-1034 requête principale (sans JOIN users), puis 1041 `const user = await this.getUser(delivery.createdBy);`, 1060 `const orderData = await this.getOrder(delivery.orderId);` (2 requêtes : storage.ts:784 et 816, qui recharge aussi toutes les livraisons de la commande avec groupe complet), 1079 comptage des commentaires. Appelée par routes.ts:1885, 1914, 2144, 2183, 2219, 2338, 2474, 2617, 2691 ; ex. GET reconciliation-comments (2183) n'utilise que `delivery.groupId`.
- **Impact :** Chaque validation, vérification de facture ou ouverture de commentaires paie 5 allers-retours ; la file d'auto-vérification du rapprochement les multiplie.
- **Recommandation :** a) Dans getDelivery : `.leftJoin(users, eq(deliveries.createdBy, users.id))` avec `creator: { id, firstName, lastName, username, email }`, puis `Promise.all([orderId ? this.getOrder(orderId) : undefined, countQuery])`, en gardant le contrôle du magasin (STORE MISMATCH) et les try/catch. b) Ne basculer vers une méthode légère getDeliveryAccessInfo que les routes qui ne lisent que groupId ou status (à vérifier route par route, ex. 2183).

### DB-13

**Statistiques mensuelles et annuelles : 4 requêtes indépendantes exécutées l'une après l'autre** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:1270`
- **Constat :** getMonthlyStats : storage.ts:1270 `const ordersResult = await db...`, 1276 `const deliveriesResult = await db...`, 1287 `const pendingResult = await db...`, 1308 `const deliveriesStatsResult = await db...`. getYearlyStats : 1409, 1415, 1426, 1446. Le tableau de bord appelle les deux (Dashboard.tsx:29 et 55).
- **Impact :** 8 allers-retours séquentiels au lieu de 2 parallèles sur la page d'accueil.
- **Recommandation :** `const [ordersResult, deliveriesResult, pendingResult, deliveriesStatsResult] = await Promise.all([q1, q2, q3, q4]);` ou fusion en une requête : `SELECT count(*) FILTER (WHERE planned_date >= $1 AND planned_date < $2) AS orders_count, count(*) FILTER (WHERE status = 'pending') AS pending_count FROM orders WHERE group_id = ANY($3);`.

### DB-14

**Aucun index sur deliveries.delivered_date alors que les stats filtrent dessus** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:1295`
- **Constat :** getMonthlyStats storage.ts:1294-1299 `gte(deliveries.deliveredDate, sql`${startDate}::timestamp`), lt(deliveries.deliveredDate, ...), eq(deliveries.status, 'delivered')` ; getYearlyStats 1397-1400 (compte des livraisons sans filtre statut) et 1432-1437. Index deliveries existants : init.sql:511-515 (group_id, status, bl_number, invoice_reference, due_date), migration 20260814 l.30-39 (order_id, group_id, supplier_id, created_by, scheduled_date, (group_id, scheduled_date), created_at, invoice_reference) : rien sur delivered_date.
- **Impact :** Parcours de toutes les livraisons du magasin (ou de toute la table pour l'admin « tous magasins ») à chaque affichage du tableau de bord.
- **Recommandation :** Ajouter `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_deliveries_group_delivered_date ON deliveries (group_id, delivered_date)` à la liste de DB-01 (une requête, try/catch). idx_deliveries_delivered_date est facultatif.

### DB-18

**Annonces : N+1 (auteur + magasin par message) alors qu'une version avec JOIN existe déjà** — perf-serveur, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:5815`
- **Constat :** routes.ts:5815 `const announcements = await Promise.all(messages.map(async (message: any) => {` puis 5823-5829 `db.select({...}).from(users).where(eq(users.username, message.createdBy))` et 5852 `await db.select().from(groups).where(eq(groups.id, message.storeId));` (ligne complète avec logo pour n'en garder que id/name). AnnouncementDatabaseStorage.getAnnouncements (announcementStorage.ts:22-46) fait déjà `.leftJoin(users, eq(dashboardMessages.createdBy, users.username)).leftJoin(groups, ...)`. Le paramètre `recent=true` envoyé par Dashboard.tsx:104 est ignoré ; le filtre « moins de 2 jours » est fait côté client (Dashboard.tsx:117-123).
- **Impact :** Jusqu'à 11 requêtes au lieu d'une à chaque chargement du tableau de bord.
- **Recommandation :** Garder exactement la condition actuelle (filtre uniquement pour l'admin avec storeId) et le LIMIT 5. Remplacer les recherches par message par `.leftJoin(users, eq(users.username, dashboardMessages.createdBy)).leftJoin(groups, eq(groups.id, dashboardMessages.storeId))` en ne sélectionnant que users.id, username, firstName, lastName, name, groups.id et groups.name. Reconstruire `author` avec la même logique de nom affiché et le même repli « Utilisateur Inconnu », et `group = { id, name }` ou null. Le filtre recent=true est optionnel.

### DB-19

**updateExistingReconciledCaches : chargement de toutes les livraisons puis 2 à 4 requêtes par livraison** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/invoiceVerification.ts:216`
- **Constat :** invoiceVerification.ts:216-217 `const deliveries = await storage.getDeliveries(); const reconciledDeliveries = deliveries.filter(d => d.reconciled);` puis 222-233 `for (const delivery of reconciledDeliveries) { ... await this.updateCacheAsReconciled(delivery.invoiceReference, delivery.groupId); ... await this.updateCacheAsReconciled(delivery.blNumber, delivery.groupId);` ; chaque appel = SELECT (l.173) + UPSERT (l.195). Clé : `${groupId}_${invoiceReference.trim().toLowerCase()}` (l.13).
- **Impact :** Action admin qui dure plusieurs minutes et monopolise des connexions sur une base d'un an.
- **Recommandation :** Comme proposé, en ajoutant `AND d.invoice_reference IS NOT NULL AND btrim(d.invoice_reference) <> ''` (idem pour bl_number) pour reproduire les tests `.trim()` actuels. Écart résiduel : trim/lower de PostgreSQL ne traitent pas les blancs Unicode comme JS, ce qui est acceptable.

### DB-21

**La purge périodique du cache de vérification des factures ne tourne pas en production** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/index.production.ts:62`
- **Constat :** server/index.ts:63-64 `const { startMaintenanceJobs } = await import('./maintenance.js'); startMaintenanceJobs();` n'existe que dans le point d'entrée de développement ; le build Docker compile server/index.production.ts (Dockerfile:41) qui ne l'appelle pas (aucune occurrence de « maintenance » dans ce fichier, registerRoutes l.62). Les entrées expirées ne sont supprimées qu'à la relecture de la même clé (storage.ts:1730).
- **Impact :** invoice_verification_cache continue de grossir sans limite en production, ce que le commit 753b301 pensait avoir corrigé.
- **Recommandation :** Dans index.production.ts, après `await registerRoutes(app);` : `const { startMaintenanceJobs } = await import('./maintenance.js'); startMaintenanceJobs();`.

### DB-24

**Aucune liste n'est paginée ; les relations sont ensuite chargées via des IN de milliers d'identifiants** — perf-api, sévérité moyenne, effort L

- **Fichier :** `server/storage.ts:711`
- **Constat :** Pas de .limit() : getOrders storage.ts:711 `await query.orderBy(desc(orders.createdAt))`, getDeliveries 931, getCustomerOrders 1883, getDlcProducts 2064, getTasks 2301 (tâches terminées comprises), getAvoirs 2565, getSavTickets 2701. Orders.tsx:73 et Deliveries.tsx:80 appellent sans date. getOrders passe ensuite tous les ids à `inArray(deliveries.orderId, orderIds)` (566) et getDeliveries tous les ids à `inArray(reconciliationComments.deliveryId, deliveryIds)` (631) : PostgreSQL refuse plus de 65 535 paramètres liés.
- **Impact :** Temps de chargement et mémoire navigateur croissant sans fin ; erreur SQL certaine au-delà de ~65 000 commandes ou livraisons pour l'admin « tous magasins ».
- **Recommandation :** Pagination keyset : `WHERE group_id = ANY($1) AND (created_at, id) < ($2, $3) ORDER BY created_at DESC, id DESC LIMIT 50`, avec `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_group_created ON orders (group_id, created_at DESC, id DESC);` (idem deliveries, customer_orders, avoirs, sav_tickets, tasks). Remplacer les inArray(ids) par une sous-requête sur le même filtre, ex. `inArray(deliveries.orderId, db.select({ id: orders.id }).from(orders).where(inArray(orders.groupId, groupIds)))`.

### DB-36

**/api/groups renvoie à l'admin la ligne magasin complète (logo, SMTP, NocoDB) à 24 composants** — perf-api, sévérité moyenne, effort M

- **Fichier :** `server/routes.ts:979`
- **Constat :** routes.ts:979-981 `if (user.role === 'admin') { const groups = await storage.getGroups(); res.json(groups);` avec getGroups = `db.select().from(groups)` (storage.ts:433). `'/api/groups'` est utilisé par 24 fichiers client ; le logo n'est lu que par le formulaire de Groups.tsx (l.282). Les non-admins reçoivent déjà une version légère (id, name, color) via getUserWithGroups (storage.ts:380-384).
- **Impact :** Avec 10 magasins ayant un logo, ~2,7 Mo téléchargés par l'admin à chaque invalidation de ['/api/groups'].
- **Recommandation :** Faire renvoyer à /api/groups une projection (id, name, color, nocodbConfigId, nocodbTableName, webhookUrl, smtpEnabled) et ajouter GET /api/groups/:id (complet, admin) utilisé par le formulaire d'édition de Groups.tsx.

### DB-37

**Synthèse de la couverture d'index par table (colonnes lues dans storage.ts)** — perf-serveur, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `migrations/20260814_add_performance_indexes.sql:15`
- **Constat :** orders : group_id, planned_date, created_at, supplier_id, created_by -> couverts par la migration 20260814 (l.20-26) ; status -> init.sql:519 seulement (DB-15). deliveries : order_id, group_id, scheduled_date, created_at, invoice_reference -> migration (l.30-39) ; delivered_date -> AUCUN (DB-14) ; status, bl_number -> init.sql seulement. user_groups : user_id, group_id -> migration (l.17-18), pas d'unicité (DB-23). users : id PK, username et email UNIQUE -> OK. tasks : group_id, status, due_date -> migration (l.56-59) ; start_date, created_at (tri) -> aucun. customer_orders : group_id, status, created_at -> migration (l.44-47) ; customer_notified -> aucun (DB-35). dlc_products : group_id, supplier_id, expiry_date, (group_id,status) -> migration (l.50-53) ; (group_id, expiry_date) -> aucun (DB-34). sav_tickets / avoirs : group_id, supplier_id, created_at, (group_id,status) -> migration. publicities : year -> migration + init.sql ; pub_number UNIQUE. publicity_participations : PK (publicity_id, group_id) + group_id. dashboard_messages : store_id, created_at -> migration + init.sql. invoice_verification_cache : cache_key UNIQUE, expires_at, group_id -> OK. session (connect-pg-simple) : sid PK, expire -> AUCUN (DB-22). Attention : tous les index « migration » ne sont présents que si le script a été lancé à la main (DB-01).
- **Impact :** Donne la liste exacte des index à garantir au démarrage et des trous restants.
- **Recommandation :** Liste à ajouter à migrations.production.ts (CONCURRENTLY IF NOT EXISTS, une requête et un try/catch par index, après purge des index invalides, sans bloquer le démarrage) : idx_deliveries_group_delivered_date, idx_orders_group_status, idx_deliveries_group_status, idx_dlc_products_group_expiry, idx_customer_orders_pending_calls, idx_supplier_mail_logs_group_created, plus les index de la migration 20260814. Ne pas créer idx_session_expire. Puis ANALYZE des tables et contrôle via pg_stat_user_indexes.

### DB-15

**Index (group_id, status) absent sur orders et deliveries, alors qu'il existe pour les autres tables** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/storage.ts:1282`
- **Constat :** storage.ts:1282-1290 `let pendingWhereCondition = eq(orders.status, 'pending'); ... inArray(orders.groupId, groupIds)` (et 1421-1429) ; filtre deliveries.status dans les stats (1297) et le rapprochement (DB-10). idx_orders_status / idx_deliveries_status n'existent que dans init.sql:512 et 519 (bases neuves uniquement). La migration 20260814 crée (group_id, status) pour customer_orders (l.47), dlc_products (53), tasks (59), avoirs (65), sav_tickets (71) mais pas pour orders ni deliveries.
- **Impact :** Comptage des commandes en attente et filtrage des livraisons livrées non servis par un index sélectif.
- **Recommandation :** Ajouter idx_orders_group_status et idx_deliveries_group_status à la liste de DB-01 (CONCURRENTLY, une requête par index).

### DB-17

**Série temporelle Analytics : 2 requêtes indépendantes séquentielles** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/storage.ts:3333`
- **Constat :** storage.ts:3333 `const ordersData = await db.execute(sql.raw(ordersSql));` puis 3344 `const deliveriesData = await db.execute(sql.raw(deliveriesSql));`.
- **Impact :** Latence doublée à chaque changement de filtre ou de granularité.
- **Recommandation :** `const [ordersData, deliveriesData] = await Promise.all([db.execute(sql.raw(ordersSql)), db.execute(sql.raw(deliveriesSql))]);`.

### DB-20

**Diagnostic du cache : toutes les livraisons chargées pour compter, et clé de cache erronée** — bug, sévérité basse, effort S

- **Fichier :** `server/routes.ts:2735`
- **Constat :** routes.ts:2725-2727 `const deliveries = await storage.getDeliveries(); const reconciledCount = deliveries.filter(d => d.reconciled).length;` ; routes.ts:2735 `const cacheKey = `${delivery.invoiceReference.toLowerCase()}_${delivery.groupId}`;` alors que generateCacheKey (invoiceVerification.ts:13) produit `${groupId}_${invoiceReference.trim().toLowerCase()}`.
- **Impact :** Le diagnostic affiche toujours « cacheExists: false » et coûte un chargement complet de la table.
- **Recommandation :** Comme proposé. Garder le même format de réponse (statistics.totalDeliveries, reconciledDeliveries, percentageReconciled en protégeant la division par zéro, et sampleCaches), et caster les count en Number.

### DB-23

**user_groups n'a ni clé primaire ni contrainte d'unicité (user_id, group_id)** — dette-code, sévérité basse, effort S

- **Fichier :** `shared/schema.ts:82`
- **Constat :** shared/schema.ts:82-86 `export const userGroups = pgTable("user_groups", { userId: ..., groupId: ..., createdAt: ... });` sans primaryKey ; init.sql:67-71 idem. assignUserToGroup (storage.ts:1210-1213) insère sans vérification, depuis routes.ts:4241 et 4469.
- **Impact :** Affectations en double possibles ; elles se répercutent dans userGroups de chaque requête (deserializeUser) et dans les listes de magasins.
- **Recommandation :** Dédoublonner (`DELETE FROM user_groups a USING user_groups b WHERE a.ctid < b.ctid AND a.user_id = b.user_id AND a.group_id = b.group_id;`) puis `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uq_user_groups_user_group ON user_groups (user_id, group_id);` (rend idx_user_groups_user_id redondant) et `.onConflictDoNothing()` dans assignUserToGroup.

### DB-25

**Statistiques SAV : 3 requêtes séquentielles, plus une requête morte** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/storage.ts:2832`
- **Constat :** storage.ts:2825-2829 `let baseQuery = db.select().from(savTickets); ... baseQuery = baseQuery.where(...)` jamais exécutée ; 2832 statusResults (GROUP BY status), 2842 priorityResults (GROUP BY priority), 2852 totalResult, chacun `await` à la suite.
- **Impact :** 3 allers-retours au lieu d'un à chaque affichage de la page SAV.
- **Recommandation :** Comme proposé, en castant les count en Number et en gardant les clés totalTickets, newTickets, inProgressTickets, resolvedTickets et criticalTickets. Supprimer baseQuery.

### DB-26

**getSavTickets attend un historique par ticket qui renvoie toujours un tableau vide** — dette-code, sévérité basse, effort S

- **Fichier :** `server/storage.ts:2704`
- **Constat :** storage.ts:2704-2706 `const ticketsWithHistory = await Promise.all(results.map(async (result: any) => { const history = await this.getSavTicketHistory(result.ticket.id);` alors que getSavTicketHistory (2790-2806) est entièrement commenté et fait `return [];`.
- **Impact :** Une promesse par ticket pour rien ; trompe le lecteur qui croit à un N+1.
- **Recommandation :** `return results.map((r: any) => ({ ...r.ticket, supplier: r.supplier, group: r.group, creator: r.creator, history: [] }));`.

### DB-27

**Numérotation des tickets SAV : filtre non indexable et risque de doublon** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:2753`
- **Constat :** storage.ts:2750-2755 `.where(sql`EXTRACT(year from created_at) = ${currentYear}`)` puis `SAV-${currentYear}-${count + 1}` ; ticket_number n'est pas unique (schema.ts:871).
- **Impact :** Parcours complet de sav_tickets à chaque création (l'index created_at ne sert pas) ; deux créations simultanées ou une suppression produisent des numéros en double.
- **Recommandation :** Auto-implémentable seulement : remplacer le filtre par `created_at >= make_date(${currentYear}::int, 1, 1) AND created_at < make_date(${currentYear + 1}::int, 1, 1)` (année suivante calculée en JS). À traiter à part, avec décision produit : le bug de concaténation (`Number(count[0]?.count ?? 0) + 1`) et l'unicité de ticket_number (séquence ou max par année, puis index unique).

### DB-28

**La synchronisation des statuts charge toutes les commandes et livraisons, puis met à jour une par une** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:1700`
- **Constat :** routes.ts:1700 `const orders = await storage.getOrders();` (tous magasins, livraisons imbriquées), puis 1704-1724 `for (const order of orders) { ... await storage.updateOrder(order.id, { status: 'delivered' });`.
- **Impact :** Action admin lente et coûteuse en mémoire sur une base d'un an.
- **Recommandation :** `WITH c AS (SELECT o.id, o.status AS current_status, count(*) FILTER (WHERE d.status = 'delivered') AS delivered, count(*) AS total FROM orders o JOIN deliveries d ON d.order_id = o.id WHERE o.status <> 'delivered' GROUP BY o.id, o.status HAVING count(*) FILTER (WHERE d.status = 'delivered') > 0), u AS (UPDATE orders SET status = 'delivered', updated_at = now() FROM c WHERE orders.id = c.id RETURNING orders.id) SELECT c.* FROM c JOIN u ON u.id = c.id;`, puis reconstruire problematicOrders et fixedOrders au même format (counts castés en Number).

### DB-29

**getPublicities ignore groupIds, groupe les participations en O(P×N) et trie deux fois ; le tableau de bord l'appelle 3 fois de suite** — perf-api, sévérité basse, effort S

- **Fichier :** `server/storage.ts:1502`
- **Constat :** storage.ts:1502 signature `getPublicities(year?: number, groupIds?: number[])` mais groupIds n'est jamais utilisé ; 1522 `orderBy(publicities.pubNumber)` puis 1544 re-tri JS ; 1552-1553 `participations.filter((p: any) => p.publicityId === publicity.id)` pour chaque publicité. Dashboard.tsx:205-211 `for (const year of years) { ... await fetch(`/api/ad-campaigns?${params}`)` (3 appels séquentiels).
- **Impact :** Réponses plus lourdes que nécessaire et 3 allers-retours HTTP+BD successifs sur l'accueil.
- **Recommandation :** Grouper les participations dans une Map<publicityId, []> ; trier en SQL `ORDER BY NULLIF(regexp_replace(pub_number, '\D', '', 'g'), '')::int` ; pour l'accueil, une seule requête `WHERE end_date >= current_date ORDER BY start_date LIMIT 10`. Filtrer par magasin via `EXISTS (SELECT 1 FROM publicity_participations pp WHERE pp.publicity_id = p.id AND pp.group_id = ANY($1))` est une décision produit.

### DB-30

**Météo : deux lectures indépendantes séquentielles et recherche « date la plus proche » non indexable** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:5683`
- **Constat :** routes.ts:5683-5684 `let currentYearData = await storage.getWeatherData(today, true); let previousYearData = await storage.getWeatherData(previousYearDate, false);` ; storage.ts:2936-2938 `sql`ABS(${weatherData.date} - ${date}::date) <= ${maxDistanceDays}`` puis ORDER BY ABS(...).
- **Impact :** Latence ajoutée au widget météo affiché sur l'accueil.
- **Recommandation :** `const [currentYearData, previousYearData] = await Promise.all([storage.getWeatherData(today, true), storage.getWeatherData(previousYearDate, false)]);`. Dans getNearestWeatherData, si on le souhaite : `${weatherData.date} BETWEEN ${date}::date - ${maxDistanceDays}::int AND ${date}::date + ${maxDistanceDays}::int`, en gardant l'ORDER BY ABS(...) et le LIMIT 1.

### DB-31

**Chaque vérification de facture relit la fiche magasin complète (logo) et la configuration NocoDB** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/invoiceVerification.ts:285`
- **Constat :** invoiceVerification.ts:285 `const group = await storage.getGroup(groupId);` (= `db.select().from(groups)`, storage.ts:437, logo compris) et 360 `const nocodbConfig = await storage.getActiveNocodbConfig();` (+ déchiffrement) ; idem 658 et 734 pour les BL. Appelé en boucle par l'échéancier (routes.ts:444, 491) et la file d'auto-vérification du rapprochement.
- **Impact :** Des centaines de relectures identiques (jusqu'à ~270 Ko chacune) quand on vérifie un lot de factures.
- **Recommandation :** Seule partie sûre : une méthode storage.getGroupVerificationSettings(id) qui ne projette que name, nocodbConfigId, nocodbTableName, nocodbTableId, invoiceColumnName, nocodb*ColumnName et webhookUrl, utilisée aux l.285 et 658. Le cache mémoire de la config NocoDB est à décider séparément, avec la liste complète des invalidations.

### DB-32

**server/cache.ts n'est importé nulle part et son middleware de compression est piégeux** — dette-code, sévérité basse, effort S

- **Fichier :** `server/cache.ts:96`
- **Constat :** Aucun import de './cache' dans server/*.ts. cache.ts:96-104 `setupCompression` pose `res.setHeader('Content-Encoding', 'gzip')` sans compresser réellement ; `createOptimizedQuery` (l.108-123) ajoute `LIMIT 1000` à l'aveugle. Aucun middleware `compression` n'est monté dans index.production.ts : les gros JSON des listes partent non compressés (sauf si un proxy compresse).
- **Impact :** Aucun cache serveur malgré l'apparence ; brancher ce fichier tel quel casserait les réponses.
- **Recommandation :** Auto-implémentable : supprimer setupCompression et createOptimizedQuery (ou tout cache.ts, qui n'a aucun import), ajouter la dépendance `compression` (et @types/compression) avec mise à jour du lockfile, puis `app.use(compression())` dans index.production.ts avant registerProductionRoutes. Le cache mémoire de getGroups et getSuppliers est hors périmètre auto.

### DB-33

**Suppression d'utilisateur : un DELETE par magasin dans une boucle** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/routes.ts:4514`
- **Constat :** routes.ts:4511-4516 `const userWithGroups = await storage.getUserWithGroups(userToDelete); if (userWithGroups) { for (const userGroup of userWithGroups.userGroups) { await storage.removeUserFromGroup(userToDelete, userGroup.groupId); }`.
- **Impact :** 2 + N requêtes au lieu d'une.
- **Recommandation :** Ajouter `removeUserFromAllGroups(userId)` (`db.delete(userGroups).where(eq(userGroups.userId, userId))`) à IStorage, DatabaseStorage et MemStorage, puis l'appeler à la place de la boucle.

### DB-34

**DLC : pas d'index composite magasin+date, recherche texte non indexable** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:2052`
- **Constat :** storage.ts:1990 `inArray(dlcProducts.groupId, groupIds)` + 2007-2008 `gt(dlcProducts.expiryDate, today), lte(dlcProducts.expiryDate, in15Days)` + tri 2064-2077 sur expiry_date ; index existants séparés idx_dlc_products_group_id / idx_dlc_products_expiry_date (migration l.50-52). Recherche 2052-2053 `LOWER(${dlcProducts.productName}) LIKE LOWER(${'%' + filters.search + '%'})`.
- **Impact :** Les filtres « expire bientôt » et la recherche parcourent toutes les lignes du magasin.
- **Recommandation :** N'ajouter que `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_dlc_products_group_expiry ON dlc_products (group_id, expiry_date)` à la liste de DB-01. Pas de pg_trgm.

### DB-35

**Index complémentaires : appels clients en attente et historique des mails fournisseurs** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/storage.ts:1933`
- **Constat :** getPendingClientCalls storage.ts:1932-1938 `eq(customerOrders.customerNotified, false), inArray(customerOrders.status, [...])` + groupId, tri created_at (1951) : aucun index sur customer_notified. getSupplierMailLogs storage.ts:2976-2988 `inArray(supplierMailLogs.groupId, groupIds)` + `.orderBy(desc(supplierMailLogs.createdAt)).limit(500)` : seul idx_supplier_mail_logs_group (init.sql:439) existe.
- **Impact :** Faible aujourd'hui, croissant avec l'historique.
- **Recommandation :** Ajouter ces deux index à la liste de DB-01 (CONCURRENTLY, une requête chacun).
