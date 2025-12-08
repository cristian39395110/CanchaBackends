// routes/ganadorusuario.js
const express = require('express');
const router = express.Router();
const { Ganador, uUsuarioNegocio } = require('../models/model');
const { autenticarUsuarioNegocio } = require('../middlewares/authUsuarioNegocio'); // ajustá nombre real


function getPeriodo(anioParam, mesParam) {
  const ahora = new Date();
  let anio = Number(anioParam) || ahora.getFullYear();
  let mes = Number(mesParam) || (ahora.getMonth() + 1); // 1-12

  if (mes < 1) { mes = 12; anio -= 1; }
  if (mes > 12) { mes = 1; anio += 1; }

  return { anio, mes };
}

/**
 * GET /api/ganador/ganadores-mes
 * Query:
 *   - anio (opcional)
 *   - mes  (opcional)
 * Usa la provincia del USUARIO logueado:
 *   req.usuario.provincia
 */
// routes/ganadorusuario.js
router.get('/ganadores-mes', autenticarUsuarioNegocio, async (req, res) => {
  try {
    const { anio: qAnio, mes: qMes } = req.query;
    const { anio, mes } = getPeriodo(qAnio, qMes);

    // 👇 acá el cambio importante
    const provinciaUsuario =
      req.user?.provincia || req.negocio?.provincia || null;

    if (!provinciaUsuario) {
      return res
        .status(400)
        .json({ error: 'El usuario no tiene provincia configurada.' });
    }

    const ganadores = await Ganador.findAll({
      where: {
        anio,
        mes,
        provincia: provinciaUsuario,
      },
      include: [
        {
          model: uUsuarioNegocio,
          as: 'Usuario',
          attributes: ['id', 'nombre', 'fotoPerfil', 'provincia', 'localidad'],
        },
      ],
      order: [['puesto', 'ASC']],
    });

    return res.json({
      anio,
      mes,
      provincia: provinciaUsuario,
      fechaSorteo: ganadores[0]?.fechaSorteo || null,
      ganadores: ganadores.map((g, idx) => ({
        id: g.id,
        puesto: g.puesto || idx + 1,
        puntos: g.puntos ?? null,
        usuarioId: g.Usuario.id,
        nombreUsuario: g.Usuario.nombre,
        provincia: g.Usuario.provincia,
        localidad: g.Usuario.localidad,
        fotoPerfil: g.Usuario.fotoPerfil,
        premio: g.premio ?? null,
        metodoSeleccion: g.metodoSeleccion,
      })),
    });
  } catch (err) {
    console.error('Error GET /api/ganador/ganadores-mes:', err);
    return res
      .status(500)
      .json({ error: 'Error al obtener ganadores del mes.' });
  }
});


module.exports = router;
