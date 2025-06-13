# FusedChatbot/server/ai_core_service/app.py
import os
import sys
import logging
import tempfile
import pandas as pd
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# --- Python Path Setup ---
AI_CORE_SERVICE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_DIR = os.path.abspath(os.path.join(AI_CORE_SERVICE_DIR, '..'))
if SERVER_DIR not in sys.path: sys.path.insert(0, SERVER_DIR)
if AI_CORE_SERVICE_DIR not in sys.path: sys.path.insert(0, AI_CORE_SERVICE_DIR)

try:
    from ai_core_service import config
    from ai_core_service import file_parser, faiss_handler, llm_handler
    from ai_core_service.modules.web_resources import youtube_dl_core, pdf_downloader
    from ai_core_service.modules.content_creation import md_to_office
    from ai_core_service.modules.pdf_processing import ocr_tesseract, ocr_nougat
    # Import the new video summarizer module
    from ai_core_service.modules import video_summarizer
    from ai_core_service.modules.academic_search import combined_search, core_api as academic_core_api
except ImportError as e:
    print(f"CRITICAL IMPORT ERROR in app.py: {e}\nSys.path: {sys.path}\nCheck __init__.py files, module names, and ensure all dependencies are installed.")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s')
logger = logging.getLogger(__name__)
app = Flask(__name__)
CORS(app)

if not os.path.exists(config.DEFAULT_ASSETS_DIR) or not os.access(config.DEFAULT_ASSETS_DIR, os.W_OK):
    logger.warning(f"WARNING: DEFAULT_ASSETS_DIR '{config.DEFAULT_ASSETS_DIR}' does not exist or is not writable. Attempting to create...")
    try:
        os.makedirs(config.DEFAULT_ASSETS_DIR, exist_ok=True)
        if not os.access(config.DEFAULT_ASSETS_DIR, os.W_OK):
             logger.critical("CRITICAL: DEFAULT_ASSETS_DIR is still not writable after creation attempt.")
        else: logger.info(f"Successfully created/ensured DEFAULT_ASSETS_DIR: {config.DEFAULT_ASSETS_DIR}")
    except Exception as e_mkdir: logger.critical(f"CRITICAL: Failed to create DEFAULT_ASSETS_DIR '{config.DEFAULT_ASSETS_DIR}': {e_mkdir}")

def create_error_response(message, status_code=500, details=None):
    logger.error(f"API Error ({status_code}): {message}" + (f" Details: {details}" if details else ""))
    return jsonify({"error": message, "status": "error", "details": str(details) if details else None}), status_code

# --- Standard FusedChat Routes ---
@app.route('/health', methods=['GET'])
def health_check():
    logger.info("\n--- Received request at /health ---")
    status_details = {
        "status": "error",
        "embedding_model_type": config.EMBEDDING_TYPE,
        "embedding_model_name": config.EMBEDDING_MODEL_NAME,
        "embedding_dimension": None,
        "sentence_transformer_load": "Unknown",
        "default_index_loaded": False,
        "gemini_sdk_installed": bool(llm_handler.genai),
        "ollama_available": bool(llm_handler.ollama_available),
        "groq_sdk_installed": bool(llm_handler.Groq),
        "message": ""
    }
    http_status_code = 503
    try:
        model = faiss_handler.embedding_model
        if model is None:
            raise RuntimeError("Embedding model could not be initialized.")
        status_details["sentence_transformer_load"] = "OK"
        status_details["embedding_dimension"] = faiss_handler.get_embedding_dimension(model)

        if config.DEFAULT_INDEX_USER_ID in faiss_handler.loaded_indices:
             status_details["default_index_loaded"] = True
        else:
            status_details["default_index_loaded"] = False
            status_details["message"] = "Default index is not loaded. It will be loaded on first use."

        if status_details["sentence_transformer_load"] == "OK":
            status_details["status"] = "ok"
            status_details["message"] = "AI Core service is running. Embeddings OK."
            http_status_code = 200
        else:
            http_status_code = 503

    except Exception as e:
        logger.error(f"--- Health Check Critical Error ---", exc_info=True)
        status_details["message"] = f"Health check failed critically: {str(e)}"
    return jsonify(status_details), http_status_code


@app.route('/add_document', methods=['POST'])
def add_document():
    logger.info("\n--- Received request at /add_document ---")
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    if data is None: return create_error_response("Invalid or empty JSON body", 400)
    user_id = data.get('user_id'); file_path = data.get('file_path'); original_name = data.get('original_name')
    if not all([user_id, file_path, original_name]): return create_error_response("Missing required fields", 400)
    if not os.path.exists(file_path): return create_error_response(f"File not found: {file_path}", 404)
    try:
        text = file_parser.parse_file(file_path)
        if not text or not text.strip(): return jsonify({"message": f"No text in '{original_name}'.", "status": "skipped"}), 200
        docs = file_parser.chunk_text(text, original_name, user_id)
        faiss_handler.add_documents_to_index(user_id, docs)
        return jsonify({"message": f"'{original_name}' added.", "chunks_added": len(docs), "status": "added"}), 200
    except Exception as e: return create_error_response(f"Failed to process '{original_name}': {e}", 500, details=str(e))


@app.route('/query_rag_documents', methods=['POST'])
def query_rag_documents_route():
    logger.info("\n--- Received request at /query_rag_documents ---")
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    if data is None: return create_error_response("Invalid or empty JSON body", 400)
    user_id = data.get('user_id'); query_text = data.get('query'); k = data.get('k', 5)
    if not user_id or not query_text: return create_error_response("Missing user_id or query", 400)
    try:
        results = faiss_handler.query_index(user_id, query_text, k=k)
        formatted = [{"documentName": d.metadata.get("documentName"), "score": float(s), "content": d.page_content} for d, s in results]
        return jsonify({"relevantDocs": formatted, "status": "success"}), 200
    except Exception as e: return create_error_response(f"Failed to query index: {e}", 500, details=str(e))


@app.route('/analyze_document', methods=['POST'])
def analyze_document_route():
    logger.info("\n--- Received request at /analyze_document ---")
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    if data is None: return create_error_response("Invalid or empty JSON body", 400)

    user_id = data.get('user_id')
    document_name = data.get('document_name')
    analysis_type = data.get('analysis_type')
    file_path_for_analysis = data.get('file_path_for_analysis')
    llm_provider = data.get('llm_provider', config.DEFAULT_LLM_PROVIDER)
    llm_model_name = data.get('llm_model_name', None)
    api_keys_data = data.get('api_keys', {})
    user_gemini_api_key = api_keys_data.get('gemini')
    user_grok_api_key = api_keys_data.get('grok')

    if not all([user_id, document_name, analysis_type, file_path_for_analysis]):
         return create_error_response("Missing required fields", 400)
    if not os.path.exists(file_path_for_analysis):
        return create_error_response(f"Document not found at path: {file_path_for_analysis}", 404)

    try:
        document_text = file_parser.parse_file(file_path_for_analysis)
        if not document_text or not document_text.strip():
            raise ValueError("Could not parse or extracted text is empty.")

        logger.info(f"Performing '{analysis_type}' analysis on '{document_name}' using {llm_provider}...")

        analysis_result, thinking_content = llm_handler.perform_document_analysis(
            document_text=document_text,
            analysis_type=analysis_type,
            llm_provider=llm_provider,
            llm_model_name=llm_model_name,
            user_gemini_api_key=user_gemini_api_key,
            user_grok_api_key=user_grok_api_key
        )

        return jsonify({
            "document_name": document_name,
            "analysis_type": analysis_type,
            "analysis_result": analysis_result,
            "thinking_content": thinking_content,
            "status": "success"
        }), 200
    except ConnectionError as e: return create_error_response(str(e), 502)
    except Exception as e: return create_error_response(f"Failed to perform analysis: {str(e)}", 500, details=str(e))


@app.route('/generate_chat_response', methods=['POST'])
def generate_chat_response_route():
    logger.info("\n--- Received request at /generate_chat_response ---")
    if not request.is_json: return create_error_response("Request must be JSON", 400)
    data = request.get_json()
    if data is None: return create_error_response("Invalid or empty JSON body", 400)

    user_id = data.get('user_id')
    current_user_query = data.get('query')
    chat_history = data.get('chat_history', [])
    system_prompt = data.get('system_prompt')
    llm_provider = data.get('llm_provider', config.DEFAULT_LLM_PROVIDER)
    llm_model_name = data.get('llm_model_name', None)
    perform_rag = data.get('perform_rag', True)
    enable_multi_query = data.get('enable_multi_query', True)
    api_keys_data = data.get('api_keys', {})
    user_gemini_api_key = api_keys_data.get('gemini')
    user_grok_api_key = api_keys_data.get('grok')

    if not user_id or not current_user_query:
        return create_error_response("Missing user_id or query in request", 400)

    context_text_for_llm = "No relevant context was found in the available documents."
    rag_references_for_client = []

    if perform_rag:
        queries_to_search = [current_user_query]
        if enable_multi_query:
            try:
                logger.info(f"Generating sub-queries with {llm_provider}...")
                sub_queries = llm_handler.generate_sub_queries_via_llm(
                    original_query=current_user_query,
                    llm_provider=llm_provider,
                    llm_model_name=llm_model_name,
                    user_gemini_api_key=user_gemini_api_key,
                    user_grok_api_key=user_grok_api_key
                )
                if sub_queries:
                    logger.info(f"Generated sub-queries: {sub_queries}")
                    queries_to_search.extend(sub_queries)
            except Exception as e: logger.error(f"Error during sub-query generation: {e}", exc_info=True)

        unique_chunks = set()
        docs_for_context = []
        for q in queries_to_search:
            results = faiss_handler.query_index(user_id, q, k=config.DEFAULT_RAG_K_PER_SUBQUERY_CONFIG)
            for doc, score in results:
                if doc.page_content not in unique_chunks:
                    unique_chunks.add(doc.page_content)
                    docs_for_context.append((doc, score))

        if docs_for_context:
            context_parts = [f"[{i+1}] Source: {d.metadata.get('documentName')}\n{d.page_content}" for i, (d, s) in enumerate(docs_for_context)]
            context_text_for_llm = "\n\n---\n\n".join(context_parts)
            rag_references_for_client = [{"documentName": d.metadata.get("documentName"), "score": float(s)} for d, s in docs_for_context]

    try:
        logger.info(f"Calling LLM provider: {llm_provider} for user: {user_id}")
        final_answer, thinking_content = llm_handler.generate_response(
            llm_provider=llm_provider,
            query=current_user_query,
            context_text=context_text_for_llm,
            chat_history=chat_history,
            system_prompt=system_prompt,
            llm_model_name=llm_model_name,
            user_gemini_api_key=user_gemini_api_key,
            user_grok_api_key=user_grok_api_key
        )
        return jsonify({
            "llm_response": final_answer,
            "references": rag_references_for_client,
            "thinking_content": thinking_content,
            "status": "success"
        }), 200
    except ConnectionError as e: return create_error_response(str(e), 502)
    except Exception as e: return create_error_response(f"Failed to generate chat response: {str(e)}", 500, details=str(e))

# --- Unified Tool Operation Helper ---
def _handle_tool_file_operation(tool_name: str, user_id: str, operation_function: callable,
                                output_subdir_name: str, *args_for_op, is_file_output_expected=True, **kwargs_for_op):
    logger.info(f"Tool Op: User='{user_id}', Tool='{tool_name}', OutSubdir='{output_subdir_name}'")
    user_tool_output_dir = os.path.join(config.DEFAULT_ASSETS_DIR, user_id, output_subdir_name)
    os.makedirs(user_tool_output_dir, exist_ok=True)
    logger.info(f"Output dir for {tool_name}: {user_tool_output_dir}")

    try:
        result_data = operation_function(user_tool_output_dir, *args_for_op, **kwargs_for_op)

        if not is_file_output_expected:
            if isinstance(result_data, pd.DataFrame):
                csv_filename = f"{tool_name.replace(' ', '_').lower()}_results.csv"
                csv_full_path = os.path.join(user_tool_output_dir, csv_filename)
                result_data.to_csv(csv_full_path, index=False, encoding='utf-8')
                logger.info(f"Saved {tool_name} DataFrame to {csv_full_path}")
                abs_assets_dir = os.path.abspath(config.DEFAULT_ASSETS_DIR)
                relative_csv_path = os.path.relpath(csv_full_path, abs_assets_dir).replace(os.sep, '/')
                return jsonify({"message": f"{tool_name} completed. Results saved as CSV.",
                                "processed_count": len(result_data),
                                "download_links_relative": [relative_csv_path],
                                "files_server_paths": [csv_full_path],
                                "result_type": "dataframe_csv", "status": "success"}), 200
            return jsonify({"message": f"{tool_name} completed.", "result_data": result_data, "status": "success"}), 200

        if not result_data: return create_error_response(f"{tool_name} process completed, but no output files were generated.", 404)
        
        # Handle dict response from video processor
        if isinstance(result_data, dict) and 'message' in result_data:
            generated_files_full_paths = [p for p in [result_data.get('transcript_path'), result_data.get('summary_path')] if p]
            if not generated_files_full_paths:
                return create_error_response(f"{tool_name} completed, but no output file paths were returned.", 404, details=result_data.get('message'))
        elif isinstance(result_data, str):
            generated_files_full_paths = [result_data]
        elif isinstance(result_data, list):
            generated_files_full_paths = result_data
        else:
            return create_error_response(f"Internal error: {tool_name} function returned unexpected type {type(result_data)}.", 500)

        relative_paths = []
        abs_assets_dir = os.path.abspath(config.DEFAULT_ASSETS_DIR)
        for f_path in generated_files_full_paths:
            if not f_path or not isinstance(f_path, str): continue
            abs_f_path = os.path.abspath(f_path)
            if not abs_f_path.startswith(abs_assets_dir):
                logger.error(f"Security: File '{abs_f_path}' is outside the user's assets directory. Skipping.")
                continue
            relative_paths.append(os.path.relpath(abs_f_path, abs_assets_dir).replace(os.sep, '/'))
        
        if not relative_paths: return create_error_response(f"{tool_name}: No valid file paths could be generated for client.", 500)
        
        response_payload = {
            "message": result_data.get('message') if isinstance(result_data, dict) else f"Successfully processed {len(relative_paths)} file(s) via {tool_name}.",
            "processed_count": len(relative_paths),
            "files_server_paths": generated_files_full_paths,
            "download_links_relative": relative_paths,
            "status": "success"
        }
        return jsonify(response_payload), 200
    except FileNotFoundError as e: return create_error_response(f"Tool Dependency for {tool_name} not found: {e}", 500, details=str(e))
    except AttributeError as e: return create_error_response(f"Component for {tool_name} misconfigured (AttributeError): {e}", 501, details=str(e))
    except Exception as e: return create_error_response(f"Failed {tool_name} operation: {e}", 500, details=str(e))

def _save_uploaded_file_temp(flask_file_obj):
    original_filename = flask_file_obj.filename or "uploaded_file"
    safe_suffix = "".join(c for c in os.path.splitext(original_filename)[1] if c.isalnum() or c == '.')
    if not safe_suffix: safe_suffix = ".tmp"
    
    fd, temp_path = tempfile.mkstemp(suffix=safe_suffix)
    os.close(fd) 
    flask_file_obj.save(temp_path)
    return temp_path

# --- Tool Routes ---
@app.route('/tools/download/youtube', methods=['POST'])
def youtube_download_tool_route():
    data = request.get_json(silent=True) or {}; uid = data.get('user_id', 'guest_user')
    url, qual = data.get('url'), data.get('quality', '720p')
    if not url: return create_error_response("Missing YouTube URL", 400)
    return _handle_tool_file_operation("YouTube", uid, 
        lambda out_dir, u, q: youtube_dl_core.download_youtube_media(u, q, out_dir), 
        "youtube_dl", url, qual)

@app.route('/tools/download/web_pdfs', methods=['POST'])
def web_pdf_downloader_tool_route():
    data = request.get_json(silent=True) or {}; uid = data.get('user_id', 'guest_user')
    query, md = data.get('query'), int(data.get('max_downloads', 3))
    if not query: return create_error_response("Missing PDF search query", 400)
    return _handle_tool_file_operation("WebPDFs", uid, 
        lambda out_dir, q_arg, md_arg: pdf_downloader.download_relevant_pdfs(
            base_query=q_arg, output_folder=out_dir, max_total_downloads=md_arg
        ), "web_pdfs", query, md)

@app.route('/tools/create/ppt', methods=['POST'])
def create_ppt_tool_route():
    fname_q, uid_q = request.args.get('filename', 'Presentation.pptx'), request.args.get('user_id', 'guest_user')
    md_content = request.get_data(as_text=True)
    if not md_content or not md_content.strip(): return create_error_response("Markdown content empty", 400)
    if not hasattr(md_to_office, 'create_ppt'): return create_error_response("PPT module missing create_ppt", 501)
    parsed_slides = md_to_office.refined_parse_markdown(md_content)
    return _handle_tool_file_operation("PPT", uid_q, 
        lambda out_dir, s_data, f_name: md_to_office.create_ppt(s_data, out_dir, f_name), 
        "gen_pptx", parsed_slides, fname_q)

@app.route('/tools/create/doc', methods=['POST'])
def create_doc_tool_route():
    data = request.get_json(silent=True) or {}; uid = data.get('user_id', 'guest_user')
    md_c, key, fname = data.get('markdown_content'), data.get('content_key'), data.get('filename', 'Document.docx')
    if not md_c or not key: return create_error_response("Missing markdown or content_key", 400)
    if not hasattr(md_to_office, 'create_doc'): return create_error_response("DOCX module missing create_doc", 501)
    parsed_slides = md_to_office.refined_parse_markdown(md_c)
    return _handle_tool_file_operation("DOCX", uid, 
        lambda out_dir, s_data, f_name, c_key: md_to_office.create_doc(s_data, out_dir, f_name, c_key), 
        "gen_docx", parsed_slides, fname, key)

@app.route('/tools/ocr/tesseract', methods=['POST'])
def ocr_tesseract_tool_route():
    if 'pdf_file' not in request.files: return create_error_response("No 'pdf_file' in request", 400)
    file = request.files['pdf_file']
    if not file or not file.filename: return create_error_response("No file selected for OCR", 400)
    uid = request.form.get('user_id', 'guest_user')
    tmp_pdf_path = _save_uploaded_file_temp(file)
    try:
        def tesseract_op_wrapper(output_dir, pdf_p_temp):
            fname_base = os.path.splitext(os.path.basename(file.filename))[0]
            output_md_full_path = os.path.join(output_dir, f"{fname_base}.md")
            success = ocr_tesseract.convert_pdf_to_markdown_tesseract(
                pdf_p_temp, output_md_full_path, config.TESSERACT_CMD_PATH, config.POPPLER_PATH)
            return output_md_full_path if success else None
        return _handle_tool_file_operation("TesseractOCR", uid, tesseract_op_wrapper, "ocr_tesseract", tmp_pdf_path)
    finally:
        if os.path.exists(tmp_pdf_path): os.unlink(tmp_pdf_path)

@app.route('/tools/ocr/nougat', methods=['POST'])
def ocr_nougat_tool_route():
    if 'pdf_file' not in request.files: return create_error_response("No 'pdf_file' in request", 400)
    file = request.files['pdf_file']
    if not file or not file.filename: return create_error_response("No file selected for OCR", 400)
    uid = request.form.get('user_id', 'guest_user')
    tmp_pdf_path = _save_uploaded_file_temp(file)
    try:
        return _handle_tool_file_operation("NougatOCR", uid,
            lambda out_dir, pdf_p_temp: ocr_nougat.convert_pdf_with_nougat(
                pdf_p_temp, out_dir, nougat_cli_path=config.NOUGAT_CLI_PATH), 
            "ocr_nougat", tmp_pdf_path)
    finally:
        if os.path.exists(tmp_pdf_path): os.unlink(tmp_pdf_path)

@app.route('/tools/process/video', methods=['POST'])
def video_summarizer_tool_route():
    if 'video_file' not in request.files: return create_error_response("No 'video_file' in request", 400)
    file = request.files['video_file']
    if not file or not file.filename: return create_error_response("No file selected for processing", 400)
    
    uid = request.form.get('user_id', 'guest_user')
    ollama_model = request.form.get('ollama_model', 'llama3')
    
    tmp_video_path = _save_uploaded_file_temp(file)
    try:
        def video_op_wrapper(output_dir, video_p_temp):
            return video_summarizer.process_video_for_summary(
                video_path=video_p_temp,
                output_dir=output_dir,
                ollama_url=config.OLLAMA_URL,
                ollama_model=ollama_model
            )
        return _handle_tool_file_operation("VideoSummarizer", uid, video_op_wrapper, "video_processing", tmp_video_path)
    finally:
        if os.path.exists(tmp_video_path): os.unlink(tmp_video_path)

@app.route('/tools/search/combined', methods=['POST'])
def combined_search_tool_route():
    data = request.get_json(silent=True) or {}
    uid = data.get('user_id', 'guest_user')
    query = data.get('query')
    if not query: return create_error_response("Missing query for combined search", 400)
    search_params = {k: v for k, v in data.items() if k not in ['user_id', 'query']}
    return _handle_tool_file_operation("CombinedSearch", uid,
        lambda out_dir, q, **sp: combined_search.run_combined_search(query=q, output_dir=out_dir, **sp),
        "academic_search", query, is_file_output_expected=False, **search_params)

@app.route('/tools/search/core', methods=['POST'])
def core_search_tool_route():
    data = request.get_json(silent=True) or {}
    uid = data.get('user_id', 'guest_user')
    query = data.get('query')
    core_key = data.get('core_api_key', config.CORE_API_KEY_FROM_ENV)
    dl_pdfs = data.get('download_pdfs', True)
    max_p = data.get('max_pages', 2)
    if not query: return create_error_response("Missing query for CORE search", 400)
    if not core_key: return create_error_response("CORE API Key not provided/configured", 400)
    def core_op_wrapper(output_dir, key, q_arg, download_flag, mp_arg):
        academic_core_api.fetch_all_core_results(
            core_api_key=key, query=q_arg, output_dir=output_dir, 
            download_pdfs=download_flag, max_pages=mp_arg)
        metadata_csv = os.path.join(output_dir, "core_results_metadata.csv")
        return [metadata_csv] if os.path.exists(metadata_csv) else []
    return _handle_tool_file_operation("CORESearch", uid, core_op_wrapper,
        "core_search", core_key, query, dl_pdfs, max_p)

# --- File Serving Route ---
@app.route('/files/<path:requested_path>', methods=['GET'])
def serve_tool_generated_file(requested_path):
    logger.info(f"\n--- Python file serving: '{requested_path}' ---")
    assets_base = os.path.abspath(config.DEFAULT_ASSETS_DIR)
    full_path = os.path.normpath(os.path.join(assets_base, requested_path))
    if not full_path.startswith(assets_base):
        return create_error_response("Access denied: Path traversal attempt.", 403)
    if not os.path.isfile(full_path):
        return create_error_response(f"File not found: {requested_path}", 404)
    try:
        return send_from_directory(os.path.dirname(full_path), os.path.basename(full_path), as_attachment=True)
    except Exception as e:
        return create_error_response(f"Error serving file '{requested_path}': {str(e)}", 500, details=str(e))

# --- Main Startup ---
if __name__ == '__main__':
    try:
        faiss_handler.ensure_faiss_dir()
        faiss_handler.get_embedding_model()
        faiss_handler.load_or_create_index(config.DEFAULT_INDEX_USER_ID)
        logger.info("FAISS init OK.")
    except Exception as e:
        logger.critical(f"FAISS STARTUP FAIL: {e}", exc_info=True)
        sys.exit(1)
    
    port, host = config.AI_CORE_SERVICE_PORT, '0.0.0.0'
    logger.info(f"--- Starting Flask on http://{host}:{port} ---")
    logger.info(f"Assets Dir: {os.path.abspath(config.DEFAULT_ASSETS_DIR)}")
    logger.info(f"Ollama URL: {config.OLLAMA_URL}")
    logger.info(f"Tesseract CMD: {config.TESSERACT_CMD_PATH or 'Not set, using PATH'}, Poppler: {config.POPPLER_PATH or 'Not set, using PATH'}, Nougat CLI: {config.NOUGAT_CLI_PATH or 'Not set, using PATH'}")
    app.run(host=host, port=port, debug=os.getenv('FLASK_DEBUG', 'false').lower() in ['true', '1', 't'])# FusedChatbot/server/ai_core_service/config.py
import os
from dotenv import load_dotenv

# --- Path Setup ---
# This ensures that paths are correct regardless of where the script is run from.
SERVER_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
# Load environment variables from a .env file located in the `server` directory
dotenv_path = os.path.join(SERVER_DIR, '.env')
load_dotenv(dotenv_path=dotenv_path)

# --- General Service Configuration ---
# Port for the Flask AI Core Service to run on.
AI_CORE_SERVICE_PORT = int(os.getenv("AI_CORE_SERVICE_PORT", 5001))
# Directory to store outputs from Python tools (e.g., downloaded videos, generated PPTX).
# It's placed one level up from the 'ai_core_service' directory.
DEFAULT_ASSETS_DIR = os.path.join(SERVER_DIR, "python_tool_assets")
# Directory to store the FAISS vector database indices.
FAISS_INDEX_DIR = os.path.join(SERVER_DIR, "faiss_indices")
# A default user ID for a global, shared index. Can be used for public/pre-loaded data.
DEFAULT_INDEX_USER_ID = "__DEFAULT__"

# --- LLM Provider Configuration ---
# Default LLM provider to use if not specified in the request. Options: 'gemini', 'ollama', 'groq'.
DEFAULT_LLM_PROVIDER = os.getenv("DEFAULT_LLM_PROVIDER", "ollama")
# URL for the Ollama service. Crucial for any tool or feature using local LLMs.
# The value from .env is preferred, otherwise it defaults to the user-specified IP address.
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://172.180.9.187:11434")

# --- RAG and Embedding Configuration ---
# Specifies the type of embedding model to use. Currently supports 'SentenceTransformer'.
EMBEDDING_TYPE = "SentenceTransformer"
# The specific model from HuggingFace to use for creating vector embeddings.
EMBEDDING_MODEL_NAME = "mixedbread-ai/mxbai-embed-large-v1"
# When performing RAG, this is the number of results to fetch from the vector DB for each sub-query.
DEFAULT_RAG_K_PER_SUBQUERY_CONFIG = 3

# --- External Tool Dependencies ---
# These are paths to command-line tools that some modules depend on.
# If these tools are in your system's PATH, you can leave these as None.
# Otherwise, specify the full path to the executable.

# Path to Tesseract OCR executable (e.g., r'C:\Program Files\Tesseract-OCR\tesseract.exe' on Windows).
TESSERACT_CMD_PATH = os.getenv("TESSERACT_CMD_PATH", None)
# Path to the 'bin' directory of your Poppler installation (e.g., r'C:\poppler-23.11.0\Library\bin' on Windows).
POPPLER_PATH = os.getenv("POPPLER_PATH", None)
# Command to run Nougat OCR (usually just 'nougat' if installed in the environment).
NOUGAT_CLI_PATH = os.getenv("NOUGAT_CLI_PATH", "nougat")
# API key for the CORE academic search service. It's best to set this in the .env file.
CORE_API_KEY_FROM_ENV = os.getenv("CORE_API_KEY")

# --- Logging and Output ---
# This print block helps verify the configuration when the application starts.
print("--- AI Core Service Configuration (config.py) ---")
print(f"SERVER_DIR: {SERVER_DIR}")
print(f"DEFAULT_ASSETS_DIR (for tool outputs): {DEFAULT_ASSETS_DIR}")
print(f"FAISS_INDEX_DIR: {FAISS_INDEX_DIR}")
print(f"AI_CORE_SERVICE_PORT: {AI_CORE_SERVICE_PORT}")
print(f"Ollama URL: {OLLAMA_URL}")
print(f"Tesseract CMD Path: {'Not Set (using system PATH)' if not TESSERACT_CMD_PATH else TESSERACT_CMD_PATH}")
print(f"Poppler Path: {'Not Set (using system PATH)' if not POPPLER_PATH else POPPLER_PATH}")
print(f"Nougat CLI Path: {NOUGAT_CLI_PATH}")
print(f"CORE API Key (from env): {'Not Set' if not CORE_API_KEY_FROM_ENV else 'Set'}")
print("-------------------------------------------------")