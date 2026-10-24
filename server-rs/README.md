# Serveur LogiFlow (Rust)

Serveur unique de l'application : il sert l'API (`src/router.rs`) et l'interface construite par Vite (`dist/public`), applique les migrations au démarrage (`src/startup.rs`) et lance les tâches de fond (`src/jobs.rs` : sauvegarde automatique quotidienne, purge des caches, compte `admin` initial sur une base vide). Il a remplacé le serveur Node/Express, dont il reprend le comportement à l'identique (`docs/PLAN-MIGRATION-RUST.md`) : mêmes réponses, même cookie de session (`connect.sid`, table `sessions`), mêmes secrets chiffrés.

## Lancer en local

```bash
npx vite build                       # interface dans dist/public
DATABASE_URL=postgres://… SESSION_SECRET=… cargo run --manifest-path server-rs/Cargo.toml
```

Puis ouvrir http://localhost:3000. Pour travailler sur l'interface : `npm run dev:server` et, à côté, `npm run dev` (Vite sur http://localhost:5173, qui relaie `/api` vers le port 3000).

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | port d'écoute | `3000` |
| `DATABASE_URL` | base PostgreSQL | obligatoire |
| `STATIC_DIR` | interface construite par Vite | `dist/public` |
| `SESSION_SECRET` | signature du cookie de session (16 caractères au minimum) | obligatoire |
| `ENCRYPTION_KEY` | clé des secrets chiffrés en base (à défaut `SESSION_SECRET`, avec avertissement) | — |
| `ENCRYPTION_KEY_PREVIOUS` | anciennes clés, séparées par des virgules : secrets rechiffrés avec `ENCRYPTION_KEY` au démarrage | — |
| `ADMIN_PASSWORD` | mot de passe initial du compte `admin` sur une base vide | aléatoire, dans les journaux |
| `BACKUP_DIR` | dossier des sauvegardes (`pg_dump` doit être installé) | `backups` |
| `NODE_ENV` | renvoyé par `/api/health` | `production` |
| `ALLOWED_ORIGINS` | origines acceptées en plus de l'hôte du serveur pour les requêtes d'écriture (`https://a.fr,https://b.fr`), voir `src/origin.rs` | — |
| `RUST_LOG` | niveau des journaux (`info`, `debug`…) | `info` |

Changer `SESSION_SECRET` ferme les sessions ouvertes. Changer `ENCRYPTION_KEY` : mettre l'ancienne clé dans `ENCRYPTION_KEY_PREVIOUS` (l'ancien `SESSION_SECRET` et les valeurs autrefois publiées dans le dépôt sont essayés d'office), les secrets chiffrés (mot de passe SMTP, jeton NocoDB) sont rechiffrés au démarrage.

## Vérifier

```bash
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

Puis le banc de comparaison avec le serveur Node de référence (`scripts/bench/README.md`) : aucun écart attendu, hors écarts déclarés.

## Organisation

- `src/router.rs` : table des adresses de l'API. `src/express_routes.rs` retrouve l'adresse qu'Express aurait servie (casse, « / » final) ; `src/static_files.rs` sert l'interface et la page 404 d'Express.
- `src/modules/` : un fichier par module de l'application ; `src/services/` : services partagés (NocoDB, vérification des factures, courriels, dates).
- Socle : session et utilisateur (`auth.rs`), droits (`access.rs`, matrice de `shared/permissions.json`), validation au format zod (`zod.rs`), accès aux tables (`db.rs`), formats JSON de Node (`json.rs`, `js.rs`), secrets chiffrés (`crypto.rs`), erreurs (`error.rs`).
- `src/schema.rs` est **généré** depuis `shared/schema.ts` : après un changement de schéma, `DATABASE_URL=… npm run gen:rust-schema`, et la migration correspondante dans `src/startup.rs`.
- Ajouter ou modifier une adresse : `PORTAGE.md` (règles et outils du socle).

## Maintenance (décision R6)

- Mainteneur et relecteur : @R0m1k3 (`.github/CODEOWNERS`). Toute modification passe par une PR dont la CI est verte : `cargo fmt`, `clippy -D warnings`, tests, contrôle de type de l'interface et banc.
- Dans les réglages GitHub du dépôt, protéger `main` : relecture des CODEOWNERS et vérifications « Serveur Rust » obligatoires.
- Dépendances : `cargo update` puis banc complet, une fois par mois ; Rust stable, image `rust:1.97-alpine` montée en même temps.
- Heure : « aujourd'hui » se calcule à Paris (`src/clock.rs`, décision R5) ; ne jamais utiliser `Utc::now().date_naive()` pour une date du jour.
- Écritures d'un autre site refusées (`src/origin.rs`, décision R4) : un nouveau service qui appelle l'API depuis un navigateur sur une autre adresse se déclare dans `ALLOWED_ORIGINS`.
