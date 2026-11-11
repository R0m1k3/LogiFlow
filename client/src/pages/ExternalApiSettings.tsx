import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, Check, Copy, KeyRound, ListOrdered, Plug, Plus, Trash2 } from "lucide-react";

type ApiAccess = "read" | "write";

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  createdAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  access: ApiAccess;
  storeIds: number[] | null;
  expiresAt: string | null;
}

interface Store {
  id: number;
  name: string;
}

interface KeyLog {
  id: number;
  method: string;
  path: string;
  outcome: string;
  createdAt: string | null;
}

interface ApiKeysResponse {
  basePath: string;
  envKeyCount: number;
  keys: ApiKey[];
}

const QUERY_KEY = ["/api/external-api/keys"];

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

// Message d'erreur lisible depuis « 400: {"error":"..."} » renvoyé par apiRequest
function errorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const json = raw.slice(raw.indexOf(":") + 1).trim();
  try {
    return JSON.parse(json).error || raw;
  } catch {
    return raw;
  }
}

// Dernier jour de validité (expiresAt = lendemain à 0 h UTC)
function formatExpiry(value: string): string {
  const lastDay = new Date(new Date(value).getTime() - 1);
  return lastDay.toLocaleDateString("fr-FR", { timeZone: "UTC" });
}

function isExpired(apiKey: ApiKey): boolean {
  return !!apiKey.expiresAt && new Date(apiKey.expiresAt).getTime() <= Date.now();
}

function storeNames(apiKey: ApiKey, stores: Store[]): string {
  if (!apiKey.storeIds) return "Tous les magasins";
  return apiKey.storeIds.map((id) => stores.find((store) => store.id === id)?.name ?? `Magasin ${id}`).join(", ");
}

function KeyLogDialog({ apiKey, onClose }: { apiKey: ApiKey | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery<{ logs: KeyLog[] }>({
    queryKey: [`/api/external-api/keys/${apiKey?.id}/logs`],
    enabled: !!apiKey,
  });
  return (
    <Dialog open={!!apiKey} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Journal de la clé « {apiKey?.name} »</DialogTitle>
          <DialogDescription>Ses 200 derniers appels (gardés 90 jours).</DialogDescription>
        </DialogHeader>
        {error ? (
          <p className="text-sm text-red-700">Impossible de charger le journal : {errorMessage(error)}</p>
        ) : isLoading ? (
          <p className="text-sm text-gray-600">Chargement…</p>
        ) : !data?.logs.length ? (
          <p className="text-sm text-gray-600">Aucun appel enregistré.</p>
        ) : (
          <ul className="max-h-96 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-200 text-sm">
            {data.logs.map((log) => (
              <li key={log.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-1.5">
                <span className="text-gray-500 tabular-nums">{formatDateTime(log.createdAt)}</span>
                <code className="font-mono text-xs text-gray-900 break-all">{log.method} {log.path}</code>
                {log.outcome !== "ok" && <span className="text-red-700">{log.outcome}</span>}
              </li>
            ))}
          </ul>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copie impossible", description: "Sélectionnez le texte et copiez-le à la main.", variant: "destructive" });
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy} aria-label={label} className="shrink-0">
      {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
      <span className="ml-1.5">{copied ? "Copié" : "Copier"}</span>
    </Button>
  );
}

export default function ExternalApiSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyAccess, setNewKeyAccess] = useState<ApiAccess>("read");
  const [newKeyStores, setNewKeyStores] = useState<number[]>([]);
  const [newKeyExpiry, setNewKeyExpiry] = useState("");
  const [createdKey, setCreatedKey] = useState<{ name: string; key: string } | null>(null);
  const [keyToRevoke, setKeyToRevoke] = useState<ApiKey | null>(null);
  const [keyLogs, setKeyLogs] = useState<ApiKey | null>(null);

  const { data, isLoading, error } = useQuery<ApiKeysResponse>({ queryKey: QUERY_KEY });
  const { data: stores = [] } = useQuery<Store[]>({ queryKey: ["/api/groups"] });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; access: ApiAccess; storeIds: number[]; expiresAt: string | null }) =>
      apiRequest("/api/external-api/keys", "POST", body),
    onSuccess: (result: { key: string; apiKey: ApiKey }) => {
      setCreatedKey({ name: result.apiKey.name, key: result.key });
      setNewKeyName("");
      setNewKeyAccess("read");
      setNewKeyStores([]);
      setNewKeyExpiry("");
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => toast({ title: "Création impossible", description: errorMessage(err), variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/external-api/keys/${id}`, "DELETE"),
    onSuccess: () => {
      toast({ title: "Clé révoquée", description: "Les outils qui l'utilisaient n'ont plus accès à l'API." });
      setKeyToRevoke(null);
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (err) => toast({ title: "Révocation impossible", description: errorMessage(err), variant: "destructive" }),
  });

  const apiUrl = `${window.location.origin}${data?.basePath ?? "/api/ext/v1"}`;
  const activeKeys = data?.keys.filter((k) => !k.revokedAt) ?? [];
  const revokedKeys = data?.keys.filter((k) => k.revokedAt) ?? [];
  const apiEnabled = activeKeys.some((k) => !isExpired(k)) || (data?.envKeyCount ?? 0) > 0;

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newKeyName.trim();
    if (name) {
      createMutation.mutate({ name, access: newKeyAccess, storeIds: newKeyStores, expiresAt: newKeyExpiry || null });
    }
  };

  const toggleStore = (id: number, checked: boolean) =>
    setNewKeyStores((current) => (checked ? [...current, id] : current.filter((store) => store !== id)));

  return (
    <div className="h-full overflow-y-auto space-y-6">
      {/* Présentation et adresse */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="w-5 h-5 text-blue-600" />
            API externe de rapprochement
          </CardTitle>
          <CardDescription>
            Permet à un outil externe ou à un agent IA (n8n, comptabilité, script…) de lire les fournisseurs, les
            commandes, le calendrier et les livraisons avec leur numéro de BL, puis d'écrire le numéro de facture,
            les montants et l'échéance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">État :</span>
            {isLoading ? (
              <span className="text-sm text-gray-600">Chargement…</span>
            ) : apiEnabled ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Active</Badge>
            ) : (
              <Badge variant="outline" className="border-orange-300 text-orange-800">Désactivée : aucune clé active</Badge>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="api-url">Adresse de l'API</Label>
            <div className="flex gap-2">
              <Input id="api-url" value={apiUrl} readOnly className="font-mono text-sm" />
              <CopyButton value={apiUrl} label="Copier l'adresse de l'API" />
            </div>
            <p className="text-sm text-gray-600">
              La clé s'envoie dans l'en-tête <code className="rounded bg-gray-100 px-1">X-API-Key</code>{" "}
              (ou <code className="rounded bg-gray-100 px-1">Authorization: Bearer …</code>).
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-sm text-gray-700 space-y-1">
            <p className="font-medium text-gray-900">Principales routes</p>
            <ul className="space-y-0.5 font-mono text-xs sm:text-sm">
              <li>GET /stores — magasins</li>
              <li>GET /suppliers, /suppliers/:id — fournisseurs (code, e-mail, contact)</li>
              <li>GET /calendar?from=…&amp;to=… — commandes et livraisons de la période</li>
              <li>GET /orders, /orders/:id — commandes et leurs livraisons</li>
              <li>GET /deliveries?status=all&amp;hasInvoice=false — livraisons et n° de BL</li>
              <li>GET /deliveries/:id — livraison détaillée</li>
              <li>PATCH /deliveries/:id — n° de facture, montants HT/TTC, échéance (clé « lecture + écriture »)</li>
            </ul>
            <p className="pt-1">Documentation complète : <code className="rounded bg-white px-1">docs/API-RAPPROCHEMENT.md</code></p>
          </div>
        </CardContent>
      </Card>

      {/* Clés */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-blue-600" />
            Clés d'API
          </CardTitle>
          <CardDescription>
            Créez une clé par outil ou par agent, pour pouvoir en révoquer une sans couper les autres. Donnez-lui
            seulement les droits et les magasins dont il a besoin. La clé n'est affichée qu'une seule fois, à sa
            création.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <form onSubmit={handleCreate} className="space-y-4 rounded-lg border border-gray-200 p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="api-key-name">Nom de la nouvelle clé</Label>
                <Input
                  id="api-key-name"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Ex. : agent factures Frouard"
                  maxLength={100}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="api-key-access">Droits</Label>
                <select
                  id="api-key-access"
                  value={newKeyAccess}
                  onChange={(e) => setNewKeyAccess(e.target.value as ApiAccess)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="read">Lecture seule</option>
                  <option value="write">Lecture + écriture de la facture</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="api-key-expiry">Expire après le (facultatif)</Label>
                <Input
                  id="api-key-expiry"
                  type="date"
                  value={newKeyExpiry}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                />
              </div>
            </div>
            {stores.length > 0 && (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium">Magasins visibles</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {stores.map((store) => (
                    <label key={store.id} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={newKeyStores.includes(store.id)}
                        onCheckedChange={(checked) => toggleStore(store.id, checked === true)}
                      />
                      {store.name}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-600">Aucun coché : tous les magasins.</p>
              </fieldset>
            )}
            <Button type="submit" disabled={!newKeyName.trim() || createMutation.isPending}>
              <Plus className="w-4 h-4 mr-1.5" />
              {createMutation.isPending ? "Création…" : "Créer une clé"}
            </Button>
          </form>

          {error ? (
            <p className="text-sm text-red-700">Impossible de charger les clés : {errorMessage(error)}</p>
          ) : isLoading ? (
            <p className="text-sm text-gray-600">Chargement…</p>
          ) : activeKeys.length === 0 ? (
            <p className="text-sm text-gray-600">Aucune clé active.</p>
          ) : (
            <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
              {activeKeys.map((apiKey) => (
                <li key={apiKey.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-gray-900 truncate">{apiKey.name}</p>
                      <Badge variant="outline">{apiKey.access === "write" ? "Lecture + écriture" : "Lecture seule"}</Badge>
                      <Badge variant="outline">{storeNames(apiKey, stores)}</Badge>
                      {apiKey.expiresAt && (
                        isExpired(apiKey) ? (
                          <Badge variant="outline" className="border-red-300 text-red-800">Expirée</Badge>
                        ) : (
                          <Badge variant="outline">Expire après le {formatExpiry(apiKey.expiresAt)}</Badge>
                        )
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      <code className="rounded bg-gray-100 px-1">{apiKey.keyPrefix}…</code>
                      {" · "}créée le {formatDateTime(apiKey.createdAt)}
                      {" · "}
                      {apiKey.lastUsedAt ? `dernière utilisation le ${formatDateTime(apiKey.lastUsedAt)}` : "jamais utilisée"}
                    </p>
                  </div>
                  <div className="flex gap-2 self-start sm:self-auto">
                    <Button variant="outline" size="sm" onClick={() => setKeyLogs(apiKey)}>
                      <ListOrdered className="w-4 h-4 mr-1.5" />
                      Journal
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-700 border-red-200 hover:bg-red-50"
                      onClick={() => setKeyToRevoke(apiKey)}
                    >
                      <Trash2 className="w-4 h-4 mr-1.5" />
                      Révoquer
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {(data?.envKeyCount ?? 0) > 0 && (
            <p className="text-sm text-gray-600">
              {data!.envKeyCount === 1 ? "1 clé est aussi définie" : `${data!.envKeyCount} clés sont aussi définies`} dans
              la variable d'environnement <code className="rounded bg-gray-100 px-1">EXTERNAL_API_KEYS</code> du serveur
              (non modifiables ici).
            </p>
          )}

          {revokedKeys.length > 0 && (
            <details className="text-sm text-gray-600">
              <summary className="cursor-pointer">Clés révoquées ({revokedKeys.length})</summary>
              <ul className="mt-2 space-y-1">
                {revokedKeys.map((apiKey) => (
                  <li key={apiKey.id}>
                    {apiKey.name} · <code className="rounded bg-gray-100 px-1">{apiKey.keyPrefix}…</code> · révoquée le {formatDateTime(apiKey.revokedAt)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Clé créée : affichée une seule fois */}
      <Dialog open={!!createdKey} onOpenChange={(open) => { if (!open) setCreatedKey(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Clé « {createdKey?.name} » créée</DialogTitle>
            <DialogDescription>
              Copiez-la maintenant et collez-la dans votre outil : elle ne sera plus jamais affichée.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input value={createdKey?.key ?? ""} readOnly className="font-mono text-sm" onFocus={(e) => e.currentTarget.select()} aria-label="Clé d'API" />
            {createdKey && <CopyButton value={createdKey.key} label="Copier la clé d'API" />}
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>Ne partagez pas cette clé ; en cas de doute, révoquez-la. Ses appels sont visibles dans son journal.</p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedKey(null)}>J'ai copié la clé</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <KeyLogDialog apiKey={keyLogs} onClose={() => setKeyLogs(null)} />

      {/* Confirmation de révocation */}
      <Dialog open={!!keyToRevoke} onOpenChange={(open) => { if (!open) setKeyToRevoke(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Révoquer la clé « {keyToRevoke?.name} » ?</DialogTitle>
            <DialogDescription>
              Les outils qui l'utilisent perdront immédiatement l'accès à l'API. Cette action est définitive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setKeyToRevoke(null)}>Annuler</Button>
            <Button
              variant="destructive"
              disabled={revokeMutation.isPending}
              onClick={() => keyToRevoke && revokeMutation.mutate(keyToRevoke.id)}
            >
              {revokeMutation.isPending ? "Révocation…" : "Révoquer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
