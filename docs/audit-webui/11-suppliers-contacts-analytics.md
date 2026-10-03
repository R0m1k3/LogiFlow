# Fournisseurs, Contacts, Statistiques

_56 constats vérifiés — 11 haute, 24 moyenne, 21 basse._

## Pages analysées

### `/suppliers`

**Rôle :** Référentiel des fournisseurs (nom, contact, téléphone, email, code ffnancy, mode de paiement, options DLC / rapprochement auto / contrôle) avec un compteur de commandes et livraisons par fournisseur. Menu visible uniquement pour l'admin.

**Tâches principales de l'utilisateur :**
- Rechercher un fournisseur par nom
- Consulter ses coordonnées et options
- Créer / modifier un fournisseur (admin)
- Supprimer un fournisseur (admin)
- Voir le volume de commandes/livraisons d'un fournisseur

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/suppliers | au montage (queryKey ['/api/suppliers'], queryFn par défaut, staleTime global 30 s) | server/routes.ts:1141 -> storage.getSuppliers() server/storage.ts:467 | Re-lit l'utilisateur en base (storage.getUser, routes.ts:1143) alors que deserializeUser l'a déjà chargé ; filtre ?dlc fait en JS (routes.ts:1151). Liste complète sans pagination (acceptable, table petite). |
| GET /api/stats/by-supplier | au montage, en parallèle | server/routes.ts:1504 -> storage.getOrderDeliveryStatsBySupplier() server/storage.ts:1842 | Agrégat SQL GROUP BY déjà optimisé (Promise.all) ; n'envoie pas storeId : ignore le magasin sélectionné dans l'en-tête ; totaux « depuis toujours ». |
| POST /api/suppliers | clic « Créer » dans la modale | server/routes.ts:1165 -> storage.createSupplier() server/storage.ts:471 | ~12 console.log dont JSON.stringify du body à chaque création (logs serveur non retirés en prod). Erreur Zod 400 non exploitée côté client. |
| PUT /api/suppliers/:id | clic « Modifier » (mise à jour optimiste) | server/routes.ts:1239 -> storage.updateSupplier() server/storage.ts:476 | Autorise admin+manager+directeur alors que l'UI réserve à l'admin ; ZodError renvoyée en 500. Double invalidation onSuccess+onSettled. |
| DELETE /api/suppliers/:id | clic corbeille + confirm() natif | server/routes.ts:1256 -> storage.deleteSupplier() server/storage.ts:485 | Échoue (FK orders/deliveries ON DELETE NO ACTION, init.sql:446-455) dès qu'il existe une commande : message générique « Impossible de supprimer ». |

**Lisibilité / simplicité :** Grille de cartes très « lourdes » (shadow-lg, icône, #id technique) peu adaptée à 100+ fournisseurs : pas de tri, pas de filtre par option (DLC, contrôle), recherche sur le nom seulement. Le code ffnancy est saisi mais jamais affiché, libellé jargon « Code fournisseur API (liaison ffnancy) ». Bon skeleton de chargement mais aucun état d'erreur (une panne affiche « Commencez par créer votre premier fournisseur »). Doublon fonctionnel avec la colonne Fournisseurs de la page Contacts (mêmes coordonnées, édition possible aux deux endroits avec des droits différents). Suppression impossible dès qu'il y a de l'historique, sans explication. Boutons icône sans libellé accessible. Page rendue sans MobileLayout sur mobile.

### `/contacts`

**Rôle :** Annuaire téléphonique : coordonnées des fournisseurs (globales) et contacts libres rattachés à un magasin (dépanneurs, commerciaux, etc.), avec liens tel:/mailto:.

**Tâches principales de l'utilisateur :**
- Trouver rapidement le téléphone/email d'un fournisseur
- Trouver un contact du magasin
- Ajouter / modifier / supprimer un contact (admin, directeur, manager)
- Mettre à jour les coordonnées d'un fournisseur (admin, directeur)

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/suppliers | au montage (même clé que les autres pages, cache partagé) | server/routes.ts:1141 -> storage.getSuppliers() server/storage.ts:467 | Liste globale complète affichée en premier ; aucun état de chargement. |
| GET /api/contacts?groupId=X (ou /api/contacts) | au montage et à chaque changement de magasin ; queryFn manuelle via apiRequest, sans enabled | server/routes.ts:1273 -> storage.getContacts(groupIds) server/storage.ts:490 | Pour un non-admin le paramètre groupId est ignoré (tous ses magasins) ; si l'utilisateur n'a aucun magasin, groupIds=[] et getContacts renvoie TOUS les contacts. Clé de cache '/api/contacts?groupId=X' non invalidée par les mutations. |
| POST /api/contacts | clic « Créer » | server/routes.ts:1293 -> storage.createContact() server/storage.ts:497 | Aucun contrôle que groupId appartient aux magasins de l'utilisateur. |
| PUT /api/contacts/:id | clic « Modifier » | server/routes.ts:1311 -> storage.updateContact() server/storage.ts:502 | Aucun contrôle d'appartenance du contact ; ZodError -> 500 ; le client écrase groupId par le magasin sélectionné. |
| DELETE /api/contacts/:id | clic corbeille + confirm() | server/routes.ts:1327 -> storage.deleteContact() server/storage.ts:511 | Aucun contrôle d'appartenance : un manager peut supprimer le contact d'un autre magasin par son id. |
| PUT /api/suppliers/:id | modale « Coordonnées — fournisseur » | server/routes.ts:1239 -> storage.updateSupplier() server/storage.ts:476 | Envoie {contact, phone, email} ; invalide ['/api/suppliers'] correctement. |
| GET /api/groups | via Layout/StoreContext (déjà en cache) | server/routes.ts:970 -> storage.getGroups() server/storage.ts:432 (admin) / userGroups (autres) | Pour l'admin renvoie toutes les colonnes de groups dont le logo en data URI base64 et la config SMTP. |

**Lisibilité / simplicité :** Deux colonnes (Fournisseurs / Autres contacts) claires sur desktop mais, sur mobile, la liste complète des fournisseurs passe avant les contacts du magasin (long défilement). Pas d'état de chargement (les états vides « Aucun contact » s'affichent pendant le chargement) ni d'erreur. Sélecteur de magasin admin propre à la page, en doublon du sélecteur global de l'en-tête. Le bouton « Nouveau contact » disparaît en vue « Tous les magasins » sans explication et le sélecteur « Magasin * » de la modale est ignoré. Les employés (pas de sélecteur dans l'en-tête, pas d'auto-sélection) restent bloqués sur « Sélectionnez un magasin ». Après création/modification/suppression, la liste ne se rafraîchit pas (clé de cache non invalidée). Notes saisies sur une ligne. Page très utile sur téléphone (liens tel:) mais absente du menu mobile et rendue sans MobileLayout.

### `/analytics`

**Rôle :** Tableau de bord statistiques (menu « Statistiques ») : KPI commandes/livraisons/taux de rapprochement/montant, courbe temporelle, camembert fournisseurs, barres par magasin, top 5 fournisseurs, exports CSV.

**Tâches principales de l'utilisateur :**
- Choisir une période (raccourcis ou dates)
- Filtrer par fournisseur / magasin
- Lire les KPI et graphiques
- Exporter les données en CSV

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/analytics/summary | au montage + à chaque changement de filtre (fetch manuel) ; polling 30 s si « Temps réel » | server/routes.ts:6218 -> storage.getAnalyticsSummary() server/storage.ts:3166 | 4 requêtes SQL séquentielles ; la 4e (topStores) fait groups LEFT JOIN orders LEFT JOIN deliveries sans filtre de date (produit cartésien) et son résultat n'est jamais affiché ; totalAmount additionne BL + facture (double comptage). |
| GET /api/analytics/timeseries | au montage + filtres + granularité | server/routes.ts:6250 -> storage.getAnalyticsTimeseries() server/storage.ts:3285 | 2 requêtes séquentielles en SQL brut concaténé (sql.raw) ; format semaine 'YYYY-IW' erroné ; pas de remplissage des trous. |
| GET /api/analytics/by-supplier | au montage + filtres | server/routes.ts:6281 -> storage.getAnalyticsBySupplier() server/storage.ts:3361 | Ignore le filtre fournisseur ; pas de LIMIT alors que le client n'affiche que 5 lignes ; doublonne summary.topSuppliers. |
| GET /api/analytics/by-store | au montage + filtres | server/routes.ts:6310 -> storage.getAnalyticsByStore() server/storage.ts:3400 | AUCUN filtrage par rôle ni par groupIds : tout utilisateur voit l'activité de tous les magasins ; erreurs avalées (return []). |
| GET /api/suppliers | au montage | server/routes.ts:1141 -> storage.getSuppliers() server/storage.ts:467 | Pour la liste déroulante fournisseurs. |
| GET /api/groups | au montage (cache partagé avec Layout) | server/routes.ts:970 -> storage.getGroups() server/storage.ts:432 | Seuls id/name sont utilisés ; l'admin reçoit logo base64 + config SMTP de chaque magasin. |
| GET /api/analytics/export?type=summary\|timeseries\|suppliers\|stores | clic sur un bouton d'export | server/routes.ts:6331 -> getAnalyticsSummary/Timeseries/BySupplier/ByStore | CSV non échappé, séparateur ',' sans BOM, en-têtes anglais ; échec silencieux côté client. |

**Lisibilité / simplicité :** Page la plus problématique du périmètre. Chaque changement de filtre remplace toute la page par un spinner plein écran (perte du contexte). Les filtres « Fournisseurs »/« Magasins » prétendent être multi-sélection mais ne le sont pas, n'agissent pas sur tous les graphiques, et ignorent le magasin choisi dans l'en-tête. Libellés jargon/anglicismes (« Tableau de bord Analytics » alors que le menu dit « Statistiques », « Granularité », « Taux de réconciliation », bouton « Temps réel/Actualisé »), montants non formatés à la française et sans HT/TTC, calendriers en anglais. Par défaut 365 points journaliers illisibles, axe X brut (« 2026-45 »), camembert dont l'infobulle affiche 0,1,2… au lieu du nom. KPI « Montant total » faux (BL + facture). Exports en double, CSV cassé dans Excel FR, échecs silencieux. États vides affichés pendant le chargement. recharts (410 Ko) chargé pour tous les utilisateurs au démarrage car la page n'est pas lazy.

### `(non routée) SalesAnalysisPage`

**Rôle :** Afficher dans une iframe un outil externe d'analyse des ventes dont l'URL est configurée dans les utilitaires.

**Tâches principales de l'utilisateur :**
- Consulter l'outil d'analyse des ventes
- Recharger l'iframe

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/utilities | au montage | server/routes.ts:333 -> storage.getUtilities() server/storage.ts:3015 | Réservé admin/directeur (403 sinon) ; la page interpréterait le 403 comme « URL non configurée ». |

**Lisibilité / simplicité :** Code mort : le composant n'est importé nulle part, aucune route ni entrée de menu « Analyse Vente » n'existe. S'il était branché : message trompeur pour manager/employé (403 affiché comme « URL non configurée » avec un bouton vers /utilities réservé admin), iframe en h-screen dans le Layout (double barre de défilement).

### `(non routée) SalesAnalysisConfig`

**Rôle :** Formulaire de saisie de l'URL de l'outil d'analyse des ventes.

**Tâches principales de l'utilisateur :**
- Saisir/enregistrer l'URL de l'outil d'analyse

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/utilities | au montage | server/routes.ts:333 -> storage.getUtilities() server/storage.ts:3015 | Même clé de cache que BackupManager. |
| POST /api/utilities | clic « Sauvegarder » | server/routes.ts:354 -> storage.updateUtilities()/createUtilities() | Aucune validation de format d'URL côté client ou serveur. |

**Lisibilité / simplicité :** Composant jamais importé (ni dans Utilities.tsx ni dans le routeur) : l'admin ne peut pas configurer l'URL depuis l'interface. Le texte renvoie à un menu « Analyse Vente » inexistant. Impossible d'effacer l'URL proprement (le champ n'est pas resynchronisé si config devient null).

### `/bl-reconciliation (partie « relances fournisseurs » uniquement : /api/supplier-mail-logs + shared/supplierMail.ts)`

**Rôle :** Afficher sur l'icône mail de chaque livraison la date de la dernière relance fournisseur envoyée, et construire le contenu du mail de relance (objet, texte, HTML).

**Tâches principales de l'utilisateur :**
- Voir si une livraison a déjà fait l'objet d'une relance
- Envoyer une relance fournisseur

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/supplier-mail-logs?storeId=X | au montage de BLReconciliation (enabled: !!user) | server/routes.ts:2439 -> storage.getSupplierMailLogs() server/storage.ts:2974 | SELECT * jusqu'à 500 lignes alors que le client ne garde que le dernier envoi 'sent' par livraison ; storeId ignoré pour un directeur. |
| POST /api/deliveries/:id/send-supplier-mail | clic sur l'icône mail | server/routes.ts:2330 -> emailService.sendSupplierDocumentRequest + storage.createSupplierMailLog() server/storage.ts:2969 | Invalide ['/api/supplier-mail-logs'] (préfixe correct). |

**Lisibilité / simplicité :** Fonctionnellement correct ; le contenu du mail est clair et en français. Points faibles : montant du BL au format « 1234.50 € » au lieu de « 1 234,50 € » dans un mail adressé aux fournisseurs, et indicateur de dernière relance pouvant disparaître pour les livraisons anciennes à cause de la limite de 500 lignes.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [ANA-01](#ana-01) | haute | perf-client | S | Spinner plein écran à chaque changement de filtre : toute la page disparaît | `client/src/pages/Analytics.tsx:140` |
| [ANA-02](#ana-02) | haute | perf-bundle | S | recharts (410 Ko) téléchargé au démarrage par tous les utilisateurs | `client/src/components/RouterProduction.tsx:28` |
| [ANA-03](#ana-03) | haute | perf-serveur | S | Requête topStores en produit cartésien, sans filtre de date, dont le résultat n'est jamais affiché | `server/storage.ts:3242` |
| [ANA-04](#ana-04) | haute | bug | S | KPI « Montant total » faux : BL et facture additionnés | `server/storage.ts:3218` |
| [ANA-05](#ana-05) | haute | bug | S | /api/analytics/by-store sans filtrage par rôle ni par magasin | `server/routes.ts:6310` |
| [ANA-06](#ana-06) | haute | bug | S | Contournement du filtrage par magasin quand la liste filtrée devient vide | `server/routes.ts:6235` |
| [API-01](#api-01) | haute | perf-serveur | M | L'utilisateur est relu en base 2 fois par requête (3 à 4 requêtes SQL d'authentification par appel) | `server/routes.ts:1143` |
| [CONT-01](#cont-01) | haute | bug | S | La liste des contacts ne se rafraîchit pas après création / modification / suppression | `client/src/pages/Contacts.tsx:72` |
| [CONT-02](#cont-02) | haute | bug | S | Un utilisateur sans magasin reçoit les contacts de TOUS les magasins | `server/storage.ts:490` |
| [CONT-03](#cont-03) | haute | bug | S | Création / modification / suppression de contacts sans contrôle du magasin | `server/routes.ts:1311` |
| [CONT-04](#cont-04) | haute | ux-simplicite | S | Les employés restent bloqués sur « Sélectionnez un magasin » sans aucun moyen de choisir | `client/src/components/Layout.tsx:131` |
| [ANA-07](#ana-07) | moyenne | perf-serveur | S | Requêtes SQL indépendantes exécutées en séquence | `server/storage.ts:3211` |
| [ANA-08](#ana-08) | moyenne | perf-api | M | 4 appels analytics séparés avec calculs en double | `client/src/pages/Analytics.tsx:56` |
| [ANA-09](#ana-09) | moyenne | bug | S | Décalage d'un jour sur les périodes (fuseau horaire) et cache jamais réutilisé | `client/src/pages/Analytics.tsx:47` |
| [ANA-10](#ana-10) | moyenne | bug | S | Format de semaine ISO erroné ('YYYY-IW' au lieu de 'IYYY-IW') | `server/storage.ts:3294` |
| [ANA-11](#ana-11) | moyenne | lisibilite | M | Courbe illisible par défaut : 365 points journaliers, dates brutes, trous non comblés | `client/src/pages/Analytics.tsx:31` |
| [ANA-12](#ana-12) | moyenne | bug | S | Camembert : l'infobulle affiche 0, 1, 2… au lieu du nom du fournisseur | `client/src/pages/Analytics.tsx:444` |
| [ANA-13](#ana-13) | moyenne | ux-simplicite | M | Filtres trompeurs : fausse multi-sélection et graphiques qui ignorent certains filtres | `client/src/pages/Analytics.tsx:265` |
| [ANA-14](#ana-14) | moyenne | coherence-design | S | Le magasin choisi dans l'en-tête est ignoré par les Statistiques | `client/src/pages/Analytics.tsx:21` |
| [ANA-15](#ana-15) | moyenne | lisibilite | S | Jargon, anglicismes et montants non formatés à la française | `client/src/pages/Analytics.tsx:159` |
| [ANA-17](#ana-17) | moyenne | ux-simplicite | M | Exports CSV : échec silencieux, boutons en double, fichier inexploitable dans Excel FR | `client/src/pages/Analytics.tsx:123` |
| [ANA-18](#ana-18) | moyenne | ux-simplicite | S | États vides affichés pendant le chargement, aucun état d'erreur | `client/src/pages/Analytics.tsx:407` |
| [API-02](#api-02) | moyenne | perf-api | S | Données de référence (fournisseurs, magasins) refetchées toutes les 30 s / à chaque page ; cache serveur inutilisé | `client/src/lib/queryClient.ts:77` |
| [API-03](#api-03) | moyenne | perf-api | S | /api/groups renvoie à l'admin le logo base64 et la configuration SMTP de chaque magasin | `server/storage.ts:432` |
| [CONT-05](#cont-05) | moyenne | bug | S | Le magasin du contact est écrasé silencieusement à l'enregistrement | `client/src/pages/Contacts.tsx:169` |
| [CONT-06](#cont-06) | moyenne | coherence-design | S | Second sélecteur de magasin propre à la page, en doublon du sélecteur global | `client/src/pages/Contacts.tsx:229` |
| [CONT-07](#cont-07) | moyenne | ux-simplicite | S | Aucun état de chargement ni d'erreur : « Aucun contact » s'affiche pendant le chargement | `client/src/pages/Contacts.tsx:68` |
| [CONT-08](#cont-08) | moyenne | ux-simplicite | M | La liste complète des fournisseurs passe avant les contacts du magasin (mobile) | `client/src/pages/Contacts.tsx:254` |
| [CONT-09](#cont-09) | moyenne | ux-simplicite | S | Contacts, Fournisseurs et Statistiques sur mobile : sans MobileLayout et absents du menu mobile | `client/src/components/RouterProduction.tsx:116` |
| [MAIL-01](#mail-01) | moyenne | perf-api | M | Historique des relances : 500 lignes complètes chargées pour n'utiliser que la dernière par livraison | `server/storage.ts:2974` |
| [SUPP-01](#supp-01) | moyenne | ux-simplicite | M | Fonctionnalité dupliquée avec la colonne Fournisseurs de la page Contacts | `client/src/pages/Suppliers.tsx:369` |
| [SUPP-02](#supp-02) | moyenne | coherence-design | M | Droits fournisseurs incohérents entre UI et serveur | `server/routes.ts:1239` |
| [SUPP-03](#supp-03) | moyenne | ux-simplicite | M | Suppression impossible dès qu'il y a un historique, avec un message générique | `client/src/pages/Suppliers.tsx:262` |
| [SUPP-04](#supp-04) | moyenne | ux-simplicite | S | Erreurs de validation non expliquées à l'utilisateur | `client/src/pages/Suppliers.tsx:93` |
| [SUPP-05](#supp-05) | moyenne | ux-simplicite | M | Grille de cartes lourde, recherche limitée au nom, ni tri ni filtres | `client/src/pages/Suppliers.tsx:276` |
| [ANA-16](#ana-16) | basse | lisibilite | S | Calendriers en anglais, popover qui ne se ferme pas, pas de contrôle début ≤ fin | `client/src/pages/Analytics.tsx:221` |
| [ANA-19](#ana-19) | basse | ux-simplicite | S | Bouton « Temps réel » confus et partiel | `client/src/pages/Analytics.tsx:71` |
| [ANA-20](#ana-20) | basse | dette-code | S | fetch() manuels, logs de debug et variables mortes | `client/src/pages/Analytics.tsx:58` |
| [ANA-21](#ana-21) | basse | dette-code | M | SQL brut concaténé et erreurs avalées dans timeseries / by-store | `server/storage.ts:3297` |
| [ANA-22](#ana-22) | basse | ux-simplicite | S | En-tête non responsive et rendu sans navigation sur mobile | `client/src/pages/Analytics.tsx:154` |
| [ANA-23](#ana-23) | basse | bug | S | Taux de rapprochement calculé sur toutes les livraisons, y compris planifiées | `server/storage.ts:3260` |
| [API-04](#api-04) | basse | dette-code | S | Logs serveur verbeux à chaque création de fournisseur | `server/routes.ts:1167` |
| [API-05](#api-05) | basse | bug | S | Erreurs de validation renvoyées en 500 sur PUT fournisseur / contact ; filtre DLC en JS | `server/routes.ts:1250` |
| [CONT-10](#cont-10) | basse | perf-client | S | Requête contacts non conditionnée et queryFn redondante | `client/src/pages/Contacts.tsx:76` |
| [CONT-11](#cont-11) | basse | ux-simplicite | S | Champ « Notes » sur une seule ligne | `client/src/pages/Contacts.tsx:536` |
| [MAIL-02](#mail-02) | basse | lisibilite | S | Montant du BL au format anglo-saxon dans le mail envoyé au fournisseur | `shared/supplierMail.ts:85` |
| [SALES-01](#sales-01) | basse | dette-code | S | Pages Analyse des ventes jamais branchées (code mort) et texte trompeur | `client/src/pages/SalesAnalysisConfig.tsx:75` |
| [SALES-02](#sales-02) | basse | ux-simplicite | S | Si branchée : 403 présenté comme « URL non configurée », iframe en h-screen, URL non validée | `client/src/pages/SalesAnalysisPage.tsx:39` |
| [SUPP-06](#supp-06) | basse | lisibilite | S | ID technique affiché, code ffnancy caché, libellés jargon | `client/src/pages/Suppliers.tsx:380` |
| [SUPP-07](#supp-07) | basse | ux-simplicite | S | Une erreur réseau s'affiche comme « Aucun fournisseur – créez votre premier fournisseur » | `client/src/pages/Suppliers.tsx:344` |
| [SUPP-08](#supp-08) | basse | perf-client | S | Recherche de stats en O(n×m) à chaque frappe, filtres non mémoïsés | `client/src/pages/Suppliers.tsx:280` |
| [SUPP-09](#supp-09) | basse | perf-api | S | Double invalidation après modification d'un fournisseur | `client/src/pages/Suppliers.tsx:156` |
| [SUPP-10](#supp-10) | basse | dette-code | S | Logs de debug et branche 401 morte dans les mutations | `client/src/pages/Suppliers.tsx:67` |
| [SUPP-11](#supp-11) | basse | coherence-design | S | Compteurs Commandes/Livraisons ambigus et indépendants du magasin sélectionné | `client/src/pages/Suppliers.tsx:61` |
| [SUPP-12](#supp-12) | basse | accessibilite | S | Boutons icône sans libellé ni infobulle, petits textes à faible contraste | `client/src/pages/Suppliers.tsx:385` |
| [SUPP-13](#supp-13) | basse | dette-code | S | Casts `as any` inutiles sur email/codefou | `client/src/pages/Suppliers.tsx:242` |

### ANA-01

**Spinner plein écran à chaque changement de filtre : toute la page disparaît** — perf-client, sévérité haute, effort S

- **Fichier :** `client/src/pages/Analytics.tsx:140`
- **Constat :** Analytics.tsx:57 `queryKey: ['/api/analytics/summary', queryParams]` sans placeholderData ; l.140-149 `if (summaryLoading) { return (<div className="flex items-center justify-center min-h-screen">...Chargement des statistiques...` — chaque nouvelle clé (nouvelle période, fournisseur, magasin) repasse isLoading à true.
- **Impact :** Au moindre clic sur « Ce mois » ou un fournisseur, filtres, KPI et graphiques sont remplacés par un spinner sur toute la hauteur : effet de clignotement, perte de repère, popovers fermés.
- **Recommandation :** Ajouter `placeholderData: keepPreviousData` à toutes les requêtes analytics, n'afficher le spinner plein écran qu'au premier chargement (`isLoading && !summary`) et utiliser `isFetching` pour une opacité réduite / skeleton par carte.

### ANA-02

**recharts (410 Ko) téléchargé au démarrage par tous les utilisateurs** — perf-bundle, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/components/RouterProduction.tsx:28`
- **Constat :** RouterProduction.tsx:28 `import Analytics from "@/pages/Analytics";` (import statique, aucun React.lazy dans le routeur) ; Analytics.tsx:14 est le seul import de recharts ; vite.config.ts manualChunks `"vendor-charts": ["recharts"]` ; dist/public/index.html contient `modulepreload ... /assets/vendor-charts-gtSIDI7m.js` (410 243 octets).
- **Impact :** Même un employé qui n'a pas accès aux Statistiques télécharge et parse ~410 Ko de JS au premier chargement (et l'index fait 1,08 Mo) : démarrage plus lent, surtout sur mobile.
- **Recommandation :** `const Analytics = lazy(() => import("@/pages/Analytics"))` + <Suspense> (desktop et mobile) ET corriger vite.config.ts : retirer l'entrée "vendor-charts" de manualChunks (ou ajouter "clsx"/"tailwind-merge" dans un chunk vendor chargé par l'entrée). Vérifier après `vite build` que dist/public/index.html ne contient plus de modulepreload vers le chunk recharts. Généraliser aux autres pages dans un second temps.

### ANA-03

**Requête topStores en produit cartésien, sans filtre de date, dont le résultat n'est jamais affiché** — perf-serveur, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:3242`
- **Constat :** storage.ts:3242-3258 `db.select({... COUNT(DISTINCT orders.id), COUNT(DISTINCT deliveries.id)}).from(groups).leftJoin(orders, eq(groups.id, orders.groupId)).leftJoin(deliveries, eq(groups.id, deliveries.groupId))` : pour chaque magasin, nb_commandes × nb_livraisons lignes, sans les conditions de date/fournisseur. `grep topStores client/src` : aucune utilisation ; avgDeliveryDelay (l.3220) non affiché non plus.
- **Impact :** C'est la requête la plus coûteuse de la page (millions de lignes intermédiaires dès quelques milliers de commandes par magasin), exécutée à chaque filtre et toutes les 30 s en mode « Temps réel », pour un résultat jeté.
- **Recommandation :** Supprimer topStores (seule requête coûteuse) de getAnalyticsSummary dans IStorage, DatabaseStorage et MemStorage, en acceptant/annonçant la disparition de cette colonne JSON de l'export Résumé (cf. ANA-17) ; ou, si l'export doit la garder, la calculer via des sous-requêtes agrégées filtrées comme getAnalyticsByStore. avgDeliveryDelay peut rester.

### ANA-04

**KPI « Montant total » faux : BL et facture additionnés** — bug, sévérité haute, effort S

- **Fichier :** `server/storage.ts:3218`
- **Constat :** storage.ts:3218 `totalAmount: sql`COALESCE(SUM(CAST(bl_amount AS NUMERIC)), 0) + COALESCE(SUM(CAST(invoice_amount AS NUMERIC)), 0)`` alors que le top fournisseurs (l.3230) n'utilise que `SUM(blAmount)`. Affiché tel quel Analytics.tsx:387.
- **Impact :** Pour une livraison rapprochée (BL ≈ facture), le montant est compté deux fois : le KPI est environ le double de la réalité et incohérent avec la somme du top fournisseurs. Décisions prises sur un chiffre faux.
- **Recommandation :** Définir le montant de référence (ex. COALESCE(invoice_amount, bl_amount) par ligne) et l'appliquer partout ; indiquer HT/TTC dans le libellé.

### ANA-05

**/api/analytics/by-store sans filtrage par rôle ni par magasin** — bug, sévérité haute, effort S

- **Fichier :** `server/routes.ts:6310`
- **Constat :** routes.ts:6317-6323 `const filters = { startDate, endDate, supplierIds }; const byStore = await storage.getAnalyticsByStore(filters);` — aucun bloc « Apply role-based filtering », groupIds non lu ; storage.ts:3400-3455 interroge `FROM groups g` sans WHERE sur g.id.
- **Impact :** Un manager voit le nom et l'activité de tous les magasins de l'enseigne ; le filtre « Magasins » de la page n'a aucun effet sur le graphique « Performance par magasin ».
- **Recommandation :** Appliquer le même filtrage par rôle que les autres routes, ajouter `groupIds` à getAnalyticsByStore (`WHERE g.id = ANY(...)`).

### ANA-06

**Contournement du filtrage par magasin quand la liste filtrée devient vide** — bug, sévérité haute, effort S

- **Fichier :** `server/routes.ts:6235`
- **Constat :** routes.ts:6235-6240 `filters.groupIds = filters.groupIds ? filters.groupIds.filter((id) => userGroupIds.includes(id)) : userGroupIds;` puis storage.ts:3200 `if (filters.groupIds?.length) { ...inArray(...) }`. Si l'utilisateur passe `groupIds=999` (magasin qui n'est pas le sien) ou n'a aucun magasin, le tableau devient [] et AUCUN filtre n'est appliqué. Même motif l.6266 (timeseries), l.6295 (by-supplier), et dans /export. Le directeur est en outre exempté de tout filtrage (l.6235) alors que /api/groups le limite à ses magasins (l.976-985).
- **Impact :** Fuite de données : un manager obtient les statistiques de toute l'enseigne avec un simple paramètre d'URL ; incohérence de périmètre pour les directeurs.
- **Recommandation :** Si la liste filtrée est vide pour un non-admin, renvoyer immédiatement un résultat vide (ou 403) ; factoriser via `resolveStatsGroupIds` (routes.ts:1469) déjà utilisé par /api/stats/* ; décider explicitement du périmètre du directeur.

### API-01

**L'utilisateur est relu en base 2 fois par requête (3 à 4 requêtes SQL d'authentification par appel)** — perf-serveur, sévérité haute, effort M

- **Fichier :** `server/routes.ts:1143`
- **Constat :** localAuth.ts:141-143 `passport.deserializeUser(async (id) => { const user = await storage.getUserWithGroups(id); ...})` charge déjà l'utilisateur + groupes à chaque requête ; puis chaque handler recommence : routes.ts:1143 `storage.getUser(...)`, 1275, 1506, 6220, 6252, 6283, 6312 `storage.getUserWithGroups(...)`. storage.ts:371-373 getUserWithGroups fait 2 requêtes séquentielles (`await this.getUser(id)` puis le SELECT user_groups JOIN groups).
- **Impact :** La page Statistiques déclenche 6 appels -> ~22 requêtes SQL rien que pour l'authentification avant tout calcul métier ; latence ajoutée sur chaque appel API de l'application.
- **Recommandation :** Remplacer, en tête de handler uniquement, `await storage.getUser(...)` / `await storage.getUserWithGroups(...)` par `req.user` (garder les relectures faites APRÈS une mise à jour de l'utilisateur) ; fusionner getUserWithGroups en une seule requête LEFT JOIN. Ne PAS ajouter de cache mémoire par userId.

### CONT-01

**La liste des contacts ne se rafraîchit pas après création / modification / suppression** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/Contacts.tsx:72`
- **Constat :** Contacts.tsx:72-74 `const contactsQueryKey = effectiveGroupId ? [`/api/contacts?groupId=${effectiveGroupId}`] : ["/api/contacts"];` alors que les mutations font (l.90, 102, 114) `queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });`. TanStack compare élément par élément : '/api/contacts?groupId=3' !== '/api/contacts', donc la requête n'est jamais invalidée dès qu'un magasin est sélectionné (cas de tous les non-admins).
- **Impact :** L'utilisateur crée un contact, voit le toast « Contact créé avec succès » mais le contact n'apparaît pas ; il recrée souvent un doublon ou pense que l'enregistrement a échoué. Idem pour une suppression : la carte reste affichée.
- **Recommandation :** Utiliser une clé structurée `['/api/contacts', { groupId: effectiveGroupId }]` (queryFn construisant l'URL) et garder `invalidateQueries({ queryKey: ['/api/contacts'] })`, qui matchera alors par préfixe. Idéalement mettre aussi à jour le cache via setQueryData dans onSuccess.

### CONT-02

**Un utilisateur sans magasin reçoit les contacts de TOUS les magasins** — bug, sévérité haute, effort S

- **Fichier :** `server/storage.ts:490`
- **Constat :** routes.ts:1279-1281 `if (user.role !== 'admin') { groupIds = (user.userGroups || []).map((ug: any) => ug.groupId); }` puis storage.ts:490-494 `if (groupIds && groupIds.length > 0) { ...where(inArray(contacts.groupId, groupIds)) } return await db.select().from(contacts).orderBy(contacts.name);` — un tableau vide fait tomber dans la branche « tout renvoyer ».
- **Impact :** Fuite de données : un employé/manager non encore rattaché à un magasin voit l'annuaire complet de toute l'enseigne.
- **Recommandation :** Dans la route, `if (user.role !== 'admin' && groupIds.length === 0) return res.json([])` ; dans les DEUX implémentations de getContacts (DatabaseStorage l.490 et MemStorage l.3719), traiter `groupIds !== undefined && groupIds.length === 0` comme « aucun contact ».

### CONT-03

**Création / modification / suppression de contacts sans contrôle du magasin** — bug, sévérité haute, effort S

- **Fichier :** `server/routes.ts:1311`
- **Constat :** routes.ts:1293-1338 : POST, PUT et DELETE vérifient seulement le rôle `['admin', 'directeur', 'manager'].includes(user.role)` puis appellent `storage.createContact(data)` / `updateContact(id, data)` / `deleteContact(id)` sans vérifier que `data.groupId` ou le contact ciblé appartient aux magasins de l'utilisateur.
- **Impact :** Un manager du magasin A peut créer, modifier ou supprimer les contacts du magasin B (simple appel avec un id). Risque de perte de données entre magasins.
- **Recommandation :** Charger le contact (getContact(id)) et vérifier `userGroupIds.includes(contact.groupId)` pour PUT/DELETE ; vérifier `data.groupId` pour POST et PUT (sauf admin). Renvoyer 403 sinon.

### CONT-04

**Les employés restent bloqués sur « Sélectionnez un magasin » sans aucun moyen de choisir** — ux-simplicite, sévérité haute, effort S

- **Fichier :** `client/src/components/Layout.tsx:131`
- **Constat :** Layout.tsx:131 le sélecteur n'existe que pour `user.role === 'admin' || 'directeur' || 'manager'` ; Layout.tsx:70 l'auto-sélection ne concerne que `directeur`/`manager`. Contacts.tsx:41 `effectiveGroupId = isAdmin ? adminGroupId : selectedStoreId` et l.355-359 affichent « Sélectionnez un magasin pour voir les contacts ». Or Sidebar.tsx:323-326 donne l'accès Contacts au rôle `employee`.
- **Impact :** Sur desktop, un employé dont le magasin n'est pas déjà mémorisé dans localStorage ne voit jamais les contacts de son magasin, alors que la page lui est proposée dans le menu.
- **Recommandation :** Auto-sélectionner le magasin pour tout rôle n'ayant qu'un magasin (y compris employee) dans Layout.tsx et MobileApp.tsx ; à défaut, afficher directement les contacts de tous les magasins de l'utilisateur (ce que renvoie déjà le serveur) au lieu du message bloquant.

### ANA-07

**Requêtes SQL indépendantes exécutées en séquence** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:3211`
- **Constat :** getAnalyticsSummary : storage.ts:3213 `await orderQuery`, 3223 `await deliveryQuery`, 3236 `await supplierQuery`, 3255 `await storeQuery` ; getAnalyticsTimeseries : 3333 `await db.execute(sql.raw(ordersSql))` puis 3344 `await db.execute(sql.raw(deliveriesSql))`.
- **Impact :** Le temps de réponse est la somme des requêtes au lieu du maximum.
- **Recommandation :** `const [[orderCount], [deliveryStats], topSuppliers] = await Promise.all([...])` ; idem pour les deux requêtes de timeseries (pattern déjà utilisé dans getOrderDeliveryStatsBySupplier l.1861).

### ANA-08

**4 appels analytics séparés avec calculs en double** — perf-api, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Analytics.tsx:56`
- **Constat :** Analytics.tsx:56-112 : summary, timeseries, by-supplier, by-store, chacun avec fetch manuel ; summary.topSuppliers (storage.ts:3226-3239) et by-supplier (storage.ts:3361-3397) exécutent la même agrégation deliveries JOIN suppliers ; by-supplier n'a pas de LIMIT alors que le client fait `bySupplier.slice(0, 5)` (l.445).
- **Impact :** 4 allers-retours + 4 ré-authentifications (API-01) et une agrégation calculée deux fois à chaque filtre.
- **Recommandation :** Créer un endpoint unique GET /api/analytics/overview qui exécute les agrégats en Promise.all et renvoie {kpis, timeseries, bySupplier(top 5), byStore} ; supprimer topSuppliers du summary ou by-supplier.

### ANA-09

**Décalage d'un jour sur les périodes (fuseau horaire) et cache jamais réutilisé** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Analytics.tsx:47`
- **Constat :** Analytics.tsx:38 `startOfMonth(new Date())` (minuit heure locale) puis l.47 `params.append('startDate', dateRange.from.toISOString())` ; serveur storage.ts:3188 `filters.startDate.toISOString().split('T')[0]`. À Paris (UTC+2), le 01/10 00:00 devient '2026-09-30'. « Aujourd'hui » entre 0 h et 2 h interroge la veille. Les raccourcis utilisent `new Date()` avec millisecondes : la clé de cache change à chaque clic.
- **Impact :** « Ce mois » inclut le dernier jour du mois précédent, « Cette semaine » le dimanche précédent ; chiffres légèrement faux et refetch systématique même en recliquant sur la même période.
- **Recommandation :** Envoyer des dates calendaires `format(date, 'yyyy-MM-dd')` (clé de cache stable) et les utiliser telles quelles côté serveur (sans toISOString).

### ANA-10

**Format de semaine ISO erroné ('YYYY-IW' au lieu de 'IYYY-IW')** — bug, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:3294`
- **Constat :** storage.ts:3293-3294 `const dateFormat = granularity === 'day' ? 'YYYY-MM-DD' : granularity === 'week' ? 'YYYY-IW' : 'YYYY-MM';` — en PostgreSQL TO_CHAR('2024-12-30','YYYY-IW') donne '2024-01'.
- **Impact :** Les jours de fin décembre sont agrégés dans la « semaine 01 » de la mauvaise année et fusionnés avec début janvier : pic faux sur la courbe.
- **Recommandation :** Utiliser 'IYYY-IW' (et un libellé lisible « Sem. 45 – 2026 » côté client).

### ANA-11

**Courbe illisible par défaut : 365 points journaliers, dates brutes, trous non comblés** — lisibilite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Analytics.tsx:31`
- **Constat :** Analytics.tsx:25 période par défaut `addDays(new Date(), -365)` et l.31 `granularity` = 'day' ; l.411 `<XAxis dataKey="date" />` affiche '2026-03-14' ou '2026-45' ; storage.ts:3347-3357 ne renvoie que les dates ayant des données (pas de zéros), la ligne relie des jours non consécutifs.
- **Impact :** Graphique en « peigne » impossible à lire, axe X technique, tendances trompeuses.
- **Recommandation :** Granularité automatique selon la durée (≤31 j : jour, ≤6 mois : semaine, sinon mois), tickFormatter en français (« 14 mars », « sept. 2026 »), remplissage des périodes vides à 0 (generate_series côté SQL).

### ANA-12

**Camembert : l'infobulle affiche 0, 1, 2… au lieu du nom du fournisseur** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Analytics.tsx:444`
- **Constat :** Analytics.tsx:444-453 `<Pie data={bySupplier.slice(0, 5)} ... label={(entry) => entry.supplierName} outerRadius={80} dataKey="deliveries">` sans `nameKey` ; recharts 2.15.4 Pie.js:520 `var name = getValueByDataKey(entry, nameKey, i)` avec nameKey par défaut 'name' -> l'index. Les labels de noms longs débordent d'une carte de 300 px.
- **Impact :** Au survol l'utilisateur lit « 0 : 34 » : impossible de savoir de quel fournisseur il s'agit ; labels qui se chevauchent.
- **Recommandation :** Auto-implémenter uniquement `nameKey="supplierName"` sur le <Pie> ; la légende, le retrait des labels et le diagramme en barres relèvent de la refonte visuelle.

### ANA-13

**Filtres trompeurs : fausse multi-sélection et graphiques qui ignorent certains filtres** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Analytics.tsx:265`
- **Constat :** Analytics.tsx:266-277 le Select est mono-valeur ; cliquer un autre fournisseur fait `setSelectedSuppliers([supplierId])` (remplacement), la valeur "multiple" n'a aucun SelectItem. l.30 `selectedStatus` n'est jamais modifié. routes.ts:6288-6292 by-supplier ne lit pas supplierIds ; routes.ts:6317-6321 by-store ne lit pas groupIds.
- **Impact :** Le « ✓ » laisse croire à une sélection multiple qui n'existe pas ; en filtrant sur un fournisseur, le camembert continue d'afficher les 5 fournisseurs, en filtrant sur un magasin, le graphique magasins reste inchangé : résultats contradictoires à l'écran.
- **Recommandation :** Soit un vrai multi-select (Popover + Checkbox), soit un Select simple sans « ✓ » ; appliquer tous les filtres à tous les endpoints (ou masquer/griser le graphique non concerné) ; supprimer selectedStatus.

### ANA-14

**Le magasin choisi dans l'en-tête est ignoré par les Statistiques** — coherence-design, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Analytics.tsx:21`
- **Constat :** Analytics.tsx:21 `const { selectedStoreId } = useStore();` n'est jamais utilisé ; l.29 `selectedStores` démarre vide et l.296-327 propose un troisième sélecteur « Magasins ».
- **Impact :** Un manager qui travaille sur « Magasin A » (en-tête) voit des statistiques multi-magasins sans s'en rendre compte.
- **Recommandation :** Initialiser/synchroniser le filtre magasin avec selectedStoreId (ou supprimer le filtre local et utiliser uniquement le sélecteur global, comme les autres pages).

### ANA-15

**Jargon, anglicismes et montants non formatés à la française** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Analytics.tsx:159`
- **Constat :** Analytics.tsx:159 « Tableau de bord Analytics » alors que le menu dit « Statistiques » (Sidebar.tsx:283) ; l.250 « Granularité » ; l.365 « Taux de réconciliation » (le reste de l'app dit « Rapprochement ») ; l.171 bouton « Temps réel » qui devient « Actualisé » ; l.387 `${summary.totalAmount.toFixed(2)}€` et l.534 `{supplier.amount.toFixed(2)}€` -> « 123456.70€ » ; aucune mention HT/TTC.
- **Impact :** Termes techniques ou anglais, chiffres difficiles à lire pour un employé/manager ; incohérence de vocabulaire entre menu et page.
- **Recommandation :** Titre « Statistiques », « Regrouper par : jour/semaine/mois », « Livraisons rapprochées (%) » ; formater avec `new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })` et préciser HT ; ajouter une courte aide (icône i) sous chaque KPI.

### ANA-17

**Exports CSV : échec silencieux, boutons en double, fichier inexploitable dans Excel FR** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Analytics.tsx:123`
- **Constat :** Analytics.tsx:123-138 `if (response.ok) {...}` sans else ni toast ; l.173-180 « Export CSV » et l.566 « Export Résumé » appellent tous deux handleExport('summary'). routes.ts:6375-6381 `Object.keys(data[0]).join(',')` / `Object.values(item).map(val => typeof val === 'object' ? JSON.stringify(val) : val).join(',')` : pas d'échappement, séparateur ',' sans BOM UTF-8, en-têtes anglais (totalOrders...), tableau topSuppliers en JSON dans une cellule ; l'export « timeseries » force `granularity: 'day'` (l.6366) quelle que soit l'option choisie.
- **Impact :** Clic sans effet si pas de données (404), accents cassés et colonnes décalées à l'ouverture dans Excel français (séparateur ';'), noms de fournisseurs contenant une virgule qui cassent le fichier.
- **Recommandation :** Un seul menu « Exporter ▾ » ; côté serveur, CSV avec ';', BOM '﻿', guillemets échappés et en-têtes français (ou XLSX) ; respecter la granularité ; toast d'erreur/« aucune donnée » côté client.

### ANA-18

**États vides affichés pendant le chargement, aucun état d'erreur** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Analytics.tsx:407`
- **Constat :** Analytics.tsx:74-112 timeseries/bySupplier/byStore sans isLoading ni isError ; l.407-427 `Array.isArray(timeseries) && timeseries.length > 0 ? ... : « Aucune donnée temporelle – Vérifiez la période sélectionnée »` (idem l.441-469, 483-509). Une erreur summary laisse les KPI à 0 (l.342 `summary?.totalOrders || 0`).
- **Impact :** L'utilisateur lit « Aucune donnée » et change de période alors que les données arrivent ; une panne est présentée comme « 0 commande ».
- **Recommandation :** Skeleton dans chaque carte pendant le chargement, message d'erreur explicite avec « Réessayer », et n'afficher l'état vide qu'une fois la requête réussie.

### API-02

**Données de référence (fournisseurs, magasins) refetchées toutes les 30 s / à chaque page ; cache serveur inutilisé** — perf-api, sévérité moyenne, effort S

- **Fichier :** `client/src/lib/queryClient.ts:77`
- **Constat :** queryClient.ts:77 `staleTime: 30 * 1000` global avec `refetchOnMount: true` ; ['/api/suppliers'] est utilisé par ~14 composants (Avoirs, SavTickets, BLReconciliation, modales commande/livraison...). server/cache.ts:53 `export function cacheMiddleware(...)` n'est importé nulle part (grep vide dans server/).
- **Impact :** Chaque navigation après 30 s relance /api/suppliers et /api/groups (avec ré-authentification, cf. API-01) pour des données qui changent quelques fois par mois.
- **Recommandation :** Définir `staleTime: 10 * 60 * 1000` sur les clés ['/api/suppliers'] et ['/api/groups'] (via queryClient.setQueryDefaults), les mutations invalidant déjà ces clés ; côté serveur, mettre en cache mémoire getSuppliers() (invalidé sur POST/PUT/DELETE) ou supprimer server/cache.ts s'il n'est pas utilisé.

### API-03

**/api/groups renvoie à l'admin le logo base64 et la configuration SMTP de chaque magasin** — perf-api, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:432`
- **Constat :** storage.ts:432-434 `return await db.select().from(groups).orderBy(groups.name);` (toutes colonnes) ; schema.ts:67 `logo: text("logo"), // Logo en data URI (data:image/png;base64,...)` + colonnes smtp*. routes.ts:979-981 renvoie ce résultat tel quel à l'admin ; Analytics.tsx:118-120 et Layout.tsx:47-50 n'utilisent que id/name/color.
- **Impact :** Pour l'admin, chaque chargement de l'application télécharge les logos de tous les magasins (souvent plusieurs dizaines de Ko chacun) ; forme de réponse différente entre admin et non-admin.
- **Recommandation :** Projeter les colonnes nécessaires à la liste (id, name, color) et exposer le détail (logo, SMTP) via GET /api/groups/:id uniquement sur la page Magasins.

### CONT-05

**Le magasin du contact est écrasé silencieusement à l'enregistrement** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Contacts.tsx:169`
- **Constat :** Contacts.tsx:169 `const payload = { ...formData, groupId: effectiveGroupId ?? formData.groupId };`. Côté serveur routes.ts:1278-1281 le paramètre groupId est ignoré pour un non-admin, qui reçoit les contacts de tous ses magasins. Pour l'admin, le sélecteur « Magasin * » de la modale (l.461-481) n'est jamais pris en compte puisque le bouton « Nouveau contact » n'est visible que si effectiveGroupId est défini (l.220).
- **Impact :** Un manager multi-magasins voit un contact du magasin B en ayant sélectionné A ; s'il le modifie (même juste le téléphone), le contact est déplacé vers A. Pour l'admin, le choix « Magasin » de la modale est un faux choix.
- **Recommandation :** En édition, conserver `selectedContact.groupId` (ne pas l'écraser). Côté serveur, honorer `groupId` pour les non-admins s'il appartient à leurs magasins. Supprimer le sélecteur de magasin de la modale ou l'utiliser réellement (et autoriser la création en vue « Tous les magasins »).

### CONT-06

**Second sélecteur de magasin propre à la page, en doublon du sélecteur global** — coherence-design, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Contacts.tsx:229`
- **Constat :** Contacts.tsx:40-41 `const [adminGroupId, setAdminGroupId] = useState<number | null>(null); const effectiveGroupId = isAdmin ? adminGroupId : selectedStoreId;` et l.229-251 un bloc bleu « Magasin affiché (admin) ». Le sélecteur global de l'en-tête (Layout.tsx:131-155) est ignoré pour l'admin sur cette page.
- **Impact :** L'admin choisit « Magasin A » dans l'en-tête mais la page Contacts affiche « Tous les magasins » : deux sélecteurs contradictoires, source de confusion.
- **Recommandation :** Supprimer adminGroupId et utiliser `selectedStoreId` du StoreContext pour tous les rôles (null = tous les magasins pour l'admin).

### CONT-07

**Aucun état de chargement ni d'erreur : « Aucun contact » s'affiche pendant le chargement** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Contacts.tsx:68`
- **Constat :** Contacts.tsx:68-84 `const { data: suppliers = [] } = useQuery(...)` / `const { data: contacts = [] } = useQuery(...)` sans lecture de isLoading/isError ; l.275-279 « Aucun fournisseur trouvé » et l.364-367 « Aucun contact » s'affichent tant que les données ne sont pas arrivées ou en cas d'erreur.
- **Impact :** L'utilisateur croit que l'annuaire est vide (ou que ses contacts ont disparu) pendant le chargement ou lors d'une panne réseau.
- **Recommandation :** Afficher des skeletons de cartes pendant isLoading (comme Suppliers.tsx:292-305) et un encart d'erreur avec bouton « Réessayer » sur isError.

### CONT-08

**La liste complète des fournisseurs passe avant les contacts du magasin (mobile)** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Contacts.tsx:254`
- **Constat :** Contacts.tsx:254 `grid grid-cols-1 lg:grid-cols-2` : sous 1024 px la colonne Fournisseurs (tous les fournisseurs de l'enseigne, l.281 `filteredSuppliers.map(...)`, sans pagination) est rendue entièrement avant « Autres contacts ».
- **Impact :** Sur téléphone/tablette il faut faire défiler des dizaines de cartes fournisseurs pour atteindre le contact du dépanneur du magasin.
- **Recommandation :** Remplacer les deux colonnes par des onglets « Fournisseurs » / « Contacts du magasin » (ou une seule recherche unifiée), afficher une liste compacte (nom + boutons Appeler / Email) et limiter l'affichage initial.

### CONT-09

**Contacts, Fournisseurs et Statistiques sur mobile : sans MobileLayout et absents du menu mobile** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/components/RouterProduction.tsx:116`
- **Constat :** RouterProduction.tsx:116-128 `{/* Pages sans version mobile - utiliser version desktop pour l'instant */} <Route path="/contacts" component={Contacts} />` (idem /suppliers, /analytics) rendus directement dans MobileApp, alors que les pages mobiles s'enveloppent dans MobileLayout (DashboardPage.tsx:136). MobileBottomNav.tsx:30-42 ne liste ni /contacts ni /analytics.
- **Impact :** La page la plus utile sur téléphone (liens tel: et mailto:) est inaccessible depuis le menu mobile ; si on y arrive par URL, il n'y a ni en-tête ni navigation pour revenir.
- **Recommandation :** Envelopper ces pages dans MobileLayout sur mobile et ajouter « Contacts » au menu « Plus » de MobileBottomNav.

### MAIL-01

**Historique des relances : 500 lignes complètes chargées pour n'utiliser que la dernière par livraison** — perf-api, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:2974`
- **Constat :** storage.ts:2984-2990 `db.select().from(supplierMailLogs)...orderBy(desc(supplierMailLogs.createdAt)).limit(500)` (toutes colonnes : subject, errorMessage, messageId...) ; BLReconciliation.tsx:100-108 ne garde que `log.status === 'sent' && !map.has(log.deliveryId)`. Index existants : group_id et delivery_id seuls (migrations.ts:106-107). routes.ts:2448-2455 n'honore storeId que pour l'admin alors que le client l'envoie aussi pour le directeur (BLReconciliation.tsx:87).
- **Impact :** Payload inutilement gros à chaque ouverture du rapprochement ; au-delà de 500 envois, l'indicateur « déjà relancé » disparaît pour les livraisons plus anciennes (risque de relancer deux fois le même fournisseur).
- **Recommandation :** Endpoint dédié `SELECT DISTINCT ON (delivery_id) delivery_id, created_at, sent_by, sent_by_name, sent_to FROM supplier_mail_logs WHERE status = 'sent' AND group_id = ANY($1) ORDER BY delivery_id, created_at DESC` (champs renvoyés en camelCase comme aujourd'hui : deliveryId, createdAt, sentBy, sentByName), index (group_id, delivery_id, created_at DESC), et prise en compte de storeId pour le directeur s'il appartient à ses magasins.

### SUPP-01

**Fonctionnalité dupliquée avec la colonne Fournisseurs de la page Contacts** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Suppliers.tsx:369`
- **Constat :** Suppliers.tsx:405-422 affiche contact/téléphone/email et permet l'édition (modale l.494-640) ; Contacts.tsx:281-330 affiche les mêmes coordonnées et ouvre sa propre modale d'édition (l.566-613) via PUT /api/suppliers/:id.
- **Impact :** Deux écrans pour la même information, avec des droits différents : l'utilisateur ne sait pas où mettre à jour un numéro.
- **Recommandation :** Garder la fiche complète (options, mode de paiement, code ffnancy) dans Fournisseurs (admin) et faire de Contacts un annuaire en lecture + lien « Modifier la fiche » vers Fournisseurs, ou l'inverse ; une seule modale de coordonnées partagée.

### SUPP-02

**Droits fournisseurs incohérents entre UI et serveur** — coherence-design, sévérité moyenne, effort M

- **Fichier :** `server/routes.ts:1239`
- **Constat :** Suppliers.tsx:216/229/253/320 : création, modification, suppression réservées à `user?.role === 'admin'` ; Contacts.tsx:27 `CAN_EDIT_SUPPLIER = ["admin", "directeur"]` ; routes.ts:1201 POST autorise admin/manager/directeur, routes.ts:1242 PUT admin/manager/directeur, routes.ts:1259 DELETE admin/directeur.
- **Impact :** Un directeur peut modifier un fournisseur depuis Contacts mais pas depuis Fournisseurs ; un manager peut créer/modifier via l'API sans que l'UI le permette. Matrice de droits impossible à expliquer aux utilisateurs.
- **Recommandation :** Définir une seule règle (ex. hasPermission(role,'suppliers','edit') dans server/permissions) et l'utiliser côté serveur et client (hook usePermission).

### SUPP-03

**Suppression impossible dès qu'il y a un historique, avec un message générique** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Suppliers.tsx:262`
- **Constat :** Suppliers.tsx:262 `if (confirm(...)) deleteMutation.mutate(supplier.id)` puis l.189-193 toast « Impossible de supprimer le fournisseur ». init.sql:446-455 : `FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION` sur deliveries et orders ; routes.ts:1265-1268 renvoie 500 « Failed to delete supplier ».
- **Impact :** L'admin confirme la suppression puis reçoit une erreur incompréhensible, alors que la carte affiche déjà le nombre de commandes (stats.orders).
- **Recommandation :** Désactiver le bouton (avec infobulle « X commandes liées ») quand stats.orders + stats.deliveries > 0, renvoyer côté serveur un 409 explicite sur violation FK (code 23503), et proposer un statut « Archivé/inactif ».

### SUPP-04

**Erreurs de validation non expliquées à l'utilisateur** — ux-simplicite, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Suppliers.tsx:93`
- **Constat :** routes.ts:1223-1228 renvoie `{ message: "Validation failed", errors: error.errors }` en 400, mais Suppliers.tsx:93-97 affiche toujours « Impossible de créer le fournisseur » (idem modification l.145-149).
- **Impact :** L'utilisateur ne sait pas quel champ corriger.
- **Recommandation :** Extraire le message serveur de l'erreur (`apiRequest` lève `${status}: ${body}`) et l'afficher dans le toast (403 = droits insuffisants, 409/FK = fournisseur utilisé, etc.) ; la validation Zod côté client n'est pas prioritaire.

### SUPP-05

**Grille de cartes lourde, recherche limitée au nom, ni tri ni filtres** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Suppliers.tsx:276`
- **Constat :** Suppliers.tsx:276-278 `suppliers.filter(supplier => supplier.name.toLowerCase().includes(searchTerm.toLowerCase()))` ; l.368-372 cartes `shadow-lg hover:shadow-xl ... p-6` en grille de 3 ; aucun filtre sur hasDlc / requiresControl / automaticReconciliation.
- **Impact :** Avec des dizaines de fournisseurs, long défilement et densité faible ; impossible de lister « les fournisseurs à contrôler » ou « avec DLC ».
- **Recommandation :** Passer en tableau compact (Nom, Contact, Téléphone, Email, Options en badges, Commandes) avec tri, recherche sur nom/contact/email/code, et filtres rapides par option.

### ANA-16

**Calendriers en anglais, popover qui ne se ferme pas, pas de contrôle début ≤ fin** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Analytics.tsx:221`
- **Constat :** Analytics.tsx:221-226 et 238-243 `<Calendar mode="single" selected={dateRange.from} onSelect={...} initialFocus />` sans `locale={fr}` ni `weekStartsOn` (calendar.tsx ne définit aucune locale) ; Popover non contrôlé ; aucune validation from <= to.
- **Impact :** Mois et jours affichés en anglais, semaine commençant le dimanche ; l'utilisateur doit cliquer à côté pour fermer ; une période inversée renvoie des graphiques vides sans explication.
- **Recommandation :** Auto-implémenter uniquement `locale={fr}` sur les deux <Calendar> ; fermeture contrôlée du Popover, validation début ≤ fin et mode="range" à traiter avec la refonte des filtres.

### ANA-19

**Bouton « Temps réel » confus et partiel** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Analytics.tsx:71`
- **Constat :** Analytics.tsx:71 `refetchInterval: isRefreshing ? 30000 : false` uniquement sur summary ; l.164-172 le bouton passe en `animate-pulse` permanent et son libellé devient « Actualisé ».
- **Impact :** Les graphiques ne se mettent pas à jour en « temps réel » (seuls les KPI) ; le libellé suggère une action terminée ; animation clignotante fatigante ; relance aussi la requête coûteuse ANA-03.
- **Recommandation :** Remplacer par un bouton « Actualiser » ponctuel (refetch de toutes les requêtes) avec l'heure de dernière mise à jour ; supprimer le polling.

### ANA-20

**fetch() manuels, logs de debug et variables mortes** — dette-code, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Analytics.tsx:58`
- **Constat :** Analytics.tsx:58-112 quatre queryFn avec `fetch(...)` dupliquant la queryFn par défaut et `console.log('📊 [ANALYTICS] Fetching summary...')`, `console.log('✅ [ANALYTICS] Summary data received:', data)` ; `console.error` (l.64, 83) conservés en prod (vite.config.ts ne retire que log/debug) ; `user` (l.20), `selectedStoreId` (l.21), `selectedStatus` (l.30) inutilisés.
- **Impact :** Code verbeux et difficile à maintenir ; la gestion 401 centralisée de queryClient.ts est contournée.
- **Recommandation :** Factoriser une seule queryFn `({ queryKey: [url, params] }) => fetch(`${url}?${params}`)` partagée par les 4 requêtes, supprimer les console.log, la variable `user` (et l'import useAuthUnified) ainsi que selectedStatus/setSelectedStatus (jamais modifiés) ; conserver selectedStoreId pour ANA-14.

### ANA-21

**SQL brut concaténé et erreurs avalées dans timeseries / by-store** — dette-code, sévérité basse, effort M

- **Fichier :** `server/storage.ts:3297`
- **Constat :** storage.ts:3297-3341 conditions construites en chaînes `orderConditions.push(`supplier_id IN (${supplierIds})`)` puis `db.execute(sql.raw(ordersSql))` ; storage.ts:3414-3439 idem avec `${sql.raw(orderDateFilter)}` ; storage.ts:3458-3461 `catch (error) { console.error(...); return []; }`. Un `supplierIds=abc` donne `IN (NaN)` -> erreur SQL 500.
- **Impact :** Fragile (aujourd'hui protégé seulement par Number()/toISOString), les erreurs de by-store sont masquées en « Aucune donnée magasin ».
- **Recommandation :** Réécrire avec les helpers Drizzle (gte, inArray, sql`...` paramétré) comme getAnalyticsBySupplier, valider les paramètres avec Zod dans la route, laisser remonter les erreurs.

### ANA-22

**En-tête non responsive et rendu sans navigation sur mobile** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Analytics.tsx:154`
- **Constat :** Analytics.tsx:154-155 `<div className="bg-white border-b p-6 -m-6 mb-6"><div className="flex items-center justify-between">` titre long + deux boutons sans flex-wrap ; la route mobile (RouterProduction.tsx:128) rend la page hors MobileLayout.
- **Impact :** Sur téléphone, titre et boutons se compressent/débordent ; aucune navigation pour revenir.
- **Recommandation :** `flex-col sm:flex-row gap-2`, supprimer le hack de marges négatives, envelopper dans MobileLayout sur mobile (cf. CONT-09).

### ANA-23

**Taux de rapprochement calculé sur toutes les livraisons, y compris planifiées** — bug, sévérité basse, effort S

- **Fichier :** `server/storage.ts:3260`
- **Constat :** storage.ts:3219 `reconciled: COUNT(CASE WHEN reconciled = true THEN 1 END)` et l.3260 `reconciliationRate: deliveryStats.count ? (reconciled / count) * 100 : 0` où count inclut les livraisons au statut 'planned' (pas encore livrables donc pas rapprochables).
- **Impact :** Le taux est mécaniquement sous-estimé dès qu'il y a des livraisons futures dans la période.
- **Recommandation :** Calculer sur les livraisons au statut 'delivered' (`COUNT(*) FILTER (WHERE status = 'delivered')`) et l'indiquer dans le libellé.

### API-04

**Logs serveur verbeux à chaque création de fournisseur** — dette-code, sévérité basse, effort S

- **Fichier :** `server/routes.ts:1167`
- **Constat :** routes.ts:1167-1213 une douzaine de `console.log` dont `console.log('📋 POST /api/suppliers - Request body:', JSON.stringify(redactBody(req.body), null, 2));` et `console.log('✅ Supplier data validation passed:', data);`. Le serveur est compilé par `tsc` (package.json:8) : rien n'est retiré en production.
- **Impact :** Pollution des logs de production, données métier écrites en clair.
- **Recommandation :** Supprimer ces logs ou les conditionner à `process.env.NODE_ENV !== 'production'`.

### API-05

**Erreurs de validation renvoyées en 500 sur PUT fournisseur / contact ; filtre DLC en JS** — bug, sévérité basse, effort S

- **Fichier :** `server/routes.ts:1250`
- **Constat :** routes.ts:1246 `insertSupplierSchema.partial().parse(req.body)` et l.1250-1253 `catch (error) { res.status(500).json({ message: "Failed to update supplier" }) }` ; idem routes.ts:1318-1324 pour les contacts. routes.ts:1151 `suppliers.filter(supplier => supplier.hasDlc === true)` après un SELECT complet.
- **Impact :** Une saisie invalide apparaît comme une panne serveur ; filtrage côté Node au lieu d'un WHERE.
- **Recommandation :** Auto-implémenter uniquement le `if (error.name === 'ZodError') return res.status(400).json({ message: 'Validation failed', errors: error.errors })` dans PUT /api/suppliers/:id et PUT /api/contacts/:id ; le paramètre dlcOnly est optionnel et non prioritaire.

### CONT-10

**Requête contacts non conditionnée et queryFn redondante** — perf-client, sévérité basse, effort S

- **Fichier :** `client/src/pages/Contacts.tsx:76`
- **Constat :** Contacts.tsx:76-84 `useQuery({ queryKey: contactsQueryKey, queryFn: async () => { const url = effectiveGroupId ? ... ; return await apiRequest(url, "GET"); } })` : pas de `enabled`, alors que l.355-360 n'affiche rien si `!effectiveGroupId && !isAdmin`. La queryFn reconstruit l'URL que la queryFn par défaut gère déjà.
- **Impact :** Requête et transfert inutiles quand le résultat n'est pas affiché ; code dupliqué.
- **Recommandation :** Ajouter `enabled: isAdmin || !!effectiveGroupId` et laisser la queryFn par défaut (ou une queryFn unique construisant l'URL depuis la clé structurée de CONT-01).

### CONT-11

**Champ « Notes » sur une seule ligne** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Contacts.tsx:536`
- **Constat :** Contacts.tsx:535-542 `<Label htmlFor="c-notes">Notes</Label><Input id="c-notes" ... placeholder="Notes libres..." />` alors que la colonne est un `text` (schema.ts:115).
- **Impact :** Saisie d'horaires, consignes ou remarques longues peu lisible ; le texte déborde.
- **Recommandation :** Utiliser le composant Textarea (rows=3).

### MAIL-02

**Montant du BL au format anglo-saxon dans le mail envoyé au fournisseur** — lisibilite, sévérité basse, effort S

- **Fichier :** `shared/supplierMail.ts:85`
- **Constat :** supplierMail.ts:84-86 `details.push(`Montant du BL : ${blAmount.toFixed(2)} €`);` -> « Montant du BL : 12345.50 € ».
- **Impact :** Mail professionnel en français avec un montant au mauvais format (point décimal, pas de séparateur de milliers).
- **Recommandation :** `new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(blAmount)` -> « 12 345,50 € ».

### SALES-01

**Pages Analyse des ventes jamais branchées (code mort) et texte trompeur** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/SalesAnalysisConfig.tsx:75`
- **Constat :** `grep -rn "SalesAnalysis" client/src` : aucun import hors des deux fichiers ; RouterProduction.tsx ne déclare aucune route ; SalesAnalysisConfig.tsx:75 « Cette page sera accessible via le menu "Analyse Vente" » alors que Sidebar.tsx n'a pas cette entrée ; Utilities.tsx n'inclut pas le formulaire.
- **Impact :** L'admin ne peut ni configurer ni consulter l'outil d'analyse ; code à maintenir pour rien.
- **Recommandation :** Décision produit : soit ajouter la route /sales-analysis + entrée de menu « Analyse des ventes » et intégrer SalesAnalysisConfig dans Utilitaires, soit supprimer les deux fichiers et la colonne utilities.sales_analysis_url.

### SALES-02

**Si branchée : 403 présenté comme « URL non configurée », iframe en h-screen, URL non validée** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/SalesAnalysisPage.tsx:39`
- **Constat :** routes.ts:340-343 /api/utilities réservé admin/directeur ; SalesAnalysisPage.tsx:20-22 ne lit pas isError, l.39-60 affiche « URL non configurée » + bouton vers /utilities (admin seulement) ; l.64 `<div className="w-full h-screen relative">` dans le Layout ; SalesAnalysisConfig.tsx:56-58 accepte n'importe quelle chaîne ; l.29-31 le champ n'est pas vidé si l'URL est supprimée.
- **Impact :** Un manager/employé recevrait un message faux et un bouton menant à une page interdite ; double barre de défilement.
- **Recommandation :** Exposer l'URL via un endpoint lisible par tous les rôles autorisés, gérer isError, hauteur `h-[calc(100vh-header)]`, valider l'URL (z.string().url()).

### SUPP-06

**ID technique affiché, code ffnancy caché, libellés jargon** — lisibilite, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Suppliers.tsx:380`
- **Constat :** Suppliers.tsx:380 `<p className="text-sm text-gray-500">#{supplier.id}</p>` ; le champ codefou est saisi (l.543-549 « Code fournisseur API (liaison ffnancy) ») mais jamais affiché sur la carte ; les options n'ont aucune aide (« Fournisseur à contrôler », « Rapprochement automatique BL/Factures »).
- **Impact :** Information inutile pour l'utilisateur, information utile absente, sens des options obscur pour un non-technicien.
- **Recommandation :** Afficher « Code : FOU01 » à la place de #id ; renommer le champ en « Code fournisseur (catalogue articles ffnancy) » ou un libellé validé par le métier, et ajouter une phrase d'aide sous chaque option.

### SUPP-07

**Une erreur réseau s'affiche comme « Aucun fournisseur – créez votre premier fournisseur »** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Suppliers.tsx:344`
- **Constat :** Suppliers.tsx:55-57 `const { data: suppliers = [], isLoading } = useQuery(...)` (isError non lu) ; l.344-355 `filteredSuppliers.length === 0` -> « Commencez par créer votre premier fournisseur ».
- **Impact :** En cas de panne, l'admin peut croire que le référentiel a été effacé et recréer des fournisseurs.
- **Recommandation :** Gérer isError avec un encart d'erreur et un bouton « Réessayer » (refetch).

### SUPP-08

**Recherche de stats en O(n×m) à chaque frappe, filtres non mémoïsés** — perf-client, sévérité basse, effort S

- **Fichier :** `client/src/pages/Suppliers.tsx:280`
- **Constat :** Suppliers.tsx:280-283 `supplierStats.find(s => s.id === supplierId)` appelé pour chaque carte (l.370) ; l.276-278 filtre recalculé et `searchTerm.toLowerCase()` réévalué pour chaque fournisseur à chaque rendu.
- **Impact :** Re-rendus plus lents à chaque caractère tapé quand la liste grossit.
- **Recommandation :** `const statsById = useMemo(() => new Map(supplierStats.map(s => [s.id, s])), [supplierStats])` et `useMemo` pour filteredSuppliers avec le terme normalisé une fois.

### SUPP-09

**Double invalidation après modification d'un fournisseur** — perf-api, sévérité basse, effort S

- **Fichier :** `client/src/pages/Suppliers.tsx:156`
- **Constat :** Suppliers.tsx:156 `queryClient.invalidateQueries({ queryKey: ['/api/suppliers'] });` dans onSuccess puis l.161-163 à nouveau dans onSettled.
- **Impact :** Deux refetchs successifs de /api/suppliers (le premier annulé, souvent déjà parti au serveur) après chaque modification.
- **Recommandation :** Ne garder l'invalidation que dans onSettled.

### SUPP-10

**Logs de debug et branche 401 morte dans les mutations** — dette-code, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Suppliers.tsx:67`
- **Constat :** Suppliers.tsx:67-69, 103-106, 110, 122, 129 `console.log('🚚 Frontend: Creating supplier...')` ; l.82-91 `if (isUnauthorizedError(error)) { ... window.location.href = "/api/login"; }` alors que authUtils.ts:2 teste `/^401: .*Unauthorized/` et que requireAuth renvoie « Authentification requise » (localAuth.ts:252) : la branche ne s'exécute jamais, et GET /api/login n'existe pas (seul POST).
- **Impact :** Bruit dans le code ; si la branche s'exécutait, l'utilisateur atterrirait sur « Cannot GET /api/login ».
- **Recommandation :** Dans Suppliers.tsx uniquement : supprimer les console.log et les trois blocs `if (isUnauthorizedError(error)) {...}` (comportement inchangé, la redirection 401 est déjà assurée par queryClient pour les requêtes). La correction globale de isUnauthorizedError (regex /^401:/) et la redirection vers /auth relèvent d'un chantier séparé.

### SUPP-11

**Compteurs Commandes/Livraisons ambigus et indépendants du magasin sélectionné** — coherence-design, sévérité basse, effort S

- **Fichier :** `client/src/pages/Suppliers.tsx:61`
- **Constat :** Suppliers.tsx:61-63 `useQuery({ queryKey: ['/api/stats/by-supplier'] })` sans storeId ; routes.ts:1511 `resolveStatsGroupIds(user, req.query.storeId)` -> tous les magasins ; l.465-474 libellés « Commandes » / « Livraisons » sans période.
- **Impact :** L'admin qui a sélectionné un magasin voit des totaux enseigne « depuis toujours » sans le savoir.
- **Recommandation :** Passer `storeId=selectedStoreId` (clé ['/api/stats/by-supplier', selectedStoreId]) et préciser le libellé (« Commandes (total) » ou « 12 derniers mois »).

### SUPP-12

**Boutons icône sans libellé ni infobulle, petits textes à faible contraste** — accessibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Suppliers.tsx:385`
- **Constat :** Suppliers.tsx:385-399 `<Button variant="ghost" size="sm" onClick={() => handleEdit(supplier)}><Edit className="w-4 h-4" /></Button>` (idem corbeille) ; Contacts.tsx:302-304 et 403-413 identiques. Textes `text-xs text-gray-400` (Suppliers.tsx:543, Contacts.tsx:327) et `text-xs text-blue-500` (Contacts.tsx:397) sous le ratio 4,5:1.
- **Impact :** Lecteurs d'écran annoncent « bouton » sans action ; utilisateurs peu à l'aise ne savent pas ce que fait l'icône ; textes difficiles à lire.
- **Recommandation :** Ajouter `aria-label` et `title` (« Modifier », « Supprimer ») ; passer les textes secondaires en text-gray-500/600 et text-blue-700.

### SUPP-13

**Casts `as any` inutiles sur email/codefou** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/Suppliers.tsx:242`
- **Constat :** Suppliers.tsx:242-243 `codefou: (supplier as any).codefou`, `email: (supplier as any).email`, l.417-420 ; Contacts.tsx:188, 317-323, 390-391 ; alors que shared/schema.ts:95-97 déclare `codefou`, `email` et contacts.company (l.111).
- **Impact :** Perte du typage : une faute de frappe ou un renommage de colonne ne sera pas détecté à la compilation.
- **Recommandation :** Supprimer les `as any` (le type Supplier/Contact inféré contient déjà ces champs) et typer les mutationFn (InsertSupplier, InsertContact).
