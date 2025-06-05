import logging
import os
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Dict, Any, Optional
from .kg_service import KGService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="KG Service",
    description="Knowledge Graph extraction and querying service",
    version="1.0.0"
)

kg_service = KGService()

class ExtractRequest(BaseModel):
    text: str
    doc_filename: str

class QueryKGRequest(BaseModel):
    doc_filename: str
    query_text: Optional[str] = None
    list_of_entities: Optional[list] = None

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

@app.post("/extract")
async def extract_kg(request: ExtractRequest):
    try:
        graph = kg_service.extract_kg_from_text(request.text, request.doc_filename)
        return {"status": "success", "graph": graph}
    except Exception as e:
        logger.error(f"Error extracting KG: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/extract_from_file")
async def extract_kg_from_file(file: UploadFile = File(...)):
    try:
        text = (await file.read()).decode("utf-8")
        graph = kg_service.extract_kg_from_text(text, file.filename)
        return {"status": "success", "graph": graph}
    except Exception as e:
        logger.error(f"Error extracting KG from file: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query_kg_for_rag")
async def query_kg_for_rag(request: QueryKGRequest):
    try:
        kg = kg_service.load_graph(request.doc_filename)
        if not kg:
            raise HTTPException(status_code=404, detail="KG not found for document")
        # For now, just return the full KG. You can add entity/relationship filtering here.
        return {"kg": kg}
    except Exception as e:
        logger.error(f"Error querying KG: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/visualize")
async def get_kg_visualization(doc_filename: str):
    try:
        kg = kg_service.load_graph(doc_filename)
        if not kg:
            raise HTTPException(status_code=404, detail="KG not found for document")
        # Return nodes and edges for visualization
        return {"nodes": kg.get("nodes", []), "edges": kg.get("edges", [])}
    except Exception as e:
        logger.error(f"Error getting KG visualization: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.exception_handler(Exception)
async def generic_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "An unexpected error occurred"}) 