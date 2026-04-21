import colors from "colors";
import cors from "cors";
import "dotenv/config";
import express from "express";
import morgan from "morgan";
import connectDB from "./config/database.js";
import authRoutes from "./routes/auth.js";
import adminRoutes from './routes/admin.js';

const app = express();

/** Conectar a MongoDB */
connectDB();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:4200",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

/** Rutas */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

/** Ruta de health chechk */
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mensaje: "SaludYa API funcionando correctamente" });
});

/** Manejo de rutas no encontradas */
app.use((req, res) => {
  res.status(404).json({ mensaje: "Ruta no encontrada" });
});

/** Manejo de errores global */
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    mensaje: "Error interno del servidor",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    colors.cyan.bold(`Servidor SaludYa corriendo en el puerto ${PORT}`),
  );
  console.log(
    colors.cyan.bold(`Health check: http://localhost:${PORT}/api/health`),
  );
});
