import React, { useState, useEffect, useCallback, useContext } from 'react';
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
function UsersTab() {
  const { token } = useContext(AuthContext);
  const { data, loading, reload } = useAdminFetch('/admin/users');
  const [confirm, setConfirm] = useState(null);

  const deleteUser = async (id) => {
    await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConfirm(null); reload();
  };

  if (loading) return <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> Loading users…</div>;
  const users = data?.data || [];

  return (
    <div>
      {confirm && <ConfirmModal message={`Delete user "${confirm.username}" and all their data? This cannot be undone.`} onConfirm={() => deleteUser(confirm.id)} onCancel={() => setConfirm(null)} />}
      <div className="admin-stat-strip">
        <div className="admin-stat"><span className="admin-stat-val">{users.length}</span><span className="admin-stat-label">Total Users</span></div>
        <div className="admin-stat"><span className="admin-stat-val">{users.reduce((s, u) => s + u.scan_count, 0)}</span><span className="admin-stat-label">Total Scans</span></div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>User</th><th>Email</th><th>Joined</th><th>Scans</th><th>Last Scan</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td><span className="admin-username">{u.username}{u.username === 'admin' && <span className="admin-badge">Admin</span>}</span></td>
                <td style={{ color: '#8b949e' }}>{u.email || '—'}</td>
                <td style={{ color: '#8b949e', fontSize: 12 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                <td><strong>{u.scan_count}</strong></td>
                <td style={{ color: '#8b949e', fontSize: 12 }}>{u.last_scan_at ? new Date(u.last_scan_at).toLocaleString() : '—'}</td>
                <td>{u.username !== 'admin' && <button className="admin-danger-btn" onClick={() => setConfirm(u)}><i className="fa-solid fa-trash" /></button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Devices Tab ───────────────────────────────────────────────────────────────
function DevicesTab() {
  const { token } = useContext(AuthContext);
  const { data, loading, reload } = useAdminFetch('/admin/devices');
  const [copied, setCopied] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const copyKey = async (key, id) => {
    await navigator.clipboard.writeText(key);
    setCopied(id); setTimeout(() => setCopied(null), 2000);
  };
  const deleteDevice = async (id) => {
    await fetch(`${API}/admin/devices/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConfirm(null); reload();
  };
  const regenKey = async (id) => {
    await fetch(`${API}/admin/devices/${id}/regenerate-key`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
    reload();
  };

  if (loading) return <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> Loading devices…</div>;
  const devices = data?.data || [];

  return (
    <div>
      {confirm && <ConfirmModal message={`Delete device "${confirm.device_name}"? This cannot be undone.`} onConfirm={() => deleteDevice(confirm.id)} onCancel={() => setConfirm(null)} />}
      <div className="admin-devices-grid">
        {devices.length === 0 && <p style={{ color: '#8b949e' }}>No devices registered.</p>}
        {devices.map(d => {
          const lastSeen = d.last_seen ? new Date(d.last_seen) : null;
          const online = lastSeen && (Date.now() - lastSeen.getTime()) < DEVICE_ONLINE_MS;
          return (
            <div key={d.id} className="gateway-device-card" style={{ position: 'relative' }}>
              <div className={`gateway-status status-pill ${online ? 'healthy' : lastSeen ? 'offline' : 'delayed'}`}>{online ? 'Online' : lastSeen ? 'Offline' : 'Never seen'}</div>
              <div className="gateway-device-header">
                <div className="gateway-device-title-row"><i className="fa-solid fa-server" /><h4>{d.device_name}</h4></div>
                <p style={{ color: '#8b949e', fontSize: 12 }}>Owner: <strong style={{ color: '#e6edf3' }}>{d.owner_username}</strong> · ID: {d.id}</p>
              </div>
              <div className="gateway-key-box">
                <p className="gateway-key-label">API Key</p>
                <div className="gateway-key-row">
                  <code className="gateway-key-value">{d.api_key.substring(0, 20)}…</code>
                  <button className={`gateway-copy-btn ${copied === d.id ? 'copied' : ''}`} onClick={() => copyKey(d.api_key, d.id)}>
                    <i className={`fa-solid ${copied === d.id ? 'fa-check' : 'fa-copy'}`} /> {copied === d.id ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <div className="gateway-actions">
                <button className="gateway-action-btn" onClick={() => regenKey(d.id)}><i className="fa-solid fa-rotate-right" /> Regenerate</button>
                <button className="gateway-action-btn danger" onClick={() => setConfirm(d)}><i className="fa-solid fa-trash" /> Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Scans Tab ─────────────────────────────────────────────────────────────────
function ScansTab() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('All');
  const qs = `?page=${page}&limit=20${filter !== 'All' ? `&disease_type=${encodeURIComponent(filter)}` : ''}`;
  const { data, loading } = useAdminFetch(`/admin/scans${qs}`, [page, filter]);
  const scans = data?.data || [];
  const totalPages = data?.total_pages || 1;

  return (
    <div>
      <div className="admin-filter-bar">
        {DISEASE_OPTS.map(opt => (
          <button key={opt} className={`admin-filter-btn ${filter === opt ? 'active' : ''}`} onClick={() => { setFilter(opt); setPage(1); }}>{opt}</button>
        ))}
        {data && <span style={{ marginLeft: 'auto', color: '#8b949e', fontSize: 13 }}>{data.total} total</span>}
      </div>
      {loading ? <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> Loading…</div> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Time</th><th>User</th><th>Disease</th><th>Confidence</th><th>Temp</th><th>Humidity</th><th>Source</th></tr></thead>
            <tbody>
              {scans.map(s => (
                <tr key={s.id}>
                  <td style={{ fontSize: 12, color: '#8b949e' }}>{s.timestamp ? new Date(s.timestamp).toLocaleString() : '—'}</td>
                  <td><span className="admin-username">{s.owner_username}</span></td>
                  <td><Badge label={s.disease_type} /></td>
                  <td><strong>{(s.confidence_score * 100).toFixed(1)}%</strong></td>
                  <td style={{ color: '#8b949e' }}>{s.temperature != null ? `${s.temperature.toFixed(1)}°C` : '—'}</td>
                  <td style={{ color: '#8b949e' }}>{s.humidity != null ? `${s.humidity.toFixed(1)}%` : '—'}</td>
                  <td><span style={{ fontSize: 11, color: s.source === 'web_app' ? '#2f81f7' : '#3fb950', background: s.source === 'web_app' ? '#2f81f722' : '#3fb95022', padding: '2px 8px', borderRadius: 20 }}>{s.source === 'web_app' ? 'Web' : 'Gateway'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
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

// ── Training Tab ──────────────────────────────────────────────────────────────
function TrainingTab() {
  const { token } = useContext(AuthContext);
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useAdminFetch(`/admin/training/samples?page=${page}&limit=20`, [page]);
  const [editing, setEditing] = useState({});
  const [confirm, setConfirm] = useState(null);
  const [exporting, setExporting] = useState(false);

  const confirm_ = async (id, label) => {
    const chosen = label || editing[id] || null;
    if (!chosen) return;
    await fetch(`${API}/admin/training/samples/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed_label: chosen }),
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

  return (
    <div>
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
          {samples.map(s => (
            <div key={s.id} className={`admin-sample-card ${!s.has_image ? 'no-image' : ''}`}>
              <div className="admin-sample-img-wrap">
                {s.has_image ? <div className="admin-sample-img-placeholder"><i className="fa-solid fa-image" /></div>
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
              <div className="admin-sample-actions">
                {s.has_image && (
                  <>
                    <select className="admin-label-select" value={editing[s.id] || s.disease_type} onChange={e => setEditing(prev => ({ ...prev, [s.id]: e.target.value }))}>
                      {LABEL_OPTS.map(l => <option key={l}>{l}</option>)}
                    </select>
                    <button className="admin-confirm-btn" onClick={() => confirm_(s.id, editing[s.id] || s.disease_type)}>
                      <i className="fa-solid fa-check" /> Confirm
                    </button>
                  </>
                )}
                <button className="admin-danger-btn" onClick={() => setConfirm(s.id)}><i className="fa-solid fa-trash" /></button>
              </div>
            </div>
          ))}
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

// ── Main AdminPage ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'users',    label: 'Users',         icon: 'fa-users' },
  { id: 'devices',  label: 'Devices',        icon: 'fa-server' },
  { id: 'scans',    label: 'Scan History',   icon: 'fa-clipboard-list' },
  { id: 'training', label: 'Training Data',  icon: 'fa-flask' },
];

export default function AdminPage() {
  const [tab, setTab] = useState('users');

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="settings-page-eyebrow"><i className="fa-solid fa-shield-halved" style={{ marginRight: 6 }} />Admin Panel</p>
          <h2 className="settings-page-title">System Management</h2>
        </div>
      </div>
      <div className="admin-tab-bar">
        {TABS.map(t => (
          <button key={t.id} className={`admin-tab-btn ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            <i className={`fa-solid ${t.icon}`} /> {t.label}
          </button>
        ))}
      </div>
      <div className="admin-tab-content">
        {tab === 'users'    && <UsersTab />}
        {tab === 'devices'  && <DevicesTab />}
        {tab === 'scans'    && <ScansTab />}
        {tab === 'training' && <TrainingTab />}
      </div>
    </div>
  );
}
