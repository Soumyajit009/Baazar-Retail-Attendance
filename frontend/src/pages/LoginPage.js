import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

export default function LoginPage() {
  const [portal, setPortal] = useState('employee');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async () => {
    if (!id || !password) { setError('Please fill all fields'); return; }
    setError(''); setLoading(true);
    try {
      if (portal === 'admin') {
        const res = await api.post('/auth/admin/login', { username: id, password });
        login(res.data.token, { role: 'admin', username: res.data.username });
        navigate('/admin');
      } else {
        const res = await api.post('/auth/employee/login', { employeeId: id, password });
        login(res.data.token, { role: 'employee', ...res.data.employee });
        navigate('/employee');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-header">
          <img src="/BK.png" alt="Bazar Retail" style={{ height: 64, borderRadius: 12, objectFit: 'contain', marginBottom: 16 }} />
          <div className="login-title">{portal === 'admin' ? 'Admin Login' : 'Employee Login'}</div>
          <div className="login-sub">Bazar Retail Attendance System</div>
        </div>

        {error && <div className="login-error">{error}</div>}

        <div className="form-group">
          <label className="form-label">{portal === 'admin' ? 'Username' : 'Employee ID'}</label>
          <input
            className="form-input"
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder={portal === 'admin' ? 'bazarHR' : 'e.g. EMP001'}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Password</label>
           <div style={{ position: 'relative' }}>
  <input
    className="form-input"
    type={showPassword ? 'text' : 'password'}
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    placeholder="Enter password"
    onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
    style={{ paddingRight: 40 }}
  />
  <span
  onClick={() => setShowPassword(!showPassword)}
  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', userSelect: 'none', color: '#6b7280' }}
>
  {showPassword ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )}
</span>
</div>
        </div>

        <button className="btn-primary" onClick={handleSubmit} disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>

        <div className="login-switch">
          {portal === 'admin' ? (
            <span>Employee? <a onClick={() => { setPortal('employee'); setError(''); setId(''); setPassword(''); }}>Go to Employee Login</a></span>
          ) : (
            <span>Admin? <a onClick={() => { setPortal('admin'); setError(''); setId(''); setPassword(''); }}>Go to Admin Login</a></span>
          )}
        </div>
      </div>
    </div>
  );
}
