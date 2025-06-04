const Usuario = require('../models/usuario');

exports.crearUsuario = async (req, res) => {
  try {
    const { nombre, telefono, email } = req.body;

    const usuario = await Usuario.create({ nombre, telefono,email,password });

    res.status(201).json({ mensaje: 'Usuario creado', usuario });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
};
// controllers/usuarioController.js
exports.asociarDeportes = async (req, res) => {
    const { usuarioId, deportesIds } = req.body; // deportesIds: [1, 2, 3]
    
    const usuario = await Usuario.findByPk(usuarioId);
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  
    await usuario.setDeportes(deportesIds); // Asocia múltiples deportes
  
    res.json({ mensaje: 'Intereses actualizados' });
  };
  