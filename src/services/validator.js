/**
 * Validador de datos para el generador de reportes
 */

function validateReportData(data) {
  const errors = [];

  // Validar datos personales
  if (!data.datosPersonales) {
    errors.push('datosPersonales es requerido');
  } else {
    if (!data.datosPersonales.nombre) {
      errors.push('datosPersonales.nombre es requerido');
    }
    if (!data.datosPersonales.email) {
      errors.push('datosPersonales.email es requerido');
    } else if (!isValidEmail(data.datosPersonales.email)) {
      errors.push('datosPersonales.email no es válido');
    }
    // perfilObjetivo es opcional ya que no se usa en el template
  }

  // Validar competencias - acepta tanto array como objeto con altas/medias/bajas
  if (!data.competencias) {
    errors.push('competencias es requerido');
  } else if (Array.isArray(data.competencias)) {
    // Formato antiguo: array de competencias
    if (data.competencias.length === 0) {
      errors.push('Debe incluir al menos una competencia');
    } else {
      data.competencias.forEach((comp, index) => {
        if (!comp.nombre) {
          errors.push(`competencias[${index}].nombre es requerido`);
        }
        if (typeof comp.puntaje !== 'number' || comp.puntaje < 1 || comp.puntaje > 10) {
          errors.push(`competencias[${index}].puntaje debe ser un número entre 1 y 10`);
        }
        if (!comp.descripcion) {
          errors.push(`competencias[${index}].descripcion es requerido`);
        }
      });
    }
  } else if (typeof data.competencias === 'object') {
    // Nuevo formato: objeto con altas/medias/bajas
    const validateCompetencyArray = (arr, type) => {
      if (arr && !Array.isArray(arr)) {
        errors.push(`competencias.${type} debe ser un array`);
      } else if (arr) {
        arr.forEach((comp, index) => {
          if (!comp.nombre) {
            errors.push(`competencias.${type}[${index}].nombre es requerido`);
          }
          if (typeof comp.puntaje !== 'number' || comp.puntaje < 1 || comp.puntaje > 10) {
            errors.push(`competencias.${type}[${index}].puntaje debe ser un número entre 1 y 10`);
          }
          if (!comp.descripcion) {
            errors.push(`competencias.${type}[${index}].descripcion es requerido`);
          }
        });
      }
    };

    // Validar cada grupo de competencias
    validateCompetencyArray(data.competencias.altas, 'altas');
    validateCompetencyArray(data.competencias.medias, 'medias');
    validateCompetencyArray(data.competencias.bajas, 'bajas');

    // Verificar que haya al menos una competencia en total
    const totalCompetencias =
      (data.competencias.altas?.length || 0) +
      (data.competencias.medias?.length || 0) +
      (data.competencias.bajas?.length || 0);

    if (totalCompetencias === 0) {
      errors.push('Debe incluir al menos una competencia en altas, medias o bajas');
    }
  } else {
    errors.push('competencias debe ser un array o un objeto con propiedades altas/medias/bajas');
  }

  // Validar análisis de empleabilidad
  if (data.analisisEmpleabilidad) {
    if (data.analisisEmpleabilidad.matchGeneral !== undefined) {
      const match = data.analisisEmpleabilidad.matchGeneral;
      if (typeof match !== 'number' || match < 0 || match > 100) {
        errors.push('analisisEmpleabilidad.matchGeneral debe ser un número entre 0 y 100');
      }
    }

    if (data.analisisEmpleabilidad.gapAnalysis) {
      if (!Array.isArray(data.analisisEmpleabilidad.gapAnalysis)) {
        errors.push('analisisEmpleabilidad.gapAnalysis debe ser un array');
      } else {
        data.analisisEmpleabilidad.gapAnalysis.forEach((gap, index) => {
          if (!gap.competencia) {
            errors.push(`gapAnalysis[${index}].competencia es requerido`);
          }
          if (typeof gap.requerido !== 'number' || gap.requerido < 1 || gap.requerido > 10) {
            errors.push(`gapAnalysis[${index}].requerido debe ser un número entre 1 y 10`);
          }
          if (typeof gap.actual !== 'number' || gap.actual < 1 || gap.actual > 10) {
            errors.push(`gapAnalysis[${index}].actual debe ser un número entre 1 y 10`);
          }
        });
      }
    }
  }

  // Validar plan de acción
  if (data.planAccion && data.planAccion.fases) {
    if (!Array.isArray(data.planAccion.fases)) {
      errors.push('planAccion.fases debe ser un array');
    } else {
      data.planAccion.fases.forEach((fase, index) => {
        if (!fase.numero) {
          errors.push(`planAccion.fases[${index}].numero es requerido`);
        }
        if (!fase.duracion) {
          errors.push(`planAccion.fases[${index}].duracion es requerido`);
        }
        if (!fase.descripcion) {
          errors.push(`planAccion.fases[${index}].descripcion es requerido`);
        }
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Categoriza una competencia según su puntaje
 * @param {number} puntaje - Puntaje de la competencia (1-10)
 * @returns {Object} - Categoría y color
 */
function categorizarCompetencia(puntaje) {
  if (puntaje >= 9) {
    return {
      categoria: 'excepcional',
      nivel: 'Excepcional',
      color: '#10B981',
      bgColor: '#D1FAE5'
    };
  } else if (puntaje >= 7) {
    return {
      categoria: 'fortaleza',
      nivel: 'Alto',
      color: '#10B981',
      bgColor: '#D1FAE5'
    };
  } else if (puntaje >= 5) {
    return {
      categoria: 'desarrollo',
      nivel: 'Medio',
      color: '#F59E0B',
      bgColor: '#FEF3C7'
    };
  } else if (puntaje >= 3) {
    return {
      categoria: 'oportunidad',
      nivel: 'Bajo',
      color: '#EF4444',
      bgColor: '#FFE4E6'
    };
  } else {
    return {
      categoria: 'critico',
      nivel: 'Muy Bajo',
      color: '#DC2626',
      bgColor: '#FFE4E6'
    };
  }
}

/**
 * Agrupa competencias por categoría
 * @param {Array} competencias - Lista de competencias
 * @returns {Object} - Competencias agrupadas por categoría
 */
function agruparCompetencias(competencias) {
  const grupos = {
    fortalezas: [],
    desarrollo: [],
    oportunidades: []
  };

  competencias.forEach(comp => {
    const categoria = categorizarCompetencia(comp.puntaje);
    comp.categoria = categoria;

    if (comp.puntaje >= 7) {
      grupos.fortalezas.push(comp);
    } else if (comp.puntaje >= 5) {
      grupos.desarrollo.push(comp);
    } else {
      grupos.oportunidades.push(comp);
    }
  });

  // Ordenar cada grupo por puntaje descendente
  Object.keys(grupos).forEach(key => {
    grupos[key].sort((a, b) => b.puntaje - a.puntaje);
  });

  // Limitar el número de competencias por grupo para que quepan en una página
  // Aproximadamente 10-12 competencias por página con el nuevo diseño compacto
  const MAX_PER_GROUP = 12;
  Object.keys(grupos).forEach(key => {
    if (grupos[key].length > MAX_PER_GROUP) {
      grupos[key] = grupos[key].slice(0, MAX_PER_GROUP);
    }
  });

  return grupos;
}

module.exports = {
  validateReportData,
  categorizarCompetencia,
  agruparCompetencias
};