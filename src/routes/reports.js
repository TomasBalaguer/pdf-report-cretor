const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs-extra');

const pdfGenerator = require('../services/pdfGenerator');
const { validateReportData } = require('../services/validator');

// POST /api/reports/generate
router.post('/generate', async (req, res) => {
  try {
    console.log('📥 Solicitud de generación de reporte recibida');

    // Validar datos de entrada
    const validationResult = validateReportData(req.body);
    if (!validationResult.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Datos de entrada inválidos',
        details: validationResult.errors
      });
    }

    // Generar ID único para el reporte
    const reportId = uuidv4();
    const fileName = `report-${reportId}.pdf`;
    const filePath = path.join(__dirname, '..', '..', 'generated-pdfs', fileName);

    console.log(`🔄 Generando PDF con ID: ${reportId}`);

    // Generar el PDF
    await pdfGenerator.generateReport(req.body, filePath);

    // Verificar que el archivo se creó
    const fileExists = await fs.pathExists(filePath);
    if (!fileExists) {
      throw new Error('El PDF no se pudo generar correctamente');
    }

    const fileStats = await fs.stat(filePath);
    console.log(`✅ PDF generado exitosamente: ${fileName} (${(fileStats.size / 1024).toFixed(2)} KB)`);

    // Construir URL del PDF
    const pdfUrl = `${req.protocol}://${req.get('host')}/generated-pdfs/${fileName}`;

    res.status(200).json({
      success: true,
      message: 'Reporte generado exitosamente',
      reportId: reportId,
      fileName: fileName,
      pdfUrl: pdfUrl,
      size: fileStats.size
    });

  } catch (error) {
    console.error('❌ Error generando reporte:', error);
    res.status(500).json({
      success: false,
      error: 'Error al generar el reporte',
      details: error.message
    });
  }
});

// GET /api/reports/list
router.get('/list', async (req, res) => {
  try {
    const pdfDir = path.join(__dirname, '..', '..', 'generated-pdfs');
    const files = await fs.readdir(pdfDir);

    const pdfFiles = files
      .filter(file => file.endsWith('.pdf'))
      .map(file => ({
        fileName: file,
        url: `${req.protocol}://${req.get('host')}/generated-pdfs/${file}`
      }));

    res.json({
      success: true,
      count: pdfFiles.length,
      reports: pdfFiles
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al listar reportes',
      details: error.message
    });
  }
});

// DELETE /api/reports/:fileName
router.delete('/:fileName', async (req, res) => {
  try {
    const { fileName } = req.params;

    if (!fileName.endsWith('.pdf')) {
      return res.status(400).json({
        success: false,
        error: 'Nombre de archivo inválido'
      });
    }

    const filePath = path.join(__dirname, '..', '..', 'generated-pdfs', fileName);

    const exists = await fs.pathExists(filePath);
    if (!exists) {
      return res.status(404).json({
        success: false,
        error: 'Archivo no encontrado'
      });
    }

    await fs.remove(filePath);

    res.json({
      success: true,
      message: 'Reporte eliminado exitosamente'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Error al eliminar reporte',
      details: error.message
    });
  }
});

module.exports = router;