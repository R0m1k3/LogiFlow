# Commandes clients

_43 constats vérifiés — 7 haute, 23 moyenne, 13 basse._

## Pages analysées

### `/customer-orders (desktop)`

**Rôle :** Suivre les commandes passées par les clients du magasin (produit non en stock commandé au fournisseur) : de la prise de commande jusqu'au retrait par le client, avec rappel du client quand le produit est disponible et impression d'une étiquette/fiche à code-barres.

**Tâches principales de l'utilisateur :**
- Créer une commande client (nom, téléphone, produit via recherche gencode/référence, fournisseur, acompte)
- Retrouver une commande (recherche texte, filtre fournisseur, filtre statut)
- Faire avancer le statut (En attente -> En cours -> Disponible -> Retiré / Annulé)
- Voir la liste des clients à appeler (bandeau orange + modale) et marquer un client comme contacté avec commentaire
- Imprimer la fiche/étiquette d'une commande disponible
- Consulter le détail, modifier, supprimer une commande

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/customer-orders[?storeId=X] (storeId seulement si admin) | au montage + à chaque changement de magasin + après chaque mutation (invalidate/refetch) | server/routes.ts:3486 -> storage.getUserWithGroups (storage.ts:371) + storage.getCustomerOrders (storage.ts:1868) | Renvoie TOUTES les commandes (historique Retiré/Annulé inclus) sans pagination, avec la ligne groups complète (logo base64, SMTP, NocoDB) et la ligne suppliers complète par commande. Filtrage/tri/pagination faits côté client. Même liste aussi téléchargée par Dashboard.tsx:81-93 juste pour compter par statut. |
| GET /api/customer-orders/pending-calls?storeId=X | au montage + polling toutes les 30 s (refetchInterval: 30000), fetch() manuel dans queryFn | server/routes.ts:3638 -> storage.getUserWithGroups + storage.getPendingClientCalls (storage.ts:1931) | Sous-ensemble de la liste déjà chargée (status Disponible && !customerNotified). 403 systématique pour le rôle employee mais la requête est quand même lancée (avec 2 retries) toutes les 30 s. storeId ignoré côté serveur pour directeur/manager. |
| GET /api/suppliers | au montage (filtre fournisseur) + dans CustomerOrderForm (même clé, dédupliqué) | server/routes.ts:1141 -> storage.getUser + storage.getSuppliers (storage.ts:467) | Liste complète des fournisseurs, même ceux sans commande client. |
| GET /api/groups | au montage (CustomerOrders.tsx:69) + CustomerOrderForm.tsx:76 | server/routes.ts:970 -> storage.getUserWithGroups + storage.getGroups (storage.ts:432) | Résultat jamais utilisé dans CustomerOrders.tsx (variable groups morte) ; servi par le cache du Layout. |
| POST /api/customer-orders | au clic Créer | server/routes.ts:3517 -> storage.createCustomerOrder (storage.ts:1913) | Aucune validation Zod (insertCustomerOrderSchema importé mais inutilisé), req.body inséré tel quel ; ~12 console.log de debug dont le body complet (données personnelles client). |
| PUT /api/customer-orders/:id | au clic Modifier (formulaire), changement de statut, 'Annuler le contact' | server/routes.ts:3577 -> storage.getCustomerOrder (storage.ts:1892, 2 jointures + logo) + storage.updateCustomerOrder (storage.ts:1918) | Pas de contrôle de rôle (employee peut modifier malgré la matrice de permissions), req.body passé directement à .set() (groupId, createdBy modifiables). |
| DELETE /api/customer-orders/:id | au clic Supprimer (après confirmation) | server/routes.ts:3607 -> storage.getCustomerOrder + storage.deleteCustomerOrder (storage.ts:1927) | Pas de contrôle de rôle serveur : un manager (sans droit delete) peut supprimer via l'API. |
| PATCH /api/customer-orders/:id/mark-called | au clic Confirmer (modale contact) ou 'Marquer Appelé' (ClientCallsModal) | server/routes.ts:3674 -> storage.getCustomerOrder + storage.markClientCalled (storage.ts:1961) | 403 pour employee alors que le bouton téléphone est affiché à tous et que la mutation n'a pas de onError (échec silencieux). |
| GET /api/ffnancy/articles?ean\|codein&limit=1 puis GET /api/ffnancy/mouvements/entrees?artNoId=... | au clic sur la loupe gencode/référence du formulaire (2 appels séquentiels) | server/routes.ts:6396 et 6411 (proxy fetch vers api.ffnancy.fr, sans timeout ni cache) | Waterfall de 2 allers-retours externes ; une erreur réseau est présentée comme 'Produit non référencé' et bloque la création. |

**Lisibilité / simplicité :** Page fonctionnelle mais dense et peu guidante : bandeau d'alerte collant au-dessus du titre, carte 'Recherche et Filtres' avec titre inutile, tableau de 9 colonnes sans défilement horizontal, 4 à 5 boutons-icônes sans libellé par ligne (dont l'ensemble varie selon le statut), statut modifiable en cliquant sur un badge (non découvrable, non accessible clavier) avec application immédiate y compris 'Annulé'. Pas d'état vide ni d'état d'erreur ('Chargement...' en texte brut). Libellés mélangés (option 'Status' en anglais, 'Fournisseurs' comme valeur 'tous', 'Gencode', 'Marquer Appelé' vs 'Marquer client comme contacté'). Formulaire de création/modification affiché à 90 % (transform scale) sans hauteur max : texte réduit et bouton Créer hors écran sur portable ; fournisseur n°1 présélectionné silencieusement ; le champ gencode (qui pré-remplit tout) arrive après la désignation. Modale Détails trompeuse (faux code-barres 'scannable', bloc 'Actions disponibles' sans bouton, notes et commentaire d'appel non affichés). Plusieurs bugs de données graves en modification (statut remis à 'En attente', commande déplacée de magasin, notes effacées). Console polluée de logs de debug.

### `/customer-orders (mobile)`

**Rôle :** Version téléphone des commandes clients : consulter la liste du magasin sélectionné, appeler le client, marquer contacté, changer rapidement le statut et créer une commande depuis le rayon.

**Tâches principales de l'utilisateur :**
- Rechercher une commande (client, produit, référence)
- Appeler le client (lien tel:) et le marquer comme contacté avec commentaire
- Passer une commande en Disponible / Retiré / Annulé via le menu ⋮
- Créer une commande via le bouton flottant (+) et la feuille 'Nouvelle Commande'

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/customer-orders?storeId=X | au montage, uniquement si selectedStoreId (enabled: !!selectedStoreId && !!user), fetch() manuel | server/routes.ts:3486 -> storage.getCustomerOrders (storage.ts:1868) | Même payload lourd que desktop (group complet avec logo par commande). Clé ['/api/customer-orders', selectedStoreId] identique à la clé desktop non-admin mais données différentes (filtrées par magasin ici, pas sur desktop). |
| GET /api/suppliers | au montage, queryFn manuelle sans contrôle res.ok | server/routes.ts:1141 -> storage.getSuppliers (storage.ts:467) | Chargé même si la feuille de création n'est jamais ouverte (pourrait être enabled: isCreateOpen). |
| GET /api/groups | au montage (déjà en cache via MobileApp) | server/routes.ts:970 -> storage.getGroups (storage.ts:432) | Utilisé seulement pour un fallback admin dans onSubmit. |
| PUT /api/customer-orders/:id | au clic Marquer Disponible / Retiré / Annuler (menu ⋮) et 'Annuler le contact' | server/routes.ts:3577 -> storage.getCustomerOrder + storage.updateCustomerOrder (storage.ts:1918) | Aucune confirmation, aucun onError, accessible aux employés (pas de droit edit). |
| PATCH /api/customer-orders/:id/mark-called | au clic Confirmer dans la feuille contact | server/routes.ts:3674 -> storage.markClientCalled (storage.ts:1961) | 403 silencieux pour les employés. |
| POST /api/customer-orders | au clic 'Valider la commande' | server/routes.ts:3517 -> storage.createCustomerOrder (storage.ts:1913) | isPromotionalPrice et customerNotified perdus (retirés par zodResolver). |
| GET /api/ffnancy/articles puis /api/ffnancy/mouvements/entrees | au clic loupe référence/gencode (2 appels séquentiels) | server/routes.ts:6396 et 6411 | Code dupliqué à l'identique de CustomerOrderForm.tsx. |

**Lisibilité / simplicité :** Cartes lisibles avec action 'Appeler' bien visible, mais : liste vide 'Aucune commande trouvée' dès que 'Tous les magasins' est sélectionné (requête désactivée), aucun filtre par statut ni séparation des commandes terminées (Retiré/Annulé mélangées aux actives), pas de pagination, menu ⋮ incomplet (pas 'Commande en cours') avec un 'Annuler' ambigu et sans confirmation, pas de bandeau 'clients à appeler'. Formulaire de création dupliqué du desktop, sans messages d'erreur de validation (FormMessage importé mais jamais rendu), cases 'Prix promotionnel' et 'Client déjà notifié' sans effet. Libellés abrégés ou fautifs ('Qty', 'Qté', 'Cmd Client', 'rév...'), date sans année, montant d'acompte non formaté, modale contact faite main (pas de focus/Échap).

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [CMDCLI-01](#cmdcli-01) | haute | perf-api | S | Chaque commande embarque la fiche magasin complète (logo base64, SMTP, NocoDB) et la fiche fournisseur complète | `server/storage.ts:1873` |
| [CMDCLI-02](#cmdcli-02) | haute | perf-api | L | Liste sans pagination ni filtre serveur : tout l'historique est téléchargé puis filtré/trié/paginé en JS | `server/routes.ts:3508` |
| [CMDCLI-03](#cmdcli-03) | haute | bug | S | Modifier une commande remet toujours son statut à « En attente de Commande » | `client/src/components/CustomerOrderForm.tsx:143` |
| [CMDCLI-04](#cmdcli-04) | haute | bug | S | Modifier une commande peut la déplacer dans un autre magasin | `client/src/components/CustomerOrderForm.tsx:127` |
| [CMDCLI-07](#cmdcli-07) | haute | bug | M | Permissions non appliquées côté serveur et corps de requête non validé (PUT/POST/DELETE) | `server/routes.ts:3599` |
| [CMDCLI-08](#cmdcli-08) | haute | bug | S | Impression d'étiquette : injection HTML/JS (XSS) via les champs de la commande | `client/src/pages/CustomerOrders.tsx:388` |
| [CMDCLI-20](#cmdcli-20) | haute | ux-simplicite | S | Formulaire de commande réduit à 90 % par transform et modale sans hauteur max : texte petit, bouton Créer hors écran | `client/src/pages/CustomerOrders.tsx:971` |
| [CMDCLI-05](#cmdcli-05) | moyenne | bug | S | Modifier une commande efface ses notes et l'email client ; les notes ne sont affichées nulle part | `client/src/components/CustomerOrderForm.tsx:147` |
| [CMDCLI-06](#cmdcli-06) | moyenne | bug | S | Mobile : les cases « Prix promotionnel / Pub » et « Client déjà notifié » n'ont aucun effet | `client/src/pages/mobile/CustomerOrdersPage.tsx:67` |
| [CMDCLI-09](#cmdcli-09) | moyenne | perf-api | S | Polling pending-calls lancé pour les employés alors que le serveur répond 403 (avec 2 retries toutes les 30 s) | `client/src/pages/CustomerOrders.tsx:74` |
| [CMDCLI-10](#cmdcli-10) | moyenne | bug | S | Mutations sans gestion d'erreur : échecs silencieux (statut, contact client) | `client/src/pages/CustomerOrders.tsx:171` |
| [CMDCLI-11](#cmdcli-11) | moyenne | perf-serveur | S | getUserWithGroups rappelé dans chaque handler alors que deserializeUser l'a déjà chargé (4 requêtes SQL séquentielles par appel) | `server/routes.ts:3488` |
| [CMDCLI-14](#cmdcli-14) | moyenne | perf-client | M | Chaque changement de statut/contact recharge toute la liste au lieu de mettre à jour la ligne | `client/src/pages/CustomerOrders.tsx:175` |
| [CMDCLI-15](#cmdcli-15) | moyenne | bug | S | « Marquer Appelé » depuis la modale ne rafraîchit pas le tableau pour un admin avec magasin sélectionné | `client/src/components/modals/ClientCallsModal.tsx:42` |
| [CMDCLI-16](#cmdcli-16) | moyenne | ux-simplicite | S | Le sélecteur de magasin n'a aucun effet pour directeur/manager (et clé de cache partagée avec le mobile) | `client/src/pages/CustomerOrders.tsx:95` |
| [CMDCLI-17](#cmdcli-17) | moyenne | perf-client | S | Filtre + tri de toute la liste recalculés à chaque rendu (y compris à chaque frappe dans le commentaire d'appel) | `client/src/pages/CustomerOrders.tsx:657` |
| [CMDCLI-18](#cmdcli-18) | moyenne | lisibilite | S | Pas d'état vide, pas d'état d'erreur, chargement en texte brut | `client/src/pages/CustomerOrders.tsx:829` |
| [CMDCLI-21](#cmdcli-21) | moyenne | ux-simplicite | M | Formulaire peu guidant : fournisseur n°1 présélectionné, gencode « obligatoire » non exigé, recherche produit placée après la désignation | `client/src/components/CustomerOrderForm.tsx:115` |
| [CMDCLI-22](#cmdcli-22) | moyenne | ux-simplicite | S | Une panne de l'API article est affichée comme « Produit non référencé » et bloque la création | `client/src/components/CustomerOrderForm.tsx:169` |
| [CMDCLI-24](#cmdcli-24) | moyenne | lisibilite | M | Tableau de 9 colonnes sans défilement horizontal, informations clés absentes, texte barré illisible | `client/src/pages/CustomerOrders.tsx:832` |
| [CMDCLI-25](#cmdcli-25) | moyenne | accessibilite | S | Éléments cliquables non accessibles : badge de statut, bandeau d'alerte, boutons-icônes sans libellé | `client/src/pages/CustomerOrders.tsx:882` |
| [CMDCLI-26](#cmdcli-26) | moyenne | ux-simplicite | S | Changement de statut appliqué immédiatement, y compris « Annulé », sans confirmation (et menu mobile incomplet) | `client/src/pages/CustomerOrders.tsx:1037` |
| [CMDCLI-29](#cmdcli-29) | moyenne | ux-simplicite | S | Modale Détails trompeuse : faux code-barres « scannable », bloc d'actions sans bouton, infos d'appel absentes | `client/src/components/CustomerOrderDetails.tsx:126` |
| [CMDCLI-30](#cmdcli-30) | moyenne | bug | S | Le code-barres imprimé peut différer du gencode du produit | `client/src/pages/CustomerOrders.tsx:309` |
| [CMDCLI-31](#cmdcli-31) | moyenne | ux-simplicite | S | Mobile : « Aucune commande trouvée » dès que « Tous les magasins » ou aucun magasin n'est sélectionné | `client/src/pages/mobile/CustomerOrdersPage.tsx:91` |
| [CMDCLI-32](#cmdcli-32) | moyenne | ux-simplicite | M | Mobile : erreurs de validation invisibles et formulaire dupliqué du desktop | `client/src/pages/mobile/CustomerOrdersPage.tsx:54` |
| [CMDCLI-33](#cmdcli-33) | moyenne | perf-client | M | Mobile : toutes les commandes (historique compris) rendues d'un bloc, sans filtre de statut ni pagination | `client/src/pages/mobile/CustomerOrdersPage.tsx:270` |
| [CMDCLI-39](#cmdcli-39) | moyenne | dette-code | S | Logs de debug en production, dont des données personnelles clients | `server/routes.ts:3530` |
| [CMDCLI-40](#cmdcli-40) | moyenne | perf-serveur | S | Réponses JSON non compressées et recopiées récursivement à chaque envoi | `server/routes.ts:168` |
| [CMDCLI-41](#cmdcli-41) | moyenne | perf-api | S | Les « clients à appeler » sont rechargés par un 2e endpoint polled alors qu'ils sont déjà dans la liste | `client/src/pages/CustomerOrders.tsx:74` |
| [CMDCLI-12](#cmdcli-12) | basse | perf-serveur | S | PUT/DELETE/mark-called chargent la commande avec 2 jointures (et le logo) juste pour lire groupId | `server/routes.ts:3585` |
| [CMDCLI-13](#cmdcli-13) | basse | perf-client | S | Création : invalidateQueries + refetchQueries en double (y compris caches inactifs) | `client/src/pages/CustomerOrders.tsx:110` |
| [CMDCLI-19](#cmdcli-19) | basse | perf-client | S | Changement de magasin : écran « Chargement... » au lieu de garder la liste précédente | `client/src/pages/CustomerOrders.tsx:96` |
| [CMDCLI-23](#cmdcli-23) | basse | perf-api | M | Recherche article : 2 appels externes séquentiels via un proxy sans timeout ni cache | `server/routes.ts:6402` |
| [CMDCLI-27](#cmdcli-27) | basse | lisibilite | S | Libellés incohérents, en anglais ou abrégés | `client/src/pages/CustomerOrders.tsx:808` |
| [CMDCLI-28](#cmdcli-28) | basse | coherence-design | S | Couleurs et listes de statuts dupliquées et divergentes (3 copies) | `client/src/components/CustomerOrderDetails.tsx:13` |
| [CMDCLI-34](#cmdcli-34) | basse | dette-code | S | Mobile : queryFn manuels sans contrôle d'erreur au lieu du fetcher par défaut | `client/src/pages/mobile/CustomerOrdersPage.tsx:105` |
| [CMDCLI-35](#cmdcli-35) | basse | lisibilite | S | Dates et montants mal formatés | `client/src/pages/mobile/CustomerOrdersPage.tsx:328` |
| [CMDCLI-36](#cmdcli-36) | basse | accessibilite | S | Mobile : feuille « contact client » faite main (pas de focus, pas d'Échap, pas de rôle dialog) | `client/src/pages/mobile/CustomerOrdersPage.tsx:628` |
| [CMDCLI-37](#cmdcli-37) | basse | ux-simplicite | S | Deux parcours différents pour « client contacté » (avec et sans commentaire) et double défilement | `client/src/components/modals/ClientCallsModal.tsx:25` |
| [CMDCLI-38](#cmdcli-38) | basse | ux-simplicite | S | Mise en page chargée et tri incohérent (Retiré en fin de liste mais pas Annulé, tri non modifiable) | `client/src/pages/CustomerOrders.tsx:680` |
| [CMDCLI-42](#cmdcli-42) | basse | perf-bundle | S | JsBarcode et la page importés en statique alors qu'ils ne servent qu'à l'impression | `client/src/pages/CustomerOrders.tsx:33` |
| [CMDCLI-43](#cmdcli-43) | basse | dette-code | S | Code mort et contournements dans la page et le formulaire | `client/src/pages/CustomerOrders.tsx:69` |

### CMDCLI-01

**Chaque commande embarque la fiche magasin complète (logo base64, SMTP, NocoDB) et la fiche fournisseur complète** — perf-api, sévérité haute, effort S

- **Fichier :** `server/storage.ts:1873`
- **Constat :** storage.ts:1870-1874 `.select({ customerOrder: customerOrders, supplier: suppliers, group: groups })` (idem getPendingClientCalls storage.ts:1945-1949 et getCustomerOrder 1894-1898). shared/schema.ts:67 `logo: text("logo"), // Logo en data URI (data:image/png;base64,...)` ; Groups.tsx:39 `const MAX_LOGO_KB = 200;` ; schema.ts:52-76 nocodb*, webhookUrl, smtpHost, smtpUser... Le client n'utilise que group.name/color et supplier.id/name.
- **Impact :** Le logo (jusqu'à ~270 Ko en base64) est répété pour CHAQUE commande : 300 commandes d'un magasin avec logo = plusieurs dizaines de Mo de JSON non compressé, téléchargés à l'ouverture de la page, après chaque mutation, sur le Dashboard, et toutes les 30 s pour pending-calls. Expose aussi la config SMTP/NocoDB/webhook aux employés.
- **Recommandation :** Sélectionner explicitement les colonnes utiles : `group: { id: groups.id, name: groups.name, color: groups.color }, supplier: { id: suppliers.id, name: suppliers.name }` dans getCustomerOrders, getCustomerOrder et getPendingClientCalls ; supprimer le mapping mort `creator: row.creator || {...}` (storage.ts:1886, row.creator n'est jamais sélectionné).

### CMDCLI-02

**Liste sans pagination ni filtre serveur : tout l'historique est téléchargé puis filtré/trié/paginé en JS** — perf-api, sévérité haute, effort L

- **Fichier :** `server/routes.ts:3508`
- **Constat :** routes.ts:3508 `const customerOrders = await storage.getCustomerOrders(groupIds);` sans limit/offset/status ; CustomerOrders.tsx:657-734 filtre, tri puis `usePagination(sortedOrders, 10)` côté client ; Dashboard.tsx:92-93 recharge la même liste et 381-386 ne fait que `customerOrders.filter(o => o.status === '...').length`.
- **Impact :** Le temps de chargement croît indéfiniment avec l'historique (les commandes Retiré/Annulé ne sont jamais purgées de la réponse) alors que l'utilisateur ne voit que 10 lignes ; le Dashboard télécharge toute la liste pour afficher 5 compteurs.
- **Recommandation :** Ajouter `?status=&supplierId=&q=&page=&limit=` à GET /api/customer-orders (WHERE + ILIKE + LIMIT/OFFSET + COUNT(*) OVER()), exclure par défaut Retiré/Annulé de plus de 30 jours, et créer GET /api/customer-orders/stats (SELECT status, COUNT(*) GROUP BY status) pour le Dashboard. Côté client : queryKey ['/api/customer-orders', {storeId, status, supplierId, q, page}] + placeholderData: keepPreviousData.

### CMDCLI-03

**Modifier une commande remet toujours son statut à « En attente de Commande »** — bug, sévérité haute, effort S

- **Fichier :** `client/src/components/CustomerOrderForm.tsx:143`
- **Constat :** CustomerOrderForm.tsx:116 `status: "En attente de Commande", // Statut fixe` (même en mode édition, aucun champ statut dans le formulaire) puis :143 `status: data.status || "En attente de Commande",` envoyé par handleEditOrder -> PUT /api/customer-orders/:id (CustomerOrders.tsx:257-260).
- **Impact :** Corriger un simple numéro de téléphone sur une commande « Disponible » la renvoie en « En attente de Commande » : elle disparaît du bandeau « clients à appeler » et le client risque de ne jamais être prévenu.
- **Recommandation :** En mode édition, ne pas envoyer `status` (ou utiliser `order.status` en defaultValue) ; n'imposer « En attente de Commande » qu'à la création (`...(order ? {} : { status: 'En attente de Commande' })`).

### CMDCLI-04

**Modifier une commande peut la déplacer dans un autre magasin** — bug, sévérité haute, effort S

- **Fichier :** `client/src/components/CustomerOrderForm.tsx:127`
- **Constat :** CustomerOrderForm.tsx:127 `const groupId = getUserAssignedGroupId();` puis :148 `groupId: groupId,` — ignore `order.groupId`. getUserAssignedGroupId (86-103) renvoie `user.userGroups[0].groupId`, sinon selectedStoreId, sinon `groups[0].id`. Le serveur applique tel quel : routes.ts:3599 `storage.updateCustomerOrder(id, req.body)`.
- **Impact :** Un directeur multi-magasins ou un admin (vue « tous magasins ») qui édite une commande du magasin B la réaffecte silencieusement à son premier magasin : la commande disparaît de la liste du bon magasin.
- **Recommandation :** Auto : dans handleSubmit, `const groupId = order?.groupId ?? getUserAssignedGroupId();`. Non auto, à traiter avec CMDCLI-07 : côté serveur, ignorer ou valider groupId dans le PUT. À noter aussi : à la création, un directeur multi-magasins crée dans userGroups[0] même si un autre magasin est sélectionné (selectedStoreId n'est pris en compte que pour l'admin).

### CMDCLI-07

**Permissions non appliquées côté serveur et corps de requête non validé (PUT/POST/DELETE)** — bug, sévérité haute, effort M

- **Fichier :** `server/routes.ts:3599`
- **Constat :** shared/permissions.ts:69-74 : manager sans 'delete', employee seulement ['view','create']. Or routes.ts:3577-3605 (PUT) et 3607-3635 (DELETE) ne vérifient que l'appartenance au magasin, pas le rôle ; :3524-3527 `const data = { ...req.body, createdBy: user.id }` et :3599 `updateCustomerOrder(id, req.body)` sans Zod (insertCustomerOrderSchema importé :127 mais jamais utilisé). Côté client, bouton Modifier (CustomerOrders.tsx:901-907) et badge statut cliquable (881-887) affichés sans `permissions.canEdit`, menu ⋮ mobile (339-356) idem.
- **Impact :** Un employé peut modifier/annuler n'importe quelle commande, un manager peut supprimer via l'API ; un body arbitraire peut changer groupId/createdBy/createdAt ; une donnée invalide provoque un 500 générique.
- **Recommandation :** Sans risque : `requireModulePermission('customer-orders','delete')` sur DELETE (le bouton est déjà masqué par canDelete, CustomerOrders.tsx:933). Pour le PUT : schéma Zod dédié (champs éditables, deposit en z.coerce.number().transform(String), notifiedAt et notifiedComment nullables, sans groupId ni createdBy), et décider avec le métier si les employés gardent le changement de statut ou de contact avant d'imposer 'edit'. Côté client, masquer Modifier selon canEdit.

### CMDCLI-08

**Impression d'étiquette : injection HTML/JS (XSS) via les champs de la commande** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:388`
- **Constat :** CustomerOrders.tsx:383 `window.open('', '_blank')` puis :388 `printWindow.document.write(` avec interpolation brute `${order.customerName}` (560), `${order.productDesignation}` (583), `${order.productReference}` (589), `${order.orderTaker}` (634), `${order.group.name}` (639). La fenêtre about:blank hérite de l'origine de l'application.
- **Impact :** Un nom client du type `<img src=x onerror=...>` saisi par un collègue s'exécute avec la session de celui qui imprime (appels API en son nom). Un simple « < » ou « & » casse aussi la mise en page de l'étiquette.
- **Recommandation :** Échapper toutes les valeurs (fonction escapeHtml remplaçant & < > " ') avant interpolation, ou construire la fenêtre via DOM (textContent).

### CMDCLI-20

**Formulaire de commande réduit à 90 % par transform et modale sans hauteur max : texte petit, bouton Créer hors écran** — ux-simplicite, sévérité haute, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:971`
- **Constat :** CustomerOrders.tsx:967 `<DialogContent className="max-w-3xl" style={{ height: 'auto', maxHeight: 'none' }}>` puis :971 `<div style={{ transform: 'scale(0.9)', transformOrigin: 'top left', width: '111%' }}>` (idem 983-987 en édition). Le formulaire empile ~10 champs + 3 titres sur une colonne (CustomerOrderForm.tsx:220-435).
- **Impact :** Sur un portable 1366×768, la modale centrée dépasse l'écran sans barre de défilement : haut et bouton « Créer » inaccessibles ; texte réduit (et parfois flou) pour des utilisateurs non techniciens.
- **Recommandation :** Auto : supprimer le wrapper transform et le style inline, et utiliser `className="max-w-3xl max-h-[90vh] overflow-y-auto"` sur les deux DialogContent. Non auto, choix de design : grille 2 colonnes et pied de modale collant.

### CMDCLI-05

**Modifier une commande efface ses notes et l'email client ; les notes ne sont affichées nulle part** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/components/CustomerOrderForm.tsx:147`
- **Constat :** CustomerOrderForm.tsx:107-121 defaultValues sans `notes` ni `customerEmail` (aucun champ dans le formulaire), puis :137 `customerEmail: data.customerEmail || ''` et :147 `notes: data.notes || ''`. La version mobile saisit pourtant des « Notes internes » (mobile/CustomerOrdersPage.tsx:593-604). CustomerOrderDetails.tsx n'affiche ni notes, ni notifiedAt, ni notifiedComment.
- **Impact :** Les notes saisies sur téléphone sont invisibles sur PC puis écrasées à la première modification.
- **Recommandation :** Partie sûre et invisible : ajouter `notes: order?.notes || ''` et `customerEmail: order?.customerEmail || ''` aux defaultValues. RHF conserve les valeurs par défaut des champs non enregistrés et le schéma Zod (43-44) les garde, donc l'édition n'efface plus rien. Ajouter un Textarea « Notes internes » et l'affichage « Contacté le … » dans les Détails change l'interface : à valider séparément.

### CMDCLI-06

**Mobile : les cases « Prix promotionnel / Pub » et « Client déjà notifié » n'ont aucun effet** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/CustomerOrdersPage.tsx:67`
- **Constat :** Le schéma Zod (67-78) ne déclare ni isPromotionalPrice ni customerNotified ; les champs sont forcés avec `name={"isPromotionalPrice" as any}` (555) et `name={"customerNotified" as any}` (575). zodResolver renvoie les valeurs parsées (z.object retire les clés inconnues), donc :263-264 `isPromotionalPrice: data.isPromotionalPrice, customerNotified: data.customerNotified` valent undefined.
- **Impact :** Le vendeur coche « Prix publicité » sur téléphone mais la commande est enregistrée au prix normal (valeur par défaut false) : litige possible au retrait.
- **Recommandation :** Ajouter `isPromotionalPrice: z.boolean().default(false), customerNotified: z.boolean().default(false)` au schéma et aux defaultValues, puis retirer les `as any`. Pour la factorisation, voir CMDCLI-32. Option produit : masquer « Client déjà notifié » à la création comme sur desktop, car notifiedAt reste null.

### CMDCLI-09

**Polling pending-calls lancé pour les employés alors que le serveur répond 403 (avec 2 retries toutes les 30 s)** — perf-api, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:74`
- **Constat :** CustomerOrders.tsx:74-87 useQuery sans `enabled`, `refetchInterval: 30000` ; routes.ts:3648-3650 `if (user.role === 'employee') { return res.status(403)... }` ; queryClient.ts retry `return failureCount < 2;` pour toute erreur non-401.
- **Impact :** Chaque poste employé ouvert sur la page génère 3 requêtes en échec toutes les 30 s (chacune = 4 requêtes SQL d'auth, voir CMDCLI-11) pour rien.
- **Recommandation :** `enabled: !!user && user.role !== 'employee'` (ou permission dédiée), et `refetchIntervalInBackground: false` explicite.

### CMDCLI-10

**Mutations sans gestion d'erreur : échecs silencieux (statut, contact client)** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:171`
- **Constat :** CustomerOrders.tsx:171-181 statusMutation, 184-194 markCalledMutation, 197-206 unmarkCalledMutation : aucun `onError`. Idem mobile 122-129, 131-140, 142-150. Or routes.ts:3684-3686 renvoie 403 aux employés pour mark-called, alors que le bouton téléphone (CustomerOrders.tsx:917-932) et « Marquer contacté » (mobile 369-375) leur sont affichés.
- **Impact :** Un employé clique « Confirmer » : rien ne se passe, la modale reste ouverte, aucun message. Toute erreur réseau sur un changement de statut est invisible.
- **Recommandation :** Auto : ajouter un onError avec un toast destructive en français (« Impossible de changer le statut », « Impossible d'enregistrer le contact ») sur les 6 mutations. Non auto : masquer le bouton contact pour les employés ou les autoriser côté serveur (décision produit).

### CMDCLI-11

**getUserWithGroups rappelé dans chaque handler alors que deserializeUser l'a déjà chargé (4 requêtes SQL séquentielles par appel)** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:3488`
- **Constat :** localAuth.ts:141-148 `passport.deserializeUser(... storage.getUserWithGroups(id) ...)` ; puis routes.ts:3488, 3519, 3579, 3609, 3640, 3676 `const user = await storage.getUserWithGroups(req.user.claims ? ... : req.user.id);`. storage.ts:371-386 : getUser puis requête user_groups JOIN groups, séquentielles.
- **Impact :** Chaque appel /api/customer-orders* (dont le polling 30 s) paie 4 allers-retours BD avant le travail utile ; latence ajoutée à chaque action.
- **Recommandation :** Utiliser `const user = req.user as UserWithGroups` dans ces handlers ; dans getUserWithGroups, faire une seule requête users LEFT JOIN user_groups JOIN groups (ou Promise.all).

### CMDCLI-14

**Chaque changement de statut/contact recharge toute la liste au lieu de mettre à jour la ligne** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/CustomerOrders.tsx:175`
- **Constat :** CustomerOrders.tsx:132, 153, 175, 188, 201 `queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0]?.toString()?.includes('/api/customer-orders') })` ; le PUT renvoie pourtant la commande mise à jour (routes.ts:3600 `res.json(updatedOrder)`).
- **Impact :** Latence visible (aller-retour PUT + re-téléchargement de toute la liste) à chaque clic de statut ; l'utilisateur ne voit pas de retour immédiat.
- **Recommandation :** Mise à jour optimiste : onMutate -> `queryClient.setQueryData(key, old => old.map(o => o.id === id ? { ...o, status } : o))`, rollback onError, puis invalidation ciblée de pending-calls uniquement.

### CMDCLI-15

**« Marquer Appelé » depuis la modale ne rafraîchit pas le tableau pour un admin avec magasin sélectionné** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/components/modals/ClientCallsModal.tsx:42`
- **Constat :** ClientCallsModal.tsx:42 `queryClient.invalidateQueries({ queryKey: ['/api/customer-orders'] });` alors que la clé du tableau est CustomerOrders.tsx:95-97 `[`/api/customer-orders?storeId=${selectedStoreId}`, selectedStoreId]` pour un admin : le préfixe ne correspond pas.
- **Impact :** Le client est marqué appelé mais l'icône téléphone reste grise dans le tableau (staleTime 30 s, pas de refetch au focus) : risque de double appel.
- **Recommandation :** Correction minimale et sûre dans ClientCallsModal.tsx:37-42 : remplacer les deux invalidations par `queryClient.invalidateQueries({ predicate: q => String(q.queryKey[0] ?? '').startsWith('/api/customer-orders') })` (couvre aussi pending-calls). L'unification des clés reste à planifier avec CMDCLI-02.

### CMDCLI-16

**Le sélecteur de magasin n'a aucun effet pour directeur/manager (et clé de cache partagée avec le mobile)** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:95`
- **Constat :** CustomerOrders.tsx:95 `/api/customer-orders${selectedStoreId && user?.role === 'admin' ? `?storeId=${selectedStoreId}` : ''}` — le serveur sait pourtant filtrer pour les non-admins (routes.ts:3500-3501). Le tableau n'a pas de colonne Magasin. Mobile 92-96 utilise la même clé `['/api/customer-orders', selectedStoreId]` mais avec ?storeId.
- **Impact :** Un directeur multi-magasins choisit « Magasin B » et voit les commandes de tous ses magasins mélangées sans pouvoir les distinguer ; en passant de l'affichage mobile au desktop, le cache affiche des données filtrées différemment.
- **Recommandation :** Toujours passer `storeId` quand un magasin est sélectionné (quel que soit le rôle) et inclure le paramètre dans la clé ; afficher une colonne Magasin quand aucun magasin n'est sélectionné.

### CMDCLI-17

**Filtre + tri de toute la liste recalculés à chaque rendu (y compris à chaque frappe dans le commentaire d'appel)** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:657`
- **Constat :** CustomerOrders.tsx:657-675 `customerOrders.filter(...)` avec `searchTerm.toLowerCase()` recalculé 5 fois par commande ; 678-723 tri avec `safeDate(a.createdAt)` parsé à chaque comparaison ; aucun useMemo ni debounce. L'état `contactComment` (61) vit dans ce composant : chaque caractère tapé dans la modale contact relance filtre + tri de toutes les commandes.
- **Impact :** Saisie qui rame sur de grosses listes ou des PC de magasin modestes.
- **Recommandation :** Auto : useMemo sur filteredOrders et sortedOrders ([customerOrders, searchTerm, filterSupplier, filterStatus, sortBy, sortOrder]), `const q = searchTerm.toLowerCase()` calculé une fois, timestamps pré-calculés. Optionnel, refactor : useDeferredValue et extraction de la modale contact.

### CMDCLI-18

**Pas d'état vide, pas d'état d'erreur, chargement en texte brut** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:829`
- **Constat :** CustomerOrders.tsx:829-831 `{isLoading ? (<div>Chargement...</div>) : (<Table>...` ; 847 `paginatedOrders.map(...)` sans branche « aucune commande » ; aucune lecture de `isError`. Côté serveur routes.ts:3513 `res.status(500).json([])`.
- **Impact :** Sans commande ou en cas de panne, l'utilisateur voit un tableau vide avec seulement les en-têtes et ne sait pas si c'est normal, filtré ou cassé.
- **Recommandation :** Skeleton de 5 lignes pendant le chargement ; ligne « Aucune commande ne correspond à votre recherche » + bouton « Effacer les filtres » ; Alert rouge « Impossible de charger les commandes — Réessayer » si isError.

### CMDCLI-21

**Formulaire peu guidant : fournisseur n°1 présélectionné, gencode « obligatoire » non exigé, recherche produit placée après la désignation** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/components/CustomerOrderForm.tsx:115`
- **Constat :** CustomerOrderForm.tsx:115 `supplierId: order?.supplierId || 1` et 272 `value={field.value?.toString() || "1"}` ; 344 `<FormLabel>Gencode (obligatoire)</FormLabel>` alors que 36 `gencode: z.string().optional()` ; ordre : Fournisseur (266) avant Produit, Désignation (295) avant Gencode (339) alors que la loupe gencode remplit désignation, référence et fournisseur (175-200) ; téléphone optionnel (33) alors qu'il sert à rappeler le client.
- **Impact :** Commandes enregistrées chez le mauvais fournisseur sans que le vendeur s'en rende compte ; saisie manuelle inutile de la désignation ; commandes sans téléphone impossibles à rappeler.
- **Recommandation :** Placer « Scanner / saisir le gencode » en premier avec autofocus et recherche à la touche Entrée ; fournisseur vide par défaut et requis (placeholder « Choisir un fournisseur ») ; aligner libellé et validation du gencode ; rendre le téléphone obligatoire (décision produit).

### CMDCLI-22

**Une panne de l'API article est affichée comme « Produit non référencé » et bloque la création** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/components/CustomerOrderForm.tsx:169`
- **Constat :** CustomerOrderForm.tsx:169 `if (!res.ok) { setArticleNotFound(true); return; }` et 202 `catch { setArticleNotFound(true); }` ; 438-441 « Produit non référencé — … La commande ne peut pas être créée. » ; 456 `disabled={... || (articleNotFound && !order) || ...}`. Identique mobile 194-227, 606-611.
- **Impact :** Si api.ffnancy.fr est lent ou indisponible, le vendeur ne peut plus créer la commande et reçoit un message faux ; il doit fermer et rouvrir la modale.
- **Recommandation :** Distinguer 3 cas : introuvable (404/aucun article), erreur technique (« Recherche indisponible, saisissez le produit manuellement ») qui ne bloque pas, et réinitialiser articleNotFound dès que l'utilisateur modifie le gencode.

### CMDCLI-24

**Tableau de 9 colonnes sans défilement horizontal, informations clés absentes, texte barré illisible** — lisibilite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/CustomerOrders.tsx:832`
- **Constat :** CustomerOrders.tsx:835-843 colonnes Client, Téléphone, Produit, Quantité, Fournisseur, Gencode, Statut, Date, Actions ; ui/table.tsx:9 wrapper `<div className="relative w-full">` sans overflow-auto ; 852-889 `line-through` appliqué à chaque cellule (et au badge) des commandes Retiré/Annulé ; acompte et « prix publicité » non affichés ; 908-916 bouton Imprimer présent seulement si Disponible (colonne Actions irrégulière).
- **Impact :** Sur écran 1280 px avec sidebar, le tableau déborde ; au comptoir, l'information utile (acompte à déduire) exige d'ouvrir le détail ; les lignes barrées sont difficiles à lire.
- **Recommandation :** Fusionner Client + Téléphone, remplacer Gencode par Acompte, ajouter `overflow-x-auto` au wrapper, griser (opacity-60) sans barrer, et regrouper les actions secondaires dans un menu « ⋯ » à côté d'un bouton principal contextuel (« Prévenir le client » si Disponible, « Remis au client » ensuite).

### CMDCLI-25

**Éléments cliquables non accessibles : badge de statut, bandeau d'alerte, boutons-icônes sans libellé** — accessibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:882`
- **Constat :** CustomerOrders.tsx:882-887 `<Badge ... onClick={() => openStatusModal(order)}>` (Badge = `<div>`, ui/badge.tsx:32) ; 740-743 `<Alert ... onClick={() => setShowClientCallsModal(true)}>` ; 894-941 boutons Eye/Edit/Printer/Trash2 sans `title` ni `aria-label` ; loupes du formulaire CustomerOrderForm.tsx:322-331 et 348-357 idem.
- **Impact :** Changement de statut impossible au clavier et non découvrable ; l'utilisateur doit deviner la fonction de chaque icône.
- **Recommandation :** Remplacer le badge cliquable par un `<button>` (ou un Select de statut), rendre le bandeau un `<button>` ; ajouter `aria-label` + `title` (« Voir le détail », « Modifier », « Imprimer l'étiquette », « Supprimer », « Rechercher le produit »).

### CMDCLI-26

**Changement de statut appliqué immédiatement, y compris « Annulé », sans confirmation (et menu mobile incomplet)** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:1037`
- **Constat :** CustomerOrders.tsx:1037-1042 `onClick={() => { handleStatusChange(selectedOrder.id, status); setShowStatusModal(false); }}` pour les 5 statuts dont « Annulé » ; mobile 346-354 menu ⋮ : « Marquer Disponible », « Marquer Retiré », « Annuler » (libellé ambigu, sans confirmation), pas d'option « Commande en Cours », proposé même sur une commande déjà Retiré.
- **Impact :** Un clic de travers annule une commande client sans possibilité d'annulation ; sur mobile « Annuler » peut être compris comme « fermer le menu ».
- **Recommandation :** Confirmation (ConfirmationModal) pour Annulé/Retiré, toast avec bouton « Annuler l'action » ; sur mobile libellé « Annuler la commande » en rouge séparé, et proposer uniquement le statut suivant logique.

### CMDCLI-29

**Modale Détails trompeuse : faux code-barres « scannable », bloc d'actions sans bouton, infos d'appel absentes** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/components/CustomerOrderDetails.tsx:126`
- **Constat :** CustomerOrderDetails.tsx:126 « Code-barres EAN13 scannable » au-dessus d'un SVG de barres codées en dur (129-167), identique pour tous les produits ; 237-246 « Actions disponibles : • Étiquette imprimable disponible • Notification client possible » sans aucun bouton ; renderBarcode (31-42) jamais appelé ; notes, notifiedAt et notifiedComment non affichés ; 79 « Client notifié » affiché seulement si statut Disponible.
- **Impact :** Un vendeur peut tenter de scanner un code-barres factice ; l'utilisateur doit fermer la modale pour agir ; l'historique d'appel est invisible.
- **Recommandation :** Supprimer le faux SVG (afficher le numéro ou générer un vrai code avec JsBarcode en lazy) et le code mort ; remplacer le bloc texte par de vrais boutons (Imprimer, Prévenir, Modifier) ; afficher « Contacté le … — commentaire » et les notes.

### CMDCLI-30

**Le code-barres imprimé peut différer du gencode du produit** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:309`
- **Constat :** CustomerOrders.tsx:309-315 code complété `padStart(12, '0')` s'il est court, tronqué à 12 chiffres sinon, puis :318-319 checksum recalculé ; 618 `<div class="barcode-number">${order.gencode}</div>` affiche le gencode original sous un code-barres encodant un autre numéro (EAN-8, codes internes, checksum invalide).
- **Impact :** À la caisse, le scan de l'étiquette peut renvoyer un autre article ou aucun.
- **Recommandation :** Encoder le gencode tel quel avec le format adapté (EAN13 si 13 chiffres valides, EAN8 si 8, sinon CODE128) et afficher sous l'image la valeur réellement encodée.

### CMDCLI-31

**Mobile : « Aucune commande trouvée » dès que « Tous les magasins » ou aucun magasin n'est sélectionné** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/CustomerOrdersPage.tsx:91`
- **Constat :** mobile 94 `if (!selectedStoreId) return [];` et 102 `enabled: !!selectedStoreId && !!user` ; 312-316 affiche « Aucune commande trouvée ». MobileLayout.tsx:152-159 propose « Tous les magasins » à l'admin et l'en-tête affiche « Tous les magasins » par défaut (28) ; MobileApp.tsx:36-41 n'auto-sélectionne un magasin que pour directeur/manager mono-magasin (pas les employés).
- **Impact :** L'utilisateur croit qu'il n'y a aucune commande alors qu'il doit d'abord choisir un magasin.
- **Recommandation :** Auto : quand !selectedStoreId, afficher un état dédié « Choisissez un magasin pour voir ses commandes » (avec ouverture du menu ou sélecteur) à la place de « Aucune commande trouvée ». Non auto : charger toutes les commandes autorisées, ou auto-sélectionner le magasin unique d'un employé.

### CMDCLI-32

**Mobile : erreurs de validation invisibles et formulaire dupliqué du desktop** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/mobile/CustomerOrdersPage.tsx:54`
- **Constat :** `FormMessage` importé (54) mais jamais rendu dans les FormField 409-604 ; orderTaker initialisé à `user?.username` (180, identifiant de connexion) contre `user?.name` sur desktop (CustomerOrderForm.tsx:108) ; schéma Zod, recherche article (190-240) et logique groupId recopiés de CustomerOrderForm.tsx ; la case « Client déjà notifié » est proposée à la création alors que le desktop la masque (CustomerOrderForm.tsx:434).
- **Impact :** Si un champ requis manque, le bouton « Valider la commande » ne fait rien de visible ; deux formulaires à maintenir qui divergent déjà (voir CMDCLI-06).
- **Recommandation :** Ajouter `<FormMessage />` à chaque champ, puis factoriser : réutiliser CustomerOrderForm (prop `variant="mobile"`) et un hook `useArticleLookup` partagé.

### CMDCLI-33

**Mobile : toutes les commandes (historique compris) rendues d'un bloc, sans filtre de statut ni pagination** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/mobile/CustomerOrdersPage.tsx:270`
- **Constat :** mobile 270-274 `orders.filter(...)` sans useMemo ni filtre de statut ; 318-389 rend une Card + un DropdownMenu Radix par commande, Retiré/Annulé mélangées aux actives (tri serveur par date).
- **Impact :** Liste interminable et lente sur téléphone ; les commandes à traiter sont noyées dans l'historique.
- **Recommandation :** Onglets/puces « À traiter / Disponibles / Terminées » (par défaut : hors Retiré/Annulé), useMemo, chargement par pages de 20 (« Voir plus ») une fois la pagination serveur en place (CMDCLI-02).

### CMDCLI-39

**Logs de debug en production, dont des données personnelles clients** — dette-code, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:3530`
- **Constat :** Serveur routes.ts:3530-3531 `console.log('🔍 CUSTOMER ORDER - Received data from frontend:', req.body)` (nom + téléphone client), 3532-3566 ~10 autres logs, 3507/3509 à chaque GET, 3666 à chaque poll pending-calls. Client CustomerOrders.tsx:83 (toutes les 30 s), 103, 107, 118, 246-254, 321.
- **Impact :** Journaux serveur gonflés et contenant des données personnelles (RGPD) ; console navigateur polluée ; léger coût sur les chemins chauds.
- **Recommandation :** Auto : supprimer, ou conditionner à process.env.DEBUG_CUSTOMER_ORDERS, les console.log serveur de routes.ts:3507, 3509, 3530-3566 et 3666 ; ne jamais logguer req.body. Le nettoyage des console.log client est cosmétique (déjà retirés du build de production).

### CMDCLI-40

**Réponses JSON non compressées et recopiées récursivement à chaque envoi** — perf-serveur, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:168`
- **Constat :** routes.ts:165-170 `res.json = (body) => originalJson(stripSmtpPassword(body))` parcourt et recopie chaque objet de la liste (sanitize.ts:13-40) ; aucun middleware de compression dans server/index.ts / index.production.ts, et `setupCompression` (server/cache.ts:93-101) n'est jamais appelé (et ne compresse rien : il pose seulement l'en-tête).
- **Impact :** La liste des commandes (déjà alourdie, CMDCLI-01) part en clair sur le réseau du magasin ; CPU serveur consommé à recopier chaque ligne.
- **Recommandation :** Vérifier d'abord la configuration gzip du nginx frontal. Si elle est absente : `npm i compression` et `app.use(compression())` avant registerRoutes dans index.ts et index.production.ts. Conserver stripSmtpPassword (filet de sécurité global). Supprimer setupCompression, mort et trompeur.

### CMDCLI-41

**Les « clients à appeler » sont rechargés par un 2e endpoint polled alors qu'ils sont déjà dans la liste** — perf-api, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/CustomerOrders.tsx:74`
- **Constat :** CustomerOrders.tsx:74-87 GET pending-calls toutes les 30 s ; storage.ts:1931-1935 `customerNotified = false AND status IN ('Disponible', ...)` — sous-ensemble exact des commandes déjà chargées par la requête de la ligne 96 (même périmètre de magasins).
- **Impact :** Double transfert des mêmes données (avec jointures lourdes) et 2 requêtes BD + 4 requêtes d'auth toutes les 30 s par poste ouvert.
- **Recommandation :** Si l'on dérive : `const pendingCalls = useMemo(() => user?.role === 'employee' ? [] : customerOrders.filter(o => PENDING_STATUSES.includes(o.status) && !o.customerNotified), ...)` avec la même liste de statuts que storage.ts:1934, et garder un rafraîchissement de la liste (refetchInterval 60 s, onglet visible) une fois la liste allégée (CMDCLI-01/02).

### CMDCLI-12

**PUT/DELETE/mark-called chargent la commande avec 2 jointures (et le logo) juste pour lire groupId** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/routes.ts:3585`
- **Constat :** routes.ts:3585, 3615, 3689 `const customerOrder = await storage.getCustomerOrder(id);` puis seul `customerOrder.groupId` est utilisé ; storage.ts:1892-1911 jointure suppliers + groups complète.
- **Impact :** Requête et transfert inutiles à chaque changement de statut ou contact ; s'ajoute au refetch complet de la liste.
- **Recommandation :** Créer `getCustomerOrderGroupId(id)` (SELECT group_id) ou faire `UPDATE ... WHERE id = $1 AND group_id = ANY($2) RETURNING *` et renvoyer 404/403 si 0 ligne.

### CMDCLI-13

**Création : invalidateQueries + refetchQueries en double (y compris caches inactifs)** — perf-client, sévérité basse, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:110`
- **Constat :** CustomerOrders.tsx:109 `queryClient.invalidateQueries({ predicate: ... includes('/api/customer-orders') })` puis :110 `queryClient.refetchQueries({ predicate: ... })` — refetchQueries recharge aussi les clés inactives (autres magasins visités, clé mobile, Dashboard).
- **Impact :** Après chaque création, la liste complète (lourde, voir CMDCLI-01) est téléchargée 2 fois ou plus.
- **Recommandation :** Supprimer la ligne 110 ; invalidateQueries suffit (refetch des requêtes actives, les autres marquées stale).

### CMDCLI-19

**Changement de magasin : écran « Chargement... » au lieu de garder la liste précédente** — perf-client, sévérité basse, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:96`
- **Constat :** CustomerOrders.tsx:96-98 useQuery sans `placeholderData` ; la clé change avec selectedStoreId donc `isLoading` repasse à true et le tableau est remplacé par le texte (829-831).
- **Impact :** Clignotement et perte de repère à chaque changement de magasin.
- **Recommandation :** `placeholderData: keepPreviousData` + indicateur discret `isFetching` dans l'en-tête de la carte.

### CMDCLI-23

**Recherche article : 2 appels externes séquentiels via un proxy sans timeout ni cache** — perf-api, sévérité basse, effort M

- **Fichier :** `server/routes.ts:6402`
- **Constat :** Client CustomerOrderForm.tsx:168 puis 182-185 (article puis `/api/ffnancy/mouvements/entrees?artNoId=...&limit=1&dateDebut=2000-01-01`) ; serveur routes.ts:6402 `await fetch(`https://api.ffnancy.fr/api/articles?${params}`)` et 6417 sans AbortController ni mise en cache.
- **Impact :** Recherche lente (2 allers-retours navigateur→serveur→ffnancy) et spinner potentiellement infini qui garde le bouton Créer désactivé (456).
- **Recommandation :** Créer un endpoint unique `/api/ffnancy/article-lookup?ean=` qui enchaîne les 2 appels côté serveur avec timeout 5 s (AbortController) et cache mémoire 10 min (server/cache.ts).

### CMDCLI-27

**Libellés incohérents, en anglais ou abrégés** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:808`
- **Constat :** CustomerOrders.tsx:805/808 placeholder et option « Status » (anglais) ; 792/795 option « Fournisseurs » pour « tous » ; titres « Commandes Client » (761, Sidebar.tsx:300) vs « Commandes Clients » (mobile 292) vs « Cmd Client » (MobileBottomNav.tsx:39) ; « Marquer Appelé » (ClientCallsModal.tsx:142) vs « Marquer client comme contacté » (1081) vs « Marquer contacté » (mobile 374) ; « Prix publicité » (form 424) vs « Prix promotionnel / Pub » (mobile 566) ; mobile « Qty: » (378), « Qté » (488), placeholder « Client, produit, rév... » (299, faute pour réf.) ; « Gencode » partout.
- **Impact :** Vocabulaire déroutant pour des employés non techniciens ; impression d'application non finie.
- **Recommandation :** Auto, corrections évidentes uniquement : « Status » en « Tous les statuts » (placeholder et option all), option all « Fournisseurs » en « Tous les fournisseurs », « Qty: » en « Qté : », « rév... » en « réf... ». Glossaire global (titres, Gencode, libellés de contact, Prix promo) : à valider avec le métier.

### CMDCLI-28

**Couleurs et listes de statuts dupliquées et divergentes (3 copies)** — coherence-design, sévérité basse, effort S

- **Fichier :** `client/src/components/CustomerOrderDetails.tsx:13`
- **Constat :** getStatusColor dupliqué : CustomerOrders.tsx:208-223 (bg-*-50 / text-*-700), CustomerOrderDetails.tsx:13-28 (idem), mobile 276-284 (bg-*-100 / text-*-800, statut inconnu = jaune au lieu de gris) ; liste des statuts dupliquée CustomerOrders.tsx:233-239 et CustomerOrderForm.tsx:57-63 (STATUS_OPTIONS jamais utilisé) ; fiche imprimée 420-427 badge toujours jaune quel que soit le statut.
- **Impact :** Un même statut n'a pas la même couleur selon l'écran ; toute évolution doit être faite à 3 endroits.
- **Recommandation :** Créer `client/src/lib/customerOrderStatus.ts` exportant `CUSTOMER_ORDER_STATUSES`, `statusClass(status)` et un composant `<CustomerOrderStatusBadge>` réutilisé partout (y compris l'impression).

### CMDCLI-34

**Mobile : queryFn manuels sans contrôle d'erreur au lieu du fetcher par défaut** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/mobile/CustomerOrdersPage.tsx:105`
- **Constat :** mobile 93-101 fetch manuel de la liste ; 105-111 `queryFn: async () => { const res = await fetch('/api/suppliers', ...); return res.json(); }` et 113-119 idem pour /api/groups, sans `res.ok` ; ces clés sont identiques à celles servies par le fetcher par défaut (queryClient.ts). /api/suppliers chargé même si la feuille de création n'est jamais ouverte. Desktop : CustomerOrders.tsx:76-85 fetch manuel avec console.log pour pending-calls.
- **Impact :** Une réponse d'erreur ({message}) est mise en cache comme liste → `suppliers.map is not a function` à l'ouverture du formulaire ; pas de redirection 401 homogène.
- **Recommandation :** Auto : supprimer seulement les queryFn manuels de /api/suppliers et /api/groups (le fetcher par défaut renvoie le même JSON, avec gestion d'erreur) ; `enabled: isCreateOpen` facultatif pour suppliers. Ne pas toucher à la clé ni au queryFn de la liste tant que les clés ne sont pas unifiées (CMDCLI-15/02).

### CMDCLI-35

**Dates et montants mal formatés** — lisibilite, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/mobile/CustomerOrdersPage.tsx:328`
- **Constat :** mobile 328 `format(new Date(order.createdAt), "dd/MM", ...)` sans année ni safeFormat ; 644 `format(new Date(contactOrder.notifiedAt), "dd/MM/yyyy 'à' HH:mm")` sans locale ; 382 `Acompte: {parseFloat(order.deposit)}€` (« 12.5€ ») ; desktop CustomerOrderDetails.tsx:202 et CustomerOrders.tsx:600 `toFixed(2)}€` (« 12.50€ », point décimal).
- **Impact :** Commande de l'an dernier indiscernable ; montants au format anglo-saxon.
- **Recommandation :** Auto : `new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseFloat(order.deposit))` aux 3 endroits (mobile 382, Details 202, impression 600), et safeFormat (dateUtils.ts:8, locale fr par défaut) à la place de format(new Date(...)) en mobile 328/644. Ajouter l'année est optionnel (dd/MM/yy).

### CMDCLI-36

**Mobile : feuille « contact client » faite main (pas de focus, pas d'Échap, pas de rôle dialog)** — accessibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/mobile/CustomerOrdersPage.tsx:628`
- **Constat :** mobile 628-630 `<div className="fixed inset-0 z-50 ..." onClick=...><div className="w-full max-w-lg bg-white rounded-t-2xl ...">` alors que la page utilise déjà Sheet (395) ; boutons natifs <button> stylés à la main (664-682).
- **Impact :** Comportement différent des autres feuilles (pas de bouton retour/Échap, focus non piégé, lecteurs d'écran perdus), style incohérent.
- **Recommandation :** Remplacer par `<Sheet side="bottom">` + composants Button/Textarea de shadcn.

### CMDCLI-37

**Deux parcours différents pour « client contacté » (avec et sans commentaire) et double défilement** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/components/modals/ClientCallsModal.tsx:25`
- **Constat :** ClientCallsModal.tsx:25 `apiRequest(`/api/customer-orders/${customerOrderId}/mark-called`, 'PATCH')` sans commentaire, bouton « Marquer Appelé » (142) ; la modale par ligne (CustomerOrders.tsx:1074-1136) demande un commentaire ; 67 `max-h-[80vh] overflow-y-auto` + 87 `<ScrollArea className="max-h-[50vh]">` imbriqués ; pas de date de mise à disposition ni de lien tel:.
- **Impact :** L'utilisateur ne sait pas lequel utiliser ; impossible de noter « message laissé » depuis la liste dédiée ; deux barres de défilement.
- **Recommandation :** Réutiliser la même mini-modale contact (commentaire optionnel) depuis ClientCallsModal, afficher « Disponible depuis le … » et le téléphone en lien tel:, garder un seul conteneur scrollable.

### CMDCLI-38

**Mise en page chargée et tri incohérent (Retiré en fin de liste mais pas Annulé, tri non modifiable)** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:680`
- **Constat :** CustomerOrders.tsx:680-681 seules les commandes « Retiré » sont renvoyées en fin de liste alors que 225-227 grise aussi « Annulé » ; 63-64 `sortBy`/`sortOrder` sans aucun contrôle UI (setSortBy/setSortOrder jamais appelés) ; 777-780 carte « Recherche et Filtres » avec titre ; 740-752 bandeau collant au-dessus du titre de page avec emoji 📞 en plus de l'icône Phone ; pas de bouton « Effacer les filtres ».
- **Impact :** Commandes annulées intercalées entre les commandes actives ; espace vertical perdu avant d'atteindre le tableau.
- **Recommandation :** Traiter Annulé comme Retiré dans le tri (ou filtre par défaut « En cours »), supprimer l'état de tri mort ou ajouter des en-têtes triables, barre de filtres compacte sans titre avec bouton « Effacer », bandeau d'appels placé sous le titre.

### CMDCLI-42

**JsBarcode et la page importés en statique alors qu'ils ne servent qu'à l'impression** — perf-bundle, sévérité basse, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:33`
- **Constat :** CustomerOrders.tsx:33 `import JsBarcode from 'jsbarcode';` utilisé uniquement dans generateEAN13Barcode (324) ; RouterProduction.tsx:19 et :41 importent CustomerOrders et MobileCustomerOrdersPage sans React.lazy (toutes les pages sont importées en statique).
- **Impact :** JsBarcode et le code des commandes clients sont téléchargés au premier chargement de l'application, même pour un utilisateur qui n'ouvre jamais cette page.
- **Recommandation :** Ouvrir la fenêtre de façon synchrone (`const w = window.open('', '_blank')`), puis `const { default: JsBarcode } = await import('jsbarcode')`, puis écrire le document. Le lazy-loading des pages doit se faire globalement dans RouterProduction (toutes les pages), avec un fallback Suspense, plutôt que pour une seule page.

### CMDCLI-43

**Code mort et contournements dans la page et le formulaire** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/CustomerOrders.tsx:69`
- **Constat :** CustomerOrders.tsx:69-71 requête /api/groups jamais utilisée ; 922-925/1095-1100 `(order as any).notifiedAt` alors que le type CustomerOrder contient déjà notifiedAt ; CustomerOrderForm.tsx:154-158 `form.setValue('groupId', …)` appelé pendant le rendu ; :129 `alert("ERREUR: …")` natif ; :134 `user?.firstName + ' ' + user?.lastName || …` (toujours vrai, fallback username inatteignable) ; `useRef` et insertCustomerOrderFrontendSchema importés sans usage (6, 27).
- **Impact :** Lecture et maintenance plus difficiles, re-rendus inutiles, message d'erreur non stylé (popup navigateur).
- **Recommandation :** Supprimer la requête groups, les `as any`, les imports inutilisés ; déplacer le setValue dans un useEffect ; remplacer alert() par un toast destructive.
