import React from 'react';
import { Box, Typography, Accordion, AccordionSummary, AccordionDetails } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const FAQAnalysis = ({ analysisData, isLoading, error }) => {
    if (isLoading) {
        return <Box sx={{ p: 2 }}><Typography>Loading FAQs...</Typography></Box>;
    }

    if (error) {
        return <Box sx={{ p: 2 }}><Typography color="error">Error loading FAQs: {error}</Typography></Box>;
    }

    if (!analysisData || analysisData.length === 0) {
        return <Box sx={{ p: 2 }}><Typography>No FAQs generated for this document.</Typography></Box>;
    }

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Frequently Asked Questions</Typography>
            {analysisData.map((faq, index) => (
                <Accordion key={index} sx={{ mb: 1 }}>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1">Q: {faq.question}</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {faq.answer}
                        </ReactMarkdown>
                    </AccordionDetails>
                </Accordion>
            ))}
        </Box>
    );
};

export default FAQAnalysis; 