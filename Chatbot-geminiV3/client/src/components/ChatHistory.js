import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Box, Typography, Paper } from '@mui/material';
import './ChatHistory.css';

const ChatHistory = ({ messages }) => {
    return (
        <Box className="chat-history">
            {messages.map((message, index) => (
                <Paper
                    key={index}
                    elevation={1}
                    className={`message ${message.role === 'user' ? 'user-message' : 'assistant-message'}`}
                >
                    <Typography variant="subtitle2" className="message-role">
                        {message.role === 'user' ? 'You' : 'Assistant'}
                    </Typography>
                    <Box className="message-content">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                        </ReactMarkdown>
                    </Box>
                </Paper>
            ))}
        </Box>
    );
};

export default ChatHistory; 