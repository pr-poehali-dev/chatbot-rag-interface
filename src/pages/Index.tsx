import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';
import RAGVisualization from '@/components/RAGVisualization';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
}

interface RAGChunk {
  content: string;
  score: number;
  source: string;
}

function Index() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ragChunks, setRagChunks] = useState<RAGChunk[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setMessages([]);
    setRagChunks([]);
  };

  const handleSendMessage = async (content: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    // Симуляция RAG-чанков для демонстрации
    const mockChunks: RAGChunk[] = [
      {
        content: "Компания была основана в 2020 году с целью создания инновационных решений в области искусственного интеллекта.",
        score: 0.95,
        source: "Введение, стр. 1"
      },
      {
        content: "Наши основные продукты включают платформы для машинного обучения и обработки естественного языка.",
        score: 0.89,
        source: "Продукты, стр. 3"
      },
      {
        content: "В команде работает более 150 специалистов в области ИИ и разработки программного обеспечения.",
        score: 0.84,
        source: "О компании, стр. 2"
      },
      {
        content: "Мы сотрудничаем с ведущими университетами и исследовательскими центрами по всему миру.",
        score: 0.78,
        source: "Партнерства, стр. 5"
      },
      {
        content: "Годовой оборот компании составляет более 50 миллионов долларов США.",
        score: 0.72,
        source: "Финансы, стр. 8"
      }
    ];

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `На основе анализа документа "${uploadedFile?.name || 'документ'}", я нашел релевантную информацию. Компания была основана в 2020 году и специализируется на создании ИИ-решений. В команде работает более 150 специалистов, а годовой оборот превышает 50 миллионов долларов.`,
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setRagChunks(mockChunks);
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Icon name="FileText" size={24} className="text-primary" />
              </div>
              <h1 className="text-xl font-semibold text-slate-900">
                AI Document Assistant
              </h1>
            </div>
            <div className="text-sm text-slate-500">
              Корпоративная система анализа документов
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center space-x-2">
              <Icon name="Upload" size={16} />
              <span>Загрузка</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center space-x-2" disabled={!uploadedFile}>
              <Icon name="MessageSquare" size={16} />
              <span>Чат</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Card className="p-8">
              <div className="text-center space-y-4 mb-8">
                <h2 className="text-2xl font-semibold text-slate-900">
                  Загрузите документ для анализа
                </h2>
                <p className="text-slate-600 max-w-2xl mx-auto">
                  Поддерживаются форматы PDF и DOCX. Система автоматически извлечет текст 
                  и создаст индекс для быстрого поиска информации.
                </p>
              </div>
              <FileUpload onFileUpload={handleFileUpload} />
              
              {uploadedFile && (
                <div className="mt-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <Icon name="CheckCircle" size={20} className="text-green-600" />
                    <div>
                      <p className="font-medium text-green-900">
                        Документ успешно загружен
                      </p>
                      <p className="text-sm text-green-700">
                        {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="chat" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <ChatInterface 
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isProcessing={isProcessing}
                  uploadedFileName={uploadedFile?.name}
                />
              </div>
              <div className="lg:col-span-1">
                <RAGVisualization chunks={ragChunks} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default Index;