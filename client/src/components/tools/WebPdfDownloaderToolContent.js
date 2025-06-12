// client/src/components/tools/WebPdfDownloaderToolContent.js
import React, { useState } from 'react';
import { downloadWebPdfs, getProxiedFileDownloadUrl } from '../../services/api';
import './WebPdfDownloaderTool.css'; // Import the specific CSS

const WebPdfDownloaderToolContent = ({ onPdfsDownloaded }) => {
    const [query, setQuery] = useState('');
    const [maxDownloads, setMaxDownloads] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [apiResult, setApiResult] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setApiResult(null);

        try {
            const response = await downloadWebPdfs(query, parseInt(maxDownloads, 10));
            console.log("WebPdfDownloaderToolContent: API response.data:", response.data);
            setApiResult(response.data);
            if (onPdfsDownloaded) {
                onPdfsDownloaded(response.data);
            }
        } catch (err) {
            console.error("WebPdfDownloaderToolContent: handleSubmit error:", err);
            const message = err.response?.data?.python_error || err.response?.data?.message || err.message || "An unknown error occurred.";
            setError(message); // Set general error for immediate feedback
            const errorResponse = { status: 'error', error: message, details: err.response?.data?.details, query: query, processed_count: 0, download_links_relative: [] };
            setApiResult(errorResponse); // Set detailed error in apiResult for the results section
            if (onPdfsDownloaded) {
                onPdfsDownloaded(errorResponse);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        // Add the specific class to the root div of this component
        <div className="web-pdf-downloader-content tool-form-container"> {/* Added web-pdf-downloader-content */}
            <h3 className="tool-title">Web PDF Downloader</h3>
            <form onSubmit={handleSubmit}>
                {/* Optional: For side-by-side layout on wider screens, wrap in a div with className="form-row" */}
                {/* <div className="form-row"> */}
                    <div className="form-group">
                        <label htmlFor="wpd-query">Search Query for PDFs:</label>
                        <input
                            type="text"
                            id="wpd-query"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="e.g., devops principles"
                            required
                            disabled={isLoading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="wpd-max-downloads">Max Downloads:</label>
                        <input
                            type="number"
                            id="wpd-max-downloads"
                            value={maxDownloads}
                            onChange={(e) => setMaxDownloads(e.target.value)}
                            min="1"
                            max="10"
                            required
                            disabled={isLoading}
                        />
                    </div>
                {/* </div> */}
                <button type="submit" disabled={isLoading}>
                    {isLoading ? 'Searching & Downloading...' : 'Download PDFs'}
                </button>
            </form>

            {isLoading && (
                <div className="loading-spinner-container">
                    <div className="loader"></div>
                    <span style={{marginLeft: '10px'}}>Processing your request...</span>
                </div>
            )}

            {/* Display general error if not loading and apiResult hasn't set its own error */}
            {error && !isLoading && !apiResult?.error && (
                 <div className="error-message" style={{marginTop: '15px'}}>
                    Operation Error: {error}
                </div>
            )}

            {/* Display results or specific error from API response, only if not loading */}
            {!isLoading && apiResult && (
                <div className="results-section" style={{ marginTop: '20px' }}>
                    {apiResult.status === 'success' ? (
                        <>
                            <h4 className="results-title">{apiResult.message || `Successfully processed files.`}</h4>
                            {apiResult.download_links_relative && apiResult.download_links_relative.length > 0 ? (
                                <>
                                    <p>Downloaded {apiResult.processed_count || apiResult.download_links_relative.length} PDF(s):</p>
                                    <ul>
                                        {apiResult.download_links_relative.map((relPath, index) => {
                                            const fullUrl = getProxiedFileDownloadUrl(relPath);
                                            let displayFilename = relPath;
                                            try {
                                                displayFilename = decodeURIComponent(relPath.substring(relPath.lastIndexOf('/') + 1));
                                            } catch (e) { /* Use raw path on decoding error */ }

                                            return (
                                                <li key={index}>
                                                    <a href={fullUrl} target="_blank" rel="noopener noreferrer" download={displayFilename}>
                                                        {/* Icon will be added by CSS ::before pseudo-element */}
                                                        {displayFilename}
                                                    </a>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </>
                            ) : (
                                <p>No PDF files were downloaded for this query, though the operation was successful.</p>
                            )}
                        </>
                    ) : apiResult.error ? (
                        <div className="error-message"> {/* Uses global error style */}
                            Download Failed: {apiResult.error}
                            {apiResult.details && <><br/>Details: {apiResult.details}</>}
                        </div>
                    ) : (
                        <div className="info-message">No results to display.</div> // Fallback if status is not success and no error
                    )}
                </div>
            )}
        </div>
    );
};

export default WebPdfDownloaderToolContent;