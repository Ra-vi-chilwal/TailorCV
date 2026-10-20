import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Dev only: forward /api/* to FastAPI (its routes already live under /api). In production FastAPI serves the app itself.
  server: { proxy: { "/api": "http://127.0.0.1:8001" } },
});
