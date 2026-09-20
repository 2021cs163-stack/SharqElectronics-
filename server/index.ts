import "dotenv/config";
import express from "express";
import cors from "cors";
import { handleDemo }      from "./routes/demo";
import { handlePrint }     from "./routes/print";
import { handlePrintBill, handlePrintDiag } from "./routes/printBill";

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.get("/api/ping",       (_req, res) => res.json({ message: process.env.PING_MESSAGE ?? "ping" }));
  app.get("/api/print-diag", handlePrintDiag);   // GET http://localhost:8080/api/print-diag
  app.get("/api/demo",       handleDemo);
  app.post("/api/print",      handlePrint);
  app.post("/api/print-bill", handlePrintBill);

  return app;
}
