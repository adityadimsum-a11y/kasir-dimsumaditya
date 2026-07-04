import Button from "../components/ui/Button";

export default function Topbar({ session, onLogout }) {
  const user = session?.user || {};

  return (
    <header className="da-topbar">
      <div>
        <div className="da-topbar-title">ERP Dimsum Aditya</div>
        <div className="da-topbar-subtitle">
          {user.location_name || "Lokasi belum terbaca"} ·{" "}
          {user.role_name || user.role_id || "Role belum terbaca"}
        </div>
      </div>

      <div className="da-topbar-user">
        <div>
          <div className="da-user-name">{user.name || user.username || "User"}</div>
          <div className="da-user-label">Sedang aktif</div>
        </div>

        <Button variant="ghost" onClick={onLogout}>
          Keluar
        </Button>
      </div>
    </header>
  );
}
