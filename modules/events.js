// Dependencies to be injected from other modules
let elements;
let handleFileSelect;
let saveNewBook;
let closeImportModal;
let goBack;
let filterBooks;
let sortBooks;
let closeModal;
let closeEditModal;
let openSearchModal;
let closeSearchModal;
let closeViewer;
let generateAiDescription;
let currentEditingBook;
let toggleHeaderPin;
let logoff;
let showLoginModal;
let isAdmin;

export function initEventListeners(dependencies) {
    elements = dependencies.elements;
    handleFileSelect = dependencies.handleFileSelect;
    saveNewBook = dependencies.saveNewBook;
    closeImportModal = dependencies.closeImportModal;
    goBack = dependencies.goBack;
    filterBooks = dependencies.filterBooks;
    sortBooks = dependencies.sortBooks;
    closeModal = dependencies.closeModal;
    closeEditModal = dependencies.closeEditModal;
    openSearchModal = dependencies.openSearchModal;
    closeSearchModal = dependencies.closeSearchModal;
    closeViewer = dependencies.closeViewer;
    generateAiDescription = dependencies.generateAiDescription;
    currentEditingBook = dependencies.currentEditingBook;
    toggleHeaderPin = dependencies.toggleHeaderPin;
    logoff = dependencies.logoff;
    showLoginModal = dependencies.showLoginModal;
    isAdmin = dependencies.isAdmin;
}


export function setupEventListeners() {
    document.getElementById('importButton').addEventListener('click', () => {
        elements.ebookImporter.click();
    });
    // MODIFIED: Use handleFileSelect for the new import modal flow
    elements.ebookImporter.addEventListener('change', handleFileSelect);

    // NEW: Listeners for the import modal
    if (elements.closeImportModal) {
        elements.closeImportModal.addEventListener('click', closeImportModal);
    }
    if (elements.importForm) {
        elements.importForm.addEventListener('submit', saveNewBook);
    }
    if (elements.importModal) {
        elements.importModal.addEventListener('click', (e) => {
            if (e.target === elements.importModal) {
                closeImportModal();
            }
        });
    }

    // Original listeners
    elements.backButton.addEventListener('click', goBack);
    elements.searchInput.addEventListener('input', filterBooks);
    elements.sortSelect.addEventListener('change', sortBooks);
    elements.closeModal.addEventListener('click', closeModal);
    elements.bookModal.addEventListener('click', (e) => {
        if (e.target === elements.bookModal) closeModal();
    });
    elements.editModal.addEventListener('click', (e) => {
        if (e.target === elements.editModal) closeEditModal();
    });
    elements.searchModal.addEventListener('click', (e) => {
        if (e.target === elements.searchModal) closeSearchModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeEditModal();
            closeSearchModal();
            closeViewer();
            closeImportModal(); // MODIFIED: Also close import modal on escape
        }
    });
    const autorInput = document.getElementById('searchAutorInput');
    const autorSelect = document.getElementById('searchAutor');
    if(autorInput && autorSelect) {
        autorInput.addEventListener('input', () => {
            const val = normalizeText(autorInput.value);
            const filtered = !val ? (window._allAuthors || []) : (window._allAuthors || []).filter(a => normalizeText(a).includes(val));
            autorSelect.innerHTML = '<option value="">Todos los autores</option>' + filtered.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
        });
        autorSelect.addEventListener('change', () => { autorInput.value = autorSelect.value; });
    }
    const generoInput = document.getElementById('searchGeneroInput');
    const generoSelect = document.getElementById('searchGenero');
    if(generoInput && generoSelect) {
        generoInput.addEventListener('input', () => {
            const val = normalizeText(generoInput.value);
            const filtered = !val ? (window._allGenres || []) : (window._allGenres || []).filter(g => normalizeText(g).includes(val));
            generoSelect.innerHTML = '<option value="">Todos los géneros</option>' + filtered.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
        });
        generoSelect.addEventListener('change', () => { generoInput.value = generoSelect.value; });
    }
    elements.aiDescriptionButton.addEventListener('click', async () => {
        if (currentEditingBook) {
            const description = await generateAiDescription(currentEditingBook.titulo, currentEditingBook.autor);
            if (description) {
                document.getElementById('editDescripcion').value = description;
            }
        }
    });

    // Header pinning logic
    if (elements.pinHeaderButton && elements.header) {
        elements.pinHeaderButton.addEventListener('click', toggleHeaderPin);
        // Apply initial state on load
        const isPinned = localStorage.getItem('headerPinned') === 'true';
        applyHeaderPinState(isPinned);
    }
}
