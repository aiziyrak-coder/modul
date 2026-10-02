const mongoose = require("mongoose");
const logger = require("./logger");

async function connectDb() {
  const uri = process.env.MONGO_HOST;
  if (!uri) throw new Error("MONGO_HOST .env da ko'rsatilmagan");

  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  logger.info(`MongoDB ulandi: ${uri.replace(/\/\/.*@/, "//***@")}`);
}

function listenerDb() {
  return mongoose.connection.useDb(process.env.LISTENER_DB || "listener-db", {
    useCache: true,
  });
}

module.exports = { connectDb, listenerDb };
