import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

// ფარდობითი ბაზა — აპლიკაცია მუშაობს ნებისმიერი ქვესაქაღალდიდან
// (imed458.github.io/playroom/ ან .../playroom/docs/)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    // Pages გასცემს `docs/` საქაღალდეს main ბრენჩიდან
    outDir: 'docs',
    emptyOutDir: true,
  },
});
