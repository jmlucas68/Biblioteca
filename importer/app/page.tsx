'''"use client";

import { useState, useRef } from "react";
import "./importer.css"; // Importar los nuevos estilos

export default function Page() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus(null);
    setError(null);
    setIsUploading(true);

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
      setStatus(`Éxito: ${json.metadata.titulo} subido correctamente.`);
      form.reset();
      setFileName(null);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsUploading(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (file && fileInputRef.current) {
        fileInputRef.current.files = e.dataTransfer.files;
        setFileName(file.name);
    }
  };

  return (
    <main className="importer-container">
      <div className="importer-card">
        <div className="importer-header">
          <h1>Importador de Ebooks</h1>
          <p>Sube un libro a Google Drive y registra sus metadatos en la biblioteca.</p>
        </div>

        <form onSubmit={onSubmit} encType="multipart/form-data">
          <div className="form-grid">
            <div className="form-group span-2">
              <label htmlFor="titulo">Título</label>
              <input id="titulo" name="titulo" type="text" placeholder="Ej: El Señor de los Anillos" required />
            </div>
            <div className="form-group">
              <label htmlFor="autor">Autor</label>
              <input id="autor" name="autor" type="text" placeholder="Ej: J.R.R. Tolkien" />
            </div>
            <div className="form-group">
                <label htmlFor="serie">Serie</label>
                <input id="serie" name="serie" type="text" placeholder="Ej: La Rueda del Tiempo" />
            </div>
            <div className="form-group">
                <label htmlFor="numero_serie">Nº Serie</label>
                <input id="numero_serie" name="numero_serie" type="text" placeholder="Ej: 1" />
            </div>
            <div className="form-group">
              <label htmlFor="genero">Géneros</label>
              <input id="genero" name="genero" type="text" placeholder="Ej: Fantasía, Aventura" />
            </div>
          </div>

          <div className="form-group">
            <label>Archivo del Ebook</label>
            <label 
              htmlFor="file" 
              className="drop-zone" 
              onDragOver={e => e.preventDefault()} 
              onDragEnter={e => e.preventDefault()} 
              onDrop={handleDrop}
            >
              {fileName ? (
                <p>Archivo seleccionado: <strong>{fileName}</strong></p>
              ) : (
                <p>Arrastra y suelta un archivo aquí, o haz clic para seleccionarlo</p>
              )}
              <input id="file" name="file" type="file" required onChange={handleFileChange} ref={fileInputRef} style={{ display: 'none' }} />
            </label>
          </div>

          <button type="submit" className="submit-btn" disabled={isUploading}>
            {isUploading ? 'Subiendo...' : 'Subir Libro'}
          </button>
        </form>

        {error && <div className="status-message error-message">{error}</div>}
        {status && <div className="status-message success-message">{status}</div>}
      </div>
    </main>
  );
}'''