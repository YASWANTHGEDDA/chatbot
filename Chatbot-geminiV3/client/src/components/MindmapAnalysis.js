import React from 'react';
import { Box, Typography } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MindmapAnalysis = ({ analysisData, isLoading, error }) => {
    if (isLoading) {
        return <Box sx={{ p: 2 }}><Typography>Loading Mindmap...</Typography></Box>;
    }

    if (error) {
        return <Box sx={{ p: 2 }}><Typography color="error">Error loading Mindmap: {error}</Typography></Box>;
    }

    if (!analysisData || analysisData.length === 0) {
        return <Box sx={{ p: 2 }}><Typography>No Mindmap generated for this document.</Typography></Box>;
    }

    // Assuming analysisData is a string containing markdown for the mindmap
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Mind Map Outline</Typography>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {analysisData}
            </ReactMarkdown>
        </Box>
    );
};

export default MindmapAnalysis; 