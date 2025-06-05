const mongoose = require('mongoose');

const chatHistorySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    message: {
        type: String,
        required: true
    },
    response: {
        type: String,
        required: true
    },
    references_json: [{
        source: String,
        chunk_index: Number,
        content_preview: String
    }],
    cot_reasoning: String,
    llm_used: {
        type: String,
        required: true,
        enum: ['gemini', 'ollama']
    },
    contextId: String,
    metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Index for faster queries
chatHistorySchema.index({ userId: 1, createdAt: -1 });

// Add method to get recent history
chatHistorySchema.statics.getRecentHistory = async function(userId, limit = 50) {
    return this.find({ userId })
        .sort({ createdAt: -1 })
        .limit(limit);
};

// Add method to get context history
chatHistorySchema.statics.getContextHistory = async function(contextId) {
    return this.find({ contextId })
        .sort({ createdAt: 1 });
};

const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

module.exports = ChatHistory;
