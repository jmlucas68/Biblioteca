document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const rawBookUrl = params.get('book');

    if (rawBookUrl) {
        // Cargar el EPUB directamente desde la URL proporcionada en el parámetro `book`.
        // Evitamos prefijar con el proxy para que epub.js no intente resolver rutas internas
        // como `META-INF/container.xml` contra el dominio del proxy (CORS).
        const bookUrl = rawBookUrl;

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