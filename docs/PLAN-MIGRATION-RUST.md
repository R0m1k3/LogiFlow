# Plan de migration du serveur LogiFlow vers Rust

*État au 15 octobre 2026. Plan à valider : rien n'est commencé.*

**Sommaire** : [Résumé](#résumé) · [Ce qui change, ce qui ne change pas](#ce-qui-change-ce-qui-ne-change-pas) · [Le serveur actuel](#le-serveur-actuel) · [Architecture cible](#architecture-cible) · [Stratégie : une adresse à la fois](#stratégie--une-adresse-à-la-fois) · [Feuille de route](#feuille-de-route) · [Compatibilité : les pièges](#compatibilité--les-pièges) · [Ce qu'on ne reporte pas](#ce-quon-ne-reporte-pas) · [Vérification](#vérification) · [Articulation avec le plan du webUI](#articulation-avec-le-plan-du-webui) · [Risques](#risques) · [Décisions à prendre](#décisions-à-prendre)

## Résumé

- **Quoi.** Réécrire le serveur (Express + TypeScript + Drizzle, environ 18 800 lignes dans `server/` et `shared/`, 148 adresses d'API) en Rust. **L'interface React reste telle quelle** : elle ne parle au serveur qu'en JSON, sous les mêmes adresses.
- **Comment.** Progressivement, jamais d'un bloc. Un serveur Rust se place devant l'actuel : il sert l'application et les adresses déjà réécrites, et transmet toutes les autres au serveur Node. Module par module, chaque adresse passe en Rust quand elle rend **exactement** les mêmes réponses (vérifié au banc de mesure), puis disparaît du code Node. À la fin, Node ne sert plus qu'à construire l'interface.
- **Ce que ça apporte.** Des types vérifiés de bout en bout, requêtes SQL comprises : les 88 erreurs TypeScript actuelles de `server/storage.ts` (comparaisons de texte et de date, champs possiblement vides) ne compileraient pas. Un serveur plus sobre en mémoire et plus rapide à démarrer, livré comme un seul binaire, sans `node_modules` en production. Et l'occasion de poser enfin des tests : le dépôt n'en a aucun.
- **Ce que ça coûte.** **4 à 6 mois pour un développeur à plein temps qui connaît Rust** (compter 1 à 2 mois de plus pour l'apprendre), pendant lesquels le serveur évolue moins vite ; deux serveurs à faire tourner pendant la transition ; une compétence Rust à garder dans l'équipe pour la maintenance.
- **Avant de commencer** (Lot 0, environ 3 semaines) : le banc de mesure versionné dans le dépôt, les sessions enregistrées dans PostgreSQL au lieu de la mémoire du serveur, le schéma réel de la base de production relevé, et les corrections de sécurité urgentes de la Phase 1a faites dans le serveur actuel, sans attendre Rust.
- Six décisions sont à prendre avant le Lot 0 ([Décisions à prendre](#décisions-à-prendre)) ; chacune a une proposition par défaut.

## Ce qui change, ce qui ne change pas

| | Change | Ne change pas |
|---|---|---|
| **Équipes en magasin** | Rien de visible, sauf les corrections décidées (fuseau horaire, protections). | Écrans, adresses, favoris, identifiants et mots de passe, session en cours au moment de la bascule. |
| **Interface** (`client/`) | En développement : `vite` lancé seul, qui renvoie `/api` vers le serveur Rust, au lieu de Vite intégré à Express (`server/vite.ts`). | React, Vite, Tailwind, React Query, le code des pages. |
| **Serveur** (`server/`) | Réécrit en Rust dans `server-rs/`, puis supprimé. | Les adresses, les réponses JSON, les codes d'erreur. |
| **Types partagés** (`shared/`) | Générés à partir du code Rust à la fin de la migration (Lot 5). | Le paquet `shared/` reste en TypeScript pour l'interface : 33 fichiers de `client/src` l'importent. |
| **Base de données** | Migrations suivies par une table (`_sqlx_migrations`) au lieu de scripts lancés à la main. | PostgreSQL, les tables, les données. Aucune migration de données. |
| **Déploiement** | Image Docker plus légère : un binaire, sans `node_modules`. | Docker Compose, le réseau nginx, le port 3000, `/api/health`, les sauvegardes `pg_dump`. |

**Pourquoi garder React.** Réécrire aussi l'interface en Rust (Leptos, Yew, Dioxus) reviendrait à refaire une trentaine de pages et leurs versions téléphone, au moment où le plan du webUI les refait déjà (Phases 2 et 3). Cela doublerait le coût sans rien apporter aux équipes : la lenteur venait du serveur et des volumes échangés (P4 du plan du webUI), pas de React. C'est la décision R1.

## Le serveur actuel

Inventaire au 15 octobre 2026, qui fixe le périmètre à reporter. Les numéros de ligne renvoient au code de cette date.

### Taille

| Fichier | Lignes | Contenu |
|---|---|---|
| `server/routes.ts` | 6 077 | 134 adresses, contrôles de droits écrits dans chaque gestionnaire |
| `server/storage.ts` | 5 914 | Accès aux données : environ 127 méthodes. Seule `DatabaseStorage` (lignes 387 à 3509) est à reporter ; `MemStorage` (stockage en mémoire de développement) disparaît. |
| `shared/schema.ts` | 1 047 | 26 tables Drizzle, schémas zod |
| `server/invoiceVerification.ts` | 922 | Vérification des factures dans NocoDB, avec cache |
| Les 27 autres fichiers | environ 4 900 | Authentification, API externe, sauvegardes, météo, courriels, chiffrement, migrations |

### Les 148 adresses, par module

| Module | Adresses | Lot |
|---|---|---|
| Santé (`/api/health`) | 1 | 1 |
| Contacts | 4 | 1 |
| Fiches fournisseurs | 4 | 1 |
| Informations (annonces) | 4 | 2 |
| Publicités (`/api/ad-campaigns`) | 7 | 2 |
| Météo | 6 | 2 |
| Statistiques (`/api/stats`) | 4 | 2 |
| Statistiques détaillées (`/api/analytics`, export CSV) | 5 | 2 |
| Tâches | 5 | 3 |
| DLC | 11 | 3 |
| Commandes clients | 6 | 3 |
| SAV | 7 | 3 |
| Commandes fournisseurs | 6 | 4 |
| Livraisons | 7 | 4 |
| Rapprochement BL / factures (commentaires, courriels fournisseurs, vérification de facture, cache) | 13 | 4 |
| Avoirs | 8 | 4 |
| Échéancier (dont export CSV) | 2 | 4 |
| Configuration NocoDB | 5 | 4 |
| Bon à payer (BAP) et webhook | 4 | 4 |
| API externe (`/api/ext/v1`) et gestion de ses clés | 8 | 4 |
| Relais ffnancy | 2 | 4 |
| Authentification | 6 | 5 |
| Utilisateurs | 8 | 5 |
| Magasins (`/api/groups`) | 5 | 5 |
| Sauvegardes | 4 | 5 |
| Paramètres (`/api/utilities`) | 2 | 5 |
| Administration et diagnostic (SQL, schéma, migration d'urgence) | 4 | 5 (décision R3) |
| **Total** | **148** | |

Le Calendrier n'a pas d'adresse à lui : il lit les commandes, les livraisons et les publicités. Il est entièrement servi par Rust à la fin du Lot 4.

### Ce que l'inventaire a révélé

Ces constats changent la façon de migrer ; certains sont déjà dans l'audit du webUI.

- **La production n'utilise pas `localAuth.production.ts`.** `server/routes.ts:4` importe `./localAuth` et c'est lui qui s'exécute : sessions dans la mémoire du processus (perdues à chaque redémarrage, AUTH-06), cookie `connect.sid` valable 24 heures, sans `sameSite`. `localAuth.production.ts`, `db.production.ts` et `monitoring.ts` ne sont jamais exécutés.
- **Aucune protection CSRF, aucune limite de débit, aucun en-tête de sécurité en production** : `server/security.ts` n'est branché que dans `server/index.ts`, qui n'est pas le point d'entrée de l'image Docker (`server/index.production.ts`). L'interface n'envoie d'ailleurs aucun jeton CSRF.
- **Mots de passe** : `scrypt` de Node (N = 16384, r = 8, p = 1, 64 octets), stockés en `empreinte_hex.sel_hex`, le sel hexadécimal étant utilisé tel quel comme texte (`server/localAuth.ts:20-57`). Le paquet `scrypt` de Rust les vérifie à l'identique : **aucun mot de passe à réinitialiser**.
- **Secrets chiffrés** (mot de passe SMTP des magasins, jeton NocoDB) : AES-256-GCM, clé = SHA-256 de `ENCRYPTION_KEY` (à défaut `SESSION_SECRET`), format `enc:v1:iv:tag:données` en base64 (`server/crypto.ts`). Reproductible à l'identique avec le paquet `aes-gcm`.
- **Droits** : une seule adresse utilise un intergiciel de droits (`requireAdmin`, `server/routes.ts:130`). Les autres contrôlent le rôle à la main (environ 131 comparaisons `user.role` et 14 appels `hasPermission`), et DLC, Tâches et Commandes clients ne contrôlent que le magasin.
- **Base** : aucune migration n'est suivie en production. `init.sql` ne crée que 25 tables et ignore des colonnes ajoutées depuis à la main (`contacts`, `suppliers.email`, `customer_orders.notified_at`…). Seul le schéma réel de la production fait foi.
- **Aucune transaction** dans tout le serveur, et un numéro de SAV calculé en « nombre de tickets + 1 » (`server/storage.ts:2824`), qui peut produire des doublons.
- **Dépendances inutilisées** : `xlsx`, `iconv-lite`, `multer`, `busboy`, `node-cron`, `csrf-csrf`, `openid-client`, `memoizee` ne sont importés nulle part. Pas de génération Excel ni PDF côté serveur ; les exports sont en CSV.
- **Aucun test** dans le dépôt. La seule intégration continue construit l'image Docker.

## Architecture cible

### Choix techniques

| Besoin | Aujourd'hui (Node) | En Rust |
|---|---|---|
| Serveur HTTP | Express | `axum` sur `tokio` |
| Compression, fichiers statiques, limite de taille, journal des requêtes | `compression`, `express.static`, `express.json({ limit: '10mb' })` | `tower-http` (`CompressionLayer`, `ServeDir`, `RequestBodyLimitLayer`, `TraceLayer`) |
| Base de données | Drizzle + `pg` | `sqlx` (PostgreSQL) : requêtes SQL écrites en clair, **vérifiées à la compilation** contre le schéma ; cache `.sqlx/` versionné pour compiler sans base |
| Migrations | scripts au démarrage + `psql` dans le `CMD` du Dockerfile | `sqlx::migrate!`, fichiers SQL numérotés, table de suivi |
| Validation des entrées | zod | `serde` (forme) + `validator` ou contrôles écrits à la main (règles) |
| Sessions, connexion | `express-session` + `passport-local` | intergiciel maison, d'environ 200 lignes : lecture du cookie signé, table `session` (voir [Sessions](#sessions-partagées-entre-node-et-rust)) |
| Mots de passe | `crypto.scrypt` | `scrypt` (mêmes paramètres) |
| Chiffrement des secrets | `crypto` AES-256-GCM | `aes-gcm`, `sha2`, `base64` |
| Clés de l'API externe | SHA-256 + `timingSafeEqual` | `sha2` + `subtle` |
| Appels sortants (NocoDB, Visual Crossing, Nominatim, ffnancy, webhooks n8n) | `node-fetch` | `reqwest` (TLS `rustls`), délai maximal sur chaque appel |
| Courriels fournisseurs | `nodemailer` | `lettre` (logo du magasin en pièce jointe intégrée `cid:logo`) |
| Sauvegardes | `exec('pg_dump … > fichier')` dans un shell | `tokio::process::Command` avec arguments séparés, sans shell |
| Tâches de fond | `setInterval` | tâches `tokio` (`tokio::time::interval`) |
| Dates et fuseau | `Date` de JavaScript | `chrono` + `chrono-tz` (`Europe/Paris`, décision R5) |
| Montants | texte renvoyé par `pg` | `rust_decimal`, sérialisé en texte (voir [Compatibilité](#compatibilité--les-pièges)) |
| Journaux | environ 150 `console.log` dans `routes.ts` | `tracing`, à niveaux, sans corps de requête ni données clients |
| Types pour l'interface | `shared/schema.ts` | `ts-rs` : les types TypeScript sont générés depuis les structures Rust (Lot 5) |

Les versions sont figées dans `Cargo.lock`, versionné. Une seule édition de Rust et une version minimale (`rust-version`) inscrites dans `Cargo.toml`.

### Organisation du code

Un seul paquet (`crate`) pour commencer, découpé en modules qui reprennent ceux de l'application. On ne le découpe en plusieurs paquets que si la compilation devient trop lente.

```
server-rs/
  Cargo.toml
  migrations/            fichiers SQL numérotés (sqlx), le premier = schéma de production relevé
  .sqlx/                 requêtes vérifiées, pour compiler sans base (SQLX_OFFLINE=true)
  src/
    main.rs              configuration, démarrage, migrations, tâches de fond
    router.rs            table des adresses servies par Rust ; tout le reste part vers Node
    proxy.rs             relais vers le serveur Node (supprimé au Lot 5)
    auth/                session, cookie signé, utilisateur courant, connexion
    access.rs            droits (rôle × module) et cloisonnement par magasin
    json.rs              formats partagés : dates, montants, erreurs { message }
    crypto.rs            secrets chiffrés (compatible enc:v1)
    modules/             un fichier par module : contacts.rs, dlc.rs, deliveries.rs…
                         chacun avec ses gestionnaires HTTP et ses requêtes SQL
    integrations/        nocodb.rs, mail.rs, weather.rs, webhooks.rs, ffnancy.rs, backup.rs
    jobs.rs              sauvegarde quotidienne, purge du cache des factures
  tests/                 tests d'intégration contre une base PostgreSQL jetable
```

**Une seule table de droits.** La matrice de `shared/permissions.ts` passe dans un fichier de données, `shared/permissions.json`, lu par le serveur Rust (`include_str!` + `serde`) et par l'interface (import JSON). C'est la « table de droits unique » de la Phase 2 du plan du webUI, sans recopie entre les deux langages. Chaque gestionnaire Rust déclare son module et son action ; le contrôle est fait par un extracteur `axum`, plus dans le corps de chaque fonction.

### Sessions partagées entre Node et Rust

Pendant la transition, un utilisateur connecté par Node doit être reconnu par Rust, et inversement. Les sessions en mémoire du processus Node ne le permettent pas : **il faut d'abord les enregistrer dans PostgreSQL** (Lot 0). C'est aussi la correction d'AUTH-06 (sessions perdues à chaque redéploiement), déjà prévue par le plan du webUI.

- **Côté Node (Lot 0)** : `connect-pg-simple` (déjà dans les dépendances), table `session (sid, sess, expire)`. Les utilisateurs se reconnectent une fois, à cette livraison-là.
- **Côté Rust (Lot 1)** : lire le cookie `connect.sid` (`s:` + identifiant + `.` + signature HMAC-SHA256 avec `SESSION_SECRET`, en base64 sans `=`), vérifier la signature en temps constant, lire `sess->'passport'->>'user'` dans la table `session` si `expire` n'est pas dépassé, puis charger l'utilisateur et ses magasins. Une seule lecture de l'utilisateur par requête (règle « utilisateur courant » de P4 § 5.2).
- **Connexion et déconnexion** restent dans Node jusqu'au Lot 5. Rust les reprend alors en écrivant des sessions **au même format** : aucune reconnexion à la bascule, et un retour à Node reste possible.

## Stratégie : une adresse à la fois

```
                 navigateur (PC, téléphone)
                            │
                  nginx (réseau nginx_default)
                            │
        ┌───────────────────▼────────────────────┐
        │  logiflow : serveur Rust, port 3000    │
        │  /assets, index.html, adresses portées │
        └───────────────────┬────────────────────┘
                            │ toute autre adresse /api
        ┌───────────────────▼────────────────────┐
        │  logiflow-node : serveur actuel        │
        │  port 3001, interne, non exposé        │
        └───────────────────┬────────────────────┘
                            │
                 PostgreSQL (logiflow-db), table session commune
```

- **Le serveur Rust est devant dès le premier jour**, avec zéro adresse portée : il sert l'interface (`/assets` avec cache d'un an, `index.html` pour toutes les autres adresses de l'application) et relaie tout `/api` à Node. Cette première livraison ne change rien pour les équipes et valide la tuyauterie en production.
- **Le relais** transmet la méthode, l'adresse, les en-têtes (cookie, `X-API-Key`, `Authorization`, type de contenu) et le corps en flux, sans le lire (l'envoi de facture en `multipart` passe tel quel). Il rend la réponse telle quelle, `Set-Cookie` et redirections 302 comprises (la déconnexion redirige vers `/auth`), sans les suivre. Délai maximal de 120 secondes : certains appels attendent NocoDB ou un webhook jusqu'à 60 secondes.
- **La table des adresses est dans le code** (`router.rs`) : une adresse est servie par Rust si elle y figure, par Node sinon. Faire revenir une adresse à Node, c'est retirer sa ligne et redéployer.
- **Une adresse vit à un seul endroit.** Quand elle passe en Rust, son code Node n'est plus appelé ; on le supprime après deux semaines en production sans régression, dans une PR dédiée.
- **Les tâches de fond ne tournent jamais dans les deux serveurs** : sauvegarde quotidienne, purge du cache des factures, configuration météo et création des index restent dans Node jusqu'au Lot 5, puis passent toutes ensemble en Rust.
- **Le schéma ne bouge pas pendant qu'un module migre.** Un changement de schéma passe par un fichier de `server-rs/migrations/`, appliqué par Rust au démarrage. Les migrations de démarrage de Node (`server/migrations.production.ts`, toutes en `IF NOT EXISTS`) continuent jusqu'au Lot 5, puis deviennent des fichiers SQL.

## Feuille de route

Effort pour un développeur à plein temps qui connaît Rust ; échelle **S** / **M** / **L** du plan du webUI. Chaque lot se termine par une livraison en production et deux semaines de suivi, qui recouvrent le début du lot suivant.

| Lot | Contenu | Adresses | Effort | Prérequis |
|---|---|---|---|---|
| [0. Préparation](#lot-0--préparation) | Banc, sessions en base, schéma relevé, squelette Rust devant Node | 0 | 3 semaines | Décisions R1 à R6 ; Phase 1a du webUI |
| [1. Socle](#lot-1--socle) | Session, droits, magasin, formats JSON, premiers modules | 9 | 2 à 3 semaines | Lot 0 en production |
| [2. Informations et planning](#lot-2--informations-et-planning) | Annonces, Publicités, Météo, Statistiques | 26 | 3 semaines | Lot 1 |
| [3. Au quotidien](#lot-3--au-quotidien) | Tâches, DLC, Commandes clients, SAV | 29 | 3 à 4 semaines | Lot 1 |
| [4. Fournisseurs](#lot-4--fournisseurs) | Commandes, Livraisons, Rapprochement, Avoirs, Échéancier, NocoDB, BAP, API externe | 55 | 6 à 8 semaines | Lot 1 |
| [5. Administration et bascule](#lot-5--administration-et-bascule) | Connexion, Utilisateurs, Magasins, Sauvegardes, Paramètres, tâches de fond ; arrêt de Node | 29 | 3 à 4 semaines | Lots 2 à 4 |
| **Total** | | **148** | **20 à 25 semaines** | |

Les lots 2, 3 et 4 sont indépendants entre eux : un second développeur peut en prendre un en parallèle. L'ordre proposé va du plus simple au plus délicat : les premiers lots rodent les outils sur des modules à faible risque, et le Lot 4, qui porte l'essentiel de la logique métier (factures, NocoDB, rapprochement), arrive quand la méthode est éprouvée.

### Lot 0 — Préparation

**Objectif.** Pouvoir prouver, adresse par adresse, que Rust répond comme Node ; et poser le serveur Rust en production sans rien changer.

1. **Verser le banc de mesure dans le dépôt** (`scripts/bench/`, c'est le lot 2, n° 0 du plan du webUI), et l'étendre :
   - les 148 adresses, pour 5 comptes : administrateur, directeur multi-magasins, manager, employé, compte sans magasin ;
   - des scénarios d'écriture (créer, modifier, valider, supprimer) rejoués sur une copie neuve de la base, avec comparaison de l'état des tables touchées après coup ;
   - la comparaison porte sur le code HTTP, le corps JSON (valeurs, ordre des listes, champs `null`), et les en-têtes qui comptent (`Content-Type`, `Cache-Control`, `Set-Cookie`, `Location`) ;
   - une horloge figée pour les réponses qui dépendent de « aujourd'hui ».
2. **Sessions dans PostgreSQL** côté Node (`connect-pg-simple`, table `session`), cookie `sameSite: 'lax'`. Corrige AUTH-06.
3. **Relever le schéma réel de la production** (`pg_dump --schema-only` sur une copie) ; il devient `server-rs/migrations/0001_schema_initial.sql`, marqué comme déjà appliqué sur les bases existantes. Noter les écarts avec `init.sql`.
4. **Squelette Rust** : configuration (mêmes variables d'environnement : `DATABASE_URL`, `SESSION_SECRET`, `ENCRYPTION_KEY`, `EXTERNAL_API_KEYS`, `VISUAL_CROSSING_API_KEY`, `BACKUP_DIR`, `PORT`), `/api/health`, fichiers statiques, renvoi de `index.html`, relais vers Node, journaux `tracing`, arrêt propre.
5. **Docker** : un service `logiflow` (Rust, port 3000) et un service `logiflow-node` (port 3001, non exposé) dans `docker-compose.yml` ; Dockerfile en étapes : interface construite avec Node, binaire Rust compilé, image finale avec le binaire, `dist/public` et `postgresql-client` (pour `pg_dump`).
6. **Intégration continue** : `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` avec un service PostgreSQL, compilation en `SQLX_OFFLINE=true`, en plus de la construction de l'image existante.

**Critères de réussite.**

- Le banc passe sur l'ensemble des 148 adresses, avec Rust devant Node : 0 différence de statut, de corps ou d'en-tête par rapport à Node seul.
- En production : connexion, déconnexion (302 vers `/auth`), envoi d'une facture en `multipart`, envoi d'un BAP (PDF de plusieurs Mo), appel de l'API externe avec sa clé, téléchargement d'une sauvegarde : tout fonctionne à travers le relais.
- Un redéploiement ne déconnecte plus personne.

### Lot 1 — Socle

**Objectif.** Tout ce dont chaque module aura besoin, éprouvé sur trois modules simples.

- **Utilisateur courant** : extracteur `axum` qui lit la session et charge l'utilisateur avec ses magasins, une fois par requête ; 401 `{ "message": … }` sinon.
- **Droits et magasins** : `shared/permissions.json` (voir [Organisation du code](#organisation-du-code)) ; extracteurs « module + action » et « magasin autorisé ». Les règles appliquées sont celles du serveur Node à ce moment-là, y compris les corrections de la Phase 1a.
- **Formats JSON** communs ([Compatibilité](#compatibilité--les-pièges)) : dates, horodatages, montants, noms de champs, `smtpPasswordSet` à la place du mot de passe SMTP, `Cache-Control: private, no-cache` sur `/api`.
- **Erreurs** : `{ "message": "…" }` en français, avec les mêmes codes HTTP que Node.
- **Chiffrement** compatible `enc:v1`, testé sur des valeurs chiffrées par le code Node.
- **Modules** : Santé (1), Contacts (4), Fiches fournisseurs (4).

**Critères de réussite.** 0 différence au banc sur les 9 adresses pour les 5 comptes ; un secret chiffré par Node est relu par Rust et inversement ; tests unitaires des droits pour chaque case du tableau rôle × module.

### Lot 2 — Informations et planning

Annonces (4), Publicités (7), Météo (6, avec Visual Crossing et Nominatim), Statistiques (4) et Statistiques détaillées (5, dont l'export CSV). Ce sont surtout des lectures et des agrégats : c'est le lot qui rode `sqlx`, les requêtes construites selon les filtres (aujourd'hui assemblées en texte dans `server/storage.ts:3337-3386` et `:3450-3487`, à remplacer par des requêtes paramétrées) et les exports CSV.

**Critères de réussite.** 0 différence au banc sur les 26 adresses ; mêmes octets pour les exports CSV ; aucun appel externe sans délai maximal.

### Lot 3 — Au quotidien

Tâches (5), DLC (11), Commandes clients (6), SAV (7). Les modules les plus utilisés en magasin, mais à la logique simple. Le numéro de SAV est attribué par la base (séquence ou `INSERT … RETURNING` dans une transaction) au lieu du comptage actuel, sans changer son format `SAV-AAAA-0001`.

**Critères de réussite.** 0 différence au banc sur les 29 adresses et les scénarios d'écriture (création, modification, validation, suppression, marquage d'une DLC traitée, client prévenu).

### Lot 4 — Fournisseurs

Commandes fournisseurs (6), Livraisons (7), Rapprochement BL / factures (13), Avoirs (8), Échéancier (2), Configuration NocoDB (5), BAP et webhook (4), API externe et ses clés (8), relais ffnancy (2). Le lot le plus lourd :

- `server/invoiceVerification.ts` (922 lignes) : recherche dans NocoDB par référence de facture puis par numéro de BL, rapprochement du nom de fournisseur, cache avec ses trois durées (6 heures, 12 heures, quasi permanent une fois rapproché). Reporter aussi le second client NocoDB (`server/nocodbService.ts`) ou, si `/api/verify-invoices` n'a pas d'appelant, le supprimer (décision R3) ;
- normalisation des échéances NocoDB (`server/dateUtils.ts`, jour avant mois par défaut) ;
- courriel de demande de documents au fournisseur (`shared/supplierMail.ts`, logo intégré), avec son journal ;
- API externe : clés `lf_…` (seules l'empreinte SHA-256 et un préfixe sont stockés), montants saisis à la française (« 1 234,56 »), règles de gel d'un rapprochement ; documentation `docs/API-RAPPROCHEMENT.md` inchangée ;
- les écritures qui touchent plusieurs tables (validation d'une livraison, rapprochement) passent dans une transaction.

**Critères de réussite.** 0 différence au banc sur les 55 adresses ; NocoDB et les webhooks remplacés au banc par un faux service qui enregistre les appels reçus, identiques entre Node et Rust ; l'outil externe qui appelle `/api/ext/v1` fonctionne sans changement de sa part.

### Lot 5 — Administration et bascule

- **Connexion et déconnexion** (6 adresses, dont la réinitialisation d'urgence : décision R3), **Utilisateurs** (8), **Magasins** (5), **Sauvegardes** (4), **Paramètres** (2), **Administration et diagnostic** (4, décision R3).
- **Tâches de fond** en Rust : sauvegarde quotidienne après 2 h (heure de Paris), purge du cache des factures toutes les 6 heures, configuration météo au démarrage ; création des index et migrations de démarrage converties en fichiers de `server-rs/migrations/`.
- **Types partagés** : `ts-rs` génère `shared/api/*.ts` depuis les structures Rust ; les imports de types de `@shared/schema` dans `client/src` sont remplacés ; les trois schémas zod de formulaire utilisés par l'interface (`insertTaskSchema`, `insertCustomerOrderFrontendSchema`, `insertAnnouncementSchema`) restent écrits à la main dans `shared/forms.ts`.
- **Arrêt de Node** : suppression de `server/`, du relais, du service `logiflow-node`, de Drizzle et des dépendances serveur de `package.json` ; l'image finale ne contient plus Node.

**Critères de réussite.** 0 différence au banc sur les 148 adresses, Rust seul ; un utilisateur connecté avant la bascule reste connecté après ; une sauvegarde automatique est créée la nuit suivante et téléchargeable ; `grep -r "server/" Dockerfile package.json` ne renvoie plus rien.

## Compatibilité : les pièges

L'interface lit les réponses JSON telles que Node les produit aujourd'hui. Chaque écart ci-dessous casserait un écran sans erreur visible ; le banc les détecte, mais autant les traiter dès le Lot 1.

| Sujet | Ce que Node renvoie | Ce qu'il faut en Rust |
|---|---|---|
| Montants (`decimal(10,2)`, 7 colonnes) | du texte : `"12.50"` | `rust_decimal` sérialisé en texte, échelle conservée ; jamais un nombre JSON |
| Dates (`date`, 10 colonnes) | `"2026-10-15"` | `chrono::NaiveDate` (format par défaut identique) |
| Horodatages (`timestamp` sans fuseau, 62 colonnes) | `"2026-10-15T08:30:00.000Z"` : lus comme UTC, millisecondes et `Z` | sérialiseur dédié `%Y-%m-%dT%H:%M:%S%.3fZ` ; le format par défaut de `chrono` n'a ni `Z` ni millisecondes fixes |
| Noms de champs | `camelCase` (Drizzle) ; certaines requêtes brutes rendent du `snake_case` | `#[serde(rename_all = "camelCase")]` par défaut, exceptions relevées au banc |
| Champs vides | présents avec `null` | ne jamais omettre un champ `None` |
| Objets imbriqués | `group`, `supplier`, `creator` dans la plupart des listes ; `dlcDate` en plus de `expiryDate` pour les DLC | mêmes structures, construites en une requête avec jointures |
| Identifiants | entiers (`serial`), sauf `users.id` (texte, ex. `admin_local`) et `database_backups.id` (nanoid) | mêmes types |
| Mot de passe SMTP | remplacé par `smtpPasswordSet: true/false` dans toute réponse | jamais sélectionné dans les requêtes ; `smtpPasswordSet` calculé en SQL |
| Erreurs | `{ "message": "…" }`, 401 si non connecté | identique |
| Déconnexion | redirection 302 vers `/auth` | identique |
| « Aujourd'hui » | `new Date().toISOString().split('T')[0]` : date UTC, fausse entre minuit et 2 h l'été | heure de Paris (décision R5), écart déclaré au banc |
| Corps des requêtes | jusqu'à 10 Mo (logos en data URI, PDF en base64) | même limite |

## Ce qu'on ne reporte pas

Une migration est l'occasion de ne pas recopier ce qui est dangereux ou mort. Chaque ligne est à confirmer (décision R3) ; les adresses sans appelant connu sont d'abord cherchées dans les journaux d'accès de production et les workflows n8n.

| Élément | Où | Proposition |
|---|---|---|
| Exécution de SQL arbitraire | `POST /api/admin/execute-sql` (`server/routes.ts:5797`), SQL-01 | Ne pas reporter : la base s'administre avec `psql`. |
| Réinitialisation d'urgence de l'administrateur | `POST /api/emergency-admin-reset` (`server/index.production.ts:87`) | Remplacer par une commande du binaire (`logiflow reset-admin`), lancée dans le conteneur. |
| Compte `admin` / `admin` créé au démarrage, mot de passe `admin.salt` accepté | `server/localAuth.ts:30`, `:59`, AUTH-04 | Ne pas reporter : premier administrateur créé par la commande ci-dessus. |
| Adresse de webhook fournie par le navigateur | `POST /api/reconciliation/send-invoice` (`server/routes.ts:823`), RAPPRO-21 | Adresse lue en base uniquement (configuration du magasin). |
| Nom de fichier de sauvegarde non contrôlé | `/api/backups/:filename` (`server/routes.ts:4916`, `:4938`), BACKUP-09 | Identifiant de sauvegarde lu en base, jamais un chemin. |
| Géolocalisation météo modifiable par tout utilisateur connecté | `POST /api/weather/geolocation` (`server/routes.ts:5740`) | Réservée à l'administrateur. |
| Routes masquées par une route identique déclarée avant | `POST /api/users/:id/groups`, `DELETE /api/users/:id/groups/:groupId` (`server/routes.ts:4179`, `:4199`) | Ne pas reporter (jamais atteintes). |
| Adresses sans appelant dans `client/src` | `bap/send-webhook`, `sync-order-delivery-status`, `cache/diagnosis`, `cache/update-reconciled`, `verify-invoice`, `verify-invoices`, `avoirs/:id/webhook-status`, `nocodb-config/active`, `ad-campaigns/debug`, `admin/emergency-migration`, diagnostic du schéma | Reporter seulement celles qui ont un appelant en production. |
| Stockage en mémoire de développement | `MemStorage`, `server/storage.ts:3510-5909` | Ne pas reporter : le développement utilise une base PostgreSQL locale (Docker). |
| Pilote Neon par WebSocket | `server/db.ts:55` | Ne pas reporter : PostgreSQL direct partout. |

**Protection des requêtes d'écriture** (décision R4). La production n'en a aucune aujourd'hui. Proposition : cookie `SameSite=Lax` et contrôle de l'en-tête `Origin` sur toute requête qui n'est pas une lecture, sauf `/api/ext/` (clé d'API). Les navigateurs envoient cet en-tête d'eux-mêmes : rien à changer dans l'interface.

## Vérification

- **Le banc fait foi.** Une adresse passe en Rust quand le banc ne montre aucune différence avec Node pour les 5 comptes, en lecture et en écriture. Une différence voulue (fuseau horaire, faille fermée) est inscrite dans la liste des écarts attendus du banc, avec sa raison.
- **Bug pour bug, sauf décision.** On reporte le comportement de Node tel qu'il est au moment du portage. Un bug découvert en route est corrigé d'abord dans Node (et vérifié au banc), ou inscrit comme écart attendu ; jamais corrigé en silence dans Rust.
- **Tests Rust** :
  - unitaires sur les règles pures : droits (chaque case du tableau rôle × module), cloisonnement par magasin, recherche de facture, normalisation des dates, montants à la française, exports CSV ;
  - de compatibilité, sur des valeurs produites par le code Node : empreintes de mots de passe, secrets `enc:v1`, cookies signés, clés d'API ;
  - d'intégration, contre une base PostgreSQL jetable, par module.
- **Requêtes SQL vérifiées à la compilation** par `sqlx` : une colonne renommée ou un type faux ne compile plus.
- **Mesures de performance** au banc, Node puis Rust, à chaque lot : temps de réponse (médiane et 95ᵉ centile) par adresse, mémoire du serveur, temps de démarrage, taille de l'image. Objectif : aucune adresse plus lente qu'avec Node. Les gains sont à mesurer, pas à supposer.
- **Avec chaque rôle, sur PC et téléphone**, comme pour toute livraison (règles communes du plan du webUI).

## Articulation avec le plan du webUI

La migration ne remplace pas le plan d'optimisation du webUI (`docs/PLAN-OPTIMISATION-WEBUI.md`) ; elle change l'endroit où se fait sa partie serveur.

| Phase du plan du webUI | Avec la migration |
|---|---|
| **1a — Corrections critiques** | **À faire dans Node, avant le Lot 0**, sans attendre : ce sont des fuites de données et des failles en production aujourd'hui. Rust reprend ensuite le comportement corrigé. |
| **1b — Corrections rapides de l'interface** | Inchangée : elle ne touche que `client/`. |
| **2 — Socle** | La partie interface (menu, design system, composants) avance en parallèle. Les règles serveur T2 à T7 et la table de droits unique se font **dans Rust**, module par module, au lieu d'être écrites deux fois. |
| **3 — Refonte des pages** | En parallèle. Quand une page a besoin d'une nouvelle adresse (synthèse de l'accueil DASH-05, listes paginées), elle s'écrit en Rust si son module est déjà porté, et son module passe en tête de file sinon. |
| **4 — Performance, lots 2 et 3** | Le banc (lot 2, n° 0) devient le Lot 0 de la migration. Les chantiers côté serveur (requêtes ciblées, échéancier en SQL, journal à niveaux) se font en Rust, lors du portage du module concerné. |
| **5 — Dette** | La partie serveur (point d'entrée unique, suppression de `localAuth.production.ts`, `console.log`, SQL paramétré, identifiants générés par le serveur) est absorbée par la migration. Restent la fusion PC / téléphone et la dette de l'interface. |

## Risques

| Risque | Conséquence | Parade |
|---|---|---|
| Effort sous-estimé, surtout au Lot 4 | Deux serveurs plus longtemps que prévu | Lots indépendants, chacun livré seul : la migration peut s'arrêter après n'importe quel lot sans rien casser, Node servant le reste. |
| Écart de format JSON non vu | Un écran affiche une valeur fausse ou vide, sans erreur | Banc sur 5 comptes, en écriture comme en lecture ; types de l'interface générés depuis Rust au Lot 5. |
| Sessions incompatibles | Utilisateurs déconnectés, ou pire, connectés sous un autre compte | Lecture du cookie signé testée sur des cookies produits par Node ; une session illisible vaut « non connecté », jamais un autre utilisateur. |
| Tâche de fond lancée deux fois | Deux sauvegardes, purges concurrentes | Toutes les tâches restent dans Node jusqu'au Lot 5, puis passent ensemble. |
| Changement de schéma pendant la transition | Node et Rust en désaccord sur une table | Gel du schéma du module en cours ; tout changement passe par `server-rs/migrations/`. |
| Compétence Rust dans l'équipe | Personne pour maintenir le serveur | Décision R6 avant de commencer ; code simple, sans abstraction gratuite, commentaires en français comme le reste du dépôt. |
| Nouvelles demandes métier pendant la migration | Tentation d'écrire les fonctions deux fois | Gel des nouvelles fonctions serveur pour le module en cours de portage seulement (décision R2). |
| Mémoire : deux serveurs pendant la transition | Plus de mémoire consommée sur l'hôte | Le serveur Rust ajoute peu ; à mesurer au Lot 0. |

## Décisions à prendre

| N° | Question | Proposition par défaut |
|---|---|---|
| R1 | **Périmètre** : le serveur seul, ou aussi l'interface en Rust ? | **Le serveur seul.** L'interface React reste, et sa refonte suit le plan du webUI. |
| R2 | **Gel des fonctions** : peut-on suspendre les évolutions serveur d'un module pendant son portage (1 à 4 semaines) ? | Oui, module par module ; les urgences passent dans Node puis sont reportées au banc. |
| R3 | **Ce qu'on ne reporte pas** : la liste de [Ce qu'on ne reporte pas](#ce-quon-ne-reporte-pas). | Tout ce qui y est proposé, après lecture des journaux d'accès de production pour les adresses sans appelant connu. |
| R4 | **Protection des requêtes d'écriture** : l'ajouter à la migration ? | Oui : `SameSite=Lax` et contrôle de `Origin`, sans changement de l'interface. |
| R5 | **Fuseau horaire** : « aujourd'hui » et la sauvegarde de 2 h à l'heure de Paris ? | Oui (c'est T5 du plan du webUI) ; écart déclaré au banc. |
| R6 | **Qui écrit et maintient le code Rust**, et qui le relit ? | À désigner avant le Lot 0 ; si personne ne connaît Rust, prévoir 1 à 2 mois d'apprentissage, ou ne pas lancer la migration. |
