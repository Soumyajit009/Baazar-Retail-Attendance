import React from 'react';
import { useAuth } from '../context/AuthContext';

const initials = (name) =>
  name ? name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2) : 'U';

export default function Topbar({ subtitle }) {
  const { user, logout } = useAuth();
  return (
    <div className="topbar">
      <div className="topbar-brand">
        <img src="/BK.png" alt="Bazar Retail" style={{ height: 32, borderRadius: 6, objectFit: 'contain' }} />
        <div>
          <div className="topbar-name">Bazar Retail</div>
          <div className="topbar-sub">{subtitle || 'Attendance System'}</div>
        </div>
      </div>
      <div className="topbar-right">
        <div className="badge-role">
          {user?.role === 'admin' ? '⚙ Admin' : user?.name || 'Employee'}
        </div>
        <button className="btn-logout" onClick={logout}>
          Logout
        </button>
      </div>
    </div>
  );
}
