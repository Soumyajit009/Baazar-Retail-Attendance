import React, { useState, useEffect, useCallback } from 'react';
import Topbar from '../components/Topbar';
import LiveClock from '../components/LiveClock';
import api from '../utils/api';

const today = () => new Date().toISOString().split('T')[0];
const fmtDate = (s) => new Date(s + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = (t) => { if (!t) return '—'; const [hh, mm] = t.split(':'); const h = parseInt(hh); return `${h % 12 || 12}:${mm} ${h >= 12 ? 'PM' : 'AM'}`; };
const initials = (name) => name ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

export default function AdminPage() {
  const [tab, setTab] = useState('dashboard');
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [notMarked, setNotMarked] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterDate, setFilterDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const now = new Date();
  const showNotMarked = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() >= 45);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        api.get('/employees'),
        api.get('/departments'),
      ]);
      setEmployees(empRes.data);
      setDepartments(deptRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const loadAttendance = useCallback(async () => {
    try {
      const params = {};
      if (filterDate) params.date = filterDate;
      if (filterDept) params.department = filterDept;
      if (search) params.search = search;
      const [attRes, nmRes] = await Promise.all([
        api.get('/attendance', { params }),
        api.get('/attendance/not-marked'),
      ]);
      setAttendance(attRes.data);
      setNotMarked(nmRes.data);
    } catch (e) { console.error(e); }
  }, [filterDate, filterDept, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadAttendance(); const t = setInterval(loadAttendance, 15000); return () => clearInterval(t); }, [loadAttendance]);

  const flash = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const todayAtt = attendance.filter(a => a.date === today());
  const presentToday = todayAtt.filter(a => a.status === 'Present').length;
  const absentToday = todayAtt.filter(a => a.status === 'Absent').length;

  const saveEmployee = async () => {
    if (!form.employeeId || !form.name || !form.department || !form.password) { alert('All fields required'); return; }
    try {
      if (modal === 'addEmp') {
        await api.post('/employees', form);
        flash('Employee added successfully');
      } else {
        await api.put(`/employees/${form.id}`, { name: form.name, department: form.department, joiningDate: form.joiningDate });
        flash('Employee updated');
      }
      setModal(null); setForm({}); setShowPassword(false);
      load();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const deleteEmployee = async (id) => {
    if (!window.confirm('Delete this employee?')) return;
    try { await api.delete(`/employees/${id}`); load(); flash('Employee deleted'); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const resetPassword = async () => {
    if (!form.newPassword) { alert('Enter new password'); return; }
    try {
      await api.patch(`/employees/${form.id}/reset-password`, { password: form.newPassword });
      setModal(null); setForm({}); setShowPassword(false); flash('Password updated successfully');
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const saveDept = async () => {
    if (!form.name) { alert('Department name required'); return; }
    try {
      if (modal === 'addDept') { await api.post('/departments', { name: form.name }); }
      else { await api.put(`/departments/${form.id}`, { name: form.name }); }
      setModal(null); setForm({}); setShowPassword(false); load(); flash('Department saved');
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const deleteDept = async (id) => {
    if (!window.confirm('Delete this department?')) return;
    try { await api.delete(`/departments/${id}`); load(); flash('Department deleted'); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
  };

  const exportExcel = async () => {
    try {
      const token = localStorage.getItem('token');
      const url = `${process.env.REACT_APP_API_URL || 'http://localhost:5000/api'}/attendance/export?date=${filterDate || today()}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await response.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Attendance_${filterDate || today()}.xlsx`;
      link.click();
    } catch (err) {
      alert('Export failed');
    }
  };

  const tabs = [
    { k: 'dashboard', l: '🏠 Dashboard' },
    { k: 'attendance', l: '📋 Attendance' },
    { k: 'employees', l: '👥 Employees' },
    { k: 'departments', l: '🏢 Departments' },
  ];

  return (
    <div className="app">
      <Topbar subtitle="Admin Portal" />
      <div className="main-content">
        <LiveClock />
        {msg && <div className="success-banner" style={{ marginBottom: 16 }}><div className="success-icon">✓</div><div style={{ fontWeight: 600 }}>{msg}</div></div>}

        <div className="tabs">{tabs.map(t => <div key={t.k} className={`tab ${tab === t.k ? 'active' : ''}`} onClick={() => setTab(t.k)}>{t.l}</div>)}</div>

        {/* DASHBOARD */}
        {tab === 'dashboard' && (
          <>
            <div className="grid-4" style={{ marginBottom: 16 }}>
              <div className="stat-card stat-blue"><div className="stat-label">Total Employees</div><div className="stat-value" style={{ color: 'var(--blue)' }}>{employees.length}</div></div>
              <div className="stat-card stat-green"><div className="stat-label">Present Today</div><div className="stat-value" style={{ color: 'var(--green)' }}>{presentToday}</div></div>
              <div className="stat-card stat-red"><div className="stat-label">Absent Today</div><div className="stat-value" style={{ color: 'var(--red)' }}>{absentToday}</div></div>
              <div className="stat-card stat-amber"><div className="stat-label">Not Marked</div><div className="stat-value" style={{ color: 'var(--amber)' }}>{notMarked.length}</div></div>
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title">Today's Attendance</div>
              {todayAtt.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">📋</div><div>No attendance submitted yet today</div></div>
              ) : (
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr>{['Employee ID', 'Name', 'Department', 'Status', 'Check In', 'Check Out'].map(c => <th key={c}>{c}</th>)}</tr></thead>
                    <tbody>
                      {todayAtt.map((a, i) => (
                        <tr key={i}>
                          <td>{a.employee_code}</td>
                          <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="emp-initials">{initials(a.employee_name)}</div>{a.employee_name}</div></td>
                          <td><span className="badge badge-blue">{a.department}</span></td>
                          <td><span className={`badge ${a.status === 'Present' ? 'badge-green' : 'badge-red'}`}>{a.status}</span></td>
                          <td>{fmtTime(a.checkin_time)}</td>
                          <td>{fmtTime(a.checkout_time)}{a.auto_checkout && a.checkout_time ? ' 🔁' : ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {showNotMarked && (
              <div className="card">
                <div className="not-marked-header">
                  <div className="pulsedot" />
                  <div style={{ fontFamily: "'Sora',sans-serif", fontWeight: 600, fontSize: 15, color: '#92400e' }}>Not Marked (visible after 9:45 AM)</div>
                </div>
                {notMarked.length === 0 ? (
                  <div className="success-banner" style={{ margin: 0 }}><div className="success-icon">✓</div><div style={{ fontWeight: 600 }}>All employees have marked attendance!</div></div>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead><tr>{['Employee ID', 'Name', 'Department'].map(c => <th key={c}>{c}</th>)}</tr></thead>
                      <tbody>
                        {notMarked.map(e => (
                          <tr key={e.id}>
                            <td>{e.employee_id}</td>
                            <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="emp-initials">{initials(e.name)}</div>{e.name}</div></td>
                            <td><span className="badge badge-amber">{e.department}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ATTENDANCE */}
        {tab === 'attendance' && (
          <>
            <div className="section-header">
              <div className="section-title">Attendance Records</div>
              <button className="btn-sm btn-green" onClick={exportExcel}>⬇ Download Excel</button>
            </div>
            <div className="search-bar">
              <input className="search-input" placeholder="Search by name or ID..." value={search} onChange={e => setSearch(e.target.value)} />
              <select className="search-select" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                <option value="">All Departments</option>
                {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
              <input className="search-input" type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} style={{ maxWidth: 160 }} />
            </div>
            <div className="table-wrap">
              {attendance.length === 0 ? (
                <div className="empty-state"><div className="empty-state-icon">🔍</div><div>No records found</div></div>
              ) : (
                <table className="data-table">
                  <thead><tr>{['Employee ID', 'Name', 'Department', 'Status', 'Check In', 'Check Out', 'Date'].map(c => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {attendance.map((a, i) => (
                      <tr key={i}>
                        <td>{a.employee_code}</td>
                        <td>{a.employee_name}</td>
                        <td><span className="badge badge-blue">{a.department}</span></td>
                        <td><span className={`badge ${a.status === 'Present' ? 'badge-green' : 'badge-red'}`}>{a.status}</span></td>
                        <td>{fmtTime(a.checkin_time)}</td>
                        <td>{fmtTime(a.checkout_time)}{a.auto_checkout && a.checkout_time ? ' 🔁' : ''}</td>
                        <td>{fmtDate(a.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {/* EMPLOYEES */}
        {tab === 'employees' && (
          <>
            <div className="section-header">
              <div className="section-title">Employee Management</div>
              <button className="btn-sm btn-blue" onClick={() => { setForm({}); setModal('addEmp'); }}>+ Add Employee</button>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr>{['Employee ID', 'Name', 'Department', 'Actions'].map(c => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {employees.map(e => (
                    <tr key={e.id}>
                      <td><span className="badge badge-blue">{e.employee_id}</span></td>
                      <td><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="emp-initials">{initials(e.name)}</div>{e.name}</div></td>
                      <td>{e.department}</td>
                      <td>{e.joining_date ? fmtDate(e.joining_date) : '—'}</td>
                      <td>
                        <div className="action-btns">
                          <button className="btn-sm btn-outline" onClick={() => { setForm({ ...e }); setModal('editEmp'); }}>Edit</button>
                          <button className="btn-sm btn-amber" onClick={() => { setForm({ id: e.id, name: e.name }); setModal('resetPw'); }}>Reset PW</button>
                          <button className="btn-sm btn-red" onClick={() => deleteEmployee(e.id)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* DEPARTMENTS */}
        {tab === 'departments' && (
          <>
            <div className="section-header">
              <div className="section-title">Department Management</div>
              <button className="btn-sm btn-blue" onClick={() => { setForm({}); setModal('addDept'); }}>+ Add Department</button>
            </div>
            {departments.length === 0 ? (
              <div className="empty-state"><div className="empty-state-icon">🏢</div><div>No departments yet. Click + Add Department to create one.</div></div>
            ) : (
              <div className="grid-3">
                {departments.map(d => (
                  <div key={d.id} className="card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ fontSize: 28 }}>🏢</div>
                        <div style={{ fontWeight: 600, fontFamily: "'Sora',sans-serif", fontSize: 15 }}>{d.name}</div>
                      </div>
                      <div className="action-btns">
                        <button className="btn-sm btn-outline" onClick={() => { setForm({ id: d.id, name: d.name }); setModal('editDept'); }}>Edit</button>
                        <button className="btn-sm btn-red" onClick={() => deleteDept(d.id)}>Del</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>

      {/* MODALS */}
      {(modal === 'addEmp' || modal === 'editEmp') && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">{modal === 'addEmp' ? 'Add New Employee' : 'Edit Employee'}</div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Employee ID</label>
                <input className="form-input" value={form.employee_id || form.employeeId || ''} onChange={e => setForm({ ...form, employeeId: e.target.value })} disabled={modal === 'editEmp'} />
              </div>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Department</label>
                <select className="form-input" value={form.department || ''} onChange={e => setForm({ ...form, department: e.target.value })}>
                  <option value="">Select...</option>
                  {departments.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              {modal === 'addEmp' && (
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      className="form-input"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password || ''}
                      onChange={e => setForm({ ...form, password: e.target.value })}
                      style={{ paddingRight: 40 }}
                    />
                    <span
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', fontSize: 16, userSelect: 'none' }}
                    >
                      {showPassword ? '🙈' : '👁️'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Joining Date</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.joining_date || form.joiningDate || ''}
                  onChange={e => setForm({ ...form, joiningDate: e.target.value })}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-outline" onClick={() => { setModal(null); setForm({}); setShowPassword(false); }}>Cancel</button>
              <button className="btn-sm btn-blue" onClick={saveEmployee}>Save</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'resetPw' && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Reset Password — {form.name}</div>
            <div className="form-group">
              <label className="form-label">New Password</label>
              <input className="form-input" type="password" value={form.newPassword || ''} onChange={e => setForm({ ...form, newPassword: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-outline" onClick={() => { setModal(null); setForm({}); setShowPassword(false); }}>Cancel</button>
              <button className="btn-sm btn-blue" onClick={resetPassword}>Update Password</button>
            </div>
          </div>
        </div>
      )}

      {(modal === 'addDept' || modal === 'editDept') && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">{modal === 'addDept' ? 'Add Department' : 'Edit Department'}</div>
            <div className="form-group">
              <label className="form-label">Department Name</label>
              <input className="form-input" value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="modal-footer">
              <button className="btn-sm btn-outline" onClick={() => { setModal(null); setForm({}); setShowPassword(false); }}>Cancel</button>
              <button className="btn-sm btn-blue" onClick={saveDept}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}