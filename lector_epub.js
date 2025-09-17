document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const rawBookUrl = params.get('book');

    if (rawBookUrl) {
        // Usamos un proxy CORS público para evitar el problema con Google Drive
        const PROXY_URL = 'https://perplexity-proxy-backend.vercel.app'; 
        const GEMINI_PROXY_URL = 'https://perplexity-proxy-backend.vercel.app/api/proxy'; 

        const bookUrl = PROXY_URL + encodeURIComponent(rawBookUrl);

        const book = ePub(bookUrl);
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
    }
});