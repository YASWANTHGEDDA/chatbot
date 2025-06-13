// client/src/components/tools/MarkdownToDocToolContent.js
import React, { useState } from 'react';
import { createDocumentFromMarkdown, getProxiedFileDownloadUrl } from '../../services/api'; // Adjust as per your api.js
import '../MarkdownToOfficeTool.css'; // Or a specific CSS file

const MarkdownToDocToolContent = ({ onDocGenerated }) => {
    const [markdown, setMarkdown] = useState(
`### Slide 1: My Document Title
**Content Key (e.g., Author Notes):**
This is some sample content for the selected key.

---
### Slide 2: Another Section
**Content Key (e.g., Author Notes):**
More notes here.`
    );
    const [filename, setFilename] = useState('MyGeneratedDocument.docx');
    const [contentKey, setContentKey] = useState('author_notes'); // Default or from a select dropdown
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [apiResult, setApiResult] = useState(null);

    const triggerDownload = (url, downloadFilename) => {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', downloadFilename || 'document.docx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setApiResult(null);

        // --- START: Robust filename and input handling ---
        const currentFilename = String(filename || '').trim(); // Ensure filename is a string and trim
        const currentMarkdown = String(markdown || '').trim(); // Ensure markdown is a string and trim

        if (!currentMarkdown) {
            setError('Markdown content cannot be empty.');
            return;
        }
        if (!currentFilename) {
            setError('Output filename cannot be empty.');
            return;
        }
        if (!currentFilename.toLowerCase().endsWith('.docx')) {
            setError('Filename must end with .docx');
            return;
        }
        // Ensure contentKey is valid
        if (!contentKey) {
            setError('Please select a Content Key for the DOCX.');
            return;
        }
        // --- END: Robust filename and input handling ---

        setIsLoading(true);

        try {
            // Pass the validated and trimmed filename
            const response = await createDocumentFromMarkdown(currentMarkdown, contentKey, currentFilename);
            console.log('MarkdownToDocToolContent: API Response data:', response.data);
            setApiResult(response.data);

            if (response.data && response.data.status === 'success' &&
                response.data.download_links_relative && response.data.download_links_relative.length > 0) {
                
                const relativePath = response.data.download_links_relative[0];
                const downloadUrl = getProxiedFileDownloadUrl(relativePath);
                const actualFilenameFromServer = response.data.filename || currentFilename;

                if (downloadUrl) {
                    triggerDownload(downloadUrl, actualFilenameFromServer);
                } else {
                    setError('DOCX generated, but an issue occurred with the download link.');
                }
            } else if (response.data && response.data.error) {
                setError(response.data.error + (response.data.details ? ` Details: ${response.data.details}` : ''));
            } else {
                setError('Failed to generate DOCX or get a valid download link.');
            }

            if (onDocGenerated) {
                onDocGenerated(response.data);
            }

        } catch (err) { // This is where your screenshot showed the error being caught
            console.error("MarkdownToDocToolContent.js: DOCX creation error:", err);
            // The 'err' object itself IS the error. err.message gives the "Cannot read..." part.
            setError(err.message || 'Failed to create document.');
            
            const errorForParent = { 
                status: 'error', 
                error: err.message || 'Failed to create document.' 
                // You might not have err.response.data.details if the error is client-side like this TypeError
            };
            setApiResult(errorForParent);
            if (onDocGenerated) {
                onDocGenerated(errorForParent);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="markdown-to-doc-tool tool-form-container"> {/* Add your specific class if needed */}
            <h3 className="tool-title">Markdown to DOCX</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="docFilename">Output Filename (.docx):</label>
                    <input
                        type="text"
                        id="docFilename"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        placeholder="MyGeneratedDocument.docx"
                        required
                        disabled={isLoading}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="docContentKey">Content Key for DOCX:</label>
                    <select
                        id="docContentKey"
                        value={contentKey}
                        onChange={(e) => setContentKey(e.target.value)}
                        required
                        disabled={isLoading}
                    >
                        <option value="text_content">Slide Text Content</option>
                        <option value="author_notes">Author Notes</option>
                        <option value="image_prompt">Image Prompts</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="markdownContentDoc">Markdown Content:</label>
                    <textarea
                        id="markdownContentDoc"
                        value={markdown}
                        onChange={(e) => setMarkdown(e.target.value)}
                        rows="15"
                        placeholder="Enter your slide content in Markdown format..."
                        required
                        disabled={isLoading}
                        style={{ fontFamily: 'monospace', minHeight: '200px', lineHeight: '1.5' }}
                    />
                </div>
                <button type="submit" disabled={isLoading} style={{ marginTop: '10px' }}>
                    {isLoading ? 'Generating DOCX...' : 'Generate & Download DOCX'}
                </button>
            </form>

            {isLoading && <div className="loading-spinner-container" style={{marginTop: '15px'}}><div className="loader"></div> Processing...</div>}
            
            {error && !isLoading && (
                <div className="error-message" style={{marginTop: '15px'}}>Error: {error}</div>
            )}

            {!isLoading && apiResult && (
                <div className="results-section" style={{ marginTop: '15px' }}>
                    {apiResult.status === 'success' ? (
                        <>
                            <h4 className="results-title">{apiResult.message || "Document generated successfully!"}</h4>
                            {apiResult.download_links_relative && apiResult.download_links_relative.length > 0 && (
                                <p>
                                    If download didn't start:
                                    <a
                                        href={getProxiedFileDownloadUrl(apiResult.download_links_relative[0])}
                                        download={apiResult.filename || filename}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ marginLeft: '5px', fontWeight: 'bold' }}
                                    >
                                        Download {apiResult.filename || filename}
                                    </a>
                                </p>
                            )}
                        </>
                    ) : apiResult.error && (
                        <div className="error-message">
                            Generation Failed: {apiResult.error}
                            {apiResult.details && <><br />Details: {apiResult.details}</>}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MarkdownToDocToolContent;