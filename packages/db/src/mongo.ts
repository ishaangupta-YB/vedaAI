import mongoose from "mongoose";

/**
 * Connect (once) to MongoDB and return the mongoose instance. Safe to call
 * repeatedly: if a connection is already established it is reused. The caller
 * supplies the URI from its typed config module (never read here directly).
 */
export async function connectMongo(uri: string): Promise<typeof mongoose> {
  mongoose.set("strictQuery", true);

  // 1 === connected, 2 === connecting; avoid opening duplicate connections.
  const state = mongoose.connection.readyState;
  if (state === 1 || state === 2) {
    return mongoose;
  }

  await mongoose.connect(uri);
  return mongoose;
}

export { mongoose };
