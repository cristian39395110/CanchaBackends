const express = require('express');
const router = express.Router();
const { Usuario, UsuarioPartido ,Mensaje} = require('../models/model');
const { Op } = require('sequelize');


// GET /api/mensajes/usuarios?filtro=localidad&localidad=San Luis&usuarioId=3



// GET /api/mensajes/chats/:usuarioId

// GET /api/mensajes/conversacion/:emisorId/:receptorId
router.get('/conversacion/:emisorId/:receptorId', async (req, res) => {
  const { emisorId, receptorId } = req.params;

  try {
    const mensajes = await require('../models/model').Mensaje.findAll({
      where: {
        [Op.or]: [
          { emisorId, receptorId },
          { emisorId: receptorId, receptorId: emisorId }
        ]
      },
      order: [['fecha', 'ASC']]
    });

    res.json(mensajes);
  } catch (error) {
    console.error('❌ Error al obtener la conversación:', error);
    res.status(500).json({ error: 'Error al obtener los mensajes' });
  }
});

// GET /api/mensajes/no-leidos/:usuarioId
router.get('/no-leidos/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;
  try {
    const mensajes = await Mensaje.findAll({
      where: {
        receptorId: usuarioId,
        leido: false
      }
    });
    res.json({ total: mensajes.length });
  } catch (error) {
    console.error('❌ Error al contar mensajes no leídos:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});


router.get('/chats/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;

  try {
    const mensajes = await Mensaje.findAll({
      where: {
        [Op.or]: [
          { emisorId: usuarioId },
          { receptorId: usuarioId }
        ]
      },
      attributes: ['emisorId', 'receptorId'],
    });

    const ids = new Set();
    mensajes.forEach(m => {
      if (Number(m.emisorId) !== Number(usuarioId)) ids.add(m.emisorId);
      if (Number(m.receptorId) !== Number(usuarioId)) ids.add(m.receptorId);
    });

    const usuarios = await Usuario.findAll({
      where: { id: { [Op.in]: Array.from(ids) } },
      attributes: ['id', 'nombre']
    });

    res.json(usuarios);
  } catch (err) {
    console.error('❌ Error en /chats:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});


router.post('/enviar', async (req, res) => {
  const { emisorId, receptorId, mensaje } = req.body;

  if (!emisorId || !receptorId || !mensaje) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  try {
    const nuevoMensaje = await require('../models/model').Mensaje.create({
      emisorId,
      receptorId,
      contenido: mensaje,
    });

    res.status(201).json(nuevoMensaje);
  } catch (error) {
    console.error('❌ Error al guardar el mensaje:', error);
    res.status(500).json({ error: 'Error al guardar el mensaje' });
  }
});



router.get('/usuarios', async (req, res) => {
  const { filtro, localidad, usuarioId } = req.query;
  console.log("-----------------------------------------------")

console.log(filtro);
console.log(localidad);
console.log(usuarioId);

   console.log("-----------------------------------------------")

  try {
    if (filtro === 'localidad') {
      if (!localidad) return res.status(400).json({ error: 'Localidad requerida' });

      const usuarios = await Usuario.findAll({
        where: {
          localidad,
          id: { [Op.ne]: usuarioId } // excluye al propio usuario
        },
        attributes: ['id', 'nombre']
      });
       console.log("----------------usuarios---------------")
       console.log(usuarios)
      return res.json(usuarios);
    }

    if (filtro === 'partido') {
      const partidos = await UsuarioPartido.findAll({
        where: { usuarioId },
        attributes: ['partidoId']
      });

      const partidoIds = partidos.map(p => p.partidoId);

      const otrosUsuarios = await UsuarioPartido.findAll({
        where: {
          partidoId: partidoIds,
          usuarioId: { [Op.ne]: usuarioId }
        },
        include: [{ model: Usuario, attributes: ['id', 'nombre'] }]
      });

      const resultado = otrosUsuarios.map(p => p.Usuario);
      return res.json(resultado);
    }

    return res.status(400).json({ error: 'Filtro inválido' });

  } catch (err) {
    console.error('Error en /usuarios:', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
