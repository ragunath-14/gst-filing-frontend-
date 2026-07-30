import { useState, useEffect } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';
import { Bell, Plus, Trash2, CheckCircle, Clock, AlertTriangle, Building2, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const REMINDER_TYPES = ['GSTR-1','GSTR-2A','GSTR-3B','GSTR-9','GSTR-9C','CMP-08','TDS Return','Income Tax','Other'];

export default function AdminReminders() {
  const [reminders, setReminders] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ companyId: '', title: '', description: '', filingType: 'GSTR-3B', dueDate: '', filingPeriod: '', priority: 'medium' });
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, cRes] = await Promise.all([
        api.get('/admin/reminders'),
        api.get('/admin/companies')
      ]);
      setReminders(rRes.data.reminders);
      setCompanies(cRes.data.companies);
    } catch { toast.error('Failed to load reminders'); }
    finally { setLoading(false); }
  };

  useEffect(() => { (async () => { await fetchData(); })(); }, []);

  const typeScoped = reminders.filter(r => typeFilter === 'all' || r.filingType === typeFilter);

  const filtered = typeScoped.filter(r => {
    const matchStatus = filter === 'all' || r.status === filter;
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.companyId?.companyName?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const availableTypes = ['all', ...REMINDER_TYPES.filter(t => reminders.some(r => r.filingType === t))];
  const typeCounts = availableTypes.reduce((acc, t) => {
    acc[t] = t === 'all' ? reminders.length : reminders.filter(r => r.filingType === t).length;
    return acc;
  }, {});

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.companyId || !form.title || !form.dueDate) return toast.error('Company, title and due date required');
    setSubmitting(true);
    try {
      await api.post('/admin/reminders', form);
      toast.success('Reminder added!');
      setShowModal(false);
      setForm({ companyId: '', title: '', description: '', filingType: 'GSTR-3B', dueDate: '', filingPeriod: '', priority: 'medium' });
      fetchData();
    } catch { toast.error('Failed to add reminder'); }
    finally { setSubmitting(false); }
  };

  const handleMarkComplete = async (id) => {
    try {
      await api.put(`/admin/reminders/${id}`, { status: 'completed' });
      toast.success('Marked complete');
      fetchData();
    } catch { toast.error('Update failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete reminder?')) return;
    try {
      await api.delete(`/admin/reminders/${id}`);
      toast.success('Deleted');
      setReminders(prev => prev.filter(r => r._id !== id));
    } catch { toast.error('Delete failed'); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const daysLeft = (d, status) => {
    if (status === 'completed') return null;
    const diff = Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
    if (diff < 0) return <span className="text-danger" style={{ fontSize: 12, fontWeight: 600 }}>{Math.abs(diff)}d overdue</span>;
    if (diff === 0) return <span style={{ color: 'var(--danger)', fontSize: 12, fontWeight: 600 }}>Due today!</span>;
    return <span style={{ color: diff <= 3 ? 'var(--danger)' : diff <= 7 ? 'var(--warning)' : 'var(--success)', fontSize: 12, fontWeight: 600 }}>{diff}d left</span>;
  };

  const counts = { all: typeScoped.length, pending: typeScoped.filter(r => r.status === 'pending').length, overdue: typeScoped.filter(r => r.status === 'overdue').length, completed: typeScoped.filter(r => r.status === 'completed').length };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">All Reminders</div>
            <div className="topbar-subtitle">Filing deadlines across all companies</div>
          </div>
          <div className="topbar-actions">
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="Search reminders..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Reminder</button>
          </div>
        </div>

        <div className="page-content">
          {/* Return Type Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {availableTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={`btn btn-sm ${typeFilter === t ? 'btn-primary' : 'btn-secondary'}`}>
                {t === 'all' ? 'All Returns' : t}
                <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 10, fontSize: 11 }}>{typeCounts[t]}</span>
              </button>
            ))}
          </div>

          {/* Status Filter Tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {['all', 'pending', 'overdue', 'completed'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-secondary'}`}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
                <span style={{ marginLeft: 6, background: 'rgba(255,255,255,0.2)', padding: '1px 6px', borderRadius: 10, fontSize: 11 }}>{counts[s]}</span>
              </button>
            ))}
          </div>

          {loading ? <div className="loading-spinner"><div className="spinner"></div></div>
            : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Bell size={28} /></div>
                <h3>No reminders</h3>
                <p>Add filing reminders for your companies</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filtered.map(r => (
                  <div key={r._id} className={`reminder-item ${r.status}`}>
                    <div className={`reminder-icon ${r.status}`}>
                      {r.status === 'completed' ? <CheckCircle size={16} />
                        : r.status === 'overdue' ? <AlertTriangle size={16} />
                          : <Clock size={16} />}
                    </div>
                    <div className="reminder-info">
                      <div className="reminder-title" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        {r.title}
                        <span className={`priority-dot ${r.priority}`}></span>
                        <span className={`badge badge-${r.status}`} style={{ fontSize: 11 }}>{r.status}</span>
                        {r.recurring && <span className="badge badge-purple" style={{ fontSize: 11 }} title="Auto-generated compliance reminder">Auto</span>}
                      </div>
                      <div className="reminder-meta">
                        <Building2 size={12} style={{ display: 'inline', marginRight: 4 }} />
                        {r.companyId?.companyName} · {r.filingType} · {r.filingPeriod} · Due: {formatDate(r.dueDate)}
                      </div>
                      {r.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.description}</div>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                      {daysLeft(r.dueDate, r.status)}
                      <div className="reminder-actions">
                        {r.status !== 'completed' && (
                          <button className="btn btn-success btn-sm" onClick={() => handleMarkComplete(r._id)}><CheckCircle size={14} /></button>
                        )}
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(r._id)}><Trash2 size={14} /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add Reminder</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Company *</label>
                  <select className="form-select" value={form.companyId} onChange={e => setForm(f => ({ ...f, companyId: e.target.value }))} required>
                    <option value="">Select Company</option>
                    {companies.map(c => <option key={c._id} value={c._id}>{c.companyName}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="GSTR-3B April 2025 Filing" required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Filing Type</label>
                    <select className="form-select" value={form.filingType} onChange={e => setForm(f => ({ ...f, filingType: e.target.value }))}>
                      {REMINDER_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date *</label>
                    <input className="form-input" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Period</label>
                    <input className="form-input" value={form.filingPeriod} onChange={e => setForm(f => ({ ...f, filingPeriod: e.target.value }))} placeholder="April 2025" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="form-group form-full">
                    <label className="form-label">Description</label>
                    <textarea className="form-textarea" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes..." />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : <><Bell size={16} /> Add Reminder</>}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
