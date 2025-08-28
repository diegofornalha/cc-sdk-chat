import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Lock, Eye, EyeOff } from 'lucide-react'

interface PasswordModalProps {
  onSuccess: () => void
}

export function PasswordModal({ onSuccess }: PasswordModalProps) {
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  // Senha padrão para desenvolvimento
  const CORRECT_PASSWORD = 'claude123'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Simula delay de verificação
    await new Promise(resolve => setTimeout(resolve, 500))

    if (password === CORRECT_PASSWORD) {
      // Salva autenticação no sessionStorage
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('isAuthenticated', 'true')
      }
      onSuccess()
    } else {
      setError('Senha incorreta. Tente novamente.')
      setPassword('')
    }

    setIsLoading(false)
  }

  // Verifica se já está autenticado
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const isAuth = sessionStorage.getItem('isAuthenticated')
      if (isAuth === 'true') {
        onSuccess()
      }
    }
  }, [onSuccess])

  return (
    <Dialog open={true}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Lock className="h-8 w-8 text-primary" />
              </div>
            </div>
            <DialogTitle className="text-center">Autenticação Necessária</DialogTitle>
            <DialogDescription className="text-center">
              Digite a senha para acessar o Claude Chat
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Digite a senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-destructive text-center">
                {error}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button 
              type="submit" 
              disabled={!password || isLoading}
              className="w-full"
            >
              {isLoading ? 'Verificando...' : 'Entrar'}
            </Button>
          </DialogFooter>
        </form>

      </DialogContent>
    </Dialog>
  )
}