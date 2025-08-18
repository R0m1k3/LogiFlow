# SOLUTION IMMÉDIATE - Migration DLC Production

## Problème
```
exec /app/scripts/docker-entrypoint.sh: no such file or directory
```

## Solution Rapide (2 minutes)

### ÉTAPE 1: Appliquer la migration directement
```bash
# Sur votre serveur de production, exécutez :
docker-compose exec logiflow-db psql -U logiflow_admin -d logiflow_db -c "
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);
"
```

### ÉTAPE 2: Redémarrer l'application
```bash
docker-compose restart logiflow
```

## Alternative avec script automatique
```bash
# Utilisez le script de correction :
chmod +x fix-docker-entrypoint.sh
./fix-docker-entrypoint.sh
```

## Vérification
```bash
# Vérifier que les colonnes existent :
docker-compose exec logiflow-db psql -U logiflow_admin -d logiflow_db -c "
SELECT column_name FROM information_schema.columns 
WHERE table_name='dlc_products' 
AND column_name LIKE '%stock_epuise%';
"
```

Résultat attendu :
```
 column_name     
-----------------
 stock_epuise
 stock_epuise_by  
 stock_epuise_at
```

## Après cette correction
- ✅ L'erreur "column does not exist" disparaîtra
- ✅ L'interface DLC fonctionnera
- ✅ Les boutons stock épuisé seront opérationnels