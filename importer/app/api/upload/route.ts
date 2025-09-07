import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Env = {
  SUPABASE_URL: string | undefined;
  SUPABASE_KEY: string | undefined;
  GOOGLE_SERVICE_ACCOUNT: string | undefined;
  GOOGLE_DRIVE_FOLDER_ID: string | undefined;
  GOOGLE_CLIENT_EMAIL?: string | undefined;
  GOOGLE_PRIVATE_KEY?: string | undefined;
};

function getEnv(): Env {
  const env: Env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    GOOGLE_SERVICE_ACCOUNT: process.env.GOOGLE_SERVICE_ACCOUNT,
    GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID,
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
  };
  if (!env.SUPABASE_URL) throw new Error("Falta variable de entorno: SUPABASE_URL");
  if (!env.SUPABASE_KEY) throw new Error("Falta variable de entorno: SUPABASE_KEY");
  if (!env.GOOGLE_DRIVE_FOLDER_ID) throw new Error("Falta variable de entorno: GOOGLE_DRIVE_FOLDER_ID");
  // Requerir EITHER JSON completo o par email/key
  const haveJson = !!env.GOOGLE_SERVICE_ACCOUNT;
  const havePair = !!(env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY);
  if (!haveJson && !havePair) {
    throw new Error("Faltan credenciales: GOOGLE_SERVICE_ACCOUNT o GOOGLE_CLIENT_EMAIL+GOOGLE_PRIVATE_KEY");
  }
  return env;
}

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

function getDriveClient(serviceAccountJson: string, email?: string, privateKey?: string) {
  const creds = parseServiceAccount(serviceAccountJson, email, privateKey);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

export async function POST(req: NextRequest) {
  try {
    const { SUPABASE_URL, SUPABASE_KEY, GOOGLE_SERVICE_ACCOUNT, GOOGLE_DRIVE_FOLDER_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = getEnv();

    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Archivo 'file' es requerido" }, { status: 400 });
    }

    const fields = {
      titulo: String(formData.get("titulo") ?? "").trim(),
      autor: String(formData.get("autor") ?? "").trim(),
      isbn: String(formData.get("isbn") ?? "").trim() || null,
      editorial: String(formData.get("editorial") ?? "").trim() || null,
      fecha_publicacion: String(formData.get("fecha_publicacion") ?? "").trim() || null,
      idioma: String(formData.get("idioma") ?? "es").trim() || "es",
      descripcion: String(formData.get("descripcion") ?? "").trim() || null,
      genero: String(formData.get("genero") ?? "").trim() || null,
      serie: String(formData.get("serie") ?? "").trim() || null,
      numero_serie: String(formData.get("numero_serie") ?? "").trim() || null,
    } as const;

    // Subir a Google Drive
    const drive = getDriveClient(GOOGLE_SERVICE_ACCOUNT, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadRes = await drive.files.create({
      requestBody: { name: file.name, parents: [GOOGLE_DRIVE_FOLDER_ID] },
      media: { mimeType: file.type, body: BufferReadable(buffer) as any },
      fields: "id, webViewLink, size",
    });

    const sizeBytes = uploadRes.data.size ? Number(uploadRes.data.size) : undefined;
    const tamanio_total = typeof sizeBytes === "number" ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB` : null;

    // Guardar en Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const insertPayload = [{
      titulo: fields.titulo || file.name,
      autor: fields.autor || "Desconocido",
      isbn: fields.isbn,
      editorial: fields.editorial,
      fecha_publicacion: fields.fecha_publicacion,
      idioma: fields.idioma || "es",
      descripcion: fields.descripcion,
      genero: fields.genero,
      serie: fields.serie,
      numero_serie: fields.numero_serie,
      carpeta_autor: fields.autor || null,
      carpeta_obra: fields.titulo || null,
      url_download_portada: uploadRes.data.webViewLink ?? null,
      tamanio_total,
    }];

    const { error } = await supabase.from("books").insert(insertPayload as any);
    if (error) {
      return NextResponse.json({ error: "Error al insertar en Supabase", details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      drive_id: uploadRes.data.id,
      file_url: uploadRes.data.webViewLink,
      metadata: {
        titulo: insertPayload[0].titulo,
        autor: insertPayload[0].autor,
        idioma: insertPayload[0].idioma,
        tamanio_total,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Error al importar libro", details: e?.message ?? String(e) }, { status: 500 });
  }
}

// Utilidad: convierte un Buffer en un Readable para googleapis
import { Readable } from "stream";
function BufferReadable(buffer: Buffer): Readable {
  const readable = new Readable();
  readable.push(buffer);
  readable.push(null);
  return readable;
}


