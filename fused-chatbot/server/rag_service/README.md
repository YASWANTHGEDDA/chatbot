# RAG Service

This is the RAG (Retrieval-Augmented Generation) service component of the fused chatbot. It handles document processing, vector storage, and LLM interactions.

## Features

- Document parsing for multiple formats (PDF, DOCX, PPTX, TXT, JSON)
- Vector storage using FAISS for efficient similarity search
- Support for multiple LLMs (Gemini and Ollama)
- Document analysis capabilities (FAQ generation, topic extraction, mind mapping)
- Robust error handling and logging

## Setup

1. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Create a `.env` file with the following environment variables:
   ```env
   # Server configuration
   RAG_SERVICE_HOST=0.0.0.0
   RAG_SERVICE_PORT=5000
   RAG_SERVICE_DEBUG=False

   # File upload configuration
   UPLOAD_DIR=uploads
   MAX_CONTENT_LENGTH=16777216  # 16MB

   # Vector store configuration
   FAISS_DIR=faiss_index
   EMBEDDING_MODEL=all-MiniLM-L6-v2
   CHUNK_SIZE=1000
   CHUNK_OVERLAP=200

   # LLM configuration
   GEMINI_API_KEY=your_gemini_api_key_here
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama2
   DEFAULT_LLM=gemini  # or 'ollama'

   # Logging configuration
   LOG_LEVEL=INFO
   ```

3. If using Ollama:
   - Install Ollama from https://ollama.ai/
   - Pull the required model:
     ```bash
     ollama pull llama2
     ```

## API Endpoints

### Health Check
- `GET /health`
  - Returns service status and component health

### Document Management
- `POST /add_document`
  - Upload and process a document
  - Required fields:
    - `file`: Document file (PDF, DOCX, PPTX, TXT, JSON)
    - `metadata` (optional): Additional document metadata

### Query
- `POST /query`
  - Search for relevant documents
  - Required fields:
    - `query`: Search query
    - `k` (optional): Number of results (default: 5)

### Analysis
- `POST /analyze`
  - Analyze a document
  - Required fields:
    - `text`: Document text
    - `type`: Analysis type ('faq', 'topics', 'mindmap')

### Chat
- `POST /chat`
  - Generate a response using RAG
  - Required fields:
    - `query`: User query
    - `context`: Relevant context
    - `llm` (optional): LLM choice ('gemini' or 'ollama')

## Directory Structure

```
rag_service/
├── app.py              # Main Flask application
├── config.py           # Configuration settings
├── document_parser.py  # Document parsing utilities
├── llm_handler.py      # LLM interaction management
├── vector_store.py     # Vector storage implementation
├── requirements.txt    # Python dependencies
└── README.md          # This file
```

## Error Handling

The service implements comprehensive error handling:
- Input validation
- File processing errors
- LLM interaction errors
- Vector store operations
- All errors are logged with appropriate context

## Logging

Logging is configured to capture:
- Service startup and shutdown
- API requests and responses
- Document processing steps
- Vector store operations
- LLM interactions
- Errors and exceptions

Log format:
```
%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 