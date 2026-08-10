import { useEffect, useMemo, useState } from "react";
import {
  createBranchUser,
  getBranchAccessBootstrap,
  resetBranchUserPassword,
  setBranchUserStatus,
  updateBranchUser,
} from "../../lib/api/actions";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";
import Tabs from "../../components/ui/Tabs";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function makeOperationId(action) {
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `OP-BRANCH-${action}-${stamp}-${random}`;
}

function isAuthRequired(result) {
  const code = String(result?.code || result?.error?.code || "").toUpperCase();
  const message = String(result?.message || "").toUpperCase();
  return code.includes("AUTH") || (message.includes("SESSION") && message.includes("LOGIN"));
}

function normalize(payload) {
  const data = payload?.data || payload || {};
  return {
    health: data.health || {},
    roles: asArray(data.roles),
    locations: asArray(data.locations),
    users: asArray(data.users),
    summary: data.summary || {},
  };
}

function roleMatchesLocation(roleId, location) {
  const type = String(location?.location_type || "").toUpperCase();
  const code = String(location?.location_code || "").toUpperCase();
  if (roleId === "ROLE-HO-ADMIN") return type === "HO" || code === "TGR";
  if (roleId === "ROLE-PRODUCTION-ADMIN") return type.includes("PRODUCTION") || type.includes("FACTORY");
  if (roleId === "ROLE-OUTLET-ADMIN") return type.includes("OUTLET") || type.includes("RESTO") || type.includes("RESTAURANT");
  if (roleId === "ROLE-BRANCH-STAFF") return type !== "HO" && code !== "TGR";
  return true;
}

const EMPTY_DRAFT = {
  full_name: "",
  username: "",
  role_id: "",
  location_id: "",
  password: "",
  confirm_password: "",
};

export default function PermissionRoleCheckPage({ session, onSessionExpired }) {
  const sessionToken = session?.sessionToken || "";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState(() => normalize({}));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [selected, setSelected] = useState(null);
  const [editDraft, setEditDraft] = useState({ full_name: "", role_id: "", location_id: "" });
  const [newPassword, setNewPassword] = useState("");
  const [activeTab, setActiveTab] = useState("accounts");
  const [createOpen, setCreateOpen] = useState(false);

  const availableLocations = useMemo(
    () => data.locations.filter((row) => roleMatchesLocation(draft.role_id, row)),
    [data.locations, draft.role_id]
  );

  const editLocations = useMemo(
    () => data.locations.filter((row) => roleMatchesLocation(editDraft.role_id, row)),
    [data.locations, editDraft.role_id]
  );

  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.users.filter((row) => {
      if (statusFilter !== "ALL" && String(row.status).toUpperCase() !== statusFilter) return false;
      if (!term) return true;
      return JSON.stringify(row).toLowerCase().includes(term);
    });
  }, [data.users, search, statusFilter]);

  async function loadData() {
    setLoading(true);
    setError("");
    try {
      const result = await getBranchAccessBootstrap(sessionToken, {});
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Akun dan permission cabang belum dapat dibaca.");
        return;
      }
      const next = normalize(result);
      setData(next);
      setDraft((current) => ({
        ...current,
        role_id: current.role_id || next.roles[0]?.role_id || "",
      }));
    } catch (err) {
      setError(err?.message || "Gagal membaca akun cabang.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!draft.role_id) return;
    if (!availableLocations.some((row) => row.location_id === draft.location_id)) {
      setDraft((current) => ({
        ...current,
        location_id: availableLocations[0]?.location_id || "",
      }));
    }
  }, [draft.role_id, draft.location_id, availableLocations]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleCreate(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (draft.password !== draft.confirm_password) {
      setError("Konfirmasi password belum sama.");
      return;
    }
    if (!draft.location_id) {
      setError("Lokasi untuk role tersebut belum tersedia.");
      return;
    }

    setSaving(true);
    try {
      const result = await createBranchUser(sessionToken, {
        full_name: draft.full_name,
        username: draft.username,
        role_id: draft.role_id,
        location_id: draft.location_id,
        password: draft.password,
        operation_id: makeOperationId("CREATE"),
      });
      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }
      if (!result?.success) {
        setError(result?.message || "Akun belum berhasil dibuat.");
        return;
      }
      setSuccess(result?.message || "Akun operasional berhasil dibuat.");
      setCreateOpen(false);
      setDraft((current) => ({ ...EMPTY_DRAFT, role_id: current.role_id }));
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal membuat akun.");
    } finally {
      setSaving(false);
    }
  }

  function openDetail(row) {
    setSelected(row);
    setEditDraft({
      full_name: row.full_name || "",
      role_id: row.role_id || "",
      location_id: row.location_id || "",
    });
    setNewPassword("");
    setError("");
    setSuccess("");
  }

  async function handleUpdate() {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const result = await updateBranchUser(sessionToken, {
        user_id: selected.user_id,
        ...editDraft,
        operation_id: makeOperationId("UPDATE"),
      });
      if (isAuthRequired(result)) { onSessionExpired?.(); return; }
      if (!result?.success) {
        setError(result?.message || "Profil akun belum berhasil diperbarui.");
        return;
      }
      setSuccess(result?.message || "Profil akun diperbarui.");
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal memperbarui akun.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus() {
    if (!selected) return;
    const nextStatus = String(selected.status).toUpperCase() === "ACTIVE" ? "Inactive" : "Active";
    setSaving(true);
    setError("");
    try {
      const result = await setBranchUserStatus(sessionToken, {
        user_id: selected.user_id,
        status: nextStatus,
        notes: "Diubah Owner dari Permission & Role.",
        operation_id: makeOperationId("STATUS"),
      });
      if (isAuthRequired(result)) { onSessionExpired?.(); return; }
      if (!result?.success) {
        setError(result?.message || "Status akun belum berhasil diubah.");
        return;
      }
      setSuccess(result?.message || "Status akun diperbarui.");
      setSelected(null);
      await loadData();
    } catch (err) {
      setError(err?.message || "Gagal mengubah status akun.");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetPassword() {
    if (!selected || !newPassword) return;
    setSaving(true);
    setError("");
    try {
      const result = await resetBranchUserPassword(sessionToken, {
        user_id: selected.user_id,
        password: newPassword,
        operation_id: makeOperationId("PASSWORD"),
      });
      if (isAuthRequired(result)) { onSessionExpired?.(); return; }
      if (!result?.success) {
        setError(result?.message || "Password belum berhasil direset.");
        return;
      }
      setSuccess(result?.message || "Password berhasil direset.");
      setNewPassword("");
    } catch (err) {
      setError(err?.message || "Gagal mereset password.");
    } finally {
      setSaving(false);
    }
  }

  const health = data.health || {};
  const blockers = asArray(health.blockers);

  const columns = [
    { key: "full_name", label: "NAMA" },
    { key: "username", label: "USERNAME" },
    { key: "role_name", label: "ROLE" },
    {
      key: "location_name",
      label: "LOKASI",
      render: (row) => `${safeText(row.location_name)} (${safeText(row.location_code)})`,
    },
    {
      key: "active_sessions",
      label: "SESSION",
      render: (row) => Number(row.active_sessions || 0),
    },
    {
      key: "status",
      label: "STATUS",
      render: (row) => (
        <Badge tone={String(row.status).toUpperCase() === "ACTIVE" ? "success" : "warning"}>
          {safeText(row.status)}
        </Badge>
      ),
    },
  ];

  const roleDescriptions = {
    "ROLE-HO-ADMIN": "Admin operasional HO dengan cakupan global, tanpa hak kebijakan Owner.",
    "ROLE-PRODUCTION-ADMIN": "Admin produksi pada lokasi sendiri untuk produksi, stok, cabang, dan HRD operasional.",
    "ROLE-OUTLET-ADMIN": "Admin outlet/resto pada lokasi sendiri untuk penjualan, stok, cabang, dan HRD operasional.",
    "ROLE-BRANCH-STAFF": "Staff cabang dengan akses operasional terbatas sesuai lokasi kerja.",
  };

  return (
    <main className="da-page system-control-page system-access-v17">
      <PageHeader
        eyebrow="Sistem · Owner Control"
        title="Hak Akses & Akun"
        description="Kelola akun operasional, lokasi kerja, role, session, dan batas akses sistem. Halaman ini khusus Owner."
        actions={(
          <div className="da-actions">
            <Button variant="secondary" disabled={loading} onClick={loadData}>{loading ? "Membaca..." : "Perbarui"}</Button>
            <Button onClick={() => setCreateOpen(true)}>+ Buat Akun</Button>
          </div>
        )}
      />

      {error ? <div className="da-alert da-alert-danger">{error}</div> : null}
      {success ? <div className="da-alert da-alert-success">{success}</div> : null}

      <section className="system-access-hero">
        <div className="system-access-hero-copy">
          <span className="system-eyebrow">Kontrol Akses</span>
          <h2>{health.branch_login_ready ? "Akun cabang siap digunakan" : "Lengkapi akun operasional sebelum cabang login"}</h2>
          <p>Password disimpan sebagai hash. Perubahan role, lokasi, status, atau password mencabut session lama agar hak akses baru langsung berlaku saat login berikutnya.</p>
          <div className="system-chip-row">
            <Badge tone={health.foundation_ready ? "success" : "warning"}>Fondasi {health.foundation_ready ? "Siap" : "Belum"}</Badge>
            <Badge tone={health.roles_ready ? "success" : "warning"}>Role {health.roles_ready ? "Lengkap" : "Belum"}</Badge>
            <Badge tone="success">Owner Only</Badge>
          </div>
        </div>
        <div className="system-access-summary">
          <div><span>Akun operasional</span><strong>{data.summary.total_users || 0}</strong></div>
          <div><span>Akun aktif</span><strong>{data.summary.active_users || 0}</strong></div>
          <div><span>Lokasi aktif</span><strong>{data.summary.locations || 0}</strong></div>
        </div>
      </section>

      <section className="system-kpi-grid system-kpi-grid-4">
        <StatCard label="Akun Operasional" value={data.summary.total_users || 0} description="Tidak termasuk akun Owner." />
        <StatCard label="Aktif" value={data.summary.active_users || 0} description="Bisa login sesuai role dan lokasi." tone="success" />
        <StatCard label="Nonaktif" value={data.summary.inactive_users || 0} description="Session operasional tidak aktif." tone={data.summary.inactive_users ? "warning" : "default"} />
        <StatCard label="Lokasi Aktif" value={data.summary.locations || 0} description="Sumber dari Master Lokasi." />
      </section>

      {blockers.length ? (
        <div className="system-blocker-strip">
          <strong>Yang masih perlu disiapkan</strong>
          <div>{blockers.map((item) => <span key={item}>{item}</span>)}</div>
        </div>
      ) : null}

      <div className="system-tabs-wrap">
        <Tabs
          items={[{ key: "accounts", label: "Akun Operasional" }, { key: "roles", label: "Role & Batas Akses" }]}
          activeKey={activeTab}
          onChange={setActiveTab}
        />
      </div>

      {activeTab === "accounts" ? (
        <div className="system-workspace-grid system-access-grid">
          <Card
            title="Akun yang Terdaftar"
            description="Klik akun untuk mengubah profil, reset password, atau aktif/nonaktifkan."
            action={<Badge tone="success">Data Aktual</Badge>}
          >
            <div className="system-toolbar">
              <label className="system-search-field">
                <span className="sr-only">Cari akun</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama, username, lokasi..." />
              </label>
              <div className="system-filter-pills">
                {[{ key: "ALL", label: "Semua" }, { key: "ACTIVE", label: "Aktif" }, { key: "INACTIVE", label: "Nonaktif" }].map((item) => (
                  <button key={item.key} type="button" className={statusFilter === item.key ? "is-active" : ""} onClick={() => setStatusFilter(item.key)}>{item.label}</button>
                ))}
              </div>
            </div>
            <DataTable columns={columns} rows={filteredUsers} getRowKey={(row) => row.user_id} onRowClick={openDetail} />
          </Card>

          <Card title="Prinsip Akses" description="Aturan yang berlaku untuk seluruh akun selain Owner.">
            <div className="system-rule-list">
              <div><strong>Lokasi mengikuti akun</strong><span>Admin cabang hanya bekerja pada lokasi yang ditetapkan kecuali role HO yang memang bersifat global.</span></div>
              <div><strong>Payroll sensitif tetap terlindungi</strong><span>Akses nominal gaji mengikuti permission payroll, bukan sekadar lokasi.</span></div>
              <div><strong>Perubahan akses mencabut session</strong><span>User wajib login ulang setelah role, lokasi, status, atau password diubah.</span></div>
              <div><strong>Menu Sistem tidak diberikan ke cabang</strong><span>Kesiapan Operasional, Integritas Data, Hak Akses, dan Cetak & Backup hanya ditampilkan untuk Owner.</span></div>
            </div>
          </Card>
        </div>
      ) : null}

      {activeTab === "roles" ? (
        <Card title="Role Operasional" description="Role disediakan backend dan digunakan bersama location scope. Owner tidak dibuat dari halaman ini.">
          <div className="system-role-grid">
            {data.roles.map((role) => (
              <div className="system-role-card" key={role.role_id}>
                <div><Badge tone="default">Level {safeText(role.level, "-")}</Badge></div>
                <h3>{safeText(role.role_name)}</h3>
                <code>{safeText(role.role_id)}</code>
                <p>{roleDescriptions[role.role_id] || "Hak akses mengikuti konfigurasi permission aktif di server."}</p>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <Modal
        open={createOpen}
        title="Buat Akun Operasional"
        subtitle="Owner menentukan identitas, role, lokasi kerja, dan password awal."
        onClose={() => !saving && setCreateOpen(false)}
        size="md"
      >
        <form onSubmit={handleCreate} className="system-modal-stack">
          <div className="da-form-grid">
            <label className="da-field">
              Nama Lengkap
              <input value={draft.full_name} onChange={(e) => updateDraft("full_name", e.target.value)} placeholder="Contoh: Admin Produksi Pemalang" disabled={saving} />
            </label>
            <label className="da-field">
              Username
              <input value={draft.username} onChange={(e) => updateDraft("username", e.target.value.toLowerCase())} placeholder="Contoh: admin.pemalang" disabled={saving} />
            </label>
            <label className="da-field">
              Role
              <select value={draft.role_id} onChange={(e) => updateDraft("role_id", e.target.value)} disabled={saving}>
                <option value="">Pilih role</option>
                {data.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.role_name}</option>)}
              </select>
            </label>
            <label className="da-field">
              Lokasi Kerja
              <select value={draft.location_id} onChange={(e) => updateDraft("location_id", e.target.value)} disabled={saving || !availableLocations.length}>
                <option value="">{availableLocations.length ? "Pilih lokasi" : "Belum ada lokasi yang cocok"}</option>
                {availableLocations.map((location) => <option key={location.location_id} value={location.location_id}>{location.location_name} — {location.location_code}</option>)}
              </select>
            </label>
            <label className="da-field">
              Password Awal
              <input type="password" value={draft.password} onChange={(e) => updateDraft("password", e.target.value)} placeholder="Minimal 10 karakter, huruf + angka" disabled={saving} />
            </label>
            <label className="da-field">
              Ulangi Password
              <input type="password" value={draft.confirm_password} onChange={(e) => updateDraft("confirm_password", e.target.value)} placeholder="Ketik ulang password" disabled={saving} />
            </label>
          </div>
          <div className="da-form-actions system-modal-actions">
            <Button type="button" variant="secondary" disabled={saving} onClick={() => setCreateOpen(false)}>Batal</Button>
            <Button type="submit" disabled={saving || !health.foundation_ready}>{saving ? "Menyimpan..." : "Buat Akun"}</Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selected)}
        title={selected ? `Akun ${selected.full_name}` : "Detail Akun"}
        subtitle={selected ? `${selected.username} · ${selected.location_name}` : ""}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div className="system-modal-stack">
            <div className="system-account-statusbar">
              <Badge tone={String(selected.status).toUpperCase() === "ACTIVE" ? "success" : "warning"}>{safeText(selected.status)}</Badge>
              <span>{Number(selected.active_sessions || 0)} session aktif</span>
            </div>
            <div className="da-form-grid">
              <label className="da-field">
                Nama Lengkap
                <input value={editDraft.full_name} onChange={(e) => setEditDraft((current) => ({ ...current, full_name: e.target.value }))} disabled={saving} />
              </label>
              <label className="da-field">
                Role
                <select value={editDraft.role_id} onChange={(e) => setEditDraft((current) => ({ ...current, role_id: e.target.value, location_id: "" }))} disabled={saving}>
                  {data.roles.map((role) => <option key={role.role_id} value={role.role_id}>{role.role_name}</option>)}
                </select>
              </label>
              <label className="da-field">
                Lokasi
                <select value={editDraft.location_id} onChange={(e) => setEditDraft((current) => ({ ...current, location_id: e.target.value }))} disabled={saving}>
                  <option value="">Pilih lokasi</option>
                  {editLocations.map((location) => <option key={location.location_id} value={location.location_id}>{location.location_name}</option>)}
                </select>
              </label>
              <label className="da-field">
                Password Baru
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Isi hanya saat reset password" disabled={saving} />
              </label>
            </div>
            <div className="system-modal-warning">Perubahan role/lokasi dan reset password otomatis mencabut session lama. Staff harus login ulang.</div>
            <div className="da-form-actions system-modal-actions">
              <Button variant="secondary" disabled={saving || !newPassword} onClick={handleResetPassword}>Reset Password</Button>
              <Button variant={String(selected.status).toUpperCase() === "ACTIVE" ? "danger" : "secondary"} disabled={saving} onClick={handleStatus}>
                {String(selected.status).toUpperCase() === "ACTIVE" ? "Nonaktifkan" : "Aktifkan"}
              </Button>
              <Button disabled={saving || !editDraft.location_id} onClick={handleUpdate}>Simpan Profil</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </main>
  );
}
