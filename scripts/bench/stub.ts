// Services externes simulés pour le banc : NocoDB, webhooks (n8n) et SMTP.
// Chaque appel reçu est enregistré ; le banc le lit (GET /__calls) pour vérifier
// que Node et Rust appellent les mêmes services avec les mêmes données.
import http from "http";
import net from "net";
import { STUB_PORT, STUB_SMTP_PORT } from "./config";

export interface StubCall {
  service: "nocodb" | "webhook" | "smtp" | "autre";
  method?: string;
  path?: string;
  contentType?: string;
  body?: unknown;
}

const calls: StubCall[] = [];

function isoDate(offsetDays: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

// Lignes de la table de factures NocoDB simulée (colonnes des magasins du banc)
function invoiceRows() {
  return [
    { Id: 1, RefFacture: "FAC-2001", NumBL: "BL-1001", MontantHT: 1250.5, MontantTTC: 1500.6, Fournisseur: "Lactalis", Echeance: isoDate(10) },
    { Id: 2, RefFacture: "FAC-2004", NumBL: "BL-1004", MontantHT: 975, MontantTTC: 1170, Fournisseur: "Brico Pro", Echeance: isoDate(25) },
    { Id: 3, RefFacture: "FAC-2002", NumBL: "BL-1002", MontantHT: 310, MontantTTC: 372, Fournisseur: "Bonduelle", Echeance: isoDate(30) },
    { Id: 4, RefFacture: "FAC-2006", NumBL: "BL-1006", MontantHT: 450.25, MontantTTC: 540.3, Fournisseur: "Jardin & Co", Echeance: isoDate(-5) },
    { Id: 5, RefFacture: "AV-3001", NumBL: null, MontantHT: -45.9, MontantTTC: -55.08, Fournisseur: "Lactalis", Echeance: null },
    // Échéances saisies à la française (JJ/MM/AAAA) ou à l'américaine (MM/JJ/AAAA)
    { Id: 6, RefFacture: "FAC-2007", NumBL: "BL-1007", MontantHT: 99.9, MontantTTC: 119.88, Fournisseur: "Bonduelle", Echeance: "25/12/2030" },
    { Id: 7, RefFacture: "FAC-2008", NumBL: "BL-1008", MontantHT: 12.34, MontantTTC: 14.81, Fournisseur: "Brico Pro", Echeance: "12/24/2030" },
  ];
}

// where=(colonne,eq,valeur) : seul opérateur utilisé par LogiFlow
function filterRows(where: string | null) {
  const rows = invoiceRows();
  if (!where) return rows;
  const match = where.match(/^\(([^,]+),eq,(.*)\)$/);
  if (!match) return rows;
  const [, column, value] = match;
  return rows.filter((row) => String((row as Record<string, unknown>)[column] ?? "") === value);
}

function readBody(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Corps enregistré sans ce qui change d'un passage à l'autre (séparateur multipart)
function describeBody(contentType: string | undefined, raw: Buffer): unknown {
  if (!raw.length) return null;
  if (contentType?.includes("application/json")) {
    try { return JSON.parse(raw.toString("utf8")); } catch { return raw.toString("utf8"); }
  }
  if (contentType?.includes("multipart/form-data")) {
    const boundary = contentType.split("boundary=")[1]?.replace(/"/g, "");
    if (!boundary) return { taille: raw.length };
    const parts = raw.toString("latin1").split(`--${boundary}`).slice(1, -1);
    return parts.map((part) => {
      const [head, ...rest] = part.split("\r\n\r\n");
      const name = head.match(/name="([^"]*)"/)?.[1];
      const filename = head.match(/filename="([^"]*)"/)?.[1];
      const content = rest.join("\r\n\r\n").replace(/\r\n$/, "");
      return filename !== undefined ? { name, filename, taille: Buffer.from(content, "latin1").length } : { name, valeur: content };
    });
  }
  return raw.toString("utf8");
}

// ---------- Courriels reçus : décodés pour comparer le contenu, pas l'encodage ----------
// nodemailer et lettre n'encodent pas de la même façon (quoted-printable ou base64,
// mots encodés RFC 2047, guillemets des noms) : on compare le texte décodé.

// Octets d'un texte où =XX désigne un octet (quoted-printable, mots encodés « Q »)
function decodeEscapes(text: string): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "=" && /^[0-9A-Fa-f]{2}$/.test(text.slice(i + 1, i + 3))) {
      bytes.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      bytes.push(...Buffer.from(text[i], "utf8"));
    }
  }
  return Buffer.from(bytes);
}

// =?utf-8?Q?…?= et =?utf-8?B?…?= ; blancs entre deux mots encodés ignorés
function decodeWords(value: string): string {
  return value
    .replace(/(=\?[^?]+\?[bBqQ]\?[^?]*\?=)\s+(?==\?[^?]+\?[bBqQ]\?[^?]*\?=)/g, "$1")
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, _charset: string, encoding: string, text: string) =>
      encoding.toUpperCase() === "B"
        ? Buffer.from(text, "base64").toString("utf8")
        : decodeEscapes(text.replace(/_/g, " ")).toString("utf8"));
}

// En-têtes dépliés, noms en minuscules (premier exemplaire de chaque)
function parseHeaders(head: string): Record<string, string> {
  const headers: Record<string, string> = {};
  const lines = head.split("\n");
  const unfolded: string[] = [];
  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length) unfolded[unfolded.length - 1] += line;
    else unfolded.push(line);
  }
  for (const line of unfolded) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    const name = line.slice(0, index).trim().toLowerCase();
    if (!(name in headers)) headers[name] = line.slice(index + 1).trim();
  }
  return headers;
}

// « Nom <adresse> » sans guillemets ni encodage, séparés par « , »
function normalizeAddresses(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return decodeWords(value)
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((part) => {
      const match = part.trim().match(/^(.*)<([^>]*)>$/);
      if (!match) return part.trim();
      const name = match[1].trim().replace(/^"(.*)"$/, "$1");
      return name ? `${name} <${match[2].trim()}>` : match[2].trim();
    })
    .join(", ");
}

// Type et paramètres d'un en-tête Content-Type ou Content-Disposition
function parseParams(value: string | undefined): { value: string; params: Record<string, string> } {
  const [main, ...rest] = (value ?? "").split(";");
  const params: Record<string, string> = {};
  for (const part of rest) {
    const index = part.indexOf("=");
    if (index < 0) continue;
    params[part.slice(0, index).trim().toLowerCase()] = part.slice(index + 1).trim().replace(/^"(.*)"$/, "$1");
  }
  return { value: main.trim().toLowerCase(), params };
}

function decodeTransfer(body: string, encoding: string | undefined): Buffer {
  switch ((encoding ?? "7bit").toLowerCase()) {
    case "base64":
      return Buffer.from(body.replace(/\s/g, ""), "base64");
    case "quoted-printable":
      return decodeEscapes(body.replace(/=\n/g, ""));
    default:
      return Buffer.from(body, "utf8");
  }
}

// Parties terminales du message, dans l'ordre, avec le chemin de leurs conteneurs
function describeParts(head: Record<string, string>, body: string, path: string[]): unknown[] {
  const type = parseParams(head["content-type"] ?? "text/plain");
  if (type.value.startsWith("multipart/")) {
    const boundary = type.params.boundary;
    const sections = body.split(`--${boundary}`);
    const parts: unknown[] = [];
    // sections[0] : préambule ; la dernière commence par « -- » (fin)
    for (const section of sections.slice(1)) {
      if (section.startsWith("--")) break;
      const content = section.replace(/^[^\n]*\n/, "").replace(/\n$/, "");
      const index = content.indexOf("\n\n");
      const partHead = parseHeaders(index < 0 ? content : content.slice(0, index));
      const partBody = index < 0 ? "" : content.slice(index + 2);
      parts.push(...describeParts(partHead, partBody, [...path, type.value]));
    }
    return parts;
  }
  const decoded = decodeTransfer(body, head["content-transfer-encoding"]);
  const disposition = parseParams(head["content-disposition"]);
  const part: Record<string, unknown> = { chemin: path.join(" > "), type: type.value };
  if (type.params.charset) part.charset = type.params.charset.toLowerCase();
  if (head["content-id"]) part.cid = head["content-id"];
  if (disposition.value) part.disposition = disposition.value;
  const filename = disposition.params.filename ?? type.params.name;
  if (filename) part.fichier = decodeWords(filename);
  if (type.value.startsWith("text/")) part.contenu = decoded.toString("utf8").replace(/\r\n/g, "\n");
  else part.taille = decoded.length;
  return [part];
}

function describeMail(message: string): Record<string, unknown> {
  const index = message.indexOf("\n\n");
  const headers = parseHeaders(index < 0 ? message : message.slice(0, index));
  const body = index < 0 ? "" : message.slice(index + 2).replace(/\n$/, "");
  return {
    sujet: headers.subject === undefined ? undefined : decodeWords(headers.subject),
    de: normalizeAddresses(headers.from),
    a: normalizeAddresses(headers.to),
    repondreA: normalizeAddresses(headers["reply-to"]),
    parties: describeParts(headers, body, []),
  };
}

export function startStub(): Promise<() => Promise<void>> {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${STUB_PORT}`);
    const raw = await readBody(req);

    if (url.pathname === "/__calls") {
      if (req.method === "DELETE") calls.length = 0;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(calls));
      return;
    }

    const contentType = req.headers["content-type"];
    const body = describeBody(contentType, raw);

    if (url.pathname.startsWith("/nocodb/")) {
      calls.push({ service: "nocodb", method: req.method, path: `${url.pathname}${url.search}` });
      const list = filterRows(url.searchParams.get("where"));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ list, pageInfo: { totalRows: list.length, page: 1, pageSize: 25, isFirstPage: true, isLastPage: true } }));
      return;
    }

    if (url.pathname.startsWith("/webhook/")) {
      calls.push({ service: "webhook", method: req.method, path: url.pathname, contentType: contentType?.split(";")[0], body });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "Reçu par le service simulé" }));
      return;
    }

    calls.push({ service: "autre", method: req.method, path: url.pathname });
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "inconnu du service simulé" }));
  });

  // SMTP minimal : accepte tout, sans STARTTLS ni authentification obligatoire
  const smtp = net.createServer((socket) => {
    let inData = false;
    let message = "";
    const recipients: string[] = [];
    socket.write("220 banc.test ESMTP simulé\r\n");
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let index: number;
      while ((index = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            // Sujet, adresses et parties décodés (voir describeMail)
            calls.push({ service: "smtp", body: { destinataires: recipients.slice(), ...describeMail(message) } });
            socket.write("250 2.0.0 message accepté\r\n");
          } else {
            // Point doublé en début de ligne (RFC 5321, 4.5.2)
            message += `${line.startsWith("..") ? line.slice(1) : line}\n`;
          }
          continue;
        }
        const command = line.slice(0, 4).toUpperCase();
        if (command === "EHLO") socket.write("250-banc.test\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n");
        else if (command === "HELO") socket.write("250 banc.test\r\n");
        else if (command === "AUTH") socket.write("235 2.7.0 authentifié\r\n");
        else if (command === "MAIL") socket.write("250 2.1.0 ok\r\n");
        else if (command === "RCPT") { recipients.push(line.replace(/^RCPT TO:\s*/i, "")); socket.write("250 2.1.5 ok\r\n"); }
        else if (command === "DATA") { inData = true; message = ""; socket.write("354 fin par .\r\n"); }
        else if (command === "QUIT") { socket.write("221 2.0.0 au revoir\r\n"); socket.end(); }
        else if (command === "RSET" || command === "NOOP") socket.write("250 2.0.0 ok\r\n");
        else socket.write("502 5.5.2 commande inconnue\r\n");
      }
    });
    socket.on("error", () => undefined);
  });

  return new Promise((resolve) => {
    server.listen(STUB_PORT, "127.0.0.1", () => {
      smtp.listen(STUB_SMTP_PORT, "127.0.0.1", () => {
        resolve(() => new Promise<void>((done) => server.close(() => smtp.close(() => done()))));
      });
    });
  });
}
