import { useState, useRef, useEffect } from 'react';

const ChatWidget = ({ onBackToHome, initialCategory, onNavigateToCatalog, onNavigateToDashboard }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    // Pre-fill input if category is provided
    if (initialCategory) {
      setInput(`I'm looking for ${initialCategory}`);
    }
  }, [messages, initialCategory]);

  const generateSessionId = () => {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = input.trim();
    const currentSessionId = sessionId || generateSessionId();
    
    if (!sessionId) {
      setSessionId(currentSessionId);
    }

    // Add user message to chat
    setMessages(prev => [...prev, { 
      type: 'user', 
      text: userMessage 
    }]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          session_id: currentSessionId
        }),
      });

      const data = await response.json();

      // Add agent response to chat
      setMessages(prev => [...prev, {
        type: 'agent',
        text: data.reply,
        payment_link: data.payment_link,
        upsell_shown: data.upsell_shown,
        tools_used: data.tools_used
      }]);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, {
        type: 'agent',
        text: 'Sorry, something went wrong. Please try again.',
        tools_used: []
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#121212] text-[#E0E0E0]">
      {/* Header */}
      <header className="border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button 
              onClick={onBackToHome}
              className="text-[#4FC3F7] hover:underline font-medium"
            >
              ← Back to Home
            </button>
            <h1 className="text-xl font-bold text-[#4FC3F7]">RazorAgent Chat</h1>
          </div>
          <nav>
            <ul className="flex space-x-6">
              <li>
                <button 
                  onClick={onNavigateToCatalog}
                  className="text-gray-400 hover:text-[#4FC3F7] hover:underline"
                >
                  Catalog
                </button>
              </li>
              <li>
                <button 
                  onClick={onNavigateToDashboard}
                  className="text-gray-400 hover:text-[#4FC3F7] hover:underline"
                >
                  Dashboard
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-lg">Welcome to RazorAgent!</p>
            <p className="text-sm mt-2">Type a message to start shopping with AI assistance.</p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[70%] rounded-lg p-4 border ${
                msg.type === 'user'
                  ? 'bg-[#4FC3F7] text-black border-[#4FC3F7]'
                  : 'bg-[#1E1E1E] text-[#E0E0E0] border-gray-700'
              } ${msg.upsell_shown ? 'border-2 border-amber-500' : ''}`}
            >
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              
              {msg.product_image && (
                <img 
                  src={msg.product_image} 
                  alt="Product" 
                  className="mt-3 rounded border border-gray-600 max-w-full h-auto"
                  style={{ maxHeight: '200px' }}
                />
              )}
              
              {msg.payment_link && (
                <a
                  href={msg.payment_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-3 px-4 py-2 bg-green-500 text-black rounded hover:bg-green-600 transition-colors text-sm font-medium"
                >
                  Pay Now →
                </a>
              )}
              
              {msg.tools_used && msg.tools_used.length > 0 && (
                <div className="mt-2 text-xs opacity-75">
                  <span className="font-medium">used:</span> {msg.tools_used.join(', ')}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1E1E1E] text-[#E0E0E0] rounded-lg p-4 border border-gray-700">
              <p className="text-sm">RazorAgent is thinking...</p>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-700 p-6 bg-[#121212]">
        <div className="max-w-7xl mx-auto flex gap-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            className="flex-1 border border-gray-600 rounded-lg px-4 py-3 bg-[#1E1E1E] text-[#E0E0E0] focus:outline-none focus:ring-2 focus:ring-[#4FC3F7] focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-6 py-3 bg-[#4FC3F7] text-black font-medium rounded-lg hover:bg-[#29B6F6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;