const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

// Configuración del canvas para Chart.js
const width = 600;
const height = 600;
const backgroundColour = 'transparent';
const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width,
  height,
  backgroundColour
});

/**
 * Genera un gráfico radar con el estilo del PDF modelo
 * @param {Object} data - Datos del gráfico
 * @returns {Promise<String>} - Imagen en base64
 */
async function generateRadarChart(data) {
  try {
    const configuration = {
      type: 'radar',
      data: {
        labels: data.labels || ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5'],
        datasets: [
          {
            label: 'Perfil',
            data: data.valores?.serie1 || [8, 6, 7, 5, 9],
            fill: true,
            backgroundColor: 'rgba(0, 188, 212, 0.2)', // Cyan transparente
            borderColor: 'rgba(0, 188, 212, 1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(0, 188, 212, 1)',
            pointBorderColor: '#fff',
            pointHoverBackgroundColor: '#fff',
            pointHoverBorderColor: 'rgba(0, 188, 212, 1)',
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              usePointStyle: true,
              padding: 20,
              font: {
                size: 12,
                family: "'Segoe UI', 'Arial', sans-serif"
              },
              generateLabels: function(chart) {
                const data = chart.data;
                if (data.datasets.length) {
                  return data.datasets.map((dataset, i) => ({
                    text: dataset.label,
                    fillStyle: dataset.backgroundColor,
                    strokeStyle: dataset.borderColor,
                    lineWidth: dataset.borderWidth,
                    hidden: !chart.isDatasetVisible(i),
                    index: i,
                    pointStyle: 'circle'
                  }));
                }
                return [];
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(0, 188, 212, 1)',
            borderWidth: 1,
            padding: 10,
            displayColors: true,
            callbacks: {
              label: function(context) {
                return `${context.dataset.label}: ${context.parsed.r}/10`;
              }
            }
          }
        },
        scales: {
          r: {
            min: 0,
            max: 10,
            ticks: {
              stepSize: 2,
              font: {
                size: 11
              },
              backdropColor: 'transparent'
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)',
              lineWidth: 1
            },
            pointLabels: {
              font: {
                size: 14,
                weight: '500',
                family: "'Segoe UI', 'Arial', sans-serif"
              },
              color: '#333',
              padding: 20
            },
            angleLines: {
              color: 'rgba(0, 0, 0, 0.1)',
              lineWidth: 1
            }
          }
        },
        elements: {
          line: {
            tension: 0.1
          }
        }
      }
    };

    // Generar el gráfico
    const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);

    // Convertir a base64
    const base64Image = buffer.toString('base64');
    const dataUri = `data:image/png;base64,${base64Image}`;

    return dataUri;
  } catch (error) {
    console.error('Error generando gráfico radar:', error);
    throw new Error('No se pudo generar el gráfico radar: ' + error.message);
  }
}

/**
 * Genera un gráfico de barras para GAP Analysis
 * @param {Array} gapData - Datos del GAP analysis
 * @returns {Promise<String>} - Imagen en base64
 */
async function generateGapChart(gapData) {
  try {
    const labels = gapData.map(item => item.competencia);
    const requerido = gapData.map(item => item.requerido);
    const actual = gapData.map(item => item.actual);

    const configuration = {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Requerido',
            data: requerido,
            backgroundColor: 'rgba(0, 102, 204, 0.5)',
            borderColor: 'rgba(0, 102, 204, 1)',
            borderWidth: 1
          },
          {
            label: 'Actual',
            data: actual,
            backgroundColor: 'rgba(0, 188, 212, 0.5)',
            borderColor: 'rgba(0, 188, 212, 1)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              padding: 15,
              font: {
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(0, 188, 212, 1)',
            borderWidth: 1
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            max: 10,
            ticks: {
              stepSize: 1
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.1)'
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    };

    const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    const base64Image = buffer.toString('base64');
    return `data:image/png;base64,${base64Image}`;
  } catch (error) {
    console.error('Error generando gráfico GAP:', error);
    throw new Error('No se pudo generar el gráfico GAP: ' + error.message);
  }
}

module.exports = {
  generateRadarChart,
  generateGapChart
};