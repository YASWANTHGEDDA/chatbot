# server/rag_service/config.py

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Server configuration
HOST = os.getenv('RAG_SERVICE_HOST', '0.0.0.0')
PORT = int(os.getenv('RAG_SERVICE_PORT', '5000'))
DEBUG = os.getenv('RAG_SERVICE_DEBUG', 'False').lower() == 'true'

# File upload configuration
UPLOAD_DIR = os.getenv('UPLOAD_DIR', 'uploads')
MAX_CONTENT_LENGTH = int(os.getenv('MAX_CONTENT_LENGTH', '16 * 1024 * 1024'))  # 16MB
ALLOWED_EXTENSIONS = {
    'pdf': '.pdf',
    'docx': '.docx',
    'pptx': '.pptx',
    'txt': '.txt',
    'json': '.json'
}

# Vector store configuration
FAISS_DIR = os.getenv('FAISS_DIR', 'faiss_index')
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', '1000'))
CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', '200'))

# LLM configuration
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama2')
DEFAULT_LLM = os.getenv('DEFAULT_LLM', 'gemini')

# Analysis configuration
ANALYSIS_TYPES = ['faq', 'topics', 'mindmap']
DEFAULT_ANALYSIS_TYPE = 'faq'

# Logging configuration
LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
LOG_FORMAT = '%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s'

# Ensure required directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(FAISS_DIR, exist_ok=True)

# Validate required environment variables
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable is required")

# Validate LLM choice
if DEFAULT_LLM not in ['gemini', 'ollama']:
    raise ValueError("DEFAULT_LLM must be either 'gemini' or 'ollama'")

# Validate analysis type
if DEFAULT_ANALYSIS_TYPE not in ANALYSIS_TYPES:
    raise ValueError(f"DEFAULT_ANALYSIS_TYPE must be one of {ANALYSIS_TYPES}") 