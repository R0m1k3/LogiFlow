// Clés de l'API externe de rapprochement créées depuis Paramètres > API externe.
//
// La clé n'est montrée qu'une fois, à sa création : seule son empreinte SHA-256
// est stockée (table external_api_keys), avec un préfixe lisible pour la
// reconnaître dans la liste. Une clé révoquée est conservée pour l'historique.
// Les clés de la variable d'environnement EXTERNAL_API_KEYS restent acceptées.

import { createHash, randomBytes } from "crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { externalApiKeys, type ExternalApiKey } from "@shared/schema";

const KEY_PREFIX = "lf_";
const DISPLAY_PREFIX_LENGTH = 10; // "lf_" + 7 caractères
// last_used_at n'est réécrit qu'au plus une fois par minute et par clé
const LAST_USED_THROTTLE_MS = 60_000;

export type PublicApiKey = Omit<ExternalApiKey, "keyHash">;

// Sans base (développement), les clés sont gardées en mémoire
const hasDatabase = !!process.env.DATABASE_URL;
const memoryKeys: ExternalApiKey[] = [];
let memoryNextId = 1;

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

function toPublic({ keyHash: _keyHash, ...key }: ExternalApiKey): PublicApiKey {
  return key;
}

export async function listApiKeys(): Promise<PublicApiKey[]> {
  if (!hasDatabase) return [...memoryKeys].reverse().map(toPublic);
  const rows: ExternalApiKey[] = await db.select().from(externalApiKeys).orderBy(desc(externalApiKeys.createdAt));
  return rows.map(toPublic);
}

// Crée une clé et la renvoie en clair : c'est la seule fois où elle est lisible
export async function createApiKey(name: string, createdBy: string | null): Promise<{ key: string; apiKey: PublicApiKey }> {
  const key = `${KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  const values = {
    name,
    keyPrefix: key.slice(0, DISPLAY_PREFIX_LENGTH),
    keyHash: hashApiKey(key),
    createdBy,
  };

  if (!hasDatabase) {
    const row: ExternalApiKey = { id: memoryNextId++, ...values, createdAt: new Date(), lastUsedAt: null, revokedAt: null };
    memoryKeys.push(row);
    return { key, apiKey: toPublic(row) };
  }

  const [row]: ExternalApiKey[] = await db.insert(externalApiKeys).values(values).returning();
  return { key, apiKey: toPublic(row) };
}

// Révoque une clé active ; false si elle n'existe pas ou l'était déjà
export async function revokeApiKey(id: number): Promise<boolean> {
  if (!hasDatabase) {
    const row = memoryKeys.find((k) => k.id === id && !k.revokedAt);
    if (!row) return false;
    row.revokedAt = new Date();
    return true;
  }

  const rows = await db
    .update(externalApiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(externalApiKeys.id, id), isNull(externalApiKeys.revokedAt)))
    .returning({ id: externalApiKeys.id });
  return rows.length > 0;
}

export async function countActiveApiKeys(): Promise<number> {
  if (!hasDatabase) return memoryKeys.filter((k) => !k.revokedAt).length;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(externalApiKeys)
    .where(isNull(externalApiKeys.revokedAt));
  return row?.count ?? 0;
}

// Vérifie une clé reçue ; met à jour sa date de dernière utilisation
export async function verifyStoredApiKey(key: string): Promise<boolean> {
  const keyHash = hashApiKey(key);

  if (!hasDatabase) {
    const row = memoryKeys.find((k) => k.keyHash === keyHash && !k.revokedAt);
    if (row) row.lastUsedAt = new Date();
    return !!row;
  }

  const [row]: ExternalApiKey[] = await db
    .select()
    .from(externalApiKeys)
    .where(and(eq(externalApiKeys.keyHash, keyHash), isNull(externalApiKeys.revokedAt)))
    .limit(1);
  if (!row) return false;

  const lastUsed = row.lastUsedAt ? new Date(row.lastUsedAt).getTime() : 0;
  if (Date.now() - lastUsed > LAST_USED_THROTTLE_MS) {
    // Sans attendre : une erreur d'écriture ne doit pas refuser la requête
    db.update(externalApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(externalApiKeys.id, row.id))
      .catch((error: any) => console.error("❌ [EXT-API] last_used_at:", error?.message));
  }
  return true;
}

// Nombre de clés fournies par la variable d'environnement EXTERNAL_API_KEYS
export function countEnvApiKeys(): number {
  return (process.env.EXTERNAL_API_KEYS || "").split(",").filter((k) => k.trim().length > 0).length;
}
