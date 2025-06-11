# modules/pdf_processing/ocr_tesseract.py
import pytesseract
from pdf2image import convert_from_path, exceptions as pdf2image_exceptions
import os

def convert_pdf_to_markdown_tesseract(pdf_path, output_md_path, tesseract_cmd_path=None, poppler_path=None):
    """
    Converts a PDF (image-based or text-based) to a Markdown file using Tesseract OCR.

    Args:
        pdf_path (str): The file path to the input PDF.
        output_md_path (str): The file path for the output Markdown file.
        tesseract_cmd_path (str, optional): Path to the Tesseract executable. 
                                           Needed if not in system PATH.
        poppler_path (str, optional): Path to the Poppler 'bin' directory.
                                      Needed on Windows if Poppler is not in PATH.

    Returns:
        bool: True if conversion was successful, False otherwise.
    """
    if tesseract_cmd_path:
        pytesseract.pytesseract.tesseract_cmd = tesseract_cmd_path

    if not os.path.exists(pdf_path):
        print(f"Error: The file '{pdf_path}' was not found.")
        return False

    print(f"Starting Tesseract OCR conversion for '{pdf_path}'...")

    try:
        if poppler_path:
            images = convert_from_path(pdf_path, poppler_path=poppler_path)
        else:
            images = convert_from_path(pdf_path)
    except pdf2image_exceptions.PDFInfoNotInstalledError:
        print("Error: Poppler not found. Please install Poppler and/or provide poppler_path.")
        print("On Linux: sudo apt-get install poppler-utils")
        print("On macOS: brew install poppler")
        print("On Windows: Download Poppler, extract, and add its /bin to PATH or provide poppler_path.")
        return False
    except pdf2image_exceptions.PDFPageCountError:
        print(f"Error: Could not get page count for PDF '{pdf_path}'. File might be corrupted or empty.")
        return False
    except Exception as e:
        print(f"Error converting PDF to images: {e}")
        return False

    if not images:
        print(f"No images extracted from '{pdf_path}'. PDF might be empty or unreadable.")
        return False

    full_markdown_text = ""
    total_pages = len(images)
    
    print(f"Found {total_pages} pages to process with Tesseract.")

    for i, page_image in enumerate(images):
        print(f"Processing page {i + 1}/{total_pages} with Tesseract...")
        
        try:
            # Use pytesseract.image_to_string to get text
            text = pytesseract.image_to_string(page_image, lang='eng') # Specify language if needed
            
            full_markdown_text += text
            
            # Add a Markdown horizontal rule between pages for clarity
            if i < total_pages - 1:
                full_markdown_text += "\n\n---\n\n"
                
        except pytesseract.TesseractNotFoundError:
            print("Tesseract Error: The Tesseract executable was not found or not configured correctly.")
            print("Please ensure Tesseract is installed and its path is set via tesseract_cmd_path or system PATH.")
            return False
        except Exception as e:
            print(f"An error occurred during Tesseract OCR on page {i+1}: {e}")
            # Optionally continue to next page or return False
            # For now, let's be strict and return False
            return False

    try:
        os.makedirs(os.path.dirname(output_md_path), exist_ok=True)
        with open(output_md_path, "w", encoding="utf-8") as md_file:
            md_file.write(full_markdown_text)
        print(f"Successfully converted PDF to Markdown (using Tesseract): '{output_md_path}'")
        return True
    except Exception as e:
        print(f"Error writing Tesseract OCR output to file '{output_md_path}': {e}")
        return False