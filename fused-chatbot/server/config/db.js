const mongoose = require('mongoose');

/**
 * Connect to MongoDB
 * @param {string} uri - MongoDB connection URI
 * @returns {Promise<void>}
 */
async function connectDB(uri) {
    try {
        const conn = await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

module.exports = connectDB; 