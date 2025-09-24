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
const PROXY_BASE_URL = 'https://perplexity-proxy-backend.vercel.app'; 
const GEMINI_PROXY_URL = 'https://perplexity-proxy-backend.vercel.app/api/proxy'; 
const UPLOAD_URL = `${PROXY_BASE_URL}/api/upload`;

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
    isAdmin = false; // Update local state
    disableAdminFeatures(); // Immediately disable features
    showLoginModal(); // Show login modal after logoff
    // No need to reload, loadInitialData will be called after successful login
}

function hash(s){ let h=0; for(let i=0;i<s.length;i++){h=((h<<5)-h)+s.charCodeAt(i); h|=0;} return String(Math.abs(h)); }

function resolveCoverThumb(urlPortada) {
    if (!urlPortada) return '';
    const m = urlPortada.match(/\/d\/([^\/]+)\//);
    const id = m ? m[1] : null;
    if (!id) return urlPortada;
    return `https://drive.google.com/thumbnail?id=${id}&sz=w400`;
}

function openClassificationEditor() {
    window.open('editor-clasificacion-visual.html', '_blank');
}

function isHTML(str) {
    if (!str) return false;
    const doc = new DOMParser().parseFromString(str, "text/html");
    return Array.from(doc.body.childNodes).some(node => node.nodeType === 1);
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
                isAdmin = true;
                enableAdminFeatures();
            } else { // Lector
                deleteCookie('isAdmin'); // Ensure no admin cookie is set
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
    await loadData();
    await loadClassification();
    if(isAdmin) {
        await sincronizarClasificacion();
    }
    populateSearchFilters();
    showSections();
    setupEventListeners();
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
        adminControls: document.getElementById('adminControls'),
        searchModal: document.getElementById('searchModal'),
        ebookImporter: document.getElementById('ebookImporter'),
        uploadStatus: document.getElementById('uploadStatus'),
        importModal: document.getElementById('importModal'),
        importForm: document.getElementById('importForm'),
        closeImportModal: document.querySelector('#importModal .close-button')
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

        const { data: formatsData, error: formatsError } = await supabaseClient.from('book_formats').select('*');
        if (formatsError) throw formatsError;
        allFormats = formatsData || [];

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
        if (error) throw error;
        classification = data.data;
    } catch (error) {
        console.error('Error loading classification:', error);
    }
}

// --- File Import ---
async function handleFileSelect(event) {
    const files = event.target.files;
    if (!files.length) {
        return;
    }
    selectedFileForImport = files[0];
    const file = selectedFileForImport;
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

        } else {
            console.log(`El archivo no es un PDF o EPUB (${fileName}), se omitirá la extracción de portada.`);
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
        ${book.descripcion ? `<div class="modal-description"><h3>Descripción</h3><div id="description-content"></div></div>` : ''}
        ${formats.length > 0 ? `
            <div class="modal-formats">
                ${formats.map(format => {
                    const downloadUrl = format.url_download || format.ruta_archivo || '#';
                    const hasValidUrl = downloadUrl && downloadUrl !== '#';
                    const formatName = esc(format.formato);
                    const bookTitle = esc(book.titulo);
                    return `
                        <a href="#" 
                           onclick="openViewer(event, '${esc(downloadUrl)}', '${bookTitle}', '${formatName}')"
                           class="format-link${!hasValidUrl ? ' format-link--disabled' : ''}">
                            📄 ${formatName}
                            ${format.tamano_mb ? ` (${format.tamano_mb} MB)` : ''}
                        </a>`;
                }).join('')}
            </div>` : ''}
        <div class="modal-footer">
            ${isAdmin ? `<button type="button" class="btn btn--success" onclick="showEditModal(${book.id})">✏️ Editar</button>` : ''}
        </div>
    `;
    
    elements.modalContent.innerHTML = modalHtml;
    if (book.descripcion) {
        const descriptionContainer = document.getElementById('description-content');
        if (isHTML(book.descripcion)) {
            descriptionContainer.innerHTML = book.descripcion;
        } else {
            descriptionContainer.innerHTML = marked.parse(book.descripcion);
        }
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

// Visor embebido
function buildPreviewUrl(viewUrl) {
    const m = String(viewUrl || '').match(/https:\/\/drive\.google\.com\/file\/d\/([^\/]+)\/view/i);
    if (m && m[1]) {
        const id = m[1];
        return `https://drive.google.com/file/d/${id}/preview`;
    }
    return `https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(viewUrl || '')}`;
}

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
}