import json
import re
from typing import Dict, Any, List
import requests

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Business: Обрабатывает чат запросы с RAG поиском через бесплатную LLM
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
        
        # Выполняем RAG поиск
        relevant_chunks = perform_rag_search(document_content, user_message)
        
        # Получаем ответ от бесплатной LLM
        ai_response = get_llm_response(user_message, relevant_chunks)
        
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


def get_llm_response(question: str, chunks: List[Dict[str, Any]]) -> str:
    """
    Получает ответ от бесплатной LLM через Hugging Face API
    """
    try:
        # Используем бесплатный API Hugging Face без токена (ограниченный, но работает)
        api_url = "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium"
        
        # Формируем контекст из найденных чанков
        if chunks:
            context = "\n".join([chunk['text'][:200] for chunk in chunks[:3]])
            prompt = f"Контекст: {context}\n\nВопрос: {question}\n\nОтвет:"
        else:
            prompt = f"Вопрос: {question}\n\nОтвет:"
        
        # Отправляем запрос
        response = requests.post(
            api_url,
            headers={"Content-Type": "application/json"},
            json={"inputs": prompt, "parameters": {"max_length": 300, "temperature": 0.7}},
            timeout=30
        )
        
        if response.status_code == 200:
            result = response.json()
            if isinstance(result, list) and len(result) > 0:
                generated_text = result[0].get('generated_text', '')
                # Извлекаем только ответ после "Ответ:"
                if "Ответ:" in generated_text:
                    answer = generated_text.split("Ответ:")[-1].strip()
                    if answer:
                        return answer
            
        # Fallback: используем простую логику на основе найденных чанков
        return generate_simple_answer(chunks, question)
        
    except Exception as e:
        print(f"Error with LLM API: {str(e)}")
        # Fallback: простой ответ на основе найденных фрагментов
        return generate_simple_answer(chunks, question)


def generate_simple_answer(chunks: List[Dict[str, Any]], question: str) -> str:
    """
    Генерирует простой ответ на основе найденных фрагментов
    """
    if not chunks:
        return f"К сожалению, я не нашел информации по вашему вопросу '{question}' в загруженном документе. Попробуйте переформулировать вопрос или использовать другие ключевые слова."
    
    # Берем топ-3 самых релевантных фрагмента
    top_chunks = chunks[:3]
    
    # Формируем ответ
    answer_parts = []
    answer_parts.append("На основе анализа документа найдена следующая информация:\n")
    
    for i, chunk in enumerate(top_chunks, 1):
        # Ограничиваем длину фрагмента
        text = chunk['text']
        if len(text) > 300:
            text = text[:300] + "..."
        answer_parts.append(f"{i}. {text}")
    
    answer_parts.append(f"\nЭто наиболее релевантные фрагменты из {len(chunks)} найденных по вашему запросу.")
    
    return "\n\n".join(answer_parts)


def perform_rag_search(document: str, query: str) -> List[Dict[str, Any]]:
    """
    Выполняет улучшенный RAG поиск по документу
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
        
        # Подсчитываем релевантность разными способами
        word_matches = sum(1 for word in query_words if word in sentence_lower)
        phrase_match = 5 if query.lower() in sentence_lower else 0
        
        # Бонус за частичные совпадения
        partial_matches = 0
        for word in query_words:
            if len(word) > 4:  # Для длинных слов ищем частичные совпадения
                for sentence_word in sentence_lower.split():
                    if word in sentence_word or sentence_word in word:
                        partial_matches += 0.5
        
        # Итоговый счет
        total_score = (word_matches + phrase_match + partial_matches) / max(len(query_words), 1)
        
        if total_score > 0:
            chunks.append({
                'text': sentence,
                'score': min(total_score, 1.0),  # Ограничиваем до 1.0
                'index': i
            })
    
    # Сортируем по релевантности
    chunks.sort(key=lambda x: x['score'], reverse=True)
    
    return chunks[:10]  # Возвращаем топ-10