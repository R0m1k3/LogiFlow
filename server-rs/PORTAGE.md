# Modifier le serveur Rust sans changer son comportement

Guide écrit pour le portage des adresses de l'ancien serveur Node (`server/routes.ts`) vers `server-rs/` (`docs/PLAN-MIGRATION-RUST.md`). Le portage est terminé et `server/` a quitté le dépôt ; son code reste lisible dans la copie de référence du banc (`.bench-reference/server/`, construite par `scripts/bench/reference-node.sh`). Les règles valent toujours : une adresse est fidèle quand le banc (`scripts/bench/`) ne montre **aucun écart** avec le Node de référence, pour les 5 comptes, en lecture comme en écriture ; tout changement voulu y est déclaré comme écart.

## La règle : le même comportement que Node, bug compris

- Même code HTTP, même corps JSON (valeurs, champs `null`, ordre des listes), mêmes messages d'erreur, même ordre des contrôles (droits, puis validation, puis base).
- Les défauts connus de Node (cloisonnement par magasin incomplet, contrôles de rôle manquants…) ont été **reproduits** et signalés par un commentaire qui cite l'identifiant de l'audit s'il existe (ex. `CONT-02`). Les corriger, c'est déclarer l'écart au banc (`deviation`) dans le même commit.
- Ne rien « améliorer » en route : une différence voulue doit être décidée et inscrite au banc.

## Lire le code Node de référence

Dans `.bench-reference/`, pour chaque adresse :

1. le gestionnaire dans `server/routes.ts` (ou `server/externalApi.ts`, `server/localAuth.ts`) : contrôles, paramètres lus (`req.query`, `req.params`, `req.body`), schéma zod, messages, codes ;
2. la méthode de `server/storage.ts` (`DatabaseStorage`, lignes 387 à 3509 ; ignorer `MemStorage`) : requête, jointures, tri, projections (`groupSummaryColumns`…) ;
3. les schémas de `shared/schema.ts` (`insertXSchema`, `.omit`, `.extend`, `.partial`) ;
4. les services appelés (`server/invoiceVerification.ts`, `server/emailService.ts`…).

## Outils du socle

| Besoin | Rust | Équivalent Node |
|---|---|---|
| Utilisateur connecté (401 « Authentification requise » sinon) | extracteur `auth::CurrentUser` : `user.user` (ligne `UsersRow`), `role()`, `is_admin()`, `group_ids()` | `isAuthenticated`, `req.user`, `getCurrentUser(req)`, `storage.getUser(req.user.id)` |
| Utilisateur facultatif | `auth::MaybeUser` | `req.isAuthenticated()` |
| Corps de la requête | `request::JsonBody(body)` : `serde_json::Value`, `{}` si le type n'est pas JSON | `req.body` (`express.json()`) |
| Paramètres d'adresse | `request::JsQuery` : `get("x")`, `truthy("x")` (présent et non vide) | `req.query.x`, `if (req.query.x)` |
| Identifiant d'adresse | `Path<String>` puis `request::int_id(&id, "message 500")` | `parseInt(req.params.id)` (NaN → erreur SQL → 500) |
| Lignes d'une table | `schema::XRow` (généré : clés, ordre et formats JSON de Drizzle), `XRow::select("WHERE … ORDER BY …")` | `db.select().from(x)` |
| Insertion, mise à jour, suppression | `db::insert::<XRow>`, `db::update_by_id::<XRow>(…, true)` (ajoute `updatedAt`), `db::delete_by_id` | `insert().values().returning()`, `update().set({ ...data, updatedAt: new Date() })` |
| Validation zod | `XRow::insert_schema()` (createInsertSchema), puis `.omit`, `.pick`, `.extend(vec![Field::…])`, `.partial()`, `.parse(&body)` | `insertXSchema.parse(req.body)` |
| Erreurs | `error::AppError::{forbidden, not_found, bad_request, internal, validation}`, `.or_500("message")` sur un `Result`, `error::json_or_empty` (`res.json(undefined)`) | `res.status(…).json({ message })` |
| Projections jointes | `projections::{GroupSummary, GroupReconciliation, UserSummary, PublicUser}` | `groupSummaryColumns`, `userSummaryColumns`… |
| Droits par module | `access::has_permission(role, "deliveries", "edit")` | `hasPermission(...)` (`shared/permissions.json`) |
| Secrets chiffrés | `crypto::decrypt(value, &state.config.encryption_key)` / `encrypt` | `decryptSecret` / `encryptSecret` |
| Sémantique JavaScript | `js::to_number`, `js::parse_int`, `js::new_date`, `js::iso`, `js::length` | `Number()`, `parseInt()`, `new Date()`, `toISOString()`, `.length` |
| Formats de date | `json::ts` (`2026-10-15T08:30:00.000Z`), `json::pg_text` (valeur brute du pilote : `2026-10-15 08:30:00`) ; `modules::now_iso()` | Date JSON ; colonnes lues par `sql\`…\`` |

Points d'attention :

- **Tri** : reprendre l'`ORDER BY` de Drizzle. Un tri fait en JavaScript (`.sort`) se refait en Rust à l'identique (tri stable, mêmes clés). Sans `ORDER BY` côté Node, garder la même requête (même jointure) pour obtenir le même ordre.
- **Montants** (`decimal`) : `rust_decimal::Decimal`, sérialisé en texte (`"12.50"`), comme Node.
- **Dates** (`date`) : `NaiveDate`, `"2026-10-15"`. **Horodatages** : `NaiveDateTime` sérialisé par `json::ts`.
- **Requêtes SQL** : `sqlx::query_as` à l'exécution, avec des paramètres liés (`$1`), jamais de valeur collée dans le texte SQL. Pour une jointure, une structure locale `#[derive(FromRow)]` ou des tuples, puis la forme JSON de Node.
- **Paramètres envoyés en texte** : `db::insert` / `update_by_id` envoient chaque valeur en texte converti par PostgreSQL (`$1::date`), comme node-pg. Pour une requête écrite à la main, lier des types Rust (`i32`, `String`, `NaiveDate`…).
- **Socle** (`db.rs`, `zod.rs`, `js.rs`…) : un ajout doit être purement additif ; changer un outil existant touche tous les modules, donc tout le banc.
- **Nouvelle adresse** : la déclarer dans le module (`.route(…)`) ; `build.rs` l'ajoute aux motifs d'Express (casse, « / » final) et elle passe par `router.rs` sans autre changement.

## Le banc

Une base et des ports par copie de travail (`BENCH_ID`, `BENCH_PORT_BASE`), le Node de référence construit une fois (`BENCH_NODE_DIR`, par défaut `.bench-reference`) :

```bash
scripts/bench/reference-node.sh             # une fois, puis à chaque changement de REFERENCE_NODE_COMMIT
export BENCH_ID=essai BENCH_PORT_BASE=3600
scripts/bench/setup.sh                       # base modèle (après tout changement de seeds/)
cargo build --manifest-path server-rs/Cargo.toml
RUST_BIN=server-rs/target/debug/logiflow npx tsx scripts/bench/compare.ts --only dlc,tasks
npx tsx scripts/bench/compare.ts --mode node --only dlc,tasks   # les cas sont-ils stables ?
```

1. **Les cas** : dans le fichier de cas du module (`scripts/bench/cases/`), des lectures avec les paramètres que l'interface envoie (chercher les appels dans `client/src`), et un scénario d'écriture par adresse qui modifie quelque chose, avec des corps valides et invalides, sur des lignes du magasin de l'utilisateur et d'un autre magasin. `--mode node` doit donner 0 écart.
2. **Données** : si la base du banc ne permet pas d'exercer un cas, ajouter des lignes dans `scripts/bench/seeds/<lot>.ts` (voir `seeds/README.md`), puis relancer `setup.sh`.
3. **Rust** : 0 écart, hors écarts déclarés.
4. Les services externes (NocoDB, webhooks, SMTP) sont simulés par `stub.ts` ; les appels reçus font partie de la comparaison.

## Avant de rendre la main

- `cargo fmt`, `cargo clippy --all-targets -- -D warnings`, `cargo test` ;
- banc complet : 0 écart, hors écarts déclarés ;
- un commit par changement, message en français, qui donne le résultat du banc.
