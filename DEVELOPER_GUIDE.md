
# DEVELOPER_GUIDE.md

## Resumen

Aplicación web de biblioteca personal en HTML/JS estático que permite explorar libros por secciones/subsecciones, realizar búsqueda avanzada, ver detalles y editar metadatos; incluye un editor visual para la taxonomía de clasificación; persistencia en Supabase mediante @supabase/supabase-js v2 y operaciones directas desde el navegador.[^2][^1]

## Arquitectura

- Entradas: index.html (exploración/búsqueda/edición) y editor-clasificacion-visual.html (CRUD de clasificación), abiertas en pestañas independientes mediante window.open.[^1][^2]
- SPA ligera: conmutación de vistas por clases .view/.active; modales para detalles, edición y búsqueda avanzada; estado en variables globales; render por strings HTML con sanitización mediante esc().[^2]
- Persistencia: Supabase JS v2 por CDN; tablas utilizadas: books, book_formats, clasificacion; llamadas select/order, update, upsert y update por id.[^1][^2]


## Contrato de datos

- books:
    - id: number; titulo: string (requerido); autor: string|null; genero: string|null (CSV de tags); serie: string|null; numero_serie: string|null; editorial: string|null; fecha_publicacion: string|date|null; descripcion: string|null; carpeta_obra: string|null; url_portada: string|null.[^2]
    - Derivados en cliente: año = fecha_publicacion.slice(0,4); pertenencia a subsecciones por intersección de tags normalizados con classification.[^2]
- book_formats:
    - book_id: number; formato: string; url_download: string|null; ruta_archivo: string|null; tamano_mb: number|null.[^2]
- clasificacion:
    - id: number; data: JSON en una de dos formas: { classification: { sections } } o { sections }.[^1]
    - Estructura: { sections: { [SECTION_KEY]: { name: string, subsections: { [SUB_KEY]: { name: string, tags: string[] } } } } }.[^1]
- Validaciones:
    - Claves de sección/subsección: /^[A-Z0-9_]+\$/; únicas por ámbito; Name libre; Tags como lista string.[^1]
    - Título de libro obligatorio; otros campos opcionales con null al guardar; normalización de textos para búsqueda y matching de tags.[^2]


## Rutas lógicas y navegación

- index.html:
    - Vistas: Sections → Subsections → Books; breadcrumbs y backButton para regresar; botón para abrir el editor de clasificación en nueva pestaña.[^2]
    - Modales: Book Details, Edit Book, Advanced Search; todos controlados por clases .modal/.show y IDs específicos.[^2]
- editor-clasificacion-visual.html:
    - Vistas: Sections → Subsections → Tags; modal de confirmación de borrado; feedback en messageArea.[^1]


## IDs y clases clave

- index.html:
    - Vistas/Grids: sectionsView, subsectionsView, booksView, sectionsGrid, subsectionsGrid, booksGrid.[^2]
    - Navegación/UI: breadcrumb, backButton, searchContainer, sortSelect, searchInput, totalBooks, totalFormats, totalAuthors.[^2]
    - Modales: bookModal, modalContent, closeModal, editModal, searchModal.[^2]
    - Búsqueda avanzada: searchQuery, includeDescription, searchAutor, searchGenero, searchSerie, searchEditorial, searchYear, searchFormato, searchResults; inputs espejo: searchAutorInput, searchGeneroInput.[^2]
    - Form edición libro: editForm con editTitulo, editAutor, editGenero, editSerie, editNumeroSerie, editEditorial, editFechaPublicacion, editDescripcion, editCarpetaObra.[^2]
- editor-clasificacion-visual.html:
    - Vistas/Grids: sectionsView, subsectionsView, tagsView, sectionsGrid, subsectionsGrid, tagsGrid.[^1]
    - Controles: addItemButton, addButtonText, addNewForm, newItemKey, newItemName, newItemTags, newTagGroup.[^1]
    - Borrado/feedback: deleteModal, deleteMessage, messageArea.[^1]
- Clases recurrentes: .view/.active, .grid, .grid--books, .grid--sections, .modal(.show), .btn(.btn--primary/.btn--success/.btn--error/.btn--outline), .form-control, .form-group, .breadcrumb, .header, .stat/.stat-number.[^1][^2]


## API con Supabase

- Inicialización:
    - const { createClient } = supabase; const supabaseClient = createClient(supabaseUrl, supabaseKey).[^1][^2]
- Lecturas:
    - Libros: supabaseClient.from('books').select('*').order('titulo').[^2]
    - Formatos: supabaseClient.from('book_formats').select('*').[^2]
    - Clasificación: supabaseClient.from('clasificacion').select('id, data').limit(1).single().[^1]
- Escrituras:
    - Actualizar libro: supabaseClient.from('books').update(updatedData).eq('id', bookId).[^2]
    - Upsert masivo de géneros: supabaseClient.from('books').upsert([{ id, genero }, ...]).[^2]
    - Guardar clasificación: supabaseClient.from('clasificacion').update({ data: currentClassification }).eq('id', clasificacionRowId).[^1]
- Notas:
    - La forma de data puede venir como { classification } o directamente { sections }, se normaliza a currentClassification.[^1]
    - Actualmente no hay paginación ni filtros server-side en las lecturas; toda la colección se trae al cliente.[^2]


## Funciones y lógica de negocio

- Carga y arranque (index):
    - DOMContentLoaded → loadData() → loadClassification() → sincronizarClasificacion() → populateSearchFilters() → showSections() → setupEventListeners().[^2]
- Búsqueda avanzada:
    - performSearch(): filtro por texto libre en titulo, autor, genero, serie, editorial y formatos; includeDescription permite buscar en descripcion; filtros exactos por selects; render en searchResults.[^2]
    - normalizeText(str): trim → toLowerCase → NFD → elimina diacríticos; base para matching y búsqueda tolerante a acentos.[^2]
- Clasificación de libros:
    - isBookInAnySubsection(book, classification): compara géneros del libro con tags de subsecciones; si hay intersección, el libro está clasificado.[^2]
    - sincronizarClasificacion(): añade “Sin_clasificar” a libros sin match y elimina dicho tag si el libro sí encaja; agrupa updates y ejecuta upsert.[^2]
- Render y navegación:
    - showSections(), showSubsections(sectionKey), showBooks(sectionKey, subsectionKey): pintan grids, breadcrumbs y exponen tags clicables con modo OR/AND para refinar; filterBooksByTags, filterBooksByTagsOR/AND para combinar.[^2]
    - showBookDetails(id): modal con portada, metadatos, formatos descargables y atajos para saltar a subsecciones donde aparece; showEditModal(id) y saveBookChanges() para edición y persistencia.[^2]
- Visor de Libros:
    - openViewer(event, formatUrl, bookTitle, formatName): Función asíncrona que abre un modal para visualizar documentos. Transforma URLs de Google Drive (drive.google.com/uc?id=...) a un formato incrustable (drive.google.com/file/d/.../preview) para evitar problemas de CORS. Para otras URLs, intenta usar el visor de Google Docs (docs.google.com/viewer).
    - buildPreviewUrl(viewUrl): Función auxiliar que genera la URL de previsualización adecuada para incrustar documentos, priorizando el formato de Google Drive /preview.
    - closeViewer(): Cierra el modal del visor y limpia el iframe.

- **Generación de Descripción con IA:**
    - `generateAiDescription(title, author)`: Función asíncrona que interactúa con un proxy de Gemini para generar una descripción de libro basada en el título y autor. Construye un prompt en español solicitando una descripción en formato Markdown.
    - **Proxy de Gemini:** La aplicación se conecta a un proxy (`perplexity-proxy-backend`) desplegado (ej. en Vercel) o ejecutándose localmente (`http://localhost:3000/api/proxy`). Este proxy es el encargado de comunicarse con la API de Gemini, ocultando la clave de API y gestionando las políticas CORS.
    - **Integración:** El botón "Descripción IA" en el modal de edición de libros (`editModal`) invoca esta función y rellena el campo `editDescripcion` con la respuesta generada.
    - **Formato de Salida:** La descripción generada se espera en formato Markdown, lo que permite un renderizado enriquecido en la interfaz de usuario.

- Editor de clasificación:
    - loadClassification(): obtiene id y data; currentClassification = data.data.classification || data.data.[^1]
    - showSections/showSubsections/showTags y renders asociados; confirmAdd(): valida claves y unicidad, añade sección/subsección o tags; deleteItem()/confirmDelete() con restricciones jerárquicas; saveChanges() persiste en Supabase.[^1]


## Ejemplos de código

- Carga de libros y formatos:
    - const { data: books } = await supabaseClient.from('books').select('*').order('titulo'); const { data: formats } = await supabaseClient.from('book_formats').select('*').[^2]
- Actualizar un libro:
    - await supabaseClient.from('books').update({ titulo, autor: autor || null, genero: genero || null, serie: serie || null, numero_serie: numero || null, editorial: editorial || null, fecha_publicacion: fecha || null, descripcion: desc || null, carpeta_obra: carpeta || null }).eq('id', bookId).[^2]
- Guardar clasificación:
    - await supabaseClient.from('clasificacion').update({ data: currentClassification }).eq('id', clasificacionRowId).[^1]
- Sincronización “Sin_clasificar”:
    - await supabaseClient.from('books').upsert(updatesArrayDeIdGenero).[^2]


## Reglas y validaciones

- Claves de sección/subsección: /^[A-Z0-9_]+\$/; únicas en su ámbito; para eliminar, la sección no debe tener subsecciones y la subsección no debe tener tags.[^1]
- Form edición de libro: “Título” requerido; resto opcional; null en campos vacíos para consistencia en BD.[^2]
- Búsqueda: normalización NFD sin acentos; filtros exactos por selects; OR/AND en selección de tags de subsección.[^2]


## Seguridad

### Modo Administrador

Se ha implementado un sistema de "Modo Administrador" para proteger las funcionalidades de edición, incluyendo la modificación de la clasificación y la edición de los metadatos de los libros.

- **Activación:** El acceso al modo administrador se controla mediante una contraseña. Al hacer clic en el botón "Login", se muestra un modal donde el usuario debe introducir la contraseña.
- **Validación de Contraseña:** La contraseña se valida enviándola a un endpoint específico (`action: 'validate_password'`) del proxy de Gemini. El proxy compara la contraseña recibida con una variable de entorno segura (`ADMIN_PASSWORD`).
- **Gestión de Estado:** Una vez validada la contraseña, se crea una cookie llamada `isAdmin` con el valor `true`. Esta cookie se utiliza para mantener el estado de administrador entre sesiones. Al recargar la página, si la cookie `isAdmin` existe y es válida, la aplicación entra directamente en modo administrador.
- **Controles de UI:** Los botones y controles de edición (ej. "Editar Clasificación", "Editar" en las tarjetas de libro, "Guardar cambios") solo son visibles y funcionales cuando la aplicación está en modo administrador. La función `enableAdminFeatures()` se encarga de mostrar estos controles, mientras que `disableAdminFeatures()` los oculta.
- **Cierre de Sesión:** El botón "Logoff" elimina la cookie `isAdmin` y recarga la página, volviendo al modo de solo lectura.

### Otros Aspectos de Seguridad

- **Proxy de Gemini:** El proxy (`perplexity-proxy-backend`) gestiona la clave de API de Gemini (a través de variables de entorno) y las políticas CORS (`allowedOrigins`) para controlar el acceso a la API de IA.
- **Claves de Supabase:** Las claves y URL de Supabase están inyectadas en el cliente. Es imprescindible configurar RLS (Row Level Security) en las tablas de Supabase y considerar añadir un sistema de autenticación más robusto (Supabase Auth) para proteger las operaciones de escritura.
- **Sanitización de Entradas:** Se utiliza una función `esc(s)` para sanitizar todas las cadenas de texto que se renderizan en el HTML mediante `innerHTML`. Esto previene ataques de tipo Cross-Site Scripting (XSS).


## Rendimiento

- Carga completa de libros y formatos al inicio; conteos y filtrados en cliente; considerar:
    - Paginación .range() o limit/offset; proyección selectiva de columnas.[^2]
    - FTS en Supabase para búsqueda por texto y descripción; índices GIN; vistas materializadas para conteos por sección/subsección.[^2]


## Testing y observabilidad

- Selectores E2E recomendados:
    - Index: \#sectionsGrid, \#subsectionsGrid, \#booksGrid, \#searchModal, \#searchQuery, \#editForm, \#editTitulo, \#sortSelect, \#backButton, \#modalContent.[^2]
    - Editor: \#sectionsGrid, \#subsectionsGrid, \#tagsGrid, \#addNewForm, \#newItemKey, \#newItemName, \#newItemTags, \#deleteModal, \#deleteMessage, \#messageArea.[^1]
- Casos clave:
    - Validación de borrados con restricciones; flujo de edición y refresco de listas; búsqueda con includeDescription; selección OR/AND de tags y filtro incremental en Books.[^1][^2]
- Logs: existen logs de sincronización y errores en consola; proponer logging estructurado y métricas básicas de latencia de select/update/upsert.[^2]


## Roadmap sugerido

## Roadmap sugerido

- **Funcionalidad implementada:** Generación de descripciones de libros con IA (Gemini) a través de un proxy.
- Seguridad: integrar Auth + RLS; roles mínimos; mover upsert/updates masivos a edge functions RPC.[^1][^2]
- Escalado: paginación e infinite scroll; FTS para búsquedas; vistas/materialized views para conteos; caché de portadas y carga diferida.[^2]
- UX: autocompletado real de filtros; edición en masa y asignación asistida de subsecciones; virtualización de grids.[^2]
- Datos: formalizar relación many-to-many de formatos y validar URLs; versionado de clasificación y auditoría de cambios.[^1]
- Calidad: extracción a módulos/plantillas, tipado con TS, pruebas unitarias de normalizeText/esc y de lógica de sincronización.[^2]


## Anexos rápidos

- Utilidades:
    - normalizeText(str): base de búsqueda y matching; elimina diacríticos.[^2]
    - esc(s): evita inyección en renders.[^1][^2]
    - resolveCoverThumb(url): genera thumbnails de Google Drive (sz=w400) si aplica.[^2]
- Elementos estadísticos:
    - totalBooks, totalFormats, totalAuthors actualizados tras loadData().[^2]

<div style="text-align: center">⁂</div>

[^1]: editor-clasificacion-visual.html

[^2]: index.html

