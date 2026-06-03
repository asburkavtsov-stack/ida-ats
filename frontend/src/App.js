import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';
import './styles/global.css';

import Dashboard from './pages/Dashboard';
import Kanban from './pages/Kanban';
import Candidates from './pages/Candidates';
import Vacancies from './pages/Vacancies';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';
import Users from './pages/Users';
import Profile from './pages/Profile';
import OrgSettings from './pages/OrgSettings';
import Landing from './pages/Landing';
import Login from './pages/Login';          // ← компонент логіну
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import AddCandidateModal from './components/AddCandidateModal';
import EmailTemplates from './pages/EmailTemplates';
import InterviewCalendar from './pages/InterviewCalendar';
import AuditLog from './pages/AuditLog';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [isAuth, setIsAuth] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [viewOrgId, setViewOrgId] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchRole = () => {
    axios.get('/api/me/')
      .then(res => {
        const role = res.data.role;
        setUserRole(role);
        if (role === 'superadmin') setCurrentPage('admin');
        else setCurrentPage('dashboard');
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

  // Функція, яка викликається після успішного логіну
  const handleLoginSuccess = () => {
    setIsAuth(true);
    setShowLogin(false);
    fetchRole();
  };

  // Функція, яка показує форму логіну
  const handleShowLogin = () => {
    setShowLogin(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    delete axios.defaults.headers.common['Authorization'];
    setIsAuth(false);
    setUserRole(null);
    setShowLogin(false);
  };

  const handleAdded = () => setRefreshKey(k => k + 1);

  const handleViewOrg = (orgId) => {
    setViewOrgId(orgId);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':       return <Dashboard />;
      case 'kanban':          return <Kanban key={refreshKey} searchQuery={debouncedSearch} />;
      case 'candidates':      return <Candidates key={refreshKey} searchQuery={debouncedSearch} />;
      case 'vacancies':       return <Vacancies />;
      case 'interviews':      return <InterviewCalendar />;
      case 'analytics':       return <Analytics />;
      case 'email_templates': return <EmailTemplates />;
      case 'org_settings':    return <OrgSettings />;
      case 'profile':         return <Profile />;
      case 'audit_log':       return <AuditLog />;
      default:                return <Dashboard />;
    }
  };

  // ── Показуємо форму логіну якщо натиснули "Увійти" ─────────────────────
  if (showLogin) {
    return <Login onLogin={handleLoginSuccess} />;
  }

  // ── Неавторизований користувач → показуємо лендінг ─────────────────────
  if (!isAuth) {
    return <Landing onLogin={handleShowLogin} />;
  }

  // ── Superadmin ──────────────────────────────────────────────────────────────
  if (userRole === 'superadmin') {
    const renderSuperadminPage = () => {
      if (viewOrgId) {
        return (
          <div>
            <div style={{ padding: '12px 28px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setViewOrgId(null)}
                style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text)', cursor: 'pointer', fontFamily: 'DM Mono', fontSize: '0.78rem' }}
              >
                ← Назад до адмінки
              </button>
              <span style={{ fontSize: '0.82rem', color: 'var(--muted)', fontFamily: 'DM Mono' }}>Перегляд організації</span>
            </div>
            <Kanban key={viewOrgId} searchQuery="" orgId={viewOrgId} />
          </div>
        );
      }
      switch (currentPage) {
        case 'users':           return <Users />;
        case 'profile':         return <Profile />;
        case 'email_templates': return <EmailTemplates />;
        case 'analytics':       return <Analytics />;
        case 'vacancies':       return <Vacancies />;
        case 'kanban':          return <Kanban key={refreshKey} searchQuery={debouncedSearch} />;
        case 'candidates':      return <Candidates key={refreshKey} searchQuery={debouncedSearch} />;
        case 'audit_log':       return <AuditLog />;
        default:                return <Admin onViewOrg={handleViewOrg} currentPage={currentPage} onNavigate={setCurrentPage} />;
      }
    };

    return (
      <div className="app-layout">
        <Sidebar currentPage={currentPage} onNavigate={p => { setViewOrgId(null); setCurrentPage(p); }} onLogout={handleLogout} userRole={userRole} />
        <div className="main">
          <Topbar
            currentPage={viewOrgId ? 'kanban' : currentPage}
            onAddCandidate={() => setShowModal(true)}
            onSearch={setSearchQuery}
          />
          <div className="content">
            {renderSuperadminPage()}
          </div>
        </div>
        {showModal && (
          <AddCandidateModal onClose={() => setShowModal(false)} onAdded={handleAdded} />
        )}
      </div>
    );
  }

  // ── Admin ───────────────────────────────────────────────────────────────────
  if (userRole === 'admin') {
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
          <AddCandidateModal onClose={() => setShowModal(false)} onAdded={handleAdded} />
        )}
      </div>
    );
  }

  // ── HR ──────────────────────────────────────────────────────────────────────
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
        <AddCandidateModal onClose={() => setShowModal(false)} onAdded={handleAdded} />
      )}
    </div>
  );
}

export default App;