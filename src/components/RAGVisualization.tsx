import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface RAGChunk {
  content: string;
  score: number;
  source: string;
}

interface RAGVisualizationProps {
  chunks: RAGChunk[];
}

const RAGVisualization = ({ chunks }: RAGVisualizationProps) => {
  const getScoreColor = (score: number) => {
    if (score >= 0.9) return 'bg-green-500';
    if (score >= 0.8) return 'bg-green-400';
    if (score >= 0.7) return 'bg-yellow-500';
    if (score >= 0.6) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.9) return 'Очень высокая';
    if (score >= 0.8) return 'Высокая';
    if (score >= 0.7) return 'Средняя';
    if (score >= 0.6) return 'Низкая';
    return 'Очень низкая';
  };

  return (
    <Card className="h-[600px] flex flex-col">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Icon name="Search" size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900">
              RAG Результаты
            </h3>
            <p className="text-sm text-slate-600">
              Топ-5 релевантных фрагментов
            </p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          {chunks.length === 0 ? (
            <div className="text-center py-12">
              <div className="mb-4">
                <Icon name="FileSearch" size={48} className="text-slate-300 mx-auto" />
              </div>
              <h4 className="font-medium text-slate-900 mb-2">
                Нет результатов поиска
              </h4>
              <p className="text-slate-600 text-sm">
                Задайте вопрос в чате, чтобы увидеть релевантные фрагменты документа
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700">
                    Найдено фрагментов: {chunks.length}
                  </span>
                  <div className="flex items-center space-x-2 text-xs text-slate-500">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span>Высокая релевантность</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Средний скор релевантности</span>
                    <span>{((chunks.reduce((acc, chunk) => acc + chunk.score, 0) / chunks.length) * 100).toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={(chunks.reduce((acc, chunk) => acc + chunk.score, 0) / chunks.length) * 100} 
                    className="h-2"
                  />
                </div>
              </div>

              {chunks.map((chunk, index) => (
                <Card key={index} className="p-4 border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline" className="text-xs">
                          #{index + 1}
                        </Badge>
                        <span className="text-sm text-slate-600">
                          {chunk.source}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${getScoreColor(chunk.score)}`}></div>
                        <span className="text-xs text-slate-600">
                          {getScoreLabel(chunk.score)}
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-800 leading-relaxed">
                      "{chunk.content}"
                    </p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <div className="flex items-center space-x-2">
                        <Icon name="Target" size={14} className="text-slate-400" />
                        <span className="text-xs text-slate-500">
                          Релевантность
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Progress 
                          value={chunk.score * 100} 
                          className="w-20 h-1.5"
                        />
                        <span className="text-xs font-medium text-slate-700 min-w-[3rem]">
                          {(chunk.score * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {chunks.length > 0 && (
        <div className="p-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <div className="flex items-center space-x-2">
              <Icon name="Info" size={14} />
              <span>Фрагменты отсортированы по релевантности</span>
            </div>
            <button className="flex items-center space-x-1 text-primary hover:text-primary/80 transition-colors">
              <span>Экспорт</span>
              <Icon name="Download" size={12} />
            </button>
          </div>
        </div>
      )}
    </Card>
  );
};

export default RAGVisualization;