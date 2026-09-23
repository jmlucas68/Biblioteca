// Supabase configuration
const { createClient } = supabase;
const supabaseUrl = ['https://fanyuclarbgwraiwbcmr', 'supabase.co'].join('.');
const key_part_1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
const key_part_2 = 'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbnl1Y2xhcmJnd3JhaXdiY21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTczMzIsImV4cCI6MjA3MTYzMzMzMn0';
const key_part_3 = 'AzELqTp0swLGcUxHqF_E7E6UZJcEKUdNcXFiPrMGr-Q';
const supabaseKey = `${key_part_1}.${key_part_2}.${key_part_3}`;
const supabaseClient = createClient(supabaseUrl, supabaseKey);

// !!! IMPORTANTE: Reemplaza esta URL con la URL de tu propio proxy de Gemini desplegado. !!!
// Puedes usar un servicio como Vercel para desplegar un proxy simple.
const isLocalDevelopment = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const PROXY_BASE_URL = isLocalDevelopment
    ? 'http://localhost:3000'
    : 'https://perplexity-proxy-backend.vercel.app';
const GEMINI_PROXY_URL = `${PROXY_BASE_URL}/api/proxy`;
const UPLOAD_URL = `${PROXY_BASE_URL}/api/upload`;
const REGISTER_DRIVE_FILE_URL = `${PROXY_BASE_URL}/api/register-drive-file`;
const DELETE_BOOK_FILES_URL = `${PROXY_BASE_URL}/api/delete-book-files`;
const BOOK_COVER_URL = `${PROXY_BASE_URL}/api/book-cover`;

// Lanzamiento reversible: una única nota general por libro. Usamos la tabla de
// anotaciones ya existente, con un ancla reservada, para no cambiar el esquema.
// Poner esta bandera a false oculta la función sin tocar las fichas de libros.
const BOOK_NOTES_ENABLED = true;
const BOOK_NOTE_ANCHOR = 'book:general-note';

async function loadBookNote(bookId) {
    try {
        const { data, error } = await supabaseClient
            .from('annotations')
            .select('id, note_content')
            .eq('book_id', bookId)
            .eq('cfi_range', BOOK_NOTE_ANCHOR)
            .maybeSingle();
        if (error) throw error;
        return data || null;
    } catch (error) {
        console.error('No se ha podido cargar la nota del libro.', error);
        throw new Error('No se ha podido cargar la nota del libro.');
    }
}

async function saveBookNote(bookId, currentNoteId, note) {
    try {
        if (!note && currentNoteId) {
            const { error } = await supabaseClient.from('annotations').delete().eq('id', currentNoteId);
            if (error) throw error;
            return null;
        }
        if (!note) return null;

        const payload = currentNoteId
            ? await supabaseClient.from('annotations').update({ note_content: note }).eq('id', currentNoteId).select('id, note_content').single()
            : await supabaseClient.from('annotations').insert([{
                book_id: bookId,
                cfi_range: BOOK_NOTE_ANCHOR,
                highlighted_text: '',
                color: 'yellow',
                note_content: note
            }]).select('id, note_content').single();
        if (payload.error) throw payload.error;
        return payload.data;
    } catch (error) {
        console.error('No se ha podido guardar la nota del libro.', error);
        throw new Error('No se ha podido guardar la nota del libro.');
    }
}

// --- Cookie Functions ---
function setCookie(name, value, days) {
    let expires = "";
    if (days) {
        const date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = "; expires=" + date.toUTCString();
    }
    document.cookie = name + "=" + (value || "")  + expires + "; path=/";
}

function getCookie(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for(let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) == ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
}

function deleteCookie(name) {
    document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

// Utility functions
function esc(s) {
    return String(s || '')
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function showLoginModal() {
    document.getElementById('securityModal').style.display = 'flex';
    const lastUserRole = getCookie('userRole');
    if (lastUserRole) {
        const radio = document.querySelector(`input[name="userType"][value="${lastUserRole}"]`);
        if (radio) {
            radio.checked = true;
        }
    }
}

function closeLoginModal() {
    document.getElementById('securityModal').style.display = 'none';
}

function logoff() {
    deleteCookie('isAdmin');
    deleteCookie('userRole'); // Delete userRole cookie
    deleteCookie('libraryAdminToken');
    isAdmin = false; // Update local state
    disableAdminFeatures(); // Immediately disable features
    showLoginModal(); // Show login modal after logoff
    // No need to reload, loadInitialData will be called after successful login
}

function hash(s){ let h=0; for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i); h|=0;} return String(Math.abs(h)); }

function extractDriveId(inputUrl) {
    if (!inputUrl) return null;
    const p = inputUrl.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (p?.[1]) return p[1];
    const d = inputUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)\//);
    return d?.[1] || null;
}

function resolveCoverThumb(urlPortada) {
    if (!urlPortada) return '';
    const id = extractDriveId(urlPortada);
    if (!id) return urlPortada;
    return `${PROXY_BASE_URL}/api/drive-proxy?id=${encodeURIComponent(id)}&inline=1`;
}

function openClassificationEditor() {
    window.open('editor-clasificacion-visual.html', '_blank');
}

function isHTML(str) {
    // Las descripciones importadas como HTML siempre se entregan dentro de un
    // <div>. También pueden llegar escapadas desde la base de datos.
    return typeof str === 'string' && /^\s*(?:<|&lt;)div(?:\s|>|&gt;)/i.test(str);
}

function decodeHtmlDescription(str) {
    // Si llega como &lt;div&gt;..., se decodifica antes de procesarla. Los estilos
    // inline vienen del sitio de origen y fuerzan fondo blanco y texto negro,
    // por lo que se eliminan para respetar el tema activo de la aplicación.
    const source = /^\s*</.test(str)
        ? str
        : new DOMParser().parseFromString(str, 'text/html').body.textContent || '';
    const doc = new DOMParser().parseFromString(source, 'text/html');
    doc.body.querySelectorAll('[style]').forEach(element => element.removeAttribute('style'));
    return doc.body.innerHTML;
}

async function enterAdminMode() {
    isAdmin = true;
    enableAdminFeatures();
    await loadInitialData();
}

async function enterReadOnlyMode() {
    isAdmin = false;
    disableAdminFeatures();
    await loadInitialData();
}

async function validatePassword() {
    const password = document.getElementById('passwordInput').value;
    const selectedUserType = document.querySelector('input[name="userType"]:checked').value; // Get selected user type

    try {
        const response = await fetch(GEMINI_PROXY_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'login', // New action for login
                userType: selectedUserType, // Send user type
                password: password
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error del proxy: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.success) { // Assuming backend returns { success: true, role: 'Lector'/'Bibliotecario' }
            closeLoginModal();
            setCookie('userRole', data.role, 7); // Set userRole cookie for 7 days
            if (data.role === 'Bibliotecario') {
                setCookie('isAdmin', 'true', 7); // Set cookie for 7 days
                if (data.adminToken) setCookie('libraryAdminToken', data.adminToken, 7);
                isAdmin = true;
                enableAdminFeatures();
            } else { // Lector
                deleteCookie('isAdmin'); // Ensure no admin cookie is set
                deleteCookie('libraryAdminToken');
                isAdmin = false;
                disableAdminFeatures();
            }
            
            // Load initial data and render UI based on the new role
            await loadInitialData(); // This will call showSections() internally

        } else {
            alert('Contraseña incorrecta o tipo de usuario inválido.');
        }
    } catch (error) {
        console.error('Error validating password:', error);
        alert('Error al validar la contraseña. Por favor, inténtalo de nuevo.');
    }
}

function disableAdminFeatures() {
    // Hide all admin-only buttons and controls
    document.querySelectorAll('.admin-control').forEach(button => {
        button.style.display = 'none';
    });

    // Configure the auth button for "Login"
    const authButton = document.getElementById('authButton');
    if (authButton) {
        authButton.innerHTML = '🔒 Login';
        authButton.onclick = showLoginModal;
        authButton.style.display = 'inline-flex';
    }
}

function enableAdminFeatures() {
    // Show all admin-only buttons and controls
    document.querySelectorAll('.admin-control').forEach(button => {
        button.style.display = 'inline-flex';
    });

    // Configure the auth button for "Logoff"
    const authButton = document.getElementById('authButton');
    if (authButton) {
        authButton.innerHTML = '🔒 Logoff';
        authButton.onclick = logoff;
        authButton.style.display = 'inline-flex';
    }
}

async function loadInitialData() {
    try {
        // Run data loading in parallel for efficiency
        await Promise.all([loadData(), loadClassification()]);

        // Add a critical check to ensure classification data is loaded
        if (!classification) {
            throw new Error("La clasificación de la biblioteca no pudo ser cargada. No se puede mostrar la interfaz.");
        }

        if(isAdmin) {
            await sincronizarClasificacion();
        }
        populateSearchFilters();
        showSections();
        setupEventListeners();
    } catch (error) {
        console.error("Error fatal durante la carga de datos inicial:", error);
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'flex'; // Make sure it's visible
            loadingElement.innerHTML = `⚠ Error: ${error.message}. Por favor, recarga la página.`;
        }
    }
}

// Global variables
let isAdmin = false;
let allBooks = [];
let allFormats = [];
let currentSection = null;
let currentSubsection = null;
let filteredBooks = [];
let currentBooks = [];
let currentEditingBook = null;
let classification = null; 
let currentObjectUrl = null; // For the book viewer
let tagFilterLogic = 'OR'; // New global variable for tag filtering logic
let selectedFileForImport = null;
const SUPPORTED_IMPORT_EXTENSIONS = new Set(['epub', 'mobi', 'pdf', 'azw3', 'cbr']);

// DOM elements
let elements = {};

function populateElements() {
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
        extractFileCoverButton: document.getElementById('extractFileCoverButton'),
        searchWebCoverButton: document.getElementById('searchWebCoverButton'),
        uploadCoverButton: document.getElementById('uploadCoverButton'),
        coverImageUploader: document.getElementById('coverImageUploader'),
        editCoverPreview: document.getElementById('editCoverPreview'),
        editCoverPlaceholder: document.getElementById('editCoverPlaceholder'),
        coverEditorStatus: document.getElementById('coverEditorStatus'),
        adminControls: document.getElementById('adminControls'),
        searchModal: document.getElementById('searchModal'),
        ebookImporter: document.getElementById('ebookImporter'),
        uploadStatus: document.getElementById('uploadStatus'),
        importModal: document.getElementById('importModal'),
        importForm: document.getElementById('importForm'),
        closeImportModal: document.querySelector('#importModal .close-button'),
        registerDriveButton: document.getElementById('registerDriveButton'),
        driveRegisterModal: document.getElementById('driveRegisterModal'),
        driveRegisterForm: document.getElementById('driveRegisterForm'),
        closeDriveRegisterModal: document.querySelector('#driveRegisterModal .close-button'),
        deleteBookModal: document.getElementById('deleteBookModal'),
        deleteBookDriveFiles: document.getElementById('deleteBookDriveFiles'),
        confirmDeleteBookButton: document.getElementById('confirmDeleteBookButton'),
        header: document.querySelector('.header'), // Add header element
        pinHeaderButton: document.getElementById('pinHeaderButton'), // Add pin button
    };
}


// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    populateElements(); // Populate elements object after DOM is loaded

    const passwordInput = document.getElementById('passwordInput');
    if (passwordInput) {
        passwordInput.addEventListener('keydown', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent any default action
                validatePassword();
            }
        });
    }

    // Theme switcher logic
    const darkModeToggle = document.getElementById('darkModeToggle');
    const currentTheme = localStorage.getItem('theme');

    if (currentTheme) {
        document.body.classList.toggle('light-mode', currentTheme === 'light');
        if (currentTheme === 'light') {
            darkModeToggle.checked = false;
        } else {
            darkModeToggle.checked = true;
        }
    } else {
        // Default to dark mode if no preference is saved
        darkModeToggle.checked = true;
    }

    darkModeToggle.addEventListener('change', function() {
        document.body.classList.toggle('light-mode', !this.checked);
        let theme = this.checked ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
    });

    const isAdminCookie = getCookie('isAdmin');
    const userRoleCookie = getCookie('userRole'); // Get the userRole cookie

    if (isAdminCookie === 'true') {
        // If admin cookie exists, enter admin mode directly
        await enterAdminMode();
    } else if (userRoleCookie === 'Lector') {
        // If Lector cookie exists, enter read-only mode directly
        await enterReadOnlyMode(); // This function already sets isAdmin = false and calls loadInitialData()
    } else {
        // If neither admin nor lector cookie exists, then show the login modal
        showLoginModal();
    }
});

// Data loading
function updateStats(books) {
    const bookIds = new Set(books.map(b => b.id));
    const relevantFormats = allFormats.filter(f => bookIds.has(f.book_id));
    const uniqueAuthors = new Set(books.map(b => (b.autor || '').trim()).filter(Boolean));

    elements.totalBooks.textContent = books.length;
    elements.totalFormats.textContent = relevantFormats.length;
    document.getElementById('totalAuthors').textContent = uniqueAuthors.size;
}

function updateGlobalStats() {
    updateStats(allBooks);
}

function getBooksForSection(sectionKey) {
    const section = classification.sections[sectionKey];
    if (!section) return [];
    const allTagsInSection = Object.values(section.subsections).flatMap(sub => sub.tags);
    const uniqueTags = [...new Set(allTagsInSection)];
    return filterBooksByTagsOR(uniqueTags);
}

async function loadData() {
    try {
        elements.loading.style.display = 'flex';
        const { data: booksData, error: booksError } = await supabaseClient.from('books').select('*').order('titulo');
        if (booksError) throw booksError;
        allBooks = booksData || [];

        // Supabase limita cada consulta a 1.000 filas. Cargar todas las
        // páginas garantiza que los formatos registrados recientemente también
        // aparezcan en las tarjetas de los libros.
        const pageSize = 1000;
        const formats = [];
        for (let from = 0; ; from += pageSize) {
            const { data: page, error: formatsError } = await supabaseClient
                .from('book_formats')
                .select('*')
                .order('id')
                .range(from, from + pageSize - 1);
            if (formatsError) throw formatsError;

            formats.push(...(page || []));
            if (!page || page.length < pageSize) break;
        }
        allFormats = formats;

        updateGlobalStats();
        elements.loading.style.display = 'none';
    } catch (error) {
        console.error('Error loading data:', error);
        elements.loading.innerHTML = '⚠ Error al cargar los datos';
    }
}

async function loadClassification() {
    try {
        const { data, error } = await supabaseClient.from('clasificacion').select('data').limit(1).single();
        if (error) {
            // Re-throw the specific Supabase error so the caller can see it
            throw error;
        }
        classification = data.data;
    } catch (error) {
        // Log the specific error and then throw a new, more informative error
        console.error('Error caught in loadClassification:', error);
        throw new Error(`Fallo al cargar la clasificación desde Supabase: ${error.message}`);
    }
}

// --- File Import ---
async function handleFileSelect(event) {
    const files = event.target.files;
    if (!files.length) {
        return;
    }
    selectedFileForImport = null;
    const file = files[0];
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!SUPPORTED_IMPORT_EXTENSIONS.has(extension)) {
        alert('Formato no compatible. Selecciona un archivo EPUB, MOBI, PDF, AZW3 o CBR.');
        event.target.value = '';
        return;
    }
    selectedFileForImport = file;
    const fileName = file.name.toLowerCase();

    // Get modal fields
    const modalTitle = document.getElementById('modalTitle');
    const modalAuthor = document.getElementById('modalAuthor');
    const modalCategory = document.getElementById('modalCategory');
    const modalDescription = document.getElementById('modalDescription');

    // Reset fields
    modalTitle.value = '';
    modalAuthor.value = '';
    modalCategory.value = '';
    modalDescription.value = '';

    // Show loading indicator while processing
    elements.loading.style.display = 'flex';
    elements.loading.textContent = 'Procesando metadatos...';

    try {
        // Pre-fill title with filename as a fallback
        modalTitle.value = file.name.replace(/\.[^/.]+$/, "");

        if (fileName.endsWith('.epub')) {
            if (typeof ePub === 'undefined') {
                 throw new Error('epub.js no está cargado.');
            }
            const arrayBuffer = await file.arrayBuffer();
            const book = ePub(arrayBuffer);
            const metadata = await book.loaded.metadata;
            if (metadata) {
                modalTitle.value = metadata.title || modalTitle.value;
                modalAuthor.value = metadata.creator || '';
                modalCategory.value = metadata.subject || '';
                modalDescription.value = metadata.description || '';
            }
            book.destroy();

        } else if (fileName.endsWith('.pdf')) {
            if (typeof pdfjsLib === 'undefined') {
                if (!window.pdfjsScriptLoading) {
                    window.pdfjsScriptLoading = true;
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    document.head.appendChild(script);
                    await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                } else {
                    await new Promise(resolve => {
                        const check = () => typeof pdfjsLib !== 'undefined' ? resolve() : setTimeout(check, 100);
                        check();
                    });
                }
            }
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            const { info } = await pdf.getMetadata();
            if (info) {
                modalTitle.value = info.Title || modalTitle.value;
                modalAuthor.value = info.Author || '';
                modalCategory.value = info.Keywords || '';
                modalDescription.value = info.Subject || '';
            }
        }
    } catch (error) {
        console.error('Error al extraer metadatos:', error);
        alert('No se pudieron extraer los metadatos del archivo. Por favor, ingréselos manualmente.');
    } finally {
        // Hide loading and show modal
        elements.loading.style.display = 'none';
        elements.loading.textContent = 'Cargando biblioteca...';
        elements.importModal.style.display = 'block';
        // Reset file input so the 'change' event fires again if the same file is selected
        event.target.value = '';
    }
}

async function saveNewBook(event) {
    event.preventDefault();
    if (!selectedFileForImport) {
        alert("No se ha seleccionado ningún archivo.");
        return;
    }

    const title = document.getElementById('modalTitle').value.trim();
    const author = document.getElementById('modalAuthor').value.trim();
    const category = document.getElementById('modalCategory').value.trim();
    const description = document.getElementById('modalDescription').value.trim();

    if (!title || !author || !category) {
        alert("Por favor, complete los campos Título, Autor y Categoría.");
        return;
    }

    // Show loading indicator
    elements.loading.style.display = 'flex';
    elements.loading.textContent = 'Subiendo fichero y guardando datos...';

    try {
        // 1. Upload the file to the backend proxy, which will upload to Google Drive
        const formData = new FormData();
        formData.append('ebook', selectedFileForImport);
        
        const uploadResponse = await fetch(UPLOAD_URL, { // UPLOAD_URL is defined at the top
            method: 'POST',
            body: formData,
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            throw new Error(`Error al subir el fichero: ${uploadResponse.status} - ${errorText}`);
        }

        const uploadResult = await uploadResponse.json();
        const viewUrl = uploadResult.viewUrl;
        const downloadUrl = uploadResult.downloadUrl;
        

        // 2. Prepare book data
        const newBookData = {
            titulo: title,
            autor: author,
            genero: category,
            descripcion: description,
            carpeta_obra: '.IMPORTADOS',
            tamanio_total: `${Math.round(selectedFileForImport.size / 1024)} KB`
        };

        // 3. Insert book data into Supabase
        const { data: insertedBook, error: bookError } = await supabaseClient
            .from('books')
            .insert([newBookData])
            .select()
            .single();

        if (bookError) {
            throw bookError;
        }

        // 4. Create the format entry with the real URLs from the upload
        const newFormat = {
            book_id: insertedBook.id,
            formato: selectedFileForImport.name.split('.').pop(),
            url: viewUrl,
            url_download: downloadUrl
        };
        
        const { error: formatError } = await supabaseClient.from('book_formats').insert([newFormat]);
        if (formatError) {
            console.warn("El libro se creó, pero hubo un error al añadir el formato:", formatError.message);
        } else {
            allFormats.push(newFormat);
        }

        // 5. Fire-and-forget request to extract cover
        extractAndSetCover(selectedFileForImport, insertedBook.id);

        // 6. Update local data and UI
        allBooks.push(insertedBook);
        updateGlobalStats();
        
        if (elements.booksView.classList.contains('active')) {
            applyTagFilters(classification.sections[currentSection].subsections[currentSubsection].tags);
        } else if (elements.subsectionsView.classList.contains('active')) {
            showSubsections(currentSection);
        } else {
            showSections();
        }

        alert(`¡Libro \"${title}\" añadido con éxito!`);
        closeImportModal();

    } catch (error) {
        console.error("Error al guardar el nuevo libro:", error);
        alert(`Error al guardar el libro: ${error.message}`);
    } finally {
        // Hide loading indicator
        elements.loading.style.display = 'none';
        elements.loading.textContent = 'Cargando biblioteca...';
    }
}

async function extractAndSetCover(file, bookId) {
    const fileName = file.name.toLowerCase();
    let coverImageBlob = null;

    try {
        // --- PDF Cover Extraction ---
        if (fileName.endsWith('.pdf')) {
            console.log('Extrayendo portada de PDF...');
            if (typeof pdfjsLib === 'undefined') {
                if (!window.pdfjsScriptLoading) {
                    window.pdfjsScriptLoading = true;
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
                    document.head.appendChild(script);
                    await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
                    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                } else {
                    await new Promise(resolve => {
                        const check = () => typeof pdfjsLib !== 'undefined' ? resolve() : setTimeout(check, 100);
                        check();
                    });
                }
            }
            
            const dataURLtoBlob = (dataurl) => {
                const arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1];
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while(n--) u8arr[n] = bstr.charCodeAt(n);
                return new Blob([u8arr], {type:mime});
            };

            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
            if (pdf.numPages === 0) throw new Error('El PDF no tiene páginas.');
            
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 1.5 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;
            
            const coverImageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
            coverImageBlob = dataURLtoBlob(coverImageDataUrl);

        // --- EPUB Cover Extraction ---
        } else if (fileName.endsWith('.epub')) {
            console.log('Extrayendo portada de EPUB...');
            if (typeof ePub === 'undefined') {
                 throw new Error('epub.js no está cargado. Asegúrate de que esté incluido en index.html');
            }
            const arrayBuffer = await file.arrayBuffer();
            const book = ePub(arrayBuffer);
            const coverUrl = await book.coverUrl();
            
            if (!coverUrl) {
                console.warn('El EPUB no parece tener una portada definida.');
                return;
            }
            
            // Fetch the blob URL to get the actual image data
            const response = await fetch(coverUrl);
            coverImageBlob = await response.blob();
            book.destroy(); // Clean up memory

        // --- CBR Cover Extraction ---
        } else if (fileName.endsWith('.cbr')) {
            console.log('Extrayendo portada de CBR...');
            const [{ createExtractorFromData }, wasmResponse] = await Promise.all([
                import('./vendor/node-unrar-js/index.esm.js'),
                fetch('./vendor/node-unrar-js/js/unrar.wasm')
            ]);
            if (!wasmResponse.ok) throw new Error('No se pudo iniciar el descompresor CBR.');
            const extractor = await createExtractorFromData({
                data: await file.arrayBuffer(),
                wasmBinary: await wasmResponse.arrayBuffer()
            });
            const imagePattern = /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i;
            const archive = extractor.extract({ files: header => !header.flags.directory && imagePattern.test(header.name) });
            const pages = [...archive.files]
                .filter(page => page.extraction && imagePattern.test(page.fileHeader.name))
                .sort((a, b) => a.fileHeader.name.localeCompare(b.fileHeader.name, 'es', { numeric: true, sensitivity: 'base' }));
            if (!pages.length) throw new Error('El CBR no contiene imágenes compatibles.');
            const extension = pages[0].fileHeader.name.split('.').pop().toLowerCase();
            const mimeType = ({ avif:'image/avif', bmp:'image/bmp', gif:'image/gif', jpeg:'image/jpeg', jpg:'image/jpeg', png:'image/png', webp:'image/webp' })[extension] || 'image/jpeg';
            coverImageBlob = new Blob([pages[0].extraction], { type: mimeType });

        } else {
            console.log(`El archivo no es un PDF, EPUB o CBR (${fileName}), se omitirá la extracción de portada.`);
            return;
        }

        if (!coverImageBlob) {
            console.warn('No se pudo extraer la portada del archivo.');
            return;
        }

        // --- Common Upload Logic ---
        console.log('Subiendo portada extraída...');
        const originalFilename = file.name.replace(/\.[^/.]+$/, "");
        const coverFilename = `${originalFilename}.jpg`;

        const formData = new FormData();
        formData.append('ebook', coverImageBlob, coverFilename);
        formData.append('bookId', bookId);

        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            body: formData,
        });

        if (response.ok) {
            const result = await response.json();
            console.log('Subida de portada exitosa:', result.viewUrl);

            const { error: updateError } = await supabaseClient
                .from('books')
                .update({ 
                    url_portada: result.viewUrl,
                    url_download_portada: result.downloadUrl || result.viewUrl
                })
                .eq('id', bookId);

            if (updateError) {
                console.warn('Error al guardar la URL de la portada en la base de datos:', updateError.message);
            } else {
                 console.log('URL de portada guardada en la base de datos.');
            }

            const bookIndex = allBooks.findIndex(b => b.id === bookId);
            if (bookIndex !== -1) {
                allBooks[bookIndex].url_portada = result.viewUrl;
            }
        } else {
            const errorText = await response.text();
            console.warn('La subida de la portada falló:', errorText);
        }
    } catch (error) {
        console.error('Error durante la extracción de portada en el cliente:', error);
    }
}


function closeImportModal() {
    elements.importModal.style.display = 'none';
    elements.importForm.reset();
    selectedFileForImport = null;
}

function openDriveRegisterModal() {
    elements.driveRegisterForm.reset();
    elements.driveRegisterModal.style.display = 'block';
}

function closeDriveRegisterModal() {
    elements.driveRegisterModal.style.display = 'none';
    elements.driveRegisterForm.reset();
}

function refreshLibraryAfterImport(book, format) {
    allBooks.push(book);
    allFormats.push(format);
    updateGlobalStats();
    if (elements.booksView.classList.contains('active')) {
        applyTagFilters(classification.sections[currentSection].subsections[currentSubsection].tags);
    } else if (elements.subsectionsView.classList.contains('active')) {
        showSubsections(currentSection);
    } else {
        showSections();
    }
}

async function registerDriveFile(event) {
    event.preventDefault();
    const fileUrl = document.getElementById('driveFileUrl').value.trim();
    const title = document.getElementById('driveTitle').value.trim();
    const author = document.getElementById('driveAuthor').value.trim();
    const category = document.getElementById('driveCategory').value.trim();
    const description = document.getElementById('driveDescription').value.trim();

    if (!fileUrl || !title || !author || !category) {
        alert('Por favor, complete el enlace, título, autor y categoría.');
        return;
    }

    elements.loading.style.display = 'flex';
    elements.loading.textContent = 'Validando y moviendo el archivo de Drive...';
    try {
        const response = await fetch(REGISTER_DRIVE_FILE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileUrl })
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'No se pudo registrar el archivo de Drive.');

        const { data: existingFormat, error: existingFormatError } = await supabaseClient
            .from('book_formats')
            .select('id')
            .eq('url_download', result.downloadUrl)
            .limit(1);
        if (existingFormatError) throw existingFormatError;
        if (existingFormat && existingFormat.length) {
            throw new Error('Este archivo de Drive ya está registrado en la biblioteca.');
        }

        const newBookData = {
            titulo: title,
            autor: author,
            genero: category,
            descripcion: description,
            carpeta_obra: '.IMPORTADOS',
            url_portada: result.coverViewUrl || null,
            url_download_portada: result.coverDownloadUrl || null,
            tamanio_total: result.size ? `${Math.round(Number(result.size) / 1024)} KB` : null
        };
        const { data: insertedBook, error: bookError } = await supabaseClient
            .from('books')
            .insert([newBookData])
            .select()
            .single();
        if (bookError) throw bookError;

        const extension = (result.name || '').split('.').pop().toUpperCase() || 'ARCHIVO';
        const newFormat = {
            book_id: insertedBook.id,
            formato: extension,
            url: result.viewUrl,
            url_download: result.downloadUrl
        };
        const { error: formatError } = await supabaseClient.from('book_formats').insert([newFormat]);
        if (formatError) throw formatError;

        refreshLibraryAfterImport(insertedBook, newFormat);
        alert(`¡${result.name} se ha registrado y movido a la biblioteca!`);
        closeDriveRegisterModal();
    } catch (error) {
        console.error('Error al registrar el archivo de Drive:', error);
        alert(`Error al registrar el archivo de Drive: ${error.message}`);
    } finally {
        elements.loading.style.display = 'none';
        elements.loading.textContent = 'Cargando biblioteca...';
    }
}

// Sugiere las categorías ya utilizadas y permite crear una nueva desde el mismo campo.
function setupCategoryAutocomplete() {
    const input = document.getElementById('modalCategory');
    const datalist = document.getElementById('bookCategories');
    if (!input || !datalist || input.dataset.autocompleteReady) return;
    const createPrefix = 'Crear nueva categoría: ';
    const refreshOptions = () => {
        const parts = input.value.split(',');
        const currentPart = parts.pop().trim();
        const typed = currentPart.toLocaleLowerCase();
        const previousCategories = parts.map(category => category.trim()).filter(Boolean);
        input.dataset.categoryPrefix = previousCategories.length ? `${previousCategories.join(', ')}, ` : '';
        const categories = [...new Set(allBooks.flatMap(book =>
            String(book.genero || '').split(',').map(category => category.trim()).filter(Boolean)
        ))].sort((a, b) => a.localeCompare(b, 'es'));
        datalist.replaceChildren(...categories
            .filter(category => !typed || category.toLocaleLowerCase().includes(typed))
            .map(category => Object.assign(document.createElement('option'), {
                value: `${previousCategories.length ? `${previousCategories.join(', ')}, ` : ''}${category}`
            })));
        if (typed && !categories.some(category => category.toLocaleLowerCase() === typed)) {
            datalist.appendChild(Object.assign(document.createElement('option'), {
                value: `${createPrefix}${previousCategories.length ? `${previousCategories.join(', ')}, ` : ''}${currentPart}`
            }));
        }
    };
    input.addEventListener('focus', refreshOptions);
    input.addEventListener('input', refreshOptions);
    input.addEventListener('change', () => {
        if (input.value.startsWith(createPrefix)) {
            const proposed = input.value.slice(createPrefix.length).split(',').pop().trim();
            const name = window.prompt('Nombre de la nueva categoría:', proposed);
            const previous = input.dataset.categoryPrefix || '';
            input.value = name ? `${previous} ${name.trim()}` : previous.trim();
            refreshOptions();
        } else if (input.value.includes(',')) {
            // Al elegir una sugerencia, conserva las categorías ya introducidas.
            const parts = input.value.split(',');
            const selected = parts.pop().trim();
            input.value = `${parts.filter(part => part.trim()).join(',')}${parts.length ? ', ' : ''}${selected}`;
        }
    });
    input.dataset.autocompleteReady = 'true';
    refreshOptions();
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
            if (normalizeText(subsection.name) === normalizeText('Sin clasificar')) {
                continue;
            }
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
    if (!title || !author) {
        alert('El libro debe tener título y autor para generar una descripción.');
        return '';
    }
    const prompt = `Dame un resumen detallado de la obra \"${title}\" del autor \"${author}\" en formato Markdown, incluyendo los puntos clave de la trama, los temas principales y el estilo literario.`;
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
        // The proxy normally returns an OpenAI-compatible response, while
        // local/proxy versions may return Gemini's native candidates shape.
        const description = data.choices?.[0]?.message?.content
            || data.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
        if (!description) {
            throw new Error('La respuesta de la IA no tiene el formato esperado.');
        }
        return description;

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
    populateDatalist('genreSuggestions', window._allGenres);
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

function populateDatalist(datalistId, options) {
    const datalist = document.getElementById(datalistId);
    if (!datalist) {
        console.warn(`Datalist con ID '${datalistId}' no encontrado.`);
        return;
    }
    datalist.innerHTML = ''; // Clear existing options
    options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option;
        datalist.appendChild(opt);
    });
}

function clearSearch() {
    document.getElementById('searchQuery').value = '';
    document.getElementById('includeDescription').checked = false;
    document.getElementById('searchAutor').value = '';
    document.getElementById('searchGenero').value = '';
    document.getElementById('searchSerie').value = '';
    document.getElementById('searchEditorial').value = '';
    document.getElementById('searchYear').value = '';
    document.getElementById('searchFormato').value = '';
    document.getElementById('searchResults').innerHTML = '';
    
    const autorInput = document.getElementById('searchAutorInput');
    const generoInput = document.getElementById('searchGeneroInput');
    if (autorInput) autorInput.value = '';
    if (generoInput) generoInput.value = '';

    if (window._allAuthors) populateSelect('searchAutor', window._allAuthors);
    if (window._allGenres) populateSelect('searchGenero', window._allGenres);
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

function showRecentlyAddedBooks() {
    const maximumBooks = 10;
    const getAddedAt = (book) => {
        const timestamp = Date.parse(book.created_at || '');
        // Las bibliotecas anteriores a la columna created_at conservan el
        // identificador autoincremental, que también refleja el alta.
        return Number.isNaN(timestamp) ? Number(book.id) || 0 : timestamp;
    };

    const recentBooks = [...allBooks]
        .sort((first, second) => getAddedAt(second) - getAddedAt(first))
        .slice(0, maximumBooks);

    renderSearchResults(recentBooks, 'Últimos 10 libros añadidos');
}

async function showRecentlyReadBooks() {
    const container = document.getElementById('searchResults');
    const button = document.getElementById('recentlyReadButton');
    const maximumBooks = 10;
    const pageSize = 1000;
    const recentBooks = [];
    const seenBookIds = new Set();
    const booksByAnnotationId = buildAnnotationBookLookup();

    try {
        if (button) button.disabled = true;
        container.innerHTML = '<div class="loading" style="display: flex;">Buscando últimos libros leídos...</div>';

        // updated_at representa la última actividad: se inicializa al crear un
        // remarcado o nota de texto y se actualiza con cada modificación.
        // Se recorren las páginas necesarias porque un libro puede tener varias
        // anotaciones recientes.
        for (let from = 0; recentBooks.length < maximumBooks; from += pageSize) {
            const { data: annotations, error } = await supabaseClient
                .from('annotations')
                .select('book_id, updated_at')
                .order('updated_at', { ascending: false })
                .range(from, from + pageSize - 1);
            if (error) throw error;

            for (const annotation of annotations || []) {
                const book = booksByAnnotationId.get(String(annotation.book_id));
                if (!book || seenBookIds.has(String(book.id))) continue;

                seenBookIds.add(String(book.id));
                recentBooks.push(book);
                if (recentBooks.length === maximumBooks) break;
            }

            if (!annotations || annotations.length < pageSize) break;
        }

        renderSearchResults(recentBooks, 'Últimos libros leídos');
    } catch (error) {
        console.error('No se han podido cargar los últimos libros leídos:', error);
        container.innerHTML = '<div class="empty-state"><h3>No se han podido cargar los últimos libros leídos</h3></div>';
    } finally {
        if (button) button.disabled = false;
    }
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

function renderSearchResults(results, heading = null) {
    const container = document.getElementById('searchResults');
    if (results.length === 0) {
        container.innerHTML = heading
            ? `<div class="empty-state"><h3>No hay libros leídos con anotaciones</h3></div>`
            : '<div class="empty-state"><h3>No se encontraron libros</h3></div>';
        return;
    }
    const title = heading || `${results.length} libro(s) encontrado(s)`;
    container.innerHTML = `<h3 style="margin-bottom: 16px;">${title}</h3><div class="grid grid--books">${results.map(renderBook).join('')}</div>`;
}

function renderFormatLinks(format, bookTitle, detailed = false) {
    const downloadUrl = format.url_download || format.ruta_archivo || '#';
    const hasValidUrl = downloadUrl && downloadUrl !== '#';
    const formatName = esc(format.formato);
    const escapedUrl = esc(downloadUrl);
    const escapedTitle = esc(bookTitle);
    const escapedBookId = esc(format.book_id);
    const disabledClass = !hasValidUrl ? ' format-link--disabled' : '';
    const size = detailed && format.tamano_mb ? ` (${format.tamano_mb} MB)` : '';
    const prefix = detailed ? '📄 ' : '';
    const standardLink = `<a href="#" onclick="openViewer(event, '${escapedUrl}', '${escapedTitle}', '${formatName}', '${escapedBookId}')" class="format-link${disabledClass}">${prefix}${formatName}${size}</a>`;

    if (String(format.formato || '').trim().toLowerCase() !== 'pdf') {
        return standardLink;
    }

    return `${standardLink}<a href="#" onclick="openPdfReader(event, '${escapedUrl}', '${escapedTitle}', '${escapedBookId}')" class="format-link${disabledClass}">${detailed ? '✍ ' : ''}PDF nuevo · anotable</a>`;
}

function renderBook(book) {
    const formats = getBookFormats(book.id);
    const genres = (book.genero || '').split(',').map(g => g.trim()).filter(Boolean);
    const portadaSrc = resolveCoverThumb(book.url_portada);
    const coverHref = book.url_portada || '#';

    const formatLinks = formats.map(format => renderFormatLinks(format, book.titulo)).join('');

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

// UI Navigation
function showSections() {
    updateGlobalStats();
    hideAllViews();
    elements.sectionsView.classList.add('active');
    elements.backButton.style.display = 'none';
    elements.searchContainer.style.display = 'none';
    elements.adminControls.style.display = 'flex';
    updateBreadcrumb([]);
    const sectionEntries = Object.entries(classification.sections).map(([key, section]) => ({ key, section, bookCount: countBooksForSection(key) })).sort((a, b) => b.bookCount - a.bookCount);
    elements.sectionsGrid.innerHTML = sectionEntries.map(({ key, section, bookCount }) => {
        const sectionImagePath = `images/${key}.jpg`;
        const defaultImagePath = 'images/biblioteca.jpg';
        return `
        <div class="section-card" onclick="showSubsections('${key}')">
            <img class="section-cover" src="${sectionImagePath}" onerror="this.onerror=null;this.src='${defaultImagePath}';" alt="Sección ${esc(section.name)}">
            <div class="section-content">
                <div class="section-title">${esc(section.name)}</div>
                <div class="section-count">${bookCount} libro(s)</div>
                <div class="section-subtitle">${Object.keys(section.subsections).length} subsecciones</div>
            </div>
        </div>`;
    }).join('');
}

function showSubsections(sectionKey) {
    const booksInSection = getBooksForSection(sectionKey);
    updateStats(booksInSection);

    currentSection = sectionKey;
    const section = classification.sections[sectionKey];
    hideAllViews();
    elements.subsectionsView.classList.add('active');
    elements.backButton.style.display = 'block';
    elements.searchContainer.style.display = 'none';
    updateBreadcrumb([section.name]);
    const subsectionEntries = Object.entries(section.subsections).map(([key, subsection]) => ({ key, subsection, bookCount: countBooksForSubsection(sectionKey, key) })).sort((a, b) => b.bookCount - a.bookCount);
    elements.subsectionsGrid.innerHTML = subsectionEntries.map(({ key, subsection, bookCount }) => `
        <div class="section-card" onclick="showBooks('${sectionKey}', '${key}')">
             <img class="section-cover" src="images/biblioteca.jpg" alt="Subsección ${esc(subsection.name)}">
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
    
    const section = classification.sections[sectionKey];
    const subsection = section.subsections[subsectionKey];
    
    const booksInSubsection = filterBooksByTagsOR(subsection.tags);
    updateStats(booksInSubsection);

    hideAllViews();
    elements.booksView.classList.add('active');
    elements.backButton.style.display = 'block';
    elements.searchContainer.style.display = 'flex';
    
    updateBreadcrumb([section.name, subsection.name]);

    let tagsHtml = '';
    if (subsection.tags && subsection.tags.length > 0) {
        tagsHtml = `
            <div id="subsectionTags" style="margin: 12px 0 20px 0;">
                <strong>Tags:</strong>
                ${subsection.tags.map(tag => `
                    <span class="subsection-tag" data-tag="${esc(tag)}"
                          style="display:inline-block;background:#e0f2fe;color:#0369a1;padding:2px 8px;border-radius:12px;margin-right:6px;font-size:13px;cursor:pointer;transition:all 0.2s;">
                        ${esc(tag)}
                    </span>
                `).join('')}
            </div>
            <div id="tagFilterOptions" class="tag-filter-options" style="margin-bottom: 20px;">
                <label style="margin-right: 15px;">
                    <input type="radio" name="tagLogic" value="OR" ${tagFilterLogic === 'OR' ? 'checked' : ''}>
                    Cualquiera (OR)
                </label>
                <label>
                    <input type="radio" name="tagLogic" value="AND" ${tagFilterLogic === 'AND' ? 'checked' : ''}>
                    Todos (AND)
                </label>
            </div>
        `;
    }
    
    const breadcrumbElem = document.getElementById('breadcrumb');
    if (breadcrumbElem) {
        const oldTags = document.getElementById('subsectionTags');
        if (oldTags) oldTags.remove();
        const oldTagOptions = document.getElementById('tagFilterOptions');
        if (oldTagOptions) oldTagOptions.remove();
        breadcrumbElem.insertAdjacentHTML('afterend', tagsHtml);
    }

    window.selectedSubsectionTags = [];

    // Add event listeners for radio buttons
    document.querySelectorAll('input[name="tagLogic"]').forEach(radio => {
        radio.addEventListener('change', function() {
            tagFilterLogic = this.value;
            applyTagFilters(subsection.tags);
        });
    });

    document.querySelectorAll('.subsection-tag').forEach(tagElem => {
        tagElem.addEventListener('click', function () {
            const tag = this.getAttribute('data-tag');
            if (window.selectedSubsectionTags.includes(tag)) {
                window.selectedSubsectionTags = window.selectedSubsectionTags.filter(t => t !== tag);
                this.style.background = '#e0f2fe';
                this.style.color = '#0369a1';
            } else {
                window.selectedSubsectionTags.push(tag);
                this.style.background = '#2563eb';
                this.style.color = '#fff';
            }
            applyTagFilters(subsection.tags);
        });
    });

    applyTagFilters(subsection.tags);
}

function applyTagFilters(defaultTags) {
    const tagsToFilter = window.selectedSubsectionTags.length > 0 ? window.selectedSubsectionTags : defaultTags;
    
    if (tagFilterLogic === 'AND') {
        filteredBooks = filterBooksByTagsAND(tagsToFilter);
    } else { // Default to OR
        filteredBooks = filterBooksByTagsOR(tagsToFilter);
    }
    
    currentBooks = [...filteredBooks];
    updateStats(currentBooks);
    renderBooks();
}

// Filtra libros que tengan al menos uno de los tags (OR)
function filterBooksByTagsOR(tags) {
    if (!tags || tags.length === 0) return [];
    const normalizedTags = tags.map(normalizeText);
    return allBooks.filter(book => {
        if (!book.genero) return false;
        const bookGenres = book.genero.split(',').map(g => normalizeText(g.trim()));
        return normalizedTags.some(tag => bookGenres.includes(tag));
    });
}

// Filtra libros que tengan TODOS los tags seleccionados (AND)
function filterBooksByTagsAND(tags) {
    if (!tags || tags.length === 0) return [];
    const normalizedTags = tags.map(normalizeText);
    return allBooks.filter(book => {
        if (!book.genero) return false;
        const bookGenres = book.genero.split(',').map(g => normalizeText(g.trim()));
        // Check if all normalizedTags are present in bookGenres
        return normalizedTags.every(tag => bookGenres.includes(tag));
    });
}

function goBack() {
    const oldTags = document.getElementById('subsectionTags');
    if (oldTags) oldTags.remove();
    const tagFilterOptions = document.getElementById('tagFilterOptions');
    if (tagFilterOptions) tagFilterOptions.remove();

    // Reset tag filter logic to default (OR) and update UI
    tagFilterLogic = 'OR';
    const orRadio = document.querySelector('input[name="tagLogic"][value="OR"]');
    if (orRadio) {
        orRadio.checked = true;
    }
    console.log('tagFilterLogic reset to:', tagFilterLogic);

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
    const coverHref = book.url_portada || '#';

    let subseccionesLibro = [];
    if (classification && classification.sections) {
        for (const [sectionKey, section] of Object.entries(classification.sections)) {
            for (const [subKey, subsection] of Object.entries(section.subsections)) {
                if ((subsection.tags || []).some(tag => genres.map(normalizeText).includes(normalizeText(tag)))) {
                    subseccionesLibro.push({
                        section: section.name,
                        subsection: subsection.name,
                        sectionKey,
                        subKey
                    });
                }
            }
        }
    }

    const subseccionesHtml = subseccionesLibro.length > 0 ? `
        <div style="margin: 16px 0 0 0;">
            <strong>Subsecciones donde aparece:</strong>
            <ul style="margin: 6px 0 0 0; padding-left: 18px;">
                ${subseccionesLibro.map(s => `
                    <li>
                        <a href="#" onclick="showSubsections('${s.sectionKey}'); setTimeout(() => showBooks('${s.sectionKey}', '${s.subKey}'), 10); closeModal(); return false;">
                            <span style="color:#2563eb;">${esc(s.section)}</span> / <span style="color:#0369a1;">${esc(s.subsection)}</span>
                        </a>
                    </li>`
                ).join('')}
            </ul>
        </div>` : `
        <div style="margin: 16px 0 0 0; color: #64748b;">
            No pertenece a ninguna subsección clasificada.
        </div>`;
    
    const modalHtml = `
        <div class="modal-book">
            <div class="modal-cover">
                <a href="${esc(coverHref)}" target="_blank" rel="noopener">
                    <img src="${esc(portadaSrc)}" alt="Portada de ${esc(book.titulo)}" 
                         onerror="this.style.display='none'; this.parentElement.innerHTML='📖';" />
                </a>
            </div>
            <div class="modal-info">
                <h2>${esc(book.titulo || 'Sin título')}</h2>
                <p><strong>Autor:</strong> ${book.autor ? `<a href="#" onclick="searchByAuthor('${esc(book.autor)}'); return false;">${esc(book.autor)}</a>` : 'Autor desconocido'}</p>
                ${book.serie ? `<p><strong>Serie:</strong> <a href="#" onclick="searchBySerie('${esc(book.serie)}'); return false;">${esc(book.serie)}</a>${book.numero_serie ? ` #${book.numero_serie}` : ''}</p>` : ''}
                ${book.editorial ? `<p><strong>Editorial:</strong> ${esc(book.editorial)}</p>` : ''}
                ${book.fecha_publicacion ? `<p><strong>Año:</strong> ${esc(book.fecha_publicacion.slice(0,4))}</p>` : ''}
                <p><strong>Géneros:</strong> ${genres.map(g => esc(g)).join(', ') || 'Sin especificar'}</p>
                ${subseccionesHtml}
            </div>
        </div>
        ${BOOK_NOTES_ENABLED ? `
            <section class="book-note" aria-labelledby="bookNoteTitle">
                <div class="book-note__header">
                    <div><h3 id="bookNoteTitle">Notas del libro</h3><p>Ideas generales, avance de lectura o cualquier recordatorio.</p></div>
                    <button id="editBookNoteButton" class="btn btn--outline" type="button">📝 Añadir nota</button>
                </div>
                <p id="bookNotePreview" class="book-note__preview" hidden></p>
                <p id="bookNoteEmpty" class="book-note__empty">Cargando nota…</p>
            </section>
            <div id="bookNoteDialog" class="book-note-dialog" hidden role="dialog" aria-modal="true" aria-labelledby="bookNoteDialogTitle">
                <div class="book-note-dialog__panel">
                    <h3 id="bookNoteDialogTitle">Nota sobre ${esc(book.titulo || 'este libro')}</h3>
                    <p>Guarda ideas generales o tu punto de lectura. No está ligada a ningún texto de la descripción.</p>
                    <label class="sr-only" for="bookNoteTextarea">Nota del libro</label>
                    <textarea id="bookNoteTextarea" class="form-control" rows="7" placeholder="Ej.: Voy por la página 84. Revisar la idea del capítulo 3…"></textarea>
                    <div class="book-note-dialog__actions">
                        <button id="deleteBookNoteButton" class="btn btn--danger" type="button" hidden>Eliminar nota</button>
                        <span></span>
                        <button id="cancelBookNoteButton" class="btn btn--outline" type="button">Cancelar</button>
                        <button id="saveBookNoteButton" class="btn btn--primary" type="button">Guardar nota</button>
                    </div>
                </div>
            </div>` : ''}
        ${book.descripcion ? `<div class="modal-description"><h3>Descripción</h3><div id="description-content"></div></div>` : ''}
        ${formats.length > 0 ? `
            <div class="modal-formats">
                ${formats.map(format => renderFormatLinks(format, book.titulo, true)).join('')}
            </div>` : ''}
        <div class="modal-footer">
            ${isAdmin ? `
                <button type="button" class="btn btn--success" onclick="showEditModal(${book.id})">✏️ Editar</button>
                <button type="button" class="btn btn--danger" onclick="showDeleteBookModal(${book.id})">🗑️ Borrar libro</button>
            ` : ''}
        </div>
    `;
    
    elements.modalContent.innerHTML = modalHtml;
    if (book.descripcion) {
        const descriptionContainer = document.getElementById('description-content');
        if (isHTML(book.descripcion)) {
            descriptionContainer.innerHTML = decodeHtmlDescription(book.descripcion);
        } else {
            descriptionContainer.innerHTML = marked.parse(book.descripcion);
        }

    }

    if (BOOK_NOTES_ENABLED) {
        const dialog = document.getElementById('bookNoteDialog');
        const textarea = document.getElementById('bookNoteTextarea');
        const preview = document.getElementById('bookNotePreview');
        const emptyState = document.getElementById('bookNoteEmpty');
        const editButton = document.getElementById('editBookNoteButton');
        const deleteButton = document.getElementById('deleteBookNoteButton');
        const saveButton = document.getElementById('saveBookNoteButton');
        let storedNote = null;

        const refreshNotePreview = () => {
            const note = storedNote?.note_content || '';
            preview.textContent = note;
            preview.hidden = !note;
            emptyState.hidden = Boolean(note);
            emptyState.textContent = note ? '' : 'Aún no hay notas para este libro.';
            editButton.textContent = `📝 ${note ? 'Editar nota' : 'Añadir nota'}`;
            deleteButton.hidden = !note;
        };
        const closeBookNoteDialog = () => { dialog.hidden = true; };

        editButton.addEventListener('click', () => {
            textarea.value = storedNote?.note_content || '';
            dialog.hidden = false;
            textarea.focus();
        });
        document.getElementById('cancelBookNoteButton').addEventListener('click', closeBookNoteDialog);
        saveButton.addEventListener('click', async () => {
            const originalLabel = saveButton.textContent;
            saveButton.disabled = true;
            saveButton.textContent = 'Guardando…';
            try {
                storedNote = await saveBookNote(book.id, storedNote?.id, textarea.value.trim());
                refreshNotePreview();
                closeBookNoteDialog();
            } catch (error) {
                alert(error.message);
            } finally {
                saveButton.disabled = false;
                saveButton.textContent = originalLabel;
            }
        });
        deleteButton.addEventListener('click', async () => {
            try {
                storedNote = await saveBookNote(book.id, storedNote?.id, '');
                refreshNotePreview();
                closeBookNoteDialog();
            } catch (error) {
                alert(error.message);
            }
        });
        dialog.addEventListener('click', event => {
            if (event.target === dialog) closeBookNoteDialog();
        });
        textarea.addEventListener('keydown', event => {
            if (event.key === 'Escape') closeBookNoteDialog();
        });
        loadBookNote(book.id)
            .then(note => { storedNote = note; refreshNotePreview(); })
            .catch(error => { emptyState.textContent = error.message; });
    }
    elements.bookModal.classList.add('show');
}

function showEditModal(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;
    currentEditingBook = book;
    const form = document.getElementById('editForm');
    form.elements.editTitulo.value = book.titulo || '';
    form.elements.editAutor.value = book.autor || '';
    form.elements.editSerie.value = book.serie || '';
    form.elements.editNumeroSerie.value = book.numero_serie || '';
    form.elements.editEditorial.value = book.editorial || '';
    form.elements.editFechaPublicacion.value = book.fecha_publicacion || '';
    form.elements.editDescripcion.value = book.descripcion || '';
    form.elements.editCarpetaObra.value = book.carpeta_obra || '';
    updateCoverEditorPreview(book.url_portada);
    setCoverEditorStatus('');

    // --- INICIO DE LA NUEVA LÓGICA DE GÉNEROS ---
    const bookGenres = (book.genero || '').split(',').map(g => g.trim()).filter(Boolean);
    renderGenrePills(bookGenres);

    const searchInput = document.getElementById('genre-search-input');
    const searchResults = document.getElementById('genre-search-results');

    searchInput.addEventListener('input', () => {
        const searchTerm = searchInput.value;
        const normalizedSearchTerm = normalizeText(searchTerm);
        const searchResults = document.getElementById('genre-search-results');
        
        searchResults.innerHTML = '';

        if (!searchTerm.trim()) {
            return;
        }

        const filteredGenres = window._allGenres.filter(g => normalizeText(g).includes(normalizedSearchTerm));

        const newGenreText = searchTerm.trim();
        let newGenreAlreadyExists = false;

        filteredGenres.forEach(genre => {
            if (normalizeText(genre) === normalizedSearchTerm) {
                newGenreAlreadyExists = true;
            }
            const item = document.createElement('div');
            item.className = 'search-result-item';
            item.textContent = genre;
            item.addEventListener('dblclick', () => {
                addGenreToBook(genre);
                searchInput.value = '';
                searchResults.innerHTML = '';
            });
            searchResults.appendChild(item);
        });

        if (newGenreText && !newGenreAlreadyExists) {
            const item = document.createElement('div');
            item.className = 'search-result-item new-genre';
            item.textContent = `Crear: "${newGenreText}"`;
            item.addEventListener('dblclick', () => {
                addGenreToBook(newGenreText);
                searchInput.value = '';
                searchResults.innerHTML = '';
            });
            searchResults.insertBefore(item, searchResults.firstChild);
        }
    });

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newGenre = searchInput.value.trim();
            if (newGenre) {
                addGenreToBook(newGenre);
                searchInput.value = '';
                searchResults.innerHTML = '';
            }
        }
    });
    // --- FIN DE LA NUEVA LÓGICA DE GÉNEROS ---

    elements.editModal.classList.add('show');
}

function setCoverEditorStatus(message, type = '') {
    if (!elements.coverEditorStatus) return;
    elements.coverEditorStatus.textContent = message;
    elements.coverEditorStatus.className = `cover-editor__status${type ? ` is-${type}` : ''}`;
}

function updateCoverEditorPreview(url) {
    if (!elements.editCoverPreview || !elements.editCoverPlaceholder) return;
    const source = resolveCoverThumb(url);
    if (!source) {
        elements.editCoverPreview.removeAttribute('src');
        elements.editCoverPreview.classList.add('cover-editor__preview--empty');
        elements.editCoverPlaceholder.hidden = false;
        return;
    }
    elements.editCoverPreview.src = source;
    elements.editCoverPreview.onerror = () => {
        elements.editCoverPreview.removeAttribute('src');
        elements.editCoverPreview.classList.add('cover-editor__preview--empty');
        elements.editCoverPlaceholder.hidden = false;
    };
    elements.editCoverPreview.classList.remove('cover-editor__preview--empty');
    elements.editCoverPlaceholder.hidden = true;
}

function setCoverEditorBusy(isBusy, message = '') {
    [elements.extractFileCoverButton, elements.searchWebCoverButton, elements.uploadCoverButton]
        .filter(Boolean)
        .forEach(button => { button.disabled = isBusy; });
    if (message) setCoverEditorStatus(message);
}

function adminAuthorizationHeaders() {
    const token = getCookie('libraryAdminToken');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

async function ensurePdfJsLoaded() {
    if (typeof pdfjsLib !== 'undefined') return;
    if (!window.pdfjsScriptLoading) {
        window.pdfjsScriptLoading = true;
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        document.head.appendChild(script);
        await new Promise((resolve, reject) => { script.onload = resolve; script.onerror = reject; });
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        return;
    }
    await new Promise((resolve, reject) => {
        const started = Date.now();
        const check = () => {
            if (typeof pdfjsLib !== 'undefined') return resolve();
            if (Date.now() - started > 15000) return reject(new Error('No se pudo cargar el lector de PDF.'));
            setTimeout(check, 100);
        };
        check();
    });
}

async function firstPageAsCover(pdfBlob) {
    await ensurePdfJsLoaded();
    const pdf = await pdfjsLib.getDocument(await pdfBlob.arrayBuffer()).promise;
    if (!pdf.numPages) throw new Error('El PDF no contiene páginas.');
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se ha podido preparar la imagen de la portada.');
    await page.render({ canvasContext: context, viewport }).promise;
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('No se ha podido crear la imagen de portada.')), 'image/jpeg', 0.9));
}

async function firstCbrPageAsCover(cbrBlob) {
    const [{ createExtractorFromData }, wasmResponse] = await Promise.all([
        import('./vendor/node-unrar-js/index.esm.js'),
        fetch('./vendor/node-unrar-js/js/unrar.wasm'),
    ]);
    if (!wasmResponse.ok) throw new Error('No se ha podido iniciar el descompresor CBR.');

    const extractor = await createExtractorFromData({
        data: await cbrBlob.arrayBuffer(),
        wasmBinary: await wasmResponse.arrayBuffer(),
    });
    const imagePattern = /\.(?:avif|bmp|gif|jpe?g|png|webp)$/i;
    const { fileHeaders } = extractor.getFileList();
    const [firstImage] = [...fileHeaders]
        .filter(header => !header.flags.directory && imagePattern.test(header.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'es', { numeric: true, sensitivity: 'base' }));
    if (!firstImage) throw new Error('El CBR no contiene imágenes compatibles.');

    const { files } = extractor.extract({ files: [firstImage.name] });
    const [extracted] = [...files];
    if (!extracted?.extraction) throw new Error('No se ha podido extraer la primera página del CBR.');

    const extension = firstImage.name.split('.').pop().toLowerCase();
    const mimeType = ({
        avif: 'image/avif', bmp: 'image/bmp', gif: 'image/gif',
        jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
    })[extension] || 'image/jpeg';
    return {
        image: new Blob([extracted.extraction], { type: mimeType }),
        extension,
    };
}

async function persistCoverResponse(response) {
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se ha podido actualizar la portada.');
    const url = result.viewUrl || result.coverUrl;
    if (!url) throw new Error('El servicio no ha devuelto una portada válida.');
    const updated = { url_portada: url, url_download_portada: result.downloadUrl || url };
    const index = allBooks.findIndex(book => book.id === currentEditingBook.id);
    if (index !== -1) allBooks[index] = { ...allBooks[index], ...updated };
    currentEditingBook = { ...currentEditingBook, ...updated };
    updateCoverEditorPreview(url);
    return url;
}

async function uploadCoverImage(image, sourceName) {
    if (!currentEditingBook) return;
    if (!image || !String(image.type || '').startsWith('image/')) throw new Error('Selecciona una imagen válida.');
    const formData = new FormData();
    formData.append('action', 'upload');
    formData.append('bookId', currentEditingBook.id);
    formData.append('image', image, sourceName || 'portada.jpg');
    const response = await fetch(BOOK_COVER_URL, { method: 'POST', headers: adminAuthorizationHeaders(), body: formData });
    await persistCoverResponse(response);
}

async function extractCoverFromBookFile() {
    if (!currentEditingBook) return;
    const formats = getBookFormats(currentEditingBook.id);
    const source = formats.find(format => String(format.formato || '').trim().toLowerCase() === 'pdf')
        || formats.find(format => String(format.formato || '').trim().toLowerCase() === 'cbr');
    if (!source) {
        setCoverEditorStatus('Este libro no tiene un PDF ni un CBR del que extraer la primera página.', 'error');
        return;
    }
    const format = String(source.formato || '').trim().toLowerCase();
    const isCbr = format === 'cbr';
    try {
        setCoverEditorBusy(true, isCbr ? 'Extrayendo la primera página del CBR…' : 'Leyendo la primera página del PDF…');
        const response = await fetch(buildDownloadUrl(source.url_download || source.ruta_archivo || ''));
        if (!response.ok) throw new Error(`No se ha podido descargar el ${isCbr ? 'CBR' : 'PDF'} del libro.`);
        const result = isCbr
            ? await firstCbrPageAsCover(await response.blob())
            : { image: await firstPageAsCover(await response.blob()), extension: 'jpg' };
        setCoverEditorStatus('Guardando la portada…');
        await uploadCoverImage(result.image, `${currentEditingBook.titulo || 'libro'}-portada.${result.extension}`);
        setCoverEditorStatus('Portada extraída y guardada.', 'success');
    } catch (error) {
        console.error('No se pudo extraer la portada del archivo:', error);
        setCoverEditorStatus(error.message || 'No se ha podido extraer la portada del PDF o CBR.', 'error');
    } finally {
        setCoverEditorBusy(false);
    }
}

async function searchAndSetWebCover() {
    if (!currentEditingBook) return;
    const form = document.getElementById('editForm');
    const titulo = form.elements.editTitulo.value.trim() || currentEditingBook.titulo;
    const autor = form.elements.editAutor.value.trim() || currentEditingBook.autor;
    try {
        setCoverEditorBusy(true, 'Buscando una portada en la web…');
        const response = await fetch(BOOK_COVER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...adminAuthorizationHeaders() },
            body: JSON.stringify({ action: 'search', bookId: currentEditingBook.id, titulo, autor })
        });
        await persistCoverResponse(response);
        setCoverEditorStatus('Portada encontrada y guardada.', 'success');
    } catch (error) {
        console.error('No se pudo buscar la portada:', error);
        setCoverEditorStatus(error.message || 'No se ha encontrado una portada.', 'error');
    } finally {
        setCoverEditorBusy(false);
    }
}

async function uploadSelectedCover(event) {
    const image = event.target.files?.[0];
    if (!image) return;
    try {
        setCoverEditorBusy(true, 'Subiendo la portada…');
        await uploadCoverImage(image, image.name);
        setCoverEditorStatus('Portada subida y guardada.', 'success');
    } catch (error) {
        console.error('No se pudo subir la portada:', error);
        setCoverEditorStatus(error.message || 'No se ha podido subir la portada.', 'error');
    } finally {
        event.target.value = '';
        setCoverEditorBusy(false);
    }
}

function renderGenrePills(genres) {
    const container = document.getElementById('current-book-tags');
    container.innerHTML = '';
    genres.forEach(genre => {
        const pill = document.createElement('div');
        pill.className = 'tag-pill';
        pill.textContent = genre;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'tag-delete-btn';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.onclick = () => {
            pill.remove();
        };
        
        pill.appendChild(deleteBtn);
        container.appendChild(pill);
    });
}

function addGenreToBook(genre) {
    const container = document.getElementById('current-book-tags');
    const existingGenres = Array.from(container.querySelectorAll('.tag-pill')).map(p => p.textContent.replace(/×$/, '').trim());
    if (!existingGenres.includes(genre)) {
        renderGenrePills([...existingGenres, genre]);
    }
}

async function saveBookChanges() {
    if (!currentEditingBook) return;
    const form = document.getElementById('editForm');
    
    // --- OBTENER GÉNEROS DE LAS PÍLDORAS ---
    const selectedGenres = Array.from(document.querySelectorAll('#current-book-tags .tag-pill'))
                                .map(pill => pill.textContent.replace(/×$/, '').trim());

    const updatedData = {
        titulo: form.elements.editTitulo.value.trim(),
        autor: form.elements.editAutor.value.trim() || null,
        genero: selectedGenres.join(', '),
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

function showDeleteBookModal(bookId) {
    if (!isAdmin) return;
    const book = allBooks.find(item => item.id === bookId);
    if (!book) return;

    const formats = getBookFormats(bookId);
    document.getElementById('deleteBookTitle').textContent = book.titulo || 'este libro';
    document.getElementById('deleteBookFormats').textContent = formats.length
        ? `Se eliminarán ${formats.length} formato${formats.length === 1 ? '' : 's'} de la base de datos.`
        : 'No hay formatos registrados para este libro.';
    document.getElementById('deleteBookDriveFiles').checked = false;
    document.getElementById('confirmDeleteBookButton').dataset.bookId = String(bookId);
    elements.deleteBookModal.classList.add('show');
}

function closeDeleteBookModal() {
    elements.deleteBookModal.classList.remove('show');
    elements.confirmDeleteBookButton.disabled = false;
    elements.confirmDeleteBookButton.textContent = 'Borrar definitivamente';
}

async function deleteBook() {
    if (!isAdmin) return;
    const bookId = Number(elements.confirmDeleteBookButton.dataset.bookId);
    const book = allBooks.find(item => item.id === bookId);
    if (!book) return;

    const deleteDriveFiles = elements.deleteBookDriveFiles.checked;
    elements.confirmDeleteBookButton.disabled = true;
    elements.confirmDeleteBookButton.textContent = 'Borrando…';

    try {
        const adminToken = getCookie('libraryAdminToken');
        if (!adminToken) throw new Error('La sesión de bibliotecario ha caducado. Vuelve a iniciar sesión.');
        const response = await fetch(DELETE_BOOK_FILES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ bookId, deleteDriveFiles })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'No se pudo borrar el libro.');

        allFormats = allFormats.filter(format => format.book_id !== bookId);
        allBooks = allBooks.filter(item => item.id !== bookId);
        filteredBooks = filteredBooks.filter(item => item.id !== bookId);
        currentBooks = currentBooks.filter(item => item.id !== bookId);
        updateGlobalStats();
        populateSearchFilters();
        closeDeleteBookModal();
        closeModal();

        if (elements.booksView.classList.contains('active')) {
            applyTagFilters(classification.sections[currentSection].subsections[currentSubsection].tags);
        } else if (elements.subsectionsView.classList.contains('active')) {
            showSubsections(currentSection);
        } else {
            showSections();
        }
        alert(`Libro \"${book.titulo}\" borrado correctamente${deleteDriveFiles ? ' junto con sus ficheros de Drive.' : '.'}`);
    } catch (error) {
        console.error('Error al borrar el libro:', error);
        alert(`No se pudo borrar el libro: ${error.message}`);
        elements.confirmDeleteBookButton.disabled = false;
        elements.confirmDeleteBookButton.textContent = 'Borrar definitivamente';
    }
}

// Visor embebido
function buildPreviewUrl(viewUrl) {
    const m = String(viewUrl || '').match(/https:\/\/drive\.google\.com\/file\/d\/([^\/]+)\/view/i);
    if (m && m[1]) {
        const id = m[1];
        return `https://drive.google.com/file/d/${id}/preview`;
    }
    return `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(viewUrl || '')}`;
}

// La URL de previsualización de Drive no fuerza una descarga. El proxy entrega
// el fichero como adjunto para que el navegador lo guarde, en vez de abrirlo.
function buildDownloadUrl(fileUrl) {
    const url = String(fileUrl || '');
    const driveId = url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/file\/d\/([a-zA-Z0-9_-]+)\//);
    if (driveId && driveId[1] && url.includes('drive.google.com')) {
        return `${PROXY_BASE_URL}/api/drive-proxy?id=${encodeURIComponent(driveId[1])}`;
    }
    return url;
}

async function openViewer(event, formatUrl, bookTitle, formatName, bookId) {
    event.preventDefault();
    event.stopPropagation();
    // EPUB y CBR conservan lectores propios; PDF usa este visor clásico salvo que se pulse el acceso anotable.
    const normalizedFormat = String(formatName || '').toLowerCase();
    if (normalizedFormat === 'epub') {
        const readerUrl = `epub-reader.html?v=annotation-book-id-v1&bookId=${encodeURIComponent(bookId || '')}&title=${encodeURIComponent(bookTitle || '')}&url=${encodeURIComponent(formatUrl || '')}`;
        window.open(readerUrl, '_blank', 'noopener');
        return;
    }
    if (normalizedFormat === 'cbr') {
        const readerUrl = `cbr-reader.html?v=cbr-zoom-v2&title=${encodeURIComponent(bookTitle || '')}&url=${encodeURIComponent(buildDownloadUrl(formatUrl || ''))}`;
        window.open(readerUrl, '_blank', 'noopener');
        return;
    }
    if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
    const viewerModal = document.getElementById('viewerModal');
    const viewerIframe = document.getElementById('viewerIframe');
    const viewerTitle = document.getElementById('viewerTitle');
    const viewerDownloadLink = document.getElementById('viewerDownloadLink');
    viewerTitle.textContent = `Cargando: ${esc(bookTitle)}...`;
    viewerIframe.src = 'about:blank';
    viewerModal.style.display = 'flex';
    viewerDownloadLink.href = buildDownloadUrl(formatUrl);
    viewerDownloadLink.download = `${String(bookTitle || 'libro').trim() || 'libro'}${normalizedFormat ? `.${normalizedFormat}` : ''}`;

    let embedUrl = formatUrl; // Default to original URL
    const googleDriveIdMatch = formatUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (googleDriveIdMatch && formatUrl.includes('drive.google.com')) {
        const fileId = googleDriveIdMatch[1];
        embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        console.log(`Converted Google Drive URL to embed: ${embedUrl}`);
    } else {
        // For non-Google Drive URLs, try Google Docs Viewer
        embedUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(formatUrl)}&embedded=true`;
        console.log(`Attempting embed with Google Docs Viewer: ${embedUrl}`);
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

function openPdfReader(event, formatUrl, bookTitle, bookId) {
    event.preventDefault();
    event.stopPropagation();
    if (!formatUrl || formatUrl === '#') return;

    const readerUrl = `pdf-reader.html?v=annotation-book-id-v1&bookId=${encodeURIComponent(bookId || '')}&title=${encodeURIComponent(bookTitle || '')}&url=${encodeURIComponent(formatUrl)}`;
    window.open(readerUrl, '_blank', 'noopener');
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
    // Supabase normalmente devuelve ambos IDs como números, pero los registros
    // creados o migrados pueden llegar como texto. Normalizarlos evita que un
    // formato existente desaparezca de la tarjeta por una diferencia de tipo.
    const normalizedBookId = String(bookId);
    return allFormats.filter(format => String(format.book_id) === normalizedBookId);
}

function stableReaderBookId(value) {
    let hash = 2166136261;
    for (const character of String(value || '')) {
        hash ^= character.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}

function buildAnnotationBookLookup() {
    const booksById = new Map(allBooks.map(book => [String(book.id), book]));
    const lookup = new Map(booksById);

    allFormats.forEach(format => {
        const book = booksById.get(String(format.book_id));
        if (!book) return;

        [format.url_download, format.ruta_archivo, format.url]
            .filter(Boolean)
            .forEach(formatUrl => {
                const driveId = extractDriveId(formatUrl);
                if (driveId) lookup.set(String(driveId), book);
                lookup.set(`pdf-url-${stableReaderBookId(formatUrl)}`, book);
            });
    });

    return lookup;
}

function countBooksForSection(sectionKey) {
    const allTags = Object.values(classification.sections[sectionKey].subsections).flatMap(s => s.tags);
    return filterBooksByTagsOR(allTags).length;
}

function countBooksForSubsection(sectionKey, subsectionKey) {
    return filterBooksByTagsOR(classification.sections[sectionKey].subsections[subsectionKey].tags).length;
}



function searchByAuthor(authorName) {
    closeModal();
    clearSearch();
    document.getElementById('searchAutorInput').value = authorName;
    document.getElementById('searchAutor').value = authorName; // Also update the select element
    openSearchModal();
    performSearch();
}

function searchBySerie(serieName) {
    closeModal();
    clearSearch();
    document.getElementById('searchSerie').value = serieName;
    openSearchModal();
    performSearch();
}

function showRandomBookDetails() {
    if (allBooks.length === 0) {
        alert('No hay libros en la biblioteca para seleccionar uno aleatorio.');
        return;
    }
    const randomIndex = Math.floor(Math.random() * allBooks.length);
    const randomBook = allBooks[randomIndex];
    closeSearchModal(); // Cerrar el modal de búsqueda
    showBookDetails(randomBook.id); // Mostrar los detalles del libro aleatorio
}

// Event Listeners
function setupEventListeners() {
    setupCategoryAutocomplete();
    document.getElementById('importButton').addEventListener('click', () => {
        elements.ebookImporter.click();
    });
    if (elements.registerDriveButton) {
        elements.registerDriveButton.addEventListener('click', openDriveRegisterModal);
    }
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
    if (elements.closeDriveRegisterModal) {
        elements.closeDriveRegisterModal.addEventListener('click', closeDriveRegisterModal);
    }
    if (elements.driveRegisterForm) {
        elements.driveRegisterForm.addEventListener('submit', registerDriveFile);
    }
    if (elements.driveRegisterModal) {
        elements.driveRegisterModal.addEventListener('click', (e) => {
            if (e.target === elements.driveRegisterModal) closeDriveRegisterModal();
        });
    }
    if (elements.confirmDeleteBookButton) {
        elements.confirmDeleteBookButton.addEventListener('click', () => void deleteBook());
    }
    if (elements.deleteBookModal) {
        elements.deleteBookModal.addEventListener('click', (e) => {
            if (e.target === elements.deleteBookModal) closeDeleteBookModal();
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
            closeDriveRegisterModal();
            closeDeleteBookModal();
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
        if (!currentEditingBook) return;

        const button = elements.aiDescriptionButton;
        const originalText = button.textContent;
        button.disabled = true;
        button.textContent = 'Generando…';
        try {
            const description = await generateAiDescription(currentEditingBook.titulo, currentEditingBook.autor);
            if (description) document.getElementById('editDescripcion').value = description;
        } finally {
            button.disabled = false;
            button.textContent = originalText;
        }
    });

    if (elements.extractFileCoverButton) {
        elements.extractFileCoverButton.onclick = () => void extractCoverFromBookFile();
    }
    if (elements.searchWebCoverButton) {
        elements.searchWebCoverButton.onclick = () => void searchAndSetWebCover();
    }
    if (elements.uploadCoverButton && elements.coverImageUploader) {
        elements.uploadCoverButton.onclick = () => elements.coverImageUploader.click();
        elements.coverImageUploader.onchange = event => void uploadSelectedCover(event);
    }

    // Header pinning logic
    if (elements.pinHeaderButton && elements.header) {
        elements.pinHeaderButton.addEventListener('click', toggleHeaderPin);
        // Apply initial state on load
        const isPinned = localStorage.getItem('headerPinned') === 'true';
        applyHeaderPinState(isPinned);
    }
}

function toggleHeaderPin() {
    const isPinned = elements.header.classList.contains('header--pinned');
    applyHeaderPinState(!isPinned);
}

function applyHeaderPinState(pin) {
    if (pin) {
        elements.header.classList.add('header--pinned');
        document.body.classList.add('header-is-pinned');
        elements.pinHeaderButton.innerHTML = '📍'; // Pinned icon
        localStorage.setItem('headerPinned', 'true');
    } else {
        elements.header.classList.remove('header--pinned');
        document.body.classList.remove('header-is-pinned');
        elements.pinHeaderButton.innerHTML = '📌'; // Unpinned icon
        localStorage.setItem('headerPinned', 'false');
    }
}

// --- Auth Button Setup ---
const authButton = document.getElementById('authButton');
authButton.addEventListener('click', () => {
    if (isAdmin) {
        logoff();
    }
    else {
        showLoginModal();
    }
});
