// // client/src/components/MarkdownToPptTool.js
// import React, { useState } from 'react';
// import { createPresentationFromMarkdown, getProxiedFileDownloadUrl } from '../../services/api';
// import '../MarkdownToOfficeTool.css'; // Assuming shared or specific CSS

// const MarkdownToPptTool = () => {
//     const [markdown, setMarkdown] = useState(
// `### Slide 1: My Presentation Title
// **Slide Text Content:**
// * Welcome to this presentation.
// * This slide introduces the main topic.
//     * Sub-point A
//     * Sub-point B

// ---
// ### Slide 2: Key Concepts
// **Slide Text Content:**
// * Concept 1: Explanation.
// * Concept 2: Further details.
// * **Important:** A bolded statement.

// **Image Prompt:** a futuristic cityscape

// ---
// ### Slide 3: Conclusion
// **Slide Text Content:**
// * Summary of points.
// * Call to action.

// **Author Notes for Slide 3:**
// Remember to thank the audience.`
//     );
//     const [filename, setFilename] = useState('MyGeneratedPresentation.pptx');
//     const [isLoading, setIsLoading] = useState(false);
//     const [error, setError] = useState('');
//     const [downloadInfo, setDownloadInfo] = useState(null); // To store { link, name }

//     const handleSubmit = async (e) => {
//         e.preventDefault();
//         if (!markdown.trim()) {
//             setError('Markdown content cannot be empty.');
//             return;
//         }
//         if (!filename.trim().toLowerCase().endsWith('.pptx')) {
//             setError('Filename must end with .pptx');
//             return;
//         }
//         setIsLoading(true);
//         setError('');
//         setDownloadInfo(null);

//         try {
//             const response = await createPresentationFromMarkdown(markdown, filename.trim());
//             // response should be like: { message, filepath, download_link (relative path from Python like "generated_pptx/filename.pptx") }
//             if (response.download_link) {
//                 setDownloadInfo({
//                     link: getProxiedFileDownloadUrl(response.download_link.replace('/files/', '')), // Construct full URL for client
//                     name: filename.trim()
//                 });
//             } else {
//                 setError('Failed to get download link from server. PPT might have been created on server.');
//                 console.warn("PPT Server Response (no download_link):", response.message, response.filepath)
//             }
//             console.log('PPT Creation Response:', response);
//         } catch (err) {
//             console.error("PPT creation error:", err);
//             setError(err.message || 'Failed to create presentation. Check console and server logs.');
//         } finally {
//             setIsLoading(false);
//         }
//     };

//     return (
//         <div className="markdown-to-office-tool">
//             <h2>Markdown to PowerPoint</h2>
//             <form onSubmit={handleSubmit}>
//                 <div>
//                     <label htmlFor="pptFilename">Output Filename (.pptx):</label>
//                     <input
//                         type="text"
//                         id="pptFilename"
//                         value={filename}
//                         onChange={(e) => setFilename(e.target.value || 'MyGeneratedPresentation.pptx')}
//                         required
//                     />
//                 </div>
//                 <div>
//                     <label htmlFor="markdownContentPpt">Markdown Content:</label>
//                     <textarea
//                         id="markdownContentPpt"
//                         value={markdown}
//                         onChange={(e) => setMarkdown(e.target.value)}
//                         rows="20"
//                         placeholder="Enter your slide content in Markdown format..."
//                         required
//                     />
//                 </div>
//                 <button type="submit" disabled={isLoading} style={{ marginTop: '15px' }}>
//                     {isLoading ? 'Generating PPTX...' : 'Generate PPTX'}
//                 </button>
//             </form>

//             {error && <p className="error-message">{error}</p>}
//             {downloadInfo && downloadInfo.link && (
//                 <div className="download-section">
//                     <p>Presentation generated successfully!</p>
//                     <a href={downloadInfo.link} download={downloadInfo.name} target="_blank" rel="noopener noreferrer">
//                         Download {downloadInfo.name}
//                     </a>
//                 </div>
//             )}
//         </div>
//     );
// };

// export default MarkdownToPptTool;

// client/src/components/tools/MarkdownToPptTool.js
import React, { useState } from 'react';
import { createPresentationFromMarkdown, getProxiedFileDownloadUrl } from '../../services/api'; // Adjust path if needed
import '../MarkdownToOfficeTool.css'; // Assuming this CSS file exists and has relevant styles
// If not, you can create it or rely on ToolsGlobal.css and component-specific styles below

const MarkdownToPptTool = ({ onPptGenerated }) => { // Added onPptGenerated prop for consistency with other tools
    const [markdown, setMarkdown] = useState(
`### Slide 1: My Presentation Title
**Slide Text Content:**
* Welcome to this presentation.
* This slide introduces the main topic.
    * Sub-point A
    * Sub-point B

---
### Slide 2: Key Concepts
**Slide Text Content:**
* Concept 1: Explanation.
* Concept 2: Further details.
* **Important:** A bolded statement.

**Image Prompt:** a futuristic cityscape (Note: Image prompt processing is not part of this component's direct functionality)

---
### Slide 3: Conclusion
**Slide Text Content:**
* Summary of points.
* Call to action.

**Author Notes for Slide 3:**
Remember to thank the audience.`
    );
    const [filename, setFilename] = useState('MyGeneratedPresentation.pptx');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [apiResult, setApiResult] = useState(null); // To store the full API response

    // Helper function to trigger browser download
    const triggerDownload = (url, downloadFilename) => {
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', downloadFilename || 'download.pptx');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        console.log(`Download triggered for ${downloadFilename} from ${url}`);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!markdown.trim()) {
            setError('Markdown content cannot be empty.');
            return;
        }
        const trimmedFilename = filename.trim();
        if (!trimmedFilename.toLowerCase().endsWith('.pptx')) {
            setError('Filename must end with .pptx');
            // setFilename(trimmedFilename + '.pptx'); // Optionally auto-correct
            return;
        }
        setFilename(trimmedFilename); // Update state with trimmed filename

        setIsLoading(true);
        setError('');
        setApiResult(null);

        try {
            // createPresentationFromMarkdown(markdownContent, filename)
            const response = await createPresentationFromMarkdown(markdown, trimmedFilename);
            console.log('MarkdownToPptTool: API Response data:', response.data);
            setApiResult(response.data); // Store the full response data

            if (response.data && response.data.status === 'success' && 
                response.data.download_links_relative && response.data.download_links_relative.length > 0) {
                
                const relativePath = response.data.download_links_relative[0];
                const downloadUrl = getProxiedFileDownloadUrl(relativePath);
                const actualFilenameFromServer = response.data.filename || trimmedFilename; // Prefer filename from response

                if (downloadUrl) {
                    console.log(`MarkdownToPptTool: Triggering auto-download for ${actualFilenameFromServer} from ${downloadUrl}`);
                    triggerDownload(downloadUrl, actualFilenameFromServer);
                } else {
                    console.error("MarkdownToPptTool: Could not construct download URL from relative path:", relativePath);
                    setError('PPT generated, but an issue occurred with the download link.');
                }
            } else if (response.data && response.data.error) {
                setError(response.data.error + (response.data.details ? ` Details: ${response.data.details}` : ''));
            } else {
                setError('Failed to generate PPT or get a valid download link from the server.');
                console.warn("MarkdownToPptTool: Server response missing expected success data:", response.data);
            }

            if (onPptGenerated) { // Callback for parent component (e.g., ToolsView)
                onPptGenerated(response.data);
            }

        } catch (err) {
            console.error("MarkdownToPptTool: handleSubmit error:", err);
            const message = err.response?.data?.python_error || err.response?.data?.message || err.message || 'Failed to create presentation.';
            setError(message);
            setApiResult({ status: 'error', error: message, details: err.response?.data?.details });
            if (onPptGenerated) {
                onPptGenerated({ status: 'error', error: message, details: err.response?.data?.details });
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        // Use .tool-form-container for consistency if ToolsGlobal.css provides it
        // Or .markdown-to-office-tool if MarkdownToOfficeTool.css defines the layout
        <div className="markdown-to-ppt-tool tool-form-container">
            <h3 className="tool-title">Markdown to PowerPoint</h3> {/* Uses .tool-title from global CSS */}
            <form onSubmit={handleSubmit}>
                <div className="form-group"> {/* Uses .form-group from global CSS */}
                    <label htmlFor="pptFilename">Output Filename:</label>
                    <input
                        type="text"
                        id="pptFilename"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                        placeholder="MyPresentation.pptx"
                        required
                        disabled={isLoading}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="markdownContentPpt">Markdown Content:</label>
                    <textarea
                        id="markdownContentPpt"
                        value={markdown}
                        onChange={(e) => setMarkdown(e.target.value)}
                        rows="15" // Reduced rows for better fit with results
                        placeholder="Enter your slide content in Markdown format..."
                        required
                        disabled={isLoading}
                        style={{ fontFamily: 'monospace', minHeight: '250px', lineHeight: '1.5' }} // Added line-height
                    />
                </div>
                <button type="submit" disabled={isLoading} style={{ marginTop: '10px' }}>
                    {isLoading ? 'Generating PPTX...' : 'Generate & Download PPTX'}
                </button>
            </form>

            {isLoading && (
                <div className="loading-spinner-container" style={{marginTop: '15px'}}>
                    <div className="loader"></div>
                    <span style={{marginLeft: '10px'}}>Generating your presentation...</span>
                </div>
            )}

            {error && !isLoading && (
                <div className="error-message" style={{marginTop: '15px'}}>
                    Error: {error}
                </div>
            )}

            {/* Display success message and a manual download link as a fallback */}
            {!isLoading && apiResult && apiResult.status === 'success' && (
                <div className="results-section" style={{marginTop: '15px'}}>
                    <h4 className="results-title">{apiResult.message || "Presentation generated successfully!"}</h4>
                    {apiResult.download_links_relative && apiResult.download_links_relative.length > 0 && (
                        <p>
                            If your download didn't start automatically, you can
                            <a
                                href={getProxiedFileDownloadUrl(apiResult.download_links_relative[0])}
                                download={apiResult.filename || filename}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ marginLeft: '5px', fontWeight: 'bold' }}
                            >
                                click here to download {apiResult.filename || filename}.
                            </a>
                        </p>
                    )}
                </div>
            )}
            {!isLoading && apiResult && apiResult.status === 'error' && apiResult.error && !error && (
                 <div className="error-message" style={{marginTop: '15px'}}> {/* General error if not caught by setError directly */}
                    Generation Failed: {apiResult.error}
                    {apiResult.details && <><br/>Details: {apiResult.details}</>}
                </div>
            )}
        </div>
    );
};

export default MarkdownToPptTool;