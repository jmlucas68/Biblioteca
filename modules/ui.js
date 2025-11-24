// Dependencies to be injected from other modules
let elements;
let allBooks;
let allFormats;
let classification;
let currentSection;
let currentSubsection;
let filteredBooks;
let currentBooks;
let currentEditingBook;
let tagFilterLogic;

let esc;
let resolveCoverThumb;
let isAdmin;
let getBookFormats;
let normalizeText;
let isHTML;

let showSubsections;
let showBooks;
let showSections;
let applyTagFilters;
let filterBooksByTagsOR;
let filterBooksByTagsAND;
let closeModal;
let closeEditModal;
let openSearchModal;
let closeSearchModal;
let openViewer;
let closeViewer;
let clearSearch;
let performSearch;
let filterBooks;
let sortBooks;
let goBack;
let showBookDetails;
let showEditModal;
let searchByAuthor;
let searchBySerie;


export function initUI(dependencies) {
    elements = dependencies.elements;
    allBooks = dependencies.allBooks;
    allFormats = dependencies.allFormats;
    classification = dependencies.classification;
    currentSection = dependencies.currentSection;
    currentSubsection = dependencies.currentSubsection;
    filteredBooks = dependencies.filteredBooks;
    currentBooks = dependencies.currentBooks;
    currentEditingBook = dependencies.currentEditingBook;
    tagFilterLogic = dependencies.tagFilterLogic;

    esc = dependencies.esc;
    resolveCoverThumb = dependencies.resolveCoverThumb;
    isAdmin = dependencies.isAdmin;
    getBookFormats = dependencies.getBookFormats;
    normalizeText = dependencies.normalizeText;
    isHTML = dependencies.isHTML;

    showSubsections = dependencies.showSubsections;
    showBooks = dependencies.showBooks;
    showSections = dependencies.showSections;
    applyTagFilters = dependencies.applyTagFilters;
    filterBooksByTagsOR = dependencies.filterBooksByTagsOR;
    filterBooksByTagsAND = dependencies.filterBooksByTagsAND;
    closeModal = dependencies.closeModal;
    closeEditModal = dependencies.closeEditModal;
    openSearchModal = dependencies.openSearchModal;
    closeSearchModal = dependencies.closeSearchModal;
    openViewer = dependencies.openViewer;
    closeViewer = dependencies.closeViewer;
    clearSearch = dependencies.clearSearch;
    performSearch = dependencies.performSearch;
    filterBooks = dependencies.filterBooks;
    sortBooks = dependencies.sortBooks;
    goBack = dependencies.goBack;
    showBookDetails = dependencies.showBookDetails;
    showEditModal = dependencies.showEditModal;
    searchByAuthor = dependencies.searchByAuthor;
    searchBySerie = dependencies.searchBySerie;
}

export function populateElements() {
    elements = {
        loading: document.getElementById('loading'),
        sectionsView: document.getElementById('sectionsView'),
        subsectionsView: document.getElementById('subsectionsView'),
        booksView: document.getElementById('booksView'),
        sectionsGrid: document.getElementById('sectionsGrid'),
        subsectionsGrid: document.getElementById('subsectionsGrid'),
        booksGrid: document.getElementById('booksGrid'),
        breadcrumb: document.getElementById('breadcrumb'),
        backButton: document.getElementById('backButton'),
        searchContainer: document.getElementById('searchContainer'),
        searchInput: document.getElementById('searchInput'),
        sortSelect: document.getElementById('sortSelect'),
        totalBooks: document.getElementById('totalBooks'),
        totalFormats: document.getElementById('totalFormats'),
        bookModal: document.getElementById('bookModal'),
        modalContent: document.getElementById('modalContent'),
        closeModal: document.getElementById('closeModal'),
        editModal: document.getElementById('editModal'),
        aiDescriptionButton: document.getElementById('aiDescriptionButton'),
        adminControls: document.getElementById('adminControls'),
        searchModal: document.getElementById('searchModal'),
        ebookImporter: document.getElementById('ebookImporter'),
        uploadStatus: document.getElementById('uploadStatus'),
        importModal: document.getElementById('importModal'),
        importForm: document.getElementById('importForm'),
        closeImportModal: document.querySelector('#importModal .close-button'),
        header: document.querySelector('.header'), // Add header element
        pinHeaderButton: document.getElementById('pinHeaderButton'), // Add pin button
    };
}

export function updateStats(books) {
    const bookIds = new Set(books.map(b => b.id));
    const relevantFormats = allFormats.filter(f => bookIds.has(f.book_id));
    const uniqueAuthors = new Set(books.map(b => (b.autor || '').trim()).filter(Boolean));

    elements.totalBooks.textContent = books.length;
    elements.totalFormats.textContent = relevantFormats.length;
    document.getElementById('totalAuthors').textContent = uniqueAuthors.size;
}

export function updateGlobalStats() {
    updateStats(allBooks);
}

export function renderBooks() {
    elements.booksGrid.innerHTML = currentBooks.length > 0 ? currentBooks.map(renderBook).join('') : '<div class="empty-state"><h3>No se encontraron libros</h3></div>';
}

export function renderSearchResults(results) {
    const container = document.getElementById('searchResults');
    if (results.length === 0) {
        container.innerHTML = '<div class="empty-state"><h3>No se encontraron libros</h3></div>';
        return;
    }
    container.innerHTML = `<h3 style="margin-bottom: 16px;">${results.length} libro(s) encontrado(s)</h3><div class="grid grid--books">${results.map(renderBook).join('')}</div>`;
}

export function renderBook(book) {
    const formats = getBookFormats(book.id);
    const genres = (book.genero || '').split(',').map(g => g.trim()).filter(Boolean);
    const portadaSrc = resolveCoverThumb(book.url_portada);
    const coverHref = book.url_portada || '#';

    const formatLinks = formats.map(f => {
        const downloadUrl = f.url_download || f.ruta_archivo || '#';
        const hasValidUrl = downloadUrl && downloadUrl !== '#';
        const formatName = esc(f.formato);
        const bookTitle = esc(book.titulo);
        return `<a href="#" onclick="openViewer(event, '${esc(downloadUrl)}', '${bookTitle}', '${formatName}')" class="format-link${!hasValidUrl ? ' format-link--disabled' : ''}">${formatName}</a>`;
    }).join('');

    return `
        <div class="book-card" onclick="showBookDetails(${book.id})">
            <div class="book-cover-wrap">
                <a href="${esc(coverHref)}" target="_blank" rel="noopener" onclick="event.stopPropagation();">
                    <img class="book-cover" src="${esc(portadaSrc)}" alt="Portada de ${esc(book.titulo)}" onerror="this.style.display='none'; this.parentElement.innerHTML='📖';" />
                </a>
            </div>
            <div class="book-info">
                <div class="book-title">${esc(book.titulo)}</div>
                <div class="book-author">por ${esc(book.autor || 'Desconocido')}</div>
                <div class="book-meta">
                    ${book.serie ? `<span class="book-badge book-badge--series">${esc(book.serie)}${book.numero_serie ? ` #${book.numero_serie}` : ''}</span>` : ''}
                    ${genres.slice(0, 2).map(genre => `<span class="book-badge book-badge--genre">${esc(genre)}</span>`).join('')}
                </div>
                <div class="book-formats">${formatLinks}</div>
                <div class="book-actions">
                    ${isAdmin ? `<button type="button" class="btn edit" onclick="showEditModal(${book.id})">✏️ Editar</button>` : ''}
                </div>
            </div>
        </div>`;
}

export function hideAllViews() {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
}

export function updateBreadcrumb(path) {
    elements.breadcrumb.innerHTML = path.length === 0 ? '' : path.map((item, index) => `<span class="breadcrumb-item">${esc(item)}</span>`).join('<span class="breadcrumb-separator"> › </span>');
}
