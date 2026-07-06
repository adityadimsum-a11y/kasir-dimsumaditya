import { useMemo, useState } from "react";
import { MENU_GROUPS, PAGE_META } from "./config/menu.config";
import { getSavedSession, saveSession, clearSession } from "./lib/auth/session";
import { getAllowedMenuGroups } from "./lib/auth/permissions";
import { logoutUser } from "./lib/api/actions";
import AppShell from "./layouts/AppShell";
import LoginPage from "./modules/auth/LoginPage";
import ModulePlaceholder from "./modules/common/ModulePlaceholder";
import PapanPusatPage from "./modules/owner/PapanPusatPage";
import DropAyamPage from "./modules/chicken/DropAyamPage";
import AdukanPage from "./modules/production/AdukanPage";
import FreezerInPage from "./modules/stock/FreezerInPage";
import FinishedStockPage from "./modules/stock/FinishedStockPage";
import OrderPage from "./modules/sales/OrderPage";
import UangMasukPage from "./modules/finance/UangMasukPage";
import KasDompetPage from "./modules/finance/KasDompetPage";

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

  const handleSessionExpired = () => {
    clearSession();
    setSession(null);
    setActivePage("papan-pusat");
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

  const renderPage = () => {
    if (activePage === "papan-pusat") {
      return (
        <PapanPusatPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "drop-ayam") {
      return (
        <DropAyamPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "produksi-adukan") {
      return (
        <AdukanPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "barang-freezer") {
      return (
        <FreezerInPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "stok-jadi") {
      return (
        <FinishedStockPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "kasir-order") {
      return (
        <OrderPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "uang-masuk") {
      return (
        <UangMasukPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "kas-dompet") {
      return (
        <KasDompetPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    return (
      <ModulePlaceholder
        page={selectedPage}
        activePage={activePage}
        availablePages={flatPages}
      />
    );
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
      {renderPage()}
    </AppShell>
  );
}
