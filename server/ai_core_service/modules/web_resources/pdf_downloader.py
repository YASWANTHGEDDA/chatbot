# modules/web_resources/pdf_downloader.py
import duckduckgo_search
import requests
import os
import arxiv # Ensure 'arxiv' package is installed
import re
from urllib.parse import urlparse
import time
import random
# Note: Gemini API integration for filtering is assumed to be handled by the calling application
# or by passing a pre-initialized Gemini model/client to the functions.
# This module will focus on search and download, with a placeholder for filtering.

def is_pdf_url(url):
    """Checks if a URL likely points to a PDF by its extension."""
    return url.lower().endswith('.pdf')

def is_arxiv_url_check(url):
    """Checks if a URL is from an arxiv.org domain."""
    parsed_url = urlparse(url)
    return "arxiv.org" in parsed_url.netloc

def extract_arxiv_id_from_url(url):
    """Extracts arXiv ID from common arXiv URL patterns."""
    # Matches formats like arxiv.org/abs/xxxx.xxxxx or arxiv.org/pdf/xxxx.xxxxx
    # Also handles versions like xxxx.xxxxxv1
    match = re.search(r'arxiv\.org/(?:abs|pdf)/(\d{4}\.\d{4,5}(?:v\d+)?)', url)
    if match:
        return match.group(1)
    return None

def download_arxiv_pdf_resource(arxiv_id, output_folder, filename_prefix="arxiv_"):
    """Downloads a PDF from arXiv given its ID."""
    os.makedirs(output_folder, exist_ok=True)
    filepath = os.path.join(output_folder, f"{filename_prefix}{arxiv_id.replace('.', '_')}.pdf")
    
    if os.path.exists(filepath):
        print(f"File already exists: {filepath}")
        return filepath

    try:
        print(f"Searching arXiv for ID: {arxiv_id}")
        search = arxiv.Search(id_list=[arxiv_id])
        paper = next(search.results(), None) # Get the first (and should be only) result
        
        if paper and paper.pdf_url:
            print(f"Downloading from arXiv PDF URL: {paper.pdf_url}")
            response = requests.get(paper.pdf_url, stream=True, timeout=30)
            response.raise_for_status()
            
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Successfully downloaded: {filepath}")
            return filepath
        else:
            print(f"Could not find arXiv paper or PDF URL for ID: {arxiv_id}")
            return None
    except StopIteration:
        print(f"No paper found on arXiv for ID: {arxiv_id}")
        return None
    except requests.exceptions.RequestException as e:
        print(f"Error downloading arXiv PDF {arxiv_id} from {paper.pdf_url if 'paper' in locals() and paper else 'N/A'}: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred downloading arXiv PDF {arxiv_id}: {e}")
        return None

def download_general_pdf_resource(url, output_folder, filename_base="doc_"):
    """Downloads a general PDF from a URL if it's a PDF."""
    os.makedirs(output_folder, exist_ok=True)
    
    # Create a somewhat unique filename from URL
    parsed_url = urlparse(url)
    path_part = parsed_url.path.strip('/').replace('/', '_')
    filename = f"{filename_base}{path_part[-50:] or 'downloaded'}.pdf" # Use last 50 chars of path
    filepath = os.path.join(output_folder, filename)

    if os.path.exists(filepath):
        print(f"File already exists: {filepath}")
        return filepath
        
    try:
        print(f"Attempting to download general PDF: {url}")
        response = requests.get(url, stream=True, timeout=30, headers={'User-Agent': 'Mozilla/5.0'})
        response.raise_for_status()
        
        content_type = response.headers.get('Content-Type', '').lower()
        if 'application/pdf' in content_type or is_pdf_url(url): # Check content type and URL
            with open(filepath, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"Successfully downloaded: {filepath}")
            return filepath
        else:
            print(f"URL does not seem to be a PDF (Content-Type: {content_type}): {url}")
            return None
    except requests.exceptions.RequestException as e:
        print(f"Error downloading general PDF from {url}: {e}")
        return None
    except Exception as e:
        print(f"An unexpected error occurred downloading general PDF from {url}: {e}")
        return None

def filter_links_with_llm(links, query_context, gemini_model_instance):
    """
    Filters links using a Gemini model for relevance.
    (This is a conceptual function; actual implementation depends on your gemini_model_instance)
    """
    if not gemini_model_instance:
        print("Gemini model not provided, skipping LLM filtering. All links considered relevant.")
        return links

    relevant_links = []
    for link in links:
        prompt = f"Is this link highly relevant to the topic of '{query_context}'? Only answer YES or NO. URL: {link}"
        try:
            # This is a placeholder for actual Gemini API call
            # response = gemini_model_instance.generate_content(prompt, ...) 
            # mocked_response_text = "YES" # Simulate LLM response
            # In a real scenario, you'd parse the actual response.text
            
            # For now, let's assume a simple pass-through or a mock
            print(f"LLM Filtering (mock): Considering link {link} relevant for '{query_context}'")
            # if "yes" in mocked_response_text.lower():
            relevant_links.append(link)
            time.sleep(0.2) # Small delay if making multiple LLM calls
        except Exception as e:
            print(f"Error during LLM filtering for link {link}: {e}")
            # Decide if you want to include the link on error or not
            # relevant_links.append(link) # Example: include on error
    return relevant_links


def web_search_ddg(query, max_results=50):
    """Performs a web search using DuckDuckGo and yields PDF links."""
    print(f"Searching DuckDuckGo for: {query} filetype:pdf")
    ddg = duckduckgo_search.DDGS()
    # DDGS().text does not directly support filetype filter in the query string like Google
    # We need to filter results manually or use keywords like "pdf" in the query.
    # A more robust way for DDG is to search for the query and then check if href ends with .pdf.
    
    pdf_links = []
    try:
        # Query for PDFs explicitly in text search
        results = ddg.text(f"{query} filetype:pdf", max_results=max_results * 2) # Fetch more to filter
        for result in results:
            href = result.get("href")
            if href and is_pdf_url(href):
                pdf_links.append(href)
                if len(pdf_links) >= max_results:
                    break
        # If not enough, try a broader search and filter
        if len(pdf_links) < max_results:
            results_broad = ddg.text(query, max_results=max_results * 2)
            for result in results_broad:
                href = result.get("href")
                if href and is_pdf_url(href) and href not in pdf_links:
                    pdf_links.append(href)
                    if len(pdf_links) >= max_results:
                        break
    except Exception as e:
        print(f"Error during DuckDuckGo search: {e}")
    return pdf_links[:max_results]


def arxiv_search_lib(query, max_results=20):
    """Searches arXiv using the 'arxiv' library and returns PDF URLs."""
    print(f"Searching arXiv for: {query}")
    try:
        search = arxiv.Search(
            query=query,
            max_results=max_results,
            sort_by=arxiv.SortCriterion.Relevance
        )
        arxiv_pdf_urls = [result.pdf_url for result in search.results() if result.pdf_url]
        return arxiv_pdf_urls
    except Exception as e:
        print(f"Error during arXiv library search: {e}")
        return []

def download_relevant_pdfs(base_query, output_folder, 
                           gemini_model_instance=None, # Pass your initialized Gemini model
                           query_variants=None, 
                           max_total_downloads=20,
                           max_ddg_results_per_query=10,
                           max_arxiv_results_per_query=5):
    """
    Main function to search for and download relevant PDF materials.

    Args:
        base_query (str): The primary search query.
        output_folder (str): Directory to save downloaded PDFs.
        gemini_model_instance (object, optional): Initialized Gemini model for filtering.
        query_variants (list, optional): List of alternative query strings.
        max_total_downloads (int): Maximum number of PDFs to download in total.
        max_ddg_results_per_query (int): Max PDF links from DDG per query variant.
        max_arxiv_results_per_query (int): Max PDF links from arXiv per query variant.

    Returns:
        list: A list of filepaths of successfully downloaded PDFs.
    """
    os.makedirs(output_folder, exist_ok=True)
    downloaded_files = []
    seen_urls = set() # To avoid re-processing the same URL

    if query_variants is None:
        query_variants = [base_query]
    elif base_query not in query_variants:
        query_variants.insert(0, base_query)

    for query_idx, current_query in enumerate(query_variants):
        if len(downloaded_files) >= max_total_downloads:
            break
        
        print(f"\nProcessing query ({query_idx+1}/{len(query_variants)}): '{current_query}'")
        
        # Search sources
        ddg_links = web_search_ddg(current_query, max_results=max_ddg_results_per_query)
        arxiv_links = arxiv_search_lib(current_query, max_results=max_arxiv_results_per_query)
        
        all_found_links = []
        for link_list in [ddg_links, arxiv_links]:
            for link in link_list:
                if link not in seen_urls:
                    all_found_links.append(link)
                    seen_urls.add(link)
        
        if not all_found_links:
            print(f"No new PDF links found for query: '{current_query}'")
            continue

        # Filter links (using LLM if provided)
        print(f"Found {len(all_found_links)} unique new links. Filtering...")
        # For LLM filtering, current_query can be the context
        relevant_links = filter_links_with_llm(all_found_links, current_query, gemini_model_instance) 
        print(f"{len(relevant_links)} links considered relevant for '{current_query}'.")

        # Download relevant PDFs
        for link_idx, link_url in enumerate(relevant_links):
            if len(downloaded_files) >= max_total_downloads:
                print("Reached maximum total downloads limit.")
                break

            print(f"\nAttempting download ({link_idx+1}/{len(relevant_links)}) for relevant link: {link_url}")
            filepath = None
            if is_arxiv_url_check(link_url):
                arxiv_id = extract_arxiv_id_from_url(link_url)
                if arxiv_id:
                    filepath = download_arxiv_pdf_resource(arxiv_id, output_folder)
                else: # Fallback if ID extraction fails but domain is arXiv
                    print(f"Could not extract arXiv ID from {link_url}, attempting general download.")
                    filepath = download_general_pdf_resource(link_url, output_folder, filename_base=f"arxiv_fallback_{query_idx}_")
            elif is_pdf_url(link_url): # General PDF link
                filepath = download_general_pdf_resource(link_url, output_folder, filename_base=f"doc_{query_idx}_")
            else:
                print(f"Skipping non-PDF or non-arXiv link: {link_url}")

            if filepath and filepath not in downloaded_files: # Ensure it was actually downloaded and not a duplicate filepath
                downloaded_files.append(filepath)
            
            time.sleep(random.uniform(1,3)) # Small delay between downloads

    print(f"\n--- Download Process Finished ---")
    print(f"Total PDFs successfully downloaded: {len(downloaded_files)}")
    for fpath in downloaded_files:
        print(f"- {fpath}")
    return downloaded_files