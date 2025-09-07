"use client";

import { useState } from "react";

export default function Page() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setError(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: data,
      });
      const json = await res.json();
      if (!res.ok) {
        const message = [json?.error, json?.details].filter(Boolean).join(" - ") || "Error inesperado";
        throw new Error(message);
      }
      setStatus(JSON.stringify(json, null, 2));
      form.reset();
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Importer App</h1>
      <p>Sube un ebook a Google Drive y registra metadatos en Supabase.</p>

      <form onSubmit={onSubmit} encType="multipart/form-data">
        <fieldset style={{ display: "grid", gap: 12 }}>
          <label>
            Título
            <input name="titulo" type="text" placeholder="Título" required />
          </label>
          <label>
            Autor
            <input name="autor" type="text" placeholder="Autor" />
          </label>
          <label>
            ISBN
            <input name="isbn" type="text" placeholder="ISBN" />
          </label>
          <label>
            Editorial
            <input name="editorial" type="text" placeholder="Editorial" />
          </label>
          <label>
            Fecha publicación
            <input name="fecha_publicacion" type="date" />
          </label>
          <label>
            Idioma
            <input name="idioma" type="text" placeholder="es" defaultValue="es" />
          </label>
          <label>
            Descripción
            <textarea name="descripcion" placeholder="Descripción" rows={4} />
          </label>
          <label>
            Género (tags CSV)
            <input name="genero" type="text" placeholder="ciencia, tecnologia" />
          </label>
          <label>
            Serie
            <input name="serie" type="text" placeholder="Serie" />
          </label>
          <label>
            Número de serie
            <input name="numero_serie" type="text" placeholder="1" />
          </label>
          <label>
            Archivo
            <input name="file" type="file" required />
          </label>
          <button type="submit">Subir</button>
        </fieldset>
      </form>

      {error && (
        <pre style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{error}</pre>
      )}
      {status && (
        <pre style={{ background: "#111", color: "#0f0", padding: 12, borderRadius: 6 }}>
          {status}
        </pre>
      )}
    </main>
  );
}

 
