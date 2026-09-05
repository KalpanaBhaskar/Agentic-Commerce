import { useState, useEffect } from 'react';
import HomePage from './components/HomePage';
import ChatWidget from './components/ChatWidget';

function App() {
  const [showChat, setShowChat] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check for system preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleStartChat = () => {
    setShowChat(true);
  };

  const handleBackToHome = () => {
    setShowChat(false);
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark' : ''}`}>
      {!showChat ? (
        <HomePage onStartChat={handleStartChat} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      ) : (
        <ChatWidget onBackToHome={handleBackToHome} darkMode={darkMode} toggleDarkMode={toggleDarkMode} />
      )}
    </div>
  );
}

export default App;