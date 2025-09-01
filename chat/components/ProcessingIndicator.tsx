import React from 'react';
import { Card } from '../src/components/ui/card';

interface ProcessingIndicatorProps {
    message?: string;
    className?: string;
}

export const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
    message = 'Processando Resposta',
    className = ''
}) => {
    return (
        <Card className={`flex-1 overflow-hidden ${className}`}>
            <div className="p-4">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <span className="text-sm font-medium italic">{message}</span>
                    <div className="flex gap-1">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                    </div>
                </div>
            </div>
        </Card>
    );
};