# server/rag_service/llm_handler.py

import os
import logging
from typing import Optional, Dict, Any
import google.generativeai as genai
from langchain_community.llms import Ollama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - [%(name)s:%(lineno)d] - %(message)s')
logger = logging.getLogger(__name__)

# Initialize Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    logger.error("GEMINI_API_KEY not found in environment variables")
else:
    genai.configure(api_key=GEMINI_API_KEY)

# Ollama configuration
OLLAMA_BASE_URL = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama2')

# Analysis prompts
ANALYSIS_PROMPTS = {
    'faq': """Based on the following document, generate a list of frequently asked questions and their answers.
    Format each Q&A pair as:
    Q: [Question]
    A: [Answer]
    
    Document:
    {text}
    
    Generate at least 5 relevant Q&A pairs.""",
    
    'topics': """Analyze the following document and identify the main topics and subtopics.
    Format the output as a hierarchical list:
    - Main Topic 1
      - Subtopic 1.1
      - Subtopic 1.2
    - Main Topic 2
      - Subtopic 2.1
      - Subtopic 2.2
    
    Document:
    {text}
    
    Identify at least 3 main topics with relevant subtopics.""",
    
    'mindmap': """Create a mind map structure from the following document.
    Format the output as a hierarchical tree with main concepts and their relationships:
    Main Concept
    ├── Related Concept 1
    │   ├── Sub-concept 1.1
    │   └── Sub-concept 1.2
    ├── Related Concept 2
    │   ├── Sub-concept 2.1
    │   └── Sub-concept 2.2
    
    Document:
    {text}
    
    Create a comprehensive mind map with at least 2 levels of hierarchy."""
}

# Chat prompt template
CHAT_PROMPT_TEMPLATE = """You are a helpful AI assistant. Use the following context to answer the user's question.
If you cannot find the answer in the context, say so and provide a general response based on your knowledge.

Context:
{context}

User Question: {query}

Please provide a detailed and accurate response. If you use information from the context, cite the source."""

def get_llm(llm_choice: str) -> Any:
    """Get the appropriate LLM instance based on the choice."""
    try:
        if llm_choice.lower() == 'gemini':
            model = genai.GenerativeModel('gemini-pro')
            return model
        elif llm_choice.lower() == 'ollama':
            model = Ollama(
                base_url=OLLAMA_BASE_URL,
                model=OLLAMA_MODEL
            )
            return model
        else:
            raise ValueError(f"Unsupported LLM choice: {llm_choice}")
    except Exception as e:
        logger.error(f"Error initializing LLM ({llm_choice}): {e}", exc_info=True)
        raise

def generate_response(
    query: str,
    context: str,
    llm_choice: str = 'gemini',
    system_prompt: Optional[str] = None
) -> Dict[str, Any]:
    """Generate a response using the chosen LLM."""
    try:
        llm = get_llm(llm_choice)
        
        # Prepare the prompt
        prompt = CHAT_PROMPT_TEMPLATE.format(
            context=context,
            query=query
        )
        
        if system_prompt:
            prompt = f"{system_prompt}\n\n{prompt}"
        
        # Generate response based on LLM type
        if llm_choice.lower() == 'gemini':
            response = llm.generate_content(prompt)
            return {
                "text": response.text,
                "thinking": None  # Gemini doesn't provide thinking process
            }
        else:  # Ollama
            # Use LangChain's prompt template and output parser
            prompt_template = ChatPromptTemplate.from_template(prompt)
            chain = prompt_template | llm | StrOutputParser()
            
            # Request thinking process
            thinking_prompt = f"{prompt}\n\nPlease show your thinking process in <thinking> tags before providing the final answer."
            thinking_response = chain.invoke({"context": context, "query": query})
            
            # Parse thinking and response
            thinking = None
            response_text = thinking_response
            
            if "<thinking>" in thinking_response:
                parts = thinking_response.split("<thinking>")
                if len(parts) > 1:
                    thinking = parts[1].split("</thinking>")[0].strip()
                    response_text = parts[1].split("</thinking>")[1].strip()
            
            return {
                "text": response_text,
                "thinking": thinking
            }
            
    except Exception as e:
        logger.error(f"Error generating response with {llm_choice}: {e}", exc_info=True)
        raise

def analyze_document(text: str, analysis_type: str) -> Dict[str, Any]:
    """Analyze a document using the specified analysis type."""
    try:
        if analysis_type not in ANALYSIS_PROMPTS:
            raise ValueError(f"Unsupported analysis type: {analysis_type}")
        
        # Get the appropriate prompt
        prompt = ANALYSIS_PROMPTS[analysis_type].format(text=text)
        
        # Use Gemini for analysis (more reliable for structured output)
        model = get_llm('gemini')
        response = model.generate_content(prompt)
        
        return {
            "type": analysis_type,
            "content": response.text,
            "thinking": None  # Analysis doesn't include thinking process
        }
        
    except Exception as e:
        logger.error(f"Error performing {analysis_type} analysis: {e}", exc_info=True)
        raise 