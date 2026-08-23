import React from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import DashboardOwner from './DashboardOwner';
import './dimsum-theme.css';

export default function AppLayout() {
  return (
    <div className="app-wrapper">
      <Sidebar role="OWNER" />
      <div className="main-content-wrapper">
        <Topbar />
        <main className="main-content">
          <DashboardOwner />
        </main>
      </div>
    </div>
  );
}
