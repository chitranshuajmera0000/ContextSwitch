import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

function Layout() {
  return (
    <div className="flex min-h-screen w-full bg-background text-on-background">
      <Sidebar />
      {/* Main area offset by exact sidebar width */}
      <div className="flex flex-col flex-1" style={{ marginLeft: 220 }}>
        <TopBar />
        <main className="flex-1 overflow-hidden" style={{ marginTop: 48, height: 'calc(100vh - 48px)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default Layout;
