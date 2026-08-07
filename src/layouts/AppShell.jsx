import { useMemo, useState } from "react";
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

  const activeMeta = useMemo(() => {
    for (const group of menuGroups || []) {
      const item = (group.items || []).find((entry) => entry.key === activePage);
      if (item) {
        return {
          pageTitle: item.label,
          groupTitle: group.title,
          description: item.description || "",
        };
      }
    }
    return { pageTitle: "Dashboard Owner", groupTitle: "ERP Dimsum Aditya", description: "" };
  }, [activePage, menuGroups]);

  const handleChangePage = (pageKey) => {
    onChangePage(pageKey);
    setMobileSidebarOpen(false);
  };

  return (
    <div
      className="da-app da-app-v3"
      data-sidebar-open={mobileSidebarOpen ? "true" : "false"}
      data-page={activePage}
    >
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
          onNavigate={handleChangePage}
          pageTitle={activeMeta.pageTitle}
          groupTitle={activeMeta.groupTitle}
          pageDescription={activeMeta.description}
        />
        <div className="da-content-shell">
          <div className="da-content">{children}</div>
        </div>
      </main>
    </div>
  );
}
