import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  server: {
    host: "localhost",
    // Puerto dedicado para evitar choque con otros proyectos Vite (que usan
    // el 5173 por defecto). strictPort: si está ocupado, Vite FALLA en vez de
    // saltar en silencio a otro puerto — así Electron nunca carga la app
    // equivocada del puerto vecino.
    port: 5180,
    strictPort: true,
  },
});
