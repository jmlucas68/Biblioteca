import { NextRequest, NextResponse } from "next/server";
import { getDriveClient, BufferReadable } from "../lib/google";
import { createSupabaseClient } from "../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Env = {
  SUPABASE_URL: string;
  SUPABASE_KEY: string;
  GOOGLE_SERVICE_ACCOUNT: string;
  GOOGLE_DRIVE_FOLDER_ID: string;
  GOOGLE_CLIENT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
};

function getEnv(): Env | { error: string } {
  const env: Partial<Env> = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    GOOGLE_SERVICE_ACCOUNT: process.env.GOOGLE_SERVICE_ACCOUNT,
    GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID,
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,
  };

  if (!env.SUPABASE_URL) return { error: "Falta variable de entorno: SUPABASE_URL" };
  if (!env.SUPABASE_KEY) return { error: "Falta variable de entorno: SUPABASE_KEY" };
  if (!env.GOOGLE_DRIVE_FOLDER_ID) return { error: "Falta variable de entorno: GOOGLE_DRIVE_FOLDER_ID" };

  const haveJson = !!env.GOOGLE_SERVICE_ACCOUNT;
  const havePair = !!(env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY);
  if (!haveJson && !havePair) {
    return { error: "Faltan credenciales: GOOGLE_SERVICE_ACCOUNT o GOOGLE_CLIENT_EMAIL+GOOGLE_PRIVATE_KEY" };
  }
  return env as Env;
}

export async function POST(req: NextRequest) {
  const env = getEnv();
  if ("error" in env) {
    return NextResponse.json({ error: "Configuración del servidor incompleta", details: env.error }, { status: 500 });
  }

  try {
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
    const drive = getDriveClient(env.GOOGLE_SERVICE_ACCOUNT, env.GOOGLE_CLIENT_EMAIL, env.GOOGLE_PRIVATE_KEY);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadRes = await drive.files.create({
      requestBody: { name: file.name, parents: [env.GOOGLE_DRIVE_FOLDER_ID] },
      media: { mimeType: file.type, body: BufferReadable(buffer) as any },
      fields: "id, webViewLink, webContentLink, size",
    });

    const sizeBytes = uploadRes.data.size ? Number(uploadRes.data.size) : undefined;
    const tamanio_total = typeof sizeBytes === "number" ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB` : null;

    // Guardar en Supabase
    const supabase = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_KEY);
    const insertPayload = {
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
      url_portada: uploadRes.data.webViewLink ?? null,
      url_download_portada: uploadRes.data.webContentLink ?? null,
      tamanio_total,
    };

    const { error } = await supabase.from("books").insert(insertPayload);
    if (error) {
      return NextResponse.json({ error: "Error al insertar en Supabase", details: error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: "success",
      drive_id: uploadRes.data.id,
      viewUrl: uploadRes.data.webViewLink,
      downloadUrl: uploadRes.data.webContentLink,
      metadata: {
        titulo: insertPayload.titulo,
        autor: insertPayload.autor,
        idioma: insertPayload.idioma,
        tamanio_total,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: "Error al importar libro", details: e?.message ?? String(e) }, { status: 500 });
  }
}