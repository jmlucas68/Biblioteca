
# GUÍA_DEVELOPER - Importer App para Biblioteca Personal

## Contexto

La aplicación principal de Biblioteca es estática (Github Pages) y organiza ebooks alojados en Google Drive.

Un mini backend en Vercel gestiona claves, y la base de datos de metadatos de libros está en Supabase (tabla `books`).

Actualmente hay ~1000 libros y la actividad es baja, por lo que todo debe funcionar con recursos gratuitos.

## Objetivo

Crear una aplicación independiente llamada **Importer App**, encargada de:

1. Subir libros desde el dispositivo (Windows/Android)
2. Guardarlos en Google Drive
3. Registrar sus metadatos en la tabla `books` de Supabase
4. Ser llamada de forma transparente desde la aplicación principal

## Arquitectura

- **Frontend Importer (Next.js minimalista)**: formulario simple con campos de metadatos y selector de archivo
- **API Importer (Vercel Functions)**: recibe archivo y metadatos → sube a Google Drive → inserta registro en Supabase
- **Google Drive**: almacenamiento de archivos de ebooks
- **Supabase**: almacenamiento de metadatos en la tabla `books`
- **Biblioteca principal (Github Pages)**: invoca Importer App mediante enlace o iframe


## Tabla `books` en Supabase

```sql
CREATE TABLE public.books (
  id integer PRIMARY KEY,
  titulo text NOT NULL,
  autor text,
  isbn varchar,
  editorial text,
  fecha_publicacion timestamp,
  idioma varchar,
  descripcion text,
  genero text,
  serie text,
  numero_serie varchar,
  carpeta_autor text,
  carpeta_obra text,
  url_portada text,
  url_download_portada text,
  tamanio_total text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```


## API Importer - Ejemplo de implementación (Vercel)

```javascript
import formidable from "formidable";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

export const config = { api: { bodyParser: false } };

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function getDriveClient() {
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método no permitido" });

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      const { titulo, autor, isbn, editorial, fecha_publicacion, idioma, descripcion, genero, serie, numero_serie } = fields;
      const file = files.file;

      const drive = getDriveClient();
      const uploaded = await drive.files.create({
        resource: { name: file.originalFilename, parents: [process.env.GOOGLE_DRIVE_FOLDER_ID] },
        media: { mimeType: file.mimetype, body: fs.createReadStream(file.filepath) },
        fields: "id, webViewLink, size",
      });

      const tamanio = uploaded.data.size ? `${(uploaded.data.size / (1024*1024)).toFixed(2)} MB` : null;

      await supabase.from("books").insert([{
        titulo: titulo || file.originalFilename,
        autor: autor || "Desconocido",
        isbn, editorial, fecha_publicacion, idioma: idioma || "es", descripcion,
        genero, serie, numero_serie,
        carpeta_autor: autor, carpeta_obra: titulo,
        url_download_portada: uploaded.data.webViewLink,
        tamanio_total: tamanio,
      }]);

      res.status(200).json({ 
        status: "success", 
        drive_id: uploaded.data.id, 
        file_url: uploaded.data.webViewLink 
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Error al importar libro" });
    }
  });
}
```


## Ejemplo de respuesta JSON

```json
{
  "status": "success",
  "drive_id": "1abc234XYZ",
  "file_url": "https://drive.google.com/file/d/1abc234XYZ/view",
  "metadata": {
    "titulo": "Ejemplo Libro",
    "autor": "Autor Desconocido",
    "isbn": null,
    "idioma": "es",
    "tamanio_total": "2.30 MB"
  }
}
```


## Integración con la aplicación principal

- La Biblioteca (Github Pages) puede abrir Importer App en una nueva pestaña o iframe
- Tras subir un libro, el usuario regresa a la Biblioteca y los datos estarán disponibles en Supabase
- No se necesita modificar la lógica de la app principal


## Próximos pasos

1. Desplegar Importer App en Vercel con credenciales de Google Drive y Supabase
2. Probar subida de un ebook desde frontend minimalista
3. Verificar inserción en Supabase y acceso en la Biblioteca
4. Optimizar extracción de metadatos (ej: ISBN, portada) en versiones futuras
