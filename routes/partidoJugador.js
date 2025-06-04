const express = require('express');
const router = express.Router();
const Partido = require('../models/partidoJugador');

// Crear un partido
router.post('/', async (req, res) => {
  try {
    const nuevoPartido = await Partido.create(req.body);
    res.status(201).json(nuevoPartido);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener todos los partidos
router.get('/', async (req, res) => {
  try {
    const partidos = await Partido.findAll();
    res.json(partidos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
