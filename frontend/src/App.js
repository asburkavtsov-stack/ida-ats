import React, { useState, useEffect } from 'react';
import axios from 'axiosConfig';
import { Toaster } from 'react-hot-toast';
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
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import AddCandidateModal from './components/AddCandidateModal';
import ErrorBoundary from './components/ErrorBoundary';
import EmailTemplates from './pages/EmailTemplates';
import InterviewCalendar from './pages/InterviewCalendar';
import AuditLog from './pages/AuditLog';
import RegisterModal from './components/RegisterModal';
import Integrations from './pages/Integrations';

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
  const [showRegister, setShowRegister] = useState(false);
  const [registerPrimaryColor, setRegisterPrimaryColor] = useState('#7a1a2e');

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

  const handleLoginSuccess = () => {
    setIsAuth(true);
    setShowLogin(false);
    setShowRegister(false);
    fetchRole();
  };

  const handleShowLogin = () => setShowLogin(true);

  const handleShowRegister = (primaryColor) => {
    setRegisterPrimaryColor(primaryColor || '#7a1a2e');
    setShowRegister(true);
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
  const handleViewOrg = (orgId) => setViewOrgId(orgId);

  const PAGE_NAMES = {
    dashboard:       'Дашборд',
    kanban:          'Канбан',
    candidates:      'Кандидати',
    vacancies:       'Вакансії',
    interviews:      "Інтерв'ю",
    analytics:       'Аналітика',
    email_templates: 'Шаблони листів',
    org_settings:    'Організація',
    profile:         'Профіль',
    audit_log:       'Аудит',
    integrations:    'Інтеграції',
    admin:           'Адмін',
    users:           'Юзери',
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
      case 'integrations':    return <Integrations />;
      default:                return <Dashboard />;
    }
  };

  const toaster = (
    <Toaster
      position="bottom-right"
      toastOptions={{
        duration: 4000,
        style: {
          fontFamily: 'DM Sans, sans-serif',
          fontSize: '0.85rem',
          borderRadius: '10px',
          padding: '12px 16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        },
        success: { iconTheme: { primary: '#16a34a', secondary: '#fff' } },
        error:   { duration: 6000, iconTheme: { primary: '#dc2626', secondary: '#fff' } },
      }}
    />
  );

  if (showLogin) {
    return (
      <>
        <ErrorBoundary pageName="Вхід">
          <Login onLogin={handleLoginSuccess} />
        </ErrorBoundary>
        {toaster}
      </>
    );
  }

  if (!isAuth) {
    return (
      <>
        <ErrorBoundary pageName="Головна">
          <Landing onLogin={handleShowLogin} onRegister={handleShowRegister} />
          {showRegister && (
            <RegisterModal
              primaryColor={registerPrimaryColor}
              onClose={() => setShowRegister(false)}
              onSuccess={handleLoginSuccess}
            />
          )}
        </ErrorBoundary>
        {toaster}
      </>
    );
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
            <ErrorBoundary pageName="Канбан організації">
              <Kanban key={viewOrgId} searchQuery="" orgId={viewOrgId} />
            </ErrorBoundary>
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
            <ErrorBoundary pageName={PAGE_NAMES[currentPage]}>
              {renderSuperadminPage()}
            </ErrorBoundary>
          </div>
        </div>
        {showModal && (
          <ErrorBoundary>
            <AddCandidateModal onClose={() => setShowModal(false)} onAdded={handleAdded} />
          </ErrorBoundary>
        )}
        {toaster}
      </div>
    );
  }

  // ── Admin / HR ──────────────────────────────────────────────────────────────
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
          <ErrorBoundary pageName={PAGE_NAMES[currentPage]}>
            {renderPage()}
          </ErrorBoundary>
        </div>
      </div>
      {showModal && (
        <ErrorBoundary>
          <AddCandidateModal onClose={() => setShowModal(false)} onAdded={handleAdded} />
        </ErrorBoundary>
      )}
      {toaster}
    </div>
  );
}

export default App;