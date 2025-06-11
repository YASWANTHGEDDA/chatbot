// client/src/components/AnalysisResultModal.js (UPDATED)

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import './AnalysisResultModal.css';

// --- MODIFICATION START: Import the new MermaidDiagram component ---
import MermaidDiagram from './MermaidDiagram';
// --- MODIFICATION END ---

const AnalysisResultModal = ({ isOpen, onClose, analysisData }) => {
    if (!isOpen || !analysisData) {
        return null;
    }

    const { type, result, thinking, documentName } = analysisData;

    // --- MODIFICATION START: Create a helper function to render the result ---
    const renderResult = () => {
        // If the analysis type is 'mindmap' and we have a result, use our new component
        if (type === 'mindmap' && result) {
            
            // --- NEW CONVERTER LOGIC ---
            const convertMarkdownToMermaid = (markdown) => {
                const lines = markdown.split('\n');
                let mermaidSyntax = 'mindmap\n';
                
                lines.forEach(line => {
                    // Trim the line to handle potential leading/trailing spaces
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                        // Check if the line starts with a Markdown list character
                        if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
                            // Calculate indentation based on the original line's leading spaces
                            const indentation = ' '.repeat(line.search(/\S/)); // Number of leading spaces
                            const text = trimmedLine.substring(2); // Remove '- ' or '* '
                            mermaidSyntax += `${indentation}  ${text}\n`; // Add 2 extra spaces for Mermaid
                        } else {
                            // If it's not a list item, assume it's a root or other node
                            mermaidSyntax += `  ${trimmedLine}\n`;
                        }
                    }
                });
                return mermaidSyntax;
            };

            let chartText = result;

            // Check if the LLM followed instructions.
            if (!result.trim().startsWith('mindmap')) {
                console.warn("LLM failed to produce correct Mermaid syntax. Attempting to convert from Markdown.");
                // If not, try to convert the Markdown list it provided into Mermaid syntax.
                chartText = convertMarkdownToMermaid(result);
            }
            // --- END OF CONVERTER LOGIC ---

            console.log("--- FINAL MERMAID SYNTAX (after potential conversion) ---");
            console.log(chartText);
            console.log("-----------------------------------------------------");

            return <MermaidDiagram chart={chartText} />;
        }

        // For any other analysis type, use the existing Markdown renderer
        return (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result || "No analysis result provided."}
            </ReactMarkdown>
        );
    };
    // --- MODIFICATION END ---

    return (
        <div className="analysis-modal-overlay" onClick={onClose}>
            <div className="analysis-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="analysis-modal-header">
                    <h3>{type ? type.toUpperCase() : 'Analysis'} Results for: {documentName || 'Document'}</h3>
                    <button onClick={onClose} className="analysis-modal-close-btn">×</button>
                </div>
                <div className="analysis-modal-body">
                    {thinking && (
                        <details className="analysis-thinking-details">
                            <summary>Thinking Process</summary>
                            <pre className="analysis-thinking-text">{thinking}</pre>
                        </details>
                    )}
                    <h4>Analysis Output:</h4>
                    {/* --- MODIFICATION: Use our new render function --- */}
                    <div className="analysis-result-text">
                        {renderResult()}
                    </div>
                </div>
                <div className="analysis-modal-footer">
                    <button onClick={onClose}>Close</button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisResultModal;