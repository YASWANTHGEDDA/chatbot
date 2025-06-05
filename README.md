# Chatbot

PS D:\Chatbot-main\fused-chatbot\server\rag_service> py app.py
PS D:\Chatbot-main\fused-chatbot\server\rag_service> py app.py
2025-05-30 21:36:50,053 - INFO - [faiss.loader:125] - Loading faiss with AVX2 support.
2025-05-30 21:36:50,829 - INFO - [faiss.loader:127] - Successfully loaded faiss with AVX2 support.
2025-05-30 21:36:50,863 - INFO - [faiss:186] - Failed to load GPU Faiss: name 'GpuIndexIVFFlat' is not defined. Will not load constructor refs for GPU indexes. This is only an error if you're trying to use GPU Faiss.    
2025-05-30 21:38:47,085 - INFO - [vector_store:37] - Initializing embedding model: all-MiniLM-L6-v2
2025-05-30 21:38:47,092 - INFO - [sentence_transformers.SentenceTransformer:211] - Use pytorch device_name: cpu
2025-05-30 21:38:47,101 - INFO - [sentence_transformers.SentenceTransformer:219] - Load pretrained SentenceTransformer: all-MiniLM-L6-v2
modules.json: 100%|███| 349/349 [00:00<00:00, 581kB/s]
C:\Users\Asus\AppData\Local\Programs\Python\Python313\Lib\site-packages\huggingface_hub\file_download.py:143: UserWarning: `huggingface_hub` cache-system uses symlinks by default to efficiently store duplicated files but your machine does not support them in C:\Users\Asus\.cache\huggingface\hub\models--sentence-transformers--all-MiniLM-L6-v2. Caching files will still work but in a degraded version that might require more space on your disk. This warning can be disabled by setting the `HF_HUB_DISABLE_SYMLINKS_WARNING` environment variable. For more details, see https://huggingface.co/docs/huggingface_hub/how-to-cache#limitations.
To support symlinks on Windows, you either need to activate Developer Mode or to run Python as an administrator. In order to activate developer mode, see this article: https://docs.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development
  warnings.warn(message)
config_sentence_transformers.json: 100%|█| 116/116 [00
README.md: 100%|█| 10.5k/10.5k [00:00<00:00, 10.3MB/s]
sentence_bert_config.json: 100%|█| 53.0/53.0 [00:00<00
config.json: 100%|███| 612/612 [00:00<00:00, 1.22MB/s]
Xet Storage is enabled for this repo, but the 'hf_xet' package is not installed. Falling back to regular HTTP download. For better performance, install the package with: `pip install huggingface_hub[hf_xet]` or `pip install hf_xet`
2025-05-30 21:38:57,116 - WARNING - [huggingface_hub.file_download:1717] - Xet Storage is enabled for this repo, but the 'hf_xet' package is not installed. Falling back to regular HTTP download. For better performance, install the package with: `pip install huggingface_hub[hf_xet]` or `pip install hf_xet`
model.safetensors: 100%|█| 90.9M/90.9M [09:30<00:00, 1
tokenizer_config.json: 100%|█| 350/350 [00:00<00:00, 1
vocab.txt: 100%|████| 232k/232k [00:00<00:00, 780kB/s]
tokenizer.json: 100%|█| 466k/466k [00:00<00:00, 534kB/
special_tokens_map.json: 100%|█| 112/112 [00:00<00:00,
config.json: 100%|████| 190/190 [00:00<00:00, 311kB/s]
2025-05-30 21:48:35,422 - INFO - [vector_store:56] - Creating new FAISS index
Traceback (most recent call last):
  File "D:\Chatbot-main\fused-chatbot\server\rag_service\app.py", line 14, in <module>
    from llm_handler import generate_response, analyze_document
  File "D:\Chatbot-main\fused-chatbot\server\rag_service\llm_handler.py", line 6, in <module>
    import google.generativeai as genai
ModuleNotFoundError: No module named 'google'
PS D:\Chatbot-main\fused-chatbot\server\rag_service> 