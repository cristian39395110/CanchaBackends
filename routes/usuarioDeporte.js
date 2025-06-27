// routes/usuarioDeporte.js
const express = require('express');
const router = express.Router();
const { UsuarioDeporte ,Usuario} = require('../models/model');

// Crear relación usuario-deporte
router.post('/', async (req, res) => {
  const { usuarioId, deporteId, nivel } = req.body; // 👈 nivel agregado


  if (!usuarioId || !deporteId || !nivel) {
    return res.status(400).json({ error: 'usuarioId, deporteId y nivel son requeridos' });
  }

  try {
    // Verificar si ya está inscrito
    const existente = await UsuarioDeporte.findOne({
      where: { usuarioId, deporteId }
    });

    if (existente) {
      return res.status(400).json({ error: 'Ya estás inscrito en este deporte' });
    }

    // Obtener la localidad del usuario
    const user = await Usuario.findOne({ where: { id: usuarioId } });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Crear nueva relación con nivel y localidad
    const nuevoVinculo = await UsuarioDeporte.create({
      usuarioId,
      deporteId,
      localidad: user.localidad,
      nivel
    });

    res.status(201).json(nuevoVinculo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la relación' });
  }
});
// Obtener los deportes donde el usuario está inscripto
router.get('/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const inscripciones = await UsuarioDeporte.findAll({
      where: { usuarioId },
      attributes: ['deporteId', 'nivel'] // Podés agregar más si querés
    });

    res.json(inscripciones);
  } catch (error) {
    console.error('Error al obtener inscripciones:', error);
    res.status(500).json({ error: 'Error al obtener las inscripciones' });
  }
});


// Eliminar la relación usuario-deporte
router.delete('/', async (req, res) => {
  const { usuarioId, deporteId } = req.body;

  if (!usuarioId || !deporteId) {
    return res.status(400).json({ error: 'usuarioId y deporteId son requeridos' });
  }

  try {
    const eliminado = await UsuarioDeporte.destroy({
      where: { usuarioId, deporteId }
    });

    if (eliminado === 0) {
      return res.status(404).json({ error: 'No se encontró la inscripción para eliminar' });
    }

    res.json({ mensaje: 'Relación eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar relación usuario-deporte:', error);
    res.status(500).json({ error: 'Error al eliminar la relación' });
  }
});

module.exports = router;
