// routes/usuarioDeporte.js
const express = require('express');
const router = express.Router();
const { UsuarioDeporte } = require('../models/model');

// Crear relación usuario-deporte
router.post('/', async (req, res) => {
  const { usuarioId, deporteId } = req.body;
  console.log(req.body);

  if (!usuarioId || !deporteId) {
    return res.status(400).json({ error: 'usuarioId y deporteId son requeridos' });
  }

  try {
    // Validar si ya existe la relación (opcional)
    const existente = await UsuarioDeporte.findOne({
  where: { usuarioId, deporteId }
});

const user = await Usuario.findOne({
    where: { id: usuarioId }
});

    if (existente) {
      return res.status(400).json({ error: 'Ya estás inscrito en este deporte' });
    }
    
    const nuevoVinculo = await UsuarioDeporte.create({ usuarioId, deporteId,localidad:user.localidad });
    res.status(201).json(nuevoVinculo);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear la relación' });
  }
});

module.exports = router;
