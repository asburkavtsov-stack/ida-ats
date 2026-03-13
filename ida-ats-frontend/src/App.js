import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './styles/global.css';

import Dashboard from './pages/Dashboard';
import Kanban from './pages/Kanban';
import Candidates from './pages/Candidates';
import Vacancies from './pages/Vacancies';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import AddCandidateModal from './components/AddCandidateModal';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAuth, setIsAuth] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuth(true);
    }
  }, []);

  const handleLogin = () => setIsAuth(true);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuth(false);
  };

  const handleAdded = () => setRefreshKey(k => k + 1);

  const renderPage = () => {
  switch(currentPage) {
    case 'dashboard':  return <Dashboard />;
    case 'kanban':     return <Kanban key={refreshKey} searchQuery={searchQuery} />;
    case 'candidates': return <Candidates key={refreshKey} searchQuery={searchQuery} />;
    case 'vacancies':  return <Vacancies />;
    case 'analytics':  return <Analytics />;
    case 'admin':      return <Admin />;
    default:           return <Dashboard />;
  }
};

  if (!isAuth) return <Login onLogin={handleLogin} />;

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} onLogout={handleLogout} />
      <div className="main">
       <Topbar
          currentPage={currentPage}
          onAddCandidate={() => setShowModal(true)}
          onSearch={setSearchQuery}
        />
        <div className="content">
          {renderPage()}
        </div>
      </div>
      {showModal && (
        <AddCandidateModal
          onClose={() => setShowModal(false)}
          onAdded={handleAdded}
        />
      )}
    </div>
  );
}

export default App;