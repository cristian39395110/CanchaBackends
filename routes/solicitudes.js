// GET /solicitudes/:usuarioId
  const express = require('express');
  const router = express.Router();
 /* const  Partido  = require('../models/partido');
   const  Usuario  = require('../models/usuario');
    const  Deporte  = require('../models/deporte');
    const  UsuarioPartido  = require('../models/usuarioPartido');

    */

    // En solicitudes.js
const { Partido, Usuario, Deporte, UsuarioPartido,UsuarioDeporte } = require('../models/model');

// GET /solicitudes/:usuarioId
router.get('/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    // Obtener las localidades donde el usuario practica deportes (deportes y localidad)
    const usuarioDeportes = await UsuarioDeporte.findAll({
      where: { usuarioId },
      attributes: ['deporteId', 'localidad'],
    });

    // Crear un mapa para rápido lookup: deporteId => [localidades]
    const deporteLocalidadesMap = {};
    usuarioDeportes.forEach(ud => {
      if (!deporteLocalidadesMap[ud.deporteId]) {
        deporteLocalidadesMap[ud.deporteId] = new Set();
      }
      if (ud.localidad) {
        deporteLocalidadesMap[ud.deporteId].add(ud.localidad);
      }
    });

    // Traer partidos donde el usuario está invitado (join con UsuarioPartido)
    const partidos = await Partido.findAll({
      include: [
        {
          model: Deporte,
          attributes: ['id', 'nombre'],
        },
        {
          model: Usuario,
          attributes: ['id', 'nombre'],
          through: { attributes: ['estado'] },
          where: { id: usuarioId } // Filtra solo partidos donde el usuario está invitado
        },
        {
          model: Usuario,
          as: 'organizador',
          attributes: ['id', 'nombre'],
        },
      ],
    });

    // Filtrar partidos que coinciden con la localidad del usuario para el deporte del partido
    const resultado = partidos
      .filter(partido => {
        const localidadesUsuario = deporteLocalidadesMap[partido.deporteId];
        if (!localidadesUsuario || localidadesUsuario.size === 0) return false; // No tiene localidades para ese deporte
        return localidadesUsuario.has(partido.localidad);
      })
      .map(partido => ({
        id: partido.id,
        fecha: partido.fecha,
        hora: partido.hora,
        lugar: partido.lugar,
        nombreCancha: partido.nombre,
        localidad: partido.localidad,
        cantidadJugadores: partido.cantidadJugadores,
        deporte: partido.Deporte?.nombre || 'Desconocido',
        organizador: partido.organizador?.nombre || 'Desconocido',
        latitud: partido.latitud,
        longitud: partido.longitud,
        invitados: partido.Usuarios.map(u => ({
          id: u.id,
          nombre: u.nombre,
          estado: u.UsuarioPartido.estado,
        })),
      }));

    res.json(resultado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
});


// POST /solicitudes/aceptar/:id
router.post('/aceptar/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await UsuarioPartido.update({ estado: 'aceptada' }, { where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al aceptar invitación' });
  }
});

// POST /solicitudes/rechazar/:id
router.post('/rechazar/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await UsuarioPartido.update({ estado: 'rechazada' }, { where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al rechazar invitación' });
  }
});

module.exports = router;