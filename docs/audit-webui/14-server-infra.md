# Infrastructure serveur

_19 constats vérifiés — 6 haute, 6 moyenne, 7 basse._

## Pages analysées

### `/* (index.html, /assets/*, fallback SPA)`

**Rôle :** Livrer l'application (HTML, JS, CSS, favicon, manifest) aux navigateurs des PC et mobiles des magasins. C'est le premier contact de l'utilisateur avec LogiFlow, et le temps avant le premier écran en dépend.

**Tâches principales de l'utilisateur :**
- Ouvrir LogiFlow le matin (premier chargement)
- Recharger une page ou ouvrir un nouvel onglet
- Ouvrir un lien direct (ex. /deliveries) via le fallback SPA

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| GET /assets/index-*.js, vendor-*.js, index-*.css | au chargement initial et à chaque rechargement | server/index.production.ts:143-144 express.static (enregistré après registerRoutes, donc après session et passport) | 1 842 832 octets bruts, sans compression. Cache-Control: public, max-age=0 par défaut, donc revalidation à chaque rechargement. Chaque requête déclenche passport.deserializeUser, soit 2 requêtes SQL. |
| GET /* (fallback SPA vers index.html) | navigation directe ou rechargement sur une route client | server/index.production.ts:158-169 app.get('*') avec res.sendFile et console.log à chaque appel | Passe par la session et passport (2 requêtes SQL). Pas de Cache-Control: no-cache explicite. |
| GET https://replit.com/public/js/replit-dev-banner.js | au parsing de index.html (script synchrone) | tiers (client/index.html:19, recopié dans dist/public/index.html:24) | Bloque la fin du parsing, donc le démarrage du module principal de l'application. |

**Lisibilité / simplicité :** Le premier écran est lent à apparaître : environ 1,8 Mo de JS/CSS non compressé, toutes les pages et recharts préchargés dès l'écran de connexion, et un script tiers replit.com bloquant. Sans cache long, chaque rechargement relance 6 à 9 requêtes réseau, et chacune réveille la session et la base de données. Si le pare-feu du magasin filtre replit.com, l'écran peut rester blanc jusqu'au timeout réseau.

### `/api/* (chaîne de middlewares transversale à toutes les requêtes API)`

**Rôle :** Servir toutes les données métier (commandes, livraisons, rapprochement, avoirs, DLC, tâches...). La latence de base de ces middlewares s'ajoute à chaque appel de chaque page.

**Tâches principales de l'utilisateur :**
- Afficher n'importe quelle liste (commandes, livraisons, DLC, tâches...)
- Créer ou modifier un enregistrement
- Changer de magasin (relance de toutes les requêtes)

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| (toute requête authentifiée) désérialisation de session | à chaque requête HTTP portant le cookie de session, assets compris | server/localAuth.ts:141-148 passport.deserializeUser, puis storage.getUserWithGroups (server/storage.ts:371-406) : SELECT users, puis SELECT user_groups JOIN groups | 2 requêtes SQL séquentielles à chaque requête. Sessions en MemoryStore (localAuth.ts:98-108). |
| GET /api/orders, /api/deliveries, /api/contacts, etc. (130 handlers) | au montage des pages et au changement de magasin | server/routes.ts:1345, 1754, 1275... : await storage.getUserWithGroups(req.user...) (106 occurrences) ou storage.getUser (24 occurrences) | L'utilisateur, déjà chargé dans req.user, est rechargé : 4 requêtes SQL d'identité avant la requête métier. |
| wrapper res.json sur /api | chaque réponse JSON | server/routes.ts:165-171 qui appelle stripSmtpPassword (server/sanitize.ts:13-42) | Clone profond de chaque réponse : +11,7 ms mesurés pour 2000 livraisons (1,6 Mo). |
| logger de requêtes | chaque requête /api | server/index.production.ts:30-39 | console.log synchrone vers le pipe Docker, en plus des 266 console.log de routes.ts. |

**Lisibilité / simplicité :** Chaque appel API paie un surcoût fixe : 4 allers-retours SQL d'identité, un clonage complet de la réponse, des logs synchrones et une réponse non compressée. En production Docker, les index de performance ne sont probablement pas créés, et la purge du cache factures ne tourne pas. Les deux points d'entrée (index.ts et index.production.ts) divergent fortement, si bien que le comportement observé en dev n'est pas celui de la production.

### `/auth (connexion), soit POST /api/login et GET /api/user`

**Rôle :** Connecter l'employé ou le manager, puis charger son profil et ses magasins.

**Tâches principales de l'utilisateur :**
- Se connecter le matin
- Rester connecté entre deux redéploiements
- Obtenir son rôle et ses magasins (sélecteur de magasin)

**Appels API :**

| Endpoint | Déclencheur | Handler serveur | Notes |
|---|---|---|---|
| POST /api/login | au clic sur Se connecter | server/localAuth.ts:152-185 : LocalStrategy (getUserByUsername + scrypt), puis await backupService.checkAndPerformDailyBackup (backupService.ts:240-300), qui lance un pg_dump complet à la première connexion du jour | La réponse attend la fin de la sauvegarde. Ensuite, fs.readFileSync sur le dump bloque l'event loop (backupService.ts:133-135). |
| GET /api/user | au montage de l'app (hooks useAuth*) | server/localAuth.ts:204-230 : getUserWithGroups recalculé alors que deserializeUser vient de le faire | 4 requêtes SQL pour renvoyer un profil déjà en mémoire. |

**Lisibilité / simplicité :** Le premier employé du jour attend la fin d'un pg_dump complet avant d'entrer dans l'application. Chaque redéploiement déconnecte tout le monde, car les sessions sont gardées en mémoire, et il faut ressaisir ses identifiants.

## Constats

| ID | Sév. | Catégorie | Effort | Titre | Fichier |
|---|---|---|---|---|---|
| [INFRA-01](#infra-01) | haute | perf-serveur | M | Les index de performance ne sont jamais appliqués en production Docker | `Dockerfile:119` |
| [INFRA-02](#infra-02) | haute | perf-api | M | L'utilisateur et ses magasins sont rechargés 2 fois par requête (4 requêtes SQL d'identité) | `server/routes.ts:1345` |
| [INFRA-03](#infra-03) | haute | perf-serveur | S | Les fichiers statiques passent par la session et passport (2 requêtes SQL par asset) | `server/index.production.ts:129` |
| [INFRA-04](#infra-04) | haute | perf-client | S | Aucune compression HTTP (gzip/brotli) des assets ni du JSON | `server/index.production.ts:27` |
| [INFRA-05](#infra-05) | haute | perf-client | S | Les assets hashés sont servis sans cache long (revalidation à chaque rechargement) | `server/index.production.ts:143` |
| [INFRA-06](#infra-06) | haute | perf-client | S | Le script tiers replit-dev-banner.js bloque le démarrage de l'application en production | `client/index.html:19` |
| [INFRA-07](#infra-07) | moyenne | perf-api | S | La connexion attend un pg_dump complet et bloque l'event loop (première connexion du jour) | `server/localAuth.ts:165` |
| [INFRA-08](#infra-08) | moyenne | bug | S | Sessions en MemoryStore en production : déconnexion de tous les utilisateurs à chaque redéploiement | `server/localAuth.ts:98` |
| [INFRA-09](#infra-09) | moyenne | perf-serveur | S | La purge du cache de vérification des factures ne tourne pas en production | `server/index.production.ts:129` |
| [INFRA-10](#infra-10) | moyenne | dette-code | M | Deux points d'entrée serveur divergents (middlewares, CSRF, rate limit différents entre dev et prod) | `server/index.production.ts:25` |
| [INFRA-11](#infra-11) | moyenne | bug | S | La sanitisation globale échappe le HTML en entrée et corrompt apostrophes, dates et URLs | `server/security.ts:202` |
| [INFRA-12](#infra-12) | moyenne | perf-bundle | M | Toutes les pages et recharts sont téléchargés dès l'écran de connexion (pas de code splitting) | `client/src/components/RouterProduction.tsx:1` |
| [INFRA-13](#infra-13) | basse | perf-api | M | stripSmtpPassword clone en profondeur chaque réponse JSON /api | `server/routes.ts:168` |
| [INFRA-14](#infra-14) | basse | perf-serveur | M | Logs console verbeux et synchrones sur les chemins chauds, sans rotation | `server/routes.ts:1353` |
| [INFRA-15](#infra-15) | basse | bug | S | Le gestionnaire d'erreurs relance l'exception après avoir répondu (connexion coupée) | `server/index.production.ts:136` |
| [INFRA-16](#infra-16) | basse | perf-api | S | Aucun en-tête Cache-Control sur les réponses /api | `server/routes.ts:165` |
| [INFRA-17](#infra-17) | basse | bug | S | NODE_ENV forcé trop tard (imports ESM hissés) et absent du Dockerfile | `server/index.production.ts:18` |
| [INFRA-18](#infra-18) | basse | perf-serveur | S | Driver BD choisi par heuristique sur le nom d'hôte, pool sans statement_timeout | `server/db.ts:17` |
| [INFRA-19](#infra-19) | basse | dette-code | S | Code d'infrastructure mort ou trompeur (cache, compression, monitoring, auth/db « production ») | `server/cache.ts:93` |

### INFRA-01

**Les index de performance ne sont jamais appliqués en production Docker** — perf-serveur, sévérité haute, effort M

- **Fichier :** `Dockerfile:119`
- **Constat :** Dockerfile:119 `CMD ["sh", "-c", "... psql \"$DATABASE_URL\" -c 'ALTER TABLE dlc_products ADD COLUMN IF NOT EXISTS stock_epuise ...' ...; node dist/index.js"]`. Le Dockerfile n'a pas d'ENTRYPOINT et docker-compose.yml n'a ni entrypoint ni command. Seul scripts/docker-entrypoint.sh (l.53-59) appelle scripts/auto-migrate-production.sh, qui contient la création des index (l.125-150 : `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_groups_user_id ON user_groups (user_id); ... idx_deliveries_order_id ...`). Ce script n'est donc jamais lancé. De plus, les deux scripts commencent par `#!/bin/bash` alors que l'image node:20-alpine n'installe que `wget postgresql-client` (Dockerfile:105). migrations/migrate.js, que cite migrations/20260814_add_performance_indexes.sql, utilise `const { Pool } = require('pg')` dans un package `"type": "module"` et n'est référencé nulle part. server/migrations.ts runMigrations() n'est jamais appelé. runProductionMigrations ne crée que idx_sav_tickets_priority et idx_supplier_mail_logs_* (migrations.production.ts:44, 98-99).
- **Impact :** Sauf création manuelle, orders, deliveries, user_groups, dlc_products, etc. sont lues par scan séquentiel. user_groups est lue à chaque requête authentifiée. Les listes et le calendrier filtrés par magasin ou par date ralentissent à mesure que les tables grossissent. Gain estimé : x10 à x100 sur les requêtes filtrées dès quelques milliers de lignes, souvent plusieurs centaines de ms par page.
- **Recommandation :** 1) Vérifier l'état réel en prod avec pg_indexes. 2) Option à privilégier : créer les index dans Node. Point important : pg exécute une chaîne de plusieurs statements dans une transaction implicite, et CREATE INDEX CONCURRENTLY y échoue (`cannot run inside a transaction block`). Il faut donc envoyer chaque `CREATE INDEX CONCURRENTLY IF NOT EXISTS` dans un `client.query()` séparé, après avoir purgé les index invalides (bloc DO de auto-migrate-production.sh:131-145). Il vaut mieux lancer cette création en tâche de fond après `server.listen`, pour ne pas retarder le démarrage ni le healthcheck. 3) Option ENTRYPOINT : elle est déconseillée sans tests, car ces scripts bash n'ont jamais tourné dans l'image, utilisent `set -e` et des bashismes, et il faudrait aussi conserver l'ALTER TABLE dlc_products du CMD actuel.

### INFRA-02

**L'utilisateur et ses magasins sont rechargés 2 fois par requête (4 requêtes SQL d'identité)** — perf-api, sévérité haute, effort M — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:1345`
- **Constat :** server/localAuth.ts:141-143 `passport.deserializeUser(async (id) => { const user = await storage.getUserWithGroups(id); ...` s'exécute à chaque requête. storage.ts:372 `const user = await this.getUser(id);` puis l.376-386 `SELECT ... FROM user_groups ug INNER JOIN groups g ... WHERE ug.user_id = ${id}`, soit 2 allers-retours séquentiels. Les handlers rechargent ensuite le même utilisateur : 106 occurrences de `await storage.getUserWithGroups(req.user.claims ? req.user.claims.sub : req.user.id)` (ex. routes.ts:1345 /api/orders, 1754 /api/deliveries, 1275 /api/contacts) et 24 de `storage.getUser(`. /api/user fait de même (localAuth.ts:211).
- **Impact :** Chaque appel API enchaîne 4 requêtes SQL séquentielles avant la requête métier. Une page qui lance environ 10 appels au montage produit environ 40 requêtes d'identité qui se disputent le pool de 25 connexions. Gain estimé : passer de 4 à 1 requête (voire 0 avec un cache), soit -2 à -8 ms par appel en local et davantage sous charge, et -75 % de requêtes SQL d'identité.
- **Recommandation :** Ne remplacer par `const user = req.user` QUE les appels dont l'argument est l'identifiant de l'utilisateur courant (`req.user.claims ? req.user.claims.sub : req.user.id`, ou une variable userId dérivée de req.user). Exclure explicitement routes.ts:4282 (que l'on corrigera plutôt par une seule requête groupée pour tous les utilisateurs) et 4512. Le mieux est d'introduire un helper `getCurrentUser(req)` qui renvoie req.user. Réécrire getUserWithGroups en une seule requête (LEFT JOIN + json_agg) est sans risque. En revanche, le cache mémoire avec TTL retarde la révocation des rôles et des magasins : c'est une décision produit.

### INFRA-03

**Les fichiers statiques passent par la session et passport (2 requêtes SQL par asset)** — perf-serveur, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `server/index.production.ts:129`
- **Constat :** index.production.ts:129 `await registerProductionRoutes(app);` appelle registerRoutes, puis routes.ts:183 `await setupAuth(app);`, puis localAuth.ts:110-112 `app.use(session(sessionSettings)); app.use(passport.initialize()); app.use(passport.session());`. Tout cela est enregistré AVANT index.production.ts:143-144 `app.use('/assets', express.static(...)); app.use('/', express.static(publicPath));`. Chaque requête d'asset portant le cookie déclenche deserializeUser, donc getUserWithGroups (2 requêtes SQL), puis parcourt les 134 routes de routes.ts avant d'atteindre express.static. Le fallback SPA (l.158-169) subit le même chemin.
- **Impact :** Un chargement complet (index.html, 6 assets, favicon.svg/ico, manifest.json) fait environ 9 à 10 requêtes, soit environ 20 requêtes SQL inutiles en concurrence avec les vrais appels API du montage. Gain estimé : -20 requêtes SQL par chargement et -2 à -10 ms par asset.
- **Recommandation :** Dans index.production.ts uniquement, déclarer avant `await registerProductionRoutes(app)` : `app.use('/assets', express.static(join(publicPath,'assets'), { maxAge:'1y', immutable:true, index:false, fallthrough:true }))` et `app.use(express.static(publicPath, { index:false }))`. Déclarer aussi le fallback SPA filtré `app.get(/^\/(?!api\/).*/, (req,res)=>{ res.set('Cache-Control','no-cache'); res.sendFile(join(publicPath,'index.html')); })`, puis supprimer les l.143-169. Ne pas toucher à index.ts/vite.ts, ou alors seulement après avoir fait exclure /api au catch-all de serveStatic.

### INFRA-04

**Aucune compression HTTP (gzip/brotli) des assets ni du JSON** — perf-client, sévérité haute, effort S — vérification : partiellement confirmé

- **Fichier :** `server/index.production.ts:27`
- **Constat :** package.json ne contient pas `compression`, et aucune occurrence dans package-lock.json. Aucun app.use(compression()) dans index.ts ni index.production.ts. Le seul code de compression, server/cache.ts:93-100 `if (req.accepts('gzip') && ...) res.setHeader('Content-Encoding', 'gzip');`, ne compresse rien et n'est jamais importé. Mesures sur dist/public/assets : 1 842 832 octets bruts, contre 454 684 en gzip -9 (-75 %) et environ 357 Ko en brotli. index-CCl1yENM.js passe de 1 081 745 à 257 997 octets en gzip. Un JSON de 2000 livraisons passe de 762 Ko à 35 Ko en gzip (5,7 ms). Le nginx externe (réseau nginx_default) n'est pas versionné, et par défaut nginx ne compresse que text/html (gzip_types).
- **Impact :** Premier chargement d'environ 1,8 Mo au lieu d'environ 0,45 Mo : sur une ligne magasin à 5 Mbit/s, environ 2,9 s de transfert contre environ 0,7 s. Les grosses listes JSON (livraisons, commandes, DLC) pèsent 5 à 20 fois plus que nécessaire. Gain estimé : -75 % sur les assets et -85 à -95 % sur le JSON.
- **Recommandation :** `npm i compression` (dans les dependencies), puis `app.use(compression({ threshold: 1024 }))` en tout premier middleware dans index.production.ts et index.ts. Ajouter OBLIGATOIREMENT `--external:compression` à la commande esbuild du Dockerfile (l.41-65), sinon le serveur plante au démarrage. Précompresser au build reste une option. Supprimer server/cache.ts, qui est du code mort et un no-op.

### INFRA-05

**Les assets hashés sont servis sans cache long (revalidation à chaque rechargement)** — perf-client, sévérité haute, effort S

- **Fichier :** `server/index.production.ts:143`
- **Constat :** index.production.ts:143-144 `app.use('/assets', express.static(join(publicPath, 'assets'))); app.use('/', express.static(publicPath));` sans option maxAge, donc serve-static envoie `Cache-Control: public, max-age=0`. Même chose dans server/vite.ts:79 `app.use(express.static(distPath));`. Les noms sont pourtant hashés (index-CCl1yENM.js, vendor-react-DogKF7zp.js...). L'index.html et le fallback SPA (l.147-169) n'ont pas non plus de `Cache-Control: no-cache` explicite.
- **Impact :** À chaque rechargement ou nouvel onglet, le navigateur renvoie 6 requêtes conditionnelles (304) pour JS/CSS, plus favicon et manifest. Chacune passe par la session et la base (INFRA-03). Gain estimé : 0 requête réseau pour les assets après la première visite, soit -100 à -400 ms par rechargement selon la latence.
- **Recommandation :** `/assets` : `{ maxAge:'1y', immutable:true, index:false }`. Racine : `express.static(publicPath, { index:false, maxAge:'1d' })`, ou `setHeaders` qui force `no-cache` sur les .html. Pour index.html, la route `/` et le fallback SPA, faire `res.set('Cache-Control','no-cache')` avant sendFile. À regrouper avec INFRA-03 dans index.production.ts.

### INFRA-06

**Le script tiers replit-dev-banner.js bloque le démarrage de l'application en production** — perf-client, sévérité haute, effort S

- **Fichier :** `client/index.html:19`
- **Constat :** client/index.html:18-19 `<!-- This is a replit script ... --> <script type="text/javascript" src="https://replit.com/public/js/replit-dev-banner.js"></script>` est recopié tel quel dans le build : dist/public/index.html:24. Le script est synchrone (ni async ni defer). Le bundle principal est `type="module"` (différé, l.14) et ne s'exécute qu'une fois le parsing terminé, donc après le téléchargement et l'exécution de ce script tiers. index.production.ts n'envoie pas de CSP : la requête vers replit.com part donc réellement en production.
- **Impact :** Il faut une résolution DNS, une poignée de main TLS et un téléchargement vers replit.com (environ 100 à 500 ms) avant que React ne démarre. Si le pare-feu du magasin ignore les paquets vers replit.com, l'écran reste blanc jusqu'au timeout réseau. Gain : -100 à -500 ms au premier rendu, et une dépendance externe inutile en moins.
- **Recommandation :** Supprimer les lignes 18-19 de client/index.html, puis rebuild.

### INFRA-07

**La connexion attend un pg_dump complet et bloque l'event loop (première connexion du jour)** — perf-api, sévérité moyenne, effort S

- **Fichier :** `server/localAuth.ts:165`
- **Constat :** localAuth.ts:160-171 `req.login(user, async (err) => { ... const backupResult = await backupService.checkAndPerformDailyBackup(user.id); ... res.json({...})`. backupService.ts:130 `await execAsync(command, { env });` lance pg_dump. Ensuite l.133-135 `fs.statSync(filepath); const sqlContent = fs.readFileSync(filepath, 'utf8'); ... sqlContent.match(/CREATE TABLE/g)` lit tout le dump de façon synchrone. Toutes les autres connexions font au moins 2 requêtes SQL (utilities, database_backups, l.243-263) avant de répondre. Un planificateur quotidien à 2h existe déjà (backupService.ts:303 scheduleAutomaticBackup).
- **Impact :** Le premier employé connecté chaque jour attend la durée complète du pg_dump (plusieurs secondes selon la taille de la base) sur l'écran de connexion. Pendant le readFileSync et la regex sur le dump, toutes les requêtes du serveur sont gelées. Gain : connexion toujours sous 200 ms, et plus aucun gel global.
- **Recommandation :** Dans localAuth.ts : `res.json({...}); setImmediate(() => backupService.checkAndPerformDailyBackup(user.id).catch(err => console.error(err)));`. Dans createBackup, remplacer statSync/readFileSync par `await fs.promises.stat(filepath)` et compter les tables autrement, par exemple en lisant le fichier en flux ou via information_schema.

### INFRA-08

**Sessions en MemoryStore en production : déconnexion de tous les utilisateurs à chaque redéploiement** — bug, sévérité moyenne, effort S

- **Fichier :** `server/localAuth.ts:98`
- **Constat :** routes.ts:4 `import { setupLocalAuth, requireAuth } from "./localAuth";`, qui est la version dev intégrée au bundle Docker (Dockerfile:41 esbuild server/index.production.ts). localAuth.ts:96-108 `console.log('🔧 Using memory session store for development'); const sessionSettings = { ... // Using default memory store`. index.production.ts:8 importe `setupLocalAuth` de localAuth.production.js (store connect-pg-simple + `app.set("trust proxy", 1)`, l.142-161) sans jamais l'appeler. express-session 1.18.2 l'avertit lui-même (node_modules/express-session/index.js:153-154 : `if (env === 'production' && store instanceof MemoryStore) console.warn(warning)`).
- **Impact :** Chaque redémarrage du conteneur (déploiement, crash, mise à jour) déconnecte tout le monde, et chaque employé doit se reconnecter. Les sessions expirées ne sont jamais purgées (fuite mémoire lente). Sans `trust proxy` derrière nginx, req.ip est l'IP du proxy et les cookies secure sont impossibles.
- **Recommandation :** Décision produit : faut-il que les sessions survivent aux redéploiements ? Si oui, utiliser connect-pg-simple, déjà installé et déjà externalisé. Sinon, utiliser memorystore avec checkPeriod 24h, en ajoutant `--external:memorystore` à la commande esbuild du Dockerfile. Dans les deux cas, ajouter `app.set('trust proxy', 1)` et ne garder qu'une seule implémentation d'auth.

### INFRA-09

**La purge du cache de vérification des factures ne tourne pas en production** — perf-serveur, sévérité moyenne, effort S

- **Fichier :** `server/index.production.ts:129`
- **Constat :** server/index.ts:63-64 `const { startMaintenanceJobs } = await import('./maintenance.js'); startMaintenanceJobs();`. Cet appel n'existe pas dans server/index.production.ts, seul point d'entrée Docker (Dockerfile:41). maintenance.ts:4-8 le rappelle : « les entrées expirées s'accumulaient indéfiniment et alourdissaient chaque lecture du cache ». clearExpiredCache n'est appelé nulle part ailleurs.
- **Impact :** En production, la table invoice_verification_cache grossit sans fin, et les lectures du cache de rapprochement ralentissent progressivement. Gain : la table reste à sa taille utile.
- **Recommandation :** Ajouter `const { startMaintenanceJobs } = await import('./maintenance.js'); startMaintenanceJobs();` après `await registerProductionRoutes(app);` dans index.production.ts.

### INFRA-10

**Deux points d'entrée serveur divergents (middlewares, CSRF, rate limit différents entre dev et prod)** — dette-code, sévérité moyenne, effort M

- **Fichier :** `server/index.production.ts:25`
- **Constat :** index.ts:28-46 : `app.use(cookieParser()); setupSecurityHeaders(app); setupRateLimiting(app); setupInputSanitization(app); if (NODE_ENV==='production') setupCsrfProtection(app);`. index.production.ts:25-39 n'a rien de tout cela. package.json `"start": "NODE_ENV=production node dist/server/index.js"` lance index.ts avec le CSRF actif, alors que le client n'envoie jamais `x-csrf-token` (0 occurrence de « csrf » dans client/src) : toute mutation y renverrait 403. security.ts:139-185 applique 1000 req/15 min et 300 req/min par IP sans `trust proxy` : derrière nginx, tous les magasins partagent le même compteur.
- **Impact :** Ce qui est testé en dev (sanitisation, CSRF, rate limit, purge) n'est pas ce qui tourne en prod, et l'inverse. Les régressions et les écarts de performance n'apparaissent qu'en production.
- **Recommandation :** Extraire un `createApp()` commun (parsers, sécurité, statiques, routes, maintenance, gestion d'erreurs) appelé par les deux points d'entrée, avec des options explicites. Décider des middlewares de sécurité à garder en prod, et ajouter le header CSRF dans apiRequest si le CSRF est conservé. Supprimer ou aligner le script `start`.

### INFRA-11

**La sanitisation globale échappe le HTML en entrée et corrompt apostrophes, dates et URLs** — bug, sévérité moyenne, effort S — vérification : partiellement confirmé

- **Fichier :** `server/security.ts:202`
- **Constat :** security.ts:202 `sanitized = validator.escape(sanitized);` est appliqué récursivement à req.body et req.query (l.308-315), branché par index.ts:37. Vérifié : `validator.escape("L'Oréal 12/03/2025 https://x.fr/a")` donne `L&#x27;Oréal 12&#x2F;03&#x2F;2025 https:&#x2F;&#x2F;x.fr&#x2F;a`. detectSqlInjection (l.278-283) contient `/(--|\#|\/\*|\*\/)/` : chaque « Commande #123 » ou couleur « #2563EB » déclenche un console.warn. Le corps entier (jusqu'à 10 Mo) est aussi recopié à chaque requête.
- **Impact :** Dans tout environnement lancé via index.ts, les noms avec apostrophe (très fréquents en français), les dates JJ/MM/AAAA, les URLs de webhook/NocoDB et les mots de passe contenant « / » ou « ' » sont stockés échappés. L'utilisateur voit alors « &#x27; » à l'écran. Les logs sont pollués de fausses alertes.
- **Recommandation :** Retirer validator.escape de sanitizeString, sauf pour le champ password, ou prévoir une migration des mots de passe. Garder le filtrage des octets nuls et de __proto__/constructor. Réserver detectSqlInjection à un mode debug. Prévoir un script pour décoder les entités dans les données créées via index.ts si une base de dev ou de `npm start` doit être conservée. À coordonner avec INFRA-10 : si ce middleware est ajouté à la prod lors de l'unification, il faut d'abord retirer l'escape.

### INFRA-12

**Toutes les pages et recharts sont téléchargés dès l'écran de connexion (pas de code splitting)** — perf-bundle, sévérité moyenne, effort M

- **Fichier :** `client/src/components/RouterProduction.tsx:1`
- **Constat :** RouterProduction.tsx : 40 imports statiques, dont 35 de pages, et 0 `lazy(`. Le build en témoigne : dist/public/index.html:14-19 `<script type="module" src="/assets/index-CCl1yENM.js">` (1 081 745 o) + `<link rel="modulepreload" href="/assets/vendor-charts-gtSIDI7m.js">` (410 243 o, recharts, utilisé par exemple dans pages/Analytics.tsx:14), vendor-react, vendor-query et vendor-icons.
- **Impact :** L'écran de connexion télécharge et compile environ 1,8 Mo de JS/CSS (environ 450 Ko gzip). Le parse et la compilation prennent environ 300 à 800 ms sur PC de caisse ou mobile d'entrée de gamme. Gain estimé : -60 à -70 % de JS initial avec un découpage par route.
- **Recommandation :** `const Deliveries = lazy(() => import('@/pages/Deliveries'))` pour chaque page, avec `<Suspense fallback={<Spinner/>}>` autour du Switch wouter. Retirer `vendor-charts` des manualChunks forcés (vite.config.ts:44) pour que recharts ne soit chargé que par les pages qui l'utilisent.

### INFRA-13

**stripSmtpPassword clone en profondeur chaque réponse JSON /api** — perf-api, sévérité basse, effort M — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:168`
- **Constat :** routes.ts:165-171 `app.use('/api', (req, res, next) => { const originalJson = res.json.bind(res); res.json = (body: any) => originalJson(stripSmtpPassword(body)); ...`. sanitize.ts:25-42 reconstruit chaque tableau et chaque objet (`value.map(...)`, `for (const [key, entry] of Object.entries(value)) result[key] = stripSmtpPassword(...)`). Mesure Node sur 2000 livraisons avec supplier, group et order imbriqués (1,6 Mo) : 11,7 ms de clonage en plus des 18 ms de JSON.stringify. Sur 5000 éléments : 33,6 ms de clonage pour 47,5 ms de stringify.
- **Impact :** Les grosses listes coûtent +40 à +65 % de CPU de sérialisation, le pic mémoire double, et l'event loop est bloquée d'autant pour les autres utilisateurs. Gain estimé : 5 à 30 ms par grosse liste.
- **Recommandation :** Remplacer d'abord, dans toutes les jointures `group: groups` de storage.ts, la sélection complète par une liste explicite de colonnes sans smtpPassword. Ensuite seulement, restreindre stripSmtpPassword aux routes /api/groups* en y conservant le calcul de smtpPasswordSet. Alternative sans refonte : `app.set('json replacer', (k, v) => v && typeof v === 'object' && !Array.isArray(v) && 'smtpPassword' in v ? (({smtpPassword, ...r}) => ({...r, smtpPasswordSet: !!smtpPassword}))(v) : v)`. Il faudra alors mesurer le gain, car le replacer est appelé pour chaque propriété.

### INFRA-14

**Logs console verbeux et synchrones sur les chemins chauds, sans rotation** — perf-serveur, sévérité basse, effort M

- **Fichier :** `server/routes.ts:1353`
- **Constat :** routes.ts contient 266 console.log, par exemple l.1353 `console.log('Orders API called with:', {...})`, l.1762 `'Deliveries API called with:'`, l.1868 `'Deliveries returned:'`, l.3507, l.3782/3791/3874/3885 `JSON.stringify(req.body, null, 2)` (avoirs). storage.ts:935 `getDeliveries() récupéré ...` et l.2303 `getTasks - Raw results`. index.production.ts:30-39 journalise chaque requête /api et l.162 chaque navigation SPA. Sous Linux, stdout vers un pipe (cas de Docker) est synchrone dans Node. docker-compose.yml n'a aucune clé `logging:`.
- **Impact :** Chaque requête écrit 3 à 6 lignes de façon bloquante (environ 0,1 à 0,5 ms par requête, davantage avec JSON.stringify indenté). Le fichier de log json-file du conteneur grossit sans limite et peut remplir le disque du serveur.
- **Recommandation :** Se limiter à supprimer, ou passer derrière un `if (process.env.LOG_LEVEL === 'debug')`, les logs des handlers GET chauds et les JSON.stringify(req.body / validatedData / dataForDb) cités, ainsi que le log SPA de index.production.ts:162. Garder les console.error et console.warn. La rotation dans docker-compose.yml (`logging: { driver: json-file, options: { max-size: "10m", max-file: "3" } }`) est indépendante et sans risque.

### INFRA-15

**Le gestionnaire d'erreurs relance l'exception après avoir répondu (connexion coupée)** — bug, sévérité basse, effort S

- **Fichier :** `server/index.production.ts:136`
- **Constat :** index.production.ts:131-137 `app.use((err, _req, res, _next) => { ... res.status(status).json({ message }); throw err; });` (idem index.ts:66-71). Express transmet l'exception à finalhandler 1.3.1, qui voit headersSent et exécute `req.socket.destroy()` (node_modules/finalhandler/index.js:126-129).
- **Impact :** Chaque erreur transmise via next(err) (JSON invalide, corps de plus de 10 Mo...) détruit la connexion keep-alive. La réponse d'erreur peut arriver tronquée, et le navigateur affiche une erreur réseau générique au lieu du message. Il doit aussi rouvrir une connexion TCP.
- **Recommandation :** `if (res.headersSent) return _next(err); console.error(err); res.status(status).json({ message });`, sans `throw`.

### INFRA-16

**Aucun en-tête Cache-Control sur les réponses /api** — perf-api, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/routes.ts:165`
- **Constat :** `grep -n "Cache-Control" server/*.ts` ne renvoie aucune occurrence. Les réponses /api reposent sur l'ETag faible par défaut d'Express (SHA1 du corps) sans directive de cache, et contiennent des données privées par magasin.
- **Impact :** Le comportement de cache dépend des heuristiques du navigateur et d'un éventuel proxy (nginx externe non versionné). Rien n'empêche un cache partagé de stocker des données d'un magasin. Les référentiels quasi statiques (/api/suppliers, /api/groups) sont rechargés intégralement à chaque montage.
- **Recommandation :** Ajouter seulement `res.set('Cache-Control', 'private, no-cache')` dans le middleware /api de routes.ts:165. Les 304 via ETag sont conservés. Ne pas mettre de max-age sur des endpoints invalidés par des mutations côté client.

### INFRA-17

**NODE_ENV forcé trop tard (imports ESM hissés) et absent du Dockerfile** — bug, sévérité basse, effort S

- **Fichier :** `server/index.production.ts:18`
- **Constat :** index.production.ts:7-9 `import { storage } from "./storage.js"; ...` : les modules importés (storage puis db) s'évaluent avant la ligne 18 `process.env.NODE_ENV = 'production';`. Or db.ts:4 `const isProduction = process.env.NODE_ENV === 'production';` est calculé à l'import. Le Dockerfile ne déclare que `ENV PORT=3000` (l.101). Seul docker-compose.yml (`NODE_ENV: production`) rend la configuration correcte.
- **Impact :** Un `docker run` sans compose ou un orchestrateur qui oublie la variable bascule db.ts sur le driver Neon WebSocket (db.ts:44-56) face à un Postgres classique : échec de connexion ou latence. Le forçage à la ligne 18 donne une fausse impression de sécurité.
- **Recommandation :** Ajouter `ENV NODE_ENV=production` dans le stage production du Dockerfile, par exemple à côté de `ENV PORT=3000`. On peut conserver la ligne 18, inoffensive, comme filet de sécurité, ou la supprimer : ce n'est pas nécessaire.

### INFRA-18

**Driver BD choisi par heuristique sur le nom d'hôte, pool sans statement_timeout** — perf-serveur, sévérité basse, effort S

- **Fichier :** `server/db.ts:17`
- **Constat :** db.ts:17 `if (isProduction && dbUrl && (dbUrl.includes('logiflow-db') || dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')))` choisit pg. Tout autre hôte tombe sur `@neondatabase/serverless` (WebSocket, l.44-56). Le pool pg (l.23-29) a `max: 25, idleTimeoutMillis: 30000, connectionTimeoutMillis: 15000`, sans statement_timeout ni application_name.
- **Impact :** Renommer le service Postgres ou passer par une IP change silencieusement de driver. Une requête lente (vérification de factures, export) peut monopoliser des connexions, et les autres requêtes attendent alors jusqu'à 15 s avant d'échouer.
- **Recommandation :** Choisir Neon seulement si l'URL contient `neon.tech` (ou via une variable DB_DRIVER), et pg sinon. Ajouter au pool `statement_timeout: 30000` et `application_name: 'logiflow'`, en surchargeant le timeout pour les opérations longues connues.

### INFRA-19

**Code d'infrastructure mort ou trompeur (cache, compression, monitoring, auth/db « production »)** — dette-code, sévérité basse, effort S — vérification : partiellement confirmé

- **Fichier :** `server/cache.ts:93`
- **Constat :** server/cache.ts n'est jamais importé. Son setupCompression (l.93-100) pose `Content-Encoding: gzip` sans compresser, et cacheMiddleware (l.53) comme createOptimizedQuery sont inutilisés. server/monitoring.ts n'est jamais importé, et getStats (l.85) trie responseTime en place. server/db.production.ts n'est jamais importé. server/localAuth.production.ts est importé (index.production.ts:8) mais jamais appelé. server/migrations.ts runMigrations() n'est jamais appelé. /api/health est défini 3 fois (routes.ts:174, localAuth.ts:245, index.production.ts:66), et seul le premier répond.
- **Impact :** Les mainteneurs croient à tort que la compression, le cache API, le monitoring et les sessions PG sont actifs. Brancher setupCompression casserait toutes les réponses (ERR_CONTENT_DECODING_FAILED), et le temps de diagnostic des lenteurs s'allonge.
- **Recommandation :** Corrections sans risque : supprimer server/cache.ts et server/db.production.ts, ainsi que les /api/health en double de localAuth.ts:244-247 et index.production.ts:65-75 (le HEALTHCHECK Docker reste servi par routes.ts:174). Conserver server/migrations.ts, utilisé par scripts/create-migration.js, ou au moins sa fonction createMigration. Traiter la suppression de localAuth.production.ts avec INFRA-08, qui pourrait réutiliser son store pg. Le branchement de monitoring.ts (avec tri sur une copie et /api/metrics derrière requireAdmin) est un chantier à part, à ne pas automatiser.
