const fs = require('fs-extra');
const path = require('path');
const { generateReport } = require('../src/services/pdfGenerator');

async function testWithManyCompetencies() {
  try {
    console.log('🚀 Iniciando prueba con múltiples competencias...\n');

    // Cargar datos base
    const dataPath = path.join(__dirname, 'alxia.json');
    const data = await fs.readJson(dataPath);

    // Crear conjuntos de competencias de diferentes tamaños
    const tests = [
      {
        name: 'Sin competencias bajas',
        modifyData: (data) => {
          data.competencias = data.competencias.filter(c => c.puntaje >= 5);
        }
      },
      {
        name: '10 competencias altas',
        modifyData: (data) => {
          const highCompetencies = [];
          for (let i = 1; i <= 10; i++) {
            highCompetencies.push({
              nombre: `Competencia Alta ${i}`,
              puntaje: Math.random() > 0.5 ? 8 : 9,
              definicion: `Definición de competencia alta ${i}`,
              descripcion: `Descripción detallada de la competencia alta número ${i}`,
              analisisDetallado: `Análisis prosódico y detallado de la competencia ${i}`
            });
          }
          data.competencias = [
            ...highCompetencies,
            ...data.competencias.filter(c => c.puntaje < 7)
          ];
        }
      },
      {
        name: '15 competencias medias',
        modifyData: (data) => {
          const mediumCompetencies = [];
          for (let i = 1; i <= 15; i++) {
            mediumCompetencies.push({
              nombre: `Competencia Media ${i}`,
              puntaje: Math.random() > 0.5 ? 5 : 6,
              definicion: `Definición de competencia media ${i}`,
              descripcion: `Descripción de la competencia media número ${i}`,
              analisisDetallado: `Análisis de la competencia media ${i}`
            });
          }
          data.competencias = [
            ...data.competencias.filter(c => c.puntaje >= 7),
            ...mediumCompetencies,
            ...data.competencias.filter(c => c.puntaje < 5)
          ];
        }
      }
    ];

    // Crear directorio de salida
    const outputDir = path.join(__dirname, '..', 'generated-pdfs');
    await fs.ensureDir(outputDir);

    // Ejecutar cada test
    for (const test of tests) {
      console.log(`📝 Test: ${test.name}`);

      // Clonar datos y modificar
      const testData = JSON.parse(JSON.stringify(data));
      test.modifyData(testData);

      // Generar nombre único
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `test-${test.name.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.pdf`;
      const outputPath = path.join(outputDir, fileName);

      // Generar PDF
      console.log('   Generando PDF...');
      await generateReport(testData, outputPath);

      // Verificar
      const stats = await fs.stat(outputPath);
      console.log(`   ✅ PDF generado: ${(stats.size / 1024).toFixed(2)} KB\n`);
    }

    console.log('🎉 Todas las pruebas completadas exitosamente!');
    console.log(`📁 Los PDFs están en: ${outputDir}`);

  } catch (error) {
    console.error('❌ Error en la prueba:', error);
    process.exit(1);
  }
}

// Ejecutar prueba
testWithManyCompetencies();