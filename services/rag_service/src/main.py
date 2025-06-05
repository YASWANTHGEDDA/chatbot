import logging
import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from .rag_service import RAGService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="RAG Service",
    description="Service for document processing and retrieval using RAG",
    version="1.0.0"
)

# Initialize RAG service
rag_service = RAGService()

# Request/Response Models
class SearchRequest(BaseModel):
    query: str
    include_sub_queries: bool = True

class SearchResponse(BaseModel):
    context: str
    documents: Dict[int, Dict[str, str]]
    sub_queries: Optional[List[str]] = None

# Health check endpoint
@app.get("/health")
async def health_check():
    return {"status": "healthy"}

# Document processing endpoint
@app.post("/process")
async def process_document(file: UploadFile = File(...)):
    try:
        # Validate file extension
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in rag_service.settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type. Allowed types: {', '.join(rag_service.settings.ALLOWED_EXTENSIONS)}"
            )
        
        # Save file temporarily
        temp_path = os.path.join(rag_service.settings.UPLOAD_FOLDER, file.filename)
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # Process document
        success = await rag_service.process_document(temp_path)
        
        # Clean up
        os.remove(temp_path)
        
        if success:
            return {"status": "success", "message": f"Document {file.filename} processed successfully"}
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to process document {file.filename}"
            )
            
    except Exception as e:
        logger.error(f"Error processing document: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# Search endpoint
@app.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest):
    try:
        # Perform RAG search
        docs, context, docs_map = await rag_service.perform_rag_search(
            query=request.query,
            include_sub_queries=request.include_sub_queries
        )
        
        # Get sub-queries if requested
        sub_queries = None
        if request.include_sub_queries:
            sub_queries = await rag_service.generate_sub_queries(request.query)
        
        return SearchResponse(
            context=context,
            documents=docs_map,
            sub_queries=sub_queries
        )
        
    except Exception as e:
        logger.error(f"Error in search endpoint: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# Error handlers
@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred"}
    ) 