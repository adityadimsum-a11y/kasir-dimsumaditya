import { useEffect, useMemo, useState } from "react";
import { MENU_GROUPS, PAGE_META } from "./config/menu.config";
import { getSavedSession, saveSession, clearSession } from "./lib/auth/session";
import { getAllowedMenuGroups } from "./lib/auth/permissions";
import { logoutUser } from "./lib/api/actions";
import AppShell from "./layouts/AppShell";
import LoginPage from "./modules/auth/LoginPage";
import ModulePlaceholder from "./modules/common/ModulePlaceholder";
import PapanPusatPage from "./modules/owner/PapanPusatPage";
import OwnerControlPage from "./modules/owner/OwnerControlPage";
import ArchiveDigitalPage from "./modules/archive/ArchiveDigitalPage";
import DropAyamPage from "./modules/chicken/DropAyamPage";
import StokAyamPage from "./modules/chicken/StokAyamPage";
import AdukanPage from "./modules/production/AdukanPage";
import FreezerInPage from "./modules/stock/FreezerInPage";
import FinishedStockPage from "./modules/stock/FinishedStockPage";
import OrderPage from "./modules/sales/OrderPage";
import POQueuePage from "./modules/sales/POQueuePage";
import UangMasukPage from "./modules/finance/UangMasukPage";
import KasDompetPage from "./modules/finance/KasDompetPage";
import BelanjaKasKeluarPage from "./modules/finance/BelanjaKasKeluarPage";
import HutangNanaPage from "./modules/finance/HutangNanaPage";
import EmpatAmplopPage from "./modules/finance/EmpatAmplopPage";
import KewajibanOwnerPage from "./modules/finance/KewajibanOwnerPage";
import LaporanHarianPage from "./modules/branch/LaporanHarianPage";
import SetoranCabangPage from "./modules/branch/SetoranCabangPage";
import RequestDOPage from "./modules/branch/RequestDOPage";
import MasterDataPage from "./modules/master/MasterDataPage";
import HRDPayrollPage from "./modules/hrd/HRDPayrollPage";
import ClosingOwnerPage from "./modules/closing/ClosingOwnerPage";
import SystemHealthPage from "./modules/system/SystemHealthPage";
import GoLiveChecklistPage from "./modules/system/GoLiveChecklistPage";
import PermissionRoleCheckPage from "./modules/system/PermissionRoleCheckPage";
import CrossModuleFocusBanner from "./components/navigation/CrossModuleFocusBanner";
import FocusDetailAutoOpen from "./components/navigation/FocusDetailAutoOpen";
import {
  FOCUS_EVENT_NAME,
  clearFocusUrl,
  readFocusFromLocation,
} from "./lib/navigation/focusRouter";

export default function App() {
  const initialFocus = useMemo(() => readFocusFromLocation(), []);
  const [session, setSession] = useState(() => getSavedSession());
  const [activePage, setActivePage] = useState(() => initialFocus?.pageKey || "papan-pusat");
  const [focusRequest, setFocusRequest] = useState(() => initialFocus);

  const allowedMenuGroups = useMemo(() => {
    return getAllowedMenuGroups(MENU_GROUPS, session);
  }, [session]);

  const flatPages = useMemo(() => {
    return allowedMenuGroups.flatMap((group) => group.items || []);
  }, [allowedMenuGroups]);

  useEffect(() => {
    const applyFocus = (event) => {
      const nextFocus = event?.detail || readFocusFromLocation();
      if (!nextFocus?.pageKey) return;

      setFocusRequest({ ...nextFocus, createdAt: Date.now() });
      setActivePage(nextFocus.pageKey);
    };

    const handlePopState = () => {
      const nextFocus = readFocusFromLocation();
      if (nextFocus?.pageKey) {
        setFocusRequest({ ...nextFocus, createdAt: Date.now() });
        setActivePage(nextFocus.pageKey);
      } else {
        setFocusRequest(null);
      }
    };

    window.addEventListener(FOCUS_EVENT_NAME, applyFocus);
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener(FOCUS_EVENT_NAME, applyFocus);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  const selectedPage = PAGE_META[activePage] || PAGE_META["papan-pusat"];

  const handleLoginSuccess = (nextSession) => {
    saveSession(nextSession);
    setSession(nextSession);

    const allowedPages = getAllowedMenuGroups(MENU_GROUPS, nextSession).flatMap(
      (group) => group.items || []
    );

    const pendingFocus = readFocusFromLocation();
    if (pendingFocus?.pageKey && allowedPages.some((item) => item.key === pendingFocus.pageKey)) {
      setFocusRequest(pendingFocus);
      setActivePage(pendingFocus.pageKey);
      return;
    }

    const firstAllowedPage = allowedPages[0]?.key || "papan-pusat";
    setFocusRequest(null);
    setActivePage(firstAllowedPage);
  };

  const handleSessionExpired = () => {
    clearSession();
    setSession(null);
    setFocusRequest(null);
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
      setFocusRequest(null);
      setActivePage("papan-pusat");
    }
  };

  const handleChangePage = (nextPage) => {
    setFocusRequest(null);
    clearFocusUrl();
    setActivePage(nextPage);
  };

  const handleClearFocus = () => {
    setFocusRequest(null);
    clearFocusUrl();
  };

  const pageProps = {
    session,
    onSessionExpired: handleSessionExpired,
    focusRequest,
    onClearFocus: handleClearFocus,
  };

  const renderPage = () => {
    if (activePage === "papan-pusat") {
      return (
        <PapanPusatPage
          {...pageProps}
        />
      );
    }


    if (activePage === "owner-control") {
      return (
        <OwnerControlPage
          {...pageProps}
        />
      );
    }

    if (activePage === "arsip-digital") {
      return (
        <ArchiveDigitalPage
          {...pageProps}
        />
      );
    }



    if (activePage === "closing-owner") {
      return (
        <ClosingOwnerPage
          {...pageProps}
        />
      );
    }

    if (activePage === "system-health") {
      return (
        <SystemHealthPage
          {...pageProps}
        />
      );
    }

    if (activePage === "go-live-check") {
      return (
        <GoLiveChecklistPage
          {...pageProps}
        />
      );
    }

    if (activePage === "permission-role-check") {
      return (
        <PermissionRoleCheckPage
          {...pageProps}
        />
      );
    }

    if (activePage === "drop-ayam") {
      return (
        <DropAyamPage
          {...pageProps}
        />
      );
    }

    if (activePage === "stok-ayam") {
      return (
        <StokAyamPage
          {...pageProps}
        />
      );
    }

    if (activePage === "produksi-adukan") {
      return (
        <AdukanPage
          {...pageProps}
        />
      );
    }

    if (activePage === "barang-freezer") {
      return (
        <FreezerInPage
          {...pageProps}
        />
      );
    }

    if (activePage === "stok-jadi") {
      return (
        <FinishedStockPage
          {...pageProps}
        />
      );
    }

    if (activePage === "kasir-order") {
      return (
        <OrderPage
          {...pageProps}
        />
      );
    }

    if (activePage === "antrian-po") {
      return (
        <POQueuePage
          {...pageProps}
        />
      );
    }

    if (activePage === "uang-masuk") {
      return (
        <UangMasukPage
          {...pageProps}
        />
      );
    }

    if (activePage === "kas-dompet") {
      return (
        <KasDompetPage
          {...pageProps}
        />
      );
    }

    if (activePage === "kas-keluar") {
      return (
        <BelanjaKasKeluarPage
          {...pageProps}
        />
      );
    }

    if (activePage === "hutang-nana") {
      return (
        <HutangNanaPage
          {...pageProps}
        />
      );
    }

    if (activePage === "empat-amplop") {
      return (
        <EmpatAmplopPage
          {...pageProps}
        />
      );
    }


    if (activePage === "kewajiban-owner") {
      return (
        <KewajibanOwnerPage
          {...pageProps}
        />
      );
    }

    if (activePage === "laporan-harian") {
      return (
        <LaporanHarianPage
          {...pageProps}
        />
      );
    }


    if (activePage === "setoran-cabang") {
      return (
        <SetoranCabangPage
          {...pageProps}
        />
      );
    }

    if (activePage === "request-do") {
      return (
        <RequestDOPage
          {...pageProps}
        />
      );
    }



    if (activePage === "hrd-payroll") {
      return (
        <HRDPayrollPage
          {...pageProps}
        />
      );
    }

    if (activePage === "master-produk") {
      return (
        <MasterDataPage
          moduleType="produk"
          {...pageProps}
        />
      );
    }

    if (activePage === "master-customer") {
      return (
        <MasterDataPage
          moduleType="customer"
          {...pageProps}
        />
      );
    }

    if (activePage === "master-supplier") {
      return (
        <MasterDataPage
          moduleType="supplier"
          {...pageProps}
        />
      );
    }

    if (activePage === "master-lokasi") {
      return (
        <MasterDataPage
          moduleType="lokasi"
          {...pageProps}
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
      onChangePage={handleChangePage}
      onLogout={handleLogout}
    >
      <div className="da-page-stack">
        <CrossModuleFocusBanner
          focusRequest={focusRequest}
          onClear={handleClearFocus}
        />
        <FocusDetailAutoOpen
          session={session}
          focusRequest={focusRequest}
          onSessionExpired={handleSessionExpired}
        />
        {renderPage()}
      </div>
    </AppShell>
  );
}
