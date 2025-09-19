import { useState, useRef } from 'react';
import { Upload, Send, FileText, Bot, User, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  chunks?: RAGChunk[];
}

interface RAGChunk {
  id: string;
  content: string;
  similarity: number;
  source: string;
}

export default function ChatBot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Проверяем размер файла (максимум 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Файл слишком большой. Максимальный размер: 10MB');
      return;
    }

    // Принимаем TXT, PDF и Word файлы
    const allowedExtensions = ['.txt', '.pdf', '.doc', '.docx'];
    const hasValidExtension = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!hasValidExtension) {
      alert('Поддерживаемые форматы: TXT, PDF, DOC, DOCX');
      return;
    }

    setIsProcessingFile(true);
    try {
      console.log('Обрабатываем файл:', {
        name: file.name,
        size: file.size,
        type: file.type
      });

      // Отправляем файл на backend для обработки
      const fileData = await fileToBase64(file);
      
      const response = await fetch('https://functions.poehali.dev/7a3e3ea4-9cd4-4958-b88a-4b0e8a0642af', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_data: fileData,
          file_name: file.name,
          file_type: file.type
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      const extractedText = result.text;
      
      // Проверяем, что текст извлечен
      if (!extractedText.trim()) {
        throw new Error('Не удалось извлечь текст из файла');
      }

      console.log('Текст извлечен, длина:', extractedText.length);

      setUploadedFile(file);
      const botMessage: Message = {
        id: Date.now().toString(),
        type: 'bot',
        content: `Файл "${file.name}" успешно обработан! Размер: ${(file.size / 1024).toFixed(1)}KB, извлечено символов: ${extractedText.length}. Теперь вы можете задавать вопросы по его содержимому.`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botMessage]);

      // Сохраняем текст в localStorage для использования
      localStorage.setItem('uploadedFileContent', extractedText);
      localStorage.setItem('uploadedFileName', file.name);

    } catch (error) {
      console.error('Ошибка при обработке файла:', error);
      const errorMessage = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Ошибка при обработке файла: ${errorMessage}. Убедитесь, что файл не поврежден и имеет правильный формат.`);
    } finally {
      setIsProcessingFile(false);
      // Очищаем input для возможности загрузки того же файла снова
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    if (!uploadedFile) {
      alert('Сначала загрузите документ');
      return;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const question = inputValue;
    setInputValue('');
    setIsLoading(true);

    try {
      // Получаем контент из localStorage
      const fileContent = localStorage.getItem('uploadedFileContent');
      
      if (!fileContent) {
        throw new Error('Содержимое файла не найдено. Загрузите файл заново.');
      }

      // Отправляем запрос к backend для получения ответа от OpenAI
      const response = await fetch('https://functions.poehali.dev/4fb1d688-b077-46e0-a394-ae3de63474a2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: question,
          document: fileContent
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: result.response,
        timestamp: new Date(),
        chunks: result.chunks || []
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: `Извините, произошла ошибка: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Функция для конвертации файла в base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Удаляем префикс data:type;base64,
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">RAG Чат-бот</h1>
              <p className="text-sm text-gray-500">
                {uploadedFile ? `Файл: ${uploadedFile.name}` : 'Загрузите файл для начала'}
              </p>
            </div>
          </div>
          
          {/* File Upload */}
          <div className="flex items-center space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFile}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isProcessingFile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              <span>{isProcessingFile ? 'Обработка...' : 'Загрузить файл'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">Добро пожаловать в RAG чат-бот!</h3>
            <p>Загрузите документ (TXT, PDF, DOC, DOCX) и начните задавать вопросы по его содержимому.</p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="space-y-3">
            <div className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex max-w-3xl ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start space-x-3`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  message.type === 'user' ? 'bg-blue-600 ml-3' : 'bg-gray-600 mr-3'
                }`}>
                  {message.type === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                
                <div className={`flex-1 p-4 rounded-lg ${
                  message.type === 'user' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white border border-gray-200'
                }`}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  <div className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>

            {/* RAG Chunks Visualization */}
            {message.chunks && message.chunks.length > 0 && (
              <div className="ml-11 space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Найденные фрагменты (топ-5):</h4>
                {message.chunks.map((chunk, index) => (
                  <div key={chunk.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-medium text-yellow-800">
                        #{index + 1} • Релевантность: {(chunk.score * 100).toFixed(1)}%
                      </span>
                      <span className="text-xs text-gray-500">{uploadedFile?.name}</span>
                    </div>
                    <p className="text-sm text-gray-700 line-clamp-3">{chunk.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                  <span className="text-gray-500">Генерирую ответ...</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={uploadedFile ? "Задайте вопрос по загруженному документу..." : "Сначала загрузите документ"}
              disabled={!uploadedFile || isLoading}
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              rows={1}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || !uploadedFile || isLoading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
          >
            <Send className="w-4 h-4" />
            <span>Отправить</span>
          </button>
        </div>
      </div>
    </div>
  );
}