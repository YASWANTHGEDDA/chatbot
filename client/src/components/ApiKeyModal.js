// client/src/components/ApiKeyModal.js
import React, { useState } from 'react';
import './ApiKeyModal.css'; // We will create this CSS file next

const ApiKeyModal = ({ username, onSave }) => {
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [grokApiKey, setGrokApiKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!geminiApiKey.trim() || !grokApiKey.trim()) {
            setError('Both Gemini and Grok API keys are required.');
            return;
        }

        setLoading(true);
        try {
            // Call the onSave function passed down from AuthPage.js
            await onSave({ geminiApiKey, grokApiKey });
            // If onSave is successful, AuthPage will handle navigation.
            // This modal doesn't need to do anything else.
        } catch (err) {
            // If onSave fails (e.g., API call in AuthPage fails), show the error here.
            const errorMessage = err.response?.data?.message || 'Failed to save keys. Please try again.';
            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="api-key-modal-overlay">
            <div className="api-key-modal-content">
                <div className="api-key-modal-header">
                    <h2>Welcome, {username}!</h2>
                    <p>To complete your setup, please enter your API keys.</p>
                </div>
                <form onSubmit={handleSubmit} className="api-key-modal-form">
                    <div className="input-group">
                        <label htmlFor="gemini-key">Gemini AI API Key</label>
                        <input
                            id="gemini-key"
                            type="password"
                            value={geminiApiKey}
                            onChange={(e) => setGeminiApiKey(e.target.value)}
                            placeholder="Enter your Gemini API Key"
                            required
                            disabled={loading}
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="grok-key">Grok API Key</label>
                        <input
                            id="grok-key"
                            type="password"
                            value={grokApiKey}
                            onChange={(e) => setGrokApiKey(e.target.value)}
                            placeholder="Enter your Grok API Key"
                            required
                            disabled={loading}
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Saving...' : 'Save and Continue'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ApiKeyModal;