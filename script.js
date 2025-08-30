// Supabase configuration
        const { createClient } = supabase;
        const supabaseUrl = 'https://fanyuclarbgwraiwbcmr.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbnl1Y2xhcmJnd3JhaXdiY21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTczMzIsImV4cCI6MjA3MTYzMzMzMn0.AzELqTp0swLGcUxHqF_E7E6UZJcEKUdNcXFiPrMGr-Q';
        const supabaseClient = createClient(supabaseUrl, supabaseKey);

        // !!! IMPORTANTE: Reemplaza esta URL con la URL de tu propio proxy de Gemini desplegado. !!!
        // Puedes usar un servicio como Vercel para desplegar un proxy simple.
        const GEMINI_PROXY_URL = 'https://your-gemini-proxy-url.vercel.app/api/proxy'; 

        // Utility functions
        function esc(s) {
            return String(s || '')
                .replace(/&/g,'&amp;').replace(/</g,'&lt;')
                .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
        }

        function resolveCoverThumb(urlPortada) {
            if (!urlPortada) return '';
            const m = urlPortada.match(/\/d\/([^/]+)\//);
            const id = m ? m[1] : null;
            if (!id) return urlPortada;
            return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
        }

        function openClassificationEditor() {
            window.open('editor-clasificacion-visual.html', '_blank');
        }

        // Global variables
        let allBooks = [];
        let allFormats = [];
        let currentSection = null;
        let currentSubsection = null;
        let filteredBooks = [];
        let currentBooks = [];
        let currentEditingBook = null;
        let classification = null; 
        let currentObjectUrl = null; // For the book viewer

        // DOM elements
        const elements = {
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
            aiDescriptionButton: document.getElementById('aiDescriptionButton'), // New element reference
            adminControls: document.getElementById('adminControls'),
            searchModal: document.getElementById('searchModal')
        };

        // Initialize app
        document.addEventListener('DOMContentLoaded', async () => {
            await loadData();
            await loadClassification();
            await sincronizarClasificacion();
            populateSearchFilters();
            showSections();
            setupEventListeners();
        });

        // Data loading
        async function loadData() {
            try {
                elements.loading.style.display = 'flex';
                const { data: booksData, error: booksError } = await supabaseClient.from('books').select('*').order('titulo');
                if (booksError) throw booksError;
                allBooks = booksData || [];

                const { data: formatsData, error: formatsError } = await supabaseClient.from('book_formats').select('*');
                if (formatsError) throw formatsError;
                allFormats = formatsData || [];

                elements.totalBooks.textContent = allBooks.length;
                elements.totalFormats.textContent = allFormats.length;
                const uniqueAuthors = new Set(allBooks.map(b => (b.autor || '').trim()).filter(Boolean));
                document.getElementById('totalAuthors').textContent = uniqueAuthors.size;
                elements.loading.style.display = 'none';
            } catch (error) {
                console.error('Error loading data:', error);
                elements.loading.innerHTML = '❌ Error al cargar los datos';
            }
        }

        async function loadClassification() {
            try {
                const { data, error } = await supabaseClient.from('clasificacion').select('data').limit(1).single();
                if (error) throw error;
                classification = data.data;
            } catch (error) {
                console.error('Error loading classification:', error);
            }
        }

        // Business Logic
        function normalizeText(str) {
            if (typeof str !== 'string') return '';
            return str.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }

        function isBookInAnySubsection(book, classification) {
            const bookTags = (book.genero || '').split(',').map(normalizeText).filter(Boolean);
            if (bookTags.length === 0) return false;
            for (const sectionKey in classification.sections) {
                const section = classification.sections[sectionKey];
                for (const subKey in section.subsections) {
                    const subsection = section.subsections[subKey];
                    const subsectionTags = (subsection.tags || []).map(normalizeText);
                    if (subsectionTags.some(tag => bookTags.includes(tag))) {
                        return true;
                    }
                }
            }
            return false;
        }

        async function sincronizarClasificacion() {
            if (!allBooks.length || !classification) return;
            const updates = [];
            for (const book of allBooks) {
                const bookTags = (book.genero || '').split(',').map(t => t.trim()).filter(Boolean);
                const normalizedBookTags = bookTags.map(normalizeText);
                const tieneTagSinClasificar = normalizedBookTags.includes(normalizeText('Sin_clasificar'));
                const estaRealmenteClasificado = isBookInAnySubsection(book, classification);
                let nuevoGenero = null;
                if (estaRealmenteClasificado && tieneTagSinClasificar) {
                    const tagsFiltrados = bookTags.filter(tag => normalizeText(tag) !== normalizeText('Sin_clasificar'));
                    nuevoGenero = tagsFiltrados.join(', ');
                } else if (!estaRealmenteClasificado && !tieneTagSinClasificar) {
                    const tagsNuevos = [...bookTags, 'Sin_clasificar'];
                    nuevoGenero = tagsNuevos.join(', ');
                }
                if (nuevoGenero !== null) {
                    updates.push({ ...book, genero: nuevoGenero });
                    book.genero = nuevoGenero;
                }
            }
            if (updates.length > 0) {
                await supabaseClient.from('books').upsert(updates);
            }
        }

        // AI Description Function
        async function generateAiDescription(title, author) {
            const prompt = `Dame una breve descripción en formato Markdown del libro: "${title}" del autor: "${author}".`;
            try {
                const response = await fetch(GEMINI_PROXY_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ prompt: prompt }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Error del proxy: ${response.status} - ${errorText}`);
                }

                const data = await response.json();
                if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
                    throw new Error('La respuesta de la IA no tiene el formato esperado.');
                }
                return data.choices[0].message.content;

            } catch (error) {
                console.error('Error al generar descripción con IA:', error);
                alert(`Error al generar descripción con IA: ${error.message}. Asegúrate de que el proxy de Gemini está configurado correctamente.`);
                return ''; // Return empty string on error
            }
        }

        // Search & Filter
        function populateSearchFilters() {
            if (!allBooks || allBooks.length === 0) return;
            const authors = [...new Set(allBooks.map(book => book.autor).filter(Boolean))].sort();
            const genres = [...new Set(allBooks.flatMap(book => (book.genero || '').split(',').map(g => g.trim()).filter(Boolean)))].sort();
            const series = [...new Set(allBooks.map(book => book.serie).filter(Boolean))].sort();
            const editorials = [...new Set(allBooks.map(book => book.editorial).filter(Boolean))].sort();
            const years = [...new Set(allBooks.map(book => (book.fecha_publicacion || '').slice(0, 4)).filter(y => /^\d{4}$/.test(y)))].sort().reverse();
            const formats = [...new Set(allFormats.map(f => f.formato))].sort();
            window._allAuthors = authors;
            window._allGenres = genres;
            populateSelect('searchAutor', authors);
            populateSelect('searchGenero', genres);
            populateSelect('searchSerie', series);
            populateSelect('searchEditorial', editorials);
            populateSelect('searchYear', years);
            populateSelect('searchFormato', formats);
        }

        function populateSelect(selectId, options) {
            const select = document.getElementById(selectId);
            select.innerHTML = '<option value="">Todos</option>';
            options.forEach(option => {
                const opt = document.createElement('option');
                opt.value = opt.textContent = option;
                select.appendChild(opt);
            });
        }

        function performSearch() {
            const query = normalizeText(document.getElementById('searchQuery').value);
            const includeDescription = document.getElementById('includeDescription').checked;
            const autor = document.getElementById('searchAutor').value;
            const genero = document.getElementById('searchGenero').value;
            const serie = document.getElementById('searchSerie').value;
            const editorial = document.getElementById('searchEditorial').value;
            const year = document.getElementById('searchYear').value;
            const formato = document.getElementById('searchFormato').value;

            const results = allBooks.filter(book => {
                const bookYear = (book.fecha_publicacion || '').slice(0, 4);
                const searchableText = [book.titulo, book.autor, book.genero, book.serie, book.editorial, getBookFormats(book.id).map(f => f.formato).join(' ')].filter(Boolean).map(normalizeText).join(' ');
                return (!query || searchableText.includes(query) || (includeDescription && normalizeText(book.descripcion).includes(query))) &&
                       (!autor || book.autor === autor) &&
                       (!genero || (book.genero || '').split(',').map(g => g.trim()).includes(genero)) &&
                       (!serie || book.serie === serie) &&
                       (!editorial || book.editorial === editorial) &&
                       (!year || bookYear === year) &&
                       (!formato || getBookFormats(book.id).some(f => f.formato === formato));
            });
            renderSearchResults(results);
        }

        function filterBooks() {
            const searchTerm = normalizeText(elements.searchInput.value);
            currentBooks = !searchTerm ? [...filteredBooks] : filteredBooks.filter(book => {
                const searchableText = [book.titulo, book.autor, book.genero, book.serie, book.editorial].filter(Boolean).map(normalizeText).join(' ');
                return searchableText.includes(searchTerm);
            });
            sortBooks();
        }

        function sortBooks() {
            const sortBy = elements.sortSelect.value;
            currentBooks.sort((a, b) => {
                switch (sortBy) {
                    case 'author': return (a.autor || '').localeCompare(b.autor || '');
                    case 'year': return (b.fecha_publicacion || '0').localeCompare(a.fecha_publicacion || '0');
                    default: return (a.titulo || '').localeCompare(b.titulo || '');
                }
            });
            renderBooks();
        }

        // Rendering
        function renderBooks() {
            elements.booksGrid.innerHTML = currentBooks.length > 0 ? currentBooks.map(renderBook).join('') : '<div class="empty-state"><h3>No se encontraron libros</h3></div>';
        }
        
        function renderSearchResults(results) {
            const container = document.getElementById('searchResults');
            if (results.length === 0) {
                container.innerHTML = '<div class="empty-state"><h3>No se encontraron libros</h3></div>';
                return;
            }
            container.innerHTML = `<h3 style="margin-bottom: 16px;">${results.length} libro(s) encontrado(s)</h3><div class="grid grid--books">${results.map(renderBook).join('')}</div>`;
        }

        function renderBook(book) {
            const formats = getBookFormats(book.id);
            const genres = (book.genero || '').split(',').map(g => g.trim()).filter(Boolean);
            const portadaSrc = resolveCoverThumb(book.url_portada);
            return `
                <div class="book-card" onclick="showBookDetails(${book.id})">
                    <div class="book-cover-wrap">
                        <a href="${esc(book.url_portada || '#')}" target="_blank" rel="noopener" onclick="event.stopPropagation();">
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
                        <div class="book-formats">${formats.map(f => `<span class="format-badge">${esc(f.formato)}</span>`).join('')}</div>
                    </div>
                </div>`;
        }

        // UI Navigation
        function showSections() {
            hideAllViews();
            elements.sectionsView.classList.add('active');
            elements.backButton.style.display = 'none';
            elements.searchContainer.style.display = 'none';
            elements.adminControls.style.display = 'flex';
            updateBreadcrumb([]);
            const sectionEntries = Object.entries(classification.sections).map(([key, section]) => ({ key, section, bookCount: countBooksForSection(key) })).sort((a, b) => b.bookCount - a.bookCount);
            elements.sectionsGrid.innerHTML = sectionEntries.map(({ key, section, bookCount }) => `
                <div class="section-card" onclick="showSubsections('${key}')">
                    <img class="section-cover" src="biblioteca.jpg" alt="Sección ${esc(section.name)}">
                    <div class="section-content">
                        <div class="section-title">${esc(section.name)}</div>
                        <div class="section-count">${bookCount} libro(s)</div>
                        <div class="section-subtitle">${Object.keys(section.subsections).length} subsecciones</div>
                    </div>
                </div>`).join('');
        }

        function showSubsections(sectionKey) {
            currentSection = sectionKey;
            const section = classification.sections[sectionKey];
            hideAllViews();
            elements.subsectionsView.classList.add('active');
            elements.backButton.style.display = 'block';
            updateBreadcrumb([section.name]);
            const subsectionEntries = Object.entries(section.subsections).map(([key, subsection]) => ({ key, subsection, bookCount: countBooksForSubsection(sectionKey, key) })).sort((a, b) => b.bookCount - a.bookCount);
            elements.subsectionsGrid.innerHTML = subsectionEntries.map(({ key, subsection, bookCount }) => `
                <div class="section-card" onclick="showBooks('${sectionKey}', '${key}')">
                     <img class="section-cover" src="biblioteca.jpg" alt="Subsección ${esc(subsection.name)}">
                    <div class="section-content">
                        <div class="section-title">${esc(subsection.name)}</div>
                        <div class="section-count">${bookCount} libro(s)</div>
                        <div class="section-subtitle">${subsection.tags.slice(0, 3).map(tag => esc(tag)).join(', ')}...</div>
                    </div>
                </div>`).join('');
        }

        function showBooks(sectionKey, subsectionKey) {
            currentSection = sectionKey;
            currentSubsection = subsectionKey;
            const subsection = classification.sections[sectionKey].subsections[subsectionKey];
            hideAllViews();
            elements.booksView.classList.add('active');
            elements.backButton.style.display = 'block';
            elements.searchContainer.style.display = 'flex';
            updateBreadcrumb([classification.sections[sectionKey].name, subsection.name]);
            filteredBooks = filterBooksByTags(subsection.tags);
            currentBooks = [...filteredBooks];
            renderBooks();
        }

        function goBack() {
            if (elements.booksView.classList.contains('active')) {
                showSubsections(currentSection);
            } else if (elements.subsectionsView.classList.contains('active')) {
                showSections();
            }
        }

        function hideAllViews() {
            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        }

        function updateBreadcrumb(path) {
            elements.breadcrumb.innerHTML = path.length === 0 ? '' : path.map((item, index) => `<span class="breadcrumb-item">${esc(item)}</span>`).join('<span class="breadcrumb-separator"> › </span>');
        }

        // Modal Handling
        function showBookDetails(bookId) {
            const book = allBooks.find(b => b.id === bookId);
            if (!book) return;
            const formats = getBookFormats(bookId);
            const genres = (book.genero || '').split(',').map(g => g.trim()).filter(Boolean);
            const portadaSrc = resolveCoverThumb(book.url_portada);
            const modalHtml = `
                <div class="modal-book">
                    <div class="modal-cover"><img src="${esc(portadaSrc)}" alt="Portada de ${esc(book.titulo)}" onerror="this.style.display='none'; this.parentElement.innerHTML='📖';"></div>
                    <div class="modal-info">
                        <h2>${esc(book.titulo)}</h2>
                        <p><strong>Autor:</strong> ${esc(book.autor || 'Desconocido')}</p>
                        ${book.serie ? `<p><strong>Serie:</strong> ${esc(book.serie)}${book.numero_serie ? ` #${book.numero_serie}` : ''}</p>` : ''}
                        <p><strong>Géneros:</strong> ${genres.join(', ') || 'Sin especificar'}</p>
                    </div>
                </div>
                ${book.descripcion ? `<div class="modal-description"><h3>Descripción</h3><div class="description-content">${marked.parse(book.descripcion || '')}</div></div>` : ''}
                <div class="modal-formats">${formats.map(f => `<a href="#" onclick="openViewer(event, '${esc(f.url_download || f.ruta_archivo)}', '${esc(book.titulo)}', '${esc(f.formato)}')" class="format-link">📄 ${esc(f.formato)}</a>`).join('')}</div>
                <div class="modal-footer"><button type="button" class="btn btn--success" onclick="showEditModal(${book.id})">✏️ Editar</button></div>`;
            elements.modalContent.innerHTML = modalHtml;
            elements.bookModal.classList.add('show');
        }

        function showEditModal(bookId) {
            const book = allBooks.find(b => b.id === bookId);
            if (!book) return;
            currentEditingBook = book;
            const form = document.getElementById('editForm');
            form.elements.editTitulo.value = book.titulo || '';
            form.elements.editAutor.value = book.autor || '';
            form.elements.editGenero.value = book.genero || '';
            form.elements.editSerie.value = book.serie || '';
            form.elements.editNumeroSerie.value = book.numero_serie || '';
            form.elements.editEditorial.value = book.editorial || '';
            form.elements.editFechaPublicacion.value = book.fecha_publicacion || '';
            form.elements.editDescripcion.value = book.descripcion || '';
            form.elements.editCarpetaObra.value = book.carpeta_obra || '';
            elements.editModal.classList.add('show');
        }

        async function saveBookChanges() {
            if (!currentEditingBook) return;
            const form = document.getElementById('editForm');
            const updatedData = {
                titulo: form.elements.editTitulo.value.trim(),
                autor: form.elements.editAutor.value.trim() || null,
                genero: form.elements.editGenero.value.trim() || null,
                serie: form.elements.editSerie.value.trim() || null,
                numero_serie: form.elements.editNumeroSerie.value.trim() || null,
                editorial: form.elements.editEditorial.value.trim() || null,
                fecha_publicacion: form.elements.editFechaPublicacion.value || null,
                descripcion: form.elements.editDescripcion.value.trim() || null,
                carpeta_obra: form.elements.editCarpetaObra.value.trim() || null
            };
            await supabaseClient.from('books').update(updatedData).eq('id', currentEditingBook.id);
            const bookIndex = allBooks.findIndex(b => b.id === currentEditingBook.id);
            if (bookIndex !== -1) {
                allBooks[bookIndex] = { ...allBooks[bookIndex], ...updatedData };
            }
            populateSearchFilters();
            closeEditModal();
        }

        function closeModal() { elements.bookModal.classList.remove('show'); }
        function closeEditModal() { elements.editModal.classList.remove('show'); }
        function openSearchModal() { elements.searchModal.classList.add('show'); }
        function closeSearchModal() { elements.searchModal.classList.remove('show'); }
        
        async function openViewer(event, formatUrl, bookTitle, formatName) {
            event.preventDefault();
            event.stopPropagation();
            if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
            const viewerModal = document.getElementById('viewerModal');
            const viewerIframe = document.getElementById('viewerIframe');
            const viewerTitle = document.getElementById('viewerTitle');
            const viewerDownloadLink = document.getElementById('viewerDownloadLink');
            viewerTitle.textContent = `Cargando: ${esc(bookTitle)}...`;
            viewerIframe.src = 'about:blank';
            viewerModal.style.display = 'flex';
            viewerDownloadLink.href = formatUrl;

            let embedUrl = formatUrl; // Default to original URL
            const googleDriveIdMatch = formatUrl.match(/id=([a-zA-Z0-9_-]+)/);
            if (googleDriveIdMatch && formatUrl.includes('drive.google.com')) {
                const fileId = googleDriveIdMatch[1];
                embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
                console.log(`Converted Google Drive URL to embed: ${embedUrl}`);
            } else {
                console.log(`Not a Google Drive URL or ID not found, attempting direct embed: ${embedUrl}`);
            }

            viewerIframe.src = embedUrl;
            viewerTitle.textContent = `${esc(bookTitle)} - ${esc(formatName)}`;

            viewerIframe.onerror = () => {
                viewerTitle.textContent = `Error al cargar ${esc(bookTitle)}`;
                viewerIframe.contentWindow.document.body.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;">
                    <h3>No se pudo cargar el libro para visualización</h3>
                    <p>Puede que el archivo no sea público o que Google Drive no permita la visualización directa.</p>
                    <p>Puedes intentar <a href="${formatUrl}" target="_blank" rel="noopener" style="color: #2563eb;">descargarlo directamente</a>.</p>
                </div>`;
            };
        }

        function closeViewer() {
            const viewerModal = document.getElementById('viewerModal');
            const viewerIframe = document.getElementById('viewerIframe');
            viewerIframe.src = 'about:blank';
            if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
            viewerModal.style.display = 'none';
        }

        // Helpers
        function getBookFormats(bookId) {
            return allFormats.filter(format => format.book_id === bookId);
        }

        function countBooksForSection(sectionKey) {
            const allTags = Object.values(classification.sections[sectionKey].subsections).flatMap(s => s.tags);
            return filterBooksByTags(allTags).length;
        }

        function countBooksForSubsection(sectionKey, subsectionKey) {
            return filterBooksByTags(classification.sections[sectionKey].subsections[subsectionKey].tags).length;
        }
        
        function filterBooksByTags(tags) {
            if (!tags || tags.length === 0) return [];
            const normalizedTags = tags.map(normalizeText);
            return allBooks.filter(book => {
                const bookGenres = (book.genero || '').split(',').map(g => normalizeText(g.trim()));
                return normalizedTags.some(tag => bookGenres.includes(tag));
            });
        }

        // Event Listeners
        function setupEventListeners() {
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
        }