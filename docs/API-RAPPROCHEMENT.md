# API externe — Rapprochement BL / factures

Permet à un outil tiers (logiciel comptable, n8n, script…) de lire les magasins,
les fournisseurs et les livraisons livrées avec leur numéro de BL, puis d'écrire
la référence et le montant de la facture, comme dans la page **Rapprochement**.

Code : `server/externalApi.ts`. Préfixe : `/api/ext/v1`.

## Activation et authentification

Définir une ou plusieurs clés (séparées par des virgules) dans l'environnement,
puis redémarrer :

```
EXTERNAL_API_KEYS=3f9c…a1,7b20…e4
```

Générer une clé :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Variable vide ou absente : l'API répond `503` (désactivée).

Chaque requête envoie la clé dans l'un de ces en-têtes :

```
X-API-Key: <clé>
Authorization: Bearer <clé>
```

Clé absente ou fausse : `401`. Une clé donne accès à **tous les magasins** ;
pour révoquer un outil, retirer sa clé de la liste et redémarrer.
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

`code` = code fournisseur (`codefou`).

### `GET /deliveries` — livraisons à rapprocher

Seules les livraisons **livrées** sont renvoyées (même périmètre que la page
Rapprochement), de la plus récente à la plus ancienne.

| Paramètre    | Exemple       | Effet                                                      |
|--------------|---------------|------------------------------------------------------------|
| `storeId`    | `1`           | Un seul magasin                                            |
| `supplierId` | `4`           | Un seul fournisseur                                        |
| `blNumber`   | `BL-4567`     | N° de BL exact (casse et espaces de bord ignorés)          |
| `reconciled` | `false`       | `true` = rapprochées, `false` = en attente                 |
| `hasBl`      | `true`        | Avec / sans numéro de BL                                   |
| `hasInvoice` | `false`       | Avec / sans référence facture                              |
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
      "updatedAt": "2026-10-08T07:42:00.000Z"
    }
  ]
}
```

Montants en nombres (euros), dates `YYYY-MM-DD`, horodatages ISO 8601 UTC.

### `GET /deliveries/:id` — une livraison

Même objet qu'un élément de `items`. Inconnue : `404`.

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
