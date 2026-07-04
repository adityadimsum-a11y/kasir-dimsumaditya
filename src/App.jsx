import { useMemo, useState } from "react";
import { MENU_GROUPS, PAGE_META } from "./config/menu.config";
import { getSavedSession, saveSession, clearSession } from "./lib/auth/session";
import { getAllowedMenuGroups } from "./lib/auth/permissions";
import { logoutUser } from "./lib/api/actions";
import AppShell from "./layouts/AppShell";
import LoginPage from "./modules/auth/LoginPage";
import ModulePlaceholder from "./modules/common/ModulePlaceholder";

export default function App() {
  const [session, setSession] = useState(() => getSavedSession());
  const [activePage, setActivePage] = useState("papan-pusat");

  const allowedMenuGroups = useMemo(() => {
    return getAllowedMenuGroups(MENU_GROUPS, session);
  }, [session]);

  const flatPages = useMemo(() => {
    return allowedMenuGroups.flatMap((group) => group.items || []);
  }, [allowedMenuGroups]);

  const selectedPage = PAGE_META[activePage] || PAGE_META["papan-pusat"];

  const handleLoginSuccess = (nextSession) => {
    saveSession(nextSession);
    setSession(nextSession);

    const firstAllowedPage =
      getAllowedMenuGroups(MENU_GROUPS, nextSession)
        .flatMap((group) => group.items || [])[0]?.key || "papan-pusat";

    setActivePage(firstAllowedPage);
  };

  const handleLogout = async () => {
    try {
      if (session?.sessionToken) {
        await logoutUser(session.sessionToken);
      }
    } finally {
      clearSession();
      setSession(null);
      setActivePage("papan-pusat");
    }
  };

  if (!session?.sessionToken) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <AppShell
      session={session}
      menuGroups={allowedMenuGroups}
      activePage={activePage}
      onChangePage={setActivePage}
      onLogout={handleLogout}
    >
      <ModulePlaceholder
        page={selectedPage}
        activePage={activePage}
        availablePages={flatPages}
      />
    </AppShell>
  );
}
