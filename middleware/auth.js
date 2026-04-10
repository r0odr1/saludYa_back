import jwt from "jsonwebtoken";
import User from "../models/User.js";

/** Verificar token JWT */
export const auth = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res
        .status(401)
        .json({ mensaje: "Acceso denegado. Token no proporcionado." });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await User.findById(decoded.id).select("-password");

    if (!usuario || !usuario.activo) {
      return res
        .status(401)
        .json({ mensaje: "Token inválido o usuario inactivo." });
    }

    req.usuario = usuario;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ mensaje: "Sesión expirada, Inicie sesión nuevamente." });
    }

    res.status(401).json({ mensaje: "Token inválido." });
  }
};

/** Verificar roles */
export const autorizar = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.usuario.rol)) {
      return res
        .status(403)
        .json({ mensaje: "No tiene permisos para realizar esta acción" });
    }
    next();
  };
};
