const Deporte = require('../models/deporte');

exports.crearDeporte = async (req, res) => {
  try {
    const { nombre, telefono, email } = req.body;

    const deporte = await Deporte.create({ nombre });

    res.status(201).json({ mensaje: 'deporte creado', deporte });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al crear deporte' });
  }
};
