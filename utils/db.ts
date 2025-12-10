import mongoose from "mongoose";
import "dotenv/config";

const dbUrl: string = process.env.DB_URI || "";

//connect database
const connectDB = async () => {
  if (!dbUrl) {
    // in test mode we skip connecting; otherwise warn and skip
    if (process.env.NODE_ENV === "test") return;
    console.warn("DB_URI not set, skipping database connection");
    return;
  }

  try {
    const data: any = await mongoose.connect(dbUrl);
    console.log(`Database connected with ${data.connection.host}`);
  } catch (error: any) {
    console.error(error);
    // retry after 5s
    setTimeout(connectDB, 5000).unref();
  }
};

export default connectDB;
