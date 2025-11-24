// Dependencies to be injected from other modules
let supabaseClient;
let GEMINI_PROXY_URL;
let UPLOAD_URL;
let allBooks;
let allFormats;
let classification;
let elements;
let applyTagFilters;
let showSubsections;
let showSections;
let updateGlobalStats;
let normalizeText;

export function initApi(dependencies) {
    supabaseClient = dependencies.supabaseClient;
    GEMINI_PROXY_URL = dependencies.GEMINI_PROXY_URL;
    UPLOAD_URL = dependencies.UPLOAD_URL;
    allBooks = dependencies.allBooks;
    allFormats = dependencies.allFormats;
    classification = dependencies.classification;
    elements = dependencies.elements;
    applyTagFilters = dependencies.applyTagFilters;
    showSubsections = dependencies.showSubsections;
    showSections = dependencies.showSections;
    updateGlobalStats = dependencies.updateGlobalStats;
    normalizeText = dependencies.normalizeText;
}

export async function loadData() {
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

export async function loadClassification() {
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

export async function sincronizarClasificacion() {
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

export async function generateAiDescription(title, author) {
    const prompt = `Dame un resumen detallado de la obra "${title}" del autor "${author}" en formato Markdown, incluyendo los puntos clave de la trama, los temas principales y el estilo literario.`;
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
