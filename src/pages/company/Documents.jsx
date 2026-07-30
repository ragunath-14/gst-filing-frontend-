import { useState, useEffect, useRef } from 'react';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';
import {
  FileText, Download, Search, Zap, Sparkles, X, CheckCircle, XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { groupFilesByFinancialYearTypeMonth } from '../../utils/fileGrouping';

export default function CompanyDocuments() {
  const [files, setFiles] = useState([]);
  const [returnServices, setReturnServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  // Smart upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pickedFiles, setPickedFiles] = useState([]);
  const [uploadResults, setUploadResults] = useState(null);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const loadFiles = () => {
    api.get('/company/files')
      .then(r => setFiles(r.data.files))
      .catch(() => toast.error('Failed to load files'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFiles();
    api.get('/company/profile')
      .then(r => setReturnServices(r.data.company?.returnServices || []))
      .catch(() => {});
  }, []);

  const openUpload = () => {
    setPickedFiles([]);
    setUploadResults(null);
    setUploadSummary(null);
    setShowUpload(true);
  };

  const handleFilesSelected = (fileList) => {
    if (!fileList || fileList.length === 0) return;
    setPickedFiles(prev => [...prev, ...Array.from(fileList)]);
  };

  const removeFile = (index) => {
    setPickedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUploadSubmit = async () => {
    if (pickedFiles.length === 0) return toast.error('Please select at least one file');

    setUploading(true);
    setUploadResults(null);
    setUploadSummary(null);

    const fd = new FormData();
    pickedFiles.forEach(f => fd.append('files', f));

    try {
      const res = await api.post('/company/files/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        setUploadResults(res.data.results);
        setUploadSummary(res.data.summary);
        if (res.data.summary.uploaded > 0) {
          toast.success(`${res.data.summary.uploaded} file(s) uploaded successfully!`);
          loadFiles();
        }
        if (res.data.summary.errors > 0) {
          toast.error(`${res.data.summary.errors} file(s) had errors`);
        }
        if (res.data.summary.duplicates > 0) {
          toast(`${res.data.summary.duplicates} file(s) look like duplicates of files already on record`, { icon: '⚠️', duration: 6000 });
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Only documents the admin has filed on the company's behalf are shown
  // here — files the company uploaded itself (for the accountant to review)
  // live in the admin's "Company Uploads" review queue, not in this archive.
  const adminFiles = files.filter(f => f.uploadedByRole !== 'company');

  const types = ['all', ...new Set(adminFiles.map(f => f.filingType))];
  const years = ['all', ...new Set(adminFiles.map(f => f.financialYear || 'Unspecified'))]
    .sort((a, b) => a === 'all' ? -1 : b === 'all' ? 1 : b.localeCompare(a, undefined, { numeric: true }));

  const filtered = adminFiles.filter(f => {
    const matchSearch = f.originalName.toLowerCase().includes(search.toLowerCase()) ||
      f.filingPeriod?.toLowerCase().includes(search.toLowerCase());
    const matchType = filterType === 'all' || f.filingType === filterType;
    const matchYear = filterYear === 'all' || (f.financialYear || 'Unspecified') === filterYear;
    return matchSearch && matchType && matchYear;
  });

  const grouped = groupFilesByFinancialYearTypeMonth(filtered, returnServices);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const formatSize = (bytes) => bytes ? (bytes / 1024 / 1024).toFixed(2) + ' MB' : '';

  const getFileIcon = (name) => {
    const ext = name ? name.split('.').pop()?.toLowerCase() : '';
    if (ext === 'pdf') return { bg: 'rgba(239,68,68,0.12)', color: '#ef4444', emoji: '📄' };
    if (['xls','xlsx'].includes(ext)) return { bg: 'rgba(16,185,129,0.12)', color: '#10b981', emoji: '📊' };
    if (ext === 'csv') return { bg: 'rgba(59,130,246,0.12)', color: '#3b82f6', emoji: '📋' };
    return { bg: 'rgba(99,120,255,0.12)', color: '#6378ff', emoji: '📁' };
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">My Documents</div>
            <div className="topbar-subtitle">GST filing documents shared with your accountant</div>
          </div>
          <div className="topbar-actions">
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="Search documents..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={openUpload}
              style={{ marginLeft: 10, background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}>
              <Zap size={16} /> Upload
            </button>
          </div>
        </div>

        <div className="page-content">
          {/* Type Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
            {types.map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`btn btn-sm ${filterType === t ? 'btn-primary' : 'btn-secondary'}`}>
                {t === 'all' ? 'All Types' : t}
              </button>
            ))}
          </div>

          {/* Year Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {years.map(y => (
              <button key={y} onClick={() => setFilterYear(y)}
                className={`btn btn-sm ${filterYear === y ? 'btn-primary' : 'btn-secondary'}`}>
                {y === 'all' ? 'All Years' : y}
              </button>
            ))}
          </div>

          {loading ? <div className="loading-spinner"><div className="spinner"></div></div>
            : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><FileText size={32} /></div>
                <h3>No documents found</h3>
                <p>{search ? 'Try different search terms' : 'No GST documents yet. Upload one, or your accountant will file it for you.'}</p>
                {!search && (
                  <button className="btn btn-primary" onClick={openUpload}
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}>
                    <Zap size={16} /> Upload Document
                  </button>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {grouped.map(({ year, types }) => (
                  <div key={year}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 14 }}>
                      {year}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                      {types.map(({ filingType, months }) => (
                        <div key={filingType} style={{
                          border: '1px solid var(--border)', borderRadius: 14, padding: 18,
                          background: 'rgba(99,120,255,0.02)'
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                            <span className="badge badge-purple" style={{ fontSize: 13 }}>{filingType}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                              {months.reduce((n, m) => n + m.files.length, 0)} file{months.reduce((n, m) => n + m.files.length, 0) > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                            {months.map(({ month, files: monthFiles }) => (
                              <div key={month}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                                  {month}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                  {monthFiles.map(f => {
                                    const icon = getFileIcon(f.originalName);
                                    return (
                                      <div key={f._id} className="file-item" style={{ padding: 18 }}>
                                        <div style={{ width: 46, height: 46, borderRadius: 12, background: icon.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                                          {icon.emoji}
                                        </div>
                                        <div className="file-info">
                                          <div className="file-name" style={{ fontSize: 15 }}>{f.originalName}</div>
                                          <div className="file-meta" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                                            {f.filingPeriod && <span>📅 {f.filingPeriod}</span>}
                                            {f.financialYear && <span>📆 FY {f.financialYear}</span>}
                                            {f.fileSize && <span>💾 {formatSize(f.fileSize)}</span>}
                                            <span>🕒 {formatDate(f.createdAt)}</span>
                                          </div>
                                          {f.description && (
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>📝 {f.description}</div>
                                          )}
                                        </div>
                                        <div className="file-actions">
                                          <a href={`/${f.filePath}`} target="_blank" rel="noreferrer" download={f.originalName}>
                                            <button className="btn btn-primary btn-sm">
                                              <Download size={14} /> Download
                                            </button>
                                          </a>
                                        </div>
                                      </div>
                                    );
                                  })}
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
            )}
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !uploading && setShowUpload(false)}>
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
                  <div className="modal-title" style={{ margin: 0 }}>Upload Documents</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                    Filing type &amp; month are auto-detected — your accountant will be notified
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => !uploading && setShowUpload(false)}>✕</button>
            </div>

            <div className="modal-body">
              {/* PHASE 1: File Selection */}
              {!uploadResults && (
                <>
                  <div
                    className="upload-area"
                    style={{
                      border: dragOver ? '2px solid #6366f1' : '2px dashed rgba(99,120,255,0.3)',
                      background: dragOver ? 'rgba(99,120,255,0.08)' : 'rgba(99,120,255,0.03)',
                      padding: '32px 20px',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer'
                    }}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => {
                      e.preventDefault();
                      setDragOver(false);
                      handleFilesSelected(e.dataTransfer.files);
                    }}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      style={{ display: 'none' }}
                      accept=".pdf,.xls,.xlsx,.csv,.doc,.docx,.jpg,.png,.txt"
                      onChange={e => { handleFilesSelected(Array.from(e.target.files || [])); e.target.value = ''; }}
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

                  {pickedFiles.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
                        {pickedFiles.length} file{pickedFiles.length > 1 ? 's' : ''} selected
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                        {pickedFiles.map((f, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 12px', borderRadius: 8,
                            background: 'rgba(99,120,255,0.04)',
                            border: '1px solid rgba(99,120,255,0.1)'
                          }}>
                            <span style={{ fontSize: 16 }}>{getFileIcon(f.name).emoji}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {f.name}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {(f.size / 1024 / 1024).toFixed(2)} MB
                              </div>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeFile(i); }}
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
              {uploadResults && (
                <div>
                  <div style={{
                    display: 'flex', gap: 12, marginBottom: 16, padding: '12px 16px',
                    borderRadius: 10,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.06))',
                    border: '1px solid rgba(99,120,255,0.12)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
                      <span style={{ color: 'var(--text-muted)' }}>Total:</span>
                      <span style={{ color: 'var(--text-primary)' }}>{uploadSummary.total}</span>
                    </div>
                    {uploadSummary.uploaded > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                        <CheckCircle size={14} style={{ color: '#10b981' }} />
                        <span style={{ color: '#10b981' }}>{uploadSummary.uploaded} uploaded</span>
                      </div>
                    )}
                    {uploadSummary.errors > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                        <XCircle size={14} style={{ color: '#ef4444' }} />
                        <span style={{ color: '#ef4444' }}>{uploadSummary.errors} error{uploadSummary.errors > 1 ? 's' : ''}</span>
                      </div>
                    )}
                    {uploadSummary.duplicates > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600 }}>
                        <span>⚠️</span>
                        <span style={{ color: '#f59e0b' }}>{uploadSummary.duplicates} possible duplicate{uploadSummary.duplicates > 1 ? 's' : ''}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                    {uploadResults.map((r, i) => (
                      <div key={i} style={{
                        padding: '14px 16px', borderRadius: 10,
                        background: r.status === 'uploaded' ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)',
                        border: `1px solid ${r.status === 'uploaded' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ marginTop: 2, flexShrink: 0 }}>
                            {r.status === 'uploaded'
                              ? <CheckCircle size={18} style={{ color: '#10b981' }} />
                              : <XCircle size={18} style={{ color: '#ef4444' }} />}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{r.fileName}</span>
                              {r.status === 'uploaded'
                                ? <span className="badge badge-active">Uploaded</span>
                                : <span className="badge badge-overdue">Error</span>}
                              {r.duplicate && (
                                <span className="badge badge-overdue" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>⚠️ Possible Duplicate</span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 12, color: 'var(--text-muted)' }}>
                              {r.filingType && <span>📋 {r.filingType}</span>}
                              {r.filingPeriod && <span>📅 {r.filingPeriod}</span>}
                              {r.financialYear && <span>📊 FY {r.financialYear}</span>}
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
              {!uploadResults ? (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                  <button
                    className="btn btn-primary"
                    disabled={pickedFiles.length === 0 || uploading}
                    onClick={handleUploadSubmit}
                    style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none' }}
                  >
                    {uploading ? (
                      <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2, marginRight: 6 }}></div> Analyzing & Uploading...</>
                    ) : (
                      <><Zap size={16} /> Upload {pickedFiles.length > 0 ? `(${pickedFiles.length})` : ''}</>
                    )}
                  </button>
                </>
              ) : (
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => {
                    setUploadResults(null);
                    setUploadSummary(null);
                    setPickedFiles([]);
                  }}>
                    Upload More
                  </button>
                  <button className="btn btn-primary" onClick={() => setShowUpload(false)}>
                    Done
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
