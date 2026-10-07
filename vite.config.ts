import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' : Vercel(루트 배포)과 Capacitor(앱 내부 파일 로드) 둘 다에서 동작
export default defineConfig({
  plugins: [react()],
  base: './',
});
