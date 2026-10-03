# Avoirs

_41 constats vérifiés — 8 haute, 21 moyenne, 12 basse._

## Pages analysées

### `/avoirs (bureau)`

**Rôle :** Suivre les demandes d'avoir fournisseurs d'un magasin : créer une demande, la faire passer de 'En attente de demande' à 'Demandé' puis à 'Reçu', vérifier que la facture d'avoir existe en comptabilité (NocoDB), valider l'avoir, envoyer le PDF au système externe (webhook) et consulter l'historique des avoirs finalisés.

**Tâches principales de l'utilisateur :**
- Créer une demande d'avoir (fournisseur, magasin, référence, montant, commentaire)
- Changer le statut d'un avoir (En attente de demande, Demandé, Reçu)
- Vérifier la présence de la facture d'avoir en comptabilité (loupe ou bouton 'Vérifier toutes')
- Valider ou dévalider un avoir (admin/directeur)
- Envoyer le PDF de l'avoir reçu
- Modifier ou supprimer un avoir (admin/directeur)
- Rechercher un avoir et consulter les onglets En cours / Finalisés

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user | au montage (useQuery ['/api/user']) | server/localAuth.production.ts:246 (lit req.user en session, sans requête BD) | En production, ce cache react-query n'est jamais rempli par useAuthUnified (enabled: isDevelopment, useAuthUnified.ts:43). La requête est donc refaite, et toutes les autres requêtes de la page l'attendent (enabled: !!user). |
| GET /api/groups | au montage, après /api/user ; puis queryClient.fetchQuery à l'envoi du PDF | server/routes.ts:970 → storage.getUserWithGroups (storage.ts:371, 2 requêtes) + storage.getGroups (storage.ts:432, select * avec le logo base64) pour admin ; sinon userGroups[].group (id, name, color seulement) | N'est utile qu'aux formulaires création/édition. Pour un non-admin, la réponse ne contient pas webhookUrl, ce qui casse l'envoi du PDF. |
| GET /api/suppliers | au montage, après /api/user | server/routes.ts:1141 → storage.getUser + storage.getSuppliers | Liste complète des fournisseurs, utilisée seulement dans les modales. |
| GET /api/avoirs?storeId=X | au montage (après /api/user), puis refetch après chaque création, modification ou suppression (invalidation par prédicat) | server/routes.ts:3711 → storage.getUserWithGroups + storage.getAvoirs (storage.ts:2528 : 3 LEFT JOIN, groups.* complet, aucune limite) | queryKey [avoirsUrl, selectedStoreId, role] différente de celle du mobile. Charge tout l'historique, y compris le logo du magasin répété dans chaque ligne. |
| POST /api/avoirs/:id/verify-invoice | boucle séquentielle dans un useEffect à chaque changement de 'avoirs' (montage et chaque refetch) ; clic sur la loupe ; 'Vérifier toutes' (forceRefresh, toutes les 200 ms) ; 1 s après l'envoi du PDF | server/routes.ts:3982 → getUserWithGroups + storage.getAvoir (storage.ts:2575) + invoiceVerificationService.verifyInvoice (invoiceVerification.ts:249 → getInvoiceVerificationCache, getGroup, getActiveNocodbConfig, appel HTTP NocoDB, saveInvoiceVerificationCache) | N appels séquentiels à chaque affichage. Si le cache a expiré (6 h ou 12 h), chaque appel va jusqu'à NocoDB. |
| POST /api/avoirs | clic 'Créer' | server/routes.ts:3774 → getUserWithGroups, createAvoir (storage.ts:2619), getGroup, fetch webhook attendu sans timeout, updateAvoirWebhookStatus | Réponse bloquée tant que le webhook externe n'a pas répondu. supplierName codé en dur à 'Unknown'. |
| PUT /api/avoirs/:id | modale Modifier ; changement de statut dans le menu de la ligne ; remplissage automatique du montant après une vérification réussie | server/routes.ts:3851 → getUserWithGroups, getAvoir, updateAvoir (storage.ts:2624), puis getGroup et webhook si passage à 'Reçu' | 3 logs JSON complets par appel. Les champs non envoyés sont remis à null. |
| DELETE /api/avoirs/:id | confirmation de suppression | server/routes.ts:3945 → getUserWithGroups, getAvoir, deleteAvoir (storage.ts:2633) | Réservé à admin et directeur. |
| PUT /api/avoirs/:id/nocodb-verification | clic Valider / Dévalider | server/routes.ts:4083 → getUserWithGroups, updateAvoirNocodbVerification (storage.ts:2644), getAvoir, updateCacheAsReconciled | Réservé à admin et directeur, mais le bouton est affiché à tous les rôles. L'invalidation côté client ne correspond pas à la queryKey quand un magasin est sélectionné. |
| POST /api/cache/mark-reconciled | juste après un Valider réussi | server/routes.ts:4126 → invoiceVerificationService.updateCacheAsReconciled | Redondant : la route nocodb-verification marque déjà le cache comme réconcilié. |
| POST {group.webhookUrl} (URL externe) | clic 'Envoyer' dans la modale d'envoi du PDF | aucun : appel direct depuis le navigateur | Dépend du CORS du service externe. La page BLReconciliation passe, elle, par le proxy /api/reconciliation/send-invoice (routes.ts:883). |

**Lisibilité / simplicité :** La page est dense et ambiguë pour un utilisateur non technicien. Le tableau a 8 colonnes. Chaque ligne contient un menu de statut modifiable directement, sans confirmation, alors qu'un passage à 'Reçu' déclenche un webhook externe, et la même ligne affiche parfois 'Lecture seule'. La colonne Actions aligne jusqu'à 6 boutons-icônes de couleurs différentes, sans texte (seulement un title au survol), et la colonne Vérification se réduit à une loupe de 16 px. Le badge vert 'Validé' apparaît dès que la facture est trouvée, alors que l'avoir n'est pas validé et que le bouton 'Valider' est toujours proposé, ce qui rend le flux principal contradictoire. Tout l'onglet Finalisés est grisé (opacity-75), donc peu lisible. Les compteurs sont affichés trois fois (en-tête, onglets, carte). Plusieurs messages emploient du jargon (NocoDB, webhook) ou sont en anglais ('Failed to create avoir', '403: {"message":...}'). Formats peu soignés : '#Sans référence', '12.50 €' avec un point. Le formulaire de création n'est pas réinitialisé après envoi et ignore le magasin sélectionné en haut. Le PDF ne peut pas être envoyé par un directeur ou un employé. Côté performance, chaque affichage déclenche une cascade (/api/user, puis 3 requêtes, puis N POST de vérification séquentiels). 'Vérifier toutes' produit O(N²) requêtes et N toasts. De nombreux console.log de debug restent actifs en production.

### `/avoirs (mobile)`

**Rôle :** Version téléphone du suivi des avoirs : voir la liste des avoirs du magasin sélectionné, en créer un rapidement et changer leur statut ou les supprimer.

**Tâches principales de l'utilisateur :**
- Consulter les avoirs du magasin sélectionné
- Rechercher par fournisseur ou référence de facture
- Créer une demande d'avoir (feuille du bas)
- Changer le statut via le menu '⋮'
- Supprimer un avoir

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/user | au montage, via useAuthUnified dans la page et dans MobileLayout (fetch direct no-cache en production) | server/localAuth.production.ts:246 | 2 requêtes supplémentaires à chaque ouverture de la page. La liste attend l'une d'elles (enabled: !!user). |
| GET /api/avoirs?storeId=X | au montage, seulement si un magasin est sélectionné et l'utilisateur chargé | server/routes.ts:3711 → getUserWithGroups + storage.getAvoirs (storage.ts:2528) | Avec 'Tous les magasins', la requête n'est pas lancée et la page affiche 'Aucun avoir trouvé'. queryKey ['/api/avoirs', storeId] différente de celle du bureau. |
| GET /api/suppliers | au montage | server/routes.ts:1141 → storage.getUser + storage.getSuppliers | Utile seulement quand la feuille de création est ouverte. |
| GET /api/groups | au montage | server/routes.ts:970 → getUserWithGroups (+ getGroups pour admin) | Même clé que MobileApp, donc dédoublonnée, mais inutile : StoreContext fournit déjà 'stores'. |
| POST /api/avoirs | clic 'Créer la demande' | server/routes.ts:3774 → createAvoir + webhook synchrone | Montant envoyé à 0 par défaut. |
| PUT /api/avoirs/:id | menu '⋮' > Marquer En attente / Demandé / Reçu | server/routes.ts:3851 → getAvoir, updateAvoir, webhook si 'Reçu' | Envoie l'objet avoir complet, relations comprises (group avec le logo base64). Aucun onError. |
| DELETE /api/avoirs/:id | menu '⋮' > Supprimer (sans confirmation) | server/routes.ts:3945 → deleteAvoir | Erreur 403 pour manager et employé, avalée sans message. |

**Lisibilité / simplicité :** La présentation en cartes est plus lisible que le tableau du bureau. En revanche : la liste est vide avec le message trompeur 'Aucun avoir trouvé' quand 'Tous les magasins' est sélectionné. La suppression se fait d'un tap, sans confirmation, et est proposée à tous les rôles. Les échecs (403) sont silencieux. Le menu de statut propose toujours les 3 états, sans indiquer l'état courant et sans les restrictions du bureau (manager vers 'Reçu', avoirs validés). Le formulaire n'affiche aucune erreur de validation et force le montant à 0 €. Les libellés, couleurs et statuts diffèrent du bureau ('Suivi' contre 'Gestion', indigo contre bleu, 'En attente' contre 'En attente de demande', 'Vérifié Compta' contre 'Validé'). Il n'y a pas de séparation En cours / Finalisés, la date s'affiche sans l'année, et le chargement utilise un spinner alors que le bureau utilise un skeleton.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [AVOIRS-01](#avoirs-01) | haute | perf-api | M | Boucle séquentielle de N appels POST verify-invoice à chaque chargement de la liste | `client/src/pages/Avoirs.tsx:192` |
| [AVOIRS-02](#avoirs-02) | haute | perf-api | M | « Vérifier toutes » déclenche une cascade O(N²) de requêtes, N toasts et ferme la modale d'édition | `client/src/pages/Avoirs.tsx:689` |
| [AVOIRS-03](#avoirs-03) | haute | bug | S | Après Valider ou Dévalider, la liste n'est pas rafraîchie quand un magasin est sélectionné | `client/src/pages/Avoirs.tsx:528` |
| [AVOIRS-04](#avoirs-04) | haute | bug | M | Envoi du PDF impossible pour directeur et employé, et appel direct au webhook externe depuis le navigateur | `client/src/pages/Avoirs.tsx:776` |
| [AVOIRS-05](#avoirs-05) | haute | ux-simplicite | S | Badge « Validé » affiché alors que l'avoir n'est pas validé (la facture a seulement été trouvée) | `client/src/pages/Avoirs.tsx:1037` |
| [AVOIRS-API-01](#avoirs-api-01) | haute | perf-api | S | La liste renvoie la ligne complète du magasin (logo base64, SMTP, webhook) dans chaque avoir | `server/storage.ts:2546` |
| [MOB-AVOIRS-01](#mob-avoirs-01) | haute | bug | S | Liste vide « Aucun avoir trouvé » quand « Tous les magasins » est sélectionné | `client/src/pages/mobile/AvoirsPage.tsx:83` |
| [MOB-AVOIRS-02](#mob-avoirs-02) | haute | ux-simplicite | S | Suppression sans confirmation, proposée à tous les rôles, avec échec silencieux | `client/src/pages/mobile/AvoirsPage.tsx:257` |
| [AVOIRS-06](#avoirs-06) | moyenne | ux-simplicite | M | Statut modifié immédiatement par un menu déroulant dans chaque ligne, sans confirmation, avec effet externe | `client/src/pages/Avoirs.tsx:994` |
| [AVOIRS-07](#avoirs-07) | moyenne | ux-simplicite | M | Jusqu'à 6 boutons-icônes sans texte par ligne et une loupe de 16 px | `client/src/pages/Avoirs.tsx:1060` |
| [AVOIRS-08](#avoirs-08) | moyenne | lisibilite | S | Onglet « Finalisés » entièrement grisé et semi-transparent | `client/src/pages/Avoirs.tsx:989` |
| [AVOIRS-09](#avoirs-09) | moyenne | lisibilite | S | Messages techniques (NocoDB, webhook) et erreurs brutes en anglais affichés à l'utilisateur | `client/src/pages/Avoirs.tsx:666` |
| [AVOIRS-10](#avoirs-10) | moyenne | bug | S | Bouton « Valider » proposé à des rôles que le serveur refuse | `client/src/pages/Avoirs.tsx:1076` |
| [AVOIRS-11](#avoirs-11) | moyenne | perf-client | S | Requête /api/user redondante qui bloque toutes les autres (cascade) | `client/src/pages/Avoirs.tsx:147` |
| [AVOIRS-12](#avoirs-12) | moyenne | bug | S | Formulaire de création non réinitialisé, et magasin par défaut qui ignore le magasin sélectionné | `client/src/pages/Avoirs.tsx:263` |
| [AVOIRS-13](#avoirs-13) | moyenne | perf-client | S | Filtrages non mémoïsés et code mort exécuté à chaque frappe, avec un risque de plantage | `client/src/pages/Avoirs.tsx:871` |
| [AVOIRS-14](#avoirs-14) | moyenne | perf-client | M | Aucune pagination : tout l'historique est rendu avec un Select Radix par ligne | `client/src/pages/Avoirs.tsx:988` |
| [AVOIRS-15](#avoirs-15) | moyenne | dette-code | S | console.log de débogage actifs en production dans les chemins chauds | `client/src/pages/Avoirs.tsx:168` |
| [AVOIRS-API-02](#avoirs-api-02) | moyenne | perf-api | M | Ni pagination ni filtre de statut en SQL : la séparation En cours / Finalisés se fait en JavaScript | `server/storage.ts:2561` |
| [AVOIRS-API-03](#avoirs-api-03) | moyenne | perf-serveur | S | Logs JSON volumineux à chaque création, modification et vérification | `server/routes.ts:3874` |
| [AVOIRS-API-04](#avoirs-api-04) | moyenne | perf-api | S | Création et modification bloquées par l'appel au webhook externe, sans timeout | `server/routes.ts:3821` |
| [AVOIRS-API-05](#avoirs-api-05) | moyenne | bug | S | Le webhook avoir est envoyé avec un nom de fournisseur factice | `server/routes.ts:3813` |
| [AVOIRS-API-06](#avoirs-api-06) | moyenne | bug | S | Le PUT efface montant, référence et commentaire s'ils ne sont pas envoyés, ce qui oblige à renvoyer tout l'objet | `server/routes.ts:3879` |
| [AVOIRS-API-07](#avoirs-api-07) | moyenne | bug | S | Règles métier appliquées seulement côté client (statut « Reçu », avoirs validés, changement de magasin) | `server/routes.ts:3866` |
| [MOB-AVOIRS-03](#mob-avoirs-03) | moyenne | ux-simplicite | S | Menu de statut sans indication de l'état courant ni restrictions | `client/src/pages/mobile/AvoirsPage.tsx:239` |
| [MOB-AVOIRS-04](#mob-avoirs-04) | moyenne | perf-api | S | Le changement de statut envoie l'objet avoir complet avec ses relations | `client/src/pages/mobile/AvoirsPage.tsx:241` |
| [MOB-AVOIRS-05](#mob-avoirs-05) | moyenne | bug | S | Montant forcé à 0 € lors d'une création sur mobile | `client/src/pages/mobile/AvoirsPage.tsx:135` |
| [MOB-AVOIRS-06](#mob-avoirs-06) | moyenne | ux-simplicite | S | Erreurs de validation invisibles dans le formulaire mobile | `client/src/pages/mobile/AvoirsPage.tsx:46` |
| [MOB-AVOIRS-07](#mob-avoirs-07) | moyenne | perf-client | M | Requêtes /api/user répétées et cascade avant le chargement des avoirs | `client/src/pages/mobile/AvoirsPage.tsx:72` |
| [AVOIRS-16](#avoirs-16) | basse | ux-simplicite | S | Compteurs affichés trois fois et deux composants Tabs séparés | `client/src/pages/Avoirs.tsx:1168` |
| [AVOIRS-17](#avoirs-17) | basse | lisibilite | S | Formats incohérents : « #Sans référence », montants « 12.50 € », couleur CSS invalide | `client/src/pages/Avoirs.tsx:1012` |
| [AVOIRS-18](#avoirs-18) | basse | bug | S | La règle « un admin peut modifier un avoir validé » est inaccessible depuis le menu de statut | `client/src/pages/Avoirs.tsx:997` |
| [AVOIRS-19](#avoirs-19) | basse | perf-api | S | Double marquage du cache lors de la validation, et validation hors useMutation | `client/src/pages/Avoirs.tsx:510` |
| [AVOIRS-20](#avoirs-20) | basse | bug | S | Timer du modal d'attente jamais nettoyé, et modal fermable pendant l'envoi | `client/src/pages/Avoirs.tsx:746` |
| [AVOIRS-21](#avoirs-21) | basse | dette-code | S | Code mort, imports inutilisés et typage faible | `client/src/pages/Avoirs.tsx:882` |
| [AVOIRS-22](#avoirs-22) | basse | perf-bundle | S | Pages Avoirs (bureau et mobile) chargées dans le bundle initial | `client/src/components/RouterProduction.tsx:26` |
| [AVOIRS-API-08](#avoirs-api-08) | basse | bug | S | Périmètre du directeur incohérent d'une route avoirs à l'autre | `server/routes.ts:3721` |
| [AVOIRS-API-09](#avoirs-api-09) | basse | perf-serveur | S | verify-invoice recharge des données déjà disponibles et ne met pas en cache les résultats négatifs | `server/invoiceVerification.ts:285` |
| [MOB-AVOIRS-08](#mob-avoirs-08) | basse | perf-client | S | Données de référence chargées inutilement et tri redondant | `client/src/pages/mobile/AvoirsPage.tsx:91` |
| [MOB-AVOIRS-09](#mob-avoirs-09) | basse | coherence-design | M | Libellés, couleurs et statuts différents de la version bureau | `client/src/pages/mobile/AvoirsPage.tsx:180` |
| [MOB-AVOIRS-10](#mob-avoirs-10) | basse | dette-code | S | Imports inutilisés, typage any et schéma dupliqué | `client/src/pages/mobile/AvoirsPage.tsx:19` |

### AVOIRS-01

**Boucle séquentielle de N appels POST verify-invoice à chaque chargement de la liste** — perf-api, sévérité haute, effort M

- **Fichier :** `client/src/pages/Avoirs.tsx:192`
- **Constat :** useEffect(() => { const loadCachedVerifications = async () => { ... for (const avoir of avoirs) { if (avoir.invoiceReference?.trim()) { const result = await apiRequest(`/api/avoirs/${avoir.id}/verify-invoice`, 'POST', { invoiceReference: avoir.invoiceReference, forceRefresh: false }); ... } } }; loadCachedVerifications(); }, [avoirs]); (l.192-245). Le commentaire de la l.716 ('✅ SUPPRIMÉ : Le chargement automatique causait des crashes JavaScript') est contredit : la boucle est toujours active. Les avoirs déjà validés (nocodbVerified) ne sont pas exclus. Côté serveur, chaque appel exécute getUserWithGroups (2 requêtes), getAvoir (3 JOIN) et une lecture du cache. Le cache expire au bout de 6 h ou 12 h (invoiceVerification.ts:101-108), après quoi l'appel va jusqu'à NocoDB. Les magasins sans configuration ne sont jamais mis en cache (invoiceVerification.ts:302-309).
- **Impact :** Avec 100 avoirs ayant une référence : 100 allers-retours successifs (plusieurs secondes à plusieurs dizaines de secondes de trafic) après chaque affichage. Chaque refetch (après toute création, modification ou suppression) relance la boucle entière. Les badges 'Validé' et les boutons 'Valider' apparaissent au compte-gouttes. Le serveur est chargé et le quota NocoDB consommé le matin, à l'expiration du cache.
- **Recommandation :** Supprimer ce useEffect. Renvoyer l'état de vérification avec la liste : dans storage.getAvoirs, ajouter un LEFT JOIN invoice_verification_cache ON cache_key = avoirs.group_id || '_' || lower(trim(avoirs.invoice_reference)) AND expires_at > now(), exposé sous la forme verification {exists, invoiceAmount, isReconciled}. À défaut, créer un endpoint groupé POST /api/avoirs/verifications {ids} qui lit uniquement le cache (un seul SELECT ... WHERE cache_key IN (...)) sans jamais appeler NocoDB, consommé par un useQuery. Exclure les avoirs nocodbVerified.

### AVOIRS-02

**« Vérifier toutes » déclenche une cascade O(N²) de requêtes, N toasts et ferme la modale d'édition** — perf-api, sévérité haute, effort M

- **Fichier :** `client/src/pages/Avoirs.tsx:689`
- **Constat :** avoirsToVerify.forEach((avoir, index) => { setTimeout(() => { handleVerifyAvoirInvoice(avoir, true); }, index * 200); }); (l.703-708). forceRefresh=true contourne le cache, d'où un appel NocoDB par avoir, y compris pour les avoirs déjà validés (le filtre des l.690-693 n'exclut pas nocodbVerified). En cas de succès : editAvoirMutation.mutate({ id: variables.avoirId, data: { ..., amount: result.invoiceAmount, ... } }) (l.601-612). Son onSuccess invalide toutes les clés '/api/avoirs' (l.303-307), affiche le toast 'Avoir modifié' et exécute setIsEditDialogOpen(false); setSelectedAvoir(null) (l.308-313). Le refetch produit un nouveau tableau 'avoirs', ce qui relance la boucle d'AVOIRS-01 (N POST).
- **Impact :** Pour N avoirs : N appels NocoDB, N PUT, N GET /api/avoirs et jusqu'à N×N POST verify-invoice. L'utilisateur reçoit N toasts 'Avoir modifié'. Si une modale d'édition est ouverte, elle se ferme toute seule. Le montant saisi est remplacé sans prévenir par le montant HT de la facture.
- **Recommandation :** Créer un endpoint serveur POST /api/avoirs/verify-all, limité aux groupes accessibles et excluant les avoirs nocodbVerified. Il traite les vérifications en parallèle avec une concurrence limitée (4) et ne remplit le montant côté serveur que s'il est vide. Côté client : une seule mutation suivie d'une seule invalidation. En attendant, utiliser une mutation de remplissage automatique séparée, sans toast ni fermeture de modale, qui met à jour la ligne avec queryClient.setQueryData au lieu d'invalider la liste.

### AVOIRS-03

**Après Valider ou Dévalider, la liste n'est pas rafraîchie quand un magasin est sélectionné** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:528`
- **Constat :** La queryKey est [avoirsUrl, selectedStoreId, (user as any)?.role] avec avoirsUrl = `/api/avoirs${selectedStoreId ? `?storeId=${selectedStoreId}` : ''}` (l.164-166). handleValidateAvoir et handleDevalidateAvoir appellent queryClient.invalidateQueries({ queryKey: ['/api/avoirs'] }) (l.528 et l.560). TanStack compare les clés élément par élément : '/api/avoirs' ≠ '/api/avoirs?storeId=3', donc aucune requête n'est invalidée. Les autres mutations utilisent un prédicat includes('/api/avoirs') (l.265-269), qui fonctionne.
- **Impact :** Dès qu'un magasin est sélectionné (cas le plus courant), un avoir validé reste dans l'onglet 'En cours'. Après 'Dévalider', l'état local est supprimé (l.551-555) mais avoir.nocodbVerified reste à true dans le cache : la ligne affiche toujours 'Validé' et reste dans 'Finalisés' jusqu'au rechargement de la page. L'utilisateur croit que l'action a échoué et recommence.
- **Recommandation :** Correction auto limitée au minimum : remplacer aux l.528 et 560 par queryClient.invalidateQueries({ predicate: q => q.queryKey[0]?.toString().includes('/api/avoirs') || false }). La normalisation de la clé ['/api/avoirs', {storeId}] avec un queryFn dédié (bureau et mobile) se fait à part, sans automatisation.

### AVOIRS-04

**Envoi du PDF impossible pour directeur et employé, et appel direct au webhook externe depuis le navigateur** — bug, sévérité haute, effort M

- **Fichier :** `client/src/pages/Avoirs.tsx:776`
- **Constat :** const groups = await queryClient.fetchQuery({ queryKey: ['/api/groups'] }); const group = (groups as any[]).find(g => g.id === groupId); if (!group?.webhookUrl) { toast({ ... description: 'Aucun webhook configuré pour ce magasin' }) } (l.776-786). Pour un non-admin, GET /api/groups renvoie (user as any).userGroups?.map((ug: any) => ug.group) (server/routes.ts:983). Ces groupes viennent de getUserWithGroups, qui ne sélectionne que g.id, g.name, g.color, created_at et updated_at (server/storage.ts:376-399) : webhookUrl est donc toujours undefined. Le bouton Upload est affiché si role !== 'manager' (l.1063), donc aux directeurs et aux employés. L'envoi se fait ensuite par fetch(group.webhookUrl, { method: 'POST', body: formData }) (l.805) directement depuis le navigateur, alors que BLReconciliation passe par le proxy '/api/reconciliation/send-invoice' (BLReconciliation.tsx:587-592, routes.ts:883), justement pour les « problèmes CORS ».
- **Impact :** Pour un directeur ou un employé, le bouton 'Envoyer fichier avoir' échoue toujours avec un message incompréhensible. Pour un admin, l'envoi dépend du CORS du service externe et l'URL du webhook est visible dans le navigateur.
- **Recommandation :** Créer POST /api/avoirs/:id/send-file. Le serveur vérifie l'accès au groupe de l'avoir, lit webhookUrl via storage.getGroup(avoir.groupId) et relaie le fichier (même parseur multipart que send-invoice). Ne pas réutiliser send-invoice, qui fait confiance à une URL fournie par le client. Décider explicitement si les employés peuvent envoyer ce fichier.

### AVOIRS-05

**Badge « Validé » affiché alors que l'avoir n'est pas validé (la facture a seulement été trouvée)** — ux-simplicite, sévérité haute, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:1037`
- **Constat :** {(avoirVerificationResults[avoir.id]?.exists === true || avoir.nocodbVerified) ? (<div className='... bg-green-100 text-green-800 ...'><CheckCircle .../>Validé</div>) (l.1037-1041). Dans la même ligne : {avoirVerificationResults[avoir.id]?.exists === true && !avoir.nocodbVerified && (<Button ... title="Valider l'avoir"><CheckCircle/></Button>)} (l.1076-1086).
- **Impact :** L'utilisateur voit 'Validé' en vert et, en même temps, un bouton vert ✓ 'Valider'. Il pense que le travail est fait, et l'avoir ne passe jamais dans 'Finalisés'. C'est le flux principal de la page qui devient ambigu.
- **Recommandation :** Afficher 3 états explicites avec du texte : 'Non vérifié' (gris, avec un bouton 'Vérifier'), 'Facture trouvée – à valider' (bleu ou orange, avec un bouton texte 'Valider'), et 'Validé' (vert) uniquement si avoir.nocodbVerified.

### AVOIRS-API-01

**La liste renvoie la ligne complète du magasin (logo base64, SMTP, webhook) dans chaque avoir** — perf-api, sévérité haute, effort S

- **Fichier :** `server/storage.ts:2546`
- **Constat :** getAvoirs sélectionne supplier: suppliers, group: groups, creator: { id, firstName, lastName, username, email: users.email } (l.2546-2554) avec .leftJoin(groups, eq(avoirs.groupId, groups.id)). La table groups contient logo: text('logo'), // Logo en data URI (data:image/png;base64,...) (shared/schema.ts:67), smtpHost, smtpUser et smtpSenderEmail (l.70-76), webhookUrl (l.63), address et phone. getAvoir fait de même (l.2593-2594) ; il est appelé par chaque PUT, DELETE et verify-invoice. Le middleware global stripSmtpPassword (server/routes.ts:168-174, server/sanitize.ts:13-45) parcourt ensuite récursivement tous les objets de la réponse.
- **Impact :** Le logo (souvent plusieurs dizaines à centaines de Ko) est répété dans chaque avoir : environ 200 avoirs × 100 Ko ≈ 20 Mo de JSON pour une seule liste, soit un chargement très lent, surtout en 4G. Sérialisation et nettoyage récursif consomment du CPU. webhookUrl et la configuration SMTP sont exposés aux employés et aux managers.
- **Recommandation :** Projection : group {id, name, color, nocodbTableName, nocodbConfigId}, supplier {id, name}, creator {id, firstName, lastName, username}, dans getAvoirs et getAvoir. Mettre à jour AvoirWithRelations (ou un type dédié) pour que tsc passe. MemStorage peut rester tel quel.

### MOB-AVOIRS-01

**Liste vide « Aucun avoir trouvé » quand « Tous les magasins » est sélectionné** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/mobile/AvoirsPage.tsx:83`
- **Constat :** queryFn: async () => { if (!selectedStoreId) return []; ... }, enabled: !!selectedStoreId && !!user (l.82-88). MobileLayout propose 'Tous les magasins' (MobileLayout.tsx:28, 40-46), et MobileApp ne présélectionne un magasin que s'il n'y en a qu'un (MobileApp.tsx:37). L'état vide affiche <p>Aucun avoir trouvé</p> (l.200-204).
- **Impact :** Un admin ou un directeur multi-magasins ouvre la page et lit 'Aucun avoir trouvé' alors que des avoirs existent. Il croit qu'il n'y en a pas.
- **Recommandation :** Appeler /api/avoirs sans storeId quand aucun magasin n'est sélectionné (le serveur filtre déjà selon le rôle, routes.ts:3721-3733). À défaut, afficher 'Choisissez un magasin en haut de l'écran pour voir ses avoirs'.

### MOB-AVOIRS-02

**Suppression sans confirmation, proposée à tous les rôles, avec échec silencieux** — ux-simplicite, sévérité haute, effort S

- **Fichier :** `client/src/pages/mobile/AvoirsPage.tsx:257`
- **Constat :** <DropdownMenuItem onClick={() => deleteMutation.mutate(avoir.id)} className='text-red-600'> (l.257-263). deleteMutation et updateStatusMutation n'ont pas d'onError (l.113-127). Le serveur refuse la suppression aux rôles autres qu'admin et directeur (routes.ts:3960-3962).
- **Impact :** Sur téléphone, un tap malheureux supprime définitivement un avoir pour un admin. Pour un manager ou un employé, rien ne se passe et aucun message n'apparaît.
- **Recommandation :** Ajouter une confirmation par AlertDialog. Masquer 'Supprimer' pour les rôles autres qu'admin et directeur. Ajouter un onError qui affiche un toast en français.

### AVOIRS-06

**Statut modifié immédiatement par un menu déroulant dans chaque ligne, sans confirmation, avec effet externe** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Avoirs.tsx:994`
- **Constat :** <Select value={avoir?.status || ''} onValueChange={(newStatus) => handleStatusChange(avoir.id, newStatus)} disabled={avoir.nocodbVerified}> (l.994-1009) envoie un PUT immédiatement. Le serveur envoie un webhook quand le statut passe à 'Reçu' (server/routes.ts:3891-3928). Pour un rôle autre qu'admin ou directeur, la même ligne affiche {!canEditDelete && avoir?.status !== 'Reçu' && (<span>Lecture seule</span>)} (l.1136-1138) alors que le menu reste modifiable.
- **Impact :** Un clic accidentel change le statut et envoie une notification irréversible au système externe. La mention 'Lecture seule' contredit un menu modifiable. Un Select large dans chaque ligne alourdit le tableau.
- **Recommandation :** Afficher le statut sous forme de badge coloré (gris 'À demander', bleu 'Demandé', vert 'Reçu'). Ajouter un seul bouton texte contextuel ('Marquer comme demandé' puis 'Marquer comme reçu'), avec confirmation pour 'Reçu'. Supprimer la mention 'Lecture seule'.

### AVOIRS-07

**Jusqu'à 6 boutons-icônes sans texte par ligne et une loupe de 16 px** — ux-simplicite, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Avoirs.tsx:1060`
- **Constat :** La colonne Actions contient Upload (bleu), CheckCircle 'Valider' (vert), XCircle 'Dévalider' (orange), MessageSquare 'Voir le commentaire' (violet), Edit et Trash2 (rouge), tous en className='h-8 w-8 p-0' avec seulement un title= (l.1062-1135). La colonne Vérification contient <button className='h-4 w-4 text-gray-400 ...' title='Cliquer pour vérifier la facture'><Search className='h-4 w-4'/></button> (l.1047-1053). Le commentaire n'est lisible que dans une modale (l.1102-1112), alors que le mobile l'affiche dans la carte (mobile/AvoirsPage.tsx:268-272).
- **Impact :** Un utilisateur non technicien doit survoler chaque icône pour la comprendre, et le title ne fonctionne pas sur écran tactile. Une cible de 16 px est difficile à cliquer. Les 6 couleurs n'ont pas de légende.
- **Recommandation :** Même recommandation, en corrigeant le constat : jusqu'à 5 icônes par ligne.

### AVOIRS-08

**Onglet « Finalisés » entièrement grisé et semi-transparent** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:989`
- **Constat :** <tr className={`hover:bg-gray-50 ${avoir?.nocodbVerified ? 'bg-gray-100 opacity-75' : ''}`}> (l.989), alors que completedAvoirs = avoirs.filter(avoir => avoir.status === 'Reçu' && avoir.nocodbVerified) (l.911). Toutes les lignes de cet onglet sont donc à 75 % d'opacité. Les dates sont déjà en text-gray-500 (l.1033).
- **Impact :** Le contraste est insuffisant (gris 500 à 75 % sur gris 100, sous 4,5:1). L'historique, justement consulté pour des vérifications, devient difficile à lire.
- **Recommandation :** Supprimer opacity-75 et bg-gray-100. Le badge 'Validé' suffit à distinguer ces lignes.

### AVOIRS-09

**Messages techniques (NocoDB, webhook) et erreurs brutes en anglais affichés à l'utilisateur** — lisibilite, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Avoirs.tsx:666`
- **Constat :** 'Ce magasin n'a pas de configuration NocoDB' (l.666) ; 'Aucun webhook configuré pour ce magasin' (l.782) ; 'Avoir traité avec succès via le webhook' (l.821) ; 'Envoi du fichier vers le webhook... {processingSeconds}s' (l.1695). Les mutations font throw new Error('Failed to create avoir') (l.259), 'Failed to edit avoir' (l.297) et 'Failed to delete avoir' (l.332), affichées via description: error.message (l.279, 318, 353). apiRequest produit des erreurs de la forme `${res.status}: ${text}` (client/src/lib/queryClient.ts:3-8), d'où un toast du type '403: {"message":"Insufficient permissions"}' (l.537).
- **Impact :** Les messages sont incompréhensibles pour un employé de magasin, qui ne sait pas quoi faire.
- **Recommandation :** Créer getErrorMessage(err) côté client, utilisé seulement au moment d'afficher le toast. Il lit le code HTTP en tête du message et le traduit (401 « Session expirée », 403 « Vous n'avez pas les droits pour cette action », 404 « Avoir introuvable », 400 « Données invalides », 5xx « Erreur serveur, réessayez »). Ne pas modifier le format des erreurs de apiRequest. Reformuler en français simple les textes 'NocoDB' et 'webhook'.

### AVOIRS-10

**Bouton « Valider » proposé à des rôles que le serveur refuse** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:1076`
- **Constat :** Côté client : {avoirVerificationResults[avoir.id]?.exists === true && !avoir.nocodbVerified && (<Button ... onClick={() => handleValidateAvoir(avoir.id)}>)} (l.1076), sans contrôle de rôle. Côté serveur : if (user.role !== 'admin' && user.role !== 'directeur') { return res.status(403).json({ message: 'Insufficient permissions' }) } (server/routes.ts:4094-4096).
- **Impact :** Un manager ou un employé qui clique reçoit un toast rouge 'Erreur de validation : 403: {"message":"Insufficient permissions"}'.
- **Recommandation :** Ajouter && canEditDelete (défini l.928) à la condition d'affichage du bouton.

### AVOIRS-11

**Requête /api/user redondante qui bloque toutes les autres (cascade)** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:147`
- **Constat :** const { data: user } = useQuery({ queryKey: ['/api/user'] }); (l.147-149), puis groups, suppliers et avoirs en enabled: !!user (l.154, 160, 188), et if (!user) { return <div>Chargement...</div>; } (l.1149-1151). En production, l'authentification passe par useAuthUnified en fetch direct, la variante react-query étant en enabled: isDevelopment (client/src/hooks/useAuthUnified.ts:43, 147-217). Le cache ['/api/user'] n'est donc jamais rempli.
- **Impact :** Chaque affichage ajoute un aller-retour séquentiel avant de lancer les 3 requêtes, elles-mêmes suivies des N vérifications. Pendant ce temps, l'utilisateur voit une page blanche avec un 'Chargement...' sans mise en forme.
- **Recommandation :** Remplir ['/api/user'] depuis useAuthUnified (setQueryData) ou lire l'utilisateur via useAuthUnified(). Retirer (user as any)?.role de la queryKey des avoirs avant de supprimer enabled: !!user. Remplacer 'Chargement...' par le skeleton.

### AVOIRS-12

**Formulaire de création non réinitialisé, et magasin par défaut qui ignore le magasin sélectionné** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:263`
- **Constat :** Le onSuccess de createAvoirMutation invalide la liste, ferme la modale (setIsCreateDialogOpen(false)) et affiche un toast, sans form.reset() (l.263-275). defaultValues: { supplierId: 0, groupId: getDefaultGroupId(), ... } (l.374-376) est évalué au premier rendu. getDefaultGroupId renvoie 1 pour un admin, sinon le premier groupe de l'utilisateur, et 0 si l'utilisateur n'est pas encore chargé (l.360-369). selectedStoreId (l.141) n'est pas utilisé.
- **Impact :** En rouvrant 'Nouvel avoir', on retrouve les données de l'avoir précédent, d'où un risque de doublon. L'utilisateur qui a choisi le magasin X en haut doit le resélectionner ; un admin risque de créer l'avoir sur le magasin 1.
- **Recommandation :** À l'ouverture de la modale et après un succès, appeler form.reset({ ...valeursParDéfaut, groupId: selectedStoreId ?? getDefaultGroupId() }).

### AVOIRS-13

**Filtrages non mémoïsés et code mort exécuté à chaque frappe, avec un risque de plantage** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:871`
- **Constat :** const filteredAvoirs = avoirs.filter(avoir => ... (avoir.creator.firstName && avoir.creator.lastName ? ... : avoir.creator.username.toLowerCase().includes(...))) (l.871-879) n'est jamais utilisé. pendingAvoirs, completedAvoirs et filterAvoirs sont recalculés à chaque rendu (l.910-926), avec un searchTerm.toLowerCase() par élément. renderAvoirTable(filteredPendingAvoirs) et renderAvoirTable(filteredCompletedAvoirs) sont tous deux évalués (l.1246 et l.1263) alors qu'un seul onglet est visible. creator provient d'un LEFT JOIN sur users (server/storage.ts:2548-2559) : si le créateur a été supprimé, Drizzle renvoie creator = null et avoir.creator.firstName lève une TypeError qui fait planter toute la page (plausible).
- **Impact :** À chaque frappe dans la recherche : 4 parcours de la liste et la construction du JSX des deux tableaux. Risque de page blanche.
- **Recommandation :** Supprimer filteredAvoirs. Calculer pending, completed et les listes filtrées dans des useMemo, en passant la recherche par useDeferredValue(searchTerm). Ne rendre que le tableau de l'onglet actif. Utiliser le chaînage optionnel sur creator.

### AVOIRS-14

**Aucune pagination : tout l'historique est rendu avec un Select Radix par ligne** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Avoirs.tsx:988`
- **Constat :** {avoirsList?.filter(avoir => avoir && avoir.id).map((avoir) => (<tr ...> ... <Select ...> (l.988-1009). Côté serveur, getAvoirs n'a pas de LIMIT : const results = await query.orderBy(desc(avoirs.createdAt)); (server/storage.ts:2565). L'onglet 'Finalisés' grossit indéfiniment.
- **Impact :** Après une année d'utilisation (des centaines d'avoirs), le DOM est lourd, et le rendu comme la recherche ralentissent. Chaque Select ajoute plusieurs composants Radix et leurs écouteurs.
- **Recommandation :** Paginer par 50, ou limiter 'Finalisés' aux 3 derniers mois avec un bouton 'Voir plus'. Remplacer le Select de chaque ligne par un badge (voir AVOIRS-06).

### AVOIRS-15

**console.log de débogage actifs en production dans les chemins chauds** — dette-code, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Avoirs.tsx:168`
- **Constat :** Dans le queryFn : console.log('💰 Fetching avoirs from:', avoirsUrl) puis console.log('🔍 Premiers avoirs avec nocodbVerified:', data.map(a => ({ id: a.id, invoiceReference: ..., nocodbVerified: ... }))) (l.168-184), qui parcourt toute la liste à chaque fetch. Dans la boucle : console.log('🔍 LoadCache - Avoir analysé:', {...}) pour chaque avoir (l.205-210), ainsi qu'aux l.220, 224 et 233-240. Autres logs aux l.414-420, 525, 557, 600 et 672-677. Aucun n'est protégé par import.meta.env.DEV, contrairement à apiRequest (queryClient.ts:17).
- **Impact :** Console saturée, allocations inutiles, et références et montants exposés dans la console du poste du magasin.
- **Recommandation :** Supprimer ces console.log, surtout ceux dont les arguments calculent quelque chose (l.178 data.map, l.205-210). Ce nettoyage est sans risque, mais le gain en production est minime, car le minifieur retire déjà les appels.

### AVOIRS-API-02

**Ni pagination ni filtre de statut en SQL : la séparation En cours / Finalisés se fait en JavaScript** — perf-api, sévérité moyenne, effort M

- **Fichier :** `server/storage.ts:2561`
- **Constat :** if (groupIds && groupIds.length > 0) { query = query.where(inArray(avoirs.groupId, groupIds)); } const results = await query.orderBy(desc(avoirs.createdAt)); (l.2561-2565), sans limite. Le client sépare ensuite les listes : pendingAvoirs = avoirs.filter(avoir => !(avoir.status === 'Reçu' && avoir.nocodbVerified)) (Avoirs.tsx:910-911). Un admin sans magasin sélectionné reçoit tous les avoirs de tous les magasins (routes.ts:3721-3722).
- **Impact :** La réponse grossit avec l'historique. L'essentiel des données transférées concerne des avoirs finalisés rarement consultés.
- **Recommandation :** Ajouter les paramètres ?scope=pending|completed&limit=50&offset=, traduits en SQL par WHERE (status <> 'Reçu' OR nocodb_verified = false). Ne charger 'Finalisés' qu'à l'ouverture de l'onglet (useQuery avec enabled: activeTab === 'completed'). L'index (group_id, status) existe déjà (migrations/20260814_add_performance_indexes.sql).

### AVOIRS-API-03

**Logs JSON volumineux à chaque création, modification et vérification** — perf-serveur, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:3874`
- **Constat :** PUT : console.log('💰 PUT Avoir - Raw body received:', JSON.stringify(req.body, null, 2)), puis les logs 'Validated data' et 'Data for DB' (l.3874, 3876, 3885). POST : l.3782, 3783 et 3791. GET : l.3735 et 3737. verify-invoice : l.4032-4038 et 4048. invoiceVerification.checkCache écrit 2 à 3 logs par appel (server/invoiceVerification.ts:22-31, 35-41, 58), et getInvoiceVerificationCache en ajoute (server/storage.ts:1718-1736). Le mobile envoie l'avoir complet, groupe et logo compris, dans le PUT (mobile/AvoirsPage.tsx:239-256), qui est donc journalisé 3 fois en pretty-print.
- **Impact :** Les écritures synchrones sur stdout bloquent la boucle d'événements. Les logs gonflent de plusieurs centaines de Ko par changement de statut, multipliés par N pendant la boucle de vérification.
- **Recommandation :** Supprimer les console.log de données (et non les console.error), ou les placer derrière un if (process.env.DEBUG). Ne jamais journaliser req.body en entier.

### AVOIRS-API-04

**Création et modification bloquées par l'appel au webhook externe, sans timeout** — perf-api, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:3821`
- **Constat :** POST : const webhookResponse = await fetch(group.webhookUrl, { method: 'POST', headers: {...}, body: JSON.stringify(webhookData) }); est attendu avant res.json(avoir) (l.3821-3840). Le PUT fait de même lors du passage à 'Reçu' (l.3914-3934). Aucun AbortSignal ni timeout.
- **Impact :** Si le service externe est lent ou indisponible, le bouton 'Création...' reste bloqué jusqu'au timeout TCP (de quelques dizaines de secondes à plusieurs minutes), alors que l'avoir est déjà enregistré. L'utilisateur reclique et crée des doublons.
- **Recommandation :** Répondre au client tout de suite, puis envoyer le webhook en arrière-plan (sans await, ou via une file de tâches) avec signal: AbortSignal.timeout(5000), et appeler updateAvoirWebhookStatus une fois l'envoi terminé.

### AVOIRS-API-05

**Le webhook avoir est envoyé avec un nom de fournisseur factice** — bug, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:3813`
- **Constat :** supplierName: 'Unknown', // Will be fetched from relations (l.3813) et supplierName: 'Fournisseur', // Sera enrichi avec relations (l.3903) ne sont jamais enrichis. Pourtant existingAvoir, issu de getAvoir (l.3859), contient déjà supplier.name.
- **Impact :** Le système externe (comptabilité, automatisation) reçoit 'Unknown' ou 'Fournisseur' au lieu du vrai fournisseur, ce qui impose un tri manuel.
- **Recommandation :** POST : après createAvoir, lire const full = await storage.getAvoir(avoir.id) et utiliser full?.supplier?.name ?? ''. PUT : si validatedData.supplierId est défini et différent de existingAvoir.supplierId, relire l'avoir avec getAvoir(id) ; sinon utiliser existingAvoir.supplier?.name.

### AVOIRS-API-06

**Le PUT efface montant, référence et commentaire s'ils ne sont pas envoyés, ce qui oblige à renvoyer tout l'objet** — bug, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:3879`
- **Constat :** const dataForDb: any = { ...validatedData, amount: validatedData.amount === undefined ? null : validatedData.amount, invoiceReference: ... === undefined ? null : ..., comment: ... === undefined ? null : ... }; (l.3879-3884), après insertAvoirSchema.partial().parse(req.body) (l.3875). Conséquence : le bureau reconstruit tout le payload pour un simple changement de statut (Avoirs.tsx:483-494, 601-612), et le mobile envoie { ...avoir, status } avec toutes les relations (mobile/AvoirsPage.tsx:239-256).
- **Impact :** Un PUT { status: 'Reçu' } effacerait le montant, la référence et le commentaire. Les requêtes sont plus lourdes que nécessaire.
- **Recommandation :** D'abord modifier le client pour qu'il envoie explicitement amount: null quand le champ est vide (Avoirs.tsx:408). Ensuite seulement, côté serveur, ne convertir en null que les clés présentes dans req.body. Les clients pourront alors n'envoyer que { status }.

### AVOIRS-API-07

**Règles métier appliquées seulement côté client (statut « Reçu », avoirs validés, changement de magasin)** — bug, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:3866`
- **Constat :** Le bureau interdit aux managers de passer un avoir en 'Reçu' (Avoirs.tsx:474-481) et bloque les avoirs validés (l.464-471). Le PUT serveur ne vérifie que le magasin de l'avoir existant : if (!userGroupIds.includes(existingAvoir.groupId)) (routes.ts:3866-3871). Il ne contrôle ni le rôle pour 'Reçu', ni nocodbVerified, ni l'accès au nouveau validatedData.groupId. Le mobile propose 'Marquer Reçu' à tous les rôles (mobile/AvoirsPage.tsx:251-256).
- **Impact :** Sur mobile, un manager peut passer un avoir en 'Reçu' (ce qui déclenche le webhook), modifier un avoir validé ou déplacer un avoir vers un magasin qu'il ne gère pas. Le comportement diffère entre bureau et mobile.
- **Recommandation :** Appliquer ces règles dans le PUT : 403 si le rôle est manager et que le statut passe à 'Reçu' ; 409 si existingAvoir.nocodbVerified et que le rôle n'est pas admin ; vérifier userGroupIds.includes(validatedData.groupId) quand groupId change.

### MOB-AVOIRS-03

**Menu de statut sans indication de l'état courant ni restrictions** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/AvoirsPage.tsx:239`
- **Constat :** Les trois entrées 'Marquer En attente', 'Marquer Demandé' et 'Marquer Reçu' sont toujours affichées, y compris pour le statut courant (l.239-256). Aucun contrôle du rôle manager ni de nocodbVerified, contrairement au bureau (Avoirs.tsx:464-481, 1005-1007).
- **Impact :** Clics inutiles et transitions non autorisées. Un 'Reçu' accidentel déclenche le webhook externe.
- **Recommandation :** Afficher sur la carte un bouton visible pour la seule étape suivante ('Marquer comme demandé' puis 'Marquer comme reçu'), avec confirmation pour 'Reçu'. Masquer ces actions pour les avoirs validés.

### MOB-AVOIRS-04

**Le changement de statut envoie l'objet avoir complet avec ses relations** — perf-api, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/AvoirsPage.tsx:241`
- **Constat :** updateStatusMutation.mutate({ id: avoir.id, data: { ...avoir, status: 'Reçu' } }) (l.239-256). L'objet avoir contient supplier, group (toutes ses colonnes, logo base64 compris, via getAvoirs) et creator.
- **Impact :** Un corps de requête qui peut atteindre plusieurs centaines de Ko sur réseau mobile, simplement pour changer un statut, et journalisé 3 fois côté serveur.
- **Recommandation :** Envoyer { supplierId, groupId, invoiceReference: avoir.invoiceReference ?? '', amount: avoir.amount ?? null, comment: avoir.comment ?? '', commercialProcessed: !!avoir.commercialProcessed, status }. Passer à { status } seul une fois AVOIRS-API-06 corrigé.

### MOB-AVOIRS-05

**Montant forcé à 0 € lors d'une création sur mobile** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/AvoirsPage.tsx:135`
- **Constat :** amount: z.coerce.number().optional() (l.65) et defaultValues: { ..., amount: 0, ... } (l.135). z.coerce convertit aussi un champ vidé ('') en 0. L'affichage {avoir.amount && (<span>{parseFloat(avoir.amount).toFixed(2)} €</span>)} (l.224-228) reçoit le décimal sous forme de chaîne '0.00', qui est truthy.
- **Impact :** Tout avoir créé sur mobile sans montant est enregistré à 0,00 € au lieu de 'non spécifié'. Le mobile affiche '0.00 €' et le bureau aussi, au lieu de 'Non spécifié'.
- **Recommandation :** Mettre amount: '' par défaut plutôt que undefined, pour éviter l'avertissement React sur le passage d'un champ non contrôlé à contrôlé. Utiliser amount: z.preprocess(v => v === '' || v == null ? undefined : v, z.coerce.number().optional()).

### MOB-AVOIRS-06

**Erreurs de validation invisibles dans le formulaire mobile** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/AvoirsPage.tsx:46`
- **Constat :** Seuls Form, FormControl, FormField, FormItem et FormLabel sont importés (l.46-52) : il n'y a aucun FormMessage. Le schéma contient pourtant supplierId: z.coerce.number().min(1, 'Fournisseur requis') (l.63).
- **Impact :** Un tap sur 'Créer la demande' sans fournisseur ne produit rien : ni message ni retour visuel.
- **Recommandation :** Ajouter <FormMessage /> sous chaque champ, et un toast d'erreur lorsque la soumission est invalide.

### MOB-AVOIRS-07

**Requêtes /api/user répétées et cascade avant le chargement des avoirs** — perf-client, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/mobile/AvoirsPage.tsx:72`
- **Constat :** const { user } = useAuthUnified(); (l.72) et enabled: !!selectedStoreId && !!user (l.88). En production, useAuthUnified exécute fetch('/api/user', { cache: 'no-cache' }) dans un useEffect à chaque montage (useAuthUnified.ts:147-217). MobileLayout appelle aussi useAuthUnified (MobileLayout.tsx:22).
- **Impact :** Chaque ouverture de la page coûte 2 requêtes /api/user supplémentaires, et la liste attend l'une d'elles, soit un aller-retour de plus sur réseau mobile (souvent 200 à 500 ms en 4G).
- **Recommandation :** Exposer l'utilisateur via un contexte, ou via le cache react-query rempli une seule fois (setQueryData(['/api/user'])) avec un staleTime long. Retirer la condition sur user dans enabled.

### AVOIRS-16

**Compteurs affichés trois fois et deux composants Tabs séparés** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:1168`
- **Constat :** Badges '{pendingAvoirs.length} en cours' et '{completedAvoirs.length} finalisés' dans l'en-tête (l.1168-1173), mêmes compteurs dans les onglets (l.1200-1209), puis '{filteredPendingAvoirs.length} éléments' et '{filteredCompletedAvoirs.length} éléments' dans l'en-tête de la carte (l.1239, 1256). Deux <Tabs value={activeTab}> distincts (l.1195 et l.1233).
- **Impact :** Surcharge visuelle : la même information répétée trois fois, sans valeur ajoutée.
- **Recommandation :** Ne garder que les compteurs des onglets. Utiliser un seul composant Tabs englobant TabsList et TabsContent. Supprimer le CardHeader redondant.

### AVOIRS-17

**Formats incohérents : « #Sans référence », montants « 12.50 € », couleur CSS invalide** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:1012`
- **Constat :** #{avoir.invoiceReference || 'Sans référence'} (l.1012) affiche '#Sans référence'. `${Number(avoir.amount).toFixed(2)} €` (l.1025) donne '12.50 €' au lieu de '12,50 €'. backgroundColor: avoir.group?.color || '#gray' (l.1018) n'est pas une couleur CSS valide. Abréviation 'Sans réf.' (l.1057).
- **Impact :** Rendu peu professionnel, et le point décimal trouble des utilisateurs francophones.
- **Recommandation :** Créer un helper partagé formatEuro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }). Afficher '—' quand il n'y a pas de référence. Utiliser '#9CA3AF' comme couleur de repli.

### AVOIRS-18

**La règle « un admin peut modifier un avoir validé » est inaccessible depuis le menu de statut** — bug, sévérité basse, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:997`
- **Constat :** handleStatusChange laisse passer l'admin : if (avoir?.nocodbVerified && (user as any)?.role !== 'admin') (l.464). Mais le Select porte disabled={avoir.nocodbVerified} pour tous les rôles (l.997). Le bouton Modifier, lui, reste autorisé pour l'admin sur un avoir validé (l.1114).
- **Impact :** Comportement incohérent : l'admin doit passer par la modale d'édition pour changer le statut.
- **Recommandation :** Trancher la règle métier : soit disabled={avoir.nocodbVerified && role !== 'admin'}, soit supprimer la branche admin devenue inutile dans handleStatusChange.

### AVOIRS-19

**Double marquage du cache lors de la validation, et validation hors useMutation** — perf-api, sévérité basse, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:510`
- **Constat :** handleValidateAvoir appelle await apiRequest(`/api/avoirs/${avoirId}/nocodb-verification`, 'PUT', { verified: true }) puis await apiRequest('/api/cache/mark-reconciled', 'POST', {...}) (l.502-513). Or la route PUT nocodb-verification exécute déjà invoiceVerificationService.updateCacheAsReconciled(...) (server/routes.ts:4101-4110). Ces fonctions async ne passent pas par useMutation : aucun état 'en cours', et un double clic envoie deux requêtes.
- **Impact :** Un aller-retour inutile à chaque validation (avec 3 requêtes BD), et des doubles soumissions possibles.
- **Recommandation :** Supprimer l'appel à mark-reconciled. Passer la validation dans un useMutation et désactiver le bouton pendant isPending.

### AVOIRS-20

**Timer du modal d'attente jamais nettoyé, et modal fermable pendant l'envoi** — bug, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Avoirs.tsx:746`
- **Constat :** const interval = setInterval(() => { setProcessingSeconds(prev => prev + 1); }, 1000); setProcessingTimeout(interval); (l.746-752), sans nettoyage dans un useEffect au démontage. <Dialog open={showWaitingModal} onOpenChange={handleCloseWaitingModal}> (l.1683) permet de fermer avec Échap ou un clic extérieur alors que le fetch continue. En cas d'erreur, setShowAvoirModal(true) (l.859) rouvre la modale de sélection.
- **Impact :** L'intervalle continue de tourner si l'utilisateur change de page. Les états affichés deviennent confus si la modale est fermée pendant l'envoi.
- **Recommandation :** Stocker l'intervalle dans un useRef (intervalRef.current), le nettoyer dans handleCloseWaitingModal via la ref et dans un useEffect de démontage, et supprimer l'état processingTimeout. Pour la modale d'attente, ajouter onInteractOutside et onEscapeKeyDown avec preventDefault tant que isUploading, et masquer la croix de fermeture pendant l'envoi.

### AVOIRS-21

**Code mort, imports inutilisés et typage faible** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/Avoirs.tsx:882`
- **Constat :** getStatusVariant (l.882-893) et getStatusIcon (l.896-907) ne sont jamais appelés. Imports inutilisés : Send et Settings (l.3), DialogTrigger et DialogFooter (l.10). key={avoir?.id || Math.random()} (l.989). (user as any) est répété une quinzaine de fois. Le montant d'édition est géré hors react-hook-form, via editAmountValue (l.135, 1536-1546).
- **Impact :** 1731 lignes difficiles à maintenir, ce qui augmente le risque de régression lors de la refonte UX.
- **Recommandation :** Partie automatisable uniquement : supprimer getStatusVariant et getStatusIcon, ainsi que les imports Send, Settings, DialogTrigger, DialogFooter et AlertCircle (ce dernier devient inutilisé, Clock reste utilisé l.1198), et remplacer key par avoir.id. Typer user avec UserWithGroups, pas User. Le passage du montant en FormField et le découpage en composants se font à part, sans automatisation.

### AVOIRS-22

**Pages Avoirs (bureau et mobile) chargées dans le bundle initial** — perf-bundle, sévérité basse, effort S

- **Fichier :** `client/src/components/RouterProduction.tsx:26`
- **Constat :** import Avoirs from '@/pages/Avoirs'; (l.26) et import MobileAvoirsPage from '@/pages/mobile/AvoirsPage'; (l.44) sont des imports statiques. Aucun React.lazy dans client/src. manualChunks ne sépare que les dépendances (vite.config.ts:41-46).
- **Impact :** Les 1731 lignes de la page, plus react-hook-form, zod et date-fns, sont téléchargées par tous les utilisateurs, y compris ceux qui n'ouvrent jamais les avoirs. Les versions bureau et mobile sont toutes deux téléchargées.
- **Recommandation :** const Avoirs = lazy(() => import('@/pages/Avoirs')), et de même pour MobileAvoirsPage, avec un <Suspense> qui affiche un skeleton.

### AVOIRS-API-08

**Périmètre du directeur incohérent d'une route avoirs à l'autre** — bug, sévérité basse, effort S

- **Fichier :** `server/routes.ts:3721`
- **Constat :** GET /api/avoirs : admin comme directeur voient tous les magasins quand aucun storeId n'est passé (l.3721-3722). verify-invoice refuse tout non-admin hors de ses groupes (l.4002-4013). DELETE vérifie le groupe du directeur (l.3965-3970). nocodb-verification ne vérifie aucun groupe (l.4093-4098). /api/groups ne renvoie au directeur que ses propres groupes (l.978-985).
- **Impact :** Un directeur voit les avoirs des autres magasins, mais leur vérification renvoie un 403 avalé sans message par la boucle (Avoirs.tsx:226-228). Le formulaire ne propose pas ces magasins, et le directeur peut valider n'importe quel avoir par son identifiant.
- **Recommandation :** Centraliser le calcul dans un helper getAccessibleGroupIds(user), utilisé par toutes les routes /api/avoirs*.

### AVOIRS-API-09

**verify-invoice recharge des données déjà disponibles et ne met pas en cache les résultats négatifs** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/invoiceVerification.ts:285`
- **Constat :** La route charge déjà l'avoir avec son groupe (routes.ts:3990, getAvoir joint groups), puis verifyInvoice exécute à nouveau const group = await storage.getGroup(groupId); (invoiceVerification.ts:285) et storage.getActiveNocodbConfig() (l.360) à chaque appel. getInvoiceVerificationCache supprime les entrées expirées une par une (storage.ts:1730-1731). Chaque appel exécute aussi getUserWithGroups, soit 2 requêtes (storage.ts:371-388). Le résultat 'Configuration NocoDB manquante' n'est pas mis en cache (invoiceVerification.ts:302-309).
- **Impact :** Environ 6 requêtes BD par vérification, multipliées par N avoirs dans la boucle du client.
- **Recommandation :** Ajouter un paramètre optionnel group à verifyInvoice, sans casser les autres appelants (deliveries, /api/verify-invoice). Mémoriser getActiveNocodbConfig (TTL 5 min) et l'invalider dans les routes de mise à jour NocoDB. Mettre en cache le résultat « pas de configuration » avec un TTL court (environ 5 min), invalidé à la mise à jour du magasin.

### MOB-AVOIRS-08

**Données de référence chargées inutilement et tri redondant** — perf-client, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/mobile/AvoirsPage.tsx:91`
- **Constat :** La requête suppliers part au montage (l.91-94) alors qu'elle ne sert que dans la feuille de création. La requête groups (l.96-99) double les stores déjà fournis par StoreContext (MobileApp.tsx:29-32). const sortedAvoirs = [...avoirs].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()); (l.158) trie à chaque rendu une liste que le serveur renvoie déjà triée DESC (storage.ts:2565). Le filtre est recalculé à chaque frappe, sans useMemo (l.160-163).
- **Impact :** Requêtes et calculs inutiles à chaque ouverture et à chaque frappe sur un téléphone.
- **Recommandation :** Supprimer le tri. Mémoïser le filtre avec useMemo. Remplacer la requête groups par stores de useStore() (même données). Charger les fournisseurs avec enabled: isCreateOpen et un staleTime de 10 min, en acceptant un court instant de liste vide à l'ouverture de la feuille, ou précharger au clic sur le bouton +.

### MOB-AVOIRS-09

**Libellés, couleurs et statuts différents de la version bureau** — coherence-design, sévérité basse, effort M

- **Fichier :** `client/src/pages/mobile/AvoirsPage.tsx:180`
- **Constat :** Titre 'Suivi des Avoirs' en indigo (l.179-180), contre 'Gestion des Avoirs' en bleu au bureau (Avoirs.tsx:1159-1161). Badge 'En attente' (l.167) contre 'En attente de demande'. 'Vérifié Compta' (l.277) contre 'Validé' (Avoirs.tsx:1040). 'Déjà traité par commercial' (l.375) contre 'Avoir fait par commercial' (Avoirs.tsx:1415). Pas de séparation En cours / Finalisés. Date au format 'dd/MM' sans année (l.214). Abréviation 'Réf. Facture' (l.332). Spinner au chargement (l.196-199), contre un skeleton au bureau (Avoirs.tsx:932-941).
- **Impact :** Un utilisateur qui passe du téléphone au PC doit réapprendre les termes. Les dates des avoirs anciens sont ambiguës.
- **Recommandation :** Créer un module partagé shared/avoirStatus.ts (libellés et couleurs) et un composant StatusBadge commun. Ajouter des onglets ou des chips 'En cours / Finalisés' sur mobile. Afficher les dates en dd/MM/yy. Utiliser des cartes skeleton.

### MOB-AVOIRS-10

**Imports inutilisés, typage any et schéma dupliqué** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/mobile/AvoirsPage.tsx:19`
- **Constat :** Filter, AlertCircle, Clock et Ban sont importés (l.19-25) mais pas utilisés. useForm n'est pas typé, et on trouve (data: any) et (a: any) aux l.103, 142, 158-163 et 206. Le schéma zod est dupliqué par rapport au bureau (Avoirs.tsx:76-101) et a divergé : pas de groupId, montant traité différemment.
- **Impact :** Les écarts de comportement entre bureau et mobile se multiplient.
- **Recommandation :** Partie automatisable : supprimer les imports Filter, AlertCircle, Clock et Ban. Le partage du schéma (insertAvoirSchema.omit({createdBy}), traitement du montant) se fait à part, sans automatisation.
