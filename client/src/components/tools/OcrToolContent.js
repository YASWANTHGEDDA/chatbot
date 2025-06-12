// client/src/components/tools/OcrToolContent.js
import React, { useState, useEffect } from 'react';
import { ocrPdfWithTesseract, ocrPdfWithNougat, getProxiedFileDownloadUrl } from '../../services/api'; // Adjust path if needed
// import './OcrTool.css'; // Create this CSS file for styling

const OcrToolContent = ({ onOcrComplete, initialData }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedFileName, setSelectedFileName] = useState('');
    const [ocrEngine, setOcrEngine] = useState('tesseract'); // 'tesseract' or 'nougat'
    
    // State to store the direct API response for display within this panel
    // { message, markdown_file (server path), download_link (relative for proxy), content_preview, error }
    const [panelOcrResult, setPanelOcrResult] = useState(null); 
    
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Reset state if initialData changes (though less common for this tool)
    useEffect(() => {
        setSelectedFile(null);
        setSelectedFileName('');
        setOcrEngine(initialData?.ocrEngine || 'tesseract');
        setPanelOcrResult(null);
        setError('');
    }, [initialData]);

    const handleFileChange = (event) => {
        const file = event.target.files[0];
        if (file) {
            if (file.type === "application/pdf") {
                setSelectedFile(file);
                setSelectedFileName(file.name);
                setPanelOcrResult(null); // Clear previous results
                setError('');
            } else {
                setSelectedFile(null);
                setSelectedFileName('');
                setError('Please select a valid PDF file.');
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            setError('Please select a PDF file to OCR.');
            return;
        }
        setIsLoading(true);
        setError('');
        setPanelOcrResult(null);

        try {
            let response;
            console.log(`OCR Tool: Submitting ${selectedFile.name} with engine ${ocrEngine}`);
            if (ocrEngine === 'tesseract') {
                response = await ocrPdfWithTesseract(selectedFile);
            } else { // nougat
                response = await ocrPdfWithNougat(selectedFile);
            }
            
            console.log(`OCR Tool: API Response from ${ocrEngine}:`, response);
            setPanelOcrResult(response); // Store full response for panel display

            // Pass structured data back to ChatPage
            onOcrComplete({
                engine: ocrEngine,
                original_filename: selectedFile.name,
                message: response.message,
                markdown_file_server_path: response.markdown_file, // Server path for reference
                // download_link_relative is the path part for getProxiedFileDownloadUrl
                // e.g., "ocr_tesseract_output/filename.md"
                download_link_relative: response.download_link?.replace('/files/', ''), 
                content_preview: response.content_preview,
                error: null
            });

        } catch (err) {
            console.error(`OCR Tool: Error with ${ocrEngine}:`, err);
            const errorMessage = err.message || `Failed to perform OCR with ${ocrEngine}.`;
            setError(errorMessage);
            setPanelOcrResult({ message: errorMessage, error: true }); // Update panel display
            onOcrComplete({ 
                engine: ocrEngine, 
                original_filename: selectedFile?.name || "unknown_file",
                error: errorMessage 
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="tool-content-panel ocr-tool-content">
            <h3>PDF OCR Tool</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="ocrPdfFile">Select PDF:</label>
                    <input 
                        type="file" 
                        id="ocrPdfFile" 
                        accept=".pdf" 
                        onChange={handleFileChange} 
                        disabled={isLoading}
                    />
                    {selectedFileName && <p className="file-name-display">Selected: {selectedFileName}</p>}
                </div>
                <div className="form-group">
                    <label htmlFor="ocrEngineSelect">OCR Engine:</label>
                    <select 
                        id="ocrEngineSelect" 
                        value={ocrEngine} 
                        onChange={(e) => setOcrEngine(e.target.value)}
                        disabled={isLoading}
                    >
                        <option value="tesseract">Tesseract (General Purpose)</option>
                        <option value="nougat">Nougat (Academic Papers/Math)</option>
                    </select>
                </div>
                <button type="submit" disabled={isLoading || !selectedFile} style={{ marginTop: '10px' }}>
                    {isLoading ? `Processing with ${ocrEngine}...` : `Run OCR with ${ocrEngine}`}
                </button>
            </form>

            {error && <p className="error-message">{error}</p>}

            {panelOcrResult && !error && ( // Show results in panel only if no major error during API call
                <div className="results-section" style={{marginTop: '20px'}}>
                    <h4>Panel OCR Result: {panelOcrResult.message}</h4>
                    {panelOcrResult.download_link_relative && panelOcrResult.markdown_file_server_path && (
                        <p>
                            <a 
                                href={getProxiedFileDownloadUrl(panelOcrResult.download_link_relative)} 
                                download={panelOcrResult.markdown_file_server_path.split(/[\\/]/).pop()} // Suggest filename
                                target="_blank" rel="noopener noreferrer"
                                title={`Download OCR output for ${selectedFileName}`}
                            >
                                Download Markdown File ({panelOcrResult.markdown_file_server_path.split(/[\\/]/).pop()})
                            </a>
                        </p>
                    )}
                    {panelOcrResult.content_preview && (
                        <div>
                            <h5>Content Preview (first 1000 chars):</h5>
                            <pre className="ocr-preview-box">
                                {panelOcrResult.content_preview}
                            </pre>
                        </div>
                    )}
                     {!panelOcrResult.download_link_relative && !panelOcrResult.content_preview && panelOcrResult.message && (
                        <p>OCR process completed. {panelOcrResult.message.includes("successful") ? "Output might be available on server." : "No downloadable content."}</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default OcrToolContent;