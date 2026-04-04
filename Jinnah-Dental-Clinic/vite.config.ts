// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react-swc";
// import path from "path";
// import { VitePWA } from "vite-plugin-pwa";

// export default defineConfig(({ mode }) => ({
//   server: {
//     host: "::",      // IPv6 + IPv4 dono support
//     port: 8080,
//   },

//   plugins: [
//     react(),

//     // PWA Plugin
//     VitePWA({
//       registerType: "autoUpdate",
//       devOptions: {
//         enabled: true,        // Development mein bhi PWA testing ke liye
//       },
//       manifest: {
//         name: "Jinnah Dental Clinic",
//         short_name: "Clinic App",
//         description: "Jinnah Dental Clinic Management System",
//         theme_color: "#2563eb",
//         background_color: "#ffffff",
//         display: "standalone",
//         orientation: "portrait",
//         scope: "/",
//         start_url: "/",
//         icons: [
//           {
//             src: "/icons/pwa-192x192.png",
//             sizes: "192x192",
//             type: "image/png",
//           },
//           {
//             src: "/icons/pwa-512x512.png",
//             sizes: "512x512",
//             type: "image/png",
//           },
//           {
//             src: "/icons/pwa-512x512.png",
//             sizes: "512x512",
//             type: "image/png",
//             purpose: "any maskable",
//           },
//         ],
//       },
//     }),
//   ],

//   resolve: {
//     alias: {
//       "@": path.resolve(__dirname, "./src"),
//     },
//   },
// }));


import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Important for Electron
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  server: {
    port: 5173,
  },
});