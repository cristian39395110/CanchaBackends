// routes/premium.js
const express = require('express');
const router = express.Router();
const { Op, literal } = require('sequelize');
const { Usuario, UsuarioDeporte, Partido, UsuarioPartido } = require('../models/model');

// GET /api/premium/usuarios?partidoId=XX&nivel=medio&nombre=Lucas&pagina=1&limite=5
router.get('/usuarios', async (req, res) => {
  const { partidoId, nivel, nombre, pagina = 1, limite = 5 } = req.query;

  if (!partidoId) {
    return res.status(400).json({ error: 'partidoId es requerido' });
  }

  const offset = (Number(pagina) - 1) * Number(limite);

  try {
    // Obtener info del partido
    const partido = await Partido.findByPk(partidoId);
    if (!partido) {
      return res.status(404).json({ error: 'Partido no encontrado' });
    }

    // Buscar jugadores por deporte, nivel, nombre y cercanía geográfica (rango de 15 km aprox)
    const usuarios = await Usuario.findAll({
      where: {
        ...(nombre && {
          nombre: { [Op.like]: `%${nombre}%` },
        }),
        id: { [Op.ne]: partido.organizadorId }, // Excluir al organizador
        latitud: { [Op.not]: null },
        longitud: { [Op.not]: null },
        [Op.and]: literal(`
          6371 * acos(
            cos(radians(${partido.latitud})) * cos(radians(latitud)) *
            cos(radians(longitud) - radians(${partido.longitud})) +
            sin(radians(${partido.latitud})) * sin(radians(latitud))
          ) < 15
        `), // dentro de 15 km
      },
      include: [
        {
          model: UsuarioDeporte,
          as: 'UsuarioDeportes',
          required: true,
          where: {
            deporteId: partido.deporteId,
            ...(nivel && { nivel }),
          },
        },
      ],
      limit: Number(limite),
      offset,
      order: [['nombre', 'ASC']],
    });

    // Filtrar los que ya están invitados o aceptados
    const yaInvitados = await UsuarioPartido.findAll({
      where: { PartidoId: partidoId },
      attributes: ['UsuarioId'],
    });

    const idsYaInvitados = yaInvitados.map(u => u.UsuarioId);

    const filtrados = usuarios.filter(u => !idsYaInvitados.includes(u.id));

    res.json(filtrados);
  } catch (err) {
    console.error('❌ Error al buscar jugadores sugeridos:', err);
    res.status(500).json({ error: 'Error interno al buscar jugadores sugeridos' });
  }
});

module.exports = router;
