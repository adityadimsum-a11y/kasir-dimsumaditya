import { Archive, CalendarDays, LogOut, MapPin, Menu, ShieldCheck } from "lucide-react";
import Button from "../components/ui/Button";

function initials(value = "") {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "DA";
  return parts.slice(0, 2).map((item) => item.charAt(0).toUpperCase()).join("");
}

function todayLabel() {
  try {
    return new Intl.DateTimeFormat("id-ID", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date());
  } catch {
    return "Hari ini";
  }
}

export default function Topbar({ session, onLogout, onOpenSidebar, onNavigate, pageTitle = "Dashboard Owner", groupTitle = "ERP Dimsum Aditya" }) {
  const user = session?.user || {};
  const userName = user.name || user.username || "User";
  const locationName = user.location_name || user.location_id || "Lokasi";
  const roleName = user.role_name || user.role_id || "Role";

  return (
    <header className="da-topbar da-topbar-v3">
      <div className="da-topbar-left-v3">
        <button type="button" className="da-mobile-menu-btn da-mobile-menu-btn-v3" aria-label="Buka menu" onClick={onOpenSidebar}>
          <Menu size={20} />
        </button>
        <div className="da-topbar-page-v3">
          <span>{groupTitle}</span>
          <strong>{pageTitle}</strong>
        </div>
      </div>

      <div className="da-topbar-tools-v3">
        <button type="button" className="da-topbar-search-v3" onClick={() => onNavigate?.("arsip-digital")} title="Buka Arsip Digital">
          <Archive size={16} />
          <span>Cari transaksi atau ID</span>
        </button>
        <div className="da-topbar-date-v3"><CalendarDays size={15} /><span>{todayLabel()}</span></div>
        <div className="da-topbar-location-v3"><MapPin size={14} /><span>{locationName}</span></div>
        <div className="da-topbar-user-v3">
          <div className="da-user-avatar-v3">{initials(userName)}<span /></div>
          <div><strong>{userName}</strong><small><ShieldCheck size={11} /> {roleName}</small></div>
        </div>
        <Button variant="ghost" onClick={onLogout} className="da-logout-button-v3" title="Keluar"><LogOut size={16} /><span>Keluar</span></Button>
      </div>
    </header>
  );
}
