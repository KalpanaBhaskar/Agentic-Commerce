import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import HomePage from './components/HomePage';
import ChatWidget from './components/ChatWidget';
import CatalogPage from './components/CatalogPage';
import Dashboard from './pages/Dashboard';

function App() {
  useEffect(() => {
    // Set dark mode as default
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <Router>
      <div className="min-h-screen dark">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/chat" element={<ChatWidget />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;