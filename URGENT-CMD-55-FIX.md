# CORRECTION URGENTE CMD-55 - Production

## Problème
CMD-55 n'apparaît pas en gris dans le calendrier malgré ses livraisons validées.

## Solution Immédiate

### Option 1 : Correction SQL Directe (Recommandée)

Exécutez ce script SQL directement sur votre base de données de production :

```sql
-- Corriger CMD-55 immédiatement
UPDATE orders 
SET status = 'delivered'
WHERE id = 55 
  AND status != 'delivered'
  AND EXISTS (
    SELECT 1 FROM deliveries d 
    WHERE d."orderId" = 55 
    AND d.status = 'delivered'
  );
```

### Option 2 : Script Complet

Utilisez le fichier `fix-cmd-55-immediate.sql` qui contient :
- Diagnostic de CMD-55
- Correction de CMD-55
- Correction de toutes les autres commandes similaires
- Vérification des résultats

### Option 3 : Via l'API (Si accessible)

```bash
curl -X PUT "http://votre-serveur.com/api/orders/55" \
  -H "Content-Type: application/json" \
  -H "Cookie: votre-session-cookie" \
  -d '{"status": "delivered"}'
```

## Vérification

Après correction, CMD-55 devrait :
1. Avoir le statut "delivered" dans la base
2. Apparaître en gris dans le calendrier
3. Afficher "Date de livraison" au lieu de "Date prévue"

## Connection à votre Base

```bash
# PostgreSQL
psql -h votre-host -U votre-user -d votre-database

# Puis exécuter le script
\i fix-cmd-55-immediate.sql
```

## Résultat Attendu

Après exécution, vous devriez voir :
```
UPDATE 1  -- CMD-55 corrigée
UPDATE X  -- X autres commandes corrigées
```

CMD-55 apparaîtra alors immédiatement en gris dans votre calendrier de production.

---

**Note**: Cette correction est immédiate et ne nécessite pas de redémarrage du serveur.