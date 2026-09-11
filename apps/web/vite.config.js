import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    server: {
        proxy: {
            // Mengarahkan request API dari port 5173 ke server backend Express (port 3000)
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            }
        }
    }
});
