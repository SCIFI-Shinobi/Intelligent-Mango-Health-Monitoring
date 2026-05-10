import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/apiBase';
import { AuthContext } from '../context/AuthContext';

const API = getApiBaseUrl();
const DISEASE_OPTS = ['All', 'Healthy', 'Anthracnose', 'Powdery Mildew'];
const LABEL_OPTS = ['Healthy', 'Anthracnose', 'Powdery Mildew'];
const DEVICE_ONLINE_MS = 5 * 60 * 1000;

function useAdminFetch(path, deps = []) {
  const { token } = useContext(AuthContext);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error(`${r.status}`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load };
}

function Badge({ label }) {
  const color = label === 'Healthy' ? '#3fb950' : label === 'Anthracnose' ? '#f85149' : label === 'Powdery Mildew' ? '#d29922' : '#8b949e';
  return <span style={{ background: color + '22', color, border: `1px solid ${color}55`, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>{label}</span>;
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 28, maxWidth: 380, width: '90%' }}>
        <p style={{ color: '#e6edf3', marginBottom: 20, fontSize: 15 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', background: '#21262d', border: '1px solid #30363d', borderRadius: 8, color: '#e6edf3', cursor: 'pointer' }}>Cancel</button>
          <button onClick={onConfirm} style={{ padding: '8px 16px', background: '#f85149', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UserManagementModal({ user, onClose, onUpdate }) {
  const { token } = useContext(AuthContext);
  const { data: devicesData, reload: reloadDevices } = useAdminFetch(`/admin/devices`); // We'll filter locally
  const [formData, setFormData] = useState({
    display_name: user.display_name || '',
    email: user.email || '',
    disease_confidence_threshold: user.disease_confidence_threshold || 70,
    notification_emails_enabled: user.notification_emails_enabled ?? true
  });
  const [saving, setSaving] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [copied, setCopied] = useState(null);

  const userDevices = (devicesData?.data || []).filter(d => d.user_id === user.id);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`${API}/admin/users/${user.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    setSaving(false);
    onUpdate();
  };

  const handleAddDevice = async () => {
    await fetch(`${API}/admin/devices`, { 
      method: 'POST', 
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: user.id, device_name: newDeviceName || undefined })
    });
    setNewDeviceName('');
    setShowAddDevice(false);
    reloadDevices();
  };

  const deleteDevice = async (id) => {
    if (!window.confirm("Delete this device?")) return;
    await fetch(`${API}/admin/devices/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    reloadDevices();
  };

  const regenKey = async (id) => {
    await fetch(`${API}/admin/devices/${id}/regenerate-key`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    reloadDevices();
  };

  const copyKey = async (key, id) => {
    await navigator.clipboard.writeText(key);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="admin-modal-overlay">
      <div className="admin-modal user-mgmt-modal">
        <div className="admin-modal-header">
          <h3>Manage User: {user.username}</h3>
          <button onClick={onClose} className="admin-modal-close"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-modal-section">
            <h4><i className="fa-solid fa-user-gear" /> Profile Settings</h4>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Display Name</label>
                <input type="text" value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} />
              </div>
              <div className="admin-form-group">
                <label>Email Address</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Confidence Threshold ({formData.disease_confidence_threshold}%)</label>
                <input type="range" min="50" max="95" value={formData.disease_confidence_threshold} onChange={e => setFormData({...formData, disease_confidence_threshold: parseInt(e.target.value)})} />
              </div>
              <div className="admin-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 25 }}>
                <label style={{ marginBottom: 0 }}>Email Alerts</label>
                <button 
                  onClick={() => setFormData({...formData, notification_emails_enabled: !formData.notification_emails_enabled})}
                  className={`admin-toggle ${formData.notification_emails_enabled ? 'enabled' : ''}`}
                ><span></span></button>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving} className="admin-primary-btn" style={{ marginTop: 10 }}>
              {saving ? <i className="fa-solid fa-spinner fa-spin" /> : 'Save Changes'}
            </button>
          </div>

          <div className="admin-modal-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h4 style={{ margin: 0 }}><i className="fa-solid fa-server" /> Registered Gateways</h4>
              <button onClick={() => setShowAddDevice(true)} className="admin-add-btn"><i className="fa-solid fa-plus" /> Add Device</button>
            </div>
            
            {showAddDevice && (
              <div className="admin-inline-add">
                <input type="text" placeholder="Device Name (e.g. Farm Alpha)" value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} />
                <button onClick={handleAddDevice} className="admin-confirm-btn">Create</button>
                <button onClick={() => setShowAddDevice(false)} className="admin-cancel-btn">Cancel</button>
              </div>
            )}

            <div className="admin-modal-devices">
              {userDevices.length === 0 ? <p className="admin-empty-msg">No devices found for this user.</p> : userDevices.map(d => {
                const online = d.last_seen && (Date.now() - new Date(d.last_seen).getTime()) < DEVICE_ONLINE_MS;
                return (
                  <div key={d.id} className="admin-device-item">
                    <div className="admin-device-info">
                      <div className="admin-device-name-row">
                        <span className={`admin-status-dot ${online ? 'online' : 'offline'}`} />
                        <strong>{d.device_name}</strong>
                      </div>
                      <div className="admin-key-display">
                        <code>{d.api_key.substring(0, 15)}...</code>
                        <button onClick={() => copyKey(d.api_key, d.id)} className="admin-icon-btn" title="Copy Key">
                          <i className={`fa-solid ${copied === d.id ? 'fa-check' : 'fa-copy'}`} />
                        </button>
                      </div>
                    </div>
                    <div className="admin-device-actions">
                      <button onClick={() => regenKey(d.id)} className="admin-icon-btn" title="Regenerate Key"><i className="fa-solid fa-rotate" /></button>
                      <button onClick={() => deleteDevice(d.id)} className="admin-icon-btn danger" title="Remove Device"><i className="fa-solid fa-trash" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const { token } = useContext(AuthContext);
  const [search, setSearch] = useState('');
  const { data, loading, reload } = useAdminFetch(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`, [search]);
  const [confirm, setConfirm] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const deleteUser = async (id) => {
    await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConfirm(null); reload();
  };

  if (loading && !data) return <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> Loading users…</div>;
  const users = data?.data || [];

  return (
    <div>
      {confirm && <ConfirmModal message={`Delete user "${confirm.username}" and all their data? This cannot be undone.`} onConfirm={() => deleteUser(confirm.id)} onCancel={() => setConfirm(null)} />}
      {selectedUser && <UserManagementModal user={selectedUser} onClose={() => setSelectedUser(null)} onUpdate={reload} />}
      
      <div className="admin-action-bar">
        <div className="admin-search-wrap">
          <i className="fa-solid fa-magnifying-glass" />
          <input type="text" placeholder="Search by username, email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="admin-stat-summary">
          <span><strong>{users.length}</strong> Users</span>
          <span><strong>{users.reduce((s, u) => s + u.scan_count, 0)}</strong> Total Scans</span>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>User</th><th>Email</th><th>Joined</th><th>Scans</th><th>Last Scan</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} onClick={() => setSelectedUser(u)} style={{ cursor: 'pointer' }}>
                <td>
                  <div className="admin-user-cell">
                    <div className="admin-avatar-small">{u.display_name?.charAt(0) || u.username.charAt(0)}</div>
                    <span className="admin-username">{u.username}{u.username === 'admin' && <span className="admin-badge">Admin</span>}</span>
                  </div>
                </td>
                <td style={{ color: '#8b949e' }}>{u.email || '—'}</td>
                <td style={{ color: '#8b949e', fontSize: 12 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                <td><strong>{u.scan_count}</strong></td>
                <td style={{ color: '#8b949e', fontSize: 12 }}>{u.last_scan_at ? new Date(u.last_scan_at).toLocaleString() : '—'}</td>
                <td>{u.username !== 'admin' && <button className="admin-danger-btn" onClick={(e) => { e.stopPropagation(); setConfirm(u); }}><i className="fa-solid fa-trash" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>No users found matching "{search}"</div>}
      </div>
    </div>
  );
}

// ── Scans Tab ─────────────────────────────────────────────────────────────────
function ScansTab() {
  const { data: usersData } = useAdminFetch('/admin/users');
  const [filterUser, setFilterUser] = useState('');
  const { data, loading } = useAdminFetch(`/admin/scans${filterUser ? `?user_id=${filterUser}` : ''}`, [filterUser]);

  if (loading && !data) return <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> Loading scans…</div>;
  const scans = data?.data || [];
  const users = usersData?.data || [];

  return (
    <div>
      <div className="admin-action-bar">
        <div className="admin-filter-wrap">
          <label>Filter by User:</label>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)} className="admin-select">
            <option value="">All Users</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
        </div>
        <div className="admin-stat-summary">
          <span><strong>{scans.length}</strong> Scans Found</span>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Date</th><th>User</th><th>Result</th><th>Conf.</th><th>Gateway</th><th>Source</th></tr></thead>
          <tbody>
            {scans.map(s => (
              <tr key={s.id}>
                <td style={{ fontSize: 12 }}>{new Date(s.timestamp).toLocaleString()}</td>
                <td><span className="admin-username">{s.owner_username || `User ${s.user_id}`}</span></td>
                <td><Badge label={s.disease_type} /></td>
                <td><strong>{Math.round(s.confidence_score * 100)}%</strong></td>
                <td style={{ color: '#8b949e' }}>{s.device_name || 'N/A'}</td>
                <td>
                  <span style={{ 
                    fontSize: 11, 
                    color: s.source === 'web_app' ? '#2f81f7' : '#3fb950', 
                    background: s.source === 'web_app' ? '#2f81f722' : '#3fb95022', 
                    padding: '2px 8px', 
                    borderRadius: 20 
                  }}>
                    {s.source === 'web_app' ? 'Web' : 'Gateway'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {scans.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>No scans found for this selection.</div>}
      </div>
    </div>
  );
}

// ── Training Tab ──────────────────────────────────────────────────────────────
function ImageViewerModal({ src, onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 20 }} onClick={onClose}>
      <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: -40, right: 0, background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }}><i className="fa-solid fa-xmark" /></button>
        <img src={src} alt="Scan preview" style={{ maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }} />
      </div>
    </div>
  );
}

function TrainingTab() {
  const { token } = useContext(AuthContext);
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useAdminFetch(`/admin/training/samples?page=${page}&limit=20`, [page]);
  const [editing, setEditing] = useState({});
  const [customLabels, setCustomLabels] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [viewerImg, setViewerImg] = useState(null);

  const confirm_ = async (id, label) => {
    let chosen = label || editing[id] || null;
    if (chosen === 'Custom...') {
      chosen = customLabels[id] || '';
    }
    if (!chosen) return;
    await fetch(`${API}/admin/training/samples/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed_label: chosen }),
    });
    reload();
  };

  const undo_ = async (id) => {
    await fetch(`${API}/admin/training/samples/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed_label: null }),
    });
    reload();
  };

  const deleteSample = async (id) => {
    await fetch(`${API}/admin/training/samples/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConfirm(null); reload();
  };

  const exportZip = async () => {
    setExporting(true);
    const r = await fetch(`${API}/admin/training/export`, { headers: { Authorization: `Bearer ${token}` } });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'training_data.zip'; a.click();
    URL.revokeObjectURL(url); setExporting(false);
  };

  const stats = data?.stats || {};
  const samples = data?.data || [];
  const totalPages = data?.total_pages || 1;

  const labelOptsWithCustom = [...LABEL_OPTS, 'Custom...'];

  return (
    <div>
      {viewerImg && <ImageViewerModal src={viewerImg} onClose={() => setViewerImg(null)} />}
      {confirm && <ConfirmModal message="Delete this training sample?" onConfirm={() => deleteSample(confirm)} onCancel={() => setConfirm(null)} />}
      <div className="admin-training-header">
        <div className="admin-stat-strip">
          <div className="admin-stat"><span className="admin-stat-val">{stats.total ?? '—'}</span><span className="admin-stat-label">Total</span></div>
          <div className="admin-stat"><span className="admin-stat-val">{stats.with_image ?? '—'}</span><span className="admin-stat-label">With Image</span></div>
          <div className="admin-stat"><span className="admin-stat-val">{stats.reviewed ?? '—'}</span><span className="admin-stat-label">Reviewed</span></div>
          <div className="admin-stat"><span className="admin-stat-val">{stats.confirmed ?? '—'}</span><span className="admin-stat-label">Confirmed</span></div>
        </div>
        <button className="admin-export-btn" onClick={exportZip} disabled={exporting}>
          {exporting ? <i className="fa-solid fa-spinner fa-spin" /> : <i className="fa-solid fa-file-zipper" />} Export ZIP
        </button>
      </div>
      {loading ? <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> Loading samples…</div> : (
        <div className="admin-training-grid">
          {samples.length === 0 && <p style={{ color: '#8b949e', gridColumn: '1/-1' }}>No training samples yet. Do a web-app scan to start collecting data.</p>}
          {samples.map(s => {
            const currentEdit = editing[s.id] || s.disease_type;
            const isCustom = currentEdit === 'Custom...';
            const imageSrc = s.has_image ? `${API}/admin/training/samples/${s.id}/image` : null;

            return (
            <div key={s.id} className={`admin-sample-card ${!s.has_image ? 'no-image' : ''}`}>
              <div className="admin-sample-img-wrap" onClick={() => s.has_image && setViewerImg(`${imageSrc}?token=${token}`)} style={{ cursor: s.has_image ? 'pointer' : 'default' }}>
                {s.has_image ? <img src={`${imageSrc}?token=${token}`} alt="Leaf sample" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div className="admin-sample-img-placeholder no-img"><i className="fa-solid fa-ban" /><span>No image</span><span style={{ fontSize: 10, color: '#484f58' }}>Gateway scan</span></div>}
              </div>
              <div className="admin-sample-meta">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={s.disease_type} />
                  {s.reviewed && <span style={{ fontSize: 10, color: '#3fb950', background: '#3fb95022', padding: '2px 6px', borderRadius: 20 }}>✓ Confirmed</span>}
                </div>
                <p style={{ fontSize: 12, color: '#8b949e', margin: '4px 0' }}>{(s.confidence_score * 100).toFixed(1)}% · {s.source === 'web_app' ? 'Web' : 'Gateway'}</p>
                {s.confirmed_label && <p style={{ fontSize: 12, color: '#2f81f7', margin: '2px 0' }}>Label: {s.confirmed_label}</p>}
                <p style={{ fontSize: 11, color: '#484f58', margin: '2px 0' }}>{s.created_at ? new Date(s.created_at).toLocaleString() : ''}</p>
              </div>
              <div className="admin-sample-actions" style={{ flexDirection: 'column', gap: '8px' }}>
                {s.has_image && (
                  <div style={{ display: 'flex', gap: '8px', width: '100%', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <select 
                        className="admin-label-select" 
                        style={{ width: '100%' }} 
                        value={currentEdit} 
                        disabled={s.reviewed}
                        onChange={e => setEditing(prev => ({ ...prev, [s.id]: e.target.value }))}
                      >
                        {labelOptsWithCustom.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      {isCustom && (
                        <input 
                          type="text" 
                          placeholder="Enter custom label" 
                          style={{ padding: '6px 10px', background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, color: '#e6edf3', fontSize: 12, width: '100%', boxSizing: 'border-box' }}
                          value={customLabels[s.id] || ''} 
                          disabled={s.reviewed}
                          onChange={e => setCustomLabels(prev => ({ ...prev, [s.id]: e.target.value }))}
                        />
                      )}
                    </div>
                    {s.reviewed ? (
                      <button className="admin-icon-btn" style={{ height: 'fit-content', background: '#21262d', border: '1px solid #30363d', color: '#8b949e', padding: '6px 12px', fontSize: 12, borderRadius: 7 }} onClick={() => undo_(s.id)}>
                        <i className="fa-solid fa-rotate-left" /> Undo
                      </button>
                    ) : (
                      <button className="admin-confirm-btn" style={{ height: 'fit-content' }} onClick={() => confirm_(s.id, currentEdit)}>
                        <i className="fa-solid fa-check" /> Confirm
                      </button>
                    )}
                    <button className="admin-danger-btn" style={{ height: 'fit-content' }} onClick={() => setConfirm(s.id)}><i className="fa-solid fa-trash" /></button>
                  </div>
                )}
                {!s.has_image && (
                  <button className="admin-danger-btn" style={{ marginLeft: 'auto' }} onClick={() => setConfirm(s.id)}><i className="fa-solid fa-trash" /></button>
                )}
              </div>
            </div>
            );
          })}
        </div>
      )}
      <div className="admin-pagination">
        <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="admin-page-btn"><i className="fa-solid fa-chevron-left" /></button>
        <span style={{ color: '#8b949e', fontSize: 13 }}>Page {page} of {totalPages}</span>
        <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="admin-page-btn"><i className="fa-solid fa-chevron-right" /></button>
      </div>
    </div>
  );
}

// ── Settings Tab ────────────────────────────────────────────────────────────
function SystemSettingsTab() {
  const { token } = useContext(AuthContext);
  const { data: settingsData, loading, reload } = useAdminFetch('/admin/settings');
  const { data: statsData, loading: loadingStats } = useAdminFetch('/admin/stats');
  const [saving, setSaving] = useState(null);

  const updateSetting = async (key, value) => {
    setSaving(key);
    try {
      await fetch(`${API}/admin/settings/${key}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: String(value) }),
      });
      reload();
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> Loading settings…</div>;
  const settings = settingsData?.data || [];
  const stats = statsData || {};

  return (
    <div className="admin-settings-container">
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <i className="fa-solid fa-users" />
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Users</span>
            <span className="admin-stat-value">{stats.users ?? '—'}</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <i className="fa-solid fa-server" />
          <div className="admin-stat-info">
            <span className="admin-stat-label">Active Devices</span>
            <span className="admin-stat-value">{stats.devices ?? '—'}</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <i className="fa-solid fa-clipboard-list" />
          <div className="admin-stat-info">
            <span className="admin-stat-label">Total Scans</span>
            <span className="admin-stat-value">{stats.scans ?? '—'}</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <i className="fa-solid fa-clock" />
          <div className="admin-stat-info">
            <span className="admin-stat-label">System Uptime</span>
            <span className="admin-stat-value">{stats.uptime ? `${Math.floor(stats.uptime / 3600)}h ${Math.floor((stats.uptime % 3600) / 60)}m` : '—'}</span>
          </div>
        </div>
      </div>

      <div className="admin-settings-list">
        <h3 style={{ color: '#e6edf3', marginBottom: 20 }}>Global System Controls</h3>
        {settings.map(s => {
          const isBool = s.value === 'true' || s.value === 'false';
          return (
            <div key={s.key} className="admin-setting-item">
              <div className="admin-setting-info">
                <p className="admin-setting-name">{s.key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}</p>
                <p className="admin-setting-desc">{s.description}</p>
              </div>
              <div className="admin-setting-action">
                {isBool ? (
                  <button 
                    disabled={saving === s.key}
                    onClick={() => updateSetting(s.key, s.value === 'true' ? 'false' : 'true')}
                    className={`admin-toggle ${s.value === 'true' ? 'enabled' : ''}`}
                  >
                    <span></span>
                  </button>
                ) : (
                  <input 
                    type="text" 
                    value={s.value} 
                    onBlur={(e) => e.target.value !== s.value && updateSetting(s.key, e.target.value)}
                    className="admin-setting-input" 
                  />
                )}
                {saving === s.key && <i className="fa-solid fa-spinner fa-spin" style={{ color: '#2f81f7', marginLeft: 10 }} />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main AdminPage ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'users',    label: 'Users',         icon: 'fa-users' },
  { id: 'scans',    label: 'Scan History',   icon: 'fa-clipboard-list' },
  { id: 'training', label: 'Training Data',  icon: 'fa-flask' },
  { id: 'settings', label: 'System Settings', icon: 'fa-gears' },
];

export default function AdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get('tab') || 'users';

  const setTab = (newTab) => {
    queryParams.set('tab', newTab);
    navigate({ search: queryParams.toString() });
  };

  return (
    <div className="admin-page">
      <div className="admin-tab-content" style={{ marginTop: 10 }}>
        {activeTab === 'users'    && <UsersTab />}
        {activeTab === 'scans'    && <ScansTab />}
        {activeTab === 'training' && <TrainingTab />}
        {activeTab === 'settings' && <SystemSettingsTab />}
      </div>
    </div>
  );
}
