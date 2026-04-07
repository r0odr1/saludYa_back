import colors from "colors";
import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(
      colors.cyan.bold(`--MongoDB Conectado en: ${conn.connection.host}`),
    );
  } catch (error) {
    console.log(colors.red.bold(`Error al conectar MongoDB: ${error.message}`));
    process.exit(1);
  }
};

export default connectDB