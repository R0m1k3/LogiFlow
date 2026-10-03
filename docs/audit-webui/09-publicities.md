# Publicités

_35 constats vérifiés — 3 haute, 19 moyenne, 13 basse._

## Pages analysées

### `/publicities (desktop, >= 768 px, tablette incluse)`

**Rôle :** Consulter le planning annuel des campagnes publicitaires (catalogues/promos) et savoir quels magasins y participent. L'admin les crée, les modifie et les supprime.

**Tâches principales de l'utilisateur :**
- Voir les publicités en cours et à venir de l'année pour son magasin
- Visualiser la couverture semaine par semaine (Vue d'ensemble) ou jour par jour (vue calendrier)
- Ouvrir le détail d'une publicité (dates, magasins participants, créateur)
- Exporter la liste de l'année en CSV
- Admin : créer ou modifier une publicité et cocher les magasins participants (PublicityForm en modale)
- Admin : supprimer une publicité après confirmation

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/ad-campaigns?year=YYYY&storeId=N | au montage, puis à chaque changement d'année ou de magasin (clé ['/api/ad-campaigns', selectedYear, selectedStoreId], fetch() manuel, staleTime par défaut 30 s, sans placeholderData ni enabled) | server/routes.ts:4595 → storage.getUserWithGroups (routes.ts:4597, 2 requêtes, en double avec deserializeUser localAuth.ts:141) → storage.getPublicities (storage.ts:1502 : SELECT publicities WHERE year, puis SELECT participations LEFT JOIN groups) | groupIds calculé par la route mais ignoré par getPublicities, donc pas de filtre magasin ni de cloisonnement par rôle. Ligne groups complète (logo base64, config SMTP/NocoDB) jointe à chaque participation. Créateur jamais joint. Triple tri (SQL, JS serveur, JS client). 2 console.log à chaque appel. Au total 6 requêtes SQL, dont 4 séquentielles avant les données. En cas d'erreur, réponse 500 avec []. |
| GET /api/groups | au montage si user (même clé que Layout.tsx:48, donc cache partagé, pas de double appel réseau) | server/routes.ts:970 → storage.getUserWithGroups + storage.getGroups (storage.ts:432, SELECT * FROM groups) pour l'admin, sinon userGroups (id/name/color) | La page n'utilise que id, name et color. Pour l'admin, toutes les colonnes partent (logo en data URI, SMTP, webhook). Doublon de useStore().stores. |
| POST /api/ad-campaigns | au clic sur Créer dans PublicityForm (fetch manuel) | server/routes.ts:4629 → getUserWithGroups → insertPublicitySchema.parse → storage.createPublicity (storage.ts:1586) → storage.setPublicityParticipations (storage.ts:1630 : DELETE puis INSERT) → storage.getPublicity (storage.ts:1562) | 5 à 6 requêtes séquentielles hors transaction. Un N° en double renvoie un 500 générique en anglais. La réponse complète est ignorée par le client, qui invalide toute la liste et la recharge. |
| PUT /api/ad-campaigns/:id | au clic sur Modifier dans PublicityForm | server/routes.ts:4665 → storage.updatePublicity (storage.ts:1591, req.body brut sans validation) → setPublicityParticipations → getPublicity | Pas de validation Zod, pas de transaction, pas de 404 si l'id n'existe pas. Invalidation large côté client. |
| POST /api/ad-campaigns/:id/delete (repli DELETE /api/ad-campaigns/:id sur 404) | au clic sur Supprimer dans la modale de confirmation | server/routes.ts:4737 (copie de routes.ts:4697) → storage.deletePublicity (storage.ts:1600 : DELETE participations RETURNING puis DELETE publicities RETURNING) | Deux handlers copiés-collés avec environ 8 console.log chacun. La suppression manuelle des participations est redondante avec le ON DELETE CASCADE. Le repli DELETE côté client est du code mort. |

**Lisibilité / simplicité :** Page dense et peu hiérarchisée. L'en-tête aligne 7 contrôles sur une ligne sans retour à la ligne : bascule Liste/Grille en icônes sans libellé, bouton 'Vue d'ensemble', icône filtre, année, mois, 'Exporter CSV', 'Nouvelle publicité'. Viennent ensuite 3 cartes stats (même icône), puis une grille annuelle de 12 colonnes affichée par défaut avant la liste, qui se retrouve sous la ligne de flottaison. La liste desktop n'a ni recherche ni filtre par statut ou magasin, alors que la version mobile a une recherche. La colonne 'Créé par' affiche toujours 'Utilisateur'. Le sélecteur de magasin n'a aucun effet (bug serveur). Des statuts et la vue calendrier sont faux d'un jour (fuseau horaire), et les numéros de semaine ne sont pas ISO certaines années. Pendant le chargement, les stats affichent 0 et toutes les semaines apparaissent 'sans publicité'. Il n'y a pas d'état d'erreur : une erreur s'affiche comme 'Aucune publicité… Commencez par créer…', y compris pour les non-admins. Les messages d'erreur serveur sont en anglais. Le tableau n'est pas scrollable en tablette (colonne Actions coupée). La modale de création n'a pas de hauteur max. Des console.log s'exécutent à chaque rendu en production. La vue calendrier fait doublon avec la page /calendar.

### `/publicities (mobile, < 768 px)`

**Rôle :** Consulter rapidement sur téléphone les publicités de l'année pour le magasin sélectionné.

**Tâches principales de l'utilisateur :**
- Voir la liste des publicités de l'année pour son magasin
- Rechercher par N° ou désignation
- Lire le statut (En cours / À venir / Terminée) et les dates

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/ad-campaigns?storeId=N&year=YYYY | au montage et au changement d'année ou de magasin, seulement si selectedStoreId (clé ['/api/ad-campaigns', selectedStoreId, selectedYear], ordre inverse de la version desktop) | server/routes.ts:4595 → storage.getUserWithGroups → storage.getPublicities (storage.ts:1502) | storeId est ignoré par le serveur (groupIds non appliqué), donc la liste contient aussi les pubs où le magasin ne participe pas. Le payload contient le logo base64 de chaque magasin participant. Pas d'appel quand aucun magasin n'est sélectionné, ce qui donne une liste vide trompeuse. |

**Lisibilité / simplicité :** Liste de cartes simple et lisible, avec recherche et année. En revanche : le bouton flottant '+' est visible pour tous les rôles et ne fait rien (TODO). La liste est vide avec 'Aucune publicité trouvée' quand aucun magasin n'est sélectionné (admin 'Tous les magasins'). Pas de détail ni de magasins participants. 'Créé par' affiche l'identifiant technique (admin_local, manual_...). Le statut passe à 'Terminée' pendant tout le dernier jour. Badges et couleurs différents du desktop (vert plein contre vert pâle, icône violette contre verte). Pas d'état d'erreur. Le même message s'affiche pour une liste vide et une recherche sans résultat. Les pubs en cours ne sont pas mises en avant (tri par N°).

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [PUB-01](#pub-01) | haute | bug | S | getPublicities ignore groupIds : filtre magasin et cloisonnement par rôle inopérants | `server/storage.ts:1502` |
| [PUB-02](#pub-02) | haute | perf-api | S | Ligne groups complète (logo base64, config SMTP/NocoDB) jointe à chaque participation | `server/storage.ts:1536` |
| [PUB-11](#pub-11) | haute | ux-simplicite | S | Bouton flottant « + » sans action, visible par tous les rôles | `client/src/pages/mobile/PublicitiesPage.tsx:162` |
| [PUB-03](#pub-03) | moyenne | bug | S | Créateur jamais joint : « Créé par » affiche « Utilisateur » ou un identifiant technique | `server/storage.ts:1503` |
| [PUB-04](#pub-04) | moyenne | perf-serveur | S | Utilisateur rechargé en base dans chaque handler alors que deserializeUser l'a déjà chargé | `server/routes.ts:4597` |
| [PUB-06](#pub-06) | moyenne | dette-code | S | Route /api/ad-campaigns/debug exposée et routes de suppression dupliquées | `server/routes.ts:4529` |
| [PUB-07](#pub-07) | moyenne | perf-client | S | Deux console.log identiques à chaque rendu, plus des logs dans queryFn et la mutation | `client/src/pages/Publicities.tsx:75` |
| [PUB-08](#pub-08) | moyenne | perf-client | M | Vue annuelle, calendrier et stats recalculés à chaque rendu sans useMemo | `client/src/pages/Publicities.tsx:229` |
| [PUB-09](#pub-09) | moyenne | bug | S | Fuseau horaire : 1er jour absent du calendrier, « Terminée » le dernier jour | `client/src/pages/Publicities.tsx:624` |
| [PUB-10](#pub-10) | moyenne | bug | S | Numéros de semaine non ISO (décalés d'une semaine certaines années) | `client/src/pages/Publicities.tsx:206` |
| [PUB-12](#pub-12) | moyenne | ux-simplicite | S | Liste vide trompeuse quand aucun magasin n'est sélectionné | `client/src/pages/mobile/PublicitiesPage.tsx:45` |
| [PUB-13](#pub-13) | moyenne | ux-simplicite | S | Aucun état d'erreur : une panne s'affiche comme « aucune publicité » | `client/src/pages/Publicities.tsx:572` |
| [PUB-14](#pub-14) | moyenne | perf-client | S | Requête sans keepPreviousData, staleTime ni enabled : flash à 0, double appel au montage | `client/src/pages/Publicities.tsx:42` |
| [PUB-17](#pub-17) | moyenne | bug | M | PUT sans validation, écritures non transactionnelles (création, participations, suppression) | `server/routes.ts:4681` |
| [PUB-18](#pub-18) | moyenne | ux-simplicite | S | Messages d'erreur génériques en anglais, N° en double non expliqué | `server/routes.ts:4661` |
| [PUB-19](#pub-19) | moyenne | ux-simplicite | M | Champ Année manuel, bornes incohérentes, filtrage par année saisie plutôt que par dates | `client/src/components/PublicityForm.tsx:27` |
| [PUB-20](#pub-20) | moyenne | ux-simplicite | S | Formulaire : erreurs qui persistent, alerte rouge sur un champ optionnel, watch global | `client/src/components/PublicityForm.tsx:215` |
| [PUB-21](#pub-21) | moyenne | lisibilite | M | En-tête surchargé : 7 contrôles sur une ligne, non responsive | `client/src/pages/Publicities.tsx:321` |
| [PUB-22](#pub-22) | moyenne | ux-simplicite | S | Tableau 7 colonnes non scrollable : colonne Actions coupée en tablette | `client/src/pages/Publicities.tsx:720` |
| [PUB-23](#pub-23) | moyenne | ux-simplicite | M | Liste desktop sans recherche ni filtre de statut, libellés abrégés, lignes non cliquables | `client/src/pages/Publicities.tsx:748` |
| [PUB-24](#pub-24) | moyenne | lisibilite | M | Vue d'ensemble affichée par défaut, info uniquement au survol, légende sans noms | `client/src/pages/Publicities.tsx:466` |
| [PUB-30](#pub-30) | moyenne | perf-api | S | « Publicités à venir » : 3 appels séquentiels d'années complètes faute de filtre API | `client/src/pages/Dashboard.tsx:197` |
| [PUB-05](#pub-05) | basse | perf-serveur | S | console.log dans le chemin chaud de lecture et logs verbeux sur la suppression | `server/storage.ts:1525` |
| [PUB-15](#pub-15) | basse | perf-client | S | Triple tri (SQL, serveur JS, client JS) incompatible avec le format de N° suggéré | `client/src/pages/Publicities.tsx:57` |
| [PUB-16](#pub-16) | basse | perf-serveur | S | Association participations ↔ publicités en O(N×M) et 2 requêtes séquentielles | `server/storage.ts:1550` |
| [PUB-25](#pub-25) | basse | lisibilite | S | Vue calendrier : seul le N° est affiché, pas de navigation mois par mois, doublon avec /calendar | `client/src/pages/Publicities.tsx:651` |
| [PUB-26](#pub-26) | basse | coherence-design | S | Icônes, badges de statut, CTA et confirmation incohérents | `client/src/pages/Publicities.tsx:775` |
| [PUB-27](#pub-27) | basse | accessibilite | S | Boutons Liste/Grille sans nom accessible ni infobulle | `client/src/pages/Publicities.tsx:324` |
| [PUB-28](#pub-28) | basse | dette-code | S | Code mort et requête groups redondante avec StoreContext | `client/src/pages/Publicities.tsx:303` |
| [PUB-29](#pub-29) | basse | perf-api | S | Invalidation par préfixe après mutation : la réponse serveur complète est ignorée | `client/src/components/PublicityForm.tsx:84` |
| [PUB-31](#pub-31) | basse | ux-simplicite | S | Modale création/édition sans hauteur max : boutons hors écran avec beaucoup de magasins | `client/src/pages/Publicities.tsx:857` |
| [PUB-32](#pub-32) | basse | perf-bundle | M | Pages Publicités et formulaire importés statiquement dans le bundle initial | `client/src/components/RouterProduction.tsx:15` |
| [PUB-33](#pub-33) | basse | ux-simplicite | M | Mobile : pas de détail, pas de magasins participants, pas de priorisation des pubs en cours | `client/src/pages/mobile/PublicitiesPage.tsx:119` |
| [PUB-34](#pub-34) | basse | dette-code | M | Trois queryFn différents et clés incohérentes pour le même endpoint | `client/src/pages/mobile/PublicitiesPage.tsx:43` |
| [PUB-35](#pub-35) | basse | perf-serveur | S | Index publicities/participations hors de shared/schema.ts, index group_id non garanti | `shared/schema.ts:166` |

### PUB-01

**getPublicities ignore groupIds : filtre magasin et cloisonnement par rôle inopérants** — bug, sévérité haute, effort S

- **Fichier :** `server/storage.ts:1502`
- **Constat :** storage.ts:1502 `async getPublicities(year?: number, groupIds?: number[])`. Le seul filtre appliqué est l.1517-1519 `if (year) { query = query.where(eq(publicities.year, year)); }` et `groupIds` n'est jamais lu. Pourtant routes.ts:4605-4615 calcule `groupIds = userGroupIds` pour les non-admins et `[parseInt(storeId)]` pour l'admin. CalendarGrid.tsx:428-442 refiltre côté client pour compenser, Publicities.tsx et PublicitiesPage.tsx ne le font pas.
- **Impact :** Employés et managers voient les publicités de tous les magasins. Le sélecteur de magasin ne change ni la liste, ni les stats Total/En cours/À venir, ni l'export CSV. Sur mobile, filtré par magasin, on voit des pubs où le magasin ne participe pas. Le payload est plus gros que nécessaire.
- **Recommandation :** Quand groupIds est défini, filtrer en SQL : `and(eq(publicities.year, year), inArray(publicities.id, db.select({ id: publicityParticipations.publicityId }).from(publicityParticipations).where(inArray(publicityParticipations.groupId, groupIds))))`. Il faut garantir l'index group_id (voir PUB-35). Décision produit à prendre : l'admin en « Tous les magasins » continue-t-il de voir les pubs sans magasin ? (comportement actuel)

### PUB-02

**Ligne groups complète (logo base64, config SMTP/NocoDB) jointe à chaque participation** — perf-api, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:1536`
- **Constat :** storage.ts:1533-1541 `.select({ publicityId: ..., groupId: ..., group: groups })`, idem dans getPublicity l.1570. La table groups (shared/schema.ts:48-79) contient `logo: text("logo") // Logo en data URI (data:image/png;base64,...)`, plus smtpHost, smtpUser, webhookUrl, nocodbTableName, address, phone… Les clients n'utilisent que group.name et group.color (Publicities.tsx:791-793, 939-941 ; CalendarGrid.tsx:659 ; Dashboard.tsx:618-629). Pour l'admin, /api/groups fait aussi `db.select().from(groups)` (storage.ts:432), utilisé ici seulement pour la couleur et le nom.
- **Impact :** Le logo est dupliqué pour chaque participation de chaque publicité. Avec 100 pubs × 5 magasins × un logo de 50 Ko, la réponse JSON atteint environ 25 Mo, ce qui ralentit fortement le chargement, surtout en 4G. stripSmtpPassword (sanitize.ts, branché routes.ts:168-174) parcourt récursivement tout ce payload. La configuration SMTP, webhook et NocoDB est en plus exposée aux employés.
- **Recommandation :** Limiter la correction à getPublicities et getPublicity : remplacer `group: groups` par `group: { id: groups.id, name: groups.name, color: groups.color }`. Ne pas modifier /api/groups ni getGroups() dans ce lot, car d'autres écrans consomment webhookUrl, logo et smtp*.

### PUB-11

**Bouton flottant « + » sans action, visible par tous les rôles** — ux-simplicite, sévérité haute, effort S

- **Fichier :** `client/src/pages/mobile/PublicitiesPage.tsx:162`
- **Constat :** l.162-170 : `<Button className="fixed bottom-20 right-4 h-14 w-14 rounded-full ..." onClick={() => { // TODO: Ouvrir modal création mobile }}>`, sans condition de rôle. Or shared/permissions.ts:61-66 : `manager: ['view'], employee: ['view']`, seul l'admin peut créer.
- **Impact :** Le bouton le plus visible de l'écran ne fait rien. L'utilisateur croit à une panne et perd confiance dans l'application.
- **Recommandation :** Masquer le bouton tant que la création mobile n'existe pas. À terme, le réserver à `user?.role === 'admin'` et ouvrir PublicityForm dans un Sheet plein écran.

### PUB-03

**Créateur jamais joint : « Créé par » affiche « Utilisateur » ou un identifiant technique** — bug, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:1503`
- **Constat :** Le select de storage.ts:1503-1514 contient `createdBy` mais pas de jointure users, alors que le type PublicityWithRelations (shared/schema.ts:814-817) promet `creator: User`. Publicities.tsx:807 `{publicity.creator?.name || publicity.creator?.username || 'Utilisateur'}` affiche donc toujours « Utilisateur ». PublicitiesPage.tsx:151 `Créé par {pub.creator?.username || pub.createdBy}` affiche l'id brut (`admin_local`, `manual_1723…_x` d'après routes.ts:4342).
- **Impact :** Une colonne entière du tableau desktop est inutile, et le mobile affiche du jargon technique aux employés.
- **Recommandation :** Ajouter `.leftJoin(users, eq(publicities.createdBy, users.id))` en sélectionnant `creator: { id: users.id, name: users.name, firstName: users.firstName, lastName: users.lastName, username: users.username }` (jamais password). Sinon, retirer la colonne « Créé par » du tableau et ne la garder que dans le détail.

### PUB-04

**Utilisateur rechargé en base dans chaque handler alors que deserializeUser l'a déjà chargé** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:4597`
- **Constat :** localAuth.ts:141-143 (et localAuth.production.ts:193-195) : `passport.deserializeUser(async (id) => { const user = await storage.getUserWithGroups(id); done(null, user); })`, donc req.user est déjà un UserWithGroups. Chaque handler ad-campaigns refait pourtant `await storage.getUserWithGroups(req.user.claims ? ... : req.user.id)` (routes.ts:4531, 4565, 4597, 4631, 4667, 4709, 4748 ; 106 occurrences dans routes.ts). getUserWithGroups enchaîne 2 requêtes (storage.ts:371-386 : getUser puis jointure user_groups).
- **Impact :** Chaque chargement de la liste coûte 2 allers-retours SQL séquentiels de plus : 6 requêtes au total, dont 4 avant d'atteindre les publicités. Cette latence s'ajoute à chaque appel et à chaque mutation.
- **Recommandation :** Limiter l'auto-implémentation aux handlers /api/ad-campaigns avec `const user = req.user as UserWithGroups` (en gardant `if (!user) return 404`). La fusion de getUser et user_groups en une seule requête est un chantier transverse, à traiter séparément.

### PUB-06

**Route /api/ad-campaigns/debug exposée et routes de suppression dupliquées** — dette-code, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:4529`
- **Constat :** routes.ts:4529 `app.get('/api/ad-campaigns/debug', isAuthenticated, ...)` est accessible à tout utilisateur connecté. Elle duplique le GET principal avec 3 console.log et renvoie `error: (error as Error).message` (l.4559). Aucun appel client (grep). routes.ts:4697-4735 (DELETE) et 4737-4774 (POST /:id/delete) sont deux copies quasi identiques. Côté client, Publicities.tsx:101-125 tente POST puis, sur 404, `fetch(`/api/ad-campaigns/${id}`, { method: 'DELETE' })` : ce repli ne s'exécute jamais puisque la route POST existe.
- **Impact :** Surface d'API inutile qui divulgue des messages d'erreur internes, et code dupliqué à maintenir deux fois.
- **Recommandation :** Serveur : supprimer GET /api/ad-campaigns/debug. Extraire un seul handler `deletePublicityHandler` monté sur `app.delete('/api/ad-campaigns/:id')` et `app.post('/api/ad-campaigns/:id/delete')`, et retirer `error: (error as Error).message` des réponses 500. Client : garder `fetch(`/api/ad-campaigns/${id}/delete`, { method: 'POST' })` avec la lecture du JSON d'erreur (`error.message`), en supprimant seulement le repli DELETE sur 404 et les console.log. Ne pas passer par apiRequest tant qu'il ne parse pas le message JSON.

### PUB-07

**Deux console.log identiques à chaque rendu, plus des logs dans queryFn et la mutation** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Publicities.tsx:75`
- **Constat :** Publicities.tsx:75-81 et 83-89 : deux blocs `console.log('📢 Publicities Debug:', { isLoading, publicitiesCount, selectedYear, selectedStoreId, publicities: publicities?.slice(0, 2) })` dans le corps du composant, sans garde DEV. Logs supplémentaires l.55, 66-69 (queryFn) et l.99, 109, 113, 131 (suppression). Calendar.tsx:146 les garde derrière `import.meta.env.DEV`.
- **Impact :** Deux logs avec sérialisation d'objets à chaque rendu (ouverture de modale, bascule de vue, survol…) en production. La console est polluée pour le support.
- **Recommandation :** Supprimer les logs des l.75-89 et ceux de queryFn et mutationFn, ou les entourer de `if (import.meta.env.DEV)`.

### PUB-08

**Vue annuelle, calendrier et stats recalculés à chaque rendu sans useMemo** — perf-client, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Publicities.tsx:229`
- **Constat :** l.229 `const yearWeeks = getYearWeeks();` s'exécute à chaque rendu, même quand showYearOverview vaut false. getWeekParticipation (l.156-192) filtre toutes les publicités avec 2 `safeDate()` (new Date) par pub pour chacune des 53 semaines, plus `groups.find` par magasin (l.188). l.480 `yearWeeks.filter(week => week.month === monthIndex)` est appelé 12 fois. La vue calendrier (l.622-628) fait 42 jours × N × 2 parses. Les stats (l.433-457) recalculent des filter avec new Date.
- **Impact :** Pour N=100, environ 19 000 créations de Date par rendu, refaites à chaque ouverture ou fermeture de modale ou bascule de vue. Les interactions deviennent lentes sur les PC de magasin peu puissants.
- **Recommandation :** Se limiter à de la mémoïsation pure, sans changer la logique de comparaison. `groupsById = useMemo(() => new Map(groups.map(g => [g.id, g])), [groups])`. `yearWeeks = useMemo(() => showYearOverview ? getYearWeeks() : [], [publicities, groupsById, selectedYear, showYearOverview])`. `weeksByMonth` pré-groupé en useMemo. Ne pas mémoïser les stats qui dépendent de `new Date()` (ou y inclure la date du jour dans les deps). Traiter la comparaison par chaînes dans PUB-09.

### PUB-09

**Fuseau horaire : 1er jour absent du calendrier, « Terminée » le dernier jour** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Publicities.tsx:624`
- **Constat :** L'API renvoie des dates 'YYYY-MM-DD'. `safeDate('2026-03-10')` vaut `new Date('2026-03-10')`, soit minuit UTC, donc 01:00 ou 02:00 heure de Paris. Calendrier l.627 : `day >= pubStart && day <= pubEnd` avec `day` à minuit local, donc le premier jour de la campagne n'est jamais affiché. Statut l.750-755 `now >= start && now <= end` et stats l.433-438 : le dernier jour passe « Terminée » dès 01:00 ou 02:00. Mobile l.61-69 : `parseISO(endDate)` vaut minuit local, donc `isWithinInterval(now, { start, end })` est faux toute la journée du dernier jour. À l'inverse, CalendarGrid.tsx:381 et 411 compare correctement des chaînes : `dateStr < pubStart || dateStr > pubEnd`.
- **Impact :** Les employés voient une promo « Terminée » le jour même où elle est encore en rayon, et le calendrier omet son jour de lancement. Les compteurs « En cours » sont faux.
- **Recommandation :** Créer un helper partagé `getPublicityStatus(pub, today = format(new Date(), 'yyyy-MM-dd'))` qui compare des chaînes 'yyyy-MM-dd' (ou utilise `endOfDay(parseISO(end))`). L'utiliser pour les badges desktop et mobile, les stats, l'export CSV (l.273-275) et la vue calendrier (`format(day,'yyyy-MM-dd')` comparé aux chaînes).

### PUB-10

**Numéros de semaine non ISO (décalés d'une semaine certaines années)** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Publicities.tsx:206`
- **Constat :** l.199-206 : `eachWeekOfInterval({ start: yearStart, end: yearEnd }, { weekStartsOn: 1 })` puis `const weekNumber = index + 1;`. La première semaine retournée est celle qui contient le 1er janvier. En 2027 (1er janvier un vendredi) et en 2028 (un samedi), la semaine du 28/12 est libellée « 1 » alors qu'en ISO c'est la S53 ou S52 de l'année précédente, et toute l'année est décalée de +1. `getWeek` est importé (l.12) mais jamais utilisé.
- **Impact :** En grande distribution, les plans promo sont exprimés en semaines ISO. La vue d'ensemble affiche une mauvaise semaine, d'où des erreurs de mise en rayon.
- **Recommandation :** Remplacer par `const weekNumber = getISOWeek(weekStart)` (date-fns) et ajuster le libellé du title (« S{n} »).

### PUB-12

**Liste vide trompeuse quand aucun magasin n'est sélectionné** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/PublicitiesPage.tsx:45`
- **Constat :** l.45 `if (!selectedStoreId) return [];` et l.53 `enabled: !!selectedStoreId && !!user`. MobileLayout.tsx:146-158 propose « Tous les magasins » (null) à l'admin, et MobileApp.tsx:37 n'auto-sélectionne un magasin que pour les directeurs et managers mono-magasin. Le message affiché est alors « Aucune publicité trouvée pour {selectedYear} » (l.122).
- **Impact :** L'admin, ou un employé sans magasin sélectionné, conclut qu'il n'y a aucune publicité alors que l'API sait répondre sans storeId (routes.ts:4605-4615).
- **Recommandation :** Appeler l'API sans storeId quand selectedStoreId est null (supprimer le `return []` et la condition enabled sur le magasin). Sinon, afficher un état explicite « Choisissez un magasin dans le menu ☰ » avec un bouton qui ouvre le menu.

### PUB-13

**Aucun état d'erreur : une panne s'affiche comme « aucune publicité »** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Publicities.tsx:572`
- **Constat :** l.42 `const { data: publicities = [], isLoading } = useQuery(...)` : isError n'est pas lu. Le serveur répond `res.status(500).json([])` (routes.ts:4625) et queryFn lance `throw new Error('Failed to fetch publicities')` (l.52). Après 2 tentatives, l'état vide l.576-593 s'affiche : « Aucune publicité pour 2026 / Commencez par créer votre première campagne publicitaire. » Même chose sur mobile (l.42 et l.119-123).
- **Impact :** En cas de panne réseau ou serveur, l'utilisateur pense que le planning est vide. Un admin peut même recréer des publicités existantes.
- **Recommandation :** Lire `isError` et `refetch`, puis afficher une carte « Impossible de charger les publicités. Vérifiez votre connexion. » avec un bouton « Réessayer ». Côté serveur, renvoyer `{ message: 'Erreur lors du chargement des publicités' }` avec le statut 500.

### PUB-14

**Requête sans keepPreviousData, staleTime ni enabled : flash à 0, double appel au montage** — perf-client, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Publicities.tsx:42`
- **Constat :** La clé `['/api/ad-campaigns', selectedYear, selectedStoreId]` n'a ni placeholderData, ni staleTime (défaut 30 s, queryClient.ts:79), ni enabled. Les cartes stats (l.418, 432-438, 453-457) et la vue d'ensemble (l.466) ne dépendent pas de isLoading : pendant chaque chargement ou changement d'année, on voit « Total 0 / En cours 0 / À venir 0 » et toutes les semaines grises. Layout.tsx:70-76 fixe selectedStoreId après /api/groups pour les directeurs et managers mono-magasin, donc la requête part avec storeId=null puis avec l'id. SavTickets.tsx:99 utilise pourtant `enabled: ... storeInitialized`.
- **Impact :** Clignotement et faux zéros à chaque changement d'année, et 2 appels API au premier affichage pour les managers et directeurs.
- **Recommandation :** Ajouter `staleTime: 5 * 60 * 1000` (les mutations invalident déjà la clé). Pour éviter l'appel en double, conditionner sur la fin du chargement de /api/groups plutôt que sur storeInitialized : par exemple `enabled: !!user && (user.role === 'admin' || groupsFetched)`, avec `groupsFetched = isFetched` de la requête ['/api/groups']. Utiliser `placeholderData: keepPreviousData` seulement avec un indicateur `isPlaceholderData` (opacité ou spinner), et afficher des Skeleton dans les stats quand isLoading. Le tout à valider visuellement.

### PUB-17

**PUT sans validation, écritures non transactionnelles (création, participations, suppression)** — bug, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:4681`
- **Constat :** PUT l.4678-4681 : `const { participatingGroups, ...publicityData } = req.body; await storage.updatePublicity(id, publicityData);` sans `insertPublicitySchema.partial().parse`. createdBy, id et tout champ inconnu arrivent directement dans `.set()` (storage.ts:1591-1597). Aucun 404 si l'id n'existe pas. POST : createPublicity (l.4649), puis setPublicityParticipations (l.4653), puis getPublicity (l.4657), hors transaction. setPublicityParticipations fait un DELETE puis un INSERT non atomiques (storage.ts:1630-1640). deletePublicity supprime manuellement les participations avec `.returning()` (storage.ts:1605) alors que la FK est `ON DELETE CASCADE` (migrations/0000_flashy_blur.sql:247, init.sql:461).
- **Impact :** Si l'insertion des participations échoue, la pub est créée mais l'utilisateur voit une erreur. S'il réessaie, il bute sur la contrainte unique du N°. Le PUT permet aussi de réécrire createdBy. Chaque écriture coûte 4 à 5 requêtes séquentielles.
- **Recommandation :** Envelopper création et mise à jour avec les participations dans `db.transaction(async tx => ...)`. Valider le PUT avec `insertPublicitySchema.partial().omit({ createdBy: true }).parse(publicityData)` et renvoyer 400 en cas de ZodError. Renvoyer 404 si `updatedPublicity` est undefined. Garder la suppression manuelle des participations dans deletePublicity, en retirant seulement `.returning()` et les logs.

### PUB-18

**Messages d'erreur génériques en anglais, N° en double non expliqué** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:4661`
- **Constat :** routes.ts:4661 `res.status(500).json({ message: "Failed to create publicity" })` est aussi renvoyé en cas de N° déjà existant (contrainte `pubNumber: varchar("pub_number").notNull().unique()`, shared/schema.ts:168). Autres messages : « Insufficient permissions » (l.4638, 4674), « Failed to update publicity » (l.4693), « Failed to delete publicity » (l.4732). Ils sont affichés tels quels dans les toasts (PublicityForm.tsx:79 et 91, Publicities.tsx:118, 128, 144). Côté client, `year: z.number().min(2020).max(2030)` (PublicityForm.tsx:27) n'a pas de message, ce qui donne « Number must be less than or equal to 2030 » ou « Expected number, received nan ».
- **Impact :** Un utilisateur non technicien lit de l'anglais et ne comprend pas qu'il doit simplement changer le numéro.
- **Recommandation :** Côté serveur, intercepter le code PG 23505 et renvoyer 409 « Ce numéro de publicité existe déjà ». Traduire tous les messages (« Vous n'avez pas les droits pour cette action », « Impossible d'enregistrer la publicité »). Côté Zod : `.min(2020, "Année invalide").max(..., "Année invalide")` et `invalid_type_error: "Saisissez une année"`.

### PUB-19

**Champ Année manuel, bornes incohérentes, filtrage par année saisie plutôt que par dates** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/components/PublicityForm.tsx:27`
- **Constat :** Le filtre d'année propose currentYear-2 à currentYear+10, soit 2024 à 2036 (Publicities.tsx:38-40), mais le formulaire limite à 2020-2030 (PublicityForm.tsx:27, 168-169). Valeur par défaut codée en dur `selectedYear || 2025` (l.56). L'année est saisie à la main, indépendamment des dates (commentaire l.61). L'API filtre sur cette colonne (storage.ts:1517-1519) et non sur les dates : une campagne du 28/12/2026 au 03/01/2027 saisie en 2026 n'apparaît pas dans le calendrier ni la vue d'ensemble de janvier 2027.
- **Impact :** Champ de plus à remplir, source d'erreurs (année ne correspondant pas aux dates), création impossible depuis le filtre 2031 et au-delà, et campagnes de fin d'année invisibles en janvier.
- **Recommandation :** Pré-remplir l'année depuis la date de début (modifiable), ou la calculer côté serveur. Aligner les bornes partout (par exemple currentYear-5 à currentYear+2). Pour les vues calendrier et semaines, filtrer côté serveur par chevauchement `start_date <= 'YYYY-12-31' AND end_date >= 'YYYY-01-01'` (l'index idx_publicities_start_date existe).

### PUB-20

**Formulaire : erreurs qui persistent, alerte rouge sur un champ optionnel, watch global** — ux-simplicite, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/components/PublicityForm.tsx:215`
- **Constat :** `form.setValue("startDate", date!)` (l.215, 253) et `form.setValue("participatingGroups", ...)` (l.285-287) sont appelés sans `{ shouldValidate: true }` : après un envoi raté, « La date de début est requise » reste affiché même une fois la date choisie. Recliquer la date la désélectionne (`date!` vaut undefined). Le bloc rouge « Aucun magasin sélectionné » (l.304-308) s'affiche alors que le champ est indiqué « (optionnel) » (l.273). Pas de « Tout sélectionner ». `form.watch(...)` est appelé une dizaine de fois au rendu (l.199-304), ce qui re-rend tout le formulaire à chaque frappe.
- **Impact :** Messages contradictoires et erreurs fantômes qui bloquent ou inquiètent l'utilisateur. Cocher 10 magasins un par un est fastidieux.
- **Recommandation :** Utiliser `setValue(name, value, { shouldValidate: form.formState.isSubmitted, shouldDirty: true })` et ignorer `undefined` dans onSelect (`if (date) ...`). Remplacer le bloc rouge par une note grise neutre, ou rendre le champ obligatoire (décision produit). Ajouter « Tous » et « Aucun ». Le remplacement de watch par useWatch est optionnel, car le gain de performance est négligeable.

### PUB-21

**En-tête surchargé : 7 contrôles sur une ligne, non responsive** — lisibilite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Publicities.tsx:321`
- **Constat :** l.321-404 : `<div className="flex items-center gap-3">` sans flex-wrap, contenant le toggle Liste/Grille (icônes seules), le bouton « Vue d'ensemble », l'icône Filtre et le Select année, le Select mois (vue calendrier), « Exporter CSV » et « Nouvelle publicité ». L'en-tête `p-6 -m-6 mb-6` (l.309) n'est pas responsive alors que Layout passe à `p-3` en tablette avec `overflow-x-hidden` (Layout.tsx:211) : l'en-tête déborde et est rogné. Orders.tsx:233 et Avoirs.tsx:1156 utilisent `p-4 sm:p-6 -m-4 sm:-m-6`.
- **Impact :** L'utilisateur ne sait pas par où commencer. Sur tablette ou petit portable, des boutons sont coupés. « CSV » est du jargon.
- **Recommandation :** Remplacer le toggle et « Vue d'ensemble » par des onglets texte « Liste | Calendrier | Année ». Placer les filtres (année, recherche) à gauche et les actions à droite avec `flex flex-wrap gap-2`. Renommer « Exporter (Excel) » et reprendre l'en-tête responsive d'Orders.tsx.

### PUB-22

**Tableau 7 colonnes non scrollable : colonne Actions coupée en tablette** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Publicities.tsx:720`
- **Constat :** l.720-721 : `<div><table className="w-full">` sans `overflow-x-auto`, 7 colonnes en `px-6`. Entre 768 et 1024 px, c'est la version desktop qui s'affiche (RouterProduction.tsx:106 `if (isMobile)`, isMobile correspondant à moins de 768 px dans use-screen-size.ts), et le conteneur de Layout est `overflow-x-hidden` (Layout.tsx:211).
- **Impact :** Sur tablette, les boutons Voir, Modifier et Supprimer peuvent être hors écran et inaccessibles.
- **Recommandation :** Auto-implémenter uniquement `<div className="overflow-x-auto">` autour du tableau (l.720). Le passage à px-4 et `hidden lg:table-cell` sur « Créé par » sont à valider visuellement (voir aussi PUB-03).

### PUB-23

**Liste desktop sans recherche ni filtre de statut, libellés abrégés, lignes non cliquables** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Publicities.tsx:748`
- **Constat :** l.748 `publicities.map(...)` : aucune recherche ni filtre par statut ou magasin, alors que le mobile a « Rechercher une pub... » (PublicitiesPage.tsx:89-94). Tri uniquement par N°. En-tête « N° PUB » en majuscules (l.725), période en `dd/MM/yy` (l.771). Le détail n'est accessible que par l'icône œil (l.812-819), la ligne elle-même n'est pas cliquable. Les cartes stats En cours / À venir (l.424-462) ne sont pas cliquables.
- **Impact :** Pour retrouver « la promo de la semaine prochaine », l'utilisateur doit parcourir toute l'année et lire les dates une par une.
- **Recommandation :** Ajouter un champ de recherche (N° ou désignation) et des puces de filtre « En cours / À venir / Terminées », en rendant les cartes stats cliquables comme filtres. Trier par défaut En cours puis À venir avant les Terminées. Rendre la ligne cliquable pour ouvrir le détail. Libellé « Numéro », dates en `dd/MM/yyyy`.

### PUB-24

**Vue d'ensemble affichée par défaut, info uniquement au survol, légende sans noms** — lisibilite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/Publicities.tsx:466`
- **Constat :** `useState(true)` pour showYearOverview (l.22) : la grille de 12 colonnes et sa légende passent avant la liste. Les cellules ont `cursor-pointer` (l.496) mais pas de onClick, et l'information n'est donnée que par `title` (l.503), inaccessible au tactile. Les pastilles magasins font `w-1.5 h-1.5` (6 px, l.512) avec `title={`Magasin ${idx + 1}`}` (l.514) au lieu du nom. La légende « Indicateurs magasins (coin supérieur droit) » montre 3 couleurs sans nom (l.551-559).
- **Impact :** La tâche principale (la liste) est repoussée sous la ligne de flottaison. Les pastilles sont illisibles, la légende inexploitable et le curseur promet un clic qui ne fait rien.
- **Recommandation :** Replier la vue par défaut ou la déplacer dans un onglet « Année ». Rendre chaque semaine cliquable pour filtrer la liste ou ouvrir un popover listant ses pubs. Légende avec chaque magasin (couleur et nom), pastilles d'au moins 8 px, title avec le nom du magasin.

### PUB-30

**« Publicités à venir » : 3 appels séquentiels d'années complètes faute de filtre API** — perf-api, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/Dashboard.tsx:197`
- **Constat :** Dashboard.tsx:203-218 : `for (const year of years) { ... await fetch(`/api/ad-campaigns?${params}`) ... }` sur [année-1, année, année+1], puis `.filter(p => new Date(p.startDate) > new Date())` côté client. Chaque réponse contient toutes les participations, avec logos (PUB-02).
- **Impact :** La page d'accueil attend 3 allers-retours successifs et télécharge 3 années complètes pour afficher quelques pubs à venir.
- **Recommandation :** Ajouter un paramètre `GET /api/ad-campaigns?upcoming=1&limit=5`, traité par `WHERE start_date >= CURRENT_DATE ORDER BY start_date LIMIT 5` (index idx_publicities_start_date présent) avec filtre magasin. À défaut, paralléliser avec Promise.all.

### PUB-05

**console.log dans le chemin chaud de lecture et logs verbeux sur la suppression** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/storage.ts:1525`
- **Constat :** storage.ts:1525-1528 à chaque GET : `console.log(`📋 PUBLICITES FETCHED: ...`)` et `console.log('🔍 PREMIERS RESULTATS:', results.slice(0, 3).map(... p.designation))`. deletePublicity l.1601-1617 : 4 logs. routes.ts:4699-4728 et 4739-4767 : dump de req.user, des headers et du nom de l'admin.
- **Impact :** Écritures stdout synchrones à chaque chargement en production, logs bruités et données métier (désignations) dans les journaux.
- **Recommandation :** Supprimer ces logs ou les conditionner à `process.env.NODE_ENV !== 'production'` ou à un logger de niveau debug. Ne garder que console.error dans les catch.

### PUB-15

**Triple tri (SQL, serveur JS, client JS) incompatible avec le format de N° suggéré** — perf-client, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Publicities.tsx:57`
- **Constat :** SQL `query.orderBy(publicities.pubNumber)` (storage.ts:1522), puis tri JS `parseInt(a.pubNumber) || 0` (storage.ts:1544-1548), puis le même tri côté client, qui mute le tableau `data.sort(...)` (Publicities.tsx:57-64). Le formulaire suggère « Ex: PUB2025-001 » (PublicityForm.tsx:155) : parseInt renvoie NaN, remplacé par 0, donc ces numéros ne sont pas triés numériquement.
- **Impact :** Travail redondant et ordre imprévisible si les formats de N° sont mélangés.
- **Recommandation :** Sans risque : supprimer seulement le tri client de Publicities.tsx:57-64, qui duplique exactement celui du serveur (mobile et Calendar s'appuient déjà sur l'ordre serveur), ainsi que les logs associés. Garder l'orderBy SQL tant que le comparateur parseInt est en place. Le passage à `localeCompare(..., 'fr', { numeric: true })` est une amélioration distincte, à valider car l'ordre change pour les N° mixtes.

### PUB-16

**Association participations ↔ publicités en O(N×M) et 2 requêtes séquentielles** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:1550`
- **Constat :** storage.ts:1550-1559 : `sortedResults.map(publicity => ({ ...publicity, participations: participations.filter((p: any) => p.publicityId === publicity.id).map(...) }))` parcourt toutes les participations pour chaque publicité. La requête participations (l.1531-1541) attend la fin de la requête publicities.
- **Impact :** Coût CPU quadratique sur les années chargées, et un aller-retour BD de plus.
- **Recommandation :** Se limiter au regroupement en mémoire : `const byPub = new Map<number, any[]>(); for (const p of participations) { (byPub.get(p.publicityId) ?? byPub.set(p.publicityId, []).get(p.publicityId)!).push({ publicityId: p.publicityId, groupId: p.groupId, group: p.group }); }` puis `participations: byPub.get(publicity.id) ?? []`. Garder les deux requêtes séquentielles.

### PUB-25

**Vue calendrier : seul le N° est affiché, pas de navigation mois par mois, doublon avec /calendar** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Publicities.tsx:651`
- **Constat :** Chaque jour n'affiche que `{pub.pubNumber}` (l.657), la désignation n'étant que dans `title` (l.655). La navigation passe uniquement par le Select mois (l.374-390), sans flèches précédent/suivant. La page /calendar (CalendarGrid.tsx:380-442) affiche déjà les publicités, avec un filtrage magasin correct.
- **Impact :** Un numéro seul ne dit rien à un employé, et deux calendriers différents coexistent pour la même information.
- **Recommandation :** Afficher « N° – désignation » tronqué et ajouter des boutons ‹ ›. Envisager de supprimer ce mode et de proposer un lien « Voir dans le calendrier » vers /calendar.

### PUB-26

**Icônes, badges de statut, CTA et confirmation incohérents** — coherence-design, sévérité basse, effort S

- **Fichier :** `client/src/pages/Publicities.tsx:775`
- **Constat :** Icône de page `Calendar` verte (l.313), contre `Megaphone` dans Sidebar.tsx:293-296 et `Megaphone` violet sur mobile (PublicitiesPage.tsx:81). Les 3 cartes stats ont la même icône Calendar (l.413, 427, 448). Badge « En cours » `bg-green-100 text-green-800` sur desktop (l.775) contre `bg-green-500` sur mobile (l.67). La variante default du Badge garde `hover:bg-primary/80` (ui/badge.tsx:11-12) : « En cours » et « À venir » changent de couleur au survol, alors que « Aucun magasin » contourne le problème avec `hover:bg-red-100` (l.782). La même action a deux styles : « Nouvelle publicité » `bg-green-600` (l.399) et « Créer une publicité » en variante par défaut (l.587). L'état vide « Commencez par créer votre première campagne » (l.583-585) s'affiche aussi aux non-admins. La confirmation de suppression est un Dialog maison (l.964-995) alors que components/ConfirmationModal.tsx existe et qu'Avoirs utilise AlertDialog (Avoirs.tsx:1603).
- **Impact :** L'utilisateur doit réapprendre les codes d'une page à l'autre et entre téléphone et PC, ce qui nuit à la lisibilité.
- **Recommandation :** Créer un composant partagé `PublicityStatusBadge` (variant outline avec couleurs fixes, sans hover) utilisé par desktop et mobile. Icône Megaphone partout et icônes distinctes pour les stats. Un seul libellé et style « Nouvelle publicité ». Message vide adapté au rôle. Réutiliser ConfirmationModal (variant destructive).

### PUB-27

**Boutons Liste/Grille sans nom accessible ni infobulle** — accessibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Publicities.tsx:324`
- **Constat :** l.324-339 : `<Button variant={viewMode === 'list' ? 'default' : 'ghost'} ...><List className="h-4 w-4" /></Button>` et `<Grid .../>` n'ont ni texte, ni aria-label, ni title. Les boutons d'action des lignes n'ont qu'un `title` (l.816, 827, 837). Les cellules de semaine sont des div non focusables (l.493).
- **Impact :** Lecteurs d'écran muets, et aucun indice pour l'utilisateur sur ce que fait l'icône « Grille » (qui ouvre en fait un calendrier).
- **Recommandation :** Ajouter `aria-label="Affichage liste"` / `"Affichage calendrier"`, `title` et `aria-pressed`. Ajouter aussi `aria-label` sur Voir, Modifier et Supprimer.

### PUB-28

**Code mort et requête groups redondante avec StoreContext** — dette-code, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/Publicities.tsx:303`
- **Constat :** `const canCreateOrEdit = user?.role === 'admin' || user?.role === 'manager';` et `const canDelete = ...` (l.303-304) ne sont jamais utilisés, et le premier contredit shared/permissions.ts:61-66 (manager : view). Imports inutilisés : `isWithinInterval`, `getWeek` (l.12), `safeCompareDate` (l.14). `useQuery(['/api/groups'])` (l.91-94) duplique `stores`, déjà exposé par `useStore()` (Layout.tsx:48-51, 86).
- **Impact :** Le code induit en erreur (on croit que les managers peuvent éditer) et le bundle est alourdi.
- **Recommandation :** Supprimer canCreateOrEdit, canDelete et les imports inutilisés (isWithinInterval, getWeek, safeCompareDate). Remplacer la requête par `const { selectedStoreId, stores: groups } = useStore();`. Ce n'est qu'une simplification de code, sans gain réseau.

### PUB-29

**Invalidation par préfixe après mutation : la réponse serveur complète est ignorée** — perf-api, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/components/PublicityForm.tsx:84`
- **Constat :** `queryClient.invalidateQueries({ queryKey: ['/api/ad-campaigns'] })` est appelé après création (l.84), modification (l.117) et suppression (Publicities.tsx:136). Le serveur renvoie pourtant déjà la publicité complète (routes.ts:4656-4658 et 4688-4690). Le préfixe marque aussi comme périmée la clé ['/api/ad-campaigns','upcoming'] du Dashboard (3 appels séquentiels).
- **Impact :** Rechargement complet de la liste après chaque action (6 requêtes SQL et le payload entier), donc un délai perceptible avant que la ligne apparaisse.
- **Recommandation :** Garder l'invalidation par préfixe, qui est simple et correcte. Au plus, ajouter une mise à jour optimiste sur la suppression (retirer l'élément de la clé courante avec rollback onError), puis invalider.

### PUB-31

**Modale création/édition sans hauteur max : boutons hors écran avec beaucoup de magasins** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/Publicities.tsx:857`
- **Constat :** `<DialogContent className="max-w-2xl">` (l.857, 874). Le DialogContent de base est `fixed top-[50%] translate-y-[-50%] grid ... p-6`, sans max-h ni overflow (ui/dialog.tsx:41). Le formulaire grandit avec la grille de magasins (PublicityForm.tsx:276-302), le bloc rouge et le textarea.
- **Impact :** Sur un portable de 768 px de haut avec une dizaine de magasins, les boutons Créer et Annuler sortent de l'écran sans possibilité de défiler.
- **Recommandation :** `className="max-w-2xl max-h-[90vh] overflow-y-auto"` sur les deux DialogContent, ou un footer collant pour les boutons.

### PUB-32

**Pages Publicités et formulaire importés statiquement dans le bundle initial** — perf-bundle, sévérité basse, effort M — vérification : partiellement confirmé

- **Fichier :** `client/src/components/RouterProduction.tsx:15`
- **Constat :** RouterProduction.tsx:15 `import Publicities from "@/pages/Publicities";` et l.40 `import MobilePublicitiesPage ...`, chargés avec toutes les autres pages. Publicities embarque PublicityForm (react-hook-form, zod, @hookform/resolvers, react-day-picker via ui/calendar, locale date-fns) alors que seuls les admins créent.
- **Impact :** JavaScript chargé et parsé au démarrage pour une page secondaire, ce qui allonge le premier affichage du Dashboard.
- **Recommandation :** Traiter le lazy loading au niveau du routeur pour toutes les pages (React.lazy et Suspense avec un fallback squelette), comme chantier transverse. Ne pas présenter le lazy de Publicities seule comme un gain sur RHF, zod ou day-picker.

### PUB-33

**Mobile : pas de détail, pas de magasins participants, pas de priorisation des pubs en cours** — ux-simplicite, sévérité basse, effort M

- **Fichier :** `client/src/pages/mobile/PublicitiesPage.tsx:119`
- **Constat :** Les cartes (l.126-155) ne sont pas cliquables et n'affichent ni `participations` ni la période complète (`dd/MM` pour le début, l.146). Tri par N° hérité du serveur. Le message « Aucune publicité trouvée pour {selectedYear} » (l.122) est le même pour une année vide et pour une recherche sans résultat. Données typées `any` (l.56, 125).
- **Impact :** En rayon, l'employé veut savoir ce qui est en cours maintenant et si son magasin participe : il doit faire défiler toute l'année sans cette information.
- **Recommandation :** Grouper les cartes par sections « En cours », « À venir » et « Terminées » (repliée). Afficher les pastilles des magasins participants et un Sheet de détail au tap. Message « Aucun résultat pour « xxx » » avec un bouton Effacer. Typer avec `PublicityWithRelations[]`.

### PUB-34

**Trois queryFn différents et clés incohérentes pour le même endpoint** — dette-code, sévérité basse, effort M

- **Fichier :** `client/src/pages/mobile/PublicitiesPage.tsx:43`
- **Constat :** Desktop : clé `['/api/ad-campaigns', selectedYear, selectedStoreId]`, storeId envoyé pour tous les rôles (Publicities.tsx:43-49). Calendar : même clé mais storeId envoyé seulement pour l'admin (Calendar.tsx:137-142), donc une même entrée de cache pour deux URLs différentes. Mobile : `["/api/ad-campaigns", selectedStoreId, selectedYear]` dans l'ordre inverse (l.43), donc pas de partage de cache. Partout des fetch() manuels au lieu d'apiRequest ou du queryFn par défaut (queryClient.ts:47-66, qui gère le 401).
- **Impact :** Données potentiellement différentes sous une même clé, aucun cache partagé entre écrans, et chaque correction (fuseau, tri, erreurs) doit être faite 3 fois.
- **Recommandation :** Créer un hook `usePublicities({ year, storeId })` dans client/src/hooks avec une clé unique `['/api/ad-campaigns', { year, storeId }]`, staleTime, keepPreviousData et gestion d'erreur. L'utiliser dans Publicities, la page mobile, Calendar et Dashboard.

### PUB-35

**Index publicities/participations hors de shared/schema.ts, index group_id non garanti** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `shared/schema.ts:166`
- **Constat :** shared/schema.ts:166-184 ne déclare aucun index (seulement l'unique sur pub_number et la PK (publicity_id, group_id)). idx_publicities_year et idx_publicities_start_date existent dans init.sql:521-523 et migrations/0000_flashy_blur.sql:260-261. idx_publicity_participations_group_id n'existe que dans migrations/20260814_add_performance_indexes.sql:86 et scripts/auto-migrate-production.sh:213 : il est absent d'init.sql et de la liste server/migrations.ts. drizzle.config.ts pointe sur shared/schema.ts (`db:push`: drizzle-kit push).
- **Impact :** Une fois PUB-01 corrigé (filtre par group_id), une installation neuve sans le script de production fera un seq scan sur publicity_participations. La source de vérité des index est éclatée entre plusieurs fichiers.
- **Recommandation :** Ajouter `CREATE INDEX IF NOT EXISTS idx_publicity_participations_group_id ON publicity_participations (group_id);` dans init.sql et dans server/migrations.production.ts, qui est réellement exécuté au démarrage, et non dans server/migrations.ts. Déclarer en option les index dans shared/schema.ts (yearIdx, startIdx, groupIdx) avec les mêmes noms, pour que `drizzle-kit push` ne les supprime pas.
