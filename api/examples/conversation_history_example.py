"""
Exemplo de uso do Histórico de Conversação no SDK Claude

Este exemplo mostra como usar o histórico de conversação para:
1. Manter contexto entre mensagens
2. Recuperar conversas anteriores
3. Analisar padrões de uso
4. Implementar memória persistente
"""

import asyncio
import json
from datetime import datetime
from typing import List, Dict, Any

# Importar o SDK estendido
import sys
sys.path.append('/Users/2a/.claude/cc-sdk-chat/api/sdk')

from claude_code_sdk import ExtendedClaudeClient, ClaudeCodeOptions


async def exemplo_basico_historico():
    """Exemplo básico de uso do histórico de conversação"""
    
    print("=" * 60)
    print("EXEMPLO 1: Histórico Básico de Conversação")
    print("=" * 60)
    
    # Criar cliente com histórico habilitado
    client = ExtendedClaudeClient(
        ClaudeCodeOptions(
            system_prompt="Você é um assistente que lembra de conversas anteriores"
        )
    )
    
    async with client:
        # Primeira pergunta
        print("\n📝 Pergunta 1: Meu nome é João e trabalho com Python")
        await client.query_and_wait("Meu nome é João e trabalho com Python")
        
        # Segunda pergunta (teste de memória)
        print("\n📝 Pergunta 2: Qual é meu nome?")
        response = await client.ask("Qual é meu nome e com o que trabalho?")
        print(f"🤖 Resposta: {response}")
        
        # Recuperar histórico
        print("\n📚 Histórico da Conversação:")
        historico = client.get_conversation_history(10)
        for i, msg in enumerate(historico, 1):
            print(f"{i}. [{msg['role']}] {msg['content'][:100]}...")
        
        # Mostrar métricas
        print("\n📊 Métricas da Sessão:")
        metricas = client.get_metrics()
        print(json.dumps(metricas, indent=2))


async def exemplo_contexto_complexo():
    """Exemplo de manutenção de contexto complexo"""
    
    print("\n" + "=" * 60)
    print("EXEMPLO 2: Contexto Complexo e Memória de Longo Prazo")
    print("=" * 60)
    
    client = ExtendedClaudeClient()
    
    async with client:
        # Estabelecer contexto inicial
        contexto_projeto = """
        Estou desenvolvendo um sistema de e-commerce em Python com FastAPI.
        O projeto tem as seguintes características:
        - Banco de dados PostgreSQL
        - Autenticação JWT
        - Sistema de carrinho de compras
        - Integração com gateway de pagamento
        """
        
        print("\n📝 Estabelecendo contexto do projeto...")
        await client.query_and_wait(contexto_projeto)
        
        # Armazenar no contexto permanente
        client.memory.set_context("projeto", "e-commerce")
        client.memory.set_context("tecnologias", ["Python", "FastAPI", "PostgreSQL", "JWT"])
        client.memory.set_context("features", ["carrinho", "pagamento", "autenticação"])
        
        # Fazer perguntas específicas que usam o contexto
        perguntas = [
            "Como implementar o carrinho de compras?",
            "Qual a melhor forma de estruturar as tabelas do banco?",
            "Como garantir segurança na autenticação?"
        ]
        
        for pergunta in perguntas:
            print(f"\n❓ Pergunta: {pergunta}")
            resposta = await client.ask(pergunta)
            print(f"✅ Resposta resumida: {resposta[:200]}...")
            
            # Adicionar conhecimento ao contexto
            if "carrinho" in pergunta.lower():
                client.memory.set_context("carrinho_discutido", True)
        
        # Mostrar contexto acumulado
        print("\n🧠 Contexto Acumulado:")
        print(f"- Projeto: {client.memory.get_context('projeto')}")
        print(f"- Tecnologias: {client.memory.get_context('tecnologias')}")
        print(f"- Features: {client.memory.get_context('features')}")
        print(f"- Carrinho discutido: {client.memory.get_context('carrinho_discutido', False)}")


async def exemplo_analise_conversa():
    """Exemplo de análise de padrões na conversação"""
    
    print("\n" + "=" * 60)
    print("EXEMPLO 3: Análise de Padrões e Insights")
    print("=" * 60)
    
    client = ExtendedClaudeClient()
    
    async with client:
        # Simular várias interações
        interacoes = [
            "Como criar uma API REST?",
            "Explique autenticação JWT",
            "Como implementar cache?",
            "O que é Docker?",
            "Como fazer deploy na AWS?"
        ]
        
        print("\n🔄 Processando múltiplas interações...")
        for interacao in interacoes:
            await client.query_and_wait(interacao)
            await asyncio.sleep(0.5)  # Pequeno delay entre perguntas
        
        # Analisar o histórico
        historico = client.get_conversation_history(20)
        metricas = client.get_metrics()
        
        print("\n📊 Análise da Conversação:")
        print(f"- Total de mensagens: {len(historico)}")
        print(f"- Mensagens do usuário: {len([m for m in historico if m['role'] == 'user'])}")
        print(f"- Mensagens do assistente: {len([m for m in historico if m['role'] == 'assistant'])}")
        print(f"- Taxa de sucesso: {metricas['success_rate']:.2%}")
        print(f"- Tempo médio de resposta: {metricas['average_duration_seconds']:.2f}s")
        print(f"- Tokens totais usados: {metricas['total_tokens']}")
        print(f"- Custo total: ${metricas['total_cost_usd']:.4f}")
        
        # Identificar tópicos mais frequentes
        print("\n🏷️ Tópicos Identificados:")
        topicos = {
            "API": 0,
            "Autenticação": 0,
            "Deploy": 0,
            "Cache": 0,
            "Docker": 0
        }
        
        for msg in historico:
            content = msg['content'].lower()
            for topico in topicos:
                if topico.lower() in content:
                    topicos[topico] += 1
        
        for topico, count in sorted(topicos.items(), key=lambda x: x[1], reverse=True):
            if count > 0:
                print(f"  - {topico}: {count} menções")


async def exemplo_persistencia():
    """Exemplo de como persistir o histórico em arquivo"""
    
    print("\n" + "=" * 60)
    print("EXEMPLO 4: Persistência do Histórico")
    print("=" * 60)
    
    import os
    
    HISTORY_FILE = "/Users/2a/.claude/cc-sdk-chat/conversation_history.json"
    
    # Função para salvar histórico
    def salvar_historico(client: ExtendedClaudeClient, arquivo: str):
        historico_data = {
            "timestamp": datetime.now().isoformat(),
            "messages": client.get_conversation_history(100),
            "context": client.memory.context,
            "metrics": client.get_metrics()
        }
        
        with open(arquivo, 'w', encoding='utf-8') as f:
            json.dump(historico_data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ Histórico salvo em: {arquivo}")
    
    # Função para carregar histórico
    def carregar_historico(client: ExtendedClaudeClient, arquivo: str):
        if os.path.exists(arquivo):
            with open(arquivo, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Restaurar mensagens
            for msg in data['messages']:
                client.memory.add_message(
                    msg['role'],
                    msg['content'],
                    msg.get('metadata', {})
                )
            
            # Restaurar contexto
            client.memory.context = data['context']
            
            print(f"✅ Histórico carregado: {len(data['messages'])} mensagens")
            print(f"📅 Última sessão: {data['timestamp']}")
            return True
        return False
    
    client = ExtendedClaudeClient()
    
    async with client:
        # Tentar carregar histórico anterior
        if carregar_historico(client, HISTORY_FILE):
            print("\n🔄 Continuando conversa anterior...")
            
            # Verificar se lembra do contexto
            ultimo_contexto = client.memory.get_context('ultimo_topico', 'nenhum')
            print(f"📌 Último tópico discutido: {ultimo_contexto}")
        else:
            print("\n🆕 Iniciando nova conversa...")
        
        # Nova interação
        print("\n💬 Nova pergunta: Como implementar WebSockets?")
        await client.query_and_wait("Como implementar WebSockets com FastAPI?")
        
        # Salvar contexto atualizado
        client.memory.set_context('ultimo_topico', 'WebSockets')
        client.memory.set_context('ultima_interacao', datetime.now().isoformat())
        
        # Salvar histórico
        salvar_historico(client, HISTORY_FILE)
        
        # Mostrar resumo
        resumo = client.memory.summarize()
        print("\n📋 Resumo da Sessão:")
        print(json.dumps(resumo, indent=2, default=str))


async def exemplo_callbacks_historico():
    """Exemplo de uso de callbacks para monitorar o histórico em tempo real"""
    
    print("\n" + "=" * 60)
    print("EXEMPLO 5: Callbacks e Monitoramento em Tempo Real")
    print("=" * 60)
    
    # Lista para armazenar eventos
    eventos = []
    
    # Criar cliente com callbacks
    client = ExtendedClaudeClient()
    
    # Registrar callbacks
    def on_message(msg):
        evento = {
            "tipo": "mensagem",
            "timestamp": datetime.now().isoformat(),
            "conteudo": str(msg)[:100]
        }
        eventos.append(evento)
        print(f"📨 [CALLBACK] Nova mensagem recebida")
    
    def on_error(err):
        evento = {
            "tipo": "erro",
            "timestamp": datetime.now().isoformat(),
            "erro": str(err)
        }
        eventos.append(evento)
        print(f"❌ [CALLBACK] Erro: {err}")
    
    def on_complete(result):
        print(f"✅ [CALLBACK] Resposta completa - Tokens: {result.usage.output_tokens if result.usage else 0}")
    
    client.on_message(on_message)
    client.on_error(on_error)
    client.on_complete(on_complete)
    
    async with client:
        # Fazer algumas perguntas
        perguntas = [
            "O que é FastAPI?",
            "Como criar rotas?",
            "Explique middleware"
        ]
        
        for pergunta in perguntas:
            print(f"\n➡️ Enviando: {pergunta}")
            await client.query_and_wait(pergunta)
        
        # Mostrar eventos capturados
        print("\n📊 Eventos Capturados pelos Callbacks:")
        for i, evento in enumerate(eventos[-10:], 1):  # Últimos 10 eventos
            print(f"{i}. [{evento['tipo']}] {evento['timestamp']} - {evento.get('conteudo', evento.get('erro', ''))[:50]}...")


# Função principal para executar todos os exemplos
async def main():
    """Executa todos os exemplos de histórico de conversação"""
    
    print("\n" + "🚀 DEMONSTRAÇÃO DO HISTÓRICO DE CONVERSAÇÃO 🚀".center(60))
    print("=" * 60)
    
    try:
        # Executar cada exemplo
        await exemplo_basico_historico()
        await exemplo_contexto_complexo()
        await exemplo_analise_conversa()
        await exemplo_persistencia()
        await exemplo_callbacks_historico()
        
        print("\n" + "=" * 60)
        print("✅ TODOS OS EXEMPLOS EXECUTADOS COM SUCESSO!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Erro durante execução: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # Executar exemplos
    asyncio.run(main())