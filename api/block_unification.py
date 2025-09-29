#!/usr/bin/env python3
"""
Bloqueador de Unificação - Solução Definitiva
Impede que Claude Code unifique sessões de diferentes pastas
"""

import json
import time
import shutil
from pathlib import Path
from datetime import datetime
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')
logger = logging.getLogger(__name__)

class UnificationBlocker:
    """Bloqueia unificação entre sessões de diferentes projetos"""

    def __init__(self):
        # Arquivo que queremos proteger
        self.web_session_file = Path.home() / ".claude/projects/-Users-2a--claude-cc-sdk-chat-api/00000000-0000-0000-0000-000000000001.jsonl"

        # Pasta de onde NÃO queremos mensagens
        self.blocked_source = Path.home() / ".claude/projects/-Users-2a--claude"

        # Backup do arquivo limpo
        self.backup_file = self.web_session_file.with_suffix('.jsonl.backup')

        logger.info("🛡️ Bloqueador de Unificação Iniciado")
        logger.info(f"📁 Protegendo: {self.web_session_file}")
        logger.info(f"⛔ Bloqueando mensagens de: {self.blocked_source}")

    def is_from_blocked_source(self, message_data):
        """Verifica se mensagem veio da pasta bloqueada"""

        # Indicadores de unificação de outra pasta
        if message_data.get("originalSession"):
            # Se tem originalSession, é unificação
            original = message_data["originalSession"]

            # Verifica se o ID original existe na pasta bloqueada
            blocked_session_file = self.blocked_source / f"{original}.jsonl"
            if blocked_session_file.exists():
                return True

        # Verifica campo unified_at
        if message_data.get("unified_at"):
            return True

        # Verifica source
        if message_data.get("source") == "claude_code_auto":
            return True

        return False

    def clean_file(self):
        """Remove todas as mensagens unificadas do arquivo"""

        if not self.web_session_file.exists():
            logger.warning(f"Arquivo não existe: {self.web_session_file}")
            return 0

        clean_lines = []
        removed_count = 0

        try:
            # Lê todas as linhas
            with open(self.web_session_file, 'r', encoding='utf-8') as f:
                for line_num, line in enumerate(f, 1):
                    if not line.strip():
                        continue

                    try:
                        data = json.loads(line)

                        # Verifica se deve bloquear
                        if self.is_from_blocked_source(data):
                            removed_count += 1
                            logger.info(f"  ❌ Linha {line_num}: Removida (origem: {data.get('originalSession', 'unknown')})")
                        else:
                            clean_lines.append(line)

                    except json.JSONDecodeError:
                        # Mantém linhas que não são JSON válido
                        clean_lines.append(line)

            # Se removeu algo, reescreve o arquivo
            if removed_count > 0:
                # Faz backup primeiro
                shutil.copy2(self.web_session_file, self.backup_file)
                logger.info(f"  💾 Backup criado: {self.backup_file}")

                # Reescreve arquivo limpo
                with open(self.web_session_file, 'w', encoding='utf-8') as f:
                    f.writelines(clean_lines)

                logger.info(f"  ✅ Arquivo limpo: {removed_count} mensagens removidas")
            else:
                logger.info("  ✨ Arquivo já está limpo")

        except Exception as e:
            logger.error(f"  ❌ Erro ao limpar arquivo: {e}")

        return removed_count

    def create_protected_file(self):
        """Cria arquivo protegido vazio se não existir"""

        # Garante que o diretório existe
        self.web_session_file.parent.mkdir(parents=True, exist_ok=True)

        if not self.web_session_file.exists():
            # Cria arquivo vazio com mensagem inicial
            initial_message = {
                "type": "system",
                "content": "Sessão Web Protegida - Não unificar com terminal",
                "timestamp": datetime.now().isoformat(),
                "protected": True,
                "session_id": "00000000-0000-0000-0000-000000000001"
            }

            with open(self.web_session_file, 'w', encoding='utf-8') as f:
                f.write(json.dumps(initial_message, ensure_ascii=False) + '\n')

            logger.info(f"  📝 Arquivo protegido criado: {self.web_session_file}")

    def monitor_and_protect(self, interval=2):
        """Monitora e protege continuamente o arquivo"""

        logger.info("🔍 Iniciando monitoramento contínuo...")
        logger.info(f"  ⏱️ Verificando a cada {interval} segundos")

        # Cria arquivo se não existir
        self.create_protected_file()

        # Limpa inicialmente
        self.clean_file()

        last_size = 0

        while True:
            try:
                # Verifica se arquivo mudou
                if self.web_session_file.exists():
                    current_size = self.web_session_file.stat().st_size

                    if current_size != last_size:
                        logger.info(f"\n📊 Mudança detectada (tamanho: {last_size} -> {current_size})")

                        # Limpa mensagens unificadas
                        removed = self.clean_file()

                        if removed > 0:
                            logger.warning(f"  ⚠️ BLOQUEADA tentativa de unificação: {removed} mensagens")

                        last_size = self.web_session_file.stat().st_size

                # Aguarda próxima verificação
                time.sleep(interval)

            except KeyboardInterrupt:
                logger.info("\n🛑 Monitoramento interrompido pelo usuário")
                break
            except Exception as e:
                logger.error(f"❌ Erro no monitoramento: {e}")
                time.sleep(interval)

def main():
    """Função principal"""

    print("""
    ╔═══════════════════════════════════════════════════════╗
    ║         BLOQUEADOR DE UNIFICAÇÃO DE SESSÕES          ║
    ╠═══════════════════════════════════════════════════════╣
    ║  Este script impede que o Claude Code unifique        ║
    ║  sessões de diferentes projetos automaticamente       ║
    ╚═══════════════════════════════════════════════════════╝
    """)

    blocker = UnificationBlocker()

    # Opções
    print("\nEscolha uma opção:")
    print("1. Limpar arquivo uma vez")
    print("2. Monitorar e proteger continuamente")
    print("3. Criar arquivo protegido vazio")

    choice = input("\nOpção (1-3): ").strip()

    if choice == "1":
        print("\n🧹 Limpando arquivo...")
        removed = blocker.clean_file()
        print(f"\n✅ Concluído! {removed} mensagens removidas.")

    elif choice == "2":
        print("\n👁️ Iniciando monitoramento contínuo...")
        print("Pressione Ctrl+C para parar\n")
        blocker.monitor_and_protect()

    elif choice == "3":
        print("\n📝 Criando arquivo protegido...")
        blocker.create_protected_file()
        print("✅ Arquivo criado!")

    else:
        print("❌ Opção inválida")

if __name__ == "__main__":
    main()