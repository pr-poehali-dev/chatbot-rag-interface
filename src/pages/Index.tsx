import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';
import RAGVisualization from '@/components/RAGVisualization';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Настройка PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

// Настройка PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

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

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }

    return fullText;
  };

  const extractTextFromDOCX = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
  };

  const extractTextFromFile = async (file: File): Promise<string> => {
    try {
      if (file.type === 'application/pdf') {
        return await extractTextFromPDF(file);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        return await extractTextFromDOCX(file);
      } else {
        throw new Error('Неподдерживаемый формат файла');
      }
    } catch (error) {
      console.error('Ошибка извлечения текста:', error);
      return `Ошибка при обработке файла "${file.name}". Убедитесь, что файл не поврежден и имеет правильный формат.`;
    }
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
    
    // Разбиваем текст на абзацы и предложения
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 20);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 15);
    
    // Все возможные чанки (абзацы + предложения)
    const allChunks = [
      ...paragraphs.map((p, i) => ({ text: p, type: 'paragraph', index: i })),
      ...sentences.map((s, i) => ({ text: s, type: 'sentence', index: i }))
    ];
    
    // Ключевые слова из запроса
    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 2)
      .map(w => w.replace(/[^\w\u0400-\u04FF]/g, ''));
    
    // Оценка релевантности каждого чанка
    const scoredChunks = allChunks.map((chunk) => {
      const chunkLower = chunk.text.toLowerCase();
      let score = 0;
      
      // Точные совпадения слов
      queryWords.forEach(word => {
        const regex = new RegExp(`\\b${word}`, 'gi');
        const matches = chunkLower.match(regex);
        if (matches) {
          score += matches.length * 0.3;
        }
      });
      
      // Частичные совпадения
      queryWords.forEach(word => {
        if (word.length > 3 && chunkLower.includes(word)) {
          score += 0.1;
        }
      });
      
      // Бонус за длину чанка (более длинные чанки предпочтительнее)
      if (chunk.type === 'paragraph') {
        score += 0.05;
      }
      
      // Бонус за позицию в документе (начало документа важнее)
      const positionBonus = Math.max(0, 0.1 - (chunk.index / allChunks.length) * 0.1);
      score += positionBonus;
      
      return {
        content: chunk.text.trim(),
        score: Math.min(score, 1),
        source: chunk.type === 'paragraph' 
          ? `Абзац ${chunk.index + 1}` 
          : `Предложение ${chunk.index + 1}`
      };
    });
    
    // Возвращаем топ-5 самых релевантных с минимальным порогом
    return scoredChunks
      .filter(chunk => chunk.score > 0.05)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  };

  const generateResponse = (query: string, chunks: RAGChunk[], fullText: string): string => {
    if (chunks.length === 0) {
      return `К сожалению, в документе "${uploadedFile?.name || 'документ'}" не найдено информации, релевантной вашему запросу "${query}". Попробуйте переформулировать вопрос или использовать другие ключевые слова.`;
    }
    
    const topChunk = chunks[0];
    const highScoreChunks = chunks.filter(c => c.score > 0.3);
    
    // Определяем тип вопроса для более точного ответа
    const queryLower = query.toLowerCase();
    let responsePrefix = '';
    
    if (queryLower.includes('название') || queryLower.includes('заголовок') || queryLower.includes('статья')) {
      // Ищем заголовок в начале документа
      const firstLines = fullText.split('\n').slice(0, 5);
      const possibleTitle = firstLines.find(line => 
        line.trim().length > 5 && 
        line.trim().length < 200 && 
        !line.includes('Abstract') &&
        !line.includes('Keywords')
      );
      
      if (possibleTitle) {
        responsePrefix = `Название документа: "${possibleTitle.trim()}"\n\n`;
      }
    } else if (queryLower.includes('автор') || queryLower.includes('author')) {
      responsePrefix = `Информация об авторе найдена в документе:\n\n`;
    } else if (queryLower.includes('аннотация') || queryLower.includes('abstract') || queryLower.includes('резюме')) {
      responsePrefix = `Аннотация документа:\n\n`;
    } else if (queryLower.includes('вывод') || queryLower.includes('заключение') || queryLower.includes('conclusion')) {
      responsePrefix = `Выводы из документа:\n\n`;
    }
    
    let mainResponse = '';
    if (highScoreChunks.length > 0) {
      mainResponse = highScoreChunks.slice(0, 2).map(chunk => chunk.content).join('\n\n');
    } else {
      mainResponse = topChunk.content;
    }
    
    const additionalInfo = chunks.length > 1 
      ? `\n\nДополнительно найдено ${chunks.length - 1} связанных фрагментов с релевантностью от ${(chunks[chunks.length - 1]?.score * 100 || 0).toFixed(1)}% до ${(topChunk.score * 100).toFixed(1)}%.`
      : '';
    
    return `${responsePrefix}${mainResponse}${additionalInfo}`;
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
      const responseText = generateResponse(content, relevantChunks, documentText);

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