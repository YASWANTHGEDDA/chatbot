# LLM Service

A microservice for handling LLM interactions with both Ollama and Gemini models. This service provides a unified interface for generating responses using either model, with support for chat history, context (RAG + KG), and system prompts.

## Features

- Support for both Ollama and Gemini models
- Chain of Thought (CoT) reasoning with thinking process extraction
- Chat history support
- System prompt customization
- Context integration (RAG + KG)
- FastAPI-based REST API

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Create a `.env` file with the following variables:
```env
# Service Configuration
DEBUG=True
LLM_SERVICE_PORT=8000

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=deepseek-r1
OLLAMA_REQUEST_TIMEOUT=180

# Gemini Configuration
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-1.5-flash

# Generation Configuration
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=4096
```

## Running the Service

```bash
python run.py
```

The service will be available at `http://localhost:8000` (or the port specified in your .env file).

## API Endpoints

### Health Check
```
GET /health
```
Returns the service health status.

### Generate Response
```
POST /generate
```

Request body:
```json
{
    "query": "Your question here",
    "context": "Context from RAG + KG",
    "chat_history": [
        {
            "role": "user",
            "content": "Previous user message"
        },
        {
            "role": "assistant",
            "content": "Previous assistant response"
        }
    ],
    "llm_preference": "ollama",  // or "gemini"
    "system_prompt": "Optional system prompt"
}
```

Response:
```json
{
    "response": "Generated response",
    "thinking_process": "Extracted thinking process"
}
```

## Integration with Other Services

This service is designed to work with:
- RAG Service: For document retrieval and context generation
- KG Service: For knowledge graph insights
- API Gateway: For routing and orchestration

## Error Handling

The service includes comprehensive error handling and logging. All errors are logged with appropriate context and returned to the client with meaningful error messages.

## Development

To run the service in development mode with auto-reload:
```bash
python run.py
```

The service will automatically reload when source files are modified. 