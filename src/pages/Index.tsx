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
  const [documentText, setDocumentText] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [ragChunks, setRagChunks] = useState<RAGChunk[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const extractTextFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (file.type === 'application/pdf') {
          // Симуляция извлечения текста из PDF
          resolve(`Содержимое PDF файла "${file.name}":\n\nЭто демонстрационный текст, извлеченный из вашего PDF документа. В реальной системе здесь был бы настоящий текст из загруженного файла.\n\nОсновные разделы:\n1. Введение\n2. Методология\n3. Результаты исследования\n4. Выводы\n\nТекст содержит важную информацию по теме исследования.`);
        } else {
          // Симуляция извлечения текста из DOCX
          resolve(`Содержимое DOCX файла "${file.name}":\n\nЭто демонстрационный текст из вашего Word документа. В реальной реализации здесь отображался бы фактический контент файла.\n\nСтруктура документа:\n- Заголовок\n- Основной текст\n- Таблицы и диаграммы\n- Заключение\n\nВ документе представлена подробная информация по запрашиваемой теме.`);
        }
      };
      reader.readAsText(file);
    });
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setMessages([]);
    setRagChunks([]);
    
    // Извлекаем текст из файла
    const text = await extractTextFromFile(file);
    setDocumentText(text);
  };

  const findRelevantChunks = (query: string, text: string): RAGChunk[] => {
    if (!text) return [];
    
    // Разбиваем текст на предложения
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    // Ключевые слова из запроса (простая реализация)
    const queryWords = query.toLowerCase().split(' ').filter(w => w.length > 2);
    
    // Оценка релевантности каждого предложения
    const scoredChunks = sentences.map((sentence, index) => {
      const sentenceLower = sentence.toLowerCase();
      let score = 0;
      
      // Подсчитываем совпадения ключевых слов
      queryWords.forEach(word => {
        if (sentenceLower.includes(word)) {
          score += 0.2;
        }
      });
      
      // Добавляем случайность для демонстрации
      score += Math.random() * 0.3;
      
      return {
        content: sentence.trim(),
        score: Math.min(score, 1),
        source: `Фрагмент ${index + 1} из документа`
      };
    });
    
    // Возвращаем топ-5 самых релевантных
    return scoredChunks
      .filter(chunk => chunk.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  };

  const generateResponse = (query: string, chunks: RAGChunk[]): string => {
    if (chunks.length === 0) {
      return `К сожалению, в документе "${uploadedFile?.name || 'документ'}" не найдено информации, релевантной вашему запросу "${query}". Попробуйте переформулировать вопрос или задать другой.`;
    }
    
    const topChunk = chunks[0];
    const contextInfo = chunks.map(c => c.content).join(' ');
    
    return `На основе анализа документа "${uploadedFile?.name || 'документ'}" по вашему запросу "${query}" найдена следующая информация:\n\n${topChunk.content}\n\nДополнительно обнаружено ${chunks.length - 1} связанных фрагментов с релевантностью от ${(chunks[chunks.length - 1]?.score * 100 || 0).toFixed(1)}% до ${(topChunk.score * 100).toFixed(1)}%.`;
  };

  const handleSendMessage = async (content: string) => {
    if (!documentText) {
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      content,
      role: 'user',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    // Имитация задержки обработки
    setTimeout(() => {
      // Поиск релевантных чанков в реальном тексте документа
      const relevantChunks = findRelevantChunks(content, documentText);
      
      // Генерация ответа на основе найденных чанков
      const responseText = generateResponse(content, relevantChunks);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: responseText,
        role: 'assistant',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);
      setRagChunks(relevantChunks);
      setIsProcessing(false);
    }, 1500);
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