import os
from dotenv import load_dotenv
from pydantic_settings import BaseSettings

load_dotenv()

class Settings(BaseSettings):
    SERVICE_NAME: str = "kg-service"
    SERVICE_VERSION: str = "1.0.0"
    DEBUG: bool = os.getenv("DEBUG", "False").lower() == "true"

    # LLM (Ollama) config
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "qwen2.5:14b-instruct")
    OLLAMA_REQUEST_TIMEOUT: int = int(os.getenv("OLLAMA_REQUEST_TIMEOUT", "180"))

    # Chunking
    KG_CHUNK_SIZE: int = int(os.getenv("KG_CHUNK_SIZE", "2048"))
    KG_CHUNK_OVERLAP: int = int(os.getenv("KG_CHUNK_OVERLAP", "256"))
    KG_MAX_WORKERS: int = int(os.getenv("KG_MAX_WORKERS", "8"))

    # Output
    KG_OUTPUT_FOLDER: str = os.getenv("KG_OUTPUT_FOLDER", "outputs")
    KG_FILENAME_SUFFIX: str = ".kg.json"

    # Prompt
    KG_PROMPT_TEMPLATE: str = """
You are an expert in knowledge graph creation. I have a chunk of lecture notes. Your task is to read the text and create a partial graph-based memory map. Identify major topics as top-level nodes, subtopics as subnodes under their respective parents, and relationships between nodes. Output the result as a valid JSON object with \"nodes\" and \"edges\" sections. Ensure the JSON is complete and properly formatted. Ensure all node IDs and relationship types are strings.\n\nText chunk:\n{chunk_text}\n\nOutput format:\n{{\n  \"nodes\": [\n    {{\"id\": \"Node Name\", \"type\": \"major|subnode\", \"parent\": \"Parent Node ID or null\", \"description\": \"Short description (max 50 words)\"}},\n    ...\n  ],\n  \"edges\": [\n    {{\"from\": \"Node A ID\", \"to\": \"Node B ID\", \"relationship\": \"subtopic|depends_on|related_to\"}},\n    ...\n  ]\n}}\n"""

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()

os.makedirs(settings.KG_OUTPUT_FOLDER, exist_ok=True) 