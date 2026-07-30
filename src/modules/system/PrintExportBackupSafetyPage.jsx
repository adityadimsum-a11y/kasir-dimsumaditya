import { useEffect, useMemo, useState } from "react";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import StatCard from "../../components/ui/StatCard";
import {
  createSystemBackupManifest,
  getSystemSafetyBootstrap,
} from "../../lib/api/actions";

function tokenOf(session) { return session?.sessionToken || session?.session_token || ""; }
function authError(result) { const c=String(result?.error?.code||result?.code||"").toUpperCase(); return ["AUTH_REQUIRED","UNAUTHORIZED","SESSION_EXPIRED","AUTH_SESSION_INVALID"].includes(c); }
function n(v){const x=Number(v||0);return Number.isFinite(x)?x:0;}
function operationId(){return `backup-manifest-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
function stamp(){return new Date().toISOString().replace(/[:.]/g,"-");}
function download(name, content, type){const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function csvCell(v){return `"${String(v??"").replace(/"/g,'""')}"`;}

export default function PrintExportBackupSafetyPage({ session, onSessionExpired }) {
  const sessionToken=tokenOf(session);
  const [loading,setLoading]=useState(true);const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");const [notice,setNotice]=useState("");const [data,setData]=useState({});
  const [form,setForm]=useState({file_reference:"",file_size_bytes:"",checksum_sha256:"",notes:"Backup SQL manual dari phpMyAdmin/hPanel."});
  const summary=data.summary||{}; const backups=Array.isArray(data.backups)?data.backups:[];

  async function load(){setLoading(true);setError("");try{const r=await getSystemSafetyBootstrap(sessionToken,{});if(authError(r)){onSessionExpired?.();return;}if(!r?.success)throw new Error(r?.message||"Safety gagal dibaca.");setData(r.data||{});}catch(e){setError(e?.message||"Gagal membaca Print & Backup.");setData({});}finally{setLoading(false);}}
  useEffect(()=>{if(sessionToken)load();},[sessionToken]);
  const exportData=useMemo(()=>data.export_payload||{},[data]);
  function exportJson(){download(`ERP_DIMSUM_ADITYA_SAFETY_${stamp()}.json`,JSON.stringify(exportData,null,2),"application/json;charset=utf-8");}
  function exportCsv(){const rows=[["TABLE","ROW_COUNT","STATUS"],...(data.tables||[]).map(r=>[r.table_name,r.row_count,r.status])];download(`ERP_DIMSUM_ADITYA_TABLE_COUNTS_${stamp()}.csv`,rows.map(r=>r.map(csvCell).join(",")).join("\n"),"text/csv;charset=utf-8");}
  async function saveManifest(){setSaving(true);setError("");setNotice("");try{const r=await createSystemBackupManifest(sessionToken,{...form,file_size_bytes:n(form.file_size_bytes),backup_type:"SQL_EXPORT",operation_id:operationId()});if(authError(r)){onSessionExpired?.();return;}if(!r?.success)throw new Error(r?.message||"Manifest gagal dicatat.");setNotice(r.message||"Manifest berhasil dicatat.");setForm(f=>({...f,file_reference:"",file_size_bytes:"",checksum_sha256:""}));await load();}catch(e){setError(e?.message||"Manifest gagal dicatat.");}finally{setSaving(false);}}

  return <div className="da-page-stack">
    <section className="da-page-header"><div><p className="da-kicker">Pusat Kendali</p><h1>Print & Backup Safety</h1><p className="da-muted">Export ringkasan pemeriksaan dan catat bukti backup SQL nyata. Tidak mengubah transaksi.</p></div><Badge tone={error?"danger":loading?"warning":"success"}>{loading?"Membaca":error?"Perlu Cek":"Backup Safety Ready"}</Badge></section>
    {error?<div className="da-form-error">{error}</div>:null}{notice?<div className="da-form-success">{notice}</div>:null}
    <Card><div className="da-section-header"><div><p className="da-kicker">Safety Export</p><h2>Ringkasan Sistem untuk Disimpan</h2><p className="da-muted">JSON/CSV adalah ringkasan audit. Full backup database tetap dibuat melalui phpMyAdmin atau fitur backup hosting.</p></div><div className="da-actions"><Button variant="secondary" onClick={load} disabled={loading}>Refresh</Button><Button variant="secondary" onClick={()=>window.print()}>Print / PDF</Button><Button onClick={exportJson}>Export JSON</Button><Button variant="secondary" onClick={exportCsv}>Export CSV</Button></div></div></Card>
    <section className="da-grid da-grid-3"><StatCard label="Health Score" value={`${n(summary.score)} / 100`} /><StatCard label="Tabel" value={n(summary.table_count).toLocaleString("id-ID")} /><StatCard label="Total Baris" value={n(summary.row_count).toLocaleString("id-ID")} /><StatCard label="Bahaya" value={n(summary.danger_count).toLocaleString("id-ID")} tone={n(summary.danger_count)?"danger":"success"}/><StatCard label="Peringatan" value={n(summary.warning_count).toLocaleString("id-ID")} tone={n(summary.warning_count)?"warning":"success"}/><StatCard label="Backup Tercatat" value={backups.length.toLocaleString("id-ID")}/></section>
    <Card><div className="da-section-header"><div><p className="da-kicker">Owner Only</p><h2>Catat Backup SQL yang Sudah Dibuat</h2><p className="da-muted">Buat export SQL dari phpMyAdmin/hPanel terlebih dahulu. Setelah file tersimpan, catat nama, ukuran, dan SHA-256 bila tersedia.</p></div><Badge tone="warning">Tidak Membuat Dump Otomatis</Badge></div>
      <div className="da-form-grid"><label className="da-form-field da-form-field-wide"><span>Nama / Referensi File SQL</span><input value={form.file_reference} onChange={e=>setForm({...form,file_reference:e.target.value})} placeholder="u1272653_erp_2026-07-30.sql.gz" /></label><label className="da-form-field"><span>Ukuran File (byte)</span><input type="number" min="0" value={form.file_size_bytes} onChange={e=>setForm({...form,file_size_bytes:e.target.value})}/></label><label className="da-form-field da-form-field-wide"><span>SHA-256 (opsional)</span><input value={form.checksum_sha256} onChange={e=>setForm({...form,checksum_sha256:e.target.value})} placeholder="64 karakter"/></label><label className="da-form-field da-form-field-wide"><span>Catatan</span><input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label></div><div className="da-form-actions"><Button onClick={saveManifest} disabled={saving||!form.file_reference.trim()}>{saving?"Mencatat...":"Catat Manifest Backup"}</Button></div>
    </Card>
    <Card><div className="da-section-header"><div><p className="da-kicker">Riwayat</p><h2>Manifest Backup Terakhir</h2></div><Badge tone="success">PHP/MySQL</Badge></div><div className="da-table-wrap"><table className="da-table"><thead><tr><th>Waktu</th><th>Backup ID</th><th>File</th><th>Ukuran</th><th>Status</th></tr></thead><tbody>{backups.length?backups.map(r=><tr key={r.backup_id}><td>{r.backup_at}</td><td>{r.backup_id}</td><td>{r.file_reference}</td><td>{n(r.file_size_bytes).toLocaleString("id-ID")} byte</td><td><Badge tone="success">{r.status}</Badge></td></tr>):<tr><td colSpan="5">Belum ada manifest backup SQL yang dicatat.</td></tr>}</tbody></table></div></Card>
  </div>;
}
