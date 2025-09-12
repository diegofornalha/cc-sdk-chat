#!/usr/bin/env python3
"""
Wrapper do Claude Code SDK que força uso de Session ID unificado
Intercepta todas as chamadas e garante que sempre use o mesmo ID
"""

import os
import sys
import json
import uuid
from pathlib import Path
from datetime import datetime
import asyncio

# Adiciona SDK ao path
sdk_dir = os.path.join(os.path.dirname(__file__), 'sdk')
sys.path.insert(0, sdk_dir)

# Importa SDK original
from claude_code_sdk import query as original_query, ClaudeCodeOptions

# Session ID unificado
UNIFIED_SESSION_ID = "00000000-0000-0000-0000-000000000001"
PROJECT_NAME = "-Users-2a--claude-cc-sdk-chat-api"

class UnifiedClaudeSDK:
    """Wrapper que força uso de session ID unificado"""
    
    def __init__(self):
        self.session_id = UNIFIED_SESSION_ID
        self.project_path = Path.home() / ".claude" / "projects" / PROJECT_NAME
        self.unified_file = self.project_path / f"{UNIFIED_SESSION_ID}.jsonl"
        
        # Garante que diretório e arquivo existem
        self.project_path.mkdir(parents=True, exist_ok=True)
        if not self.unified_file.exists():
            self.unified_file.touch()
    
    async def query(self, prompt: str, options: ClaudeCodeOptions = None):
        """
        Query que sempre usa o session ID unificado
        """
        # Se não tem opções, cria padrão
        if options is None:
            options = ClaudeCodeOptions()
        
        # Força o cwd para garantir que use nosso projeto
        if not options.cwd:
            options.cwd = str(Path.home() / ".claude" / "cc-sdk-chat")
        
        # Registra mensagem do usuário
        self._log_message("user", {"role": "user", "content": prompt})
        
        # Chama SDK original
        response_text = ""
        message_data = None
        
        async for message in original_query(prompt=prompt, options=options):
            # Captura resposta
            if hasattr(message, 'content'):
                # Constrói dados da mensagem
                content_blocks = []
                for block in message.content:
                    if hasattr(block, 'text'):
                        response_text += block.text
                        content_blocks.append({
                            "type": "text",
                            "text": block.text
                        })
                
                # Monta estrutura completa da mensagem
                if hasattr(message, 'id'):
                    message_data = {
                        "id": message.id,
                        "type": "message",
                        "role": "assistant",
                        "model": getattr(message, 'model', 'unknown'),
                        "content": content_blocks,
                        "stop_reason": getattr(message, 'stop_reason', None),
                        "stop_sequence": getattr(message, 'stop_sequence', None)
                    }
                    
                    # Adiciona usage se disponível
                    if hasattr(message, 'usage'):
                        message_data["usage"] = message.usage
            
            # Retorna mensagem original
            yield message
        
        # Registra resposta do assistente
        if message_data:
            self._log_message("assistant", message_data)
    
    def _log_message(self, msg_type: str, message_content: dict):
        """Registra mensagem no arquivo unificado"""
        try:
            entry = {
                "parentUuid": self._get_last_uuid(),
                "isSidechain": False,
                "userType": "external",
                "cwd": str(Path.home() / ".claude" / "cc-sdk-chat"),
                "sessionId": self.session_id,  # SEMPRE usa o ID unificado
                "version": "1.0.111",
                "gitBranch": "master",
                "type": msg_type,
                "message": message_content,
                "uuid": str(uuid.uuid4()),
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            
            # Se for resposta do assistente, adiciona requestId
            if msg_type == "assistant":
                entry["requestId"] = f"req_{uuid.uuid4().hex[:24]}"
            
            # Escreve no arquivo unificado
            with open(self.unified_file, 'a') as f:
                f.write(json.dumps(entry) + '\n')
                
            print(f"✅ Mensagem registrada no arquivo unificado: {self.unified_file.name}")
            
        except Exception as e:
            print(f"❌ Erro ao registrar mensagem: {e}")
    
    def _get_last_uuid(self):
        """Pega UUID da última mensagem para criar chain"""
        try:
            with open(self.unified_file, 'r') as f:
                lines = f.readlines()
                if lines:
                    last_line = lines[-1]
                    if last_line.strip():
                        data = json.loads(last_line)
                        return data.get('uuid', str(uuid.uuid4()))
        except:
            pass
        return str(uuid.uuid4())

# Substitui função query original
async def unified_query(prompt: str, options: ClaudeCodeOptions = None):
    """Query que força uso de session ID unificado"""
    sdk = UnifiedClaudeSDK()
    async for message in sdk.query(prompt, options):
        yield message

# Exporta versão unificada
query = unified_query

# Para uso direto
if __name__ == "__main__":
    async def test():
        """Teste do wrapper unificado"""
        print("🧪 Testando SDK Unificado...")
        print(f"📁 Session ID: {UNIFIED_SESSION_ID}")
        print()
        
        options = ClaudeCodeOptions(
            system_prompt="You are a helpful assistant.",
            max_turns=1
        )
        
        test_prompt = f"Testing unified wrapper at {datetime.now().strftime('%H:%M:%S')}. Reply with: 'Unified wrapper working!'"
        
        response = ""
        async for message in query(test_prompt, options):
            if hasattr(message, 'content'):
                for block in message.content:
                    if hasattr(block, 'text'):
                        response += block.text
        
        print(f"✅ Resposta: {response}")
        print(f"📄 Verifique o arquivo: {UNIFIED_SESSION_ID}.jsonl")
    
    asyncio.run(test())