import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const host = process.env.HOST || env.VITE_HOST || env.HOST || undefined;

  return {
    plugins: [react()],
    server: {
      host: host === 'true' ? '0.0.0.0' : host,
      port: Number(process.env.PORT || env.PORT || 5174)
    },
    resolve: {
      alias: {
        react: path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom')
      }
    }
  };
});

