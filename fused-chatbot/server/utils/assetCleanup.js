const fs = require('fs').promises;
const path = require('path');

/**
 * Perform cleanup of temporary assets
 * @returns {Promise<void>}
 */
async function performAssetCleanup() {
    const assetsDir = path.join(__dirname, '..', 'assets');
    const backupDir = path.join(__dirname, '..', 'backup_assets');

    try {
        // Create directories if they don't exist
        await fs.mkdir(assetsDir, { recursive: true });
        await fs.mkdir(backupDir, { recursive: true });

        // Get all files in assets directory
        const files = await fs.readdir(assetsDir);

        // Move files older than 24 hours to backup
        const now = Date.now();
        for (const file of files) {
            const filePath = path.join(assetsDir, file);
            const stats = await fs.stat(filePath);
            const fileAge = now - stats.mtime.getTime();

            // If file is older than 24 hours
            if (fileAge > 24 * 60 * 60 * 1000) {
                const backupPath = path.join(backupDir, file);
                await fs.rename(filePath, backupPath);
                console.log(`Moved ${file} to backup directory`);
            }
        }

        console.log('Asset cleanup completed successfully');
    } catch (error) {
        console.error('Error during asset cleanup:', error);
        throw error;
    }
}

module.exports = {
    performAssetCleanup
}; 