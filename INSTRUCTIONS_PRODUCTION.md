# Instructions pour corriger la production

## Problème identifié
La table `announcements` n'existe pas dans votre base de données de production.

## Solution rapide

### Étape 1: Accédez à votre conteneur
```bash
# Accédez au conteneur de votre application
docker exec -it logiflow-logiflow-1 /bin/bash
```

### Étape 2: Exécutez le script SQL
```bash
# Dans le conteneur, exécutez le script de correction
psql $DATABASE_URL -f fix_production_announcements.sql
```

### Alternative: Depuis l'extérieur du conteneur
```bash
# Copiez le fichier dans le conteneur
docker cp fix_production_announcements.sql logiflow-logiflow-1:/app/

# Exécutez le script
docker exec logiflow-logiflow-1 psql $DATABASE_URL -f /app/fix_production_announcements.sql
```

## Vérification
Après l'exécution, vous devriez voir :
```
Table announcements créée avec succès!
```

Le système d'annonces fonctionnera immédiatement après cette correction.

## Prévention future
Pour éviter ce problème lors des futures mises à jour, utilisez le fichier `init.sql` pour les nouvelles installations.