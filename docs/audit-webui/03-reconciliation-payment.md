# Rapprochement BL/Factures & Échéancier

_40 constats vérifiés — 6 haute, 22 moyenne, 12 basse._

## Pages analysées

### `/bl-reconciliation`

**Rôle :** Rapprocher les bons de livraison (BL) des factures fournisseurs : vérifier que la facture existe dans NocoDB, compléter la référence, le montant et l'échéance, valider le rapprochement, relancer le fournisseur par mail, envoyer une facture PDF au webhook du magasin et commenter les écarts.

**Tâches principales de l'utilisateur :**
- Voir les livraisons livrées à rapprocher (onglet manuel) et celles déjà validées
- Vérifier une facture (loupe, ou bouton « Vérifier toutes les factures »)
- Valider ou dévalider un rapprochement
- Modifier N° BL, montants, référence facture et échéance (modale)
- Demander la facture ou le BL au fournisseur par mail
- Envoyer une facture PDF au webhook (modale + attente)
- Ajouter, modifier ou supprimer des commentaires de rapprochement
- Rechercher par fournisseur, BL, facture ou magasin

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/suppliers | au montage | server/routes.ts:1141 -> storage.getSuppliers (storage.ts:467, SELECT * FROM suppliers) | Redondant : chaque livraison contient déjà supplier complet (jointure storage.ts:912). Bloque l'effet de vérification automatique (BLReconciliation.tsx:387) alors que suppliers n'y est pas utilisé. |
| GET /api/supplier-mail-logs?storeId= | au montage (enabled: !!user) | server/routes.ts:2439 -> storage.getSupplierMailLogs (storage.ts:2974, LIMIT 500, index sur delivery_id et group_id) | Correct et borné. storeId ignoré pour le directeur (seul l'admin le prend en compte, routes.ts:2454). |
| GET /api/deliveries?storeId= | au montage, staleTime 0 (refetch à chaque visite), queryKey ['/api/deliveries/bl', storeId] | server/routes.ts:1752 -> storage.getDeliveries (storage.ts:885) + attachOrdersAndCommentCounts (storage.ts:643 : loadOrdersByIds + count des commentaires) | Toutes les livraisons du magasin (ou de tous les magasins pour l'admin), tous statuts, sans pagination. Filtrage status==='delivered' fait côté navigateur (BLReconciliation.tsx:371). Chaque ligne embarque la ligne groups complète (logo base64, config SMTP/NocoDB/webhook) et la commande avec à nouveau supplier + group. Pas de compression HTTP. Toute la réponse est clonée récursivement par stripSmtpPassword (routes.ts:168-174). |
| POST /api/deliveries/:id/verify-invoice | automatique au montage pour chaque livraison livrée sans montant facture (file de 3 requêtes simultanées), clic sur la loupe, bouton « Vérifier toutes les factures » (forceRefresh) | server/routes.ts:2466 -> getUserWithGroups (2 requêtes) + getDelivery (storage.ts:1004 : jointure + getUser + getOrder [2 requêtes] + count commentaires) + invoiceVerificationService.verifyInvoice/verifyInvoiceByBL (invoiceVerification.ts:249/612 : cache BD, getGroup, getActiveNocodbConfig, 1 à 2 appels NocoDB, upsert cache) + storage.updateDelivery | Environ 10 requêtes séquentielles par livraison, plus NocoDB en cas d'absence en cache. Le serveur enregistre déjà montant, TTC, échéance et référence (routes.ts:2555-2587), mais le client renvoie en plus un PUT identique. |
| PUT /api/deliveries/:id | auto-remplissage après chaque vérification réussie, validation rapide, dévalidation, enregistrement de la modale | server/routes.ts:1906 -> getUserWithGroups + getDelivery + (si invoiceReference change) verifyInvoice forceRefresh synchrone + storage.updateDelivery (storage.ts:1136) + (si blNumber présent) storage.getSuppliers() complet | Le PUT d'auto-remplissage fait doublon avec verify-invoice. La modale envoie toujours blNumber, ce qui charge toute la table fournisseurs. Logs complets du corps et de l'objet mis à jour. |
| DELETE /api/deliveries/:id | au clic (window.confirm) | server/routes.ts:2136 -> getDelivery + storage.deleteDelivery (storage.ts:1175) | Suivi de refetchQueries sur ['/api/deliveries/bl'] et ['/api/deliveries'] (toutes les requêtes livraisons en cache, même inactives). |
| POST /api/deliveries/:id/send-supplier-mail | au clic sur l'icône mail | server/routes.ts:2330 -> getDelivery + storage.getGroup + sendSupplierDocumentRequest + storage.createSupplierMailLog (storage.ts:2969) | OK fonctionnellement ; invalide ensuite /api/supplier-mail-logs. |
| POST /api/reconciliation/send-invoice (multipart) | au clic « Envoyer » dans la modale Envoyer Facture | server/routes.ts:883 -> parse multipart manuel + fetch(parts.webhookUrl) sans timeout | L'URL du webhook vient du client (risque SSRF), le corps est lu sans limite de taille, il n'y a de timeout ni côté client ni côté serveur, et la modale d'attente ne peut pas être fermée. Réservé admin/directeur côté serveur, mais le bouton est affiché sans contrôle de rôle. |
| GET /api/deliveries/:id/reconciliation-comments | ouverture de la modale commentaires ou de l'onglet Commentaires de ReconciliationModal | server/routes.ts:2175 -> getDelivery + storage.getReconciliationComments (storage.ts:3035) | Sélectionne author: users (ligne complète, hash du mot de passe inclus), group: groups (logo) et une copie de la livraison pour chaque commentaire. |
| POST /api/deliveries/:id/reconciliation-comments, PUT/DELETE /api/reconciliation-comments/:id | au clic Ajouter / Enregistrer / Supprimer | server/routes.ts:2211 / 2254 / 2292 -> storage.createReconciliationComment / updateReconciliationComment / deleteReconciliationComment (storage.ts:3142-3163) | Chaque mutation invalide toute la liste des livraisons (['/api/deliveries'] et ['/api/deliveries/bl']) juste pour mettre à jour un compteur. |

**Lisibilité / simplicité :** La page est dense et technique. Le tableau a 10 colonnes (min-w 900px, même sur mobile) et jusqu'à 6 boutons-icônes par ligne, sans texte, expliqués seulement par l'attribut title (invisible au toucher). Les deux onglets n'ont ni le même ordre de colonnes, ni la même unité d'écart (€ avec seuil 10 € d'un côté, % avec seuil 5 % de l'autre), ni le même style de boutons. Les compteurs apparaissent deux fois (badges d'en-tête et badges d'onglets). Le jargon est fréquent : « Rapprochement Manuel », « AUTO », « Ref. Facture », « Montant Fact. », « webhook », « workflow », URL technique du webhook affichée. Les coches verte et rouge n'expliquent pas pourquoi une facture est introuvable. Le bouton Valider reste grisé avec une consigne trompeuse quand le magasin n'a pas NocoDB. La modale d'attente ne se ferme jamais si le webhook ne répond pas. Les erreurs s'affichent en JSON brut anglais (« 403: {"message":...} »). Les confirmations utilisent window.confirm, alors qu'Avoirs et DLC utilisent AlertDialog. Le chargement est un simple texte « Chargement... » en pleine page. La pagination revient à la page 1 après chaque validation. La modale de détail est éditable même depuis « Voir les détails » et duplique la gestion des commentaires. Les règles d'accès se contredisent : le message de la page parle des managers, le menu latéral ne cite qu'admin et directeur, la barre mobile inclut les managers.

### `/payment-schedule`

**Rôle :** Afficher, pour le magasin sélectionné, les factures fournisseurs à payer dans le mois choisi (date d'échéance, fournisseur, mode de paiement, montants HT et TTC), avec totaux par mode de paiement et export CSV pour Excel.

**Tâches principales de l'utilisateur :**
- Choisir un mois et voir les échéances
- Lire le total HT/TTC du mois et par mode de paiement
- Exporter les échéances (filtrées par mode de paiement, colonnes HT/TTC) en CSV

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/payment-schedule?groupId= | au montage et à chaque changement de magasin (staleTime par défaut 30 s, donc rappelée à chaque retour sur la page après 30 s) | server/routes.ts:390 -> storage.getUser + getUserGroups (directeur) + getGroup + storage.getDeliveries() SANS filtre (tous magasins, storage.ts:885) + boucles séquentielles verificationService.verifyInvoice + storage.updateDelivery + storage.getSuppliers() | Endpoint le plus lent du périmètre. Il charge toutes les livraisons de tous les magasins avec leurs relations, filtre en JS, puis appelle NocoDB et écrit en base un par un (await dans des boucles for) au sein d'une requête GET. Le repli TTC écrit dans la mauvaise colonne, donc la boucle recommence à chaque chargement. |
| POST /api/payment-schedule/export | au clic « Exporter » dans la modale | server/routes.ts:549 -> storage.getDeliveries() complet + storage.getSuppliers() + filtrage mois et mode de paiement en JS + génération CSV | Même chargement complet que le GET. Champs CSV non échappés. Logs verbeux (paramètres, utilisateur). |

**Lisibilité / simplicité :** Page plutôt claire et plus simple que le rapprochement, mais hors charte. En-tête h1 text-3xl sans bandeau blanc, alors qu'Avoirs, Commandes et Rapprochement utilisent h2 text-xl/2xl dans un bandeau. Icône dollar pour des euros. La carte « Période » répète le mois déjà affiché dans le sélecteur. Les montants s'affichent en « 1234.50 € » au lieu de « 1 234,50 € ». Le TTC vaut souvent « 0.00 € » à cause d'un bug serveur. On change de mois uniquement par une liste de 25 mois, sans flèches précédent/suivant. Le filtre par mode de paiement n'existe que dans l'export. Le vocabulaire mélange CSV et Excel. Un spinner plein écran remplace aussi l'en-tête à chaque changement de magasin. Les erreurs 403 (manager arrivé par URL) donnent une carte générique. La ligne d'en-tête (titre + bouton + sélecteur de 256 px) n'est pas responsive alors que la route est servie telle quelle sur mobile.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [ECHE-01](#eche-01) | haute | perf-serveur | M | GET /api/payment-schedule charge toutes les livraisons de tous les magasins puis appelle NocoDB et écrit en base, une livraison à la fois | `server/routes.ts:430` |
| [ECHE-02](#eche-02) | haute | bug | S | Le repli TTC écrit le montant HT au lieu du TTC : boucle infinie à chaque chargement et TTC affiché à 0,00 € | `server/routes.ts:501` |
| [RAPPRO-01](#rappro-01) | haute | perf-api | M | La liste des livraisons transporte la fiche magasin complète (logo base64, SMTP, NocoDB) et toutes les livraisons de tous les statuts | `server/storage.ts:912` |
| [RAPPRO-02](#rappro-02) | haute | perf-api | M | Avalanche de vérifications automatiques (POST verify-invoice + PUT redondant) à chaque ouverture de la page | `client/src/pages/BLReconciliation.tsx:386` |
| [RAPPRO-03](#rappro-03) | haute | bug | S | Les commentaires renvoient la ligne users complète (hash du mot de passe) et la fiche magasin complète | `server/storage.ts:3047` |
| [RAPPRO-04](#rappro-04) | haute | ux-simplicite | S | La modale « Traitement en cours » ne peut pas être fermée et aucun timeout n'existe (client ni serveur) | `client/src/pages/BLReconciliation.tsx:1684` |
| [ECHE-03](#eche-03) | moyenne | perf-serveur | S | L'export recharge toutes les livraisons de tous les magasins et produit un CSV non échappé | `server/routes.ts:596` |
| [ECHE-04](#eche-04) | moyenne | coherence-design | S | En-tête hors charte, non responsive, icône dollar et carte « Période » redondante | `client/src/pages/PaymentSchedulePage.tsx:295` |
| [ECHE-05](#eche-05) | moyenne | lisibilite | S | Montants affichés au format anglais (« 1234.50 € ») au lieu du format français | `client/src/pages/PaymentSchedulePage.tsx:340` |
| [NOCO-01](#noco-01) | moyenne | bug | S | Les erreurs techniques NocoDB (timeout, HTTP 5xx, réseau) sont mises en cache 12 à 24 h comme « facture introuvable » | `server/invoiceVerification.ts:488` |
| [NOCO-02](#noco-02) | moyenne | bug | S | L'upsert du cache de vérification ne met à jour ni expiresAt ni invoiceAmountTTC : le cache « permanent » expire au bout de 6 h | `server/storage.ts:1746` |
| [NOCO-03](#noco-03) | moyenne | perf-serveur | S | Clés de cache BL incohérentes, et un hit BL ne renvoie ni montant ni échéance | `server/invoiceVerification.ts:635` |
| [RAPPRO-05](#rappro-05) | moyenne | perf-serveur | M | getDelivery() sert au contrôle d'accès mais lance 5 à 7 requêtes séquentielles | `server/storage.ts:1004` |
| [RAPPRO-06](#rappro-06) | moyenne | perf-serveur | S | PUT /api/deliveries/:id charge toute la table fournisseurs pour en lire un seul | `server/routes.ts:2043` |
| [RAPPRO-07](#rappro-07) | moyenne | bug | S | Changer la référence facture déclenche un appel NocoDB synchrone qui efface l'échéance saisie à la main | `server/routes.ts:1992` |
| [RAPPRO-08](#rappro-08) | moyenne | perf-client | S | Rafraîchissements trop larges : refetchQueries sur toutes les requêtes livraisons, même inactives, et rechargement complet pour un compteur de commentaires | `client/src/pages/BLReconciliation.tsx:758` |
| [RAPPRO-09](#rappro-09) | moyenne | perf-client | M | Calculs non mémoïsés en O(n×m) et re-rendu de toute la page chaque seconde ou à chaque résultat de vérification | `client/src/pages/BLReconciliation.tsx:456` |
| [RAPPRO-10](#rappro-10) | moyenne | perf-api | S | Requête /api/suppliers redondante qui retarde la vérification automatique | `client/src/pages/BLReconciliation.tsx:78` |
| [RAPPRO-11](#rappro-11) | moyenne | perf-client | S | staleTime 0, clé de cache isolée et écran « Chargement... » texte en pleine page | `client/src/pages/BLReconciliation.tsx:376` |
| [RAPPRO-12](#rappro-12) | moyenne | bug | S | Les livraisons des fournisseurs en mode « automatique » validées depuis Livraisons/Calendrier n'apparaissent dans aucun onglet | `client/src/pages/BLReconciliation.tsx:456` |
| [RAPPRO-13](#rappro-13) | moyenne | ux-simplicite | S | Bouton Valider grisé avec une consigne impossible à suivre quand le magasin n'a pas NocoDB | `client/src/pages/BLReconciliation.tsx:1258` |
| [RAPPRO-14](#rappro-14) | moyenne | ux-simplicite | M | Jusqu'à 6 boutons-icônes par ligne, sans texte, et des coches de vérification sans explication | `client/src/pages/BLReconciliation.tsx:1169` |
| [RAPPRO-15](#rappro-15) | moyenne | coherence-design | M | Les deux onglets n'affichent pas les mêmes colonnes ni le même calcul d'écart, et « Date Livr. » montre la date prévue | `client/src/pages/BLReconciliation.tsx:1424` |
| [RAPPRO-16](#rappro-16) | moyenne | ux-simplicite | S | Messages d'erreur affichés en JSON brut et en anglais | `client/src/lib/queryClient.ts:4` |
| [RAPPRO-17](#rappro-17) | moyenne | coherence-design | S | Règles d'accès contradictoires entre la page, les menus, les permissions et le serveur | `client/src/pages/BLReconciliation.tsx:31` |
| [RAPPRO-19](#rappro-19) | moyenne | ux-simplicite | M | Sur mobile, la page desktop est servie telle quelle (tableau 900px, 10 colonnes, modale en 2 colonnes) | `client/src/components/RouterProduction.tsx:121` |
| [RAPPRO-21](#rappro-21) | moyenne | bug | S | Le proxy d'envoi de facture appelle une URL fournie par le client et lit le corps sans limite de taille | `server/routes.ts:916` |
| [RAPPRO-22](#rappro-22) | moyenne | perf-api | S | « Vérifier toutes les factures » force un appel NocoDB pour chaque ligne, y compris celles déjà vertes, sans suivi de progression | `client/src/pages/BLReconciliation.tsx:339` |
| [ECHE-06](#eche-06) | basse | perf-client | S | Spinner plein écran à chaque changement de magasin, cache court sur un endpoint coûteux, erreurs génériques | `client/src/pages/PaymentSchedulePage.tsx:254` |
| [ECHE-07](#eche-07) | basse | lisibilite | S | Vocabulaire CSV/Excel incohérent et filtre par mode de paiement réservé à l'export | `client/src/pages/PaymentSchedulePage.tsx:309` |
| [NOCO-04](#noco-04) | basse | perf-serveur | S | Logs console volumineux sur les chemins chauds (vérification, liste et mise à jour des livraisons) | `server/invoiceVerification.ts:22` |
| [RAPPRO-18](#rappro-18) | basse | lisibilite | S | En-tête redondant et vocabulaire technique (webhook, workflow, AUTO, abréviations) | `client/src/pages/BLReconciliation.tsx:911` |
| [RAPPRO-20](#rappro-20) | basse | ux-simplicite | S | Retour en page 1 après chaque validation, et la validation rapide n'a pas d'état « en cours » | `client/src/components/ui/pagination.tsx:157` |
| [RAPPRO-23](#rappro-23) | basse | dette-code | S | Code mort, imports inutilisés et logs de debug dans le rendu | `client/src/pages/BLReconciliation.tsx:1032` |
| [RAPPRO-24](#rappro-24) | basse | bug | S | Hooks appelés après un return conditionnel (règle des hooks violée) | `client/src/pages/BLReconciliation.tsx:31` |
| [RAPPRO-25](#rappro-25) | basse | bug | S | Le minuteur de la modale d'attente n'est pas nettoyé au démontage | `client/src/pages/BLReconciliation.tsx:527` |
| [RAPPRO-26](#rappro-26) | basse | ux-simplicite | S | Modale de rapprochement surchargée : commentaires en double, « Voir les détails » qui ouvre une édition, titre et badge redondants | `client/src/components/modals/ReconciliationModal.tsx:147` |
| [RAPPRO-27](#rappro-27) | basse | lisibilite | S | Commentaires signés par l'email, boutons sans libellé, confirmation native | `client/src/components/ReconciliationComments.tsx:287` |
| [RAPPRO-28](#rappro-28) | basse | ux-simplicite | S | Envoi de facture : annuler le sélecteur de fichier affiche une erreur, et le libellé Facture/Avoir est trompeur | `client/src/pages/BLReconciliation.tsx:543` |
| [RAPPRO-29](#rappro-29) | basse | perf-bundle | S | Pages Rapprochement et Échéancier importées dans le bundle initial | `client/src/components/RouterProduction.tsx:14` |

### ECHE-01

**GET /api/payment-schedule charge toutes les livraisons de tous les magasins puis appelle NocoDB et écrit en base, une livraison à la fois** — perf-serveur, sévérité haute, effort M

- **Fichier :** `server/routes.ts:430`
- **Constat :** routes.ts:430-431 `const allDeliveries = await storage.getDeliveries();
const groupDeliveries = allDeliveries.filter((d: any) => d.groupId === groupId && d.invoiceReference);`. 444-481 `for (const delivery of deliveriesWithoutDueDate) { ... await verificationService.verifyInvoice(...) ... await storage.updateDelivery(...)`. 491-516 deuxième boucle séquentielle identique pour le TTC. 519 `await storage.getSuppliers()` alors que delivery.supplier est déjà joint.
- **Impact :** Le temps de réponse croît avec le nombre total de livraisons de l'enseigne et avec le nombre de factures sans échéance ou sans TTC. Si NocoDB est lent (timeout 10 s par appel, invoiceVerification.ts:535), le chargement peut durer plusieurs minutes et l'utilisateur reste face au spinner. Un GET qui écrit en base est aussi rejoué à chaque visite.
- **Recommandation :** Remplacer par une requête SQL ciblée : SELECT d.id, d.invoice_reference, d.due_date, d.invoice_amount, d.invoice_amount_ttc, s.name, s.payment_method FROM deliveries d JOIN suppliers s ... WHERE d.group_id=$1 AND d.invoice_reference IS NOT NULL AND d.due_date IS NOT NULL (index idx_deliveries_due_date / (group_id, due_date)). Sortir le repli NocoDB du GET : il est déjà fait par verify-invoice qui persiste dueDate et TTC (routes.ts:2555-2587). Si on le garde, le passer en tâche de fond ou en Promise.all avec concurrence limitée.

### ECHE-02

**Le repli TTC écrit le montant HT au lieu du TTC : boucle infinie à chaque chargement et TTC affiché à 0,00 €** — bug, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:501`
- **Constat :** routes.ts:487 `const deliveriesNeedingTTC = allDeliveriesWithDueDate.filter((d: any) => !d.invoiceAmountTTC || parseFloat(d.invoiceAmountTTC) === 0);` puis 501-504 `const updates: any = { invoiceAmount: result.invoiceAmount.toString(), supplierName: result.supplierName };` : invoiceAmountTTC n'est jamais écrit et supplierName n'est pas une colonne de deliveries. 506 `updates.dueDate = new Date(result.dueDate)` sans normalizeDateString, contrairement à 457.
- **Impact :** Les mêmes livraisons repartent dans la boucle NocoDB + UPDATE à chaque ouverture de l'échéancier (ECHE-01). La colonne « Montant TTC » et le total TTC du mois restent faux (0,00 €) pour ces factures, ce qui fausse la trésorerie affichée et exportée.
- **Recommandation :** N'écrire invoiceAmountTTC que si result.invoiceAmountTTC > 0. Ne réécrire invoiceAmount que s'il est absent. Retirer supplierName et normaliser la date. Corriger NOCO-02 d'abord. Idéalement, sortir ce repli du GET (ECHE-01) ou mémoriser la tentative pour ne pas la relancer à chaque chargement. Côté client, afficher « — » quand le TTC vaut 0 ou est inconnu.

### RAPPRO-01

**La liste des livraisons transporte la fiche magasin complète (logo base64, SMTP, NocoDB) et toutes les livraisons de tous les statuts** — perf-api, sévérité haute, effort M — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:912`
- **Constat :** storage.ts:912-913 `supplier: suppliers, group: groups,` (groups contient `logo: text("logo") // Logo en data URI (data:image/png;base64,...)` schema.ts:66, smtpHost/smtpUser, webhookUrl, mapping NocoDB) ; storage.ts:598-599 loadOrdersByIds rejoint encore `supplier: suppliers, group: groups` dans chaque commande. routes.ts:1781/1859 `deliveries = await storage.getDeliveries(groupIds);` sans filtre de statut ni pagination ; filtrage client BLReconciliation.tsx:371 `deliveries.filter((d: any) => d.status === 'delivered')`. Aucun middleware compression (server/index.ts:30). Chaque réponse est clonée récursivement par stripSmtpPassword (routes.ts:168-174, sanitize.ts:13-44).
- **Impact :** Si un logo est configuré, chaque ligne transporte ce logo une à deux fois. Avec 1 000 livraisons, cela fait des dizaines de Mo de JSON non compressé à télécharger, parser et cloner côté serveur. Le chargement initial de la page est lent et la mémoire du navigateur gonfle. Les livraisons « planned », inutiles ici, sont aussi transférées.
- **Recommandation :** Étape 1, sans risque : dans getDeliveries, getDeliveriesByDateRange et loadOrdersByIds, remplacer `group: groups` par une projection {id, name, color, nocodbConfigId, nocodbTableName, webhookUrl}. Ce sont les seuls champs group lus par le client (name, webhookUrl, color, nocodbTableName, nocodbConfigId) et le serveur ne lit que group.name. Ajouter compression() (nouvelle dépendance) dans index.ts et index.production.ts. Étape 2 : créer l'endpoint dédié /api/reconciliation/deliveries (WHERE status='delivered', pagination, totaux par onglet). Ne retirer webhookUrl de la projection qu'après RAPPRO-21, une fois que le serveur retrouve lui-même l'URL du webhook.

### RAPPRO-02

**Avalanche de vérifications automatiques (POST verify-invoice + PUT redondant) à chaque ouverture de la page** — perf-api, sévérité haute, effort M

- **Fichier :** `client/src/pages/BLReconciliation.tsx:386`
- **Constat :** BLReconciliation.tsx:396-436 parcourt TOUTES les livraisons livrées (les deux onglets, y compris celles qui ne s'affichent nulle part) et appelle `handleVerifyInvoice(delivery, false, true)`. Puis onSuccess (151-186) envoie `apiRequest(`/api/deliveries/${variables.deliveryId}`, "PUT", updateData)`, alors que le serveur a déjà enregistré ces données (routes.ts:2555-2587 `await storage.updateDelivery(deliveryId, updateData)`). autoRequestedIdsRef (124) est un useRef, donc remis à zéro à chaque montage, et verificationResults est un état local perdu à la navigation.
- **Impact :** Pour 200 livraisons sans montant : 400 requêtes HTTP à chaque visite. Côté serveur, environ 10 requêtes SQL séquentielles par vérification (voir RAPPRO-05) plus NocoDB. Les coches arrivent lentement, la page re-rend à chaque résultat, puis un refetch complet de la liste suit quand la file se vide (269-270).
- **Recommandation :** En supprimant le PUT, conserver `needsCacheInvalidationRef.current = true` dans onSuccess quand result.exists apporte des données (montant, échéance ou référence). Sinon la liste ne se rafraîchit plus après l'auto-remplissage fait côté serveur.

### RAPPRO-03

**Les commentaires renvoient la ligne users complète (hash du mot de passe) et la fiche magasin complète** — bug, sévérité haute, effort S

- **Fichier :** `server/storage.ts:3047`
- **Constat :** storage.ts:3047-3048 `author: users,
 group: groups,` dans getReconciliationComments (idem getReconciliationCommentById 3101-3102). La table users contient `password: varchar("password")` (schema.ts:39). sanitize.ts:36 ne retire que `smtpPassword`/`smtp_password`. Le client n'utilise que `comment.author.email` (ReconciliationComments.tsx:287).
- **Impact :** Fuite du hash de mot de passe de chaque auteur de commentaire vers tout utilisateur qui ouvre la modale. La réponse est aussi alourdie par le logo du magasin et une copie de la livraison répétés pour chaque commentaire.
- **Recommandation :** Projeter author {id,email,firstName,lastName,username,role}, retirer group et delivery ainsi que le .map qui les remballe, dans les deux fonctions (3035 et 3088), et alléger le type ReconciliationCommentWithRelations en conséquence. Dans sanitize.ts, supprimer simplement la clé `password`. Aucune autre colonne password n'existe dans le schéma.

### RAPPRO-04

**La modale « Traitement en cours » ne peut pas être fermée et aucun timeout n'existe (client ni serveur)** — ux-simplicite, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/BLReconciliation.tsx:1684`
- **Constat :** BLReconciliation.tsx:1684 `<Dialog open={showWaitingModal} onOpenChange={() => {}}>`, sans bouton Fermer. 588-592 `fetch('/api/reconciliation/send-invoice', {...})` sans AbortController, donc la branche `error.name === 'AbortError'` (633) est du code mort. Côté serveur, routes.ts:940-943 `await fetch(parts.webhookUrl, { method: 'POST', body: formData })` sans signal ni timeout. Le texte affiche « 60s restantes (max) » puis « Finalisation... » indéfiniment (1720).
- **Impact :** Si le webhook n8n/Make ne répond pas, l'écran reste bloqué : l'utilisateur doit recharger la page et ne sait pas si la facture est partie.
- **Recommandation :** Fixer le délai serveur un peu au-dessus de la durée annoncée (par exemple AbortSignal.timeout(90 000)) et le délai client au-dessus du délai serveur (par exemple 100 s). En cas de dépassement, afficher : « Le traitement prend plus de temps que prévu ; il peut encore aboutir. Vérifiez la ligne avant de renvoyer la facture. » Ajouter un bouton « Continuer en arrière-plan » qui ferme la modale sans annuler la requête et affiche un toast à la fin.

### ECHE-03

**L'export recharge toutes les livraisons de tous les magasins et produit un CSV non échappé** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:596`
- **Constat :** routes.ts:596-601 `const allDeliveries = await storage.getDeliveries();
const groupDeliveries = allDeliveries.filter((d: any) => d.groupId === validatedGroupId && d.invoiceReference && d.dueDate);`, puis filtre du mois en JS (609-616) et `await storage.getSuppliers()` (619). Lignes CSV 654-662 `row.join(';')` sans guillemets.
- **Impact :** L'export est lent sur une base volumineuse. Un nom de fournisseur ou une référence contenant « ; » ou un retour à la ligne décale les colonnes dans Excel.
- **Recommandation :** Requête SQL filtrée sur group_id et due_date BETWEEN début/fin du mois, avec jointure suppliers. Échapper chaque champ (`"${v.replace(/"/g,'""')}"`). Réutiliser la même fonction que le GET.

### ECHE-04

**En-tête hors charte, non responsive, icône dollar et carte « Période » redondante** — coherence-design, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/PaymentSchedulePage.tsx:295`
- **Constat :** PaymentSchedulePage.tsx:295-297 `<div className="flex justify-between items-center">` + `<h1 className="text-3xl font-bold">Échéancier des Paiements</h1>`, alors qu'Avoirs, Orders et BLReconciliation utilisent un bandeau `bg-white border-b` + `h2 text-xl sm:text-2xl` avec icône. 311 `<div className="w-64">` sur la même ligne, sans flex-col mobile, alors que la route est servie sur mobile (RouterProduction.tsx:129). 333 `<DollarSign .../>` pour des euros. 382-395 carte « Période » qui répète le mois déjà dans le sélecteur. Libellé du menu « Échéance » (Sidebar.tsx:266) différent du titre.
- **Impact :** L'utilisateur ne retrouve pas la mise en page des autres modules. Sur téléphone, l'en-tête déborde. Le symbole $ prête à confusion.
- **Recommandation :** Reprendre l'en-tête standard (bandeau blanc, h2, icône CreditCard), `flex-col sm:flex-row`, icône Euro, remplacer la carte Période par une carte utile (prochaine échéance, ou montant restant à payer cette semaine). Harmoniser le libellé du menu en « Échéancier ». Ajouter des flèches mois précédent/suivant autour du sélecteur.

### ECHE-05

**Montants affichés au format anglais (« 1234.50 € ») au lieu du format français** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/PaymentSchedulePage.tsx:340`
- **Constat :** PaymentSchedulePage.tsx:340 `{monthTotal.toFixed(2)} €`, idem 346, 368, 373, 448, 451. BLReconciliation.tsx:1071 `${parseFloat(delivery.blAmount).toFixed(2)}€`, idem 1123, 1157, 1471, 1479.
- **Impact :** Les grands montants sont difficiles à lire (pas de séparateur de milliers) et le point décimal ne correspond pas aux habitudes françaises ni à Excel FR.
- **Recommandation :** Créer un utilitaire partagé `formatEuro = (n) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)` et l'utiliser dans les deux pages, avec des colonnes de montants alignées à droite et `tabular-nums`.

### NOCO-01

**Les erreurs techniques NocoDB (timeout, HTTP 5xx, réseau) sont mises en cache 12 à 24 h comme « facture introuvable »** — bug, sévérité moyenne, effort S

- **Fichier :** `server/invoiceVerification.ts:488`
- **Constat :** invoiceVerification.ts:394-403 `if (matchResult.error) { ... await this.saveToCache(invoiceReference, groupId, result, undefined, isReconciled);` avec exists:false, donc expiration +12 h (106-108). 488-489, même chose dans le catch. Pour les BL : 762-786 erreur mise en cache `expiresAt.setHours(expiresAt.getHours() + 24)`. Côté client, exists === false grise le bouton Valider (BLReconciliation.tsx:1248-1257).
- **Impact :** Une micro-coupure NocoDB affiche une croix rouge et bloque la validation pendant 12 à 24 h pour toutes les factures vérifiées à ce moment. Seul le bouton « Vérifier toutes » (forceRefresh) contourne le problème, ce que l'utilisateur ne peut pas deviner.
- **Recommandation :** Ne pas mettre en cache les résultats avec matchResult.error, ou seulement 2 à 5 minutes. Renvoyer un statut distinct (`status: 'error'`) et l'afficher côté UI par une icône orange « Service de vérification indisponible — réessayer » plutôt qu'une croix rouge.

### NOCO-02

**L'upsert du cache de vérification ne met à jour ni expiresAt ni invoiceAmountTTC : le cache « permanent » expire au bout de 6 h** — bug, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:1746`
- **Constat :** storage.ts:1746-1760 `onConflictDoUpdate({ target: invoiceVerificationCache.cacheKey, set: { exists, matchType, errorMessage, supplierName, invoiceReference, invoiceAmount, dueDate, isReconciled, cacheHit, apiCallTime, updatedAt } })` : ni expiresAt ni invoiceAmountTTC. updateCacheAsReconciled (invoiceVerification.ts:186-195) calcule `expiresAt + 50 ans` mais l'upsert l'ignore. getInvoiceVerificationCache supprime la ligne une fois expirée (storage.ts:1729-1732).
- **Impact :** Les factures validées sont re-interrogées dans NocoDB après 6 h au lieu d'être servies depuis le cache, d'où des appels externes inutiles et des pages plus lentes. Un forceRefresh ne rallonge pas non plus la durée de vie, et le TTC reste périmé dans le cache.
- **Recommandation :** Ajouter `expiresAt: cacheData.expiresAt, invoiceAmountTTC: cacheData.invoiceAmountTTC, groupId: cacheData.groupId` au `set` de onConflictDoUpdate.

### NOCO-03

**Clés de cache BL incohérentes, et un hit BL ne renvoie ni montant ni échéance** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/invoiceVerification.ts:635`
- **Constat :** verifyInvoiceByBL : `const cacheKey = `bl_${groupId}_${blNumber.trim().toLowerCase()}_${supplierName.toLowerCase()}`;` (635), alors que updateCacheAsReconciled(blNumber) utilise generateCacheKey = `${groupId}_${ref}` (13, appelé routes.ts:2653 et invoiceVerification.ts:232), donc la clé BL n'est jamais marquée réconciliée. Le hit cache BL (641-651) ne renvoie que exists/matchType/invoiceReference/supplierName, et la sauvegarde succès (827-839) ne stocke ni invoiceAmount ni dueDate.
- **Impact :** Le cache BL ne devient jamais permanent (rappels NocoDB toutes les 24 h). Un hit BL donne une coche verte sans montant ni échéance, ce qui laisse des cellules « Non renseigné » et relance d'autres vérifications.
- **Recommandation :** Centraliser la construction de clé (buildKey(type, groupId, value, supplier)) et l'utiliser partout. Stocker et renvoyer invoiceAmount, invoiceAmountTTC et dueDate dans le cache BL comme pour la référence facture.

### RAPPRO-05

**getDelivery() sert au contrôle d'accès mais lance 5 à 7 requêtes séquentielles** — perf-serveur, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:1004`
- **Constat :** storage.ts:1005-1034 jointure, 1041 `await this.getUser(delivery.createdBy)`, 1060 `await this.getOrder(delivery.orderId)` (qui fait lui-même une jointure commande + une jointure de toutes ses livraisons, storage.ts:816-856), 1079-1082 count des commentaires. getDelivery est appelé pour le seul contrôle d'accès dans verify-invoice (routes.ts:2474), PUT (1914), DELETE (2144), commentaires (2183, 2219), send-supplier-mail (2338), toujours après getUserWithGroups qui fait 2 requêtes séquentielles (storage.ts:372-387).
- **Impact :** Chaque vérification ou modification coûte 7 à 9 allers-retours SQL avant même le travail utile. Multiplié par les centaines de vérifications automatiques (RAPPRO-02), cela sature le pool Postgres et ralentit toutes les pages.
- **Recommandation :** Gain immédiat sans changer le format : dans getDelivery, lancer getUser, getOrder et le count en Promise.all après la jointure principale. Pour getDeliveryForAccess, inclure id, groupId, supplierId, status, reconciled, blNumber, invoiceReference, scheduledDate, deliveredDate, supplier {id,name,email,automaticReconciliation} et group {id,name}, et ne l'utiliser que dans les routes qui ne lisent rien d'autre : verify-invoice, PUT, DELETE et commentaires. Garder getDelivery pour GET /api/deliveries/:id. Lancer getUserWithGroups et le chargement de la livraison en parallèle.

### RAPPRO-06

**PUT /api/deliveries/:id charge toute la table fournisseurs pour en lire un seul** — perf-serveur, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:2043`
- **Constat :** routes.ts:2040-2044 `if (data.status === 'delivered' || data.blNumber) { ... const suppliers = await storage.getSuppliers();
 const supplier = suppliers.find((s: any) => s.id === updatedDelivery.supplierId);`. La modale envoie toujours blNumber s'il est rempli (ReconciliationModal.tsx:86), et delivery.supplier est déjà chargé par getDelivery (storage.ts:1028).
- **Impact :** Chaque enregistrement depuis la modale lit inutilement toute la table fournisseurs.
- **Recommandation :** `const supplier = (data.supplierId === undefined || data.supplierId === delivery.supplierId) ? delivery.supplier : (await storage.getSuppliers()).find((s: any) => s.id === updatedDelivery.supplierId);`

### RAPPRO-07

**Changer la référence facture déclenche un appel NocoDB synchrone qui efface l'échéance saisie à la main** — bug, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:1992`
- **Constat :** routes.ts:1992-2030 : si `data.invoiceReference !== delivery.invoiceReference`, appel `verificationService.verifyInvoice(data.invoiceReference, delivery.groupId, true, ...)` (forceRefresh, jusqu'à 2 × 10 s de timeout), puis `data.dueDate = null;` si NocoDB ne trouve pas l'échéance (2017) ou en cas d'erreur (2023). Cela écrase la dueDate envoyée par la modale (ReconciliationModal.tsx:90).
- **Impact :** L'utilisateur saisit référence et échéance, clique Enregistrer, attend parfois plus de 10 s (« Enregistrement... »), puis découvre que son échéance a disparu. Perte de donnée et lenteur perçue.
- **Recommandation :** Ne respecter la saisie que si l'utilisateur a modifié l'échéance, c'est-à-dire si data.dueDate diffère de delivery.dueDate. Sinon, compléter depuis NocoDB. Ne jamais remplacer par null en cas d'échec ou de résultat vide : conserver la valeur existante. Le cas 2027 (référence vidée, donc échéance vidée) peut rester. Faire l'appel NocoDB après la réponse HTTP ou le laisser à verify-invoice.

### RAPPRO-08

**Rafraîchissements trop larges : refetchQueries sur toutes les requêtes livraisons, même inactives, et rechargement complet pour un compteur de commentaires** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:758`
- **Constat :** BLReconciliation.tsx:758-759 `queryClient.refetchQueries({ queryKey: ['/api/deliveries/bl'] }); queryClient.refetchQueries({ queryKey: ['/api/deliveries'] });` (idem 481-482, 797-798, 837-838). En TanStack 5.83, refetchQueries fait `this.#queryCache.findAll(filters)` sans filtre `type` (node_modules/@tanstack/query-core/build/modern/queryClient.js:172), donc les requêtes inactives (mois du calendrier visités, etc.) sont aussi rechargées. ReconciliationModal.tsx:67-69 invalide, puis onSave (BLReconciliation.tsx:481-482) refait un refetch. ReconciliationComments.tsx:62-63, 88-89, 113-114 invalident toute la liste pour un compteur.
- **Impact :** Une validation ou un commentaire peut déclencher plusieurs téléchargements de la liste complète (lourde, voir RAPPRO-01), y compris pour des pages non affichées. L'interface rame juste après chaque action.
- **Recommandation :** Après validation, suppression ou commentaire : `queryClient.setQueryData(['/api/deliveries/bl', selectedStoreId], ...)` (mise à jour locale, compteur +1/-1), puis une seule `invalidateQueries({ queryKey: ['/api/deliveries/bl', selectedStoreId] })` (refetchType 'active' par défaut). Remplacer les refetchQueries(['/api/deliveries']) par invalidateQueries. Supprimer le refetch en double de handleSaveReconciliation.

### RAPPRO-09

**Calculs non mémoïsés en O(n×m) et re-rendu de toute la page chaque seconde ou à chaque résultat de vérification** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/BLReconciliation.tsx:456`
- **Constat :** BLReconciliation.tsx:456-461 `deliveriesWithBL.filter(... suppliers.find(s => s.id === delivery.supplierId) ...)` recalculé à chaque rendu, de même que filterDeliveries (851-866) et `suppliers.find` dans chaque ligne validée (1422). startProcessingTimer (527-537) fait `setProcessingSeconds(prev => prev + 1)` chaque seconde dans le composant page. Chaque vérification fait 2 setState (144-147, 189-193).
- **Impact :** Pendant l'envoi d'une facture, la page entière (10 colonnes × N lignes, filtres complets) est recalculée chaque seconde. Pendant la vérification auto de 200 lignes, il y a plus de 400 rendus complets, ce qui rend la saisie et le scroll saccadés.
- **Recommandation :** useMemo pour manualNotValidatedDeliveries, allValidatedDeliveries et les listes filtrées, avec une Map supplierById ou directement delivery.supplier.automaticReconciliation. Extraire la ligne dans un composant React.memo qui reçoit son seul résultat de vérification. Déplacer le compteur de secondes dans un composant WaitingDialog isolé. Ajouter useDeferredValue sur searchTerm.

### RAPPRO-10

**Requête /api/suppliers redondante qui retarde la vérification automatique** — perf-api, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:78`
- **Constat :** BLReconciliation.tsx:78-80 `useQuery<any[]>({ queryKey: ['/api/suppliers'] })` sert à `supplier?.automaticReconciliation` (457, 1423) et à l'email de repli (681). Ces champs sont déjà dans `delivery.supplier` (storage.ts:912 `supplier: suppliers`). L'effet 387 `if (!deliveriesWithBL.length || !suppliers.length) return;` attend suppliers alors que le corps de l'effet ne l'utilise pas.
- **Impact :** Une requête inutile, et un enchaînement en cascade (waterfall) : les coches de vérification n'apparaissent qu'après le chargement des fournisseurs. Si la liste fournisseurs est vide ou en erreur, aucune vérification automatique n'a lieu.
- **Recommandation :** Supprimer la requête suppliers, utiliser `delivery.supplier?.automaticReconciliation` et `delivery.supplier?.email`, retirer `suppliers` des dépendances et de la garde de l'effet.

### RAPPRO-11

**staleTime 0, clé de cache isolée et écran « Chargement... » texte en pleine page** — perf-client, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/BLReconciliation.tsx:376`
- **Constat :** BLReconciliation.tsx:350 `queryKey: ['/api/deliveries/bl', selectedStoreId]` alors que l'URL appelée est `/api/deliveries` (357), donc aucun partage avec les autres pages. 376 `staleTime: 0 // Éviter la mise en cache`. 892-894 `if (isLoading) { return <div className="flex justify-center items-center h-64">Chargement...</div>; }`.
- **Impact :** Chaque retour sur la page retélécharge la liste complète (lourde). Pendant ce temps, l'utilisateur voit un texte gris sans structure. Un changement de magasin vide tout l'écran.
- **Recommandation :** Renommer d'abord la clé en ['/api/deliveries', 'reconciliation', selectedStoreId] pour que toutes les invalidations de ['/api/deliveries'] la touchent par préfixe. Mettre à jour en même temps les setQueryData de BLReconciliation et le prédicat de ValidateDeliveryModal. Passer ensuite à staleTime 60 s avec placeholderData: keepPreviousData, et afficher un squelette sous l'en-tête et la recherche.

### RAPPRO-12

**Les livraisons des fournisseurs en mode « automatique » validées depuis Livraisons/Calendrier n'apparaissent dans aucun onglet** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:456`
- **Constat :** Onglet manuel : `const isManual = supplier?.automaticReconciliation !== true;` (458). Onglet validé : `delivery.reconciled === true` (464). Or POST /api/deliveries/:id/validate (routes.ts:2643 `await storage.validateDelivery(id, blData);`, storage.ts:1179-1194) ne met jamais reconciled=true. Seul le PUT générique le fait (routes.ts:2040-2056).
- **Impact :** Des factures de fournisseurs « automatiques » peuvent n'être ni rapprochées ni visibles. Elles échappent au contrôle, alors que la vérification automatique les traite en arrière-plan.
- **Recommandation :** Appliquer la même auto-réconciliation dans /validate (si supplier.automaticReconciliation et blNumber), ou ajouter un filtre ou onglet « Automatiques en attente » pour les rendre visibles.

### RAPPRO-13

**Bouton Valider grisé avec une consigne impossible à suivre quand le magasin n'a pas NocoDB** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:1258`
- **Constat :** BLReconciliation.tsx:1258-1267 bouton désactivé avec `title="Validation impossible : veuillez d'abord vérifier la facture en cliquant sur l'icône de recherche"`. Or l'icône de recherche n'est affichée que si `delivery.group?.nocodbTableName || nocodbConfigId || webhookUrl` (1085), et handleVerifyInvoice sort en silence sans config (298-307).
- **Impact :** Dans un magasin sans NocoDB, l'utilisateur ne peut valider une ligne qu'en devinant qu'il doit saisir un montant facture dans la modale. Il est bloqué et appelle le support.
- **Recommandation :** Sans configuration NocoDB, ou si un montant facture est saisi, autoriser la validation manuelle avec une confirmation (« Valider sans vérification automatique ? »). Rédiger un tooltip exact selon le cas (pas de référence, pas de NocoDB, facture introuvable).

### RAPPRO-14

**Jusqu'à 6 boutons-icônes par ligne, sans texte, et des coches de vérification sans explication** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/BLReconciliation.tsx:1169`
- **Constat :** Cellule Actions 1169-1316 : Mail, Upload, MessageSquare, Check, Edit, Trash2, en `h-8 w-8 p-0` sans libellé, expliqués seulement par `title=`. Coches 1089-1094 `<CheckCircle className="h-4 w-4 text-green-500 cursor-help" />` / `<XCircle ... cursor-help />` sans title ni Tooltip, alors que `errorMessage` est stocké (202) mais jamais affiché.
- **Impact :** Un employé non technicien ne sait pas quel bouton faire en premier ni pourquoi une facture est en rouge. Les title ne s'affichent pas au toucher (tablette, mobile).
- **Recommandation :** Garder une seule action principale visible avec du texte (« Valider » en vert, ou « Compléter » si des données manquent) et regrouper le reste (Relancer le fournisseur, Envoyer la facture, Commentaires, Modifier, Supprimer) dans un menu « ⋯ » (DropdownMenu) avec libellés. Ajouter un Tooltip/Popover sur la coche qui affiche errorMessage en français et un bouton « Revérifier ».

### RAPPRO-15

**Les deux onglets n'affichent pas les mêmes colonnes ni le même calcul d'écart, et « Date Livr. » montre la date prévue** — coherence-design, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/BLReconciliation.tsx:1424`
- **Constat :** Onglet manuel, Écart en € et rouge au-delà de 10 € : 1150-1157 `diffAbs > 10 ? 'text-red-600'` ... `{diff.toFixed(2)}€`. Onglet validé, Écart en % et rouge au-delà de 5 % : 1424-1425 `(... / parseFloat(delivery.blAmount) * 100).toFixed(1)` et 1498 `Math.abs(parseFloat(ecart)) > 5 ? "destructive"`. Ordre des colonnes : manuel « Montant BL, Ref. Facture » (1004-1009), validé « Ref. Facture, Montant BL » (1397-1402). « Date Livr. » affiche `delivery.scheduledDate` (1065, 1458) alors que le tri utilise deliveredDate (373). Formats dd/MM/yy et dd/MM/yyyy mélangés. « Non renseigné » et « Non renseignée » mélangés (1452/1464). Styles de boutons différents (Button outline 1176 contre <button opacity-70> 1519).
- **Impact :** L'utilisateur compare deux tableaux qui ne se lisent pas de la même façon. Un écart de 8 € apparaît orange d'un côté et peut apparaître rouge en % de l'autre. La date affichée n'est pas celle de la livraison réelle.
- **Recommandation :** Factoriser une définition de colonnes et un composant <ReconciliationRow> commun aux deux onglets. Fixer une seule règle d'écart (montant € + % en sous-texte, mêmes seuils). Renommer en « Livrée le » avec deliveredDate (repli scheduledDate) et utiliser dd/MM/yyyy partout.

### RAPPRO-16

**Messages d'erreur affichés en JSON brut et en anglais** — ux-simplicite, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/lib/queryClient.ts:4`
- **Constat :** queryClient.ts:4-7 `const text = (await res.text()) || res.statusText; throw new Error(`${res.status}: ${text}`);`. Les toasts affichent error.message tel quel : ReconciliationComments.tsx:95 `description: error?.message || ...`, BLReconciliation.tsx:702, ReconciliationModal.tsx:76. Messages serveur en anglais : routes.ts:2270 "Only comment author or admin can edit comments", 2598 "Failed to verify invoice".
- **Impact :** Un manager voit par exemple « 403: {"message":"Only comment author or admin can edit comments"} ». Le message est incompréhensible et anxiogène.
- **Recommandation :** Garder le message actuel et ajouter à l'Error les propriétés `status` et `userMessage` (body.message || body.error). Les toasts passent par un helper getUserErrorMessage(error). Adapter isUnauthorizedError et les tests de retry pour lire error.status en priorité, avec repli sur l'ancien test. Traduire ensuite les messages serveur et masquer Modifier/Supprimer pour les non-auteurs.

### RAPPRO-17

**Règles d'accès contradictoires entre la page, les menus, les permissions et le serveur** — coherence-design, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:31`
- **Constat :** La page bloque seulement `user?.role === 'employee'` avec le texte « Seuls les managers et administrateurs peuvent accéder » (31-42). Sidebar.tsx:259-262 `roles: ["admin", "directeur"]`, PhoneBottomNav.tsx:37 `roles: ["admin", "directeur", "manager"]`, shared/permissions.ts:53-57 `manager: []`. Le bouton Upload s'affiche sans contrôle de rôle (shouldShowInvoiceButton 653-672), alors que le serveur refuse les managers (routes.ts:891 `user.role !== 'admin' && user.role !== 'directeur'`).
- **Impact :** Un manager arrive sur la page depuis la barre mobile, voit des boutons, envoie un PDF, attend, puis obtient « Accès refusé ». Le message d'accès restreint est lui-même faux.
- **Recommandation :** Garder la page avec `permissions.canView('reconciliation')`, aligner Sidebar et PhoneBottomNav sur la même matrice, masquer Upload/Valider/Supprimer selon canCreate/canValidate/canDelete, et corriger le texte (« réservé aux directeurs et administrateurs »).

### RAPPRO-19

**Sur mobile, la page desktop est servie telle quelle (tableau 900px, 10 colonnes, modale en 2 colonnes)** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/components/RouterProduction.tsx:121`
- **Constat :** RouterProduction.tsx:121 `<Route path="/bl-reconciliation" component={BLReconciliation} />` dans le bloc mobile (« Pages sans version mobile »). BLReconciliation.tsx:992 `<table className="w-full min-w-[900px]">`, colonnes `px-6`. ReconciliationModal.tsx:120 et 162 `grid grid-cols-2 gap-4` sans breakpoint.
- **Impact :** Sur téléphone (accessible aux rôles listés dans PhoneBottomNav), il faut faire défiler horizontalement pour atteindre les actions. Les champs de la modale font la moitié de l'écran.
- **Recommandation :** Sous md, rendu en cartes (fournisseur + montants + statut + bouton principal) comme les pages mobiles existantes. `grid-cols-1 sm:grid-cols-2` dans la modale.

### RAPPRO-21

**Le proxy d'envoi de facture appelle une URL fournie par le client et lit le corps sans limite de taille** — bug, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:916`
- **Constat :** Client BLReconciliation.tsx:582 `formData.append('webhookUrl', selectedDeliveryForInvoice.group.webhookUrl);`. Serveur routes.ts:907-918, lecture complète `req.on('data', (chunk: Buffer) => chunks.push(chunk));` sans plafond, puis 940 `await fetch(parts.webhookUrl, ...)` sans vérifier que l'URL est celle du magasin.
- **Impact :** Un compte directeur peut faire appeler n'importe quelle URL interne par le serveur (SSRF). Un gros fichier peut saturer la mémoire du serveur et ralentir toute l'application.
- **Recommandation :** Envoyer deliveryId et retrouver group.webhookUrl côté serveur après contrôle d'accès. Plafonner la taille (par exemple 15 Mo, multer ou busboy avec limits), contrôler le type PDF côté client et serveur, et ajouter un timeout (voir RAPPRO-04).

### RAPPRO-22

**« Vérifier toutes les factures » force un appel NocoDB pour chaque ligne, y compris celles déjà vertes, sans suivi de progression** — perf-api, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:339`
- **Constat :** BLReconciliation.tsx:322-340 filtre toutes les lignes de manualNotValidatedDeliveries ayant une référence, puis `handleVerifyInvoice(delivery, true); // Force refresh pour toutes`. Le seul retour est le toast initial « Vérification de N facture(s)/BL en cours... » (342-345). Aucun toast de fin.
- **Impact :** Contournement du cache : 1 à 2 requêtes NocoDB par ligne (invoiceVerification.ts:386-429), donc des minutes d'attente sur un gros magasin. L'utilisateur ne sait pas quand c'est fini.
- **Recommandation :** Forcer le rafraîchissement seulement pour les lignes rouges ou non vérifiées. Afficher une progression (« 12 / 40 vérifiées ») et un toast final récapitulatif (x trouvées, y introuvables, z erreurs).

### ECHE-06

**Spinner plein écran à chaque changement de magasin, cache court sur un endpoint coûteux, erreurs génériques** — perf-client, sévérité basse, effort S

- **Fichier :** `client/src/pages/PaymentSchedulePage.tsx:254`
- **Constat :** PaymentSchedulePage.tsx:69-81 useQuery sans staleTime (30 s par défaut, queryClient.ts:76) ni placeholderData. 254-260 `if (isLoading) { return (<div ...><Loader2 .../></div>); }` remplace aussi l'en-tête. 262-275 carte « Une erreur est survenue » identique pour un 403 (manager arrivé par URL, routes.ts:398-399). 278-289 « Configuration requise » affiché pour le message serveur « Groupe non trouvé » (routes.ts:424).
- **Impact :** Chaque retour sur la page après 30 s relance l'endpoint lent (ECHE-01). Changer de magasin fait disparaître toute la page. Les messages d'erreur n'aident pas l'utilisateur.
- **Recommandation :** staleTime 5 min, `placeholderData: keepPreviousData`, squelette des cartes et du tableau sous l'en-tête, message spécifique pour 403 (« Réservé aux directeurs et administrateurs ») et pour un magasin introuvable.

### ECHE-07

**Vocabulaire CSV/Excel incohérent et filtre par mode de paiement réservé à l'export** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/PaymentSchedulePage.tsx:309`
- **Constat :** Bouton « Exporter CSV » (309), modale « Exporter vers CSV ... (ouvrez le fichier dans Excel) » (468-471), toast d'erreur « l'export du fichier Excel » (230). Les modes de paiement ne se filtrent que dans la modale d'export (477-509) : le tableau (425-454) n'a ni filtre ni recherche fournisseur.
- **Impact :** Les utilisateurs ne savent pas quel format ils obtiennent et ne peuvent pas afficher à l'écran seulement les virements ou les traites qu'ils vont payer.
- **Recommandation :** Libellé unique « Exporter pour Excel ». Ajouter au-dessus du tableau des puces de filtre par mode de paiement (réutilisées par défaut dans l'export) et une recherche fournisseur.

### NOCO-04

**Logs console volumineux sur les chemins chauds (vérification, liste et mise à jour des livraisons)** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/invoiceVerification.ts:22`
- **Constat :** invoiceVerification.ts:22-31, 111-119, 140-148, 261, 273, 276 `console.log('✅ [INVOICE] Résultat depuis cache:', cachedResult)`, 294-299 : environ 8 logs d'objets par vérification. storage.ts:1718-1722 et 1736 à chaque lecture de cache, storage.ts:935 à chaque liste. routes.ts:1762, 1868 (GET /api/deliveries), 1932 `console.log('🔄 Updating delivery:', { id, data: req.body ...})`, 2033 `console.log('✅ Delivery updated successfully:', { id, updatedDelivery })`, 2516-2523, 2552.
- **Impact :** Pendant les centaines de vérifications automatiques, les sorties console synchrones ralentissent l'event loop Node et remplissent les logs Docker, ce qui rend les vraies erreurs difficiles à trouver.
- **Recommandation :** Commencer, sans risque, par réduire les logs qui sérialisent des objets complets (routes.ts:1932 et 2033, invoiceVerification.ts:273 et 2552) à un identifiant et quelques champs. Introduire ensuite un logger avec LOG_LEVEL, défaut 'info' en production, et passer les logs [CACHE]/[INVOICE] en debug, après accord de l'exploitant.

### RAPPRO-18

**En-tête redondant et vocabulaire technique (webhook, workflow, AUTO, abréviations)** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:911`
- **Constat :** Compteurs en double : badges 911-916 « {n} à traiter » / « {n} validées » et badges d'onglets 935-944. Sous-titre « Gestion des rapprochements manuels et automatiques » (907), onglet « Rapprochement Manuel » (934). En-têtes abrégés « Date Livr. », « Ref. Facture », « Montant Fact. » (1002-1012). Badge « AUTO » (1445). URL affichée `Envoi via: {selectedDeliveryForInvoice.group.webhookUrl}` (1662-1666), « Le workflow peut prendre jusqu'à 1 minute » (1706), toast « Facture traitée avec succès via le webhook » (603). Encadré vert permanent dans l'onglet Validées (1342-1357).
- **Impact :** Le bruit visuel et le jargon informatique ralentissent la compréhension. Exposer l'URL du webhook n'apporte rien à l'utilisateur.
- **Recommandation :** Onglets « À traiter (n) » / « Validées (n) » et suppression des badges d'en-tête. En-têtes complets : « Livrée le », « N° facture », « Montant facture ». « AUTO » remplacé par « Validé automatiquement ». Supprimer l'URL et dire « Envoi au service de traitement des factures… ». Remplacer l'encadré par une ligne d'aide discrète ou un tooltip.

### RAPPRO-20

**Retour en page 1 après chaque validation, et la validation rapide n'a pas d'état « en cours »** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/components/ui/pagination.tsx:157`
- **Constat :** pagination.tsx:157-159 `useEffect(() => { setCurrentPage(1); }, [data.length]);`. Valider une ligne la retire de la liste et renvoie donc l'utilisateur en page 1. BLReconciliation.tsx:735-769 handleQuickValidate est une fonction async sans état pending : le bouton (1239-1247) reste cliquable pendant la requête.
- **Impact :** En traitant la page 3, chaque validation renvoie en page 1, ce qui fait perdre le fil. Un double clic envoie deux PUT et affiche deux toasts.
- **Recommandation :** Ajouter à usePagination un paramètre optionnel resetKey (par exemple `${searchTerm}|${activeTab}`). Quand il est fourni, remettre la page à 1 sur ce changement plutôt que sur data.length, et garder le comportement actuel par défaut pour les 7 autres appelants. Le bornage à totalPages existe déjà (166-170).

### RAPPRO-23

**Code mort, imports inutilisés et logs de debug dans le rendu** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:1032`
- **Constat :** Imports inutilisés : Card, CardContent, CardHeader, CardTitle (7), Settings, AlertTriangle, X, Filter (15), Select... (17), Textarea (19). Branches mortes de l'onglet manuel, filtré sur `reconciled !== true` (459) : style `delivery.reconciled === true ? 'bg-gray-100 opacity-60'` (1032-1035) et bloc dévalidation (1290-1315). console.log dans le rendu de chaque ligne (662-669, 1429-1435). console.log non conditionné (624). ReconciliationModal.tsx:57,59 `console.log('Sending update for delivery:'...)`. formData.reconciled jamais utilisé (ReconciliationModal.tsx:38,50). PaymentSchedulePage.tsx:6-7 imports Building et startOfMonth inutilisés.
- **Impact :** Le fichier de 1 787 lignes est plus difficile à maintenir, la console est polluée en production (624, ReconciliationModal), et des appels de log tournent pendant le rendu en dev.
- **Recommandation :** Supprimer les imports inutilisés, les branches mortes, les logs de rendu et les console.log non conditionnés. Retirer reconciled de l'état de la modale.

### RAPPRO-24

**Hooks appelés après un return conditionnel (règle des hooks violée)** — bug, sévérité basse, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:31`
- **Constat :** BLReconciliation.tsx:31-49 `if (user?.role === 'employee') { return (...); }` placé avant `const [activeTab, setActiveTab] = useState("manual");` (51) et tous les useQuery/useMutation/useEffect qui suivent.
- **Impact :** Si le rôle passe de undefined à « employee » pendant la vie du composant (rechargement de session), React lève « Rendered fewer hooks than expected » et la page plante.
- **Recommandation :** Extraire le contenu dans <BLReconciliationContent/> et garder dans BLReconciliation le seul test de rôle qui rend soit le message, soit le contenu.

### RAPPRO-25

**Le minuteur de la modale d'attente n'est pas nettoyé au démontage** — bug, sévérité basse, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:527`
- **Constat :** BLReconciliation.tsx:529 `const interval = setInterval(...)` stocké dans un state (538 `setProcessingTimeout(interval)`), nettoyé seulement dans handleCloseWaitingModal par `clearTimeout(processingTimeout)` (522). Aucun useEffect de nettoyage au démontage.
- **Impact :** Si l'utilisateur quitte la page pendant l'envoi, l'intervalle continue d'appeler setState sur un composant démonté (fuite mineure).
- **Recommandation :** Stocker l'intervalle dans un useRef, utiliser clearInterval et nettoyer dans un useEffect de démontage. Ou isoler le minuteur dans le composant de la modale (voir RAPPRO-09).

### RAPPRO-26

**Modale de rapprochement surchargée : commentaires en double, « Voir les détails » qui ouvre une édition, titre et badge redondants** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/components/modals/ReconciliationModal.tsx:147`
- **Constat :** ReconciliationModal.tsx:147-157 onglet « Commentaires », en doublon de la modale commentaires dédiée de la page (BLReconciliation.tsx:1744-1785). 102-112 titre « Rapprochement Automatique/Manuel » suivi d'un badge « AUTO/MANUEL ». 136-139 statut « Rapproché / En attente » alors que la page dit « Validées ». 242-248 bouton principal Enregistrer en `variant="outline"`. L'icône Eye « Voir les détails » de l'onglet validé (BLReconciliation.tsx:1582-1588) ouvre ce même formulaire éditable.
- **Impact :** Deux chemins pour la même action, un vocabulaire qui change d'un écran à l'autre, et un risque de modifier par erreur une ligne déjà validée en croyant seulement la consulter.
- **Recommandation :** Retirer l'onglet Commentaires de la modale (ou retirer la modale commentaires séparée), garder un titre simple « Facture de {fournisseur} », utiliser « Validé / À traiter », mettre Enregistrer en bouton plein, et ouvrir les lignes validées en lecture seule avec un bouton « Modifier » explicite.

### RAPPRO-27

**Commentaires signés par l'email, boutons sans libellé, confirmation native** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/components/ReconciliationComments.tsx:287`
- **Constat :** ReconciliationComments.tsx:287 `Par {comment.author.email} • ...`. Boutons 292-307 `<Edit2 className="w-3 h-3" />` et `<Trash2 className="w-3 h-3" />` sans title ni aria-label, affichés pour tous les commentaires. 152 `if (confirm("Êtes-vous sûr ..."))`. Même usage de window.confirm dans BLReconciliation.tsx:781 et 818, alors qu'Avoirs.tsx et DlcPage.tsx utilisent AlertDialog.
- **Impact :** L'auteur est peu lisible (email au lieu du nom), les icônes de 12 px sont difficiles à viser, et les confirmations n'ont pas le même style que le reste de l'application.
- **Recommandation :** Afficher « Prénom Nom » (repli username), ajouter aria-label et title, n'afficher Modifier/Supprimer que pour l'auteur ou l'admin, et utiliser un composant ConfirmDialog commun basé sur AlertDialog.

### RAPPRO-28

**Envoi de facture : annuler le sélecteur de fichier affiche une erreur, et le libellé Facture/Avoir est trompeur** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/BLReconciliation.tsx:543`
- **Constat :** BLReconciliation.tsx:543-551 `if (file && file.type === 'application/pdf') {...} else { toast({ title: "Erreur", description: "Veuillez sélectionner un fichier PDF" ...` : déclenché aussi quand l'utilisateur annule (file undefined). Le bouton dit `title="Envoyer Facture/Avoir"` (1212), la modale « Envoyer Facture » (1629), et le type envoyé est toujours `formData.append('type', 'Facture')` (585).
- **Impact :** Un toast d'erreur rouge apparaît alors que l'utilisateur n'a rien fait de mal, et il pense pouvoir envoyer un avoir alors que ce n'est pas possible.
- **Recommandation :** Ne rien faire si aucun fichier n'est choisi. Soit proposer un choix Facture/Avoir dans la modale, soit renommer le bouton « Envoyer la facture (PDF) ». Utiliser une zone de dépôt avec le nom et la taille du fichier.

### RAPPRO-29

**Pages Rapprochement et Échéancier importées dans le bundle initial** — perf-bundle, sévérité basse, effort S

- **Fichier :** `client/src/components/RouterProduction.tsx:14`
- **Constat :** RouterProduction.tsx:14 `import BLReconciliation from "@/pages/BLReconciliation";` et 29 `import PaymentSchedulePage from "@/pages/PaymentSchedulePage";` en imports statiques, sans React.lazy dans le routeur.
- **Impact :** Les 1 787 lignes du rapprochement, ses modales et date-fns/locale sont téléchargés par tous les utilisateurs (y compris les employés qui n'y ont pas accès) avant le premier affichage.
- **Recommandation :** `const BLReconciliation = lazy(() => import("@/pages/BLReconciliation"))` (idem PaymentSchedulePage) avec <Suspense fallback={<PageSkeleton/>}> autour du Switch.
