# 🐛 DEBUG PRODUCTION - Module Avoirs

## ⚠️ Problème identifié
D'après votre capture d'écran, l'erreur "Failed to create avoir" indique un problème côté serveur.

## 🔍 ÉTAPES DE DÉBOGAGE

### 1️⃣ **Vérifier que la table `avoirs` existe**

```bash
# Connectez-vous à votre base PostgreSQL
psql -d votre_database_name

# Vérifiez si la table existe
\dt avoirs

# Si elle n'existe pas, vous verrez "Did not find any relation named avoirs"
```

### 2️⃣ **Créer la table manquante**

Si la table n'existe pas, exécutez le script SQL fourni :

```bash
# Depuis votre serveur, exécutez :
psql -d votre_database_name -f sql/create_avoirs_table.sql

# Ou copiez-collez le contenu du fichier directement :
```

```sql
-- Script de création de la table avoirs pour la production
CREATE TABLE IF NOT EXISTS avoirs (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  invoice_reference VARCHAR(255),
  amount DECIMAL(10,2),
  comment TEXT,
  commercial_processed BOOLEAN DEFAULT FALSE,
  status VARCHAR(50) DEFAULT 'En attente de demande' CHECK (status IN ('En attente de demande', 'Demandé', 'Reçu')),
  webhook_sent BOOLEAN DEFAULT FALSE,
  nocodb_verified BOOLEAN DEFAULT FALSE,
  nocodb_verified_at TIMESTAMP,
  processed_at TIMESTAMP,
  created_by VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_avoirs_supplier_id ON avoirs(supplier_id);
CREATE INDEX IF NOT EXISTS idx_avoirs_group_id ON avoirs(group_id);
CREATE INDEX IF NOT EXISTS idx_avoirs_created_by ON avoirs(created_by);
CREATE INDEX IF NOT EXISTS idx_avoirs_status ON avoirs(status);
CREATE INDEX IF NOT EXISTS idx_avoirs_created_at ON avoirs(created_at DESC);

-- Trigger pour mettre à jour automatically updated_at
CREATE OR REPLACE FUNCTION update_avoirs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_avoirs_updated_at_trigger ON avoirs;
CREATE TRIGGER update_avoirs_updated_at_trigger
  BEFORE UPDATE ON avoirs
  FOR EACH ROW
  EXECUTE FUNCTION update_avoirs_updated_at();
```

### 3️⃣ **Vérifier les logs serveur**

```bash
# Sur votre serveur, surveillez les logs :
tail -f /var/log/your_app.log

# Ou si vous utilisez PM2 :
pm2 logs your_app_name

# Ou Docker :
docker logs your_container_name -f
```

### 4️⃣ **Tester manuellement l'API**

```bash
# Test avec curl pour vérifier l'API
curl -X POST http://votre-serveur.com/api/avoirs \
  -H "Content-Type: application/json" \
  -H "Cookie: connect.sid=your_session_cookie" \
  -d '{
    "supplierId": 1,
    "groupId": 1,
    "invoiceReference": "TEST123",
    "amount": 100.00,
    "comment": "Test avoir",
    "commercialProcessed": false
  }'
```

### 5️⃣ **Vérifier les permissions de base**

```sql
-- Vérifiez que votre utilisateur de base de données a les bonnes permissions
GRANT ALL PRIVILEGES ON TABLE avoirs TO your_db_user;
GRANT USAGE, SELECT ON SEQUENCE avoirs_id_seq TO your_db_user;
```

## 🛠️ SOLUTIONS COMMUNES

### **Erreur : Table 'avoirs' doesn't exist**
➡️ Exécutez le script SQL ci-dessus

### **Erreur : Permission denied**
➡️ Vérifiez les droits sur la table et la séquence

### **Erreur : Foreign key constraint fails**
➡️ Vérifiez que les IDs `supplierId` et `groupId` existent dans leurs tables respectives

### **Erreur : Webhook timeout**
➡️ Le webhook n'est pas bloquant, l'avoir sera créé même si le webhook échoue

## 🔧 COMMANDES DE DIAGNOSTIC

```sql
-- Vérifier la structure de la table
\d avoirs

-- Voir les contraintes
SELECT conname, contype FROM pg_constraint WHERE conrelid = 'avoirs'::regclass;

-- Compter les enregistrements
SELECT COUNT(*) FROM avoirs;

-- Tester une insertion basique
INSERT INTO avoirs (supplier_id, group_id, invoice_reference, amount, created_by) 
VALUES (1, 1, 'TEST-001', 50.00, 'admin') 
RETURNING id;
```

## ⚡ RESTART RAPIDE

Si tout semble correct mais ça ne marche toujours pas :

```bash
# Redémarrez votre application
pm2 restart your_app_name

# Ou Docker
docker restart your_container_name

# Ou service systemd
sudo systemctl restart your_app_service
```

---

💡 **Une fois la table créée et les permissions correctes, l'interface devrait fonctionner immédiatement !**