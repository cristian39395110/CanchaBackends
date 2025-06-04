const express = require('express');
const router = express.Router();
const UsuarioPartido = require('../models/usuarioPartido');
const Suscripcion = require('../models/Suscripcion');

const Partido = require('../models/partido');  // <-- Importar el modelo Partido para el include
// routes/notificaciones.js (o donde manejes notificaciones)

// Modelo Suscripcion

// GET /api/notificaciones/:usuarioId -> ¿Está suscripto?
router.get('/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;


  try {
    // Buscamos si existe alguna suscripción para el usuario
    const suscripcion = await Suscripcion.findOne({
      where: { UsuarioId: usuarioId }
    });

    res.json({ suscrito: !!suscripcion });  // true si encontró suscripción, false si no
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar la suscripción' });
  }
});

module.exports = router;
