/** @type {import('next').NextConfig} */
const nextConfig = {
  // Desabilita Strict Mode para evitar duplicação em dev
  reactStrictMode: false,
  
  // Configurações específicas do projeto
  experimental: {
    // Habilita recursos experimentais se necessário
  },
  
  // Configurações de servidor
  server: {
    port: 3020,
    hostname: '0.0.0.0'
  },
  
  // Configurações de build
  output: 'standalone',
  
  // Configurações de desenvolvimento
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right'
  }
}

module.exports = nextConfig
