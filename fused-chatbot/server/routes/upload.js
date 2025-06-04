const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');

// Configure multer for file upload
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'assets');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 16 * 1024 * 1024 // 16MB default
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['.pdf', '.docx', '.pptx', '.txt', '.json'];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedTypes.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type'));
        }
    }
});

/**
 * @route   POST /api/upload/document
 * @desc    Upload a document
 * @access  Public
 */
router.post('/document', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        // Create form data for RAG service
        const formData = new FormData();
        formData.append('file', fs.createReadStream(req.file.path));

        // Send to RAG service
        const ragResponse = await axios.post(
            `${process.env.PYTHON_RAG_SERVICE_URL}/add_document`,
            formData,
            {
                headers: {
                    ...formData.getHeaders()
                }
            }
        );

        // Clean up uploaded file
        await fs.unlink(req.file.path);

        res.json(ragResponse.data);
    } catch (error) {
        console.error('Upload error:', error);
        // Clean up file if it exists
        if (req.file) {
            try {
                await fs.unlink(req.file.path);
            } catch (unlinkError) {
                console.error('Error cleaning up file:', unlinkError);
            }
        }
        res.status(500).json({ error: 'Failed to upload document' });
    }
});

module.exports = router; 