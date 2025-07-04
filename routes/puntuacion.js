const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Partido, UsuarioPartido, Usuario, HistorialPuntuacion } = require('../models/model');

// Obtener partidos finalizados organizados por el usuario
router.get('/organizados-finalizados/:organizadorId', async (req, res) => {
  const { organizadorId } = req.params;

  try {
    const hoy = new Date();

    const partidos = await Partido.findAll({
      where: {
        organizadorId,
        fecha: { [Op.lte]: hoy }
      },
      include: [{
        model: UsuarioPartido,
        where: { estado: 'confirmado' },
        required: true // ✅ Solo partidos con jugadores confirmados
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
    // Traemos todos los jugadores confirmados
    const jugadoresConfirmados = await UsuarioPartido.findAll({
      where: {
        PartidoId: partidoId,
        estado: 'confirmado'
      },
      include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
    });

    // Traemos a quién ya calificó el organizador
    const calificados = await HistorialPuntuacion.findAll({
      where: {
        usuarioId: organizadorId,
        partidoId
      },
      attributes: ['puntuadoId']
    });

    const idsCalificados = calificados.map(c => c.puntuadoId);

    const resultado = jugadoresConfirmados.map(j => ({
      id: j.Usuario.id,
      nombre: j.Usuario.nombre,
      yaCalificado: idsCalificados.includes(j.Usuario.id)
    }));

    res.json(resultado);
  } catch (err) {
    console.error('❌ Error obteniendo jugadores confirmados:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});


module.exports = router;
