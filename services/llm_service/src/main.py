import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from .llm_service import LLMService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="LLM Service",
    description="Service for handling LLM interactions with both Ollama and Gemini models",
    version="1.0.0"
)

# Initialize LLM service
llm_service = LLMService()

# Request/Response Models
class ChatMessage(BaseModel):
    role: str
    content: str

class GenerateRequest(BaseModel):
    query: str
    context: str
    chat_history: Optional[List[ChatMessage]] = None
    llm_preference: str = "ollama"
    system_prompt: Optional[str] = None

class GenerateResponse(BaseModel):
    response: str
    thinking_process: str

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Main generation endpoint
@app.post("/generate", response_model=GenerateResponse)
async def generate_response(request: GenerateRequest):
    try:
        # Convert chat history to the format expected by LLM service
        chat_history = None
        if request.chat_history:
            chat_history = [
                {"role": msg.role, "content": msg.content}
                for msg in request.chat_history
            ]
        
        # Generate response
        response, thinking = await llm_service.generate_response(
            query=request.query,
            context=request.context,
            chat_history=chat_history,
            llm_preference=request.llm_preference,
            system_prompt=request.system_prompt
        )
        
        return GenerateResponse(
            response=response,
            thinking_process=thinking
        )
        
    except Exception as e:
        logger.error(f"Error in generate endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# Error handlers
@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return {
        "status_code": 500,
        "detail": "An unexpected error occurred"
    } 