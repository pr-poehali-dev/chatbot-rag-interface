import { useCallback, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface FileUploadProps {
  onFileUpload: (file: File) => void;
}

const FileUpload = ({ onFileUpload }: FileUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    // Симуляция загрузки с прогрессом
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          onFileUpload(file);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file && (file.type === 'application/pdf' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  }, [handleFileUpload]);

  return (
    <div className="w-full max-w-4xl mx-auto">
      <Card 
        className={`
          border-2 border-dashed transition-all duration-200 cursor-pointer
          ${isDragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-slate-300 hover:border-slate-400'
          }
          ${isUploading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="p-12 text-center space-y-6">
          <div className="flex justify-center">
            <div className="p-4 bg-slate-100 rounded-full">
              <Icon 
                name={isUploading ? "Loader2" : "Upload"} 
                size={48} 
                className={`text-slate-600 ${isUploading ? 'animate-spin' : ''}`} 
              />
            </div>
          </div>
          
          <div className="space-y-3">
            <h3 className="text-xl font-semibold text-slate-900">
              {isUploading ? 'Обработка документа...' : 'Перетащите файл сюда'}
            </h3>
            <p className="text-slate-600">
              или нажмите для выбора файла
            </p>
            <div className="flex items-center justify-center space-x-6 text-sm text-slate-500">
              <div className="flex items-center space-x-2">
                <Icon name="FileText" size={16} />
                <span>PDF</span>
              </div>
              <div className="flex items-center space-x-2">
                <Icon name="FileText" size={16} />
                <span>DOCX</span>
              </div>
            </div>
          </div>

          {isUploading && (
            <div className="space-y-3">
              <Progress value={uploadProgress} className="w-full max-w-md mx-auto" />
              <p className="text-sm text-slate-600">
                Извлечение текста и создание индекса... {uploadProgress}%
              </p>
            </div>
          )}

          {!isUploading && (
            <Button 
              onClick={() => document.getElementById('file-input')?.click()}
              className="px-6 py-2"
            >
              <Icon name="FolderOpen" size={18} className="mr-2" />
              Выбрать файл
            </Button>
          )}

          <input
            id="file-input"
            type="file"
            accept=".pdf,.docx"
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
      </Card>

      <div className="mt-4 text-center text-sm text-slate-500">
        Максимальный размер файла: 50 МБ
      </div>
    </div>
  );
};

export default FileUpload;