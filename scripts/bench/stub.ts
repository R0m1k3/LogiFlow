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
            const subject = message.match(/^Subject: (.*)$/m)?.[1];
            calls.push({ service: "smtp", body: { destinataires: recipients.slice(), sujet: subject } });
            socket.write("250 2.0.0 message accepté\r\n");
          } else {
            message += `${line}\n`;
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
