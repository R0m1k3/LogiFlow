# API externe — Rapprochement BL / factures

Permet à un outil tiers ou à un agent IA (logiciel comptable, n8n, script…) de
lire les magasins, les fournisseurs, les commandes, le calendrier et les
livraisons avec leur numéro de BL, puis d'écrire la référence et le montant de
la facture, comme dans la page **Rapprochement**.

Code : `server/externalApi.ts`. Préfixe : `/api/ext/v1`.

## Activation et authentification

**Depuis LogiFlow (recommandé)** : *Paramètres > API externe* (admin). On y
crée une clé par outil (nommée, ex. « n8n comptabilité »), affichée une seule
fois à sa création, avec sa date de dernière utilisation ; une clé se révoque
d'un clic, sans redémarrage. Seule l'empreinte SHA-256 de la clé est stockée
(table `external_api_keys`). L'onglet s'ouvre directement par
`/utilities?tab=api`.

Créer **une clé par outil ou par agent**, avec seulement ce dont il a besoin :

| Réglage   | Valeurs                                    | Effet                                                                 |
|-----------|--------------------------------------------|-----------------------------------------------------------------------|
| Droits    | lecture seule / lecture + écriture         | En lecture seule, `PATCH /deliveries/:id` répond `403`                |
| Magasins  | aucun coché (tous) ou une liste            | Les autres magasins sont invisibles : listes filtrées, détail en `404` |
| Expiration | facultative, dernier jour de validité     | Le lendemain, la clé est refusée (`401`) comme une clé révoquée       |

Chaque appel d'une clé enregistrée est noté dans son **journal** (bouton
« Journal », 200 derniers appels, gardés 90 jours), refus compris. Les clés
créées avant ces réglages gardent tous les droits sur tous les magasins.

Par l'API de gestion (session admin), `POST /api/external-api/keys` accepte :

```json
{ "name": "Agent factures Frouard", "access": "read", "storeIds": [1], "expiresAt": "2026-12-31" }
```

`access` absent : `write` ; `storeIds` absent ou vide : tous les magasins.
Journal : `GET /api/external-api/keys/:id/logs`.

**Par l'environnement (optionnel)** : des clés peuvent aussi être définies,
séparées par des virgules, puis le serveur redémarré :

```
EXTERNAL_API_KEYS=3f9c…a1,7b20…e4
```

Générer une clé :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Aucune clé active (ni dans Paramètres, ni dans l'environnement) : l'API répond
`503` (désactivée).

Chaque requête envoie la clé dans l'un de ces en-têtes :

```
X-API-Key: <clé>
Authorization: Bearer <clé>
```

Clé absente, fausse, révoquée ou expirée : `401`. Les clés de l'environnement
ont tous les droits sur tous les magasins ; pour en révoquer une, la retirer de
la liste et redémarrer.
Exposer l'API uniquement en HTTPS (la clé circule dans chaque requête).

## Points d'accès

### `GET /stores` — magasins

```json
[{ "id": 1, "name": "Magasin Nancy" }]
```

### `GET /suppliers` — fournisseurs

```json
[{ "id": 4, "name": "Lactalis", "code": "LAC01", "paymentMethod": "Virement", "automaticReconciliation": false }]
```

`code` = code fournisseur (`codefou`). Chaque fournisseur porte aussi `email`,
`contact`, `phone`, `hasDlc`, `requiresControl` et `updatedAt`.

### `GET /suppliers/:id` — un fournisseur

Même objet. Inconnu : `404`.

### `GET /orders` — commandes

De la date prévue la plus récente à la plus ancienne, avec leurs livraisons.

| Paramètre    | Exemple      | Effet                                              |
|--------------|--------------|----------------------------------------------------|
| `storeId`    | `1`          | Un seul magasin                                    |
| `supplierId` | `4`          | Un seul fournisseur                                |
| `status`     | `pending`    | Un statut (`pending`, `planned`, `delivered`…) ; absent ou `all` : tous |
| `from`, `to` | `2026-11-01` | Bornes incluses sur la date prévue                 |
| `limit`, `offset` |         | Pagination, comme `/deliveries`                    |

```json
{
  "total": 1, "limit": 100, "offset": 0,
  "items": [{
    "id": 100, "storeId": 1, "supplierId": 4, "plannedDate": "2026-11-05",
    "quantity": 5, "unit": "palettes", "status": "delivered", "notes": "BC26647377",
    "storeName": "Magasin Nancy", "supplierName": "Lactalis", "supplierCode": "LAC01",
    "createdBy": "admin_local", "createdAt": "…", "updatedAt": "…",
    "deliveries": [{ "id": 812, "status": "delivered", "scheduledDate": "2026-11-08",
                     "deliveredDate": "2026-11-09T08:30:00.000Z", "blNumber": "BL-4567" }]
  }]
}
```

### `GET /orders/:id` — une commande

Même objet qu'un élément de `items`. Inconnue : `404`.

### `GET /calendar?from=…&to=…` — calendrier détaillé

`from` et `to` (`YYYY-MM-DD`) obligatoires, 366 jours au plus. Filtres
facultatifs : `storeId`, `supplierId`, `status`. Réponse, de la plus ancienne
date à la plus récente, sans pagination :

```json
{ "from": "2026-11-01", "to": "2026-11-30", "orders": [ … ], "deliveries": [ … ] }
```

- `orders` : commandes dont la date prévue est dans la période (objet de `/orders`) ;
- `deliveries` : livraisons prévues **ou** livrées dans la période (objet de `/deliveries`).

### `GET /deliveries` — livraisons à rapprocher

Par défaut, seules les livraisons **livrées** (validées avec leur n° de BL)
sont renvoyées, comme la page Rapprochement ; `status` en choisit un autre.
De la plus récente à la plus ancienne.

| Paramètre    | Exemple       | Effet                                                      |
|--------------|---------------|------------------------------------------------------------|
| `storeId`    | `1`           | Un seul magasin                                            |
| `supplierId` | `4`           | Un seul fournisseur                                        |
| `blNumber`   | `BL-4567`     | N° de BL exact (casse et espaces de bord ignorés)          |
| `reconciled` | `false`       | `true` = rapprochées, `false` = en attente                 |
| `hasBl`      | `true`        | Avec / sans numéro de BL                                   |
| `hasInvoice` | `false`       | Avec / sans référence facture                              |
| `status`     | `all`         | `delivered` par défaut ; `all` = tous ; ou `planned`, `pending`… |
| `controlValidated` | `true`  | Contrôle de réception validé ou non                        |
| `from`, `to` | `2026-10-01`  | Bornes incluses sur la date de livraison (sinon date prévue) |
| `limit`      | `100`         | Taille de page, 100 par défaut, 500 maximum                |
| `offset`     | `0`           | Décalage de pagination                                     |

Paramètre mal formé : `400` avec la liste des paramètres fautifs.

```json
{
  "total": 1,
  "limit": 100,
  "offset": 0,
  "items": [
    {
      "id": 812,
      "storeId": 1,
      "storeName": "Magasin Nancy",
      "supplierId": 4,
      "supplierName": "Lactalis",
      "supplierCode": "LAC01",
      "automaticReconciliation": false,
      "status": "delivered",
      "scheduledDate": "2026-10-08",
      "deliveredDate": "2026-10-08T07:42:00.000Z",
      "blNumber": "BL-4567",
      "blAmount": 1234.5,
      "invoiceReference": null,
      "invoiceAmount": null,
      "invoiceAmountTTC": null,
      "dueDate": null,
      "reconciled": false,
      "validatedAt": null,
      "updatedAt": "2026-10-08T07:42:00.000Z",
      "orderId": 100,
      "quantity": 5,
      "unit": "palettes",
      "notes": null,
      "controlValidated": true,
      "controlValidatedBy": "admin_local",
      "controlValidatedAt": "2026-10-08T09:10:00.000Z",
      "createdBy": "admin_local",
      "createdAt": "2026-10-01T10:00:00.000Z"
    }
  ]
}
```

Montants en nombres (euros), dates `YYYY-MM-DD`, horodatages ISO 8601 UTC.

### `GET /deliveries/:id` — une livraison

Même objet qu'un élément de `items`, avec en plus `order` : la commande liée
(`id`, `storeId`, `supplierId`, `plannedDate`, `quantity`, `unit`, `status`,
`notes`) ou `null`. Inconnue, ou d'un magasin non autorisé pour la clé : `404`.

### `PATCH /deliveries/:id` — écrire la facture

Tous les champs sont facultatifs, au moins un est requis ; tout autre champ est refusé.

| Champ              | Type                    | Effet                                                            |
|--------------------|-------------------------|------------------------------------------------------------------|
| `invoiceReference` | texte (100 car.) / null | Référence facture ; `null` ou `""` l'efface                      |
| `invoiceAmount`    | nombre / texte / null   | Montant HT. Accepte `1234.5`, `"1234,50"`, `"1 234,50"`          |
| `invoiceAmountTTC` | nombre / texte / null   | Montant TTC, mêmes formats                                       |
| `dueDate`          | `YYYY-MM-DD` / null     | Échéance. Si absente et que la référence change, elle est reprise de NocoDB comme dans le webUI |
| `reconciled`       | booléen                 | `true` valide le rapprochement, `false` le dévalide              |

```bash
curl -X PATCH https://logiflow.example/api/ext/v1/deliveries/812 \
  -H "X-API-Key: $LOGIFLOW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"invoiceReference":"FAC-2026-0042","invoiceAmount":"1234,50"}'
```

Réponse : la livraison mise à jour.

Règles :

- clé en lecture seule : `403` ;
- livraison non livrée : `409` ;
- livraison déjà rapprochée : sa facture est figée (`409`). Envoyer
  `"reconciled": false` dans la même requête pour la dévalider et la modifier ;
- exception, fournisseur en **rapprochement automatique**
  (`automaticReconciliation: true`) : la livraison est validée d'office dès la
  saisie du BL, sa facture (référence, montants, échéance) se complète ensuite
  directement, sans la dévalider ; elle reste validée ;
- corps invalide : `400` avec le détail par champ.

## Exemple : rapprocher une facture reçue

1. `GET /suppliers` → retrouver l'`id` du fournisseur via son `code`.
2. `GET /deliveries?supplierId=4&blNumber=BL-4567` → récupérer l'`id` de la livraison.
3. `PATCH /deliveries/812` avec `invoiceReference` et `invoiceAmount`
   (ajouter `"reconciled": true` pour valider directement).

## Exemple : compléter la facture d'un fournisseur automatique

Les livraisons d'un fournisseur en rapprochement automatique sont déjà
validées (`reconciled: true`) ; la facture s'y ajoute sans autre champ :

```bash
curl -X PATCH https://logiflow.example/api/ext/v1/deliveries/815 \
  -H "X-API-Key: $LOGIFLOW_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"invoiceReference":"FAC-2026-0057","invoiceAmount":"842,10","invoiceAmountTTC":"1010,52","dueDate":"2026-11-30"}'
```

Pour les retrouver : `GET /deliveries?supplierId=<id auto>&hasInvoice=false`.
