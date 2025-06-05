import os
import json
import logging
import concurrent.futures
from typing import List, Dict, Any, Optional
from langchain_ollama import ChatOllama
from ..config.config import settings

logger = logging.getLogger(__name__)

class KGService:
    def __init__(self):
        self.llm = ChatOllama(
            base_url=settings.OLLAMA_BASE_URL,
            model=settings.OLLAMA_MODEL,
            request_timeout=settings.OLLAMA_REQUEST_TIMEOUT
        )
        os.makedirs(settings.KG_OUTPUT_FOLDER, exist_ok=True)

    def split_into_chunks(self, text: str) -> List[str]:
        chunks = []
        start = 0
        text_len = len(text)
        while start < text_len:
            end = min(start + settings.KG_CHUNK_SIZE, text_len)
            chunks.append(text[start:end])
            next_start = end - settings.KG_CHUNK_OVERLAP
            start = max(next_start, start + 1) if end < text_len else end
        return chunks

    def process_single_chunk(self, chunk_data) -> Optional[Dict[str, Any]]:
        index, chunk_text = chunk_data
        prompt = settings.KG_PROMPT_TEMPLATE.format(chunk_text=chunk_text)
        try:
            response = self.llm.invoke(prompt)
            content = response.content if hasattr(response, 'content') else response
            if not content:
                logger.warning(f"Empty response for chunk {index+1}")
                return None
            # Remove code fences if present
            if content.strip().startswith("```json"):
                content = content.strip()[7:-3].strip()
            elif content.strip().startswith("```"):
                content = content.strip()[3:-3].strip()
            graph_data = json.loads(content)
            if isinstance(graph_data, dict) and 'nodes' in graph_data and 'edges' in graph_data:
                return graph_data
            else:
                logger.warning(f"Invalid graph structure for chunk {index+1}")
                return None
        except Exception as e:
            logger.error(f"Error processing chunk {index+1}: {e}")
            return None

    def merge_graphs(self, graphs: List[Optional[Dict[str, Any]]]) -> Dict[str, Any]:
        final_nodes = {}
        final_edges = set()
        for i, graph in enumerate(graphs):
            if not graph or 'nodes' not in graph or 'edges' not in graph:
                continue
            for node in graph['nodes']:
                node_id = node.get('id')
                if node_id and node_id not in final_nodes:
                    final_nodes[node_id] = node
            for edge in graph['edges']:
                if all(k in edge for k in ['from', 'to', 'relationship']):
                    edge_tuple = (edge['from'], edge['to'], edge['relationship'])
                    final_edges.add(edge_tuple)
        return {
            'nodes': list(final_nodes.values()),
            'edges': [ {'from': e[0], 'to': e[1], 'relationship': e[2]} for e in final_edges ]
        }

    def save_graph(self, graph: Dict[str, Any], doc_filename: str):
        base_name = os.path.splitext(os.path.basename(doc_filename))[0]
        kg_file = f"{base_name}{settings.KG_FILENAME_SUFFIX}"
        kg_path = os.path.join(settings.KG_OUTPUT_FOLDER, kg_file)
        with open(kg_path, 'w', encoding='utf-8') as f:
            json.dump(graph, f, ensure_ascii=False, indent=2)
        return kg_path

    def load_graph(self, doc_filename: str) -> Optional[Dict[str, Any]]:
        base_name = os.path.splitext(os.path.basename(doc_filename))[0]
        kg_file = f"{base_name}{settings.KG_FILENAME_SUFFIX}"
        kg_path = os.path.join(settings.KG_OUTPUT_FOLDER, kg_file)
        if os.path.exists(kg_path):
            with open(kg_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        return None

    def extract_kg_from_text(self, text: str, doc_filename: str) -> Dict[str, Any]:
        chunks = self.split_into_chunks(text)
        with concurrent.futures.ThreadPoolExecutor(max_workers=settings.KG_MAX_WORKERS) as executor:
            results = list(executor.map(self.process_single_chunk, enumerate(chunks)))
        merged_graph = self.merge_graphs([g for g in results if g])
        self.save_graph(merged_graph, doc_filename)
        return merged_graph 