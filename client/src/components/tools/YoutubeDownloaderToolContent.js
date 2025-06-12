// client/src/components/tools/YouTubeDownloaderToolContent.js
import React, { useState, useEffect } from 'react';
import { downloadYouTubeMedia, getProxiedFileDownloadUrl } from '../../services/api';
import './YouTubeDownloaderTool.css'; // Create this CSS file

const YouTubeDownloaderToolContent = ({ onMediaDownloaded = () => {}, initialData }) => {
    console.log('YouTubeDownloaderToolContent received onMediaDownloaded:', typeof onMediaDownloaded);
    const [youtubeUrl, setYoutubeUrl] = useState(initialData?.url || '');
    const [qualityProfile, setQualityProfile] = useState(initialData?.quality || '720p'); // '720p', '1080p', 'audio_mp3', 'audio_best', 'best'
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [downloadedMediaInfo, setDownloadedMediaInfo] = useState(null); // { message, files, download_links }

    useEffect(() => {
        setYoutubeUrl(initialData?.url || '');
        setQualityProfile(initialData?.quality || '720p');
        setDownloadedMediaInfo(null);
        setError('');
    }, [initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const urlPattern = /^(https|http):\/\/(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})|^https?:\/\/youtu\.be\/([a-zA-Z0-9_-]{11})/;
        if (!youtubeUrl.trim() || !urlPattern.test(youtubeUrl.trim())) {
            setError('Please enter a valid YouTube video URL.');
            return;
        }
        setIsLoading(true);
        setError('');
        setDownloadedMediaInfo(null);

        try {
            const response = await downloadYouTubeMedia(youtubeUrl.trim(), qualityProfile);
            setDownloadedMediaInfo(response);
            onMediaDownloaded({
                original_url: youtubeUrl.trim(),
                quality: qualityProfile,
                downloaded_count: response.files?.length || 0,
                files_with_links: response.files?.map((serverPath, index) => ({
                    name: serverPath.split(/[\\/]/).pop(),
                    link: response.download_links?.[index] ? getProxiedFileDownloadUrl(response.download_links[index].replace('/files/', '')) : '#'
                })) || [],
                error: null
            });
        } catch (err) {
            console.error("YouTube download error:", err);
            const errorMessage = err.message || 'Failed to download YouTube media.';
            setError(errorMessage);
            setDownloadedMediaInfo({ message: errorMessage, files: [], download_links: [] });
            onMediaDownloaded({ original_url: youtubeUrl.trim(), quality: qualityProfile, error: errorMessage });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="tool-content-panel youtube-downloader-tool">
            <h3>YouTube Downloader</h3>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="youtubeUrl">YouTube Video URL:</label>
                    <input
                        type="url"
                        id="youtubeUrl"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="qualityProfile">Quality:</label>
                    <select 
                        id="qualityProfile" 
                        value={qualityProfile} 
                        onChange={(e) => setQualityProfile(e.target.value)}
                    >
                        <option value="best">Best Available (Video+Audio MP4)</option>
                        <option value="1080p">1080p (MP4)</option>
                        <option value="720p">720p (MP4)</option>
                        <option value="audio_mp3">Audio Only (MP3)</option>
                        <option value="audio_best">Best Audio (Original Format)</option>
                    </select>
                </div>
                <button type="submit" disabled={isLoading} style={{ marginTop: '15px' }}>
                    {isLoading ? 'Downloading...' : 'Download Media'}
                </button>
            </form>
            {error && <p className="error-message">{error}</p>}
            {downloadedMediaInfo && (
                <div className="results-section" style={{marginTop: '15px'}}>
                    <h4>Download Results: {downloadedMediaInfo.message}</h4>
                    {downloadedMediaInfo.files && downloadedMediaInfo.files.length > 0 && (
                        <>
                            <p>Successfully processed: {downloadedMediaInfo.files.length} file(s).</p>
                            <ul>
                                {downloadedMediaInfo.files.map((filepath, index) => {
                                    const filename = filepath.split(/[\\/]/).pop();
                                    const downloadLink = downloadedMediaInfo.download_links?.[index]
                                        ? getProxiedFileDownloadUrl(downloadedMediaInfo.download_links[index].replace('/files/', ''))
                                        : null;
                                    return (
                                        <li key={index}>
                                            {filename}
                                            {downloadLink && (
                                                <a href={downloadLink} download={filename} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '10px' }}>
                                                    (Download)
                                                </a>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default YouTubeDownloaderToolContent;