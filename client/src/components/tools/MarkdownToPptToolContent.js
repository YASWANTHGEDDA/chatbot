// client/src/components/MarkdownToPptTool.js
import React, { useState } from 'react';
import { createPresentationFromMarkdown, getProxiedFileDownloadUrl } from '../../services/api';
import '../MarkdownToOfficeTool.css'; // Assuming shared or specific CSS

const MarkdownToPptTool = () => {
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

**Image Prompt:** a futuristic cityscape

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
    const [downloadInfo, setDownloadInfo] = useState(null); // To store { link, name }

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!markdown.trim()) {
            setError('Markdown content cannot be empty.');
            return;
        }
        if (!filename.trim().toLowerCase().endsWith('.pptx')) {
            setError('Filename must end with .pptx');
            return;
        }
        setIsLoading(true);
        setError('');
        setDownloadInfo(null);

        try {
            const response = await createPresentationFromMarkdown(markdown, filename.trim());
            // response should be like: { message, filepath, download_link (relative path from Python like "generated_pptx/filename.pptx") }
            if (response.download_link) {
                setDownloadInfo({
                    link: getProxiedFileDownloadUrl(response.download_link.replace('/files/', '')), // Construct full URL for client
                    name: filename.trim()
                });
            } else {
                setError('Failed to get download link from server. PPT might have been created on server.');
                console.warn("PPT Server Response (no download_link):", response.message, response.filepath)
            }
            console.log('PPT Creation Response:', response);
        } catch (err) {
            console.error("PPT creation error:", err);
            setError(err.message || 'Failed to create presentation. Check console and server logs.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="markdown-to-office-tool">
            <h2>Markdown to PowerPoint</h2>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="pptFilename">Output Filename (.pptx):</label>
                    <input
                        type="text"
                        id="pptFilename"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value || 'MyGeneratedPresentation.pptx')}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="markdownContentPpt">Markdown Content:</label>
                    <textarea
                        id="markdownContentPpt"
                        value={markdown}
                        onChange={(e) => setMarkdown(e.target.value)}
                        rows="20"
                        placeholder="Enter your slide content in Markdown format..."
                        required
                    />
                </div>
                <button type="submit" disabled={isLoading} style={{ marginTop: '15px' }}>
                    {isLoading ? 'Generating PPTX...' : 'Generate PPTX'}
                </button>
            </form>

            {error && <p className="error-message">{error}</p>}
            {downloadInfo && downloadInfo.link && (
                <div className="download-section">
                    <p>Presentation generated successfully!</p>
                    <a href={downloadInfo.link} download={downloadInfo.name} target="_blank" rel="noopener noreferrer">
                        Download {downloadInfo.name}
                    </a>
                </div>
            )}
        </div>
    );
};

export default MarkdownToPptTool;