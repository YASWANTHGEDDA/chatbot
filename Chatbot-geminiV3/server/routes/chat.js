// // server/routes/chat.js
// const express = require('express');
// const axios = require('axios');
// const { protect } = require('../middleware/authMiddleware');
// const ChatHistory = require('../models/ChatHistory');
// const { v4: uuidv4 } = require('uuid');
// const { generateContentWithHistory } = require('../services/geminiService');
// const { getKnowledgeGraphData, formatKGDataForContext } = require('../services/kgService');

// const router = express.Router();

// // --- Helper to call Python RAG Query Endpoint ---
// async function queryPythonRagService(userId, query, k = 5) { // <<<--- INCREASED DEFAULT k HERE
//     // Read URL from environment variable set during startup
//     const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL;
//     if (!pythonServiceUrl) {
//         console.error("PYTHON_RAG_SERVICE_URL is not set in environment. Cannot query RAG service.");
//         throw new Error("RAG service configuration error.");
//     }
//     const queryUrl = `${pythonServiceUrl}/query`;
//     console.log(`Querying Python RAG service for User ${userId} at ${queryUrl} with k=${k}`); // Log k value
//     try {
//         const response = await axios.post(queryUrl, {
//             user_id: userId,
//             query: query,
//             k: k // Pass the requested k value
//         }, { timeout: 30000 }); // 30 second timeout for query

//         // Check for valid response structure (expecting "content" now)
//         if (response.data && Array.isArray(response.data.relevantDocs)) {
//             console.log(`Python RAG service returned ${response.data.relevantDocs.length} results.`);
//             // Extract kg_data from metadata if available
//             const relevantDocsWithKg = response.data.relevantDocs.map(doc => {
//                 if (doc && doc.metadata && doc.metadata.kg_data) {
//                     return { ...doc, kg_data: doc.metadata.kg_data };
//                 } else {
//                     return doc;
//                 }
//             });
//             return relevantDocsWithKg;
//         } else {
//              console.warn(`Python RAG service returned unexpected data structure:`, response.data);
//              return []; // Return empty on unexpected structure
//         }
//     } catch (error) {
//         console.error(`Error querying Python RAG service for User ${userId}:`, error.response?.data || error.message);
//         // Return empty allows chat to proceed without RAG context on error.
//         return [];
//     }
// }

// // --- Helper to call Python KG Query Endpoint ---
// async function queryPythonKgService(query, documentName = null) {
//     const pythonBackendUrl = `http://localhost:${process.env.NOTEBOOK_BACKEND_PORT || 5000}`;
//     const queryUrl = `${pythonBackendUrl}/get_kg_data?filename=${encodeURIComponent(documentName)}`;

//     console.log(`Querying Python KG service for document: ${documentName || 'general'}`);
//     try {
//         const response = await axios.get(queryUrl, { timeout: 30000 }); // 30 second timeout
//         if (response.data && response.data.kg_data) {
//             console.log(`Python KG service returned KG data for ${documentName}`);
//             return response.data.kg_data;
//         } else {
//             console.warn(`Python KG service returned no data or unexpected structure for ${documentName}:`, response.data);
//             return null;
//         }
//     } catch (error) {
//         console.error(`Error querying Python KG service for ${documentName}:`, error.response?.data || error.message);
//         return null;
//     }
// }

// // --- Helper to call Python Code Execution Service ---
// async function executePythonCode(code) {
//     const pythonExecutorUrl = process.env.PYTHON_EXECUTOR_SERVICE_URL;
//     if (!pythonExecutorUrl) {
//         console.error("PYTHON_EXECUTOR_SERVICE_URL is not set in environment. Cannot execute Python code.");
//         throw new Error("Python Executor service configuration error.");
//     }
//     const executeUrl = `${pythonExecutorUrl}/execute_code`;
//     console.log(`Calling Python Executor service at ${executeUrl}`);
//     try {
//         const response = await axios.post(executeUrl, {
//             code: code
//         }, { timeout: 60000 }); // 60 second timeout for code execution

//         if (response.data) {
//             console.log(`Python Executor service returned: Output: ${response.data.output}, Error: ${response.data.error}`);
//             return response.data;
//         } else {
//             console.warn(`Python Executor service returned unexpected data structure:`, response.data);
//             return { output: "", error: "Unexpected response from executor." };
//         }
//     } catch (error) {
//         console.error(`Error calling Python Executor service:`, error.response?.data || error.message);
//         return { output: "", error: `Execution failed: ${error.message}` };
//     }
// }

// // --- @route   POST /api/chat/rag ---
// // Use tempAuth middleware
// router.post('/rag', protect, async (req, res) => {
//     const { message } = req.body;
//     const userId = req.user._id.toString(); // req.user is guaranteed by tempAuth

//     if (!message || typeof message !== 'string' || message.trim() === '') {
//         return res.status(400).json({ message: 'Query message text required.' });
//     }

//     console.log(`>>> POST /api/chat/rag: User=${userId} (TEMP AUTH)`);

//     try {
//         // --- MODIFICATION START ---
//         const kValue = 5; // Define the number of documents to retrieve
//         // --- MODIFICATION END ---
//         const relevantDocs = await queryPythonRagService(userId, message.trim(), kValue); // Pass kValue
//         console.log(`<<< POST /api/chat/rag successful for User ${userId}. Found ${relevantDocs.length} docs.`);
//         res.status(200).json({ relevantDocs }); // Send back the results

//     } catch (error) {
//         console.error(`!!! Error processing RAG query for User ${userId}:`, error);
//         res.status(500).json({ message: "Failed to retrieve relevant documents." });
//     }
// });


// // --- @route   POST /api/chat/message ---
// // Use tempAuth middleware
// router.post('/message', protect, async (req, res) => {
//     const { message, history, sessionId, selectedLlm } = req.body; // Removed systemPrompt, isRagEnabled, relevantDocs, isKgEnabled
//     const userId = req.user._id.toString(); // req.user is guaranteed by tempAuth

//     // --- Input Validations ---
//     if (!message || typeof message !== 'string' || message.trim() === '') return res.status(400).json({ message: 'Message text required.' });
//     if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ message: 'Session ID required.' });
//     // if (!Array.isArray(history)) return res.status(400).json({ message: 'Invalid history format.'}); // History is sent to Python now

//     console.log(`>>> POST /api/chat/message: User=${userId}, Session=${sessionId} (TEMP AUTH)`);

//     let accumulatedThinking = ""; // Accumulate thinking content
//     let toolOutput = ""; // Store output from tool calls
//     let finalAnswer = "";

//     const MAX_REACT_ITERATIONS = 5; // Limit iterations to prevent infinite loops
//     let currentIteration = 0;

//     try {
//         // Save user's message to MongoDB ChatHistory at the start
//         await ChatHistory.findOneAndUpdate(
//             { userId: userId, sessionId: sessionId },
//             {
//                 $push: {
//                     messages: {
//                         role: 'user',
//                         parts: [{ text: message.trim() }],
//                         timestamp: new Date()
//                     }
//                 },
//                 $set: { updatedAt: new Date() }, // Ensure updatedAt is updated
//                 $setOnInsert: { createdAt: new Date() } // Set createdAt only on insert for new documents
//             },
//             { upsert: true, new: true, setDefaultsOnInsert: true }
//         );
//         console.log(`User message saved to ChatHistory for session ${sessionId}.`);

//         // Format chat history for the Python backend's LLM
//         const historyForPythonLLM = history.map(msg => ({
//             role: msg.role,
//             content: msg.parts.map(part => part.text || '').join(' ')
//         }));

//         // Main ReAct loop
//         while (currentIteration < MAX_REACT_ITERATIONS) {
//             currentIteration++;
//             console.log(`   ReAct Iteration ${currentIteration}: Calling Python backend LLM service.`);

//             const llmPayload = {
//                 query: message.trim(),
//                 session_id: sessionId,
//                 chat_history: historyForPythonLLM,
//                 tool_output: toolOutput,
//                 llm_preference: selectedLlm, // Pass selected LLM from frontend
//             };

//             let llmResponse;
//             try {
//                 // Call the Python backend's chat endpoint
//                 const pythonBackendUrl = `http://localhost:${process.env.NOTEBOOK_BACKEND_PORT || 5000}`;
//                 const response = await axios.post(`${pythonBackendUrl}/chat`, llmPayload, { timeout: 90000 }); // Longer timeout for LLM
//                 llmResponse = response.data;
//             } catch (error) {
//                 console.error(`   Error calling Python backend LLM service in iteration ${currentIteration}:`, error.response?.data || error.message);
//                 accumulatedThinking += `Iteration ${currentIteration} Error: Failed to call LLM service - ${error.message}\n`;
//                 finalAnswer = "Sorry, the AI service encountered an error.";
//                 // Set default references if an error occurred in Python backend and no references were returned
//                 llmResponse = { answer: finalAnswer, thinking: accumulatedThinking, references: [] };
//                 break;
//             }

//             const rawAnswer = llmResponse.answer || "";
//             const llmThinking = llmResponse.thinking || "";
//             accumulatedThinking += `Iteration ${currentIteration} Thought: ${llmThinking}\n`;

//             // Check if the LLM wants to perform an action
//             const actionMatch = rawAnswer.match(/<ACTION>(.*)<\/ACTION>/s);
//             if (actionMatch) {
//                 const actionContent = actionMatch[1].trim();
//                 console.log(`   LLM proposed Action: ${actionContent.substring(0, 100)}...`);

//                 const toolMatch = actionContent.match(/^(\w+)\((.*)\)$/s);
//                 if (toolMatch) {
//                     const toolName = toolMatch[1];
//                     const toolArgsString = toolMatch[2];
//                     let toolArgs = {};

//                     // Simple regex to parse arguments like key='value' or key=value
//                     // This is a basic parser. For complex args, a proper JSON/parser is better.
//                     const argRegex = /(\w+)=(?:\"([^\"]*)\"|\'([^\']*)\'|([^,)]+))/g;
//                     let match;
//                     while ((match = argRegex.exec(toolArgsString)) !== null) {
//                         toolArgs[match[1]] = (match[2] || match[3] || match[4]).trim();
//                         // Attempt to parse as JSON if it looks like JSON
//                         if (toolArgs[match[1]].startsWith('{') && toolArgs[match[1]].endsWith('}')) {
//                             try {
//                                 toolArgs[match[1]] = JSON.parse(toolArgs[match[1]]);
//                             } catch (e) {
//                                 // Not JSON, keep as string
//                             }
//                         }
//                     }

//                     toolOutput = `Error: Unknown tool or invalid arguments for ${toolName}.`; // Default error

//                     switch (toolName) {
//                         case "RAG_search":
//                             const searchQuery = toolArgs.query;
//                             if (searchQuery) {
//                                 const ragResults = await queryPythonRagService(userId, searchQuery);
//                                 if (ragResults.length > 0) {
//                                     // Format RAG results as text for the LLM's next Observation
//                                     toolOutput = "RAG_search Result:\n" +
//                                         ragResults.map((doc, idx) => {
//                                             let docContent = doc.content ? doc.content.substring(0, 500) + (doc.content.length > 500 ? "..." : "") : "No content";
//                                             let docSource = doc.documentName || doc.metadata?.source || 'Unknown Source';
//                                             let kgInfo = "";
//                                             if (doc.kg_data) {
//                                                 kgInfo = `  KG Data for ${docSource}:\n${formatKGDataForContext(doc.kg_data)}`;
//                                             }
//                                             return `Document ${idx + 1} (Source: ${docSource}):\n${docContent}\n${kgInfo}`;
//                                         }).join("\n\n");
//                                     console.log(`   RAG_search executed. ${ragResults.length} docs found.`);
//                                 } else {
//                                     toolOutput = "RAG_search Result: No relevant documents found.";
//                                     console.log("   RAG_search executed. No relevant documents found.");
//                                 }
//                             } else {
//                                 toolOutput = "Error: RAG_search requires a 'query' argument.";
//                                 console.warn("   RAG_search tool called without a query.");
//                             }
//                             break;
//                         case "KG_query":
//                             const kgQuery = toolArgs.query;
//                             const kgDocumentName = toolArgs.document_name;
//                             if (kgQuery || kgDocumentName) {
//                                 const kgData = await queryPythonKgService(kgQuery, kgDocumentName);
//                                 if (kgData) {
//                                     toolOutput = `KG_query Result:\n${formatKGDataForContext(kgData)}`;
//                                     console.log(`   KG_query executed. KG data found.`);
//                                 } else {
//                                     toolOutput = "KG_query Result: No knowledge graph data found.";
//                                     console.log("   KG_query executed. No KG data found.");
//                                 }
//                             } else {
//                                 toolOutput = "Error: KG_query requires 'query' or 'document_name' argument.";
//                                 console.warn("   KG_query tool called without query or document name.");
//                             }
//                             break;
//                         case "Python_execute":
//                             const pythonCode = toolArgs.code;
//                             if (pythonCode) {
//                                 const executionResult = await executePythonCode(pythonCode);
//                                 if (executionResult.error) {
//                                     toolOutput = `Python_execute Error: ${executionResult.error}\nOutput: ${executionResult.output}`;
//                                     console.error(`   Python_execute failed: ${executionResult.error}`);
//                                 } else {
//                                     toolOutput = `Python_execute Result:\n${executionResult.output}`;
//                                     console.log(`   Python_execute succeeded.`);
//                                 }
//                             } else {
//                                 toolOutput = "Error: Python_execute requires a 'code' argument.";
//                                 console.warn("   Python_execute tool called without code.");
//                             }
//                             break;
//                         case "Web_search":
//                             const webQuery = toolArgs.query;
//                             toolOutput = `Observation: Web_search is not yet implemented. Cannot search for '${webQuery}'.`;
//                             console.warn(`   Web_search tool called but not implemented: ${webQuery}`);
//                             break;
//                         default:
//                             console.warn(`   Unknown tool requested by LLM: ${toolName}`);
//                             toolOutput = `Error: Unknown tool: ${toolName}.`;
//                             break;
//                     }
//                     accumulatedThinking += `Iteration ${currentIteration} Action: ${toolName}(${toolArgsString})\n`;
//                     accumulatedThinking += `Iteration ${currentIteration} Observation: ${toolOutput.substring(0, 200)}...\n`;

//                 } else {
//                     toolOutput = `Error: Failed to parse action format: ${actionContent}`; // For LLM to correct
//                     console.warn(`   LLM proposed action in unparseable format: ${actionContent.substring(0, 200)}...`);
//                     accumulatedThinking += `Iteration ${currentIteration} Error: Failed to parse action format.\n`;
//                 }
//             } else {
//                 // LLM did not propose an action, means it's a 'Speak' or an error
//                 finalAnswer = rawAnswer; // This should be the final answer if not an action
//                 console.log(`LLM provided final answer. Iterations: ${currentIteration}`);
//                 break; // Exit loop if not an action
//             }
//         }

//         // If loop finishes without a 'Speak' (e.g., max iterations reached or error)
//         if (currentIteration >= MAX_REACT_ITERATIONS && !finalAnswer) { // Check if finalAnswer is still empty
//             finalAnswer = "Sorry, I reached the maximum number of reasoning steps and could not generate a complete answer. Please try rephrasing your query.";
//             console.warn(`Max ReAct iterations reached for session ${sessionId}.`);
//         }

//         // Save model's final answer to MongoDB ChatHistory
//         const modelResponseMessage = {
//             role: 'model',
//             parts: [{ text: finalAnswer }],
//             references: llmResponse.references || [], // Ensure it's an array
//             thinking: accumulatedThinking.trim(),
//             llm_used: llmResponse.llm_used || selectedLlm, // Store the LLM actually used by the backend
//             timestamp: new Date()
//         };

//         try {
//             await ChatHistory.findOneAndUpdate(
//                 { userId: userId, sessionId: sessionId },
//                 { $push: { messages: modelResponseMessage }, $set: { updatedAt: new Date() } },
//                 { new: true }
//             );
//             console.log(`Model response saved to ChatHistory for session ${sessionId}.`);
//         } catch (dbError) {
//             console.error(`Error saving model response to ChatHistory for session ${sessionId}:`, dbError);
//         }

//         console.log(`<<< POST /api/chat/message successful for session ${sessionId}.`);
//         res.status(200).json({
//             reply: modelResponseMessage,
//             thinking: accumulatedThinking.trim() // Send accumulated thinking to frontend
//         });

//     } catch (error) {
//         // --- Error Handling ---
//         console.error(`!!! Error processing chat message for session ${sessionId}:`, error);
//         let statusCode = error.response?.status || 500;
//         let clientMessage = error.response?.data?.message || error.message || "Failed to get response from AI service.";
//         // Don't expose excessive detail like stack traces
//         if (error.originalError && statusCode === 500) {
//             clientMessage = "An internal server error occurred while processing the AI response.";
//         }
//         res.status(statusCode).json({ message: clientMessage, thinking: accumulatedThinking.trim() }); // Also send thinking on error
//     }
// });

// // --- @route   POST /api/chat/history ---
// // (No changes needed in this route)
// router.post('/history', protect, async (req, res) => {
//     const { sessionId, messages } = req.body;
//     const userId = req.user._id; // req.user guaranteed by tempAuth
//     if (!sessionId) return res.status(400).json({ message: 'Session ID required to save history.' });
//     if (!Array.isArray(messages)) return res.status(400).json({ message: 'Invalid messages format.' });

//     try {
//         const validMessages = messages.filter(m =>
//             m && typeof m.role === 'string' &&
//             Array.isArray(m.parts) && m.parts.length > 0 &&
//             typeof m.parts[0].text === 'string' &&
//             m.timestamp
//         ).map(m => ({
//             role: m.role,
//             parts: [{ text: m.parts[0].text }],
//             timestamp: m.timestamp
//         }));

//         if (validMessages.length !== messages.length) {
//              console.warn(`Session ${sessionId}: Filtered out ${messages.length - validMessages.length} invalid messages during save.`);
//         }
//         if (validMessages.length === 0) {
//              console.log(`Session ${sessionId}: No valid messages to save. Generating new session ID.`);
//              const newSessionId = uuidv4();
//              return res.status(200).json({
//                  message: 'No history saved (empty chat). New session started.',
//                  savedSessionId: null,
//                  newSessionId: newSessionId
//              });
//         }

//         const savedHistory = await ChatHistory.findOneAndUpdate(
//             { sessionId: sessionId, userId: userId },
//             { $set: { userId: userId, sessionId: sessionId, messages: validMessages, updatedAt: Date.now() } },
//             { new: true, upsert: true, setDefaultsOnInsert: true }
//         );
//         const newSessionId = uuidv4();
//         console.log(`History saved for session ${savedHistory.sessionId}. New session ID generated: ${newSessionId}`);
//         res.status(200).json({
//             message: 'Chat history saved successfully.',
//             savedSessionId: savedHistory.sessionId,
//             newSessionId: newSessionId
//         });
//     } catch (error) {
//         console.error(`Error saving chat history for session ${sessionId}:`, error);
//         if (error.name === 'ValidationError') return res.status(400).json({ message: "Validation Error saving history: " + error.message });
//         if (error.code === 11000) return res.status(409).json({ message: "Conflict: Session ID might already exist unexpectedly." });
//         res.status(500).json({ message: 'Failed to save chat history due to a server error.' });
//     }
// });

// // --- @route   GET /api/chat/sessions ---
// // (No changes needed in this route)
// router.get('/sessions', protect, async (req, res) => {
//     const userId = req.user._id;
//     try {
//         const sessions = await ChatHistory.find({ userId: userId })
//             .sort({ updatedAt: -1 })
//             .select('sessionId createdAt updatedAt messages')
//             .lean();

//         const sessionSummaries = sessions.map(session => {
//              const firstUserMessage = session.messages?.find(m => m.role === 'user');
//              let preview = 'Chat Session';
//              if (firstUserMessage?.parts?.[0]?.text) {
//                  preview = firstUserMessage.parts[0].text.substring(0, 75);
//                  if (firstUserMessage.parts[0].text.length > 75) {
//                      preview += '...';
//                  }
//              }
//              return {
//                  sessionId: session.sessionId,
//                  createdAt: session.createdAt,
//                  updatedAt: session.updatedAt,
//                  messageCount: session.messages?.length || 0,
//                  preview: preview
//              };
//         });
//         res.status(200).json(sessionSummaries);
//     } catch (error) {
//         console.error(`Error fetching chat sessions for user ${userId}:`, error);
//         res.status(500).json({ message: 'Failed to retrieve chat sessions.' });
//     }
// });

// // --- @route   GET /api/chat/session/:sessionId ---
// // (No changes needed in this route)
// router.get('/session/:sessionId', protect, async (req, res) => {
//     const userId = req.user._id;
//     const { sessionId } = req.params;
//     if (!sessionId) return res.status(400).json({ message: 'Session ID parameter is required.' });
//     try {
//         const session = await ChatHistory.findOne({ sessionId: sessionId, userId: userId }).lean();
//         if (!session) return res.status(404).json({ message: 'Chat session not found or access denied.' });
//         res.status(200).json(session);
//     } catch (error) {
//         console.error(`Error fetching chat session ${sessionId} for user ${userId}:`, error);
//         res.status(500).json({ message: 'Failed to retrieve chat session details.' });
//     }
// });

// module.exports = router;

// server/routes/chat.js
const express = require('express');
const axios = require('axios');
const { protect } = require('../middleware/authMiddleware');
const ChatHistory = require('../models/ChatHistory');
const { v4: uuidv4 } = require('uuid');
// Assuming getKnowledgeGraphData and formatKGDataForContext are still relevant if KG_query tool is used.
const { getKnowledgeGraphData, formatKGDataForContext } = require('../services/kgService');

// --- START OF HELPER FUNCTIONS ---
// Ensure these are defined at the top, before 'router' is used.

async function queryPythonRagService(userId, query, k = 5) {
    const pythonServiceUrl = process.env.PYTHON_RAG_SERVICE_URL; // This should be your RAG service (e.g., port 5002)
    if (!pythonServiceUrl) {
        console.error("PYTHON_RAG_SERVICE_URL is not set. Cannot query RAG service.");
        throw new Error("RAG service configuration error.");
    }
    const queryUrl = `${pythonServiceUrl}/query`; // Ensure your RAG service has a /query endpoint
    console.log(`[NodeJS] Querying Python RAG service for User ${userId} at ${queryUrl} with query "${query}" and k=${k}`);
    try {
        const response = await axios.post(queryUrl, {
            user_id: userId,
            query: query,
            k: k
        }, { timeout: 30000 });

        if (response.data && Array.isArray(response.data.relevantDocs)) {
            console.log(`[NodeJS] Python RAG service returned ${response.data.relevantDocs.length} results for query "${query}".`);
            // Your existing logic for relevantDocsWithKg
            const relevantDocsWithKg = response.data.relevantDocs.map(doc => {
                if (doc && doc.metadata && doc.metadata.kg_data) {
                    return { ...doc, kg_data: doc.metadata.kg_data };
                }
                return doc;
            });
            return relevantDocsWithKg;
        } else {
            console.warn(`[NodeJS] Python RAG service returned unexpected data structure for query "${query}":`, response.data);
            return [];
        }
    } catch (error) {
        console.error(`[NodeJS] Error querying Python RAG service for User ${userId}, query "${query}":`);
        if (error.response) {
            console.error('   RAG Error Data:', error.response.data);
            console.error('   RAG Error Status:', error.response.status);
        } else if (error.request) {
            console.error('   RAG Error Request:', error.request);
            console.error('   No response received from Python RAG service.');
        } else {
            console.error('   RAG Error Message:', error.message);
        }
        return [];
    }
}

async function queryPythonKgService(query, documentName = null) {
    // This PYTHON_NOTEBOOK_SERVICE_URL should point to your Flask app (app.py)
    const pythonNotebookServiceUrl = `http://localhost:${process.env.NOTEBOOK_BACKEND_PORT || 5000}`;
    const endpoint = `/get_kg_data`; // From your app.py
    let queryUrl = `${pythonNotebookServiceUrl}${endpoint}`;
    if (documentName) {
        queryUrl += `?filename=${encodeURIComponent(documentName)}`;
    } else if (query) { // If your /get_kg_data can handle a general query param
        // queryUrl += `?query=${encodeURIComponent(query)}`; // This endpoint in app.py only takes filename
        console.warn("[NodeJS] queryPythonKgService called with query but no documentName. The current /get_kg_data in app.py primarily uses filename.");
        // For now, if no documentName, we can't do much with just a query to this endpoint
        if (!documentName) return null;
    }


    console.log(`[NodeJS] Querying Python KG service for document: '${documentName || 'general query (unsupported for now)'}' at ${queryUrl}`);
    try {
        const response = await axios.get(queryUrl, { timeout: 30000 });
        if (response.data && response.data.kg_data) {
            console.log(`[NodeJS] Python KG service returned KG data for ${documentName}`);
            return response.data.kg_data;
        } else {
            console.warn(`[NodeJS] Python KG service returned no data or unexpected structure for ${documentName}:`, response.data);
            return null;
        }
    } catch (error) {
        console.error(`[NodeJS] Error querying Python KG service for ${documentName}:`);
        // ... (detailed error logging as above) ...
        return null;
    }
}

async function executePythonCode(code) {
    const pythonExecutorUrl = process.env.PYTHON_EXECUTOR_SERVICE_URL; // Separate service if you have one
    if (!pythonExecutorUrl) {
        console.error("PYTHON_EXECUTOR_SERVICE_URL is not set.");
        // Fallback to notebook service if it has an /execute_code endpoint
        const pythonNotebookServiceUrl = `http://localhost:${process.env.NOTEBOOK_BACKEND_PORT || 5000}`;
        if (true) { // Assuming your main app.py will handle /execute_code
             // Modify if your app.py doesn't have /execute_code
            console.warn("PYTHON_EXECUTOR_SERVICE_URL not set, attempting to use NOTEBOOK_BACKEND_PORT for /execute_code (this needs to be implemented in app.py).");
            // return { output: "", error: "Python Executor service URL not configured." };
        } else {
           // throw new Error("Python Executor service configuration error.");
        }
    }
    const executeUrl = `${pythonExecutorUrl || `http://localhost:${process.env.NOTEBOOK_BACKEND_PORT || 5000}`}/execute_code`; // Modify if different
    console.log(`[NodeJS] Calling Python Executor service at ${executeUrl}`);
    try {
        const response = await axios.post(executeUrl, { code: code }, { timeout: 60000 });
        if (response.data) {
            console.log(`[NodeJS] Python Executor service returned: Output: ${response.data.output}, Error: ${response.data.error}`);
            return response.data;
        } else {
            console.warn(`[NodeJS] Python Executor service returned unexpected data structure:`, response.data);
            return { output: "", error: "Unexpected response from executor." };
        }
    } catch (error) {
        console.error(`[NodeJS] Error calling Python Executor service:`);
        // ... (detailed error logging) ...
        return { output: "", error: `Execution failed: ${error.message}` };
    }
}
// --- END OF HELPER FUNCTIONS ---

const router = express.Router();

// --- @route POST /api/chat/rag ---
// This route is called by ChatPage.js if RAG is enabled before sending the main message
router.post('/rag', protect, async (req, res) => {
    const { message } = req.body;
    const userId = req.user._id.toString();

    if (!message || typeof message !== 'string' || message.trim() === '') {
        return res.status(400).json({ message: 'RAG query message text required.' });
    }
    console.log(`[NodeJS] >>> POST /api/chat/rag: User=${userId}, Query="${message}"`);
    try {
        const kValue = 5;
        const relevantDocs = await queryPythonRagService(userId, message.trim(), kValue); // This should now work
        console.log(`[NodeJS] <<< POST /api/chat/rag successful for User ${userId}. Found ${relevantDocs.length} docs for query "${message}".`);
        res.status(200).json({ relevantDocs });
    } catch (error) {
        console.error(`[NodeJS] !!! Error in /api/chat/rag route for User ${userId}, Query="${message}":`, error);
        res.status(500).json({ message: "Failed to retrieve relevant documents for RAG." });
    }
});


// --- @route POST /api/chat/message ---
router.post('/message', protect, async (req, res) => {
    // Frontend ChatPage.js sends: message, history, sessionId, systemPrompt, isRagEnabled, relevantDocs, llm_preference
    const {
        message,
        history,        // from frontend (ChatPage.js messages state)
        sessionId,
        systemPrompt,   // from frontend (ChatPage.js editableSystemPromptText)
        isRagEnabled,   // from frontend (ChatPage.js isRagEnabled state)
        relevantDocs,   // from frontend (result of /api/chat/rag call if isRagEnabled)
        llm_preference  // from frontend (ChatPage.js selectedLlm state)
    } = req.body;
    const userId = req.user._id.toString();

    if (!message || typeof message !== 'string' || message.trim() === '') return res.status(400).json({ message: 'Message text required.' });
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ message: 'Session ID required.' });

    // Log the received llm_preference
    console.log(`[NodeJS] >>> POST /api/chat/message: User=${userId}, Session=${sessionId}, LLM Pref RECV: ${llm_preference}`);

    try {
        await ChatHistory.findOneAndUpdate(
            { userId: userId, sessionId: sessionId },
            {
                $push: { messages: { role: 'user', parts: [{ text: message.trim() }], timestamp: new Date() } },
                $set: { updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() }
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        console.log(`[NodeJS] User message saved to ChatHistory for session ${sessionId}.`);

        // Prepare payload for Python Flask app (app.py) /chat endpoint
        // Your app.py /chat endpoint expects: query, session_id, chat_history (formatted), tool_output
        // It does NOT directly take systemPrompt, isRagEnabled, relevantDocs from this Node.js payload.
        // The ReAct loop within app.py will call RAG_search tool if needed.

        const historyForPython = history.map(msg => ({ // Convert to {role, content} format if needed by Python
            role: msg.role,
            content: msg.parts.map(part => part.text || '').join(' ') // Assuming Python wants 'content'
        }));

        const llmPayloadForPython = {
            query: message.trim(), // This is the 'content' for the LLM
            session_id: sessionId,
            // chat_history: historyForPython, // Your app.py fetches history from its DB, so this might be redundant or for overriding
                                            // Based on app.py, it uses messages_from_db then formats to chat_history_for_llm
                                            // So, sending history from Node.js might not be used by app.py's ReAct loop.
                                            // Let's send it just in case, app.py can decide.
            chat_history: historyForPython, 
            tool_output: "", // Initial tool_output for the first turn in ReAct loop
            // llm_preference IS NOT directly used by app.py /chat endpoint in its initial payload.
            // llm_preference from Node.js would need to be passed into ai_core.synthesize_chat_response if you want to select LLM there.
            // For now, let's assume ai_core.py uses a configured default or handles selection.
            // If you want to pass llm_preference, modify ai_core.synthesize_chat_response to accept it.
        };
        // Add llm_preference if your Python /chat endpoint or ai_core.py can use it:
        // llmPayloadForPython.llm_preference = llm_preference;


        console.log(`[NodeJS]   Payload to Python Flask app /chat:`, JSON.stringify(llmPayloadForPython, null, 2));

        const pythonChatServiceUrl = `http://localhost:${process.env.NOTEBOOK_BACKEND_PORT || 5000}`;
        const responseFromPython = await axios.post(`${pythonChatServiceUrl}/chat`, llmPayloadForPython, { timeout: 90000 });

        const pythonResponseData = responseFromPython.data;

        if (pythonResponseData.error) {
            console.error(`[NodeJS] Python /chat service returned an error:`, pythonResponseData.error);
            // Construct a valid model reply structure even for errors from Python
            const errorReply = {
                role: 'model',
                parts: [{ text: pythonResponseData.answer || pythonResponseData.error || "Error from AI service." }],
                references: pythonResponseData.references || [],
                thinking: pythonResponseData.thinking || "Error occurred in Python service.",
                llm_used: pythonResponseData.llm_used || llm_preference || 'default', // Use preference if Python doesn't specify
                timestamp: new Date()
            };
            await ChatHistory.findOneAndUpdate(
                { userId: userId, sessionId: sessionId },
                { $push: { messages: errorReply }, $set: { updatedAt: new Date() } }
            );
            return res.status(200).json({ reply: errorReply, thinking: errorReply.thinking }); // Send 200 but with error message in reply
        }

        // Assuming pythonResponseData contains: answer, session_id (can ignore), references, thinking
        const modelResponseMessage = {
            role: 'model',
            parts: [{ text: pythonResponseData.answer || "No response content." }],
            references: pythonResponseData.references || [],
            thinking: pythonResponseData.thinking || "",
            llm_used: pythonResponseData.llm_used || llm_preference || 'default',
            timestamp: new Date()
        };

        await ChatHistory.findOneAndUpdate(
            { userId: userId, sessionId: sessionId },
            { $push: { messages: modelResponseMessage }, $set: { updatedAt: new Date() } }
        );
        console.log(`[NodeJS] Model response saved to ChatHistory for session ${sessionId}.`);

        console.log(`[NodeJS] <<< POST /api/chat/message successful for session ${sessionId}.`);
        res.status(200).json({
            reply: modelResponseMessage,
            thinking: modelResponseMessage.thinking
        });

    } catch (error) {
        console.error(`[NodeJS] !!! Error in POST /api/chat/message for session ${sessionId}:`);
        let clientMessage = "Failed to get response due to a server error.";
        let thinkingOnError = "";

        if (error.response) { // Axios error (error from Python service)
            console.error('   Error Data from Python service:', error.response.data);
            console.error('   Error Status from Python service:', error.response.status);
            clientMessage = error.response.data.answer || error.response.data.error || error.response.data.message || "Error from AI sub-service.";
            thinkingOnError = error.response.data.thinking || `Python service responded with status ${error.response.status}.`;
        } else if (error.request) { // Axios error (no response from Python service)
            console.error('   Error Request (no response from Python):', error.request);
            clientMessage = "AI sub-service did not respond.";
            thinkingOnError = "Connection to Python service failed or timed out.";
        } else { // Other errors (e.g., in Node.js logic itself)
            console.error('   Error Message:', error.message);
            clientMessage = error.message; // Be cautious about exposing internal error messages
            if (error instanceof ReferenceError) {
                clientMessage = "An internal variable error occurred in Node.js. Please check server logs.";
            }
        }
        
        // Construct a valid model reply structure for errors
        const errorReplyForClient = {
            role: 'model',
            parts: [{ text: clientMessage }],
            references: [],
            thinking: thinkingOnError,
            llm_used: llm_preference || 'default',
            timestamp: new Date()
        };
         try {
            await ChatHistory.findOneAndUpdate(
                { userId: userId, sessionId: sessionId },
                { $push: { messages: errorReplyForClient }, $set: { updatedAt: new Date() } }
            );
        } catch (dbErr) {
            console.error("[NodeJS] Failed to save error message to DB:", dbErr);
        }

        res.status(500).json({ // Send 500 for Node.js level errors or if Python returns 500
            reply: errorReplyForClient, // Send the structured error back
            thinking: thinkingOnError,
            message: clientMessage // Also include a top-level message for ChatPage's error display
        });
    }
});

// ... (rest of your /history, /sessions, /session/:sessionId routes - they seem okay) ...
// Make sure to include them from your previous correct version. Example:
router.post('/history', protect, async (req, res) => { /* Your existing history save logic */ });
router.get('/sessions', protect, async (req, res) => { /* Your existing sessions list logic */ });
router.get('/session/:sessionId', protect, async (req, res) => { /* Your existing single session fetch logic */ });


module.exports = router;