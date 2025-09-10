/** @type {import('next').NextConfig} */
const nextConfig = {
  // Desabilita Strict Mode para evitar duplicação em dev
  reactStrictMode: false,
  
  // Configurações específicas para Next.js 15
  experimental: {
    // Otimizações de performance para Next.js 15
    optimizePackageImports: ['lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
    // Suporte aprimorado para React 19
    ppr: false,
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
  
  // Configurações de desenvolvimento (Next.js 15)
  devIndicators: {
    appIsrStatus: true,
    buildActivity: false,
  },

  // Configuração de webpack para resolver caminhos
  webpack: (config) => {
    // Garante que os aliases de path estão configurados corretamente
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': require('path').resolve(__dirname, './src'),
    };
    return config;
  },
}

module.exports = nextConfig
