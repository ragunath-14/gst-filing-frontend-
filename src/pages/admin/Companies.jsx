import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from '../../components/Sidebar';
import api from '../../api/axios';
import {
  Building2, Plus, Search, Trash2, Pencil, MapPin, Mail, Eye, EyeOff, Download, User
} from 'lucide-react';
import toast from 'react-hot-toast';

const STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh'];
const BUSINESS_TYPES = ['Proprietorship','Partnership','LLP','Private Limited','Public Limited','Other'];
// Filing types the company files. GSTR-1 / GSTR-3B have known monthly due dates
// (11th / 20th) so reminders for them are auto-scheduled; the rest need reminders
// added manually since their due dates aren't a fixed monthly rule.
const RETURN_SERVICES = ['GSTR-1','GSTR-3B','CMP-08','GSTR-9','GSTR-9C','TDS Return','Income Tax','Other'];
const RETURN_SERVICE_DUE_DATES = {
  'GSTR-1': 'Due 11th of every month',
  'GSTR-3B': 'Due 20th of every month',
};
const RETURN_SERVICE_DEFAULT_NOTE = 'No fixed due date — add reminders manually';

export default function AdminCompanies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showCreds, setShowCreds] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [form, setForm] = useState({
    companyName: '', gstin: '', email: '', phone: '', address: '',
    state: '', businessType: 'Private Limited', returnServices: [],
    assignedTo: '',
    loginEmail: '', loginPassword: '', loginName: '',
    panNo: '', gmailId: '', gmailPassword: '',
    gstPortalId: '', gstPortalPassword: '',
    ewayBillId: '', ewayBillPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({});

  const [editingCompany, setEditingCompany] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const fetchCompanies = () => {
    setLoading(true);
    api.get('/admin/companies')
      .then(r => setCompanies(r.data.companies))
      .catch(() => toast.error('Failed to load companies'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { (async () => { await fetchCompanies(); })(); }, []);

  const filtered = companies.filter(c =>
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.gstin.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.companyName || !form.gstin || !form.loginEmail || !form.loginPassword) {
      return toast.error('Fill all required fields');
    }
    setSubmitting(true);
    try {
      const res = await api.post('/admin/companies', form);
      toast.success('Company created!');
      setShowCreds(res.data.credentials);
      setShowModal(false);
      resetForm();
      fetchCompanies();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create company');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/admin/companies/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `companies_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download companies Excel sheet');
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This will remove all files and reminders.`)) return;
    try {
      await api.delete(`/admin/companies/${id}`);
      toast.success('Company deleted');
      fetchCompanies();
    } catch { toast.error('Delete failed'); }
  };

  const openEdit = (c) => {
    setEditingCompany(c);
    setEditForm({
      companyName: c.companyName || '',
      gstin: c.gstin || '',
      email: c.email || '',
      phone: c.phone || '',
      address: c.address || '',
      state: c.state || '',
      businessType: c.businessType || 'Other',
      returnServices: c.returnServices || [],
      assignedTo: c.assignedTo || '',
      status: c.status || 'active'
    });
  };

  const closeEdit = () => {
    setEditingCompany(null);
    setEditForm(null);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editForm.companyName || !editForm.gstin) {
      return toast.error('Company name and GSTIN are required');
    }
    setEditSubmitting(true);
    try {
      await api.put(`/admin/companies/${editingCompany._id}`, editForm);
      toast.success('Company updated!');
      closeEdit();
      fetchCompanies();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update company');
    } finally {
      setEditSubmitting(false);
    }
  };

  const setEditField = (k) => (e) => setEditForm(f => ({ ...f, [k]: e.target.value }));

  const resetForm = () => setForm({
    companyName: '', gstin: '', email: '', phone: '', address: '',
    state: '', businessType: 'Private Limited', returnServices: [],
    assignedTo: '',
    loginEmail: '', loginPassword: '', loginName: '',
    panNo: '', gmailId: '', gmailPassword: '',
    gstPortalId: '', gstPortalPassword: '',
    ewayBillId: '', ewayBillPassword: ''
  });

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const toggleShowPassword = (k) => setShowPasswords(p => ({ ...p, [k]: !p[k] }));

  const toggleReturnService = (setter) => (service) => setter(f => ({
    ...f,
    returnServices: f.returnServices.includes(service)
      ? f.returnServices.filter(s => s !== service)
      : [...f.returnServices, service]
  }));

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        <div className="topbar">
          <div>
            <div className="topbar-title">Companies</div>
            <div className="topbar-subtitle">Manage client company accounts</div>
          </div>
          <div className="topbar-actions">
            <div className="search-bar">
              <Search size={16} />
              <input placeholder="Search companies..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <button className="btn btn-secondary" onClick={handleExport} disabled={exporting} title="Download all companies as Excel">
              <Download size={16} /> {exporting ? 'Exporting...' : 'Export Excel'}
            </button>
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={16} /> Add Company
            </button>
          </div>
        </div>

        <div className="page-content">
          {loading ? <div className="loading-spinner"><div className="spinner"></div></div>
            : filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon"><Building2 size={32} /></div>
                <h3>No companies found</h3>
                <p>{search ? 'Try a different search' : 'Add your first client company to get started'}</p>
                {!search && <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={16} /> Add Company</button>}
              </div>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Company</th>
                      <th>Business Type</th>
                      <th>Contact</th>
                      <th>State</th>
                      <th>Assigned To</th>
                      <th>Files</th>
                      <th>Pending</th>
                      <th>Overdue</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c._id} onClick={() => navigate(`/admin/companies/${c._id}`)} style={{ cursor: 'pointer' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div className="company-icon" style={{ width: 34, height: 34, fontSize: 14, borderRadius: 9 }}>{c.companyName[0]}</div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.companyName}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{c.gstin}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div>{c.businessType || '-'}</div>
                          {c.returnServices?.length > 0 && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{c.returnServices.join(', ')}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {c.email && <span style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}><Mail size={12} />{c.email}</span>}
                            {c.phone && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.phone}</span>}
                            {!c.email && !c.phone && '-'}
                          </div>
                        </td>
                        <td>
                          {c.state ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={12} />{c.state}</span> : '-'}
                        </td>
                        <td>
                          {c.assignedTo ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><User size={12} />{c.assignedTo}</span> : '-'}
                        </td>
                        <td style={{ color: 'var(--info)', fontWeight: 600 }}>{c.fileCount ?? 0}</td>
                        <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{c.pendingReminders ?? 0}</td>
                        <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{c.overdueReminders ?? 0}</td>
                        <td><span className={`badge badge-${c.status}`}>{c.status}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary btn-sm" onClick={e => { e.stopPropagation(); openEdit(c); }} title="Edit company">
                              <Pencil size={14} />
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={e => { e.stopPropagation(); handleDelete(c._id, c.companyName); }} title="Delete company">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      </div>

      {/* Add Company Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">Add New Company</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body">
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Company Details</p>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Company Name *</label>
                    <input className="form-input" value={form.companyName} onChange={set('companyName')} placeholder="Acme Pvt Ltd" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GSTIN *</label>
                    <input className="form-input" value={form.gstin} onChange={set('gstin')} placeholder="22AAAAA0000A1Z5" maxLength={15} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company Email</label>
                    <input className="form-input" type="email" value={form.email} onChange={set('email')} placeholder="company@example.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Phone</label>
                    <input className="form-input" value={form.phone} onChange={set('phone')} placeholder="+91 98765 43210" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select className="form-select" value={form.state} onChange={set('state')}>
                      <option value="">Select State</option>
                      {STATES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Business Type</label>
                    <select className="form-select" value={form.businessType} onChange={set('businessType')}>
                      {BUSINESS_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Assigned To</label>
                    <input className="form-input" value={form.assignedTo} onChange={set('assignedTo')} placeholder="Staff member handling this company" />
                  </div>
                  <div className="form-group form-full">
                    <label className="form-label">Address</label>
                    <input className="form-input" value={form.address} onChange={set('address')} placeholder="Street, City, PIN" />
                  </div>
                </div>

                <div className="divider"></div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Return Services</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Select the returns this company files — nothing is pre-selected. Picking GSTR-1 or GSTR-3B shows its filing due date and auto-schedules reminders for it; other types need reminders added manually.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {RETURN_SERVICES.map(s => {
                    const checked = form.returnServices.includes(s);
                    return (
                      <label key={s} className={`badge ${checked ? 'badge-info' : ''}`}
                        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, border: '1px solid var(--border)', padding: '6px 10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleReturnService(setForm)(s)} style={{ margin: 0 }} />
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
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Portal Login Credentials</p>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">Login Name</label>
                    <input className="form-input" value={form.loginName} onChange={set('loginName')} placeholder="Contact person name" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Login Email *</label>
                    <input className="form-input" type="email" value={form.loginEmail} onChange={set('loginEmail')} placeholder="user@company.com" required />
                  </div>
                  <div className="form-group form-full">
                    <label className="form-label">Password *</label>
                    <input className="form-input" value={form.loginPassword} onChange={set('loginPassword')} placeholder="Min 6 characters" minLength={6} required />
                  </div>
                </div>

                <div className="divider"></div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Additional Details (Optional)</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                  For your own reference when filing on this company's behalf — none of these are required.
                </p>
                <div className="form-grid">
                  <div className="form-group">
                    <label className="form-label">PAN No</label>
                    <input className="form-input" value={form.panNo} onChange={set('panNo')} placeholder="AAAAA0000A" maxLength={10} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gmail ID</label>
                    <input className="form-input" type="email" value={form.gmailId} onChange={set('gmailId')} placeholder="company@gmail.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gmail Password</label>
                    <div className="search-bar" style={{ padding: '9px 12px' }}>
                      <input type={showPasswords.gmailPassword ? 'text' : 'password'} value={form.gmailPassword} onChange={set('gmailPassword')}
                        placeholder="Gmail password" style={{ width: '100%' }} autoComplete="new-password" />
                      <button type="button" onClick={() => toggleShowPassword('gmailPassword')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                        {showPasswords.gmailPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Portal ID</label>
                    <input className="form-input" value={form.gstPortalId} onChange={set('gstPortalId')} placeholder="GST portal username" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST Portal Password</label>
                    <div className="search-bar" style={{ padding: '9px 12px' }}>
                      <input type={showPasswords.gstPortalPassword ? 'text' : 'password'} value={form.gstPortalPassword} onChange={set('gstPortalPassword')}
                        placeholder="GST portal password" style={{ width: '100%' }} autoComplete="new-password" />
                      <button type="button" onClick={() => toggleShowPassword('gstPortalPassword')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                        {showPasswords.gstPortalPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-Way Bill ID</label>
                    <input className="form-input" value={form.ewayBillId} onChange={set('ewayBillId')} placeholder="E-way bill username" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">E-Way Bill Password</label>
                    <div className="search-bar" style={{ padding: '9px 12px' }}>
                      <input type={showPasswords.ewayBillPassword ? 'text' : 'password'} value={form.ewayBillPassword} onChange={set('ewayBillPassword')}
                        placeholder="E-way bill password" style={{ width: '100%' }} autoComplete="new-password" />
                      <button type="button" onClick={() => toggleShowPassword('ewayBillPassword')}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}>
                        {showPasswords.ewayBillPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : <><Plus size={16} /> Create Company</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {editingCompany && editForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeEdit()}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">Edit Company</div>
              <button className="modal-close" onClick={closeEdit}>✕</button>
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
                  <div className="form-group">
                    <label className="form-label">Assigned To</label>
                    <input className="form-input" value={editForm.assignedTo} onChange={setEditField('assignedTo')} placeholder="Staff member handling this company" />
                  </div>
                  <div className="form-group form-full">
                    <label className="form-label">Address</label>
                    <input className="form-input" value={editForm.address} onChange={setEditField('address')} placeholder="Street, City, PIN" />
                  </div>
                </div>

                <div className="divider"></div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Return Services</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {RETURN_SERVICES.map(s => {
                    const checked = editForm.returnServices.includes(s);
                    return (
                      <label key={s} className={`badge ${checked ? 'badge-info' : ''}`}
                        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, border: '1px solid var(--border)', padding: '6px 10px' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleReturnService(setEditForm)(s)} style={{ margin: 0 }} />
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
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeEdit}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSubmitting}>
                  {editSubmitting ? 'Saving...' : <><Pencil size={16} /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Dialog */}
      {showCreds && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">✅ Company Created!</div>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                Share these login credentials with the company. This is the only time the password is shown.
              </p>
              <div className="credentials-box">
                <h4>🔑 Portal Login Credentials</h4>
                <div className="credential-row">
                  <span className="credential-key">Email</span>
                  <span className="credential-val">{showCreds.email}</span>
                </div>
                <div className="credential-row">
                  <span className="credential-key">Password</span>
                  <span className="credential-val">{showCreds.password}</span>
                </div>
                <div className="credential-row">
                  <span className="credential-key">Portal URL</span>
                  <span className="credential-val">http://localhost:5173</span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowCreds(null)}>Got it, Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
