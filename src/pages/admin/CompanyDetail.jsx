import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';
import {
  ArrowLeft, Upload, Trash2, Download, Bell, Plus, Pencil,
  FileText, CheckCircle, Clock, AlertTriangle, Zap, Sparkles, X, XCircle,
  Eye, EyeOff, KeyRound, UploadCloud
} from 'lucide-react';
import toast from 'react-hot-toast';
import { groupFilesByYearTypeMonth } from '../../utils/fileGrouping';
import { downloadFile } from '../../utils/downloadFile';
import { uploadFileToBlob, uploadFilesToBlob } from '../../utils/blobUpload';

const FILING_TYPES = ['GSTR-1','GSTR-2A','GSTR-3B','GSTR-9','GSTR-9C','CMP-08','Other'];
const REMINDER_TYPES = ['GSTR-1','GSTR-2A','GSTR-3B','GSTR-9','GSTR-9C','CMP-08','TDS Return','Income Tax','Other'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const YEARS = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - 2 + i).toString());
const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh'];
const BUSINESS_TYPES = ['Proprietorship','Partnership','LLP','Private Limited','Public Limited','Other'];
const RETURN_SERVICE_DUE_DATES = {
  'GSTR-1': 'Due 11th of every month',
  'GSTR-3B': 'Due 20th of every month',
};
const RETURN_SERVICE_DEFAULT_NOTE = 'No fixed due date — add reminders manually';

export default function AdminCompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [company, setCompany] = useState(null);
  const [files, setFiles] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [reminderTypeFilter, setReminderTypeFilter] = useState('all');
  const [tab, setTab] = useState('files');
  const [loading, setLoading] = useState(true);

  // Upload state
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    filingMonth: new Date().toLocaleString('en-US', { month: 'long' }),
    filingYear: new Date().getFullYear().toString(),
    filingType: 'GSTR-3B',
    financialYear: '',
    description: ''
  });
  const [selectedFile, setSelectedFile] = useState(null);

  // Smart bulk upload state
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkFiles, setBulkFiles] = useState([]);
  const [bulkResults, setBulkResults] = useState(null);
  const [bulkSummary, setBulkSummary] = useState(null);
  const [bulkDragOver, setBulkDragOver] = useState(false);
  const bulkFileInputRef = useRef(null);

  // Reminder state
  const [showReminder, setShowReminder] = useState(false);
  const [reminderForm, setReminderForm] = useState({ title: '', description: '', filingType: 'GSTR-3B', dueDate: '', filingPeriod: '', priority: 'medium' });
  const [submittingReminder, setSubmittingReminder] = useState(false);

  // Edit company state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [showPasswords, setShowPasswords] = useState({});
  const toggleShowPassword = (k) => setShowPasswords(p => ({ ...p, [k]: !p[k] }));

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [cRes, fRes, rRes] = await Promise.all([
        api.get(`/admin/companies/${id}`),
        api.get(`/admin/files/${id}`),
        api.get(`/admin/reminders/company/${id}`)
      ]);
      setCompany(cRes.data.company);
      setFiles(fRes.data.files);
      setReminders(rRes.data.reminders);
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { (async () => { await fetchAll(); })(); }, [id]);

  const openEdit = () => {
    setEditForm({
      companyName: company.companyName || '',
      gstin: company.gstin || '',
      email: company.email || '',
      phone: company.phone || '',
      address: company.address || '',
      state: company.state || '',
      businessType: company.businessType || 'Other',
      returnServices: company.returnServices || [],
      status: company.status || 'active',
      panNo: company.panNo || '',
      gmailId: company.gmailId || '',
      gmailPassword: company.gmailPassword || '',
      gstPortalId: company.gstPortalId || '',
      gstPortalPassword: company.gstPortalPassword || '',
      ewayBillId: company.ewayBillId || '',
      ewayBillPassword: company.ewayBillPassword || ''
    });
    setShowPasswords({});
    setShowEdit(true);
  };

  const setEditField = (k) => (e) => setEditForm(f => ({ ...f, [k]: e.target.value }));

  const toggleEditReturnService = (service) => setEditForm(f => ({
    ...f,
    returnServices: f.returnServices.includes(service)
      ? f.returnServices.filter(s => s !== service)
      : [...f.returnServices, service]
  }));

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.companyName || !editForm.gstin) {
      return toast.error('Company name and GSTIN are required');
    }
    setEditSubmitting(true);
    try {
      const res = await api.put(`/admin/companies/${id}`, editForm);
      setCompany(res.data.company);
      toast.success('Company updated!');
      setShowEdit(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update company');
    } finally {
      setEditSubmitting(false);
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

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return toast.error('Please select a file');
    setUploading(true);
    try {
      const blob = await uploadFileToBlob(selectedFile);
      const res = await api.post(`/admin/files/upload/${id}`, {
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
        toast.success('File uploaded!');
      }
      setShowUpload(false);
      setSelectedFile(null);
      setUploadForm({
        filingMonth: new Date().toLocaleString('en-US', { month: 'long' }),
        filingYear: new Date().getFullYear().toString(),
        filingType: 'GSTR-3B',
        financialYear: '',
        description: ''
      });
      fetchAll();
    } catch (err) { toast.error(err.response?.data?.detail || err.message || 'Upload failed'); }
    finally { setUploading(false); }
  };

  // ─── SMART BULK UPLOAD ─────────────────────────────────────────────────
  const openBulkUpload = () => {
    setBulkFiles([]);
    setBulkResults(null);
    setBulkSummary(null);
    setShowBulkUpload(true);
  };

  const handleBulkFilesSelected = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setBulkFiles(prev => [...prev, ...Array.from(fileList)]);
  };

  const removeBulkFile = (index) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleBulkUploadSubmit = async () => {
    if (bulkFiles.length === 0) return toast.error('Please select at least one file');

    setBulkUploading(true);
    setBulkResults(null);
    setBulkSummary(null);

    try {
      const uploaded = await uploadFilesToBlob(bulkFiles);
      const results = [];
      const okFiles = [];
      for (const u of uploaded) {
        if (u.error) {
          results.push({
            fileName: u.file.name, status: 'error', error: u.error.message || 'Upload to storage failed',
            gstin: null, filingType: null, filingPeriod: null, financialYear: null, fileId: null,
            duplicate: false, duplicateOf: null,
          });
        } else {
          okFiles.push(u);
        }
      }

      if (okFiles.length > 0) {
        const res = await api.post(`/admin/files/bulk-upload/${id}`, {
          files: okFiles.map(u => ({ blobUrl: u.blob.url, originalName: u.file.name, mimeType: u.file.type })),
        });
        results.push(...res.data.results);
      }

      const summary = {
        total: results.length,
        uploaded: results.filter(r => r.status === 'uploaded').length,
        errors: results.filter(r => r.status === 'error').length,
        duplicates: results.filter(r => r.duplicate).length,
      };
      setBulkResults(results);
      setBulkSummary(summary);

      if (summary.uploaded > 0) {
        toast.success(`${summary.uploaded} file(s) auto-filed successfully!`);
        fetchAll();
      }
      if (summary.errors > 0) {
        toast.error(`${summary.errors} file(s) had errors`);
      }
      if (summary.duplicates > 0) {
        toast(`${summary.duplicates} file(s) look like duplicates of files already on record`, { icon: '⚠️', duration: 6000 });
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || 'Bulk upload failed');
    } finally {
      setBulkUploading(false);
    }
  };

  const openCompanyUploadsTab = () => {
    setTab('companyUploads');
    if (files.some(f => f.uploadedByRole === 'company' && !f.seenByAdmin)) {
      api.post(`/admin/files/${id}/mark-seen`).catch(() => {});
      setFiles(prev => prev.map(f => f.uploadedByRole === 'company' ? { ...f, seenByAdmin: true } : f));
    }
  };

  const handleDeleteFile = async (fileId) => {
    if (!confirm('Delete this file?')) return;
    try {
      await api.delete(`/admin/files/${fileId}`);
      toast.success('File deleted');
      setFiles(files.filter(f => f._id !== fileId));
    } catch { toast.error('Delete failed'); }
  };

  const handleCreateReminder = async (e) => {
    e.preventDefault();
    if (!reminderForm.title || !reminderForm.dueDate) return toast.error('Title and due date required');
    setSubmittingReminder(true);
    try {
      await api.post('/admin/reminders', { ...reminderForm, companyId: id });
      toast.success('Reminder created!');
      setShowReminder(false);
      setReminderForm({ title: '', description: '', filingType: 'GSTR-3B', dueDate: '', filingPeriod: '', priority: 'medium' });
      fetchAll();
    } catch { toast.error('Failed to create reminder'); }
    finally { setSubmittingReminder(false); }
  };

  const handleMarkComplete = async (rid) => {
    try {
      await api.put(`/admin/reminders/${rid}`, { status: 'completed' });
      toast.success('Marked as completed');
      fetchAll();
    } catch { toast.error('Update failed'); }
  };

  const handleDeleteReminder = async (rid) => {
    if (!confirm('Delete this reminder?')) return;
    try {
      await api.delete(`/admin/reminders/${rid}`);
      toast.success('Reminder deleted');
      setReminders(reminders.filter(r => r._id !== rid));
    } catch { toast.error('Delete failed'); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const formatSize = (bytes) => bytes ? (bytes / 1024 / 1024).toFixed(2) + ' MB' : '';

  const getFileIcon = (name) => {
    const ext = name ? name.split('.').pop()?.toLowerCase() : '';
    if (ext === 'pdf') return '📄';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return '📊';
    return '📁';
  };

  const getBulkStatusIcon = (status) => {
    if (status === 'uploaded') return <CheckCircle size={18} style={{ color: '#10b981' }} />;
    return <XCircle size={18} style={{ color: '#ef4444' }} />;
  };

  const getBulkStatusBadge = (status) => {
    if (status === 'uploaded') return <span className="badge badge-active">Filed</span>;
    return <span className="badge badge-overdue">Error</span>;
  };

  const companyUploadedFiles = [...files]
    .filter(f => f.uploadedByRole === 'company')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const unseenCompanyUploads = companyUploadedFiles.filter(f => !f.seenByAdmin).length;

  const reminderTypes = ['all', ...new Set(reminders.map(r => r.filingType))];
  const reminderTypeCounts = reminderTypes.reduce((acc, t) => {
    acc[t] = t === 'all' ? reminders.length : reminders.filter(r => r.filingType === t).length;
    return acc;
  }, {});
  const filteredReminders = reminderTypeFilter === 'all' ? reminders : reminders.filter(r => r.filingType === reminderTypeFilter);

  if (loading) return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="loading-spinner" style={{ marginTop: 100 }}><div className="spinner"></div></div>
      </div>
    </div>
  );

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">{company?.companyName}</div>
            <div className="topbar-subtitle">{company?.gstin} · {company?.state}</div>
          </div>
          <div className="topbar-actions">
            <button className="btn btn-secondary" onClick={openEdit}>
              <Pencil size={16} /> Edit Company
            </button>
            {tab === 'files' && (
              <>
                <button className="btn btn-primary" onClick={openBulkUpload}
                  style={{ marginRight: 8, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}>
                  <Zap size={16} /> Smart Upload
                </button>
                <button className="btn btn-secondary" onClick={() => setShowUpload(true)}>
                  <Upload size={16} /> Upload File
                </button>
              </>
            )}
            {tab === 'reminders' && (
              <button className="btn btn-primary" onClick={() => setShowReminder(true)}>
                <Plus size={16} /> Add Reminder
              </button>
            )}
          </div>
        </div>

        <div className="page-content">
          <button className="back-link" onClick={() => navigate('/admin/companies')}>
            <ArrowLeft size={16} /> Back to Companies
          </button>

          {/* Company Info Card */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 20 }}>
              {[
                ['Company', company?.companyName],
                ['GSTIN', company?.gstin],
                ['Business Type', company?.businessType],
                ['Email', company?.email || '-'],
                ['Phone', company?.phone || '-'],
                ['State', company?.state || '-'],
                ['Status', company?.status],
                ['Registered', formatDate(company?.registrationDate)],
                ['Return Services', company?.returnServices?.length ? company.returnServices.join(', ') : '-'],
                ['PAN No', company?.panNo || '-'],
              ].map(([label, val]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {label === 'Status' ? <span className={`badge badge-${val}`}>{val}</span> : val}
                  </div>
                </div>
              ))}
            </div>
            {company?.companyUserId && (
              <div style={{ marginTop: 16, padding: 12, background: 'rgba(99,120,255,0.06)', borderRadius: 10, border: '1px solid rgba(99,120,255,0.15)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>PORTAL USER: </span>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  {company.companyUserId.name} · {company.companyUserId.email} ·{' '}
                  <span className={`badge badge-${company.companyUserId.isActive ? 'active' : 'inactive'}`} style={{ fontSize: 11 }}>
                    {company.companyUserId.isActive ? 'Active' : 'Inactive'}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Portal Credentials Card — only shown once at least one is on file */}
          {(company?.gmailId || company?.gstPortalId || company?.ewayBillId) && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <KeyRound size={16} /> Portal Credentials
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 16 }}>
                {[
                  { label: 'Gmail', idVal: company?.gmailId, pwVal: company?.gmailPassword, key: 'gmailPassword' },
                  { label: 'GST Portal', idVal: company?.gstPortalId, pwVal: company?.gstPortalPassword, key: 'gstPortalPassword' },
                  { label: 'E-Way Bill', idVal: company?.ewayBillId, pwVal: company?.ewayBillPassword, key: 'ewayBillPassword' },
                ].filter(c => c.idVal || c.pwVal).map(c => (
                  <div key={c.label} style={{ padding: 12, borderRadius: 10, border: '1px solid var(--border)', background: 'rgba(99,120,255,0.02)' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>{c.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>{c.idVal || '-'}</div>
                    {c.pwVal && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {showPasswords[c.key] ? c.pwVal : '••••••••'}
                        <button onClick={() => toggleShowPassword(c.key)}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: 2 }}
                          title={showPasswords[c.key] ? 'Hide password' : 'Show password'}>
                          {showPasswords[c.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="tabs" style={{ marginBottom: 20 }}>
            <button className={`tab${tab === 'files' ? ' active' : ''}`} onClick={() => setTab('files')}>
              📄 Files ({files.length})
            </button>
            <button className={`tab${tab === 'companyUploads' ? ' active' : ''}`} onClick={openCompanyUploadsTab} style={{ position: 'relative' }}>
              📥 Company Uploads ({companyUploadedFiles.length})
              {unseenCompanyUploads > 0 && (
                <span style={{
                  marginLeft: 6, minWidth: 16, height: 16, padding: '0 3px', borderRadius: 8,
                  background: '#ef4444', color: '#fff', fontSize: 10, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1
                }}>
                  {unseenCompanyUploads > 9 ? '9+' : unseenCompanyUploads}
                </span>
              )}
            </button>
            <button className={`tab${tab === 'reminders' ? ' active' : ''}`} onClick={() => setTab('reminders')}>
              🔔 Reminders ({reminders.length})
            </button>
          </div>

          {/* Files Tab */}
          {tab === 'files' && (
            files.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><FileText size={28} /></div>
                <h3>No files uploaded</h3>
                <p>Upload GST return documents for this company</p>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                  <button className="btn btn-primary" onClick={openBulkUpload}
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}>
                    <Zap size={16} /> Smart Upload
                  </button>
                  <button className="btn btn-secondary" onClick={() => setShowUpload(true)}><Upload size={16} /> Upload File</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                {groupFilesByYearTypeMonth(files, company?.returnServices || []).map(({ year, types }) => (
                  <div key={year}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 12 }}>
                      {year}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {types.map(({ filingType, months }) => (
                        <div key={filingType} style={{
                          border: '1px solid var(--border)', borderRadius: 12, padding: 16,
                          background: 'rgba(99,120,255,0.02)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                            <span className="badge badge-purple" style={{ fontSize: 12 }}>{filingType}</span>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                              {months.reduce((n, m) => n + m.files.length, 0)} file{months.reduce((n, m) => n + m.files.length, 0) > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {months.map(({ month, files: monthFiles }) => (
                              <div key={month}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                  {month}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {monthFiles.map(f => (
                                    <div key={f._id} className="file-item">
                                      <div className="file-icon">
                                        <FileText size={20} />
                                      </div>
                                      <div className="file-info">
                                        <div className="file-name">{f.originalName}</div>
                                        <div className="file-meta">
                                          {f.filingPeriod} · {f.financialYear} · {formatSize(f.fileSize)} · {formatDate(f.createdAt)}
                                        </div>
                                        {f.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{f.description}</div>}
                                      </div>
                                      <div className="file-actions">
                                        <button
                                          className="btn btn-secondary btn-sm"
                                          title="Download file"
                                          onClick={() => downloadFile(f._id, f.originalName, 'admin')}
                                        >
                                          <Download size={14} />
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteFile(f._id)}><Trash2 size={14} /></button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Company Uploads Tab — documents the company user uploaded themselves,
              as opposed to files the admin filed on their behalf */}
          {tab === 'companyUploads' && (
            companyUploadedFiles.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><UploadCloud size={28} /></div>
                <h3>No company uploads yet</h3>
                <p>Documents this company's user uploads themselves will appear here</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {companyUploadedFiles.map(f => (
                  <div key={f._id} className="file-item">
                    <div className="file-icon">
                      <UploadCloud size={20} />
                    </div>
                    <div className="file-info">
                      <div className="file-name" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {f.originalName}
                        {!f.seenByAdmin && <span className="badge badge-overdue" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>New</span>}
                      </div>
                      <div className="file-meta">
                        {f.filingType && <>{f.filingType} · </>}{f.filingPeriod} · {f.financialYear} · {formatSize(f.fileSize)} · {formatDate(f.createdAt)}
                      </div>
                      {f.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{f.description}</div>}
                    </div>
                    <div className="file-actions">
                      <button
                        className="btn btn-secondary btn-sm"
                        title="Download file"
                        onClick={() => downloadFile(f._id, f.originalName, 'admin')}
                      >
                        <Download size={14} />
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteFile(f._id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Reminders Tab */}
          {tab === 'reminders' && (
            reminders.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Bell size={28} /></div>
                <h3>No reminders set</h3>
                <p>Add filing deadlines for this company</p>
                <button className="btn btn-primary" onClick={() => setShowReminder(true)}><Plus size={16} /> Add Reminder</button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
                  {reminderTypes.map(t => (
                    <button key={t} onClick={() => setReminderTypeFilter(t)}
                      className={`btn btn-sm ${reminderTypeFilter === t ? 'btn-primary' : 'btn-secondary'}`}>
                      {t === 'all' ? 'All Returns' : t} ({reminderTypeCounts[t]})
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {filteredReminders.map(r => (
                  <div key={r._id} className={`reminder-item ${r.status}`}>
                    <div className={`reminder-icon ${r.status}`}>
                      {r.status === 'completed' ? <CheckCircle size={16} />
                        : r.status === 'overdue' ? <AlertTriangle size={16} />
                          : <Clock size={16} />}
                    </div>
                    <div className="reminder-info">
                      <div className="reminder-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {r.title}
                        <span className={`priority-dot ${r.priority}`}></span>
                        <span className={`badge badge-${r.status}`} style={{ fontSize: 11 }}>{r.status}</span>
                        {r.recurring && <span className="badge badge-purple" style={{ fontSize: 11 }} title="Auto-generated compliance reminder">Auto</span>}
                      </div>
                      <div className="reminder-meta">
                        {r.filingType} · {r.filingPeriod} · Due: {formatDate(r.dueDate)}
                      </div>
                      {r.description && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{r.description}</div>}
                    </div>
                    <div className="reminder-actions">
                      {r.status !== 'completed' && (
                        <button className="btn btn-success btn-sm" onClick={() => handleMarkComplete(r._id)} title="Mark complete">
                          <CheckCircle size={14} />
                        </button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteReminder(r._id)}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* Smart Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !bulkUploading && setShowBulkUpload(false)}>
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
                    Upload multiple documents — filing type &amp; month are auto-detected for {company?.companyName}
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => !bulkUploading && setShowBulkUpload(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* PHASE 1: File Selection (before results) */}
              {!bulkResults && (
                <>
                  <div
                    className="upload-area"
                    style={{
                      border: bulkDragOver ? '2px solid #6366f1' : '2px dashed rgba(99,120,255,0.3)',
                      background: bulkDragOver ? 'rgba(99,120,255,0.08)' : 'rgba(99,120,255,0.03)',
                      padding: '32px 20px',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => bulkFileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setBulkDragOver(true); }}
                    onDragLeave={() => setBulkDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setBulkDragOver(false);
                      handleBulkFilesSelected(e.dataTransfer.files);
                    }}
                  >
                    <input
                      ref={bulkFileInputRef}
                      type="file"
                      multiple
                      style={{ display: 'none' }}
                      accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.png,.txt"
                      onChange={e => { handleBulkFilesSelected(Array.from(e.target.files || [])); e.target.value = ''; }}
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

                  {bulkFiles.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {bulkFiles.length} file{bulkFiles.length > 1 ? 's' : ''} selected
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                        {bulkFiles.map((f, i) => (
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
                              onClick={(e) => { e.stopPropagation(); removeBulkFile(i); }}
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
              {bulkResults && (
                <div>
                  <div style={{
                    display: 'flex', gap: 12, marginBottom: 16, padding: '12px 16px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06))',
                    border: '1px solid rgba(99,120,255,0.12)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Total:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{bulkSummary.total}</span>
                    </div>
                    {bulkSummary.uploaded > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                        <CheckCircle size={14} style={{ color: '#10b981' }} />
                        <span style={{ color: '#10b981' }}>{bulkSummary.uploaded} filed</span>
                      </div>
                    )}
                    {bulkSummary.errors > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                        <XCircle size={14} style={{ color: '#ef4444' }} />
                        <span style={{ color: '#ef4444' }}>{bulkSummary.errors} error{bulkSummary.errors > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {bulkSummary.duplicates > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                        <span>⚠️</span>
                        <span style={{ color: '#f59e0b' }}>{bulkSummary.duplicates} possible duplicate{bulkSummary.duplicates > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                    {bulkResults.map((r, i) => (
                      <div key={i} style={{
                        padding: '14px 16px', borderRadius: 10,
                        background: r.status === 'uploaded' ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
                        border: `1px solid ${r.status === 'uploaded' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ marginTop: 2, flexShrink: 0 }}>{getBulkStatusIcon(r.status)}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.fileName}</span>
                              {getBulkStatusBadge(r.status)}
                              {r.duplicate && (
                                <span className="badge badge-overdue" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>⚠️ Possible Duplicate</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
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
                            {r.error && (
                              <div style={{ fontSize: 12, color: '#ef4444', marginTop: 4, fontStyle: 'italic' }}>
                                {r.error}
                              </div>
                            )}
                            {r.duplicate && r.duplicateOf && (
                              <div style={{ fontSize: 12, color: '#f59e0b', marginTop: 4, fontStyle: 'italic' }}>
                                Matches an existing file for this period: "{r.duplicateOf.originalName}"
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
              {!bulkResults ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowBulkUpload(false)}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    disabled={bulkFiles.length === 0 || bulkUploading}
                    onClick={handleBulkUploadSubmit}
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
                  >
                    {bulkUploading ? (
                      <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6 }}></div> Analyzing & Uploading...</>
                    ) : (
                      <><Zap size={16} /> Auto-Upload {bulkFiles.length > 0 ? `(${bulkFiles.length})` : ''}</>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setBulkResults(null);
                    setBulkSummary(null);
                    setBulkFiles([]);
                  }}>
                    Upload More
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowBulkUpload(false)}>
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUpload(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Upload GST File</div>
              <button className="modal-close" onClick={() => setShowUpload(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Select File *</label>
                  <div className="upload-area" onClick={() => document.getElementById('fileInput').click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); handleFileChange(e.dataTransfer.files[0]); }}>
                    <input id="fileInput" type="file" style={{ display: 'none' }}
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
                  <div className="form-group form-full">
                    <label className="form-label">Financial Year</label>
                    <input className="form-input" value={uploadForm.financialYear} onChange={e => setUploadForm(f => ({ ...f, financialYear: e.target.value }))} placeholder="2024-25" />
                  </div>
                  <div className="form-group form-full">
                    <label className="form-label">Description</label>
                    <input className="form-input" value={uploadForm.description} onChange={e => setUploadForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional notes" />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Uploading...' : <><Upload size={16} /> Upload</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Reminder Modal */}
      {showReminder && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReminder(false)}>
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add Filing Reminder</div>
              <button className="modal-close" onClick={() => setShowReminder(false)}>✕</button>
            </div>
            <form onSubmit={handleCreateReminder}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-input" value={reminderForm.title} onChange={e => setReminderForm(f => ({ ...f, title: e.target.value }))} placeholder="GSTR-3B Filing for April 2025" required />
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Filing Type</label>
                    <select className="form-select" value={reminderForm.filingType} onChange={e => setReminderForm(f => ({ ...f, filingType: e.target.value }))}>
                      {REMINDER_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Due Date *</label>
                    <input className="form-input" type="date" value={reminderForm.dueDate} onChange={e => setReminderForm(f => ({ ...f, dueDate: e.target.value }))} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Filing Period</label>
                    <input className="form-input" value={reminderForm.filingPeriod} onChange={e => setReminderForm(f => ({ ...f, filingPeriod: e.target.value }))} placeholder="April 2025" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Priority</label>
                    <select className="form-select" value={reminderForm.priority} onChange={e => setReminderForm(f => ({ ...f, priority: e.target.value }))}>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="form-group form-full">
                    <label className="form-label">Description</label>
                    <textarea className="form-textarea" value={reminderForm.description} onChange={e => setReminderForm(f => ({ ...f, description: e.target.value }))} placeholder="Additional notes..." />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowReminder(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submittingReminder}>
                  {submittingReminder ? 'Saving...' : <><Bell size={16} /> Add Reminder</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {showEdit && editForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEdit(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">Edit Company</div>
              <button className="modal-close" onClick={() => setShowEdit(false)}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Company Name *</label>
                    <input className="form-input" value={editForm.companyName} onChange={setEditField('companyName')} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN *</label>
                    <input className="form-input" value={editForm.gstin} onChange={setEditField('gstin')} maxLength={15} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company Email</label>
                    <input className="form-input" type="email" value={editForm.email} onChange={setEditField('email')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={editForm.phone} onChange={setEditField('phone')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select className="form-select" value={editForm.state} onChange={setEditField('state')}>
                      <option value="">Select State</option>
                      {STATES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business Type</label>
                    <select className="form-select" value={editForm.businessType} onChange={setEditField('businessType')}>
                      {BUSINESS_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Status</label>
                    <select className="form-select" value={editForm.status} onChange={setEditField('status')}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group form-full">
                    <label className="form-label">Address</label>
                    <input className="form-input" value={editForm.address} onChange={setEditField('address')} placeholder="Street, City, PIN" />
                  </div>
                </div>

                <div className="divider"></div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Return Services</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Nothing is pre-selected. Picking GSTR-1 or GSTR-3B shows its filing due date and auto-schedules reminders for it.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {REMINDER_TYPES.map(s => {
                    const checked = editForm.returnServices.includes(s);
                    return (
                      <label key={s} className={`badge ${checked ? 'badge-info' : ''}`}
                        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, border: '1px solid var(--border)', padding: '6px 10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleEditReturnService(s)} style={{ margin: 0 }} />
                          {s}
                        </span>
                        {checked && (
                          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)' }}>
                            {RETURN_SERVICE_DUE_DATES[s] || RETURN_SERVICE_DEFAULT_NOTE}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>

                <div className="divider"></div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Additional Details (Optional)</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  For your own reference when filing on this company's behalf.
                </p>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">PAN No</label>
                    <input className="form-input" value={editForm.panNo} onChange={setEditField('panNo')} placeholder="AAAAA0000A" maxLength={10} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gmail ID</label>
                    <input className="form-input" type="email" value={editForm.gmailId} onChange={setEditField('gmailId')} placeholder="company@gmail.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gmail Password</label>
                    <div className="search-bar" style={{ padding: '9px 12px' }}>
                      <input type={showPasswords.editGmailPassword ? 'text' : 'password'} value={editForm.gmailPassword} onChange={setEditField('gmailPassword')}
                        placeholder="Gmail password" style={{ width: '100%' }} autoComplete="new-password" />
                      <button type="button" onClick={() => toggleShowPassword('editGmailPassword')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                        {showPasswords.editGmailPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Portal ID</label>
                    <input className="form-input" value={editForm.gstPortalId} onChange={setEditField('gstPortalId')} placeholder="GST portal username" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Portal Password</label>
                    <div className="search-bar" style={{ padding: '9px 12px' }}>
                      <input type={showPasswords.editGstPortalPassword ? 'text' : 'password'} value={editForm.gstPortalPassword} onChange={setEditField('gstPortalPassword')}
                        placeholder="GST portal password" style={{ width: '100%' }} autoComplete="new-password" />
                      <button type="button" onClick={() => toggleShowPassword('editGstPortalPassword')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                        {showPasswords.editGstPortalPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-Way Bill ID</label>
                    <input className="form-input" value={editForm.ewayBillId} onChange={setEditField('ewayBillId')} placeholder="E-way bill username" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-Way Bill Password</label>
                    <div className="search-bar" style={{ padding: '9px 12px' }}>
                      <input type={showPasswords.editEwayBillPassword ? 'text' : 'password'} value={editForm.ewayBillPassword} onChange={setEditField('ewayBillPassword')}
                        placeholder="E-way bill password" style={{ width: '100%' }} autoComplete="new-password" />
                      <button type="button" onClick={() => toggleShowPassword('editEwayBillPassword')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                        {showPasswords.editEwayBillPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEdit(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : <><Pencil size={16} /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
