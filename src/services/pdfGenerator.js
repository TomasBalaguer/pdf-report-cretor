const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('path');

const chartGenerator = require('./chartGenerator');
const { agruparCompetencias } = require('./validator');

// Registrar helpers de Handlebars
handlebars.registerHelper('lt', function(a, b) {
  return a < b;
});

handlebars.registerHelper('gte', function(a, b) {
  return a >= b;
});

handlebars.registerHelper('if', function(conditional, options) {
  if (conditional) {
    return options.fn(this);
  } else {
    return options.inverse(this);
  }
});

/**
 * Genera un reporte PDF de competencias
 * @param {Object} data - Datos del reporte
 * @param {String} outputPath - Ruta donde guardar el PDF
 */
async function generateReport(data, outputPath) {
  let browser;

  try {
    console.log('🔄 Iniciando generación de PDF...');

    // Preparar los datos
    const reportData = await prepareReportData(data);

    // Cargar templates
    const templatePath = path.join(__dirname, '..', 'templates', 'report.hbs');
    const templateHtml = await fs.readFile(templatePath, 'utf8');

    // Cargar CSS
    const cssPath = path.join(__dirname, '..', 'templates', 'styles', 'report.css');
    const css = await fs.readFile(cssPath, 'utf8');
    reportData.css = css;

    // Registrar partials
    await registerPartials();

    // Compilar template
    const template = handlebars.compile(templateHtml);
    const html = template(reportData);

    // Iniciar Puppeteer
    console.log('🌐 Iniciando navegador...');
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Configurar la página
    await page.setContent(html, {
      waitUntil: ['domcontentloaded', 'networkidle0'],
      timeout: 30000
    });

    // Esperar a que se carguen las imágenes
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generar PDF
    console.log('📄 Generando PDF...');
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: false,
      margin: {
        top: '0mm',
        bottom: '0mm',
        left: '0mm',
        right: '0mm'
      },
      preferCSSPageSize: true
    });

    console.log('✅ PDF generado exitosamente');

  } catch (error) {
    console.error('❌ Error generando PDF:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Prepara los datos del reporte
 * @param {Object} data - Datos crudos del reporte
 * @returns {Object} - Datos procesados para el template
 */
async function prepareReportData(data) {
  const reportData = { ...data };

  // Generar gráfico radar si hay datos
  if (data.datosGraficoRadar) {
    try {
      console.log('📊 Generando gráfico radar...');
      reportData.chartRadar = await chartGenerator.generateRadarChart(data.datosGraficoRadar);
    } catch (error) {
      console.error('Error generando gráfico radar:', error);
    }
  }

  // Agrupar competencias por categoría
  if (data.competencias) {
    reportData.competenciasAgrupadas = agruparCompetencias(data.competencias);

    // Calcular altura dinámica para cada grupo de competencias
    // Altura disponible aproximada: 210mm (después del header y título)
    const ALTURA_DISPONIBLE_MM = 210;

    // Calcular clase CSS según cantidad de competencias para cada grupo
    ['fortalezas', 'desarrollo', 'oportunidades'].forEach(grupo => {
      if (reportData.competenciasAgrupadas[grupo]) {
        const count = reportData.competenciasAgrupadas[grupo].length;
        if (count > 0) {
          // Calcular altura por tarjeta (en mm)
          const alturaCard = Math.floor(ALTURA_DISPONIBLE_MM / count);
          // Determinar clase CSS basada en la cantidad
          let sizeClass = 'card-auto';
          if (count <= 3) sizeClass = 'card-xl';
          else if (count <= 5) sizeClass = 'card-lg';
          else if (count <= 8) sizeClass = 'card-md';
          else if (count <= 12) sizeClass = 'card-sm';
          else sizeClass = 'card-xs';

          reportData.competenciasAgrupadas[`${grupo}SizeClass`] = sizeClass;
          reportData.competenciasAgrupadas[`${grupo}Count`] = count;
        }
      }
    });

    // Crear listas de fortalezas y oportunidades
    reportData.fortalezasList = reportData.competenciasAgrupadas.fortalezas
      .slice(0, 5)
      .map(c => c.nombre);

    reportData.oportunidadesList = reportData.competenciasAgrupadas.oportunidades
      .slice(0, 5)
      .map(c => c.nombre);
  }

  // Procesar GAP analysis si existe
  if (data.analisisEmpleabilidad?.gapAnalysis) {
    for (let gap of data.analisisEmpleabilidad.gapAnalysis) {
      gap.gap = gap.gap || (gap.requerido - gap.actual);
    }
  }

  // Procesar timeline si existe
  if (data.analisisEmpleabilidad?.timeline) {
    data.analisisEmpleabilidad.timeline = data.analisisEmpleabilidad.timeline.map((item, index) => ({
      ...item,
      numero: item.numero || (index + 1)
    }));
  }

  // Asegurar que existan las secciones principales
  reportData.perfilGeneral = reportData.perfilGeneral || {};
  reportData.planAccion = reportData.planAccion || {};
  reportData.conclusiones = reportData.conclusiones || {};

  return reportData;
}

/**
 * Registra los partials de Handlebars
 */
async function registerPartials() {
  const partialsDir = path.join(__dirname, '..', 'templates', 'partials');

  const partialFiles = [
    'header.hbs',
    'executive-summary.hbs',
    'employability.hbs',
    'action-plan.hbs'
  ];

  for (const file of partialFiles) {
    const filePath = path.join(partialsDir, file);
    const partialName = path.basename(file, '.hbs');
    const partialContent = await fs.readFile(filePath, 'utf8');
    handlebars.registerPartial(partialName, partialContent);
  }
}

module.exports = {
  generateReport
};