import { useState } from 'react';

const HomePage = ({ onStartChat, onNavigateToCatalog, onNavigateToDashboard }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="min-h-screen dark">
      <div className="min-h-screen bg-[#121212] text-[#E0E0E0]">
        {/* Header */}
        <header className="border-b border-gray-700 px-6 py-4">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-[#4FC3F7]">RazorAgent</h1>
            <nav>
              <ul className="flex space-x-6">
                <li>
                  <button 
                    onClick={onStartChat}
                    className="text-[#4FC3F7] hover:underline font-medium"
                  >
                    Start Shopping
                  </button>
                </li>
                <li>
                  <button 
                    onClick={onNavigateToCatalog}
                    className="text-gray-400 hover:text-[#4FC3F7] hover:underline"
                  >
                    View Catalog
                  </button>
                </li>
                <li>
                  <button 
                    onClick={onNavigateToDashboard}
                    className="text-gray-400 hover:text-[#4FC3F7] hover:underline"
                  >
                    Merchant Dashboard
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-6 py-12">
          {/* Hero Section */}
          <section className="mb-12">
            <div className="border border-gray-700 p-8">
              <h2 className="text-4xl font-bold mb-4">AI-Powered Shopping Assistant</h2>
              <p className="text-lg leading-relaxed mb-6">
                Experience the future of e-commerce with RazorAgent. Our AI assistant helps you find products, 
                compare options, and complete purchases using natural conversation. No complex forms, no endless 
                scrolling—just tell us what you need.
              </p>
              <button 
                onClick={onStartChat}
                className="px-6 py-3 bg-[#4FC3F7] text-black font-medium rounded hover:bg-[#29B6F6] transition-colors"
              >
                Start Shopping Now
              </button>
            </div>
          </section>

          {/* Features Section */}
          <section className="mb-12">
            <h3 className="text-2xl font-bold mb-6">How It Works</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-gray-700 p-6">
                <h4 className="text-xl font-semibold mb-3">1. Tell Us What You Need</h4>
                <p className="leading-relaxed">
                  Simply type what you're looking for in natural language. Our AI understands context, 
                  preferences, and even vague requests.
                </p>
              </div>
              <div className="border border-gray-700 p-6">
                <h4 className="text-xl font-semibold mb-3">2. Get Smart Recommendations</h4>
                <p className="leading-relaxed">
                  RazorAgent analyzes our catalog to find perfect matches, suggests related products, 
                  and explains why each recommendation fits your needs.
                </p>
              </div>
              <div className="border border-gray-700 p-6">
                <h4 className="text-xl font-semibold mb-3">3. Complete Your Purchase</h4>
                <p className="leading-relaxed">
                  Once you find what you want, we create a secure Razorpay order instantly. 
                  Pay safely with test-mode integration.
                </p>
              </div>
            </div>
          </section>

          {/* Product Categories */}
          <section className="mb-12">
            <h3 className="text-2xl font-bold mb-6">Browse by Category</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="border border-gray-700 p-6 hover:border-[#4FC3F7] transition-colors cursor-pointer">
                <h4 className="text-xl font-semibold mb-2">Electronics</h4>
                <p className="text-sm mb-3">Headphones, keyboards, mice, and more</p>
                <button onClick={() => onStartChat('electronics')} className="text-[#4FC3F7] hover:underline text-sm">
                  Browse Electronics →
                </button>
              </div>
              <div className="border border-gray-700 p-6 hover:border-[#4FC3F7] transition-colors cursor-pointer">
                <h4 className="text-xl font-semibold mb-2">Accessories</h4>
                <p className="text-sm mb-3">Cases, cables, desk mats, and essentials</p>
                <button onClick={() => onStartChat('accessories')} className="text-[#4FC3F7] hover:underline text-sm">
                  Browse Accessories →
                </button>
              </div>
              <div className="border border-gray-700 p-6 hover:border-[#4FC3F7] transition-colors cursor-pointer">
                <h4 className="text-xl font-semibold mb-2">Apparel</h4>
                <p className="text-sm mb-3">T-shirts, hoodies, caps, and more</p>
                <button onClick={() => onStartChat('apparel')} className="text-[#4FC3F7] hover:underline text-sm">
                  Browse Apparel →
                </button>
              </div>
            </div>
          </section>

          {/* Technical Information */}
          <section className="mb-12">
            <h3 className="text-2xl font-bold mb-6">For Developers & AI Agents</h3>
            <div className="border border-gray-700 p-6">
              <h4 className="text-lg font-semibold mb-4">Agent-Readable Architecture</h4>
              <div className="space-y-4">
                <div>
                  <h5 className="font-medium mb-1">Structured Product Catalog</h5>
                  <p className="text-sm leading-relaxed">
                    Our catalog uses standardized JSON schema with clear product relationships, 
                    pricing in paise, and comprehensive metadata for AI parsing.
                  </p>
                </div>
                <div>
                  <h5 className="font-medium mb-1">Bounded Tool Interfaces</h5>
                  <p className="text-sm leading-relaxed">
                    The AI agent operates through strictly defined tool schemas ensuring safe, 
                    predictable interactions with our commerce systems.
                  </p>
                </div>
                <div>
                  <h5 className="font-medium mb-1">Complete Audit Trail</h5>
                  <p className="text-sm leading-relaxed">
                    Every action is logged with explainable reasoning, making the system 
                    transparent and accountable for both humans and AI agents.
                  </p>
                </div>
              </div>
              <div className="mt-6 relative inline-block">
                <button 
                  onClick={onNavigateToCatalog}
                  className="inline-block px-4 py-2 border border-[#4FC3F7] text-[#4FC3F7] hover:bg-[#4FC3F7] hover:text-black transition-colors text-sm"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                >
                  View API Documentation
                </button>
                {showTooltip && (
                  <div className="absolute bottom-full left-0 mb-2 px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded whitespace-nowrap">
                    API Documentation (To be updated...)
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer className="border-t border-gray-700 px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div>
                <h4 className="font-semibold mb-4">RazorAgent</h4>
                <p className="text-sm leading-relaxed">
                  AI-powered commerce layer built on Razorpay test-mode APIs and Claude AI.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Quick Links</h4>
                <ul className="space-y-2 text-sm">
                  <li><button onClick={onNavigateToCatalog} className="hover:underline">Product Catalog</button></li>
                  <li><button onClick={onNavigateToDashboard} className="hover:underline">Merchant Dashboard</button></li>
                  <li><span className="text-gray-500">Audit Trail (Coming Soon)</span></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Technology</h4>
                <ul className="space-y-2 text-sm">
                  <li>Razorpay Payment Gateway</li>
                  <li>Anthropic Claude AI</li>
                  <li>React + Vite Frontend</li>
                  <li>Node.js + Express Backend</li>
                </ul>
              </div>
            </div>
            <div className="border-t border-gray-700 pt-6 text-center text-sm">
              <p>Powered by Razorpay test-mode APIs + Claude AI</p>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default HomePage;