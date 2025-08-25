const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://your-project-id.supabase.co';
const supabaseKey = 'your-anon-public-key-here';
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyImport() {
  try {
    // Contar libros
    const { count: booksCount } = await supabase
      .from('books')
      .select('*', { count: 'exact', head: true });
    
    // Contar formatos
    const { count: formatsCount } = await supabase
      .from('book_formats')
      .select('*', { count: 'exact', head: true });
    
    // Muestra de datos
    const { data: sampleBooks } = await supabase
      .from('books_with_formats')
      .select('*')
      .limit(3);
    
    console.log('📊 Estadísticas de importación:');
    console.log(`📚 Total libros: ${booksCount}`);
    console.log(`💿 Total formatos: ${formatsCount}`);
    console.log('\n🔍 Muestra de datos:');
    sampleBooks?.forEach(book => {
      console.log(`- "${book.titulo}" por ${book.autor} (${book.formatos?.length || 0} formatos)`);
    });
    
  } catch (error) {
    console.error('Error verificando:', error);
  }
}

verifyImport();
