const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// ⚠️ Reemplaza con tus credenciales reales
const supabaseUrl = 'https://fanyuclarbgwraiwbcmr.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZhbnl1Y2xhcmJnd3JhaXdiY21yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYwNTczMzIsImV4cCI6MjA3MTYzMzMzMn0.AzELqTp0swLGcUxHqF_E7E6UZJcEKUdNcXFiPrMGr-Q';
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugImport() {
  console.log('🔍 DIAGNÓSTICO PASO A PASO\n');
  
  // PASO 1: Verificar archivo JSON
  console.log('PASO 1: Verificando archivo JSON...');
  try {
    if (!fs.existsSync('catalogo_biblioteca.json')) {
      console.error('❌ ERROR: No se encuentra el archivo catalogo_biblioteca.json');
      console.log('📁 Archivos en la carpeta actual:');
      fs.readdirSync('.').forEach(file => console.log(`  - ${file}`));
      return;
    }
    console.log('✅ Archivo JSON encontrado');
  } catch (error) {
    console.error('❌ Error accediendo al archivo:', error.message);
    return;
  }

  // PASO 2: Leer y parsear JSON
  console.log('\nPASO 2: Leyendo contenido del JSON...');
  let books;
  try {
    const rawData = fs.readFileSync('catalogo_biblioteca.json', 'utf8');
    books = JSON.parse(rawData);
    console.log(`✅ JSON parseado correctamente`);
    console.log(`📊 Total de elementos: ${books.length}`);
    
    if (books.length === 0) {
      console.log('⚠️ El JSON está vacío');
      return;
    }
  } catch (error) {
    console.error('❌ Error leyendo/parseando JSON:', error.message);
    return;
  }

  // PASO 3: Examinar primer elemento
  console.log('\nPASO 3: Examinando estructura del primer libro...');
  const firstBook = books[0];
  console.log('📋 Primer libro:');
  console.log(`  - Título: ${firstBook.titulo}`);
  console.log(`  - Autor: ${firstBook.autor}`);
  console.log(`  - Carpeta Autor: ${firstBook.carpetaAutor}`);
  console.log(`  - Carpeta Obra: ${firstBook.carpetaObra}`);
  console.log(`  - Formatos: ${firstBook.formatos ? firstBook.formatos.length : 'undefined'}`);

  // PASO 4: Probar conexión a Supabase
  console.log('\nPASO 4: Probando conexión a Supabase...');
  try {
    const { data, error } = await supabase.from('books').select('count').limit(1);
    if (error) {
      console.error('❌ Error de conexión:', error);
      return;
    }
    console.log('✅ Conexión a Supabase exitosa');
  } catch (error) {
    console.error('❌ Error de red:', error.message);
    return;
  }

  // PASO 5: Inserción de prueba
  console.log('\nPASO 5: Intentando insertar el primer libro...');
  try {
    const testBook = {
      titulo: firstBook.titulo,
      autor: firstBook.autor,
      isbn: firstBook.isbn || null,
      editorial: firstBook.editorial || null,
      fecha_publicacion: null, // Empezamos con null para evitar errores de fecha
      idioma: firstBook.idioma || null,
      descripcion: firstBook.descripcion || null,
      genero: firstBook.genero || null,
      serie: firstBook.serie || null,
      numero_serie: firstBook.numeroSerie || null,
      carpeta_autor: firstBook.carpetaAutor,
      carpeta_obra: firstBook.carpetaObra,
      url_portada: firstBook.urlPortada || null,
      url_download_portada: firstBook.downloadUrlPortada || null,
      tamanio_total: firstBook.tamanoTotal || null
    };

    console.log('📤 Datos a insertar:');
    console.log(JSON.stringify(testBook, null, 2));

    const { data: insertedBook, error: insertError } = await supabase
      .from('books')
      .insert([testBook])
      .select()
      .single();

    if (insertError) {
      console.error('❌ Error insertando libro:', insertError);
      console.log('\n🔧 Posibles soluciones:');
      console.log('1. Verifica las políticas RLS en Supabase');
      console.log('2. Confirma que los nombres de campos coincidan con la tabla');
      console.log('3. Revisa que la clave API tenga permisos de escritura');
      return;
    }

    console.log(`✅ Libro insertado exitosamente con ID: ${insertedBook.id}`);

    // PASO 6: Insertar formatos si existen
    if (firstBook.formatos && firstBook.formatos.length > 0) {
      console.log(`\nPASO 6: Insertando ${firstBook.formatos.length} formato(s)...`);
      
      const formatsToInsert = firstBook.formatos.map(fmt => ({
        book_id: insertedBook.id,
        formato: fmt.formato,
        url: fmt.url,
        url_download: fmt.downloadUrl || null,
        tamanio: fmt.tamano || null
      }));

      const { error: formatsError } = await supabase
        .from('book_formats')
        .insert(formatsToInsert);

      if (formatsError) {
        console.error('❌ Error insertando formatos:', formatsError);
      } else {
        console.log(`✅ ${firstBook.formatos.length} formato(s) insertado(s)`);
      }
    }

    // PASO 7: Verificar datos insertados
    console.log('\nPASO 7: Verificando datos en la base...');
    const { data: verifyData } = await supabase
      .from('books')
      .select('id, titulo, autor')
      .eq('id', insertedBook.id)
      .single();

    console.log('✅ Verificación exitosa:', verifyData);

  } catch (error) {
    console.error('❌ Error durante la inserción:', error);
  }

  console.log('\n🎉 Diagnóstico completado');
  console.log('Si la inserción de prueba funcionó, puedes proceder con la importación completa');
}

debugImport();
