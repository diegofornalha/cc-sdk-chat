import { marked } from 'marked';

interface MarkedOptions {
    highlight?: (code: string, lang: string) => string;
    breaks?: boolean;
    gfm?: boolean;
}

export class MarkdownRenderer {
    private container: HTMLElement;
    private static styleAdded = false;

    constructor(containerId: string) {
        const element = document.getElementById(containerId);
        if (!element) {
            throw new Error(`Container element with id '${containerId}' not found`);
        }
        this.container = element;
        this.container.classList.add('notion-content');
    }

    render(markdown: string): void {
        const options: MarkedOptions = {
            highlight: (code: string): string => code,
            breaks: true,
            gfm: true
        };

        // Configurar o marked para converter URLs em links
        const renderer = new marked.Renderer();
        renderer.link = (href: string, title: string | null, text: string): string => {
            const isExternal = href.startsWith('http') || href.startsWith('https');
            const target = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
            const titleAttr = title ? ` title="${title}"` : '';
            return `<a href="${href}"${target}${titleAttr}>${text}</a>`;
        };

        // Adicionar suporte para autolink de URLs
        renderer.text = (text: string): string => {
            const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/g;
            return text.replace(urlRegex, (url) => {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
            });
        };

        marked.setOptions({ ...options, renderer });
        const html = marked.parse(markdown);
        this.container.innerHTML = html;

        if (!MarkdownRenderer.styleAdded) {
            this.applyStyles();
            MarkdownRenderer.styleAdded = true;
        }
    }

    private applyStyles(): void {
        const style = document.createElement('style');
        style.textContent = this.getStyles();
        document.head.appendChild(style);
    }

    private getStyles(): string {
        return `
            .notion-content {
                font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, sans-serif;
                line-height: 1.5;
                color: rgb(55, 53, 47);
                width: 100%;
                max-width: 900px;
                margin: 0 auto;
                padding: 0 96px;
            }

            .notion-content > *:first-child {
                margin-top: 2em;
            }

            .notion-content h1 {
                font-weight: 700;
                font-size: 2.5em;
                margin: 1em 0 4px;
                padding: 3px 2px;
            }

            .notion-content h2 {
                font-weight: 600;
                font-size: 1.875em;
                margin: 1.4em 0 4px;
                padding: 3px 2px;
            }

            .notion-content h3 {
                font-weight: 600;
                font-size: 1.5em;
                margin: 1em 0 4px;
                padding: 3px 2px;
            }

            .notion-content p {
                margin: 2px 0;
                padding: 3px 2px;
                min-height: 1.5em;
            }

            .notion-content p:first-of-type {
                font-style: italic;
                color: rgba(55, 53, 47, 0.65);
            }

            .notion-content pre {
                background: rgb(247, 246, 243);
                border-radius: 4px;
                padding: 16px;
                margin: 4px 0;
                overflow: auto;
            }

            .notion-content code {
                font-family: SFMono-Regular, Menlo, Consolas, "PT Mono", "Liberation Mono", Courier, monospace;
                line-height: normal;
                background: rgba(135, 131, 120, 0.15);
                color: #EB5757;
                border-radius: 3px;
                font-size: 85%;
                padding: 0.2em 0.4em;
            }

            .notion-content pre code {
                background: transparent;
                padding: 0;
                color: inherit;
                font-size: 14px;
                display: block;
            }

            .notion-content ul,
            .notion-content ol {
                margin: 2px 0;
                padding-left: 24px;
            }

            .notion-content li {
                padding: 3px 2px;
                min-height: 1.5em;
            }

            .notion-content blockquote {
                margin: 4px 0;
                padding-left: 14px;
                border-left: 3px solid rgba(55, 53, 47, 0.16);
                color: rgba(55, 53, 47, 0.65);
            }

            .notion-content a {
                color: rgb(35, 131, 226);
                text-decoration: none;
                border-bottom: 0.05em solid rgba(35, 131, 226, 0.4);
                transition: border-color 0.15s ease;
            }

            .notion-content a:hover {
                border-bottom: 0.05em solid rgb(35, 131, 226);
                background: rgba(35, 131, 226, 0.1);
            }

            .notion-content strong {
                font-weight: 600;
            }

            .notion-content hr {
                margin: 6px 0;
                border: none;
                border-top: 1px solid rgba(55, 53, 47, 0.16);
            }

            .code-block {
                background: rgb(247, 246, 243);
                border-radius: 3px;
                margin: 4px 0;
                padding: 30px 16px 16px;
                position: relative;
            }

            .code-block::before {
                content: 'bash';
                position: absolute;
                top: 8px;
                left: 16px;
                font-size: 12px;
                color: rgba(55, 53, 47, 0.5);
            }

            .code-block pre {
                margin: 0;
                padding: 0;
                background: transparent;
            }

            .code-block code {
                font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
                font-size: 14px;
                line-height: 1.4;
                color: rgb(55, 53, 47);
                white-space: pre-wrap;
                word-break: break-word;
            }
        `;
    }
} 