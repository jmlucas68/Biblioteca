document.addEventListener('DOMContentLoaded', async function () {
    const viewer = document.getElementById('viewer');
    const params = new URLSearchParams(window.location.search);
    const rawBookUrl = params.get('book');

    if (!rawBookUrl) {
        viewer.innerText = "Error: No se ha proporcionado la URL del libro.";
        return;
    }

    const match = rawBookUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (!match || !match[1]) {
        console.error("No se pudo extraer el fileId de la URL:", rawBookUrl);
        viewer.innerText = "Error: La URL del libro no es un enlace de Google Drive válido.";
        return;
    }
    const fileId = match[1];

    try {
        viewer.innerText = "Descargando libro...";
        const PROXY_DOWNLOAD_URL = 'https://perplexity-proxy-backend.vercel.app/api/download';

        const response = await fetch(PROXY_DOWNLOAD_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'download_file',
                fileId: fileId
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`El proxy devolvió un error: ${response.status} ${errorText}`);
        }

        viewer.innerText = "Cargando libro...";
        const epubData = await response.arrayBuffer();

        const book = ePub(epubData);
        const rendition = book.renderTo("viewer", { width: "100%", height: "100%" });
        rendition.display();

        const next = document.getElementById("next");
        next.addEventListener("click", function(){
            rendition.next();
        });

        const prev = document.getElementById("prev");
        prev.addEventListener("click", function(){
            rendition.prev();
        });

        book.ready.then(() => {
            console.log('Libro listo');
        });

    } catch (error) {
        console.error("Error al cargar el libro EPUB:", error);
        viewer.innerText = `No se pudo cargar el libro. ${error.message}`;
    }
});