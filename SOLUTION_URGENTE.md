# SOLUTION URGENTE - Production DLC

## Commande immédiate à exécuter sur votre serveur

### Étape 1: Appliquer la migration
```bash
docker-compose exec logiflow-db psql -U logiflow_admin -d logiflow_db << 'EOF'
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);

SELECT 'Migration DLC terminée' as status;
EOF
```

### Étape 2: Redémarrer l'application
```bash
docker-compose restart logiflow
```

## Si la première commande ne fonctionne pas

### Alternative avec connexion directe:
```bash
# Identifier le nom du conteneur PostgreSQL
docker ps | grep postgres

# Se connecter directement
docker exec -it [NOM_CONTENEUR_POSTGRES] psql -U logiflow_admin -d logiflow_db

# Puis dans psql, exécuter:
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);

\q
```

## Vérification
Après l'application, vérifiez que les colonnes existent :
```bash
docker-compose exec logiflow-db psql -U logiflow_admin -d logiflow_db -c "\d dlc_products"
```

L'erreur "column does not exist" disparaîtra immédiatement.