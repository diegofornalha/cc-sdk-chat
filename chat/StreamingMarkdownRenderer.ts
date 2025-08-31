interface StreamingState {
    isInCodeBlock: boolean;
    codeBlockCount: number;
    isInInlineCode: boolean;
    currentLanguage: string;
    currentPosition: number;
}

export class StreamingMarkdownRenderer {
    private container: HTMLElement;
    private currentText: string;
    private state: StreamingState;
    private autoScrollThreshold: number;
    private markdownContent: string;
    private streamingSpeed: number;

    constructor(containerId: string) {
        const element = document.getElementById(containerId);
        if (!element) {
            throw new Error(`Container element with id '${containerId}' not found`);
        }
        this.container = element;
        this.container.classList.add('notion-content');
        this.currentText = '';
        this.state = {
            isInCodeBlock: false,
            codeBlockCount: 0,
            isInInlineCode: false,
            currentLanguage: '',
            currentPosition: 0
        };
        this.autoScrollThreshold = window.innerHeight * 0.5;
        this.markdownContent = '';
        this.streamingSpeed = 50;
        this.setupCopyButtons();
        this.setupStreamingControl();
    }

    private setupCopyButtons(): void {
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('.copy-button');
            if (!button) return;

            const codeBlock = button.closest('.code-block');
            if (!codeBlock) return;

            const code = codeBlock.querySelector('code');
            if (!code) return;

            navigator.clipboard.writeText(code.textContent || '')
                .then(() => {
                    button.classList.add('copied');
                })
                .catch(err => console.error('Failed to copy:', err));
        });
    }

    private setupStreamingControl(): void {
        // Botão de pause/play removido
        // O streaming agora flui continuamente sem interrupção manual
    }

    private performAutoScroll(): void {
        const containerBottom = this.container.getBoundingClientRect().bottom;
        if (containerBottom > this.autoScrollThreshold) {
            const scrollTarget = containerBottom - this.autoScrollThreshold;
            window.scrollTo({
                top: window.scrollY + scrollTarget,
                behavior: 'smooth'
            });
        }
    }

    async streamMarkdown(markdown: string, speed = 50): Promise<void> {
        this.resetState();
        this.markdownContent = markdown;
        this.streamingSpeed = speed;
        await this.startStreaming();
    }

    appendMarkdown(markdown: string): void {
        // Método para adicionar markdown incrementalmente
        this.currentText += markdown;
        this.updateDisplay();
        this.performAutoScroll();
    }
    
    // Nova implementação: streaming por chunks com buffer inteligente
    async streamByChunks(markdown: string, chunkSize = 50, speed = 10): Promise<void> {
        const chunks = this.createSmartChunks(markdown, chunkSize);
        
        for (const chunk of chunks) {
            
            this.currentText += chunk;
            this.updateDisplay();
            this.performAutoScroll();
            
            // Delay menor entre chunks (não entre caracteres)
            await new Promise(resolve => setTimeout(resolve, speed));
        }
    }
    
    // Cria chunks inteligentes baseados em limites naturais de palavras
    private createSmartChunks(text: string, targetSize: number): string[] {
        const chunks: string[] = [];
        let currentChunk = '';
        let i = 0;
        
        while (i < text.length) {
            currentChunk += text[i];
            
            // Verifica se chegou ao tamanho alvo e procura o próximo espaço
            if (currentChunk.length >= targetSize) {
                // Se estiver no meio de uma palavra, continua até o fim dela
                while (i + 1 < text.length && text[i + 1] !== ' ' && text[i + 1] !== '\n') {
                    i++;
                    currentChunk += text[i];
                }
                
                chunks.push(currentChunk);
                currentChunk = '';
            }
            
            i++;
        }
        
        // Adiciona o último chunk se houver
        if (currentChunk) {
            chunks.push(currentChunk);
        }
        
        return chunks;
    }
    
    // Método legado mantido para compatibilidade (usar streamByChunks preferencialmente)
    async streamCharacterByCharacter(markdown: string, speed = 30): Promise<void> {
        // Redireciona para o novo método otimizado
        return this.streamByChunks(markdown, 1, speed);
    }

    private async startStreaming(): Promise<void> {
        while (this.state.currentPosition < this.markdownContent.length) {

            await new Promise(resolve => setTimeout(resolve, this.streamingSpeed));
            this.processCharacter(this.markdownContent[this.state.currentPosition]);
            this.updateDisplay();
            this.performAutoScroll();
            this.state.currentPosition++;
        }
    }

    private async resumeStreaming(): Promise<void> {
        await this.startStreaming();
    }

    private resetState(): void {
        this.currentText = '';
        this.container.innerHTML = '';
        this.state = {
            isInCodeBlock: false,
            codeBlockCount: 0,
            isInInlineCode: false,
            currentLanguage: '',
            currentPosition: 0
        };
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    private processCharacter(char: string): void {
        this.detectCodeBlocks(char);
        this.currentText += char;
        this.detectLanguage();
    }

    private detectCodeBlocks(char: string): void {
        if (this.currentText.endsWith('``') && char === '`') {
            this.state.isInCodeBlock = !this.state.isInCodeBlock;
            this.state.codeBlockCount = this.state.isInCodeBlock ? 1 : 0;
            if (!this.state.isInCodeBlock) {
                this.state.currentLanguage = '';
            }
        } else if (char === '`' && !this.state.isInCodeBlock) {
            this.state.isInInlineCode = !this.state.isInInlineCode;
        }
    }

    private detectLanguage(): void {
        if (this.state.isInCodeBlock && this.currentText.endsWith('```')) {
            const lines = this.currentText.split('\n');
            const lastLine = lines[lines.length - 1];
            if (lastLine.startsWith('```')) {
                this.state.currentLanguage = lastLine.slice(3).trim() || 'bash';
            }
        }
    }

    private updateDisplay(): void {
        const html = this.generateHtml();
        const copiedCodeBlocks = new Set(
            Array.from(this.container.querySelectorAll('.code-block'))
                .filter(block => block.querySelector('.copy-button.copied'))
                .map(block => block.querySelector('code')?.textContent)
        );

        this.container.innerHTML = html;

        if (copiedCodeBlocks.size > 0) {
            this.container.querySelectorAll('.code-block').forEach(block => {
                const code = block.querySelector('code');
                if (code && copiedCodeBlocks.has(code.textContent)) {
                    const button = block.querySelector('.copy-button');
                    if (button) {
                        button.classList.add('copied');
                    }
                }
            });
        }
    }

    private generateHtml(): string {
        const lines = this.currentText.split('\n');
        let html = '';
        let inCodeBlock = false;

        lines.forEach((line, index) => {
            if (line.startsWith('```')) {
                html += this.handleCodeBlockDelimiter(line, inCodeBlock);
                inCodeBlock = !inCodeBlock;
                return;
            }

            if (inCodeBlock) {
                html += this.escapeHtml(line) + '\n';
                return;
            }

            html += this.processLine(line, index, lines.length);
        });

        return html;
    }

    private handleCodeBlockDelimiter(line: string, inCodeBlock: boolean): string {
        if (!inCodeBlock) {
            const language = line.slice(3).trim() || 'bash';
            this.state.currentLanguage = language;
            return `<div class="code-block">
                <div class="code-language">${language}</div>
                <button class="copy-button" title="Copy code" aria-label="Copy code to clipboard">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M7.5 3.375c0-1.036.84-1.875 1.875-1.875h.375a3.75 3.75 0 013.75 3.75v1.875C13.5 8.161 14.34 9 15.375 9h1.875A3.75 3.75 0 0121 12.75v3.375C21 17.16 20.16 18 19.125 18h-9.75A1.875 1.875 0 017.5 16.125V3.375z" />
                        <path d="M15 5.25a5.23 5.23 0 00-1.279-3.434 9.768 9.768 0 016.963 6.963A5.23 5.23 0 0017.25 7.5h-1.875A.375.375 0 0115 7.125V5.25zM4.875 6H6v10.125A3.375 3.375 0 009.375 19.5H16.5v1.125c0 1.035-.84 1.875-1.875 1.875h-9.75A1.875 1.875 0 013 20.625V7.875C3 6.839 3.84 6 4.875 6z" />
                    </svg>
                </button>
                <pre><code class="language-${language}">`;
        }
        return '</code></pre></div>';
    }

    private processLine(line: string, index: number, totalLines: number): string {
        let html = '';

        if (line.startsWith('# ')) {
            html += `<h1>${this.processInline(line.slice(2))}</h1>`;
        } else if (line.startsWith('## ')) {
            html += `<h2>${this.processInline(line.slice(3))}</h2>`;
        } else if (line.startsWith('### ')) {
            html += `<h3>${this.processInline(line.slice(4))}</h3>`;
        } else if (line.match(/^\d+\. /)) {
            html += `<ol><li>${this.processInline(line.replace(/^\d+\. /, ''))}</li></ol>`;
        } else if (line.startsWith('- ')) {
            html += `<ul><li>${this.processInline(line.slice(2))}</li></ul>`;
        } else if (line.trim()) {
            html += `<p>${this.processInline(line)}</p>`;
        }

        if (line.trim() || index < totalLines - 1) {
            html += '\n';
        }

        return html;
    }

    private processInline(text: string): string {
        // Processa links markdown primeiro
        text = text.replace(
            /\[([^\]]+)\]\(([^)]+)\)/g,
            (match, text, url) => {
                // Remove aspas extras e espaços do URL
                url = url.trim().replace(/^["']|["']$/g, '');
                return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
            }
        );

        // Depois processa URLs simples como texto clicável
        text = text.replace(
            /(?<!["'(\[])https?:\/\/[^\s<]+[^<.,:;"')\]\s]/g,
            (url) => {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
            }
        );

        // Por último processa outros elementos inline
        return text
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    }

    private updateLanguageStyle(): void {
        const style = document.createElement('style');
        style.textContent = `
            .code-block[data-language="${this.state.currentLanguage}"]::before {
                content: '${this.state.currentLanguage}';
            }
        `;
        document.head.appendChild(style);
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
} 