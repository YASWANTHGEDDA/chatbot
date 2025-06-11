import React, { useState, useEffect } from 'react';
import { downloadWebPdfs, getProxiedFileDownloadUrl } from '../../services/api'; // Ensure api.js has downloadWebPdfs
import './WebPdfDownloaderTool.css'; // Make sure you create/update this CSS file

const WebPdfDownloaderToolContent = ({ onPdfsDownloaded, initialData }) => {
    const [query, setQuery] = useState(initialData?.query || '');
    const [maxDownloads, setMaxDownloads] = useState(initialData?.maxDownloads || 3); // Default to 3
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    // State to hold the direct response from the API for displaying within the panel
    const [panelDisplayInfo, setPanelDisplayInfo] = useState(null);

    useEffect(() => {
        // Reset when the panel is effectively re-opened or initialData changes
        setQuery(initialData?.query || '');
        setMaxDownloads(initialData?.maxDownloads || 3);
        setPanelDisplayInfo(null); // Clear previous panel results
        setError('');
    }, [initialData]); // Assuming initialData might change if panel is re-used with new context

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!query.trim()) {
            setError('Please enter a search query for PDFs.');
            return;
        }
        const maxDownloadsInt = parseInt(maxDownloads, 10);
        if (isNaN(maxDownloadsInt) || maxDownloadsInt < 1) {
            setError('Please enter a valid number for max downloads (at least 1).');
            return;
        }

        setIsLoading(true);
        setError('');
        setPanelDisplayInfo(null);

        try {
            // This 'response' is what comes back from your Node.js /api/external-ai-tools/download/web_pdfs
            // which in turn gets it from Python's /tools/download/web_pdfs
            // Expected structure: { message, downloaded_count, files: [server_paths...], download_links: [relative_proxy_paths...] }
            const response = await downloadWebPdfs(query, maxDownloadsInt);
            
            console.log("WebPdfDownloaderToolContent: API Response received:", response);
            setPanelDisplayInfo(response); // Store for display within this panel

            // Prepare data to pass back to ChatPage for chat message
            const filesForChat = response.files?.map((serverPath, index) => {
                const filename = serverPath.split(/[\\/]/).pop();
                // response.download_links[index] should be like "/files/downloaded_pdfs/some_file.pdf"
                // getProxiedFileDownloadUrl expects the part after "/files/", e.g., "downloaded_pdfs/some_file.pdf"
                const relativePathForProxy = response.download_links?.[index]?.replace('/files/', '');
                
                return {
                    name: filename,
                    link: relativePathForProxy ? getProxiedFileDownloadUrl(relativePathForProxy) : '#'
                };
            }) || [];

            onPdfsDownloaded({
                query: query,
                downloaded_count: response.downloaded_count || 0,
                files_with_links: filesForChat, // This is the array of {name, link}
                error: null
            });

        } catch (err) {
            console.error("Web PDF download error in WebPdfDownloaderToolContent:", err);
            const errorMessage = err.message || 'Failed to download PDFs from the web.';
            setError(errorMessage);
            setPanelDisplayInfo({ message: errorMessage, downloaded_count: 0, files: [] }); // Update panel display on error
            onPdfsDownloaded({ query: query, downloaded_count: 0, files_with_links: [], error: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="tool-content-panel web-pdf-downloader-tool">
            <h3>Web PDF Downloader</h3>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="pdfDownloaderQuery">Search Query for PDFs:</label>
                    <input
                        type="text"
                        id="pdfDownloaderQuery" // Unique ID
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="e.g., machine learning textbook pdf"
                        required
                        disabled={isLoading}
                    />
                </div>
                <div>
                    <label htmlFor="pdfDownloaderMaxDownloads">Max Downloads:</label>
                    <input
                        type="number"
                        id="pdfDownloaderMaxDownloads" // Unique ID
                        value={maxDownloads}
                        min="1"
                        max="20" // A reasonable upper limit for UI
                        onChange={(e) => setMaxDownloads(e.target.value)}
                        required
                        disabled={isLoading}
                    />
                </div>
                <button type="submit" disabled={isLoading} style={{ marginTop: '15px' }}>
                    {isLoading ? 'Searching & Downloading...' : 'Download PDFs'}
                </button>
            </form>

            {error && <p className="error-message">{error}</p>}

            {panelDisplayInfo && (
                <div className="results-section" style={{marginTop: '20px'}}>
                    <h4>Panel Results: {panelDisplayInfo.message}</h4>
                    {panelDisplayInfo.downloaded_count > 0 && panelDisplayInfo.files && panelDisplayInfo.files.length > 0 && (
                        <>
                            <p>Processed: {panelDisplayInfo.downloaded_count} PDF(s) by the server.</p>
                            <p>Files available for download (via server proxy):</p>
                            <ul>
                                {panelDisplayInfo.files.map((serverPath, index) => {
                                    const filename = serverPath.split(/[\\/]/).pop();
                                    const relativeProxyPath = panelDisplayInfo.download_links?.[index]?.replace('/files/', '');
                                    const downloadLink = relativeProxyPath ? getProxiedFileDownloadUrl(relativeProxyPath) : null;
                                    
                                    return (
                                        <li key={serverPath + index}> {/* Use a more unique key */}
                                            {filename}
                                            {downloadLink && downloadLink !== '#' ? (
                                                <a 
                                                    href={downloadLink} 
                                                    download={filename} // Suggests filename to browser
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    style={{ marginLeft: '10px' }}
                                                    title={`Download ${filename} (from server path: ${serverPath})`}
                                                >
                                                    (Download)
                                                </a>
                                            ) : (
                                                <span style={{ marginLeft: '10px', color: '#888' }}>(Link not available)</span>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                    {panelDisplayInfo.downloaded_count === 0 && !error && (
                         <p>No PDFs were downloaded based on your query and limits.</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default WebPdfDownloaderToolContent; 