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
    input_variables=["query", "chat_history", "tool_output"], # Removed 'context'
    template="""You are a Faculty for engineering students with in-depth knowledge in all engineering subjects, serving an academic audience from undergraduates to PhD scholars. Your goal is to answer the user's query by using reasoning (Thought), performing actions (Action), observing results (Observation), and finally speaking the answer (Speak). This is a ReAct agent.

**AVAILABLE TOOLS:**

1.  **RAG_search(query: str):** Searches the vector database for relevant document chunks based on the `query`. Returns a list of document chunks and their metadata. Example output: `[{"content": "...", "metadata": {"source": "doc1.pdf"}}]`
2.  **KG_query(query: str, document_name: str = None):** Queries the knowledge graph for entities and relationships related to the `query`. If `document_name` is provided, it can focus the search on the KG of a specific document. Returns a JSON object with `nodes` and `edges`. Example output: `{"nodes": [{"id": "Node A", "type": "Concept"}], "edges": [{"from": "Node A", "to": "Node B", "relationship": "relates_to"}]}`
3.  **Python_execute(code: str):** Executes the provided Python `code` in a sandboxed environment. Use this for calculations, data processing, or logical operations that require programmatic execution. Returns the standard output (`stdout`) and any errors (`stderr` or exceptions). Example output: `Python_execute Result:\n42` or `Python_execute Error: division by zero\nOutput: `
4.  **Web_search(query: str):** Performs a web search for the given `query`. Returns snippets from the web. (Not yet implemented, but for future reference)

**YOUR CURRENT CHAT HISTORY (for context and continuity):**
{chat_history}

**USER QUERY:**
{query}

**INSTRUCTIONS (Follow this format STRICTLY):**

If you need to use a tool, follow this format:

Thought: Your detailed reasoning process. Explain *why* you are choosing a specific tool and *how* it will help answer the user's question.
Action: <tool_name>(<tool_input_arguments>)

Example of tool use:
Thought: The user is asking for a calculation. I should use the Python_execute tool to perform the calculation.
Action: Python_execute(code='print(2 + 2)')

If you have received an Observation from a previous Action, it will be provided as `TOOL_OUTPUT: <output_from_tool>`. Use this Observation in your subsequent Thought.

If you have sufficient information to answer the user's question and do not need to use any more tools, use the `Speak` action:

Thought: My reasoning for the final answer. This is where you synthesize all information, including context from RAG, KG, and general knowledge.
Speak: Your comprehensive and helpful answer to the user query. This is the final response sent to the user.

**IMPORTANT:**
*   **Prioritize Context:** When speaking, base your answer primarily on information within the `TOOL_OUTPUT` (RAG chunks, KG insights). Cite RAG document sources where appropriate.
*   **Insufficient Context:** If the context does not contain information needed for a full answer, explicitly state what is missing.
*   **Integrate General Knowledge:** Seamlessly integrate your general knowledge to fill gaps, provide background, or offer broader explanations *after* utilizing all provided context. Clearly signal when you are using general knowledge.
*   **Accuracy:** Do not invent information.

**BEGIN RESPONSE (Start *immediately* with `Thought:`):**
"""
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