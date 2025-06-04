# --- START OF FILE config.py ---

import os
from dotenv import load_dotenv
import logging
from langchain.prompts import PromptTemplate

# Load environment variables from .env file in the same directory
dotenv_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=dotenv_path)

# --- Environment Variables & Defaults ---

# Base directory
BASE_DIR = r"D:\Chatbot-main\Notebook\backend"

# Ollama Configuration
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://172.180.9.187:11435')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'deepseek-r1')  # For RAG and general LLM tasks
OLLAMA_EMBED_MODEL = os.getenv('OLLAMA_EMBED_MODEL', 'mxbai-embed-large')  # For embeddings
OLLAMA_REQUEST_TIMEOUT = int(os.getenv('OLLAMA_REQUEST_TIMEOUT', 180))  # Seconds

# Application Configuration Paths
backend_dir = os.path.dirname(__file__)
FAISS_FOLDER = os.path.join(backend_dir, os.getenv('FAISS_FOLDER', 'faiss_store'))
UPLOAD_FOLDER = os.path.join(BASE_DIR, os.getenv('UPLOAD_FOLDER', 'upload_folder'))
DATABASE_NAME = os.getenv('DATABASE_NAME', 'chat_history.db')
DATABASE_PATH = os.path.join(backend_dir, DATABASE_NAME)
DEFAULT_PDFS_FOLDER = os.path.join(BASE_DIR, os.getenv('DEFAULT_PDFS_FOLDER', 'default_pdfs'))
KG_OUTPUT_FOLDER = os.path.join(BASE_DIR, os.getenv('KG_OUTPUT_FOLDER', 'KG'))

# File Handling
ALLOWED_EXTENSIONS = {'pdf', 'pptx', 'ppt'}

# RAG Configuration
RAG_CHUNK_K = int(os.getenv('RAG_CHUNK_K', 5))
RAG_SEARCH_K_PER_QUERY = int(os.getenv('RAG_SEARCH_K_PER_QUERY', 3))
MULTI_QUERY_COUNT = int(os.getenv('MULTI_QUERY_COUNT', 3))
ANALYSIS_MAX_CONTEXT_LENGTH = int(os.getenv('ANALYSIS_MAX_CONTEXT_LENGTH', 8000))

# Knowledge Graph Configuration
KG_CHUNK_SIZE = int(os.getenv('KG_CHUNK_SIZE', 2048))
KG_CHUNK_OVERLAP = int(os.getenv('KG_CHUNK_OVERLAP', 256))
KG_MAX_WORKERS = int(os.getenv('KG_MAX_WORKERS', 10))
KG_MODEL = os.getenv('KG_MODEL', 'deepseek-r1')
KG_PROMPT_TEMPLATE = os.getenv('KG_PROMPT_TEMPLATE', """
You are an expert in knowledge graph creation. I have a chunk of lecture notes on DevOps. Your task is to read the text and create a partial graph-based memory map. Identify major topics as top-level nodes, subtopics as subnodes under their respective parents, and relationships between nodes. Output the result as a valid JSON object with "nodes" and "edges" sections. Ensure the JSON is complete and properly formatted. Ensure all node IDs and relationship types are strings.

Text chunk:
{chunk_text}

Output format:
{{
  "nodes": [
    {{"id": "Node Name", "type": "major|subnode", "parent": "Parent Node ID or null", "description": "Short description (max 50 words)"}},
    ...
  ],
  "edges": [
    {{"from": "Node A ID", "to": "Node B ID", "relationship": "subtopic|depends_on|related_to"}},
    ...
  ]
}}
""")
KG_FILENAME_SUFFIX = ".kg.json" # Suffix for KG files

# Logging Configuration
LOGGING_LEVEL_NAME = os.getenv('LOGGING_LEVEL', 'INFO').upper()
LOGGING_LEVEL = getattr(logging, LOGGING_LEVEL_NAME, logging.INFO)
LOGGING_FORMAT = '%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s'

# --- Prompt Templates ---

SUB_QUERY_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["query", "num_queries"],
    template="""You are an AI assistant skilled at decomposing user questions into effective search queries for a vector database containing chunks of engineering documents.
Given the user's query, generate {num_queries} distinct search queries targeting different specific aspects, keywords, or concepts within the original query.
Focus on creating queries that are likely to retrieve relevant text chunks individually.
Output ONLY the generated search queries, each on a new line. Do not include numbering, labels, explanations, or any other text.

User Query: "{query}"

Generated Search Queries:"""
)

SYNTHESIS_PROMPT_TEMPLATE = PromptTemplate(
    input_variables=["query", "context"], # context will now include RAG + KG info
    template="""You are a Faculty for engineering students with in-depth knowledge in all engineering subjects, serving an academic audience from undergraduates to PhD scholars. Your goal is to answer the user's query based on the provided context document chunks and relevant knowledge graph insights, augmented with your general knowledge when necessary. Provide detailed, technical, and well-structured responses suitable for this audience. Use precise terminology, include relevant concepts, algorithms, and applications, and organize your response with sections or bullet points where appropriate.

**TASK:** Respond to the user's query using the provided context (which includes text chunks and may include knowledge graph insights) and your general knowledge.

**USER QUERY:**
"{query}"

**PROVIDED CONTEXT:**
--- START CONTEXT ---
{context}
--- END CONTEXT ---
*The context above may contain direct text excerpts from documents AND/OR structured insights derived from knowledge graphs related to those documents (e.g., "Key concepts and relationships from Knowledge Graph..."). Use all provided information.*

**INSTRUCTIONS:**

**STEP 1: THINKING PROCESS (MANDATORY):**
*   **CRITICAL:** Before writing the final answer, articulate your step-by-step reasoning process for how you will arrive at the answer. Explain how you will use the RAG context, any provided knowledge graph insights, and potentially supplement it with general knowledge.
*   Use a step-by-step Chain of Thought (CoT) approach to arrive at a logical and accurate answer, and include your reasoning in a <thinking> tag. Enclose this entire reasoning process *exclusively* within `<thinking>` and `</thinking>` tags.
*   Example: `<thinking>The user asks about X. RAG Context [1] defines X. KG insights for Document Y highlight a relationship between X and Z. RAG Context [3] gives an example. I will synthesize this information, ensuring to use the KG to clarify connections, and then add general knowledge about aspect W.</thinking>`
*   **DO NOT** put any text before `<thinking>` or after `</thinking>` except for the final answer.

**STEP 2: FINAL ANSWER (After the `</thinking>` tag):**
*   Provide a comprehensive and helpful answer to the user query.
*   **Prioritize Context:** Base your answer **primarily** on information within the `PROVIDED CONTEXT` (both RAG chunks and KG insights).
*   **Cite Sources:** When using information *directly* from a RAG context chunk, **you MUST cite** its number like [1], [2], [1][3]. Cite all relevant sources for each piece of information derived from the RAG context. KG insights are supplementary and generally don't need separate citation unless the prompt structure changes.
*   **Insufficient Context:** If the context (RAG + KG) does not contain information needed for a full answer, explicitly state what is missing.
*   **Integrate General Knowledge:** *Seamlessly integrate* your general knowledge to fill gaps, provide background, or offer broader explanations **after** utilizing all provided context. Clearly signal when you are using general knowledge.
*   **Be a Tutor:** Explain concepts clearly. Be helpful, accurate, and conversational. Use Markdown formatting.
*   **Accuracy:** Do not invent information.

**BEGIN RESPONSE (Start *immediately* with the `<thinking>` tag):**
<thinking>"""
)

_ANALYSIS_THINKING_PREFIX = """**STEP 1: THINKING PROCESS (Recommended):**
*   Before generating the analysis, briefly outline your plan in `<thinking>` tags. Example: `<thinking>Analyzing for FAQs. Will scan for key questions and answers presented in the text.</thinking>`
*   If you include thinking, place the final analysis *after* the `</thinking>` tag.

**STEP 2: ANALYSIS OUTPUT:**
*   Generate the requested analysis based **strictly** on the text provided below.
*   Follow the specific OUTPUT FORMAT instructions carefully.

--- START DOCUMENT TEXT ---
{doc_text_for_llm}
--- END DOCUMENT TEXT ---
"""

ANALYSIS_PROMPTS = {
    "faq": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template=_ANALYSIS_THINKING_PREFIX + """
**TASK:** Generate 5-7 Frequently Asked Questions (FAQs) with concise answers based ONLY on the text.

**OUTPUT FORMAT (Strict):**
*   Start directly with the first FAQ (after thinking, if used). Do **NOT** include preamble.
*   Format each FAQ as:
    Q: [Question derived ONLY from the text]
    A: [Answer derived ONLY from the text, concise]
*   If the text doesn't support an answer, don't invent one. Use Markdown for formatting if appropriate (e.g., lists within an answer).

**BEGIN OUTPUT (Start with 'Q:' or `<thinking>`):**
"""
    ),
    "topics": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template=_ANALYSIS_THINKING_PREFIX + """
**TASK:** Identify the 5-8 most important topics discussed. Provide a 1-2 sentence explanation per topic based ONLY on the text.

**OUTPUT FORMAT (Strict):**
*   Start directly with the first topic (after thinking, if used). Do **NOT** include preamble.
*   Format as a Markdown bulleted list:
    *   **Topic Name:** Brief explanation derived ONLY from the text content (1-2 sentences max).

**BEGIN OUTPUT (Start with '*   **' or `<thinking>`):**
"""
    ),
    "mindmap": PromptTemplate(
        input_variables=["doc_text_for_llm"],
        template=_ANALYSIS_THINKING_PREFIX + """
**TASK:** Generate a mind map outline in Markdown list format representing key concepts and hierarchy ONLY from the text.

**OUTPUT FORMAT (Strict):**
*   Start directly with the main topic as the top-level item (using '-') (after thinking, if used). Do **NOT** include preamble.
*   Use nested Markdown lists ('-' or '*') with indentation (2 or 4 spaces) for hierarchy.
*   Focus **strictly** on concepts and relationships mentioned in the text. Be concise.

**BEGIN OUTPUT (Start with e.g., '- Main Topic' or `<thinking>`):**
"""
    )
}

# --- Logging Setup ---
def setup_logging():
    """Configures application-wide logging."""
    logging.basicConfig(level=LOGGING_LEVEL, format=LOGGING_FORMAT)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("faiss.loader").setLevel(logging.WARNING)
    logger = logging.getLogger(__name__)
    logger.info(f"Logging configured with level {LOGGING_LEVEL_NAME}")
    # ... (rest of your debug logs)

# Ensure directories exist
for folder in [FAISS_FOLDER, UPLOAD_FOLDER, DEFAULT_PDFS_FOLDER, KG_OUTPUT_FOLDER]:
    os.makedirs(folder, exist_ok=True)