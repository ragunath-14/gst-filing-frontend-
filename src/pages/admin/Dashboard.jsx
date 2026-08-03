import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';
import { useAuth } from '../../context/useAuth';
import { uploadFileToBlob, uploadFilesToBlob } from '../../utils/blobUpload';
import {
  Building2, Bell, AlertTriangle,
  Clock, ChevronRight, Plus, Upload,
  Zap, CheckCircle, XCircle, ArrowRight, Sparkles, X
} from 'lucide-react';
import toast from 'react-hot-toast';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const YEARS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());
const FILING_TYPES = ['GSTR-1','GSTR-2A','GSTR-3B','GSTR-9','GSTR-9C','CMP-08','Other'];

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  // Manual upload modal state
  const [companies, setCompanies] = useState([]);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    companyId: '',
    filingMonth: new Date().toLocaleString('en-US', { month: 'long' }),
    filingYear: new Date().getFullYear().toString(),
    filingType: 'GSTR-3B',
    financialYear: '',
    description: ''
  });

  // Smart upload state
  const [showSmartUpload, setShowSmartUpload] = useState(false);
  const [smartUploading, setSmartUploading] = useState(false);
  const [smartFiles, setSmartFiles] = useState([]);
  const [smartResults, setSmartResults] = useState(null);
  const [smartSummary, setSmartSummary] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const smartFileInputRef = useRef(null);

  // Manual assign state for unmatched files (per-file company selection)
  const [manualAssigns, setManualAssigns] = useState({});
  const [manualUploading, setManualUploading] = useState({});

  const refreshStats = async () => {
    try {
      const r = await api.get('/admin/stats');
      setStats(r.data.stats);
    } catch { /* silently ignore stats load error */ }
  };

  useEffect(() => {
    (async () => { await refreshStats(); setLoading(false); })();
  }, []);

  // ─── MANUAL UPLOAD (existing) ──────────────────────────────────────────
  const openUploadModal = async () => {
    try {
      const res = await api.get('/admin/companies');
      setCompanies(res.data.companies);
      setShowUpload(true);
    } catch {
      toast.error('Failed to load companies');
    }
  };

  const handleFileChange = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    const toastId = toast.loading('Extracting & analyzing report...');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await api.post('/admin/files/analyze', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        toast.success('Report details auto-filled!', { id: toastId });
        setUploadForm(f => ({
          ...f,
          companyId: res.data.matchedCompanyId || f.companyId,
          filingMonth: res.data.filingMonth || f.filingMonth,
          filingYear: res.data.filingYear || f.filingYear,
          filingType: res.data.filingType || f.filingType,
          financialYear: res.data.financialYear || f.financialYear,
          description: res.data.gst_no !== 'UNKNOWN' ? `Auto-extracted GSTIN: ${res.data.gst_no}` : f.description
        }));
      } else {
        toast.dismiss(toastId);
      }
    } catch {
      toast.error('Analysis failed, please fill fields manually.', { id: toastId });
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadForm.companyId) return toast.error('Please select a company');
    if (!selectedFile) return toast.error('Please select a file');

    setUploading(true);
    try {
      const blob = await uploadFileToBlob(selectedFile);
      const res = await api.post(`/admin/files/upload/${uploadForm.companyId}`, {
        blobUrl: blob.url,
        originalName: selectedFile.name,
        mimeType: selectedFile.type,
        filingPeriod: `${uploadForm.filingMonth} ${uploadForm.filingYear}`,
        filingType: uploadForm.filingType,
        financialYear: uploadForm.financialYear,
        description: uploadForm.description,
      });
      if (res.data.duplicate) {
        toast(`Uploaded, but this looks like a duplicate of "${res.data.duplicateOf?.originalName}" already on file for this period`, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success('File uploaded successfully!');
      }
      setShowUpload(false);
      setSelectedFile(null);
      setUploadForm({
        companyId: '',
        filingMonth: new Date().toLocaleString('en-US', { month: 'long' }),
        filingYear: new Date().getFullYear().toString(),
        filingType: 'GSTR-3B',
        financialYear: '',
        description: ''
      });
      refreshStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ─── SMART UPLOAD ──────────────────────────────────────────────────────
  const openSmartUpload = async () => {
    // Pre-fetch companies for the manual-assign fallback
    try {
      const res = await api.get('/admin/companies');
      setCompanies(res.data.companies);
    } catch { /* silently ignore prefetch error */ }
    setSmartFiles([]);
    setSmartResults(null);
    setSmartSummary(null);
    setManualAssigns({});
    setManualUploading({});
    setShowSmartUpload(true);
  };

  const handleSmartFilesSelected = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    const filesArray = Array.from(fileList);
    setSmartFiles(prev => [...prev, ...filesArray]);
  };

  const removeSmartFile = (index) => {
    setSmartFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSmartUploadSubmit = async () => {
    if (smartFiles.length === 0) return toast.error('Please select at least one file');

    setSmartUploading(true);
    setSmartResults(null);
    setSmartSummary(null);

    try {
      const uploaded = await uploadFilesToBlob(smartFiles);
      const results = [];
      const okFiles = [];
      for (const u of uploaded) {
        if (u.error) {
          results.push({
            fileName: u.file.name, status: 'error', error: u.error.message || 'Upload to storage failed',
            companyName: null, companyId: null, gstin: null, filingType: null, filingPeriod: null,
            financialYear: null, fileId: null, duplicate: false, duplicateOf: null,
          });
        } else {
          okFiles.push(u);
        }
      }

      if (okFiles.length > 0) {
        const res = await api.post('/admin/files/auto-upload', {
          files: okFiles.map(u => ({ blobUrl: u.blob.url, originalName: u.file.name, mimeType: u.file.type })),
        });
        results.push(...res.data.results);
      }

      const summary = {
        total: results.length,
        uploaded: results.filter(r => r.status === 'uploaded').length,
        noMatch: results.filter(r => r.status === 'no_match').length,
        errors: results.filter(r => r.status === 'error').length,
        duplicates: results.filter(r => r.duplicate).length,
      };
      setSmartResults(results);
      setSmartSummary(summary);

      if (summary.uploaded > 0) {
        toast.success(`${summary.uploaded} file(s) auto-uploaded successfully!`);
        refreshStats();
      }
      if (summary.noMatch > 0) {
        toast(`${summary.noMatch} file(s) need manual assignment`, { icon: '⚠️' });
      }
      if (summary.errors > 0) {
        toast.error(`${summary.errors} file(s) had errors`);
      }
      if (summary.duplicates > 0) {
        toast(`${summary.duplicates} file(s) look like duplicates of files already on record`, { icon: '⚠️', duration: 6000 });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Auto-upload failed');
    } finally {
      setSmartUploading(false);
    }
  };

  const handleManualAssign = async (resultIndex) => {
    const result = smartResults[resultIndex];
    const companyId = manualAssigns[resultIndex];
    if (!companyId) return toast.error('Please select a company');

    // The file is already sitting in Vercel Blob from the initial smart-upload
    // attempt (result.filePath) — no need to re-upload it, just re-run
    // completion against the manually-chosen company.
    if (!result.filePath) return toast.error('Original upload not found. Please use manual upload.');

    setManualUploading(prev => ({ ...prev, [resultIndex]: true }));

    try {
      const uploadRes = await api.post(`/admin/files/upload/${companyId}`, {
        blobUrl: result.filePath,
        originalName: result.fileName,
        mimeType: '',
        filingPeriod: result.filingPeriod || `${new Date().toLocaleString('en-US', { month: 'long' })} ${new Date().getFullYear()}`,
        filingType: result.filingType || 'GSTR-3B',
        financialYear: result.financialYear || '',
        description: result.gstin && result.gstin !== 'UNKNOWN'
          ? `Manually assigned · GSTIN from file: ${result.gstin}`
          : 'Manually assigned',
      });
      if (uploadRes.data.duplicate) {
        toast(`Uploaded, but this looks like a duplicate of "${uploadRes.data.duplicateOf?.originalName}" already on file for this period`, { icon: '⚠️', duration: 6000 });
      } else {
        toast.success(`${result.fileName} uploaded successfully!`);
      }
      // Update the result status locally
      setSmartResults(prev => prev.map((r, i) =>
        i === resultIndex
          ? { ...r, status: 'uploaded', companyName: companies.find(c => c._id === companyId)?.companyName || 'Assigned', duplicate: uploadRes.data.duplicate, duplicateOf: uploadRes.data.duplicateOf }
          : r
      ));
      setSmartSummary(prev => ({
        ...prev,
        uploaded: prev.uploaded + 1,
        noMatch: prev.noMatch - 1
      }));
      refreshStats();
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Upload failed');
    } finally {
      setManualUploading(prev => ({ ...prev, [resultIndex]: false }));
    }
  };

  // ─── HELPERS ───────────────────────────────────────────────────────────
  const statCards = stats ? [
    { label: 'Total Companies', value: stats.totalCompanies, icon: Building2, color: 'blue' },
    { label: 'Overdue Filings', value: stats.overdueReminders, icon: AlertTriangle, color: 'red' },
    { label: 'GSTR-1 Pending', value: stats.gstr1Pending, icon: Clock, color: 'yellow' },
    { label: 'GSTR-3B Pending', value: stats.gstr3bPending, icon: Clock, color: 'yellow' },
  ] : [];

  const getFileIcon = (name) => {
    const ext = name ? name.split('.').pop()?.toLowerCase() : '';
    if (ext === 'pdf') return '📄';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    return '📁';
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const daysUntil = (d) => Math.ceil((new Date(d) - new Date()) / (1000 * 60 * 60 * 24));
  const isUrgent = (d) => { const diff = daysUntil(d); return diff >= 0 && diff <= 5; };
  const daysLeft = (d) => {
    const diff = daysUntil(d);
    if (diff < 0) return <span className="text-danger">{Math.abs(diff)}d overdue</span>;
    if (diff === 0) return <span style={{ color: 'var(--danger)' }}>Due today!</span>;
    return <span style={{ color: diff <= 5 ? 'var(--danger)' : 'var(--warning)' }}>{diff}d left</span>;
  };

  const getStatusIcon = (status) => {
    if (status === 'uploaded') return <CheckCircle size={18} style={{ color: '#10b981' }} />;
    if (status === 'no_match') return <AlertTriangle size={18} style={{ color: '#f59e0b' }} />;
    return <XCircle size={18} style={{ color: '#ef4444' }} />;
  };

  const getStatusBadge = (status) => {
    if (status === 'uploaded') return <span className="badge badge-active">Auto-Filed</span>;
    if (status === 'no_match') return <span className="badge badge-overdue" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>Needs Assignment</span>;
    return <span className="badge badge-overdue">Error</span>;
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">Dashboard</div>
            <div className="topbar-subtitle">Welcome back, {user?.name}</div>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-primary" onClick={openSmartUpload}
              style={{ marginRight: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}>
              <Zap size={16} /> Smart Upload
            </button>
            <button className="btn btn-secondary" style={{ marginRight: 8 }} onClick={openUploadModal}>
              <Upload size={16} /> Manual Upload
            </button>
            <button className="btn btn-primary" onClick={() => navigate('/admin/companies')}>
              <Plus size={16} /> Add Company
            </button>
          </div>
        </div>

        <div className="page-content">
          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : (
            <>
              {/* Stats */}
              <div className="stats-grid">
                {statCards.map((s) => (
                  <div key={s.label} className={`stat-card ${s.color}`}>
                    <div className={`stat-icon ${s.color}`}><s.icon /></div>
                    <div className="stat-value">{s.value}</div>
                    <div className="stat-label">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Two columns */}
              <div className="two-col-grid">
                {/* Company Filing Status */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Company Filing Status</div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/companies')}>
                      View All <ChevronRight size={14} />
                    </button>
                  </div>
                  {stats?.companyPendingStatus?.length === 0 ? (
                    <div className="empty-state" style={{ padding: 30 }}>
                      <div className="empty-icon"><CheckCircle size={24} /></div>
                      <p>No pending GSTR-1 / GSTR-3B filings</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {stats?.companyPendingStatus?.map(c => (
                        <div key={c.companyId} className="file-item" style={{ cursor: 'pointer' }}
                          onClick={() => navigate(`/admin/companies/${c.companyId}`)}>
                          <div className="file-icon" style={{ fontSize: 16, background: 'var(--info-bg)' }}>
                            <Building2 size={18} />
                          </div>
                          <div className="file-info">
                            <div className="file-name">{c.companyName}</div>
                            <div className="file-meta">{c.gstin}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {c.gstr1Pending > 0 && (
                              <span className="badge badge-overdue" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                                GSTR-1: {c.gstr1Pending}
                              </span>
                            )}
                            {c.gstr3bPending > 0 && (
                              <span className="badge badge-overdue">
                                GSTR-3B: {c.gstr3bPending}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Upcoming Reminders */}
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Upcoming Deadlines</div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin/reminders')}>
                      View All <ChevronRight size={14} />
                    </button>
                  </div>
                  {stats?.upcomingReminders?.length === 0 ? (
                    <div className="empty-state" style={{ padding: 30 }}>
                      <div className="empty-icon"><Bell size={24} /></div>
                      <p>No upcoming deadlines</p>
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
                            <div className="reminder-meta">
                              {r.companyId?.companyName} · {r.filingType} · Due {formatDate(r.dueDate)}
                            </div>
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                            {daysLeft(r.dueDate)}
                          </div>
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

      {/* ─── SMART UPLOAD MODAL ─────────────────────────────────────────── */}
      {showSmartUpload && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !smartUploading && setShowSmartUpload(false)}>
          <div className="modal" style={{ maxWidth: 720 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Zap size={16} color="#fff" />
                </div>
                <div>
                  <div className="modal-title" style={{ margin: 0 }}>Smart Upload</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Auto-detect company & file to the right section
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => !smartUploading && setShowSmartUpload(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* PHASE 1: File Selection (before results) */}
              {!smartResults && (
                <>
                  {/* Drop Zone */}
                  <div
                    className="upload-area"
                    style={{
                      border: dragOver ? '2px solid #6366f1' : '2px dashed rgba(99,120,255,0.3)',
                      background: dragOver ? 'rgba(99,120,255,0.08)' : 'rgba(99,120,255,0.03)',
                      padding: '32px 20px',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => smartFileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOver(false);
                      handleSmartFilesSelected(e.dataTransfer.files);
                    }}
                  >
                    <input
                      ref={smartFileInputRef}
                      type="file"
                      multiple
                      style={{ display: 'none' }}
                      accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.png,.txt"
                      onChange={e => { handleSmartFilesSelected(Array.from(e.target.files || [])); e.target.value = ''; }}
                    />
                    <div style={{ textAlign: 'center' }}>
                      <div style={{
                        width: 56, height: 56, borderRadius: 16, margin: '0 auto 12px',
                        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Sparkles size={24} style={{ color: '#8b5cf6' }} />
                      </div>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 15, marginBottom: 4 }}>
                        Drop files here or click to browse
                      </p>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        PDF, Excel, CSV, Word, Images, Text · Multiple files supported · Max 20MB each
                      </p>
                    </div>
                  </div>

                  {/* Selected Files List */}
                  {smartFiles.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {smartFiles.length} file{smartFiles.length > 1 ? 's' : ''} selected
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                        {smartFiles.map((f, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', borderRadius: 8,
                            background: 'rgba(99,120,255,0.04)',
                            border: '1px solid rgba(99,120,255,0.1)'
                          }}>
                            <span style={{ fontSize: 16 }}>{getFileIcon(f.name)}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {(f.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeSmartFile(i); }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: 'var(--text-muted)', padding: 4, borderRadius: 4,
                                display: 'flex', alignItems: 'center'
                              }}
                              title="Remove file"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* PHASE 2: Results */}
              {smartResults && (
                <div>
                  {/* Summary Bar */}
                  <div style={{
                    display: 'flex', gap: 12, marginBottom: 16, padding: '12px 16px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06))',
                    border: '1px solid rgba(99,120,255,0.12)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Total:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{smartSummary.total}</span>
                    </div>
                    {smartSummary.uploaded > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                        <CheckCircle size={14} style={{ color: '#10b981' }} />
                        <span style={{ color: '#10b981' }}>{smartSummary.uploaded} filed</span>
                      </div>
                    )}
                    {smartSummary.noMatch > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                        <AlertTriangle size={14} style={{ color: '#f59e0b' }} />
                        <span style={{ color: '#f59e0b' }}>{smartSummary.noMatch} unmatched</span>
                      </div>
                    )}
                    {smartSummary.errors > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                        <XCircle size={14} style={{ color: '#ef4444' }} />
                        <span style={{ color: '#ef4444' }}>{smartSummary.errors} error{smartSummary.errors > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {smartSummary.duplicates > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                        <span>⚠️</span>
                        <span style={{ color: '#f59e0b' }}>{smartSummary.duplicates} possible duplicate{smartSummary.duplicates > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  {/* Per-file Results */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                    {smartResults.map((r, i) => (
                      <div key={i} style={{
                        padding: '14px 16px', borderRadius: 10,
                        background: r.status === 'uploaded'
                          ? 'rgba(16,185,129,0.04)'
                          : r.status === 'no_match'
                            ? 'rgba(245,158,11,0.04)'
                            : 'rgba(239,68,68,0.04)',
                        border: `1px solid ${r.status === 'uploaded' ? 'rgba(16,185,129,0.15)' : r.status === 'no_match' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)'}`,
                        transition: 'all 0.2s ease'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ marginTop: 2, flexShrink: 0 }}>{getStatusIcon(r.status)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.fileName}</span>
                              {getStatusBadge(r.status)}
                              {r.duplicate && (
                                <span className="badge badge-overdue" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>⚠️ Possible Duplicate</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                              {r.companyName && (
                                <span>📍 <strong style={{ color: 'var(--text-secondary)' }}>{r.companyName}</strong></span>
                              )}
                              {r.gstin && r.gstin !== 'UNKNOWN' && (
                                <span>🔖 GSTIN: {r.gstin}</span>
                              )}
                              {r.filingType && (
                                <span>📋 {r.filingType}</span>
                              )}
                              {r.filingPeriod && (
                                <span>📅 {r.filingPeriod}</span>
                              )}
                              {r.financialYear && (
                                <span>📊 FY {r.financialYear}</span>
                              )}
                            </div>
                            {r.error && r.status !== 'uploaded' && (
                              <div style={{ fontSize: 12, color: r.status === 'no_match' ? '#f59e0b' : '#ef4444', marginTop: 4, fontStyle: 'italic' }}>
                                {r.error}
                              </div>
                            )}
                            {r.duplicate && r.duplicateOf && (
                              <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, fontStyle: 'italic' }}>
                                Matches an existing file for this period: "{r.duplicateOf.originalName}"
                              </div>
                            )}

                            {/* Manual assign for unmatched */}
                            {r.status === 'no_match' && (
                              <div style={{
                                display: 'flex', alignItems: 'center', gap: 8, marginTop: 10,
                                padding: '8px 10px', borderRadius: 8,
                                background: 'rgba(245,158,11,0.06)',
                                border: '1px solid rgba(245,158,11,0.1)'
                              }}>
                                <select
                                  className="form-select"
                                  style={{ flex: 1, fontSize: 13, padding: '6px 10px' }}
                                  value={manualAssigns[i] || ''}
                                  onChange={e => setManualAssigns(prev => ({ ...prev, [i]: e.target.value }))}
                                >
                                  <option value="">Assign to company...</option>
                                  {companies.map(c => (
                                    <option key={c._id} value={c._id}>{c.companyName} ({c.gstin})</option>
                                  ))}
                                </select>
                                <button
                                  className="btn btn-primary btn-sm"
                                  style={{ flexShrink: 0, fontSize: 12, padding: '6px 12px' }}
                                  disabled={!manualAssigns[i] || manualUploading[i]}
                                  onClick={() => handleManualAssign(i)}
                                >
                                  {manualUploading[i] ? 'Uploading...' : <><ArrowRight size={13} /> Assign & Upload</>}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {!smartResults ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowSmartUpload(false)}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    disabled={smartFiles.length === 0 || smartUploading}
                    onClick={handleSmartUploadSubmit}
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
                  >
                    {smartUploading ? (
                      <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6 }}></div> Analyzing & Uploading...</>
                    ) : (
                      <><Zap size={16} /> Auto-Upload {smartFiles.length > 0 ? `(${smartFiles.length})` : ''}</>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setSmartResults(null);
                    setSmartSummary(null);
                    setSmartFiles([]);
                    setManualAssigns({});
                  }}>
                    Upload More
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowSmartUpload(false)}>
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── MANUAL UPLOAD MODAL (existing) ────────────────────────────── */}
      {showUpload && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUpload(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Upload GST Document</div>
              <button className="modal-close" onClick={() => setShowUpload(false)}>✕</button>
            </div>
            <form onSubmit={handleUploadSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Client Company *</label>
                  <select
                    className="form-select"
                    value={uploadForm.companyId}
                    onChange={e => setUploadForm(f => ({ ...f, companyId: e.target.value }))}
                    required
                  >
                    <option value="">Select Company</option>
                    {companies.map(c => (
                      <option key={c._id} value={c._id}>{c.companyName} ({c.gstin})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Select File *</label>
                  <div className="upload-area" onClick={() => document.getElementById('dashFileInput').click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]); }}>
                    <input id="dashFileInput" type="file" style={{ display: 'none' }}
                      accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.png"
                      onChange={e => handleFileChange(e.target.files[0])} />
                    <div className="upload-icon"><Upload size={28} /></div>
                    {selectedFile ? (
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedFile.name}</p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Drop file here or click to browse</p>
                        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>PDF, Excel, CSV, Word, Images (max 20MB)</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Filing Month *</label>
                    <select
                      className="form-select"
                      value={uploadForm.filingMonth}
                      onChange={e => setUploadForm(f => ({ ...f, filingMonth: e.target.value }))}
                      required
                    >
                      {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Filing Year *</label>
                    <select
                      className="form-select"
                      value={uploadForm.filingYear}
                      onChange={e => setUploadForm(f => ({ ...f, filingYear: e.target.value }))}
                      required
                    >
                      {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Filing Type</label>
                    <select className="form-select" value={uploadForm.filingType} onChange={e => setUploadForm(f => ({ ...f, filingType: e.target.value }))}>
                      {FILING_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Financial Year</label>
                    <input className="form-input" value={uploadForm.financialYear} onChange={e => setUploadForm(f => ({ ...f, financialYear: e.target.value }))} placeholder="e.g. 2025-26" />
                  </div>
                  <div className="form-group form-full">
                    <label className="form-label">Description</label>
                    <input className="form-input" value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes for the client" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : <><Upload size={16} /> Upload & Share</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
