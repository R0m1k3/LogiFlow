# Serveur LogiFlow (Rust)

Serveur unique de l'application : il sert l'API (`src/router.rs`) et l'interface construite par Vite (`dist/public`), applique les migrations au démarrage (`src/startup.rs`) et lance les tâches de fond (`src/jobs.rs` : sauvegarde automatique quotidienne, purge des caches, compte `admin` par défaut sur une base vide). Il a remplacé le serveur Node/Express, dont il reprend le comportement à l'identique (`docs/PLAN-MIGRATION-RUST.md`) : mêmes réponses, même cookie de session (`connect.sid`, table `sessions`), mêmes secrets chiffrés.

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
| `SESSION_SECRET` | signature du cookie de session | `fallback-secret-key` |
| `ENCRYPTION_KEY` | clé des secrets chiffrés en base (à défaut `SESSION_SECRET`) | — |
| `BACKUP_DIR` | dossier des sauvegardes (`pg_dump` doit être installé) | `backups` |
| `NODE_ENV` | renvoyé par `/api/health` | `production` |
| `RUST_LOG` | niveau des journaux (`info`, `debug`…) | `info` |

Ne pas changer `SESSION_SECRET` ni `ENCRYPTION_KEY` d'une installation existante : les sessions ouvertes et les secrets déjà chiffrés (mot de passe SMTP, jeton NocoDB) deviendraient illisibles.

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
