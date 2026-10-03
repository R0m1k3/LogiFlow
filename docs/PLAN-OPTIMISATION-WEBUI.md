# Plan d'optimisation du webUI LogiFlow

*État au 3 octobre 2026. Annexe : les constats détaillés de l'audit, dans [`docs/audit-webui/`](audit-webui/).*

**Sommaire** : [Résumé](#résumé) · [Comment lire ce plan](#comment-lire-ce-plan) · [Feuille de route](#feuille-de-route) · [Décisions produit à prendre](#décisions-produit-à-prendre) · [P1 — Principes, navigation et design system](#p1--principes-navigation-et-design-system) · [P2 — Plan page par page](#p2--plan-page-par-page) · [P3 — Bugs et dette technique](#p3--bugs-et-dette-technique) · [P4 — Performance](#p4--performance)

## Résumé

- **Constat.** L'audit de l'interface a vérifié 620 constats, dont 107 de gravité haute. Trois faiblesses dominent : des écrans qui affichent de fausses informations (« 0 » pendant le chargement, une panne présentée comme une liste vide, les données d'un autre magasin) ; une application qui ne parle pas le même langage sur PC et sur téléphone (mots, couleurs, droits, fonctions absentes ou en panne) ; une grande lenteur, parce que chaque écran téléchargeait bien plus que ce qu'il affiche.
- **Déjà fait dans cette branche** (lot 1 de performance, pas encore en production, sans changement visible pour les équipes) : JavaScript avant l'écran de connexion 1,6 Mo → 180 Ko ; connexion → accueil 5,9 s → 0,16 s ; données reçues pour une visite des 23 pages 1,5 Go → 0,8 Mo ; appels en double 82 → 0 ; requêtes SQL −56 % ; mémoire du serveur 1,4 Go → 325 Mo ; plus aucune empreinte de mot de passe dans les réponses mesurées. Près de la moitié des constats graves (49 sur 107, surtout de performance) sont ainsi réglés en tout ou en partie.
- **Trois chantiers prioritaires :**
  1. **Corriger les 20 problèmes critiques** (Phase 1a, environ deux semaines) : données visibles d'un magasin à l'autre, failles d'impression, produits périmés qui disparaissent des alertes, commandes abîmées par une simple modification, SAV inutilisable sur téléphone.
  2. **Poser un socle commun** (Phase 2) : un seul menu pour PC et téléphone, une seule table de droits, une palette unique des statuts et une dizaine de composants standards (chargement, erreur, liste vide, confirmation, tableau).
  3. **Refaire les écrans du quotidien en magasin** (Phase 3), dans l'ordre d'usage : Accueil, DLC, Tâches, Livraisons, Commandes clients.
- Douze décisions produit (qui voit quoi, vocabulaire des statuts) sont à prendre avant la Phase 2 ; chacune a une proposition par défaut.

## Comment lire ce plan

**Pour qui.** Le résumé, la feuille de route et les décisions produit s'adressent à tous : direction, responsables de magasin, administrateur. Les parties P1 à P4 sont écrites pour les développeurs : chaque action y est précise (fichier, composant, route) et renvoie aux constats de l'audit.

| Partie | Contenu | À quoi elle sert |
|---|---|---|
| [Feuille de route](#feuille-de-route) | Six phases, de ce qui est fait (Phase 0) à la dette (Phase 5), avec effort et critères de réussite | Savoir dans quel ordre avancer et comment vérifier chaque étape |
| [Décisions produit](#décisions-produit-à-prendre) | Les questions à trancher par le métier, avec une proposition par défaut | Préparer la réunion de décision |
| [P1](#p1--principes-navigation-et-design-system) | Dix principes, navigation, design system, accessibilité | Les règles communes à tous les écrans |
| [P2](#p2--plan-page-par-page) | Les 20 écrans, un par un : usage, gênes, écran cible, libellés | Ce que chaque écran doit devenir |
| [P3](#p3--bugs-et-dette-technique) | Les 136 bugs et les 51 constats de dette technique | Ce qu'il faut réparer, puis nettoyer |
| [P4](#p4--performance) | Gains mesurés du lot 1, puis lots 2 et 3 | Ce qui a été fait et ce qui reste |

Les renvois internes s'écrivent « P1 § 3.6 » (partie P1, paragraphe 3.6). « Principe 3 » désigne l'un des dix principes de P1 § 1.

**L'annexe.** Le dossier [`docs/audit-webui/`](audit-webui/) contient 15 fichiers, un par zone de l'application, soit **620 constats vérifiés** (107 de gravité haute, 309 moyenne, 204 basse). En tête de chaque fichier, un tableau liste ses constats (identifiant, gravité, catégorie, effort, titre, fichier et ligne). Chaque constat a ensuite sa fiche : constat, preuve, impact, recommandation vérifiée et **verdict**. Quand une correction du plan s'écarte de la première recommandation de l'audit, c'est le verdict qui fait foi : il signale les pièges (régressions possibles, fonctions inexistantes).

**Les identifiants.** Dans ce plan, les constats sont cités entre parenthèses, par exemple (DASH-22). La fiche se trouve dans le fichier indiqué ci-dessous, à l'ancre formée de l'identifiant en minuscules : DASH-22 → [`audit-webui/01-dashboard.md#dash-22`](audit-webui/01-dashboard.md#dash-22).

| Préfixe de l'identifiant | Fichier de l'annexe | Constats (dont haute) |
|---|---|---|
| DASH | [`01-dashboard.md`](audit-webui/01-dashboard.md) | 46 (9) |
| CAL, MCAL, ORD, LIV, MOD, MOB, SRV, BUNDLE, PERM-01 (droits des commandes) | [`02-calendar-orders-deliveries.md`](audit-webui/02-calendar-orders-deliveries.md) | 58 (7) |
| RAPPRO, ECHE, NOCO-01 à NOCO-04 suivis de « (annexe 03) » | [`03-reconciliation-payment.md`](audit-webui/03-reconciliation-payment.md) | 40 (6) |
| AVOIRS, AVOIRS-API, MOB-AVOIRS | [`04-avoirs.md`](audit-webui/04-avoirs.md) | 41 (8) |
| TASKS | [`05-tasks.md`](audit-webui/05-tasks.md) | 36 (6) |
| SAV, MSAV | [`06-sav.md`](audit-webui/06-sav.md) | 38 (8) |
| CMDCLI | [`07-customer-orders.md`](audit-webui/07-customer-orders.md) | 43 (7) |
| DLC | [`08-dlc.md`](audit-webui/08-dlc.md) | 51 (12) |
| PUB | [`09-publicities.md`](audit-webui/09-publicities.md) | 35 (3) |
| USERS, GROUPS, PERF-BUNDLE, PERM-01 (droits des utilisateurs), PERM-02 | [`10-users-groups.md`](audit-webui/10-users-groups.md) | 43 (7) |
| SUPP, CONT, ANA, API, MAIL, SALES | [`11-suppliers-contacts-analytics.md`](audit-webui/11-suppliers-contacts-analytics.md) | 56 (11) |
| ADMIN, AUTH, BACKUP, BAP, DEBUG, ERR, LAND, NF, SQL, UTIL, WEATHER, NOCO (sans mention ou avec « annexe 12 ») | [`12-admin-utilities-auth.md`](audit-webui/12-admin-utilities-auth.md) | 48 (4) |
| SHELL | [`13-app-shell.md`](audit-webui/13-app-shell.md) | 30 (5) |
| INFRA | [`14-server-infra.md`](audit-webui/14-server-infra.md) | 19 (6) |
| DB | [`15-database.md`](audit-webui/15-database.md) | 36 (8) |

Les identifiants NOCO-01 à NOCO-04 existent dans deux annexes : sans autre mention ou avec « (annexe 12) », ils renvoient à la page de configuration NocoDB ; avec « (annexe 03) », au rapprochement. PERM-01 existe aussi dans deux annexes, avec le même sujet (deux tables de droits divergentes).

**Conventions.**

- **Effort** (échelle commune à tout le plan) : **S** = moins d'une demi-journée, **M** = 1 à 3 jours, **L** = plus de 3 jours, à découper. Pour une page de P2, l'effort porte sur l'interface, une fois les composants de P1 disponibles ; les travaux serveur nécessaires sont signalés à part.
- **Gravité** : celle de l'audit (haute, moyenne, basse).
- **Lots.** Le *lot 1* est le premier lot de performance, déjà réalisé dans cette branche (P4 § 2) ; ce qu'il a réglé porte la mention *fait par le lot 1* dans P1 à P3. Les *lots 2 et 3* sont les lots de performance restants (P4 § 4). Les *lots A, B et C* sont les trois lots de corrections prioritaires de P3 § 1.

## Feuille de route

Six phases. Les phases 1 à 3 se suivent. La phase 4 (performance, surtout côté serveur) avance en parallèle des phases 2 et 3. La dette (phase 5) est en partie traitée plus tôt, quand elle conditionne une autre phase. Les efforts sont donnés pour un développeur à plein temps ; un second développeur (l'un sur l'interface, l'autre sur le serveur) raccourcit nettement le calendrier.

| Phase | Objectif | Effort | Prérequis |
|---|---|---|---|
| [0. Performance, lot 1](#phase-0--performance-lot-1-fait) | Une application rapide, sans rien changer à l'écran | **Fait** ; livraison : une demi-journée, puis une semaine de suivi | — |
| [1. Corrections critiques](#phase-1--corrections-critiques) | Une application qui ne ment pas et ne laisse rien fuir | 3 à 4 semaines (1a : 2 semaines ; 1b : 1 à 2 semaines, en parallèle possible) | Phase 0 livrée |
| [2. Socle](#phase-2--socle--navigation-design-system-composants-communs) | Les mêmes menus, mots, couleurs, droits et composants partout | 4 à 6 semaines | Phase 1a ; décisions D1 à D12 |
| [3. Refonte des pages](#phase-3--refonte-des-pages-dans-lordre-dusage) | Chaque écran refait selon sa fiche, dans l'ordre d'usage | 10 à 12 semaines, page par page | Phase 2 |
| [4. Performance, lots 2 et 3](#phase-4--performance-lots-2-et-3) | Des temps de réponse qui ne grandissent plus avec l'historique | 7 à 10 semaines, en parallèle des phases 2 et 3 | Phase 0 livrée ; décisions DP1 à DP10 |
| [5. Dette](#phase-5--dette-technique) | Plus de copies divergentes, un seul serveur, une base protégée | 2 à 3 semaines pour ce qui reste | Phase 1 ; Phase 3 pour la fusion PC / téléphone |

### Phase 0 — Performance, lot 1 (fait)

**Objectif.** Rendre l'application rapide sans rien changer à ce que voient les équipes.

**Contenu.** Réalisé dans cette branche (64 fichiers modifiés), pas encore livré en production : code découpé par page, compressé et mis en cache ; utilisateur connecté lu une seule fois par session ; réponses de l'API allégées (plus de logo ni de configuration du magasin dans les listes, plus d'empreinte de mot de passe) ; 65 index créés automatiquement au démarrage ; appels inutiles et en double supprimés ; plus aucun rechargement complet de l'application. Détail en P4 § 2, mesures en P4 § 1.

| Mesure (administrateur sur PC) | Avant | Après |
|---|---|---|
| JavaScript reçu avant l'écran de connexion | 1,6 Mo | 180 Ko |
| Connexion → accueil affiché | 5,9 s, avec rechargement complet | 0,16 s |
| Accueil : appels `/api`, données reçues | 20 appels, 361 Mo | 12 appels, 464 Ko |
| Visite des 23 pages : données reçues, appels en double | 1,5 Go, 82 | 0,8 Mo, 0 |
| Requêtes SQL pour un passage sur toute l'API | 425 | 189 |
| Pic de mémoire du serveur | 1,4 Go | 325 Mo |
| Réponses contenant une empreinte de mot de passe ou le mot de passe SMTP chiffré | 18 | 0 |

**Pour clore la phase.** Les vérifications de livraison de P4 § 3 : reconstruire l'image Docker, livrer hors des heures d'ouverture (création des index en arrière-plan), contrôler la configuration nginx, tester un redéploiement avec un onglet resté ouvert, vérifier qu'aucun outil externe ne lisait les champs retirés des réponses. Dans la foulée, les quatre chantiers rapides du lot 3 (P4 § 4.2, n° 1 à 4).

**Effort.** Réalisé. Livraison : une demi-journée, puis une semaine de relevé des index.

**Critères de réussite** (mesurés au banc, à revérifier en production) :

- JavaScript reçu avant l'écran de connexion ≤ 200 Ko compressés ; aucun fichier `/assets` retéléchargé lors d'une visite suivante.
- `/api/user` appelé une seule fois par session ; 0 appel `/api` en double sur les 23 pages.
- Nombre de requêtes `/api` à l'accueil (administrateur) ≤ 12, pour moins de 500 Ko reçus.
- 0 réponse de l'API contenant une empreinte de mot de passe ou le mot de passe SMTP (sur les routes de lecture).
- En production : `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid` ne renvoie rien ; après un redéploiement, un onglet resté ouvert se recharge une fois, sans écran blanc.
- Aucune régression : statuts, valeurs et ordre des listes identiques sur les 272 réponses comparées (P4 § 1.6).

### Phase 1 — Corrections critiques

**Objectif.** Que l'application ne mente plus et ne laisse plus rien fuir : chaque magasin ne voit que ses données, aucun chiffre n'est faux, aucune saisie n'est perdue, les fonctions du quotidien marchent, y compris sur téléphone. L'organisation des écrans ne change pas encore.

**Contenu.**

- **1a. Bugs prioritaires**, à faire avant toute refonte (P3 § 1 et § 5) :
  - *Jour 1, filets immédiats* : clé `password` retirée de toutes les réponses (P3, T1), échappement des impressions (T8), `requireAdmin` sur les magasins et la météo, journaux contenant des secrets supprimés, champ commentaire du SAV masqué, suppression du code mort sans importateur (P3 § 4.5, étape 1), avertissement « ne jamais lancer `db:push` sur la base de production » dans le README (DB-02). Vérifier aussi que la production utilise sa propre clé de session (`SESSION_SECRET`, complément en fin de P3).
  - *Les vingt problèmes de P3 § 1*, en trois lots. **Lot A, sécurité** : empreintes de mots de passe envoyées au navigateur (USERS-02), failles d'impression (CMDCLI-08, DLC-26), fichiers relayés sans contrôle vers une adresse fournie par le navigateur (RAPPRO-21, AVOIRS-04), secrets en clair (NOCO-01 annexe 12, GROUPS-14), comptes sans magasin qui voient toute l'enseigne (SAV-06, CONT-02, ANA-05, ANA-06), écritures sans contrôle du magasin ni du rôle (CONT-03, DLC-06, CMDCLI-07, TASKS-13), configuration d'un magasin effacée par un manager (GROUPS-01), téléchargement hors du dossier des sauvegardes et identifiants « admin / admin » affichés (BACKUP-09, AUTH-04). **Lot B, données fausses ou perdues** : produits DLC « traités » qui disparaissent des alertes (DLC-01, DLC-02), formulaire DLC qui écrase des produits (DLC-03, DLC-04, DLC-05), commandes clients abîmées par une modification (CMDCLI-03, CMDCLI-04), commentaires SAV jamais enregistrés (SAV-02), échéance effacée et TTC à 0,00 € (RAPPRO-07, ECHE-02), chiffres faux (DASH-26, CAL-11, ANA-04, DASH-28), sauvegarde ratée affichée « en cours » (BACKUP-02). **Lot C, fonctions cassées** : accueil et tâches vides pour les managers et les employés (DASH-01, DASH-03, TASKS-02), modification des commandes fournisseurs impossible (ORD-01), SAV et dates en panne sur téléphone (MSAV-01, MSAV-02, MOB-02), listes vides ou figées (DLC-10, MOB-AVOIRS-01, SAV-01), fenêtre d'alerte DLC qui se rouvre (DASH-02, DLC-08).
  - *Puis la liste « Juste après » de P3 § 1* : sessions perdues à chaque redéploiement (AUTH-06), filtres absents sur tablette (TASKS-09), « En retard de 0 jour » (TASKS-12), affectations de magasin en double (USERS-03), fournisseur n° 1 attribué en silence (DLC-11), etc.
  - Avec ce qu'a déjà fait le lot 1, ces corrections ferment les 49 bugs de gravité haute de l'audit, sauf PUB-01 (publicités de tous les magasins visibles par tous), qui dépend de la décision DP5 et se traite en Phase 2 avec le correctif T2. ADMIN-01 est à vérifier à l'écran : le lot 1 en a supprimé la cause (hook d'authentification non partagé).
- **1b. Corrections rapides de l'interface**, sans changer l'organisation des écrans (en parallèle de 1a si un second développeur est disponible) :
  - Les actions immédiates de P1 (§ 4.1 et § 5, étape 1) : nom sur chaque bouton-icône (A2), gris lisibles (A5), messages d'erreur en français (A12), formats français des montants et des dates (A13), plus de texte technique à l'écran (A14), page introuvable en français (A15), tableaux qui défilent au lieu d'être coupés (ORD-11, PUB-22, USERS-14, DLC-43), rôle en français sur téléphone (SHELL-24).
  - Les lignes « D'abord (S) » de chaque fiche de P2 : elles retirent les fonctions factices (« Modifier » du SAV, SAV-03 ; « + » des publicités, PUB-11 ; « Exporter PDF » des DLC ; « Tester la configuration NocoDB »), protègent les gestes dangereux (suppression d'une sauvegarde sans confirmation, BACKUP-01 ; SQL brut en un clic, SQL-01 ; suppression d'un avoir d'un toucher sur téléphone, MOB-AVOIRS-02), débloquent les écrans (fenêtre d'envoi de facture qui ne se ferme jamais, RAPPRO-04 ; formulaire de commande client réduit à 90 % avec son bouton hors de l'écran, CMDCLI-20 ; employés bloqués sans magasin dans Contacts, CONT-04) et corrigent les libellés trompeurs (badge « Validé » d'un avoir non validé, AVOIRS-05).

**Effort.** 1a : environ deux semaines (P3 § 5 : jour 1, semaines 1 et 2). 1b : 1 à 2 semaines.

**Critères de réussite.**

- 0 réponse de l'API contenant `password`, `smtpPassword` ou un jeton NocoDB en clair, sur toutes les routes et pour les 4 rôles, `POST /api/users` compris.
- Un compte sans magasin reçoit 0 ticket SAV, 0 contact et 0 statistique ; un manager du magasin A reçoit un refus pour toute écriture sur le magasin B (contacts, SAV, DLC, commandes clients, tâches, magasins).
- Une étiquette ou une liste DLC imprimée avec un nom contenant `<b>` ou `&` affiche ce texte tel quel.
- Les scénarios des 20 problèmes de P3 § 1 sont rejoués et passent : une commande fournisseur se modifie ; un produit DLC « traité » revient dans « Expirés » à sa date ; corriger le téléphone d'une commande client ne change ni son statut ni son magasin ; la fenêtre d'alerte DLC se ferme en un geste et ne revient pas dans la session ; une sauvegarde interrompue apparaît « Échec ».
- Sur téléphone : 0 « Date inconnue » ; le SAV liste, crée et change de statut ; les listes DLC et avoirs ne sont jamais vides à tort (employé, « Tous les magasins »).
- 0 bug de gravité haute ouvert, sauf PUB-01 (Phase 2).
- Pour 1b : 0 bouton-icône sans nom accessible (contrôle automatique d'accessibilité) ; 0 code HTTP ni JSON dans les messages d'erreur ; `grep` : aucun `N/A`, `Required`, `toFixed(2)} €` ni identifiant technique `#12` affiché ; 0 fonction factice visible.

### Phase 2 — Socle : navigation, design system, composants communs

**Objectif.** Que chaque employé retrouve les mêmes mots, couleurs, gestes et droits partout, sur PC comme sur téléphone, et que chaque écran sache dire « chargement », « erreur » et « vide ». C'est la base de la refonte : une page refaite avant le socle devrait l'être deux fois.

**Prérequis.** Les décisions D1 à D11 (droits) et D12 (vocabulaire des statuts), prises en une réunion d'une heure avec un directeur et un responsable de magasin, tableau rôle × module de P1 § 2.2 en main.

**Contenu.**

- **Règles serveur communes à tous les modules** (P3 § 2) : accès par magasin (T2, qui règle aussi PUB-01 selon DP5), requêtes et clés de cache centralisées (T3), dates justes partout (T5), formulaires de modification qui n'écrasent rien (T6), retour juste après chaque action (T7). T4 (utilisateur chargé une seule fois) est fait par le lot 1.
- **Droits** : une seule table `shared/permissions.ts`, alignée sur le tableau rôle × module (P1 § 2.2), lue par le menu, les routes (`ProtectedRoute`), les boutons et le serveur ; suppression de la table client (P3 § 4.2, D).
- **Navigation** (P1 § 2) : menu regroupé par usage, identique sur PC et téléphone (`NAV_ITEMS`) ; magasin actif toujours visible et présélectionné ; cadre mobile unique qui rend au téléphone les 8 modules qui lui manquent (SHELL-10) ; PC ou téléphone choisi une fois au démarrage.
- **Design system** (P1 § 3) : couleurs contrastées et survols qui fonctionnent (§ 3.1, A3, A4), cinq tonalités et palette unique des statuts (§ 3.2, § 3.3, avec la configuration unique de P3 § 4.2, F), typographie, espacements et arrondis (§ 3.4, § 3.5).
- **Composants communs** (P1 § 3.6) : `PageHeader`, `StatusBadge`, `EmptyState`, `ErrorState`, squelettes, `ConfirmDialog`, `FilterBar`, `DataTable`, `IconButton`, `FormDialog`, `AccessDenied`, et un chargeur de données commun qui lève une erreur lisible (P3 § 4.2, G).
- **Migration des états et des confirmations sur toutes les pages existantes**, sans attendre leur refonte : squelette au premier chargement, `ErrorState`, `EmptyState`, `ConfirmDialog` à la place des 7 `window.confirm` (P1 § 5, étape 5). C'est ce qui supprime les faux « 0 » de l'accueil (DASH-22) et des autres écrans.

**Effort.** 4 à 6 semaines : correctifs T2 à T7 (environ deux semaines, P3 § 5), puis fondations, navigation et composants (P1 § 5, étapes 3 à 5, une dizaine de chantiers M).

**Critères de réussite.**

- Aucune page n'affiche « 0 » ni « Aucun… » pendant le chargement (test des 23 pages, PC et téléphone, avec un réseau ralenti dans le navigateur).
- Réseau coupé : chaque écran affiche « Impossible de charger… — Réessayer » (aujourd'hui, 2 pages seulement lisent l'erreur).
- Une seule table de droits : `client/src/lib/permissions.ts` supprimé, `grep "user?.role ==="` dans `client/src/pages` = 0. Avec un compte de chaque rôle : 0 « Accès refusé » en cliquant sur ce qui est affiché, et toute page interdite affiche « Vous n'avez pas accès à cette page ».
- Même menu sur PC et téléphone (18 entrées au plus, chaque icône une seule fois) ; sur téléphone, 0 module inaccessible (8 aujourd'hui) et 0 page sans navigation.
- Un employé mono-magasin, sur un navigateur vierge, voit son magasin et des listes remplies ; un seul sélecteur de magasin dans toute l'application.
- `grep "confirm("` = 0 (7 aujourd'hui) ; `grep -E "text-\[1[01]px\]"` = 0 ; aucun statut affiché en code brut (`planned`, `attente_echange`) ; aucun `statusConfig` ni `getStatusColor` en dehors du module de statuts.
- Contraste d'au moins 4,5:1 pour tout texte, bouton principal compris (3,2:1 aujourd'hui, 5,2:1 visé).

### Phase 3 — Refonte des pages, dans l'ordre d'usage

**Objectif.** Construire, écran par écran, l'écran cible décrit dans sa fiche de P2 : une action principale, des listes lisibles sur PC et téléphone, plus de fonction factice ni de doublon.

**Contenu.** Les fiches de P2, dans cet ordre :

1. **Écrans du quotidien en magasin** : Accueil (P2 § 1), DLC (§ 3), Tâches (§ 2), Livraisons (§ 6), Commandes clients (§ 4).
2. **Écrans de suivi** : SAV (§ 5), Commandes fournisseurs (§ 7), Calendrier (§ 8), Publicités (§ 12), Contacts (§ 13).
3. **Écrans de gestion** : Rapprochement BL / factures (§ 9), Avoirs (§ 10), Échéancier (§ 11), Statistiques (§ 15), Fiches fournisseurs (§ 14).
4. **Administration** : Utilisateurs (§ 16), Magasins (§ 17, dont la fenêtre d'environ 25 champs, GROUPS-05), Paramètres (§ 18), puis Connexion (§ 19) et page introuvable (§ 20).

Pour chaque page : versions PC et téléphone fusionnées en un seul écran qui s'adapte (P3 § 4.2, B, E et H), ce qui donne enfin au téléphone les fiches et les actions qui lui manquent (ouvrir une fiche, valider une réception, MOB-01) ; suppression des écrans non visibles qui la concernent (P2 § 21) ; bugs de gravité basse restants corrigés ; liste paginée côté serveur au même moment (P4 § 5.1). Les prérequis serveur sont signalés dans chaque fiche ; la refonte de l'Accueil s'appuie sur la route de synthèse de la Phase 4 (DASH-05).

**Effort.** 10 à 12 semaines pour un développeur (somme des fiches de P2 : une vingtaine de chantiers de 1 à 3 jours et trois de plus de 3 jours : DLC, Commandes clients, Rapprochement), découpables page par page ; chaque page livrée est utilisable seule.

**Critères de réussite.** Pour chaque page livrée :

- Elle respecte les dix principes de P1 § 1 et a été parcourue avec un compte de chaque rôle, sur PC et sur téléphone.
- Un seul bouton plein dans l'en-tête ; sur chaque ligne, au plus une action avec du texte et un menu « ⋯ » (jusqu'à 6 boutons-icônes par ligne aujourd'hui).
- Mêmes libellés, couleurs et icônes de statut sur PC, téléphone, calendrier et impression (tableau de P1 § 3.3).
- Après une action en page 3, la liste reste en page 3 ; actualiser une liste filtrée conserve les filtres.
- Une seule implémentation de l'écran : plus de paire PC / téléphone divergente.

Et pour l'ensemble : depuis l'accueil, chaque urgence est à un clic de sa liste filtrée et au plus une fenêtre automatique s'ouvre par session ; sur téléphone, valider une réception, traiter un produit DLC, prévenir un client et suivre un ticket SAV se font de bout en bout (selon les droits D1, D7, D8 et D9) ; 0 écran non visible ni fonction factice dans le code.

### Phase 4 — Performance, lots 2 et 3

**Objectif.** Des temps de réponse qui ne grandissent plus avec l'historique, et aucun service externe qui bloque un écran.

**Contenu.** P4 § 4.1 (lot 2), puis § 4.2 (lot 3), dans l'ordre de P4 § 5.1 :

- Le banc de mesure versionné dans le dépôt (lot 2, n° 0), pour prouver chaque gain sans régression.
- Logo et configuration du magasin retirés des réponses courantes et des fiches de détail (n° 1, GROUPS-02) ; contrôles d'accès légers (n° 2).
- Synthèse de l'accueil calculée en SQL (n° 3, DASH-05, DB-08), à faire avec DASH-01 et la décision DP2.
- Pagination côté serveur et sous-objets allégés, liste par liste (n° 4 et 5 : ORD-02, CMDCLI-02…), au moment où la page est refaite en Phase 3 et après la décision DP1.
- État de vérification des factures renvoyé avec les listes (n° 6), échéancier en SQL (n° 7, ECHE-01), liste légère des commandes (n° 8, MOD-01), délais maximaux sur les appels externes (n° 9), historique des relances (n° 10).
- Le lot 3 au fil de l'eau : caches, outils d'administration, journaux à niveaux, index déclarés dans le schéma.

**Effort.** Lot 2 : 5 à 7 semaines ; lot 3 : 2 à 3 semaines. Ce travail, surtout côté serveur, avance en parallèle des phases 2 et 3.

**Critères de réussite** (mesurés au banc, avant et après chaque chantier) :

- Nombre de requêtes `/api` à l'accueil (administrateur) ≤ 5, pour quelques Ko, quel que soit l'historique (12 appels et 464 Ko après le lot 1).
- `/api/groups` ≤ 10 Ko (148 Ko aujourd'hui) ; une fiche de détail ≤ 10 Ko compressés (111 Ko).
- Chaque liste renvoie au plus 50 lignes par page : les livraisons de l'administrateur pèsent environ 75 Ko au lieu de 3,8 Mo.
- Page Avoirs : ≤ 4 appels par visite (81 aujourd'hui).
- Échéancier : quelques dizaines de millisecondes, même avec NocoDB.
- Aucun appel externe sans délai maximal (webhook 5 s, météo 3 s, recherche d'article 5 s) ; `statement_timeout` en place sur la base.
- 0 régression au banc : statuts, valeurs et ordre des listes identiques.

### Phase 5 — Dette technique

**Objectif.** Que les corrections tiennent : plus de copies divergentes d'un même écran ou d'une même règle, un seul serveur, testé comme celui de production, une base qui ne peut pas perdre ses index.

**Contenu.** P3 § 4, dans l'ordre de P3 § 4.5. Une partie est avancée dans les phases précédentes, parce qu'elle les conditionne :

- en Phase 1 : suppression du code mort sans importateur (environ 3 700 lignes et 36 fichiers temporaires, étape 1), journaux contenant des secrets, avertissement `db:push` ;
- en Phase 2 : table de droits unique (étape 4), requêtes centralisées, chargeur commun et configuration des statuts (étape 5) ; le hook d'authentification unique (étape 3) est fait pour l'essentiel par le lot 1 ;
- en Phase 3 : fusion des versions PC et téléphone, module par module (étape 7).

Restent pour la Phase 5 (les étapes 2 et 6 ne dépendent d'aucune autre phase : P3 § 5 les place dès les semaines 3 et 4, en parallèle de la Phase 2, si un développeur serveur est disponible) :

- les journaux et routes mortes restants (étape 2) et le code mort à l'intérieur des fichiers (P3 § 4.1, seconde table : routes en double, `!important` du CSS, blocs 401 recopiés) ;
- le point d'entrée serveur unique (`createApp`), puis la suppression de `localAuth.production.ts` (étape 6, P3 § 4.2, C) ;
- la base de données (étape 8, P3 § 4.4) : index déclarés dans le schéma, unicité de `user_groups`, compteurs entiers, SQL paramétré, identifiants générés par le serveur.

**Effort.** 2 à 3 semaines pour ce qui reste après les phases 1 à 3.

**Critères de réussite.**

- 0 fichier sans importateur dans `client/src` et `server` (vérifié par recherche dans tout le dépôt).
- `npm start` et l'image Docker lancent le même code, avec les mêmes protections ; `localAuth.production.ts` et `db.production.ts` supprimés.
- Un `db:push` sur une copie de la base de production ne supprime aucun index ; `user_groups` n'a plus aucun doublon et porte un index unique.
- Une seule implémentation par module pour Tâches, Commandes clients, SAV, Avoirs, Publicités et DLC.
- Plus aucun `console.log` dans `server/routes.ts` (environ 150 aujourd'hui), remplacés par le journal à niveaux de P4 (lot 3, n° 21).

### Règles communes à toutes les phases

- **Aucune nouvelle erreur TypeScript** : `npx tsc --noEmit -p tsconfig.json` compte aujourd'hui 88 erreurs, toutes dans `server/storage.ts` ; ce nombre ne doit pas augmenter.
- **Le build Docker passe** : `vite build`, puis la commande esbuild du `Dockerfile` sur `server/index.production.ts` (c'est elle qui échoue si un fichier encore importé est supprimé).
- **Tester avec un compte de chaque rôle** : administrateur, directeur multi-magasins, manager, employé, et un compte sans magasin, sur PC, tablette et téléphone. Les bugs de cloisonnement (P3 § 3.2 et § 3.5) ne se voient qu'avec ces comptes.
- **Mesurer chaque changement de performance** avec le banc (P4 § 5.2) : il ne doit modifier ni un statut, ni une valeur, ni l'ordre d'une liste.
- **Lire le verdict de l'annexe avant de coder** : il signale les recommandations incomplètes ou risquées (par exemple RAPPRO-07, AVOIRS-API-06, TASKS-02, PERM-01, LAND-01, INFRA-11).
- **Une correction = un ou plusieurs identifiants cités** dans le message de commit, pour pouvoir cocher l'annexe.
- **Style** : code qui ressemble au code voisin, commentaires en français, sobres.

## Décisions produit à prendre

Ces questions ne relèvent pas du développeur : la réponse change ce que voient ou font les équipes. Pour ne pas bloquer le chantier, chacune a une proposition par défaut, appliquée tant que rien d'autre n'est décidé. Les décisions D1 à D12 sont à prendre avant la Phase 2, en une réunion d'une heure avec un directeur et un responsable de magasin, tableau rôle × module de P1 § 2.2 en main. D13 et D14 peuvent attendre. DP1 à DP10 sont à prendre avant le chantier de performance concerné (Phase 4).

### Droits, vocabulaire et contenu (D1 à D14)

| N° | Question | Situation actuelle | Proposition par défaut | Constats |
|---|---|---|---|---|
| D1 | L'employé voit-il les **commandes fournisseurs** et les **livraisons** ? Peut-il **valider une réception** depuis son téléphone ? | PC : masqué. Mobile : visible. Les deux tables de droits se contredisent. L'API renvoie les données. | Commandes fournisseurs : masqué. Livraisons : visible en lecture (savoir ce qui arrive aujourd'hui). Validation de réception : à accorder seulement si les employés réceptionnent les camions. | SHELL-11, PERM-01, MOB-01, DB-11 |
| D2 | L'employé voit-il les **avoirs** ? Qui peut **envoyer le PDF** d'un avoir reçu ? | PC : masqué ; mobile : visible avec suppression ; envoi du PDF impossible pour directeur et employé. | Avoirs masqués pour l'employé. Envoi du PDF : admin et directeur. | SHELL-11, AVOIRS-04, MOB-AVOIRS-02 |
| D3 | Le manager a-t-il accès au **rapprochement BL / factures** ? | Le texte de la page dit oui, le menu et le serveur disent non. | Non (admin et directeur). Corriger le texte de la page. | RAPPRO-17 |
| D4 | L'employé voit-il les **statistiques** ? | Menu : non. Serveur : oui. | Non. | ANA-05, ANA-14 |
| D5 | Le directeur gère-t-il les **comptes utilisateurs** de ses magasins ? | Menu : admin seul. Serveur : admin, directeur et manager peuvent lister les comptes. | Admin seul, serveur aligné. | USERS-02, USERS-20 |
| D6 | L'employé peut-il **terminer** une tâche ? Le manager peut-il en **supprimer** ? | Mobile : « Terminer » pour tous. PC : « Supprimer » pour les managers. Table de droits : ni l'un ni l'autre. | Employé : oui pour terminer. Manager : pas de suppression. | TASKS-13, TASKS-26 |
| D7 | L'employé peut-il marquer un produit **« Retiré du rayon »** ou **« Vérifié »** ? | Proposé sur mobile, refusé en silence par le serveur ; la fenêtre d'alerte pousse à « Stock épuisé » à la place. | Oui (c'est lui qui est en rayon), avec confirmation. Suppression réservée à partir du manager. | DLC-13, DLC-32, DLC-06 |
| D8 | L'employé peut-il marquer **« Client prévenu »**, **« Retirée »**, **« Annulée »** sur une commande client ? | Interface : oui pour tout. Serveur : aucun contrôle. Table : création seule. | Oui pour « Client prévenu » et « Retirée » (gestes de comptoir). Non pour « Annulée » et la modification. | CMDCLI-07, CMDCLI-10, CMDCLI-26 |
| D9 | L'employé peut-il **créer un ticket SAV** ? | PC : non. Mobile : bouton visible. Serveur : refus. | Oui pour la création (le client se présente à l'accueil). Statut et priorité : à partir du manager. | MSAV-04 |
| D10 | Qui modifie une **fiche fournisseur** ? | Fiches fournisseurs : admin. Contacts : admin et directeur. Serveur : admin, directeur et manager. | Admin et directeur, depuis Fiches fournisseurs uniquement. | SUPP-02, SUPP-01 |
| D11 | Les **outils avancés** (SQL brut, diagnostic de la base) restent-ils accessibles en production ? | Un clic depuis Utilitaires, sans confirmation. | Masqués par défaut (variable d'environnement), regroupés sous « Outils avancés » avec confirmation tapée. | SQL-01, DEBUG-02, UTIL-01 |
| D12 | **Vocabulaire des statuts** de P1 § 3.3 (« À demander », « Retiré du rayon », « Vérifié », « Contrôle fait », féminin « Planifiée / Livrée ») : à valider avec un responsable de magasin. | Libellés différents selon l'écran. | Tableau de P1 § 3.3 (avec « À recevoir » pour les livraisons planifiées). | CMDCLI-27, DLC-32, AVOIRS-06, LIV-02, LIV-01 |
| D13 | **Analyse des ventes** (page externe en iframe, non branchée) : on la branche ou on la supprime ? | Code présent mais inaccessible. | À trancher ; sans usage connu, supprimer. | SALES-01 |
| D14 | **Mode sombre** : le maintient-on ? | Jamais activé (aucune classe `dark` posée, vérifié), mais 73 classes `dark:` dans le code. | Non pour l'instant : un seul thème clair, bien contrasté. | TASKS-17 |

### Performance et données (DP1 à DP10)

| N° | Question | Pourquoi c'est une décision | Proposition par défaut | Constats |
|---|---|---|---|---|
| DP1 | **Quelle période afficher par défaut** dans les listes paginées ? | Avec une période, une ligne ancienne n'est plus visible sans action. | Commandes et livraisons : les 3 derniers mois, puis « Voir plus ». Tâches terminées, produits DLC validés, commandes clients retirées ou annulées : les 30 derniers jours. Tickets SAV fermés masqués par défaut. Avoirs finalisés chargés à l'ouverture de l'onglet. La recherche porte toujours sur tout l'historique. | ORD-02, TASKS-27, DLC-17, CMDCLI-02, SAV-13, AVOIRS-API-02 |
| DP2 | **Que montre l'accueil**, et pour quel magasin ? | La route de synthèse fige la définition des compteurs. Corriger DASH-01 change les chiffres des managers et des directeurs. | Les compteurs de la fiche Accueil de P2 (§ 1), toujours calculés pour le magasin actif. | DASH-05, DB-08, DASH-01 |
| DP3 | **Caches côté serveur** : accepte-t-on un léger décalage des chiffres ? | Un cache mal invalidé affiche un chiffre périmé. | Pas de cache pour les statistiques (5 ms aujourd'hui). Cache de 5 minutes pour la configuration NocoDB, vidé à sa modification. Cache météo seulement après WEATHER-01. | DASH-10, CAL-12, WEATHER-04, AVOIRS-API-09 |
| DP4 | **« Meilleurs magasins »** dans l'export de Statistiques : le garder ? Lui appliquer la période choisie ? | Le résultat n'est affiché nulle part à l'écran. Appliquer la période change les chiffres exportés. | Le retirer de l'export (ANA-17), ce qui supprime la requête. | ANA-03, ANA-17, DB-16 |
| DP5 | **Publicités** : chaque magasin ne voit-il que ses campagnes ? | Aujourd'hui, toutes les campagnes de l'année sont visibles par tous. | Oui pour le calendrier et l'accueil. Vue d'ensemble complète gardée pour l'admin. | CAL-15, DB-29 |
| DP6 | **Logger à niveaux en production** : accord de l'exploitant ? | Change ce que contiennent les journaux Docker. | Niveau `info` par défaut, `debug` activable par variable d'environnement. | NOCO-04 (annexe 03), INFRA-14 |
| DP7 | **Index en double** déjà présents sur certaines bases (créés à la fois par `init.sql` et par la migration manuelle) : les supprimer ? | Supprimer un index est une opération sur la base de production. | Oui, après une semaine de relevé de `pg_stat_user_indexes`, en supprimant celui qui n'est pas utilisé. | DB-37 |
| DP8 | **Sauvegarde déclenchée à la connexion** : la garder ? | Elle n'est plus bloquante, mais elle fait doublon avec la sauvegarde automatique horaire. | La garder tant que BACKUP-02 n'est pas corrigé, puis la retirer. | BACKUP-04 |
| DP9 | **« Vérifier toutes les factures »** : forcer NocoDB pour toutes les lignes, ou seulement pour celles en rouge ou pas encore vérifiées ? | Le comportement du bouton change. | Seulement les lignes rouges ou non vérifiées, avec une progression « 12 / 40 » et un récapitulatif. | RAPPRO-22 |
| DP10 | **Échéancier** : que faire des livraisons dont l'échéance est inconnue ? | Ne plus appeler NocoDB pendant l'affichage, c'est accepter de les montrer « à compléter ». | Les afficher dans une ligne « Échéance à compléter », complétée par la vérification de facture. | ECHE-01 |
| — | **Numérotation des tickets SAV** : corriger le calcul (« 5 » + 1 = « 51 ») et imposer l'unicité ? | Les numéros visibles changent. | Déjà inscrit dans P3. Le lot 1 n'a rendu que le filtre indexable. | DB-27 |

### Autres questions ouvertes relevées dans les fiches

| N° | Question | Où | Proposition par défaut | Constats |
|---|---|---|---|---|
| Q1 | **Vue Kanban des tâches** : la retirer ? | P2 § 2 | Retirée : ses deux colonnes répètent les onglets « À faire » et « Terminées ». À défaut, la rendre utilisable sur tablette. À confirmer avec le propriétaire. | TASKS-09 |
| Q2 | **« Modifier » du SAV** : brancher l'enregistrement ou retirer le bouton ? | P2 § 5 | Bouton retiré tant que l'enregistrement n'existe pas. | SAV-03 |
| Q3 | **Bouton « Envoyer un bon à payer (BAP) »** : dans le Rapprochement ou dans l'Échéancier ? | P1 § 2.1 | En-tête du Rapprochement BL / factures, réservé à l'admin ; à confirmer avec la personne qui l'utilise. | BAP-01, SHELL-29 |
| Q4 | **Restaurer une sauvegarde depuis l'interface** ? | P2 § 18.1 | Pas de proposition dans les fiches ; en attendant, pas de restauration depuis l'interface (situation actuelle). | — |
| Q5 | **Téléphone du client obligatoire** dans une commande client ? | P2 § 4 | Oui, à confirmer avec le comptoir. | — |
| Q6 | **Cases « Prix promotionnel » et « Client déjà notifié »** du formulaire sur téléphone : les faire fonctionner ou les retirer ? | P2 § 4, P3 § 3.3 | Les faire fonctionner (champs ajoutés au schéma, P3) ; les retirer si le comptoir ne s'en sert pas. | CMDCLI-06 |
| Q7 | **Avoir validé** : l'admin peut-il encore changer son statut ? | P3 § 3.6 | Oui pour l'admin seul, comme la règle serveur d'AVOIRS-API-07 ; menu grisé pour les autres. | AVOIRS-18, AVOIRS-API-07 |
| Q8 | **Publicités sans magasin participant**, en « Tous les magasins » : l'admin les voit-il ? | P3 § 3.2 | Oui : la vue d'ensemble complète reste à l'admin (DP5). | PUB-01 |
| Q9 | **Sessions conservées entre deux déploiements** ? | P3 § 3.10 | Oui : sessions en base, plus de déconnexion générale à chaque mise à jour. | AUTH-06, INFRA-08 |
| Q10 | **Protection CSRF** (décision technique) : la garder, avec l'en-tête envoyé par `apiRequest`, ou aligner `npm start` sur l'image Docker, qui n'en a pas ? | P3 § 3.10, § 4.2 C | À trancher avant l'unification des points d'entrée (dette, étape 6). | AUTH-07 |

---

## P1 — Principes, navigation et design system

Cette section fixe les règles communes à tous les écrans : ce que l'on s'interdit, comment on navigue, quelles couleurs et quels composants on utilise. Les sections suivantes du plan (page par page) s'appuient dessus. Le but : qu'un employé, un manager ou un directeur retrouve **les mêmes mots, les mêmes couleurs et les mêmes gestes partout**, sur PC comme sur téléphone.

Chaque action renvoie aux constats de l'audit entre parenthèses, par exemple (SHELL-12, DASH-21) ; le tableau des préfixes et des fichiers de l'annexe est dans [Comment lire ce plan](#comment-lire-ce-plan).

---

### 1. Dix principes pour toute l'application

Chaque principe est une règle simple, avec les constats qui la justifient et un moyen concret de vérifier qu'elle est respectée. Une page n'est « terminée » que si elle respecte les dix.

#### Principe 1. Une action principale par écran, une action principale par ligne

- **Règle.** En haut de page : un titre et **un seul** bouton plein (ex. « Nouvelle livraison »). Sur chaque ligne ou carte : **un seul** bouton avec du texte pour le geste le plus fréquent (« Valider la réception », « Prévenir le client »), le reste dans un menu « ⋯ » dont chaque entrée a un libellé. Une seule fenêtre ouverte à la fois, jamais deux fenêtres empilées.
- **Pourquoi.** Jusqu'à 5 ou 6 boutons-icônes sans texte par ligne, dont deux coches presque identiques (RAPPRO-14, AVOIRS-07, DLC-23, ORD-10, CMDCLI-24) ; en-têtes à 7 contrôles (PUB-21) ; deux fenêtres automatiques empilées à l'ouverture de l'accueil (DASH-24) ; fiches avec une fenêtre d'édition par-dessus (MOD-08, CAL-14) ; couleurs de bouton principal différentes d'un onglet à l'autre (BACKUP-10, MOD-09).
- **Vérification.** Au plus un `<Button>` en variante par défaut dans l'en-tête de page ; au plus un bouton texte + un menu « ⋯ » par ligne ; aucune `Dialog` ouverte depuis une autre `Dialog`.

#### Principe 2. Un statut = un mot, une couleur, une icône, partout

- **Règle.** Le même statut s'affiche avec le même libellé, la même couleur et la même icône sur PC, sur téléphone, dans le calendrier, dans les légendes et à l'impression. La couleur n'est jamais seule : il y a toujours un texte. Tout vient d'une seule configuration (§ 3.3).
- **Pourquoi.** « Planifié » est bleu dans Commandes, jaune dans le calendrier, affiché `planned` sur mobile (ORD-12, CAL-06, MCAL-01) ; légende du calendrier fausse (CAL-06) ; trois copies divergentes des couleurs de commandes clients (CMDCLI-28) ; vocabulaire et couleurs différents entre PC et mobile pour les tâches, le SAV, les avoirs, les DLC, les publicités (TASKS-18, MSAV-06, MOB-AVOIRS-09, DLC-28, PUB-26) ; toutes les priorités de tâches en bleu sur l'accueil (DASH-19) ; statut codé par des points de 8 px (CAL-07).
- **Vérification.** `grep` : plus aucun `case 'pending'`, `case "Reçu"`, `statusConfig` ou `getStatusColor` en dehors du module de statuts ; aucun code brut (`attente_echange`, `planned`) visible à l'écran.

#### Principe 3. Jamais de faux chiffre

- **Règle.** Pendant le chargement : un squelette à la forme du contenu, jamais « 0 » ni « Aucun… ». En cas d'erreur : un message clair et un bouton « Réessayer ». Le message « Aucun… » n'apparaît qu'après un chargement réussi, et dit pourquoi (vraiment vide, filtres trop stricts, ou aucun magasin choisi).
- **Pourquoi.** L'accueil affiche « 0 » et « Toutes les tâches sont terminées » pendant le chargement (DASH-22) ; une panne s'affiche comme « Aucune commande », « Aucun ticket », « Aucune publicité », « 0 produit expiré » (MOB-03, TASKS-22, SAV-23, PUB-13, DLC-22, CMDCLI-18, MSAV-09, SUPP-07, CONT-07, ANA-18). Aujourd'hui, seules 2 pages lisent `isError` et 29 fichiers de pages (21 PC, 8 mobiles) n'affichent qu'un spinner pendant le chargement (vérifié par `grep`).
- **Vérification.** Chaque `useQuery` affichée gère `isLoading`, `isError` et la liste vide avec les composants du § 3.6 ; test manuel : couper le réseau, chaque écran affiche « Impossible de charger… — Réessayer ».

#### Principe 4. Lisible de loin, en magasin

- **Règle.** Données en 14 px minimum (16 px dans les champs sur téléphone), rien sous 12 px. Texte informatif en gris 600 au moins sur fond blanc. Pas d'opacité ni de texte barré pour signaler un état : on utilise un badge. Cibles tactiles d'au moins 44 × 44 px sur téléphone, 36 px sur PC.
- **Pourquoi.** Libellés de 10-11 px dans la navigation et le calendrier (SHELL-22, CAL-07) ; gris 400 (contraste 2,5:1) pour des textes utiles (DASH-41, SUPP-12) ; tâches terminées à 1,6:1 (TASKS-20), lignes DLC et avoirs finalisés grisés par opacité (DLC-42, AVOIRS-08), lignes barrées (CMDCLI-24) ; boutons de 16 à 28 px (AVOIRS-07, TASKS-15, SAV-20, DASH-37) ; bouton principal à 3,2:1 (SHELL-16).
- **Vérification.** `grep` : aucun `text-[10px]`/`text-[11px]`, aucun `text-gray-400` sur du texte, aucun `opacity-50/60/75` sur une ligne de données ; contrôle des contrastes du § 3.1.

#### Principe 5. Français métier, formats français, zéro jargon

- **Règle.** Aucun code technique, mot anglais, JSON, identifiant interne ou emoji dans l'interface. Montants « 1 234,50 € », dates « 05/10/2026 », pluriels corrects (« Expire aujourd'hui », « Expiré depuis 2 jours »). Un seul mot par notion (glossaire § 4.2).
- **Pourquoi.** Texte de debug « (API: NOT_ARRAY) » (DASH-21) ; erreurs « 403: {"message":…} » (ERR-01, RAPPRO-16, AVOIRS-09, DLC-21) ; « N/A », codes `pieces_manquantes` (SAV-18) ; « Required » (DLC-44) ; « Groupe » au lieu de « Magasin » (ORD-08, USERS-17, GROUPS-11) ; identifiants techniques (USERS-09, SUPP-06, GROUPS-10, ORD-09) ; « 1234.50 € » (ECHE-05, AVOIRS-17, CMDCLI-35, ANA-15, MAIL-02) ; calendriers en anglais (ANA-16) ; 404 en anglais (NF-01, SHELL-23) ; rôle « Employee » (SHELL-24) ; « Expiré depuis 0 jour(s) », « J-3 » ambigu (DLC-39, DLC-29).
- **Vérification.** Tous les toasts d'erreur passent par `getErrorMessage()` ; tous les montants par `formatEuro()` ; `grep` : aucun `N/A`, `Required`, `toFixed(2)} €`, `#{id}` affiché.

#### Principe 6. Confirmer ce qui est définitif, et seulement cela

- **Règle.** Suppression, changement de statut à effet externe ou irréversible (avoir « Reçu », ticket « Fermé », commande client « Annulée », produit « Retiré du rayon », dévalidation, changement de rôle, SQL) : une fenêtre de confirmation, **la même partout**, qui nomme l'objet (« Supprimer la livraison du 12/10 de Lactalis ? »). Pour un geste rapide et réversible (contrôle fait, client prévenu) : pas de fenêtre, mais un toast avec « Annuler ». Jamais `window.confirm`. Fermer un formulaire modifié demande « Abandonner les modifications ? ».
- **Pourquoi.** Suppressions sans confirmation (BACKUP-01, MOB-AVOIRS-02, DASH-37) ; statuts changés d'un clic avec effet externe (AVOIRS-06, CMDCLI-26, SAV-24, MSAV-05, DLC-13, LIV-02) ; 7 `window.confirm` natifs et 3 styles de confirmation (USERS-13, RAPPRO-27, SAV-21) ; SQL brut exécuté sans garde-fou (SQL-01) ; saisie perdue d'un clic hors de la fenêtre (GROUPS-13).
- **Vérification.** `grep "confirm("` = 0 ; toutes les confirmations utilisent `ConfirmDialog` (§ 3.6).

#### Principe 7. On ne montre que ce que l'utilisateur a le droit de faire

- **Règle.** Une seule table de droits (`shared/permissions.ts`) décide du menu, de l'accès aux pages, de l'affichage des boutons **et** des contrôles du serveur. Un bouton visible doit fonctionner. Une page interdite affiche « Vous n'avez pas accès à cette page » avec un bouton de retour, jamais une page vide.
- **Pourquoi.** Trois sources de vérité différentes pour la navigation (SHELL-11), deux tables de droits divergentes (PERM-01) ; boutons proposés puis refusés par le serveur (AVOIRS-10, MSAV-04, DLC-13, RAPPRO-17, CAL-08) ; actions permises par l'API mais cachées dans l'interface, ou l'inverse (SUPP-02, TASKS-13, CMDCLI-07, GROUPS-01) ; bouton « + » qui ne fait rien (PUB-11).
- **Vérification.** `grep "user?.role ==="` dans `client/src/pages` = 0 (tout passe par `usePermissions`) ; test avec un compte de chaque rôle : aucun toast « Accès refusé » en cliquant sur ce qui est affiché.

#### Principe 8. Le magasin actif est toujours visible et toujours défini

- **Règle.** Le nom du magasin actif est affiché en permanence dans l'en-tête, pour tous les rôles. Un utilisateur qui n'a qu'un magasin l'a sélectionné d'office ; un directeur ou un manager multi-magasins retrouve son dernier magasin. Un seul sélecteur dans toute l'application. Le mode « Tous les magasins » (admin) est explicite : les listes affichent alors une colonne Magasin, les formulaires demandent le magasin.
- **Pourquoi.** Un employé ne voit jamais son magasin (SHELL-14) et reste bloqué sans tâches ni contacts (TASKS-02, CONT-04) ; bandeau rouge bloquant pour les directeurs (SHELL-15) ; second sélecteur dans Contacts et Statistiques (CONT-06, ANA-14) ; sélecteur ignoré (CMDCLI-16, SUPP-11) ; magasin imposé en silence à la création (MOD-03, TASKS-21) ; listes vides en « Tous les magasins » (CMDCLI-31, PUB-12, DLC-10).
- **Vérification.** Connexion avec un employé mono-magasin sur un navigateur vierge : le magasin s'affiche et toutes les listes sont remplies ; `grep` : aucun sélecteur de magasin hors de l'en-tête.

#### Principe 9. Ce qui a l'air cliquable l'est, et inversement

- **Règle.** Un curseur « main », une ombre ou un fond au survol uniquement sur un élément qui fait quelque chose. Les compteurs mènent à la liste filtrée correspondante. Une carte de liste s'ouvre au clic.
- **Pourquoi.** Accueil où tout réagit au survol mais rien n'est cliquable (DASH-23) ; cartes SAV et tâches avec curseur « main » inertes (SAV-20, TASKS-19) ; flèches « › » sur des cartes mobiles non cliquables (MOB-01) ; compteurs DLC, SAV, publicités non cliquables (DLC-27, SAV-22, PUB-23) ; widgets météo et date avec ombre au survol (SHELL-14) ; badge de statut cliquable mais non repérable (CMDCLI-25).
- **Vérification.** `grep cursor-pointer` et `hover:shadow` : chaque occurrence est sur un élément avec `onClick` ou `href`.

#### Principe 10. On ne perd ni sa saisie ni sa place

- **Règle.** Après une action dans une liste, on reste sur la même page de résultats et les mêmes filtres. Les filtres et l'onglet actif sont dans l'adresse (on peut actualiser ou partager le lien). Après connexion, on arrive sur la page demandée. Tourner le téléphone ne réinitialise rien.
- **Pourquoi.** Retour en page 1 après chaque suppression ou validation (ORD-14, RAPPRO-20, DLC-51, TASKS-14) ; onglet perdu à l'actualisation (UTIL-02) ; page demandée perdue à la connexion (SHELL-09) ; rotation du téléphone qui démonte l'application et efface la saisie (SHELL-25) ; « Annuler » qui n'annule pas les magasins déjà enregistrés (USERS-07).
- **Vérification.** Supprimer une ligne en page 3 : on reste en page 3 ; actualiser une liste filtrée : les filtres sont conservés ; ouvrir `/dlc` déconnecté puis se connecter : on arrive sur `/dlc`.

---

### 2. Navigation

#### 2.1 Menu regroupé par usage métier

Aujourd'hui : 19 entrées en 5 sections pour un admin, dont une section d'une seule entrée, des libellés ambigus (« Commandes » / « Commandes Client », « Échéance », « BAP »), la même icône pour Tableau de bord et Statistiques, et des noms différents sur mobile (SHELL-12). Nouveau menu, **identique sur PC et téléphone** :

| Section | Ordre | Libellé exact | Icône (lucide) | Adresse | Libellé actuel PC / mobile |
|---|---|---|---|---|---|
| *(en tête, sans titre)* | 1 | Accueil | `Home` | `/` | Tableau de bord / Accueil |
| **Au quotidien** | 2 | Tâches | `ListTodo` | `/tasks` | Tâches (icône `CheckSquare` sur mobile) |
| | 3 | DLC | `CalendarClock` | `/dlc` | Gestion DLC / DLC |
| | 4 | Commandes clients | `ShoppingCart` | `/customer-orders` | Commandes Client / Cmd Client |
| | 5 | SAV | `Wrench` | `/sav` | SAV |
| **Fournisseurs** | 6 | Commandes fournisseurs | `Package` | `/orders` | Commandes |
| | 7 | Livraisons | `Truck` | `/deliveries` | Livraisons |
| | 8 | Rapprochement BL / factures | `FileCheck` | `/bl-reconciliation` | Rapprochement (absent du mobile) |
| | 9 | Avoirs | `Receipt` | `/avoirs` | Avoirs |
| | 10 | Échéancier | `CreditCard` | `/payment-schedule` | Échéance (absent du mobile) |
| **Planning et infos** | 11 | Calendrier | `CalendarDays` | `/calendar` | Calendrier (« Agenda » sur l'accueil mobile, DASH-31) |
| | 12 | Publicités | `Megaphone` | `/publicities` | Publicités |
| | 13 | Contacts | `BookUser` | `/contacts` | Contacts (absent du mobile, CONT-09) |
| | 14 | Statistiques | `LineChart` | `/analytics` | Statistiques (icône `BarChart3` en double ; titre de page « Tableau de bord Analytics », ANA-15) |
| **Administration** | 15 | Utilisateurs | `UserCog` | `/users` | Utilisateurs |
| | 16 | Magasins | `Store` | `/groups` | Magasins (icône `Users`) |
| | 17 | Fiches fournisseurs | `Building2` | `/suppliers` | Fournisseurs |
| | 18 | Paramètres | `Settings` | `/utilities` | Utilitaires |

Règles associées :

- **Chaque icône n'apparaît qu'une fois dans le menu.** `Store` sert aujourd'hui de logo dans l'en-tête du menu (Sidebar.tsx:400) : le logo passe à une autre icône (ex. `Boxes`) ou à une image, pour que `Store` désigne uniquement « Magasins ». (SHELL-12)
- **Titres de section** en casse normale, 12 px semi-gras, sans majuscules forcées (aujourd'hui `text-[11px] uppercase tracking-widest`, SHELL-22).
- **Les adresses ne changent pas** (liens existants, favoris). `/` et `/dashboard` activent tous deux « Accueil » (SHELL-13).
- **« Fiches fournisseurs »** évite la confusion avec la section « Fournisseurs ». Contacts reste l'annuaire téléphonique (lecture, liens Appeler / Écrire) avec un lien « Modifier la fiche » vers Fiches fournisseurs, pour qu'il n'y ait qu'un seul endroit où modifier un fournisseur (SUPP-01, SUPP-02).
- **Le menu ne contient que des pages.** L'entrée « BAP » (un bouton déguisé en lien, non accessible au clavier, SHELL-21) quitte le menu : l'envoi devient un bouton « Envoyer un bon à payer (BAP) » dans l'en-tête de la page Rapprochement BL / factures, réservé à l'admin, dont la fenêtre est extraite du composant de menu (SHELL-29, BAP-01). L'emplacement exact (Rapprochement ou Échéancier) est à confirmer avec la personne qui l'utilise.
- **Paramètres** regroupe les onglets d'administration en 4 onglets compréhensibles : « Sauvegardes », « Météo », « Connexions externes » (NocoDB + envoi des BAP), « Outils avancés » (diagnostic de la base, SQL) replié derrière un avertissement, avec l'onglet actif dans l'adresse (UTIL-01, UTIL-02, DEBUG-02, SQL-01).

#### 2.2 Qui voit quoi : tableau rôle × module

Légende : **Gérer** = voir, créer, modifier, supprimer · **Voir** = consultation seule · **—** = absent du menu, page refusée · **Dn** = décision produit à prendre (voir [Décisions produit à prendre](#décisions-produit-à-prendre)), la proposition par défaut est indiquée.

| Module | Admin | Directeur | Manager | Employé | Incohérences actuelles corrigées |
|---|---|---|---|---|---|
| Accueil | ✓ | ✓ | ✓ | ✓ | — |
| Tâches | Gérer | Gérer | Créer, modifier, terminer | Voir + terminer (D6) | « Supprimer » proposé aux managers sur PC, « Terminer » à tous sur mobile, serveur sans contrôle de rôle (TASKS-13, TASKS-26) |
| DLC | Gérer | Gérer | Créer, modifier, retirer | Voir, ajouter + retirer du rayon (D7) | « Valider » proposé puis refusé en silence sur mobile (DLC-13) |
| Commandes clients | Gérer | Gérer | Créer, modifier | Voir, créer + « client prévenu », « retirée » (D8) | serveur ne vérifie pas le rôle en modification (CMDCLI-07, CMDCLI-10) |
| SAV | Gérer | Gérer | Créer, modifier | Voir + créer (D9) | « + » mobile visible puis refusé (MSAV-04) |
| Commandes fournisseurs | Gérer | Gérer | Créer, modifier | **D1** — proposé : — | masqué sur PC, visible sur mobile, lisible par l'API (SHELL-11, PERM-01) |
| Livraisons | Gérer + valider | Gérer + valider | Créer, modifier, valider | **D1** — proposé : Voir | idem |
| Rapprochement BL / factures | Gérer | Gérer sauf supprimer | **D3** — proposé : — | — | message de la page « managers », menu sans manager, serveur sans manager (RAPPRO-17) |
| Avoirs | Gérer | Gérer | Voir, créer | **D2** — proposé : — | visible pour tous sur mobile, masqué sur PC (SHELL-11, AVOIRS-04) |
| Échéancier | Voir | Voir | — | — | inaccessible sur mobile (SHELL-10) |
| Calendrier | Gérer | Gérer | Créer, modifier | Voir | case cliquable même sans droit (CAL-08) |
| Publicités | Gérer | Voir | Voir | Voir | « + » mobile sans action, visible pour tous (PUB-11) |
| Contacts | Gérer | Gérer | Gérer | Voir | employé bloqué sans magasin (CONT-04), absent du mobile (CONT-09) |
| Statistiques | Voir | Voir | Voir | **D4** — proposé : — | API ouverte à tous, sans filtre par magasin pour un bloc (ANA-05) |
| Utilisateurs | Gérer | **D5** — proposé : — | — | — | API de liste ouverte aux managers, avec les empreintes de mots de passe (USERS-02) |
| Magasins | Gérer | — | — | — | un manager peut ouvrir la page par l'adresse et effacer la configuration d'un magasin (GROUPS-01) |
| Fiches fournisseurs | Gérer | **D10** — proposé : modifier | — | — | trois règles différentes PC / Contacts / serveur (SUPP-02) |
| Paramètres | Gérer (outils avancés : D11) | — | — | — | — |

Mise en œuvre (une seule fois, pour tous les modules) :

1. **Compléter `shared/permissions.ts`** avec les modules qui n'y figurent pas (`sav`, `contacts`, `analytics`, `payment-schedule`, `users`, `groups`, `suppliers`, `settings`), y reporter le tableau ci-dessus, et **supprimer `client/src/lib/permissions.ts`** (seconde table divergente, encore importée par Calendar, OrderDetailModal, QuickCreateMenu, Users, Utilities, BackupManager). (PERM-01, SHELL-11)
2. **Une configuration de navigation unique** `client/src/lib/navigation.ts`, lue par le menu PC, la barre mobile, le menu mobile, l'en-tête (titre de page) et le titre de l'onglet du navigateur :

   ```ts
   // Configuration unique de la navigation (PC et mobile)
   export interface NavItem {
     path: string;            // "/deliveries"
     label: string;           // "Livraisons" : même libellé partout
     icon: LucideIcon;        // unique dans le menu
     module: Module;          // clé de shared/permissions.ts
     section?: "quotidien" | "fournisseurs" | "planning" | "admin";
     mobileShortcut?: number; // ordre de priorité pour la barre basse
   }
   export const NAV_ITEMS: NavItem[] = [/* tableau du § 2.1 */];
   export const getNavItems = (role: string) =>
     NAV_ITEMS.filter((item) => hasModuleAccess(role, item.module));
   export const getNavItemForPath = (path: string) => /* "/" et "/dashboard" -> Accueil */;
   ```

3. **Protéger chaque route** : `<ProtectedRoute module="reconciliation" component={BLReconciliation} />` affiche un écran « Vous n'avez pas accès à cette page — Retour à l'accueil » au lieu d'une page vide ou partielle (SHELL-11, RAPPRO-17, GROUPS-01).
4. **Aligner le serveur** sur la même table (`requireModulePermission` existe déjà dans `server/permissions.ts`) pour chaque route qui écrit (TASKS-13, CMDCLI-07, SUPP-02, GROUPS-01, USERS-02, ANA-05). Ce point est détaillé dans les sections serveur du plan.
5. Dans la page Utilisateurs, afficher sous chaque rôle une ligne qui résume ce qu'il permet, générée depuis la même table (USERS-20), et proposer « Directeur » partout (USERS-08).

#### 2.3 Décisions produit à prendre

Les décisions D1 à D14 (qui voit quoi, vocabulaire des statuts, analyse des ventes, mode sombre) ne relèvent pas du développeur : la réponse change ce que voient les équipes. Elles sont regroupées, avec celles de P4 et les autres questions ouvertes, dans la section [Décisions produit à prendre](#décisions-produit-à-prendre) en tête de document. Chacune a une proposition par défaut, pour ne pas bloquer le chantier.

#### 2.4 Page d'accueil

- **Une seule page d'accueil**, « Accueil », atteinte après la connexion (ou la page demandée avant connexion, SHELL-09), active dans le menu sur `/` et `/dashboard` (SHELL-13).
- **Ordre fixe, du plus urgent au moins urgent**, identique sur PC et téléphone : 1) un bloc « À traiter aujourd'hui » (DLC expirés et proches, livraisons en retard, commandes en attente, clients à appeler), chaque ligne avec son bouton d'action ; 2) les compteurs, chacun cliquable vers la liste filtrée ; 3) les informations internes ; 4) les tâches. (DASH-24, DASH-23, DASH-31)
- **Au plus une fenêtre automatique par session** (information d'abord, alerte DLC ensuite), toujours fermable par la croix (DASH-24).
- Aucun chiffre avant la fin du chargement (principe 3, DASH-22). Le détail de l'accueil est traité dans la section consacrée au tableau de bord.

#### 2.5 En-tête

**PC — barre du haut (64 px)**, de gauche à droite :

1. Bouton de repli du menu, avec un nom accessible « Réduire le menu » / « Déplier le menu » (SHELL-21).
2. *(espace)*
3. **Magasin actif**, toujours visible : sélecteur pour ceux qui ont plusieurs magasins, simple badge en lecture seule pour les autres, nom complet non tronqué (SHELL-14, SHELL-15). Le changement de magasin passe par une seule fonction partagée PC/mobile qui recharge proprement les données (SHELL-07).
4. **Météo compacte** : icône + température, détail (an dernier, écart) en infobulle, largeur réservée pour éviter que l'en-tête bouge, rien si la météo n'est pas configurée (SHELL-14, DASH-36). Plus d'ombre au survol.
5. La date quitte l'en-tête (elle n'était jamais mise à jour après minuit, DASH-43) et rejoint la salutation de l'Accueil.

**Titre de page** : porté par le composant `PageHeader` en haut du contenu (h1, avec l'icône du menu et l'action principale), et repris dans l'onglet du navigateur : « Livraisons — LogiFlow » (SHELL-14). Il n'y a qu'un titre visible par écran : les doubles en-têtes disparaissent (BACKUP-10, UTIL-04).

**Téléphone — barre du haut** : titre de la page (tiré de `NAV_ITEMS`) + badge du magasin en 14 px (touché = changer de magasin pour ceux qui le peuvent). Le bouton « hamburger », qui n'ouvrait que le profil, disparaît : un seul menu, en bas (SHELL-10, SHELL-22).

#### 2.6 Même navigation sur PC et téléphone

- **Même configuration, mêmes libellés, mêmes icônes** : `NAV_ITEMS` alimente la barre latérale, la barre du bas et le menu mobile (SHELL-11, SHELL-12, TASKS-18).
- **Barre du bas = 4 raccourcis + « Menu »**. Les raccourcis sont les 4 premiers modules autorisés selon `mobileShortcut` : Accueil, Livraisons, Tâches, DLC, puis Commandes clients. Un employé (sans Livraisons si D1 reste « masqué ») a donc Accueil, Tâches, DLC, Commandes clients ; un manager a Accueil, Livraisons, Tâches, DLC. Commandes fournisseurs passe dans le Menu (la page mobile est en lecture seule, MOB-01). Libellés en 12 px minimum (aujourd'hui 10 px, SHELL-22).
- **« Menu » ouvre une feuille avec tous les modules autorisés**, groupés par les mêmes sections que sur PC, puis le magasin, le profil (nom, rôle en français, SHELL-24) et la déconnexion. Contacts, Rapprochement, Échéancier, Statistiques et Paramètres redeviennent accessibles (SHELL-10, CONT-09). Le bouton « Plus » devient un vrai `<button>` (SHELL-21).
- **Aucune page sans navigation** : les pages qui n'ont pas de version mobile sont affichées dans le cadre mobile (en-tête + barre du bas), et ce cadre est monté une seule fois autour du routeur au lieu d'être recréé par chaque page (SHELL-10, CONT-09, ANA-22, RAPPRO-19, DASH-29). Leurs tableaux passent en cartes grâce au `DataTable` responsive (§ 3.6).
- **Liens internes** toujours via `<Link>` de wouter, jamais `<a href>` ni `window.location` (rechargement complet de l'application, DASH-30).
- **PC ou téléphone est décidé une fois au démarrage** (largeur + écran tactile), pas à chaque redimensionnement : tourner le téléphone ne bascule plus vers l'interface PC et ne fait plus perdre la saisie (SHELL-25).
- **Erreur dans une page** : seul le contenu affiche « Une erreur est survenue — Réessayer / Retour à l'accueil », le menu reste utilisable (SHELL-30). Page 404 en français avec bouton de retour (NF-01, SHELL-23).

---

### 3. Design system

#### 3.1 Couleurs de base (tokens)

Constat : deux bleus concurrents (le bouton par défaut à `#2094F3`, le reste de l'interface en bleu 600 `#2563EB` codé en dur 150 fois), un bouton principal à 3,2:1 de contraste, un orange `--accent` à 2,5:1 utilisé comme fond des entrées de menu déroulant au survol (texte blanc sur orange, vérifié dans `dropdown-menu.tsx:84`), et des modificateurs d'opacité (`hover:bg-primary/90`) qui ne produisent aucun CSS, donc aucun retour visuel au survol (SHELL-16, SHELL-17). Le seuil à atteindre est 4,5:1 pour tout texte (WCAG AA).

**Format.** Les tokens passent au format « canaux » (`--primary: 221 83% 53%;`) et `tailwind.config.ts` les lit avec `hsl(var(--primary) / <alpha-value>)`, ce qui fait fonctionner les opacités et les survols (SHELL-17).

| Token | Rôle | Valeur actuelle | Contraste actuel | Valeur proposée | Contraste proposé |
|---|---|---|---|---|---|
| `--primary` | Bouton principal, liens, élément actif du menu, anneau de focus | `207 90% 54%` (#2094F3) | 3,2:1 (blanc dessus) | `221 83% 53%` (#2563EB, bleu 600) ; survol `224 76% 48%` (bleu 700) | 5,2:1 ; survol 6,7:1 |
| `--destructive` | Supprimer, erreurs | `0 84% 60%` | 3,8:1 | `0 72% 51%` (#DC2626, rouge 600) ; survol `0 74% 42%` | 4,8:1 ; survol 6,5:1 |
| `--success` *(nouveau)* | Valider, succès | — (`--secondary` vert à 4,3:1 et `bg-green-600` à 3,3:1 codé en dur 11 fois) | 3,3 à 4,3:1 | `142 72% 29%` (#15803D, vert 700) | 5,0:1 |
| `--warning` *(nouveau)* | Attention, à traiter | — (`bg-orange-600` à 3,6:1 codé en dur 8 fois, `--accent` orange à 2,5:1) | 2,5 à 3,6:1 | `26 90% 37%` (#B45309, ambre 700) | 5,0:1 |
| `--accent` | Fond de survol des menus et listes | `35 100% 47%` (orange) | 2,5:1 | `220 14% 96%` (gris 100) avec `--accent-foreground: 221 39% 11%` | 16,1:1 |
| `--secondary` | Bouton secondaire | `120 61% 34%` (vert, détourné pour « livraison ») | 4,3:1 | `220 14% 96%` (gris 100), texte gris 900 ; les 10 usages actuels de `bg-secondary`/`text-secondary` passent à `success` | 16,1:1 |
| `--muted-foreground` | Texte secondaire | `25 5% 45%` | 4,8:1 (4,6:1 sur le fond de page) | `215 14% 34%` (gris 600) | 7,6:1 |
| `--ring` | Anneau de focus | `20 14% 4%` + surcharges `!important` | — | égal à `--primary`, 2 px avec décalage | 5,2:1 |

À faire en même temps : remplacer progressivement les `bg-blue-600` / `text-blue-600` codés en dur par `bg-primary` / `text-primary` (SHELL-16) ; supprimer les surcharges de `index.css` qui retirent le focus et forcent tous les anneaux en bleu (`.bg-blue-600 { outline: none !important … }`, `* { --tw-ring-color … !important }`) ainsi que le bloc `.phone-mode` jamais utilisé (SHELL-19) ; puis vérifier à l'œil boutons, toasts, menus déroulants et calendrier.

#### 3.2 Cinq tonalités de statut

La couleur d'un statut dit **à qui revient l'action**. Cinq tonalités seulement, chacune avec une signification simple à expliquer aux équipes :

| Tonalité | Ce qu'elle dit à l'utilisateur | Badge (fond / texte / bordure) | Contraste du texte |
|---|---|---|---|
| **Rouge** | Problème : il faut agir maintenant | `red-100` / `red-800` / `red-200` | 6,8:1 |
| **Ambre** | À traiter : une action est attendue de notre part, ou une échéance approche | `amber-100` / `amber-800` / `amber-200` | 6,4:1 |
| **Bleu** | En cours : c'est lancé, ça suit son cours (souvent chez un tiers) | `blue-100` / `blue-800` / `blue-200` | 7,2:1 |
| **Vert** | Fait, prêt ou actif : tout va bien | `green-100` / `green-800` / `green-200` | 6,5:1 |
| **Gris** | Clos ou neutre : plus rien à faire | `gray-100` / `gray-700` / `gray-200` | 9,4:1 |

Deux styles distincts, pour ne plus confondre statut et priorité sur une même carte (SAV-21) :

- **Statut** → `StatusBadge` : pastille à fond pâle, icône de 14 px + libellé.
- **Priorité ou urgence** → `PriorityIndicator` : icône + texte coloré (rouge 700 ou ambre 700), **sans fond**. Sur les cartes, on n'affiche que les priorités hautes (« Élevée », « Haute », « Critique ») ; les autres restent visibles dans le détail (TASKS-19).

Le violet n'est plus une couleur de statut : il est réservé au **type** « Publicité » dans le calendrier et au type d'information « Nouveauté ».

#### 3.3 Palette unique des statuts

Toutes les pages (PC, mobile, calendrier, légendes, fenêtres de détail, impression) lisent ce tableau. Les libellés vivent dans `shared/` pour que le serveur écrive aussi en français (historique SAV, SAV-18) ; tonalités et icônes vivent côté client. Un statut inconnu s'affiche « Statut inconnu » en gris, jamais le code brut.

**Commandes fournisseurs** (`orders.status`) — constats ORD-12, CAL-06, MCAL-01, MOB-02

| Code | Aujourd'hui (PC / mobile / calendrier) | Libellé retenu | Tonalité | Icône |
|---|---|---|---|---|
| `pending` | « En attente » gris / jaune / bleu | En attente | Ambre | `Clock` |
| `planned` | « Planifié » bleu / `planned` brut / jaune | Planifiée | Bleu | `CalendarCheck` |
| `delivered` | « Livré » vert / « Livrée » vert / gris | Livrée | Vert | `CheckCircle2` |
| `cancelled` | badge mobile pour un statut qui n'existe pas en base | *(supprimé)* | — | — |

**Livraisons** (`deliveries.status` + contrôle + rapprochement) — constats ORD-12, LIV-02, DASH-40, MOB-02, RAPPRO-15, RAPPRO-18

| Code | Aujourd'hui | Libellé retenu | Tonalité | Icône |
|---|---|---|---|---|
| `planned` | « Planifié » bleu / vert clair (calendrier) | Planifiée | Bleu | `CalendarCheck` |
| `planned` et date dépassée | présenté comme « à venir » | En retard | Rouge | `AlertTriangle` |
| `delivered` | « Livré » vert / gris (calendrier) | Livrée | Vert | `CheckCircle2` |
| filtre « En attente », statuts `pending` / `received` (mobile) | ne correspondent à aucun statut | *(supprimés)* | — | — |
| contrôle requis, non fait | « Contrôle à faire » orange | Contrôle à faire | Ambre | `ClipboardList` |
| contrôle fait | « Contrôle validé » vert | Contrôle fait | Vert | `ClipboardCheck` |
| livrée, non rapprochée | onglet « Rapprochement Manuel » | À rapprocher | Ambre | `FileSearch` |
| référence ou montant manquant | coche grise | À compléter | Ambre | `FilePen` |
| facture introuvable | coche rouge sans explication | Facture introuvable | Rouge | `FileX` |
| facture trouvée, non validée | coche verte | Facture trouvée – à valider | Ambre | `FileCheck` |
| rapprochée | badge vert | Rapprochée | Vert | `CheckCircle2` |
| rapprochée automatiquement | « AUTO » | Validée automatiquement | Vert | `Zap` |
| écart de montant | € d'un côté (seuil 10 €), % de l'autre (seuil 5 %) | « + 8,00 € (1,2 %) » : 0 → gris, sous le seuil → ambre, au-dessus → rouge (une seule règle) | Gris / Ambre / Rouge | — |

**Avoirs** (`avoirs.status` + vérification) — constats AVOIRS-05, AVOIRS-06, MOB-AVOIRS-09

| Code | Aujourd'hui (PC / mobile) | Libellé retenu | Tonalité | Icône |
|---|---|---|---|---|
| `En attente de demande` | contour + icône orange / « En attente » jaune | À demander | Ambre | `Send` |
| `Demandé` | gris + icône bleue / bleu | Demandé | Bleu | `Clock` |
| `Reçu` | bleu primaire + icône verte / vert | Reçu | Vert | `CheckCircle2` |
| non vérifié | — | Non vérifié | Gris | `Circle` |
| facture trouvée, avoir non validé | « Validé » vert (faux) / « Vérifié Compta » | Facture trouvée – à valider | Ambre | `FileCheck` |
| `nocodbVerified` | « Validé » | Validé | Vert | `BadgeCheck` |

Note : AVOIRS-06 proposait le gris pour « À demander » ; l'ambre est retenu car c'est une action à faire par le magasin, comme « Contrôle à faire », et c'est déjà la couleur du mobile.

**Tâches** (`tasks.status`, dates, priorité) — constats TASKS-18, TASKS-19, TASKS-20, TASKS-26, DASH-19

| Code | Aujourd'hui (PC / mobile) | Libellé retenu | Tonalité | Icône |
|---|---|---|---|---|
| `pending` | « En cours » / « Actives » | À faire *(pas de badge sur la carte)* | Gris | `Circle` |
| `pending`, début dans le futur | « Future », « (Programmée) », « 📅 Active »… (3 badges) / rien | Programmée · visible le 05/10 | Bleu | `CalendarClock` |
| `completed` | barré, opacité 60 %, gris 400 | Terminée *(fond vert très pâle + coche, texte lisible)* | Vert | `CheckCircle2` |
| échéance dépassée | « En retard de 0 jour » (bug) | En retard de 2 jours | Rouge | `AlertTriangle` |
| échéance aujourd'hui ou demain | « Dans 0 jour » | Aujourd'hui / Demain | Ambre | `Clock` |
| priorité `high` | rouge (PC) / rouge (mobile) / bleu (accueil) | Élevée *(indicateur, affiché sur la carte)* | Rouge | `ArrowUp` |
| priorité `medium` | bleu plein (PC) / jaune (mobile) / bleu (accueil) | Moyenne *(dans le détail seulement)* | Ambre | `Minus` |
| priorité `low` | gris (PC) / vert (mobile) | Faible *(dans le détail seulement)* | Gris | `ArrowDown` |

**SAV** (`sav_tickets.status`, `priority`) — constats SAV-21, MSAV-06, SAV-18

| Code | Aujourd'hui (PC / mobile) | Libellé retenu | Tonalité | Icône |
|---|---|---|---|---|
| `nouveau` | bleu / bleu | Nouveau | Ambre | `Inbox` |
| `en_cours` | jaune / jaune | En cours | Bleu | `Loader` |
| `attente_pieces` | « Attente pièces » orange / « Pièces » orange | En attente de pièces | Bleu | `Package` |
| `attente_echange` | « Attente échange » violet / code brut | En attente d'échange | Bleu | `RefreshCw` |
| `resolu` | vert / vert | Résolu | Vert | `CheckCircle2` |
| `ferme` | gris / gris | Fermé | Gris | `Archive` |
| priorité `critique` | rouge | Critique *(indicateur, affiché sur la carte)* | Rouge | `AlertOctagon` |
| priorité `haute` | orange | Haute *(indicateur, affiché sur la carte)* | Ambre | `ArrowUp` |
| priorité `normale`, `faible` | bleu, gris | Normale, Faible *(dans le détail seulement)* | Gris | — |

**Commandes clients** (`customer_orders.status`) — constats CMDCLI-28, CMDCLI-24, CMDCLI-38

| Code | Aujourd'hui (PC, détail, impression / mobile) | Libellé retenu | Tonalité | Icône |
|---|---|---|---|---|
| `En attente de Commande` | jaune 50 / jaune 100 (couleur par défaut) | En attente de commande | Ambre | `Clock` |
| `Commande en Cours` | bleu 50 / bleu 100 | Commandée chez le fournisseur | Bleu | `Truck` |
| `Disponible` | vert 50 / vert 100 | Disponible | Vert | `PackageCheck` |
| `Disponible`, client pas encore prévenu | bandeau orange séparé | + indicateur « Client à prévenir » | Ambre | `Phone` |
| `Retiré` | gris + ligne grisée | Retirée | Gris | `CheckCheck` |
| `Annulé` | rouge | Annulée | Gris | `XCircle` |

**DLC** (`dlc_products.status` + date) — constats DLC-28, DLC-29, DLC-23, DLC-32, DLC-50, DASH-27

| Cas | Aujourd'hui (PC / mobile) | Libellé retenu | Tonalité | Icône |
|---|---|---|---|---|
| date dépassée | « Expiré » rouge / « J-3 » rouge (même libellé qu'avant expiration) | Expiré depuis 3 j | Rouge | `AlertOctagon` |
| expire aujourd'hui | compté deux fois | Expire aujourd'hui | Rouge | `AlertOctagon` |
| expire dans 3 jours ou moins | « Expire bientôt » orange / « J-2 » rouge | Encore 2 j | Rouge | `AlertTriangle` |
| expire dans 4 à 15 jours | « Expire bientôt » orange / « J-10 » orange | Encore 10 j | Ambre | `Clock` |
| plus de 15 jours | « Actif » vert / « OK » contour vert | OK | Vert | `CheckCircle2` |
| traité (`processedAt`) | « Traité - Expire dans X jours » bleu | Vérifié · expire le 12/10 | Bleu | `Eye` |
| `valides` (retiré) | « Validé » gris / onglet « Validés » | Retiré du rayon | Gris | `PackageMinus` |
| `stockEpuise` | « Stock épuisé » jaune | Stock épuisé | Gris | `PackageX` |
| type de date | « DLC », « DDM », « DLUO » | DLC (à consommer jusqu'au), DDM (de préférence avant) ; DLUO seulement pour l'existant | — | infobulle |

**Publicités** (calculé depuis les dates) — constats PUB-26, PUB-23, PUB-33

| Cas | Aujourd'hui (PC / mobile) | Libellé retenu | Tonalité | Icône |
|---|---|---|---|---|
| en cours aujourd'hui | vert pâle / vert plein | En cours | Vert | `Megaphone` |
| à venir | bleu pâle / contour bleu | À venir | Bleu | `CalendarDays` |
| terminée | — / gris | Terminée | Gris | `Archive` |

**Informations internes** (types) — constats DASH-46, DASH-20 : « Important » rouge, « Attention » ambre, « Information » bleu, « Nouveauté » violet. Aujourd'hui, `success` s'affiche « Important » en rouge et `error` « Nouveauté » en violet : on garde les valeurs en base mais on corrige la correspondance, dans une configuration unique partagée par l'accueil et la carte d'information.

**Calendrier** — constats CAL-06, CAL-07. Le **type** se lit à l'icône (`Package` commande, `Truck` livraison, `Megaphone` publicité, en violet pâle) ; l'**état** se lit au fond (tonalité du tableau ci-dessus) et à une icône d'état de 14 px. Les éléments livrés ne sont plus en blanc sur gris 400 (2,5:1, vérifié dans `CalendarGrid.tsx:57` et `:101`). La légende est générée à partir des mêmes constantes, et liste types et états.

#### 3.4 Typographie

Police système (aucune police à télécharger, déjà le cas). Une échelle courte :

| Usage | Taille | Classe Tailwind | Graisse |
|---|---|---|---|
| Titre de page (h1, un seul par écran) | 20 px mobile / 24 px PC | `text-xl sm:text-2xl` | semi-gras |
| Titre de carte ou de section (h2) | 18 px | `text-lg` | semi-gras |
| Sous-titre, libellé de champ | 14 px | `text-sm` | moyen |
| Texte courant, cellules de tableau | 14 px PC / 16 px mobile | `text-sm` / `text-base` | normal |
| Texte secondaire (auteur, date de création) | 14 px, gris 600 (12 px toléré) | `text-sm text-gray-600` | normal |
| Badges, titres de section du menu, libellés de la barre mobile | 12 px **minimum** | `text-xs` | moyen / semi-gras |
| Champs de saisie sur téléphone | 16 px (évite le zoom automatique d'iOS) | `text-base` | normal |
| Chiffres des compteurs | 30 px | `text-3xl tabular-nums` | gras |
| Montants | taille du texte, alignés à droite | `tabular-nums text-right` | normal |

Interdits : `text-[10px]`, `text-[11px]`, icônes porteuses de sens sous 14 px (CAL-07, SHELL-22) ; majuscules forcées avec espacement pour les titres (SHELL-22) ; italique, barré ou opacité pour signifier un état (TASKS-20, CMDCLI-24) ; emojis dans les libellés et les toasts (SAV-18, DLC-34, GROUPS-15, TASKS-19). Les pages mélangent aujourd'hui `h1` en `text-3xl` (Échéancier, NocoDB) et `h2` en `text-xl`/`text-2xl` (ECHE-04, UTIL-04) : `PageHeader` règle ce point.

#### 3.5 Espacements, rayons, ombres, hauteurs

- **Espacements** (multiples de 4 px) : marge de page `p-4` sur téléphone, `p-6` sur PC, **un seul niveau** (pas de `p-6` imbriqués comme dans Livraisons, ni `p-3` + `px-3` comme dans les tâches mobiles) ; `gap-6` entre blocs, `gap-4` entre champs et dans une carte, `gap-2` entre boutons ; cartes en `p-4` (téléphone) / `p-6` (PC) ; cellules de tableau `px-4 py-3`, ligne d'au moins 48 px.
- **Rayons** (`--radius: 0.5rem` conservé) : boutons, champs, listes déroulantes, badges → `rounded-md` (6 px) ; cartes, fenêtres, feuilles, menus → `rounded-lg` (8 px) ; pastilles de couleur, avatars, bouton flottant → `rounded-full`. À rétablir d'abord dans les composants de base (`button`, `card`, `input`, `select`, `dialog`, `badge` ont perdu leur arrondi, `dialog` force `rounded-none`), puis retirer les arrondis improvisés des pages. (SHELL-18)
- **Ombres** : cartes en `shadow-sm` sans effet au survol ; `shadow-lg` réservé aux fenêtres, menus et bouton flottant ; pas d'ombre « lourde » sur les cartes de liste (SUPP-05) ni sur les widgets (SHELL-14).
- **Hauteurs** : bouton 40 px (`h-10`, déjà le défaut), petit bouton 36 px ; sur téléphone, boutons et champs de 44 px (`h-11`) ; bouton icône 40 × 40 px sur PC, 44 × 44 px sur téléphone (TASKS-15, SAV-20, DASH-37, AVOIRS-07).
- **Fenêtres** : `max-h-[90vh] overflow-y-auto`, jamais de `transform: scale` ; pied de fenêtre identique partout, « Annuler » en contour à gauche, action principale à droite (CMDCLI-20, PUB-31, SAV-19, MOD-09).

#### 3.6 Composants standards à créer

Huit composants principaux, plus trois petits. Tous dans `client/src/components/common/`, construits sur les briques shadcn déjà présentes (`alert-dialog`, `skeleton`, `dropdown-menu`, `sheet`, `tooltip`).

##### `PageHeader`

```tsx
<PageHeader
  title="Livraisons"                 // h1 + titre de l'onglet « Livraisons — LogiFlow »
  icon={Truck}                       // même icône que le menu (lue dans NAV_ITEMS par défaut)
  description="Livraisons prévues et reçues du magasin"   // facultatif, une ligne
  actions={<Button>Nouvelle livraison</Button>}           // 1 bouton plein + éventuellement un menu « ⋯ »
/>
```

Empile titre et actions sous 640 px (`flex-col sm:flex-row flex-wrap`). Sur téléphone, le titre est déjà dans la barre du haut : `PageHeader` n'affiche que les actions. Variante `AdminSection` (titre h2 + description + actions) pour les onglets de Paramètres.
**Pages** : les 18 modules du menu, les 6 onglets de Paramètres, la 404. **Constats** : SHELL-14, ECHE-04, BACKUP-10, UTIL-04, PUB-21, ANA-22, GROUPS-16.

##### `StatusBadge` et `PriorityIndicator`

```tsx
<StatusBadge domain="delivery" status={delivery.status} />        // libellé, tonalité, icône lus dans la configuration
<StatusBadge tone="warning" icon={ClipboardList}>Contrôle à faire</StatusBadge>   // cas calculés
<PriorityIndicator domain="sav" priority={ticket.priority} compact />             // rien si priorité basse et compact
```

Configuration `STATUS[domain][code] = { label, tone, icon }` + `getStatusLabel(domain, code)` pour les exports, l'impression et le serveur. Badge non cliquable, sans effet au survol (PUB-26). Quand un statut se change d'un clic, on utilise un bouton ou une liste déroulante explicite, pas un badge cliquable (CMDCLI-25).
**Pages** : Commandes fournisseurs, Livraisons, fiche commande/livraison, Calendrier (grille + légende), Accueil, Rapprochement, Avoirs, Tâches, SAV, Commandes clients (liste, détail, impression), DLC (+ fenêtre d'alerte), Publicités, et toutes leurs versions mobiles. **Constats** : ORD-12, CAL-06, CAL-07, MCAL-01, TASKS-18, MSAV-06, SAV-21, MOB-AVOIRS-09, CMDCLI-28, DLC-28, PUB-26, DASH-19, DASH-46.

##### `EmptyState`

```tsx
<EmptyState
  kind="empty" | "no-results" | "no-store"
  icon={Truck}
  title="Aucune livraison prévue"
  description="Les livraisons planifiées apparaîtront ici."
  action={canCreate ? <Button>Nouvelle livraison</Button> : undefined}   // kind="empty"
  onClearFilters={resetFilters}                                           // kind="no-results" : bouton « Effacer les filtres »
/>
```

`no-store` affiche « Choisissez un magasin en haut de l'écran » (avec un bouton qui ouvre le sélecteur sur mobile). Le message s'adapte au rôle : pas de « Créez votre première publicité » pour qui ne peut pas créer.
**Pages** : toutes les listes PC et mobile, chaque carte de l'accueil, chaque graphique des statistiques. **Constats** : TASKS-22, MSAV-09, CMDCLI-18, CMDCLI-31, PUB-12, PUB-26, PUB-33, SAV-23, CONT-04, DLC-10, SUPP-07.

##### `ErrorState`

```tsx
<ErrorState
  error={query.error}
  onRetry={() => query.refetch()}
  title="Impossible de charger les livraisons"   // facultatif
  compact                                        // version une ligne, pour une carte de l'accueil
/>
```

Affiche le message de `getErrorMessage(error)` (français, jamais de JSON). Un refus de droit (403) affiche « Vous n'avez pas les droits pour voir ces données », sans bouton « Réessayer ». Les erreurs 403/404 ne sont plus réessayées automatiquement, ce qui évite 3 s d'attente (SHELL-08, *fait par le lot 1*).
**Pages** : mêmes pages qu'`EmptyState`. **Constats** : DASH-22, MOB-03, TASKS-22, SAV-23, PUB-13, CONT-07, SUPP-07, ANA-18, DLC-22, CMDCLI-18, MSAV-09, ERR-01.

##### `TableSkeleton` (et `ListSkeleton`, `StatSkeleton`, `PageSkeleton`)

```tsx
<TableSkeleton rows={5} columns={6} />   // même hauteur de ligne que DataTable
<ListSkeleton rows={5} />                // cartes mobiles
<StatSkeleton count={4} />               // rangée de compteurs, même hauteur que les vrais
<PageSkeleton />                         // pendant le chargement d'une page à la demande (SHELL-03)
```

Affichés au **premier** chargement uniquement. Quand on change de filtre, de mois ou de magasin, on garde les données précédentes à l'écran avec un indicateur discret « Mise à jour… » (`placeholderData: keepPreviousData`) au lieu de tout remplacer par un spinner.
**Pages** : les 29 pages qui utilisent aujourd'hui un spinner (`animate-spin`), en priorité Accueil, Calendrier, Statistiques, Échéancier, DLC, Utilisateurs. **Constats** : DASH-22, USERS-24, MOB-AVOIRS-09, SAV-23, ANA-18, CMDCLI-18, DASH-42.

##### `ConfirmDialog` (+ `useConfirm`)

```tsx
<ConfirmDialog
  open={open} onOpenChange={setOpen}
  title="Supprimer la livraison du 12/10 de Lactalis ?"
  description="Cette action est définitive."
  confirmLabel="Supprimer"
  tone="danger"                                  // bouton rouge ; "default" sinon
  isPending={deleteMutation.isPending}           // bouton désactivé + « Suppression… »
  onConfirm={() => deleteMutation.mutate(id, { onSuccess: () => setOpen(false) })}
  requireText="EXÉCUTER"                         // facultatif : saisie obligatoire (SQL)
/>

// Pour remplacer un window.confirm sans réécrire la page :
const confirm = useConfirm();
if (await confirm({ title: "Dévalider ce rapprochement ?", confirmLabel: "Dévalider" })) { … }
```

Basé sur `AlertDialog`. Reste ouvert pendant l'action et en cas d'erreur, se ferme au succès (ORD-14, USERS-10). Nomme toujours l'objet, avec un repli si le nom est vide (USERS-13). Remplace `ConfirmationModal`, `ConfirmDeleteModal`, la confirmation propre à la fiche commande (MOD-07) et les 7 `window.confirm` (ReconciliationComments, BLReconciliation × 2, Users, Suppliers, Contacts, Groups).
**Pages** : toutes les suppressions + les changements d'état listés au principe 6 + fermeture d'un formulaire modifié. **Constats** : USERS-13, RAPPRO-27, SAV-21, BACKUP-01, MOB-AVOIRS-02, AVOIRS-06, CMDCLI-26, SAV-24, MSAV-05, DLC-13, DASH-37, NOCO-04, SQL-01, GROUPS-13.

##### `FilterBar`

```tsx
<FilterBar
  search={{ value: q, onChange: setQ, placeholder: "Fournisseur, n° de BL…" }}   // saisie temporisée (300 ms)
  filters={[{ id: "status", label: "Statut", value: status, options: STATUS_OPTIONS.delivery, onChange: setStatus }]}
  quickFilters={[{ label: "Aujourd'hui", active: …, onClick: … }, { label: "En retard", … }]}
  onReset={resetFilters}       // bouton « Effacer les filtres » visible seulement si un filtre est actif
  resultCount={total}          // « 23 livraisons »
/>
```

Une ligne compacte au-dessus de la liste, sans carte ni titre « Recherche et filtres ». Sur téléphone : la recherche reste visible, les autres filtres s'ouvrent dans une feuille « Filtres (2) ». Les filtres sont lus et écrits dans l'adresse (`?status=planned`), ce qui permet aux compteurs de l'accueil d'ouvrir une liste déjà filtrée (DASH-23) et conserve les filtres à l'actualisation (principe 10). Les listes « tous les … » ont un libellé explicite (« Tous les statuts », pas « Status », CMDCLI-27).
**Pages** : Commandes fournisseurs, Livraisons, Tâches, SAV, Commandes clients, DLC, Publicités, Avoirs, Rapprochement, Échéancier, Utilisateurs, Fiches fournisseurs, Contacts, Statistiques. **Constats** : DLC-27, CMDCLI-38, ECHE-07, ORD-15, PUB-23, SAV-25, ANA-13, TASKS-14, USERS-09.

##### `DataTable` responsive

```tsx
<DataTable
  rows={deliveries}
  rowKey={(d) => d.id}
  columns={[
    { id: "date", header: "Date prévue", cell: (d) => formatDate(d.scheduledDate) },
    { id: "supplier", header: "Fournisseur", cell: (d) => d.supplier?.name },
    { id: "store", header: "Magasin", cell: …, hideBelow: "lg", onlyWhenAllStores: true },
    { id: "status", header: "Statut", cell: (d) => <StatusBadge domain="delivery" status={d.status} /> },
    { id: "amount", header: "Montant", cell: (d) => formatEuro(d.blAmount), align: "right" },
  ]}
  onRowClick={openDetail}
  primaryAction={(d) => d.status === "planned" && canValidate ? { label: "Valider la réception", onClick: … } : null}
  rowActions={(d) => [
    { label: "Modifier", icon: Pencil, onClick: … },
    { label: "Supprimer", icon: Trash2, tone: "danger", onClick: … },   // passe par ConfirmDialog
  ]}
  mobileCard={(d) => <DeliveryCard delivery={d} />}   // rendu sous 768 px
  query={deliveriesQuery}                             // gère squelette, erreur et vide
  empty={<EmptyState kind="empty" … />}
  pagination={{ page, pageSize, total, onPageChange }}
/>
```

Ce que le composant garantit sans effort de la page : défilement horizontal au lieu de colonnes coupées (`overflow-x-auto`), colonnes secondaires masquées sur écran étroit, cartes sous 768 px, une seule action texte + menu « ⋯ » libellé (les boutons-icônes reçoivent automatiquement un nom accessible), lignes cliquables avec un vrai retour au survol, montants alignés à droite en chiffres tabulaires, colonne Magasin ajoutée en mode « Tous les magasins », page conservée après une action (la pagination ne revient en page 1 que si les filtres changent), états de chargement / erreur / vide intégrés.
**Pages** : Commandes fournisseurs, Livraisons, Rapprochement (les deux onglets, mêmes colonnes et même règle d'écart), Échéancier, Avoirs, Commandes clients, DLC, Publicités, Utilisateurs, Fiches fournisseurs (au lieu de la grille de cartes), Tâches (vue liste), liste des sauvegardes. **Constats** : ORD-11, PUB-22, USERS-14, DLC-43, CMDCLI-24, RAPPRO-19, RAPPRO-14, RAPPRO-15, AVOIRS-07, DLC-23, ORD-10, TASKS-15, SAV-20, SUPP-05, BACKUP-07, ORD-14, RAPPRO-20, DLC-51, ECHE-05.

##### Trois petits composants complémentaires

| Composant | API | Pourquoi | Constats |
|---|---|---|---|
| `IconButton` | `<IconButton icon={Trash2} label="Supprimer la sauvegarde" tone="danger" onClick={…} />` : `label` **obligatoire**, devient `aria-label` + infobulle | Plus aucun bouton-icône muet ; 40 px PC / 44 px mobile | ORD-10, TASKS-15, DLC-41, PUB-27, USERS-23, SUPP-12, SHELL-21, BACKUP-07, NOCO-04, CMDCLI-25, SAV-20, RAPPRO-27 |
| `FormDialog` | `<FormDialog title="Nouvelle tâche" isDirty={form.formState.isDirty} onSubmit={…} submitLabel="Créer" isPending={…}>` : `Dialog` sur PC, `Sheet` plein écran sur téléphone, pied normé, hauteur max, garde « Abandonner les modifications ? » | Fenêtres faites main sans Échap ni focus, boutons hors écran, saisie perdue | TASKS-16, CMDCLI-36, CMDCLI-20, PUB-31, SAV-19, MOD-09, GROUPS-13 |
| `AccessDenied` | `<AccessDenied />` : « Vous n'avez pas accès à cette page » + « Retour à l'accueil » | Utilisé par `ProtectedRoute` | SHELL-11, RAPPRO-17 |

---

### 4. Accessibilité et lisibilité : actions concrètes

#### 4.1 Actions

Effort selon l'échelle commune (S, M). Les actions marquées « immédiat » sont sans risque et peuvent partir tout de suite.

| N° | Action | Où | Constats | Effort |
|---|---|---|---|---|
| A1 (immédiat) | Déclarer la page en français : `<html lang="fr">` (*fait par le lot 1*, P4 § 2.1). Ensuite, quand tous les champs sur téléphone sont en 16 px, retirer `maximum-scale=1` pour autoriser le zoom. | `client/index.html` ; champs de `TasksPage.tsx`, formulaires mobiles | SHELL-20, DASH-34 | S |
| A2 (immédiat) | Donner un nom à **chaque** bouton-icône (`aria-label` + `title`, libellés du § 3.6) en attendant `IconButton` ; transformer les `div` cliquables (« Plus », « BAP », badge de statut, bandeau d'appels) en `<button>`. | Orders, Deliveries, Tasks, SAV, DLC, Publicités, Users, Suppliers, Backup, NocoDB, Commandes clients, commentaires du rapprochement, barre mobile, repli du menu | ORD-10, TASKS-15, SAV-20, CMDCLI-25, DLC-41, PUB-27, USERS-23, SUPP-12, BACKUP-07, NOCO-04, RAPPRO-27, SHELL-21 | S |
| A3 | Rendre le focus clavier visible partout : supprimer les surcharges `!important` qui l'effacent sur les éléments bleus et forcent tous les anneaux en bleu ; un anneau de 2 px couleur `--ring`. | `client/src/index.css` | SHELL-19 | M |
| A4 | Appliquer les tokens du § 3.1 (format canaux, nouveau `--primary`, `--destructive`, `--success`, `--warning`, `--accent` neutre) ; remplacer les boutons blancs sur `green-600` (3,3:1) et `orange-600` (3,6:1) par `success` / `warning`. | `index.css`, `tailwind.config.ts`, pages | SHELL-16, SHELL-17 | M |
| A5 (immédiat) | Texte informatif en gris 600 minimum (fini le gris 400 à 2,5:1 sur du texte utile). | Accueil, Fiches fournisseurs, puis toutes les pages | DASH-41, SUPP-12 | S |
| A6 | Supprimer les opacités et le texte barré sur les lignes de données ; signaler l'état par un badge (« Terminée », « Validé », « Retirée »). | Tâches, DLC, Avoirs « Finalisés », Commandes clients | TASKS-20, DLC-42, AVOIRS-08, CMDCLI-24 | S |
| A7 | Aucune taille sous 12 px : barre mobile, titres de section du menu, calendrier (11 px, icônes de 8 px, abréviations « P » / « C » remplacées par « palettes » / « colis »). Données en 14 px. | `MobileBottomNav`, `Sidebar`, `CalendarGrid`, Livraisons | SHELL-22, CAL-07 | M |
| A8 | Cibles tactiles : 44 × 44 px sur téléphone, 36 px minimum sur PC (boutons Kanban de 28 px, loupe de 16 px, icônes d'impression de 24 px, boutons d'information de 24 px). | Tâches, SAV, Avoirs, DLC, Accueil | TASKS-15, SAV-20, AVOIRS-07, DLC-25, DASH-37 | S |
| A9 | Remplacer les fenêtres faites main par `Dialog` / `Sheet` (Échap, focus piégé, rôle « dialog », défilement bloqué) ; hauteur max et défilement interne dans toutes les fenêtres ; supprimer le `transform: scale(0.9)` du formulaire de commande client. | Tâches, contact client mobile, Commandes clients, Publicités, SAV | TASKS-16, CMDCLI-36, CMDCLI-20, PUB-31, SAV-19 | M |
| A10 | Formulaires : message d'erreur sous **chaque** champ (`<FormMessage />`) et focus sur le premier champ en erreur ; messages de validation en français ; champs de connexion avec `autoComplete`, sans majuscule automatique ; calendriers de sélection de date en français, semaine commençant le lundi. | Formulaires mobiles (Avoirs, SAV, DLC, Commandes clients), DLC, Publicités, Connexion, Statistiques | MOB-AVOIRS-06, MSAV-03, DLC-12, CMDCLI-32, DLC-44, PUB-18, AUTH-05, ANA-16 | S |
| A11 | La couleur ne porte jamais seule l'information : chaque statut a un texte (fin des points de couleur dans le calendrier), chaque légende liste noms et couleurs à partir des mêmes constantes, pastilles de magasin d'au moins 8 px avec le nom en infobulle. | Calendrier, Publicités (vue d'ensemble), DLC mobile | CAL-06, CAL-07, PUB-24, DLC-29 | S |
| A12 (immédiat) | Messages d'erreur lisibles : une fonction `getErrorMessage(err)` qui traduit le code (401 « Votre session a expiré », 403 « Vous n'avez pas les droits pour cette action », 404 « Élément introuvable », 409 message du serveur, 5xx « Erreur du serveur, réessayez ») et n'affiche jamais de JSON ; utilisée par tous les toasts. | `client/src/lib/queryClient.ts` + toutes les mutations | ERR-01, RAPPRO-16, AVOIRS-09, DLC-21, SUPP-04, GROUPS-08, PUB-18 | M |
| A13 (immédiat) | Utilitaires de format partagés, utilisés partout : `formatEuro` (« 1 234,50 € »), `formatDate` (« 05/10/2026 », s'appuie sur `safeFormat`), `formatDays` (« Expire aujourd'hui », « Expiré depuis 2 jours », « Encore 3 j »), `formatRef` (« CMD-123 », « LIV-456 »), `formatFileSize` (« 12,4 Mo »), `getRoleDisplayName` (déjà présent). Y compris dans le mail envoyé aux fournisseurs et dans les exports. | `client/src/lib/format.ts` (+ `shared/` pour le mail) | ECHE-05, AVOIRS-17, CMDCLI-35, ANA-15, MAIL-02, DLC-39, DLC-29, ORD-09, BACKUP-06, SHELL-24, USERS-10 | S |
| A14 (immédiat) | Retirer de l'écran tout texte technique : debug « (API: …) », identifiants internes (`#12`, `manual_…`), URL de webhook, « N/A », codes de statut ; remplacer les emojis par des icônes. | Accueil, Utilisateurs, Magasins, Fiches fournisseurs, Rapprochement, SAV, DLC | DASH-21, USERS-09, GROUPS-10, SUPP-06, RAPPRO-18, SAV-18, DLC-34, DASH-39, GROUPS-15 | S |
| A15 (immédiat) | Page 404 et écran d'erreur en français, avec bouton « Retour à l'accueil » ; écran d'erreur limité au contenu de la page. | `not-found.tsx`, `ErrorBoundary` | NF-01, SHELL-23, SHELL-30 | S |
| A16 | Titre de l'onglet du navigateur mis à jour à chaque page (« Livraisons — LogiFlow »), un seul `h1` par écran, hiérarchie h1 → h2 → h3 respectée (fin des `h1` imbriqués dans les onglets de Paramètres). | `PageHeader`, Paramètres | SHELL-14, UTIL-04 | S |

#### 4.2 Glossaire : un mot par notion

À appliquer dans les libellés, titres, messages, exports et e-mails. À relire avec un responsable de magasin (décision D12).

| On écrit | On n'écrit plus | Constats |
|---|---|---|
| Magasin, Magasins | Groupe, Groupes, Magasin/Groupe | ORD-08, USERS-17, GROUPS-11 |
| Commandes fournisseurs / Commandes clients | Commandes, Commandes Client, Cmd Client | SHELL-12, CMDCLI-27 |
| Accueil | Tableau de bord (dans le menu) | SHELL-12, DASH-31 |
| Échéancier | Échéance | ECHE-04 |
| Rapprochement BL / factures, « À traiter » / « Validées » | Rapprochement Manuel, AUTO, Ref. Facture, Montant Fact. | RAPPRO-18 |
| Information | Annonce, Information interne (mélangés) | DASH-37 |
| Code-barres | Gencode, EAN13 | MSAV-07, CMDCLI-27 |
| Exporter pour Excel | Exporter CSV, Exporter (Excel) | ECHE-07, PUB-21, ANA-17 |
| Statistiques | Analytics, Tableau de bord Analytics, Granularité, Taux de réconciliation | ANA-15 |
| Bon à payer (BAP) | BAP seul, webhook, n8n | BAP-01 |
| Service de traitement des factures | NocoDB, webhook, workflow (dans les messages aux utilisateurs) | AVOIRS-09, RAPPRO-18, NOCO-07 |
| Identifiant (de connexion) | ID, ID technique | USERS-09 |
| Retiré du rayon, Vérifié, Stock épuisé | Validé, Traité (pour les DLC) | DLC-23, DLC-32 |
| DLC (à consommer jusqu'au), DDM (de préférence avant) | DLUO pour toute nouvelle saisie | DLC-50 |
| Cette fenêtre | Ce modal, popup | DLC-34, DASH-39 |
| Qté, réf. | Qty, rév. | CMDCLI-27 |
| Administrateur, Directeur, Manager, Employé | admin, Employee, employee | SHELL-24, USERS-10 |
| Client non renseigné | N/A | SAV-18 |

---

### 5. Ordre de réalisation conseillé

Cet ordre est repris dans la [feuille de route](#feuille-de-route) : étape 1 = Phase 1b, étape 2 = décisions produit, étapes 3 à 5 = Phase 2, étape 6 = Phase 3.

1. **Corrections immédiates, sans risque (S)** : A1 (langue : `lang="fr"` déjà fait par le lot 1), A2 (noms des boutons-icônes), A5, A12, A13, A14, A15 ; menu « Accueil » actif sur `/` (SHELL-13, *fait par le lot 1*) ; `overflow-x-auto` sur les tableaux coupés (ORD-11, PUB-22, USERS-14, DLC-43) ; rôle en français sur mobile (SHELL-24).
2. **Décisions produit** D1 à D14 ([Décisions produit à prendre](#décisions-produit-à-prendre)) : une réunion d'une heure avec un directeur et un responsable de magasin, tableau du § 2.2 en main.
3. **Fondations (M)** : tokens et rayons (§ 3.1, § 3.5, A3, A4) ; configuration des statuts + `StatusBadge` (§ 3.3) ; `shared/permissions.ts` complété, `NAV_ITEMS`, `ProtectedRoute` (§ 2.2).
4. **Navigation (M)** : menu regroupé, barre et menu mobiles complets, cadre mobile unique, en-tête avec magasin, présélection du magasin (§ 2.1, § 2.5, § 2.6).
5. **États et confirmations (M)** : squelettes, `EmptyState`, `ErrorState`, `ConfirmDialog`, `FormDialog`, `IconButton`, migrés page par page.
6. **Listes (M à L par page)** : `PageHeader`, `FilterBar`, `DataTable`, en commençant par les écrans les plus utilisés en magasin : Livraisons, DLC, Tâches, Commandes clients, puis SAV, Avoirs, Rapprochement, Échéancier, Publicités, et enfin les pages d'administration.

Chaque page migrée est vérifiée avec la grille des dix principes (§ 1) et un passage avec un compte de chaque rôle.

---

## P2 — Plan page par page

Cette section décrit, écran par écran, ce que l'utilisateur doit pouvoir faire, ce qui le gêne aujourd'hui et l'écran à construire. Elle applique les règles de la section P1 : les dix principes (§ 1), le menu et l'en-tête (§ 2), la palette unique des statuts (§ 3.3), les composants standards (§ 3.6 : `PageHeader`, `FilterBar`, `DataTable`, `StatusBadge`, `EmptyState`, `ErrorState`, squelettes, `ConfirmDialog`, `FormDialog`, `IconButton`) et le glossaire (§ 4.2). Quand un choix revient au métier, la page renvoie aux décisions D1 à D14 (voir [Décisions produit à prendre](#décisions-produit-à-prendre)) et applique la proposition par défaut.

Les pages sont rangées par fréquence d'usage probable en magasin. **Les versions PC et téléphone d'un même module sont traitées ensemble** : la cible est un seul écran qui s'adapte, avec les mêmes mots, les mêmes couleurs et les mêmes actions (tableau sur PC, cartes sur téléphone grâce à `DataTable`). Le cadre commun (menu, en-tête, sélecteur de magasin, barre du bas) est décrit dans P1 § 2 et n'est pas repris ici.

**Comment lire chaque fiche**

- **Objectif et tâches principales** : ce que la personne vient faire sur l'écran, en une phrase, puis ses 2 à 4 gestes les plus fréquents.
- **Ce qui gêne aujourd'hui** : les problèmes les plus importants, avec les identifiants des constats entre parenthèses.
- **Écran cible** : en-tête, action principale, filtres, liste (colonnes gardées ou retirées), actions par ligne, états (chargement, erreur, vide), fenêtres, version téléphone.
- **Libellés à renommer** : avant → après.
- **Gains et effort** : ce que l'utilisateur y gagne, les corrections courtes à faire d'abord, puis l'effort de la refonte.

Partout, les messages d'erreur passent par la fonction commune de P1 (A12) : jamais de code HTTP, de JSON ni d'anglais à l'écran (ERR-01). Les textes d'erreur cités dans les fiches en sont des exemples.

**Effort** : échelle commune (voir [Comment lire ce plan](#comment-lire-ce-plan)), pour l'interface de la page une fois les composants de P1 disponibles. Les travaux serveur nécessaires sont signalés à part (« prérequis serveur »). Ce que le lot 1 de performance a déjà réglé porte la mention *fait par le lot 1*.

---

### Vue d'ensemble

| N° | Page | Utilisée surtout par | Ce qui change le plus | Effort |
|---|---|---|---|---|
| 1 | Accueil | tous, chaque matin | un bloc « À traiter aujourd'hui » cliquable remplace bandeaux, fenêtres et cartes ; plus de faux zéros | M (+ prérequis serveur L) |
| 2 | Tâches | tous | cartes à 4 informations, onglets « À faire / Terminées » justes, vue Kanban retirée | M |
| 3 | DLC | tous, en rayon | onglets-compteurs en tête, une action texte par ligne, trois gestes clairs, téléphone complet | L (M PC + M téléphone) |
| 4 | Commandes clients | vente, accueil | une action « étape suivante » par ligne, onglets par statut, formulaire lisible et fiable | L |
| 5 | SAV | accueil, managers | fonctions factices retirées, onglets « À traiter / En attente / Clôturés », téléphone réparé | M + M |
| 6 | Livraisons | managers, réception | filtres « Aujourd'hui / En retard », bouton « Valider la réception », téléphone utilisable | M + M |
| 7 | Commandes fournisseurs | managers | tableau allégé, modification réparée, fiche en lecture puis édition | M |
| 8 | Calendrier | managers, directeurs | grille lisible, panneau « Journée du … », chiffres du mois dans le flux | M |
| 9 | Rapprochement BL / factures | directeurs, admin | deux onglets identiques, une action par ligne, états en clair | L |
| 10 | Avoirs | directeurs, managers | bouton « étape suivante », trois états de vérification sans ambiguïté | M |
| 11 | Échéancier | directeurs, admin | navigation de mois, montants au format français, filtre par mode de paiement à l'écran | S à M |
| 12 | Publicités | tous | liste en premier, groupée « En cours / À venir / Terminées », en-tête allégé | M |
| 13 | Contacts | tous | recherche unique, onglets, boutons « Appeler / Écrire », accessible sur téléphone | M |
| 14 | Fiches fournisseurs | admin, directeurs | tableau triable et filtrable au lieu de grosses cartes, archivage | M |
| 15 | Statistiques | managers et plus | page qui ne disparaît plus, chiffres justes, vocabulaire simple | M |
| 16 | Utilisateurs | admin | identifiant de connexion visible, une seule fenêtre, rôles expliqués | M |
| 17 | Magasins | admin | fiche en trois onglets, réglages techniques à part | M |
| 18 | Paramètres | admin | 4 onglets au lieu de 6, sauvegardes lisibles, outils dangereux masqués | M |
| 19 | Connexion | tous | identifiants par défaut masqués, saisie fiable sur téléphone, arrivée sur la page demandée | S |
| 20 | Page introuvable et erreurs | tous | français, bouton de retour, menu toujours utilisable | S |

**Ce que la refonte retire de l'écran** (simplification nette, sans perte de fonction) : les deux bandeaux DLC et les « Accès rapides » de l'accueil, la vue Kanban des tâches, le bouton « Exporter PDF » des DLC, le bouton « Modifier » du SAV tant qu'il n'enregistre rien, le panneau flottant de statistiques du calendrier, la vue calendrier des publicités (doublon de `/calendar`), la fenêtre séparée « clients à appeler », le bouton « Tester la configuration NocoDB », les sélecteurs de magasin propres à Contacts et Statistiques, les colonnes « Créé par » et les identifiants techniques (`#12`, `manual_…`), les onglets développeur de Paramètres (masqués par défaut).

---

### 1. Accueil — `/` et `/dashboard` (PC et téléphone)

**Pour qui :** tous les rôles, au début de chaque journée.
**Objectif :** savoir en dix secondes ce qu'il faut traiter aujourd'hui dans son magasin, et y aller en un clic.
**Tâches principales :**
1. Repérer les urgences : produits DLC expirés ou proches, livraisons en retard ou attendues aujourd'hui, clients à prévenir.
2. Lire les informations internes (l'admin les publie et les modifie).
3. Voir ses tâches du jour et les terminer.
4. Managers et plus : suivre quelques chiffres du mois.

**Ce qui gêne aujourd'hui**

- **L'écran ment pendant le chargement et en cas de panne** : « 0 », « Aucune commande en attente », « Toutes les tâches sont terminées » s'affichent avant l'arrivée des données, et du texte de débogage « (API: NOT_ARRAY) » est visible (DASH-22, DASH-21).
- **Les données ne suivent pas le magasin choisi** : pour un manager ou un directeur, tâches toujours vides, commandes du premier magasin, informations de tous les magasins, et des données qui changent selon la page visitée en premier ; sur téléphone, « Commandes » et « Livraisons » sont des totaux historiques présentés comme l'activité du jour (DASH-01, SRV-07, DASH-13, DASH-03, DASH-38, DASH-28).
- **Rien n'est cliquable**, alors que compteurs et cartes réagissent au survol : pour traiter « 12 commandes en attente », il faut repasser par le menu et refiltrer (DASH-23).
- **L'alerte DLC apparaît trois fois** (deux bandeaux et une fenêtre). La fenêtre se rouvre dès qu'on la ferme, peut s'empiler sur la fenêtre d'information, pousse à marquer un produit périmé « Stock épuisé », et ses compteurs ne correspondent pas à sa liste (DASH-24, DASH-02, DLC-08, DLC-32, DASH-27).
- **Libellés ambigus** : « Total palettes » (en fait le mois en cours, et faux), délai moyen calculé sur l'année sans le dire, numéro de publicité au lieu de son nom, badge de jours d'attente négatif, « Livraisons à venir » qui contient des retards (DASH-25, DASH-26, DASH-18, DASH-40).
- **Repères visuels cassés** : toutes les priorités de tâches en bleu, barre de couleur des lignes invisible, textes secondaires en gris trop clair (DASH-19, DASH-20, DASH-41).
- **Sur téléphone**, les « Accès rapides » répètent la barre du bas avec des libellés trompeurs (« Commande » au singulier fait penser à une création, « Agenda » au lieu de « Calendrier »), rechargent toute l'application, et aucune alerte DLC n'apparaît (DASH-31, DASH-30).
- **Informations** : la croix de 24 px supprime définitivement l'information sans confirmation, et un texte long repousse les tâches hors de l'écran (DASH-37).

**Écran cible** (même ordre sur PC et téléphone ; une colonne sur téléphone, deux colonnes sur PC à partir du bloc 3)

- **En-tête :** « Bonjour Marie » et la date en toutes lettres (« vendredi 3 octobre »), mise à jour après minuit ; la date quitte la barre du haut, où figure le magasin actif (P1 § 2.5). L'entrée « Accueil » du menu est active sur `/` comme sur `/dashboard` (DASH-43, SHELL-13). Pas de bouton principal : l'accueil sert à s'orienter. Le sous-titre « Vue d'ensemble des performances et statistiques » disparaît.
- **Bloc 1 « À traiter aujourd'hui »** (remplace les deux bandeaux DLC et la carte « Livraisons à venir ») : une ligne par urgence, avec son nombre, sa couleur (P1 § 3.2) et un bouton « Voir » qui ouvre la liste déjà filtrée. Les lignes à zéro sont masquées, chaque ligne n'apparaît que pour les rôles qui ont accès au module (principe 7 de P1). Si tout est à zéro, et seulement après un chargement réussi : « Rien d'urgent aujourd'hui », en vert. (DASH-24, DASH-23, DASH-31, DASH-40, DASH-18)

  | Ligne (exemple) | Couleur | Ouvre |
  |---|---|---|
  | « 3 produits expirés à retirer du rayon » | rouge | DLC, onglet « Expirés » |
  | « 12 produits à surveiller : date dans moins de 15 jours » | ambre | DLC, onglet « À surveiller » |
  | « 2 livraisons en retard » | rouge | Livraisons, filtre « En retard » (selon D1) |
  | « 4 livraisons attendues aujourd'hui » | bleu | Livraisons, filtre « Aujourd'hui » (selon D1) |
  | « 2 clients à prévenir : leur commande est disponible » | ambre | Commandes clients, filtre « Client à prévenir » |
  | « 3 tickets SAV à traiter » | ambre | SAV, onglet « À traiter » |
  | « 2 tâches en retard » | rouge | Tâches, filtre « En retard » |

- **Bloc 2 « Ce mois-ci »** (managers et plus) : 4 compteurs cliquables aux libellés explicites, « Livraisons reçues ce mois », « Commandes fournisseurs en attente », « Palettes reçues ce mois », « Délai moyen commande → livraison (2026) ». Les valeurs sont corrigées côté serveur (DASH-26). Plus d'ombre au survol sur ce qui n'est pas cliquable. (DASH-23, DASH-25)
- **Bloc 3 « Informations »** : les 3 dernières (magasin actif et informations générales), type indiqué par un badge (Important rouge, Attention ambre, Information bleu, Nouveauté violet, P1 § 3.3), texte coupé à 3 lignes avec « Lire la suite ». Pour l'admin : bouton « Nouvelle information » en tête du bloc et menu « ⋯ » par information (« Modifier », « Supprimer » avec confirmation). (DASH-37, DASH-46, DASH-13)
- **Bloc 4 « Mes tâches »** : 5 tâches au plus, triées comme partout (en retard, puis priorité élevée, puis échéance la plus proche), chacune avec son échéance (« En retard de 2 jours », « Aujourd'hui ») et un bouton « Terminer » si le rôle le permet (D6) ; lien « Toutes les tâches ». (DASH-40, DASH-19)
- **Bloc 5 « Publicités en cours et à venir »** : la désignation d'abord, puis « Pub n° 2541 · du 12 au 18 oct. » ; lien « Toutes les publicités ». (DASH-25)
- **Ce qui disparaît** : la carte « Commandes en attente » (remplacée par le compteur cliquable), la carte « Livraisons à venir » (fusionnée dans le bloc 1), les bandeaux DLC, les « Accès rapides » du téléphone (la barre du bas fait déjà ce travail).
- **États :** squelette à la forme de chaque bloc au premier chargement ; si un bloc échoue, lui seul affiche « Impossible de charger — Réessayer », les autres restent visibles. (DASH-22, SHELL-30)
- **Fenêtres automatiques :** une seule par session, l'information importante d'abord, l'alerte DLC ensuite ; toujours fermables par la croix, Échap ou un clic à côté. Fermer signifie « me le rappeler à la prochaine connexion ». (DASH-02, DLC-08, DASH-24)
- **Fenêtre d'alerte DLC**, titre « Produits à retirer ou à surveiller » : deux sections, « Expirés : à retirer du rayon » avec un bouton « Retiré du rayon » (selon D7), et « À surveiller » avec un bouton « Vérifié ». « Stock épuisé » passe dans un menu secondaire. Les nombres affichés sont ceux des lignes. Le bouton « Ouvrir la page DLC » ne recharge plus l'application. (DLC-32, DASH-27, DASH-39, DLC-34, DLC-33)
- **Téléphone :** mêmes blocs en une colonne ; les chiffres « du jour » sont vraiment ceux du jour ; liens internes sans rechargement. (DASH-28, DASH-30, DASH-31)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Tableau de Bord | Accueil |
| Vue d'ensemble des performances et statistiques | Bonjour Marie · vendredi 3 octobre |
| Total palettes | Palettes reçues ce mois |
| Délai commande → livraison | Délai moyen commande → livraison (2026) |
| Commandes en Attente | Commandes fournisseurs en attente (compteur) |
| Livraisons à Venir | intégré à « À traiter aujourd'hui » |
| Publicités à Venir | Publicités en cours et à venir |
| badge « -3 jours » ou « 12 jours » | « En retard de 3 j » (rouge) ou « Prévue le 12/10 » (gris) |
| « 2541 » puis désignation tronquée | « Catalogue Noël » · Pub n° 2541 · du 12 au 18 oct. |
| Accès rapide : Commande, Livraison, Tâche, Agenda | supprimé |
| Fenêtre DLC : « Ce modal reviendra… », « Expiré depuis 0 jour(s) », « URGENT », « 5j » | « Cette fenêtre reviendra… », « Expire aujourd'hui », « Urgent », « Dans 5 jours » |

**Gains et effort**

- Plus aucun « tout va bien » affiché à tort ; chaque urgence est à un clic ; l'employé voit enfin ses DLC sur téléphone ; une seule fenêtre, qui se ferme.
- **D'abord (S)** : retirer le texte de débogage (DASH-21) ; rendre la fenêtre DLC fermable (DASH-02) ; envoyer le magasin choisi pour tous les rôles (DASH-01) ; couleurs de priorité et barre colorée (DASH-19, DASH-20) ; vrais chiffres du jour sur téléphone (DASH-28, *fait par le lot 1* ; reste le libellé « du jour »).
- **Refonte : M** pour l'interface. **Prérequis serveur** : un point d'accès de synthèse qui renvoie directement les compteurs au lieu de l'historique complet (DASH-05, effort L, traité avec les performances).

---

### 2. Tâches — `/tasks` (PC, tablette et téléphone)

**Pour qui :** tous ; création et modification à partir de manager.
**Objectif :** savoir ce que j'ai à faire aujourd'hui et le cocher quand c'est fait.
**Tâches principales :**
1. Voir les tâches en retard et celles du jour.
2. Terminer une tâche.
3. Créer ou modifier une tâche (titre, échéance, personne).
4. Retrouver une tâche.

**Ce qui gêne aujourd'hui**

- **Un employé sur PC ne voit aucune tâche** (aucun magasin sélectionné, et pas de sélecteur), et une panne s'affiche « Aucune tâche trouvée avec les filtres sélectionnés » (TASKS-02, TASKS-22).
- **Cartes surchargées** : jusqu'à 7 informations, la notion « programmée » répétée trois fois (« Future », « (Programmée) », « 📅 Active »), emojis et icônes en double ; les tâches terminées sont presque illisibles (opacité 60 %, gris clair, texte barré) (TASKS-19, TASKS-20).
- **Dates fausses** : « En retard de 0 jour » pour une tâche du jour, « Dans 0 jour » pour demain ; le filtre « En retard » inclut les tâches sans échéance (TASKS-12, TASKS-11).
- **Compteurs faux** : « Tâches en cours (10) » ne compte que la page affichée (TASKS-14).
- **Sur tablette**, recherche et filtres sont inaccessibles et l'onglet Kanban est vide ; sur PC, le Kanban n'a que deux colonnes (« En cours », « Terminées ») qui répètent la liste (TASKS-09).
- **Actions en icônes muettes**, fenêtres faites à la main (ni Échap ni focus), formulaire au style disparate, page entièrement rechargée après chaque enregistrement (TASKS-15, TASKS-16, TASKS-17, TASKS-03).
- **Droits incohérents** : « Supprimer » visible pour les managers, « Terminer » pour tous sur téléphone, y compris sur une tâche programmée ; « Tâche terminée » s'affiche même si le serveur refuse (TASKS-13, TASKS-26, TASKS-25).
- **Formulaire** : personne assignée en texte libre, magasin 1 imposé à l'admin en « Tous les magasins », pas de date de début sur téléphone ; mots et couleurs différents entre PC et téléphone (« Actives / Faites » contre « En cours / Terminées ») (TASKS-21, TASKS-18).

**Écran cible**

- **En-tête :** « Tâches » + bouton « Nouvelle tâche » si le rôle peut créer (bouton flottant « + » sur téléphone, avec un nom lisible par les lecteurs d'écran).
- **Onglets avec des compteurs justes :** « À faire (45) » (par défaut), « Programmées (3) » (admin et directeur, seuls à voir une tâche avant sa date de début), « Terminées ». Les nombres portent sur toutes les tâches filtrées, pas sur la page affichée. (TASKS-14)
- **Filtres :** recherche « Titre ou description », identique sur PC et téléphone ; puces « En retard », « Aujourd'hui », « Cette semaine » (du lundi au dimanche), « Sans échéance » ; filtres secondaires « Priorité » et « Assignée à », regroupés sous « Filtres (n) » sur téléphone. Les filtres fonctionnent à toutes les largeurs. (TASKS-11, TASKS-09)
- **Liste :** une seule vue en cartes compactes, sur toutes les largeurs. À gauche, un grand bouton rond « Terminer » ; puis le titre ; puis une seule ligne d'informations : échéance (rouge « En retard de 2 jours », ambre « Aujourd'hui » ou « Demain », sinon la date en gris), priorité seulement si « Élevée », personne assignée si elle est renseignée. Une tâche programmée porte un seul badge « Visible le 05/10 » et pas de bouton « Terminer ». Une tâche terminée a un fond vert très pâle, une coche et « Terminée le 02/10 », en texte lisible et non barré. Description et date de création passent dans la fiche. (TASKS-19, TASKS-20, TASKS-26)
- **Tri unique**, le même que sur l'accueil : en retard, puis priorité élevée, puis échéance la plus proche, puis sans échéance. (DASH-40)
- **Vue Kanban retirée** : ses deux colonnes sont exactement les onglets « À faire » et « Terminées ». À confirmer avec le propriétaire ; à défaut, la rendre utilisable sur tablette. (TASKS-09)
- **Actions par tâche :** un clic sur la carte ouvre la fiche, avec un bouton « Modifier » ; menu « ⋯ » avec « Modifier » et « Supprimer » (admin et directeur, confirmation qui nomme la tâche) ; « Terminer » selon D6. (TASKS-13, TASKS-15)
- **Formulaire** (`FormDialog` : fenêtre sur PC, plein écran sur téléphone, mêmes champs) : Titre*, Description, Priorité (Faible / Moyenne / Élevée, Moyenne par défaut), Échéance, « Visible à partir du » (date de début, aussi sur téléphone), « Assignée à » (liste des personnes du magasin, « Personne » par défaut), Magasin (affiché en lecture seule, ou liste obligatoire en « Tous les magasins »). Contrôle : « L'échéance ne peut pas précéder la date de début ». Après enregistrement, la fenêtre se ferme et la liste se met à jour sans recharger la page, en gardant filtres et page. (TASKS-21, TASKS-16, TASKS-17, TASKS-03)
- **États :** squelette de cartes ; « Impossible de charger les tâches — Réessayer » ; vide : « Aucune tâche à faire » (avec « Nouvelle tâche » si autorisé), « Aucune tâche ne correspond aux filtres — Effacer les filtres », « Choisissez un magasin en haut de l'écran ». (TASKS-22, TASKS-02)
- **Téléphone :** même carte, mêmes mots, mêmes couleurs ; un échec du serveur affiche un vrai message d'erreur. (TASKS-18, TASKS-25)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Tâches en cours (n) · Actives (mobile) | À faire (45) |
| Tâches terminées · Faites (mobile) | Terminées |
| Future · (Programmée) · Visible en avance (directeur) · 📅 Active | Visible le 05/10 |
| ⏰ En retard de 0 jour · Dans 0 jour | Aujourd'hui · Demain |
| Assigné à: Non assigné | rien ; sinon « Pour : Paul » |
| Créée le 02/10/2026 à 14:32 (sur la carte) | dans la fiche seulement |
| Filtre « Statut : En cours » | « À faire » |
| Onglet « Kanban » | retiré |

**Gains et effort**

- L'employé retrouve ses tâches ; une carte se lit en une seconde ; dates et compteurs sont justes ; un seul écran à maintenir au lieu de deux pages et de six formulaires inutilisés (TASKS-31, TASKS-32).
- **D'abord (S)** : magasin présélectionné pour l'employé (TASKS-02) ; calcul des jours (TASKS-12) ; filtres sur tablette (TASKS-09) ; plus de rechargement complet (TASKS-03, *fait par le lot 1*) ; tâches terminées lisibles (TASKS-20) ; droits alignés sur la table de P1 § 2.2 (TASKS-13).
- **Refonte : M.**

---

### 3. DLC — `/dlc` (PC et téléphone, plus la fenêtre d'alerte de l'accueil)

**Pour qui :** tous ; en rayon sur téléphone, au bureau sur PC.
**Objectif :** ne laisser aucun produit périmé en rayon et surveiller ceux qui approchent de leur date.
**Tâches principales :**
1. Ajouter un produit (scan du code-barres, date limite).
2. Voir les produits expirés et ceux qui expirent bientôt.
3. Les traiter : retiré du rayon, vérifié, stock épuisé.
4. Imprimer la liste pour la tournée en rayon.

**Ce qui gêne aujourd'hui**

- **L'essentiel est caché** : les compteurs sont sous un bloc de filtres, ne sont pas cliquables et sont faux (« Actifs » inclut « Expire bientôt », le jour J est compté deux fois) (DLC-27, DLC-14).
- **Jusqu'à 5 boutons-icônes colorés par ligne**, dont deux coches presque identiques pour « Valider » et « Traité », et quatre notions qui se recouvrent : Validé, Traité, Stock épuisé, Supprimé (DLC-23, DLC-41).
- **Le jour J, aucun bouton n'apparaît** et le badge dit « Expire bientôt » ; un produit « traité » ne revient jamais dans les expirés, contrairement à ce qu'annonce l'écran (DLC-02, DLC-01).
- **Formulaire piégé** : après « Annuler » une modification, « Nouveau produit DLC » rouvre en modification et écrase l'ancien produit ; ouvrir un produit relance la recherche du code-barres et écrase son nom ; le magasin choisi est ignoré, à la création comme à l'affichage pour les non-admins (DLC-03, DLC-04, DLC-05, DLC-15).
- **Téléphone** : liste vide pour les employés et en « Tous les magasins » ; onglet par défaut « OK » (le moins urgent), sans compteurs ; badge « J-3 » identique avant et après la date ; formulaire sans message d'erreur, avec la date du jour et le fournisseur n° 1 pré-remplis ; « Valider » refusé sans message ; ni modification, ni stock épuisé (DLC-10, DLC-30, DLC-29, DLC-12, DLC-49, DLC-11, DLC-13, DLC-31).
- **Impression introuvable** (icônes de 24 px sans texte) et bouton « Exporter PDF » qui ne fait rien (DLC-25, DLC-24).
- **Erreurs trompeuses** : « 403: {"message":…} » en anglais, panne affichée comme « 0 produit expiré », tableau remplacé par un texte de chargement à chaque frappe ; la recherche sur PC ne trouve pas un code-barres (DLC-21, DLC-22, DLC-16, DLC-47).
- **Lisibilité** : lignes grisées à 50 %, vocabulaire et seuils différents entre PC, téléphone et fenêtre d'alerte, « DLUO », message « Required » (DLC-42, DLC-28, DLC-50, DLC-44).

**Écran cible**

- **En-tête :** « DLC » + « Ajouter un produit » (bouton flottant sur téléphone) + un bouton « Imprimer ▾ » à deux choix : « Produits expirés » et « Produits à surveiller (15 jours) ». L'impression sort toujours la liste complète correspondante, quels que soient les filtres, et neutralise les noms saisis avant de les imprimer. « Exporter PDF » disparaît. (DLC-25, DLC-24, DLC-26)
- **Onglets-compteurs en haut de page**, cliquables, avec des catégories qui ne se recouvrent pas : « Expirés (3) » rouge, « À surveiller (12) » ambre (1 à 15 jours), « OK (140) » vert, « Retirés et épuisés » gris (historique). L'écran s'ouvre sur « Expirés » s'il y en a, sinon sur « À surveiller ». (DLC-27, DLC-30, DLC-14)
- **Filtres :** une ligne, recherche « Nom, code-barres ou fournisseur » + « Fournisseur ». Les résultats précédents restent affichés pendant la recherche. (DLC-47, DLC-16)
- **Tableau PC, 4 colonnes d'information au lieu de 6, plus l'action :** Produit (nom, code-barres en gris dessous) · Fournisseur · Date limite (« 12/10/2026 » et un petit badge « DLC » ou « DDM » avec infobulle) · État (« Expiré depuis 3 j », « Expire aujourd'hui », « Encore 2 j », « Vérifié · expire le 12/10 ») · Action. Colonne « Magasin » seulement en « Tous les magasins ». La colonne séparée « Code EAN13 » disparaît. (DLC-43, DLC-28)
- **Une action texte par ligne :** produit expiré ou du jour → « Retiré du rayon » (confirmation courte, selon D7) ; produit à surveiller → « Vérifié » (réversible, avec un toast « Annuler ») ; produit OK → pas de bouton. Menu « ⋯ » : « Stock épuisé », « Modifier », « Supprimer » (à partir de manager, avec confirmation) ; dans l'historique : « Remettre en rayon » ; sur un produit vérifié : « Annuler la vérification ». Un produit vérifié revient de lui-même dans « Expirés » le jour de sa date. (DLC-23, DLC-02, DLC-01, DLC-13)
- **Trois gestes expliqués en une ligne d'aide sous les onglets** : « Retiré du rayon » = le produit périmé est sorti ; « Vérifié » = j'ai contrôlé le rayon, le produit reviendra à sa date ; « Stock épuisé » = plus de stock, rien à retirer. « Supprimer » ne sert qu'à corriger une erreur de saisie. (DLC-23, DLC-32)
- **Formulaire**, mêmes champs sur PC et téléphone : Code-barres en premier (scan ou saisie ; en création il remplit le nom et le fournisseur, jamais en modification) · Nom du produit* · Fournisseur* (liste avec recherche, vide par défaut) · Date limite* (vide ; raccourcis « +3 j », « +7 j », « +15 j » sur téléphone) · Type (« À consommer jusqu'au (DLC) » ou « À consommer de préférence avant (DDM) ») · Magasin (affiché, ou liste obligatoire en « Tous les magasins ») · Notes. Un message en français sous chaque champ manquant. Fermer la fenêtre remet le formulaire à zéro. (DLC-03, DLC-04, DLC-05, DLC-11, DLC-12, DLC-49, DLC-44, DLC-50)
- **États :** squelette au premier chargement ; « Impossible de charger les produits — Réessayer » au lieu de zéros ; vide par onglet (« Aucun produit expiré », en vert) ; « Choisissez un magasin » si nécessaire. Après une action, on reste sur la même page de résultats. Les lignes de l'historique restent lisibles, l'état est porté par le badge. (DLC-22, DLC-10, DLC-51, DLC-42)
- **Téléphone :** mêmes onglets avec leurs nombres ; cartes avec nom, date, badge d'état et gros bouton d'action ; menu « ⋯ » avec les mêmes actions que sur PC ; la recherche attend la fin de la frappe avant d'interroger le serveur et ne plante plus sur un produit sans nom. (DLC-31, DLC-09, DLC-29, DLC-48)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Gestion DLC (menu) | DLC |
| Produits Actifs | OK (plus de 15 jours) |
| Expire Bientôt | À surveiller |
| Valider · onglet mobile « Validés » | Retiré du rayon · onglet « Retirés et épuisés » |
| Marquer traité · « Traité - Expire dans X jours » | Vérifié · « Vérifié · expire le 12/10 » |
| J-3 (mobile) | Encore 3 j · Expiré depuis 3 j |
| Code EAN13 (optionnel) · Gencode (Scanner si dispo) | Code-barres |
| Date Expiration · Date d'expiration | Date limite |
| DLUO (en saisie) | plus proposé (affiché seulement pour les produits existants) |
| Exporter PDF + icônes imprimante | Imprimer ▾ |
| Required | Choisissez un fournisseur |
| Produits DLC (23) | 23 produits |

**Gains et effort**

- L'employé voit d'abord ce qu'il doit retirer, a un seul bouton clair, et peut tout faire depuis le rayon ; fin des données faussées (produits périmés notés « épuisés », produits déplacés de magasin, produits écrasés).
- **D'abord (S)** : boutons du jour J (DLC-02) ; retour des produits vérifiés à expiration (DLC-01) ; formulaire remis à zéro (DLC-03, DLC-04) ; magasin respecté (DLC-05) ; liste téléphone pour les employés (DLC-10) ; retrait d'« Exporter PDF » (DLC-24) ; recherche par code-barres (DLC-47).
- **Refonte : L** (M pour le PC, M pour le téléphone), avec une seule logique partagée de dates, de libellés et d'actions pour les trois écrans (DLC-28). Prérequis serveur : contrôle des droits et du magasin à l'enregistrement, aligné sur D7 (DLC-06).

---

### 4. Commandes clients — `/customer-orders` (PC et téléphone)

**Pour qui :** vendeurs, accueil, managers.
**Objectif :** suivre chaque commande d'un client jusqu'au retrait, sans jamais oublier de le prévenir.
**Tâches principales :**
1. Saisir une commande au comptoir (scan du code-barres, client, acompte).
2. Prévenir le client quand le produit est disponible.
3. Marquer la commande retirée.
4. Retrouver une commande (nom, téléphone, produit) et imprimer son étiquette.

**Ce qui gêne aujourd'hui**

- **Modifier une commande l'abîme** : le statut repasse à « En attente de Commande », la commande peut changer de magasin, les notes et l'e-mail sont effacés (CMDCLI-03, CMDCLI-04, CMDCLI-05).
- **Formulaire difficile** : affiché à 90 % de sa taille, bouton « Créer » hors de l'écran sur un portable ; fournisseur n° 1 présélectionné en silence ; le champ code-barres, qui remplit tout, arrive après la désignation ; une panne du service article s'affiche « Produit non référencé » et bloque la saisie (CMDCLI-20, CMDCLI-21, CMDCLI-22).
- **Tableau de 9 colonnes** sans défilement, 4 à 5 icônes muettes par ligne qui changent selon le statut, statut modifiable en cliquant sur un badge (introuvable et inaccessible au clavier), lignes barrées (CMDCLI-24, CMDCLI-25).
- **Changements de statut immédiats**, y compris « Annulé », sans confirmation, et échecs silencieux (CMDCLI-26, CMDCLI-10).
- **Mise en page chargée** : bandeau orange collant au-dessus du titre, carte « Recherche et Filtres » qui n'apporte rien, aucun état vide ni d'erreur, « Chargement... » en texte brut (CMDCLI-38, CMDCLI-18).
- **Deux parcours pour « client contacté »** (avec ou sans commentaire), libellés mêlés : « Status », « Fournisseurs » pour « tous », « Gencode », « Qty », « rév... » (CMDCLI-37, CMDCLI-27).
- **Fiche détail trompeuse** (faux code-barres « scannable », bloc « Actions disponibles » sans bouton, notes et appel invisibles) et étiquette imprimée qui peut encoder un autre code que celui du produit (CMDCLI-29, CMDCLI-30).
- **Téléphone** : liste vide en « Tous les magasins », pas de filtre par statut (les commandes retirées et annulées restent mêlées aux actives), menu « ⋮ » incomplet avec un « Annuler » ambigu, formulaire sans messages d'erreur, cases « Prix promotionnel » et « Client déjà notifié » sans effet ; le sélecteur de magasin est sans effet pour directeur et manager sur PC (CMDCLI-31, CMDCLI-33, CMDCLI-26, CMDCLI-32, CMDCLI-06, CMDCLI-16).

**Écran cible**

- **En-tête :** « Commandes clients » + « Nouvelle commande ».
- **Bandeau « À prévenir »** placé sous le titre (et non collé en haut) : « 3 clients à prévenir : leur commande est disponible » avec un bouton « Voir », qui applique le filtre au lieu d'ouvrir une fenêtre séparée. (CMDCLI-38, CMDCLI-37, CMDCLI-41)
- **Onglets :** « En cours (12) » (en attente de commande et commandées), « Disponibles (5) », « Terminées » (retirées et annulées), ouverture sur « En cours ». Dans « Disponibles », les clients pas encore prévenus apparaissent en premier avec l'indicateur « Client à prévenir ». (CMDCLI-38, CMDCLI-33)
- **Filtres :** recherche « Nom, téléphone, produit ou code-barres » + « Fournisseur » (« Tous les fournisseurs »). Le magasin vient du sélecteur global, pour tous les rôles. (CMDCLI-27, CMDCLI-16)
- **Tableau PC, 6 colonnes d'information au lieu de 8, plus l'action :** Client (nom, téléphone cliquable dessous) · Produit (désignation, puis « Qté 2 · réf. 12345 ») · Fournisseur · Acompte (« 20,00 € », aligné à droite) · Statut (badge unique de P1 § 3.3, le même dans la liste, la fiche et l'étiquette, plus « Client à prévenir » ou « Prévenu le 02/10 ») · Commandée le. Colonnes retirées : « Gencode » (dans la fiche), « Téléphone » et « Quantité » (fusionnées). Plus de lignes barrées. (CMDCLI-24, CMDCLI-28)
- **Une action « étape suivante » par ligne, avec du texte** : en attente de commande → « Commandée » ; commandée → « Disponible » ; disponible, client non prévenu → « Prévenir le client » ; disponible et prévenu → « Remise au client » (passe en « Retirée », toast « Annuler ») ; terminée → aucune. Menu « ⋯ » : « Voir la fiche », « Imprimer l'étiquette », « Modifier », « Annuler la commande » (en rouge, confirmation), « Supprimer » (admin et directeur, confirmation). Le badge de statut n'est plus cliquable. (CMDCLI-25, CMDCLI-26, CMDCLI-10)
- **« Prévenir le client »** ouvre une petite fenêtre unique (PC et téléphone) : numéro avec bouton « Appeler », commentaire facultatif (« Message laissé, rappeler demain »), bouton « Client prévenu ». La ligne et le bandeau se mettent à jour aussitôt. (CMDCLI-37, CMDCLI-36, CMDCLI-15)
- **Fiche** (panneau latéral sur PC, plein écran sur téléphone, ouverte au clic sur la ligne) : toutes les informations, notes internes, « Prévenu le 02/10 à 10:12 — message laissé », code-barres affiché en chiffres (ou vrai code-barres), et de vrais boutons « Imprimer l'étiquette », « Prévenir le client », « Modifier ». (CMDCLI-29, CMDCLI-05)
- **Formulaire** (`FormDialog` à hauteur maximale, sans réduction d'échelle), deux blocs. *Produit* : Code-barres en premier (curseur placé dedans, recherche à la touche Entrée ; si le service article ne répond pas : « Recherche indisponible, saisissez le produit à la main », sans bloquer) · Désignation* · Référence · Quantité* · Fournisseur* (vide par défaut, avec recherche) · Prix promotionnel. *Client* : Nom* · Téléphone* (obligatoire, à confirmer) · Acompte · Commande prise par · Notes internes. En modification, ni le statut ni le magasin ne changent, et les notes sont conservées. (CMDCLI-20, CMDCLI-21, CMDCLI-22, CMDCLI-03, CMDCLI-04, CMDCLI-05)
- **États :** squelette de 5 lignes ; « Impossible de charger les commandes — Réessayer » ; vide par onglet ; « Aucune commande ne correspond à la recherche — Effacer les filtres ». (CMDCLI-18)
- **Impression :** l'étiquette encode exactement le code-barres du produit et affiche sous l'image la valeur encodée ; les champs saisis sont neutralisés avant impression (CMDCLI-30, CMDCLI-08).
- **Téléphone :** même formulaire (version mobile du même composant), mêmes onglets, cartes avec gros boutons « Appeler » et « Client prévenu » ; le menu « ⋮ » ne propose que l'étape suivante et « Annuler la commande » en rouge, séparé, avec confirmation ; état « Choisissez un magasin » ; dates avec l'année, montants au format français ; les deux cases inopérantes fonctionnent ou disparaissent. (CMDCLI-32, CMDCLI-31, CMDCLI-35, CMDCLI-06)
- **Droits :** selon D8, l'employé peut marquer « Client prévenu » et « Remise au client », mais pas annuler ni modifier.

**Libellés à renommer**

| Avant | Après |
|---|---|
| Commandes Client (PC) · Cmd Client (mobile) | Commandes clients |
| 📞 3 clients à appeler | 3 clients à prévenir : leur commande est disponible |
| Recherche et Filtres (titre de carte) | supprimé |
| Status (filtre) · option « Fournisseurs » | Tous les statuts · Tous les fournisseurs |
| Gencode (obligatoire) · Gencode | Code-barres |
| En attente de Commande · Commande en Cours | En attente de commande · Commandée chez le fournisseur |
| Retiré · Annulé | Retirée · Annulée |
| Marquer Appelé · Marquer client comme contacté · Marquer contacté | Client prévenu |
| Annuler (menu mobile) | Annuler la commande |
| Qty · rév... | Qté · réf. |
| Qui a pris la commande · Prise par | Commande prise par |

**Gains et effort**

- Le comptoir saisit plus vite (code-barres d'abord, formulaire entier à l'écran) ; aucune commande n'est plus abîmée par une modification ; le geste suivant est toujours écrit sur la ligne ; plus de client oublié.
- **D'abord (S)** : modification sans perte de statut, de magasin ni de notes (CMDCLI-03, CMDCLI-04, CMDCLI-05) ; formulaire à taille normale avec défilement (CMDCLI-20) ; état « Choisissez un magasin » sur téléphone (CMDCLI-31) ; libellés évidents (CMDCLI-27) ; échappement de l'impression (CMDCLI-08).
- **Refonte : L** (tableau et actions M, formulaire commun PC/téléphone M). Prérequis serveur : contrôle des droits en modification (CMDCLI-07).

---

### 5. SAV — `/sav` (PC et téléphone)

**Pour qui :** accueil et managers ; création par l'employé selon D9.
**Objectif :** suivre chaque produit défectueux ou incomplet d'un client jusqu'à sa résolution, et pouvoir le rappeler.
**Tâches principales :**
1. Ouvrir un ticket quand le client se présente.
2. Suivre le ticket et changer son statut (pièces commandées, résolu, fermé).
3. Noter ce qui a été fait (commentaire).
4. Retrouver un ticket et appeler le client.

**Ce qui gêne aujourd'hui**

- **Des boutons visibles ne font rien** : « Modifier » ouvre un formulaire complet dont l'enregistrement répond « Fonction en développement » ; les commentaires affichent « ajouté » mais ne sont jamais enregistrés ; la liste ne se met pas à jour après une création dès qu'un filtre ou un magasin est choisi (SAV-03, SAV-02, SAV-01).
- **La version téléphone est entièrement en panne** : elle appelle une adresse de serveur qui n'existe pas (liste toujours vide, création et changement de statut en échec) et envoie des statuts en anglais ; le « + » est montré aux employés que le serveur refuse ; le formulaire n'affiche aucune erreur ; il n'y a ni fiche, ni commentaires, ni confirmation avant « Fermer » (MSAV-01, MSAV-02, MSAV-04, MSAV-03, MSAV-05).
- **Codes techniques à l'écran** : « pieces_manquantes », « Statut changé de "en_cours" vers "resolu" », « N/A », « attente_echange », emojis ; libellés et couleurs différents entre PC et téléphone (SAV-18, MSAV-06).
- **Cartes trompeuses** : curseur « main » mais rien au clic, trois petites icônes sans texte ; le badge « Nouveau » (commentaire récent) se confond avec le statut « Nouveau », et les couleurs de statut et de priorité se chevauchent (SAV-20, SAV-21).
- **Fenêtre de suivi coupée** sur un portable : le bloc « Actions Rapides », qui sert à changer le statut, est hors de l'écran ; le statut change d'un clic, sans confirmation, avec un message inexact (SAV-19, SAV-24).
- **Compteurs faux et non cliquables** (« Critiques » compte les tickets clos, « Résolus » inclut les fermés), tickets fermés mélangés aux tickets ouverts, et une panne s'affiche « Aucun ticket trouvé » (SAV-22, SAV-25, SAV-23, MSAV-09).
- **Création** : l'admin crée dans le premier magasin de la liste, le formulaire « Nouveau ticket » reprend le dernier ticket ouvert en modification, et le fournisseur se choisit dans une longue liste sans recherche (SAV-07, SAV-08, SAV-28).

**Écran cible**

- **En-tête :** « SAV » + « Nouveau ticket ».
- **Onglets-compteurs** (remplacent les 5 cartes Total / Nouveaux / En cours / Résolus / Critiques) : « À traiter (4) » (nouveaux et en cours), « En attente (3) » (pièces ou échange), « Clôturés » (résolus et fermés). Ouverture sur « À traiter ». Un indicateur rouge « 2 urgents » à côté du titre filtre les tickets ouverts de priorité haute ou critique. (SAV-22, SAV-25)
- **Filtres :** recherche « N° de ticket, client ou produit » + « Fournisseur » ; « Priorité » en filtre secondaire.
- **Liste** (tableau sur PC, cartes sur téléphone) : Ticket (n° et date d'ouverture) · Produit · Client (nom, téléphone cliquable) · Problème (« Pièces manquantes ») · Statut · Priorité (indicateur seulement si Haute ou Critique) · Ouvert depuis (« 5 j »). Tri : priorité, puis ancienneté. (SAV-18, SAV-21)
- **Actions par ligne :** un clic sur la ligne ouvre la fiche de suivi (le geste principal) ; menu « ⋯ » avec « Supprimer » (admin et directeur, confirmation). Le bouton « Modifier » disparaît tant que l'enregistrement n'existe pas (décision à prendre : le brancher ou non). (SAV-20, SAV-03)
- **Fiche de suivi** (panneau latéral sur PC, plein écran sur téléphone, défilement interne, rien n'est coupé). En haut : n° du ticket, **Statut** (liste déroulante explicite) et **Priorité**, avec un bouton « Enregistrer ». Passer à « Résolu » ou « Fermé » demande une confirmation et une phrase « Comment le problème a-t-il été résolu ? ». En dessous, une seule carte « Produit · Client · Problème » et un bouton « Appeler le client ». La zone « Historique et commentaires » n'est affichée qu'une fois l'enregistrement réparé côté serveur. (SAV-19, SAV-24, SAV-02)
- **Formulaire « Nouveau ticket »** (`FormDialog`, vide à chaque ouverture), deux blocs. *Produit et problème* : Code-barres · Désignation* · Référence · Fournisseur* (avec recherche) · Type de problème* (Défectueux, Pièces manquantes, Non conforme, Autre) · Description du problème* · Priorité (Normale par défaut). *Client (facultatif)* : Nom · Téléphone. Le magasin est le magasin actif (liste obligatoire en « Tous les magasins »). Erreurs sous chaque champ. (SAV-28, SAV-07, SAV-08)
- **États :** squelettes qui réservent la place des compteurs ; « Impossible de charger les tickets — Réessayer » ; vide par onglet (« Aucun ticket à traiter », avec « Nouveau ticket ») ; « Aucun ticket ne correspond — Effacer les filtres » ; « Choisissez un magasin ». (SAV-23, MSAV-09)
- **Téléphone :** branché sur le même serveur et les mêmes statuts que le PC ; mêmes onglets et mêmes libellés ; cartes avec un bouton « Appeler » et ouverture de la fiche au toucher ; « + » visible selon D9 ; erreurs sous chaque champ ; « Code-barres du produit » sans promesse de scanner ; confirmation avant « Résolu » ou « Fermé ». (MSAV-01, MSAV-02, MSAV-04, MSAV-03, MSAV-05, MSAV-06, MSAV-07)

**Libellés à renommer**

| Avant | Après |
|---|---|
| pieces_manquantes · defectueux · non_conforme | Pièces manquantes · Défectueux · Non conforme |
| Statut changé de "en_cours" vers "resolu" | Statut : En cours → Résolu |
| N/A | Client non renseigné |
| Attente pièces (PC) · Pièces (mobile) | En attente de pièces |
| attente_echange (mobile) · Attente échange | En attente d'échange |
| Badge « Nouveau » (commentaire récent) | Nouveau message |
| Gencode (EAN13) + « Scanner... » | Code-barres du produit + « Ex. 3017620422003 » |
| Description Panne | Description du problème |
| Actions Rapides | intégré en haut de la fiche |
| Tickets SAV (12) | 12 tickets |
| Fonction en développement | bouton retiré |

**Gains et effort**

- Plus de travail perdu dans un formulaire qui n'enregistre pas ; le téléphone devient utilisable à l'accueil ; les urgences ouvertes ne se perdent plus parmi les tickets clos.
- **D'abord (S)** : rafraîchissement de la liste (SAV-01) ; masquer « Modifier » et le champ commentaire tant qu'ils n'enregistrent rien (SAV-03, SAV-02) ; brancher le téléphone sur la bonne adresse et les bons statuts (MSAV-01, MSAV-02) ; libellés français (SAV-18, MSAV-06) ; défilement de la fenêtre de suivi (SAV-19).
- **Refonte : M** pour le PC, **M** pour le téléphone. Prérequis serveur : table d'historique et dates de résolution (SAV-02, effort M).

---

### 6. Livraisons — `/deliveries` (PC et téléphone)

**Pour qui :** managers et réception ; l'employé selon D1.
**À noter :** les fenêtres de création, de modification et de validation, ainsi que la fiche détail, sont communes aux Livraisons, aux Commandes fournisseurs et au Calendrier ; elles sont décrites ici une seule fois.
**Objectif :** savoir ce qui arrive aujourd'hui et valider chaque réception avec son bon de livraison.
**Tâches principales :**
1. Voir les livraisons du jour et celles en retard.
2. Valider la réception en saisissant le n° de BL.
3. Marquer le contrôle qualité comme fait.
4. Planifier ou corriger une livraison et la lier à une commande.

**Ce qui gêne aujourd'hui**

- **Le téléphone est inutilisable** alors que la réception se fait souvent debout : toutes les dates affichent « Date inconnue », l'onglet « Reçues » est toujours vide, aucune action n'est possible (impossible de valider une réception), et une panne s'affiche comme une liste vide (MOB-02, MOB-01, MOB-03).
- **Tableau de 8 colonnes** non défilable sur tablette, et jusqu'à 5 icônes sans texte, dont deux coches presque identiques pour « valider la livraison » et « contrôle effectué » (ORD-11, ORD-10).
- **« Contrôle effectué » se valide en un clic**, sans confirmation ni annulation possible (LIV-02).
- **Filtres inadaptés** : « En attente » ne correspond à aucun statut ; pas de tri, pas de raccourci « Aujourd'hui » ou « En retard », pas de recherche par n° de BL (LIV-01, ORD-15).
- **Libellés techniques** : « Groupe » au lieu de « Magasin », `#34`, « Commande liée #12 », abréviations « P » et « C » ; couleurs de statut différentes du calendrier (ORD-08, ORD-09, CAL-07, ORD-12).
- **Fenêtres** : magasin imposé en « Tous les magasins », fournisseur dans une longue liste sans recherche, fiche avec une fenêtre de modification empilée qui affiche ensuite des données périmées, commande liée qui disparaît si elle est livrée, boutons placés différemment d'une fenêtre à l'autre (MOD-03, MOD-04, MOD-08, MOD-10, MOD-09).
- **La liste des commandes à lier** télécharge tout l'historique (admin) ou reste vide (employé) (MOD-01) ; après une suppression, retour en page 1 (ORD-14).

**Écran cible**

- **En-tête :** « Livraisons » + « Nouvelle livraison » (managers et plus).
- **Filtres rapides** (puces, avec leur nombre) : « À recevoir » (par défaut), « Aujourd'hui (4) », « En retard (2) », « Cette semaine », « Reçues » ; recherche « Fournisseur ou n° de BL » ; « Fournisseur ». Tri par date prévue, les retards en tête. Le filtre « En attente » disparaît. (ORD-15, LIV-01)
- **Tableau PC, 5 colonnes d'information au lieu de 7, plus l'action :** Date prévue (« Aujourd'hui », « Demain », sinon « 12/10 ») · Fournisseur · Quantité (« 3 palettes », « 12 colis ») · Statut (« Planifiée », « En retard », « Livrée le 02/10 · BL 4512 », avec à côté « Contrôle à faire » ou « Contrôle fait ») · Commande liée (« Commande du 28/09 », cliquable) · Magasin (seulement en « Tous les magasins »). Colonnes retirées : « Créé par » (dans la fiche), identifiant `#34`. (ORD-08, ORD-09, ORD-12)
- **Une action texte par ligne :** livraison planifiée → « Valider la réception » ; livraison reçue dont le contrôle est requis et pas fait → « Contrôle fait » (toast « Annuler » pendant quelques secondes) ; sinon rien. Menu « ⋯ » : « Voir la fiche », « Modifier », « Supprimer » (confirmation qui nomme la livraison : « Supprimer la livraison du 12/10 de Lactalis ? »). (ORD-10, LIV-02)
- **Fenêtre « Valider la réception »** : rappel du fournisseur et de la quantité, avertissement « Contrôle à effectuer » sans emoji si le fournisseur l'exige, champ « N° de bon de livraison (BL) »*, bouton « Valider la réception ».
- **Fiche livraison** (panneau latéral) : lecture d'abord, puis bouton « Modifier » qui passe en édition dans la même fenêtre ; données à jour après enregistrement ; commande liée toujours visible ; couleur propre aux livraisons. (MOD-08, MOD-10)
- **Formulaire création et modification :** Magasin (liste obligatoire en « Tous les magasins », sinon affiché) · Fournisseur* (liste avec recherche, fournisseurs récents en premier) · Date prévue* · Quantité* et unité (Palettes / Colis) · Commande liée (commandes ouvertes de ce fournisseur, chargées après le choix du fournisseur) · Commentaire. Pied de fenêtre standard : « Annuler » à gauche, action à droite. (MOD-03, MOD-04, MOD-01, MOD-09)
- **États :** squelette ; « Impossible de charger les livraisons — Réessayer » ; vide par filtre (« Aucune livraison attendue aujourd'hui ») ; après une action, on reste sur la même page ; une session expirée pendant la saisie renvoie proprement à la connexion. (MOB-03, ORD-14, MOD-02)
- **Téléphone :** cartes cliquables avec le fournisseur en titre, « Aujourd'hui · 3 palettes » et le badge ; bouton « Valider la réception » directement sur la carte (si le rôle le permet, D1) ; mêmes filtres en onglets « À recevoir », « En retard », « Reçues », qui fonctionnent. (MOB-01, MOB-02)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Groupe | Magasin |
| Planifié · `planned` (mobile) | Planifiée |
| Livré | Livrée |
| Filtre « En attente » | supprimé |
| P · C | palettes · colis |
| #34 · Liv #34 | supprimé |
| Commande liée : #12 | Commande du 28/09 |
| Valider livraison | Valider la réception |
| N° Bon de Livraison * | N° de bon de livraison (BL) * |
| Contrôle validé · « Marquer le contrôle comme effectué » | Contrôle fait |
| Date inconnue (mobile) | la vraie date prévue |

**Gains et effort**

- La réception se valide depuis le téléphone, au quai ; la liste du jour est à un clic ; plus de contrôle qualité validé par erreur.
- **D'abord (S)** : champs et statuts réels sur téléphone (MOB-02) ; filtre « En attente » retiré (LIV-01) ; défilement horizontal du tableau (ORD-11) ; noms sur les boutons-icônes (ORD-10) ; « Magasin » au lieu de « Groupe » (ORD-08).
- **Refonte : M** pour le PC, **M** pour le téléphone (cartes et validation). Prérequis serveur : liste légère des commandes ouvertes d'un fournisseur (MOD-01).

---

### 7. Commandes fournisseurs — `/orders` (PC et téléphone)

**Pour qui :** managers, directeurs, admin ; masquée pour l'employé selon D1.
**Objectif :** savoir ce qui a été commandé à chaque fournisseur et ce qui n'est pas encore livré.
**Tâches principales :**
1. Créer une commande.
2. Retrouver une commande et voir ses livraisons.
3. La modifier ou la supprimer.

**Ce qui gêne aujourd'hui**

- **La modification échoue à chaque fois** (ORD-01).
- **Supprimer une commande liée à des livraisons** échoue avec un message générique (ORD-13).
- **Tableau tronqué** sur petit écran, icônes sans texte, identifiant `#id`, « Groupe » au lieu de « Magasin » (ORD-11, ORD-10, ORD-09, ORD-08).
- **Couleurs de statut** différentes du calendrier ; ni tri ni filtre de période (ORD-12, ORD-15).
- **Téléphone** : cartes avec une flèche mais non cliquables, « Date inconnue », recherche par numéro qui ne trouve jamais rien, statut « planned » en anglais, page visible des employés alors que le PC la leur cache, panne affichée comme « Aucune commande trouvée » (MOB-01, MOB-02, MOB-03, SHELL-11).
- **Retour en page 1** après chaque suppression ; liste de plus en plus lente avec l'historique (ORD-14, ORD-02).

**Écran cible**

- **En-tête :** « Commandes fournisseurs » + « Nouvelle commande ».
- **Filtres :** onglets « En attente (8) », « Planifiées », « Livrées », « Toutes » ; recherche « Fournisseur » ; période (« Ce mois », « Mois dernier », dates libres). Tri par date prévue. (ORD-15)
- **Tableau, 4 colonnes d'information au lieu de 5 :** Date prévue · Fournisseur · Statut (« En attente », « Planifiée », « Livrée ») · Livraisons (« 1 livraison · 02/10 » ou « Aucune ») · Magasin (seulement en « Tous les magasins »). Colonnes retirées : « Créé par » (dans la fiche), `#id`. (ORD-09, ORD-12)
- **Actions :** clic sur la ligne = fiche (même fiche que les livraisons : lecture puis « Modifier ») ; menu « ⋯ » : « Modifier », « Supprimer ». Si des livraisons sont liées, la confirmation le dit : « Cette commande a 2 livraisons liées. Supprimez-les ou détachez-les d'abord. » (ORD-13, MOD-08)
- **Formulaire :** identique à celui des livraisons pour le magasin et le fournisseur (liste avec recherche), plus la date prévue et un commentaire. (MOD-03, MOD-04)
- **États :** squelette, erreur avec « Réessayer », vide par onglet ; la liste se met à jour après chaque modification et on reste sur la même page. (ORD-14, ORD-05)
- **Téléphone :** accessible depuis le menu (et plus depuis la barre du bas, P1 § 2.6) ; cartes cliquables vers la fiche, vraies dates, statuts en français, erreur explicite ; masquée pour l'employé selon D1. (MOB-01, MOB-02, MOB-03)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Commandes | Commandes fournisseurs |
| Groupe · Magasin/Groupe | Magasin |
| #12 · Cmd #12 · Commande #12 | « Commande Lactalis du 28/09 » ; référence CMD-12 pour la recherche |
| Planifié · `planned` | Planifiée |
| Livré | Livrée |
| Message d'échec générique à la suppression | « Cette commande a 2 livraisons liées… » |

**Gains et effort**

- Les commandes redeviennent modifiables ; une ligne se lit en un coup d'œil ; le téléphone sert enfin à consulter.
- **D'abord (S)** : réparer la modification (ORD-01) ; défilement du tableau et noms des boutons (ORD-11, ORD-10) ; champs réels sur téléphone (MOB-02).
- **Refonte : M.** Prérequis serveur : message clair à la suppression (ORD-13, M) ; pagination côté serveur (ORD-02, L, traité avec les performances).

---

### 8. Calendrier — `/calendar` (PC et téléphone)

**Pour qui :** managers et directeurs ; consultation pour l'employé.
**Objectif :** voir d'un coup d'œil ce qui est commandé, livré et en promotion chaque jour du mois.
**Tâches principales :**
1. Parcourir le mois et repérer les jours chargés.
2. Ouvrir une commande ou une livraison d'un jour.
3. Créer une commande ou une livraison à une date.
4. Lire les chiffres du mois.

**Ce qui gêne aujourd'hui**

- **Grille illisible** : texte de 11 px, icônes de 8 px, abréviations « P » et « C », état codé par des points de couleur ; la légende ne correspond pas aux couleurs utilisées (CAL-07, CAL-06).
- **Un clic n'importe où dans une case ouvre « Création rapide »**, même pour qui n'a pas le droit ; le « + » n'apparaît qu'au survol, donc jamais sur tablette (CAL-08).
- **Deux éléments par jour seulement**, le reste derrière « +N autres » qui ouvre des fenêtres imbriquées, avec la date de création au lieu de la date prévue (CAL-14, CAL-13).
- **Le panneau « Statistiques du mois » flotte en bas à droite**, cache les derniers jours et affiche des chiffres faux (palettes et colis mélangés, « colis » = nombre de livraisons, commandes en attente de toutes dates) (CAL-10, DASH-42, CAL-11, DASH-26).
- **Navigation** : « mois suivant » saute un mois les 29, 30 et 31 ; la grille est remplacée par un spinner à chaque changement de mois ; les jours des mois voisins sont toujours vides ; une panne donne un calendrier vide sans message ; le mois est affiché deux fois (CAL-01, CAL-04, CAL-05, CAL-16).
- **Téléphone** : lecture seule, statuts en anglais (« pending », « planned »), titres « Cmd #12 » et « Liv #34 » (MCAL-01, MOB-01, MOB-02).

**Écran cible**

- **En-tête :** « Calendrier » + navigation « ‹ octobre 2026 › » + bouton « Aujourd'hui » + bouton « Nouveau ▾ » (« Commande fournisseur », « Livraison ») pour qui a le droit. Le mois n'apparaît qu'une fois. (CAL-01, CAL-08)
- **Bandeau « Ce mois-ci »** au-dessus de la grille, dans le flux de la page (plus de panneau flottant) : « 18 livraisons reçues », « 42 palettes reçues », « 15 colis reçus », « 6 commandes en attente (toutes dates) », avec des chiffres corrigés. (CAL-10, CAL-11, DASH-42, DASH-26)
- **Légende** générée à partir des mêmes réglages que la grille : types (commande, livraison, publicité) et états. (CAL-06)
- **Grille :** chaque élément sur une ligne lisible (14 px) : icône de type de 14 px, nom du fournisseur, « 3 palettes » ; le fond porte la couleur d'état de P1 § 3.3. Trois éléments par jour, puis « + 2 autres ». Les jours des mois voisins sont remplis. (CAL-07, CAL-05)
- **Clic sur un jour** (ou sur « + 2 autres ») : panneau latéral « Journée du 12/10 » qui liste tout, avec les commentaires en clair et un bouton par élément (« Voir la fiche », « Valider la réception »). Plus de fenêtres imbriquées. La création passe par « Nouveau ▾ » ou un « + » toujours visible dans la case, seulement pour qui a le droit. (CAL-14, CAL-08, CAL-13)
- **États :** squelette de grille au premier chargement ; au changement de mois, la grille reste affichée avec une mention « Mise à jour… » et les mois voisins sont préchargés ; « Impossible de charger le calendrier — Réessayer » en cas de panne. (CAL-04, CAL-16)
- **Téléphone :** sous chaque jour, de petites pastilles chiffrées par type (icône et nombre) au lieu des seuls points de couleur ; la liste du jour choisi s'affiche dessous, avec le fournisseur en titre, les statuts en français et des cartes cliquables (fiche, « Valider la réception »). (MCAL-01, MOB-01, MOB-02)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Création rapide (au clic dans la case) | Nouveau ▾ : Commande fournisseur · Livraison |
| P · C | palettes · colis |
| Statistiques du mois (panneau flottant) | Ce mois-ci (bandeau) |
| Palettes (somme mélangée) · Colis (= nombre de livraisons) | Palettes reçues · Colis reçus |
| Commandes en attente (sous « du mois ») | Commandes en attente (toutes dates) |
| Cmd #12 · Liv #34 (mobile) | Lactalis · commande · Lactalis · livraison |
| pending · planned · delivered (mobile) | En attente · Planifiée · Livrée |

**Gains et effort**

- Le calendrier se lit de loin ; plus de fenêtre ouverte par erreur ; les chiffres du mois sont justes et ne cachent plus rien.
- **D'abord (S)** : navigation de mois (CAL-01) ; date prévue dans « +N autres » (CAL-13) ; légende générée (CAL-06) ; plus de création au clic dans la case (CAL-08) ; statuts en français sur téléphone (MCAL-01).
- **Refonte : M** (grille, panneau du jour, bandeau). Prérequis serveur : calcul correct des palettes et colis (CAL-11, M).

---

### 9. Rapprochement BL / factures — `/bl-reconciliation` (PC, tablette et téléphone)

**Pour qui :** admin et directeurs ; manager selon D3 (proposition : non).
**Objectif :** vérifier que chaque livraison reçue a sa facture, au bon montant, puis la valider.
**Tâches principales :**
1. Voir les livraisons à rapprocher et comprendre ce qui manque.
2. Compléter le n° de facture, le montant et l'échéance, puis valider.
3. Relancer le fournisseur ou envoyer la facture PDF au service de traitement.
4. Commenter un écart.

**Ce qui gêne aujourd'hui**

- **Tableau de 10 colonnes et jusqu'à 6 boutons-icônes par ligne**, sans texte, expliqués seulement au survol (invisible au toucher) ; les coches rouge et verte ne disent pas pourquoi une facture est introuvable (RAPPRO-14).
- **Les deux onglets ne se lisent pas pareil** : ordre des colonnes différent, écart en euros avec un seuil de 10 € d'un côté, en pourcentage avec un seuil de 5 % de l'autre ; « Date Livr. » affiche la date prévue (RAPPRO-15).
- **Jargon** : « Rapprochement Manuel », « AUTO », « Ref. Facture », « Montant Fact. », « webhook », « workflow », adresse technique affichée ; compteurs en double (RAPPRO-18).
- **Blocages** : « Valider » reste grisé avec une consigne impossible à suivre quand le magasin n'a pas de vérification automatique ; une erreur technique du service de factures est mémorisée des heures comme « facture introuvable » (RAPPRO-13, NOCO-01 annexe 03).
- **Envoi de facture** : la fenêtre d'attente ne se ferme jamais si le service ne répond pas ; annuler le choix du fichier affiche une erreur rouge ; le libellé « Facture/Avoir » promet un envoi d'avoir qui n'existe pas (RAPPRO-04, RAPPRO-28).
- **Messages et confirmations** : erreurs en JSON anglais, confirmations natives du navigateur, commentaires signés par l'adresse e-mail ; « Voir les détails » ouvre en fait une modification, commentaires gérés à deux endroits (RAPPRO-16, RAPPRO-27, RAPPRO-26).
- **Lenteur et perte de place** : « Chargement... » en pleine page, vérifications en rafale à chaque ouverture, retour en page 1 après chaque validation, double clic = double envoi (RAPPRO-11, RAPPRO-02, RAPPRO-20).
- **Incohérences** : les livraisons des fournisseurs en rapprochement automatique validées ailleurs n'apparaissent dans aucun onglet ; la page parle des managers alors que le menu et le serveur les excluent ; sur téléphone, le tableau de 900 px est servi tel quel (RAPPRO-12, RAPPRO-17, RAPPRO-19).

**Écran cible**

- **En-tête :** « Rapprochement BL / factures » + bouton secondaire « Vérifier les factures » ; pour l'admin, « Envoyer un bon à payer (BAP) » (déplacé depuis le menu, P1 § 2.1). Une ligne d'aide discrète remplace l'encadré technique. (RAPPRO-18)
- **Deux onglets, seul endroit où figurent les compteurs :** « À traiter (23) » et « Validées ». Dans « À traiter », des puces pour isoler « À compléter », « Facture introuvable », « Facture trouvée – à valider », « Écart ». (RAPPRO-18)
- **Filtres :** recherche « Fournisseur, n° de BL ou de facture ».
- **Même tableau dans les deux onglets, 8 colonnes d'information au lieu de 9, plus l'action :** Livrée le (vraie date de livraison) · Fournisseur · N° BL · Montant BL · N° facture · Montant facture · Écart (« + 8,00 € (1,2 %) », une seule règle de couleur : 0 en gris, sous le seuil en ambre, au-dessus en rouge) · État (« À compléter », « Facture introuvable », « Facture trouvée – à valider », « Rapprochée », « Validée automatiquement »). L'échéance passe dans la fiche ; la colonne Magasin n'apparaît qu'en « Tous les magasins ». (RAPPRO-15, RAPPRO-18)
- **Une action texte par ligne :** « Valider » quand la facture est trouvée ; « Compléter » quand il manque des données (ouvre la fiche) ; sans vérification automatique, « Valider » reste possible avec la confirmation « Valider sans vérification automatique ? ». Le badge « Facture introuvable » s'ouvre au toucher et explique la raison en français, avec « Revérifier ». Menu « ⋯ » : « Relancer le fournisseur » (avec « Dernière relance le 02/10 » ; montant au format français dans le mail, MAIL-02), « Envoyer la facture (PDF) », « Commentaires (2) », « Modifier », « Dévalider » (dans « Validées », avec confirmation), « Supprimer » (admin). Le bouton est désactivé pendant l'envoi. (RAPPRO-14, RAPPRO-13, RAPPRO-20)
- **Fiche** (panneau latéral), titre « Facture Lactalis — BL 4512 » : lecture seule pour une ligne validée, avec un bouton « Modifier » explicite ; champs N° BL, Montant BL, N° facture, Montant facture, Échéance ; changer le n° de facture n'efface plus une échéance saisie à la main ; commentaires à un seul endroit, signés « Marie Dupont », modifiables par leur auteur ou l'admin. (RAPPRO-26, RAPPRO-27, RAPPRO-07)
- **Envoi de la facture PDF :** zone de dépôt qui affiche le nom et la taille du fichier ; annuler le choix ne fait rien ; message « Envoi au service de traitement des factures… » ; délai maximal, puis « Le traitement prend plus de temps que prévu ; vérifiez la ligne avant de renvoyer », avec un bouton « Continuer en arrière-plan ». (RAPPRO-04, RAPPRO-28)
- **« Vérifier les factures »** ne revérifie que les lignes rouges ou non vérifiées, affiche une progression (« 12 / 40 vérifiées ») puis un bilan unique. (RAPPRO-22)
- **États :** squelette du tableau ; erreurs en français ; on reste sur la même page après une validation ; les livraisons rapprochées automatiquement apparaissent dans « Validées ». (RAPPRO-11, RAPPRO-16, RAPPRO-20, RAPPRO-12)
- **Tablette et téléphone :** cartes avec fournisseur, montants, écart, état et bouton principal ; fiche sur une colonne. (RAPPRO-19)
- **Accès :** une seule règle (D3), texte de la page corrigé : « Réservé aux directeurs et administrateurs ». (RAPPRO-17)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Rapprochement Manuel · Livraisons Validées | À traiter · Validées |
| AUTO | Validée automatiquement |
| Date Livr. | Livrée le |
| Ref. Facture · Montant Fact. | N° facture · Montant facture |
| Écart « 8 € » (un onglet) · « 1,2 % » (l'autre) | + 8,00 € (1,2 %) |
| Envoyer Facture/Avoir | Envoyer la facture (PDF) |
| webhook · workflow · adresse technique | Envoi au service de traitement des factures… |
| coche verte · coche rouge · coche grise | Facture trouvée – à valider · Facture introuvable · À compléter |
| « Validation impossible : veuillez d'abord vérifier la facture en cliquant sur l'icône de recherche » | « Compléter » ou « Valider sans vérification automatique ? » selon le cas |
| 403: {"message":"Only comment author or admin can edit comments"} | Seul l'auteur du commentaire peut le modifier |
| auteur « marie@… » | Marie Dupont |

**Gains et effort**

- Le directeur sait pour chaque ligne ce qui manque et quoi faire ; plus d'écran bloqué pendant un envoi ; les deux onglets se lisent pareil.
- **D'abord (S)** : délai maximal et sortie de la fenêtre d'attente (RAPPRO-04) ; annulation du choix de fichier (RAPPRO-28) ; validation possible sans vérification automatique (RAPPRO-13) ; libellés (RAPPRO-18) ; page conservée après validation (RAPPRO-20).
- **Refonte : L**, à découper en trois lots : tableau commun aux deux onglets et menu « ⋯ » (M) ; fiche et commentaires (M) ; version cartes pour tablette et téléphone (M).

---

### 10. Avoirs — `/avoirs` (PC et téléphone)

**Pour qui :** admin et directeurs (gestion complète), managers (consultation et création) ; employé selon D2 (proposition : masqué).
**Objectif :** suivre chaque avoir demandé à un fournisseur jusqu'à sa réception et sa validation en comptabilité.
**Tâches principales :**
1. Créer une demande d'avoir.
2. La faire avancer : demandé, puis reçu.
3. Vérifier que la facture d'avoir existe en comptabilité, puis valider.
4. Envoyer le PDF de l'avoir reçu et consulter l'historique.

**Ce qui gêne aujourd'hui**

- **Le flux principal se contredit** : un badge vert « Validé » s'affiche dès que la facture est trouvée, à côté d'un bouton « Valider » ; l'avoir ne passe jamais dans « Finalisés » (AVOIRS-05).
- **Le statut se change dans un menu déroulant posé dans chaque ligne**, sans confirmation, alors que « Reçu » déclenche un envoi vers un système externe ; la même ligne affiche parfois « Lecture seule » (AVOIRS-06, AVOIRS-18).
- **Jusqu'à 5 boutons-icônes de couleurs différentes par ligne** et une loupe de 16 px ; « Valider » est proposé à des rôles que le serveur refuse ; l'envoi du PDF est impossible pour un directeur (AVOIRS-07, AVOIRS-10, AVOIRS-04).
- **Lisibilité** : onglet « Finalisés » entièrement grisé, compteurs affichés trois fois, « #Sans référence », « 12.50 € », messages en jargon (NocoDB, webhook) ou en anglais (« Failed to create avoir ») (AVOIRS-08, AVOIRS-16, AVOIRS-17, AVOIRS-09).
- **Formulaire** jamais remis à zéro, magasin par défaut qui ignore le magasin choisi ; la liste ne se met pas à jour après « Valider » (AVOIRS-12, AVOIRS-03).
- **« Vérifier toutes »** produit une rafale de requêtes et autant de messages, et ferme la fenêtre de modification ; la page vérifie chaque avoir à chaque ouverture (AVOIRS-02, AVOIRS-01).
- **Téléphone** : liste vide en « Tous les magasins » ; suppression d'un simple toucher, sans confirmation, proposée à tous ; menu de statut qui n'indique pas l'état actuel ; montant forcé à 0 € et erreurs invisibles ; mots, couleurs et statuts différents du PC (MOB-AVOIRS-01, MOB-AVOIRS-02, MOB-AVOIRS-03, MOB-AVOIRS-05, MOB-AVOIRS-06, MOB-AVOIRS-09).

**Écran cible**

- **En-tête :** « Avoirs » + « Nouvelle demande d'avoir ».
- **Onglets, seul endroit des compteurs :** « En cours (8) » et « Finalisés ». Dans « En cours », des puces « À demander », « Demandés », « Reçus – à valider ». (AVOIRS-16)
- **Filtres :** recherche « Fournisseur ou n° de facture d'avoir ».
- **Tableau, 6 colonnes d'information au lieu de 7, plus l'action :** Fournisseur · N° de facture d'avoir (« — » si vide) · Montant (« 12,50 € », à droite) · Statut (« À demander », « Demandé », « Reçu ») · Vérification (« Non vérifié », « Facture trouvée – à valider », « Validé ») · Créé le. Colonne « Magasin » seulement en « Tous les magasins ». La loupe et la colonne d'actions colorées disparaissent. (AVOIRS-05, AVOIRS-17)
- **Une action « étape suivante » par ligne, avec du texte :** à demander → « Marquer comme demandé » ; demandé → « Marquer comme reçu » (confirmation : « L'avoir sera transmis au service de traitement des factures. ») ; reçu et non vérifié → « Vérifier » ; facture trouvée → « Valider » (admin et directeur). Menu « ⋯ » : « Envoyer le PDF » (selon D2 ; même fenêtre d'attente que le rapprochement, impossible à fermer par erreur pendant l'envoi, AVOIRS-20), « Modifier », « Dévalider » (confirmation), « Supprimer » (confirmation). Plus de menu déroulant de statut dans la ligne, plus de « Lecture seule ». (AVOIRS-06, AVOIRS-07, AVOIRS-10, AVOIRS-04, AVOIRS-18)
- **« Vérifier tout »** (bouton secondaire de l'onglet « En cours ») : progression puis un seul message de bilan, sans fermer de fenêtre. (AVOIRS-02)
- **Onglet « Finalisés » :** lignes en texte normal, le badge « Validé » suffit. (AVOIRS-08)
- **Formulaire :** Fournisseur* (avec recherche) · Magasin (le magasin actif ; liste obligatoire en « Tous les magasins ») · N° de facture d'avoir · Montant (vide par défaut) · Motif. Remis à zéro à chaque ouverture ; erreurs sous les champs. (AVOIRS-12, MOB-AVOIRS-05, MOB-AVOIRS-06)
- **États :** squelette ; erreurs traduites ; vide par onglet ; la liste se met à jour après chaque action. (AVOIRS-09, AVOIRS-03)
- **Téléphone :** mêmes onglets, mêmes libellés et couleurs ; cartes avec le bouton « étape suivante » ; suppression réservée à l'admin et au directeur, avec confirmation et message en cas d'échec ; état « Choisissez un magasin », ou liste de tous les magasins autorisés ; dates avec l'année. (MOB-AVOIRS-09, MOB-AVOIRS-03, MOB-AVOIRS-02, MOB-AVOIRS-01)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Gestion des Avoirs (PC) · Suivi des Avoirs (mobile) | Avoirs |
| En attente de demande (PC) · En attente (mobile) | À demander |
| « Validé » quand la facture est seulement trouvée · « Vérifié Compta » | Facture trouvée – à valider |
| Lecture seule | supprimé |
| #Sans référence | — |
| 12.50 € | 12,50 € |
| Réf. Facture · Référence facture (optionnel) | N° de facture d'avoir |
| Commentaire / Raison | Motif |
| NocoDB · webhook (dans les messages) | comptabilité · service de traitement des factures |
| Failed to create avoir · 403: {"message":…} | Impossible de créer la demande d'avoir · Vous n'avez pas les droits pour cette action |

**Gains et effort**

- Un avoir ne peut plus avoir l'air validé sans l'être ; un seul bouton dit quoi faire ensuite ; plus de suppression ni d'envoi externe par accident.
- **D'abord (S)** : trois états de vérification distincts (AVOIRS-05) ; rafraîchissement après validation (AVOIRS-03, *fait par le lot 1*) ; bouton « Valider » selon le rôle (AVOIRS-10) ; liste et suppression sur téléphone (MOB-AVOIRS-01, MOB-AVOIRS-02).
- **Refonte : M.** Prérequis serveur : envoi du PDF par le serveur (AVOIRS-04, M), règles métier vérifiées côté serveur (AVOIRS-API-07), modification qui n'efface plus les champs non envoyés (AVOIRS-API-06).

---

### 11. Échéancier — `/payment-schedule` (PC et téléphone)

**Pour qui :** admin et directeurs.
**Objectif :** savoir quelles factures fournisseurs payer ce mois-ci, pour quel montant et par quel moyen.
**Tâches principales :**
1. Choisir le mois.
2. Lire le total à payer et la répartition par mode de paiement.
3. Exporter la liste pour Excel.

**Ce qui gêne aujourd'hui**

- **Montants faux ou difficiles à lire** : le TTC vaut souvent « 0.00 € » à cause d'un défaut serveur, et les montants s'écrivent « 1234.50 € » (ECHE-02, ECHE-05).
- **Changer de mois** oblige à parcourir une liste de 25 mois, sans flèches ; le filtre par mode de paiement n'existe que dans l'export ; « CSV » et « Excel » sont mélangés (ECHE-04, ECHE-07).
- **En-tête hors charte** (grand titre, icône dollar), carte « Période » qui répète le mois, ligne de titre qui déborde sur téléphone (ECHE-04).
- **Chargement** : un spinner remplace toute la page, en-tête compris, à chaque changement de magasin ; un refus d'accès s'affiche comme une erreur générique ; c'est l'une des pages les plus lentes de l'application (ECHE-06, ECHE-01).
- **Inaccessible depuis le menu du téléphone** (SHELL-10).

**Écran cible**

- **En-tête :** « Échéancier » (icône euro) + « Exporter pour Excel ».
- **Navigation de mois :** « ‹ octobre 2026 › » + « Ce mois-ci ». (ECHE-04)
- **Résumé en 3 cartes** (la carte « Période » disparaît) : « À payer ce mois : 12 345,60 € TTC (10 288,00 € HT) » · « Prochaine échéance : 05/10, Lactalis, 1 230,00 € » · « Par mode de paiement » (Virement, Traite, Traite magnétique, Chèque ; chaque ligne est cliquable et filtre le tableau). (ECHE-04, ECHE-07)
- **Filtres :** puces par mode de paiement et recherche « Fournisseur », reprises automatiquement par l'export. (ECHE-07)
- **Tableau :** Échéance · Fournisseur · N° facture · Mode de paiement · Montant HT · Montant TTC (« — » s'il est inconnu, jamais « 0,00 € » par défaut), montants alignés à droite au format français, ligne de total en bas. (ECHE-05, ECHE-02)
- **États :** squelette des cartes et du tableau sous l'en-tête, qui reste en place ; « Cette page est réservée aux directeurs et administrateurs » pour un refus d'accès ; message spécifique si le magasin est introuvable ; vide : « Aucune facture à payer en octobre ». (ECHE-06)
- **Téléphone :** page accessible depuis « Menu » ; cartes « 05/10 · Lactalis · 1 230,00 € TTC · Virement ». (SHELL-10)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Échéance (menu) | Échéancier |
| icône dollar | icône euro |
| Exporter CSV · Excel | Exporter pour Excel |
| 1234.50 € | 1 234,50 € |
| 0.00 € (TTC inconnu) | — |
| carte « Période » | remplacée par « Prochaine échéance » |

**Gains et effort**

- Des montants justes et lisibles ; on voit tout de suite les virements ou les traites à préparer.
- **D'abord (S)** : écriture du TTC (ECHE-02, côté serveur) ; format des montants (ECHE-05) ; en-tête standard et flèches de mois (ECHE-04).
- **Refonte : S à M.** Prérequis serveur : calcul de l'échéancier sans relire toute la base (ECHE-01, M, traité avec les performances).

---

### 12. Publicités — `/publicities` (PC et téléphone)

**Pour qui :** tous en consultation ; création et modification par l'admin.
**Objectif :** savoir quelles promotions sont en cours et à venir, et si mon magasin y participe.
**Tâches principales :**
1. Voir les publicités en cours et à venir.
2. Ouvrir le détail : dates, magasins participants.
3. Exporter la liste de l'année.
4. Admin : créer, modifier, supprimer une publicité.

**Ce qui gêne aujourd'hui**

- **En-tête de 7 contrôles** sur une ligne, dont des icônes Liste/Grille sans nom (PUB-21, PUB-27).
- **La grille annuelle de 12 colonnes s'affiche par défaut avant la liste**, avec des informations visibles au survol seulement et une légende sans noms de magasins ; la vue calendrier ne montre que des numéros et double la page Calendrier (PUB-24, PUB-25).
- **Liste** sans recherche ni filtre de statut, lignes non cliquables, « N° PUB » ; la colonne « Créé par » affiche toujours « Utilisateur » (PUB-23, PUB-03).
- **Données fausses** : le sélecteur de magasin n'a aucun effet ; statuts et calendrier décalés d'un jour ; numéros de semaine faux certaines années (PUB-01, PUB-09, PUB-10).
- **États** : pendant le chargement, les compteurs valent 0 ; une panne affiche « Aucune publicité… Commencez par créer… », y compris aux non-admins (PUB-14, PUB-13).
- **Formulaire et tableau** : tableau coupé sur tablette, fenêtre sans hauteur maximale (boutons hors de l'écran), année saisie à la main, erreurs qui restent affichées, magasins à cocher un par un, messages serveur en anglais (PUB-22, PUB-31, PUB-19, PUB-20, PUB-18).
- **Téléphone** : bouton « + » visible par tous et qui ne fait rien ; liste vide sans magasin choisi ; ni détail ni magasins participants ; tri par numéro ; badges différents du PC (PUB-11, PUB-12, PUB-33, PUB-26).

**Écran cible**

- **En-tête :** « Publicités » + « Nouvelle publicité » (admin) + menu « ⋯ » avec « Exporter pour Excel ».
- **Barre de filtres :** année « ‹ 2026 › », recherche « N° ou désignation », onglets texte « Liste » et « Année ». La vue « calendrier » disparaît au profit d'un lien « Voir dans le calendrier » (page Calendrier). (PUB-21, PUB-25, PUB-27)
- **Liste par défaut, groupée** en « En cours », « À venir », « Terminées » (repliée). Les trois compteurs servent de raccourcis vers ces groupes. (PUB-23, PUB-24)
- **Tableau, 4 colonnes d'information au lieu de 6 (plus les actions pour l'admin) :** Désignation (avec « Pub n° 2541 » en dessous) · Période (« du 12/10 au 18/10/2026 ») · Statut (« En cours », « À venir », « Terminée ») · Magasins (pastilles avec nom au survol, « Tous les magasins », et la mention « Votre magasin participe »). Colonne « Créé par » retirée (le vrai nom figure dans le détail). Ligne cliquable vers le détail. Défilement horizontal si besoin. (PUB-23, PUB-03, PUB-22)
- **Onglet « Année » :** semaines numérotées selon la norme française, cliquables pour filtrer la liste ; légende avec le nom de chaque magasin ; pastilles d'au moins 8 px. (PUB-24, PUB-10)
- **Actions admin :** menu « ⋯ » par ligne : « Modifier », « Supprimer » (confirmation qui nomme la publicité).
- **Formulaire** (`FormDialog` à hauteur maximale) : N°* · Désignation* · Date de début* · Date de fin* (l'année est déduite des dates) · Magasins participants avec « Tous » et « Aucun ». Messages en français (« Ce numéro de publicité existe déjà »). (PUB-19, PUB-20, PUB-31, PUB-18)
- **États :** squelette (jamais de 0 provisoire) ; « Impossible de charger les publicités — Réessayer » ; vide adapté au rôle : « Aucune publicité pour 2026 » (et « Créer une publicité » pour l'admin seulement). (PUB-14, PUB-13, PUB-26)
- **Téléphone :** mêmes groupes, en cours en premier ; toucher une carte ouvre le détail avec les magasins participants ; « + » masqué tant que la création n'existe pas sur téléphone, puis réservé à l'admin ; liste chargée même sans magasin choisi ; même badge qu'au PC. (PUB-11, PUB-12, PUB-33, PUB-26)

**Libellés à renommer**

| Avant | Après |
|---|---|
| N° PUB | Pub n° 2541 (sous la désignation) |
| icônes Liste / Grille + « Vue d'ensemble » | onglets « Liste » et « Année » |
| Exporter CSV | Exporter pour Excel |
| Créé par : Utilisateur · admin_local · manual_… | colonne retirée ; vrai nom dans le détail |
| « Aucune publicité… Commencez par créer… » (non-admin) | Aucune publicité pour 2026 |
| Survolez les semaines pour voir les détails | Cliquez sur une semaine pour voir ses publicités |
| messages serveur en anglais | « Ce numéro de publicité existe déjà », « Vous n'avez pas les droits pour cette action » |

**Gains et effort**

- La question « qu'est-ce qui est en promo maintenant chez moi ? » trouve sa réponse en haut de la page, sur PC comme sur téléphone ; les dates sont justes.
- **D'abord (S)** : retirer le « + » inopérant (PUB-11) ; défilement du tableau (PUB-22) ; décalage d'un jour (PUB-09) ; filtre par magasin côté serveur (PUB-01) ; nom du créateur (PUB-03).
- **Refonte : M.**

---

### 13. Contacts — `/contacts` (PC et téléphone)

**Pour qui :** tous en consultation ; gestion des contacts du magasin à partir de manager.
**Objectif :** trouver en quelques secondes le téléphone d'un fournisseur ou d'un dépanneur, et l'appeler.
**Tâches principales :**
1. Chercher un contact ou un fournisseur.
2. L'appeler ou lui écrire.
3. Ajouter ou modifier un contact du magasin.

**Ce qui gêne aujourd'hui**

- **Les employés restent bloqués** sur « Sélectionnez un magasin pour voir les contacts », sans moyen d'en choisir un (CONT-04).
- **Après un ajout, une modification ou une suppression, la liste ne change pas**, et le magasin du contact est écrasé à l'enregistrement (CONT-01, CONT-05).
- **Un second sélecteur de magasin**, propre à la page, contredit celui de l'en-tête ; « Nouveau contact » disparaît en « Tous les magasins » sans explication (CONT-06).
- **« Aucun contact » s'affiche pendant le chargement**, et aucune erreur n'est signalée (CONT-07).
- **Sur téléphone**, la liste complète des fournisseurs passe avant les contacts du magasin, et la page n'est ni dans le menu mobile ni dans le cadre mobile (CONT-08, CONT-09).
- **Les fiches fournisseurs se modifient ici et dans Fournisseurs**, avec des droits différents ; les notes se saisissent sur une seule ligne (SUPP-01, SUPP-02, CONT-11).

**Écran cible**

- **En-tête :** « Contacts » + « Nouveau contact » (managers et plus).
- **Une recherche unique :** « Nom, entreprise ou téléphone », qui cherche dans les deux listes.
- **Onglets :** « Contacts du magasin (8) » (par défaut) et « Fournisseurs (120) ». (CONT-08)
- **Liste compacte :** nom, fonction et entreprise ; deux boutons bien visibles « Appeler » et « Écrire » ; notes repliées sous « Voir les notes ». Les fournisseurs sont en lecture seule, avec un lien « Modifier la fiche » vers Fiches fournisseurs pour l'admin et le directeur (D10). (SUPP-01, SUPP-02)
- **Magasin :** seul le sélecteur de l'en-tête compte ; l'employé a son magasin présélectionné ; en « Tous les magasins », chaque contact porte le nom de son magasin et le formulaire demande le magasin. (CONT-04, CONT-06, CONT-05)
- **Actions par contact :** menu « ⋯ » « Modifier », « Supprimer » (confirmation qui nomme le contact).
- **Formulaire :** Nom* · Entreprise · Fonction · Téléphone · E-mail · Magasin (affiché, ou liste en « Tous les magasins ») · Notes (zone de texte de 3 lignes). En modification, le magasin du contact est conservé. (CONT-11, CONT-05)
- **États :** squelette de cartes ; erreur avec « Réessayer » ; vide : « Aucun contact pour ce magasin », avec « Nouveau contact » si autorisé ; la liste se met à jour après chaque action. (CONT-07, CONT-01)
- **Téléphone :** page présente dans « Menu », affichée dans le cadre mobile ; mêmes onglets ; boutons « Appeler » de 44 px. (CONT-09)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Fournisseurs et contacts par magasin | Contacts |
| Autres contacts | Contacts du magasin |
| Sélectionnez un magasin pour voir les contacts | magasin présélectionné ; sinon « Choisissez un magasin en haut de l'écran » |
| Fonction / Rôle | Fonction |
| Notes (une ligne) | Notes (zone de texte) |

**Gains et effort**

- L'annuaire devient l'outil de poche qu'il devrait être : ouvert depuis le téléphone, un numéro trouvé et appelé en trois gestes.
- **D'abord (S)** : rafraîchissement de la liste (CONT-01, *fait par le lot 1*) ; présélection du magasin pour l'employé (CONT-04) ; états de chargement et d'erreur (CONT-07) ; page dans le menu mobile (CONT-09).
- **Refonte : M.** Prérequis serveur : contrôle du magasin à la création et à la modification, et plus de contacts de tous les magasins pour un compte sans magasin (CONT-03, CONT-02).

---

### 14. Fiches fournisseurs — `/suppliers`

**Pour qui :** admin ; directeur selon D10 (proposition : modification autorisée).
**Objectif :** tenir à jour la liste des fournisseurs et leurs réglages (suivi DLC, contrôle à réception, rapprochement automatique, mode de paiement).
**Tâches principales :**
1. Retrouver un fournisseur.
2. Créer ou modifier une fiche et ses options.
3. Retirer un fournisseur qui n'est plus utilisé.

**Ce qui gêne aujourd'hui**

- **Grille de grosses cartes** peu adaptée à plus de 100 fournisseurs : ni tri, ni filtre par option, recherche sur le nom seulement (SUPP-05).
- **Informations mal choisies** : identifiant technique `#12` affiché, code fournisseur saisi mais jamais affiché, libellé « Code fournisseur API (liaison ffnancy) » incompréhensible, options sans explication (SUPP-06).
- **Suppression impossible dès qu'il y a un historique**, avec un message générique après confirmation ; erreurs de saisie non expliquées (SUPP-03, SUPP-04).
- **Une panne s'affiche « Commencez par créer votre premier fournisseur »** (SUPP-07).
- **Doublon avec Contacts** et droits différents selon l'écran (SUPP-01, SUPP-02).
- **Compteurs « Commandes / Livraisons »** ambigus (depuis toujours, tous magasins) ; icônes sans nom, textes gris clair ; pas de cadre mobile (SUPP-11, SUPP-12, CONT-09).

**Écran cible**

- **En-tête :** « Fiches fournisseurs » + « Nouveau fournisseur ».
- **Filtres :** recherche « Nom, contact, e-mail ou code » ; puces « Suivi DLC », « Contrôle à réception », « Rapprochement automatique », « Archivés ». (SUPP-05)
- **Tableau triable** (remplace la grille) : Nom (avec « Code : FOU01 » en dessous) · Contact · Téléphone · E-mail · Options (badges en toutes lettres) · Mode de paiement · Commandes (« 34 sur 12 mois », pour le magasin actif). L'identifiant `#12` disparaît. (SUPP-05, SUPP-06, SUPP-11)
- **Actions :** clic sur la ligne = fiche en modification ; menu « ⋯ » : « Archiver » (le fournisseur disparaît des listes de choix mais garde son historique), « Supprimer » (désactivé s'il y a un historique, avec l'infobulle « 34 commandes liées : archivez-le plutôt »). (SUPP-03)
- **Formulaire :** Nom* · Contact · Téléphone · E-mail · Mode de paiement · « Code fournisseur (catalogue articles) » avec une phrase d'aide · trois options, chacune avec une ligne d'explication : « Suivi DLC : ce fournisseur est proposé dans la saisie des DLC » ; « Contrôle à réception : un avertissement s'affiche à la validation de ses livraisons » ; « Rapprochement automatique : ses livraisons sont rapprochées dès la saisie du BL ». Erreurs du serveur affichées en clair. (SUPP-06, SUPP-04)
- **États :** squelette (déjà présent) ; « Impossible de charger les fournisseurs — Réessayer » ; vide réel seulement après un chargement réussi. (SUPP-07)
- **Téléphone :** page affichée dans le cadre mobile, tableau en cartes. (CONT-09)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Fournisseurs (menu) | Fiches fournisseurs |
| #12 | Code : FOU01 |
| Code fournisseur API (liaison ffnancy) | Code fournisseur (catalogue articles) |
| DLC · Contrôle requis · Auto-rapprochement | Suivi DLC · Contrôle à réception · Rapprochement automatique |
| Commandes : 34 · Livraisons : 30 | 34 commandes sur 12 mois |
| « Commencez par créer votre premier fournisseur » (sur une panne) | Impossible de charger les fournisseurs — Réessayer |

**Gains et effort**

- Retrouver un fournisseur ou lister « ceux à contrôler » prend une seconde ; un seul endroit pour modifier une fiche ; plus d'échec de suppression inexpliqué.
- **D'abord (S)** : état d'erreur (SUPP-07) ; noms des boutons et contraste (SUPP-12) ; code affiché à la place de `#id` (SUPP-06).
- **Refonte : M.** Prérequis serveur : statut « archivé » et refus explicite de la suppression (SUPP-03, M) ; règle de droits unique (SUPP-02).

---

### 15. Statistiques — `/analytics` (PC et téléphone)

**Pour qui :** managers, directeurs, admin ; employé selon D4 (proposition : non).
**Objectif :** suivre l'activité sur une période : commandes, livraisons, montants, fournisseurs principaux.
**Tâches principales :**
1. Choisir une période.
2. Filtrer sur un fournisseur.
3. Lire les chiffres clés et les graphiques.
4. Exporter pour Excel.

**Ce qui gêne aujourd'hui**

- **Toute la page disparaît derrière un spinner** à chaque changement de filtre ; « Aucune donnée » s'affiche pendant le chargement ; aucune erreur n'est signalée (ANA-01, ANA-18).
- **Chiffres faux** : « Montant total » additionne BL et facture ; le taux de rapprochement compte aussi les livraisons pas encore reçues (ANA-04, ANA-23).
- **Filtres trompeurs** : fausse multi-sélection, graphiques qui ignorent certains filtres, magasin de l'en-tête ignoré (ANA-13, ANA-14).
- **Graphiques illisibles** : 365 points par défaut, axe en « 2026-45 », camembert dont l'infobulle affiche 0, 1, 2 au lieu du nom (ANA-11, ANA-12).
- **Jargon** : « Tableau de bord Analytics » alors que le menu dit « Statistiques », « Granularité », « Taux de réconciliation », bouton « Temps réel / Actualisé » ; montants non formatés, sans HT ni TTC ; calendriers en anglais (ANA-15, ANA-19, ANA-16).
- **Exports** en double, fichier illisible dans Excel français, échecs silencieux (ANA-17).
- **Téléphone** : en-tête qui déborde, aucune navigation (ANA-22).

**Écran cible**

- **En-tête :** « Statistiques » + un seul bouton « Exporter pour Excel ▾ » + « Actualiser » avec l'heure de la dernière mise à jour (plus de rafraîchissement automatique). (ANA-17, ANA-19)
- **Période :** puces « Ce mois », « Mois dernier », « 3 derniers mois », « Cette année », plus « Personnaliser » (un seul calendrier en français pour choisir début et fin, semaine commençant le lundi, contrôle début ≤ fin). (ANA-16)
- **Filtres :** « Fournisseur » en choix simple (« Tous les fournisseurs ») ; le magasin vient du sélecteur de l'en-tête, comme partout. Tous les blocs respectent tous les filtres, ou indiquent clairement qu'ils ne sont pas concernés. (ANA-13, ANA-14)
- **4 chiffres clés**, chacun avec une ligne d'aide : « Commandes », « Livraisons reçues », « Livraisons rapprochées (%) » (calculé sur les livraisons reçues), « Montant des factures (HT) ». (ANA-15, ANA-04, ANA-23)
- **Graphique d'évolution :** regroupement automatique (par jour jusqu'à 31 jours, par semaine jusqu'à 6 mois, par mois au-delà), dates lisibles (« 14 mars », « sem. 45 », « sept. 2026 »), périodes sans activité affichées à zéro, sans décalage d'un jour ni numéro de semaine faux. (ANA-11, ANA-09, ANA-10)
- **« Principaux fournisseurs » :** barres horizontales avec le nom lisible et la valeur, au lieu du camembert. (ANA-12)
- **« Par magasin »** : seulement pour les personnes qui ont plusieurs magasins, sur la période choisie. (ANA-05)
- **États :** au changement de filtre, les données restent affichées avec « Mise à jour… » ; squelette par carte au premier chargement ; « Impossible de charger — Réessayer » par carte ; « Aucune donnée sur cette période » seulement après un chargement réussi. (ANA-01, ANA-18)
- **Téléphone :** page dans le cadre mobile ; chiffres clés empilés, graphiques en pleine largeur. (ANA-22)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Tableau de bord Analytics | Statistiques |
| Granularité | Regroupement automatique (ou « Regrouper par ») |
| Taux de réconciliation | Livraisons rapprochées (%) |
| Montant total | Montant des factures (HT) |
| Temps réel · Actualisé | Actualiser · mis à jour à 10:42 |
| 2026-45 | sem. 45 |
| Fournisseurs ✓ (fausse sélection multiple) | Fournisseur : Tous |
| deux boutons « Export CSV » | Exporter pour Excel ▾ |

**Gains et effort**

- Des chiffres justes, compréhensibles sans formation, qui ne disparaissent plus à chaque clic.
- **D'abord (S)** : garder la page affichée au changement de filtre (ANA-01, *fait par le lot 1*) ; montant total et taux corrigés (ANA-04, ANA-23) ; nom dans le camembert (ANA-12) ; calendriers en français (ANA-16) ; magasin de l'en-tête (ANA-14).
- **Refonte : M.** Prérequis serveur : export lisible par Excel français (ANA-17) et filtrage par rôle et par magasin de tous les blocs (ANA-05, ANA-06).

---

### Administration

Les pages qui suivent ne servent qu'à l'admin. (Les fiches fournisseurs, rangées dans la section Administration du menu, sont traitées plus haut, au § 14, à cause de leur lien avec Contacts.) Elles doivent rester compréhensibles par un admin qui n'est pas informaticien : un réglage technique est toujours rangé derrière une section « Avancé » et expliqué en une phrase.

### 16. Utilisateurs — `/users`

**Pour qui :** admin ; directeur selon D5 (proposition : non).
**Objectif :** créer les comptes des équipes et leur donner le bon rôle et les bons magasins.
**Tâches principales :**
1. Retrouver un compte (nom, identifiant).
2. Créer un compte : identifiant, mot de passe, rôle, magasins.
3. Modifier un compte, changer son rôle ou ses magasins.
4. Supprimer un compte.

**Ce qui gêne aujourd'hui**

- **Le tableau montre un identifiant technique** (« ID: manual_1712_x9… ») au lieu de l'identifiant de connexion à donner à l'employé, et celui-ci n'est pas cherchable (USERS-09).
- **Le rôle apparaît deux fois par ligne** (badge et sélecteur rapide), avec deux règles différentes : la fenêtre de modification permet de changer son propre rôle sans confirmation ; « Directeur » manque dans le filtre et à la création ; rien n'explique ce que permet chaque rôle (USERS-11, USERS-08, USERS-20).
- **Les magasins s'enregistrent dès le clic dans la fenêtre**, « Annuler » ne les annule pas, et le bouton « Assigner / Retirer » ne change pas d'état, ce qui crée des doublons (USERS-07, USERS-03).
- **Confirmations peu sûres** : changement de rôle annoncé avec le code anglais (« employee ») sans nommer la personne ; suppression par la boîte native du navigateur (USERS-10, USERS-13).
- **Erreurs muettes** : le message précis du serveur (identifiant déjà utilisé…) n'est jamais affiché ; « Minimum 6 caractères » n'est vérifié nulle part ; la fenêtre reste ouverte une seconde de trop (USERS-04, USERS-18, USERS-12).
- **« Groupes » et « Magasins » alternent** ; tableau coupé sur téléphone ; spinner au lieu d'un squelette (USERS-17, USERS-14, USERS-24).

**Écran cible**

- **En-tête :** « Utilisateurs » + « Nouvel utilisateur ».
- **Filtres :** recherche « Nom, identifiant ou e-mail » ; « Rôle » (Administrateur, Directeur, Manager, Employé) ; « Magasin ». (USERS-09, USERS-08)
- **Tableau, 4 colonnes et une action :** Nom (avec « Identifiant : ff0292 » en dessous ; l'identifiant sert de titre si le nom est vide) · E-mail · Rôle (badge seul) · Magasins (noms, ou « 3 magasins » avec la liste en infobulle) · bouton « Modifier » et menu « ⋯ » « Supprimer » (confirmation : « Supprimer le compte de Marie Dupont (ff0292) ? ») ; tout bouton-icône porte un nom (« Modifier Marie Dupont »). Le sélecteur rapide de rôle disparaît de la ligne. (USERS-09, USERS-11, USERS-13, USERS-17, USERS-23)
- **Une seule fenêtre pour créer et modifier** (`FormDialog`, sections) :
  - *Identité* : Prénom, Nom, E-mail.
  - *Connexion* : Identifiant* ; Mot de passe* à la création, « Nouveau mot de passe (laisser vide pour ne pas le changer) » en modification ; 6 caractères minimum, vérifiés.
  - *Rôle* : 4 choix, chacun avec une ligne d'explication tirée de la table des droits (« Manager : commandes, livraisons, DLC, tâches ; pas de rapprochement ni de suppression »).
  - *Magasins* : cases à cocher, enregistrées avec le reste par « Enregistrer ».
  - Si le rôle change : confirmation « Passer Marie Dupont de Manager à Employé ? ». On ne peut ni modifier son propre rôle ni retirer le dernier administrateur.
  (USERS-07, USERS-03, USERS-20, USERS-10, USERS-11, USERS-18)
- **Après enregistrement :** fermeture immédiate, toast « Compte enregistré » ; en cas d'erreur, la fenêtre reste ouverte avec le message du serveur en français (« Cet identifiant est déjà utilisé »). (USERS-12, USERS-04)
- **États :** squelette de 5 lignes ; erreur avec « Réessayer ». (USERS-24)
- **Téléphone :** cartes (nom, identifiant, rôle, magasins, « Modifier »). (USERS-14)

**Libellés à renommer**

| Avant | Après |
|---|---|
| ID: manual_1712_x9… | Identifiant : ff0292 |
| Groupes (colonne et fenêtre) | Magasins |
| boutons « Assigner » / « Retirer » (enregistrement immédiat) | cases à cocher enregistrées avec le formulaire |
| « …changer le rôle en employee ? » | Passer Marie Dupont de Manager à Employé ? |
| « Supprimer l'utilisateur   ? » (boîte du navigateur, nom vide) | Supprimer le compte de Marie Dupont (ff0292) ? |
| Mettre à jour | Enregistrer |
| Nom non renseigné | l'identifiant sert de titre |

**Gains et effort**

- L'admin voit l'identifiant qu'il doit communiquer ; un seul endroit pour changer un rôle, avec une explication ; « Annuler » annule vraiment.
- **D'abord (S)** : identifiant affiché et cherchable (USERS-09) ; « Directeur » partout (USERS-08) ; libellé du rôle et nom dans la confirmation (USERS-10) ; défilement du tableau (USERS-14).
- **Refonte : M.** Prérequis serveur : enregistrement des magasins avec le compte, en une seule opération (USERS-07, USERS-05) ; garde-fous sur son propre rôle et le dernier admin (USERS-11) ; plus aucune empreinte de mot de passe envoyée au navigateur (USERS-02).

---

### 17. Magasins — `/groups`

**Pour qui :** admin uniquement (aligné sur le menu, GROUPS-01).
**Objectif :** créer un magasin et renseigner ses coordonnées ; les réglages techniques sont rangés à part.
**Tâches principales :**
1. Voir les magasins et leur état de configuration.
2. Créer un magasin, modifier ses coordonnées, son logo, sa couleur.
3. Configurer l'envoi des e-mails du magasin.
4. Avancé : relier la vérification des factures et l'adresse de réception des factures.

**Ce qui gêne aujourd'hui**

- **Une fenêtre d'environ 25 champs** sur deux colonnes, pleine de jargon : NocoDB, « Mapping des colonnes », Webhook, SMTP, STARTTLS, SSL/TLS (GROUPS-05).
- **Un clic à côté de la fenêtre ou Échap efface toute la saisie** sans prévenir (GROUPS-13).
- **Des boutons trompeurs** : « 🔍 Tester la configuration NocoDB » ne fait rien ; le champ Webhook n'apparaît que si NocoDB est choisi, alors qu'il sert seul ; le test d'envoi d'e-mails affiche du JSON brut et teste l'ancienne configuration (GROUPS-06, GROUPS-07, GROUPS-08).
- **Un manager peut ouvrir la modification** et, en enregistrant, effacer la configuration du magasin, car il ne reçoit qu'une fiche tronquée (GROUPS-01, GROUPS-03).
- **Vocabulaire** : la page parle de « Groupes » alors que le menu dit « Magasins » ; les cartes montrent `#12` et un code couleur hexadécimal au lieu d'informations utiles (GROUPS-11, GROUPS-10).
- **Composants disparates** (listes et cases natives, emojis), formulaire inutilisable sur téléphone ; suppression contrôlée seulement dans le navigateur (GROUPS-15, GROUPS-16, GROUPS-09).

**Écran cible**

- **En-tête :** « Magasins » + « Nouveau magasin ».
- **Cartes allégées :** pastille de couleur et nom, adresse, « 5 utilisateurs », badges d'état « E-mails : configurés » ou « à configurer », « Vérification des factures : reliée » ou « non reliée », activité (commandes et livraisons) ; bouton « Modifier », menu « ⋯ » « Supprimer ». Plus de `#12` ni de code hexadécimal. (GROUPS-10)
- **Création en deux temps :** d'abord le nom et la couleur seulement ; puis « Compléter la fiche ». (GROUPS-05)
- **Fiche magasin en 3 onglets** :
  - *Informations* (ouvert par défaut) : nom, couleur (10 pastilles, sans code), adresse, téléphone, e-mail, logo.
  - *Envoi des e-mails* : préréglages « Office 365 », « Gmail », « Autre » qui remplissent serveur, port et sécurité ; champs détaillés avec une aide ; bouton « Enregistrer et tester » qui teste la saisie en cours et affiche un message clair.
  - *Avancé* : « Vérification des factures » (configuration NocoDB et colonnes, en mots simples) et « Adresse de réception des factures » (webhook), visible même sans NocoDB.
  (GROUPS-05, GROUPS-07, GROUPS-08)
- **Retirés :** le bouton « Tester la configuration NocoDB » (tant qu'il n'existe pas), les emojis, les composants natifs. (GROUPS-06, GROUPS-15)
- **Fermeture :** si la fiche a été modifiée, « Abandonner les modifications ? ». (GROUPS-13)
- **Suppression :** refusée par le serveur tant que le magasin a des données, avec le message « Ce magasin a encore des commandes, livraisons, DLC, tâches ou avoirs ». (GROUPS-09)
- **Téléphone :** champs sur une colonne, titre et bouton qui passent à la ligne. (GROUPS-16)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Groupes · Nouveau Groupe · Groupe créé · Nom du groupe | Magasins · Nouveau magasin · Magasin créé · Nom du magasin |
| Mapping des colonnes | Colonnes du tableau des factures (ex. « Colonne n° de facture ») |
| SMTP | Envoi des e-mails (« Serveur d'envoi (SMTP) » en sous-titre) |
| STARTTLS · SSL/TLS | Sécurité de la connexion, avec une aide |
| Webhook | Adresse de réception des factures (fournie par votre informaticien) |
| 🔍 Tester la configuration NocoDB | supprimé |
| #12 · #2563EB | supprimés |

**Gains et effort**

- Créer un magasin redevient une affaire de 30 secondes ; les réglages techniques ne font plus peur ; plus de configuration effacée par erreur.
- **D'abord (S)** : modification réservée à l'admin (GROUPS-01) ; retirer « Tester la configuration NocoDB » (GROUPS-06) ; Webhook toujours visible (GROUPS-07) ; garde à la fermeture (GROUPS-13) ; « Magasin » partout (GROUPS-11).
- **Refonte : M.**

---

### 18. Paramètres — `/utilities` (6 onglets regroupés en 4)

**Pour qui :** admin.
**Objectif :** vérifier que les sauvegardes tournent et régler les services connectés (météo, factures, BAP).
**Tâches principales :**
1. Vérifier que la dernière sauvegarde est récente et réussie ; en lancer une, la télécharger.
2. Régler la météo de l'en-tête.
3. Relier la vérification des factures et l'envoi des BAP, et tester ces connexions.

**Ce qui gêne aujourd'hui (cadre commun)**

- **Six onglets plats** qui mêlent outils de tous les jours (sauvegardes, météo) et outils dangereux pour développeur (SQL brut, analyse de la base), avec des noms jargon (NocoDB, BAP, Debug) ; illisibles sur téléphone (6 colonnes forcées) (UTIL-01).
- **L'onglet actif n'est pas dans l'adresse** : une actualisation ramène sur « Sauvegardes » (UTIL-02).
- **« Accès refusé » clignote** à chaque ouverture (ADMIN-01) ; double en-tête, largeurs et titres différents d'un onglet à l'autre (UTIL-04, BACKUP-10).

**Écran cible (cadre commun)**

- **Titre « Paramètres »** et 4 onglets, avec l'onglet dans l'adresse (`/utilities?tab=meteo`) ; les anciennes adresses (`/backup`, `/nocodb-config`, `/weather-settings`, `/database-debug`) mènent au bon onglet. (UTIL-01, UTIL-02)
- **Chaque onglet** utilise `AdminSection` (titre de section, une phrase d'explication, actions) : un seul titre de page, mêmes largeurs, même squelette de chargement. (UTIL-04, BACKUP-10)
- **Pas de clignotement** : la page attend de connaître l'utilisateur avant de décider de l'accès. (ADMIN-01)

#### 18.1 Onglet « Sauvegardes »

- **Gêne :** suppression d'une sauvegarde en un clic, sans confirmation, sur une icône collée à « Télécharger » (BACKUP-01) ; information répétée trois fois, nom de fichier technique en titre, « Bytes », « Manuel backup du… » (BACKUP-06) ; une sauvegarde ratée reste « En cours » à vie et compte comme « dernière sauvegarde » (BACKUP-02) ; ligne coupée sur petit écran (BACKUP-07) ; bouton principal orange (BACKUP-10).
- **Écran cible :** une carte d'état unique « Sauvegarde automatique chaque nuit : activée — dernière réussie cette nuit à 02:00 », avec l'interrupteur et le bouton bleu « Créer une sauvegarde maintenant » ; bandeau rouge si la dernière tentative a échoué. Liste : « Sauvegarde automatique — jeu. 2 oct. 2026, 02:00 », « 12,4 Mo », état (« Réussie », « En cours », « Échec »), bouton « Télécharger », menu « ⋯ » « Supprimer » (confirmation « Supprimer la sauvegarde du 02/10/2026 à 02:00 ? » ; la dernière sauvegarde réussie ne peut pas être supprimée). Nom du fichier en infobulle. L'interrupteur bascule tout de suite et son message dit le nouvel état. La restauration depuis l'interface reste une décision produit. (BACKUP-01, BACKUP-02, BACKUP-06, BACKUP-07, BACKUP-08, BACKUP-10)

#### 18.2 Onglet « Météo »

- **Gêne :** après un changement de ville, le widget garde l'ancienne ville jusqu'au lendemain ; messages d'erreur en anglais ; formulaire manipulé directement dans la page ; texte « À propos » inexact (WEATHER-01, WEATHER-03).
- **Écran cible :** formulaire court : Ville (avec « Détecter ma position »), « Clé du service météo » (avec une phrase d'aide), interrupteur « Afficher la météo dans l'en-tête », boutons « Tester » et « Enregistrer » côte à côte ; l'en-tête se met à jour immédiatement ; messages en français ; seul l'admin peut changer la ville, y compris par la géolocalisation. (WEATHER-01, WEATHER-03, WEATHER-02)

#### 18.3 Onglet « Connexions externes » (vérification des factures + envoi des BAP)

- **Gêne (vérification des factures) :** libellés anglais (« Personal API Token », « xc-token »), aucun test de connexion ; jeton affiché en clair ; plusieurs configurations « Actif » sans dire laquelle sert ; boutons-icônes et suppression sans avertir des magasins concernés ; formulaire de création jamais vidé (NOCO-07, NOCO-01, NOCO-03, NOCO-04, NOCO-05).
- **Gêne (BAP) :** jargon (webhook, n8n, sigle BAP non expliqué) et prénoms écrits en dur ; interrupteur « Configuration active » sans explication ; bouton « Sauvegarder » isolé et « Connexion réussie » qui reste affiché après une modification (BAP-01, BAP-02).
- **Écran cible :** deux cartes.
  - *Vérification des factures (NocoDB)* : liste des configurations avec « Utilisée par : Magasin A, Magasin B » et une seule marquée « Utilisée pour la vérification » ; formulaire « Adresse du serveur », « Jeton d'accès » (masqué ; laisser vide pour conserver l'actuel), « Identifiant de la base (commence par p_) », bouton « Tester la connexion » ; suppression avec l'avertissement « 3 magasins utilisent cette configuration ». (NOCO-07, NOCO-01, NOCO-03, NOCO-04, NOCO-05)
  - *Envoi des bons à payer (BAP)* : « Adresse de réception (fournie par votre informaticien) », interrupteur « Envoi des BAP activé » avec l'aide « Désactivé : le bouton BAP n'enverra plus de fichiers », boutons « Tester » et « Enregistrer » dans le même pied de carte, mention « Modifications non enregistrées », résultat du test effacé dès que l'adresse change. Les destinataires ne sont plus écrits en dur, et une adresse invalide est refusée avec un message clair au lieu d'une erreur serveur. (BAP-01, BAP-02, BAP-03)

#### 18.4 Onglet « Outils avancés » (diagnostic de la base + SQL)

- **Gêne :** du SQL brut s'exécute sur la base de production en un clic, sans confirmation ni sauvegarde ; résultats en un bloc JSON illisible ; bouton obsolète « SQL Webhook BAP » qui écrase l'éditeur ; outil de diagnostic incompréhensible pour un admin non informaticien (SQL-01, SQL-02, SQL-03, DEBUG-02).
- **Écran cible :** onglet masqué par défaut (D11). S'il est activé : bandeau d'avertissement en tête ; « Télécharger le rapport technique » en un seul bouton ; SQL en lecture seule par défaut ; une commande qui modifie des données déclenche une sauvegarde automatique et demande de taper « EXÉCUTER » ; résultats en tableau limité à 200 lignes ; bouton « SQL Webhook BAP » supprimé. (SQL-01, SQL-02, SQL-03, DEBUG-02)

**Libellés à renommer**

| Avant | Après |
|---|---|
| Utilitaires | Paramètres |
| Configuration NocoDB · Configuration BAP | Connexions externes |
| Debug Base de Données · Exécution SQL | Outils avancés |
| Liste des Sauvegardes · nom de fichier en titre | Sauvegardes · « Sauvegarde automatique — jeu. 2 oct. 2026, 02:00 » |
| Bytes | o, Ko, Mo, Go |
| Manuel backup du… | Sauvegarde manuelle du… |
| Terminé | Réussie |
| Personal API Token · xc-token | Jeton d'accès personnel |
| Webhook n8n … Laurie et Jeremy | Adresse de réception des BAP |
| Configuration active | Envoi des BAP activé |

**Gains et effort**

- L'admin voit d'un coup d'œil si les sauvegardes sont à jour ; aucun outil dangereux n'est plus à portée d'un clic ; chaque réglage se teste avant d'être enregistré.
- **D'abord (S)** : confirmation de suppression des sauvegardes (BACKUP-01) ; état « Échec » réel (BACKUP-02) ; onglet SQL masqué (SQL-01) ; bouton « SQL Webhook BAP » retiré (SQL-03) ; widget météo mis à jour (WEATHER-01).
- **Refonte : M** (cadre et sauvegardes S, connexions externes M, outils avancés M).

---

### 19. Connexion — `/auth`

**Pour qui :** tous.
**Objectif :** entrer dans l'application vite et sans se tromper, puis arriver là où l'on voulait aller.
**Tâches principales :** se connecter ; à la toute première installation, connaître les identifiants par défaut.

**Ce qui gêne aujourd'hui**

- **Les identifiants « admin / admin » s'affichent à tout visiteur**, avant même la vérification, et en cas d'erreur réseau (AUTH-04, SHELL-28).
- **Sur téléphone, le clavier met une majuscule** à l'identifiant, d'où « Identifiant ou mot de passe incorrect » alors que la personne a bien tapé (AUTH-05).
- **Lenteur** : deux spinners avant l'écran, attente de 500 ms et rechargement complet après connexion ; la page demandée avant connexion est perdue (AUTH-03, SHELL-09). *L'attente et le rechargement sont supprimés par le lot 1 ; reste la page demandée.*
- **Messages trompeurs** en cas de blocage après plusieurs essais (AUTH-08) ; anglicisme « across tous vos magasins » ; page déclarée en anglais et zoom bloqué (SHELL-20).
- **Chaque redéploiement déconnecte tout le monde** (sessions gardées en mémoire) (AUTH-06).

**Écran cible**

- Logo et titre « Connexion à LogiFlow » ; champs « Identifiant » (sans majuscule automatique, ni correction, ni espace final) et « Mot de passe » (avec « Afficher ») ; bouton « Se connecter », désactivé pendant l'envoi. (AUTH-05)
- **Messages distincts :** « Identifiant ou mot de passe incorrect » ; « Trop de tentatives, réessayez dans 15 minutes » ; « Votre session a expiré, reconnectez-vous ». (AUTH-08)
- **Identifiants par défaut** affichés seulement si le serveur confirme une première installation. (AUTH-04, SHELL-28)
- **Après connexion :** arrivée directe, sans rechargement, sur la page demandée au départ (par exemple un lien vers `/dlc`), sinon sur l'Accueil. (AUTH-03, SHELL-09)
- Sur grand écran, le visuel de présentation reste, avec un texte entièrement en français.

**Gains et effort**

- Plus d'échec de connexion sur téléphone ; plus d'identifiants exposés ; on retrouve la page demandée.
- **Effort : S** côté interface. Prérequis serveur : sessions conservées entre deux redémarrages (AUTH-06).

---

### 20. Page introuvable et écran d'erreur

**Pour qui :** tous, en cas de lien périmé ou de faute de frappe dans l'adresse, ou de panne d'une page.
**Objectif :** comprendre ce qui se passe et revenir en un clic.

**Ce qui gêne aujourd'hui**

- **Message de développeur en anglais** (« 404 Page Not Found — Did you forget to add the page to the router? »), sans bouton de retour, sur une hauteur d'écran doublée (NF-01, SHELL-23).
- **Une erreur dans une seule carte efface toute l'application**, menu compris (SHELL-30).

**Écran cible**

- **Page introuvable :** « Page introuvable — Cette page n'existe pas ou a été déplacée. » + bouton « Retour à l'accueil », dans le cadre normal (menu visible). (NF-01, SHELL-23)
- **Erreur d'une page :** seul le contenu affiche « Une erreur est survenue » avec « Réessayer » et « Retour à l'accueil » ; le menu reste utilisable. (SHELL-30)
- **Page interdite :** « Vous n'avez pas accès à cette page » + « Retour à l'accueil » (composant `AccessDenied` de P1). (SHELL-11)

**Effort : S.**

---

### 21. Écrans non visibles à supprimer

Ces fichiers ne sont affichés nulle part, mais ils entretiennent la confusion (plusieurs versions d'un même formulaire, liens vers des adresses inexistantes) et ralentissent chaque évolution. À supprimer dans le même lot que la refonte de la page concernée.

| Écran | Pourquoi | Constats |
|---|---|---|
| Carte « tâches récentes » et tableau de bord « responsive » jamais branchés | troisième tri et troisième mise en forme des priorités | DASH-45 |
| Six formulaires de tâche et un composant « tâches responsive » jamais importés | appellent une route inexistante, magasin 1 codé en dur | TASKS-32 |
| Ancienne page d'accueil « Landing » | boutons vers une adresse qui n'existe pas, marque codée en dur | LAND-01 |
| Pages « Analyse des ventes » (affichage et réglage) | jamais branchées ; à brancher ou supprimer selon D13 | SALES-01, SALES-02 |

---

### Ordre de passage conseillé

L'ordre est celui de la [feuille de route](#feuille-de-route) : les corrections courtes des lignes « D'abord » en Phase 1b, sans changer l'organisation des écrans ; puis, en Phase 3, les écrans du quotidien en magasin (Accueil, DLC, Tâches, Livraisons, Commandes clients), les écrans de suivi (SAV, Commandes fournisseurs, Calendrier, Publicités, Contacts), les écrans de gestion (Rapprochement BL / factures, Avoirs, Échéancier, Statistiques, Fiches fournisseurs) et enfin l'administration (Utilisateurs, Magasins, Paramètres).

Chaque page refaite est vérifiée avec la grille des dix principes de P1, puis parcourue avec un compte de chaque rôle, sur PC et sur téléphone.

---

## P3 — Bugs et dette technique

La refonte décrite dans P1 et P2 n'a de sens que sur une base qui ne ment pas : un écran plus clair qui affiche un faux chiffre, perd une saisie ou montre les données d'un autre magasin ferait perdre la confiance des équipes. Cette section liste donc **ce qu'il faut réparer**, dans l'ordre où il faut le faire, puis **ce qu'il faut nettoyer dans le code** pour que les corrections tiennent dans le temps.

**En chiffres.** L'audit a confirmé **136 bugs** (49 de gravité haute, 64 moyenne, 23 basse) et **51 constats de dette technique**. Environ **3 700 lignes de code mort** (dont 2 030 pour des formulaires et cartes de tâches jamais utilisés) et 36 fichiers temporaires sont versionnés. Beaucoup de bugs viennent de la même cause : le même écran existe en plusieurs copies (PC, tablette, téléphone) et la correction n'a été faite que dans l'une d'elles.

**Comment lire cette section**

- § 1 : la liste courte des **20 problèmes à corriger avant toute refonte** (sécurité, données fausses, pertes de données, fonctions cassées au quotidien).
- § 2 : **huit correctifs transversaux** qui règlent chacun une dizaine de bugs d'un coup et empêchent qu'ils reviennent.
- § 3 : **la liste complète des 136 bugs**, rangés par thème puis par gravité. Une ligne par bug : identifiant, page, ce que voit l'utilisateur, correction. Quand l'audit a relevé le même bug depuis deux pages, les deux identifiants sont sur la même ligne (exemple : DASH-02 et DLC-08).
- § 4 : **la dette technique** : fichiers à supprimer, copies à fusionner, base de données, avec l'ordre conseillé.
- § 5 : **l'ordre de réalisation global** et les règles de vérification.

**Gravité** : celle de l'audit. **Effort** : échelle commune (voir [Comment lire ce plan](#comment-lire-ce-plan)) ; sans mention, la correction est de taille S. Ce que le lot 1 de performance (P4) a déjà réglé porte la mention *fait par le lot 1*.

**À savoir sur le serveur.** L'image Docker de production lance `server/index.production.ts`. Le fichier `server/index.ts` ne sert qu'à `npm run dev` et à `npm start`. Plusieurs bugs serveur ne touchent que ces deux modes : ils sont signalés « dev et `npm start` seulement » et passent après les autres.

---

### 1. À corriger en priorité (avant toute refonte)

Vingt problèmes, en trois lots. Chaque correction est **locale et minimale** : on répare sans refaire les écrans, pour que la refonte parte d'une base saine. Les correctifs de fond (§ 2) viennent ensuite et évitent les rechutes.

#### Lot A — Sécurité (2 à 3 jours)

| N° | Problème | Correction | Constats | Effort |
|---|---|---|---|---|
| 1 | Les empreintes des mots de passe de tous les comptes, administrateurs compris, sont envoyées au navigateur des managers et directeurs (page Utilisateurs, Tâches), et à tout employé qui ouvre le SAV ou les commentaires du rapprochement. | Le jour même : ajouter la clé `password` au filtre de sortie de `server/sanitize.ts`, déjà appliqué à toutes les réponses `/api` (`routes.ts:165`). Ensuite : projections explicites dans `storage.ts` (identifiant, prénom, nom, e-mail, jamais `password`) et suppression de la requête `/api/users` inutile de Tâches. *En partie fait par le lot 1 (P4 § 2.9) : plus aucune empreinte dans les lectures de `/api/users`, le SAV ni les commentaires, et Tâches ne charge plus les utilisateurs ; restent `POST /api/users` et le filet `sanitize.ts`.* | USERS-02, DB-04, SAV-04, RAPPRO-03, TASKS-07 | S |
| 2 | Un nom de client ou de produit piégé, saisi par un collègue, s'exécute au moment de l'impression d'une étiquette ou d'une liste DLC, avec la session de la personne qui imprime. | Une fonction commune `escapeHtml` appliquée à toutes les valeurs imprimées (ou construction de la page d'impression avec `textContent`). | CMDCLI-08, DLC-26 | S |
| 3 | Le serveur relaie un fichier vers une adresse fournie par le navigateur, sans limite de taille (appel possible vers une adresse interne, saturation mémoire). L'envoi du PDF d'un avoir passe, lui, directement du navigateur au service externe et échoue pour les directeurs et employés. | Deux routes serveur (facture, avoir) qui reçoivent l'identifiant de la livraison ou de l'avoir, contrôlent l'accès, lisent l'adresse du webhook du magasin en base, plafonnent la taille (15 Mo), vérifient le PDF et posent un délai maximal. | RAPPRO-21, AVOIRS-04 | M |
| 4 | Des secrets circulent en clair : le jeton NocoDB est déchiffré puis envoyé au navigateur, le mot de passe SMTP d'un magasin est écrit dans les journaux du serveur et dans la console du navigateur. | Jeton renvoyé masqué avec `apiTokenSet: true` (champ vide en modification = jeton conservé) ; suppression des `console.log` concernés côté serveur et côté client. | NOCO-01 (annexe 12), GROUPS-14, USERS-15 | S |
| 5 | Un compte sans magasin affecté (nouvel employé, affectation retirée) voit les tickets SAV, l'annuaire et les statistiques de toute l'enseigne ; un manager obtient les statistiques de tous les magasins avec un paramètre d'adresse. | Une seule règle serveur : un non-admin sans magasin reçoit une liste vide ; les statistiques par magasin sont filtrées par rôle comme les autres (correctif T2). | SAV-06, CONT-02, ANA-05, ANA-06, SRV-08 | S |
| 6 | Des écritures sont acceptées sans vérifier le magasin ni le rôle : contacts d'un autre magasin, suppression de ticket SAV, validation ou déplacement de produit DLC, modification de commande client, suppression de tâche, avoir passé en « Reçu » sur téléphone, ville météo changée par un employé. | Helper `assertStoreAccess(user, groupId)` sur chaque écriture et `requireModulePermission` / `requireAdmin` (déjà présents dans `server/permissions.ts`) alignés sur le tableau des droits de P1 § 2.2 (correctif T2). | CONT-03, SAV-09, DLC-06, CMDCLI-07, TASKS-13, AVOIRS-API-07, WEATHER-02 | M |
| 7 | Un manager qui ouvre `/groups` par l'adresse et enregistre la fiche d'un magasin efface sa configuration NocoDB, son webhook, son adresse, son logo et coupe son SMTP. | `requireAdmin` sur POST, PUT et DELETE `/api/groups` ; n'envoyer que les champs modifiés ; même forme de réponse pour tous les rôles. | GROUPS-01, GROUPS-03 | S |
| 8 | Deux petites failles faciles : un admin peut télécharger des fichiers hors du dossier des sauvegardes (dont `.env`) ; l'écran de connexion affiche « admin / admin » par défaut. | Nom de fichier vérifié par motif et chemin résolu contrôlé ; encart des identifiants par défaut affiché seulement si le serveur répond explicitement `true`. | BACKUP-09, AUTH-04, SHELL-28 | S |

#### Lot B — Données fausses ou perdues (3 jours environ)

| N° | Problème | Correction | Constats | Effort |
|---|---|---|---|---|
| 9 | **Sécurité alimentaire.** Un produit DLC marqué « traité » avant son expiration disparaît pour toujours du filtre « Expirés », du compteur rouge et de l'alerte. Le jour J, le produit est classé « Expiré » mais affiché « Expire bientôt », sans bouton pour le retirer. | Retirer l'exclusion « traité » du filtre et du compteur des expirés ; un utilitaire partagé de calcul des jours restants (jours calendaires, seuils uniques) pour PC, téléphone, alerte et SQL. | DLC-01, DLC-02 | S |
| 10 | DLC : après « Annuler », « Nouveau produit DLC » rouvre en modification et écrase le produit précédent ; ouvrir une fiche relance la recherche du code-barres et remplace son nom ; le produit est créé ou déplacé dans le premier magasin de l'utilisateur. | `closeDialog()` unique qui vide le formulaire ; pas de recherche en modification tant que le code-barres n'a pas changé ; magasin = magasin sélectionné, jamais envoyé en modification. | DLC-03, DLC-04, DLC-05 | S |
| 11 | Commandes clients : corriger un numéro de téléphone remet la commande « En attente de Commande » (le client ne sera pas prévenu), la déplace dans un autre magasin et efface ses notes. | Statut initial imposé seulement à la création ; `groupId` de la commande conservé ; notes et e-mail ajoutés aux valeurs initiales du formulaire. | CMDCLI-03, CMDCLI-04, CMDCLI-05 | S |
| 12 | SAV : les commentaires et l'historique ne sont jamais enregistrés, alors que l'écran affiche « succès ». | Tout de suite : masquer le champ commentaire. Ensuite : recréer la table `sav_ticket_history` (déjà décrite dans `migrations/sav_production_fix.sql`), la déclarer dans `shared/schema.ts`, réactiver le code commenté. | SAV-02 | S puis M |
| 13 | Rapprochement et échéancier : changer la référence d'une facture efface l'échéance saisie à la main ; des factures affichent un TTC à 0,00 € et sont re-vérifiées à chaque ouverture. | Garder l'échéance si l'utilisateur l'a modifiée, ne jamais écrire vide sur échec ; n'écrire le TTC que s'il est supérieur à 0 ; compléter l'upsert du cache de vérification. | RAPPRO-07, ECHE-02, NOCO-02 (annexe 03) | S |
| 14 | Chiffres faux : « Palettes » et « Colis » du mois (unités mélangées, « Colis » = nombre de livraisons), « Montant total » des statistiques doublé, compteurs du téléphone qui affichent tout l'historique comme l'activité du jour. | Sommes filtrées par unité ; un montant de référence par livraison (facture, sinon BL) ; compteurs du jour sur le téléphone (*fait par le lot 1*), libellés « Commandes du jour ». | DASH-26, CAL-11, ANA-04, DASH-28, DB-09 | S |
| 15 | Une sauvegarde ratée reste « En cours » pour toujours et s'affiche comme « Dernière sauvegarde » : l'admin croit la base protégée. | Statut `failed` dans le `catch`, fichier partiel supprimé ; seules les sauvegardes terminées comptent ; bandeau si la dernière tentative a échoué. | BACKUP-02 | S |

#### Lot C — Fonctions cassées au quotidien (2 à 3 jours)

| N° | Problème | Correction | Constats | Effort |
|---|---|---|---|---|
| 16 | Accueil et Tâches : un manager ou un directeur voit « Aucune tâche en cours » en permanence et les commandes d'un autre magasin ; un admin voit les chiffres de tous les magasins sous le nom d'un seul ; un employé n'a jamais aucune tâche sur PC. | Envoyer le magasin sélectionné pour tous les rôles ; attendre l'utilisateur avant de charger (`enabled: !!user`, *fait par le lot 1* : DASH-03, SHELL-02) ; présélectionner l'unique magasin de l'employé. | DASH-01, DASH-03, SHELL-02, TASKS-02 | S à M |
| 17 | Aucune commande fournisseur ne peut être modifiée (« Impossible de modifier la commande »). | Remettre les arguments de `apiRequest` dans l'ordre dans `EditOrderModal.tsx`. | ORD-01 | S |
| 18 | Téléphone : le SAV est inutilisable (adresses et statuts inexistants), commandes et livraisons affichent « Date inconnue », les listes DLC et avoirs restent vides tant qu'aucun magasin n'est choisi. | Vraies adresses `/api/sav/tickets` et statuts du serveur ; vrais noms de champs de date ; appel sans magasin (le serveur filtre déjà) ou message « Choisissez un magasin ». | MSAV-01, MSAV-02, MOB-02, DLC-10, MOB-AVOIRS-01 | S chacun |
| 19 | Après une création ou une suppression, la liste ne bouge pas (SAV, Contacts, Avoirs) : l'utilisateur recommence et crée des doublons. | Clés de cache structurées pour que l'invalidation existante fonctionne (correctif T3). *Contacts et Avoirs : faits par le lot 1 ; reste le SAV.* | SAV-01, CONT-01, AVOIRS-03 | S |
| 20 | La fenêtre d'alerte DLC de l'accueil se rouvre aussitôt qu'on la ferme : l'employé est bloqué. | Toute fermeture vaut mise en sourdine pour la session ; ouverture automatique une seule fois par chargement. | DASH-02, DLC-08 | S |

**Juste après** (gravité haute ou forte gêne quotidienne) : sessions perdues à chaque redéploiement (AUTH-06, INFRA-08), filtres absents sur tablette (TASKS-09), « En retard de 0 jour » sur les tâches du jour (TASKS-12), affectations de magasin en double (USERS-03), fournisseur n°1 attribué en silence sur téléphone (DLC-11), livraisons « automatiques » invisibles au rapprochement (RAPPRO-12), panne NocoDB mise en cache comme « facture introuvable » (NOCO-01, annexe 03), compteurs DLC différents des listes (DLC-14, DASH-27), session expirée mal gérée (MOD-02), actions sans message d'erreur (CMDCLI-10 ; TASKS-25 est fait par le lot 1).

---

### 2. Huit correctifs transversaux

Chacun de ces chantiers règle un groupe entier de bugs du § 3 et rend les futures corrections plus simples. Ils se font après les corrections locales du § 1, avant ou pendant la refonte P2.

| N° | Correctif | Bugs réglés ou rendus impossibles | Effort |
|---|---|---|---|
| T1 | **Aucune donnée sensible ne sort du serveur.** Filtre de sortie unique (`server/sanitize.ts`) qui retire `password` en plus du mot de passe SMTP ; projections explicites pour toute jointure sur `users` (créateur, auteur) et sur `groups` (nom et couleur seulement, jamais le logo ni la configuration SMTP ou NocoDB) ; jeton NocoDB masqué. *En partie fait par le lot 1 : projections des listes, des créateurs et des auteurs.* | USERS-02, DB-04, SAV-04, RAPPRO-03, NOCO-01 (annexe 12) ; aussi TASKS-07, DLC-07 | S |
| T2 | **Une seule règle d'accès par magasin côté serveur.** `getAccessibleGroupIds(user)` : tous les magasins pour l'admin, ses magasins pour les autres, **aucun** si la liste est vide ; `assertStoreAccess(user, groupId)` sur chaque écriture ; droits par module lus dans `shared/permissions.ts` via `requireModulePermission`. `req.user` contient déjà les magasins de l'utilisateur (`deserializeUser` charge `getUserWithGroups`) : aucune requête supplémentaire n'est nécessaire. | SAV-06, SAV-09, CONT-02, CONT-03, SRV-08, ANA-05, ANA-06, PUB-01, DASH-13, AVOIRS-API-07, AVOIRS-API-08, DLC-06, CMDCLI-07, TASKS-13, GROUPS-01, GROUPS-03, WEATHER-02 ; aussi ADMIN-03 | M |
| T3 | **Une seule façon de demander « les données du magasin actif ».** Un module `client/src/lib/queries.ts` où chaque requête construit à la fois l'adresse et la clé de cache (la clé reflète exactement l'adresse), avec des hooks partagés PC et téléphone : `useTasks`, `useDlcStats`, `useSavTickets`, `usePublicities`… Le magasin sélectionné est toujours envoyé ; sans magasin, soit le serveur filtre, soit un état vide « Choisissez un magasin ». Invalidation par préfixe après chaque modification. *Amorcé par le lot 1 : CONT-01 et AVOIRS-03 réglés, Tâches a sa propre clé.* | DASH-01, DASH-38, TASKS-02, TASKS-06, DLC-10, DLC-15, MOB-AVOIRS-01, SRV-07, ORD-05, SAV-01, CONT-01, AVOIRS-03, CMDCLI-15 ; aussi PUB-34 | M |
| T4 | **L'utilisateur connecté est chargé une seule fois.** Un hook unique basé sur React Query (détails au § 4.2, A). *Fait pour l'essentiel par le lot 1 (P4 § 2.2).* | DASH-03, SHELL-02, ADMIN-01, SHELL-27 ; aussi SHELL-01, ADMIN-02, AUTH-09 | M |
| T5 | **Des dates justes partout.** Utilitaires partagés : date du jour locale au format `yyyy-MM-dd`, jours restants en jours calendaires (`differenceInCalendarDays`), semaines ISO commençant le lundi ; côté SQL, date du jour en heure de Paris (`(now() AT TIME ZONE 'Europe/Paris')::date`). Plus aucun `toISOString()` pour une date sans heure. | DLC-02, DLC-14, DASH-27, TASKS-11, TASKS-12, DASH-18, PUB-09, PUB-10, ANA-09, ANA-10, CAL-01, CAL-05 | S à M |
| T6 | **Des formulaires de modification qui ne cassent rien.** Formulaire vidé à l'ouverture d'une création et à la fermeture d'une modification ; en modification, on n'envoie que les champs que l'utilisateur a changés, jamais le magasin ni le statut par défaut. C'est le rôle du futur `FormDialog` (P1 § 3.6). | DLC-03, DLC-04, DLC-05, CMDCLI-03, CMDCLI-04, CMDCLI-05, CONT-05, GROUPS-01, AVOIRS-12, SAV-07, SAV-08, NOCO-05, RAPPRO-07, AVOIRS-API-06 | M |
| T7 | **Toute action donne un retour juste.** Toutes les écritures passent par `apiRequest` (qui lève une erreur si la réponse n'est pas bonne) ; chaque mutation a un `onError` qui affiche le message traduit par la fonction commune de P1 (A12) ; un bouton n'est affiché que si le serveur accepte l'action. | TASKS-25, CMDCLI-10, DLC-13, AVOIRS-10, USERS-04, MOD-02, API-05, BAP-03 ; aussi ERR-01 | M |
| T8 | **Impression sûre.** `escapeHtml` partagé et une seule fonction d'impression de liste. | CMDCLI-08, DLC-26 ; aussi DLC-45 | S |

---

### 3. Liste complète des bugs, par thème

Dix thèmes, du plus grave au moins grave. Dans chaque tableau, les bugs sont triés par gravité (haute, moyenne, basse). « Tél. » = version téléphone.

#### 3.1 Sécurité : informations sensibles exposées (12 constats)

| Gravité | ID | Page | Ce que voit l'utilisateur (ou le risque) | Correction |
|---|---|---|---|---|
| Haute | USERS-02 | Utilisateurs, Tâches | Rien de visible, mais tout manager ou directeur reçoit les empreintes des mots de passe de tous les comptes, lisibles dans le navigateur. | Ne plus renvoyer `password` dans GET, POST et PUT `/api/users` ; supprimer la requête `/api/users` inutile de Tâches (TASKS-07). Qui peut lister les comptes : décision D5 (P1 § 2.3). *En partie fait par le lot 1 : reste `POST /api/users`.* |
| Haute | SAV-04, RAPPRO-03, DB-04 | SAV, Rapprochement | Même fuite pour les créateurs de tickets SAV et les auteurs de commentaires ; chaque commentaire transporte en plus le logo du magasin et une copie de la livraison. | Dans `storage.ts`, remplacer `creator: users` et `author: users` par une projection (id, prénom, nom, identifiant, e-mail) ; retirer `group` et `delivery` des commentaires ; ajuster les types. Filet global : T1. *Fait par le lot 1 (P4 § 2.3).* |
| Haute | CMDCLI-08 | Commandes clients | Un nom de client piégé s'exécute à l'impression de l'étiquette avec la session de celui qui imprime ; un simple « & » ou « < » casse l'étiquette. | Échapper toutes les valeurs (`escapeHtml`) ou construire la page via le DOM (`textContent`). |
| Haute | DLC-26 | DLC | Même faille dans l'impression des listes « Expirés » et « Expire bientôt ». | Même `escapeHtml` ; une seule fonction `printList(titre, produits)` (DLC-45). |
| Haute | GROUPS-14 | Magasins | Rien de visible, mais le mot de passe SMTP du magasin et le logo en base64 sont écrits en clair dans les journaux du serveur à chaque création. | Supprimer les `console.log` de debug du handler ; garder un seul `console.error` avec le corps masqué (`redactBody` étendu au logo). |
| Moyenne | RAPPRO-21 | Rapprochement | Le serveur relaie un fichier vers une adresse fournie par le navigateur, sans limite de taille : appel possible vers une adresse interne, saturation mémoire. | Le client envoie `deliveryId` ; le serveur retrouve le webhook du magasin après contrôle d'accès ; taille plafonnée, PDF vérifié, délai maximal. |
| Moyenne | NOCO-01 (annexe 12) | Paramètres › NocoDB | Le jeton d'accès aux factures de tous les magasins est déchiffré, envoyé au navigateur et affichable d'un clic. | Jeton masqué + `apiTokenSet: true` ; champ vide en modification = jeton conservé ; supprimer ou réserver à l'admin `GET /api/nocodb-config/active` (aucun appelant côté client). |
| Moyenne | BACKUP-09 | Paramètres › Sauvegardes | Depuis une session admin, une adresse fabriquée permet de lire des fichiers hors du dossier de sauvegardes (dont `.env`). | Dans `downloadBackup` et `deleteBackup` : n'accepter que les noms `backup_manual_….sql` ou `backup_automatic_….sql`, puis vérifier que le chemin résolu reste dans le dossier. |
| Moyenne | AUTH-04, SHELL-28 | Connexion | « admin / admin » s'affiche à chaque ouverture de l'écran de connexion (en permanence si l'appel échoue), même après changement du mot de passe. | Valeur initiale `false` ; encart affiché seulement si le serveur répond explicitement `true` ; à terme, seulement au tout premier démarrage. |

#### 3.2 Cloisonnement par magasin et droits côté serveur (17 constats)

Données d'autres magasins visibles ou modifiables, actions acceptées sans droit. Correctif de fond : T2.

| Gravité | ID | Page | Ce que voit l'utilisateur (ou le risque) | Correction |
|---|---|---|---|---|
| Haute | SAV-06 | SAV | Un employé ou un manager sans magasin affecté voit les tickets de toute l'enseigne, avec noms et téléphones des clients. | Non-admin sans magasin : liste vide et statistiques à zéro. |
| Haute | CONT-02 | Contacts | Un compte sans magasin voit l'annuaire complet de l'enseigne. | Même règle dans la route et dans les deux `getContacts` (base et mémoire). |
| Haute | CONT-03 | Contacts | Un manager du magasin A peut créer, modifier ou supprimer les contacts du magasin B par un simple appel. | Charger le contact et vérifier son magasin en PUT et DELETE ; vérifier `groupId` en POST et PUT ; 403 sinon. |
| Haute | ANA-05 | Statistiques | « Performance par magasin » montre tous les magasins à un manager ; le filtre « Magasins » n'a aucun effet sur ce graphique. | Même filtrage par rôle que les autres routes ; `groupIds` passé à `getAnalyticsByStore`. Accès des employés : décision D4. |
| Haute | ANA-06 | Statistiques | Avec un paramètre d'adresse, un manager obtient les statistiques de toute l'enseigne (liste filtrée vide = aucun filtre). | Liste vide pour un non-admin = résultat vide ; réutiliser `resolveStatsGroupIds` (`routes.ts:1469`). |
| Haute | PUB-01 | Publicités (PC et tél.) | Tout le monde voit les publicités de tous les magasins ; changer de magasin ne change ni la liste, ni les compteurs, ni l'export. | Filtrer en SQL sur les magasins participants (index `group_id` à garantir, PUB-35). Décider si l'admin en « Tous les magasins » voit les publicités sans magasin. |
| Haute | TASKS-13 | Tâches (PC et tél.) | Selon l'appareil, un employé peut supprimer des tâches terminées (PC) ou terminer n'importe quelle tâche (tél.) ; un manager peut supprimer. | Serveur : contrôle des droits « modifier », « supprimer » et « terminer » sur PUT, DELETE et `complete` ; client : boutons dérivés de `shared/permissions.ts`. Règle : décision D6. |
| Haute | CMDCLI-07 | Commandes clients | Un employé peut modifier ou annuler n'importe quelle commande, un manager peut en supprimer par l'API ; une saisie invalide donne une erreur générique. | `requireModulePermission('customer-orders','delete')` sur DELETE ; schéma Zod dédié au PUT, sans `groupId` ni `createdBy` ; « Modifier » masqué selon le droit. Décision D8. (M) |
| Haute | DLC-06 | DLC (PC et tél.) | Un employé peut valider un produit ou le déplacer dans un autre magasin par l'API ; une saisie invalide donne « Failed to create DLC product ». | Schéma Zod d'édition (champs modifiables seulement) ; en PUT, ignorer statut, magasin et champs de validation ; en POST, forcer le statut « en cours ». Décision D7. (M) |
| Moyenne | SRV-08 | Livraisons, Commandes, Calendrier | Un directeur peut valider une livraison de n'importe quel magasin ; le contrôle de livraison ne vérifie pas le magasin ; un employé peut lire les commandes ; un compte sans magasin reçoit les statistiques de tous. | `assertStoreAccess` sur validate, control, PUT et DELETE ; droit « voir » vérifié sur les listes ; aucun magasin = aucun accès. |
| Moyenne | SAV-09 | SAV | Un directeur peut supprimer définitivement le ticket d'un autre magasin en devinant son numéro. | Vérifier le magasin comme dans le PATCH (`req.user.userGroups`). |
| Moyenne | AVOIRS-API-07 | Avoirs (tél.) | Sur téléphone, un manager peut passer un avoir en « Reçu » (ce qui déclenche l'envoi externe), modifier un avoir validé ou le déplacer vers un magasin qu'il ne gère pas. | Règles appliquées dans le PUT : 403 pour un manager qui passe en « Reçu » ; 409 si l'avoir est validé et l'utilisateur non admin ; magasin cible contrôlé. |
| Moyenne | DASH-13 | Accueil | Un employé du magasin A lit les informations destinées au magasin B ; les informations générales peuvent sortir de la liste (limite de 5). | Non-admins : informations sans magasin ou de leurs magasins ; filtre « récentes » fait en SQL ou retiré. |
| Moyenne | WEATHER-02 | En-tête (météo) | N'importe quel employé peut changer la ville météo affichée dans tous les magasins (et déclencher des appels payants). | `requireAdmin` sur la route de géolocalisation. |
| Moyenne | USERS-11 | Utilisateurs | Un admin peut se retirer ses propres droits depuis sa fiche, sans confirmation, et perdre l'accès à l'administration. | Un seul endroit pour changer un rôle (la fiche, avec confirmation) ; serveur : refuser de changer son propre rôle et de retirer le dernier admin. |
| Moyenne | GROUPS-09 | Magasins | Supprimer un magasin qui a encore des données affiche « Impossible de supprimer le groupe » sans dire pourquoi ; un appel direct contourne le contrôle de l'écran ; les affectations d'utilisateurs restent orphelines. | Serveur : transaction (affectations, puis magasin) ; erreur `23503` traduite en 409 « Ce magasin a encore des commandes, livraisons, DLC, tâches ou avoirs », affiché tel quel. (M) |
| Basse | AVOIRS-API-08 | Avoirs | Un directeur voit les avoirs des autres magasins, mais leur vérification échoue en silence ; il peut valider n'importe quel avoir par son numéro. | Helper `getAccessibleGroupIds(user)` utilisé par toutes les routes `/api/avoirs`. |

#### 3.3 Pertes et écrasements de données (18 constats)

Correctif de fond : T6.

| Gravité | ID | Page | Ce que voit l'utilisateur | Correction |
|---|---|---|---|---|
| Haute | SAV-02 | SAV | Les commentaires et l'historique ne sont jamais enregistrés, mais l'écran affiche « succès » ; le badge « Nouveau » ne s'allume jamais. | Recréer `sav_ticket_history` (décrite dans `migrations/sav_production_fix.sql`), la déclarer dans `shared/schema.ts`, réactiver le code commenté, dater la résolution et la clôture. En attendant : masquer le champ. (M) |
| Haute | DLC-03 | DLC | Après « Annuler » une modification, « Nouveau produit DLC » rouvre en modification : l'employé croit créer un produit et écrase le précédent. | `closeDialog()` (fermer, oublier le produit en cours, vider le formulaire) utilisée partout, y compris par « Annuler » ; vider aussi au clic sur « Nouveau produit DLC ». |
| Haute | DLC-04 | DLC | Ouvrir un produit en modification relance la recherche du code-barres et remplace son nom et son fournisseur sans prévenir. | Pas de recherche en modification tant que le code-barres n'a pas changé ; réponses obsolètes ignorées (`AbortController`). |
| Haute | DLC-05 | DLC | Les produits sont créés dans le premier magasin de l'utilisateur, pas dans le magasin choisi ; modifier un produit le transfère dans ce premier magasin. | Création : magasin sélectionné, sinon l'unique magasin, sinon champ « Magasin » obligatoire (plus de repli sur le magasin 1) ; modification : ne pas envoyer `groupId`. |
| Haute | CMDCLI-03 | Commandes clients | Corriger un téléphone sur une commande « Disponible » la renvoie en « En attente de Commande » : elle sort des « clients à appeler ». | Statut initial imposé seulement à la création ; en modification, ne pas envoyer `status`. |
| Haute | CMDCLI-04 | Commandes clients | Modifier une commande d'un autre magasin la réaffecte au premier magasin de l'utilisateur ; elle disparaît de la bonne liste. | `groupId` de la commande conservé ; serveur : `groupId` ignoré ou contrôlé au PUT (avec CMDCLI-07). |
| Haute | GROUPS-01 | Magasins | Un manager qui enregistre une fiche magasin efface NocoDB, webhook, adresse, téléphone, logo, et coupe le SMTP. | `requireAdmin` sur POST, PUT et DELETE `/api/groups`, page réservée à l'admin ; n'envoyer que les champs modifiés. |
| Haute | USERS-03 | Utilisateurs | Dans la fiche, « Assigner » ne bascule pas : un second clic crée une affectation en double (deux badges identiques). | Utilisateur affiché lu dans la liste à jour (`selectedUserId`) ; en base : dédoublonnage, contrainte unique, `.onConflictDoNothing()` (DB-23). |
| Haute | DLC-11 | DLC (tél.) | Sur téléphone, le fournisseur n°1 est enregistré en silence si l'on n'en choisit pas ; la liste affichée ne correspond pas à la valeur. | Fournisseur vide par défaut, liste contrôlée, message « Fournisseur requis » ; livrer avec l'affichage des erreurs (DLC-12), sinon le bouton ne fait plus rien. |
| Moyenne | CMDCLI-05 | Commandes clients | Modifier une commande sur PC efface les notes et l'e-mail saisis sur téléphone (les notes ne sont affichées nulle part). | `notes` et `customerEmail` dans les valeurs initiales du formulaire. Afficher les notes : avec la refonte (P2 § 4). |
| Moyenne | CONT-05 | Contacts | Modifier un contact, même son téléphone, le déplace dans le magasin sélectionné en haut. | Magasin du contact conservé en modification ; supprimer le faux choix « Magasin » de la fenêtre ou le rendre réel. |
| Moyenne | RAPPRO-07 | Rapprochement | Changer la référence facture fait attendre jusqu'à 10 secondes, puis efface l'échéance saisie à la main. | Garder la saisie si l'utilisateur a changé l'échéance, sinon compléter depuis NocoDB ; jamais d'écriture vide sur échec ; appel NocoDB après la réponse. Voir le verdict : la modale envoie toujours l'ancienne échéance. |
| Moyenne | GROUPS-03 | Magasins, Avoirs | Les non-admins reçoivent des fiches magasin tronquées : un directeur lit « Aucun webhook configuré » alors qu'il existe (cause de GROUPS-01). | Même forme de réponse pour tous (projection légère), filtrée sur les magasins de l'utilisateur. |
| Moyenne | AVOIRS-API-06 | Avoirs | Un enregistrement partiel efface montant, référence et commentaire (toute clé absente est vidée). | D'abord le client envoie `amount: null` quand le champ est vidé ; ensuite seulement, le serveur ne vide que les clés présentes (ordre imposé par le verdict). |
| Moyenne | CMDCLI-06 | Commandes clients (tél.) | Sur téléphone, cocher « Prix publicité » ou « Client déjà notifié » n'a aucun effet : la commande est enregistrée au prix normal. | Ajouter les deux champs au schéma et aux valeurs initiales ; retirer les `as any`. |
| Moyenne | MOB-AVOIRS-05 | Avoirs (tél.) | Un avoir créé sur téléphone sans montant est enregistré à 0,00 € au lieu de « Non spécifié ». | Valeur initiale `''` et `z.preprocess` qui transforme `''` en `undefined`. |
| Moyenne | PUB-17 | Publicités | Si l'enregistrement des magasins participants échoue, la publicité est créée quand même ; le nouvel essai bute sur « numéro déjà utilisé ». | Création et modification dans une transaction ; PUT validé (sans `createdBy`) ; 404 si la publicité n'existe pas ; suppression manuelle des participations conservée. (M) |
| Basse | SAV-26 | SAV | Deux tickets peuvent porter le même numéro, communiqué au client ou au fournisseur. | `Number(count) + 1`, contrôle des doublons existants, puis séquence ou contrainte unique. |

#### 3.4 Chiffres et informations faux à l'écran (20 constats)

| Gravité | ID | Page | Ce que voit l'utilisateur | Correction |
|---|---|---|---|---|
| Haute | DLC-01 | DLC, alerte de l'accueil | Un produit marqué « traité » avant expiration disparaît pour toujours du filtre « Expirés », du compteur rouge et de l'alerte (sécurité alimentaire). | Retirer l'exclusion « traité » du filtre et du compteur des expirés (la garder pour « expire bientôt ») ; adapter tri et grisage ; aligner la version mémoire. |
| Haute | ANA-04 | Statistiques | « Montant total » environ deux fois trop élevé (BL et facture additionnés). | Montant de référence par livraison (facture, sinon BL) partout ; HT ou TTC dans le libellé. |
| Haute | ECHE-02 | Échéancier | « Montant TTC » et total du mois à 0,00 € pour certaines factures, re-vérifiées à chaque ouverture. | TTC écrit seulement s'il est supérieur à 0 ; HT réécrit seulement s'il manque ; NOCO-02 (annexe 03) d'abord ; « — » à l'écran si le TTC est inconnu. |
| Haute | DASH-28, DB-09 | Accueil (tél.) | « 1 254 Commandes » : totaux historiques présentés comme l'activité du jour ; tout l'historique est téléchargé ; un appel part vers une adresse inexistante. | Supprimer l'appel `/api/stats/dashboard` ; début = fin = aujourd'hui ; libellés « Commandes du jour », « Livraisons du jour ». *Appel supprimé et dates du jour : faits par le lot 1 ; restent les libellés.* |
| Moyenne | DASH-26, CAL-11 | Calendrier (statistiques du mois) | « Palettes » et « Colis » faux (unités mélangées, « Colis » = nombre de livraisons) ; « en attente » toutes dates confondues. | `SUM(quantity) FILTER (WHERE unit = 'palettes')` et idem pour les colis ; « Commandes en attente (toutes dates) » ; supprimer le retour de données fictives. |
| Moyenne | DLC-14, DASH-27 | DLC, Accueil | Les compteurs ne correspondent pas aux listes : « Actifs » inclut « Expire bientôt », les produits du jour comptent deux fois, « Produits expirés (3) » au-dessus de 4 lignes ; entre minuit et 2 h, date de la veille. | Une seule définition SQL des catégories (expiré, bientôt, correct, épuisé, traité, validé) partagée par compteurs et listes ; date du jour en heure de Paris (T5). (M) |
| Moyenne | BACKUP-02 | Paramètres › Sauvegardes | Une sauvegarde ratée reste « En cours » et s'affiche comme « Dernière sauvegarde ». | Statut `failed` dans le `catch` (sortir `id` et `filepath` du `try`), fichier partiel supprimé ; seules les sauvegardes terminées comptent ; bandeau si la dernière a échoué. |
| Moyenne | NOCO-01 (annexe 03) | Rapprochement | Une micro-coupure du service de factures affiche une croix rouge « facture introuvable » et bloque la validation 12 à 24 h. | Erreurs techniques non mises en cache (ou 2 à 5 min) ; statut distinct, icône orange « Vérification indisponible, réessayer ». |
| Moyenne | NOCO-02 (annexe 03) | Rapprochement | Les factures validées sont re-vérifiées après 6 h au lieu d'être lues dans le cache ; le TTC reste périmé. | `expiresAt`, `invoiceAmountTTC` et `groupId` ajoutés au `set` de l'upsert. |
| Moyenne | RAPPRO-12 | Rapprochement | Les livraisons d'un fournisseur « automatique » validées depuis Livraisons ou le Calendrier n'apparaissent dans aucun onglet : elles échappent au contrôle. | Réconciliation automatique aussi dans `/validate`, ou onglet « Automatiques en attente ». |
| Moyenne | PUB-03 | Publicités | La colonne « Créé par » affiche « Utilisateur » ou un identifiant technique. | Joindre le créateur (sans mot de passe) ou retirer la colonne du tableau. |
| Moyenne | AVOIRS-API-05 | Avoirs | Le système externe reçoit « Unknown » ou « Fournisseur » au lieu du vrai nom du fournisseur. | Relire l'avoir (`getAvoir`) après création, et après modification si le fournisseur change. |
| Moyenne | CMDCLI-30 | Commandes clients | Le code-barres de l'étiquette peut ne pas correspondre au produit : la caisse scanne un autre article, ou rien. | Encoder le code tel quel (EAN13, EAN8 ou CODE128 selon sa forme) et imprimer la valeur sous l'image. |
| Moyenne | ANA-12 | Statistiques | Au survol du camembert : « 0 : 34 » au lieu du nom du fournisseur. | `nameKey="supplierName"` sur le `<Pie>`. |
| Basse | ANA-23 | Statistiques | Le taux de rapprochement baisse dès qu'il y a des livraisons futures dans la période. | Calcul sur les livraisons livrées, précisé dans le libellé. |
| Basse | BACKUP-08 | Paramètres › Sauvegardes | Sans configuration enregistrée, désactiver les sauvegardes affiche « activées » ; l'interrupteur ne bascule qu'après un rechargement. | Mettre le cache à jour avec la réponse et construire le message à partir de la nouvelle valeur. |
| Basse | DB-20 | Paramètres (diagnostic) | Le diagnostic affiche toujours « cache absent » et charge toute la table des livraisons pour compter. | Comptages SQL, clé de cache corrigée, même format de réponse. |

#### 3.5 Mauvais magasin à l'écran, listes vides à tort (10 constats)

Correctif de fond : T3, et le principe 8 de P1 (le magasin actif est toujours visible et toujours défini).

| Gravité | ID | Page | Ce que voit l'utilisateur | Correction |
|---|---|---|---|---|
| Haute | DASH-01 | Accueil | Manager ou directeur : « Aucune tâche en cours » en permanence ; commandes et livraisons d'un autre magasin que celui choisi ; statistiques de tous ses magasins. | Envoyer le magasin pour tous les rôles dès qu'il est choisi, comme Commandes et Tâches. |
| Haute | DASH-03, SHELL-02 | Accueil | Admin avec un magasin choisi : chiffres et tâches de tous les magasins affichés comme ceux du magasin, puis remplacés ; trois gros téléchargements faits deux fois. | `enabled: !!user` sur les requêtes de l'accueil ; définitivement : T4. (M) *Fait par le lot 1.* |
| Haute | TASKS-02 | Tâches | Un employé arrive sur « Aucune tâche trouvée » sans moyen d'en sortir : il ne voit pas les tâches qui lui sont confiées. | Côté client seulement : présélectionner l'unique magasin de tout non-admin, sélecteur pour les employés multi-magasins, état vide « Choisissez un magasin ». Le serveur ne change pas (choix délibéré, voir le verdict). |
| Haute | MOB-AVOIRS-01 | Avoirs (tél.) | En « Tous les magasins », « Aucun avoir trouvé » alors qu'il en existe. | Appeler `/api/avoirs` sans magasin (le serveur filtre déjà par rôle), sinon message « Choisissez un magasin ». |
| Haute | DLC-10 | DLC (tél.) | « Aucun produit trouvé » tant qu'aucun magasin n'est choisi (employé non initialisé, manager multi-magasins, admin) : faux sentiment de sécurité. | Appel sans magasin ou état vide explicite avec un bouton vers le choix du magasin. |
| Moyenne | DLC-15 | DLC | Un directeur qui a choisi un magasin voit les produits de tous ses magasins mélangés, sans colonne Magasin ; les cartes changent de chiffres au rechargement. | Toujours envoyer le magasin ; hook partagé `useDlcStats(storeId)` pour l'accueil et la page DLC. |
| Moyenne | SRV-07 | Commandes, Livraisons, Calendrier | Manager ou directeur multi-magasins sans sélection : seul le premier magasin est renvoyé, sans le dire ; la liste et les statistiques ne portent pas sur le même périmètre. | Une règle unique (magasin toujours défini, P1 § 2.5) et le magasin concerné affiché. |
| Moyenne | AVOIRS-12 | Avoirs | « Nouvel avoir » rouvre avec les données du précédent (risque de doublon) ; le magasin proposé ignore le magasin choisi (un admin crée sur le magasin 1). | À l'ouverture et après succès : formulaire vidé, magasin = magasin sélectionné ou magasin par défaut. |
| Moyenne | SAV-07 | SAV | Un admin qui travaille sur le magasin B crée le ticket dans le magasin A (premier par ordre alphabétique) ; le ticket disparaît de sa vue. | Magasin initialisé avec le magasin sélectionné ou l'unique magasin ; plus de repli sur le magasin 1. |

#### 3.6 Actions qui échouent, boutons proposés à tort (21 constats)

Correctif de fond : T7.

| Gravité | ID | Page | Ce que voit l'utilisateur | Correction |
|---|---|---|---|---|
| Haute | ORD-01 | Commandes fournisseurs, Calendrier | Aucune commande ne peut être modifiée : « Impossible de modifier la commande ». | `EditOrderModal.tsx` : appeler `apiRequest` avec l'adresse en premier, puis `'PUT'`, puis les données (arguments inversés aujourd'hui) ; typer `method` pour éviter la récidive. |
| Haute | MOB-02 | Commandes et Livraisons (tél.) | « Date inconnue » partout, badges « Aujourd'hui » et « En retard » jamais affichés, onglet « Reçues » vide, recherche par numéro sans résultat. | Vrais champs (`scheduledDate`, `plannedDate`), filtre « livrée » au lieu de « reçue », badge « Planifiée », numéro remplacé par l'identifiant. |
| Haute | MSAV-01 | SAV (tél.) | Liste toujours vide, création en erreur avec du HTML, changement de statut sans effet : le SAV est inutilisable sur téléphone. | Vraies adresses `/api/sav/tickets` (GET, POST, PATCH) ; hook `useSavTickets()` commun PC et téléphone. |
| Haute | MSAV-02 | SAV (tél.) | Même réparé, chaque changement de statut serait refusé ; « Attente échange » est impossible à gérer. | Statuts du serveur (`en_cours`, `attente_pieces`, `attente_echange`, `resolu`, `ferme`) dans une configuration partagée avec le PC. |
| Haute | AVOIRS-04 | Avoirs | Pour un directeur ou un employé, « Envoyer fichier avoir » échoue toujours ; pour l'admin, l'envoi dépend du service externe et l'adresse du webhook est visible. | Route `POST /api/avoirs/:id/send-file` : contrôle d'accès, adresse lue en base, relais du fichier. Qui envoie : décision D2. (M) |
| Haute | TASKS-09 | Tâches (tablette) | Sur tablette (768 à 1 024 px), ni recherche ni filtres ; la vue Kanban est vide. | `lg:hidden` au lieu de `sm:hidden` sur le bouton Filtres et contenu Kanban ajouté ; mieux : un seul rendu (TASKS-31). |
| Moyenne | LIV-01 | Livraisons | Le filtre « En attente » renvoie toujours « Aucune livraison trouvée » : l'utilisateur croit n'avoir rien à recevoir. | Retirer l'option (statut inexistant) ; libellé « À recevoir » pour les livraisons planifiées : décision D12. |
| Moyenne | MOD-02 | Toutes les fenêtres | Session expirée : « Impossible de créer la commande » sans explication ; si la redirection se déclenchait, page brute « Cannot GET /api/login ». | Motif `/^401\b/` et les 25 `"/api/login"` remplacés par `"/auth"` dans le même changement ; ensuite, gestion centrale (P1, A12). |
| Moyenne | TASKS-25 | Tâches (tél.) | « Tâche terminée » ou « Tâche supprimée » affiché alors que le serveur a refusé ou échoué. | Passer par `apiRequest` et afficher l'erreur du serveur. *Fait par le lot 1.* |
| Moyenne | CMDCLI-10 | Commandes clients | « Confirmer » ne fait rien, la fenêtre reste ouverte, aucun message : les échecs de statut ou de contact sont invisibles. | `onError` avec message en français sur les 6 mutations ; droits sur le contact client : décision D8. |
| Moyenne | USERS-04 | Utilisateurs | Identifiant ou e-mail déjà pris : seulement « Impossible de créer l'utilisateur », sans savoir quoi corriger. | Helper `getApiErrorMessage(error, défaut)` qui extrait le message du serveur (P1, A12). |
| Moyenne | USERS-08 | Utilisateurs | Impossible de filtrer les directeurs ou d'en créer un directement. | Liste ordonnée `ROLE_OPTIONS` dans `roleUtils.ts`, utilisée par le filtre, la création et la modification. |
| Moyenne | GROUPS-07 | Magasins | Sans configuration NocoDB, le champ Webhook n'apparaît pas : envoi de factures et d'avoirs impossible depuis l'interface. | Sortir le bloc Webhook de la condition NocoDB. |
| Moyenne | WEATHER-01 | Paramètres › Météo | Après avoir remplacé « Nancy » par « Metz », l'en-tête montre l'ancienne ville jusqu'au lendemain. | Vider le cache météo si la ville change ; invalider `['/api/weather/current']` côté client. |
| Moyenne | AVOIRS-10 | Avoirs | « Valider » proposé aux managers et employés, qui reçoivent un message rouge avec « 403 » et du JSON. | Ajouter `&& canEditDelete` à la condition d'affichage. |
| Moyenne | DLC-13 | DLC (tél.) | « Valider (Sortir) » proposé à tous : refusé en silence aux employés, sans confirmation pour les autres. | Masqué selon le droit, `onError` avec message ; confirmation à valider avec D7. |
| Basse | AVOIRS-18 | Avoirs | Le menu de statut est grisé pour un avoir validé, même pour l'admin qui a le droit de le modifier. | Trancher la règle : grisé sauf pour l'admin, ou suppression de la branche admin inutile. |
| Basse | USERS-18 | Utilisateurs | « Minimum 6 caractères » est annoncé, mais un mot de passe d'un caractère est accepté. | Une règle unique, appliquée dans les deux schémas serveur et rappelée sous le champ. |
| Basse | API-05 | Fiches fournisseurs, Contacts | Une saisie invalide apparaît comme une panne du serveur (erreur 500). | `ZodError` traduite en 400 avec le détail dans les PUT fournisseur et contact. |
| Basse | BAP-03 | Paramètres › BAP | Saisie invalide affichée comme « 500: {"error": …} » ; formulaire pré-rempli avec une adresse jamais saisie. | 400 « URL ou champs invalides » ; configuration factice supprimée (réponse `null`). |
| Basse | DLC-48 | DLC (tél.) | Un ancien produit sans nom fait planter la recherche dès la première lettre. | `(p.productName ?? p.name ?? '').toLowerCase()`. |

#### 3.7 Listes qui ne se mettent pas à jour (7 constats)

Correctif de fond : T3.

| Gravité | ID | Page | Ce que voit l'utilisateur | Correction |
|---|---|---|---|---|
| Haute | SAV-01 | SAV | Pendant 5 minutes, un ticket créé n'apparaît pas, un ticket supprimé reste affiché (second clic : « Ticket not found »), un statut modifié reste l'ancien : l'utilisateur recommence et crée des doublons. | Clé structurée `['/api/sav/tickets', filtres]`, ou invalidation par préfixe ; après un commentaire, n'invalider que le détail. Correctif minimal relevé pendant le lot 1 : un prédicat `startsWith('/api/sav/tickets')` dans les 4 mutations. |
| Haute | CONT-01 | Contacts | « Contact créé avec succès », mais le contact n'apparaît pas ; une carte supprimée reste affichée. | Clé `['/api/contacts', { groupId }]` pour que l'invalidation existante fonctionne. *Fait par le lot 1.* |
| Haute | AVOIRS-03 | Avoirs | Avec un magasin choisi (cas courant), un avoir validé reste dans « En cours » ; après « Dévalider », il reste « Validé » jusqu'au rechargement. | Invalider toutes les clés qui commencent par `/api/avoirs` ; normaliser la clé ensuite. *Fait par le lot 1.* |
| Moyenne | ORD-05 | Commandes, Livraisons, Calendrier | Après une suppression ou une validation depuis la fiche, la liste ne change pas ; les statistiques du mois ne se mettent jamais à jour. | Clés harmonisées pour les commandes et les statistiques ; invalidation des commandes et statistiques après chaque modification de livraison. (M) |
| Moyenne | CMDCLI-15 | Commandes clients | « Marquer appelé » depuis la fenêtre des appels : l'icône téléphone reste grise dans le tableau (risque de double appel). | Invalider toutes les clés qui commencent par `/api/customer-orders`. |
| Moyenne | DASH-38, TASKS-06 | Accueil, Tâches, DLC | Les données dépendent de la page visitée en premier : après l'accueil, Tâches affiche une liste vide ; les compteurs DLC diffèrent entre l'accueil et la page DLC. | Une clé = exactement l'adresse appelée, construite par une seule fonction (`useTasks`, `useDlcStats`) ; retirer ensuite le « FORCE REFRESH » de Tâches. (M) *En partie fait par le lot 1 : Tâches a sa propre clé ; l'accueil attend DASH-01.* |

#### 3.8 Dates, fuseaux horaires et calendrier (12 constats)

Correctif de fond : T5.

| Gravité | ID | Page | Ce que voit l'utilisateur | Correction |
|---|---|---|---|---|
| Haute | DLC-02 | DLC | Le jour J, le produit est dans « Expirés » avec un badge orange « Expire bientôt », sans bouton « Valider » ni « Marquer traité » : le retrait est oublié. | Utilitaire partagé (`shared/dlc.ts`) : jours restants en jours calendaires, seuils uniques (0 ou moins = expiré, 1 à 15 = bientôt) pour PC, téléphone, alerte et SQL. |
| Moyenne | TASKS-12 | Tâches (PC et tél.) | Une tâche due aujourd'hui s'affiche « En retard de 0 jour » en rouge ; une tâche due demain « Dans 0 jour ». | `parseISO` puis `differenceInCalendarDays`, dans un helper commun PC et téléphone. |
| Moyenne | TASKS-11 | Tâches | « En retard » affiche aussi les tâches sans échéance ; « Cette semaine » commence le dimanche. | Tâches sans date exclues des filtres datés ; semaine commençant le lundi (`weekStartsOn: 1`). |
| Moyenne | DASH-18 | Accueil | Badge « -4 jour » ou « 3 jours » sans savoir s'il s'agit d'un retard ; rouge seulement après 10 jours. | « En retard de X j » en rouge si la date est passée, sinon « Prévue le 12 oct. » ; retards en premier. |
| Moyenne | CAL-01 | Calendrier | Le 29, 30 ou 31, « mois suivant » saute un mois : les commandes du mois suivant semblent absentes. | Naviguer à partir du 1er du mois (`addMonths(startOfMonth(d), 1)`). |
| Moyenne | PUB-09 | Publicités | Une promotion s'affiche « Terminée » le jour où elle est encore en rayon ; le calendrier omet son premier jour ; « En cours » est faux. | Helper `getPublicityStatus` qui compare des dates `yyyy-MM-dd`, utilisé par les badges, les compteurs, l'export et le calendrier. |
| Moyenne | PUB-10 | Publicités | Numéros de semaine décalés certaines années (pas ISO), alors que les plans promo sont en semaines ISO. | `getISOWeek`. |
| Moyenne | ANA-09 | Statistiques | « Ce mois » inclut le dernier jour du mois précédent, « Cette semaine » le dimanche d'avant. | Dates calendaires `yyyy-MM-dd` envoyées et utilisées telles quelles par le serveur. |
| Moyenne | ANA-10 | Statistiques | Pic faux en fin d'année : les derniers jours de décembre sont comptés dans la semaine 1 de la mauvaise année. | Format `IYYY-IW` ; libellé « Sem. 45 – 2026 ». |
| Basse | CAL-05 | Calendrier | Les jours des mois voisins sont affichés mais toujours vides : une livraison du 1er du mois suivant n'apparaît pas. | Requêter exactement la plage de la grille (42 jours à partir du lundi) ; sur téléphone, de début à fin de semaine. |
| Basse | CAL-13 | Calendrier | La fenêtre « +X autres » affiche la date de création au lieu de la date prévue. | Date prévue de la commande ou de la livraison. |
| Basse | DASH-43 | En-tête | Sur un poste resté ouvert la nuit sans changer de page, la date de la veille reste affichée. | Hook `useToday()` qui se réarme à minuit, ou date déplacée dans l'accueil (P1 § 2.5). |

#### 3.9 Fenêtres, formulaires et plantages d'écran (10 constats)

| Gravité | ID | Page | Ce que voit l'utilisateur | Correction |
|---|---|---|---|---|
| Haute | DASH-02, DLC-08 | Accueil | La fenêtre d'alerte DLC se rouvre dès qu'on la ferme (croix, Échap, clic à côté) : l'employé est bloqué tant qu'il ne trouve pas « Traiter plus tard (2h) ». | Toute fermeture = mise en sourdine pour la session ; ouverture automatique une seule fois par chargement (`useRef`). |
| Moyenne | SAV-08 | SAV | « Nouveau ticket » s'ouvre pré-rempli avec le dernier ticket modifié : risque de ticket mélangé ou en double. | États séparés pour la création et la modification (le brouillon de création reste conservé). |
| Moyenne | SHELL-17 | Toutes les pages | Les boutons principaux et « Supprimer » ne changent pas au survol : rien n'indique qu'ils sont cliquables. | Couleurs au format « canaux » dans `tailwind.config.ts`, puis vérification visuelle (P1, A4). |
| Basse | AVOIRS-20 | Avoirs | Après chaque envoi de fichier, un minuteur continue de tourner : la page entière se redessine chaque seconde, avec un minuteur de plus à chaque envoi ; la fenêtre d'attente peut être fermée pendant l'envoi. | Minuteur dans un `useRef`, arrêté en fin d'envoi et au démontage ; fenêtre non fermable pendant l'envoi. Plus grave que la gravité notée (voir le verdict). |
| Basse | RAPPRO-25 | Rapprochement | Quitter la page pendant un envoi laisse tourner le minuteur de la fenêtre d'attente. | Même correction (`useRef` et nettoyage au démontage). *Fait par le lot 1.* |
| Basse | ORD-07 | Commandes, Livraisons | Écran blanc possible si le rôle change pendant la session (« Rendered more hooks than expected »). | Contrôle du rôle dans un composant enveloppe, ou garde de route commune (`ProtectedRoute`, P1 § 2.2). |
| Basse | RAPPRO-24 | Rapprochement | Même risque d'écran blanc. | Extraire `<BLReconciliationContent/>`. |
| Basse | NOCO-05 | Paramètres › NocoDB | « Nouvelle configuration » rouvre avec la précédente : risque de doublon. | `createForm.reset()` après succès. |
| Basse | SHELL-27 | Connexion (développement) | La connexion peut planter en développement (hook appelé dans une fonction asynchrone). | Importer `queryClient` au lieu d'appeler le hook ; une seule implémentation (AUTH-09). *SHELL-27 : fait par le lot 1.* |

#### 3.10 Connexion, sessions et serveur (9 constats)

| Gravité | ID | Page | Ce que voit l'utilisateur | Correction |
|---|---|---|---|---|
| Haute | ADMIN-01 | Paramètres, toutes les pages | À l'ouverture de Paramètres, l'admin voit « Accès refusé », puis un second, puis un chargement ; `/api/user` est appelé cinq fois ou plus par écran. | Hook utilisateur unique (T4) ; squelette tant que l'utilisateur charge. (M) *Hook unique fait par le lot 1 ; vérifier qu'aucun « Accès refusé » ne clignote plus.* |
| Moyenne | AUTH-06, INFRA-08 | Toutes | Chaque redéploiement ou redémarrage déconnecte tous les magasins ; la mémoire du serveur grossit lentement. | Sessions en base avec `connect-pg-simple` (déjà installé) et `app.set('trust proxy', 1)`. Proposition : les sessions survivent aux déploiements. |
| Moyenne | INFRA-11, TASKS-36 | Toutes (dev et `npm start` seulement) | Apostrophes, dates et adresses enregistrées sous la forme `&#x27;` ; la recherche « l'entrepôt » ne trouve rien. L'image Docker n'est pas touchée. | Retirer `validator.escape` de la sanitisation globale (React protège déjà l'affichage) ; attention aux mots de passe créés dans ce mode (verdict) ; à faire avant d'unifier les points d'entrée. |
| Moyenne | AUTH-07 | Connexion (`npm start` seulement) | Avec `npm start`, la connexion et toutes les écritures sont refusées (403, message en anglais). | Si le CSRF est gardé : en-tête `x-csrf-token` envoyé par `apiRequest`, et tous les `fetch` d'écriture passent par lui ; exemption corrigée en `/api/webhook/`. Sinon, aligner `npm start` sur l'image Docker. |
| Basse | AUTH-08 | Connexion (dev et `npm start`) | Au-delà de 5 connexions en 15 minutes depuis la même adresse (tout un magasin derrière une box), la suivante est refusée avec « Identifiant ou mot de passe incorrect ». | Message dédié pour le statut 429 ; côté serveur, `skipSuccessfulRequests: true` et plafond adapté. |
| Basse | INFRA-15 | Toutes | Certaines erreurs (JSON invalide, corps trop gros) coupent la connexion : le navigateur affiche une erreur réseau au lieu du message. | Gestionnaire d'erreurs sans `throw`, qui respecte `res.headersSent`. *Fait par le lot 1.* |
| Basse | INFRA-17 | Toutes | Un lancement Docker sans la variable `NODE_ENV` peut utiliser le mauvais pilote de base de données (échec ou lenteur). | `ENV NODE_ENV=production` dans l'étape production du `Dockerfile`. *Fait par le lot 1.* |

---

### 4. Dette technique

La dette n'est pas visible à l'écran, mais elle fabrique des bugs : tant que trois copies d'un même écran coexistent, chaque correction risque de n'en toucher qu'une. Le nettoyage se fait **en quatre temps** : supprimer ce qui ne sert à rien (sans risque), retirer les traces de debug, fusionner les copies, puis consolider la base de données.

#### 4.1 Code mort à supprimer

**Fichiers entiers.** Chacun a été vérifié par recherche dans tout le dépôt : aucun fichier ne l'importe. Total : environ 3 700 lignes, plus 36 fichiers temporaires.

| Fichier(s) | Lignes | Pourquoi on peut le supprimer | Précaution | Constats |
|---|---|---|---|---|
| `client/src/components/tasks/NewTaskForm.tsx`, `TaskFormClean.tsx`, `SimpleTaskFormClean.tsx`, `TaskFormProduction.tsx`, `TaskFormUltraSimple.tsx`, `TaskForm.tsx`, `SimpleTaskForm.tsx`, `RecentTasksCard.tsx`, et `client/src/components/ResponsiveTasks.tsx` | 2 030 | Huit formulaires et cartes de tâches jamais importés. Plusieurs appellent une route PATCH qui n'existe pas et créent les tâches dans le magasin 1. Seul le formulaire intégré à `Tasks.tsx` est utilisé. | Aucune : les seules références sont internes (`TaskForm.tsx` réexporte `TaskFormUltraSimple`). | TASKS-32, DASH-45 |
| `client/src/components/ResponsiveDashboard.tsx`, `ResponsiveOrders.tsx`, `ResponsiveDeliveries.tsx`, `ResponsiveCalendar.tsx` | 64 | Jamais importés : le routeur choisit directement la page PC ou téléphone. | Aucune. | SHELL-26, DASH-45 |
| `client/src/hooks/useAuth.ts`, `client/src/hooks/useAuthProduction.ts` | 97 | Deux des quatre hooks d'authentification, jamais importés (le lot 1 en a fait de simples renvois vers le hook unifié). | Aucune. `useAuthSimple.ts` est utilisé par le menu : il se fusionne (§ 4.2, A). | SHELL-26 |
| `client/src/hooks/use-phone-mode.ts`, `client/src/components/PhoneBottomNav.tsx` | 228 | Troisième système de détection « téléphone » et ancienne barre du bas, jamais utilisés. | Aucune. | SHELL-26, SHELL-25 |
| `client/src/components/ToasterRobust.tsx`, `client/src/hooks/use-toast-robust.ts` | 170 | Second système de notifications, jamais branché. | Aucune. | SHELL-26 |
| `client/src/pages/Landing.tsx` | 132 | Ancien écran d'accueil ; ses boutons mènent vers une route qui n'existe pas. | Aucune. | LAND-01 |
| `client/src/components/AuthInfo.tsx` | 96 | Jamais importé (vérifié pendant la rédaction de ce plan ; absent de l'annexe). | Aucune. | — |
| `client/src/pages/SalesAnalysisConfig.tsx`, `client/src/pages/SalesAnalysisPage.tsx` | 215 | Pages jamais routées ni présentes dans le menu. | Décision D13 (proposé : supprimer, avec la colonne `utilities.sales_analysis_url` dans une migration). | SALES-01 |
| `client/src/components/ui/*.tsx.tmp` (36 fichiers) | — | Fichiers temporaires versionnés par erreur. | Aucune. | SHELL-26 |
| `client/public/nocodb-protection-patch.js`, `client/public/nocodb-urgent-fix.js` | 93 | Référencés nulle part, mais copiés dans le build et servis publiquement ; le premier remplace `console.error` et masquerait les erreurs s'il était rebranché. | Aucune. | SHELL-26 |
| `server/cache.ts` | 118 | *Supprimé par le lot 1.* Il n'était jamais importé, et sa « compression » posait l'en-tête gzip sans compresser. | Les réponses sont désormais compressées par le paquet `compression` dans `index.production.ts` (lot 1). | DB-32, INFRA-19, DASH-45 |
| `server/db.production.ts` | 56 | Jamais importé. | Aucune. | INFRA-19 |
| `server/monitoring.ts` | 150 | Jamais importé. | Le brancher un jour (derrière `requireAdmin`) est un chantier séparé ; il reste dans l'historique git. | INFRA-19 |
| `server/localAuth.production.ts` | 284 | Importé par `server/index.production.ts:8` mais jamais appelé : la connexion réelle passe par `server/localAuth.ts` via `routes.ts`. | **Retirer d'abord l'import**, sinon le build Docker (esbuild) échoue. Reprendre sa configuration de session PostgreSQL et `trust proxy` pour AUTH-06 avant de le supprimer. | LAND-01, INFRA-19, INFRA-08 |

**À conserver** malgré les apparences : `server/migrations.ts` (utilisé par `scripts/create-migration.js`) et `server/migrations.production.ts` (exécuté au démarrage Docker).

**Code mort à l'intérieur des fichiers**

| Où | Quoi | Constats |
|---|---|---|
| `server/routes.ts` | Routes en double `POST` et `DELETE /api/users/:id/groups` (vers la ligne 4461) : jamais atteintes, les premières répondent toujours. | USERS-22 |
| `server/routes.ts` | Route `GET /api/ad-campaigns/debug` exposée (messages d'erreur internes) ; deux routes de suppression des publicités en double, à remplacer par un seul handler. | PUB-06 |
| `server/routes.ts`, `server/localAuth.ts`, `server/index.production.ts` | `/api/health` déclaré trois fois ; seul celui de `routes.ts:174` répond (garder celui-là, utilisé par le contrôle de santé Docker). | INFRA-19 |
| `server/storage.ts` | `getSavTickets` attend un historique par ticket qui renvoie toujours un tableau vide. | DB-26 |
| `OrderDetailModal.tsx` | Mutation `validateDeliveryMutation` jamais utilisée ; rôles codés en dur au lieu de `hasPermission`. | MOD-07 |
| `SQLExecutor.tsx` | Bouton « SQL Webhook BAP » obsolète, qui peut écraser un script en cours. | SQL-03 |
| `Users.tsx`, `Groups.tsx`, `Suppliers.tsx` | Blocs de gestion du 401 jamais déclenchés (11 copies, dont environ 120 lignes dans Utilisateurs et Magasins) : le 401 est déjà géré globalement. À remplacer par un helper commun `onApiError(toast, message)`. | USERS-16, SUPP-10 |
| Pages | Imports, variables, fonctions et requêtes inutilisés : Accueil (DASH-45), Avoirs (AVOIRS-21), Avoirs tél. (MOB-AVOIRS-10), Publicités (PUB-28, la requête des magasins est remplacée par `useStore()`), Commandes clients (CMDCLI-43, `alert()` remplacé par un message), SAV (SAV-17, requête de détail déclarée deux fois), SAV tél. (MSAV-08), Rapprochement (RAPPRO-23), Tâches (TASKS-33), Statistiques (ANA-20), NocoDB (NOCO-02, annexe 12), Fiches fournisseurs (SUPP-13, casts `as any`). | voir à gauche |
| `Layout.tsx`, `Sidebar.tsx` | Branches « téléphone » inatteignables (le cadre PC n'est jamais affiché sur téléphone). À retirer avec la décision « PC ou téléphone choisi au démarrage » (P1 § 2.6). | SHELL-25 |
| `client/src/index.css` | 62 `!important` ; commencer par les blocs sans effet (`.phone-mode`, `ring: 0`), puis retirer les surcharges de `.bg-blue-600` et des anneaux de focus avec vérification visuelle (P1, A3). | SHELL-19 |

#### 4.2 Copies à fusionner

Chaque fusion supprime une source de bugs. Les plus importantes d'abord.

**A. Quatre hooks d'authentification → un seul** (SHELL-01, ADMIN-01, SHELL-27, AUTH-09, ADMIN-02)

*Fait pour l'essentiel par le lot 1 (P4 § 2.2) : un seul hook basé sur React Query, dont les trois autres sont devenus des alias, et `/api/user` qui renvoie l'utilisateur de la session. Restent l'écran de connexion à implémentation unique (AUTH-09) et le retrait progressif des alias. La description ci-dessous reste la référence.*

- Aujourd'hui : `useAuthUnified` (241 lignes, appelé dans 49 fichiers) refait son propre `fetch('/api/user')` à chaque instance en production ; `useAuthSimple` (menu) en refait un autre ; `useAuth` et `useAuthProduction` sont morts. Résultat : cinq appels ou plus par écran, des écrans « Accès refusé » qui clignotent, des requêtes lancées avant de connaître le rôle (DASH-03, SHELL-02), et un comportement différent entre développement et production.
- Cible : un seul hook basé sur `useQuery({ queryKey: ['/api/user'] })`, avec un `queryFn` **dédié** qui renvoie `null` sur 401 **sans rediriger** (le `queryFn` par défaut renvoie vers `/auth` et rechargerait la page d'un visiteur), `staleTime` de 5 minutes, sans nouvel essai. Même forme de retour qu'aujourd'hui (`user`, `isLoading`, `isAuthenticated`, `refreshAuth`, `forceAuthRefresh`) ; `useAuthUnified` et `useAuthSimple` deviennent de simples alias, remplacés au fil de l'eau ; la branche `isDevelopment` disparaît.
- Après la connexion : `invalidateQueries({ queryKey: ['/api/user'] })` et non `setQueryData` (la réponse de `/api/login` ne contient pas les magasins, que lit le formulaire de commande client).
- Écran de connexion : une seule implémentation (`useMutation` + `apiRequest`), bouton désactivé jusqu'à la redirection (AUTH-09).
- Serveur : `/api/user` renvoie directement `req.user`, déjà complet grâce à `deserializeUser` (4 requêtes SQL de moins par appel, ADMIN-02).

**B. Formulaires et cartes de tâches** (TASKS-31, TASKS-32)

- Aujourd'hui, après suppression des neuf fichiers morts (§ 4.1) : `Tasks.tsx` (1 633 lignes) contient six copies du balisage des cartes et deux copies des filtres ; la page téléphone `mobile/TasksPage.tsx` (487 lignes) a son propre formulaire, sa propre configuration des priorités et sa propre recherche. D'où des bugs présents dans une seule variante (TASKS-09, TASKS-12, TASKS-25).
- Cible, utilisée par le PC et le téléphone : `useTasks` (requête et mutations, règle aussi TASKS-06), `taskUi.ts` (dates et priorités), `<TaskCard variant>`, `<TaskFilters>`, `<TaskFormDialog>`. Un seul jeu d'actions par statut (« À faire » : Terminer, Modifier, Supprimer ; « Terminée » : Rouvrir, Supprimer). À faire avec la refonte de la page Tâches (P2 § 2).

**C. Deux points d'entrée serveur** (INFRA-10, INFRA-19, AUTH-06, AUTH-07, AUTH-08, INFRA-11)

- Aujourd'hui : `server/index.ts` (développement et `npm start`) applique en-têtes de sécurité, limitation de débit, sanitisation et CSRF ; `server/index.production.ts` (image Docker) n'en applique aucun. Ce qui est testé en développement n'est pas ce qui tourne en production. S'y ajoutent `localAuth.production.ts` et `db.production.ts`, morts.
- Cible : un fichier `server/app.ts` avec une fonction `createApp(options)` (lecture des requêtes, sécurité, fichiers statiques, routes, tâches de maintenance, gestionnaire d'erreurs corrigé par INFRA-15), appelée par les deux points d'entrée. Le script `start` de `package.json` lance le même bundle que Docker, ou disparaît.
- Prérequis, dans cet ordre : retirer l'échappement HTML de la sanitisation (INFRA-11) ; envoyer l'en-tête CSRF depuis `apiRequest` si le CSRF est gardé (AUTH-07) ; limitation de débit avec `trust proxy` et `skipSuccessfulRequests` (AUTH-08) ; sessions en base (AUTH-06) ; seulement ensuite, suppression de `localAuth.production.ts`.

**D. Deux tables de droits** (PERM-01 annexes 02 et 10, SHELL-11, MOD-07)

- Aujourd'hui : `client/src/lib/permissions.ts` (utilisée par Calendrier, `OrderDetailModal`, `QuickCreateMenu`, Utilisateurs, Paramètres, Sauvegardes) contredit `shared/permissions.ts` (Commandes, Livraisons, Rapprochement, Commandes clients et serveur), et d'autres règles sont codées en dur dans le menu, la barre du bas et les routes.
- Cible : P1 § 2.2. **Piège** : le module `backups` et l'action `manage` n'existent que côté client ; les ajouter à `shared/permissions.ts` **avant** de supprimer le fichier client, sinon l'admin perd la gestion des sauvegardes. Les décisions D1 à D11 doivent être prises avant, car l'unification change ce que voient les employés.

**E. PC et téléphone qui réimplémentent les mêmes écrans**

| Module | Ce qui est recopié | Cible partagée | Constats |
|---|---|---|---|
| Commandes clients | Schéma, recherche d'article, choix du magasin ; les deux versions divergent déjà. | `CustomerOrderForm` avec une variante téléphone, hook `useArticleLookup`. | CMDCLI-32, CMDCLI-06 |
| SAV | Adresses, statuts, requêtes des magasins et fournisseurs. | `useSavTickets()`, configuration des statuts partagée. | MSAV-01, MSAV-02, MSAV-08 |
| Avoirs | Schéma de formulaire et traitement du montant. | Schéma tiré de `shared/schema.ts` (`insertAvoirSchema`). | MOB-AVOIRS-10, MOB-AVOIRS-05 |
| Publicités | Trois `queryFn` et trois clés différentes pour la même adresse. | `usePublicities({ year, storeId })`. | PUB-34 |
| DLC | Calcul des jours restants et seuils. | `shared/dlc.ts`. | DLC-02, DLC-14 |
| Tâches | Voir B. | — | TASKS-31 |

À terme, P2 vise un seul écran qui s'adapte (tableau sur PC, cartes sur téléphone) : ces hooks partagés en sont la première marche.

**F. Configurations de statuts et de priorités recopiées** (DASH-46, CMDCLI-28)

Priorités de tâches en trois ou quatre copies, types d'information en deux, statuts de commandes clients en trois, statuts SAV différents sur téléphone. Cible : `client/src/lib/statusConfig.ts`, qui porte la palette unique de P1 § 3.3 et alimente `StatusBadge`. Première étape sans risque : extraire les copies identiques sans changer aucun libellé ni couleur.

**G. Appels `fetch()` faits à la main** (CAL-16, ANA-20, CMDCLI-34, SAV-17, WEATHER-03, PUB-06)

Calendrier, Statistiques, Commandes clients sur téléphone, SAV, Météo et Publicités contournent le chargeur commun : pas de gestion de session expirée, pas d'état d'erreur, et une réponse d'erreur peut être mise en cache comme une liste (plantage `suppliers.map is not a function` sur téléphone). Cible : le `queryFn` par défaut (`getQueryFn`) ou un helper `fetchJson(url)` qui lève une erreur lisible, plus le composant `ErrorState` de P1 § 3.6. Le formulaire Météo passe en champs contrôlés.

**H. Copier-coller dans une même page**

| Où | Copie | Cible | Constats |
|---|---|---|---|
| DLC | Sept mutations recopiées, deux fonctions d'impression identiques, un `TooltipProvider` par bouton. | Hook `useDlcAction`, `printList` (avec l'échappement de DLC-26). Le découpage de la page vient après DLC-03, DLC-04, DLC-16 et DLC-19. | DLC-45 |
| Paramètres › NocoDB | Formulaires de création et de modification en double. | `<NocodbConfigFormFields>`. | NOCO-06 |
| Menu latéral | En-tête recopié trois fois. | `<SidebarHeader>`. | SHELL-26 |
| Menu latéral | Fonction d'envoi des BAP (environ 300 lignes) logée dans le menu, avec destinataires et adresse codés en dur. | `BapSendModal` chargé à la demande ; envoi via une route serveur ; destinataires dans la configuration BAP (migration) avant de les retirer du code. | SHELL-29 |
| Publicités (serveur) | Deux routes de suppression. | Un seul handler monté sur les deux chemins. | PUB-06 |

#### 4.3 Traces de debug et journaux

- **Serveur d'abord** (les journaux de production contiennent des données personnelles) : `req.body` et données clients des commandes clients (CMDCLI-39), création de fournisseur (API-04), routes DLC (DLC-35), magasins (GROUPS-14, déjà au lot A du § 1). Règle : seul `console.error` reste, sans corps de requête.
- **Client** : mot de passe SMTP visible dans la console (USERS-15), noms et téléphones clients loggés à chaque frappe (SAV-15), montants et références (AVOIRS-15), Tâches (TASKS-33), Rapprochement (RAPPRO-23), NocoDB (NOCO-02, annexe 12), Statistiques (ANA-20), Fiches fournisseurs (SUPP-10). Le build de production retire déjà `console.log` (`vite.config.ts`), mais pas `console.error` ni `console.warn`, ni les journaux de `npm start`. Ce qui doit rester passe derrière `if (import.meta.env.DEV)`, comme dans `apiRequest`.
- *Déjà fait par le lot 1 (P4 § 2.7)* : journaux serveur de CMDCLI-39 ; journaux navigateur de USERS-15, SAV-15, TASKS-33, NOCO-02 (annexe 12), ANA-20, et en partie SUPP-10.

#### 4.4 Base de données et schéma

| Problème | Risque | Correction | Constats |
|---|---|---|---|
| Les index de performance ne sont pas déclarés dans `shared/schema.ts`. | Un `npm run db:push` sur la base de production les supprimerait tous, sans prévenir. | Tout de suite : avertissement dans le README, « ne jamais lancer `db:push` sur la base de production ». Ensuite : arrêter une liste unique d'index (en réconciliant `init.sql` et la migration 20260814) et la déclarer dans le schéma avec les mêmes noms. | DB-02, DLC-40 |
| `user_groups` n'a ni clé primaire ni contrainte d'unicité. | Affectations en double (voir USERS-03), répétées dans chaque requête authentifiée. | Dédoublonner, puis index unique `(user_id, group_id)` créé `CONCURRENTLY`, et `.onConflictDoNothing()` dans `assignUserToGroup`. | DB-23 |
| Les compteurs DLC sont renvoyés en chaînes de caractères. | « 2 » + « 3 » = « 23 » au premier calcul côté client. | `COUNT(...)::int` ou `.mapWith(Number)`. | DLC-38 |
| SQL brut concaténé dans les statistiques, erreurs avalées. | Requêtes fragiles ; une panne s'affiche « Aucune donnée magasin ». | Helpers Drizzle paramétrés, paramètres validés par Zod, erreurs remontées. | ANA-21 |
| La clé primaire d'un utilisateur est fabriquée par le navigateur à partir de l'e-mail (`_1712…` si l'e-mail est vide). | Identifiants illisibles, clé choisie par le client. | Le serveur génère un UUID (`crypto.randomUUID()`). | USERS-19 |

#### 4.5 Ordre conseillé pour la dette

| Étape | Contenu | Risque | Effort |
|---|---|---|---|
| 1 | Supprimer les fichiers sans importateur du § 4.1 (sauf `localAuth.production.ts`, et les pages d'analyse des ventes si D13 n'est pas tranchée), les `.tmp` et les scripts publics. | Nul : vérifié par recherche. | S |
| 2 | Journaux serveur puis client (§ 4.3) ; routes mortes (USERS-22, PUB-06, `/api/health`) ; avertissement `db:push` dans le README (DB-02). | Très faible. | S |
| 3 | Hook d'authentification unique (§ 4.2, A). *Fait pour l'essentiel par le lot 1.* | Moyen : touche tous les écrans ; tester connexion, déconnexion, session expirée. | M |
| 4 | Table de droits unique (§ 4.2, D), après les décisions D1 à D11. | Moyen : change ce que voient certains rôles. | M |
| 5 | Requêtes et clés centralisées (T3), chargeur commun (§ 4.2, G), configurations de statuts (§ 4.2, F). | Faible à moyen. | M |
| 6 | Point d'entrée serveur unique et sessions en base (§ 4.2, C), puis suppression de `localAuth.production.ts`. | Moyen : à tester sur l'image Docker. | M |
| 7 | Fusion PC et téléphone module par module (§ 4.2, B, E et H), pendant la refonte P2 : Tâches, puis Commandes clients, SAV, Avoirs, Publicités, DLC. | Moyen, découpé par module. | L |
| 8 | Base de données (§ 4.4) : index déclarés, unicité de `user_groups`, compteurs entiers, SQL paramétré, UUID serveur. | Moyen : migrations à tester sur une copie de la base. | M |

---

### 5. Ordre de réalisation global et règles de vérification

Ce calendrier détaille les Phases 1a, 2 et 5 de la [feuille de route](#feuille-de-route).

| Quand | Quoi | Résultat attendu |
|---|---|---|
| Jour 1 | Filets immédiats : clé `password` retirée de toutes les réponses (T1), `escapeHtml` (T8), `requireAdmin` sur les magasins et la météo, journaux contenant des secrets supprimés, champ commentaire SAV masqué. Suppression du code mort (dette, étape 1). | Plus de fuite de mot de passe ni de faille d'impression ; dépôt allégé d'environ 3 200 lignes (le reste attend la décision D13 et l'étape 6). |
| Semaine 1 | Lot A (sécurité) complet. | Chaque magasin ne voit et ne modifie que ses données. |
| Semaine 2 | Lots B et C (données fausses ou perdues, fonctions cassées), puis la liste « Juste après » du § 1. | Chiffres justes, aucune saisie perdue, téléphone utilisable. |
| Semaines 3 et 4 | Correctifs transversaux T2 à T7 et dette, étapes 2 à 6. La plupart des bugs restants des § 3.2 à 3.8 tombent avec eux. | Une seule règle par sujet : accès, magasin actif, dates, formulaires, erreurs. |
| Ensuite | Refonte P1 et P2 sur cette base. Les bugs de gravité basse restants sont corrigés au moment où leur page est migrée ; dette, étapes 7 et 8. | Chaque page migrée n'a plus de bug connu. |

**Règles pour chaque correction** : ce sont les [règles communes](#règles-communes-à-toutes-les-phases) de la feuille de route (aucune nouvelle erreur TypeScript, build Docker, test avec un compte de chaque rôle, verdict de l'annexe lu avant de coder, identifiants cités dans les commits, style du code voisin).

**Complément relevé pendant la rédaction (hors annexe, à vérifier).** `server/localAuth.ts` utilise une clé de session de secours fixe (`'fallback-secret-key'`) si `SESSION_SECRET` est absente, et la valeur d'exemple de `SESSION_SECRET` est versionnée dans `docker-compose.yml` et `.env.example`. Vérifier que la production utilise une clé propre, et faire échouer le démarrage si la variable manque.

---

## P4 — Performance

LogiFlow était lent pour une raison simple : chaque écran téléchargeait beaucoup plus que ce qu'il affichait. Sur le banc de mesure, l'accueil d'un administrateur recevait plus de 360 Mo de données pour montrer une dizaine de chiffres. Le logo du magasin était recopié dans chaque commande et chaque livraison, rien n'était compressé, et le serveur relisait l'utilisateur connecté deux fois à chaque appel (quatre requêtes SQL). Le **lot 1**, réalisé dans cette branche et pas encore livré en production, traite ces causes **sans changer ce que voient les équipes**.

Cette section donne les **gains mesurés** et **ce qui a été fait**, puis les **vérifications à faire avant la mise en production** et **ce qui reste à faire**, en deux lots.

**En chiffres** (banc de mesure décrit au § 1.1, administrateur sur PC sauf mention contraire)

- Avant l'écran de connexion, le JavaScript téléchargé passe de 1,6 Mo à **180 Ko** (−89 %).
- De la connexion à l'affichage de l'accueil : **5,9 s** avec rechargement complet de l'application avant, **0,16 s** sans rechargement après.
- Visite des 23 pages : les données reçues de l'API passent de **1,5 Go à 0,8 Mo**, les appels de 309 à 202, les appels en double de 82 à 0. Le temps de chargement cumulé passe de 35,9 s à 15,4 s.
- Requêtes SQL pour un même passage sur toutes les routes de l'API : **−56 à −57 %** pour les quatre rôles (pour l'admin, de 425 à 189).
- Pic de mémoire du serveur : de 1,4 Go à **325 Mo**.
- **Aucune régression** : les statuts HTTP, les valeurs et l'ordre des listes sont identiques. Seuls des champs inutiles ont disparu des réponses (logo, configuration SMTP, empreintes de mot de passe). Quatre écrans de l'employé qui plantaient s'affichent maintenant.

**Comment lire cette section**

- § 1 : les **gains mesurés**, avant → après.
- § 2 : **ce qui a été optimisé** dans le lot 1, par thème, avec les identifiants des constats.
- § 3 : ce qu'il faut **vérifier en livrant** le lot 1.
- § 4 : **ce qui reste** : lot 2 (les gros gains restants, surtout côté serveur), lot 3 (finitions), décisions produit, puis la **liste complète des constats de performance non traités**, avec la raison.
- § 5 : **l'ordre conseillé** et les **règles** à respecter pour ne pas reperdre les gains.

**Effort** : échelle commune (voir [Comment lire ce plan](#comment-lire-ce-plan)). **Risque** : **faible** = rien ne change à l'écran et le banc permet de le vérifier ; **moyen** = la forme d'une réponse ou le comportement d'un écran change, à tester page par page ; **élevé** = ce que voient les équipes change, ou les données sont touchées.

---

### 1. Gains mesurés

#### 1.1 Le banc de mesure

- **Serveur de production** construit exactement comme dans l'image Docker (`vite build`, puis la commande esbuild du `Dockerfile`, `NODE_ENV=production`). Il tourne sur une base PostgreSQL locale qui a les index de `init.sql` et de la migration `20260814`.
- **Données fictives réalistes**, les mêmes avant et après : 3 magasins, dont un avec un logo de 150 Ko (comme un magasin qui a configuré le sien), 1 500 commandes, 2 500 livraisons, 400 tâches, 300 commandes clients, 500 produits DLC, 150 tickets SAV, 150 avoirs et 40 publicités, sur 18 mois (juillet 2025 à décembre 2026).
- **Deux mesures.**
  - Appel direct des 272 routes de l'API avec les 4 rôles : taille de la réponse, temps médian sur 5 appels, nombre de requêtes SQL.
  - Chromium piloté automatiquement sur 23 pages, sur PC et sur téléphone, avec un compte administrateur et un compte employé. L'horloge est figée au 2 octobre 2026 et le cache du navigateur est conservé d'une page à l'autre.
- **Référence** : le commit `3f2660c` sans modification. **Après** : la branche, avec ses 64 fichiers modifiés.

**Trois précautions de lecture.**

1. Le serveur et le navigateur tournent sur la même machine, donc le temps de transfert réseau est presque nul. Sur le Wi-Fi d'un magasin ou en 4G, les gains de temps sont **plus grands** que dans les tableaux, car ils suivent les volumes économisés : 360 Mo représentent plus de deux minutes de téléchargement sur une ligne à 20 Mbit/s.
2. Les volumes « avant » dépendent du logo, et un magasin sans logo pesait moins lourd. Le manager du banc est rattaché à un magasin sans logo : sur l'ensemble des routes, il passe tout de même de 19,2 Mo à 506 Ko (−97 %).
3. La base du banc avait déjà les index de performance, comme une base où le script manuel a été lancé. Le gain des index désormais créés au démarrage (§ 2.4) n'apparaît donc pas dans les chiffres : il s'y ajoute en production si ces index manquaient.

#### 1.2 Premier chargement et cache du navigateur

| Mesure | Avant | Après |
|---|---|---|
| JavaScript reçu avant le formulaire de connexion | 5 fichiers, 1,6 Mo | 4 fichiers, 180 Ko compressés (−89 %) |
| JavaScript initial, brut / compressé gzip | 1,6 Mo / 428,5 Ko | 610 Ko / 178,6 Ko |
| CSS reçu avant le formulaire | 118 Ko | 18,7 Ko |
| Code à télécharger en revenant sur l'application | 5 revalidations (réponse 304) à chaque rechargement | rien : les fichiers sont servis depuis le cache sans revalidation |
| JavaScript cumulé sur les 23 pages (admin PC) | ≈ 1,75 Mo | ≈ 455 Ko (180 Ko au départ, plus 270 Ko de morceaux chargés à la demande) |
| Cache de `index.html` | `public, max-age=0` | `no-cache` (toujours revalidé, donc toujours la dernière version) |
| Cache des fichiers `/assets/*.js` | `public, max-age=0` | `public, max-age=31536000, immutable` (1 an) |
| Compression (HTML, JS, JSON) | aucune | brotli ou gzip |
| Cache des réponses `/api` | aucune consigne | `private, no-cache` (les 304 via ETag restent possibles) |

#### 1.3 Connexion et utilisateur connecté

| Mesure | Avant | Après |
|---|---|---|
| GET `/api/user` sur la page de connexion | 2 | 1 |
| GET `/api/user` entre la connexion et l'accueil | 5 | 1 |
| GET `/api/user` à chaque changement de page | 3 à 5 | 0 (lu une fois par session) |
| Connexion → accueil, admin PC | 5,88 s, rechargement complet, 365 Mo d'API | 164 ms, sans rechargement, 470 o |
| Connexion → accueil, employé PC | 1,55 s | 147 ms |
| Requêtes SQL pour `/api/user` | 4 | 1 |
| Requêtes SQL d'identité au début de chaque appel API | 4 | 1 |

#### 1.4 Pages, dans le navigateur

Administrateur sur PC, sauf mention. Chaque case donne le nombre d'appels `/api`, le volume reçu de l'API, le temps jusqu'à la fin du chargement et la mémoire JavaScript de la page.

| Page | Avant | Après |
|---|---|---|
| Accueil `/` | 20 appels, 361 Mo, 5,50 s, 364 Mo de mémoire | 12 appels, 464 Ko, 1,16 s, 10 Mo |
| Commandes `/orders` | 8 appels, 134,5 Mo, 2,36 s, 139 Mo | 4 appels, 1 Ko*, 0,69 s, 6,8 Mo |
| Livraisons `/deliveries` | 9 appels, 380,7 Mo, 6,16 s, 382 Mo | 4 appels, 1 Ko*, 0,75 s, 7,7 Mo |
| Calendrier `/calendar` | 11 appels, 11 Mo, 0,83 s | 7 appels, 14,8 Ko, 0,62 s |
| Tâches `/tasks` | 8 appels, 20,2 Mo, 0,88 s | 4 appels, 1 Ko*, 0,58 s |
| Rapprochement `/bl-reconciliation` | 10 appels, 190,4 Mo, 3,06 s, 164 Mo | 5 appels, 186 Ko, 0,74 s, 7,9 Mo |
| DLC `/dlc` | 9 appels, 26,1 Mo, 0,92 s | 6 appels, 26 Ko, 0,62 s |
| Commandes clients `/customer-orders` | 9 appels, 17,2 Mo, 0,85 s | 6 appels, 25 Ko, 0,61 s |
| Avoirs `/avoirs` | 102 appels, 7,4 Mo, 1,79 s | 81 appels, 38,5 Ko, 1,07 s (voir lot 2, § 4.1 n° 7) |
| Statistiques `/analytics` | 11 appels, 28 Ko, 1,11 s | 8 appels, 6 Ko, 0,64 s |
| Accueil sur téléphone (admin) | 10 appels, 345 Mo, 5,05 s | 5 appels, 1 Ko, 0,60 s |
| Accueil employé sur PC | 21 appels, 15,8 Mo | 14 appels, 6,7 Ko |
| Commandes, Livraisons et Rapprochement, employé sur PC | écran d'erreur | s'affichent |

\* 1 Ko : la liste n'a pas changé depuis la visite précédente, le serveur répond 304 et le navigateur réutilise sa copie. À froid, la liste des commandes de l'admin pèse 131,6 Ko compressés.

**Totaux sur les 23 pages**

| Scénario | Avant | Après |
|---|---|---|
| Admin PC : appels `/api`, volume, doublons, temps cumulé, erreurs console | 309, 1 516 Mo, 82, 35,9 s, 52 | 202, 797 Ko, 0, 15,4 s, 24 |
| Admin téléphone : appels, volume, doublons | 144, 1 236 Mo, 64 | 76, 561 Ko, 0 |
| Employé PC : pages affichées, appels | 20 sur 23, 231 | 23 sur 23, 143 |
| Employé téléphone : appels, doublons | 137, 63 | 69, 0 |

Le JavaScript transféré page par page augmente (30 Ko → 270 Ko cumulés) : c'est attendu, car chaque page télécharge son propre code à sa première ouverture. Sur la session entière, le total baisse fortement (1,75 Mo → 455 Ko).

#### 1.5 Routes de l'API (administrateur)

Pour chaque route : taille brute, taille compressée, temps médian et nombre de requêtes SQL.

| Route | Avant | Après |
|---|---|---|
| `/api/orders` | 134,5 Mo, non compressé, 1 204 ms, 6 SQL | 2,5 Mo, 131,6 Ko, 113 ms, 3 SQL |
| `/api/orders?storeId=1` | 132 Mo, 1 132 ms, 6 SQL | 879 Ko, 48 Ko, 39 ms, 3 SQL |
| `/api/deliveries` | 190,3 Mo, non compressé, 1 643 ms, 7 SQL | 3,8 Mo, 205,7 Ko, 145 ms, 4 SQL |
| `/api/deliveries?storeId=1` | 186,8 Mo, 1 624 ms, 7 SQL | 1,3 Mo, 73,5 Ko, 56 ms, 4 SQL |
| `/api/tasks` | 20,1 Mo, 149 ms, 5 SQL | 175 Ko, 12,6 Ko, 9 ms, 2 SQL |
| `/api/dlc-products` | 26,1 Mo, 211 ms, 5 SQL | 499 Ko, 24 Ko, 18 ms, 2 SQL |
| `/api/customer-orders` | 16 Mo, 120 ms, 5 SQL | 287 Ko, 21 Ko, 12 ms, 2 SQL |
| `/api/customer-orders/pending-calls` (appelée toutes les 30 s) | 1,2 Mo, 12 ms, 5 SQL | 18 Ko, 2,6 Ko, 4 ms, 2 SQL |
| `/api/avoirs` | 7,4 Mo, 58 ms, 5 SQL | 138 Ko, 8 Ko, 8 ms, 2 SQL |
| `/api/sav/tickets` | 7 Mo, 54 ms, 5 SQL | 165 Ko, 12 Ko, 8 ms, 2 SQL |
| `/api/ad-campaigns?year=2026` | 2,9 Mo, 23 ms, 6 SQL | 12 Ko, 1,1 Ko, 6 ms, 3 SQL |
| `/api/users` | 8,4 Ko, 9,5 ms, 31 SQL | 6,1 Ko, 825 o, 3,8 ms, 3 SQL |
| `/api/announcements` | 1,5 Ko, 6 ms, 13 SQL | 1,5 Ko, 506 o, 4,3 ms, 2 SQL |
| `/api/payment-schedule?groupId=1` | 126 Ko, 322 ms, 8 SQL | 126 Ko, 12 Ko, 35 ms, 7 SQL |
| `/api/analytics/summary` | 712 o, 504 ms, 8 SQL | 712 o, 4,8 ms, 5 SQL |
| `/api/deliveries/38/reconciliation-comments` | 295,6 Ko, 12 ms, 10 SQL | 964 o, 8 ms, 7 SQL |
| `/api/groups` (pas encore traitée) | 148 Ko, 6 ms, 5 SQL | 148 Ko, 111 Ko, 5,5 ms, 2 SQL |
| `/api/deliveries/38` (fiche, en partie traitée) | 444 Ko, 9 SQL | 297 Ko, 111 Ko, 6 SQL |

**Totaux par rôle**, sur l'ensemble des routes : volume reçu (compression demandée), temps cumulé et requêtes SQL.

| Rôle | Avant | Après |
|---|---|---|
| Administrateur | 1 150,6 Mo, 10,6 s, 425 SQL | 1,4 Mo, 0,81 s, 189 SQL |
| Directeur | 1 123,7 Mo, 10,5 s, 423 SQL | 1,0 Mo, 0,60 s, 184 SQL |
| Manager | 19,2 Mo, 0,93 s, 416 SQL | 506 Ko, 0,56 s, 177 SQL |
| Employé | 785,9 Mo, 6,7 s, 376 SQL | 877 Ko, 0,42 s, 162 SQL |

Pic de mémoire du serveur : 1 437 Mo → 325 Mo.

#### 1.6 Contrôles de non-régression

- **Réponses JSON** (272 réponses comparées, 4 rôles) : 155 identiques et 117 différentes, mais **uniquement par des champs supprimés**. Aucun statut, aucune valeur, aucun type ni aucun ordre ne change, et aucun élément n'est ajouté ou retiré d'une liste. Les champs supprimés se rangent en 11 catégories, toutes attendues : logo, adresse, SMTP et colonnes NocoDB du magasin dans les listes ; mot de passe et champs inutiles des créateurs et auteurs ; mot de passe dans `/api/users`. Pour chacune, le code client a été relu et il ne lisait pas ces champs.
- **Sécurité, effet de bord utile** : avant, 18 réponses contenaient une empreinte de mot de passe ou le mot de passe SMTP chiffré. Après, aucune.
- **Nouveaux paramètres** (`status=` sur les livraisons, `startDate=endDate=` sur l'accueil téléphone) : 183 contrôles, 0 échec. Les 4 rôles ont été testés, avec et sans magasin, y compris sur des magasins interdits.
- **Parcours réels** dans le navigateur : connexion, navigation interne sans rechargement, changement de magasin (1 appel au lieu de 2, aucune ligne d'un autre magasin), tâche terminée, déconnexion puis reconnexion, redirection depuis `/auth`, bouton de l'alerte DLC. Tous réussissent. Les erreurs console tombent à 6, 2 et 1, contre 11, 6 et 3 dans la référence.
- **Affichage** : textes identiques, avec deux écarts attendus. « Chargement météo... » n'apparaît plus, car la météo désactivée n'est plus réessayée. Les tuiles de l'accueil téléphone affichent les chiffres du jour (2 et 4) au lieu du total historique (1 500 et 2 500), ce qui a été vérifié en base.
- **Typage et build** : 88 erreurs TypeScript, toutes dans `server/storage.ts`, comme avant (aucune nouvelle). `vite build` et la commande esbuild du `Dockerfile` réussissent.

---

### 2. Ce qui a été optimisé (lot 1)

#### 2.1 Premier chargement : code découpé, compressé et mis en cache

| Changement | Effet | Constats |
|---|---|---|
| Chaque page (17 sur PC, 9 sur téléphone) n'est téléchargée qu'à sa première ouverture (`React.lazy`). Le paquet initial ne garde que la connexion, les accueils PC et téléphone, le cadre de l'application et la page introuvable. Pendant le chargement d'une page, le menu et l'en-tête restent affichés avec « Chargement... ». Les quatre imports morts du routeur sont retirés. | JavaScript initial : 1,6 Mo → 610 Ko brut. Les graphiques (recharts, 424 Ko) ne sont chargés que par Statistiques. | SHELL-03, DASH-32, BUNDLE-01, INFRA-12, ANA-02, UTIL-03, PERF-BUNDLE-01, RAPPRO-29, AVOIRS-22, TASKS-35, SAV-29, DLC-46, PUB-32 |
| Après un déploiement, si un onglet resté ouvert demande un morceau de code qui n'existe plus, la page se recharge une fois (au plus une fois par minute). | Pas de page blanche après une mise à jour. | BUNDLE-01, TASKS-35 |
| La bibliothèque de codes-barres n'est chargée qu'au moment d'imprimer une étiquette. En cas d'échec, un message s'affiche au lieu d'un faux code-barres. | 66 Ko de moins pour Commandes clients. | CMDCLI-42 |
| Le script tiers Replit, qui bloquait le démarrage, est supprimé. La page est déclarée en français (`lang="fr"`). | Plus de dépendance à replit.com. Chrome ne propose plus de « traduire depuis l'anglais ». | SHELL-04, INFRA-06, DASH-33, AUTH-01 et SHELL-20 (en partie) |
| Compression brotli ou gzip de toutes les réponses (paquet `compression`, installé dans l'image Docker). `server/cache.ts`, mort et trompeur, est supprimé. | JavaScript initial servi en 178 Ko. Listes JSON 10 à 20 fois plus légères sur le réseau. | INFRA-04, SRV-03, DASH-08, CMDCLI-40, AUTH-02, DB-32, INFRA-19 |
| Les fichiers statiques sont servis avant la session, donc sans requête SQL. Les fichiers `/assets` sont gardés 1 an en cache (leur nom change à chaque version). `index.html` est toujours revalidé. | Aucune requête réseau pour le code après la première visite. Environ 20 requêtes SQL de moins par chargement complet. | INFRA-03, INFRA-05, SHELL-05 |
| En-tête `Cache-Control: private, no-cache` sur toute l'API. | Aucun cache partagé (proxy) ne peut garder les données d'un magasin. | INFRA-16 |
| `NODE_ENV=production` fixé dans l'image Docker. | Le bon pilote de base de données est choisi même sans docker-compose. | INFRA-17 |

#### 2.2 Utilisateur connecté : chargé une seule fois

| Changement | Effet | Constats |
|---|---|---|
| Toute l'application partage une seule lecture de l'utilisateur connecté (cache React Query), au lieu d'une lecture par composant. Les quatre hooks d'authentification renvoient au même. Le comportement est le même en développement et en production. | `/api/user` : 3 à 5 appels par page → 1 par session. Plus d'attente en cascade avant le chargement des données d'une page. | SHELL-01, DASH-04, SHELL-27, AVOIRS-11, MOB-AVOIRS-07, TASKS-08 (en partie) |
| Connexion sans attente artificielle de 500 ms ni rechargement de l'application. Redirection depuis `/auth` sans rechargement. | Connexion → accueil : 5,9 s → 0,16 s. | AUTH-03, SHELL-09 (en partie) |
| Côté serveur, l'utilisateur chargé par la session (désormais en 1 requête SQL au lieu de 2) est réutilisé par les 104 handlers qui le relisaient (`getCurrentUser(req)`) et par `/api/user`. | De 4 requêtes SQL d'identité par appel à 1. | INFRA-02, DB-06, DASH-09, SRV-04, TASKS-04, SAV-10, CMDCLI-11, GROUPS-04, PUB-04, ADMIN-02 ; API-01, ADMIN-03 et DLC-18 en partie |
| La connexion n'attend plus la vérification de la sauvegarde quotidienne. Si plusieurs personnes se connectent en même temps, une seule sauvegarde est lancée. Le fichier de sauvegarde n'est plus relu en mémoire pour compter les tables. | Connexion en 50 ms environ, même la première de la journée. Le serveur ne gèle plus pendant une sauvegarde. | INFRA-07, BACKUP-03, BACKUP-04 (en partie) |
| Les erreurs 4xx (droit refusé, introuvable) ne sont plus réessayées. Les autres erreurs ont un seul nouvel essai, contre deux avant. | Un « accès refusé » s'affiche tout de suite, au lieu d'environ 3 s plus tard. | SHELL-08 |

#### 2.3 Réponses de l'API allégées

| Changement | Effet | Constats |
|---|---|---|
| Dans toutes les listes, le magasin n'est plus renvoyé en entier (logo, SMTP, NocoDB). Il est réduit aux champs lus par les écrans : `{id, name, color}`, ou, pour les livraisons, les commandes et les avoirs, `{id, name, color, nocodbConfigId, nocodbTableName, webhookUrl}`. Avant de réduire, une recherche dans tout le code client a vérifié quels champs étaient lus. | Livraisons (admin) : 190 Mo → 3,8 Mo brut (206 Ko compressés). Commandes : 134 Mo → 2,5 Mo (132 Ko). Publicités : 2,9 Mo → 12 Ko. | DB-03, DASH-07, SRV-01 (magasin), RAPPRO-01 (étape 1), AVOIRS-API-01, TASKS-01, SAV-05, CMDCLI-01, DLC-07, PUB-02 |
| Créateur des tickets SAV et auteur des commentaires de rapprochement réduits à l'identité, sans mot de passe. `/api/users` sans mot de passe, en 2 requêtes au lieu de 1 + 2 par utilisateur. Suppression d'un utilisateur en une requête au lieu d'une par magasin. | Plus aucune empreinte de mot de passe dans les réponses mesurées. `/api/users` : 31 → 3 requêtes SQL. | DB-04, DB-05, USERS-01, TASKS-07, DB-33, USERS-21 (en partie) |
| Le rapprochement ne demande plus que les livraisons livrées (`GET /api/deliveries?status=delivered`, filtre en SQL). Il lit le fournisseur dans la livraison au lieu de charger toute la liste des fournisseurs. | Rapprochement : 190 Mo → 186 Ko. Les vérifications automatiques démarrent sans attendre les fournisseurs. | DB-10, RAPPRO-10, RAPPRO-01 et SRV-09 (en partie) |
| L'échéancier et son export ne lisent plus que les livraisons du magasin demandé. | 322 ms → 35 ms. | DB-07, ECHE-01 et ECHE-03 (en partie) |
| L'accueil sur téléphone demande les commandes et livraisons du jour (`startDate=endDate=aujourd'hui`) au lieu de tout l'historique. | Tuiles justes. Accueil téléphone admin : 345 Mo → 1 Ko. | DB-09, DASH-28 (en partie) |
| Les fenêtres « Nouvelle livraison » et « Modifier livraison » ne chargent que les commandes du magasin choisi. | 879 Ko brut au lieu de 2,5 Mo pour un admin. | MOD-01 et DB-11 (en partie) |
| Les informations de l'accueil sont lues en une requête avec jointure, au lieu de 2 requêtes par message. | 13 → 2 requêtes SQL. Le contenu des messages n'est plus écrit dans les journaux. | DB-18, DASH-12 |
| Enregistrement d'une livraison : le fournisseur déjà chargé est réutilisé au lieu de relire toute la table. | 1 requête de moins par enregistrement. | RAPPRO-06 |

#### 2.4 Base de données : index et requêtes

| Changement | Effet | Constats |
|---|---|---|
| **65 index créés automatiquement au démarrage**, en arrière-plan, sans bloquer l'application : un `CREATE INDEX CONCURRENTLY IF NOT EXISTS` par index, après la suppression des index invalides, puis `ANALYZE` des tables concernées. Aucun index n'est créé en double sous un autre nom. Ces index n'étaient créés que par un script manuel, donc souvent jamais. | Les listes filtrées par magasin, par date ou par statut ne parcourent plus toute la table. Le gain grandit avec l'historique. | DB-01, INFRA-01, DB-37, DB-14, DB-15, DB-34, DB-35 ; TASKS-29, SAV-27 et PUB-35 en production seulement |
| Les requêtes indépendantes partent en parallèle : statistiques du mois et de l'année, page Statistiques, fiche livraison (2 allers-retours au lieu de 5), météo. | Le temps de réponse est celui de la requête la plus longue, et non plus la somme de toutes. | DB-13, DASH-10, CAL-12, DB-17, ANA-07, DB-12, RAPPRO-05 (en partie), DB-30, DASH-35, WEATHER-04 (en partie) |
| « Meilleurs magasins » (Statistiques) : sous-requêtes agrégées au lieu d'un produit cartésien commandes × livraisons. Les chiffres sont identiques. | `/api/analytics/summary` : 504 ms → 5 ms. | DB-16, ANA-03 (en partie) |
| Suppression de requêtes répétées par élément : historique SAV toujours vide (N appels inutiles), participations des publicités regroupées en un seul passage, compteurs SAV en 1 requête au lieu de 3. | Moins d'allers-retours, calcul linéaire. | SAV-12, DB-26, PUB-16, DB-25, SAV-11 |
| Mise à jour des caches de factures rapprochées en une seule requête SQL. | Environ 2 200 requêtes → 20 ms. | DB-19 |
| Numérotation SAV : le filtre par année peut maintenant utiliser l'index sur la date. Le comptage est identique. | La création d'un ticket ne parcourt plus toute la table. | DB-27 (en partie) |
| La purge du cache de vérification des factures tourne enfin en production. | La table ne grossit plus sans fin. | INFRA-09, DB-21 |

#### 2.5 Écrans : moins d'appels, plus aucun rechargement complet

| Changement | Effet | Constats |
|---|---|---|
| Fournisseurs et magasins gardés 5 minutes au lieu d'être rechargés à chaque page ou fenêtre. Les modifications les rafraîchissent toujours. | Les fenêtres s'ouvrent avec des listes déjà prêtes. | MOD-06, API-02 |
| **Appels inutiles supprimés** : statistiques mensuelles et commandes clients non affichées sur l'accueil, route inexistante de l'accueil téléphone, magasins dans Commandes, Livraisons et Commandes clients, utilisateurs dans Tâches, double marquage après validation d'un avoir, deuxième lecture du détail SAV. **Appels désormais conditionnels** : configurations NocoDB (admin seulement), contacts (si un magasin est connu), clients à appeler (refusés par le serveur pour l'employé), fournisseurs du formulaire d'avoir sur téléphone (chargés à l'ouverture du formulaire). | 2 à 5 appels de moins selon les pages. | DASH-06, ORD-04, CMDCLI-43 (en partie), TASKS-07, AVOIRS-19 (en partie), SAV-17 (en partie), GROUPS-12, CONT-10, CMDCLI-09, MOB-AVOIRS-08 |
| **Appels en double supprimés** : informations de l'accueil (une seule clé de cache), invalidations au montage (accueil, alerte DLC, Tâches), changement de magasin (1 appel au lieu de 2), suppressions et créations (les listes non affichées ne sont plus rechargées), compteur de commentaires du rapprochement (mis à jour sur place), affectations d'utilisateurs, fournisseurs, recherche DLC sur téléphone (plus d'appel à chaque frappe ni à chaque onglet), requêtes de l'accueil lancées avant de connaître le rôle (elles attendent maintenant l'utilisateur). | Doublons : 82 → 0 sur PC et 64 → 0 sur téléphone (admin). | DASH-14, DASH-16, DLC-20, SHELL-02, SHELL-07, DASH-15 (en partie), TASKS-05, ORD-06, CMDCLI-13, RAPPRO-08, RAPPRO-11 (en partie), USERS-06, SUPP-09, DLC-09 |
| **Plus de rechargement complet de l'application** : après l'enregistrement d'une tâche, depuis les raccourcis de l'accueil téléphone, depuis l'alerte DLC, après la connexion. | Navigation instantanée. Les filtres, la recherche et la page en cours sont conservés. | TASKS-03, DASH-30, DLC-33, AUTH-03 |
| Publicités à venir de l'accueil : les 3 années sont demandées en parallèle au lieu de l'une après l'autre. | Un aller-retour au lieu de trois en cascade. | DASH-11, PUB-30 (en partie) |
| Vérification des factures d'avoirs : file de 4 appels simultanés au lieu d'une boucle, limitée aux avoirs non validés et pas encore vérifiés. « Vérifier toutes » ne déclenche plus de cascade : une seule actualisation et un seul message récapitulatif, sans fermer la fenêtre de modification ouverte. Rapprochement : suppression de l'enregistrement redondant après chaque vérification (le serveur l'a déjà fait). | Plus de cascade de N × N appels ni de N messages. Le rapprochement fait 2 fois moins d'appels pendant la vérification automatique. | AVOIRS-01, AVOIRS-02, RAPPRO-02 (en partie) |
| Terminer et Supprimer une tâche : l'écran change tout de suite et revient en arrière si le serveur refuse. | Plus d'attente ni de double clic. | TASKS-24, TASKS-25 |
| Actions sur une ligne DLC : seul le bouton de la ligne traitée est désactivé. | On peut traiter les produits à la suite. | DLC-19 |
| Rafraîchissements automatiques : sauvegardes toutes les 5 minutes (30 s pendant une sauvegarde en cours) ; météo sans nouvel essai, gardée 30 minutes. | Moins d'appels de fond. | BACKUP-05, DASH-36 (en partie) |
| Changement de statut d'un avoir sur téléphone : la requête n'envoie plus que les champs utiles, au lieu de l'avoir complet et de ses relations. | Requête de quelques centaines d'octets. | MOB-AVOIRS-04 (en partie) |
| Échéancier gardé 5 minutes. L'en-tête reste affiché pendant le chargement. | Moins d'appels sur une route coûteuse. | ECHE-06 (en partie) |

#### 2.6 Écrans : affichage plus fluide

| Changement | Effet | Constats |
|---|---|---|
| Les calculs sont mémorisés au lieu d'être refaits à chaque affichage ou à chaque frappe : accueil, calendrier (les 42 jours de la grille sont indexés une fois), commandes, livraisons, fenêtres de création, rapprochement, avoirs, tâches, commandes clients (PC et téléphone), publicités, fournisseurs, SAV, DLC. Les recherches sont différées pendant la frappe, et le cache n'est plus modifié par les tris. | Saisie fluide sur les PC de magasin, même avec un long historique. | DASH-17, CAL-03, ORD-03, MOD-05, RAPPRO-09 (en partie), AVOIRS-13, TASKS-34, CMDCLI-17, CMDCLI-33 (en partie), PUB-08, PUB-15, SUPP-08, SAV-15 |
| Tâches : une seule mise en page est montée (tablette ou PC) au lieu des deux, l'une cachée. | Deux fois moins d'éléments à l'écran. | TASKS-10 |
| Le changement de magasin et le redimensionnement de la fenêtre ne redessinent plus toute l'application à chaque pixel. | Interface stable sur les PC peu puissants. | SHELL-06 |
| Pendant un rechargement (changement de mois, d'année ou de filtre), la liste précédente reste affichée, estompée, avec « Mise à jour… ». Ce n'est **jamais** le cas quand le magasin change : on ne montre pas les données d'un autre magasin. | Plus de clignotement ni de faux « 0 ». | CAL-04 (en partie), TASKS-23, SAV-14, CMDCLI-19, DLC-16, PUB-14 (en partie), ANA-01, DASH-42 (en partie) |
| Le calendrier n'attend plus les publicités pour afficher la grille. | La grille apparaît plus vite. | CAL-04 (en partie) |

#### 2.7 Journaux

| Changement | Effet | Constats |
|---|---|---|
| Les journaux de débogage sont retirés des chemins les plus sollicités du serveur : commandes, livraisons, tâches, SAV, commandes clients, avoirs, vérification des factures, informations, statistiques, publicités (lecture). Cela comprend ceux qui écrivaient des données clients, des corps de requête complets ou le texte des informations. `console.error` et `console.warn` sont conservés. | Moins d'écritures bloquantes. Journaux lisibles et sans données personnelles sur ces chemins. | INFRA-14, DASH-44, SRV-06, TASKS-28, SAV-16, AVOIRS-API-03, CMDCLI-39, PUB-05 (lecture), NOCO-04 (annexe 03, en partie) |
| Mêmes retraits côté navigateur, y compris les calculs de débogage faits à chaque affichage du calendrier. | Console utilisable par le support. | CAL-02, ORD-03, PUB-07, NOCO-02 (annexe 12), SAV-15, TASKS-33, USERS-15, ANA-20, DLC-35 (navigateur), SUPP-10 (en partie) |
| Le gestionnaire d'erreurs ne coupe plus la connexion après avoir répondu. | Les messages d'erreur arrivent entiers. | INFRA-15 |

#### 2.8 Corrections ajoutées après relecture et intégration

- **Boucle de rechargement évitée.** Avec le cache partagé, une erreur serveur ou réseau sur `/api/user` relançait l'appel environ 1 200 fois en 3 secondes, et l'écran de connexion n'apparaissait jamais. C'est corrigé (`retryOnMount: false`) : 1 seul appel, puis le formulaire s'affiche.
- **Compte supprimé avec un cookie de session encore valide** : le serveur répond maintenant 401 proprement, au lieu d'une erreur 500 sur tous les appels. Avant, l'erreur touchait aussi `/api/login` et bloquait la personne suivante sur un poste partagé.
- **Échéancier** : comme il est désormais gardé 5 minutes en cache, il est aussi actualisé après la suppression d'une livraison et après la modification d'un fournisseur, pour ne jamais afficher une ligne supprimée ou un mode de paiement périmé.
- **Administrateur qui modifie son propre compte** : l'utilisateur gardé en cache est rafraîchi (Users.tsx).

#### 2.9 Bugs de P3 déjà corrigés par ce lot

| Constat (P3) | Ce qui est réglé | Ce qui reste |
|---|---|---|
| CONT-01 | La liste des contacts se met à jour après une création, une modification ou une suppression. | — |
| AVOIRS-03 | La liste des avoirs se rafraîchit après une validation, même avec un magasin sélectionné. | — |
| TASKS-25 | Sur téléphone, « Tâche terminée » ne s'affiche plus quand le serveur refuse. | — |
| RAPPRO-25 | Le minuteur de la fenêtre d'attente s'arrête quand on quitte la page. | — |
| DB-09, DASH-28 | Les tuiles de l'accueil téléphone comptent les éléments du jour. | Renommer les tuiles « Commandes du jour » et « Livraisons du jour » (P2). |
| DB-04, USERS-02, SAV-04, RAPPRO-03, TASKS-07 (P3 § 1, lot A, n° 1) | Plus d'empreinte de mot de passe dans `/api/users`, le SAV ni les commentaires. Le mot de passe SMTP chiffré ne passe plus par les commentaires. | `POST /api/users` renvoie encore l'empreinte du compte créé. Le filet `sanitize.ts` sur la clé `password` reste à poser. |
| INFRA-15, INFRA-17, SHELL-27 | Faits (voir § 2.1, § 2.2 et § 2.7). | — |
| USERS-15, SAV-15, CMDCLI-39 | Journaux contenant un mot de passe SMTP ou des données clients retirés. | Journaux serveur des routes DLC et de suppression de publicité (lot 3). |
| SHELL-13 | L'entrée « Tableau de bord » du menu est active sur `/` comme sur `/dashboard`. | — |

---

### 3. Avant de livrer le lot 1

1. **Image Docker.** Reconstruire l'image. La commande esbuild déclare `--external:compression`, et l'étape de production installe le paquet par `npm ci --only=production`. Les deux sont déjà en place : il faut seulement vérifier que le conteneur démarre.
2. **Premier démarrage.** La création des 65 index tourne en arrière-plan sans bloquer l'application, mais elle consomme des ressources pendant quelques minutes sur une base importante. Il vaut mieux livrer hors des heures d'ouverture. Ensuite :
   - lire dans les journaux le résumé de la création (index créés, déjà présents, ignorés faute de table, en échec, et durée) ;
   - vérifier qu'aucun index n'est invalide : `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid` doit ne rien renvoyer ;
   - après une semaine, relever `pg_stat_user_indexes` pour repérer les index jamais utilisés.
3. **nginx en frontal** (configuration non versionnée). Vérifier qu'il ne supprime pas les en-têtes `Cache-Control` et qu'il ne garde pas en cache les réponses `/api`. Une compression déjà faite par nginx n'est pas un problème : nginx ne recompresse pas une réponse déjà compressée.
4. **Redéploiement avec un onglet ouvert.** Après le déploiement, ouvrir dans cet onglet une page jamais visitée. La page doit se recharger une fois, sans écran blanc. Ce test n'a pas pu être fait sur un vrai redéploiement (TASKS-35).
5. **Purge du cache de factures.** Elle tourne maintenant en production. La première purge peut supprimer beaucoup de lignes expirées : c'est normal.
6. **Outils externes qui liraient l'API.** Scripts ou automatisations : les listes ne renvoient plus le logo, la configuration SMTP et NocoDB complète du magasin, ni le mot de passe dans `/api/users`. Vérifier qu'aucun outil externe ne s'en servait.
7. **Rôle ou magasins modifiés par un autre administrateur.** Les droits sont à jour immédiatement côté serveur, car l'utilisateur est relu à chaque requête. En revanche, le menu de la personne concernée garde l'ancien état jusqu'à son prochain rechargement de page, puisque l'utilisateur est maintenant gardé en cache pour la session. Voir le lot 3, n° 1.

---

### 4. Ce qui reste à faire

Ce qui reste coûte cher pour cinq raisons :

1. **Le logo pèse encore** dans `/api/groups`, chargé par tous les écrans d'un administrateur (148 Ko, soit 111 Ko une fois compressé), et dans chaque fiche de détail : livraison (297 Ko), commande, avoir, produit DLC, ticket SAV (environ 148 Ko chacune).
2. **Les listes renvoient tout l'historique.** Pour l'admin « tous magasins » : 2,5 Mo brut pour les commandes, 3,8 Mo pour les livraisons. Ces volumes augmentent chaque mois.
3. **L'accueil télécharge encore** les listes complètes des commandes et des livraisons pour calculer quelques compteurs : 12 appels et 464 Ko pour l'admin.
4. **Les avoirs revérifient chaque avoir** non validé à chaque visite : 81 appels sur la page de l'admin.
5. **Les appels externes n'ont pas de délai maximal** : webhook des avoirs, météo, recherche de code EAN, NocoDB pendant l'affichage de l'échéancier.

#### 4.1 Lot 2 — les gros gains restants (environ 5 à 7 semaines pour un développeur, découpables)

L'ordre du tableau est l'ordre conseillé : le meilleur rapport gain/effort d'abord, puis les chantiers qui empêchent les volumes de regrossir.

| N° | Chantier | Gain attendu | Effort | Risque | Décision | Constats |
|---|---|---|---|---|---|---|
| 0 | **Verser le banc de mesure dans le dépôt** (`scripts/bench/`) : données de test, passage sur toutes les routes de l'API, parcours dans le navigateur, comparaison avant/après. Il n'existe aujourd'hui que dans un répertoire de travail temporaire. | Chaque chantier ci-dessous peut être mesuré et prouvé sans régression, comme le lot 1. | S à M | Nul | — | — |
| 1 | **Logo et configuration hors des réponses courantes.** `/api/groups` ne renvoie plus que `{id, name, color, webhookUrl, nocodb*, smtpEnabled, address, phone}`, avec `hasLogo` et `smtpPasswordSet` calculés. Une nouvelle route `GET /api/groups/:id`, complète et réservée à l'admin, sert au formulaire de Magasins. Les fiches de détail (`getOrder`, `getDelivery`, `getCustomerOrder`, `getDlcProduct`, `getTask`, `getAvoir`, `getSavTicket`, `getReconciliationCommentById`) utilisent les mêmes projections que les listes. La vérification des factures lit seulement les réglages du magasin dont elle a besoin (`getGroupVerificationSettings`). `getGroup` reste complet pour l'envoi des e-mails. | `/api/groups` : 148 Ko → quelques Ko, sur chaque écran d'administration. Ouverture d'une fiche : 111 Ko compressés → quelques Ko. Chaque vérification de facture ne relit plus le logo. | M | Moyen. Il faut relire chaque lecteur de `/api/groups` et de `.group` : formulaire de Magasins, `Avoirs.tsx` (qui lit `webhookUrl`), envoi d'e-mails. | — | GROUPS-02, API-03, DB-36, DB-31, DASH-07 (reste), TASKS-30 |
| 2 | **Contrôles d'accès légers.** Pour les routes qui ne lisent que le magasin et le statut (vérification de facture, modification, suppression, commentaires), une lecture minimale remplace la fiche complète avec ses jointures : `getDeliveryForAccess`, `getSavTicketAccessInfo`, `getDlcProductGroupId`, `getCustomerOrderGroupId`, et `getTask` sans jointure. `GET /api/deliveries/:id` garde la fiche complète. | 2 à 4 requêtes SQL de moins par action et par vérification automatique de facture. La file de vérification du rapprochement sature moins la base. | M (route par route) | Moyen. Chaque route ne doit lire que les champs prévus. | — | RAPPRO-05, DB-12 (b), SAV-10 (reste), DLC-18 (reste), CMDCLI-12, TASKS-30 |
| 3 | **Synthèse de l'accueil** : une route `GET /api/stats/dashboard?storeId=`, filtrée par rôle et par magasin comme `/api/orders`. Elle calcule en SQL, en parallèle : commandes en attente, livraisons et palettes du mois, délai moyen, 10 commandes en attente les plus anciennes, 4 prochaines livraisons, 3 prochaines publicités (`start_date >= today ORDER BY start_date LIMIT 3`, index déjà présent), 5 tâches ouvertes prioritaires, compteurs DLC et commandes clients, dernière information. Les accueils PC et téléphone l'utilisent tous les deux. | Accueil admin : 12 appels et 464 Ko → environ 5 appels et quelques Ko. Surtout, ce coût ne grandit plus avec l'historique. Les 3 années de publicités ne sont plus téléchargées. | M à L | Moyen. Les chiffres doivent rester exacts (même filtre que les listes). À faire avec la correction de DASH-01 (envoyer le magasin pour tous les rôles), qui change les chiffres vus par les managers et les directeurs. | DP2 | DASH-05, DB-08, DASH-11, PUB-30, DB-29 (accueil), DASH-28, CMDCLI-02 (compteurs), DASH-01 (P3) |
| 4 | **Pagination côté serveur des listes**, par curseur : `WHERE group_id = ANY($1) AND (created_at, id) < ($2, $3) ORDER BY created_at DESC, id DESC LIMIT 50`. Les filtres (statut, fournisseur, période) et la recherche passent en SQL, et le total de chaque onglet est renvoyé. Côté écran, une page ou « Voir plus » (`useInfiniteQuery` sur téléphone), avec la liste précédente gardée pendant le chargement. Les `IN (milliers d'identifiants)` sont remplacés par des sous-requêtes. Index `(group_id, created_at DESC, id DESC)` sur commandes, livraisons, commandes clients et avoirs ; ceux des tâches et du SAV existent depuis le lot 1. Ordre conseillé : livraisons et rapprochement (la route dédiée de RAPPRO-01, étape 2), puis commandes, commandes clients, DLC, tâches, SAV, avoirs. | Réponse constante quel que soit l'historique : environ 50 lignes au lieu de 2 500 (livraisons de l'admin), soit 3,8 Mo → environ 75 Ko brut. La mémoire du navigateur ne grandit plus (29 Mo aujourd'hui sur Livraisons, téléphone). L'erreur SQL certaine au-delà d'environ 65 000 commandes ou livraisons disparaît. | L (M par liste) | Moyen à élevé : la recherche, les filtres, les compteurs d'onglets et les exports passent côté serveur. Chaque liste est à tester avec les 4 rôles. | DP1 | DB-24, ORD-02, RAPPRO-01 (étape 2), CMDCLI-02, CMDCLI-33, SAV-13, TASKS-27, DLC-17, AVOIRS-API-02, AVOIRS-14, SRV-09 (paramètre `withBL` mort) |
| 5 | **Sous-objets allégés dans les listes** (à faire en même temps que le n° 4, sur les mêmes routes). Dans les commandes, les livraisons imbriquées sont réduites à `{id, status, scheduledDate, deliveredDate, quantity, unit}`. Dans les livraisons, la commande est réduite à `{id, plannedDate, status}`. Le fournisseur est réduit à `{id, name, email, requiresControl, hasDlc, automaticReconciliation}`. Le détail complet reste dans les fiches. | Environ la moitié du JSON brut des listes de commandes et de livraisons : selon l'audit, ces imbrications doublent ou triplent leur poids. Lecture plus rapide sur téléphone. | M | Moyen. Vérifier `OrderDetailModal` (statut et dates des livraisons) et `BLReconciliation` (`supplier.email`, `automaticReconciliation`). | — | SRV-02, SRV-01 (fournisseur), CMDCLI-01, DLC-07, SAV-05 et AVOIRS-API-01 (fournisseur) |
| 6 | **État de vérification des factures renvoyé avec la liste**, pour les avoirs et le rapprochement. `getAvoirs` et la liste du rapprochement font une jointure sur `invoice_verification_cache`, avec la même clé que `invoiceVerification.ts` (identifiant du magasin, « _ », puis la référence en minuscules et sans espaces autour), entrées non expirées seulement. Elles renvoient `verification {exists, invoiceAmount, isReconciled}`. Une route `POST /api/avoirs/verify-all` traite les vérifications côté serveur, 4 à la fois. Les clés du cache BL sont harmonisées, et un résultat BL renvoie aussi le montant et l'échéance. Le magasin est transmis à `verifyInvoice` au lieu d'être relu. | Avoirs : 81 appels à chaque visite → 3 ou 4. NocoDB n'est plus interrogé qu'à la demande. Plus de cellules « Non renseigné » après une vérification par BL. | M | Moyen : il faut des clés de cache identiques au code existant. | DP9 | AVOIRS-01, AVOIRS-02, RAPPRO-02, RAPPRO-22, NOCO-03 (annexe 03), AVOIRS-API-09 |
| 7 | **Échéancier calculé en SQL**, sans appel à NocoDB pendant l'affichage. Une requête ciblée sur `deliveries JOIN suppliers WHERE group_id = $1 AND invoice_reference IS NOT NULL AND due_date IS NOT NULL` remplace le calcul actuel. L'export la réutilise, filtrée sur le mois, avec des champs CSV échappés. Les échéances manquantes sont complétées par la vérification de facture, comme aujourd'hui, ou par une tâche de fond. | Le banc n'a pas NocoDB : 35 ms. En production avec NocoDB, chaque livraison sans échéance déclenche aujourd'hui un appel NocoDB (jusqu'à 10 s) pendant l'affichage, ce qui peut faire attendre plusieurs minutes. Après : quelques dizaines de millisecondes, toujours. | M | Moyen : il faut que les montants affichés restent identiques. | DP10 | ECHE-01, ECHE-03, DB-07 (reste) |
| 8 | **Liste légère des commandes** dans les fenêtres de livraison : `GET /api/orders?storeId=&supplierId=&status=pending,planned&light=1` renvoie `{id, plannedDate, status, quantity, unit}`, au plus 50 lignes. La liste n'est demandée qu'une fois le fournisseur choisi. Index `(group_id, supplier_id, status)`. | Ouverture de « Nouvelle livraison » : 879 Ko brut (48 Ko compressés) → quelques Ko. | S à M | Faible | D1 (P1) : l'employé peut-il lier une livraison à une commande ? | MOD-01, DB-11 |
| 9 | **Délai maximal sur les appels externes, en dehors du temps de réponse.** Le webhook des avoirs est envoyé après la réponse, avec 5 s maximum (`AbortSignal.timeout`), puis le statut d'envoi est mis à jour. Météo : 3 s maximum. Recherche de code EAN ou d'article : une seule route serveur qui enchaîne les deux appels, avec 5 s maximum et un cache. Pool de base de données : `statement_timeout` à 30 s (sauf opérations longues connues), `application_name`, et choix du pilote par variable plutôt que d'après le nom d'hôte. | Plus de bouton « Création... » bloqué plusieurs minutes, ni d'avoir créé en double par un nouveau clic. Plus de chargement sans fin après un scan. Une requête lente ne monopolise plus de connexion. | S à M | Faible à moyen : il faut recenser les opérations longues (statistiques, mises à jour en masse) avant de fixer `statement_timeout`. | — | AVOIRS-API-04, DASH-35 (reste), DLC-36, CMDCLI-23, INFRA-18 |
| 10 | **Historique des relances fournisseurs** : `SELECT DISTINCT ON (delivery_id) ...` filtré par magasin, avec un index `(group_id, delivery_id, created_at DESC)`, au lieu des 500 dernières lignes complètes. | Réponse réduite à une ligne par livraison. Corrige aussi un risque : au-delà de 500 envois, l'indicateur « déjà relancé » disparaît et on peut relancer deux fois le même fournisseur. | S à M | Faible | — | MAIL-01 |

#### 4.2 Lot 3 — finitions, caches et outils d'administration (environ 2 à 3 semaines, au fil de l'eau)

Gains plus modestes, ou qui dépendent d'une décision ou du lot 2. Les lignes marquées **rapide** peuvent se faire à tout moment.

| N° | Chantier | Gain attendu | Effort | Risque | Décision | Constats |
|---|---|---|---|---|---|---|
| 1 | **Rapide.** Recharger l'utilisateur connecté quand on revient sur l'onglet (`refetchOnWindowFocus` sur la seule clé `['/api/user']`), ou toutes les 10 minutes. | Le menu suit un changement de rôle ou de magasins sans attendre que la personne recharge la page. 1 appel léger de plus de temps en temps. | S | Faible | — | SHELL-01 (suite) |
| 2 | **Rapide.** Rotation des journaux Docker dans `docker-compose.yml` : `logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }`. | Le disque du serveur ne peut plus être rempli par les journaux. | S | Nul | — | INFRA-14 (reste) |
| 3 | **Rapide.** Les 24 `storage.getUser(<utilisateur courant>)` qui restent dans `routes.ts` passent par `getCurrentUser(req)`. Les contrôles de rôle répétés passent par `requireAdmin` et `requireAdminOrDirecteur` (`permissions.ts`), route par route. | 1 requête SQL de moins par appel d'administration, y compris le rafraîchissement automatique des sauvegardes. | S à M | Faible : relire chaque route. Seules les lectures faites en tête de handler sont concernées. | — | API-01 (reste), ADMIN-03 (reste) |
| 4 | **Rapide.** Nettoyages : invalidations de `['/api/deliveries/bl']` qui ne correspondent plus à aucune clé (ReconciliationModal, ValidateDeliveryModal) ; réévaluer l'invalidation de Layout au changement de magasin, maintenant que les fenêtres de livraison incluent le magasin dans leur clé. | Code plus simple. L'invalidation de Layout ne coûte déjà plus d'appel en double ; elle devient inutile dès que plus aucune clé n'omet le magasin. | S | Faible | — | SHELL-07 (reste), DASH-15 (reste) |
| 5 | **Filet `stripSmtpPassword`** : une fois le lot 2, n° 1 fait et vérifié par le banc (aucune réponse ne contient `smtpPassword`), le nettoyage n'est plus appliqué qu'aux routes `/api/groups*` et `/api/users*`, au lieu de recopier toutes les réponses JSON. | 5 à 30 ms et une copie mémoire de moins par grosse réponse. | S | Moyen (sécurité). Ne jamais le faire avant que toutes les jointures soient projetées. | — | SRV-05, PERM-02, INFRA-13 |
| 6 | **Accueil sur PC** : garder l'affichage précédent pendant un rechargement, une fois DASH-01 corrigé, et jamais au changement de magasin. | Plus de « 0 » transitoires sur l'accueil. | S | Faible | — | DASH-15 (reste) |
| 7 | **Téléphone : en-tête et barre du bas montés une seule fois**, autour des pages (MobileApp), au lieu d'être remontés à chaque page. | Plus de clignotement ni de perte d'état à chaque appui sur la barre du bas. | M | Moyen : le titre de page doit passer par un contexte. | — | DASH-29 |
| 8 | **Double appel au démarrage** : `storeInitialized` doit aussi passer à vrai quand `/api/groups` répond une liste vide ou une erreur (Layout). Ensuite, les requêtes de Calendrier, Commandes, Livraisons et Publicités attendent que le magasin soit choisi. | Un gros appel au lieu de deux à la première connexion d'un manager ou d'un directeur. | S | Moyen : sans la correction de Layout, une page pourrait rester bloquée. | — | CAL-17, PUB-14 (reste) |
| 9 | **Calendrier** : précharger le mois précédent et le mois suivant, mais seulement après le lot 2 (n° 4 et 5), sinon on ajoute 4 appels lourds par clic. Grille squelette au premier chargement. | Changement de mois instantané. | S | Faible | — | CAL-04 (reste) |
| 10 | **Mises à jour immédiates à l'écran** (puis confirmation du serveur) : statut et contact des commandes clients, suppression de publicité (facultatif). « Valider » un avoir dans une mutation, avec bouton désactivé pendant l'envoi. | Retour immédiat au clic, plus de double soumission. | S à M | Faible à moyen | — | CMDCLI-14, PUB-29, AVOIRS-19 (reste) |
| 11 | **Clients à appeler** déduits de la liste des commandes clients au lieu d'une deuxième route appelée toutes les 30 s, une fois la liste allégée et paginée (lot 2, n° 4). | Une route de moins appelée toutes les 30 s sur chaque poste ouvert. | S | Moyen : le rafraîchissement change. | — | CMDCLI-41 |
| 12 | **Rapprochement** : ligne de tableau mémorisée (`React.memo`), avec des gestionnaires stabilisés. Squelette au lieu de « Chargement... ». **Échéancier** : squelette et messages clairs pour le 403 et le magasin introuvable. **Tâches** : squelette tant que l'utilisateur ou la liste n'est pas prêt. | Moins de recalculs pendant la vérification automatique. Écrans de chargement plus clairs. | M | Faible | — | RAPPRO-09 (reste), RAPPRO-11 (reste), ECHE-06 (reste), TASKS-08 (reste) |
| 13 | **Avoir sur téléphone** : n'envoyer que `{ status }` une fois le serveur corrigé (AVOIRS-API-06 : ne remettre à vide que les champs envoyés). | Requête minimale. | S | Faible | — | MOB-AVOIRS-04 (reste), AVOIRS-API-06 (P3) |
| 14 | **Utilisateurs** : création avec ses magasins en un seul appel et une transaction (`groupIds` dans `POST /api/users`). Suppression dans une transaction. | 1 appel, 1 message et 1 rafraîchissement au lieu de N. Plus de compte à moitié créé. | M | Moyen | — | USERS-05, USERS-21 (reste) |
| 15 | **Statistiques** : une route `GET /api/analytics/overview` qui renvoie les indicateurs, la série temporelle, le top 5 des fournisseurs et les chiffres par magasin, au lieu de 4 appels. | 4 appels → 1. Les agrégats ne sont plus calculés deux fois. | M | Faible | DP4 | ANA-08, ANA-03 (reste), DB-16 (période) |
| 16 | **DLC** : les statistiques ne parcourent plus les produits validés (filtre dans le `WHERE`) et utilisent la date de Paris. Index partiel par migration. Liste des fournisseurs DLC lue en SQL (`getDlcSuppliers`). | Statistiques DLC de l'accueil à coût constant. Plus de décalage d'un jour la nuit. | S à M | Moyen : à faire avec DLC-01 (P3) pour les produits expirés déjà traités. | — | DLC-39, DLC-37 |
| 17 | **Publicités** : tri par numéro fait en SQL. Filtre par magasin seulement si la décision est prise. | Réponse plus petite pour un directeur multi-magasins. | S | Moyen : le contenu affiché change. | DP5 | CAL-15 (reste), DB-29 (reste) |
| 18 | **Caches mémoire côté serveur**, avec une liste d'invalidations complète : statistiques du mois et de l'année, météo (après WEATHER-01), configuration NocoDB (5 min, invalidée à sa modification). | Faible aujourd'hui (5 ms pour les statistiques) ; utile surtout pour la configuration NocoDB pendant les vérifications en lot. | S à M | Moyen : risque de chiffres décalés si une invalidation manque. | DP3 | DASH-10, CAL-12, WEATHER-04, DASH-35 (cache), AVOIRS-API-09 (cache) |
| 19 | **Outils d'administration** : synchronisation des statuts en une requête au lieu d'un chargement complet suivi d'une mise à jour ligne par ligne ; diagnostic du cache de factures en SQL, avec une clé corrigée ; analyse du schéma en une requête ; résultats SQL plafonnés à 200 lignes ; sauvegarde horaire qui partage la même vérification que la connexion ; polling des sauvegardes plafonné dans le temps (après BACKUP-02). | Actions d'administration de plusieurs minutes ramenées à quelques secondes. Plus de navigateur figé sur un `SELECT *`. | M au total | Faible à moyen | DP8 | DB-28, DB-20, DEBUG-01, SQL-02, BACKUP-04 (reste), BACKUP-05 (reste) |
| 20 | **Index déclarés dans `shared/schema.ts` et `init.sql`** avec les mêmes noms, pour qu'une installation neuve les ait et qu'un `db:push` ne les supprime pas (P3 § 4.4, DB-02). Suppression des index en double existants, après relevé de `pg_stat_user_indexes`. Index unique sur `user_groups` après dédoublonnage (P3). | Cohérence des environnements. Écritures un peu plus rapides sans les doublons. | M | Moyen : migration à tester sur une copie de la base. | DP7 | TASKS-29, SAV-27, PUB-35 (reste), DB-23 |
| 21 | **Journaux restants** : un logger à niveaux (`LOG_LEVEL`, `info` par défaut en production) remplace les quelque 150 `console.log` qui restent dans `routes.ts`, en commençant par les routes DLC et la suppression de publicité. | Journaux lisibles, sans données personnelles. | M | Faible | DP6 | INFRA-14 (reste), NOCO-04 (annexe 03, reste), PUB-05 (routes), DLC-35 (serveur) |
| 22 | **Petits restes** : recherche « date la plus proche » de la météo bornée (`BETWEEN`) ; `history` des tickets SAV recalculé (`lastCommentAt`) seulement quand la table d'historique sera recréée (SAV-02) ; route météo qui répond `{ configured: false }` au lieu d'un 404. | Marginal. | S | Faible | — | DB-30 (reste), SAV-12 (suite), DASH-36 (reste) |

#### 4.3 Décisions produit

Les décisions DP1 à DP10 (période par défaut des listes paginées, contenu de l'accueil, caches côté serveur, « Meilleurs magasins », publicités par magasin, journaux, index en double, sauvegarde à la connexion, vérification des factures, échéancier) et la numérotation des tickets SAV (DB-27) sont regroupées avec celles de P1 dans la section [Décisions produit à prendre](#décisions-produit-à-prendre). Chacune a une proposition par défaut.

#### 4.4 Liste complète des constats de performance non traités ou traités en partie

Tous les constats de performance de l'audit qui ne sont pas entièrement réglés par le lot 1. Pour chacun : ce qui reste, la raison pour laquelle il n'est pas dans le lot 1, et le lot où il est repris. Les constats absents de cette liste sont entièrement traités (§ 2).

**Côté serveur**

| Constat | Ce qui reste | Pourquoi pas dans le lot 1 | Lot |
|---|---|---|---|
| GROUPS-02, API-03, DB-36 | Projection de `/api/groups` et route de détail. | D'autres écrans lisent `webhookUrl` et les champs SMTP : il faut une nouvelle route et une modification du formulaire Magasins. | 2, n° 1 |
| DASH-07, SRV-01 | Projection du magasin dans les fiches de détail, et projection des fournisseurs. | Le lot était limité aux listes. La ligne fournisseur ne contient pas de champ lourd. | 2, n° 1 et 5 |
| DB-31 | Réglages de vérification lus sans le logo. | Nouvelle méthode de stockage, à faire avec le n° 1. | 2, n° 1 |
| TASKS-30 | `getTask` sans jointure sur le magasin. | Hors des listes. | 2, n° 1 et 2 |
| RAPPRO-05, DB-12 (b) | Lecture légère pour les contrôles d'accès. | À faire route par route dans `routes.ts` : seul le parallélisme de `getDelivery` a été fait. | 2, n° 2 |
| SAV-10, DLC-18, CMDCLI-12 | Lecture du seul magasin pour les contrôles d'accès (l'utilisateur, lui, n'est plus relu). | Nouvelles méthodes de stockage, et les signatures changent. | 2, n° 2 |
| DASH-05, DB-08 | Route de synthèse de l'accueil. | Nouvelle route, effort L, et définition des compteurs à arrêter (DP2). | 2, n° 3 |
| DASH-11, PUB-30, DB-29 | Route « prochaines publicités ». L'année N-1 est gardée pour l'instant, car une publicité classée en N-1 peut commencer plus tard. | Nouvelle route. Seul le parallélisme a été fait. | 2, n° 3 |
| DB-24, ORD-02, CMDCLI-02, SAV-13, TASKS-27, DLC-17, AVOIRS-API-02 | Pagination côté serveur. | Effort L et décision sur la période par défaut (DP1). | 2, n° 4 |
| RAPPRO-01 (étape 2), SRV-09 | Route dédiée au rapprochement, paginée, avec les totaux par onglet. Paramètre `withBL` mort. | Nouvelle dépendance et nouvelle route. Seuls le filtre `status` et la projection ont été faits. | 2, n° 4 |
| SRV-02 | Sous-objets imbriqués allégés. | Changement de forme des listes, à vérifier écran par écran. | 2, n° 5 |
| CMDCLI-01 (fournisseur, mapping `creator` mort) | Projection du fournisseur. Le mapping mort est conservé. | Supprimer ce mapping changerait la forme JSON sans aucun gain. | 2, n° 5 |
| DLC-07, SAV-05, AVOIRS-API-01 (fournisseur) | Projection du fournisseur. | Ligne légère, pas demandé dans ce lot. | 2, n° 5 |
| AVOIRS-01, AVOIRS-02, RAPPRO-02 (côté serveur) | État de vérification renvoyé avec la liste, et route `verify-all`. | Changements serveur. Le lot 1 a seulement rendu la file côté écran bornée et sans cascade. | 2, n° 6 |
| RAPPRO-22, NOCO-03 (annexe 03), AVOIRS-API-09 | « Vérifier toutes » ciblé, clés du cache BL harmonisées, magasin transmis à la vérification, cache des résultats négatifs. | Non traités dans ce lot (décision DP9, cache à valider). | 2, n° 6 |
| ECHE-01, ECHE-03, DB-07 | Requête SQL dédiée, NocoDB retiré de l'affichage, export filtré par mois et échappé. | Chantier distinct : une requête dédiée et une tâche de fond. Seul le filtre par magasin a été fait. | 2, n° 7 |
| MOD-01, DB-11 | Paramètres `supplierId`, `status` et `light` sur `GET /api/orders`, et index. | Ces paramètres n'existent pas côté serveur. Seul `storeId`, qui existe, est utilisé. | 2, n° 8 |
| AVOIRS-API-04 | Webhook des avoirs envoyé après la réponse, avec un délai maximal. | Non traité dans ce lot. | 2, n° 9 |
| DASH-35 | Délai maximal sur les appels météo. Cache négatif à valider. | `server/weatherService.ts` était hors du périmètre. Le parallélisme est fait. | 2, n° 9 |
| DLC-36, CMDCLI-23 | Route serveur unique pour la recherche EAN ou article, avec délai et cache. | Nouvelle route. | 2, n° 9 |
| INFRA-18 | `statement_timeout`, `application_name`, choix explicite du pilote. | Il faut recenser les opérations longues. | 2, n° 9 |
| MAIL-01 | Historique des relances par `DISTINCT ON`. | Nouvelle route. | 2, n° 10 |
| API-01, ADMIN-03 | 24 lectures `storage.getUser` de l'utilisateur courant, et `requireAdmin`. | Le lot était limité aux appels `getUserWithGroups`. | 3, n° 3 |
| SRV-05, PERM-02, INFRA-13 | `stripSmtpPassword` restreint. | Possible seulement quand plus aucune jointure ne renvoie le mot de passe SMTP (lot 2, n° 1). | 3, n° 5 |
| USERS-05, USERS-21 (transaction) | Création avec magasins en transaction, suppression en transaction. | Changement de la route `POST /api/users` côté serveur. | 3, n° 14 |
| ANA-08 | Route de synthèse des statistiques. | Nouvelle route ; la page est déjà rapide (5 ms). | 3, n° 15 |
| ANA-03, DB-16 | « Meilleurs magasins » : toujours calculé alors que non affiché. La période et les fournisseurs ne sont pas appliqués. | Changement visible des chiffres exportés : décision DP4. Le produit cartésien est supprimé. | 3, n° 15 |
| DLC-39, DLC-37 | Filtre et fuseau horaire des statistiques DLC, fournisseurs DLC en SQL. | Dépend de DLC-01 (P3). Nouvelle méthode de stockage, gain faible sur une petite table. | 3, n° 16 |
| CAL-15 | Filtre des publicités par magasin et par période. | Décision DP5. Projection et regroupement faits. | 3, n° 17 |
| DASH-10, CAL-12, WEATHER-04 | Cache mémoire. | Décision DP3 (liste d'invalidations). Le parallélisme est fait. | 3, n° 18 |
| DB-28, DEBUG-01, SQL-02, DB-20 | Outils d'administration (synchronisation des statuts, analyse du schéma, résultats SQL, diagnostic du cache). | Priorité basse. DB-20 est d'abord un bug d'administration (mauvaise clé de cache). | 3, n° 19 |
| BACKUP-04 (sauvegarde horaire) | Partager la vérification en cours avec la sauvegarde horaire. | Gardé minimal : seules les connexions simultanées sont protégées. Le risque de course de la sauvegarde horaire est inchangé. | 3, n° 19 |
| TASKS-29, SAV-27, PUB-35 | Déclaration dans `shared/schema.ts` et `init.sql`. | Fichiers hors du périmètre. La production est couverte par la création au démarrage. | 3, n° 20 |
| DB-27 | Calcul du numéro de ticket et unicité. | Décision : les numéros visibles changeraient. | P3 |
| INFRA-14, NOCO-04 (annexe 03), PUB-05 (routes), DLC-35 (serveur) | Logger à niveaux, journaux restants des routes, rotation Docker. | Accord de l'exploitant nécessaire (DP6). Les journaux des routes DLC et de suppression de publicité n'étaient pas dans le périmètre du lot. | 3, n° 2 et 21 |
| DB-30 | Recherche « date la plus proche » bornée. | Facultatif selon l'audit. Le parallélisme est fait. | 3, n° 22 |
| SAV-12 (suite) | `lastCommentAt` calculé en une requête. | À concevoir avec la recréation de la table d'historique (SAV-02). | 3, n° 22 |
| INFRA-03 (`npm start`) | Fichiers statiques servis avant la session en mode `npm start` (`server/vite.ts`). | L'audit le déconseille : cela changerait le comportement du mode `npm start`. Seuls les en-têtes de cache y ont été ajoutés. La production est traitée. | Non retenu |
| API-02 (côté serveur) | Cache mémoire des fournisseurs côté serveur. | Le cache de 5 minutes côté écran suffit. | Non retenu |
| PUB-29 | Mise à jour immédiate après une action sur une publicité. | L'audit recommande de garder l'invalidation actuelle. Mise à jour immédiate de la suppression facultative. | 3, n° 10 |

**Côté écran**

| Constat | Ce qui reste | Pourquoi pas dans le lot 1 | Lot |
|---|---|---|---|
| CMDCLI-33, AVOIRS-14 | Onglets et pagination (téléphone), avoirs paginés, badge à la place d'un menu déroulant par ligne. | Dépend de la pagination serveur. Le badge relève de l'UX (P2). | 2, n° 4 |
| DASH-28 | Libellés « du jour » sur l'accueil téléphone. | Changement de texte (P2). | P2 |
| SHELL-07, DASH-15 | Invalidation de Layout encore présente (différée et dédoublonnée). Liste précédente non gardée sur l'accueil. | Deux fenêtres de livraison utilisaient une clé sans magasin. Elles l'ont maintenant : à réévaluer. Garder l'ancienne liste sur l'accueil montrerait les données d'un autre magasin. | 3, n° 4 et 6 |
| DASH-29 | En-tête et barre du bas montés une seule fois sur téléphone. | Refonte du cadre mobile. La partie `/api/user` est réglée par le cache partagé. | 3, n° 7 |
| CAL-17, PUB-14 (double appel au montage) | Attendre le choix du magasin. | Il faut d'abord corriger Layout (`storeInitialized`), sinon une page pourrait rester bloquée. | 3, n° 8 |
| CAL-04 (préchargement, squelette) | Mois voisins préchargés, grille squelette. | Le préchargement ajouterait des appels lourds tant que le lot 2 n'est pas fait. Le squelette relève de l'UX. Sur téléphone, il n'y a pas d'indicateur de chargement, donc la liste précédente n'y est pas gardée. | 3, n° 9 |
| CMDCLI-14, AVOIRS-19 (bouton désactivé) | Mise à jour immédiate du statut d'une commande client. Validation d'un avoir dans une mutation. | Pas prévu comme sûr dans l'audit. Désactiver le bouton change l'interface. | 3, n° 10 |
| CMDCLI-41 | Clients à appeler déduits de la liste. | Changerait le rafraîchissement de 30 s et touche la fenêtre ClientCallsModal. | 3, n° 11 |
| RAPPRO-09 (ligne `React.memo`), RAPPRO-11 (squelette), ECHE-06 (messages, squelette), TASKS-08 (squelette) | Ligne mémorisée, squelettes, messages d'erreur. | Refonte trop large pour un gain faible (20 lignes par page) ; UX. Garder la liste précédente au changement de magasin est exclu, car elle montrerait les montants d'un autre magasin. | 3, n° 12 |
| MOB-AVOIRS-04 (reste) | N'envoyer que `{ status }`. | Le serveur viderait les autres champs tant qu'AVOIRS-API-06 n'est pas corrigé. | 3, n° 13 |
| BACKUP-05 (reste) | Durée maximale du rafraîchissement accéléré pendant une sauvegarde. | Dépend de BACKUP-02 : une sauvegarde peut rester « en cours » indéfiniment. Le lot 1 a choisi 5 minutes au repos et 30 s pendant une sauvegarde, au lieu de supprimer le rafraîchissement. | 3, n° 19 |
| DASH-36 (côté serveur) | Réponse `{ configured: false }` au lieu d'un 404. | Changement serveur. | 3, n° 22 |
| SAV-17 (durée de cache du détail) | Passer de 0 à 30 s. | Non appliqué : le code demande explicitement des données toujours fraîches, pour un gain faible. | Non retenu |
| AUTH-01, SHELL-20 (`maximum-scale=1`) | Autoriser le zoom sur téléphone. | Accessibilité, exclu de la mission. Il faut d'abord vérifier que les champs ont une police d'au moins 16 px. | P1 § 4 |

#### 4.5 Repérés pendant le lot 1, hors performance

Ces points ont été vus pendant le lot 1 sans être corrigés, car ce ne sont pas des optimisations. Tous figurent dans P3 ou P2 :

- **ORD-01** : la fenêtre de modification d'une commande appelle `apiRequest` avec les arguments inversés. Gravité haute, toujours présent (P3 § 1, n° 17).
- **SAV-01** : les invalidations de `['/api/sav/tickets']` ne correspondent pas à la clé réelle dès qu'un filtre ou un magasin est actif ; correctif minimal ajouté à P3 § 3.7.
- **TASKS-06, DASH-38** : l'accueil PC et la page Tâches utilisaient la même clé de cache pour des adresses différentes. Tâches a désormais sa propre clé ; l'accueil affiche toujours 0 tâche aux directeurs et aux managers, ce qui sera corrigé avec DASH-01 (P3 § 1, n° 16).
- **CMDCLI-16** : même collision de clé entre la page Commandes clients sur PC et sur téléphone, et sélecteur de magasin sans effet (P2 § 4).
- **DLC-48** : la recherche DLC sur téléphone plante si un produit n'a pas de nom (P3 § 3.6).
- **MSAV-01** : la page SAV sur téléphone appelle `/api/sav-tickets`, une route qui n'existe pas, quand un magasin est sélectionné (P3 § 1, n° 18).
- **CMDCLI-08, DLC-26** : injection HTML dans les impressions (P3 § 1, lot A, n° 2).
- **ORD-07** : sur la page Commandes, des hooks sont placés après le retour anticipé prévu pour les employés (P3 § 3.9).
- **`POST /api/users`** renvoie l'empreinte du mot de passe du compte créé (P3 § 1, n° 1, USERS-02).

---

### 5. Ordre conseillé et règles à respecter

#### 5.1 Ordre

Ce calendrier détaille la livraison de la Phase 0 et la Phase 4 de la [feuille de route](#feuille-de-route).

| Quand | Quoi | Résultat attendu |
|---|---|---|
| Livraison du lot 1 | Vérifications du § 3. Lot 3, n° 1 à 4 (rapides). | Gains du § 1 en production, journaux bornés. |
| Lot 2, semaines 1 et 2 | n° 0 (banc versionné), n° 1 (logo hors des réponses), n° 2 (contrôles d'accès), n° 8 (fenêtres de livraison), n° 9 (délais maximaux). | Plus aucun logo dans les réponses courantes. Plus d'écran bloqué par un service externe. |
| Lot 2, semaines 3 et 4 | n° 3 (synthèse de l'accueil, avec DASH-01), n° 6 (vérifications de factures), n° 7 (échéancier), n° 10 (relances). | Accueil et avoirs légers. Échéancier en temps constant. |
| Lot 2, semaines 5 à 7 | n° 4 et 5 (pagination et sous-objets), liste par liste, après la décision DP1. | Plus aucune réponse qui grandit avec l'historique. |
| Ensuite, au fil de la refonte P2 | Lot 3 restant. Chaque page migrée reprend les règles ci-dessous. | Les gains se conservent. |

Le lot 2, n° 4 et la refonte P2 touchent les mêmes écrans (listes, filtres, squelettes). Il vaut mieux paginer une liste au moment où sa page est refaite, en commençant par Livraisons et Rapprochement.

#### 5.2 Règles pour chaque changement

- **Mesurer avant et après** avec le banc (lot 2, n° 0) : volumes, nombre d'appels, requêtes SQL, réponses JSON comparées. Un changement de performance ne doit modifier ni un statut, ni une valeur, ni l'ordre d'une liste. Si une réponse change de forme, il faut le prévoir et vérifier ses lecteurs dans le code client.
- **Ne jamais sélectionner le logo ni les champs SMTP dans une liste.** Toute nouvelle jointure sur `groups` utilise `groupSummaryColumns` ou `groupReconciliationColumns` (`server/storage.ts`).
- **Utilisateur courant** : `getCurrentUser(req)` dans les routes, jamais une nouvelle lecture en base. Pas de cache mémoire de l'utilisateur côté serveur, pour qu'un changement de rôle ou de magasin s'applique tout de suite.
- **Clés de cache côté écran** : le premier élément est l'adresse de la route, ou bien la requête a sa propre fonction de chargement. Le magasin fait partie de la clé. Les mutations invalident par préfixe, sans `refetchQueries` sur les requêtes inactives.
- **Garder l'affichage précédent** pendant un rechargement **seulement si le magasin n'a pas changé**, avec un signe visible (« Mise à jour… », liste estompée).
- **Index** : uniquement dans `server/migrations.production.ts`, avec `CREATE INDEX CONCURRENTLY IF NOT EXISTS`, une requête et un `try/catch` par index, en arrière-plan. Le déclarer aussi dans `shared/schema.ts` (lot 3, n° 20).
- **Appels externes** : toujours avec un délai maximal, et jamais attendus avant de répondre si la réponse n'en dépend pas.
- **Journaux** : seuls `console.error` et `console.warn` restent sur les chemins fréquents, jamais avec un corps de requête ni des données clients.
- **Règles communes** (aucune nouvelle erreur TypeScript, build Docker, test avec chaque rôle) : voir les [règles communes](#règles-communes-à-toutes-les-phases) de la feuille de route.
