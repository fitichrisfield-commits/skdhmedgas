import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Replace 'skdhmedgas' with your actual repo name if different
export default defineConfig({
  plugins: [react()],
  base: "/skdhmedgas/",
});
