import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/apiBase';
import { AuthContext } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

const API = getApiBaseUrl();
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
  const { t } = useLanguage();
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 12, padding: 28, maxWidth: 380, width: '90%' }}>
        <p style={{ color: '#e6edf3', marginBottom: 20, fontSize: 15 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="admin-cancel-btn">{t('common', 'cancel')}</button>
          <button onClick={onConfirm} className="admin-primary-btn" style={{ background: '#f85149' }}>{t('settings', 'remove')}</button>
        </div>
      </div>
    </div>
  );
}

// ── Users Tab ─────────────────────────────────────────────────────────────────
function UserManagementModal({ user, onClose, onUpdate }) {
  const { t } = useLanguage();
  const { token } = useContext(AuthContext);
  const { data: devicesData, reload: reloadDevices } = useAdminFetch(`/admin/devices`); 
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
    setNewDeviceName(''); setShowAddDevice(false); reloadDevices();
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
          <h3>{t('admin', 'manageUser')}: {user.username}</h3>
          <button onClick={onClose} className="admin-modal-close"><i className="fa-solid fa-xmark" /></button>
        </div>
        <div className="admin-modal-body">
          <div className="admin-modal-section">
            <h4><i className="fa-solid fa-user-gear" /> {t('settings', 'general')}</h4>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>{t('profile', 'displayName')}</label>
                <input type="text" value={formData.display_name} onChange={e => setFormData({...formData, display_name: e.target.value})} />
              </div>
              <div className="admin-form-group">
                <label>{t('auth', 'email')}</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>{t('settings', 'confidenceThreshold')} ({formData.disease_confidence_threshold}%)</label>
                <input type="range" min="50" max="95" value={formData.disease_confidence_threshold} onChange={e => setFormData({...formData, disease_confidence_threshold: parseInt(e.target.value)})} />
              </div>
              <div className="admin-form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 25 }}>
                <label style={{ marginBottom: 0 }}>{t('settings', 'pushNotifications')}</label>
                <button 
                  onClick={() => setFormData({...formData, notification_emails_enabled: !formData.notification_emails_enabled})}
                  className={`admin-toggle ${formData.notification_emails_enabled ? 'enabled' : ''}`}
                ><span></span></button>
              </div>
            </div>
            <button onClick={handleSave} disabled={saving} className="admin-primary-btn" style={{ marginTop: 10 }}>
              {saving ? <i className="fa-solid fa-spinner fa-spin" /> : t('settings', 'saveChanges')}
            </button>
          </div>

          <div className="admin-modal-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
              <h4 style={{ margin: 0 }}><i className="fa-solid fa-server" /> {t('admin', 'gateways')}</h4>
              <button onClick={() => setShowAddDevice(true)} className="admin-add-btn"><i className="fa-solid fa-plus" /> {t('common', 'addDevice')}</button>
            </div>
            
            {showAddDevice && (
              <div className="admin-inline-add">
                <input type="text" placeholder={t('common', 'deviceName')} value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} />
                <button onClick={handleAddDevice} className="admin-confirm-btn">{t('common', 'createDevice')}</button>
                <button onClick={() => setShowAddDevice(false)} className="admin-cancel-btn">{t('common', 'cancel')}</button>
              </div>
            )}

            <div className="admin-modal-devices">
              {userDevices.length === 0 ? <p className="admin-empty-msg">{t('settings', 'noDevicesConnectedYet')}</p> : userDevices.map(d => {
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
                        <button onClick={() => copyKey(d.api_key, d.id)} className="admin-icon-btn" title={t('settings', 'copy')}>
                          <i className={`fa-solid ${copied === d.id ? 'fa-check' : 'fa-copy'}`} />
                        </button>
                      </div>
                    </div>
                    <div className="admin-device-actions">
                      <button onClick={() => regenKey(d.id)} className="admin-icon-btn" title={t('settings', 'regenerate')}><i className="fa-solid fa-rotate" /></button>
                      <button onClick={() => deleteDevice(d.id)} className="admin-icon-btn danger" title={t('settings', 'remove')}><i className="fa-solid fa-trash" /></button>
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
  const { t } = useLanguage();
  const { token } = useContext(AuthContext);
  const [search, setSearch] = useState('');
  const { data, loading, reload } = useAdminFetch(`/admin/users${search ? `?search=${encodeURIComponent(search)}` : ''}`, [search]);
  const [confirm, setConfirm] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);

  const deleteUser = async (id) => {
    await fetch(`${API}/admin/users/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
    setConfirm(null); reload();
  };

  if (loading && !data) return <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> {t('common', 'loading')}</div>;
  const users = data?.data || [];

  return (
    <div>
      {confirm && <ConfirmModal message={t('admin', 'deleteUserConfirm').replace('{username}', confirm.username)} onConfirm={() => deleteUser(confirm.id)} onCancel={() => setConfirm(null)} />}
      {selectedUser && <UserManagementModal user={selectedUser} onClose={() => setSelectedUser(null)} onUpdate={reload} />}
      
      <div className="admin-action-bar">
        <div className="admin-search-wrap">
          <i className="fa-solid fa-magnifying-glass" />
          <input type="text" placeholder={t('auth', 'enterUsername')} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="admin-stat-summary">
          <span><strong>{users.length}</strong> {t('admin', 'users')}</span>
          <span><strong>{users.reduce((s, u) => s + u.scan_count, 0)}</strong> {t('admin', 'total')} {t('logs', 'title')}</span>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>{t('auth', 'username')}</th><th>{t('auth', 'email')}</th><th>{t('logs', 'timestamp')}</th><th>{t('logs', 'title')}</th><th>{t('disease', 'lastScan')}</th><th></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td onClick={() => setSelectedUser(u)} style={{ cursor: 'pointer' }}>
                  <div className="admin-user-cell">
                    <div className="admin-avatar-small">{u.display_name?.charAt(0) || u.username.charAt(0)}</div>
                    <span className="admin-username">{u.username}{u.username === 'admin' && <span className="admin-badge">{t('nav', 'admin')}</span>}</span>
                  </div>
                </td>
                <td style={{ color: '#8b949e' }}>{u.email || '—'}</td>
                <td style={{ color: '#8b949e', fontSize: 12 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                <td><strong>{u.scan_count}</strong></td>
                <td style={{ color: '#8b949e', fontSize: 12 }}>{u.last_scan_at ? new Date(u.last_scan_at).toLocaleString() : '—'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button className="admin-icon-btn" onClick={() => setSelectedUser(u)} title={t('admin', 'manageUser')}>
                      <i className="fa-solid fa-user-gear" /> {t('common', 'manage')}
                    </button>
                    {u.username !== 'admin' && (
                      <button className="admin-danger-btn" onClick={() => setConfirm(u)}>
                        <i className="fa-solid fa-trash" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>{t('nav', 'noNotifications')}</div>}
      </div>
    </div>
  );
}

function ScansTab() {
  const { t } = useLanguage();
  const { data: usersData } = useAdminFetch('/admin/users');
  const [filterUser, setFilterUser] = useState('');
  const { data, loading } = useAdminFetch(`/admin/scans${filterUser ? `?user_id=${filterUser}` : ''}`, [filterUser]);

  if (loading && !data) return <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> {t('common', 'loading')}</div>;
  const scans = data?.data || [];

  return (
    <div>
      <div className="admin-action-bar">
        <div className="admin-filter-wrap">
          <label><i className="fa-solid fa-filter" /> {t('nav', 'unreadOnly').replace('Unread', 'Filter')}</label>
          <select className="admin-select" value={filterUser} onChange={e => setFilterUser(e.target.value)}>
            <option value="">{t('nav', 'allItems')}</option>
            {(usersData?.data || []).map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
          </select>
        </div>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>{t('logs', 'diseaseClass')}</th><th>{t('auth', 'username')}</th><th>{t('logs', 'timestamp')}</th><th>{t('logs', 'confidence')}</th><th>{t('logs', 'source')}</th><th>{t('sensor', 'temperature')}</th></tr></thead>
          <tbody>
            {scans.map(s => (
              <tr key={s.id}>
                <td><Badge label={s.disease_type} /></td>
                <td>{s.owner_username}</td>
                <td style={{ color: '#8b949e', fontSize: 12 }}>{new Date(s.timestamp).toLocaleString()}</td>
                <td>{(s.confidence_score * 100).toFixed(0)}%</td>
                <td><span className="admin-source-tag">{s.source}</span></td>
                <td style={{ color: '#8b949e' }}>{s.temperature ? `${s.temperature}°C` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {scans.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#8b949e' }}>{t('logs', 'empty')}</div>}
      </div>
    </div>
  );
}

function TrainingTab() {
  const { t } = useLanguage();
  const { token } = useContext(AuthContext);
  const [page, setPage] = useState(1);
  const { data, loading, reload } = useAdminFetch(`/admin/training/samples?page=${page}`, [page]);

  const confirm_ = async (id, label) => {
    await fetch(`${API}/admin/training/samples/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmed_label: label }),
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

  if (loading && !data) return <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> {t('common', 'loading')}</div>;
  const samples = data?.data || [];
  const stats = data?.stats || {};

  return (
    <div>
      <div className="admin-action-bar">
        <div className="admin-stat-summary">
          <span><strong>{stats.total || 0}</strong> {t('admin', 'total')}</span>
          <span><strong>{stats.confirmed || 0}</strong> {t('admin', 'confirmed')}</span>
        </div>
        <button onClick={() => window.location.href=`${API}/admin/training/export`} className="admin-add-btn">
          <i className="fa-solid fa-download" /> {t('admin', 'exportZip')}
        </button>
      </div>

      <div className="admin-training-grid">
        {samples.map(s => (
          <div key={s.id} className="admin-sample-card">
            <div className="admin-sample-img">
              {s.has_image ? <img src={`${API}/admin/training/samples/${s.id}/image`} alt="Sample" /> : <div className="admin-no-img"><i className="fa-solid fa-image" /></div>}
              {s.reviewed && <div className="admin-reviewed-badge"><i className="fa-solid fa-check" /> {t('admin', 'confirmed')}</div>}
            </div>
            <div className="admin-sample-info">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="admin-sample-id">#{s.id}</span>
                  <Badge label={s.disease_type} />
                </div>
                <span className="admin-sample-source">{s.source}</span>
              </div>
              
              {s.reviewed ? (
                <div className="admin-confirmed-row">
                  <div className="admin-confirmed-label">
                    <span className="admin-label-dot" /> {s.confirmed_label}
                  </div>
                  <button onClick={() => undo_(s.id)} className="admin-undo-btn">{t('admin', 'undo')}</button>
                </div>
              ) : (
                <div className="admin-label-actions">
                  {LABEL_OPTS.map(opt => (
                    <button key={opt} onClick={() => confirm_(s.id, opt)} className="admin-confirm-opt">{opt}</button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {samples.length === 0 && <div className="admin-empty-state">{t('admin', 'noSamples')}</div>}
    </div>
  );
}

function SystemSettingsTab() {
  const { t } = useLanguage();
  const { token } = useContext(AuthContext);
  const { data, loading, reload } = useAdminFetch('/admin/stats');
  const { data: settingsData, reload: reloadSettings } = useAdminFetch('/admin/settings');

  const updateSetting = async (key, val) => {
    await fetch(`${API}/admin/settings/${key}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: val }),
    });
    reloadSettings();
  };

  if (loading && !data) return <div className="admin-loading"><i className="fa-solid fa-spinner fa-spin" /> {t('common', 'loading')}</div>;
  const stats = data || {};
  const settings = settingsData?.data || [];

  return (
    <div>
      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <i className="fa-solid fa-users" />
          <div className="admin-stat-info">
            <span className="admin-stat-label">{t('admin', 'users')}</span>
            <span className="admin-stat-value">{stats.users}</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <i className="fa-solid fa-server" />
          <div className="admin-stat-info">
            <span className="admin-stat-label">{t('admin', 'gateways')}</span>
            <span className="admin-stat-value">{stats.devices}</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <i className="fa-solid fa-microchip" />
          <div className="admin-stat-info">
            <span className="admin-stat-label">{t('logs', 'title')}</span>
            <span className="admin-stat-value">{stats.scans}</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <i className="fa-solid fa-flask" />
          <div className="admin-stat-info">
            <span className="admin-stat-label">{t('admin', 'training')}</span>
            <span className="admin-stat-value">{stats.samples}</span>
          </div>
        </div>
      </div>

      <div className="admin-settings-list">
        <h3><i className="fa-solid fa-screwdriver-wrench" /> {t('admin', 'settings')}</h3>
        {settings.map(s => (
          <div key={s.key} className="admin-setting-item">
            <div>
              <p className="admin-setting-name">{s.key.replace(/_/g, ' ')}</p>
              <p className="admin-setting-desc">System default configuration for this parameter.</p>
            </div>
            <input 
              type="text" 
              className="admin-setting-input" 
              defaultValue={s.value} 
              onBlur={e => updateSetting(s.key, e.target.value)} 
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminPage() {
  const { t } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get('tab') || 'users';

  if (!user || user.username !== 'admin') {
    return <div className="admin-access-denied">Access Denied</div>;
  }

  const tabs = [
    { id: 'users', label: t('admin', 'users'), icon: 'fa-users' },
    { id: 'scans', label: t('admin', 'scans'), icon: 'fa-clipboard-list' },
    { id: 'training', label: t('admin', 'training'), icon: 'fa-flask' },
    { id: 'settings', label: t('admin', 'settings'), icon: 'fa-screwdriver-wrench' },
  ];

  return (
    <div className="admin-panel-container">
      <div className="admin-sidebar">
        <div className="admin-sidebar-header">
          <div className="admin-logo">
            <i className="fa-solid fa-shield-halved" />
            <span>{t('nav', 'admin')} Panel</span>
          </div>
        </div>
        <nav className="admin-nav">
          {tabs.map(tab => (
            <button 
              key={tab.id}
              onClick={() => navigate(`/admin?tab=${tab.id}`)}
              className={`admin-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            >
              <i className={`fa-solid ${tab.icon}`} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <main className="admin-content">
        <header className="admin-content-header">
          <h2>{tabs.find(t => t.id === activeTab)?.label}</h2>
          <div className="admin-user-profile">
            <span>{user.username}</span>
            <div className="admin-avatar">{user.username.charAt(0).toUpperCase()}</div>
          </div>
        </header>

        <div className="admin-tab-content">
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'scans' && <ScansTab />}
          {activeTab === 'training' && <TrainingTab />}
          {activeTab === 'settings' && <SystemSettingsTab />}
        </div>
      </main>
    </div>
  );
}
