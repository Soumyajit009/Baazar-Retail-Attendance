import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Topbar from '../components/Topbar';
import api from '../utils/api';

const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (t) => { if (!t) return '—'; const [hh, mm] = t.split(':'); const h = parseInt(hh); return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`; };
const today = () => new Date().toISOString().split('T')[0];
const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

export default function EmployeePage() {
  const { user } = useAuth();
  const [todayRec, setTodayRec] = useState(null);
  const [monthly, setMonthly] = useState({ present: 0, absent: 0, total: 0, percentage: 0 });
  const [selected, setSelected] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const outsideWindow = now.getHours() > 10;

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [todayRes, monthlyRes] = await Promise.all([
        api.get('/attendance/today/me'),
        api.get('/attendance/monthly/me'),
      ]);
      setTodayRec(todayRes.data);
      setMonthly(monthlyRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selected) { setError('Please select Present or Absent'); return; }
    setError(''); setSubmitting(true);

    try {
      let latitude = null;
      let longitude = null;

      if (selected === 'Present') {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
            });
          });
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch (geoErr) {
          setError('Location access denied. Please enable GPS to mark Present.');
          setSubmitting(false);
          return;
        }
      }

      const res = await api.post('/attendance/submit', { status: selected, latitude, longitude });
      setTodayRec(res.data);
      await fetchData();
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const pct = monthly.percentage || 0;

  return (
    <div className="app">
      <Topbar subtitle="Employee Portal" />
      <div className="main-content">
        <div className="welcome-card">
          <div>
            <div className="welcome-name">Welcome, {user?.name}</div>
            <div className="welcome-meta">{user?.employeeId} · {user?.department} · {fmtDate(today())}</div>
          </div>
          <div className="welcome-avatar">{initials(user?.name)}</div>
        </div>

        <div className="card">
          <div className="card-title">📋 Mark Attendance</div>

          {loading ? (
            <div className="loading"><div className="spinner" />Loading...</div>
          ) : todayRec ? (
            <div className="success-banner">
              <div className="success-icon">✓</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Attendance Already Submitted Today</div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>
                  Status: <strong>{todayRec.status}</strong> at {fmtTime(todayRec.time)}
                </div>
              </div>
            </div>
          ) : (
            <>
              {outsideWindow && (
                <div className="warning-banner">⚠️ Attendance window (9:00 AM – 10:00 AM) has closed for today.</div>
              )}
              <div className="info-banner">🕐 Attendance window: 9:00 AM – 10:00 AM</div>
              {error && <div className="error-banner">{error}</div>}
              <div className="radio-group">
                <div
                  className={`radio-option ${selected === 'Present' ? 'selected-present' : ''}`}
                  onClick={() => setSelected('Present')}
                >
                  <div className="radio-circle">{selected === 'Present' && <div className="radio-dot" />}</div>
                  <div className="radio-label">✅ Present</div>
                </div>
                <div
                  className={`radio-option ${selected === 'Absent' ? 'selected-absent' : ''}`}
                  onClick={() => setSelected('Absent')}
                >
                  <div className="radio-circle">{selected === 'Absent' && <div className="radio-dot" />}</div>
                  <div className="radio-label">❌ Absent</div>
                </div>
              </div>
              <button className="btn-primary" onClick={handleSubmit} disabled={submitting} style={{ marginTop: 8 }}>
                {submitting ? 'Submitting...' : 'Submit Attendance'}
              </button>
            </>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title">📊 Monthly Summary</div>
          <div className="monthly-grid">
            <div className="monthly-item">
              <div className="monthly-num num-green">{monthly.present}</div>
              <div className="monthly-lbl">Present Days</div>
            </div>
            <div className="monthly-item">
              <div className="monthly-num num-red">{monthly.absent}</div>
              <div className="monthly-lbl">Absent Days</div>
            </div>
            <div className="monthly-item">
              <div className="monthly-num num-blue">{pct}%</div>
              <div className="monthly-lbl">Attendance %</div>
            </div>
          </div>
          <div className="progress-bar-wrap" style={{ marginTop: 16 }}>
            <div className="progress-bar" style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)' }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 6, textAlign: 'right' }}>{pct}% attendance this month</div>
        </div>
      </div>
    </div>
  );
}
