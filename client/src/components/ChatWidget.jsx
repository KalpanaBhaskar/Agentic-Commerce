import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';

// Product Card Component
const ProductCard = ({ product, onBuyNow, onAddToCart }) => {
  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-[#1E1E1E] mb-3 hover:border-[#4FC3F7] transition-colors">
      <div className="flex gap-4">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-24 h-24 object-cover rounded"
          />
        )}
        <div className="flex-1">
          <h4 className="font-semibold text-white mb-1">{product.name}</h4>
          <p className="text-sm text-gray-400 mb-2 line-clamp-2">{product.description}</p>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[#4FC3F7] font-bold">₹{product.price_inr?.toFixed(2)}</span>
            {product.shop_name && (
              <span className="text-xs text-gray-500">via {product.shop_name}</span>
            )}
          </div>
          {product.rating && (
            <div className="text-xs text-yellow-400 mb-2">
              ⭐ {product.rating}/5 ({product.reviews || 0} reviews)
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onBuyNow(product)}
              className="px-3 py-1.5 bg-green-500 text-black text-sm font-medium rounded hover:bg-green-600 transition-colors"
            >
              Buy Now
            </button>
            <button
              onClick={() => onAddToCart(product)}
              className="px-3 py-1.5 bg-[#4FC3F7] text-black text-sm font-medium rounded hover:bg-[#29B6F6] transition-colors"
            >
              Add to Cart
            </button>
            {product.product_link && (
              <a
                href={product.product_link}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 border border-gray-600 text-gray-300 text-sm rounded hover:border-[#4FC3F7] hover:text-[#4FC3F7] transition-colors"
              >
                View Details
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const ChatWidget = () => {
  const location = useLocation();
  const hasInitialized = useRef(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [lastSearchResults, setLastSearchResults] = useState([]);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle initial query from navigation
  useEffect(() => {
    if (location.state?.initialQuery && !hasInitialized.current && messages.length === 0) {
      hasInitialized.current = true;
      handleSendWithMessage(location.state.initialQuery);
    }
  }, [location.state?.initialQuery]);

  const handleSendWithMessage = async (message) => {
    if (!message?.trim()) return;

    const userMessage = message.trim();
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
      const response = await fetch('/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          session_id: currentSessionId,
          conversation_history: messages
        }),
      });

      const data = await response.json();

      // Store search results if available
      if (data.search_results && data.search_results.length > 0) {
        setLastSearchResults(data.search_results);
      }

      // Add agent response to chat
      setMessages(prev => [...prev, {
        type: 'agent',
        text: data.reply,
        payment_link: data.payment_link,
        upsell_shown: data.upsell_shown,
        tools_used: data.tools_used,
        products: data.upsell_products || [],
        search_results: data.search_results || []
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

  const addToCart = (product) => {
    setCart(prev => [...prev, product]);
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price_inr || 0), 0);

  const handleBuyNow = async (product) => {
    // Send a message to buy this specific product
    await handleSendWithMessage(`I want to buy ${product.name} (ID: ${product.id})`);
  };

  const generateSessionId = () => {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const handleSend = async () => {
    await handleSendWithMessage(input);
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
            <Link
              to="/"
              className="text-[#4FC3F7] hover:underline font-medium"
            >
              ← Back to Home
            </Link>
            <h1 className="text-xl font-bold text-[#4FC3F7]">Vortex Commerce Chat</h1>
          </div>
          <nav>
            <ul className="flex space-x-6 items-center">
              <li>
                <button
                  onClick={() => setShowCart(!showCart)}
                  className="text-gray-400 hover:text-[#4FC3F7] hover:underline flex items-center gap-2"
                >
                  🛒 Cart ({cart.length})
                </button>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="text-gray-400 hover:text-[#4FC3F7] hover:underline"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-lg">Welcome to Vortex Commerce!</p>
            <p className="text-sm mt-2">Type a message to start shopping with AI assistance.</p>
          </div>
        )}
        
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg p-4 border ${
                msg.type === 'user'
                  ? 'bg-[#4FC3F7] text-black border-[#4FC3F7]'
                  : 'bg-[#1E1E1E] text-[#E0E0E0] border-gray-700'
              } ${msg.upsell_shown ? 'border-2 border-amber-500' : ''}`}
            >
              {msg.type === 'agent' ? (
                <div className="text-sm leading-relaxed">
                  <ReactMarkdown
                    components={{
                      // Customize markdown rendering
                      p: ({ children }) => <p className="mb-2">{children}</p>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto mb-3">
                          <table className="min-w-full text-sm border-collapse">
                            {children}
                          </table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="border border-gray-600 px-3 py-2 bg-[#2E2E2E] text-left">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-gray-600 px-3 py-2">
                          {children}
                        </td>
                      ),
                    }}
                  >
                    {msg.text}
                  </ReactMarkdown>

                  {/* Render product cards if search results exist */}
                  {msg.search_results && msg.search_results.length > 0 && (
                    <div className="mt-4">
                      {msg.search_results.map((product, idx) => (
                        <ProductCard
                          key={product.id || idx}
                          product={product}
                          onBuyNow={handleBuyNow}
                          onAddToCart={addToCart}
                        />
                      ))}
                    </div>
                  )}

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
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              )}
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#1E1E1E] text-[#E0E0E0] rounded-lg p-4 border border-gray-700">
              <p className="text-sm">Vortex Commerce is thinking...</p>
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

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setShowCart(false)}
          />
          <div className="absolute right-0 top-0 h-full w-96 bg-[#1E1E1E] border-l border-gray-700 p-6 overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Shopping Cart</h2>
              <button
                onClick={() => setShowCart(false)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            {cart.length === 0 ? (
              <p className="text-gray-400">Your cart is empty</p>
            ) : (
              <>
                {cart.map((item, index) => (
                  <div key={index} className="border-b border-gray-700 py-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-medium">{item.name}</h3>
                        <p className="text-sm text-gray-400">₹{item.price_inr?.toFixed(2)}</p>
                      </div>
                      <button
                        onClick={() => removeFromCart(index)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <div className="flex justify-between items-center mb-4">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-xl">₹{cartTotal.toFixed(2)}</span>
                  </div>
                  <button
                    className="w-full px-4 py-3 bg-[#4FC3F7] text-black font-medium rounded hover:bg-[#29B6F6] transition-colors"
                    onClick={() => {
                      alert('Cart checkout coming soon! For now, use the chat to buy individual items.');
                    }}
                  >
                    Checkout All Items
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;