// client/src/components/tools/MarkdownToDocToolContent.js
import React, { useState, useEffect } from 'react';
import { createDocumentFromMarkdown, getProxiedFileDownloadUrl } from '../../services/api';
import '../MarkdownToOfficeTool.css'; // Can reuse or adapt CSS

const MarkdownToDocToolContent = ({ onDocGenerated, initialData }) => {
    const [markdown, setMarkdown] = useState(initialData?.markdown || 
`### Document Title
This is content for the document.

**Author Notes:**
*   Note 1 for conversion.
*   Note 2 for conversion.

**Image Prompts:**
*   An image of a serene landscape.
`
    );
    const [filename, setFilename] = useState(initialData?.filename || 'MyGeneratedDocument.docx');
    const [contentKey, setContentKey] = useState(initialData?.contentKey || 'author_notes'); // 'author_notes', 'image_prompt', 'text_content'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setMarkdown(initialData?.markdown || '');
        setFilename(initialData?.filename || 'MyGeneratedDocument.docx');
        setContentKey(initialData?.contentKey || 'author_notes');
        setError('');
    }, [initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!markdown.trim()) {
            setError('Markdown content cannot be empty.');
            return;
        }
        if (!filename.trim().toLowerCase().endsWith('.docx')) {
            setError('Filename must end with .docx');
            return;
        }
        if (!contentKey) {
            setError('Please select a content key for DOCX generation.');
            return;
        }
        setIsLoading(true);
        setError('');

        try {
            const response = await createDocumentFromMarkdown(markdown, contentKey, filename.trim());
            // response: { message, filepath, download_link (relative path) }
            onDocGenerated({
                ...response, // Pass through message, filepath
                download_link_relative: response.download_link.replace('/files/', ''), // Ensure it's just the relative part
                error: null
            });
        } catch (err) {
            console.error("DOCX creation error:", err);
            const errorMessage = err.message || 'Failed to create document.';
            setError(errorMessage);
            onDocGenerated({ error: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="tool-content-panel markdown-to-office-tool">
            <h3>Markdown to DOCX</h3>
            <form onSubmit={handleSubmit}>
                <div>
                    <label htmlFor="docFilename">Output Filename (.docx):</label>
                    <input
                        type="text"
                        id="docFilename"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value || 'MyGeneratedDocument.docx')}
                        required
                    />
                </div>
                <div>
                    <label htmlFor="docContentKey">Content Key for DOCX:</label>
                    <select 
                        id="docContentKey" 
                        value={contentKey} 
                        onChange={(e) => setContentKey(e.target.value)}
                        required
                    >
                        <option value="author_notes">Author Notes</option>
                        <option value="image_prompt">Image Prompts</option>
                        <option value="text_content">Slide Text Content</option>
                        {/* Add other keys if your md_to_office.py supports them */}
                    </select>
                </div>
                <div>
                    <label htmlFor="markdownContentDoc">Markdown Content:</label>
                    <textarea
                        id="markdownContentDoc"
                        value={markdown}
                        onChange={(e) => setMarkdown(e.target.value)}
                        rows="15"
                        placeholder="Enter Markdown content with sections like **Author Notes:**, **Image Prompt:** etc."
                        required
                    />
                </div>
                <button type="submit" disabled={isLoading} style={{ marginTop: '15px' }}>
                    {isLoading ? 'Generating DOCX...' : 'Generate DOCX'}
                </button>
            </form>
            {error && <p className="error-message">{error}</p>}
        </div>
    );
};

export default MarkdownToDocToolContent;