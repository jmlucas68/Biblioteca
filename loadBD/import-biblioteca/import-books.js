const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// ⚠️ CAMBIAR POR TUS CREDENCIALES
const supabaseUrl = 'https://fanyuclarbgwraiwbcmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbnl1Y2xhcmJnd3JhaXdiY21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTczMzIsImV4cCI6MjA3MTYzMzMzMn0.AzELqTp0swLGcUxHqF_E7E6UZJcEKUdNcXFiPrMGr-Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function importBooksFromJSON() {
  try {
    console.log('🚀 Iniciando diagnóstico e importación...');
    
    // DIAGNÓSTICO 1: Verificar que el JSON existe y se lee
    console.log('📁 Verificando archivo JSON...');
    if (!fs.existsSync('catalogo_biblioteca.json')) {
      console.error('❌ Error: No se encuentra catalogo_biblioteca.json');
      return;
    }
    
    const rawData = fs.readFileSync('catalogo_biblioteca.json', 'utf8');
    console.log('✅ Archivo JSON leído correctamente');
    
    // DIAGNÓSTICO 2: Parsear y verificar contenido
    const books = JSON.parse(rawData);
    console.log(`📚 Total de libros en JSON: ${books.length}`);
    
    if (books.length === 0) {
      console.log('⚠️ El JSON está vacío o no contiene libros');
      return;
    }
    
    // DIAGNÓSTICO 3: Mostrar estructura del primer libro
    console.log('🔍 Estructura del primer libro:');
    console.log(JSON.stringify(books[0], null, 2));
    
    // DIAGNÓSTICO 4: Verificar conexión con Supabase
    console.log('🔗 Probando conexión con Supabase...');
    const { data: testData, error: testError } = await supabase
      .from('books')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Error de conexión con Supabase:', testError);
      return;
    }
    console.log('✅ Conexión con Supabase exitosa');
    
    let importedCount = 0;
    let errorCount = 0;
    
    // DIAGNÓSTICO 5: Procesar solo los primeros 3 libros para prueba
    const booksToProcess = books; // Cambiar por books para procesar todos
    console.log(`🧪 Procesando primeros ${booksToProcess.length} libros como prueba...`);
    
    for (const [index, book] of booksToProcess.entries()) {
      try {
        console.log(`\n📖 [${index + 1}/${booksToProcess.length}] Procesando: "${book.titulo}"`);
        console.log(`👤 Autor: ${book.autor}`);
        
        // DIAGNÓSTICO 6: Mostrar datos que se van a insertar
        const bookData = {
          titulo: book.titulo,
          autor: book.autor,
          isbn: book.isbn || null,
          editorial: book.editorial || null,
          fecha_publicacion: book.fechaPublicacion && !book.fechaPublicacion.startsWith('0101-01-01') 
            ? new Date(book.fechaPublicacion).toISOString() 
            : null,
          idioma: book.idioma || null,
          descripcion: book.descripcion || null,
          genero: book.genero || null,
          serie: book.serie || null,
          numero_serie: book.numeroSerie || null,
          carpeta_autor: book.carpetaAutor,
          carpeta_obra: book.carpetaObra,
          url_portada: book.urlPortada || null,
          url_download_portada: book.downloadUrlPortada || null,
          tamanio_total: book.tamanoTotal || null
        };
        
        console.log('📋 Datos a insertar:', JSON.stringify(bookData, null, 2));
        
        // DIAGNÓSTICO 7: Insertar libro con logs detallados
        console.log('⏳ Insertando en tabla books...');
        const { data: insertedBook, error: bookError } = await supabase
          .from('books')
          .insert([bookData])
          .select()
          .single();

        if (bookError) {
          console.error(`❌ Error insertando libro "${book.titulo}":`, bookError);
          errorCount++;
          continue;
        }
        
        console.log(`✅ Libro insertado con ID: ${insertedBook.id}`);
        
        // DIAGNÓSTICO 8: Insertar formatos si existen
        if (book.formatos && book.formatos.length > 0) {
          console.log(`📁 Insertando ${book.formatos.length} formato(s)...`);
          
          const formatsToInsert = book.formatos.map(fmt => ({
            book_id: insertedBook.id,
            formato: fmt.formato,
            url: fmt.url,
            url_download: fmt.downloadUrl || null,
            tamanio: fmt.tamano || null
          }));
          
          console.log('📋 Formatos a insertar:', JSON.stringify(formatsToInsert, null, 2));
          
          const { error: formatsError } = await supabase
            .from('book_formats')
            .insert(formatsToInsert);

          if (formatsError) {
            console.error(`⚠️ Error insertando formatos:`, formatsError);
          } else {
            console.log(`✅ ${book.formatos.length} formato(s) insertado(s)`);
          }
        }
        
        importedCount++;
        
      } catch (bookError) {
        console.error(`💥 Error procesando "${book.titulo}":`, bookError);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Diagnóstico completado:');
    console.log(`✅ Libros importados: ${importedCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    
    // DIAGNÓSTICO 9: Verificar que los datos se insertaron
    console.log('\n🔍 Verificando datos insertados en la base de datos...');
    const { data: insertedBooks, error: countError } = await supabase
      .from('books')
      .select('id, titulo, autor')
      .limit(5);
    
    if (countError) {
      console.error('❌ Error verificando datos:', countError);
    } else {
      console.log(`📊 Libros en la base de datos:`, insertedBooks);
    }
    
  } catch (error) {
    console.error('💥 Error general:', error);
  }
}

// Ejecutar diagnóstico
importBooksFromJSON();
