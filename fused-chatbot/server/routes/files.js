const express = require('express');
const router = express.Router();
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;

/**
 * @route   GET /api/files/list
 * @desc    List all uploaded files
 * @access  Public
 */
router.get('/list', async (req, res) => {
    try {
        const uploadDir = path.join(__dirname, '..', 'assets');
        
        // Create directory if it doesn't exist
        await fs.mkdir(uploadDir, { recursive: true });
        
        // Get list of files
        const files = await fs.readdir(uploadDir);
        
        // Get file details
        const fileDetails = await Promise.all(
            files.map(async (file) => {
                const filePath = path.join(uploadDir, file);
                const stats = await fs.stat(filePath);
                return {
                    name: file,
                    size: stats.size,
                    modified: stats.mtime
                };
            })
        );
        
        res.json({ files: fileDetails });
    } catch (error) {
        console.error('Error listing files:', error);
        res.status(500).json({ error: 'Failed to list files' });
    }
});

/**
 * @route   DELETE /api/files/:filename
 * @desc    Delete a file
 * @access  Public
 */
router.delete('/:filename', async (req, res) => {
    try {
        const { filename } = req.params;
        const filePath = path.join(__dirname, '..', 'assets', filename);
        
        // Check if file exists
        try {
            await fs.access(filePath);
        } catch {
            return res.status(404).json({ error: 'File not found' });
        }
        
        // Delete file
        await fs.unlink(filePath);
        
        res.json({ message: 'File deleted successfully' });
    } catch (error) {
        console.error('Error deleting file:', error);
        res.status(500).json({ error: 'Failed to delete file' });
    }
});

module.exports = router; 