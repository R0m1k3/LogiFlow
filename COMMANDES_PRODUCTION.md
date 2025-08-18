# MIGRATION PRODUCTION URGENTE - DLC Stock Épuisé

## Problème
```
Error: column dlc_products.stock_epuise does not exist
```

## Solution Rapide

### Option 1: Migration SQL directe
```bash
# Connectez-vous à votre base PostgreSQL de production
psql -h [VOTRE_HOST] -U [VOTRE_USER] -d [VOTRE_DB] -f MIGRATION_PRODUCTION_URGENTE.sql
```

### Option 2: Commandes manuelles
```sql
-- Connectez-vous à votre base et exécutez :
ALTER TABLE dlc_products 
ADD COLUMN IF NOT EXISTS stock_epuise boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS stock_epuise_by varchar(255),
ADD COLUMN IF NOT EXISTS stock_epuise_at timestamp;

CREATE INDEX IF NOT EXISTS idx_dlc_products_stock_epuise ON dlc_products(stock_epuise);
```

### Option 3: Via Docker (si vous utilisez notre docker-compose)
```bash
# Sur votre serveur de production
./scripts/production-deploy-dlc-stock.sh
```

## Vérification après migration
```sql
SELECT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name='dlc_products' 
    AND column_name='stock_epuise'
);
```

Résultat attendu: `t` (true)

## Redémarrage application
Après la migration, redémarrez votre application :
```bash
# Si Docker
docker-compose restart logiflow

# Ou selon votre setup
systemctl restart votre-service
```

## Vérification fonctionnelle
1. L'erreur "column does not exist" doit disparaître
2. L'interface DLC doit afficher les boutons PackageX et RotateCcw
3. Les fonctionnalités stock épuisé doivent être opérationnelles