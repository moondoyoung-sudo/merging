import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// 더블클릭으로 바로 열리는 단일 HTML 파일 빌드 → dist-single/index.html
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: { outDir: 'dist-single', emptyOutDir: true },
});
