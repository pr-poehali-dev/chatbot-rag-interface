import json
import os
import re
from typing import Dict, Any, List
import openai
from openai import OpenAI

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Обрабатывает чат запросы с RAG поиском через OpenAI
    Args: event - dict с httpMethod, body (message, document)
          context - объект с request_id, function_name и другими атрибутами
    Returns: HTTP ответ с response и chunks
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
        # Парсим данные запроса
        body_data = json.loads(event.get('body', '{}'))
        user_message = body_data.get('message', '').strip()
        document_content = body_data.get('document', '').strip()
        
        if not user_message:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Message is required'})
            }
        
        if not document_content:
            return {
                'statusCode': 400,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Document content is required'})
            }
        
        # Инициализируем OpenAI клиент
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            return {
                'statusCode': 500,
                'headers': {'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'OpenAI API key not configured'})
            }
        
        client = OpenAI(api_key=api_key)
        
        # Выполняем RAG поиск
        relevant_chunks = perform_rag_search(document_content, user_message)
        
        # Формируем контекст для OpenAI
        context_text = "\n\n".join([chunk['text'] for chunk in relevant_chunks[:5]])
        
        # Создаем промпт для OpenAI
        system_prompt = """Ты - помощник для анализа документов. Отвечай на вопросы пользователя на основе предоставленного контекста из документа.

Правила:
1. Используй только информацию из предоставленного контекста
2. Если в контексте нет ответа на вопрос, честно скажи об этом
3. Отвечай на русском языке
4. Будь точным и конкретным
5. Ссылайся на конкретные фрагменты текста при ответе"""

        user_prompt = f"""Контекст из документа:
{context_text}

Вопрос пользователя: {user_message}

Ответь на вопрос на основе предоставленного контекста."""

        # Отправляем запрос к OpenAI
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        ai_response = response.choices[0].message.content
        
        # Формируем ответ
        result = {
            'response': ai_response,
            'chunks': relevant_chunks[:5],  # Топ-5 чанков
            'request_id': context.request_id
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


def perform_rag_search(document: str, query: str) -> List[Dict[str, Any]]:
    """
    Выполняет простой RAG поиск по документу
    """
    # Разбиваем документ на предложения
    sentences = re.split(r'[.!?]+', document)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
    
    # Получаем ключевые слова из запроса
    query_words = set(query.lower().split())
    query_words = {word for word in query_words if len(word) > 2}
    
    chunks = []
    
    for i, sentence in enumerate(sentences):
        sentence_lower = sentence.lower()
        
        # Подсчитываем релевантность
        word_matches = sum(1 for word in query_words if word in sentence_lower)
        phrase_match = 5 if query.lower() in sentence_lower else 0
        
        # Нормализуем счет
        total_score = (word_matches + phrase_match) / max(len(query_words), 1)
        
        if total_score > 0:
            chunks.append({
                'text': sentence,
                'score': min(total_score, 1.0),  # Ограничиваем до 1.0
                'index': i
            })
    
    # Сортируем по релевантности
    chunks.sort(key=lambda x: x['score'], reverse=True)
    
    return chunks[:10]  # Возвращаем топ-10