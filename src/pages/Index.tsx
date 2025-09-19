import { useState } from 'react';
import FileUpload from '@/components/FileUpload';
import ChatInterface from '@/components/ChatInterface';
import RAGVisualization from '@/components/RAGVisualization';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import * as pdfjsLib from 'pdfjs-dist';
import mammoth from 'mammoth';

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

interface DocumentChunk {
  id: string;
  content: string;
  pageNumber?: number;
  chunkIndex: number;
  wordCount: number;
}

function Index() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [documentText, setDocumentText] = useState<string>('');
  const [documentChunks, setDocumentChunks] = useState<DocumentChunk[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ragChunks, setRagChunks] = useState<RAGChunk[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    // Используем стабильный CDN источник
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
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

  const createRAGChunks = (text: string, chunkSize: number = 300): DocumentChunk[] => {
    if (!text.trim()) return [];

    // Очищаем текст от лишних пробелов и переносов
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    // Разделяем на предложения
    const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    const chunks: DocumentChunk[] = [];
    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      // Если добавление предложения превысит размер чанка, создаем новый чанк
      if (currentChunk.length + trimmedSentence.length > chunkSize && currentChunk.length > 0) {
        chunks.push({
          id: `chunk_${chunkIndex}`,
          content: currentChunk.trim(),
          chunkIndex,
          wordCount: currentChunk.split(' ').length
        });
        
        currentChunk = trimmedSentence;
        chunkIndex++;
      } else {
        currentChunk += (currentChunk ? ' ' : '') + trimmedSentence;
      }
    }

    // Добавляем последний чанк
    if (currentChunk.trim()) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        content: currentChunk.trim(),
        chunkIndex,
        wordCount: currentChunk.split(' ').length
      });
    }

    return chunks;
  };

  const handleFileUpload = async (file: File) => {
    setUploadedFile(file);
    setMessages([]);
    setRagChunks([]);
    setDocumentChunks([]);
    
    // Извлекаем текст из файла
    const text = await extractTextFromFile(file);
    setDocumentText(text);
    
    // Создаем RAG-чанки для поиска
    const chunks = createRAGChunks(text);
    setDocumentChunks(chunks);
  };

  const calculateSemanticSimilarity = (query: string, chunk: DocumentChunk): number => {
    const queryLower = query.toLowerCase();
    const chunkLower = chunk.content.toLowerCase();
    
    // Извлекаем ключевые слова из запроса
    const queryWords = queryLower
      .split(/\s+/)
      .filter(w => w.length > 2)
      .map(w => w.replace(/[^\w\u0400-\u04FF]/g, ''));
    
    if (queryWords.length === 0) return 0;
    
    let score = 0;
    let totalPossibleScore = 0;
    
    queryWords.forEach(word => {
      totalPossibleScore += 1;
      
      // Точное совпадение слова (высокий вес)
      const exactMatches = (chunkLower.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
      score += exactMatches * 0.5;
      
      // Частичное совпадение (средний вес)
      if (chunkLower.includes(word)) {
        score += 0.2;
      }
      
      // Совпадения с вариациями слова (низкий вес)
      const variations = [word + 'а', word + 'ы', word + 'и', word + 'ов', word + 'ах'];
      variations.forEach(variation => {
        if (chunkLower.includes(variation)) {
          score += 0.05;
        }
      });
    });
    
    // Нормализуем по количеству слов в запросе
    let normalizedScore = totalPossibleScore > 0 ? score / totalPossibleScore : 0;
    
    // Бонусы за контекст
    // Бонус за длину чанка (оптимальная длина 100-500 символов)
    const lengthBonus = chunk.content.length >= 100 && chunk.content.length <= 500 ? 0.1 : 0;
    normalizedScore += lengthBonus;
    
    // Бонус за позицию в документе (первые чанки важнее)
    const positionBonus = Math.max(0, 0.1 - (chunk.chunkIndex / documentChunks.length) * 0.1);
    normalizedScore += positionBonus;
    
    return Math.min(normalizedScore, 1);
  };

  const findRelevantChunks = (query: string): RAGChunk[] => {
    if (!documentChunks.length) return [];
    
    // Вычисляем релевантность для каждого чанка
    const scoredChunks = documentChunks.map(chunk => ({
      content: chunk.content,
      score: calculateSemanticSimilarity(query, chunk),
      source: `Чанк ${chunk.chunkIndex + 1} (${chunk.wordCount} слов)`
    }));
    
    // Фильтруем и сортируем по релевантности
    return scoredChunks
      .filter(chunk => chunk.score > 0.01) // Минимальный порог релевантности
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Топ-5 результатов
  };

  const generateResponse = (query: string, chunks: RAGChunk[], fullText: string): string => {
    if (chunks.length === 0) {
      return `К сожалению, в документе "${uploadedFile?.name || 'документ'}" не найдено информации, релевантной вашему запросу "${query}". \n\nВозможные причины:\n• Информация отсутствует в документе\n• Попробуйте переформулировать вопрос\n• Используйте другие ключевые слова\n\nВсего создано ${documentChunks.length} чанков для анализа.`;
    }
    
    const queryLower = query.toLowerCase();
    const topChunk = chunks[0];
    const highScoreChunks = chunks.filter(c => c.score > 0.3);
    
    // Анализируем тип вопроса для улучшения ответа
    let response = '';
    
    if (queryLower.includes('название') || queryLower.includes('заголовок') || queryLower.includes('статья') || queryLower.includes('title')) {
      // Специальная обработка для вопросов о названии
      const firstParagraphs = documentChunks.slice(0, 3);
      let titleFound = false;
      
      for (const chunk of firstParagraphs) {
        const content = chunk.content.trim();
        // Ищем строки, которые могут быть заголовком
        if (content.length > 10 && content.length < 200 && 
            !content.toLowerCase().includes('abstract') &&
            !content.toLowerCase().includes('introduction') &&
            !content.toLowerCase().includes('keywords')) {
          response = `Название статьи: "${content}"\n\n`;
          titleFound = true;
          break;
        }
      }
      
      if (!titleFound && topChunk) {
        response = `Возможное название из релевантного фрагмента: "${topChunk.content}"\n\n`;
      }
    } else if (queryLower.includes('автор') || queryLower.includes('author')) {
      response = `Информация об авторах:\n\n`;
    } else if (queryLower.includes('аннотация') || queryLower.includes('abstract') || queryLower.includes('резюме')) {
      response = `Аннотация:\n\n`;
    } else if (queryLower.includes('вывод') || queryLower.includes('заключение') || queryLower.includes('conclusion')) {
      response = `Выводы:\n\n`;
    } else {
      response = `По вашему вопросу "${query}" найдена следующая информация:\n\n`;
    }
    
    // Формируем основной ответ из релевантных чанков
    if (highScoreChunks.length >= 2) {
      // Используем несколько высокорелевантных чанков
      response += highScoreChunks.slice(0, 2)
        .map((chunk, index) => `${index + 1}. ${chunk.content}`)
        .join('\n\n');
    } else if (topChunk) {
      // Используем самый релевантный чанк
      response += topChunk.content;
    }
    
    // Добавляем информацию о поиске
    const statsInfo = `\n\n📊 Статистика поиска:\n• Найдено релевантных фрагментов: ${chunks.length}\n• Максимальная релевантность: ${(topChunk.score * 100).toFixed(1)}%\n• Проанализировано чанков: ${documentChunks.length}`;
    
    return response + statsInfo;
  };

  const handleSendMessage = async (content: string) => {
    if (!documentText || !documentChunks.length) {
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

    // Имитация задержки обработки RAG-поиска
    setTimeout(() => {
      // Поиск релевантных чанков в RAG-индексе
      const relevantChunks = findRelevantChunks(content);
      
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
    }, 1000);
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