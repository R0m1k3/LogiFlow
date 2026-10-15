# Banc de comparaison Node / Rust

Rejoue les mêmes requêtes sur deux serveurs et compare, requête par requête : code HTTP, corps (valeurs et ordre des listes), en-têtes utiles (`Content-Type`, `Cache-Control`, `Location`, `Content-Disposition`, attributs des cookies), état des tables après les écritures, et appels faits aux services externes. C'est ce qui décide qu'une adresse peut passer en Rust (`docs/PLAN-MIGRATION-RUST.md`, « Vérification »).

## Préparer

1. PostgreSQL local, avec un rôle qui peut créer des bases :
   ```bash
   sudo -u postgres psql -c "CREATE ROLE logiflow_admin LOGIN SUPERUSER PASSWORD 'bench'"
   ```
   Autre adresse : variable `BENCH_PG_URL` (par défaut `postgres://logiflow_admin:bench@localhost:5432`).
2. Construire l'interface et le serveur Node comme le `Dockerfile` (`npx vite build`, puis la commande `esbuild` du Dockerfile), et le serveur Rust (`cargo build --release` dans `server-rs/`).
3. Créer la base modèle `bench_seed` : `scripts/bench/setup.sh`. Elle contient le schéma de production (`schema.sh`), les index créés au démarrage de Node et les données de `seed.ts` : 3 magasins, 5 comptes, quelques lignes par table, datées par rapport au jour du passage.

## Lancer

```bash
npx tsx scripts/bench/compare.ts                  # Node seul contre Rust devant Node
npx tsx scripts/bench/compare.ts --only dlc,tasks # seulement ces modules
npx tsx scripts/bench/compare.ts --mode node      # Node contre Node : le banc est-il stable ?
```

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
