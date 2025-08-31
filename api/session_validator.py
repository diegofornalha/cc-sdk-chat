"""Validador de sessões para garantir que apenas sessões reais sejam usadas."""

import os
import glob
from typing import List, Optional, Set
import uuid

class SessionValidator:
    """Valida e verifica a existência de sessões reais no sistema."""
    
    def __init__(self):
        self.project_path = '/home/suthub/.claude/projects/-home-suthub--claude-api-claude-code-app-cc-sdk-chat'
        
    def get_real_session_ids(self) -> Set[str]:
        """Retorna conjunto de IDs de sessão que realmente existem no sistema."""
        session_ids = set()
        
        # Verifica arquivos .jsonl no projeto
        if os.path.exists(self.project_path):
            pattern = os.path.join(self.project_path, '*.jsonl')
            jsonl_files = glob.glob(pattern)
            
            for file_path in jsonl_files:
                filename = os.path.basename(file_path)
                if filename.endswith('.jsonl'):
                    session_id = filename.replace('.jsonl', '')
                    # Valida se é um UUID válido
                    if self.is_valid_uuid(session_id):
                        session_ids.add(session_id)
        
        return session_ids
    
    def is_valid_uuid(self, uuid_string: str) -> bool:
        """Verifica se a string é um UUID válido."""
        try:
            uuid.UUID(uuid_string)
            return True
        except ValueError:
            return False
    
    def session_exists(self, session_id: str) -> bool:
        """Verifica se uma sessão específica existe no sistema."""
        if not session_id or not self.is_valid_uuid(session_id):
            return False
            
        real_sessions = self.get_real_session_ids()
        return session_id in real_sessions
    
    def is_temporary_session(self, session_id: str) -> bool:
        """Verifica se um session_id é temporário."""
        if not session_id:
            return False
            
        return (
            session_id.startswith('temp-') or 
            session_id == 'awaiting-real-session' or
            not self.is_valid_uuid(session_id)
        )
    
    def get_session_file_path(self, session_id: str) -> Optional[str]:
        """Retorna o caminho do arquivo da sessão se existir."""
        if not self.session_exists(session_id):
            return None
            
        file_path = os.path.join(self.project_path, f"{session_id}.jsonl")
        if os.path.exists(file_path):
            return file_path
            
        return None
    
    def validate_session_for_redirect(self, session_id: str) -> dict:
        """Valida se uma sessão pode ser usada para redirecionamento."""
        result = {
            'valid': False,
            'exists': False,
            'is_temporary': False,
            'can_redirect': False,
            'session_id': session_id,
            'error': None
        }
        
        if not session_id:
            result['error'] = 'Session ID vazio'
            return result
            
        result['is_temporary'] = self.is_temporary_session(session_id)
        result['exists'] = self.session_exists(session_id)
        result['valid'] = self.is_valid_uuid(session_id)
        
        # Só pode redirecionar se:
        # 1. É um UUID válido
        # 2. A sessão realmente existe no sistema
        # 3. Não é uma sessão temporária
        result['can_redirect'] = (
            result['valid'] and 
            result['exists'] and 
            not result['is_temporary']
        )
        
        if not result['can_redirect']:
            if result['is_temporary']:
                result['error'] = f'Sessão temporária não pode ser usada para redirecionamento: {session_id}'
            elif not result['exists']:
                result['error'] = f'Sessão não existe no sistema: {session_id}'
            elif not result['valid']:
                result['error'] = f'Session ID inválido: {session_id}'
        
        return result
    
    def validate_and_migrate_session(self, session_id: str) -> tuple[str, bool]:
        """
        Valida e migra uma sessão se necessário.
        
        Retorna: (session_id_validado, foi_migrado)
        """
        import uuid
        
        # Se é temporária ou inválida, gera novo UUID
        if self.is_temporary_session(session_id) or not self.is_valid_uuid(session_id):
            # Gera novo UUID válido
            new_session_id = str(uuid.uuid4())
            print(f"🔄 Migrando sessão temporária {session_id} → {new_session_id}")
            return new_session_id, True
        
        # Se já é válida, retorna como está
        return session_id, False