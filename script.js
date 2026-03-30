import { initAuth, showLoginModal, enterAdminMode, enterReadOnlyMode, validatePassword } from './modules/auth.js';
import { initApi, loadData, loadClassification, sincronizarClasificacion, generateAiDescription } from './modules/api.js';
import { initUI, populateElements, showSections, populateSearchFilters, applyHeaderPinState, toggleHeaderPin } from './modules/ui.js';
import { initImporter, handleFileSelect, saveNewBook, closeImportModal } from './modules/importer.js';
import { initEventListeners, setupEventListeners } from './modules/events.js';
import * as state from './modules/state.js';
import { getCookie, setCookie, deleteCookie, esc, hash, extractDriveId, resolveCoverThumb, isHTML, normalizeText } from './modules/utils.js';

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

async function loadInitialData() {
    try {
        // Run data loading in parallel for efficiency
        await Promise.all([loadData(), loadClassification()]);

        // Add a critical check to ensure classification data is loaded
        if (!state.classification) {
            throw new Error("La clasificación de la biblioteca no pudo ser cargada. No se puede mostrar la interfaz.");
        }

        if(state.isAdmin) {
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

    initAuth({
        isAdmin: state.isAdmin,
        loadInitialData,
        showSections,
        GEMINI_PROXY_URL,
    });

    initApi({
        supabaseClient,
        GEMINI_PROXY_URL,
        UPLOAD_URL,
        allBooks: state.allBooks,
        allFormats: state.allFormats,
        classification: state.classification,
        elements: state.elements,
        applyTagFilters,
        showSubsections,
        showSections,
        updateGlobalStats,
        normalizeText,
    });

    initUI({
        elements: state.elements,
        allBooks: state.allBooks,
        allFormats: state.allFormats,
        classification: state.classification,
        currentSection: state.currentSection,
        currentSubsection: state.currentSubsection,
        filteredBooks: state.filteredBooks,
        currentBooks: state.currentBooks,
        currentEditingBook: state.currentEditingBook,
        tagFilterLogic: state.tagFilterLogic,
        esc,
        resolveCoverThumb,
        isAdmin: state.isAdmin,
        getBookFormats: (bookId) => state.allFormats.filter(format => format.book_id === bookId),
        normalizeText,
        isHTML,
        showSubsections,
        showBooks,
        showSections,
        applyTagFilters,
        filterBooksByTagsOR,
        filterBooksByTagsAND,
        closeModal,
        closeEditModal,
        openSearchModal,
        closeSearchModal,
        openViewer,
        closeViewer,
        clearSearch,
        performSearch,
        filterBooks,
        sortBooks,
        goBack,
        showBookDetails,
        showEditModal,
        searchByAuthor,
        searchBySerie,
    });

    initImporter({
        elements: state.elements,
        loading: state.elements.loading,
        importModal: state.elements.importModal,
        importForm: state.elements.importForm,
        selectedFileForImport: state.selectedFileForImport,
        UPLOAD_URL,
        supabaseClient,
        allFormats: state.allFormats,
        allBooks: state.allBooks,
        updateGlobalStats,
        applyTagFilters,
        showSubsections,
        showSections,
        classification: state.classification,
        currentSection: state.currentSection,
        currentSubsection: state.currentSubsection,
    });
    
    initEventListeners({
        elements: state.elements,
        handleFileSelect,
        saveNewBook,
        closeImportModal,
        goBack,
        filterBooks,
        sortBooks,
        closeModal,
        closeEditModal,
        openSearchModal,
        closeSearchModal,
        closeViewer,
        generateAiDescription,
        currentEditingBook: state.currentEditingBook,
        toggleHeaderPin,
        logoff,
        showLoginModal,
        isAdmin: state.isAdmin,
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
