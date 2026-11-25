import { defineConfig } from 'vite'
import { handleApi } from './server/api.js'

export default defineConfig({
  plugins: [{
    name: 'feelinfilm-api',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.startsWith('/api/')) return handleApi(request, response)
        next()
      })
    }
  }]
})
