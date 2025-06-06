import React from 'react';
import { Box, Typography, List, ListItem, ListItemText } from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TopicAnalysis = ({ analysisData, isLoading, error }) => {
    if (isLoading) {
        return <Box sx={{ p: 2 }}><Typography>Loading Topics...</Typography></Box>;
    }

    if (error) {
        return <Box sx={{ p: 2 }}><Typography color="error">Error loading Topics: {error}</Typography></Box>;
    }

    if (!analysisData || analysisData.length === 0) {
        return <Box sx={{ p: 2 }}><Typography>No Topics generated for this document.</Typography></Box>;
    }

    // Assuming analysisData is a string containing markdown list of topics
    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Key Topics</Typography>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {analysisData}
            </ReactMarkdown>
        </Box>
    );
};

export default TopicAnalysis; 