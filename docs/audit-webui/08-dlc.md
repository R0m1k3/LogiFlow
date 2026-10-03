# DLC

_51 constats vérifiés — 12 haute, 21 moyenne, 18 basse._

## Pages analysées

### `/dlc (desktop, client/src/pages/DlcPage.tsx via RouterProduction.tsx:164)`

**Rôle :** Suivre les produits à date courte (DLC/DDM/DLUO) du magasin : saisir un produit et sa date, voir ceux qui expirent bientôt ou sont expirés, et les traiter (retrait du rayon, rupture de stock, suppression), imprimer les listes.

**Tâches principales de l'utilisateur :**
- Ajouter un produit DLC (nom, fournisseur, EAN avec recherche automatique, date, type de date)
- Repérer les produits expirés / expirant dans 15 jours (cartes compteurs + filtre Statut)
- Traiter un produit : Valider (retrait), Marquer traité, Stock épuisé, Restaurer, Annuler traitement
- Modifier / supprimer un produit
- Imprimer la liste des produits expirés ou expirant bientôt
- Rechercher / filtrer par statut et fournisseur

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/groups | au montage (enabled: !authLoading), cache partagé avec Layout | server/routes.ts:970 -> storage.getUserWithGroups (storage.ts:371) + storage.getGroups (storage.ts:432) pour admin | Sert uniquement au fallback groupId de onSubmit ; doublon de useStore().stores déjà chargé par Layout.tsx:48. |
| GET /api/suppliers?dlc=true | au montage, staleTime 10 min | server/routes.ts:1141 -> storage.getSuppliers (storage.ts:467) puis filtre JS hasDlc | Charge tous les fournisseurs puis filtre en JS au lieu d'un WHERE has_dlc. |
| GET /api/dlc-products?storeId&status&supplierId&search | au montage + à chaque changement de filtre / recherche (debounce 500 ms), staleTime 2 min | server/routes.ts:2797 -> storage.getUserWithGroups (2 requêtes) + storage.getDlcProducts (storage.ts:1976) | Aucune limite/pagination serveur ; SELECT complet de suppliers et groups (dont groups.logo en data URI) pour chaque ligne ; storeId envoyé seulement pour admin. |
| GET /api/dlc-products/stats?storeId | au montage, staleTime 5 min | server/routes.ts:2831 -> storage.getUserWithGroups + storage.getDlcStats (storage.ts:2224) | Même queryKey que Dashboard.tsx:232 mais URL différente (storeId admin uniquement ici) ; compteurs renvoyés en chaînes (COUNT bigint). |
| POST /api/dlc-products | au clic Créer | server/routes.ts:2889 -> storage.createDlcProduct (storage.ts:2110) | req.body inséré tel quel, sans validation zod ni liste blanche de champs. |
| PUT /api/dlc-products/:id | au clic Mettre à jour | server/routes.ts:2917 -> storage.getDlcProduct (storage.ts:2088) + storage.updateDlcProduct (storage.ts:2115) | req.body passé tel quel à .set() : groupId/status/validatedBy modifiables. |
| DELETE /api/dlc-products/:id | au clic Supprimer (après AlertDialog) | server/routes.ts:2947 -> storage.getDlcProduct + storage.deleteDlcProduct (storage.ts:2124) | Aucun contrôle de rôle : tout employé peut supprimer. |
| POST /api/dlc-products/:id/validate | au clic bouton vert (admin/manager/directeur) | server/routes.ts:2977 -> storage.getDlcProduct + storage.validateDlcProduct (storage.ts:2128) | 2 console.log par appel ; pas de confirmation côté client pour une action définitive. |
| PUT /api/dlc-products/:id/stock-epuise | au clic PackageX | server/routes.ts:3023 -> storage.getDlcProduct + storage.markDlcProductStockEpuise (storage.ts:2142) | Invalide liste + stats (2 refetchs complets). |
| PUT /api/dlc-products/:id/restore-stock | au clic RotateCcw (admin/manager/directeur) | server/routes.ts:3063 -> storage.getDlcProduct + storage.restoreDlcProductStock (storage.ts:2156) | Idem. |
| PUT /api/dlc-products/:id/mark-processed | au clic CheckCircle2 | server/routes.ts:3108 -> storage.getDlcProduct + storage.markDlcProductAsProcessed (storage.ts:2170) | Le produit traité est ensuite exclu définitivement des filtres/compteurs « Expirés ». |
| PUT /api/dlc-products/:id/unmark-processed | au clic X (admin/manager/directeur) | server/routes.ts:3148 -> storage.getDlcProduct + storage.unmarkDlcProductAsProcessed (storage.ts:2197) | Idem. |
| GET /api/ffnancy/articles?ean=…&limit=1 puis GET /api/ffnancy/mouvements/entrees?artNoId=… | saisie du champ EAN (≥ 8 caractères, debounce 600 ms) — aussi déclenché à l'ouverture en édition | server/routes.ts:6396 et 6411 -> proxy fetch https://api.ffnancy.fr sans timeout ni cache | 2 allers-retours séquentiels client→serveur→API externe, fetch() manuels sans AbortController. |

**Lisibilité / simplicité :** Page fonctionnelle mais chargée et ambiguë pour un employé : filtres placés avant les compteurs, compteurs non cliquables et incohérents avec les listes filtrées (« Actifs » inclut les « Expire bientôt », le jour J compté deux fois), jusqu'à 5 boutons icônes colorés par ligne (Modifier/Supprimer sans infobulle, deux icônes de coche quasi identiques pour « Valider » et « Traité »), 4 notions qui se recouvrent (Validé, Traité, Stock épuisé, Supprimé). Bouton « Exporter PDF » inactif, mini-icônes d'impression de 24 px sans libellé. Le jour J, aucun bouton Valider/Traiter n'apparaît. Le chargement remplace le tableau par un texte à chaque frappe ; les erreurs serveur s'affichent en JSON anglais ou se déguisent en « Aucun produit ». Bug de dialogue : après « Annuler » d'une modification, « Nouveau produit DLC » rouvre en mode modification. console.log de debug dans onSubmit.

### `/dlc (mobile, client/src/pages/mobile/DlcPage.tsx via RouterProduction.tsx:124)`

**Rôle :** Version téléphone de la gestion DLC : consulter la liste par onglet (OK / Bientôt / Expirés / Validés), ajouter un produit (scan EAN) et valider un produit expiré.

**Tâches principales de l'utilisateur :**
- Voir les produits par onglet d'urgence
- Rechercher un produit (nom ou EAN)
- Ajouter un produit via le bouton flottant + feuille de saisie
- Valider (sortir) un produit via le menu …

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/dlc-products?storeId=… | au montage puis à CHAQUE changement d'onglet et CHAQUE frappe dans la recherche (queryKey contient statusFilter et searchTerm), seulement si selectedStoreId | server/routes.ts:2797 -> storage.getDlcProducts (storage.ts:1976) | fetch() manuel sans contrôle res.ok ; le queryFn ignore statut et recherche : même réponse complète re-téléchargée à chaque fois. |
| GET /api/suppliers?dlc=true | au montage (pas d'enabled) | server/routes.ts:1141 -> storage.getSuppliers (storage.ts:467) | Même clé que desktop, OK. |
| GET /api/groups | au montage | server/routes.ts:970 -> storage.getUserWithGroups / getGroups | Redondant avec useStore().stores fourni par MobileApp.tsx:28. |
| POST /api/dlc-products | soumission du formulaire | server/routes.ts:2889 -> storage.createDlcProduct (storage.ts:2110) | supplierId par défaut = 1. |
| POST /api/dlc-products/:id/validate | menu … > Valider (Sortir) | server/routes.ts:2977 -> storage.validateDlcProduct (storage.ts:2128) | Proposé à tous les rôles, refusé (403) pour les employés, sans onError. |
| GET /api/ffnancy/articles + /api/ffnancy/mouvements/entrees | saisie EAN ≥ 8 caractères (debounce 600 ms) | server/routes.ts:6396 / 6411 (proxy externe) | Code copié-collé du desktop. |

**Lisibilité / simplicité :** Interface simple (cartes, onglets, bouton flottant) mais : liste vide pour les employés et pour « Tous les magasins » (requête désactivée sans magasin sélectionné, sans message explicatif), onglet par défaut « OK » (le moins urgent), onglets sans compteurs, badge « J-3 » identique pour « expire dans 3 jours » et « expiré depuis 3 jours », formulaire sans aucun message d'erreur, fournisseur n°1 pré-sélectionné en silence, date du jour pré-remplie, action « Valider » silencieusement refusée aux employés et sans confirmation. Fonctions absentes par rapport au desktop (modifier, supprimer, stock épuisé, traité). Chaque frappe recharge toute la liste.

### `/ (Dashboard) — modale DlcAlertModal (client/src/components/DlcAlertModal.tsx, utilisée dans client/src/pages/Dashboard.tsx:773)`

**Rôle :** Alerter automatiquement les utilisateurs non-admin, à l'ouverture du tableau de bord, des produits expirés ou expirant sous 15 jours, avec action rapide « Stock épuisé » et lien vers la page DLC.

**Tâches principales de l'utilisateur :**
- Prendre connaissance des produits expirés / bientôt expirés
- Marquer un produit expiré comme « Stock épuisé »
- Aller à la page DLC
- Reporter l'alerte de 2 h

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/dlc-products/stats?storeId | au montage du Dashboard (Dashboard.tsx:231) + invalidation au montage (Dashboard.tsx:22-26) | server/routes.ts:2831 -> storage.getDlcStats (storage.ts:2224) | Requête lancée puis relancée par l'invalidation du useEffect au montage. |
| GET /api/dlc-products?status=expires&storeId | à l'ouverture de la modale si stats.expired > 0 | server/routes.ts:2797 -> storage.getDlcProducts filtre 'expires' (storage.ts:2017) | fetch() manuel sans res.ok ; liste complète téléchargée pour n'en afficher que 8 ; inclut les stocks épuisés alors que le compteur les exclut. |
| GET /api/dlc-products?status=expires_soon&storeId | à l'ouverture si stats.expiringSoon > 0 | server/routes.ts:2797 -> storage.getDlcProducts filtre 'expires_soon' (storage.ts:2000) | Idem. |
| PUT /api/dlc-products/:id/stock-epuise | clic « Stock épuisé » | server/routes.ts:3023 -> storage.markDlcProductStockEpuise (storage.ts:2142) | Invalide liste et stats. |

**Lisibilité / simplicité :** La modale ne peut pas être fermée par la croix/Échap/clic extérieur (elle se rouvre aussitôt) : seul « Traiter plus tard (2h) » fonctionne. Elle pousse à marquer un produit EXPIRÉ comme « stock épuisé » pour faire disparaître l'alerte, ce qui contredit la définition de la page DLC (« différent de périmé »). Aucun bouton d'action pour les produits qui expirent bientôt. Jargon (« Ce modal »), emojis dans les toasts, compteurs d'en-tête différents du nombre de lignes affichées, « Expiré depuis 0 jour(s) » le jour J. Le lien « Voir tous les produits DLC » recharge toute l'application.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [DLC-01](#dlc-01) | haute | bug | S | Un produit « traité » ne réapparaît jamais une fois expiré (filtre Expirés, compteurs et alerte) | `server/storage.ts:2017` |
| [DLC-02](#dlc-02) | haute | bug | S | Le jour J, aucun bouton « Valider » ni « Marquer traité » et badge « Expire bientôt » alors que le serveur le classe « Expiré » | `client/src/pages/DlcPage.tsx:425` |
| [DLC-03](#dlc-03) | haute | bug | S | Après « Annuler » une modification, « Nouveau produit DLC » rouvre en mode modification et écrase l'ancien produit | `client/src/pages/DlcPage.tsx:668` |
| [DLC-04](#dlc-04) | haute | bug | S | Ouvrir un produit en modification relance la recherche EAN et écrase son nom et son fournisseur | `client/src/pages/DlcPage.tsx:123` |
| [DLC-05](#dlc-05) | haute | bug | S | Le magasin du produit ignore le magasin sélectionné et une modification peut déplacer le produit dans un autre magasin | `client/src/pages/DlcPage.tsx:330` |
| [DLC-06](#dlc-06) | haute | bug | M | POST/PUT DLC sans validation : un employé peut valider un produit ou le déplacer vers un autre magasin | `server/routes.ts:2940` |
| [DLC-07](#dlc-07) | haute | perf-api | S | Chaque produit DLC renvoie la ligne complète du magasin (logo base64, config SMTP/NocoDB) et du fournisseur | `server/storage.ts:1977` |
| [DLC-08](#dlc-08) | haute | bug | S | La modale d'alerte DLC se rouvre immédiatement quand on la ferme par la croix, Échap ou clic extérieur | `client/src/pages/Dashboard.tsx:257` |
| [DLC-09](#dlc-09) | haute | perf-client | S | Mobile : toute la liste est re-téléchargée à chaque frappe de recherche et à chaque changement d'onglet | `client/src/pages/mobile/DlcPage.tsx:84` |
| [DLC-10](#dlc-10) | haute | bug | S | Mobile : liste DLC toujours vide pour les employés et pour « Tous les magasins » | `client/src/pages/mobile/DlcPage.tsx:96` |
| [DLC-11](#dlc-11) | haute | bug | S | Mobile : fournisseur n°1 attribué en silence et choix fournisseur non synchronisé | `client/src/pages/mobile/DlcPage.tsx:137` |
| [DLC-26](#dlc-26) | haute | bug | S | Injection HTML/JS dans l'impression (document.write avec nom de produit non échappé) | `client/src/pages/DlcPage.tsx:535` |
| [DLC-12](#dlc-12) | moyenne | ux-simplicite | S | Mobile : formulaire sans aucun message d'erreur | `client/src/pages/mobile/DlcPage.tsx:368` |
| [DLC-13](#dlc-13) | moyenne | bug | S | Mobile : « Valider (Sortir) » proposé à tous, refusé en silence aux employés et sans confirmation | `client/src/pages/mobile/DlcPage.tsx:121` |
| [DLC-14](#dlc-14) | moyenne | bug | M | Compteurs incohérents avec les listes : « Actifs » inclut « Expire bientôt », le jour J compté deux fois, stocks épuisés comptés différemment | `server/storage.ts:2238` |
| [DLC-15](#dlc-15) | moyenne | bug | S | Desktop : le magasin sélectionné est ignoré pour les non-admins et la clé de cache des stats entre en collision avec le Dashboard | `client/src/pages/DlcPage.tsx:83` |
| [DLC-16](#dlc-16) | moyenne | perf-client | S | Le tableau disparaît à chaque changement de filtre ou de recherche (pas de placeholderData ni de squelette) | `client/src/pages/DlcPage.tsx:937` |
| [DLC-17](#dlc-17) | moyenne | perf-api | M | Aucune pagination serveur : l'historique complet (y compris tous les produits validés) est chargé par défaut | `server/storage.ts:2063` |
| [DLC-18](#dlc-18) | moyenne | perf-serveur | M | Chaque requête DLC recharge l'utilisateur (2 requêtes) et chaque action relit le produit avec 2 jointures | `server/routes.ts:2799` |
| [DLC-19](#dlc-19) | moyenne | perf-client | M | Chaque clic d'action recharge toute la liste + les stats et désactive le bouton sur toutes les lignes | `client/src/pages/DlcPage.tsx:255` |
| [DLC-20](#dlc-20) | moyenne | perf-api | S | Invalidations au montage : la requête de stats DLC part deux fois à chaque visite du tableau de bord | `client/src/components/DlcAlertModal.tsx:45` |
| [DLC-21](#dlc-21) | moyenne | ux-simplicite | S | Messages d'erreur affichés en JSON anglais avec code HTTP | `client/src/lib/queryClient.ts:6` |
| [DLC-22](#dlc-22) | moyenne | ux-simplicite | S | Les erreurs serveur sont déguisées en « Aucun produit » ou en compteurs à 0 | `server/routes.ts:2827` |
| [DLC-23](#dlc-23) | moyenne | ux-simplicite | M | Jusqu'à 5 boutons icônes colorés par ligne, deux coches quasi identiques et 4 notions qui se recouvrent | `client/src/pages/DlcPage.tsx:982` |
| [DLC-25](#dlc-25) | moyenne | ux-simplicite | S | Impression cachée dans des icônes de 24 px et liste imprimée différente du compteur affiché | `client/src/pages/DlcPage.tsx:887` |
| [DLC-27](#dlc-27) | moyenne | ux-simplicite | S | Hiérarchie visuelle inversée : filtres avant les compteurs, compteurs non cliquables | `client/src/pages/DlcPage.tsx:817` |
| [DLC-28](#dlc-28) | moyenne | coherence-design | M | Vocabulaire, couleurs et seuils d'urgence différents entre desktop, mobile et modale | `client/src/pages/mobile/DlcPage.tsx:293` |
| [DLC-29](#dlc-29) | moyenne | lisibilite | S | Badge « J-3 » identique pour « expire dans 3 jours » et « expiré depuis 3 jours » | `client/src/pages/mobile/DlcPage.tsx:264` |
| [DLC-30](#dlc-30) | moyenne | ux-simplicite | S | Mobile : l'onglet par défaut montre les produits les moins urgents et les onglets n'ont pas de compteur | `client/src/pages/mobile/DlcPage.tsx:77` |
| [DLC-31](#dlc-31) | moyenne | ux-simplicite | M | Mobile : actions manquantes par rapport au desktop (modifier, supprimer, stock épuisé, traité) | `client/src/pages/mobile/DlcPage.tsx:336` |
| [DLC-32](#dlc-32) | moyenne | ux-simplicite | S | La modale incite à marquer un produit périmé « stock épuisé » pour faire disparaître l'alerte | `client/src/components/DlcAlertModal.tsx:285` |
| [DLC-36](#dlc-36) | moyenne | perf-api | M | Recherche EAN : 2 allers-retours séquentiels vers une API externe, sans cache, sans délai max, code dupliqué | `client/src/pages/DlcPage.tsx:132` |
| [DLC-47](#dlc-47) | moyenne | ux-simplicite | S | La recherche desktop ne trouve pas un produit par son code EAN (le mobile oui) | `server/storage.ts:2049` |
| [DLC-24](#dlc-24) | basse | ux-simplicite | S | Bouton « Exporter PDF » sans action | `client/src/pages/DlcPage.tsx:930` |
| [DLC-33](#dlc-33) | basse | perf-client | S | Le lien vers la page DLC recharge toute l'application | `client/src/components/DlcAlertModal.tsx:142` |
| [DLC-34](#dlc-34) | basse | lisibilite | S | Jargon, emojis et formulations maladroites dans la modale | `client/src/components/DlcAlertModal.tsx:285` |
| [DLC-35](#dlc-35) | basse | dette-code | S | console.log de debug dans onSubmit et dans les routes de mutation | `client/src/pages/DlcPage.tsx:348` |
| [DLC-37](#dlc-37) | basse | perf-serveur | S | Fournisseurs DLC filtrés en JavaScript après lecture de toute la table | `server/routes.ts:1150` |
| [DLC-38](#dlc-38) | basse | dette-code | S | Les compteurs DLC sont renvoyés en chaînes (COUNT bigint), comparaison stricte morte dans la modale | `server/storage.ts:2261` |
| [DLC-39](#dlc-39) | basse | perf-serveur | S | Les stats DLC parcourent tout l'historique (validés inclus) et utilisent la date UTC | `server/storage.ts:2229` |
| [DLC-40](#dlc-40) | basse | dette-code | S | Index dlc_products absents de shared/schema.ts (risque de suppression par drizzle-kit push) | `shared/schema.ts:278` |
| [DLC-41](#dlc-41) | basse | accessibilite | S | Boutons icônes sans libellé accessible (Modifier, Supprimer, Imprimer, menu …, bouton +) | `client/src/pages/DlcPage.tsx:983` |
| [DLC-42](#dlc-42) | basse | accessibilite | S | Lignes grisées par opacité 50-60 % : texte et boutons peu lisibles | `client/src/pages/DlcPage.tsx:962` |
| [DLC-43](#dlc-43) | basse | ux-simplicite | S | Tableau DLC non défilable et sans colonne Magasin sur tablette / vue multi-magasins | `client/src/components/ui/table.tsx:9` |
| [DLC-44](#dlc-44) | basse | lisibilite | S | Message de validation « Required » en anglais si aucun fournisseur choisi | `client/src/pages/DlcPage.tsx:33` |
| [DLC-45](#dlc-45) | basse | dette-code | M | Code dupliqué : 7 mutations copiées-collées, 2 fonctions d'impression identiques, TooltipProvider par bouton, imports morts | `client/src/pages/DlcPage.tsx:178` |
| [DLC-46](#dlc-46) | basse | perf-bundle | S | Pages DLC desktop et mobile importées statiquement dans le bundle principal | `client/src/components/RouterProduction.tsx:21` |
| [DLC-48](#dlc-48) | basse | bug | S | Recherche mobile plantée si un produit n'a pas de productName (colonne nullable) | `client/src/pages/mobile/DlcPage.tsx:236` |
| [DLC-49](#dlc-49) | basse | ux-simplicite | S | Mobile : date d'expiration pré-remplie à aujourd'hui | `client/src/pages/mobile/DlcPage.tsx:135` |
| [DLC-50](#dlc-50) | basse | lisibilite | S | Choix DLC / DDM / DLUO : DLUO est un terme obsolète qui ajoute de la confusion | `client/src/pages/DlcPage.tsx:777` |
| [DLC-51](#dlc-51) | basse | ux-simplicite | S | Retour à la page 1 après chaque action qui retire une ligne de la vue filtrée | `client/src/components/ui/pagination.tsx:157` |

### DLC-01

**Un produit « traité » ne réapparaît jamais une fois expiré (filtre Expirés, compteurs et alerte)** — bug, sévérité haute, effort S

- **Fichier :** `server/storage.ts:2017`
- **Constat :** storage.ts:2017-2027 filtre 'expires' : and(lte(expiryDate, today), ne(status,'valides'), or(isNull(processedUntilExpiry), eq(processedUntilExpiry,false))) ; storage.ts:2250-2254 compteur expired : AND (processedUntilExpiry IS NULL OR = false). Aucun job ne remet processedUntilExpiry à false (grep sans résultat hors storage.ts). Or DlcPage.tsx:1023 promet : « Indique que vous vous êtes occupé de ce produit (réapparaîtra à expiration) ».
- **Impact :** Sécurité alimentaire : un produit marqué « traité » quand il expirait bientôt disparaît définitivement du filtre « Expirés », du compteur rouge et de la modale d'alerte du tableau de bord ; il ne reste visible qu'en vue « Tous les statuts », grisé et trié en fin de liste.
- **Recommandation :** Comme proposé : retirer l'exclusion processedUntilExpiry du filtre 'expires' et du COUNT expired, en la gardant pour 'expires_soon'. Il faut aussi adapter le ORDER BY (storage.ts:2066-2074 : un produit traité expiré ne doit plus être classé en priorité 2) et le grisage de la ligne (DlcPage.tsx:963). Aligner MemStorage (storage.ts:4538-4549). À coordonner avec DLC-39 : si l'exclusion passe dans le WHERE des stats, elle ne doit pas s'appliquer aux expirés.

### DLC-02

**Le jour J, aucun bouton « Valider » ni « Marquer traité » et badge « Expire bientôt » alors que le serveur le classe « Expiré »** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:425`
- **Constat :** daysUntilExpiry = Math.ceil((expiry - today)/86400000) avec expiry = new Date('YYYY-MM-DD') (minuit UTC, drizzle renvoie la date en chaîne : node_modules/drizzle-orm/node-postgres/session.js:31). Le jour J la valeur vaut -0 → shouldShowValidateButton exige `daysUntilExpiry < 0` (l.432) et shouldShowMarkProcessedButton exige `daysUntilExpiry > 0` (l.445) : aucun des deux. getStatusBadge l.490-493 affiche « Expire bientôt ». Côté serveur, le filtre 'expires' utilise lte(expiryDate, today) (storage.ts:2021) : le produit du jour est listé dans « Expirés ».
- **Impact :** Le jour le plus critique, l'employé voit le produit dans « Expirés » avec un badge orange « Expire bientôt » et sans action de retrait possible : confusion et retrait oublié.
- **Recommandation :** Créer un utilitaire partagé (ex. shared/dlc.ts) : getDaysUntilExpiry(date) = differenceInCalendarDays(parseISO(date), startOfToday()) et des seuils uniques (≤ 0 = expiré, 1-15 = bientôt). L'utiliser dans DlcPage, mobile/DlcPage, DlcAlertModal et aligner la requête SQL (expiry_date <= CURRENT_DATE).

### DLC-03

**Après « Annuler » une modification, « Nouveau produit DLC » rouvre en mode modification et écrase l'ancien produit** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:668`
- **Constat :** handleEdit (l.377-389) fait setEditingProduct(product) + form.reset(...). Le bouton Annuler (l.803) fait seulement `setIsDialogOpen(false)` et `<Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>` (l.668) ne remet ni editingProduct ni le formulaire à zéro. Le DialogTrigger « Nouveau produit DLC » (l.669-673) rouvre donc avec le titre « Modifier le produit DLC » et onSubmit appelle updateMutation (l.370-371).
- **Impact :** Un employé qui croit créer un nouveau produit modifie en réalité le dernier produit ouvert : perte de données silencieuse.
- **Recommandation :** Créer une fonction closeDialog() qui fait setIsDialogOpen(false), setEditingProduct(null) et form.reset(). L'utiliser dans onOpenChange (si !open), dans le bouton Annuler (un appel programmatique ne déclenche pas onOpenChange) et dans les onSuccess. Au clic sur « Nouveau produit DLC », faire setEditingProduct(null) et form.reset().

### DLC-04

**Ouvrir un produit en modification relance la recherche EAN et écrase son nom et son fournisseur** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:123`
- **Constat :** useEffect([gencodeValue, suppliers]) l.123-176 se déclenche dès que gencode ≥ 8 caractères. handleEdit appelle form.reset({ gencode: product.gencode, ... }) (l.379-381) → 600 ms plus tard `form.setValue("productName", article.libelle1)` (l.138) et `form.setValue("supplierId", matched.id)` (l.163). Aucun AbortController : une réponse ancienne peut aussi écraser une saisie plus récente.
- **Impact :** Le nom personnalisé (« Yaourt fraise lot promo ») est remplacé sans prévenir par le libellé ffnancy ; le fournisseur peut changer. L'utilisateur enregistre sans s'en rendre compte.
- **Recommandation :** Garder le remplissage automatique en création, puisque c'est la fonctionnalité voulue ; remplacer l'écrasement par un simple message serait une décision produit. Correctif sûr : ne pas lancer la recherche en mode modification tant que le gencode est celui du produit (editingProduct?.gencode === gencodeValue), ou ne la déclencher que depuis l'onChange du champ. Ajouter un AbortController annulé dans le cleanup, et ignorer une réponse dont le gencode ne correspond plus à la valeur courante.

### DLC-05

**Le magasin du produit ignore le magasin sélectionné et une modification peut déplacer le produit dans un autre magasin** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:330`
- **Constat :** onSubmit l.329-346 : « FORCE L'UTILISATION DU GROUPE ASSIGNÉ EN PREMIER » `if (user?.userGroups?.[0]?.groupId) groupId = user.userGroups[0].groupId;` puis fallback `groupId = 1` (l.344). dlcData contient groupId et est aussi envoyé en modification (l.371). Le mobile fait l'inverse : `let groupId = selectedStoreId;` (mobile/DlcPage.tsx:204).
- **Impact :** Un manager/directeur multi-magasins qui a sélectionné le magasin B crée ses produits dans le magasin A ; modifier un produit du magasin B le transfère dans A. Les produits « disparaissent » du magasin attendu.
- **Recommandation :** En création : groupId = selectedStoreId s'il est défini, sinon unique magasin de l'utilisateur, sinon afficher un champ « Magasin » obligatoire (supprimer le fallback 1). En modification : ne pas envoyer groupId.

### DLC-06

**POST/PUT DLC sans validation : un employé peut valider un produit ou le déplacer vers un autre magasin** — bug, sévérité haute, effort M

- **Fichier :** `server/routes.ts:2940`
- **Constat :** routes.ts:2896-2909 `const data = { ...req.body, createdBy: user.id }; ... storage.createDlcProduct(data)` ; routes.ts:2940 `storage.updateDlcProduct(id, req.body)` puis storage.ts:2118 `.set({ ...productData, updatedAt })`. Aucun insertDlcProductSchema.parse ; le nouveau groupId n'est pas vérifié. Le rôle requis pour /validate (routes.ts:2985 ['admin','directeur','manager']) est contournable via PUT {status:'valides'}. DELETE (routes.ts:2947) n'a aucun contrôle de rôle.
- **Impact :** Contournement des droits (validation, transfert vers un magasin non autorisé, modification de validatedBy/stockEpuiseBy) ; payload invalide → 500 générique « Failed to create DLC product » au lieu d'erreurs de champ.
- **Recommandation :** Schéma zod d'édition : productName, name (le client l'envoie pour garder la colonne NOT NULL synchronisée, DlcPage.tsx:361), gencode, expiryDate (accepter la chaîne ISO datetime envoyée par le client : new Date(...) sérialisé), dateType, supplierId, notes. Ignorer status, groupId et les champs validated*/processed*/stockEpuise* en PUT ; en POST, vérifier que groupId appartient aux groupes de l'utilisateur (déjà fait, routes.ts:2902-2906) et forcer status='en_cours'. Le contrôle de rôle sur DELETE est une décision produit séparée.

### DLC-07

**Chaque produit DLC renvoie la ligne complète du magasin (logo base64, config SMTP/NocoDB) et du fournisseur** — perf-api, sévérité haute, effort S

- **Fichier :** `server/storage.ts:1977`
- **Constat :** storage.ts:1977-1985 `.select({ dlcProduct: dlcProducts, supplier: suppliers, group: groups })` ; idem getDlcProduct storage.ts:2089-2098. shared/schema.ts:67 `logo: text("logo"), // Logo en data URI (data:image/png;base64,...)` + smtpHost/smtpUser/webhookUrl/nocodb*. Le client n'utilise que product.supplier?.name (DlcPage.tsx:979, mobile l.325, DlcAlertModal l.178) et jamais product.group. Pas de compression gzip dans server/index.production.ts (aucun middleware compression). stripSmtpPassword (server/sanitize.ts) reparcourt récursivement tout ce JSON.
- **Impact :** Avec un logo de 50 Ko et 300 produits, la réponse dépasse 15 Mo non compressés : chargement de la page DLC et de la modale de plusieurs secondes sur le Wi-Fi/4G du magasin, parsing JSON lourd sur mobile, fuite d'informations de configuration à tous les employés.
- **Recommandation :** Partie automatisable : dans getDlcProducts, sélectionner `supplier: { id: suppliers.id, name: suppliers.name }` et `group: { id: groups.id, name: groups.name, color: groups.color }`. Dans getDlcProduct (utilisé pour les contrôles de droits et par GET /api/dlc-products/:id, qu'aucun client n'appelle), même restriction. Activer la compression demande d'ajouter une dépendance (`compression`) dans index.production.ts et index.ts : c'est un changement séparé, non automatique. Ne surtout pas brancher setupCompression de cache.ts.

### DLC-08

**La modale d'alerte DLC se rouvre immédiatement quand on la ferme par la croix, Échap ou clic extérieur** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:257`
- **Constat :** DlcAlertModal.tsx:146 `<Dialog open={isOpen} onOpenChange={onClose}>` → handleCloseDlcAlertModal met showDlcAlertModal à false (Dashboard.tsx:276-278). L'effet Dashboard.tsx:243-273 a showDlcAlertModal dans ses dépendances : `if (shouldShowDlcModal && !showDlcAlertModal) { ... } else { setShowDlcAlertModal(true); }` (l.257-268) sans snooze → réouverture instantanée. Seul handleSnooze (DlcAlertModal.tsx:106-112) écrit dlcAlertSnooze.
- **Impact :** Pour un employé, la croix « ne marche pas » : il est bloqué sur une fenêtre rouge tant qu'il ne trouve pas « Traiter plus tard (2h) ». Expérience très frustrante à chaque ouverture du tableau de bord.
- **Recommandation :** Considérer toute fermeture comme une mise en sourdine (au minimum pour la session : sessionStorage ou useRef « dismissed »), et retirer showDlcAlertModal des dépendances de l'effet ; n'ouvrir automatiquement qu'une fois par chargement.

### DLC-09

**Mobile : toute la liste est re-téléchargée à chaque frappe de recherche et à chaque changement d'onglet** — perf-client, sévérité haute, effort S

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:84`
- **Constat :** `queryKey: ["/api/dlc-products", selectedStoreId, statusFilter, searchTerm]` (l.84) alors que le queryFn ignore statut et recherche : `fetch(`/api/dlc-products?storeId=${selectedStoreId}`)` (l.91). Le filtrage est déjà fait en useMemo (l.227-257). Pas de debounce sur searchTerm (l.285).
- **Impact :** Taper « yaourt » = 6 requêtes complètes identiques (avec la charge de DLC-07) ; chaque onglet affiche un spinner alors que les données sont déjà en mémoire. Très lent en 4G en rayon.
- **Recommandation :** queryKey ["/api/dlc-products", "mobile", selectedStoreId] (le préfixe reste invalidé par les mutations), staleTime 2 min, filtrage uniquement côté client avec useDeferredValue(searchTerm), queryFn via apiRequest.

### DLC-10

**Mobile : liste DLC toujours vide pour les employés et pour « Tous les magasins »** — bug, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:96`
- **Constat :** `enabled: !!selectedStoreId && !!user` (l.96) et `if (selectedStoreId) {...} return [];` (l.90-94). MobileApp.tsx:33-38 ne pré-sélectionne un magasin que pour `user.role === 'directeur' || user.role === 'manager'` avec un seul magasin. Le serveur sait pourtant limiter aux magasins de l'utilisateur sans storeId (routes.ts:2809-2815). L'état vide affiche « Aucun produit trouvé » (l.306-310).
- **Impact :** Un employé ouvre « DLC » sur son téléphone et voit « Aucun produit trouvé » alors que des produits expirent : faux sentiment de sécurité.
- **Recommandation :** Appeler /api/dlc-products sans storeId quand selectedStoreId est null (routes.ts:2807-2815 restreint déjà aux magasins de l'utilisateur), en retirant la condition selectedStoreId de enabled ; sinon, afficher un état vide explicite « Choisissez votre magasin » avec un bouton qui ouvre le menu.

### DLC-11

**Mobile : fournisseur n°1 attribué en silence et choix fournisseur non synchronisé** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:137`
- **Constat :** defaultValues `supplierId: 1` (l.137) ; Select non contrôlé `defaultValue={field.value.toString()}` (l.424) et dateType `defaultValue={field.value}` (l.398). Si le fournisseur 1 n'est pas « DLC », le Select affiche « Choisir... » mais la valeur 1 passe la validation `z.coerce.number().min(1)` (l.68). Le form.setValue("supplierId", matched.id) de la recherche EAN (l.188) ne met pas à jour l'affichage.
- **Impact :** Des produits sont enregistrés avec un mauvais fournisseur sans que l'utilisateur le voie ; filtrage par fournisseur et retours fournisseurs faussés.
- **Recommandation :** supplierId: undefined par défaut et Select contrôlé `value={field.value ? String(field.value) : ""}` ("" pour revenir au placeholder après reset), idem pour dateType. Avec z.coerce, undefined devient NaN et produit « Expected number, received nan » : utiliser `z.coerce.number({ invalid_type_error: "Fournisseur requis" }).min(1, "Fournisseur requis")`. À livrer avec DLC-12, sinon la soumission échoue sans aucun message.

### DLC-26

**Injection HTML/JS dans l'impression (document.write avec nom de produit non échappé)** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:535`
- **Constat :** l.529-543 : `<td>${product.productName}</td> <td>${product.gencode || '-'}</td> ... ${product.supplier?.name}` puis l.550-554 `window.open('', '_blank')` + `printWindow.document.write(printContent)` (fenêtre about:blank de même origine). En production Docker (Dockerfile:41 compile server/index.production.ts) aucun middleware setupInputSanitization n'est appliqué (présent seulement dans server/index.ts:37).
- **Impact :** Un nom de produit contenant `<img src=x onerror=...>` saisi par n'importe quel employé s'exécute dans la session du manager qui imprime (XSS stocké).
- **Recommandation :** Échapper toutes les valeurs (helper escapeHtml) ou construire le tableau via DOM/textContent ; factoriser printExpired/printExpiringSoon en une fonction printList(titre, produits).

### DLC-12

**Mobile : formulaire sans aucun message d'erreur** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:368`
- **Constat :** Aucun <FormMessage /> dans les FormItem (l.364-476), alors que le schéma définit « Nom du produit requis », « Date requise », « Fournisseur requis » (l.64-68).
- **Impact :** Si un champ manque, le bouton « Ajouter le produit » ne fait rien de visible : l'utilisateur pense que l'application est bloquée.
- **Recommandation :** Ajouter <FormMessage /> sous chaque champ. React Hook Form met déjà le focus sur le premier champ en erreur (shouldFocusError par défaut), le défilement explicite est facultatif.

### DLC-13

**Mobile : « Valider (Sortir) » proposé à tous, refusé en silence aux employés et sans confirmation** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:121`
- **Constat :** validateMutation (l.121-127) n'a pas d'onError ; le menu (l.329-343) s'affiche pour tout rôle dès que statusFilter !== 'valides'. Le serveur répond 403 aux employés (routes.ts:2984-2987). Action définitive (aucune route d'annulation) sans AlertDialog.
- **Impact :** L'employé clique, rien ne se passe (aucun message) ; un manager peut valider par erreur un produit d'un simple tap sans retour possible.
- **Recommandation :** Partie automatisable : masquer l'entrée pour les rôles non autorisés (même règle que DlcPage.tsx:990) et ajouter un onError avec toast en français. La confirmation (AlertDialog) ajoute une étape visible : c'est recommandé, mais à valider côté produit.

### DLC-14

**Compteurs incohérents avec les listes : « Actifs » inclut « Expire bientôt », le jour J compté deux fois, stocks épuisés comptés différemment** — bug, sévérité moyenne, effort M

- **Fichier :** `server/storage.ts:2238`
- **Constat :** getDlcStats : active = expiryDate > today (l.2238-2243, inclut donc 1-15 jours) ; expiringSoon = BETWEEN today AND today+15 (l.2244-2249) ; expired = <= today (l.2250-2255) → jour J dans les deux. Les compteurs excluent stockEpuise, mais les filtres liste 'expires'/'expires_soon' (l.2000-2028) ne l'excluent pas ; le filtre 'en_cours' = > 15 jours (l.2029-2039) ≠ carte « Produits Actifs ». DlcAlertModal affiche « Produits Expirés ({dlcStats.expired}) » (l.165) au-dessus d'une liste qui contient les stocks épuisés (l.196-200).
- **Impact :** La carte dit 12 « Actifs » mais le filtre « Actifs » en montre 5 ; la modale annonce 2 expirés et en liste 4 : l'utilisateur ne fait plus confiance aux chiffres.
- **Recommandation :** Définir une seule fonction SQL de classement en catégories exclusives (expiré / bientôt / ok / épuisé / traité / validé) réutilisée par getDlcStats et getDlcProducts (CASE commun ou helper drizzle), basée sur CURRENT_DATE.

### DLC-15

**Desktop : le magasin sélectionné est ignoré pour les non-admins et la clé de cache des stats entre en collision avec le Dashboard** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:83`
- **Constat :** l.83 et l.99 : `if (selectedStoreId && user?.role === 'admin') params.append("storeId", ...)`. Dashboard.tsx:232-236 utilise la même queryKey ["/api/dlc-products/stats", selectedStoreId] mais envoie storeId pour tous les rôles. Le serveur gère déjà le contrôle (routes.ts:2843-2849).
- **Impact :** Un directeur multi-magasins voit sur la page DLC les produits de tous ses magasins mélangés (sans colonne Magasin) alors qu'il en a sélectionné un ; les cartes peuvent afficher les chiffres d'un magasin (cache Dashboard) puis basculer sur le total après refetch.
- **Recommandation :** Toujours envoyer storeId quand il est défini ; extraire un hook partagé useDlcStats(selectedStoreId) utilisé par Dashboard et DlcPage pour garantir une seule URL par clé.

### DLC-16

**Le tableau disparaît à chaque changement de filtre ou de recherche (pas de placeholderData ni de squelette)** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:937`
- **Constat :** useQuery l.79-92 sans placeholderData ; chaque nouvelle clé (statut, fournisseur, recherche) remet isLoading à true → l.937-938 `<div className="flex justify-center items-center h-32">Chargement des produits...</div>` remplace tout le tableau. authLoading affiche aussi un simple texte (l.650-652).
- **Impact :** Clignotement et saut de mise en page à chaque frappe ; sensation de lenteur même quand la réponse est rapide.
- **Recommandation :** placeholderData: keepPreviousData + indicateur isFetching dans l'en-tête de la carte ; squelette seulement au premier chargement.

### DLC-17

**Aucune pagination serveur : l'historique complet (y compris tous les produits validés) est chargé par défaut** — perf-api, sévérité moyenne, effort M

- **Fichier :** `server/storage.ts:2063`
- **Constat :** getDlcProducts (storage.ts:1976-2086) n'a ni limit ni offset ; aucune purge des produits 'valides' (aucun autre fichier serveur ne touche dlc_products). Filtre par défaut desktop `useState("all")` (DlcPage.tsx:45) + pagination purement client usePagination (l.640-648). Mobile : toutes les cartes rendues sans pagination (mobile/DlcPage.tsx:312-347) et l'onglet « Validés » affiche tout l'historique.
- **Impact :** La page ralentit mois après mois (téléchargement + tri + rendu de centaines/milliers de produits déjà retirés), surtout sur mobile.
- **Recommandation :** Vue par défaut « À traiter » (exclure 'valides') ; pagination serveur (limit/offset + total) ou au minimum limiter les validés aux 30 derniers jours ; archivage/purge des validés > 90 jours.

### DLC-18

**Chaque requête DLC recharge l'utilisateur (2 requêtes) et chaque action relit le produit avec 2 jointures** — perf-serveur, sévérité moyenne, effort M

- **Fichier :** `server/routes.ts:2799`
- **Constat :** Toutes les routes DLC font `await storage.getUserWithGroups(req.user.id)` (ex. routes.ts:2799, 2833, 2919, 2979, 3025) alors que passport.deserializeUser a déjà exécuté getUserWithGroups (server/localAuth.ts:141-143) ; getUserWithGroups = getUser + SELECT user_groups (storage.ts:371-388). Les mutations font ensuite storage.getDlcProduct(id) (3 tables, logo inclus, storage.ts:2089-2098) juste pour lire groupId.
- **Impact :** 5 allers-retours BD par clic (2 auth + 2 rechargement user + 1 lecture) avant la mise à jour : latence cumulée sur chaque action de la liste.
- **Recommandation :** Partie automatisable : utiliser `const user = req.user as UserWithGroups` (même donnée, calculée dans la même requête) et une méthode légère getDlcProductGroupId(id) (SELECT group_id) pour les contrôles de droits. Le UPDATE ... WHERE group_id = ANY(...) RETURNING ne permet pas de distinguer 404 et 403 sans requête supplémentaire et change les signatures de storage : non automatique.

### DLC-19

**Chaque clic d'action recharge toute la liste + les stats et désactive le bouton sur toutes les lignes** — perf-client, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/DlcPage.tsx:255`
- **Constat :** 7 mutations (l.179-320) font toutes invalidateQueries ["/api/dlc-products"] et ["/api/dlc-products/stats"], sans mise à jour optimiste alors que le serveur renvoie la ligne modifiée. `disabled={markStockEpuiseMutation.isPending}` (l.1065), `disabled={markProcessedMutation.isPending}` (l.1013), etc. désactivent le bouton de toutes les lignes.
- **Impact :** Traiter 10 produits à la suite = 20 rechargements complets ; les boutons de toutes les lignes clignotent/grisent pendant chaque action.
- **Recommandation :** Partie sûre : désactiver uniquement la ligne concernée (`mutation.isPending && mutation.variables === product.id`). Garder l'invalidation de la liste (éventuellement refetchType 'active'). Une mise à jour optimiste n'est possible qu'en fusionnant les champs modifiés dans la ligne existante ET en conservant l'invalidation.

### DLC-20

**Invalidations au montage : la requête de stats DLC part deux fois à chaque visite du tableau de bord** — perf-api, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/components/DlcAlertModal.tsx:45`
- **Constat :** DlcAlertModal.tsx:45-47 `useEffect(() => { queryClient.invalidateQueries({ queryKey: ["/api/dlc-products"] }); }, [selectedStoreId, queryClient]);` (la modale est toujours montée, même fermée) et Dashboard.tsx:22-26 invalide aussi ["/api/dlc-products"] et ["/api/dlc-products/stats"] au montage. invalidateQueries (cancelRefetch par défaut) relance la requête déjà en cours ; le fetch n'utilise pas le signal, donc le serveur traite les deux.
- **Impact :** Requêtes doublées à chaque ouverture du tableau de bord et cache DLC de la page /dlc systématiquement marqué périmé.
- **Recommandation :** Supprimer les deux useEffect comme proposé (aucun appelant n'en dépend) ; justification à corriger : refetch inutile de l'ancienne clé au changement de magasin et staleTime ignoré, pas une double requête à chaque visite.

### DLC-21

**Messages d'erreur affichés en JSON anglais avec code HTTP** — ux-simplicite, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/lib/queryClient.ts:6`
- **Constat :** queryClient.ts:4-7 `throw new Error(`${res.status}: ${text}`)` avec text = corps brut ; DlcPage.tsx:193 `description: error.message`. Serveur : `res.status(500).json({ message: "Failed to create DLC product" })` (routes.ts:2913), « Insufficient permissions to validate DLC products » (routes.ts:2986), « Access denied to this group » (routes.ts:2905).
- **Impact :** L'employé voit « 403: {"message":"Insufficient permissions to validate DLC products"} » : incompréhensible pour un non-technicien.
- **Recommandation :** Ne pas modifier le format de error.message globalement. Soit créer une classe ApiError(status, message, body) et migrer d'abord toutes les détections de 401 vers error.status ; soit ajouter un helper getUserMessage(error), qui extrait `message` du JSON après le préfixe « NNN: », et l'utiliser dans les toasts DLC. Traduire en parallèle les messages des routes DLC.

### DLC-22

**Les erreurs serveur sont déguisées en « Aucun produit » ou en compteurs à 0** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:2827`
- **Constat :** routes.ts:2827 `res.status(500).json([])` et routes.ts:2857 `res.status(500).json({ active: 0, expiringSoon: 0, expired: 0 })`. Côté client, aucune gestion isError : DlcPage.tsx:79 `data: dlcProducts = []` puis l.939-942 « Aucun produit DLC trouvé ». Le fetch mobile (l.91-92) et DlcAlertModal (l.56-57) ne testent pas res.ok.
- **Impact :** En cas de panne BD, l'écran affiche 0 produit expiré : l'équipe pense que tout est en ordre.
- **Recommandation :** Renvoyer 500 avec { message } ; afficher un bandeau « Impossible de charger les produits – Réessayer » (isError + refetch) ; utiliser apiRequest partout.

### DLC-23

**Jusqu'à 5 boutons icônes colorés par ligne, deux coches quasi identiques et 4 notions qui se recouvrent** — ux-simplicite, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/DlcPage.tsx:982`
- **Constat :** Colonne Actions l.982-1113 : Edit (sans infobulle), Valider `<CheckCircle>` vert (l.1000), Marquer traité `<CheckCircle2>` bleu (l.1017), Annuler traitement `<X>` orange, Stock épuisé `<PackageX>` jaune, Restaurer `<RotateCcw>` bleu, Supprimer `<Trash2>` rouge (sans infobulle). Concepts : « Validé », « Traité », « Stock épuisé », « Supprimé ».
- **Impact :** Un employé ne sait pas quel bouton utiliser pour « j'ai retiré le produit du rayon » ; risque d'erreurs (valider au lieu de traiter, supprimer au lieu de valider).
- **Recommandation :** Même recommandation (une action principale libellée + menu « … ») ; corriger le décompte : 4 boutons au maximum.

### DLC-25

**Impression cachée dans des icônes de 24 px et liste imprimée différente du compteur affiché** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:887`
- **Constat :** Boutons l.887-894 et l.907-914 : `className="h-6 w-6 p-0"` avec `<FileText className="h-3 w-3">`, sans texte ni infobulle. printExpiringSoon/printExpired utilisent expiringSoonProducts/expiredProducts calculés depuis la liste filtrée courante (l.617-637), donc dépendent du filtre statut/fournisseur/recherche et incluent stocks épuisés et traités, alors que la carte affiche stats.expiringSoon/expired du serveur.
- **Impact :** Fonction d'impression introuvable pour la plupart des utilisateurs ; avec le filtre « Validés » ou une recherche active, l'impression des expirés sort une feuille vide ou partielle.
- **Recommandation :** Bouton visible « Imprimer » avec libellé dans chaque carte (ou un menu Imprimer), alimenté par une requête dédiée status=expires / expires_soon indépendante des filtres.

### DLC-27

**Hiérarchie visuelle inversée : filtres avant les compteurs, compteurs non cliquables** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:817`
- **Constat :** Ordre du rendu : en-tête (l.657), carte « Filtres » avec titre (l.818-868), puis les 3 cartes statistiques (l.871-922), puis le tableau (l.926). Les cartes n'ont pas d'onClick pour filtrer.
- **Impact :** L'information prioritaire (combien de produits expirés ?) est sous un bloc de formulaires ; il faut 2 actions (ouvrir le Select, choisir « Expirés ») au lieu d'un clic sur la carte rouge.
- **Recommandation :** Placer les cartes en premier, les rendre cliquables (setStatusFilter('expires') etc. avec état actif visible), et réduire les filtres à une barre compacte au-dessus du tableau (recherche + 2 selects, sans titre de carte).

### DLC-28

**Vocabulaire, couleurs et seuils d'urgence différents entre desktop, mobile et modale** — coherence-design, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:293`
- **Constat :** Desktop filtre « Actifs » / badge « Actif » / carte « Produits Actifs » (DlcPage.tsx:835, 495, 874) vs onglet mobile « OK » (mobile l.293) ; « Expire bientôt » vs « Bientôt » vs « Expirent Bientôt » (DlcAlertModal.tsx:219) ; « Validé » vs « Valider (Sortir) » vs toast « Produit validé (retiré) » (mobile l.125, 339) ; « Code EAN13 » (DlcPage.tsx:731) vs « Gencode (Scanner si dispo) » (mobile l.448) ; rouge ≤ 3 jours sur mobile (l.265) et « URGENT » dans la modale (l.244) mais aucun seuil 3 jours sur desktop ; bouton principal bleu desktop (l.670) vs orange mobile (l.478, 488).
- **Impact :** Un même utilisateur qui passe du téléphone au PC doit réapprendre les termes ; les couleurs ne signifient pas la même urgence.
- **Recommandation :** Créer un module partagé (ex. client/src/lib/dlcStatus.ts) avec libellés, couleurs de badge et seuils (expiré, ≤ 3 j urgent, ≤ 15 j bientôt), et un composant <DlcStatusBadge> utilisé par les 3 écrans.

### DLC-29

**Badge « J-3 » identique pour « expire dans 3 jours » et « expiré depuis 3 jours »** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:264`
- **Constat :** l.264 `<Badge variant="destructive">Expiré J{days}</Badge>` avec days négatif → « Expiré J-3 » ; l.265 `J-{days}` avec days = 3 → « J-3 » ; le jour J → « J-0 ».
- **Impact :** Lecture ambiguë en rayon : « J-3 » signifie habituellement « dans 3 jours » ; un produit expiré peut être lu comme encore bon.
- **Recommandation :** Libellés explicites : « Expiré depuis 3 j », « Expire aujourd'hui », « Encore 3 j ».

### DLC-30

**Mobile : l'onglet par défaut montre les produits les moins urgents et les onglets n'ont pas de compteur** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:77`
- **Constat :** `useState("en_cours")` (l.77) = produits à plus de 15 jours ; TabsTrigger « OK / Bientôt / Expirés / Validés » en text-xs sans nombre (l.292-297).
- **Impact :** En ouvrant l'écran, l'employé ne voit pas qu'il y a des produits expirés à retirer ; il doit tester chaque onglet.
- **Recommandation :** Ouvrir par défaut sur « Expirés » s'il y en a, sinon « Bientôt » ; afficher le nombre dans chaque onglet (calculé depuis la liste déjà chargée) avec pastille rouge/orange.

### DLC-31

**Mobile : actions manquantes par rapport au desktop (modifier, supprimer, stock épuisé, traité)** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:336`
- **Constat :** Le menu « … » ne contient qu'une entrée « Valider (Sortir) » (l.336-341) ; aucune mutation stock-epuise, mark-processed, PUT ou DELETE dans le fichier, alors que la page desktop les propose (DlcPage.tsx:255-320).
- **Impact :** En rayon avec le téléphone, l'employé ne peut ni corriger une date mal saisie, ni marquer un produit épuisé ou vérifié : il doit retourner au PC.
- **Recommandation :** Ajouter dans le menu les actions contextuelles réutilisant un hook commun (useDlcActions) partagé avec le desktop, et une feuille d'édition réutilisant le formulaire de création.

### DLC-32

**La modale incite à marquer un produit périmé « stock épuisé » pour faire disparaître l'alerte** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/components/DlcAlertModal.tsx:285`
- **Constat :** Pour les expirés, seul bouton « Stock épuisé » (l.182-193) ; aide l.285-286 : « Marquez les produits comme "stock épuisé" ... pour faire disparaître l'alerte ». La page DLC définit pourtant ce statut comme « Indique que ce produit n'est plus en stock (différent de périmé) » (DlcPage.tsx:1074). Aucune action pour les produits « Expirent bientôt » (l.224-248).
- **Impact :** Données faussées (produits périmés enregistrés comme ruptures) et traçabilité du retrait perdue ; l'utilisateur apprend un mauvais réflexe.
- **Recommandation :** Proposer l'action adaptée : « Retiré du rayon » (validate, si rôle autorisé) pour les expirés et « Vérifié » (mark-processed) pour les bientôt expirés ; réécrire l'aide en conséquence.

### DLC-36

**Recherche EAN : 2 allers-retours séquentiels vers une API externe, sans cache, sans délai max, code dupliqué** — perf-api, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/DlcPage.tsx:132`
- **Constat :** DlcPage.tsx:132 `fetch('/api/ffnancy/articles?ean=...')` puis l.143 `fetch('/api/ffnancy/mouvements/entrees?artNoId=...')` ; même bloc copié dans mobile/DlcPage.tsx:148-201. Proxys routes.ts:6396-6423 : `await fetch('https://api.ffnancy.fr/...')` sans AbortSignal.timeout ni cache. Aucun retour visuel si le code est inconnu (`if (!article) return;`).
- **Impact :** 1 à plusieurs secondes après le scan avant pré-remplissage ; spinner infini si l'API externe ne répond pas ; l'utilisateur ne sait pas si le code a été reconnu.
- **Recommandation :** Créer un endpoint serveur unique GET /api/ffnancy/ean-lookup?ean= qui enchaîne les 2 appels, matche le fournisseur en SQL et met en cache 24 h (server/cache.ts), avec timeout 5 s ; côté client un hook useEanLookup partagé basé sur useQuery ; afficher « Produit reconnu : … » ou « Code inconnu, saisissez le nom ».

### DLC-47

**La recherche desktop ne trouve pas un produit par son code EAN (le mobile oui)** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:2049`
- **Constat :** storage.ts:2049-2055 : la recherche porte uniquement sur `LOWER(product_name)` et `LOWER(suppliers.name)` ; pas de gencode. Le mobile cherche aussi dans `p.gencode.includes(lower)` (mobile/DlcPage.tsx:237). Placeholder desktop « Rechercher un produit... » (DlcPage.tsx:861).
- **Impact :** Un employé qui scanne ou tape le code-barres dans la recherche obtient « Aucun produit DLC trouvé » alors que le produit existe.
- **Recommandation :** Ajouter `gencode LIKE search || '%'` (et `name`) à la condition OR ; placeholder « Nom, code-barres ou fournisseur ».

### DLC-24

**Bouton « Exporter PDF » sans action** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:930`
- **Constat :** l.930-933 `<Button variant="outline" size="sm"><Download className="w-4 h-4 mr-2" />Exporter PDF</Button>` : aucun onClick.
- **Impact :** L'utilisateur clique, rien ne se passe : perte de confiance dans l'outil.
- **Recommandation :** Le brancher sur l'impression de la liste filtrée courante (« Imprimer la liste ») ou le retirer.

### DLC-33

**Le lien vers la page DLC recharge toute l'application** — perf-client, sévérité basse, effort S

- **Fichier :** `client/src/components/DlcAlertModal.tsx:142`
- **Constat :** l.141-143 `const handleViewDlcModule = () => { window.location.href = '/dlc'; };`
- **Impact :** Rechargement complet du bundle, de l'authentification et de toutes les requêtes (2 à 5 s perdues) au lieu d'une navigation instantanée.
- **Recommandation :** Utiliser la navigation wouter : `const [, setLocation] = useLocation(); setLocation('/dlc'); onClose();`.

### DLC-34

**Jargon, emojis et formulations maladroites dans la modale** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/components/DlcAlertModal.tsx:285`
- **Constat :** l.285 « 💡 Conseil : Ce modal réapparaîtra... » ; toasts « ✅ Produit marqué » / « ❌ Erreur » (l.80, 89) ; titre « Alerte Produits DLC - Action Requise » (l.151) ; le jour J « Expiré depuis {Math.abs(0)} jour(s) » → « Expiré depuis 0 jour(s) » (l.178) ; « et 3 autre(s) produit(s) expiré(s)... » (l.206).
- **Impact :** Lecture moins fluide ; « modal » et les « (s) » font technique ; « depuis 0 jour » est incohérent.
- **Recommandation :** « Cette fenêtre reviendra tant que... », supprimer les emojis (cohérence avec les autres toasts), gérer le singulier/pluriel et « Expire aujourd'hui ».

### DLC-35

**console.log de debug dans onSubmit et dans les routes de mutation** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:348`
- **Constat :** DlcPage.tsx:333-357 : `console.log("🏪 DLC GroupId Selection DEBUG:", { userGroupsRaw: user?.userGroups, availableStores: ... })`. Serveur : 2 console.log par action (routes.ts:3003-3013, 3044-3053, 3089-3098, 3129-3138, 3174-3183).
- **Impact :** Données utilisateur exposées dans la console du navigateur ; logs serveur bruités à chaque clic.
- **Recommandation :** Supprimer les logs client ; côté serveur, garder uniquement console.error ou un logger conditionné par NODE_ENV/niveau.

### DLC-37

**Fournisseurs DLC filtrés en JavaScript après lecture de toute la table** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/routes.ts:1150`
- **Constat :** routes.ts:1150-1154 `const suppliers = await storage.getSuppliers(); ... suppliers.filter(supplier => supplier.hasDlc === true)` ; getSuppliers = `db.select().from(suppliers)` (storage.ts:467-468).
- **Impact :** Requête et JSON plus lourds que nécessaire à chaque ouverture de la page DLC (faible tant que la table est petite).
- **Recommandation :** Ajouter une méthode dédiée getDlcSuppliers() (WHERE has_dlc = true, ORDER BY name, colonnes id/name/codefou) dans IStorage, DatabaseStorage et MemStorage (storage.ts:3685), plutôt que de changer la signature de getSuppliers, utilisée ailleurs (routes.ts:519, 619, 2043).

### DLC-38

**Les compteurs DLC sont renvoyés en chaînes (COUNT bigint), comparaison stricte morte dans la modale** — dette-code, sévérité basse, effort S

- **Fichier :** `server/storage.ts:2261`
- **Constat :** storage.ts:2238 `sql<number>`COUNT(CASE ...)`` ; drizzle node-postgres ne surcharge que DATE/TIMESTAMP/INTERVAL (session.js:24-37) donc INT8 reste une chaîne « 3 » ; `stats.active || 0` renvoie « 0 » (chaîne truthy). DlcAlertModal.tsx:133 `if (dlcStats.expired === 0 && dlcStats.expiringSoon === 0) return null;` n'est jamais vrai.
- **Impact :** Comparaisons fragiles (=== 0, additions qui concatènent « 2 »+« 3 » = « 23 ») au moindre calcul futur.
- **Recommandation :** Caster en SQL : `COUNT(...)::int` ou `sql<number>`...`.mapWith(Number)`.

### DLC-39

**Les stats DLC parcourent tout l'historique (validés inclus) et utilisent la date UTC** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:2229`
- **Constat :** storage.ts:2229-2232 `let whereCondition = sql`1 = 1``, seul filtre éventuel group_id ; les exclusions (status != 'valides', stockEpuise, processed) sont dans les CASE. Date calculée par `today.toISOString().split('T')[0]` (l.2239) = date UTC (entre 0 h et 2 h en France, « aujourd'hui » vaut la veille), alors que getDlcProducts utilise `today.setHours(0,0,0,0)` heure serveur (l.1996-1997).
- **Impact :** Coût croissant avec l'historique sur une requête appelée à chaque Dashboard ; décalage d'un jour la nuit entre compteurs et liste.
- **Recommandation :** Partie automatisable : déplacer `status <> 'valides' AND stock_epuise IS NOT TRUE` dans le WHERE. Pour processed_until_expiry, attendre DLC-01 : les expirés traités doivent être comptés. Pour le fuseau horaire : utiliser `(now() AT TIME ZONE 'Europe/Paris')::date` dans les deux requêtes, ou définir TZ=Europe/Paris. Index partiel via une migration dédiée (non automatique).

### DLC-40

**Index dlc_products absents de shared/schema.ts (risque de suppression par drizzle-kit push)** — dette-code, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `shared/schema.ts:278`
- **Constat :** dlcProducts = pgTable("dlc_products", {...}) (schema.ts:278-304) sans 3e argument d'index, alors que les index existent seulement en SQL : migrations/20260814_add_performance_indexes.sql:56-59 (group_id, supplier_id, expiry_date, (group_id, status)). package.json : "db:push": "drizzle-kit push" avec schema: "./shared/schema.ts".
- **Impact :** Un `npm run db:push` peut proposer de supprimer ces index et dégrader toutes les requêtes DLC ; aucun index composite (group_id, expiry_date) pour la requête principale.
- **Recommandation :** Déclarer dans schema.ts exactement les index existants, avec les mêmes noms (idx_dlc_products_group_id, idx_dlc_products_supplier_id, idx_dlc_products_expiry_date, idx_dlc_products_group_status), et traiter les 47 index de la migration en une seule passe. Ajouter un nouvel index composite seulement via une migration explicite.

### DLC-41

**Boutons icônes sans libellé accessible (Modifier, Supprimer, Imprimer, menu …, bouton +)** — accessibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:983`
- **Constat :** DlcPage.tsx:983-989 `<Button variant="outline" size="sm" onClick={() => handleEdit(product)}><Edit className="w-4 h-4" /></Button>` ; l.1105-1112 Trash2 ; l.887-894 et l.907-914 FileText ; mobile/DlcPage.tsx:332 MoreVertical et l.487-492 bouton flottant Plus : aucun aria-label ni title.
- **Impact :** Pas d'infobulle au survol pour Modifier/Supprimer/Imprimer ; lecteurs d'écran annoncent « bouton » sans nom.
- **Recommandation :** Ajouter aria-label + title (« Modifier », « Supprimer », « Imprimer les produits expirés », « Plus d'actions », « Ajouter un produit »).

### DLC-42

**Lignes grisées par opacité 50-60 % : texte et boutons peu lisibles** — accessibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:962`
- **Constat :** l.961-965 `product.status === "valides" ? "opacity-60 bg-gray-50" : product.processedUntilExpiry ? "opacity-60 bg-blue-50" : product.stockEpuise ? "opacity-50 bg-yellow-50" : ""` appliqué à toute la ligne, boutons d'action compris.
- **Impact :** Contraste insuffisant (texte gris à 50 %) pour lire nom et date ; boutons Restaurer/Annuler paraissent désactivés.
- **Recommandation :** Remplacer l'opacité par une couleur de texte atténuée (text-gray-500) sur les cellules d'information uniquement, et garder les boutons à pleine opacité.

### DLC-43

**Tableau DLC non défilable et sans colonne Magasin sur tablette / vue multi-magasins** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/components/ui/table.tsx:9`
- **Constat :** table.tsx:9 `<div className="relative w-full">` (pas d'overflow-x-auto) ; use-screen-size.ts:26-28 : 768-1024 px = « tablet » → layout desktop ; tableau DlcPage.tsx:945-956 avec 7 colonnes + jusqu'à 5 boutons. Aucune colonne Magasin alors que l'admin en « Tous les magasins » voit les produits de tous les magasins.
- **Impact :** Sur tablette, la colonne Actions déborde hors écran ; l'admin ne sait pas à quel magasin appartient un produit.
- **Recommandation :** Envelopper le tableau dans overflow-x-auto ; afficher l'EAN sous le nom (supprimer une colonne) ; ajouter une colonne Magasin (pastille couleur) quand aucun magasin n'est sélectionné.

### DLC-44

**Message de validation « Required » en anglais si aucun fournisseur choisi** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:33`
- **Constat :** l.33 `supplierId: z.number().min(1, "Le fournisseur est obligatoire")` sans required_error/invalid_type_error : quand le Select n'est pas renseigné la valeur est undefined et zod renvoie son message par défaut « Required ».
- **Impact :** Message anglais incompréhensible pour l'utilisateur final.
- **Recommandation :** `z.number({ required_error: "Choisissez un fournisseur", invalid_type_error: "Choisissez un fournisseur" }).min(1, ...)` ; faire de même pour dlcDate (`z.string({ required_error: "La date d'expiration est obligatoire" })`) ou ajouter dlcDate: "" aux defaultValues.

### DLC-45

**Code dupliqué : 7 mutations copiées-collées, 2 fonctions d'impression identiques, TooltipProvider par bouton, imports morts** — dette-code, sévérité basse, effort M

- **Fichier :** `client/src/pages/DlcPage.tsx:178`
- **Constat :** Mutations quasi identiques l.179-320 (seuls URL et texte changent) ; printExpiringSoon/printExpired l.499-615 ; un <TooltipProvider> par bouton et par ligne (l.1006, 1032, 1058, 1083) ; imports inutilisés AlertTriangle, Eye, Tabs/TabsContent/TabsList/TabsTrigger, AlertDialogTrigger (l.9-16). Fichier de 1156 lignes.
- **Impact :** Maintenance difficile (les corrections doivent être répétées 7 fois, d'où les incohérences) ; rendu un peu plus lourd.
- **Recommandation :** Partie automatisable : supprimer les imports morts, retirer les TooltipProvider locaux (le global d'App.tsx suffit), factoriser printList (avec l'échappement de DLC-26) et un hook useDlcAction. Le découpage en DlcFormDialog, DlcStatsCards et DlcTable est un refactor plus large, qui entre en conflit avec DLC-03, DLC-04, DLC-16 et DLC-19 : à faire après eux.

### DLC-46

**Pages DLC desktop et mobile importées statiquement dans le bundle principal** — perf-bundle, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/components/RouterProduction.tsx:21`
- **Constat :** RouterProduction.tsx:21 `import DlcPage from "@/pages/DlcPage";` et l.42 `import MobileDlcPage from "@/pages/mobile/DlcPage";` — aucun React.lazy ; un appareil n'utilise qu'une des deux versions.
- **Impact :** Code DLC (≈1 650 lignes + react-hook-form/zod) téléchargé au premier chargement même par les utilisateurs qui n'ouvrent jamais la page.
- **Recommandation :** Passer au chargement différé page par page pour tout le routeur, avec un Suspense commun et un ErrorBoundary qui recharge la page en cas d'erreur de chargement de chunk (ou vite:preloadError → location.reload()).

### DLC-48

**Recherche mobile plantée si un produit n'a pas de productName (colonne nullable)** — bug, sévérité basse, effort S

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:236`
- **Constat :** mobile/DlcPage.tsx:236 `p.productName.toLowerCase().includes(lower)` alors que shared/schema.ts:281 `productName: varchar("product_name")` est nullable (seul `name` est NOT NULL).
- **Impact :** Une seule ligne ancienne sans product_name fait planter la page mobile dès la première lettre tapée.
- **Recommandation :** `(p.productName ?? p.name ?? '').toLowerCase()` ; à terme fusionner name/productName en une seule colonne.

### DLC-49

**Mobile : date d'expiration pré-remplie à aujourd'hui** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/mobile/DlcPage.tsx:135`
- **Constat :** defaultValues `dlcDate: format(new Date(), 'yyyy-MM-dd')` (l.135) ; le desktop laisse le champ vide et le rend obligatoire (DlcPage.tsx:31).
- **Impact :** Si l'employé oublie de changer la date, le produit est créé comme expirant aujourd'hui : fausse alerte immédiate et données erronées.
- **Recommandation :** Laisser le champ vide (obligatoire) ou proposer des raccourcis explicites (+3 j, +7 j, +15 j).

### DLC-50

**Choix DLC / DDM / DLUO : DLUO est un terme obsolète qui ajoute de la confusion** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/DlcPage.tsx:777`
- **Constat :** Options l.777-779 « DLC (Date Limite de Consommation) », « DDM (Date de Durabilité Minimale) », « DLUO (Date Limite d'Utilisation Optimale) » ; badge du tableau en sigle seul `uppercase` (l.972-974). DLUO a été remplacée par DDM en 2014 (règlement INCO).
- **Impact :** L'employé hésite entre DDM et DLUO (même notion) ; le sigle seul dans le tableau n'est pas explicite.
- **Recommandation :** Ne proposer que « À consommer jusqu'au (DLC) » et « À consommer de préférence avant (DDM) » en création, garder l'affichage DLUO pour l'existant ; infobulle sur le badge.

### DLC-51

**Retour à la page 1 après chaque action qui retire une ligne de la vue filtrée** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/components/ui/pagination.tsx:157`
- **Constat :** pagination.tsx:156-159 `useEffect(() => { setCurrentPage(1); }, [data.length]);` ; sur DlcPage, « Marquer traité » en filtre « Expire bientôt » retire la ligne (filtre serveur storage.ts:2010-2013) → longueur change → page 1.
- **Impact :** En traitant une liste sur plusieurs pages, l'utilisateur est renvoyé en haut à chaque clic et perd sa position.
- **Recommandation :** Remettre la page à 1 seulement quand les filtres changent (passer une clé de filtres au hook) et sinon borner currentPage à totalPages.
