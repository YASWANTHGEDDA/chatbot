import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings
from typing import Set, Dict, Any

# Load environment variables
load_dotenv()

class Settings(BaseSettings):
    # Service Configuration
    SERVICE_NAME: str = "rag-service"
    SERVICE_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"
    
    # Base directories
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Storage Configuration
    FAISS_FOLDER: str = os.path.join(BASE_DIR, os.getenv("FAISS_FOLDER", "faiss_store"))
    UPLOAD_FOLDER: str = os.path.join(BASE_DIR, os.getenv("UPLOAD_FOLDER", "upload_folder"))
    DEFAULT_DOCS_FOLDER: str = os.path.join(BASE_DIR, os.getenv("DEFAULT_DOCS_FOLDER", "default_docs"))
    
    # File Handling
    ALLOWED_EXTENSIONS: Set[str] = {'pdf', 'pptx', 'ppt'}
    MAX_FILE_SIZE: int = int(os.getenv("MAX_FILE_SIZE", "10485760"))  # 10MB default
    
    # RAG Configuration
    RAG_CHUNK_SIZE: int = int(os.getenv("RAG_CHUNK_SIZE", "1000"))
    RAG_CHUNK_OVERLAP: int = int(os.getenv("RAG_CHUNK_OVERLAP", "200"))
    RAG_CHUNK_K: int = int(os.getenv("RAG_CHUNK_K", "5"))
    RAG_SEARCH_K_PER_QUERY: int = int(os.getenv("RAG_SEARCH_K_PER_QUERY", "3"))
    MULTI_QUERY_COUNT: int = int(os.getenv("MULTI_QUERY_COUNT", "3"))
    
    # Ollama Configuration (for embeddings and sub-query generation)
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_EMBED_MODEL: str = os.getenv("OLLAMA_EMBED_MODEL", "mxbai-embed-large")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "deepseek-r1")
    OLLAMA_REQUEST_TIMEOUT: int = int(os.getenv("OLLAMA_REQUEST_TIMEOUT", "180"))
    
    # Prompt Templates
    SUB_QUERY_PROMPT_TEMPLATE: str = """
You are an AI assistant skilled at decomposing user questions into effective search queries for a vector database containing chunks of engineering documents.
Given the user's query, generate {num_queries} distinct search queries targeting different specific aspects, keywords, or concepts within the original query.
Focus on creating queries that are likely to retrieve relevant text chunks individually.
Output ONLY the generated search queries, each on a new line. Do not include numbering, labels, explanations, or any other text.

User Query: "{query}"

Generated Search Queries:"""
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

# Ensure directories exist
for folder in [settings.FAISS_FOLDER, settings.UPLOAD_FOLDER, settings.DEFAULT_DOCS_FOLDER]:
    os.makedirs(folder, exist_ok=True) 