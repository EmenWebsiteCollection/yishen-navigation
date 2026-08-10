import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  build: {
    // 生成 .vite/manifest.json，前端运行时据此解析懒加载 chunk 的真实 URL
    manifest: true,
    rollupOptions: {
      output: {
        // 把重量级第三方库拆成独立 vendor chunk，利用浏览器长期缓存
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
})
