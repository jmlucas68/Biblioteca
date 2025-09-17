document.addEventListener('DOMContentLoaded', async function () {
    const params = new URLSearchParams(window.location.search);
    const rawBookUrl = params.get('book');

    if (rawBookUrl) {
        try {
            // Show loading message
            const viewer = document.getElementById("viewer");
            if (viewer) {
                viewer.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;"><p>Cargando libro...</p></div>';
            }

            // Instead of loading directly from Google Drive URL (which causes CORS),
            // we need to fetch the file as a blob first
            let bookData;
            
            // Check if it's a Google Drive URL and convert to download URL
            const googleDriveMatch = rawBookUrl.match(/drive\.google\.com.*[?&]id=([a-zA-Z0-9_-]+)/);
            if (googleDriveMatch) {
                const fileId = googleDriveMatch[1];
                const downloadUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;
                
                try {
                    const response = await fetch(downloadUrl);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    bookData = await response.arrayBuffer();
                } catch (fetchError) {
                    console.warn('Direct download failed, trying proxy approach:', fetchError);
                    // If direct download fails, we might need to use the proxy
                    // This would require modifying your backend proxy to handle EPUB files
                    throw new Error('No se pudo descargar el archivo EPUB. Verifique que el archivo sea público.');
                }
            } else {
                // For non-Google Drive URLs, try direct fetch
                try {
                    const response = await fetch(rawBookUrl);
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    bookData = await response.arrayBuffer();
                } catch (fetchError) {
                    throw new Error('No se pudo descargar el archivo EPUB desde la URL proporcionada.');
                }
            }

            // Now create the epub.js book from the ArrayBuffer
            const book = ePub(bookData);
            const rendition = book.renderTo("viewer", { 
                width: "100%", 
                height: "100%",
                allowScriptedContent: true 
            });
            
            // Display the book
            await rendition.display();

            // Set up navigation controls
            const next = document.getElementById("next");
            if (next) {
                next.addEventListener("click", function(){
                    rendition.next();
                });
            }

            const prev = document.getElementById("prev");
            if (prev) {
                prev.addEventListener("click", function(){
                    rendition.prev();
                });
            }

            // Add keyboard navigation
            document.addEventListener('keydown', function(event) {
                switch(event.key) {
                    case 'ArrowLeft':
                        rendition.prev();
                        break;
                    case 'ArrowRight':
                        rendition.next();
                        break;
                }
            });

            // Wait for book to be ready
            await book.ready;
            console.log('Libro EPUB cargado correctamente');

        } catch (error) {
            console.error('Error loading EPUB:', error);
            const viewer = document.getElementById("viewer");
            if (viewer) {
                viewer.innerHTML = `
                    <div style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100%;padding:20px;text-align:center;">
                        <h3 style="color:#ef4444;margin-bottom:16px;">Error al cargar el libro</h3>
                        <p style="margin-bottom:16px;">${error.message}</p>
                        <p style="color:#64748b;">Posibles soluciones:</p>
                        <ul style="text-align:left;color:#64748b;margin-top:8px;">
                            <li>Verificar que el archivo EPUB sea público en Google Drive</li>
                            <li>Intentar descargar el archivo manualmente</li>
                            <li>Contactar al administrador si el problema persiste</li>
                        </ul>
                    </div>
                `;
            }
        }
    } else {
        const viewer = document.getElementById("viewer");
        if (viewer) {
            viewer.innerHTML = '<div style="display:flex;justify-content:center;align-items:center;height:100%;"><p>No se especificó un libro para cargar.</p></div>';
        }
    }
});