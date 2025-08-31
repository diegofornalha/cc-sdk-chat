/** @type {import('next').NextConfig} */
const nextConfig = {
  // Desabilita Strict Mode para evitar duplicação em dev
  reactStrictMode: false,
  
  // Configurações específicas do projeto
  experimental: {
    // Habilita recursos experimentais se necessário
  },
  
  // Configurações de build
  output: 'standalone',
  
  // Configurações de build production  
  typescript: {
    // Manter verificação de tipos ativa (comentar se houver problemas)
    ignoreBuildErrors: false,
  },
  eslint: {
    // Manter linting ativo (comentar se houver problemas)
    ignoreDuringBuilds: false,
  },
  
  // Configurações de desenvolvimento
  devIndicators: {
    buildActivity: true,
    buildActivityPosition: 'bottom-right'
  }
}

module.exports = nextConfig
