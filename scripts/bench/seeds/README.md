Données complémentaires du banc, une par lot : chaque fichier `*.ts` exporte
`seed(q)` (voir `seed.ts`), appelée après les données de base, par ordre
alphabétique de nom de fichier. Identifiants à partir de 100 pour ne pas
heurter ceux de `seed.ts` ni ceux d'un autre fichier : choisir une centaine
libre (lot 2 : 200…, lot 3 : 300…, lot 4 : 400…, lot 5 : 500…).

Les fichiers de `sauvegardes/` (sauvegardes déclarées dans `database_backups`)
sont copiés par `compare.ts` dans le dossier de sauvegardes de chaque serveur.
