const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs-extra');
const path = require('path');

// Configurar cliente S3 (Cloudflare R2)
const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'auto',
  endpoint: process.env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: process.env.AWS_USE_PATH_STYLE_ENDPOINT === 'true',
});

/**
 * Sube un archivo PDF a S3/R2
 * @param {String} filePath - Ruta local del archivo
 * @param {String} key - Nombre del archivo en S3 (ej: 'reports/2024/report-123.pdf')
 * @returns {Object} - URL pública y key del archivo
 */
async function uploadPDF(filePath, key) {
  try {
    console.log('📤 Subiendo PDF a S3/R2...');

    // Leer el archivo
    const fileContent = await fs.readFile(filePath);

    // Preparar el comando de upload
    const uploadParams = {
      Bucket: process.env.AWS_BUCKET,
      Key: key,
      Body: fileContent,
      ContentType: 'application/pdf',
      // Metadata opcional
      Metadata: {
        uploadDate: new Date().toISOString(),
        source: 'pdfgenerator'
      }
    };

    // Subir el archivo
    const command = new PutObjectCommand(uploadParams);
    await s3Client.send(command);

    // Construir la URL pública
    const publicUrl = `${process.env.AWS_URL}/${key}`;

    console.log('✅ PDF subido exitosamente a S3/R2');
    console.log('   📎 URL:', publicUrl);

    return {
      success: true,
      key: key,
      url: publicUrl,
      bucket: process.env.AWS_BUCKET
    };

  } catch (error) {
    console.error('❌ Error subiendo PDF a S3/R2:', error);
    throw error;
  }
}

/**
 * Descarga un archivo PDF de S3/R2
 * @param {String} key - Key del archivo en S3
 * @param {String} downloadPath - Ruta local donde guardar el archivo
 */
async function downloadPDF(key, downloadPath) {
  try {
    console.log('📥 Descargando PDF de S3/R2...');

    const command = new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: key
    });

    const response = await s3Client.send(command);

    // Convertir el stream a buffer y guardar
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    await fs.writeFile(downloadPath, buffer);

    console.log('✅ PDF descargado exitosamente');
    return downloadPath;

  } catch (error) {
    console.error('❌ Error descargando PDF de S3/R2:', error);
    throw error;
  }
}

/**
 * Elimina un archivo PDF de S3/R2
 * @param {String} key - Key del archivo en S3
 */
async function deletePDF(key) {
  try {
    console.log('🗑️ Eliminando PDF de S3/R2...');

    const command = new DeleteObjectCommand({
      Bucket: process.env.AWS_BUCKET,
      Key: key
    });

    await s3Client.send(command);

    console.log('✅ PDF eliminado exitosamente');
    return true;

  } catch (error) {
    console.error('❌ Error eliminando PDF de S3/R2:', error);
    throw error;
  }
}

/**
 * Genera un key único para el archivo basado en la fecha y un ID
 * @param {String} reportId - ID del reporte
 * @returns {String} - Key para S3
 */
function generateS3Key(reportId) {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  // Estructura: reports/2024/09/25/report-uuid.pdf
  return `reports/${year}/${month}/${day}/report-${reportId}.pdf`;
}

module.exports = {
  uploadPDF,
  downloadPDF,
  deletePDF,
  generateS3Key
};