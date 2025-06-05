# server/rag_service/faiss_handler.py

import os
import faiss
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain_core.embeddings import Embeddings as LangchainEmbeddings
from langchain_core.documents import Document as LangchainDocument
from langchain_community.docstore import InMemoryDocstore
from rag_service import config
import numpy as np
import time
import logging
import pickle
import uuid
import shutil # Import shutil for removing directories
import httpx # Added for asynchronous HTTP requests
import json # Added for JSON handling
import asyncio # Added for running async functions

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s')
handler.setFormatter(formatter)
if not logger.hasHandlers():
    logger.addHandler(handler)

embedding_model: LangchainEmbeddings | None = None
loaded_indices = {}
_embedding_dimension = None # Cache the dimension

async def _get_kg_data_from_notebook_backend(filename: str) -> dict | None:
    """
    Asynchronously fetches knowledge graph data for a given document filename
    from the Notebook backend's KG retrieval service.
    """
    kg_retrieval_url = f"http://localhost:{config.NOTEBOOK_BACKEND_PORT}/get_kg_data?filename={filename}"

    try:
        async with httpx.AsyncClient(timeout=config.KG_SERVICE_TIMEOUT) as client:
            response = await client.get(kg_retrieval_url)
            response.raise_for_status() # Raise an exception for 4xx/5xx responses
            kg_response = response.json()
            if kg_response and kg_response.get("kg_data"):
                logger.info(f"Successfully retrieved KG data for '{filename}'.")
                return kg_response["kg_data"]
            else:
                logger.info(f"No KG data found for '{filename}' from backend.")
                return None
    except httpx.RequestError as e:
        logger.error(f"HTTP request failed for KG retrieval service for '{filename}': {e}")
        return None
    except httpx.HTTPStatusError as e:
        logger.error(f"KG retrieval service returned an error status for '{filename}': {e.response.status_code} - {e.response.text}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode JSON response from KG retrieval service for '{filename}': {e}")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred while calling KG retrieval service for '{filename}': {e}", exc_info=True)
        return None


async def _trigger_kg_generation_on_notebook_backend(filename: str) -> dict | None:
    """
    Asynchronously triggers knowledge graph generation for a given document filename
    on the Notebook backend's KG generation service.
    """
    kg_generation_url = f"http://localhost:{config.NOTEBOOK_BACKEND_PORT}/generate_kg_service"
    payload = {"filename": filename}
    headers = {"Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=config.KG_SERVICE_TIMEOUT) as client:
            response = await client.post(kg_generation_url, json=payload, headers=headers)
            response.raise_for_status() # Raise an exception for 4xx/5xx responses
            kg_response = response.json()
            logger.info(f"Successfully triggered KG generation for '{filename}'. Response: {kg_response.get("message")}")
            return kg_response # Return the response payload, indicating success of trigger
    except httpx.RequestError as e:
        logger.error(f"HTTP request failed to trigger KG generation for '{filename}': {e}")
        return None
    except httpx.HTTPStatusError as e:
        logger.error(f"KG generation service returned an error status for '{filename}': {e.response.status_code} - {e.response.text}")
        return None
    except json.JSONDecodeError as e:
        logger.error(f"Failed to decode JSON response from KG generation service for '{filename}': {e}")
        return None
    except Exception as e:
        logger.error(f"An unexpected error occurred while triggering KG generation for '{filename}': {e}", exc_info=True)
        return None


def get_embedding_dimension(embedder: LangchainEmbeddings) -> int:
    """Gets and caches the embedding dimension."""
    global _embedding_dimension
    if _embedding_dimension is None:
        try:
            logger.info("Determining embedding dimension...")
            dummy_embedding = embedder.embed_query("dimension_check")
            dimension = len(dummy_embedding)
            if not isinstance(dimension, int) or dimension <= 0:
                raise ValueError(f"Invalid embedding dimension obtained: {dimension}")
            _embedding_dimension = dimension
            logger.info(f"Detected embedding dimension: {_embedding_dimension}")
        except Exception as e:
            logger.error(f"CRITICAL ERROR determining embedding dimension: {e}", exc_info=True)
            raise RuntimeError(f"Failed to determine embedding dimension: {e}")
    return _embedding_dimension

def get_embedding_model():
    global embedding_model
    if embedding_model is None:
        if config.EMBEDDING_TYPE == 'sentence-transformer':
            logger.info(f"Initializing HuggingFace Embeddings for Sentence Transformer (Model: {config.EMBEDDING_MODEL_NAME})")
            try:
                # Try CUDA first, fallback to CPU
                try:
                    if faiss.get_num_gpus() > 0:
                        device = 'cuda'
                        logger.info("CUDA detected. Using GPU for embeddings.")
                    else:
                        raise RuntimeError("No GPU found") # Force fallback
                except Exception:
                    device = 'cpu'
                    logger.warning("CUDA not available or GPU check failed. Using CPU for embeddings. This might be slow.")

                embedding_model = HuggingFaceEmbeddings(
                    model_name=config.EMBEDDING_MODEL_NAME,
                    model_kwargs={'device': device},
                    encode_kwargs={'normalize_embeddings': True} # Often recommended for cosine similarity / MIPS with FAISS
                )
                # Determine and cache dimension on successful load
                get_embedding_dimension(embedding_model)

                logger.info("Testing embedding function...")
                test_embedding_doc = embedding_model.embed_documents(["test document"])
                test_embedding_query = embedding_model.embed_query("test query")
                if not test_embedding_doc or not test_embedding_query:
                    raise ValueError("Embedding test failed, returned empty results.")
                logger.info(f"Embedding test successful.")

            except Exception as e:
                logger.error(f"Error loading HuggingFace Embeddings for '{config.EMBEDDING_MODEL_NAME}': {e}", exc_info=True)
                embedding_model = None
                raise RuntimeError(f"Failed to load embedding model: {e}")
        else:
            raise ValueError(f"Unsupported embedding type in config: {config.EMBEDDING_TYPE}. Expected 'sentence-transformer'.")
    return embedding_model

def get_user_index_path(user_id):
    safe_user_id = str(user_id).replace('.', '_').replace('/', '_').replace('\\', '_')
    user_dir = os.path.join(config.FAISS_INDEX_DIR, f"user_{safe_user_id}")
    return user_dir

def _delete_index_files(index_path, user_id):
    """Safely deletes index files for a user."""
    logger.warning(f"Deleting potentially incompatible index files for user '{user_id}' at {index_path}")
    try:
        if os.path.isdir(index_path):
            shutil.rmtree(index_path)
            logger.info(f"Successfully deleted directory: {index_path}")
        # If only loose files exist (less likely with save_local)
        index_file = os.path.join(index_path, "index.faiss")
        pkl_file = os.path.join(index_path, "index.pkl")
        if os.path.exists(index_file): os.remove(index_file)
        if os.path.exists(pkl_file): os.remove(pkl_file)
    except OSError as e:
        logger.error(f"Error deleting index files/directory for user '{user_id}' at {index_path}: {e}", exc_info=True)
        # Don't raise here, allow fallback to creating new index if possible

def load_or_create_index(user_id):
    global loaded_indices
    if user_id in loaded_indices:
        # **Even if cached, re-verify dimension on subsequent loads in case model changed**
        index = loaded_indices[user_id]
        embedder = get_embedding_model() # Ensure model is loaded
        current_dim = get_embedding_dimension(embedder)
        if hasattr(index, 'index') and index.index is not None and index.index.d != current_dim:
            logger.warning(f"Cached index for user '{user_id}' has dimension {index.index.d}, but current model has dimension {current_dim}. Discarding cache and forcing reload/recreate.")
            del loaded_indices[user_id] # Remove from cache
            # Fall through to load/create logic below
        else:
            logger.debug(f"Returning cached index for user '{user_id}'.")
            return index # Return cached and verified index

    index_path = get_user_index_path(user_id)
    index_file = os.path.join(index_path, "index.faiss")
    pkl_file = os.path.join(index_path, "index.pkl")

    embedder = get_embedding_model()
    if embedder is None:
        raise RuntimeError("Embedding model is not available.")
    current_embedding_dim = get_embedding_dimension(embedder)

    force_recreate = False
    if os.path.exists(index_file) and os.path.exists(pkl_file):
        logger.info(f"Attempting to load existing FAISS index for user '{user_id}' from {index_path}")
        try:
            start_time = time.time()
            # Temporarily load to check dimension
            index = FAISS.load_local(
                folder_path=index_path,
                embeddings=embedder,
                allow_dangerous_deserialization=True # Use with caution if index source isn't trusted
            )
            end_time = time.time()

            # --- CRITICAL DIMENSION CHECK ---
            if not hasattr(index, 'index') or index.index is None:
                 logger.warning(f"Loaded index for user '{user_id}' has no 'index' attribute or it's None. Forcing recreation.")
                 force_recreate = True
            elif index.index.d != current_embedding_dim:
                logger.warning(f"DIMENSION MISMATCH! Index for user '{user_id}' has dimension {index.index.d}, but current embedding model has dimension {current_embedding_dim}. Index is incompatible and will be recreated.")
                force_recreate = True
            elif index.index.ntotal == 0:
                logger.info(f"Loaded index for user '{user_id}' is empty (0 vectors). Will use it but note it's empty.")
                 # Not forcing recreate, just noting it's empty
            # --- END DIMENSION CHECK ---

            if force_recreate:
                _delete_index_files(index_path, user_id)
                # Don't return the incompatible index, fall through to create new one
            else:
                # If dimensions match and index is valid
                logger.info(f"Index for user '{user_id}' loaded successfully in {end_time - start_time:.2f} seconds. Dimension ({index.index.d}) matches. Contains {index.index.ntotal} vectors.")
                loaded_indices[user_id] = index
                return index

        except (pickle.UnpicklingError, EOFError, ModuleNotFoundError, AttributeError, ValueError) as load_err:
            logger.error(f"Error loading index for user '{user_id}' from {index_path}: {load_err}")
            logger.warning("Index files might be corrupted or incompatible. Attempting to delete and create a new index instead.")
            _delete_index_files(index_path, user_id)
            force_recreate = True # Ensure recreation logic runs
        except Exception as e:
            logger.error(f"Unexpected error loading index for user '{user_id}': {e}", exc_info=True)
            logger.warning("Attempting to delete and create a new index instead.")
            _delete_index_files(index_path, user_id)
            force_recreate = True # Ensure recreation logic runs

    # --- Create New Index Logic ---
    # This block runs if files didn't exist OR force_recreate is True
    logger.info(f"Creating new FAISS index structure for user '{user_id}' at {index_path} with dimension {current_embedding_dim}")
    try:
        # Ensure directory exists (it might have been deleted)
        os.makedirs(index_path, exist_ok=True)

        # Use the already determined dimension
        # Use IndexFlatIP if embeddings are normalized (recommended)
        faiss_index = faiss.IndexIDMap(faiss.IndexFlatIP(current_embedding_dim))
        # faiss_index = faiss.IndexIDMap(faiss.IndexFlatL2(current_embedding_dim)) # Use L2 if not normalized

        docstore = InMemoryDocstore({})
        index_to_docstore_id = {}

        index = FAISS(
            embedding_function=embedder,
            index=faiss_index,
            docstore=docstore,
            index_to_docstore_id=index_to_docstore_id,
            normalize_L2=False # Set True if using IndexFlatIP and normalized embeddings (which we are with encode_kwargs)
        )

        logger.info(f"Initialized empty index structure for user '{user_id}'.")
        loaded_indices[user_id] = index # Add to cache immediately
        save_index(user_id) # Save the empty structure
        logger.info(f"New empty index for user '{user_id}' created and saved.")
        return index
    except Exception as e:
        logger.error(f"CRITICAL ERROR creating new index for user '{user_id}': {e}", exc_info=True)
        if user_id in loaded_indices:
            del loaded_indices[user_id] # Clean up cache on failure
        # Attempt to clean up directory if creation failed badly
        _delete_index_files(index_path, user_id)
        raise RuntimeError(f"Failed to initialize FAISS index for user '{user_id}'")


def add_documents_to_index(user_id, documents: list[LangchainDocument]):
    if not documents:
        logger.warning(f"No documents provided to add for user '{user_id}'.")
        return

    try:
        index = load_or_create_index(user_id) # This now handles dimension checks/recreation
        embedder = get_embedding_model() # Ensure model is loaded

        # --- VERIFY DIMENSIONS AGAIN before adding (paranoid check) ---
        current_dim = get_embedding_dimension(embedder)
        if not hasattr(index, 'index') or index.index is None:
             logger.error(f"Index object for user '{user_id}' is invalid after load/create. Cannot add documents.")
             raise RuntimeError("Failed to get valid index structure.")
        if index.index.d != current_dim:
             logger.error(f"FATAL: Dimension mismatch just before adding documents for user '{user_id}'. Index: {index.index.d}, Model: {current_dim}. This shouldn't happen if load_or_create_index worked.")
             # Attempt recovery by deleting and trying again? Risky loop potential.
             _delete_index_files(get_user_index_path(user_id), user_id)
             if user_id in loaded_indices: del loaded_indices[user_id]
             raise RuntimeError(f"Inconsistent index dimension detected for user '{user_id}'. Please retry.")
        # --- END VERIFY ---

        logger.info(f"Adding {len(documents)} documents to index for user '{user_id}' (Index dim: {index.index.d})...")
        start_time = time.time()

        texts = [doc.page_content for doc in documents]
        metadatas = [doc.metadata for doc in documents]

        # Generate embeddings using the current model
        embeddings = embedder.embed_documents(texts)
        if not embeddings or len(embeddings) != len(texts):
             logger.error(f"Embedding generation failed or returned unexpected number of vectors for user '{user_id}'.")
             raise ValueError("Embedding generation failed.")
        if len(embeddings[0]) != current_dim:
             logger.error(f"Generated embeddings have incorrect dimension ({len(embeddings[0])}) for user '{user_id}', expected {current_dim}.")
             raise ValueError("Generated embedding dimension mismatch.")

        embeddings_np = np.array(embeddings, dtype=np.float32)

        # Generate unique IDs for FAISS
        ids = [str(uuid.uuid4()) for _ in texts]
        ids_np = np.array([uuid.UUID(id_).int & (2**63 - 1) for id_ in ids], dtype=np.int64)


        # Add embeddings and their corresponding IDs to the FAISS index
        index.index.add_with_ids(embeddings_np, ids_np)

        # Add the original documents and their metadata to the Langchain Docstore,
        # using the generated string UUIDs as keys.
        # Map the FAISS integer ID back to the string UUID used in the docstore.
        docstore_additions = {doc_id: doc for doc_id, doc in zip(ids, documents)}
        index.docstore.add(docstore_additions)
        for i, faiss_id in enumerate(ids_np):
            index.index_to_docstore_id[int(faiss_id)] = ids[i] # Map FAISS int ID -> string UUID

        end_time = time.time()
        logger.info(f"Successfully added {len(documents)} vectors/documents for user '{user_id}' in {end_time - start_time:.2f} seconds. Total vectors: {index.index.ntotal}")
        save_index(user_id)
    except Exception as e:
        logger.error(f"Error adding documents for user '{user_id}': {e}", exc_info=True)
        # Don't re-raise here if app.py handles it, but ensure logging is clear
        raise # Re-raise the exception so app.py can catch it and return 500

async def query_index(user_id, query_text, k=3):
    all_results_with_scores = []
    embedder = get_embedding_model()

    if embedder is None:
        logger.error("Embedding model is not available for query.")
        raise ConnectionError("Embedding model is not available for query.")

    try:
        start_time = time.time()
        user_index = None # Initialize to None
        default_index = None # Initialize to None

        # Query User Index
        try:
            user_index = load_or_create_index(user_id) # Assign to user_index
            if hasattr(user_index, 'index') and user_index.index is not None and user_index.index.ntotal > 0:
                logger.info(f"Querying index for user: '{user_id}' (Dim: {user_index.index.d}, Vectors: {user_index.index.ntotal}) with k={k}")
                user_results = user_index.similarity_search_with_score(query_text, k=k)
                logger.info(f"User index '{user_id}' query returned {len(user_results)} results.")
                all_results_with_scores.extend(user_results)
            else:
                logger.info(f"Skipping query for user '{user_id}': Index is empty or invalid.")
        except FileNotFoundError:
            logger.warning(f"User index files for '{user_id}' not found on disk (might be first time). Skipping query for this index.")
        except RuntimeError as e:
            logger.error(f"Could not load or create user index for '{user_id}': {e}", exc_info=True)
        except Exception as e:
            logger.error(f"Unexpected error querying user index for '{user_id}': {e}", exc_info=True)


        # Query Default Index (if different from user_id)
        if user_id != config.DEFAULT_INDEX_USER_ID:
            try:
                default_index = load_or_create_index(config.DEFAULT_INDEX_USER_ID) # Assign to default_index
                if hasattr(default_index, 'index') and default_index.index is not None and default_index.index.ntotal > 0:
                    logger.info(f"Querying default index '{config.DEFAULT_INDEX_USER_ID}' (Dim: {default_index.index.d}, Vectors: {default_index.index.ntotal}) with k={k}")
                    default_results = default_index.similarity_search_with_score(query_text, k=k)
                    logger.info(f"Default index '{config.DEFAULT_INDEX_USER_ID}' query returned {len(default_results)} results.")
                    all_results_with_scores.extend(default_results)
                else:
                    logger.info(f"Skipping query for default index '{config.DEFAULT_INDEX_USER_ID}': Index is empty or invalid.")
            except FileNotFoundError:
                 logger.warning(f"Default index '{config.DEFAULT_INDEX_USER_ID}' not found on disk (run default.py?). Skipping query.")
            except RuntimeError as e:
                logger.error(f"Could not load or create default index '{config.DEFAULT_INDEX_USER_ID}': {e}", exc_info=True)
            except Exception as e:
                logger.error(f"Unexpected error querying default index '{config.DEFAULT_INDEX_USER_ID}': {e}", exc_info=True)

        query_time = time.time()
        logger.info(f"Completed all index queries in {query_time - start_time:.2f} seconds. Found {len(all_results_with_scores)} raw results.")

        # --- Deduplication and Sorting ---
        unique_results = {}
        for doc, score in all_results_with_scores:
            if not doc or not hasattr(doc, 'metadata') or not hasattr(doc, 'page_content'):
                logger.warning(f"Skipping invalid document object in results: {doc}")
                continue

            # Use the fallback content-based key
            content_key = f"{doc.metadata.get('documentName', 'Unknown')}_{doc.page_content[:200]}"
            unique_key = content_key # Use the content key directly

            # Add or update if the new score is better (lower for L2 distance / IP distance if normalized)
            if unique_key not in unique_results or score < unique_results[unique_key][1]:
                unique_results[unique_key] = (doc, score)

        # Sort by score (ascending for L2 distance / IP distance)
        sorted_results = sorted(unique_results.values(), key=lambda item: item[1])
        final_docs_and_scores = sorted_results[:k] # Get top k unique results

        # --- Fetch KG Data for Relevant Documents ---
        docs_to_fetch_kg_for = [] # (doc_object, original_index_in_final_docs_and_scores)
        for i, (doc, score) in enumerate(final_docs_and_scores):
            document_name = doc.metadata.get('documentName') # Assuming documentName is present in metadata
            if document_name:
                docs_to_fetch_kg_for.append((doc, i, document_name))
        
        kg_fetch_tasks = []
        for doc_obj, original_idx, doc_name in docs_to_fetch_kg_for:
            kg_fetch_tasks.append(_get_kg_data_from_notebook_backend(doc_name))
        
        # Execute all KG fetch tasks concurrently
        all_kg_data_fetched = await asyncio.gather(*kg_fetch_tasks, return_exceptions=True)

        # Create a mutable list to store the final results
        final_results_with_kg = []

        # Reconstruct final_results, adding KG data to document metadata
        kg_result_idx = 0
        for i, (doc, score) in enumerate(final_docs_and_scores):
            doc_with_kg = doc # Start with the original document object

            # Check if this document was one for which KG data was fetched
            # We need to find its corresponding result in all_kg_data_fetched
            found_matching_doc_for_kg = False
            for kg_doc_info in docs_to_fetch_kg_for:
                if kg_doc_info[1] == i: # Check if original index matches
                    found_matching_doc_for_kg = True
                    break
            
            if found_matching_doc_for_kg and kg_result_idx < len(all_kg_data_fetched):
                kg_data_for_this_doc = all_kg_data_fetched[kg_result_idx]
                
                if not isinstance(kg_data_for_this_doc, Exception) and kg_data_for_this_doc:
                    doc_with_kg.metadata['kg_data'] = kg_data_for_this_doc
                    logger.info(f"Attached KG data to document '{doc.metadata.get('documentName')}'.")
                elif isinstance(kg_data_for_this_doc, Exception):
                    logger.error(f"Error fetching KG for '{doc.metadata.get('documentName')}': {kg_data_for_this_doc}")
                else:
                    logger.info(f"No KG data retrieved for '{doc.metadata.get('documentName')}'.")
                
                kg_result_idx += 1 # Move to the next KG result only if a fetch was attempted

            final_results_with_kg.append((doc_with_kg, score))

        logger.info(f"Returning {len(final_results_with_kg)} unique results after filtering, sorting, and KG enrichment.")
        return final_results_with_kg
    except Exception as e:
        logger.error(f"Error during query processing for user '{user_id}': {e}", exc_info=True)
        return [] # Return empty list on error


def save_index(user_id):
    global loaded_indices
    if user_id not in loaded_indices:
        logger.warning(f"Index for user '{user_id}' not found in cache, cannot save.")
        return

    index = loaded_indices[user_id]
    index_path = get_user_index_path(user_id)

    if not isinstance(index, FAISS) or not hasattr(index, 'index') or not hasattr(index, 'docstore') or not hasattr(index, 'index_to_docstore_id'):
        logger.error(f"Cannot save index for user '{user_id}': Invalid index object in cache.")
        return

    # Ensure the target directory exists before saving
    try:
        os.makedirs(index_path, exist_ok=True)
        logger.info(f"Saving FAISS index for user '{user_id}' to {index_path} (Vectors: {index.index.ntotal if hasattr(index.index, 'ntotal') else 'N/A'})...")
        start_time = time.time()
        # This saves index.faiss and index.pkl
        index.save_local(folder_path=index_path)
        end_time = time.time()
        logger.info(f"Index for user '{user_id}' saved successfully in {end_time - start_time:.2f} seconds.")
    except Exception as e:
        logger.error(f"Error saving FAISS index for user '{user_id}' to {index_path}: {e}", exc_info=True)

# --- ADD THIS FUNCTION DEFINITION BACK ---
def ensure_faiss_dir():
    """Ensures the base FAISS index directory exists."""
    try:
        os.makedirs(config.FAISS_INDEX_DIR, exist_ok=True)
        logger.info(f"Ensured FAISS base directory exists: {config.FAISS_INDEX_DIR}")
    except OSError as e:
        logger.error(f"Could not create FAISS base directory {config.FAISS_INDEX_DIR}: {e}")
        raise # Raise the error to prevent startup if dir creation fails
# --- END OF ADDED FUNCTION ---
