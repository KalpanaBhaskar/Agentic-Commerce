import { useState, useEffect } from 'react';
import HomePage from './components/HomePage';
import ChatWidget from './components/ChatWidget';
import CatalogPage from './components/CatalogPage';
import DashboardPage from './components/DashboardPage';

function App() {
  const [currentPage, setCurrentPage] = useState('home');
  const [initialCategory, setInitialCategory] = useState(null);

  useEffect(() => {
    // Set dark mode as default
    document.documentElement.classList.add('dark');
    
    // Handle browser back button
    const handlePopState = () => {
      setCurrentPage('home');
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleStartChat = (category = null) => {
    setInitialCategory(category);
    setCurrentPage('chat');
    window.history.pushState({ page: 'chat' }, '', '#chat');
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    setInitialCategory(null);
    window.history.pushState({ page: 'home' }, '', '#');
  };

  const handleNavigateToCatalog = () => {
    setCurrentPage('catalog');
    window.history.pushState({ page: 'catalog' }, '', '#catalog');
  };

  const handleNavigateToDashboard = () => {
    setCurrentPage('dashboard');
    window.history.pushState({ page: 'dashboard' }, '', '#dashboard');
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <HomePage 
            onStartChat={handleStartChat}
            onNavigateToCatalog={handleNavigateToCatalog}
            onNavigateToDashboard={handleNavigateToDashboard}
          />
        );
      case 'chat':
        return (
          <ChatWidget 
            onBackToHome={handleBackToHome} 
            initialCategory={initialCategory}
            onNavigateToCatalog={handleNavigateToCatalog}
            onNavigateToDashboard={handleNavigateToDashboard}
          />
        );
      case 'catalog':
        return <CatalogPage onBackToHome={handleBackToHome} />;
      case 'dashboard':
        return <DashboardPage onBackToHome={handleBackToHome} />;
      default:
        return <HomePage onStartChat={handleStartChat} />;
    }
  };

  return (
    <div className="min-h-screen dark">
      {renderPage()}
    </div>
  );
}

export default App;