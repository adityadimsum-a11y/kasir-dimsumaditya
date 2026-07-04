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
  return (
    <div className="da-app">
      <Sidebar
        menuGroups={menuGroups}
        activePage={activePage}
        onChangePage={onChangePage}
      />

      <main className="da-main">
        <Topbar session={session} onLogout={onLogout} />
        <div className="da-content">{children}</div>
      </main>
    </div>
  );
}
