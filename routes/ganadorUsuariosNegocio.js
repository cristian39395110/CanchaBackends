// routes/ganadorusuario.js
const express = require('express');
const router = express.Router();

const {
  SorteoMensualProvincia,
  uUsuarioNegocio,
} = require('../models/model');

const {
  autenticarUsuarioNegocio,
} = require('../middlewares/authUsuarioNegocio');

function getPeriodo(anioParam, mesParam) {
  const ahora = new Date();
  let anio = Number(anioParam) || ahora.getFullYear();
  let mes = Number(mesParam) || (ahora.getMonth() + 1); // 1-12

  if (mes < 1) {
    mes = 12;
    anio -= 1;
  }
  if (mes > 12) {
    mes = 1;
    anio += 1;
  }

  return { anio, mes };
}

/**
 * GET /api/ganadorusuario/ganadores-mes
 * Query:
 *   - anio (opcional)
 *   - mes  (opcional)
 *
 * Usa la provincia del usuario logueado (uUsuariosNegocio)
 * que viene en el token de autenticarUsuarioNegocio
 */
router.get(
  '/ganadores-mes',
  autenticarUsuarioNegocio,
  async (req, res) => {
    try {
      const { anio: qAnio, mes: qMes } = req.query;
      const { anio, mes } = getPeriodo(qAnio, qMes);

      // ⚠️ Ajustá esto si tu middleware usa otra propiedad:
      const provinciaUsuario =
        req.user?.provincia ||
        req.usuario?.provincia ||
        req.negocio?.provincia ||
        null;

      if (!provinciaUsuario) {
        return res.status(400).json({
          error: 'El usuario no tiene provincia configurada.',
        });
      }

      // Leemos los ganadores del sorteo mensual
      const filas = await SorteoMensualProvincia.findAll({
        where: {
          anio,
          mes,
          provincia: provinciaUsuario,
          localidad: null, // por ahora manejás sorteo solo por provincia
        },
        include: [
          {
            model: uUsuarioNegocio,
            as: 'usuario', // alias definido en models/model.js
            attributes: [
              'id',
              'nombre',
              'fotoPerfil',
              'provincia',
              'localidad',
            ],
          },
        ],
        order: [['puesto', 'ASC']],
      });

      // Si no hay sorteo para ese mes, devolvemos vacío pero 200
      if (!filas || filas.length === 0) {
        return res.json({
          anio,
          mes,
          provincia: provinciaUsuario,
          fechaSorteo: null,
          ganadores: [],
        });
      }

      return res.json({
        anio,
        mes,
        provincia: provinciaUsuario,
        // Usamos createdAt como fecha de sorteo
        fechaSorteo: filas[0].createdAt || null,
        ganadores: filas.map((g, idx) => ({
          id: g.id,
          puesto: g.puesto || idx + 1,
          puntos: g.puntosMes ?? null, // columna de SorteoMensualProvincia
          usuarioId: g.usuario?.id ?? g.usuarioId,
          nombreUsuario:
            g.usuario?.nombre ?? 'Usuario sin nombre',
          provincia:
            g.usuario?.provincia ?? provinciaUsuario,
          localidad: g.usuario?.localidad ?? null,
          fotoPerfil: g.usuario?.fotoPerfil ?? null,
          // Estos dos todavía no los grabás en SorteoMensualProvincia,
          // así que salen null hasta que los agregues al modelo.
          premio: g.premio ?? null,
          metodoSeleccion: g.metodoSeleccion ?? null,
        })),
      });
    } catch (err) {
      console.error(
        'Error GET /api/ganadorusuario/ganadores-mes:',
        err
      );
      return res.status(500).json({
        error: 'Error al obtener ganadores del mes.',
      });
    }
  }
);

module.exports = router;
