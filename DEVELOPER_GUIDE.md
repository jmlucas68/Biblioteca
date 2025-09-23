# Guía para Desarrolladores - Proyecto Biblioteca

## 1. Visión General

El proyecto Biblioteca es un sistema de gestión de libros digitales compuesto por tres partes principales:

1.  **Aplicación Principal (Biblioteca):** Una aplicación web estática (Single Page Application) donde los usuarios pueden explorar, buscar y ver los libros de la colección. Incluye un modo de administrador para editar metadatos.
2.  **Aplicación de Importación (Importer):** Una aplicación web independiente construida con Next.js, encargada de subir nuevos archivos de libros a Google Drive y registrar sus metadatos en la base de datos.
3.  **Backend (Supabase):** Una base de datos PostgreSQL gestionada a través de Supabase que almacena todos los metadatos de los libros, formatos y la estructura de clasificación.
4.  **Proxy de IA (Perplexity-Proxy-Backend):** Un servicio intermedio (desplegado por separado) que gestiona las llamadas a la API de Gemini para generar descripciones de libros, manteniendo la clave de API segura.

---

## 2. Aplicación Principal (Biblioteca)

Esta es la interfaz principal para los usuarios. Al ser estática, puede ser desplegada en cualquier servidor de archivos estáticos como GitHub Pages.

### 2.1. Tech Stack

-   **HTML5**
-   **CSS3** (con un diseño responsive)
-   **JavaScript (ES6+)**
-   **Supabase.js:** Cliente de Supabase cargado vía CDN para interactuar con la base de datos.
-   **Marked.js:** Para renderizar descripciones de libros escritas en Markdown.
-   **EPUB.js / PDF.js:** Para extraer metadatos y portadas de los archivos de los libros.

### 2.2. Puesta en Marcha

1.  **Configuración de Supabase:**
    -   Abre el fichero `script.js`.
    -   Localiza las variables `supabaseUrl` y `supabaseKey` al principio del archivo.
    -   Reemplaza los valores con tus propias credenciales de Supabase.

2.  **Ejecución:**
    -   No requiere un servidor web. Simplemente abre el fichero `index.html` en tu navegador.

### 2.3. Características Clave

-   **Navegación por Jerarquía:** Explora libros a través de Secciones y Subsecciones.
-   **Búsqueda Avanzada:** Filtra por título, autor, género, serie, editorial, año y formato.
-   **Modo Administrador:** Protegido por contraseña, permite editar los metadatos de los libros y la estructura de clasificación. La validación de la contraseña se delega en el proxy de IA.
-   **Generación de Descripciones con IA:** En el modo de edición, un botón permite generar automáticamente una descripción del libro utilizando el servicio de proxy.

---

## 3. Aplicación de Importación (`importer/`)

Una aplicación web dedicada para añadir nuevos libros al sistema.

### 3.1. Tech Stack

-   **Next.js** (con Turbopack)
-   **React**
-   **TypeScript**
-   **Tailwind CSS** (configurado pero puede no estar en uso extensivo)
-   **Google APIs (`googleapis`):** Para subir archivos a Google Drive.
-   **Supabase.js:** Para registrar los metadatos en la base de datos.

### 3.2. Puesta en Marcha

1.  **Navegación:**
    -   Abre una terminal y navega al directorio `importer/`:
        ```bash
        cd ruta/a/Biblioteca/importer
        ```

2.  **Instalación de Dependencias:**
    -   Instala los paquetes necesarios usando npm:
        ```bash
        npm install
        ```

3.  **Configuración de Entorno:**
    -   Crea un fichero `.env.local` en la raíz del directorio `importer/`.
    -   Añade las siguientes variables de entorno con tus credenciales:
        ```
        # Supabase
        NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
        NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_de_supabase

        # Google Drive
        GOOGLE_SERVICE_ACCOUNT=el_contenido_json_de_tu_cuenta_de_servicio
        GOOGLE_DRIVE_FOLDER_ID=el_id_de_la_carpeta_en_google_drive
        ```

4.  **Ejecución en Desarrollo:**
    -   Inicia el servidor de desarrollo de Next.js:
        ```bash
        npm run dev
        ```
    -   La aplicación estará disponible en `http://localhost:3000`.

### 3.3. Comandos Útiles

-   `npm run dev`: Inicia el servidor de desarrollo.
-   `npm run build`: Compila la aplicación para producción.
-   `npm run start`: Inicia el servidor de producción (después de un `build`).
-   `npm run lint`: Ejecuta el linter para revisar la calidad del código.

---

## 4. Backend (Supabase)

Supabase actúa como el backend principal, proporcionando la base de datos y una API para interactuar con ella.

### 4.1. Estructura de Datos

-   **`books`:** Almacena los metadatos principales de cada libro (título, autor, descripción, etc.).
-   **`book_formats`:** Almacena los diferentes formatos de archivo para cada libro (PDF, EPUB, etc.) y sus URLs.
-   **`clasificacion`:** Contiene un único registro JSON que define la estructura de secciones, subsecciones y tags.

### 4.2. Seguridad

-   **Row Level Security (RLS):** Es **crítico** habilitar RLS en tus tablas de Supabase, especialmente si la `anon_key` está expuesta en el cliente. Define políticas que restrinjan las operaciones de escritura (insert, update, delete) solo a usuarios autenticados (si implementas autenticación) o a través de funciones seguras en el servidor.
-   **Claves de API:** La `service_role_key` de Supabase nunca debe ser expuesta en el lado del cliente.

---

## 5. Proxy de IA (`perplexity-proxy-backend`)

Este es un proyecto **separado** y no se encuentra en este repositorio. Su función es actuar como un intermediario seguro entre la aplicación de Biblioteca y la API de Gemini de Google.

-   **Propósito:**
    1.  **Ocultar la Clave de API:** La clave de la API de Gemini se almacena de forma segura en las variables de entorno del proxy, nunca en el cliente.
    2.  **Gestionar CORS:** Permite que el frontend (desplegado en un dominio diferente) pueda hacer llamadas a la API de IA.
    3.  **Validar Contraseña de Admin:** Centraliza la lógica de validación de la contraseña del modo administrador.