# SAV

_38 constats vérifiés — 8 haute, 17 moyenne, 13 basse._

## Pages analysées

### `/sav (desktop)`

**Rôle :** Suivre les retours SAV (produits défectueux, pièces manquantes...) d'un magasin : créer un ticket, suivre son statut et sa priorité, échanger des commentaires, supprimer un ticket.

**Tâches principales de l'utilisateur :**
- Créer un ticket SAV (produit, fournisseur, client, problème, priorité)
- Retrouver un ticket (recherche texte + filtres statut/priorité/fournisseur)
- Ouvrir le suivi d'un ticket et changer son statut ou sa priorité
- Ajouter un commentaire de suivi
- Modifier un ticket (bouton crayon)
- Supprimer un ticket (admin/directeur)

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/sav/tickets?status=&priority=&supplierId=&groupId= | au montage puis à chaque changement de filtre statut/priorité/fournisseur (nouvelle queryKey) | server/routes.ts:5242 -> storage.getUserWithGroups (2 requêtes) + storage.getSavTickets (server/storage.ts:2656) | Aucune pagination/LIMIT ; SELECT de lignes complètes savTickets + suppliers + groups (dont logo base64, config SMTP/NocoDB) + users (dont hash du mot de passe) ; Promise.all de getSavTicketHistory par ticket (no-op actuellement) ; 3 console.log par appel. |
| GET /api/sav/stats?groupId= | au montage (queryFn fetch manuel, staleTime 2 min) | server/routes.ts:5524 -> storage.getUserWithGroups + storage.getSavTicketStats (server/storage.ts:2818) | 3 requêtes SQL séquentielles (group by status, group by priority, count) + variable baseQuery morte ; 'Critiques' compte aussi les tickets résolus/fermés. |
| GET /api/suppliers | au montage (staleTime 10 min) | server/routes.ts:1141 -> storage.getUser + storage.getSuppliers (server/storage.ts:467) | Liste complète de tous les fournisseurs pour 2 Select sans recherche (filtre + formulaire). |
| GET /api/groups | au montage (même clé que Layout.tsx:49, donc dédupliqué) | server/routes.ts:970 -> storage.getUserWithGroups + storage.getGroups (server/storage.ts:432) | Utilisé uniquement pour le formulaire de création ; StoreContext expose déjà `stores`. |
| GET /api/sav/tickets/:id | ouverture de la modale de suivi (staleTime 0, déclaré 2 fois lignes 142 et 376) | server/routes.ts:5288 -> storage.getUserWithGroups + storage.getSavTicket (server/storage.ts:2720) | Renvoie les mêmes données que la liste (history toujours []), donc requête redondante à chaque ouverture. |
| POST /api/sav/tickets | clic 'Créer le ticket' | server/routes.ts:5319 -> getUserWithGroups + getGroups (admin) + storage.createSavTicket (server/storage.ts:2747) | Numéro de ticket généré dans la route puis écrasé par un count(*) annuel dans storage (doublons possibles). |
| PATCH /api/sav/tickets/:id | changement de Statut ou Priorité dans 'Actions Rapides' (sauvegarde immédiate) | server/routes.ts:5390 -> getUserWithGroups + getSavTicket (3 jointures) + storage.updateSavTicket (server/storage.ts:2773) + addSavTicketHistory (no-op) | resolvedAt/closedAt jamais renseignés ; changement de statut non historisé. |
| POST /api/sav/tickets/:id/history | clic 'Ajouter commentaire' | server/routes.ts:5471 -> getUserWithGroups + getSavTicket + storage.addSavTicketHistory (server/storage.ts:2808, renvoie null sans rien écrire) | Le commentaire est perdu alors que l'UI affiche 'Commentaire ajouté'. |
| DELETE /api/sav/tickets/:id | confirmation dans la modale de suppression | server/routes.ts:5443 -> storage.getUser + getSavTicket + storage.deleteSavTicket (server/storage.ts:2783) | Aucun contrôle d'appartenance au magasin pour un directeur. |

**Lisibilité / simplicité :** Page lisible dans sa structure (en-tête, 5 compteurs, filtres, grille de cartes) mais plusieurs fonctions visibles ne marchent pas : le bouton crayon ouvre un formulaire complet dont 'Sauvegarder' affiche 'Fonction en développement', les commentaires affichent un succès mais ne sont jamais enregistrés (historique toujours vide), et la liste ne se rafraîchit pas après création/suppression dès qu'un filtre ou un magasin est sélectionné (staleTime 5 min). Des codes techniques sont affichés tels quels ('pieces_manquantes', 'status_change', 'Statut changé de "en_cours" vers "resolu"'), avec 'N/A' et des emojis. Les cartes ont un curseur 'main' mais ne sont pas cliquables ; les actions sont 3 petites icônes sans libellé. La modale de détail (max-w-6xl, 5 cartes à gauche, overflow-hidden) coupe le bloc 'Actions Rapides' sur des écrans de portable. Le badge 'Nouveau' (commentaire récent) se confond avec le statut 'Nouveau', et les couleurs priorité/statut se chevauchent. Les tickets fermés restent mélangés aux tickets ouverts, sans pagination. Les états d'erreur ne sont pas gérés : une panne API affiche 'Aucun ticket trouvé'. La console est inondée de logs à chaque frappe.

### `/sav (mobile)`

**Rôle :** Version téléphone du SAV : consulter les tickets du magasin, appeler le client, changer rapidement le statut et créer un ticket depuis la surface de vente.

**Tâches principales de l'utilisateur :**
- Rechercher un ticket (n°, client, produit)
- Appeler le client (bouton 'Appeler')
- Changer le statut via le menu ⋮
- Créer un ticket via le bouton flottant +

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /api/sav-tickets?storeId= | au montage (enabled si selectedStoreId) | AUCUN handler (seul /api/sav/tickets existe, server/routes.ts:5242) -> 404 Express en production (index.production.ts:157-160 fait next() pour /api/) | La liste est toujours vide : l'erreur est masquée par l'état vide 'Aucun ticket SAV'. |
| GET /api/suppliers | au montage (queryFn apiRequest, staleTime par défaut 30 s) | server/routes.ts:1141 -> storage.getSuppliers | Nécessaire uniquement pour le formulaire de création. |
| GET /api/groups | au montage | server/routes.ts:970 -> storage.getGroups / userGroups | Utilisé seulement en repli dans onSubmit (admin sans magasin). |
| PATCH /api/sav-tickets/:id/status | clic sur un statut dans le menu ⋮ | AUCUN handler | Valeurs envoyées en anglais ('in_progress', 'waiting_parts', 'resolved', 'closed') hors de l'enum serveur ; pas de onError. |
| POST /api/sav-tickets | submit du formulaire 'Créer le ticket' | AUCUN handler | En production : toast d'erreur contenant le HTML brut du 404. |

**Lisibilité / simplicité :** Interface mobile simple et bien pensée (cartes compactes, bouton 'Appeler', bouton flottant), mais entièrement non fonctionnelle : elle appelle des endpoints /api/sav-tickets inexistants, donc la liste est toujours vide et la création comme le changement de statut échouent. Les erreurs de validation du formulaire ne s'affichent jamais (FormMessage absent). Le bouton + est visible pour les employés alors que le serveur refuse la création. Il n'y a ni vue détail, ni commentaires, ni confirmation avant 'Fermer'. Les libellés et couleurs divergent du desktop (badge 'Pièces' au lieu de 'Attente pièces', 'attente_echange' affiché en code brut, violet au lieu de bleu), avec du jargon ('Gencode (EAN13)', placeholder 'Scanner...' sans scanner).

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [MSAV-01](#msav-01) | haute | bug | S | La page mobile appelle des endpoints inexistants (/api/sav-tickets) : SAV mobile inutilisable | `client/src/pages/mobile/SavPage.tsx:88` |
| [MSAV-02](#msav-02) | haute | bug | S | Valeurs de statut en anglais, hors de l'enum serveur | `client/src/pages/mobile/SavPage.tsx:230` |
| [SAV-01](#sav-01) | haute | bug | S | La liste ne se rafraîchit pas après création/modification/suppression (queryKey incompatible avec l'invalidation) | `client/src/pages/SavTickets.tsx:98` |
| [SAV-02](#sav-02) | haute | bug | M | Les commentaires et l'historique ne sont jamais enregistrés, mais l'UI affiche un succès | `server/storage.ts:2808` |
| [SAV-03](#sav-03) | haute | ux-simplicite | S | Bouton 'Modifier' : formulaire complet dont la sauvegarde n'est pas implémentée | `client/src/pages/SavTickets.tsx:1338` |
| [SAV-04](#sav-04) | haute | bug | S | Le hash du mot de passe du créateur est envoyé au navigateur pour chaque ticket | `server/storage.ts:2669` |
| [SAV-05](#sav-05) | haute | perf-api | S | Chaque ticket embarque la ligne magasin complète, logo base64 et config SMTP/NocoDB compris | `server/storage.ts:2668` |
| [SAV-06](#sav-06) | haute | bug | S | Un utilisateur non admin sans magasin assigné voit les tickets de tous les magasins | `server/routes.ts:5272` |
| [MSAV-03](#msav-03) | moyenne | ux-simplicite | S | Les erreurs de validation du formulaire mobile ne s'affichent jamais | `client/src/pages/mobile/SavPage.tsx:283` |
| [MSAV-04](#msav-04) | moyenne | ux-simplicite | S | Bouton + et menu de statut visibles pour les employés, qui n'ont pas le droit | `client/src/pages/mobile/SavPage.tsx:397` |
| [MSAV-05](#msav-05) | moyenne | ux-simplicite | M | Mobile : ni détail, ni commentaires, ni confirmation de fermeture, ni gestion d'erreur du statut | `client/src/pages/mobile/SavPage.tsx:106` |
| [SAV-07](#sav-07) | moyenne | bug | S | Création par un admin : ticket rattaché au premier magasin alphabétique et non au magasin sélectionné | `client/src/pages/SavTickets.tsx:337` |
| [SAV-08](#sav-08) | moyenne | bug | S | Le formulaire 'Nouveau Ticket' est pré-rempli avec le dernier ticket ouvert en modification | `client/src/pages/SavTickets.tsx:400` |
| [SAV-09](#sav-09) | moyenne | bug | S | DELETE : aucun contrôle d'appartenance au magasin | `server/routes.ts:5446` |
| [SAV-10](#sav-10) | moyenne | perf-serveur | S | Chaque route SAV recharge l'utilisateur et ses magasins déjà fournis par la session | `server/routes.ts:5245` |
| [SAV-11](#sav-11) | moyenne | perf-serveur | S | Statistiques SAV : 3 requêtes séquentielles au lieu d'une seule | `server/storage.ts:2832` |
| [SAV-12](#sav-12) | moyenne | perf-serveur | M | Schéma N+1 : un appel getSavTicketHistory par ticket de la liste | `server/storage.ts:2704` |
| [SAV-13](#sav-13) | moyenne | perf-api | M | Liste sans pagination ni limite, rendue entièrement en cartes | `server/storage.ts:2701` |
| [SAV-14](#sav-14) | moyenne | perf-client | S | Chaque changement de filtre vide la liste et affiche un spinner (aucun placeholderData) | `client/src/pages/SavTickets.tsx:97` |
| [SAV-15](#sav-15) | moyenne | dette-code | S | console.log de debug exécutés à chaque rendu (chaque frappe clavier) | `client/src/pages/SavTickets.tsx:294` |
| [SAV-18](#sav-18) | moyenne | lisibilite | S | Codes techniques, anglais et emojis affichés à l'utilisateur | `client/src/pages/SavTickets.tsx:1034` |
| [SAV-19](#sav-19) | moyenne | ux-simplicite | S | Modale de suivi trop chargée : 'Actions Rapides' coupé en bas sur écran de portable | `client/src/pages/SavTickets.tsx:966` |
| [SAV-20](#sav-20) | moyenne | accessibilite | S | Cartes non cliquables malgré cursor-pointer ; actions en icônes minuscules sans libellé | `client/src/pages/SavTickets.tsx:846` |
| [SAV-22](#sav-22) | moyenne | ux-simplicite | S | Compteurs trompeurs et non cliquables (Critiques inclut les tickets clos, Résolus inclut Fermés) | `server/storage.ts:2882` |
| [SAV-23](#sav-23) | moyenne | ux-simplicite | S | Pas d'état d'erreur, état vide sans action, et compteurs qui apparaissent en décalant la page | `client/src/pages/SavTickets.tsx:832` |
| [MSAV-06](#msav-06) | basse | coherence-design | S | Libellés et couleurs de statut différents du desktop ; statut 'attente_echange' affiché brut | `client/src/pages/mobile/SavPage.tsx:165` |
| [MSAV-07](#msav-07) | basse | lisibilite | S | Jargon 'Gencode (EAN13)' et placeholder 'Scanner...' sans scanner | `client/src/pages/mobile/SavPage.tsx:284` |
| [MSAV-08](#msav-08) | basse | dette-code | S | Imports inutilisés et requêtes chargées au montage pour un formulaire fermé | `client/src/pages/mobile/SavPage.tsx:100` |
| [MSAV-09](#msav-09) | basse | ux-simplicite | S | Erreur ou absence de magasin sélectionné affichée comme 'Aucun ticket SAV' | `client/src/pages/mobile/SavPage.tsx:202` |
| [SAV-16](#sav-16) | basse | perf-serveur | S | Logs console sur chaque requête GET SAV (chemin chaud) | `server/routes.ts:5258` |
| [SAV-17](#sav-17) | basse | dette-code | S | Requête de détail déclarée deux fois, plus fetch manuels incohérents | `client/src/pages/SavTickets.tsx:376` |
| [SAV-21](#sav-21) | basse | coherence-design | S | Badges ambigus : 'Nouveau' commentaire contre statut 'Nouveau', couleurs priorité/statut qui se chevauchent | `client/src/pages/SavTickets.tsx:856` |
| [SAV-24](#sav-24) | basse | ux-simplicite | S | Changement de statut/priorité enregistré immédiatement, sans confirmation, avec un message inexact | `client/src/pages/SavTickets.tsx:1123` |
| [SAV-25](#sav-25) | basse | ux-simplicite | S | Les tickets fermés sont mélangés aux tickets à traiter par défaut | `client/src/pages/SavTickets.tsx:59` |
| [SAV-26](#sav-26) | basse | bug | S | Numéros de ticket dupliqués possibles (count(*) + 1) et génération en double | `server/storage.ts:2750` |
| [SAV-27](#sav-27) | basse | perf-serveur | S | Index SAV absents du schéma Drizzle, pas d'index composite magasin+date ni fournisseur | `shared/schema.ts:869` |
| [SAV-28](#sav-28) | basse | ux-simplicite | M | Formulaire de création : fournisseur sans recherche et validation non localisée | `client/src/pages/SavTickets.tsx:536` |
| [SAV-29](#sav-29) | basse | perf-bundle | S | Pages SAV desktop et mobile importées statiquement dans le bundle initial | `client/src/components/RouterProduction.tsx:25` |

### MSAV-01

**La page mobile appelle des endpoints inexistants (/api/sav-tickets) : SAV mobile inutilisable** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/mobile/SavPage.tsx:88`
- **Constat :** L88 `fetch(`/api/sav-tickets?storeId=${selectedStoreId}`)`, L108 `apiRequest(`/api/sav-tickets/${id}/status`, 'PATCH', ...)`, L116 `apiRequest('/api/sav-tickets', 'POST', data)`. Aucune route de ce nom dans le serveur (grep 'sav-tickets' dans server/ : 0 résultat). Seuls `/api/sav/tickets` et `/api/sav/tickets/:id` existent (routes.ts:5242-5443). En production, index.production.ts:157-160 fait `next()` pour /api/, d'où un 404.
- **Impact :** Sur téléphone, la liste affiche toujours 'Aucun ticket SAV', la création renvoie un toast d'erreur contenant le HTML du 404, et le changement de statut échoue sans message. Les employés en magasin ne peuvent pas utiliser le SAV.
- **Recommandation :** Utiliser `/api/sav/tickets` (GET avec `groupId` pour l'admin, comme sur desktop, en partageant la même queryKey), `PATCH /api/sav/tickets/:id` avec `{ status }`, et `POST /api/sav/tickets`. Idéalement, extraire un hook commun `useSavTickets()` partagé entre desktop et mobile.

### MSAV-02

**Valeurs de statut en anglais, hors de l'enum serveur** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/mobile/SavPage.tsx:230`
- **Constat :** L230-239 : `status: 'in_progress'`, `'waiting_parts'`, `'resolved'`, `'closed'`. Le schéma attend `z.enum(["nouveau", "en_cours", "attente_pieces", "attente_echange", "resolu", "ferme"])` (schema.ts:919), et init.sql:356 impose un CHECK sur ces valeurs. Le menu ne propose pas non plus 'Nouveau' ni 'Attente échange'.
- **Impact :** Même après correction de l'URL (MSAV-01), chaque changement de statut sera rejeté (400 Validation error), et un ticket en 'Attente échange' ne pourra pas être géré sur mobile.
- **Recommandation :** Utiliser les valeurs de l'enum ('en_cours', 'attente_pieces', 'attente_echange', 'resolu', 'ferme') via un statusConfig partagé avec le desktop (à extraire dans un fichier commun).

### SAV-01

**La liste ne se rafraîchit pas après création/modification/suppression (queryKey incompatible avec l'invalidation)** — bug, sévérité haute, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:98`
- **Constat :** L95-100 : `const ticketsUrl = `/api/sav/tickets${queryParams...}`` puis `queryKey: [ticketsUrl, selectedStoreId], staleTime: 1000 * 60 * 5`. Les mutations font `queryClient.invalidateQueries({ queryKey: ['/api/sav/tickets'] })` (L170, 209, 240, 268). TanStack compare les éléments du tableau un à un : '/api/sav/tickets' !== '/api/sav/tickets?groupId=3'. Dès qu'un admin a un magasin sélectionné (L91-93 ajoute groupId) ou qu'un filtre est actif, l'invalidation ne correspond à aucune requête.
- **Impact :** Un ticket créé n'apparaît pas, un ticket supprimé reste affiché (un second clic sur Supprimer renvoie 'Ticket not found') et un statut modifié reste ancien sur la carte, pendant 5 minutes. L'utilisateur croit que l'action a échoué et la refait (doublons).
- **Recommandation :** Partie auto-applicable : clé `['/api/sav/tickets', { status, priority, supplierId, groupId }]` avec une queryFn qui reconstruit l'URL via apiRequest (le message '401: ...' garde la redirection du retry global). Alternative minimale : `invalidateQueries({ predicate: q => String(q.queryKey[0]).startsWith('/api/sav/tickets') })`. Après un commentaire, n'invalider que le détail. Le passage à setQueryData est une optimisation à faire à part, non automatique.

### SAV-02

**Les commentaires et l'historique ne sont jamais enregistrés, mais l'UI affiche un succès** — bug, sévérité haute, effort M

- **Fichier :** `server/storage.ts:2808`
- **Constat :** storage.ts:2808-2816 `async addSavTicketHistory(...) { // const [history] = await db.insert(savTicketHistory)... return null; }` et 2790-2805 `getSavTicketHistory(...) { // ... return []; }`. La route routes.ts:5508 renvoie 201. Côté client, SavTickets.tsx:214-218 affiche le toast 'Commentaire ajouté', mais la colonne 'Historique et commentaires' (L1154-1177) montre toujours 'Aucun commentaire pour le moment'. Les changements de statut (routes.ts:5424-5430) ne sont pas historisés non plus, et `resolvedAt`/`closedAt` (schema.ts:887-888) ne sont jamais renseignés par le PATCH (routes.ts:5420-5421).
- **Impact :** Perte silencieuse des informations saisies par les managers (suivi fournisseur, échanges client). La fonction 'Nouveau' (commentaire < 24 h, L853) ne s'allume jamais. Aucune traçabilité de qui a changé un statut, ni de date de résolution.
- **Recommandation :** Recréer la table sav_ticket_history (déjà définie dans migrations/sav_production_fix.sql:41), déclarer `savTicketHistory` dans shared/schema.ts et décommenter les implémentations. Dans updateSavTicket, positionner resolvedAt/closedAt quand le statut passe à 'resolu'/'ferme'. En attendant, masquer le champ commentaire plutôt que d'afficher un faux succès.

### SAV-03

**Bouton 'Modifier' : formulaire complet dont la sauvegarde n'est pas implémentée** — ux-simplicite, sévérité haute, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:1338`
- **Constat :** L1337-1344 : `onClick={() => { // TODO: Implement update ticket functionality
 toast({ title: "Fonction en développement", description: "La modification de tickets sera bientôt disponible." }); }}`. Le bouton crayon est pourtant affiché sur chaque carte pour admin/directeur/manager (L932-941). Le PATCH serveur accepte déjà une mise à jour partielle (routes.ts:5420 `insertSavTicketSchema.partial().parse(req.body)`).
- **Impact :** L'utilisateur remplit 9 champs puis découvre que rien n'est enregistré : frustration et perte de temps sur une action visible en permanence.
- **Recommandation :** Si on branche la sauvegarde : envoyer seulement les champs éditables (supplierId en entier, produit, problemType, problemDescription, priority, clientName, clientPhone), jamais groupId ni createdBy. Côté serveur, retirer groupId/createdBy/ticketNumber du schéma PATCH (ou vérifier l'accès au nouveau groupId). Sinon, masquer le bouton crayon : c'est une décision produit.

### SAV-04

**Le hash du mot de passe du créateur est envoyé au navigateur pour chaque ticket** — bug, sévérité haute, effort S

- **Fichier :** `server/storage.ts:2669`
- **Constat :** storage.ts:2665-2669 `.select({ ticket: savTickets, supplier: suppliers, group: groups, creator: users })` et de même 2722-2726 pour getSavTicket. La table users contient `password: varchar("password")` (schema.ts:40). Le middleware de sortie (routes.ts:165-171, sanitize.ts:36) ne retire que smtpPassword. Par contraste, /api/user (localAuth.ts:217-226) choisit ses champs explicitement.
- **Impact :** Tout employé qui ouvre la page SAV reçoit les hash bcrypt des managers/admins créateurs de tickets (craquage hors ligne possible). Cela alourdit aussi chaque ticket de colonnes inutiles.
- **Recommandation :** Comme proposé. Ajuster aussi le type `SavTicketWithRelations.creator` (schema.ts:939) en `Pick<User,'id'|'username'|'firstName'|'lastName'>`, sinon getSavTicket ne type-checke plus. MemStorage (4940, 4962) peut faire la même projection.

### SAV-05

**Chaque ticket embarque la ligne magasin complète, logo base64 et config SMTP/NocoDB compris** — perf-api, sévérité haute, effort S

- **Fichier :** `server/storage.ts:2668`
- **Constat :** storage.ts:2667-2668 `supplier: suppliers, group: groups` (lignes complètes). groups contient `logo: text("logo"), // Logo en data URI (data:image/png;base64,...)` (schema.ts:67), plus smtpHost/smtpUser/webhookUrl/nocodb*. Le client n'utilise que `ticket.supplier?.name` (L911, L1067) et `ticket.group?.name` (L1071).
- **Impact :** Avec un logo de 50-200 Ko, 100 tickets donnent 5 à 20 Mo de JSON à télécharger, parser et traverser récursivement (stripSmtpPassword) à chaque chargement et chaque filtre. Le chargement est lent sur le Wi-Fi ou la 4G du magasin, et des données sensibles (hôte/utilisateur SMTP) fuient.
- **Recommandation :** Partie auto-applicable : projection `supplier: { id, name }`, `group: { id, name, color }` dans getSavTickets/getSavTicket, et types ajustés (Pick<Supplier,...>, Pick<Group,...>). Ajouter la compression gzip est une autre décision : nouvelle dépendance, effet global sur toute l'API, et à vérifier avec un éventuel proxy nginx. À traiter à part, pas automatiquement.

### SAV-06

**Un utilisateur non admin sans magasin assigné voit les tickets de tous les magasins** — bug, sévérité haute, effort S

- **Fichier :** `server/routes.ts:5272`
- **Constat :** routes.ts:5266 `groupIds = userGroups ? userGroups.map(...) : [];` puis 5272 `groupIds: groupIds.length > 0 ? groupIds : undefined`. Dans storage.ts:2678, `if (filters?.groupIds?.length)` : aucun filtre magasin n'est appliqué. Même logique pour les stats (routes.ts:5548, 5552).
- **Impact :** Un employé ou un manager fraîchement créé, ou dont l'affectation a été retirée, voit les tickets SAV (noms et téléphones clients) de toute l'enseigne.
- **Recommandation :** Pour un non-admin dont groupIds est vide, renvoyer immédiatement `res.json([])` (et des stats à zéro) au lieu de passer `undefined`.

### MSAV-03

**Les erreurs de validation du formulaire mobile ne s'affichent jamais** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/SavPage.tsx:283`
- **Constat :** FormMessage est importé (L51), mais aucun FormItem ne le rend, par exemple L283-286 `<FormItem><FormLabel>Gencode (EAN13)</FormLabel><FormControl><Input .../></FormControl></FormItem>`. Le schéma zod définit pourtant 'Gencode requis', 'Désignation requise', 'Fournisseur requis', 'Description requise' (L66-71). supplierId vaut 0 par défaut (L135).
- **Impact :** En appuyant sur 'Créer le ticket' avec un champ manquant, rien ne se passe à part un libellé qui devient rouge en haut d'une feuille de 90vh. L'utilisateur pense que le bouton ne marche pas.
- **Recommandation :** Ajouter `<FormMessage />` dans chaque FormItem et faire défiler jusqu'au premier champ en erreur (`shouldFocusError` est actif par défaut avec les champs enregistrés).

### MSAV-04

**Bouton + et menu de statut visibles pour les employés, qui n'ont pas le droit** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/mobile/SavPage.tsx:397`
- **Constat :** L397-402 : le FAB `<Button className="fixed bottom-20 right-4 ..." onClick={() => setIsCreateOpen(true)}>` et le menu ⋮ (L223-243) sont toujours rendus. Le desktop limite pourtant `canCreate`/`canModify` à admin/directeur/manager (SavTickets.tsx:287-288), et le serveur renvoie 403 aux employés (routes.ts:5328, 5399).
- **Impact :** Un employé remplit tout le formulaire puis reçoit une erreur 'Insufficient permissions' en anglais.
- **Recommandation :** Reprendre les mêmes règles de rôle que le desktop (hook partagé `useSavPermissions`) et masquer le FAB et le menu ⋮ si l'utilisateur n'a pas le droit.

### MSAV-05

**Mobile : ni détail, ni commentaires, ni confirmation de fermeture, ni gestion d'erreur du statut** — ux-simplicite, sévérité moyenne, effort M

- **Fichier :** `client/src/pages/mobile/SavPage.tsx:106`
- **Constat :** Les cartes (L209-259) ne sont pas cliquables : seuls le menu ⋮ et 'Appeler' sont présents, sans accès au fournisseur, au gencode ni à l'historique. `statusMutation` (L106-113) n'a pas de onError. 'Fermer' (L239) s'applique en un tap, sans confirmation.
- **Impact :** Sur le terrain, l'employé ne voit pas les détails nécessaires pour traiter le SAV (fournisseur, code-barres). Un tap accidentel ferme un ticket, et un échec passe inaperçu.
- **Recommandation :** Ouvrir une Sheet de détail au tap sur la carte (infos, statut, commentaires). Ajouter onError avec un toast français et une confirmation pour Résolu/Fermé.

### SAV-07

**Création par un admin : ticket rattaché au premier magasin alphabétique et non au magasin sélectionné** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:337`
- **Constat :** L328 `let selectedGroupId = formData.groupId ? parseInt(formData.groupId) : null;` puis L337-339 `if (!selectedGroupId && availableGroups.length > 0) { selectedGroupId = availableGroups[0].id; }` et L345 `groupId: selectedGroupId || 1`. Pour un admin, availableGroups = tous les groupes triés par nom (storage.ts:433). Le Select 'Magasin' (L553) n'a pas de valeur par défaut et `selectedStoreId` n'est pas utilisé.
- **Impact :** Un admin qui travaille sur le magasin B et ne touche pas le Select crée le ticket dans le magasin A. Le ticket disparaît ensuite de sa vue filtrée sur B.
- **Recommandation :** Initialiser `formData.groupId` avec `selectedStoreId` (ou le seul magasin de l'utilisateur) à l'ouverture de la modale. Supprimer le repli `|| 1`.

### SAV-08

**Le formulaire 'Nouveau Ticket' est pré-rempli avec le dernier ticket ouvert en modification** — bug, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:400`
- **Constat :** handleEditTicket (L397-412) fait `setFormData({ supplierId: ticket.supplierId.toString(), ... })`. La modale d'édition se ferme sans réinitialisation (L1334 `setShowEditModal(false)`), et la modale de création lit le même état `formData` (L506, 516, 527...). Seul le succès de création le réinitialise (L173).
- **Impact :** Après avoir ouvert un ticket en modification, 'Nouveau Ticket' affiche les données de l'ancien ticket. Risque de créer un doublon ou un ticket mélangé.
- **Recommandation :** Préférer des états séparés (editFormData / createFormData), ou réinitialiser formData à la fermeture de la modale d'édition. Ne pas le réinitialiser à l'ouverture de la création : on perdrait le brouillon de création que l'utilisateur garde aujourd'hui quand il ferme et rouvre.

### SAV-09

**DELETE : aucun contrôle d'appartenance au magasin** — bug, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:5446`
- **Constat :** routes.ts:5446 `const user = await storage.getUser(userId);` puis 5452 `if (!['admin', 'directeur'].includes(user.role))` puis directement 5463 `await storage.deleteSavTicket(ticketId);`. Contrairement au GET/PATCH (5304-5310, 5411-5417), userGroups n'est pas vérifié.
- **Impact :** Un directeur peut supprimer définitivement un ticket d'un autre magasin en devinant un id.
- **Recommandation :** Utiliser req.user (qui contient déjà userGroups) et vérifier `userGroupIds.includes(existingTicket.groupId)` pour les non-admin, comme dans le PATCH.

### SAV-10

**Chaque route SAV recharge l'utilisateur et ses magasins déjà fournis par la session** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/routes.ts:5245`
- **Constat :** localAuth.ts:141-143 `passport.deserializeUser(async (id) => { const user = await storage.getUserWithGroups(id); ...` (idem localAuth.production.ts:193-195). Pourtant routes.ts:5245, 5291, 5322, 5393, 5474, 5527 refont `await storage.getUserWithGroups(userId)` (2 requêtes séquentielles : storage.ts:372 getUser puis 376 user_groups). Les PATCH, DELETE et history (5404, 5457, 5485) chargent aussi le ticket complet avec 3 jointures et l'historique, uniquement pour lire groupId/status.
- **Impact :** Au montage de la page (tickets + stats), 4 requêtes SQL inutiles s'ajoutent. Chaque mutation coûte 3 à 5 allers-retours BD au lieu de 1 à 2, soit +5 à 20 ms par appel selon la latence Postgres.
- **Recommandation :** Utiliser directement `req.user` (déjà de type UserWithGroups) dans les routes SAV. Pour les contrôles d'accès, ajouter une méthode légère `getSavTicketAccessInfo(id)` qui fait `select({ groupId, status }).from(savTickets).where(eq(id))`.

### SAV-11

**Statistiques SAV : 3 requêtes séquentielles au lieu d'une seule** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:2832`
- **Constat :** storage.ts:2832-2855 : `await db.select({count, status})...groupBy(status)`, puis `await db.select({count, priority})...groupBy(priority)`, puis `await db.select({ count: sql`count(*)` })...`. Les trois sont awaités l'un après l'autre. La variable `baseQuery` (L2825-2829) est construite puis jamais utilisée.
- **Impact :** Trois allers-retours BD par affichage de la page (plus les 2 de getUserWithGroups), ce qui retarde l'apparition des compteurs.
- **Recommandation :** Une seule requête avec `count(*) filter (where ...)` qui garde exactement la sémantique actuelle : total ; new = 'nouveau' ; in_progress = en_cours/attente_pieces/attente_echange ; resolved = resolu/ferme ; critical = priority='critique' sans condition de statut. Convertir les résultats avec Number() (node-postgres renvoie count en chaîne). Supprimer baseQuery. Changer la définition de 'Critiques' seulement dans le cadre de SAV-22.

### SAV-12

**Schéma N+1 : un appel getSavTicketHistory par ticket de la liste** — perf-serveur, sévérité moyenne, effort M — vérification : partiellement confirmé

- **Fichier :** `server/storage.ts:2704`
- **Constat :** storage.ts:2704-2715 `await Promise.all(results.map(async (result) => { const history = await this.getSavTicketHistory(result.ticket.id); ... }))`. La fonction est aujourd'hui un no-op (`return []`), mais réactiver l'historique (SAV-02) produira N requêtes SQL pour N tickets. La liste n'utilise l'historique que pour hasRecentComments (SavTickets.tsx:383-394).
- **Impact :** Une fois l'historique réactivé, 200 tickets donnent 201 requêtes par affichage et par changement de filtre. Aujourd'hui, ce sont N promesses inutiles et un champ history vide sérialisé.
- **Recommandation :** Pour l'instant, se contenter de supprimer l'appel no-op dans la liste et renvoyer `history: []` (même format pour le client, hasRecentComments continue de marcher). Concevoir lastCommentAt (sous-requête ou inArray groupé) en même temps que la recréation de la table (SAV-02), pas avant.

### SAV-13

**Liste sans pagination ni limite, rendue entièrement en cartes** — perf-api, sévérité moyenne, effort M

- **Fichier :** `server/storage.ts:2701`
- **Constat :** storage.ts:2701 `const results = await query.orderBy(desc(savTickets.createdAt));` sans limit/offset. Côté client, SavTickets.tsx:840 `{filteredTickets.map((ticket) => { ... <Card> ...` rend toutes les cartes dans une grille 3 colonnes, tickets fermés compris.
- **Impact :** Le volume grossit indéfiniment (les tickets fermés ne sont jamais archivés) : temps de réponse, poids JSON et rendu DOM augmentent chaque mois, et la page devient longue à défiler.
- **Recommandation :** Ajouter `limit`/`offset` (ou un curseur sur created_at) côté serveur avec un total. Côté client, afficher 30 tickets puis 'Charger plus' (useInfiniteQuery). Par défaut, exclure les tickets 'ferme' (voir SAV-24).

### SAV-14

**Chaque changement de filtre vide la liste et affiche un spinner (aucun placeholderData)** — perf-client, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:97`
- **Constat :** L95-101 : la clé change à chaque filtre (`queryKey: [ticketsUrl, selectedStoreId]`) sans `placeholderData`. L827 `{isLoading ? (<div className="animate-spin ..."/> <p>Chargement des tickets...</p>)`. Les filtres statut/priorité/fournisseur sont envoyés au serveur (L86-88), alors que la recherche texte est faite côté client (L445-455) sur la même liste.
- **Impact :** À chaque clic sur un filtre, la grille disparaît, un spinner s'affiche, puis un aller-retour serveur complet a lieu (avec le payload lourd de SAV-05). L'interface paraît lente et saute visuellement.
- **Recommandation :** Partie auto-applicable : seulement `placeholderData: keepPreviousData`. Le passage à un filtrage entièrement côté client (une seule requête par magasin) dépend de SAV-13 (pagination) et n'est pas mécanique.

### SAV-15

**console.log de debug exécutés à chaque rendu (chaque frappe clavier)** — dette-code, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:294`
- **Constat :** `const availableGroups = getUserGroups();` (L314) est appelé dans le corps du composant. getUserGroups loggue `console.log('🎫 [CLIENT] Admin user - can access all groups:', ...)` (L294) ou un objet complet avec username et groupes (L304-309). D'autres logs dans handleCreateTicket (L330-335, L340, L358-365) affichent les données du ticket et du client. Le filtrage `groupsData.filter(...)` est aussi recalculé à chaque rendu, alors que /api/groups renvoie déjà uniquement les magasins de l'utilisateur non admin (routes.ts:983).
- **Impact :** Chaque caractère tapé dans la recherche ou le formulaire produit un log : console saturée, ralentissement perceptible avec les DevTools ouverts, données client (nom, téléphone) exposées dans la console.
- **Recommandation :** Supprimer tous les console.log de la page. Remplacer getUserGroups par `const availableGroups = groupsData` (le serveur filtre déjà), ou utiliser `stores` de StoreContext, mémorisé avec useMemo.

### SAV-18

**Codes techniques, anglais et emojis affichés à l'utilisateur** — lisibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:1034`
- **Constat :** L1034 `<p>{displayedTicket.problemType}</p>` affiche 'pieces_manquantes'/'defectueux'. L1160 `{entry.action === 'comment' ? 'Commentaire' : entry.action}` affiche 'status_change'. routes.ts:5428 `description: `Statut changé de "${existingTicket.status}" vers "${req.body.status}"`` produit 'de "en_cours" vers "resolu"'. L871 `{ticket.clientName || 'N/A'}`. L875 `📞 {ticket.clientPhone}` et L889 `📦 {ticket.productGencode}` mélangent emojis et icônes lucide.
- **Impact :** Un employé non technicien lit des codes informatiques et de l'anglais ('N/A') : la compréhension baisse et l'interface paraît peu finie.
- **Recommandation :** Créer un `problemTypeConfig` (Défectueux, Pièces manquantes, Non conforme, Autre) réutilisé partout. Traduire les actions d'historique ('Changement de statut'). Côté serveur, utiliser les libellés français dans la description. Remplacer 'N/A' par 'Client non renseigné', et les emojis par les icônes Phone/Barcode de lucide.

### SAV-19

**Modale de suivi trop chargée : 'Actions Rapides' coupé en bas sur écran de portable** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:966`
- **Constat :** L966 `<DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">`. La colonne gauche (L975 `<div className="space-y-4">`, sans overflow) empile 5 Cards (Produit, Client, Problème, Informations Ticket, Actions Rapides), soit environ 900 px. Seule la colonne droite défile (L1150 `overflow-y-auto max-h-[70vh]`). En dessous de lg, `grid-cols-1` place les deux colonnes l'une sous l'autre dans un conteneur overflow-hidden.
- **Impact :** Sur un écran 1366x768 ou une tablette, la carte 'Actions Rapides' (changer le statut, l'action principale) est invisible et inatteignable. L'utilisateur ne trouve pas comment clôturer un ticket.
- **Recommandation :** Mettre `overflow-y-auto` sur DialogContent. Placer Statut et Priorité en haut de la modale (juste sous le titre), et fusionner Produit, Client et Problème en une seule carte compacte de type 'définition'.

### SAV-20

**Cartes non cliquables malgré cursor-pointer ; actions en icônes minuscules sans libellé** — accessibilite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:846`
- **Constat :** L846 `<Card ... className={`hover:shadow-md transition-shadow cursor-pointer ...`}>` sans onClick. Les actions (L923-950) sont des boutons `className="text-xs h-7"` contenant seulement `<ClipboardList className="h-3 w-3" />`, `<Edit .../>`, `<Trash2 .../>`. Seul le premier a un `title`, et aucun n'a d'aria-label.
- **Impact :** L'utilisateur clique sur la carte et rien ne se passe. Il doit deviner que l'icône presse-papier signifie 'Suivi'. Les cibles de 28 px sur des icônes de 12 px sont difficiles à viser, et les lecteurs d'écran annoncent 'bouton' sans nom.
- **Recommandation :** Partie auto-applicable : ajouter aria-label et title ('Suivi du ticket', 'Modifier', 'Supprimer') sur les 3 boutons. Mettre `onClick={() => handleViewTicket(ticket)}` sur la Card, avec `e.stopPropagation()` dans les onClick des boutons Modifier/Supprimer/Suivi, ce qui rend réel le comportement déjà suggéré par cursor-pointer. Le menu ⋮ et l'agrandissement des boutons restent à décider côté design.

### SAV-22

**Compteurs trompeurs et non cliquables (Critiques inclut les tickets clos, Résolus inclut Fermés)** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `server/storage.ts:2882`
- **Constat :** storage.ts:2879-2884 : `if (result.priority === 'critique') stats.criticalTickets = count;` sans condition de statut. L2873 : `['resolu', 'ferme']` est compté dans resolvedTickets. Côté UI (SavTickets.tsx:703-750), 5 Cards statiques sans onClick, alors que le filtre propose 6 statuts différents.
- **Impact :** Le compteur rouge 'Critiques' reste élevé alors que tous les tickets critiques sont résolus, ce qui crée une fausse alerte. L'utilisateur ne peut pas cliquer sur 'En cours' pour voir ces tickets.
- **Recommandation :** Ne compter que les tickets critiques ouverts. Rendre chaque carte compteur cliquable pour appliquer le filtre correspondant. Réduire à 4 compteurs utiles : À traiter, En attente, Urgents ouverts, Clôturés ce mois.

### SAV-23

**Pas d'état d'erreur, état vide sans action, et compteurs qui apparaissent en décalant la page** — ux-simplicite, sévérité moyenne, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:832`
- **Constat :** L97 `const { data: ticketsData = [], isLoading } = useQuery(...)` : isError n'est jamais lu. Si l'API échoue, L832-836 affiche 'Aucun ticket trouvé'. Cet état vide ne distingue pas 'aucun ticket' de 'aucun résultat pour ces filtres' et ne propose ni 'Créer un ticket' ni 'Réinitialiser les filtres'. L703 `{statsData && (<div className="grid ...">` insère les 5 cartes après chargement, ce qui pousse filtres et liste vers le bas.
- **Impact :** Pendant une panne, l'utilisateur croit qu'il n'y a pas de SAV. Après un filtrage sans résultat, il ne sait pas quoi faire. Le saut de mise en page provoque des clics ratés.
- **Recommandation :** Afficher un encart d'erreur avec un bouton 'Réessayer' quand isError est vrai. Proposer un état vide contextuel avec une action ('Effacer les filtres' ou 'Créer un ticket'). Réserver la place des compteurs avec des Skeleton de même hauteur pendant le chargement.

### MSAV-06

**Libellés et couleurs de statut différents du desktop ; statut 'attente_echange' affiché brut** — coherence-design, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/mobile/SavPage.tsx:165`
- **Constat :** L169 `case "attente_pieces": ... >Pièces</Badge>` contre 'Attente pièces' sur desktop (SavTickets.tsx:39). Il n'y a pas de cas 'attente_echange', d'où `default: return <Badge variant="outline">{status}</Badge>` (L172) qui affiche le code. Le menu L234 écrit 'Attente Pièces' (majuscule). Le header et le FAB sont violets (L181 `text-purple-600`, L398 `bg-purple-600`), alors que le desktop utilise le bleu/primary (SavTickets.tsx:464).
- **Impact :** Un même ticket a un libellé différent selon l'appareil, et un code technique apparaît : la confiance et la compréhension s'en ressentent.
- **Recommandation :** Partie auto-applicable : extraire statusConfig/priorityConfig/problemTypeConfig dans client/src/lib/savConfig.ts et les utiliser dans les deux pages (libellés français identiques, cas attente_echange inclus). Ne pas toucher aux couleurs d'accent mobile sans décision de design globale.

### MSAV-07

**Jargon 'Gencode (EAN13)' et placeholder 'Scanner...' sans scanner** — lisibilite, sévérité basse, effort S

- **Fichier :** `client/src/pages/mobile/SavPage.tsx:284`
- **Constat :** L284-285 `<FormLabel>Gencode (EAN13)</FormLabel><FormControl><Input placeholder="Scanner..." .../>`. L'icône Camera est importée (L19) mais aucune fonction de scan n'existe. Le desktop dit 'Code-barres produit' (SavTickets.tsx:503).
- **Impact :** Le terme technique et la promesse d'un scan inexistant déroutent l'utilisateur, qui cherche un bouton caméra.
- **Recommandation :** Libellé 'Code-barres du produit', placeholder 'Ex. 3017620422003'. Ajouter un vrai bouton de scan plus tard, ou retirer la mention 'Scanner'.

### MSAV-08

**Imports inutilisés et requêtes chargées au montage pour un formulaire fermé** — dette-code, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/mobile/SavPage.tsx:100`
- **Constat :** Imports inutilisés : `Filter, Camera, Image as ImageIcon, CheckCircle, XCircle` (L18-23) et `FormMessage` (L51). `useQuery(['/api/groups'])` (L100-103) ne sert qu'au repli `groups[0].id` de onSubmit (L145), et `/api/suppliers` (L95-98) ne sert qu'au formulaire. Les deux sont chargés au montage sans staleTime spécifique.
- **Impact :** Deux requêtes réseau inutiles à chaque ouverture de la page sur mobile (connexion souvent lente), et du code mort.
- **Recommandation :** Supprimer les imports morts. Remplacer useQuery('/api/groups') par `stores` de useStore(), qui contient les mêmes données (MobileApp.tsx). Mettre staleTime 10 min sur les fournisseurs. Ne pas conditionner les fournisseurs à l'ouverture de la Sheet.

### MSAV-09

**Erreur ou absence de magasin sélectionné affichée comme 'Aucun ticket SAV'** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/mobile/SavPage.tsx:202`
- **Constat :** L84-93 : `isError` n'est jamais lu. Avec `enabled: !!selectedStoreId && !!user`, un admin en 'Tous les magasins' voit isLoading=false et la liste vide. L202-206 affiche alors 'Aucun ticket SAV'. Par ailleurs, L216 `format(new Date(ticket.createdAt), "dd/MM")` omet l'année et lève une exception si la date est invalide.
- **Impact :** Panne réseau, magasin non choisi et absence réelle de ticket produisent le même message : l'utilisateur ne sait pas quoi faire.
- **Recommandation :** Distinguer trois états : erreur ('Impossible de charger, Réessayer'), aucun magasin choisi ('Choisissez un magasin') et liste vide (avec bouton 'Créer un ticket'). Utiliser safeFormat avec 'dd/MM/yy'.

### SAV-16

**Logs console sur chaque requête GET SAV (chemin chaud)** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/routes.ts:5258`
- **Constat :** routes.ts:5258 `console.log(`🎫 [SAV] Admin filtering by selected store: ${selectedGroupId}`)`, 5261, 5267 `console.log(`🎫 [SAV] User ${user.username} (${user.role}) can see stores:`, groupIds)`. De même pour les stats (5540, 5543, 5549) et la création (5337, 5341, 5354, 5374-5379).
- **Impact :** Deux à trois lignes de log par affichage de page, en plus du log HTTP global. Cela pollue les logs de production et coûte en I/O synchrone sur stdout.
- **Recommandation :** Supprimer ces console.log ou les passer derrière un logger de niveau debug désactivé en production.

### SAV-17

**Requête de détail déclarée deux fois, plus fetch manuels incohérents** — dette-code, sévérité basse, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:376`
- **Constat :** L142-146 `useQuery({ queryKey: [`/api/sav/tickets/${selectedTicket?.id}`], staleTime: 0 })` et L376-380, même clé, résultat `ticketDetails` jamais utilisé. Les stats utilisent un `fetch` manuel (L121-136) et la création un `fetch` brut (L154-167), alors que les autres mutations utilisent apiRequest. Le détail renvoie les mêmes données que la liste (history toujours []) et staleTime 0 force un appel à chaque ouverture.
- **Impact :** Code plus difficile à maintenir, gestion d'erreur/401 incohérente entre les appels, et une requête réseau à chaque ouverture de ticket sans gain d'information.
- **Recommandation :** Partie sûre : supprimer le second useQuery (L376-380), qui est placé avant le return conditionnel, donc sans risque pour l'ordre des hooks. Ne pas remplacer le fetch de création par apiRequest sans extraire le `message` du JSON d'erreur. placeholderData et staleTime 30 s pour le détail sont acceptables, puisque les mutations invalident explicitement la clé du détail.

### SAV-21

**Badges ambigus : 'Nouveau' commentaire contre statut 'Nouveau', couleurs priorité/statut qui se chevauchent** — coherence-design, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `client/src/pages/SavTickets.tsx:856`
- **Constat :** L853-857 badge orange `<MessageCircle/> Nouveau` pour un commentaire récent, alors que le statut 'nouveau' affiche aussi 'Nouveau' (L37, bleu). priorityConfig.normale = 'bg-blue-100 text-blue-800' (L47) a la même couleur que le statut 'Nouveau' (L37). priorityConfig.haute = 'bg-orange-100' (L48) a la même couleur que 'Attente pièces' (L39). La suppression utilise une modale maison (L1356-1394) au lieu du composant partagé `ConfirmationModal` utilisé par Avoirs, DlcPage et CustomerOrders.
- **Impact :** Sur une carte, deux badges bleus ou deux badges orange ne permettent pas de distinguer statut et priorité. Le mot 'Nouveau' a deux sens, et les confirmations n'ont pas le même aspect d'une page à l'autre.
- **Recommandation :** Pour harmoniser la suppression, utiliser AlertDialog comme Avoirs et DlcPage, pas ConfirmationModal. Renommer le badge en 'Nouveau message' seulement quand l'historique sera réactivé. Le code couleur de la priorité est un choix de design.

### SAV-24

**Changement de statut/priorité enregistré immédiatement, sans confirmation, avec un message inexact** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:1123`
- **Constat :** L1099-1104 et L1123-1128 : `onValueChange={(value) => { setTempStatus(value); updateTicketMutation.mutate({ ticketId, status: value }); }}`, y compris pour 'ferme'. Le toast de succès dit toujours 'Le statut du ticket a été modifié avec succès.' (L249), même pour une priorité. En cas d'erreur (L252-258), tempStatus/tempPriority ne sont pas remis à zéro et le Select affiche une valeur non enregistrée. La mutation prévoit `resolutionDescription` (L231-235) mais aucun champ ne permet de la saisir.
- **Impact :** Un mauvais clic ferme un ticket. Le message de succès ne correspond pas à l'action, et l'affichage peut mentir après une erreur.
- **Recommandation :** Demander une confirmation (et un champ 'Comment le problème a été résolu ?') quand le statut passe à Résolu ou Fermé. Adapter le texte du toast à la priorité. Réinitialiser tempStatus/tempPriority dans onError.

### SAV-25

**Les tickets fermés sont mélangés aux tickets à traiter par défaut** — ux-simplicite, sévérité basse, effort S

- **Fichier :** `client/src/pages/SavTickets.tsx:59`
- **Constat :** L59 `const [statusFilter, setStatusFilter] = useState("all");`. Les tickets fermés sont simplement grisés (L846 `${ticket.status === 'ferme' ? 'opacity-60' : ''}`) et triés uniquement par date de création (storage.ts:2701).
- **Impact :** Au fil des mois, la page se remplit de tickets clos et les tickets urgents ouverts se perdent dans la grille.
- **Recommandation :** Ajouter un filtre par défaut 'Ouverts' (nouveau, en cours, attente) avec des onglets simples 'À traiter / En attente / Clôturés'. Trier les tickets ouverts par priorité puis par ancienneté.

### SAV-26

**Numéros de ticket dupliqués possibles (count(*) + 1) et génération en double** — bug, sévérité basse, effort S

- **Fichier :** `server/storage.ts:2750`
- **Constat :** storage.ts:2750-2755 `count(*) ... where EXTRACT(year from created_at) = ${currentYear}` puis `SAV-${currentYear}-${count + 1}`. Après une suppression ou deux créations simultanées, le même numéro est réattribué. schema.ts:871 `ticketNumber: varchar(...).notNull()` n'a pas de contrainte unique. La route génère déjà un autre numéro (routes.ts:5350 `SAV-YYYYMMDD-xxxxxx`), qui est écrasé (code mort). EXTRACT(year ...) empêche aussi l'usage de l'index created_at.
- **Impact :** Deux tickets peuvent porter le même numéro communiqué au client ou au fournisseur, d'où confusion et recherche ambiguë.
- **Recommandation :** Corriger aussi la conversion : `Number(count[0]?.count ?? 0) + 1`. Vérifier en base les numéros existants avant de choisir une séquence ou une contrainte UNIQUE, car des doublons existants feraient échouer l'ajout de la contrainte.

### SAV-27

**Index SAV absents du schéma Drizzle, pas d'index composite magasin+date ni fournisseur** — perf-serveur, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `shared/schema.ts:869`
- **Constat :** schema.ts:869-889 `pgTable("sav_tickets", {...})` sans 3e argument d'index, alors que la table session en déclare (schema.ts:28). Les index n'existent que dans init.sql:536-539 (status, priority, group_id, created_at séparés). La requête principale fait `WHERE group_id IN (...) ORDER BY created_at DESC`, plus éventuellement `supplier_id = ?` (storage.ts:2679, 2685, 2701).
- **Impact :** Sur une base créée par `npm run db:push`, aucun index n'existe. Même avec init.sql, le tri par date après filtre magasin et le filtre fournisseur ne sont pas couverts.
- **Recommandation :** Si on veut l'index composite, l'ajouter par `CREATE INDEX IF NOT EXISTS idx_sav_tickets_group_created ON sav_tickets(group_id, created_at DESC)` dans migrations.production.ts et init.sql, et éventuellement le refléter dans schema.ts. C'est une modification de base de données, à valider : pas d'application automatique.

### SAV-28

**Formulaire de création : fournisseur sans recherche et validation non localisée** — ux-simplicite, sévérité basse, effort M

- **Fichier :** `client/src/pages/SavTickets.tsx:536`
- **Constat :** L536-546 `<Select value={formData.supplierId}>` avec `{suppliersData.map(...)}` liste tous les fournisseurs sans champ de recherche. Idem pour le filtre (L789-801). Validation L318-325 : un seul toast 'Veuillez remplir tous les champs obligatoires.' sans indiquer lequel ni le mettre en rouge. La modale (L480-695) répartit 10 champs dans 3 Cards avec titres et descriptions.
- **Impact :** Choisir un fournisseur dans une longue liste est laborieux, et l'utilisateur ne sait pas quel champ manque.
- **Recommandation :** Utiliser un Combobox (Command de shadcn) avec recherche pour le fournisseur. Valider avec react-hook-form + zod (comme la page mobile) et afficher l'erreur sous chaque champ. Alléger la modale en 2 blocs : 'Produit et problème' (obligatoires) puis 'Client (facultatif)' repliable.

### SAV-29

**Pages SAV desktop et mobile importées statiquement dans le bundle initial** — perf-bundle, sévérité basse, effort S

- **Fichier :** `client/src/components/RouterProduction.tsx:25`
- **Constat :** RouterProduction.tsx:25 `import SavTickets from "@/pages/SavTickets";` et :43 `import MobileSavPage from "@/pages/mobile/SavPage";`, sans React.lazy. Les deux versions sont donc chargées pour tous les utilisateurs, quel que soit l'appareil.
- **Impact :** Environ 1 800 lignes de JSX (plus react-hook-form/zod côté mobile) chargées au démarrage même si l'utilisateur n'ouvre jamais le SAV, ce qui ralentit le premier affichage.
- **Recommandation :** Appliquer lazy() à toutes les pages en une fois, avec un seul Suspense placé à l'intérieur de Layout et de MobileApp autour du Switch, plutôt qu'au cas par cas pour le SAV. Le gain pour le seul SAV est marginal.
