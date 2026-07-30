import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';
import { useAuth } from '../../context/useAuth';
import {
  FileText, Bell, Clock, AlertTriangle, CheckCircle,
  ChevronRight, Download
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function CompanyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/company/stats'),
      api.get('/company/profile')
    ]).then(([sRes, pRes]) => {
      setStats(sRes.data.stats);
      setCompany(pRes.data.company);
    }).catch(() => toast.error('Failed to load data'))
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
  const isUrgent = (d) => { const diff = daysUntil(d); return diff >= 0 && diff <= 5; };
  const daysLeft = (d) => {
    const diff = daysUntil(d);
    if (diff < 0) return <span className="text-danger">{Math.abs(diff)}d overdue</span>;
    if (diff === 0) return <span style={{ color: 'var(--danger)' }}>Due today!</span>;
    return <span style={{ color: diff <= 5 ? 'var(--danger)' : diff <= 7 ? 'var(--warning)' : 'var(--success)' }}>{diff}d left</span>;
  };

  const getFileEmoji = (name) => {
    const ext = name ? name.split('.').pop()?.toLowerCase() : '';
    if (ext === 'pdf') return '📄';
    if (['xls','xlsx','csv'].includes(ext)) return '📊';
    return '📁';
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">My Dashboard</div>
            <div className="topbar-subtitle">Welcome, {user?.name}</div>
          </div>
        </div>

        <div className="page-content">
          {loading ? <div className="loading-spinner"><div className="spinner"></div></div> : (
            <>
              {/* Company Profile Card */}
              {company && (
                <div className="card" style={{ marginBottom: 24, background: 'linear-gradient(135deg, rgba(99,120,255,0.1), rgba(139,92,246,0.05))', borderColor: 'rgba(99,120,255,0.25)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--accent-gradient)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'white', flexShrink: 0 }}>
                      {company.companyName[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>{company.companyName}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: 2 }}>GSTIN: {company.gstin}</div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
                        {company.businessType && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>🏢 {company.businessType}</span>}
                        {company.state && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📍 {company.state}</span>}
                        {company.email && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>✉️ {company.email}</span>}
                        {company.phone && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>📞 {company.phone}</span>}
                        <span className={`badge badge-${company.status}`}>{company.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="stats-grid" style={{ marginBottom: 24 }}>
                {[
                  { label: 'Total Documents', value: stats?.totalFiles ?? 0, icon: FileText, color: 'blue' },
                  { label: 'Pending Filings', value: stats?.pendingReminders ?? 0, icon: Clock, color: 'yellow' },
                  { label: 'Overdue Filings', value: stats?.overdueReminders ?? 0, icon: AlertTriangle, color: 'red' },
                  { label: 'Completed', value: stats?.completedReminders ?? 0, icon: CheckCircle, color: 'green' },
                ].map(s => (
                  <div key={s.label} className={`stat-card ${s.color}`}>
                    <div className={`stat-icon ${s.color}`}><s.icon size={20} /></div>
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Two Columns */}
              <div className="two-col-grid">
                {/* Recent Documents */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Recent Documents</div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/documents')}>
                      View All <ChevronRight size={14} />
                    </button>
                  </div>
                  {stats?.recentFiles?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      <FileText size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                      <p style={{ fontSize: 14 }}>No documents uploaded yet</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {stats?.recentFiles?.map(f => (
                        <div key={f._id} className="file-item">
                          <div style={{ fontSize: 22 }}>{getFileEmoji(f.originalName)}</div>
                          <div className="file-info">
                            <div className="file-name">{f.originalName}</div>
                            <div className="file-meta">{f.filingType} · {f.filingPeriod} · {formatDate(f.createdAt)}</div>
                          </div>
                          <a href={`/${f.filePath}`} target="_blank" rel="noreferrer">
                            <button className="btn btn-secondary btn-sm"><Download size={14} /></button>
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming Deadlines */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Upcoming Deadlines</div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/reminders')}>
                      View All <ChevronRight size={14} />
                    </button>
                  </div>
                  {stats?.upcomingReminders?.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                      <Bell size={28} style={{ marginBottom: 8, opacity: 0.4 }} />
                      <p style={{ fontSize: 14 }}>No upcoming deadlines</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {stats?.upcomingReminders?.map(r => (
                        <div key={r._id} className={`reminder-item pending${isUrgent(r.dueDate) ? ' urgent' : ''}`}>
                          <div className={`reminder-icon ${isUrgent(r.dueDate) ? 'overdue' : 'pending'}`}><Bell size={16} /></div>
                          <div className="reminder-info">
                            <div className="reminder-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              {r.title}
                              {isUrgent(r.dueDate) && <span className="urgent-badge"><AlertTriangle size={11} /> Urgent</span>}
                            </div>
                            <div className="reminder-meta">{r.filingType} · Due {formatDate(r.dueDate)}</div>
                          </div>
                          <div style={{ flexShrink: 0, fontSize: 12, fontWeight: 600 }}>{daysLeft(r.dueDate)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
