# Banc de comparaison Node / Rust

Le serveur Node a quitté le dépôt ; il reste la référence du comportement attendu. Le banc rejoue les mêmes requêtes sur le serveur Node de référence (construit depuis le commit `REFERENCE_NODE_COMMIT`) et sur le serveur Rust et compare, requête par requête : code HTTP, corps (valeurs et ordre des listes), en-têtes utiles (`Content-Type`, `Cache-Control`, `Location`, `Content-Disposition`, attributs des cookies), état des tables après les écritures, et appels faits aux services externes. Tout changement du serveur Rust qui ne doit pas changer son comportement passe par lui ; un changement voulu y est déclaré comme écart (`deviation`).

## Préparer

1. PostgreSQL local, avec un rôle qui peut créer des bases :
   ```bash
   sudo -u postgres psql -c "CREATE ROLE logiflow_admin LOGIN SUPERUSER PASSWORD 'bench'"
   ```
   Autre adresse : variable `BENCH_PG_URL` (par défaut `postgres://logiflow_admin:bench@localhost:5432`).
2. Construire le serveur Node de référence : `scripts/bench/reference-node.sh`. Il en fait une copie de travail à part (`.bench-reference/`, ignorée par git) au commit `REFERENCE_NODE_COMMIT`, avec son interface ; à refaire seulement quand ce commit change. Autre dossier : variable `BENCH_NODE_DIR`.
3. Construire le serveur Rust : `cargo build --release --manifest-path server-rs/Cargo.toml` (autre binaire : `RUST_BIN`).
4. Créer la base modèle `bench_seed` : `scripts/bench/setup.sh`. Elle contient le schéma de production (`schema.sh`), les index créés au premier démarrage du Node de référence et les données de `seed.ts` : 3 magasins, 5 comptes, quelques lignes par table, datées par rapport au jour du passage.

## Lancer

```bash
npx tsx scripts/bench/compare.ts                  # Node de référence contre Rust
npx tsx scripts/bench/compare.ts --only dlc,tasks # seulement ces modules
npx tsx scripts/bench/compare.ts --mode node      # Node contre Node : le banc est-il stable ?
```

Les deux serveurs servent la même interface (celle de la référence). Plusieurs bancs en parallèle : `BENCH_ID` (bases distinctes) et `BENCH_PORT_BASE` (ports distincts).

Le résultat liste les écarts, puis un tableau par module. Les réponses complètes et les écarts sont écrits dans le dossier de journaux affiché au début (`gauche.json`, `droite.json`, `ecarts.json`), avec les journaux des serveurs.

## Ajouter des requêtes

Une liste par module dans `cases/` (lectures et scénarios d'écriture, voir `types.ts`), déclarée dans `cases/index.ts`.

- **Lecture** : rejouée pour les 5 comptes et sans session, sur la même base.
- **Écriture** : base remise à zéro avant chaque compte ; les tables listées sont comparées à la fin.
- **Gabarits** : `{{today}}`, `{{today+3}}`, `{{year-1}}`, `{{month}}` ; `{{0.id}}` reprend l'`id` de la réponse de l'étape 0.
- Les horodatages proches du passage sont remplacés par `<maintenant>` ; `ignore` masque d'autres champs propres à chaque passage.
- **Écart voulu** (faille fermée, décision du plan) : `deviation: { fields, reason }` retire ces champs des deux côtés avant la comparaison ; le banc rappelle la raison en fin de rapport.

## Comptes et services simulés

| Compte | Rôle | Magasins |
|---|---|---|
| `admin` | admin | aucun (voit tout) |
| `directeur` | directeur | Nancy, Metz |
| `manager` | manager | Nancy |
| `employe` | employee | Nancy |
| `sans-magasin` | employee | aucun |

Plus `anonyme` (sans session) et `api` (clé de l'API externe). Mots de passe et clé : `config.ts`.

`stub.ts` simule NocoDB (table de factures), les webhooks (avoirs, BAP) et un serveur SMTP ; les magasins du banc pointent vers lui. La météo (Visual Crossing) et ffnancy, dont les adresses sont écrites dans le code, ne sont pas rejouées.
