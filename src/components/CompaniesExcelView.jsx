import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Eye, EyeOff, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

// Fields the admin can edit directly in the sheet (click to edit, like
// Excel). Everything else here is read-only reference data — use the list
// view's Edit modal for company profile fields.
const EDITABLE_FIELDS = ['gstPortalId', 'gstPortalPassword', 'loginEmail', 'loginPassword'];
const PASSWORD_FIELDS = ['gmailPassword', 'gstPortalPassword', 'ewayBillPassword'];
// loginEmail/loginPassword live on the linked user account, not the company
// document, so they save through a different endpoint than the rest.
const LOGIN_FIELDS = ['loginEmail', 'loginPassword'];
// The login password is bcrypt-hashed one-way on the account — there's
// nothing to read back or reveal, only a new value to set.
const WRITE_ONLY_FIELD = 'loginPassword';

export default function CompaniesExcelView() {
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { id, field, value }
  const [savingKey, setSavingKey] = useState(null);
  const [revealed, setRevealed] = useState(new Set());

  const fetchSheet = useCallback(() => {
    setLoading(true);
    api.get('/admin/companies/sheet')
      .then(r => { setColumns(r.data.columns); setRows(r.data.rows); })
      .catch(() => toast.error('Failed to load companies sheet'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { (async () => { await fetchSheet(); })(); }, [fetchSheet]);

  const startEdit = (row, field) => {
    if (savingKey) return;
    setEditing({ id: row._id, field, value: row[field] || '' });
  };

  const cancelEdit = () => setEditing(null);

  const commitEdit = async () => {
    if (!editing) return;
    const { id, field, value } = editing;
    const original = rows.find(r => r._id === id)?.[field] || '';
    setEditing(null);
    if (value === original) return;

    if (field === WRITE_ONLY_FIELD && value.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    const key = `${id}:${field}`;
    setSavingKey(key);
    try {
      if (LOGIN_FIELDS.includes(field)) {
        const body = field === 'loginEmail' ? { email: value } : { password: value };
        await api.put(`/admin/companies/${id}/login`, body);
        toast.success(field === 'loginEmail' ? 'Login email updated' : 'Password reset');
        // loginPassword is never echoed back — it stays blank in the sheet.
        if (field === 'loginEmail') {
          setRows(rs => rs.map(r => (r._id === id ? { ...r, loginEmail: value } : r)));
        }
      } else {
        await api.put(`/admin/companies/${id}`, { [field]: value });
        setRows(rs => rs.map(r => (r._id === id ? { ...r, [field]: value } : r)));
        toast.success('Saved');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSavingKey(null);
    }
  };

  const toggleReveal = (key) => setRevealed(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  if (loading) return <div className="loading-spinner"><div className="spinner"></div></div>;

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <h3>No companies found</h3>
        <p>Add a company from the list view to see it here.</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Click <strong>GST Portal ID/Password</strong> or <strong>Login Email/Password</strong> to edit in place. Other columns are read-only here.
        </p>
        <button className="btn btn-secondary btn-sm" onClick={fetchSheet} title="Refresh">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="excel-sheet-wrap">
        <table className="excel-sheet">
          <thead>
            <tr>
              <th className="excel-row-num">#</th>
              {columns.map(col => <th key={col.field}>{col.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={row._id}>
                <td className="excel-row-num">{idx + 1}</td>
                {columns.map(col => {
                  const field = col.field;
                  const isEditable = EDITABLE_FIELDS.includes(field);
                  const isPassword = PASSWORD_FIELDS.includes(field);
                  const key = `${row._id}:${field}`;
                  const isEditing = editing?.id === row._id && editing?.field === field;
                  const isSaving = savingKey === key;

                  if (isEditing) {
                    return (
                      <td key={field} className="excel-cell-editing">
                        <input
                          autoFocus
                          type="text"
                          value={editing.value}
                          onChange={e => setEditing(ed => ({ ...ed, value: e.target.value }))}
                          onBlur={commitEdit}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                            if (e.key === 'Escape') cancelEdit();
                          }}
                        />
                      </td>
                    );
                  }

                  const isWriteOnly = field === WRITE_ONLY_FIELD;
                  const raw = row[field];
                  const hidden = isPassword && raw && !revealed.has(key);
                  const display = isWriteOnly
                    ? '••••••••'
                    : hidden ? '•'.repeat(Math.min(String(raw).length, 10)) : (raw || '—');

                  return (
                    <td
                      key={field}
                      className={isEditable ? 'excel-cell-editable' : ''}
                      onClick={() => isEditable && startEdit(row, field)}
                      title={isEditable ? (isWriteOnly ? 'Click to set a new password' : 'Click to edit') : undefined}
                    >
                      <span className={(isPassword || isWriteOnly) ? 'excel-cell-password' : ''}>{isSaving ? 'Saving...' : display}</span>
                      {isPassword && !isWriteOnly && raw && (
                        <button
                          type="button"
                          className="excel-cell-reveal"
                          onClick={e => { e.stopPropagation(); toggleReveal(key); }}
                          title={revealed.has(key) ? 'Hide' : 'Show'}
                        >
                          {revealed.has(key) ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
