import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './styles/global.css';
import API_URL from './api';

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

axios.defaults.baseURL = API_URL;

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAuth, setIsAuth] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [viewOrgId, setViewOrgId] = useState(null);

  const fetchRole = () => {
    axios.get('/api/me/')
      .then(res => {
        const role = res.data.role;
        setUserRole(role);
        if (role === 'superadmin') {
          setCurrentPage('admin');
        } else {
          setCurrentPage('dashboard');
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setIsAuth(true);
      fetchRole();
    }
  }, []);

  const handleLogin = () => {
    setIsAuth(true);
    fetchRole();
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuth(false);
    setUserRole(null);
  };

  const handleAdded = () => setRefreshKey(k => k + 1);

  const renderPage = () => {
    switch (currentPage) {
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

  // Superadmin бачить тільки адмінку
 if (userRole === 'superadmin') {
    return (
      <div className="app-layout">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} onLogout={handleLogout} userRole={userRole} />
        <div className="main">
          <div className="content" style={{ padding: 0 }}>
            {viewOrgId ? (
              <div>
                <div style={{ padding: '16px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={() => setViewOrgId(null)}
                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '0.78rem' }}>
                    ← Назад до адмінки
                  </button>
                  <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Перегляд організації</span>
                </div>
                <Kanban key={viewOrgId} searchQuery="" orgId={viewOrgId} />
              </div>
            ) : (
              <Admin onViewOrg={setViewOrgId} />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} onLogout={handleLogout} userRole={userRole} />
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