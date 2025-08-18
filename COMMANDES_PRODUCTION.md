# COMMANDES PRODUCTION - Solution Immédiate

## SOLUTION URGENTE (2 minutes)

### Commande 1: Appliquer la migration DLC
```bash
docker-compose exec logiflow-db psql -U logiflow_admin -d logiflow_db -f - << 'EOF'
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);

UPDATE dlc_products SET stock_epuise = false WHERE stock_epuise IS NULL;

SELECT 'Migration DLC terminée' as status;
EOF
```

### Commande 2: Redémarrer l'application
```bash
docker-compose restart logiflow
```

### Alternative si la première ne marche pas:
```bash
# Option A: Via fichier SQL
docker cp MIGRATION_PRODUCTION_URGENTE.sql [CONTAINER_NAME]:/tmp/migration.sql
docker-compose exec logiflow-db psql -U logiflow_admin -d logiflow_db -f /tmp/migration.sql

# Option B: Connexion directe
docker-compose exec logiflow-db psql -U logiflow_admin -d logiflow_db

# Dans psql, coller:
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);
```

## Vérification
```bash
# Vérifier que les colonnes existent
docker-compose exec logiflow-db psql -U logiflow_admin -d logiflow_db -c "
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name='dlc_products' 
AND column_name LIKE '%stock_epuise%';
"

# Vérifier les logs de l'application
docker-compose logs logiflow | tail -20
```

## Résultat attendu
```
    column_name     |     data_type
--------------------+-------------------
 stock_epuise       | boolean
 stock_epuise_at    | timestamp without time zone
 stock_epuise_by    | character varying
```

L'erreur "column does not exist" disparaîtra immédiatement.