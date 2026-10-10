// API externe de rapprochement BL / factures.
//
// Permet à un outil tiers (comptabilité, n8n, script...) de lire les magasins,
// les fournisseurs et les livraisons livrées (numéros de BL), puis d'écrire la
// référence, les montants et l'échéance de la facture sur une livraison (y
// compris déjà validée, pour les fournisseurs en rapprochement automatique).
//
// Authentification par clé d'API, indépendante des sessions du webUI :
//   - variable d'environnement EXTERNAL_API_KEYS (une ou plusieurs clés
//     séparées par des virgules) ; vide => API désactivée ;
//   - clé transmise dans l'en-tête "X-API-Key" ou "Authorization: Bearer <clé>".
//
// Documentation : docs/API-RAPPROCHEMENT.md

import type { Express, Request, Response, NextFunction } from "express";
import { createHash, timingSafeEqual } from "crypto";
import { z } from "zod";
import { storage } from "./storage";
import { normalizeDateString } from "./dateUtils";
import { invoiceVerificationService } from "./invoiceVerification";

export const EXTERNAL_API_PREFIX = "/api/ext/v1";

const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

function digest(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

// Clés relues à chaque requête : une rotation via l'environnement ne demande
// qu'un redémarrage, et aucune clé n'est gardée en clair plus que nécessaire.
function configuredKeyDigests(): Buffer[] {
  return (process.env.EXTERNAL_API_KEYS || "")
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0)
    .map(digest);
}

function extractKey(req: Request): string | null {
  const header = req.headers["x-api-key"];
  if (typeof header === "string" && header.trim()) return header.trim();

  const auth = req.headers.authorization;
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    const token = auth.slice(7).trim();
    if (token) return token;
  }
  return null;
}

function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const keys = configuredKeyDigests();
  if (keys.length === 0) {
    return res.status(503).json({ error: "API externe désactivée (EXTERNAL_API_KEYS non défini)" });
  }

  const provided = extractKey(req);
  // Comparaison à temps constant sur les empreintes (longueur fixe)
  const providedDigest = provided ? digest(provided) : null;
  const valid = providedDigest !== null && keys.some((k) => timingSafeEqual(k, providedDigest));

  if (!valid) {
    console.warn(`🚨 [EXT-API] Clé d'API invalide ou absente : ${req.method} ${req.path} depuis ${req.ip}`);
    return res.status(401).json({ error: "Clé d'API invalide ou absente" });
  }
  next();
}

// Montant : nombre, ou chaîne au format "1234.56", "1234,56" ou "1 234,56"
const amountSchema = z
  .union([z.number(), z.string()])
  .nullable()
  .transform((value, ctx) => {
    if (value === null) return null;
    const raw = typeof value === "number" ? String(value) : value.replace(/[\s ]/g, "").replace(",", ".");
    if (raw === "") return null;
    const num = Number(raw);
    if (!Number.isFinite(num) || Math.abs(num) >= 1e8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Montant invalide" });
      return z.NEVER;
    }
    return num.toFixed(2); // colonne decimal(10,2)
  });

const updateInvoiceSchema = z
  .object({
    invoiceReference: z.string().trim().max(100).nullable().optional(),
    invoiceAmount: amountSchema.optional(),
    invoiceAmountTTC: amountSchema.optional(),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format attendu : YYYY-MM-DD")
      .nullable()
      .optional(),
    reconciled: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, { message: "Aucun champ à mettre à jour" });

const INVOICE_FIELDS = ["invoiceReference", "invoiceAmount", "invoiceAmountTTC", "dueDate"] as const;

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function toIsoDate(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function toIsoDateTime(value: unknown): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return isNaN(date.getTime()) ? null : date.toISOString();
}

// Format public d'une livraison : champs utiles au rapprochement uniquement
function toApiDelivery(d: any) {
  return {
    id: d.id,
    storeId: d.groupId,
    storeName: d.group?.name ?? null,
    supplierId: d.supplierId,
    supplierName: d.supplier?.name ?? null,
    supplierCode: d.supplier?.codefou ?? null,
    automaticReconciliation: !!d.supplier?.automaticReconciliation,
    status: d.status,
    scheduledDate: toIsoDate(d.scheduledDate),
    deliveredDate: toIsoDateTime(d.deliveredDate),
    blNumber: d.blNumber ?? null,
    blAmount: toNumber(d.blAmount),
    invoiceReference: d.invoiceReference ?? null,
    invoiceAmount: toNumber(d.invoiceAmount),
    invoiceAmountTTC: toNumber(d.invoiceAmountTTC),
    dueDate: toIsoDate(d.dueDate),
    reconciled: !!d.reconciled,
    validatedAt: toIsoDateTime(d.validatedAt),
    updatedAt: toIsoDateTime(d.updatedAt),
  };
}

function parseIntParam(value: unknown): number | undefined | null {
  if (value === undefined || value === "") return undefined;
  const num = Number(value);
  return Number.isInteger(num) && num > 0 ? num : null; // null = invalide
}

function parseBoolParam(value: unknown): boolean | undefined | null {
  if (value === undefined || value === "") return undefined;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseDateParam(value: unknown): string | undefined | null {
  if (value === undefined || value === "") return undefined;
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

// Échéance lue dans NocoDB pour une référence facture (même logique que le webUI)
async function lookupDueDate(invoiceReference: string, groupId: number, reconciled: boolean): Promise<Date | null> {
  try {
    const result = await invoiceVerificationService.verifyInvoice(invoiceReference, groupId, true, reconciled);
    const normalized = result.exists ? normalizeDateString(result.dueDate) : null;
    return normalized ? new Date(normalized) : null;
  } catch (error) {
    console.error("❌ [EXT-API] Erreur récupération échéance NocoDB:", error);
    return null;
  }
}

export function registerExternalApi(app: Express) {
  const base = EXTERNAL_API_PREFIX;
  app.use(base, requireApiKey);

  // Magasins
  app.get(`${base}/stores`, async (_req, res) => {
    try {
      const groups = await storage.getGroups();
      res.json(groups.map((g: any) => ({ id: g.id, name: g.name })));
    } catch (error) {
      console.error("❌ [EXT-API] stores:", error);
      res.status(500).json({ error: "Erreur lors de la lecture des magasins" });
    }
  });

  // Fournisseurs
  app.get(`${base}/suppliers`, async (_req, res) => {
    try {
      const suppliers = await storage.getSuppliers();
      res.json(
        suppliers.map((s: any) => ({
          id: s.id,
          name: s.name,
          code: s.codefou ?? null,
          paymentMethod: s.paymentMethod ?? null,
          automaticReconciliation: !!s.automaticReconciliation,
        })),
      );
    } catch (error) {
      console.error("❌ [EXT-API] suppliers:", error);
      res.status(500).json({ error: "Erreur lors de la lecture des fournisseurs" });
    }
  });

  // Livraisons livrées (périmètre du rapprochement BL / factures)
  app.get(`${base}/deliveries`, async (req, res) => {
    const storeId = parseIntParam(req.query.storeId);
    const supplierId = parseIntParam(req.query.supplierId);
    const reconciled = parseBoolParam(req.query.reconciled);
    const hasBl = parseBoolParam(req.query.hasBl);
    const hasInvoice = parseBoolParam(req.query.hasInvoice);
    const from = parseDateParam(req.query.from);
    const to = parseDateParam(req.query.to);
    const limit = parseIntParam(req.query.limit);
    const offsetRaw = req.query.offset;
    const offset = offsetRaw === undefined || offsetRaw === "" ? 0 : Number(offsetRaw);
    const blNumber = typeof req.query.blNumber === "string" ? req.query.blNumber.trim().toLowerCase() : "";

    const invalid = Object.entries({ storeId, supplierId, reconciled, hasBl, hasInvoice, from, to, limit })
      .filter(([, v]) => v === null)
      .map(([k]) => k);
    if (!Number.isInteger(offset) || offset < 0) invalid.push("offset");
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Paramètre(s) invalide(s) : ${invalid.join(", ")}` });
    }

    try {
      let rows: any[] = await storage.getDeliveries(storeId ? [storeId] : undefined, { status: "delivered" });

      rows = rows.filter((d) => {
        if (supplierId && d.supplierId !== supplierId) return false;
        if (reconciled !== undefined && !!d.reconciled !== reconciled) return false;
        if (hasBl !== undefined && !!d.blNumber?.trim() !== hasBl) return false;
        if (hasInvoice !== undefined && !!d.invoiceReference?.trim() !== hasInvoice) return false;
        if (blNumber && (d.blNumber || "").trim().toLowerCase() !== blNumber) return false;
        if (from || to) {
          // Date de livraison effective, sinon date prévue
          const day = toIsoDate(d.deliveredDate) ?? toIsoDate(d.scheduledDate);
          if (!day) return false;
          if (from && day < from) return false;
          if (to && day > to) return false;
        }
        return true;
      });

      rows.sort((a, b) => {
        const da = toIsoDateTime(a.deliveredDate) ?? toIsoDate(a.scheduledDate) ?? "";
        const db = toIsoDateTime(b.deliveredDate) ?? toIsoDate(b.scheduledDate) ?? "";
        return da < db ? 1 : da > db ? -1 : b.id - a.id;
      });

      const pageSize = Math.min(limit ?? DEFAULT_LIMIT, MAX_LIMIT);
      res.json({
        total: rows.length,
        limit: pageSize,
        offset,
        items: rows.slice(offset, offset + pageSize).map(toApiDelivery),
      });
    } catch (error) {
      console.error("❌ [EXT-API] deliveries:", error);
      res.status(500).json({ error: "Erreur lors de la lecture des livraisons" });
    }
  });

  app.get(`${base}/deliveries/:id`, async (req, res) => {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant invalide" });

    try {
      const delivery = await storage.getDelivery(id);
      if (!delivery) return res.status(404).json({ error: "Livraison introuvable" });
      res.json(toApiDelivery(delivery));
    } catch (error) {
      console.error("❌ [EXT-API] delivery:", error);
      res.status(500).json({ error: "Erreur lors de la lecture de la livraison" });
    }
  });

  // Écriture de la facture (référence, montants, échéance) et validation optionnelle
  app.patch(`${base}/deliveries/:id`, async (req, res) => {
    const id = parseIntParam(req.params.id);
    if (!id) return res.status(400).json({ error: "Identifiant invalide" });

    const parsed = updateInvoiceSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        error: "Corps de requête invalide",
        details: parsed.error.issues.map((i) => ({ field: i.path.join("."), message: i.message })),
      });
    }
    const body = parsed.data;

    try {
      const delivery = await storage.getDelivery(id);
      if (!delivery) return res.status(404).json({ error: "Livraison introuvable" });

      if (delivery.status !== "delivered") {
        return res.status(409).json({ error: "Seules les livraisons livrées peuvent être rapprochées" });
      }

      const touchesInvoice = INVOICE_FIELDS.some((f) => body[f] !== undefined);
      // Une livraison rapprochée est figée, comme dans le webUI : il faut la
      // dévalider (reconciled: false) pour modifier sa facture. Exception : les
      // fournisseurs en rapprochement automatique, validés d'office dès la
      // saisie du BL, dont la facture arrive après et se complète sans dévalider.
      const isAutomatic = !!delivery.supplier?.automaticReconciliation;
      if (delivery.reconciled && !isAutomatic && touchesInvoice && body.reconciled !== false) {
        return res.status(409).json({
          error: "Livraison déjà rapprochée : envoyer reconciled: false pour la dévalider avant de modifier la facture",
        });
      }

      const update: Record<string, any> = {};
      if (body.invoiceReference !== undefined) update.invoiceReference = body.invoiceReference || null;
      if (body.invoiceAmount !== undefined) update.invoiceAmount = body.invoiceAmount;
      if (body.invoiceAmountTTC !== undefined) update.invoiceAmountTTC = body.invoiceAmountTTC;

      if (body.dueDate !== undefined) {
        update.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      } else if (update.invoiceReference !== undefined && update.invoiceReference !== delivery.invoiceReference) {
        // Échéance non fournie : reprise depuis NocoDB, ou vidée avec la référence
        update.dueDate = update.invoiceReference
          ? await lookupDueDate(update.invoiceReference, delivery.groupId, !!delivery.reconciled)
          : null;
      }

      if (body.reconciled !== undefined) {
        update.reconciled = body.reconciled;
        update.validatedAt = body.reconciled ? new Date() : null;
      }

      await storage.updateDelivery(id, update);
      console.log(`🔌 [EXT-API] Livraison #${id} mise à jour : ${Object.keys(update).join(", ")}`);

      const updated = await storage.getDelivery(id);
      res.json(toApiDelivery(updated));
    } catch (error) {
      console.error("❌ [EXT-API] update delivery:", error);
      res.status(500).json({ error: "Erreur lors de la mise à jour de la livraison" });
    }
  });

  // Toute autre route sous le préfixe : 404 JSON plutôt que la page du webUI
  app.use(base, (_req, res) => {
    res.status(404).json({ error: "Route inconnue" });
  });
}
