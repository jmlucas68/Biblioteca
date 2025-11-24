import { google } from "googleapis";
import { Readable } from "stream";

function parseServiceAccount(serviceAccountJson: string, fallbackEmail?: string, fallbackKey?: string) {
  let creds: any | undefined;
  let raw = serviceAccountJson?.trim();
  if (raw?.startsWith("base64:")) {
    const b64 = raw.slice("base64:".length);
    raw = Buffer.from(b64, "base64").toString("utf8");
  }
  try {
    creds = raw ? JSON.parse(raw) : undefined;
  } catch (_e) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT no es JSON válido");
  }

  // Permitir variables separadas como fallback o para sobreescribir
  if (fallbackEmail) creds.client_email = fallbackEmail;
  if (fallbackKey) creds.private_key = fallbackKey;

  // Normalizar saltos de línea en la private_key
  if (typeof creds?.private_key === "string") {
    creds.private_key = creds.private_key.replace(/\\n/g, "\n");
  }

  if (!creds?.client_email) {
    const keys = creds && typeof creds === "object" ? Object.keys(creds) : [];
    throw new Error(`Service Account sin client_email. Claves presentes: ${keys.join(",")}`);
  }
  return creds;
}

export function getDriveClient(serviceAccountJson: string, email?: string, privateKey?: string) {
  const creds = parseServiceAccount(serviceAccountJson, email, privateKey);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

export function BufferReadable(buffer: Buffer): Readable {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}
