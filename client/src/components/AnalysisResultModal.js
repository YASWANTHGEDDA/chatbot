// client/src/components/AnalysisResultModal.js
import React, { useState, useCallback, useEffect } from 'react'; // Import hooks
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FiX, FiCopy } from 'react-icons/fi'; // Import Copy icon

import './AnalysisResultModal.css';
import MermaidDiagram from './MermaidDiagram';

const AnalysisResultModal = ({ isOpen, onClose, analysisData }) => {
    // State to manage the text of the copy button for user feedback
    const [isCopied, setIsCopied] = useState(false);

    // Effect to prevent body scrolling when the modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            // Also reset the copy button state whenever the modal opens
            setIsCopied(false);
        } else {
            document.body.style.overflow = 'unset';
        }
        // Cleanup function
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isOpen]);

    if (!isOpen || !analysisData) {
        return null;
    }

    const { type, result, thinking, documentName } = analysisData;

    // Handler function to copy the result text to the clipboard
    const handleCopy = useCallback(() => {
        if (result) {
            navigator.clipboard.writeText(result).then(() => {
                setIsCopied(true);
                // Reset the button text after 2 seconds
                setTimeout(() => setIsCopied(false), 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                alert('Failed to copy text.');
            });
        }
    }, [result]);

    const renderResult = () => {
        if (type === 'mindmap' && result) {
            const convertMarkdownToMermaid = (markdown) => {
                const lines = markdown.split('\n');
                let mermaidSyntax = 'mindmap\n';
                lines.forEach(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine) {
                        const indentation = ' '.repeat(line.search(/\S/));
                        const text = trimmedLine.replace(/^- \*/, '').trim();
                        mermaidSyntax += `${indentation}  ${text}\n`;
                    }
                });
                return mermaidSyntax;
            };

            let chartText = result;
            if (!result.trim().startsWith('mindmap')) {
                chartText = convertMarkdownToMermaid(result);
            }
            return <MermaidDiagram chart={chartText} />;
        }
        // This 'return' is critical and was fixed previously
        return (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result || "No analysis result provided."}
            </ReactMarkdown>
        );
    };

    // The 'mindmap' type is not suitable for raw text copying
    const isCopyDisabled = isCopied || type === 'mindmap' || !result;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">
                        {type ? `${type.charAt(0).toUpperCase() + type.slice(1)}` : 'Analysis'} Results
                    </h3>
                    <button onClick={onClose} className="modal-close-button" title="Close">
                        <FiX size={24} />
                    </button>
                </div>
                <div className="modal-body">
                    <p className="modal-document-name">File: {documentName || 'Document'}</p>
                    {thinking && (
                        <details className="modal-thinking-details">
                            <summary>View Thinking Process</summary>
                            <pre>{thinking}</pre>
                        </details>
                    )}
                    <div className="modal-result-container">
                        {renderResult()}
                    </div>
                </div>
                <div className="modal-footer">
                    <button
                        onClick={handleCopy}
                        className="modal-secondary-button"
                        disabled={isCopyDisabled}
                    >
                        <FiCopy size={16} style={{ marginRight: '8px' }} />
                        {isCopied ? 'Copied!' : 'Copy'}
                    </button>
                    <button onClick={onClose} className="modal-action-button">Close</button>
                </div>
            </div>
        </div>
    );
};

export default AnalysisResultModal;