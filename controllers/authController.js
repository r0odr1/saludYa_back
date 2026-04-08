import jwt from "jsonwebtoken";
import User from "../models/User.js";

const generarToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_SECRET_IN || "2h",
  });
};

/** POST /api/auth/registro */
export const registro = async (req, res) => {
  try {
    const { nombre, email, password, telefono } = req.body;

    /** Validar que la contraseña tenga mayusculas y un numero */
    if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return res
        .status(400)
        .json({
          mensaje:
            "La contraseña debe tener al menos una mayúscula y un número",
        });
    }

    const existente = await User.findOne({ email });

    if (existente) {
      return res
        .status(400)
        .json({ mensaje: "Este correo ya está registrado." });
    }

    const usuario = await User.create({
      nombre,
      email,
      password,
      telefono,
      rol: "paciente",
    });

    const token = generarToken(usuario._id);

    res.status(201).json({
      mensjae: "Registro exitoso",
      token,
      usuario,
    });
  } catch (error) {
    res
      .status(500)
      .json({ mensaje: "Error en el registro", error: error.message });
  }
};
