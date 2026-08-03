import { useState } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AppShell({
  session,
  menuGroups,
  activePage,
  onChangePage,
  onLogout,
  children,
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleChangePage = (pageKey) => {
    onChangePage(pageKey);
    setMobileSidebarOpen(false);
  };

  return (
    <div className="da-app" data-sidebar-open={mobileSidebarOpen ? "true" : "false"}>
      <Sidebar
        menuGroups={menuGroups}
        activePage={activePage}
        onChangePage={handleChangePage}
        open={mobileSidebarOpen}
        onClose={() => setMobileSidebarOpen(false)}
      />

      <div
        className="da-sidebar-backdrop"
        role="presentation"
        onClick={() => setMobileSidebarOpen(false)}
      />

      <main className="da-main">
        <Topbar
          session={session}
          onLogout={onLogout}
          onOpenSidebar={() => setMobileSidebarOpen(true)}
        />
        <div className="da-content-shell">
          <div className="da-content">{children}</div>
        </div>
      </main>
    </div>
  );
}
