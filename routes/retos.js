const express = require('express');
const router = express.Router();

const { Reto, uUsuariosNegocio } = require('../models/model');
// 👇 usamos los nuevos
const { autenticarTokenNegocio } = require('../middlewares/authNegocios');
const { soloAdminNegocio } = require('../middlewares/soloAdminNegocio');

/**
 * ===========================================================
 * GET /api/retos
 * → Devuelve todos los retos (cualquiera logueado de negocio)
 * ===========================================================
 */
router.get('/', autenticarTokenNegocio, async (req, res) => {
  try {
    const retos = await Reto.findAll({
      order: [['createdAt', 'DESC']],
    });
    res.json(retos);
  } catch (err) {
    console.error('Error en GET /api/retos:', err);
    res.status(500).json({ error: 'No se pudieron cargar los retos' });
  }
});

/**
 * ===========================================================
 * POST /api/retos/crear
 * → Crear nuevo reto (solo admin de negocios)
 * body: { titulo, descripcion, puntos, fechaInicio, fechaFin }
 * ===========================================================
 */
router.post('/crear', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  try {
    const { titulo, descripcion, puntos, fechaInicio, fechaFin } = req.body;
    if (!titulo || !descripcion || !puntos) {
      return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    // última versión
    const ultimaVersion = await Reto.max('version');
    const nuevaVersion = (ultimaVersion || 0) + 1;

    const nuevo = await Reto.create({
      titulo,
      descripcion,
      puntos,
      tipo: 'general',
      fechaInicio,
      fechaFin,
      version: nuevaVersion,
    });

    res.json(nuevo);
  } catch (err) {
    console.error('Error en POST /api/retos/crear:', err);
    res.status(500).json({ error: 'No se pudo crear el reto' });
  }
});

/**
 * ===========================================================
 * PUT /api/retos/:id  (solo admin negocio)
 * ===========================================================
 */
router.put('/:id', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
  try {
    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: 'Reto no encontrado' });

    await reto.update(req.body);
    res.json(reto);
  } catch (err) {
    console.error('Error en PUT /api/retos/:id:', err);
    res.status(500).json({ error: 'No se pudo actualizar el reto' });
  }
});

/**
 * ===========================================================
 * DELETE /api/retos/:id  (solo admin negocio)
 * ===========================================================
 */
router.delete('/:id', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
  try {
    const reto = await Reto.findByPk(id);
    if (!reto) return res.status(404).json({ error: 'Reto no encontrado' });

    await reto.destroy();
    res.json({ mensaje: 'Reto eliminado correctamente' });
  } catch (err) {
    console.error('Error en DELETE /api/retos/:id:', err);
    res.status(500).json({ error: 'No se pudo eliminar el reto' });
  }
});

/**
 * ===========================================================
 * GET /api/retos/usuarios-premium   (solo admin negocio)
 * ===========================================================
 */
router.get('/usuarios-premium', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  try {
    const lista = await uUsuariosNegocio.findAll({
      attributes: ['id', 'nombre', 'email', 'puntos', 'esPremium', 'esAdmin'],
      order: [['nombre', 'ASC']],
    });
    res.json(lista);
  } catch (err) {
    console.error('Error en GET /usuarios-premium:', err);
    res.status(500).json({ error: 'No se pudo obtener la lista de usuarios' });
  }
});

/**
 * ===========================================================
 * PATCH /api/retos/usuarios-premium/:id  (solo admin negocio)
 * ===========================================================
 */
router.patch('/usuarios-premium/:id', autenticarTokenNegocio, soloAdminNegocio, async (req, res) => {
  const { id } = req.params;
  const { esPremium } = req.body;
  try {
    const user = await uUsuariosNegocio.findByPk(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    await user.update({ esPremium });
    res.json({ mensaje: 'Usuario actualizado', user });
  } catch (err) {
    console.error('Error en PATCH /usuarios-premium/:id:', err);
    res.status(500).json({ error: 'No se pudo actualizar el usuario' });
  }
});

/**
 * ===========================================================
 * GET /api/retos/meta
 * → Esto sí lo dejamos PÚBLICO porque el frontend lo llama apenas carga
 *   y no siempre hay token.
 * ===========================================================
 */
router.get('/meta', async (req, res) => {
  try {
    const ultimo = await Reto.findOne({
      order: [['updatedAt', 'DESC']],
      attributes: ['version'],
    });

    const version = ultimo ? Number(ultimo.version) : 1;

    res.json({
      version,
      hayNuevos: true,
    });
  } catch (err) {
    console.error('Error en GET /api/retos/meta:', err);
    res.status(500).json({ error: 'No se pudo obtener meta de retos' });
  }
});

module.exports = router;
