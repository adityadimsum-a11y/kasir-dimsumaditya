import React, { useMemo, useState } from "react";
import { MENU_GROUPS } from "../../config/menu.config";
import {
  getAllowedMenuGroups,
  getUserScope,
} from "../../lib/auth/permissions";
import {
  ROLE_SCOPES,
  buildPermissionCopySummary,
  getPermissionReadiness,
  makeMockSession,
} from "../../lib/roles/permissionRoleRules";

const BRAND = {
  red: "#b42318",
  redSoft: "#fef2f2",
  orange: "#f97316",
  goldSoft: "#fffbeb",
  greenSoft: "#f0fdf4",
  blueSoft: "#eff6ff",
  ink: "#111827",
  muted: "#64748b",
  line: "#e5e7eb",
};

export default function PermissionRoleCheckPage({ session }) {
  const [previewScope, setPreviewScope] = useState("OWNER");

  const report = useMemo(() => {
    return getPermissionReadiness({
      session,
      menuGroups: MENU_GROUPS,
      getAllowedMenuGroups,
      getUserScope,
    });
  }, [session]);

  const previewSession = useMemo(() => makeMockSession(previewScope), [previewScope]);
  const previewGroups = useMemo(
    () => getAllowedMenuGroups(MENU_GROUPS, previewSession),
    [previewSession]
  );

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(buildPermissionCopySummary(report));
      alert("Ringkasan Permission Check sudah disalin.");
    } catch (error) {
      alert("Browser belum mengizinkan copy otomatis.");
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.hero}>
        <div>
          <div style={styles.kicker}>Pusat Kendali</div>
          <h1 style={styles.title}>Permission & Role Check</h1>
          <p style={styles.desc}>
            Cek final menu dan akses per role sebelum sistem dipakai staff. Ini
            hanya membaca konfigurasi menu, session aktif, dan simulasi role.
            Tidak mengubah data.
          </p>
        </div>
        <Badge tone={report.tone}>{report.status}</Badge>
      </section>

      <section style={styles.scoreCard}>
        <div>
          <div style={styles.scoreLabel}>Score Permission</div>
          <div style={styles.score}>
            {report.score}
            <span>/100</span>
          </div>
          <p style={styles.scoreDesc}>
            Target sebelum go-live: cabang tidak melihat data sensitif owner,
            payroll nominal, 4 Amplop, Data Health, master pusat, dan uang pusat.
          </p>
        </div>

        <div style={styles.sessionBox}>
          <div style={styles.sessionTitle}>Session Aktif</div>
          <InfoRow label="Nama" value={session?.user?.name || session?.user?.user_name || "-"} />
          <InfoRow label="Role" value={session?.user?.role_id || session?.user?.role_name || "-"} />
          <InfoRow label="Lokasi" value={session?.user?.location_code || session?.user?.location_name || "-"} />
          <InfoRow label="Scope" value={report.currentAccess.scope || "-"} />
          <button style={styles.primaryBtn} onClick={copySummary}>Copy Ringkasan</button>
        </div>
      </section>

      <section style={styles.grid}>
        <MiniCard label="Menu Terlihat" value={report.currentAccess.pageCount} note="Dari session aktif" />
        <MiniCard label="Group Terlihat" value={report.currentAccess.groupCount} note="Sidebar aktif" />
        <MiniCard label="Sensitive Aktif" value={report.currentAccess.sensitiveCount} note="Wajar untuk Owner/HO" />
        <MiniCard label="Blocker" value={report.blockers.length} note="Harus nol sebelum live" danger={report.blockers.length > 0} />
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHead}>
          <div>
            <h2 style={styles.panelTitle}>Checklist Role</h2>
            <p style={styles.panelDesc}>
              Jika ada blocker, perbaikan dilakukan di menu.config atau permission matrix,
              bukan dari halaman ini.
            </p>
          </div>
          <Badge tone={report.blockers.length ? "danger" : "success"}>
            {report.blockers.length ? `${report.blockers.length} blocker` : "Aman"}
          </Badge>
        </div>

        <TableWrap>
          <thead>
            <tr>
              <th style={styles.th}>CEK</th>
              <th style={styles.th}>DETAIL</th>
              <th style={styles.th}>SUMBER</th>
              <th style={styles.th}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {report.checks.map((row) => (
              <tr key={row.id}>
                <td style={styles.td}><b>{row.title}</b></td>
                <td style={styles.td}>{row.detail}</td>
                <td style={styles.td}>{row.source}</td>
                <td style={styles.td}><Badge tone={row.tone}>{row.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHead}>
          <div>
            <h2 style={styles.panelTitle}>Matrix Role</h2>
            <p style={styles.panelDesc}>
              Simulasi menu yang terlihat untuk Owner, Tangerang, Pemalang,
              Cibinong, dan Staff.
            </p>
          </div>
        </div>

        <TableWrap>
          <thead>
            <tr>
              <th style={styles.th}>ROLE</th>
              <th style={styles.th}>MENU</th>
              <th style={styles.th}>CATATAN</th>
              <th style={styles.th}>STATUS</th>
            </tr>
          </thead>
          <tbody>
            {report.matrix.map((row) => (
              <tr key={row.key}>
                <td style={styles.td}><b>{row.label}</b></td>
                <td style={styles.td}>{row.allowedCount} menu</td>
                <td style={styles.td}>
                  {row.violationKeys?.length ? (
                    <span>Perlu cek: {row.violationKeys.join(", ")}</span>
                  ) : (
                    row.expected
                  )}
                </td>
                <td style={styles.td}><Badge tone={row.tone}>{row.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelHead}>
          <div>
            <h2 style={styles.panelTitle}>Preview Sidebar per Role</h2>
            <p style={styles.panelDesc}>
              Pilih role untuk melihat menu apa saja yang muncul. Ini simulasi
              frontend, bukan login sungguhan.
            </p>
          </div>
          <select
            style={styles.select}
            value={previewScope}
            onChange={(event) => setPreviewScope(event.target.value)}
          >
            {ROLE_SCOPES.map((scope) => (
              <option key={scope.key} value={scope.key}>{scope.label}</option>
            ))}
          </select>
        </div>

        <div style={styles.menuPreview}>
          {previewGroups.map((group) => (
            <div key={group.key} style={styles.previewGroup}>
              <div style={styles.previewTitle}>{group.title}</div>
              <div style={styles.previewItems}>
                {(group.items || []).map((item) => (
                  <span key={item.key} style={styles.menuPill}>{item.label}</span>
                ))}
              </div>
            </div>
          ))}
          {!previewGroups.length ? (
            <div style={styles.empty}>Tidak ada menu untuk scope ini.</div>
          ) : null}
        </div>
      </section>

      <section style={styles.noteBox}>
        <b>Catatan:</b> halaman ini masih alat final check permission. Nanti
        kalau sudah masuk layout go-live final, bahasa menu untuk staff bisa
        dibuat lebih sederhana, sementara logic role tetap ketat di belakang.
      </section>
    </main>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={styles.infoRow}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function MiniCard({ label, value, note, danger }) {
  return (
    <div style={{ ...styles.miniCard, background: danger ? BRAND.redSoft : "#fff", borderColor: danger ? "#fecaca" : BRAND.line }}>
      <div style={styles.miniLabel}>{label}</div>
      <div style={styles.miniValue}>{value ?? 0}</div>
      <div style={styles.miniNote}>{note}</div>
    </div>
  );
}

function TableWrap({ children }) {
  return (
    <div style={styles.tableWrap}>
      <table style={styles.table}>{children}</table>
    </div>
  );
}

function Badge({ children, tone = "default" }) {
  const meta = {
    success: { bg: BRAND.greenSoft, color: "#15803d", border: "#bbf7d0" },
    danger: { bg: BRAND.redSoft, color: "#991b1b", border: "#fecaca" },
    warning: { bg: BRAND.goldSoft, color: "#92400e", border: "#fde68a" },
    info: { bg: BRAND.blueSoft, color: "#1d4ed8", border: "#bfdbfe" },
    default: { bg: "#f8fafc", color: BRAND.ink, border: BRAND.line },
  }[tone] || { bg: "#f8fafc", color: BRAND.ink, border: BRAND.line };

  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "6px 10px", fontSize: 12, fontWeight: 900, background: meta.bg, color: meta.color, border: `1px solid ${meta.border}`, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

const styles = {
  page: { padding: "28px 32px 48px", color: BRAND.ink },
  hero: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 20 },
  kicker: { color: BRAND.muted, fontSize: 14, fontWeight: 800, marginBottom: 4 },
  title: { margin: 0, fontSize: 34, lineHeight: 1.1, fontWeight: 950 },
  desc: { maxWidth: 880, margin: "10px 0 0", color: BRAND.muted, lineHeight: 1.6 },
  scoreCard: { display: "grid", gridTemplateColumns: "1fr 340px", gap: 18, background: "linear-gradient(135deg, #fff 0%, #fff7ed 100%)", border: "1px solid #fed7aa", borderRadius: 24, padding: 22, boxShadow: "0 18px 45px rgba(124,45,18,0.08)", marginBottom: 16 },
  scoreLabel: { color: BRAND.muted, fontWeight: 900, textTransform: "uppercase", fontSize: 12, letterSpacing: 0.7 },
  score: { fontSize: 68, fontWeight: 950, color: BRAND.red, lineHeight: 1, marginTop: 8 },
  scoreDesc: { color: BRAND.muted, lineHeight: 1.55, maxWidth: 760, margin: "12px 0 0" },
  sessionBox: { background: "#fff", border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 14, display: "grid", gap: 8 },
  sessionTitle: { fontSize: 13, fontWeight: 950, textTransform: "uppercase", color: BRAND.muted, letterSpacing: 0.5 },
  infoRow: { display: "flex", justifyContent: "space-between", gap: 10, color: BRAND.muted, fontSize: 13, borderBottom: `1px dashed ${BRAND.line}`, paddingBottom: 6 },
  primaryBtn: { border: "none", borderRadius: 14, padding: "12px 14px", background: BRAND.red, color: "#fff", fontWeight: 900, cursor: "pointer", marginTop: 4 },
  grid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 },
  miniCard: { border: "1px solid", borderRadius: 18, padding: 16 },
  miniLabel: { color: BRAND.muted, fontSize: 12, fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.5 },
  miniValue: { fontSize: 30, fontWeight: 950, marginTop: 8 },
  miniNote: { color: BRAND.muted, fontSize: 13, marginTop: 4 },
  panel: { background: "#fff", border: `1px solid ${BRAND.line}`, borderRadius: 22, padding: 18, marginBottom: 16 },
  panelHead: { display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 12 },
  panelTitle: { margin: 0, fontSize: 20, fontWeight: 950 },
  panelDesc: { margin: "6px 0 0", color: BRAND.muted },
  tableWrap: { overflowX: "auto", border: `1px solid ${BRAND.line}`, borderRadius: 16 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "12px 14px", background: "#f8fafc", color: BRAND.ink, borderBottom: `1px solid ${BRAND.line}`, fontSize: 12 },
  td: { padding: "12px 14px", borderBottom: `1px solid ${BRAND.line}`, verticalAlign: "top" },
  select: { border: `1px solid ${BRAND.line}`, borderRadius: 14, padding: "10px 12px", background: "#fff", fontWeight: 800 },
  menuPreview: { display: "grid", gap: 12 },
  previewGroup: { background: "#f8fafc", border: `1px solid ${BRAND.line}`, borderRadius: 16, padding: 14 },
  previewTitle: { fontWeight: 950, marginBottom: 10 },
  previewItems: { display: "flex", flexWrap: "wrap", gap: 8 },
  menuPill: { border: "1px solid #fed7aa", background: "#fff7ed", color: BRAND.red, borderRadius: 999, padding: "7px 10px", fontSize: 12, fontWeight: 900 },
  empty: { color: BRAND.muted, padding: 14, background: "#f8fafc", borderRadius: 14 },
  noteBox: { background: "#f8fafc", border: `1px solid ${BRAND.line}`, borderRadius: 18, padding: 16, color: BRAND.muted, lineHeight: 1.55 },
};
