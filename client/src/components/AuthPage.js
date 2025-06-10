// client/src/components/AuthPage.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
// --- MODIFICATION START ---
import { signinUser, signupUser, saveApiKeys } from '../services/api';
import ApiKeyModal from './ApiKeyModal'; // Import the new modal component
// --- MODIFICATION END ---


const AuthPage = ({ setIsAuthenticated }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // --- MODIFICATION START ---
    // State to control the visibility of the API key modal
    const [showApiKeyModal, setShowApiKeyModal] = useState(false);
    // State to hold user data temporarily before keys are saved
    const [tempUser, setTempUser] = useState(null);
    // --- MODIFICATION END ---

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!username.trim() || !password.trim()) {
            setError('Username and password cannot be empty.');
            setLoading(false);
            return;
        }

        try {
            const userData = { username, password };
            let response;
            if (isLogin) {
                response = await signinUser(userData);
            } else {
                if (password.length < 6) {
                    setError('Password must be at least 6 characters long.');
                    setLoading(false);
                    return;
                }
                response = await signupUser(userData);
            }

            // --- START OF DIAGNOSTIC LOGGING ---

            console.log('Server response received:', response.data);

            // This line might fail if response.data is not what we expect. Let's be safe.
            const hasProvidedApiKeys = response.data?.hasProvidedApiKeys;
            const sessionId = response.data?.sessionId;
            const loggedInUsername = response.data?.username;
            const userId = response.data?._id;

            console.log('Extracted `hasProvidedApiKeys`:', hasProvidedApiKeys);
            console.log('Extracted `userId`:', userId);

            if (!userId || !sessionId || !loggedInUsername) {
                // This error will now trigger if any of the key fields are missing.
                throw new Error("Incomplete authentication data received from server. Check console for details.");
            }

            // --- END OF DIAGNOSTIC LOGGING ---

            localStorage.setItem('sessionId', sessionId);
            localStorage.setItem('username', loggedInUsername);
            localStorage.setItem('userId', userId);
            
            // --- This is the critical decision point ---
            if (hasProvidedApiKeys === true) { // Explicitly check for true
                console.log('Decision: API keys ARE provided. Navigating to /chat.');
                setIsAuthenticated(true);
                navigate('/chat', { replace: true });
            } else {
                console.log('Decision: API keys are NOT provided or flag is missing. Showing modal.');
                setTempUser({ username: loggedInUsername });
                setShowApiKeyModal(true); // This should trigger the modal
            }

        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || `An error occurred.`;
            console.error("Auth Error full details:", err); // Log the full error object
            setError(errorMessage);
            localStorage.removeItem('sessionId');
            localStorage.removeItem('username');
            localStorage.removeItem('userId');
            setIsAuthenticated(false);
        } finally {
            setLoading(false);
        }
    };

    // --- MODIFICATION START ---
    // Handler for the ApiKeyModal's onSave event
    const handleSaveKeys = async (keyData) => {
        // The modal's internal state will handle loading/errors display
        // The saveApiKeys function will automatically use the userId from localStorage via the interceptor
        try {
            await saveApiKeys(keyData);

            // On successful save, complete the authentication flow
            setIsAuthenticated(true);
            setShowApiKeyModal(false);
            navigate('/chat', { replace: true });
        } catch (err) {
            // The ApiKeyModal component is responsible for showing the error to the user.
            // We just re-throw it so the modal's catch block can handle it.
            console.error("Failed to save API keys from AuthPage:", err);
            throw err; // Re-throw to be caught in ApiKeyModal's handleSubmit
        }
    };
    // --- MODIFICATION END ---

    const toggleMode = () => {
        setIsLogin(!isLogin);
        setUsername('');
        setPassword('');
        setError('');
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h2>{isLogin ? 'Sign In' : 'Sign Up'}</h2>
                <form onSubmit={handleAuth}>
                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text" id="username" value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required autoComplete="username"
                            disabled={loading}
                        />
                    </div>
                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password" id="password" value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required autoComplete={isLogin ? "current-password" : "new-password"}
                            disabled={loading}
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
                    </button>
                </form>
                <button onClick={toggleMode} className="toggle-button" disabled={loading}>
                    {isLogin ? 'Need an account? Sign Up' : 'Have an account? Sign In'}
                </button>
            </div>

            {/* --- MODIFICATION START: Conditionally render the modal --- */}
            {showApiKeyModal && (
                <ApiKeyModal
                    username={tempUser?.username}
                    onSave={handleSaveKeys}
                    // Optional: If the user closes the modal without saving, we should log them out
                    onClose={() => {
                        localStorage.clear();
                        setIsAuthenticated(false);
                        setShowApiKeyModal(false);
                        setError("API keys are required to proceed. Please sign in again.");
                    }}
                />
            )}
            {/* --- MODIFICATION END --- */}
        </div>
    );
};

// --- CSS for AuthPage (included directly) ---
const AuthPageCSS = `
.auth-container { display: flex; justify-content: center; align-items: center; min-height: 100vh; background-color: #f0f2f5; }
.auth-box { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); width: 100%; max-width: 400px; text-align: center; }
.auth-box h2 { margin-bottom: 25px; color: #333; }
.input-group { margin-bottom: 20px; text-align: left; }
.input-group label { display: block; margin-bottom: 8px; color: #555; font-weight: bold; }
.input-group input { width: 100%; padding: 12px 15px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; font-size: 1rem; }
.input-group input:focus { outline: none; border-color: #007bff; box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25); }
.input-group input:disabled { background-color: #e9ecef; cursor: not-allowed; }
.auth-button { width: 100%; padding: 12px; background-color: #007bff; color: white; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; transition: background-color 0.3s ease; margin-top: 10px; }
.auth-button:hover:not(:disabled) { background-color: #0056b3; }
.auth-button:disabled { background-color: #cccccc; cursor: not-allowed; }
.toggle-button { background: none; border: none; color: #007bff; cursor: pointer; margin-top: 20px; font-size: 0.9rem; }
.toggle-button:hover:not(:disabled) { text-decoration: underline; }
.toggle-button:disabled { color: #999; cursor: not-allowed; }
.error-message { color: #dc3545; margin-top: 15px; margin-bottom: 0; font-size: 0.9rem; }
`;
// --- Inject CSS ---
const styleTagAuthId = 'auth-page-styles';
if (!document.getElementById(styleTagAuthId)) {
    const styleTag = document.createElement("style");
    styleTag.id = styleTagAuthId;
    styleTag.type = "text/css";
    styleTag.innerText = AuthPageCSS;
    document.head.appendChild(styleTag);
}
// --- End CSS Injection ---

export default AuthPage;