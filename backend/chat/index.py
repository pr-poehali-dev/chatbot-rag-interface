import json
import re
import os
from typing import Dict, Any, List
from openai import OpenAI

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: RAG чат-бот с OpenAI для анализа документов и поиска релевантной информации
    Args: event - dict с httpMethod, body содержащий query и document
          context - объект с атрибутами request_id, function_name
    Returns: HTTP response dict с ответом и релевантными чанками
    '''
    method: str = event.get('httpMethod', 'GET')
    
    # Обработка CORS OPTIONS запроса
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            'body': ''
        }
    
    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'})
        }
    
    try:
        # Парсим входные данные
        body_data = json.loads(event.get('body', '{}'))
        query = body_data.get('query', '').strip()
        document = body_data.get('document', '').strip()
        
        if not query:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Query is required'})
            }
        
        if not document:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Document is required'})
            }
        
        # Инициализируем OpenAI клиент
        openai_api_key = os.environ.get('OPENAI_API_KEY')
        if not openai_api_key:
            return {
                'statusCode': 500,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'OpenAI API key not configured'})
            }
        
        client = OpenAI(api_key=openai_api_key)
        
        # Выполняем RAG поиск
        relevant_chunks = perform_rag_search(query, document)
        
        # Создаем контекст для OpenAI
        context_text = "\n\n".join([f"Фрагмент {i+1} (релевантность: {chunk['relevance']:.2f}):\n{chunk['text']}" 
                                   for i, chunk in enumerate(relevant_chunks)])
        
        # Формируем промпт для OpenAI
        system_prompt = """Ты - помощник по анализу документов. Твоя задача - отвечать на вопросы пользователя на основе предоставленных фрагментов документа.

Правила:
1. Отвечай только на основе предоставленной информации
2. Если информации недостаточно, так и скажи
3. Структурируй ответ с нумерацией пунктов если возможно
4. Указывай на какие фрагменты ты ссылаешься
5. Отвечай на русском языке"""

        user_prompt = f"""Вопрос пользователя: {query}

Доступные фрагменты документа:
{context_text}

Пожалуйста, ответь на вопрос на основе этих фрагментов."""
        
        # Запрос к OpenAI
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        answer = response.choices[0].message.content
        
        # Возвращаем результат
        result = {
            'answer': answer,
            'relevant_chunks': relevant_chunks[:5],  # Топ-5 чанков
            'query': query,
            'chunks_found': len(relevant_chunks)
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result, ensure_ascii=False)
        }
        
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Invalid JSON in request body'})
        }
    except Exception as e:
        print(f"Error processing chat request: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Internal server error'})
        }


def perform_rag_search(query: str, document: str, chunk_size: int = 200) -> List[Dict[str, Any]]:
    """
    Выполняет RAG поиск по документу
    """
    # Разбиваем документ на чанки
    chunks = create_chunks(document, chunk_size)
    
    # Вычисляем релевантность каждого чанка
    scored_chunks = []
    query_lower = query.lower()
    query_words = set(re.findall(r'\b\w+\b', query_lower))
    
    for i, chunk in enumerate(chunks):
        chunk_lower = chunk.lower()
        score = calculate_relevance_score(query_lower, chunk_lower, query_words)
        
        if score > 0:  # Только релевантные чанки
            scored_chunks.append({
                'text': chunk,
                'relevance': score,
                'chunk_id': i,
                'length': len(chunk)
            })
    
    # Сортируем по релевантности
    scored_chunks.sort(key=lambda x: x['relevance'], reverse=True)
    
    return scored_chunks


def create_chunks(text: str, chunk_size: int = 200) -> List[str]:
    """
    Разбивает текст на чанки с учетом предложений
    """
    # Разбиваем на предложения
    sentences = re.split(r'[.!?]+', text)
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        # Если добавление предложения не превышает лимит
        if len(current_chunk + sentence) <= chunk_size:
            current_chunk += sentence + ". "
        else:
            # Сохраняем текущий чанк и начинаем новый
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + ". "
    
    # Добавляем последний чанк
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks


def calculate_relevance_score(query: str, chunk: str, query_words: set) -> float:
    """
    Вычисляет релевантность чанка запросу
    """
    chunk_words = set(re.findall(r'\b\w+\b', chunk))
    
    # Точные совпадения слов
    exact_matches = len(query_words.intersection(chunk_words))
    
    # Частичные совпадения (для длинных слов)
    partial_score = 0
    for query_word in query_words:
        if len(query_word) > 4:  # Только для длинных слов
            for chunk_word in chunk_words:
                if query_word in chunk_word or chunk_word in query_word:
                    partial_score += 0.5
    
    # Проверяем точные фразы
    phrase_score = 0
    if len(query) > 10:  # Для фраз длиннее 10 символов
        if query in chunk:
            phrase_score = 2.0
    
    # Итоговый скор
    total_score = exact_matches + partial_score + phrase_score
    
    # Нормализуем относительно длины запроса
    if len(query_words) > 0:
        total_score = total_score / len(query_words)
    
    return min(total_score, 1.0)  # Ограничиваем максимум единицей


