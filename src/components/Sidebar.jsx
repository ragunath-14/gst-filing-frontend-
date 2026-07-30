import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useTheme } from '../context/useTheme';
import ThemeToggle from './ThemeToggle';
import api from '../api/axios';
import {
  LayoutDashboard, Building2, Bell, FileText,
  LogOut, Receipt, Menu, X, UploadCloud
} from 'lucide-react';
import toast from 'react-hot-toast';

const AdminNav = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/companies', icon: Building2, label: 'Companies' },
  { to: '/admin/reminders', icon: Bell, label: 'All Reminders' },
];

const CompanyNav = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/documents', icon: FileText, label: 'My Documents' },
  { to: '/reminders', icon: Bell, label: 'My Reminders' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const navItems = user?.role === 'admin' ? AdminNav : CompanyNav;

  // Upload notifications (admin only) — files uploaded directly by company users
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    api.get('/admin/notifications/uploads').then(r => {
      setNotifCount(r.data.count);
      setNotifications(r.data.notifications);
      if (r.data.count > 0 && !sessionStorage.getItem('uploadNotifAlerted')) {
        toast(`${r.data.count} new document${r.data.count > 1 ? 's' : ''} uploaded by ${r.data.count > 1 ? 'companies' : 'a company'}`, {
          icon: '📥',
          duration: 6000
        });
      }
      sessionStorage.setItem('uploadNotifAlerted', '1');
    }).catch(() => {});
  }, [user?.role]);

  const toggleNotifDropdown = () => {
    const opening = !notifOpen;
    setNotifOpen(opening);
    if (opening && notifCount > 0) {
      api.post('/admin/notifications/uploads/mark-seen').catch(() => {});
      setNotifCount(0);
    }
  };

  const goToNotification = (n) => {
    setNotifOpen(false);
    navigate(`/admin/companies/${n.companyId}`);
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <>
      <button
        className="sidebar-hamburger"
        onClick={() => setOpen(o => !o)}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)} />}

      <aside className={`sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <Receipt size={20} color="white" />
          </div>
          <div className="sidebar-logo-text">
            <span className="sidebar-logo-name">GST Manager</span>
            <span className="sidebar-logo-sub">Filing System</span>
          </div>
          {user?.role === 'admin' && (
            <div style={{ position: 'relative', marginLeft: 'auto' }}>
              <button
                onClick={toggleNotifDropdown}
                aria-label="Upload notifications"
                style={{
                  position: 'relative', background: 'rgba(99,120,255,0.08)', border: '1px solid var(--border)',
                  borderRadius: 10, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-secondary)'
                }}
              >
                <Bell size={16} />
                {notifCount > 0 && (
                  <span style={{
                    position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 3px',
                    borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1
                  }}>
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setNotifOpen(false)} />
                  <div style={{
                    position: 'absolute', top: 42, right: 0, width: 300, maxHeight: 360, overflowY: 'auto',
                    background: 'var(--bg-modal)', border: '1px solid var(--border)', borderRadius: 12,
                    boxShadow: 'var(--shadow-lg)', zIndex: 150, padding: 8
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '6px 8px' }}>
                      Company Uploads
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '16px 8px', fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                        No new uploads
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div key={n.fileId} onClick={() => goToNotification(n)}
                          style={{
                            display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 8px',
                            borderRadius: 8, cursor: 'pointer'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,120,255,0.06)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <UploadCloud size={16} style={{ color: '#8b5cf6', flexShrink: 0, marginTop: 2 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{n.companyName}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {n.originalName}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                              {n.filingType && <span>{n.filingType} </span>}
                              {n.filingPeriod && <span>· {n.filingPeriod}</span>}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">
            {user?.role === 'admin' ? 'Admin Panel' : 'My Portal'}
          </div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/admin' || to === '/dashboard'}
              className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="theme-toggle-row">
            <span className="theme-toggle-label">{theme === 'dark' ? 'Dark Mode' : 'Light Mode'}</span>
            <ThemeToggle />
          </div>
          <div className="user-card" onClick={handleLogout} title="Click to logout">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <LogOut size={16} color="var(--text-muted)" />
          </div>
        </div>
      </aside>
    </>
  );
}
