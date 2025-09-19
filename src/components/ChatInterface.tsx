import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import Icon from '@/components/ui/icon';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isProcessing: boolean;
  uploadedFileName?: string;
}

const ChatInterface = ({ messages, onSendMessage, isProcessing, uploadedFileName }: ChatInterfaceProps) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (inputValue.trim() && !isProcessing) {
      onSendMessage(inputValue.trim());
      setInputValue('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Icon name="MessageSquare" size={20} className="text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">
                Чат с документом
              </h3>
              {uploadedFileName && (
                <p className="text-sm text-slate-600">
                  {uploadedFileName}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-2 text-sm text-slate-500">
            <Icon name="Users" size={16} />
            <span>AI Assistant</span>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="mb-4">
                <Icon name="MessageCircle" size={48} className="text-slate-300 mx-auto" />
              </div>
              <h4 className="font-medium text-slate-900 mb-2">
                Начните диалог с AI-ассистентом
              </h4>
              <p className="text-slate-600 max-w-md mx-auto">
                Задавайте вопросы о содержании загруженного документа. 
                ИИ найдет релевантную информацию и даст развернутый ответ.
              </p>
              <div className="mt-6 space-y-2">
                <p className="text-sm font-medium text-slate-700">Примеры вопросов:</p>
                <div className="text-sm text-slate-600 space-y-1">
                  <p>• "Расскажи основные выводы документа"</p>
                  <p>• "Какие цифры приводятся в отчете?"</p>
                  <p>• "Кто упоминается в тексте?"</p>
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div className={`flex items-start space-x-3 max-w-[80%] ${
                message.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
              }`}>
                <div className={`
                  p-2 rounded-full 
                  ${message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-slate-100 text-slate-600'
                  }
                `}>
                  <Icon 
                    name={message.role === 'user' ? 'User' : 'Bot'} 
                    size={16} 
                  />
                </div>
                <div className={`
                  p-4 rounded-lg 
                  ${message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-slate-100 text-slate-900'
                  }
                `}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <p className={`
                    text-xs mt-2 
                    ${message.role === 'user' 
                      ? 'text-primary-foreground/70' 
                      : 'text-slate-500'
                    }
                  `}>
                    {formatTime(message.timestamp)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="flex items-start space-x-3 max-w-[80%]">
                <div className="p-2 rounded-full bg-slate-100 text-slate-600">
                  <Icon name="Bot" size={16} />
                </div>
                <div className="p-4 rounded-lg bg-slate-100">
                  <div className="flex items-center space-x-2">
                    <Icon name="Loader2" size={16} className="animate-spin text-slate-600" />
                    <span className="text-slate-600">Анализирую документ...</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      <div className="p-4 border-t border-slate-200">
        <div className="flex space-x-3">
          <Textarea
            ref={textareaRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Задайте вопрос о документе..."
            className="flex-1 min-h-[44px] max-h-32 resize-none"
            disabled={isProcessing}
          />
          <Button 
            onClick={handleSend}
            disabled={!inputValue.trim() || isProcessing}
            size="lg"
            className="px-6"
          >
            {isProcessing ? (
              <Icon name="Loader2" size={18} className="animate-spin" />
            ) : (
              <Icon name="Send" size={18} />
            )}
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>Нажмите Enter для отправки, Shift+Enter для новой строки</span>
          <span className={inputValue.length > 500 ? 'text-orange-600' : ''}>
            {inputValue.length}/1000
          </span>
        </div>
      </div>
    </Card>
  );
};

export default ChatInterface;