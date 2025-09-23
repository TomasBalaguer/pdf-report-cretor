const puppeteer = require('puppeteer');
const handlebars = require('handlebars');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

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
 * Determina la clase CSS según la cantidad de competencias
 * @param {Number} count - Cantidad de competencias
 * @returns {String} - Clase CSS correspondiente
 */
function getSizeClassForCount(count) {
  if (count <= 3) return 'card-xl';
  else if (count <= 5) return 'card-lg';
  else if (count <= 7) return 'card-md';
  else return 'card-sm';
}

/**
 * Detecta la ruta del ejecutable de Chromium
 * @returns {String|null} - Ruta del ejecutable o null si no se encuentra
 */
function findChromiumExecutable() {
  const possiblePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/nix/var/nix/profiles/default/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/opt/google/chrome/chrome',
    '/app/.apt/usr/bin/google-chrome'
  ];

  // Intenta encontrar chromium con which
  try {
    const chromiumPath = execSync('which chromium || which chromium-browser || which google-chrome-stable || which google-chrome', { encoding: 'utf8' }).trim();
    if (chromiumPath) {
      console.log('✅ Chromium encontrado en:', chromiumPath);
      return chromiumPath;
    }
  } catch (e) {
    // Si which falla, continuar con las rutas predefinidas
  }

  // Buscar en rutas predefinidas
  for (const chromePath of possiblePaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      console.log('✅ Chromium encontrado en:', chromePath);
      return chromePath;
    }
  }

  return null;
}

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

    // Configurar opciones de lanzamiento
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    };

    // Si estamos en un entorno sin Puppeteer instalado, usar executablePath
    const chromiumPath = findChromiumExecutable();
    if (chromiumPath) {
      launchOptions.executablePath = chromiumPath;
    } else if (process.env.RAILWAY_ENVIRONMENT || process.env.NODE_ENV === 'production') {
      // En Railway o producción, intentar usar Puppeteer sin ejecutable específico
      console.log('⚠️ No se encontró Chromium instalado, usando Puppeteer bundle');
    }

    browser = await puppeteer.launch(launchOptions);

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
    const competenciasBase = agruparCompetencias(data.competencias);
    reportData.competenciasAgrupadas = {};

    // Procesar cada grupo y dividir si es necesario
    ['fortalezas', 'desarrollo', 'oportunidades'].forEach(grupo => {
      if (competenciasBase[grupo] && competenciasBase[grupo].length > 0) {
        const competencias = competenciasBase[grupo];
        const count = competencias.length;

        // Si hay más de 7 competencias, dividir en dos páginas
        if (count > 7) {
          const mitad = Math.ceil(count / 2);
          reportData.competenciasAgrupadas[`${grupo}Parte1`] = competencias.slice(0, mitad);
          reportData.competenciasAgrupadas[`${grupo}Parte2`] = competencias.slice(mitad);

          // Calcular tamaño para cada parte
          const sizeClass1 = getSizeClassForCount(mitad);
          const sizeClass2 = getSizeClassForCount(count - mitad);

          reportData.competenciasAgrupadas[`${grupo}Parte1SizeClass`] = sizeClass1;
          reportData.competenciasAgrupadas[`${grupo}Parte2SizeClass`] = sizeClass2;
          reportData.competenciasAgrupadas[`${grupo}Dividido`] = true;
        } else {
          // Si hay 7 o menos, mantener en una sola página
          reportData.competenciasAgrupadas[grupo] = competencias;
          reportData.competenciasAgrupadas[`${grupo}SizeClass`] = getSizeClassForCount(count);
          reportData.competenciasAgrupadas[`${grupo}Count`] = count;
        }
      }
    });

    // Crear listas de fortalezas y oportunidades
    const fortalezasArray = competenciasBase.fortalezas || [];
    const oportunidadesArray = competenciasBase.oportunidades || [];

    reportData.fortalezasList = fortalezasArray
      .slice(0, 5)
      .map(c => c.nombre);

    reportData.oportunidadesList = oportunidadesArray
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

  // Agregar logo de Re-Skilling.AI
  try {
    const logoPath = path.join(__dirname, '..', 'assets', 'images', 'reskiling-logo.png');
    const logoExists = await fs.pathExists(logoPath);

    if (logoExists) {
      const logoBuffer = await fs.readFile(logoPath);
      reportData.logoReskilling = `data:image/png;base64,${logoBuffer.toString('base64')}`;
    } else {
      console.warn('⚠️ Logo de Re-Skilling.AI no encontrado en:', logoPath);
      reportData.logoReskilling = null;
    }
  } catch (error) {
    console.error('❌ Error cargando logo:', error.message);
    reportData.logoReskilling = null;
  }

  // Procesar logo de la empresa/universidad
  if (data.company) {
    reportData.company = {
      name: data.company.name || reportData.datosPersonales?.nombreUniversidad || 'Universidad',
      imageUrl: data.company.image_url || null
    };
  } else {
    // Mantener compatibilidad con formato anterior
    reportData.company = {
      name: reportData.datosPersonales?.nombreUniversidad || 'Universidad',
      imageUrl: reportData.datosPersonales?.logoUniversidad || null
    };
  }

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