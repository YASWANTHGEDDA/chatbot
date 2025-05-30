# server/rag_service/vector_store.py

import os
import logging
from typing import List, Dict, Any, Optional
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer
from langchain.text_splitter import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s')
logger = logging.getLogger(__name__)

# Configuration
FAISS_DIR = os.getenv('FAISS_DIR', 'faiss_index')
EMBEDDING_MODEL = os.getenv('EMBEDDING_MODEL', 'all-MiniLM-L6-v2')
CHUNK_SIZE = int(os.getenv('CHUNK_SIZE', '1000'))
CHUNK_OVERLAP = int(os.getenv('CHUNK_OVERLAP', '200'))

class VectorStore:
    def __init__(self):
        """Initialize the vector store with embedding model and FAISS index."""
        self.embedding_model = None
        self.index = None
        self.documents = []
        self.initialize()
    
    def initialize(self):
        """Initialize the embedding model and load or create the FAISS index."""
        try:
            # Initialize embedding model
            logger.info(f"Initializing embedding model: {EMBEDDING_MODEL}")
            self.embedding_model = SentenceTransformer(EMBEDDING_MODEL)
            
            # Ensure FAISS directory exists
            os.makedirs(FAISS_DIR, exist_ok=True)
            
            # Load or create index
            index_path = os.path.join(FAISS_DIR, 'index.faiss')
            if os.path.exists(index_path):
                logger.info("Loading existing FAISS index")
                self.index = faiss.read_index(index_path)
                
                # Load document metadata
                metadata_path = os.path.join(FAISS_DIR, 'metadata.json')
                if os.path.exists(metadata_path):
                    import json
                    with open(metadata_path, 'r') as f:
                        self.documents = json.load(f)
            else:
                logger.info("Creating new FAISS index")
                dimension = self.embedding_model.get_sentence_embedding_dimension()
                self.index = faiss.IndexFlatL2(dimension)
                self.documents = []
                
        except Exception as e:
            logger.error(f"Error initializing vector store: {e}", exc_info=True)
            raise
    
    def save_index(self):
        """Save the FAISS index and document metadata."""
        try:
            # Save FAISS index
            index_path = os.path.join(FAISS_DIR, 'index.faiss')
            faiss.write_index(self.index, index_path)
            
            # Save document metadata
            metadata_path = os.path.join(FAISS_DIR, 'metadata.json')
            import json
            with open(metadata_path, 'w') as f:
                json.dump(self.documents, f)
                
            logger.info("Successfully saved FAISS index and metadata")
            
        except Exception as e:
            logger.error(f"Error saving vector store: {e}", exc_info=True)
            raise
    
    def add_documents(self, texts: List[str], metadata: Optional[List[Dict[str, Any]]] = None):
        """Add documents to the vector store."""
        try:
            # Initialize text splitter
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=CHUNK_SIZE,
                chunk_overlap=CHUNK_OVERLAP
            )
            
            # Split texts into chunks
            chunks = []
            for text in texts:
                chunks.extend(text_splitter.split_text(text))
            
            # Generate embeddings
            embeddings = self.embedding_model.encode(chunks)
            
            # Add to FAISS index
            self.index.add(np.array(embeddings).astype('float32'))
            
            # Store document metadata
            if metadata is None:
                metadata = [{} for _ in range(len(texts))]
            
            for i, (text, meta) in enumerate(zip(texts, metadata)):
                self.documents.append({
                    'text': text,
                    'metadata': meta,
                    'chunk_indices': list(range(len(chunks) - len(texts) + i, len(chunks) - len(texts) + i + 1))
                })
            
            # Save updated index
            self.save_index()
            
            logger.info(f"Successfully added {len(texts)} documents to vector store")
            
        except Exception as e:
            logger.error(f"Error adding documents to vector store: {e}", exc_info=True)
            raise
    
    def similarity_search(self, query: str, k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar documents using the query."""
        try:
            # Generate query embedding
            query_embedding = self.embedding_model.encode([query])[0]
            
            # Search in FAISS index
            distances, indices = self.index.search(
                np.array([query_embedding]).astype('float32'),
                k
            )
            
            # Get relevant documents
            results = []
            for distance, idx in zip(distances[0], indices[0]):
                if idx < len(self.documents):
                    doc = self.documents[idx]
                    results.append({
                        'text': doc['text'],
                        'metadata': doc['metadata'],
                        'score': float(1 / (1 + distance))  # Convert distance to similarity score
                    })
            
            return results
            
        except Exception as e:
            logger.error(f"Error performing similarity search: {e}", exc_info=True)
            raise
    
    def get_document_count(self) -> int:
        """Get the total number of documents in the vector store."""
        return len(self.documents)
    
    def clear(self):
        """Clear the vector store."""
        try:
            # Reset FAISS index
            dimension = self.embedding_model.get_sentence_embedding_dimension()
            self.index = faiss.IndexFlatL2(dimension)
            self.documents = []
            
            # Save empty index
            self.save_index()
            
            logger.info("Successfully cleared vector store")
            
        except Exception as e:
            logger.error(f"Error clearing vector store: {e}", exc_info=True)
            raise

# Create global vector store instance
vector_store = VectorStore() 