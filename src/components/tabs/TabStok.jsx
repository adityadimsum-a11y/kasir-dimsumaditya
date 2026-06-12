import React, { useState, useMemo, useEffect } from 'react';
import { Factory, Calendar, Edit2, CheckCircle2, AlertTriangle, Printer, Trash2, Scale, Package, Filter, Activity, Undo, Layers, Utensils } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

const parseDateToYMD = (dbDate) => {
  if (!dbDate) return null;
  const EN_MONTHS = {
    'januari': 'january', 'februari': 'february', 'maret': 'march', 'mei': 'may',
    'juni': 'june', 'juli': 'july', 'agustus': 'august', 'oktober': 'october', 'desember': 'december'
  };
  let safeDateStr = String(dbDate).toLowerCase();
  for (const [id, en] of Object.entries(EN_MONTHS)) {
    safeDateStr = safeDateStr.replace(id, en);
  }
  try {
    const d = new Date(safeDateStr);
    if(!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
  } catch(e){}
  
  if (typeof dbDate === 'string' && dbDate.match(/^\d{4}-\d{2}-\d{2}/)) return dbDate.substring(0, 10);
  return null; 
};

export default function TabStok({ 
  productionBatches = [], masterRules = [], 
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  const todayYMD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  // --- STATE FILTER ---
  const [filterMode, setFilterMode] = useState('HARI_INI');
  const [dateRange, setDateRange] = useState({ start: todayYMD, end: todayYMD });

  // --- STATE INPUT JUMLAH ADUKAN (PATOKAN UTAMA) ---
  const [inputAdukan, setInputAdukan] = useState('1'); 

  // --- STATE FORM INPUT ---
  const [form, setForm] = useState({
    id: '', date: todayStr, pic_name: '', total_yield_pcs: '', notes: ''
  });
  const [isEditing, setIsEditing] = useState(false);

  // --- STANDARD ATURAN MASTER ---
  const [rules, setRules] = useState({
    timbangan_mentah: 10, resep_adukan: 30, target_yield: 1000, porsi_eceran: 4, mika_frozen: 50
  });

  useEffect(() => {
    if (masterRules && masterRules.length > 0) {
      setRules({
        timbangan_mentah: Number(masterRules[0].timbangan_mentah || 10),
        resep_adukan: Number(masterRules[0].resep_adukan || 30),
        target_yield: Number(masterRules[0].target_yield || 1000),
        porsi_eceran: Number(masterRules[0].porsi_eceran || 4),
        mika_frozen: Number(masterRules[0].mika_frozen || 50)
      });
    }
  }, [masterRules]);

  // --- PERHITUNGAN LIVE MONITOR BANNER ---
  const jumlahAdukan = Number(inputAdukan || 0);
  const monitorAyamKg = jumlahAdukan * rules.resep_adukan;
  const monitorTargetPcs = jumlahAdukan * rules.target_yield;
  const monitorSetaraMika = monitorTargetPcs / rules.mika_frozen;
  const monitorSetaraPorsi = monitorTargetPcs / rules.porsi_eceran;

  // Real-time validasi hasil input fisik lapangan
  const selisih = Number(form.total_yield_pcs || 0) - monitorTargetPcs;
  const realMika = Number(form.total_yield_pcs || 0) / rules.mika_frozen;
  const realPorsi = Number(form.total_yield_pcs || 0) / rules.porsi_eceran;

  // --- ENGINE SINKRON DATA TABLE ---
  const realBatches = useMemo(() => Array.isArray(productionBatches) ? productionBatches : [], [productionBatches]);
  
  const filteredBatches = useMemo(() => {
    return realBatches.filter(b => {
      if (b.isDeleted) return false;
      if (b.branch_id !== currentBranch && currentBranch !== 'TANGERANG_PUSAT') return false;
      if (filterMode === 'SEMUA') return true;
      
      const bYMD = parseDateToYMD(b.date);
      if (!bYMD) return false; 

      if (filterMode === 'HARI_INI') return bYMD === todayYMD;
      if (filterMode === 'RENTANG') return bYMD >= dateRange.start && bYMD <= dateRange.end;
      
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realBatches, filterMode, dateRange, todayYMD, currentBranch]);

  const summary = useMemo(() => {
    let totalAyam = 0; let totalDimsum = 0;
    filteredBatches.forEach(b => {
      totalAyam += Number(b.total_ayam_kg || 0);
      totalDimsum += Number(b.total_yield_pcs || 0);
    });
    return { totalAyam, totalDimsum, count: filteredBatches.length };
  }, [filteredBatches]);

  // --- ACTIONS ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalStatus = Number(form.total_yield_pcs) >= monitorTargetPcs ? 'VALID' : 'DEFICIT';

    const payload = {
      id: isEditing ? form.id : generateId('PRD', form.date),
      date: form.date,
      pic_name: form.pic_name.toUpperCase(),
      total_ayam_kg: monitorAyamKg, // Di-lock dari monitor adukan
      total_yield_pcs: Number(form.total_yield_pcs),
      notes: form.notes.toUpperCase(),
      branch_id: currentBranch,
      status: finalStatus
    };

    if (await sendToSheet(isEditing ? 'update' : 'insert', payload, 'production_batches')) {
      showToast('Laporan produksi berhasil dikunci masuk freezer!', 'success');
      handlePrint(payload);
      setForm({ id: '', date: todayStr, pic_name: '', total_yield_pcs: '', notes: '' });
      setInputAdukan('1');
      setIsEditing(false);
    }
  };

  const handleEdit = (b) => {
    setForm({
      id: b.id, date: b.date ? String(b.date).substring(0, 10) : todayStr,
      pic_name: b.pic_name || '', total_yield_pcs: String(b.total_yield_pcs || ''), notes: b.notes || ''
    });
    setInputAdukan(String(Number(b.total_ayam_kg || 0) / rules.resep_adukan));
    setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrint = (log) => {
    triggerPrint('NOTA_DOTMATRIX', {
      title: 'BUKTI PRODUKSI MASUK FREEZER',
      id: log.id, date: formatDate(log.date), branch_name: log.branch_id || currentBranch,
      admin_name: log.pic_name, customer_name: 'GUDANG FREEZER UTAMA',
      items: [
        { name: 'TOTAL BAHAN AYAM', qty: log.total_ayam_kg, subtotal: 0, suffix: ' Kg' },
        { name: 'TOTAL DIMSUM JADI', qty: log.total_yield_pcs, subtotal: 0, suffix: ' Pcs' }
      ],
      paymentMethod: 'CATATAN: ' + (log.notes || 'PRODUKSI AMAN')
    });
  };

  return (
    <div className="space-y-6 pb-10 relative animate-in fade-in duration-300">
      
      {/* ========================================= */}
      {/* 🔥 BANNER PAPAN MONITOR PRODUKSI DIGITAL RAKSASA */}
      {/* ========================================= */}
      <div className="bg-slate-900 rounded-3xl border border-slate-800 p-6 text-white shadow-xl">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-4 mb-6">
           <div>
              <h2 className="text-xl font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                <Activity size={22}/> Papan Monitor Kendali Produksi (Live)
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Ketik jumlah rencana adukan untuk melihat proyeksi nilai konversi</p>
           </div>
           
           {/* KOTAK SETTING ADUKAN UTAMA */}
           <div className="bg-slate-950 p-2 rounded-2xl border border-slate-700 flex items-center gap-3">
              <span className="text-xs font-black text-amber-400 uppercase pl-2">SET ADUKAN:</span>
              <input type="number" min="1" max="100" value={inputAdukan} onChange={e => setInputAdukan(e.target.value)} className="w-16 bg-slate-800 border border-slate-600 text-white text-xl font-black text-center rounded-xl py-1 outline-none focus:border-amber-400" />
           </div>
         </div>

         {/* GRID BANNER MONITOR */}
         <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Adukan Aktif</div>
              <div className="text-2xl font-black text-amber-400 mt-1">{formatNumber(jumlahAdukan)} <span className="text-xs text-slate-500">KALI</span></div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Wajib Sedia Ayam Mentah</div>
              <div className="text-2xl font-black text-rose-400 mt-1">{formatNumber(monitorAyamKg)} <span className="text-xs text-slate-500">KG</span></div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Target Hasil Dimsum Jadi</div>
              <div className="text-2xl font-black text-emerald-400 mt-1">{formatNumber(monitorTargetPcs)} <span className="text-xs text-slate-500">PCS</span></div>
            </div>
            <div className="bg-slate-950/60 border border-slate-800 p-4 rounded-2xl">
              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Proyeksi Hasil Kemasan</div>
              <div className="text-xs font-black text-blue-400 mt-1.5 flex flex-col gap-0.5 uppercase">
                 <span>📦 {formatNumber(monitorSetaraMika)} Mika Frozen</span>
                 <span>🍽️ {formatNumber(monitorSetaraPorsi)} Porsi Resto</span>
              </div>
            </div>
         </div>
      </div>

      {/* FORM & RIWAYAT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* FORMULIR INPUT */}
        <div className="lg:col-span-4 bg-white rounded-2xl border shadow-sm p-6 border-t-4 border-t-blue-600 h-max">
          <div className="flex items-center justify-between border-b pb-4 mb-5">
            <h3 className="font-black text-sm uppercase text-slate-800 tracking-widest flex items-center gap-2">
              <Factory size={18} className="text-blue-600"/> Isi Hasil Kerja Lapangan
            </h3>
            {isEditing && <button type="button" onClick={() => { setIsEditing(false); setForm({ id: '', date: todayStr, pic_name: '', total_yield_pcs: '', notes: '' }); setInputAdukan('1'); }} className="text-[10px] border border-amber-200 px-2 py-1 rounded-lg font-black uppercase text-amber-700 bg-white hover:bg-amber-50"><Undo size={12}/></button>}
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Tanggal Kerja</label>
                <input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 bg-slate-50 border rounded-xl font-bold text-xs uppercase outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Kepala Dapur (PIC)</label>
                <input type="text" required value={form.pic_name} onChange={e=>setForm({...form, pic_name: e.target.value})} placeholder="Nama..." className="w-full p-2.5 bg-slate-50 border rounded-xl font-black text-xs uppercase outline-none focus:border-blue-400" />
              </div>
            </div>

            {/* BOX 1: AYAM LOCK */}
            <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 relative overflow-hidden opacity-80">
              <Scale size={60} className="absolute -right-4 -bottom-4 text-slate-300 opacity-40"/>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">1. Bahan Ayam Terkunci (Sesuai Monitor)</label>
              <div className="text-2xl font-black text-slate-700 mt-1">{formatNumber(monitorAyamKg)} <span className="text-xs text-slate-400">KG ASLI</span></div>
            </div>

            {/* BOX 2: INPUT PCS REAL JADI */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 relative overflow-hidden focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-100 transition-all">
              <label className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block mb-2">2. Ketik Hasil Jadi Fisik Dimsum (PCS)</label>
              <div className="flex items-center gap-2">
                <input type="number" required min="0" value={form.total_yield_pcs} onChange={e=>setForm({...form, total_yield_pcs: e.target.value})} className="w-full p-3 bg-white border-2 border-emerald-300 rounded-lg text-2xl font-black text-emerald-700 text-center outline-none focus:border-emerald-500" placeholder="0" />
                <span className="font-black text-slate-500 text-lg">Pcs</span>
              </div>
              
              {Number(form.total_yield_pcs) > 0 && (
                <div className="mt-3 bg-emerald-100/50 p-2 rounded border border-emerald-200 flex justify-between text-[10px] font-black text-emerald-800 uppercase">
                  <span>Mika Jadi: {formatNumber(realMika.toFixed(0))} Mika</span>
                  <span>Porsi Jadi: {formatNumber(realPorsi.toFixed(0))} Porsi</span>
                </div>
              )}
            </div>

            {/* DETEKSI SUSUT LIVE */}
            {jumlahAdukan > 0 && Number(form.total_yield_pcs) > 0 && (
              <div className={`p-3 rounded-xl border flex items-start gap-2 ${selisih < 0 ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                {selisih < 0 ? <AlertTriangle size={18} className="shrink-0 mt-0.5"/> : <CheckCircle2 size={18} className="shrink-0 mt-0.5"/>}
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest">{selisih < 0 ? 'Hati-hati: Hasil Susut!' : 'Sukses: Sesuai Target!'}</div>
                  <div className="text-xs font-bold mt-1">{selisih < 0 ? `Kurang ${formatNumber(Math.abs(selisih))} Pcs dari target monitor (${formatNumber(monitorTargetPcs)} Pcs).` : `Produksi aman & subur.`}</div>
                </div>
              </div>
            )}

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Catatan Tambahan / Alasan Susut</label>
              <textarea rows="2" value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Ketik info penting adonan jika ada..." className={`w-full p-3 bg-slate-50 border rounded-xl font-bold text-xs uppercase outline-none ${selisih < 0 ? 'border-rose-300 focus:border-rose-500' : 'focus:border-blue-400'}`}></textarea>
            </div>

            <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-xl transition-transform active:scale-95 flex items-center justify-center gap-2 ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              {isEditing ? 'Simpan Revisi' : 'Kunci Masuk Freezer &amp; Cetak'}
            </button>
          </form>
        </div>

        {/* RIWAYAT PENJUALAN / PRODUKSI TABEL */}
        <div className="lg:col-span-8 bg-white rounded-3xl border flex flex-col overflow-hidden shadow-sm h-max">
          <div className="p-5 bg-slate-50 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-4">
             <div>
               <h4 className="font-black text-sm uppercase text-slate-800 tracking-widest flex items-center gap-2"><Activity size={18} className="text-blue-600"/> Log Jurnal Buku Produksi Dapur</h4>
               <p className="text-[10px] font-bold text-slate-500 uppercase mt-1">Gunakan alat filter di samping untuk merekap total barang.</p>
             </div>
             
             <div className="flex flex-wrap items-center gap-2 bg-white p-1.5 border border-slate-200 rounded-2xl shadow-sm">
               <div className="flex items-center gap-2 pl-2 pr-1">
                  <Filter size={14} className="text-blue-500"/>
                  <select value={filterMode} onChange={e => setFilterMode(e.target.value)} className="text-xs font-black text-slate-700 bg-transparent py-2 outline-none cursor-pointer uppercase">
                    <option value="HARI_INI">HARI INI (REALTIME)</option>
                    <option value="RENTANG">RENTANG WAKTU (DARI - SAMPAI)</option>
                    <option value="SEMUA">BUKA SEMUA CATATAN</option>
                  </select>
               </div>

               {filterMode === 'RENTANG' && (
                 <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl">
                    <span className="text-[9px] font-black text-slate-400 uppercase">DARI</span>
                    <input type="date" value={dateRange.start} onChange={e => setDateRange({...dateRange, start: e.target.value})} className="text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer" />
                    <span className="text-[9px] font-black text-slate-400 uppercase border-l border-slate-300 pl-2">SAMPAI</span>
                    <input type="date" value={dateRange.end} onChange={e => setDateRange({...dateRange, end: e.target.value})} className="text-xs font-black text-slate-800 outline-none bg-transparent cursor-pointer" />
                 </div>
               )}
             </div>
          </div>

          {summary.count > 0 && (
            <div className="bg-blue-50 border-b border-blue-100 px-6 py-4 flex flex-wrap justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                 <div className="bg-blue-500 text-white p-2 rounded-lg shadow-sm"><Package size={20}/></div>
                 <div>
                   <div className="text-xs font-black text-blue-800 uppercase tracking-widest">Total {summary.count} Catatan Laporan Terkumpul</div>
                 </div>
              </div>
              <div className="flex flex-wrap gap-6 bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                 <div className="border-r border-slate-100 pr-6">
                    <div className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Ayam Mentah Diproses</div>
                    <div className="text-lg font-black text-slate-800">{formatNumber(summary.totalAyam)} <span className="text-[10px] text-slate-500">KG</span></div>
                 </div>
                 <div>
                    <div className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Dimsum Jadi Masuk Freezer</div>
                    <div className="text-xl font-black text-emerald-600">{formatNumber(summary.totalDimsum)} <span className="text-[10px] text-emerald-500/70">PCS</span></div>
                 </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto p-4 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-100 text-[10px] uppercase text-slate-500 border-b-2 border-slate-200">
                <tr>
                  <th className="px-5 py-4 font-black rounded-tl-xl">Tgl &amp; ID</th>
                  <th className="px-5 py-4 font-black">Kinerja Produksi Dapur</th>
                  <th className="px-5 py-4 font-black text-center">PIC Kepala Dapur</th>
                  <th className="px-5 py-4 font-black text-center rounded-tr-xl">Aksi / Cetak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {filteredBatches.map(log => {
                  const currentAdukan = Number(log.total_ayam_kg || 0) / rules.resep_adukan;
                  const t_target = currentAdukan * rules.target_yield;
                  const t_selisih = Number(log.total_yield_pcs) - t_target;
                  const t_mika = Number(log.total_yield_pcs) / rules.mika_frozen;

                  return (
                    <tr key={log.id} className="hover:bg-blue-50/50 group transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black">{formatDate(log.date)}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td className="px-5 py-4 min-w-[300px]">
                        <div className="flex items-center gap-4 mb-2">
                           <div className="bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-lg text-center">
                             <div className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-0.5">Volume Skala</div>
                             <div className="text-sm font-black text-amber-600">{currentAdukan.toFixed(0)} Adukan</div>
                           </div>
                           <div className="text-slate-300 font-black">➔</div>
                           <div className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg text-center">
                             <div className="text-[9px] font-black text-emerald-400 uppercase tracking-widest mb-0.5">Hasil Jadi</div>
                             <div className="text-sm font-black text-emerald-600">{formatNumber(log.total_yield_pcs)} Pcs</div>
                           </div>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-[9px] font-black text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded uppercase">SETARA: {formatNumber(t_mika.toFixed(0))} MIKA FROZEN</span>
                          {t_selisih < 0 ? (
                            <span className="text-[9px] font-black text-rose-600 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded uppercase flex items-center gap-1"><AlertTriangle size={10}/> SUSUT {formatNumber(Math.abs(t_selisih))} Pcs</span>
                          ) : (
                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded uppercase flex items-center gap-1"><CheckCircle2 size={10}/> TARGET AMAN</span>
                          )}
                        </div>
                        {log.notes && <div className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded mt-2 border border-slate-200">" {log.notes} "</div>}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-center">
                        <div className="text-xs font-black uppercase text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 w-max mx-auto shadow-sm">{log.pic_name}</div>
                      </td>
                      <td className="px-5 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button type="button" onClick={() => handlePrint(log)} className="p-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-black uppercase flex items-center gap-1.5 text-[10px] shadow-sm"><Printer size={14}/> Bukti</button>
                          <button type="button" onClick={() => handleEdit(log)} className="p-2 bg-amber-50 border border-amber-200 text-amber-600 hover:bg-amber-500 hover:text-white rounded-lg transition-colors"><Edit2 size={16}/></button>
                          <button type="button" onClick={() => { if(window.confirm("Yakin ingin menghapus catatan produksi ini?")) requestDelete(log.id); }} className="p-2 bg-rose-50 border border-rose-200 text-rose-600 hover:bg-rose-600 hover:text-white rounded-lg transition-colors"><Trash2 size={16}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredBatches.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-20 bg-slate-50 border-t border-slate-100">
                      <div className="flex flex-col items-center justify-center text-slate-400">
                        <Package size={40} className="mb-3 opacity-20"/>
                        <span className="font-black uppercase tracking-widest text-xs">Tidak ada aktivitas produksi dapur pada tanggal ini.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
