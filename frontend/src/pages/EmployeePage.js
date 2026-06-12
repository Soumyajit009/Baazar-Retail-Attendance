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
  const [summary, setSummary] = useState({ present: 0, absent: 0, total: 0, percentage: 0 });
  const [period, setPeriod] = useState('month');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { fetchSummary(); }, [period]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/attendance/today/me');
      setTodayRec(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const res = await api.get(`/attendance/summary/me?period=${period}`);
      setSummary(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckIn = async () => {
    setError(''); setSubmitting(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });
      const { latitude, longitude } = position.coords;
      const res = await api.post('/attendance/checkin', { latitude, longitude });
      setTodayRec(res.data);
      await fetchSummary();
    } catch (err) {
      if (err.code === 1 || err.code === 2 || err.code === 3) {
        setError('Location access denied. Please enable GPS to Check In.');
      } else {
        setError(err.response?.data?.error || 'Check In failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    setError(''); setSubmitting(true);
    try {
      const res = await api.post('/attendance/checkout');
      setTodayRec(res.data);
      await fetchSummary();
    } catch (err) {
      setError(err.response?.data?.error || 'Check Out failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAbsent = async () => {
    setError(''); setSubmitting(true);
    try {
      const res = await api.post('/attendance/absent');
      setTodayRec(res.data);
      await fetchSummary();
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const pct = summary.percentage || 0;

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
            todayRec.status === 'Absent' ? (
              <div className="error-banner">
                You marked <strong>Absent</strong> today.
              </div>
            ) : (
              <div>
                <div className="success-banner">
                  <div className="success-icon">✓</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>Checked In at {fmtTime(todayRec.checkin_time || todayRec.time)}</div>
                    {todayRec.checkout_time && (
                      <div style={{ fontSize: 13, color: '#374151', marginTop: 2 }}>
                        Checked Out at {fmtTime(todayRec.checkout_time)}
                        {todayRec.auto_checkout && ' (auto)'}
                      </div>
                    )}
                  </div>
                </div>
                {!todayRec.checkout_time && (
                  <>
                    {error && <div className="error-banner">{error}</div>}
                    <button className="btn-primary" onClick={handleCheckOut} disabled={submitting} style={{ marginTop: 8, background: 'var(--red)' }}>
                      {submitting ? 'Processing...' : '🚪 Check Out'}
                    </button>
                  </>
                )}
              </div>
            )
          ) : (
            <>
              <div className="info-banner">🕐 Attendance window will close at 10:30 AM</div>
              {error && <div className="error-banner">{error}</div>}
              <div className="radio-group">
                <button className="btn-primary" onClick={handleCheckIn} disabled={submitting} style={{ background: 'var(--green)' }}>
                  {submitting ? 'Processing...' : '✅ Check In'}
                </button>
                <button className="btn-primary" onClick={handleAbsent} disabled={submitting} style={{ background: 'var(--red)' }}>
                  {submitting ? 'Processing...' : '❌ Absent'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="section-header" style={{ marginBottom: 0 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>📊 Attendance Summary</div>
            <div className="tabs" style={{ marginBottom: 0 }}>
              <div className={`tab ${period === 'week' ? 'active' : ''}`} onClick={() => setPeriod('week')}>This Week</div>
              <div className={`tab ${period === 'month' ? 'active' : ''}`} onClick={() => setPeriod('month')}>This Month</div>
            </div>
          </div>
          <div className="monthly-grid" style={{ marginTop: 16 }}>
            <div className="monthly-item">
              <div className="monthly-num num-green">{summary.present}</div>
              <div className="monthly-lbl">Present Days</div>
            </div>
            <div className="monthly-item">
              <div className="monthly-num num-red">{summary.absent}</div>
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
          <div style={{ fontSize: 12, color: 'var(--gray)', marginTop: 6, textAlign: 'right' }}>{pct}% attendance {period === 'week' ? 'this week' : 'this month'}</div>
        </div>
      </div>
    </div>
  );
}