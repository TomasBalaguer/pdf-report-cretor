const fs = require('fs-extra');
const path = require('path');
const { generateReport } = require('../src/services/pdfGenerator');

async function testPDFGeneration() {
  try {
    console.log('🚀 Iniciando prueba de generación de PDF...\n');

    // Cargar datos de prueba
    const sampleDataPath = path.join(__dirname, 'sample-data.json');
    const sampleData = await fs.readJson(sampleDataPath);
    console.log('✅ Datos de prueba cargados correctamente');

    // Crear directorio de salida si no existe
    const outputDir = path.join(__dirname, '..', 'generated-pdfs');
    await fs.ensureDir(outputDir);
    console.log('✅ Directorio de salida verificado');

    // Generar nombre único para el PDF
    const timestamp = new Date().toISOString().replace(/[:]/g, '-').split('.')[0];
    const outputFileName = `reporte-competencias-${timestamp}.pdf`;
    const outputPath = path.join(outputDir, outputFileName);

    // Generar el PDF
    console.log('📄 Generando PDF...');
    await generateReport(sampleData, outputPath);

    // Verificar que el archivo fue creado
    const fileExists = await fs.pathExists(outputPath);
    if (fileExists) {
      const stats = await fs.stat(outputPath);
      console.log(`\n✅ PDF generado exitosamente:`);
      console.log(`   📁 Archivo: ${outputFileName}`);
      console.log(`   📏 Tamaño: ${(stats.size / 1024).toFixed(2)} KB`);
      console.log(`   📍 Ubicación: ${outputPath}`);
    } else {
      throw new Error('El archivo PDF no fue creado');
    }

    console.log('\n🎉 Prueba completada exitosamente');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error durante la prueba:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Ejecutar la prueba
testPDFGeneration();