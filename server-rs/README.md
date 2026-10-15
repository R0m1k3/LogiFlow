# Serveur LogiFlow en Rust

Serveur axum placé devant le serveur Node pendant la migration (`docs/PLAN-MIGRATION-RUST.md`). Il sert l'interface (`dist/public`) et les adresses déjà portées (`src/router.rs`), et relaie toutes les autres au serveur Node (`src/proxy.rs`). Les deux serveurs partagent la base PostgreSQL et les sessions (table `sessions`, cookie `connect.sid`).

## Lancer en local

```bash
npm ci && scripts/bench/build-node.sh          # interface et serveur Node construits (dist/)
NODE_ENV=production PORT=3001 DATABASE_URL=postgres://… SESSION_SECRET=… node dist/index.js
cd server-rs
PORT=3000 NODE_UPSTREAM=http://127.0.0.1:3001 STATIC_DIR=../dist/public \
  DATABASE_URL=postgres://… SESSION_SECRET=… cargo run
```

Puis ouvrir http://localhost:3000. `SESSION_SECRET` (et `ENCRYPTION_KEY` s'il est utilisé) doit être le même pour les deux serveurs : sinon Rust ne reconnaît pas les sessions ouvertes par Node, ni les secrets qu'il a chiffrés.

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | port d'écoute | `3000` |
| `DATABASE_URL` | base PostgreSQL | obligatoire |
| `NODE_UPSTREAM` | serveur Node qui sert les adresses non portées | `http://127.0.0.1:3001` |
| `STATIC_DIR` | interface construite par Vite | `dist/public` |
| `SESSION_SECRET` | signature du cookie de session (comme Node) | `fallback-secret-key` |
| `ENCRYPTION_KEY` | clé des secrets chiffrés (à défaut `SESSION_SECRET`) | — |
| `NODE_ENV` | renvoyé par `/api/health` | `production` |
| `RUST_LOG` | niveau des journaux (`info`, `debug`…) | `info` |

## Vérifier

```bash
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

Puis le banc de comparaison avec Node (`scripts/bench/README.md`) : une adresse passe en Rust quand il ne montre aucun écart.

## Organisation

- `src/router.rs` : table des adresses servies par Rust ; toute autre adresse part vers Node. Retirer une ligne fait revenir le module à Node.
- `src/modules/` : un fichier par module de l'application ; `src/services/` : services partagés (NocoDB, vérification des factures, courriels).
- Socle : session et utilisateur (`auth.rs`), droits (`access.rs`, matrice de `shared/permissions.json`), validation au format zod (`zod.rs`), accès aux tables (`db.rs`), formats JSON de Node (`json.rs`, `js.rs`), secrets chiffrés (`crypto.rs`), erreurs (`error.rs`).
- `src/schema.rs` est **généré** depuis `shared/schema.ts` : après un changement de schéma, `DATABASE_URL=… npx tsx scripts/gen-rust-schema.ts`.
- Porter un module : `PORTAGE.md`.
