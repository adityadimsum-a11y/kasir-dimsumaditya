import { useMemo, useState } from "react";
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


    if (activePage === "owner-control") {
      return (
        <OwnerControlPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "arsip-digital") {
      return (
        <ArchiveDigitalPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }



    if (activePage === "closing-owner") {
      return (
        <ClosingOwnerPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "system-health") {
      return (
        <SystemHealthPage
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

    if (activePage === "stok-ayam") {
      return (
        <StokAyamPage
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

    if (activePage === "antrian-po") {
      return (
        <POQueuePage
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

    if (activePage === "kas-keluar") {
      return (
        <BelanjaKasKeluarPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "hutang-nana") {
      return (
        <HutangNanaPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "empat-amplop") {
      return (
        <EmpatAmplopPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }


    if (activePage === "kewajiban-owner") {
      return (
        <KewajibanOwnerPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "laporan-harian") {
      return (
        <LaporanHarianPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }


    if (activePage === "setoran-cabang") {
      return (
        <SetoranCabangPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "request-do") {
      return (
        <RequestDOPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }



    if (activePage === "hrd-payroll") {
      return (
        <HRDPayrollPage
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "master-produk") {
      return (
        <MasterDataPage
          moduleType="produk"
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "master-customer") {
      return (
        <MasterDataPage
          moduleType="customer"
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "master-supplier") {
      return (
        <MasterDataPage
          moduleType="supplier"
          session={session}
          onSessionExpired={handleSessionExpired}
        />
      );
    }

    if (activePage === "master-lokasi") {
      return (
        <MasterDataPage
          moduleType="lokasi"
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
