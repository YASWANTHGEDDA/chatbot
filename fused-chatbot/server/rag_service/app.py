# server/rag_service/app.py

import os
import logging
from typing import Dict, Any, Optional
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from config import (
    HOST, PORT, DEBUG, UPLOAD_DIR, MAX_CONTENT_LENGTH,
    ALLOWED_EXTENSIONS, DEFAULT_LLM, ANALYSIS_TYPES
)
from document_parser import DocumentParser
from vector_store import vector_store
from llm_handler import generate_response, analyze_document

# Configure logging
logging.basicConfig(
    level=getattr(logging, os.getenv('LOG_LEVEL', 'INFO')),
    format='%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

def allowed_file(filename: str) -> bool:
    """Check if the file extension is allowed."""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_error_response(message: str, status_code: int = 400) -> tuple:
    """Create a standardized error response."""
    logger.error(message)
    return jsonify({'error': message}), status_code

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint."""
    try:
        # Check vector store
        doc_count = vector_store.get_document_count()
        
        return jsonify({
            'status': 'healthy',
            'components': {
                'vector_store': {
                    'status': 'healthy',
                    'document_count': doc_count
                }
            }
        })
    except Exception as e:
        logger.error(f"Health check failed: {e}", exc_info=True)
        return create_error_response("Service unhealthy", 500)

@app.route('/add_document', methods=['POST'])
def add_document():
    """Add a document to the vector store."""
    try:
        # Check if file is present
        if 'file' not in request.files:
            return create_error_response("No file provided")
        
        file = request.files['file']
        if file.filename == '':
            return create_error_response("No file selected")
        
        # Validate file type
        if not allowed_file(file.filename):
            return create_error_response(
                f"Invalid file type. Allowed types: {', '.join(ALLOWED_EXTENSIONS.keys())}"
            )
        
        # Save file
        filename = secure_filename(file.filename)
        file_path = os.path.join(UPLOAD_DIR, filename)
        file.save(file_path)
        
        # Parse document
        logger.info(f"Parsing document: {filename}")
        parsed_doc = DocumentParser.parse_file(file_path)
        
        # Add to vector store
        logger.info(f"Adding document to vector store: {filename}")
        vector_store.add_documents(
            [parsed_doc['text']],
            [parsed_doc['metadata']]
        )
        
        # Clean up
        os.remove(file_path)
        
        return jsonify({
            'message': 'Document added successfully',
            'metadata': parsed_doc['metadata']
        })
        
    except Exception as e:
        logger.error(f"Error adding document: {e}", exc_info=True)
        return create_error_response(str(e), 500)

@app.route('/query', methods=['POST'])
def query():
    """Search for relevant documents."""
    try:
        data = request.get_json()
        if not data or 'query' not in data:
            return create_error_response("Query is required")
        
        query = data['query']
        k = data.get('k', 5)
        
        # Search vector store
        logger.info(f"Searching for query: {query}")
        results = vector_store.similarity_search(query, k=k)
        
        return jsonify({
            'results': results
        })
        
    except Exception as e:
        logger.error(f"Error performing query: {e}", exc_info=True)
        return create_error_response(str(e), 500)

@app.route('/analyze', methods=['POST'])
def analyze():
    """Analyze a document."""
    try:
        data = request.get_json()
        if not data or 'text' not in data or 'type' not in data:
            return create_error_response("Text and analysis type are required")
        
        text = data['text']
        analysis_type = data['type']
        
        # Validate analysis type
        if analysis_type not in ANALYSIS_TYPES:
            return create_error_response(
                f"Invalid analysis type. Allowed types: {', '.join(ANALYSIS_TYPES)}"
            )
        
        # Perform analysis
        logger.info(f"Analyzing document with type: {analysis_type}")
        result = analyze_document(text, analysis_type)
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error analyzing document: {e}", exc_info=True)
        return create_error_response(str(e), 500)

@app.route('/chat', methods=['POST'])
def chat():
    """Generate a response using RAG."""
    try:
        data = request.get_json()
        if not data or 'query' not in data or 'context' not in data:
            return create_error_response("Query and context are required")
        
        query = data['query']
        context = data['context']
        llm_choice = data.get('llm', DEFAULT_LLM)
        system_prompt = data.get('system_prompt')
        
        # Generate response
        logger.info(f"Generating response with {llm_choice}")
        response = generate_response(
            query=query,
            context=context,
            llm_choice=llm_choice,
            system_prompt=system_prompt
        )
        
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Error generating response: {e}", exc_info=True)
        return create_error_response(str(e), 500)

if __name__ == '__main__':
    # Ensure required directories exist
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    
    # Start server
    logger.info(f"Starting RAG service on {HOST}:{PORT}")
    app.run(host=HOST, port=PORT, debug=DEBUG) 