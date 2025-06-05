import logging
from typing import List, Dict, Any, Optional, Tuple
from langchain_ollama import ChatOllama
from langchain.prompts import PromptTemplate
from langchain.chains import LLMChain
from google.generativeai import GenerativeModel, HarmCategory, HarmBlockThreshold
import google.generativeai as genai
from ..config.config import settings

logger = logging.getLogger(__name__)

class LLMService:
    def __init__(self):
        self.ollama_client = None
        self.gemini_client = None
        self.initialize_clients()
        
    def initialize_clients(self):
        """Initialize both Ollama and Gemini clients."""
        try:
            # Initialize Ollama
            self.ollama_client = ChatOllama(
                base_url=settings.OLLAMA_BASE_URL,
                model=settings.OLLAMA_MODEL,
                request_timeout=settings.OLLAMA_REQUEST_TIMEOUT
            )
            logger.info("Ollama client initialized successfully")
            
            # Initialize Gemini if API key is available
            if settings.GEMINI_API_KEY:
                genai.configure(api_key=settings.GEMINI_API_KEY)
                self.gemini_client = GenerativeModel(
                    model_name=settings.GEMINI_MODEL,
                    generation_config={
                        "temperature": settings.DEFAULT_TEMPERATURE,
                        "max_output_tokens": settings.DEFAULT_MAX_TOKENS,
                    },
                    safety_settings=[
                        {
                            "category": getattr(HarmCategory, f"HARM_CATEGORY_{category}"),
                            "threshold": getattr(HarmBlockThreshold, threshold)
                        }
                        for category, threshold in settings.SAFETY_SETTINGS.items()
                    ]
                )
                logger.info("Gemini client initialized successfully")
            else:
                logger.warning("Gemini API key not found, Gemini client not initialized")
                
        except Exception as e:
            logger.error(f"Error initializing LLM clients: {e}", exc_info=True)
            raise
    
    async def generate_response(
        self,
        query: str,
        context: str,
        chat_history: Optional[List[Dict[str, Any]]] = None,
        llm_preference: str = "ollama",
        system_prompt: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Generate a response using the specified LLM.
        
        Args:
            query: The user's query
            context: The context to use for generation (RAG + KG)
            chat_history: Optional chat history
            llm_preference: Which LLM to use ("ollama" or "gemini")
            system_prompt: Optional system prompt
            
        Returns:
            Tuple of (response_text, thinking_process)
        """
        try:
            if llm_preference.lower() == "ollama":
                return await self._generate_with_ollama(query, context, chat_history, system_prompt)
            elif llm_preference.lower() == "gemini":
                return await self._generate_with_gemini(query, context, chat_history, system_prompt)
            else:
                raise ValueError(f"Unsupported LLM preference: {llm_preference}")
                
        except Exception as e:
            logger.error(f"Error generating response: {e}", exc_info=True)
            raise
    
    async def _generate_with_ollama(
        self,
        query: str,
        context: str,
        chat_history: Optional[List[Dict[str, Any]]] = None,
        system_prompt: Optional[str] = None
    ) -> Tuple[str, str]:
        """Generate response using Ollama."""
        if not self.ollama_client:
            raise RuntimeError("Ollama client not initialized")
            
        try:
            # Create prompt template
            prompt = PromptTemplate(
                template=settings.SYNTHESIS_PROMPT_TEMPLATE,
                input_variables=["query", "context"]
            )
            
            # Create chain
            chain = LLMChain(llm=self.ollama_client, prompt=prompt)
            
            # Generate response
            response = await chain.arun(query=query, context=context)
            
            # Extract thinking process and final answer
            thinking_process, final_answer = self._extract_thinking_and_answer(response)
            
            return final_answer, thinking_process
            
        except Exception as e:
            logger.error(f"Error in Ollama generation: {e}", exc_info=True)
            raise
    
    async def _generate_with_gemini(
        self,
        query: str,
        context: str,
        chat_history: Optional[List[Dict[str, Any]]] = None,
        system_prompt: Optional[str] = None
    ) -> Tuple[str, str]:
        """Generate response using Gemini."""
        if not self.gemini_client:
            raise RuntimeError("Gemini client not initialized")
            
        try:
            # Prepare chat history
            history = []
            if chat_history:
                for msg in chat_history:
                    if msg["role"] == "user":
                        history.append({"role": "user", "parts": [{"text": msg["content"]}]})
                    elif msg["role"] == "assistant":
                        history.append({"role": "model", "parts": [{"text": msg["content"]}]})
            
            # Create chat session
            chat = self.gemini_client.start_chat(history=history)
            
            # Prepare the prompt
            prompt = settings.SYNTHESIS_PROMPT_TEMPLATE.format(
                query=query,
                context=context
            )
            
            # Generate response
            response = await chat.send_message_async(prompt)
            
            # Extract thinking process and final answer
            thinking_process, final_answer = self._extract_thinking_and_answer(response.text)
            
            return final_answer, thinking_process
            
        except Exception as e:
            logger.error(f"Error in Gemini generation: {e}", exc_info=True)
            raise
    
    def _extract_thinking_and_answer(self, response: str) -> Tuple[str, str]:
        """Extract thinking process and final answer from response."""
        try:
            # Find thinking process
            thinking_start = response.find("<thinking>")
            thinking_end = response.find("</thinking>")
            
            if thinking_start == -1 or thinking_end == -1:
                logger.warning("No thinking tags found in response")
                return "", response
            
            thinking_process = response[thinking_start + len("<thinking>"):thinking_end].strip()
            final_answer = response[thinking_end + len("</thinking>"):].strip()
            
            return thinking_process, final_answer
            
        except Exception as e:
            logger.error(f"Error extracting thinking and answer: {e}", exc_info=True)
            return "", response 