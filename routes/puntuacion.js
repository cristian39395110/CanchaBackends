const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Partido, UsuarioPartido, Usuario, HistorialPuntuacion } = require('../models/model');

// Obtener partidos finalizados organizados por el usuario
// ✅ Traer partidos organizados por el usuario que ya pasaron (con jugadores confirmados)
router.get('/organizados-finalizados/:organizadorId', async (req, res) => {
  const { organizadorId } = req.params;

  try {
    // ✅ Tomamos solo la fecha en formato YYYY-MM-DD
    const hoy = new Date().toISOString().slice(0, 10); // Ej: '2025-07-08'

    const partidos = await Partido.findAll({
      where: {
        organizadorId,
        fecha: { [Op.lte]: hoy } // Comparación solo por fecha, no por hora
      },
      include: [{
        model: UsuarioPartido,
        where: { estado: 'confirmado' },
        required: true // Solo partidos con jugadores confirmados
      }],
      order: [['fecha', 'DESC']]
    });

    res.json(partidos);
  } catch (err) {
    console.error('❌ Error obteniendo partidos finalizados con jugadores:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


// Obtener jugadores confirmados de un partido
router.get('/jugadores-confirmados/:partidoId', async (req, res) => {
  const { partidoId } = req.params;

  try {
    const jugadores = await UsuarioPartido.findAll({
      where: {
        PartidoId: partidoId,
        estado: 'confirmado'
      },
      include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
    });

    const resultados = jugadores.map(j => j.Usuario);
    res.json(resultados);
  } catch (err) {
    console.error('❌ Error obteniendo jugadores confirmados:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// Guardar calificación (jugador califica al organizador o viceversa)
async function verificarSuspension(puntuadoId) {
  const puntuaciones = await HistorialPuntuacion.findAll({ where: { puntuadoId } });
  const promedio = puntuaciones.reduce((acc, r) => acc + r.puntaje, 0) / puntuaciones.length;

  if (promedio < 2.5) {
    const usuario = await Usuario.findByPk(puntuadoId);
    if (usuario) {
      usuario.suspensionHasta = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // Suspensión por 2 días
      await usuario.save();
    }
  }
}

// ✅ POST calificación con penalización automática si aplica
router.post('/', async (req, res) => {
  const { usuarioId, partidoId, puntuadoId, puntaje, comentario } = req.body;

  try {
    const yaExiste = await HistorialPuntuacion.findOne({
      where: { usuarioId, partidoId, puntuadoId }
    });

    if (yaExiste) {
      return res.status(400).json({ error: 'Ya calificaste en este partido.' });
    }

    await HistorialPuntuacion.create({
      usuarioId,
      partidoId,
      puntuadoId,
      puntaje,
      comentario
    });

    await Usuario.increment('partidosJugados', {
      by: 1,
      where: { id: puntuadoId }
    });

    if (usuarioId !== puntuadoId) {
      await Usuario.increment('partidosJugados', {
        by: 1,
        where: { id: usuarioId }
      });
    }

    // 🔒 Verificar si debe suspenderse
    await verificarSuspension(puntuadoId);

    res.json({ mensaje: '✅ Calificación guardada correctamente.' });
  } catch (err) {
    console.error('❌ Error guardando calificación:', err);
    res.status(500).json({ error: 'Error al guardar la calificación' });
  }
});
// Verificar si ya calificó
router.get('/ya-calificado', async (req, res) => {
  const { usuarioId, partidoId, puntuadoId } = req.query;

  try {
    const yaExiste = await HistorialPuntuacion.findOne({
      where: { usuarioId, partidoId, puntuadoId }
    });

    res.json({ yaCalificado: !!yaExiste });
  } catch (error) {
    console.error('❌ Error verificando calificación:', error);
    res.status(500).json({ error: 'Error al verificar la calificación' });
  }
});
router.get('/jugadores-confirmados-con-calificacion/:partidoId/:organizadorId', async (req, res) => {
  const { partidoId, organizadorId } = req.params;

  try {
    // Trae los jugadores confirmados con sus datos
    const jugadoresConfirmados = await UsuarioPartido.findAll({
      where: {
        PartidoId: partidoId,
        estado: 'confirmado'
      },
      include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
    });

    const resultado = await Promise.all(
      jugadoresConfirmados.map(async (j) => {
        const calificacion = await HistorialPuntuacion.findOne({
          where: {
            usuarioId: organizadorId,
            partidoId,
            puntuadoId: j.Usuario.id
          }
        });

        return {
          id: j.Usuario.id,
          nombre: j.Usuario.nombre,
          yaCalificado: !!calificacion,
          puntaje: calificacion?.puntaje ?? null,
          comentario: calificacion?.comentario ?? ''
        };
      })
    );

    res.json(resultado);
  } catch (err) {
    console.error('❌ Error obteniendo jugadores confirmados:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


module.exports = router;
