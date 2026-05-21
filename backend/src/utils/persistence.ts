import mongoose from "mongoose";

export function canPersist() {
  return mongoose.connection.readyState === 1;
}
