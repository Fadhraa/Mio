import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
    envDir: path.resolve(__dirname, '../../'),
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
