document.addEventListener('DOMContentLoaded', function () {
    const params = new URLSearchParams(window.location.search);
    const bookUrl = params.get('book');

    if (bookUrl) {
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