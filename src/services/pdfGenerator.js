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
 * Retorna la clase CSS fija para las cards
 * @param {Number} count - Cantidad de competencias (no usado ahora)
 * @returns {String} - Clase CSS fija
 */
function getSizeClassForCount(count) {
  return 'card-fixed'; // Siempre usar tamaño fijo para 6 cards por página
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

    // Inyectar JavaScript para limpiar páginas vacías
    await page.evaluate(() => {
      // Encontrar todos los elementos .page
      const pages = document.querySelectorAll('.page');
      pages.forEach(page => {
        // Verificar si la página está efectivamente vacía o solo tiene el header
        const hasContent = Array.from(page.children).some(child => {
          // Ignorar headers vacíos
          if (child.classList.contains('header')) return false;
          // Verificar si tiene contenido real
          return child.textContent.trim().length > 0;
        });

        // Si no hay contenido real, remover la página
        if (!hasContent) {
          page.remove();
        }
      });
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

  // Procesar competencias - ahora vienen ya separadas en altas, medias y bajas
  if (data.competencias) {
    // Si las competencias vienen en el formato antiguo (array), convertir al nuevo formato
    if (Array.isArray(data.competencias)) {
      const competenciasAgrupadas = agruparCompetencias(data.competencias);
      reportData.competencias = {
        altas: competenciasAgrupadas.fortalezas || [],
        medias: competenciasAgrupadas.desarrollo || [],
        bajas: competenciasAgrupadas.oportunidades || []
      };
    } else {
      // Usar directamente el nuevo formato
      reportData.competencias = {
        altas: data.competencias.altas || [],
        medias: data.competencias.medias || [],
        bajas: data.competencias.bajas || []
      };
    }

    // Calcular tamaño de las tarjetas según cantidad
    if (reportData.competencias.altas.length > 0) {
      reportData.competencias.altasSizeClass = getSizeClassForCount(reportData.competencias.altas.length);
    }
    if (reportData.competencias.medias.length > 0) {
      reportData.competencias.mediasSizeClass = getSizeClassForCount(reportData.competencias.medias.length);
    }
    if (reportData.competencias.bajas.length > 0) {
      reportData.competencias.bajasSizeClass = getSizeClassForCount(reportData.competencias.bajas.length);
    }

    // Crear listas de fortalezas y oportunidades para el resumen
    reportData.fortalezasList = reportData.competencias.altas
      .slice(0, 5)
      .map(c => c.nombre);

    reportData.oportunidadesList = reportData.competencias.bajas.length > 0
      ? reportData.competencias.bajas.slice(0, 5).map(c => c.nombre)
      : reportData.competencias.medias.slice(0, 5).map(c => c.nombre);
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