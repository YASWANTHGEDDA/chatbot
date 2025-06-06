import React, { useState } from 'react';

function ChatHistoryItem({ chatId, onClick }) {
  return (
    <div className="chat-history-item" onClick={() => onClick(chatId)}>
      Chat #{chatId}
    </div>
  );
}

function Message({ message }) {
  return (
    <div className={`message ${message.role}`}>
      <div className="message-content">
        {message.parts[0].text}
      </div>
      <div className="message-timestamp">
        {new Date(message.timestamp).toLocaleString()}
      </div>
    </div>
  );
}

function ChatApp() {
  const [activeChat, setActiveChat] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);

  // Load chat when clicking history item
  const loadChat = (chatId) => {
    // Fetch the specific chat data based on ID
    fetch(`/api/chat/session/${chatId}`)
      .then(response => response.json())
      .then(data => setActiveChat(data))
      .catch(error => console.error('Error loading chat:', error));
  };

  return (
    <div className="chat-app">
      <div className="sidebar">
        {chatHistory.map(chat => (
          <ChatHistoryItem 
            key={chat.id} 
            chatId={chat.id}
            onClick={loadChat}
          />
        ))}
      </div>
      
      <div className="active-chat">
        {activeChat && (
          <>
            <h2>Chat #{activeChat.id}</h2>
            {activeChat.messages.map(msg => (
              <Message key={msg.id} message={msg} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default ChatApp; 