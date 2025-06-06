 // client/src/components/KnowledgeGraphViewer.js
import React from 'react';

const KnowledgeGraphViewer = (props) => {
    const { kgData, isLoading, error } = props;

    if (isLoading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Knowledge Graph...</div>;
    }

    if (error) {
        return <div style={{ padding: '20px', color: 'red', textAlign: 'center' }}>Error loading Knowledge Graph: {error}</div>;
    }

    if (!kgData || Object.keys(kgData).length === 0) { // Check if kgData is null, undefined, or an empty object
        return (
            <div style={{ padding: '20px', textAlign: 'center' }}>
                <p>No Knowledge Graph data to display.</p>
                <p>Please select a file and ensure KG analysis has run successfully.</p>
            </div>
        );
    }

    // Placeholder for your actual Knowledge Graph visualization
    // You would typically use a library like react-graph-vis, vis-network, D3.js, etc. here
    // to render the nodes and edges from kgData.
    return (
        <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            <h4>Knowledge Graph Visualization</h4>
            <p>KG Data Received (raw):</p>
            <pre style={{ backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {JSON.stringify(kgData, null, 2)}
            </pre>
            <p style={{ marginTop: '20px', fontStyle: 'italic' }}>
                (Replace this section with your actual graph rendering component using the data above.)
            </p>
        </div>
    );
};

export default KnowledgeGraphViewer;