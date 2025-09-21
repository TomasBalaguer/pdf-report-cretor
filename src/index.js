const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

const reportRoutes = require('./routes/reports');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors({
  origin: process.env.ENABLE_CORS === 'true' ? '*' : 'http://localhost:3001',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Servir PDFs generados
app.use('/generated-pdfs', express.static(path.join(__dirname, '..', 'generated-pdfs')));

// Rutas
app.use('/api/reports', reportRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({
    message: 'Generador de Informes de Competencias - Re-Skilling.AI',
    version: '1.0.0',
    endpoints: {
      generateReport: 'POST /api/reports/generate',
      getReport: 'GET /generated-pdfs/:filename'
    }
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Ruta 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Ruta no encontrada'
  });
});

// Crear directorio para PDFs si no existe
async function initializeApp() {
  try {
    const pdfDir = path.join(__dirname, '..', 'generated-pdfs');
    await fs.ensureDir(pdfDir);
    console.log('✅ Directorio de PDFs verificado');

    app.listen(PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
      console.log(`📄 Endpoint principal: POST http://localhost:${PORT}/api/reports/generate`);
      console.log(`🌍 CORS: ${process.env.ENABLE_CORS === 'true' ? 'Habilitado' : 'Restringido'}`);
    });
  } catch (error) {
    console.error('❌ Error al inicializar la aplicación:', error);
    process.exit(1);
  }
}

initializeApp();