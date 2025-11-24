// Dependencies to be injected from other modules
let elements;
let loading;
let importModal;
let importForm;
let selectedFileForImport;
let UPLOAD_URL;
let supabaseClient;
let allFormats;
let allBooks;
let updateGlobalStats;
let applyTagFilters;
let showSubsections;
let showSections;
let classification;
let currentSection;
let currentSubsection;


export function initImporter(dependencies) {
    elements = dependencies.elements;
    loading = dependencies.loading;
    importModal = dependencies.importModal;
    importForm = dependencies.importForm;
    selectedFileForImport = dependencies.selectedFileForImport;
    UPLOAD_URL = dependencies.UPLOAD_URL;
    supabaseClient = dependencies.supabaseClient;
    allFormats = dependencies.allFormats;
    allBooks = dependencies.allBooks;
    updateGlobalStats = dependencies.updateGlobalStats;
    applyTagFilters = dependencies.applyTagFilters;
    showSubsections = dependencies.showSubsections;
    showSections = dependencies.showSections;
    classification = dependencies.classification;
    currentSection = dependencies.currentSection;
    currentSubsection = dependencies.currentSubsection;
}


export async function handleFileSelect(event) {
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

export async function saveNewBook(event) {
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
                const arr = dataurl.split(',');
                const mime = arr[0].match(/:(.*?);/)[1];
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

export function closeImportModal() {
    elements.importModal.style.display = 'none';
    elements.importForm.reset();
    selectedFileForImport = null;
}
