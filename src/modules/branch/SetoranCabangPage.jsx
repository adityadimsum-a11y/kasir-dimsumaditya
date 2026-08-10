import { AlertCircle, ArrowRight, CheckCircle2, Landmark, RefreshCw, Send, Wallet } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { approveSetoranCabang, createSetoranCabang, getSetoranCabangBootstrap, rejectSetoranCabang } from "../../lib/api/actions";
import { formatRupiah } from "../../lib/format/money";
import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import BranchFlowButton from "./BranchFlowButton";

const asArray = (value) => Array.isArray(value) ? value : [];
const num = (value) => { const parsed = Number(String(value ?? 0).replace(/[^0-9.-]/g, "")); return Number.isFinite(parsed) ? parsed : 0; };
const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`; };
const authRequired = (result) => String(result?.error?.code || result?.message || "").toUpperCase().includes("AUTH_REQUIRED");
const tone = (status) => { const value=String(status||"").toUpperCase(); if(value==="APPROVED") return "success"; if(value==="REJECTED") return "danger"; return "warning"; };
const depositStatus = (status) => { const value=String(status||"").toUpperCase(); if(value==="APPROVED") return "Diterima Pusat"; if(value==="REJECTED") return "Perlu Revisi"; if(value==="PENDING_OWNER") return "Menunggu Tangerang"; return status || "-"; };
const wallet = (row={}) => ({ ...row, id: row.wallet_id || row.id || "", name: row.wallet_name || row.name || "Dompet", balance: num(row.current_balance ?? row.balance), location_code: row.location_code || "", wallet_type: row.wallet_type || "" });
const report = (row={}) => ({ ...row, report_id: row.report_id || row.id || "", expected_deposit: num(row.expected_deposit), approved_deposit_amount: num(row.approved_deposit_amount), pending_deposit_amount: num(row.pending_deposit_amount), period_label: row.date_start===row.date_end ? row.date_start : `${row.date_start} s/d ${row.date_end}` });
const deposit = (row={}) => ({ ...row, deposit_id: row.deposit_id || row.id || "", deposit_amount: num(row.deposit_amount), expected_amount: num(row.expected_amount), difference_amount: num(row.difference_amount), period_label: row.period_label || (row.date_start===row.date_end ? row.date_start : `${row.date_start} s/d ${row.date_end}`), items: asArray(row.items) });
function normalize(payload){
  const data=payload?.data||payload||{};
  return {
    health:data.health||{},
    locations:asArray(data.locations),
    reports:asArray(data.eligible_reports||data.reports).map(report),
    deposits:asArray(data.deposits).map(deposit),
    sourceWallets:asArray(data.source_wallets).map(wallet),
    destinationWallets:asArray(data.destination_wallets||data.wallets).map(wallet),
    summary:{
      ...(data.summary||{}),
      total_income:num(data.summary?.total_income), total_expense:num(data.summary?.total_expense), estimated_deposit:num(data.summary?.estimated_deposit),
      pending_amount:num(data.summary?.pending_amount), approved_amount:num(data.summary?.approved_amount), rejected_amount:num(data.summary?.rejected_amount),
      pending_count:num(data.summary?.pending_count), approved_count:num(data.summary?.approved_count), deposit_count:num(data.summary?.deposit_count),
    },
    policy:data.policy||{},
  };
}

const DEPOSIT_COLUMNS=[
  {key:"deposit_date",label:"Tanggal"},
  {key:"deposit_id",label:"Setoran ID",render:(row)=><strong>{row.deposit_id}</strong>},
  {key:"location_code",label:"Cabang"},
  {key:"period_label",label:"Periode"},
  {key:"deposit_amount",label:"Nominal",render:(row)=>formatRupiah(row.deposit_amount)},
  {key:"destination_wallet_name",label:"Tujuan"},
  {key:"status",label:"Status",render:(row)=><Badge tone={tone(row.status)}>{depositStatus(row.status)}</Badge>},
];
const ITEM_COLUMNS=[
  {key:"date",label:"Tanggal"},{key:"module",label:"Sumber"},{key:"id",label:"ID",render:(row)=><strong>{row.id}</strong>},{key:"description",label:"Keterangan"},{key:"amount",label:"Nominal",render:(row)=>formatRupiah(row.amount)},{key:"status",label:"Status"},
];

export default function SetoranCabangPage({ session, onSessionExpired, onNavigate }){
  const date=today();
  const token=session?.sessionToken||"";
  const role=String(session?.user?.role_id||"").toUpperCase();
  const canApprove=role==="ROLE-OWNER"||role==="ROLE-HO-ADMIN";
  const defaultLocation=canApprove?"":(session?.user?.location_code||"");
  const [filter,setFilter]=useState({report_mode:"daily",report_date:date,date_start:date,date_end:date,location_code:defaultLocation});
  const [data,setData]=useState(()=>normalize({}));
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [error,setError]=useState("");
  const [success,setSuccess]=useState("");
  const [createOpen,setCreateOpen]=useState(false);
  const [selected,setSelected]=useState(null);
  const [reviewNote,setReviewNote]=useState("");
  const [draft,setDraft]=useState({report_id:"",source_wallet_id:"",destination_wallet_id:"",deposit_amount:"0",deposit_date:date,payment_method:"TRANSFER",proof_reference:"",notes:""});
  const request=useMemo(()=>({...filter,report_date:filter.report_mode==="period"?filter.date_start:filter.report_date,date_start:filter.report_mode==="period"?filter.date_start:filter.report_date,date_end:filter.report_mode==="period"?filter.date_end:filter.report_date}),[filter]);
  const selectedReport=data.reports.find((item)=>item.report_id===draft.report_id)||null;
  const source=data.sourceWallets.find((item)=>item.id===draft.source_wallet_id)||null;
  const destination=data.destinationWallets.find((item)=>item.id===draft.destination_wallet_id)||null;
  const reportRemaining=(item)=>Math.max(num(item?.expected_deposit)-num(item?.approved_deposit_amount)-num(item?.pending_deposit_amount),0);
  const totalReady=data.reports.reduce((sum,item)=>sum+reportRemaining(item),0);

  const readiness=[
    {label:"Laporan disetujui",ready:data.reports.length>0,detail:data.reports.length?`${data.reports.length} laporan siap`:"Setujui Laporan Harian terlebih dahulu"},
    {label:"Dompet cabang",ready:data.sourceWallets.length>0,detail:data.sourceWallets.length?`${data.sourceWallets.length} dompet aktif`:"Belum ada dompet aktif pada cabang"},
    {label:"Dompet Tangerang",ready:data.destinationWallets.length>0,detail:data.destinationWallets.length?`${data.destinationWallets.length} dompet tujuan`:"Dompet pusat belum tersedia"},
    {label:"Sisa setoran",ready:totalReady>0,detail:totalReady>0?formatRupiah(totalReady):"Tidak ada setoran yang perlu dikirim"},
  ];
  const canCreate=data.health?.ready&&readiness.every((item)=>item.ready);

  const applyDefaults=(next)=>{
    const firstReport=next.reports.find((item)=>reportRemaining(item)>0)||next.reports[0]||null;
    setDraft((value)=>({
      ...value,
      report_id: next.reports.some((item)=>item.report_id===value.report_id) ? value.report_id : (firstReport?.report_id||""),
      source_wallet_id: next.sourceWallets.some((item)=>item.id===value.source_wallet_id) ? value.source_wallet_id : (next.sourceWallets[0]?.id||""),
      destination_wallet_id: next.destinationWallets.some((item)=>item.id===value.destination_wallet_id) ? value.destination_wallet_id : (next.destinationWallets[0]?.id||""),
      deposit_amount: value.deposit_amount!=="0" ? value.deposit_amount : String(firstReport?reportRemaining(firstReport):0),
    }));
  };

  const load=async()=>{
    setLoading(true);setError("");
    try{
      const result=await getSetoranCabangBootstrap(token,request);
      if(authRequired(result))return onSessionExpired?.();
      if(!result?.success)return setError(result?.message||"Gagal membaca setoran cabang.");
      const next=normalize(result.data||result);
      setData(next);applyDefaults(next);
      if(!filter.location_code&&next.locations[0]?.location_code){setFilter((value)=>({...value,location_code:next.locations[0].location_code}));}
    }catch(err){setError(err?.message||"Gagal membaca setoran cabang.");}
    finally{setLoading(false);}
  };
  useEffect(()=>{load();/* eslint-disable-next-line react-hooks/exhaustive-deps */},[]);

  const openCreate=()=>{
    if(!canCreate)return;
    const firstReport=data.reports.find((item)=>reportRemaining(item)>0)||null;
    setDraft((value)=>({...value,report_id:firstReport?.report_id||value.report_id,deposit_amount:String(firstReport?reportRemaining(firstReport):num(value.deposit_amount))}));
    setCreateOpen(true);
  };

  const create=async()=>{
    setSaving(true);setError("");setSuccess("");
    try{
      if(!draft.report_id)return setError("Pilih laporan yang sudah disetujui Tangerang.");
      if(num(draft.deposit_amount)<=0)return setError("Nominal setoran wajib lebih dari 0.");
      if(!draft.source_wallet_id||!draft.destination_wallet_id)return setError("Dompet asal dan tujuan wajib dipilih.");
      const result=await createSetoranCabang(token,{...request,...draft,deposit_amount:num(draft.deposit_amount),expected_amount:selectedReport?.expected_deposit||0});
      if(authRequired(result))return onSessionExpired?.();
      if(!result?.success)return setError(result?.message||"Setoran gagal diajukan.");
      setSuccess(result?.message||"Setoran berhasil diajukan ke Tangerang.");
      setCreateOpen(false);setDraft((value)=>({...value,deposit_amount:"0",proof_reference:"",notes:""}));
      await load();
    }catch(err){setError(err?.message||"Setoran gagal diajukan.");}
    finally{setSaving(false);}
  };

  const process=async(action)=>{
    if(!selected)return;
    if(action==="reject"&&reviewNote.trim()===""){setError("Tuliskan alasan revisi setoran.");return;}
    setSaving(true);setError("");setSuccess("");
    try{
      const fn=action==="approve"?approveSetoranCabang:rejectSetoranCabang;
      const result=await fn(token,{deposit_id:selected.deposit_id,notes:reviewNote.trim()||(action==="approve"?"Setoran diterima dan divalidasi Tangerang.":""),reason:action==="reject"?reviewNote.trim():""});
      if(authRequired(result))return onSessionExpired?.();
      if(!result?.success)return setError(result?.message||"Setoran gagal diproses.");
      setSuccess(result?.message||"Setoran berhasil diproses.");setSelected(null);setReviewNote("");await load();
    }catch(err){setError(err?.message||"Setoran gagal diproses.");}
    finally{setSaving(false);}
  };

  return <div className="da-page-stack da-branch-page">
    <PageHeader
      title="Setoran Cabang"
      description="Kirim dana cabang berdasarkan laporan yang sudah disetujui. Validasi Tangerang memindahkan saldo cabang ke pusat tanpa membuat omzet baru."
      eyebrow="Cabang · Settlement"
      actions={<>
        <BranchFlowButton current="deposit" onNavigate={onNavigate}/>
        <Button variant="ghost" onClick={load} disabled={loading}><RefreshCw size={16}/>{loading?"Memuat...":"Perbarui"}</Button>
        <Button variant="primary" onClick={openCreate} disabled={!canCreate}><Send size={16}/> Ajukan Setoran</Button>
      </>}
    />

    <div className="da-branch-filterbar">
      <label><span>Mode</span><select value={filter.report_mode} onChange={(e)=>setFilter((value)=>({...value,report_mode:e.target.value}))}><option value="daily">Harian</option><option value="period">Periode</option></select></label>
      {filter.report_mode==="period"?<><label><span>Mulai</span><input type="date" value={filter.date_start} onChange={(e)=>setFilter((value)=>({...value,date_start:e.target.value}))}/></label><label><span>Sampai</span><input type="date" value={filter.date_end} onChange={(e)=>setFilter((value)=>({...value,date_end:e.target.value}))}/></label></>:<label><span>Tanggal</span><input type="date" value={filter.report_date} onChange={(e)=>setFilter((value)=>({...value,report_date:e.target.value}))}/></label>}
      <label className="da-branch-filter-location"><span>Cabang</span><select value={filter.location_code} onChange={(e)=>setFilter((value)=>({...value,location_code:e.target.value}))}>{data.locations.length===0?<option value="">Belum ada cabang aktif</option>:data.locations.map((location)=><option key={location.location_id} value={location.location_code}>{location.location_name} · {location.location_code}</option>)}</select></label>
      <Button variant="ghost" onClick={load} disabled={loading}>Terapkan</Button>
    </div>

    {error?<div className="da-form-warning">{error}</div>:null}{success?<div className="da-form-success">{success}</div>:null}

    <section className="da-branch-command da-branch-command-deposit">
      <div className="da-branch-command-main">
        <div className="da-branch-command-kicker"><Wallet size={15}/> Settlement Cabang</div>
        <span>Sisa laporan yang siap disetor</span>
        <strong>{formatRupiah(totalReady)}</strong>
        <p>Hanya laporan yang sudah disetujui Tangerang dan belum selesai disetor.</p>
      </div>
      <div className="da-branch-command-metrics">
        <div><span>Menunggu Validasi</span><strong>{formatRupiah(data.summary.pending_amount)}</strong></div>
        <div><span>Diterima Pusat</span><strong>{formatRupiah(data.summary.approved_amount)}</strong></div>
        <div><span>Laporan Siap</span><strong>{data.reports.length}</strong></div>
        <div><span>Setoran Tercatat</span><strong>{data.summary.deposit_count||data.deposits.length}</strong></div>
      </div>
    </section>

    <div className="da-branch-workspace">
      <Card>
        <div className="da-card-header-row"><div><div className="da-section-kicker">Antrean Settlement</div><h2>Setoran yang Tercatat</h2><p className="da-muted">Klik baris untuk melihat sumber laporan, dompet, dan hasil validasi.</p></div><Badge tone="default">{data.deposits.length} setoran</Badge></div>
        <DataTable columns={DEPOSIT_COLUMNS} rows={data.deposits} getRowKey={(row)=>row.deposit_id} onRowClick={(row)=>{setSelected(row);setReviewNote("");}}/>
      </Card>

      <Card className="da-branch-readiness-card">
        <div className="da-section-kicker">Kesiapan Setoran</div>
        <h2>{canCreate?"Siap diajukan":"Lengkapi sebelum setoran"}</h2>
        <p className="da-muted">Sistem memeriksa laporan, dompet sumber, dompet tujuan, dan sisa nominal.</p>
        <div className="da-branch-readiness-list">
          {readiness.map((item)=><div key={item.label} className={item.ready?"is-ready":"is-waiting"}>{item.ready?<CheckCircle2 size={18}/>:<AlertCircle size={18}/>}<div><strong>{item.label}</strong><span>{item.detail}</span></div></div>)}
        </div>
        {!data.reports.length&&onNavigate?<Button variant="ghost" onClick={()=>onNavigate("laporan-harian")}>Buka Laporan Harian <ArrowRight size={15}/></Button>:null}
      </Card>
    </div>

    <Modal open={createOpen} title="Ajukan Setoran Cabang" subtitle="Saldo belum berubah sampai Tangerang mengesahkan" onClose={()=>setCreateOpen(false)} size="xl">
      <div className="da-branch-detail-summary">
        <div><span>Laporan Siap</span><strong>{data.reports.length}</strong></div>
        <div><span>Sisa Setoran</span><strong>{formatRupiah(totalReady)}</strong></div>
        <div><span>Dompet Cabang</span><strong>{data.sourceWallets.length}</strong></div>
        <div><span>Dompet Pusat</span><strong>{data.destinationWallets.length}</strong></div>
      </div>
      <div className="da-detail-grid">
        <label className="da-detail-box"><strong>Laporan Disetujui</strong><select value={draft.report_id} onChange={(e)=>{const item=data.reports.find((row)=>row.report_id===e.target.value);setDraft((value)=>({...value,report_id:e.target.value,deposit_amount:String(reportRemaining(item))}));}}><option value="">Pilih laporan</option>{data.reports.map((item)=><option key={item.report_id} value={item.report_id}>{item.report_id} · {item.period_label} · sisa {formatRupiah(reportRemaining(item))}</option>)}</select></label>
        <label className="da-detail-box"><strong>Dompet Asal Cabang</strong><select value={draft.source_wallet_id} onChange={(e)=>setDraft((value)=>({...value,source_wallet_id:e.target.value}))}><option value="">Pilih dompet asal</option>{data.sourceWallets.map((item)=><option key={item.id} value={item.id}>{item.name} · saldo {formatRupiah(item.balance)}</option>)}</select></label>
        <label className="da-detail-box"><strong>Dompet Tujuan Tangerang</strong><select value={draft.destination_wallet_id} onChange={(e)=>setDraft((value)=>({...value,destination_wallet_id:e.target.value}))}><option value="">Pilih dompet pusat</option>{data.destinationWallets.map((item)=><option key={item.id} value={item.id}>{item.name} · {item.location_code}</option>)}</select></label>
        <label className="da-detail-box"><strong>Nominal Setoran</strong><input type="number" min="0" value={draft.deposit_amount} onChange={(e)=>setDraft((value)=>({...value,deposit_amount:e.target.value}))}/><p>Sisa laporan: {formatRupiah(reportRemaining(selectedReport))}</p></label>
        <label className="da-detail-box"><strong>Tanggal Setoran</strong><input type="date" value={draft.deposit_date} onChange={(e)=>setDraft((value)=>({...value,deposit_date:e.target.value}))}/></label>
        <label className="da-detail-box"><strong>Referensi Bukti</strong><input value={draft.proof_reference} onChange={(e)=>setDraft((value)=>({...value,proof_reference:e.target.value}))} placeholder="Nomor transfer / nama bukti"/></label>
      </div>
      <label className="da-modal-note"><span>Catatan / Selisih</span><textarea rows="3" value={draft.notes} onChange={(e)=>setDraft((value)=>({...value,notes:e.target.value}))} placeholder="Wajib diisi jika nominal berbeda dari sisa laporan."/></label>
      <div className="da-branch-transfer-preview"><div><Wallet size={18}/><span>{source?.name||"Dompet cabang"}</span><strong>OUT {formatRupiah(num(draft.deposit_amount))}</strong></div><ArrowRight size={18}/><div><Landmark size={18}/><span>{destination?.name||"Dompet Tangerang"}</span><strong>IN {formatRupiah(num(draft.deposit_amount))}</strong></div></div>
      <div className="da-form-actions"><Button variant="ghost" onClick={()=>setCreateOpen(false)} disabled={saving}>Batal</Button><Button variant="primary" onClick={create} disabled={saving}>{saving?"Mengirim...":"Ajukan ke Tangerang"}</Button></div>
    </Modal>

    <Modal open={Boolean(selected)} title="Detail Setoran Cabang" subtitle={selected?.deposit_id||""} onClose={()=>{setSelected(null);setReviewNote("");}} size="xl">
      <div className="da-branch-detail-summary"><div><span>Nominal</span><strong>{formatRupiah(selected?.deposit_amount||0)}</strong></div><div><span>Dompet Asal</span><strong>{selected?.source_wallet_name||"-"}</strong></div><div><span>Dompet Pusat</span><strong>{selected?.destination_wallet_name||"-"}</strong></div><div><span>Status</span><strong><Badge tone={tone(selected?.status)}>{depositStatus(selected?.status)}</Badge></strong></div></div>
      <div className="da-branch-transfer-preview is-compact"><div><Wallet size={18}/><span>{selected?.source_wallet_name||"Cabang"}</span><strong>{selected?.out_mutation_id||"Menunggu OUT"}</strong></div><ArrowRight size={18}/><div><Landmark size={18}/><span>{selected?.destination_wallet_name||"Tangerang"}</span><strong>{selected?.in_mutation_id||"Menunggu IN"}</strong></div></div>
      <DataTable columns={ITEM_COLUMNS} rows={selected?.items||[]} getRowKey={(row,index)=>`${row.id}-${index}`}/>
      {canApprove&&String(selected?.status).toUpperCase()==="PENDING_OWNER"?<><label className="da-modal-note"><span>Catatan Validasi</span><textarea rows="3" value={reviewNote} onChange={(e)=>setReviewNote(e.target.value)} placeholder="Opsional saat disahkan, wajib jika dikembalikan untuk revisi."/></label><div className="da-form-actions"><Button variant="ghost" onClick={()=>process("reject")} disabled={saving}>Kembalikan untuk Revisi</Button><Button variant="primary" onClick={()=>process("approve")} disabled={saving}>Sahkan Setoran</Button></div></>:null}
    </Modal>
  </div>;
}
