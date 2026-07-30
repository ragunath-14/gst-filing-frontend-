import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';
import { Bell, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function CompanyReminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    api.get('/company/reminders')
      .then(r => setReminders(r.data.reminders))
      .catch(() => toast.error('Failed to load reminders'))
      .finally(() => setLoading(false));
  }, []);

  const typeScoped = typeFilter === 'all' ? reminders : reminders.filter(r => r.filingType === typeFilter);
  const filtered = filter === 'all' ? typeScoped : typeScoped.filter(r => r.status === filter);

  const availableTypes = ['all', ...new Set(reminders.map(r => r.filingType))];
  const typeCounts = availableTypes.reduce((acc, t) => {
    acc[t] = t === 'all' ? reminders.length : reminders.filter(r => r.filingType === t).length;
    return acc;
  }, {});

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  const daysLeft = (d, status) => {
    if (status === 'completed') return null;
    const diff = Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
    const color = diff < 0 ? 'var(--danger)' : diff <= 3 ? 'var(--danger)' : diff <= 7 ? 'var(--warning)' : 'var(--success)';
    const label = diff < 0 ? `${Math.abs(diff)} days overdue` : diff === 0 ? 'Due today!' : `${diff} days left`;
    return (
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Due: {formatDate(d)}</div>
      </div>
    );
  };

  const counts = {
    all: typeScoped.length,
    pending: typeScoped.filter(r => r.status === 'pending').length,
    overdue: typeScoped.filter(r => r.status === 'overdue').length,
    completed: typeScoped.filter(r => r.status === 'completed').length,
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">My Reminders</div>
            <div className="topbar-subtitle">Filing deadlines set by your accountant</div>
          </div>
        </div>

        <div className="page-content">
          {/* Summary Cards */}
          <div className="stats-grid" style={{ marginBottom: 24 }}>
            {[
              { label: 'Total', value: counts.all, color: 'blue', icon: Bell },
              { label: 'Pending', value: counts.pending, color: 'yellow', icon: Clock },
              { label: 'Overdue', value: counts.overdue, color: 'red', icon: AlertTriangle },
              { label: 'Completed', value: counts.completed, color: 'green', icon: CheckCircle },
            ].map(s => (
              <div key={s.label} className={`stat-card ${s.color}`} style={{ cursor: 'pointer' }}
                onClick={() => setFilter(s.label.toLowerCase() === 'total' ? 'all' : s.label.toLowerCase())}>
                <div className={`stat-icon ${s.color}`}><s.icon size={18} /></div>
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Return Type Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {availableTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-secondary'}`}>
                {t === 'all' ? 'All Returns' : t} ({typeCounts[t]})
              </button>
            ))}
          </div>

          {/* Status Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {['all', 'pending', 'overdue', 'completed'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s] ?? counts.all})
              </button>
            ))}
          </div>

          {loading ? <div className="loading-spinner"><div className="spinner"></div></div>
            : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Bell size={32} /></div>
                <h3>No reminders</h3>
                <p>Your accountant hasn't set any filing reminders yet.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filtered.map(r => (
                  <div key={r._id} className={`reminder-item ${r.status}`} style={{ padding: 18 }}>
                    <div className={`reminder-icon ${r.status}`} style={{ width: 44, height: 44 }}>
                      {r.status === 'completed' ? <CheckCircle size={20} />
                        : r.status === 'overdue' ? <AlertTriangle size={20} />
                          : <Clock size={20} />}
                    </div>
                    <div className="reminder-info">
                      <div className="reminder-title" style={{ fontSize: 15, display: 'flex', alignItems: 'center', gap: 10 }}>
                        {r.title}
                        <span className={`priority-dot ${r.priority}`} title={r.priority + ' priority'}></span>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                        <span className="badge badge-purple">{r.filingType}</span>
                        {r.filingPeriod && <span className="badge badge-info">{r.filingPeriod}</span>}
                        <span className={`badge badge-${r.status}`}>{r.status}</span>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
                          Priority: <span style={{ marginLeft: 4, fontWeight: 600, color: r.priority === 'high' ? 'var(--danger)' : r.priority === 'medium' ? 'var(--warning)' : 'var(--success)' }}>
                            {r.priority}
                          </span>
                        </span>
                      </div>
                      {r.description && (
                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>{r.description}</div>
                      )}
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      {daysLeft(r.dueDate, r.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>
    </div>
  );
}
