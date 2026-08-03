import React, { useState, useMemo, useEffect } from 'react';
import { 
  Target, Calendar, Wallet, CheckCircle2, AlertTriangle, 
  Plus, History, BarChart3, ShieldAlert, ArrowRight,
  X, Lightbulb, Activity
} from 'lucide-react';
import { getTodayStr, generateId, formatDate, getLocalYMD } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

// =========================================================================
// 🔒 CONSTANTS & ENUMS
// =========================================================================
const KEWAJIBAN_STATUS = {
  ACTIVE: 'ACTIVE',
  PAID_OFF: 'PAID_OFF'
};

const TRACKING_MODE = {
  TENOR: 'TENOR',
  POKOK: 'POKOK',
  PERMANEN: 'PERMANEN'
};

export default function TabKewajiban({ 
  master_kewajiban = [], 
  trx_pembayaran_kewajiban = [], 
  cashflowTransactions = [], 
  masterConversionRules = [], // 🔥 SSOT DIHUBUNGKAN
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  const currentMonth = todayStr.substring(0, 7);
  const currentDay = new Date(todayStr).getDate();

  const [activeSubTab, setActiveSubTab] = useState('DASHBOARD');
  const [showFormKewajiban, setShowFormKewajiban] = useState(false);
  const [showFormBayar, setShowFormBayar] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  
  const [selectedKewajiban, setSelectedKewajiban] = useState(null);
  const [detailHistory, setDetailHistory] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Form Master Kewajiban
  const [formMaster, setFormMaster] = useState({
    id: '', nama_kewajiban: '', kategori: 'CICILAN', 
    target_bulanan: '', jatuh_tempo: '15',
    mode_tracking: TRACKING_MODE.TENOR, 
    sisa_tenor: '', sisa_pokok: ''
  });

  const [formBayar, setFormBayar] = useState({
    nominal: '', dompet: 'TF_BRI_PUSAT', keterangan: ''
  });

  // 🔥 DETEKSI PERSENTASE PROFIT DARI SSOT
  const profitMargin = useMemo(() => {
    const rule = masterConversionRules?.find(r => r.id === 'RULE-PROFIT' || String(r.rule_name).toLowerCase().includes('profit'));
    return rule ? Number(rule.output_val || 5) : 5;
  }, [masterConversionRules]);

  // 🔥 DINAMISASI NILAI DEFAULT SIMULATOR
  const [simSlider, setSimSlider] = useState({ ayam: 55, ops: 25, komitmen: 15, profit: 5 });
  useEffect(() => {
    setSimSlider(prev => ({ ...prev, profit: profitMargin }));
  }, [profitMargin]);

  // =========================================================================
  // 🧠 ENGINE 1: DATA KEWAJIBAN & PROGRESS
  // =========================================================================
  const { kewajibanAktif, kewajibanLunas, metrikBulanIni } = useMemo(() => {
    let targetBulanIni = 0;
    let dibayarBulanIni = 0;
    let terdekat = null;
    let jarakTerdekat = 999;
    let kapasitasBebas = 0;

    const aktif = [];
    const lunas = [];

    (master_kewajiban || []).forEach(k => {
      if (k.isDeleted) return;

      const trxBulanIni = (trx_pembayaran_kewajiban || []).filter(t => 
        !t.isDeleted && t.id_kewajiban === k.id && getLocalYMD(t.tanggal_bayar).startsWith(currentMonth)
      );
      
      const totalTrxBulanIni = trxBulanIni.reduce((sum, t) => sum + Number(t.nominal_dibayar || 0), 0);
      const targetBulanan = Number(k.target_bulanan || 0);

      const item = { 
        ...k, 
        totalTrxBulanIni, 
        sisaBulanIni: Math.max(0, targetBulanan - totalTrxBulanIni), 
        progress: Math.min(100, (totalTrxBulanIni / targetBulanan) * 100) || 0 
      };

      if (k.status_kewajiban === KEWAJIBAN_STATUS.ACTIVE) {
        aktif.push(item);
        targetBulanIni += targetBulanan;
        dibayarBulanIni += totalTrxBulanIni;

        const tglJatuhTempo = Number(k.jatuh_tempo || 1);
        let jarak = tglJatuhTempo - currentDay;
        if (jarak < 0) jarak += 30;
        
        if (item.sisaBulanIni > 0 && jarak < jarakTerdekat) {
          jarakTerdekat = jarak;
          terdekat = { nama: k.nama_kewajiban, tgl: tglJatuhTempo, sisaHari: jarak };
        }
      } else if (k.status_kewajiban === KEWAJIBAN_STATUS.PAID_OFF) {
        lunas.push(item);
        kapasitasBebas += targetBulanan;
      }
    });

    return {
      kewajibanAktif: aktif.sort((a,b) => Number(a.jatuh_tempo) - Number(b.jatuh_tempo)),
      kewajibanLunas: lunas,
      metrikBulanIni: { targetBulanIni, dibayarBulanIni, sisaKewajiban: Math.max(0, targetBulanIni - dibayarBulanIni), terdekat, kapasitasBebas }
    };
  }, [master_kewajiban, trx_pembayaran_kewajiban, currentMonth, currentDay]);

  // =========================================================================
  // 🧠 ENGINE 2: HEALTH CHECK KAS RIIL
  // =========================================================================
  const kasRiil = useMemo(() => {
    let bca = 0, bri = 0, cash = 0;
    (cashflowTransactions || []).forEach(c => {
      if (c.isDeleted) return;
      const amt = Number(c.amount || 0);
      const isMasuk = c.type === 'IN' || c.transaction_type === 'INFLOW';
      if (c.method === 'TF_BCA_PUSAT') isMasuk ? bca += amt : bca -= amt;
      else if (c.method === 'TF_BRI_PUSAT') isMasuk ? bri += amt : bri -= amt;
      else if (c.method === 'CASH') isMasuk ? cash += amt : cash -= amt;
    });
    return { bca, bri, cash, total: bca + bri + cash };
  }, [cashflowTransactions]);

  // =========================================================================
  // ⚡ ACTIONS: MASTER & TRANSAKSI
  // =========================================================================
  const handleSaveMaster = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    const isEdit = !!formMaster.id;
    
    const finalTenor = formMaster.mode_tracking === TRACKING_MODE.TENOR ? Number(formMaster.sisa_tenor) : null;
    const finalPokok = formMaster.mode_tracking === TRACKING_MODE.POKOK ? Number(formMaster.sisa_pokok.replace(/\D/g, '')) : null;

    const payload = {
      id: isEdit ? formMaster.id : generateId('KWJ', todayStr),
      nama_kewajiban: formMaster.nama_kewajiban.toUpperCase(), 
      kategori: formMaster.kategori,
      target_bulanan: Number(formMaster.target_bulanan.replace(/\D/g, '')), 
      jatuh_tempo: Number(formMaster.jatuh_tempo),
      mode_tracking: formMaster.mode_tracking, 
      sisa_tenor: finalTenor,
      sisa_pokok: finalPokok,
      status_kewajiban: KEWAJIBAN_STATUS.ACTIVE, 
      branch_id: currentBranch, 
      isDeleted: false, 
      date: todayStr
    };

    const isSuccess = await sendToSheet(isEdit ? 'update' : 'insert', payload, 'master_kewajiban');
    if (isSuccess) {
      if (typeof showToast === 'function') showToast('Kewajiban berhasil disahkan!', 'success');
      setShowFormKewajiban(false);
      setFormMaster({ id: '', nama_kewajiban: '', kategori: 'CICILAN', target_bulanan: '', jatuh_tempo: '15', mode_tracking: TRACKING_MODE.TENOR, sisa_tenor: '', sisa_pokok: '' });
    }
    setIsSubmitting(false);
  };

  const handleBayarCicilan = async (e) => {
    e.preventDefault();
    const nominalBayar = Number(formBayar.nominal.replace(/\D/g, ''));
    if (nominalBayar <= 0) return alert("Nominal tidak valid!");

    const dompetVal = formBayar.dompet === 'TF_BRI_PUSAT' ? kasRiil.bri : formBayar.dompet === 'TF_BCA_PUSAT' ? kasRiil.bca : kasRiil.cash;
    if (nominalBayar > dompetVal) {
      if (!window.confirm(`⚠️ KAS FISIK TIDAK CUKUP!\nSaldo ${formBayar.dompet.replace(/_/g, ' ')} Anda hanya ${formatRupiah(dompetVal)}.\nSistem akan mencatat minus jika dipaksa. Lanjutkan?`)) return;
    } else {
      if (!window.confirm(`Eksekusi Pembayaran Kewajiban:\n\nKe: ${selectedKewajiban.nama_kewajiban}\nNominal: ${formatRupiah(nominalBayar)}\nSumber: ${formBayar.dompet.replace(/_/g, ' ')}\n\nLanjutkan pemotongan kas riil?`)) return;
    }

    setIsSubmitting(true);
    const trxId = generateId('PKW', todayStr);
    
    const payloadTrx = {
      id: trxId, 
      id_kewajiban: selectedKewajiban.id, 
      tanggal_bayar: todayStr,
      nominal_dibayar: nominalBayar, 
      dompet_sumber: formBayar.dompet,
      keterangan_opsional: formBayar.keterangan.toUpperCase(), 
      gl_sync_status: 'PENDING',
      branch_id: currentBranch, 
      isDeleted: false
    };

    const payloadCfo = {
      id: generateId('CFO', todayStr), 
      date: todayStr, 
      branch_id: currentBranch, 
      type: 'OUT',
      category: 'PEMBAYARAN_KEWAJIBAN', 
      method: formBayar.dompet, 
      amount: nominalBayar,
      description: `BAYAR KOMITMEN: ${selectedKewajiban.nama_kewajiban} (${formBayar.keterangan})`,
      reference_table: 'trx_pembayaran_kewajiban',
      reference_id: trxId, 
      isDeleted: false
    };

    let payloadUpdateMaster = null;
    let isFullLunas = false;
    
    if (selectedKewajiban.sisaBulanIni - nominalBayar <= 0) {
       if (selectedKewajiban.mode_tracking === TRACKING_MODE.TENOR) {
          const newTenor = Number(selectedKewajiban.sisa_tenor || 0) - 1;
          if (newTenor <= 0) {
            isFullLunas = true;
            payloadUpdateMaster = { id: selectedKewajiban.id, sisa_tenor: 0, status_kewajiban: KEWAJIBAN_STATUS.PAID_OFF };
          } else {
            payloadUpdateMaster = { id: selectedKewajiban.id, sisa_tenor: newTenor };
          }
       } else if (selectedKewajiban.mode_tracking === TRACKING_MODE.POKOK) {
          const newPokok = Math.max(0, Number(selectedKewajiban.sisa_pokok || 0) - nominalBayar);
          if (newPokok <= 0) {
            isFullLunas = true;
            payloadUpdateMaster = { id: selectedKewajiban.id, sisa_pokok: 0, status_kewajiban: KEWAJIBAN_STATUS.PAID_OFF };
          } else {
            payloadUpdateMaster = { id: selectedKewajiban.id, sisa_pokok: newPokok };
          }
       }
    }

    try {
      const isSuccess = await sendToSheet('insert', payloadTrx, 'trx_pembayaran_kewajiban');
      if (isSuccess) {
        await sendToSheet('insert', payloadCfo, 'cashflow_transactions');
        if (payloadUpdateMaster) await sendToSheet('update', payloadUpdateMaster, 'master_kewajiban');

        if (typeof showToast === 'function') showToast(`Pembayaran ${formatRupiah(nominalBayar)} berhasil dicatat!`, 'success');
        if (isFullLunas) alert(`🎉 LUAR BIASA! ${selectedKewajiban.nama_kewajiban} telah LUNAS SEPENUHNYA! Kapasitas Dana Bebas Anda bertambah ${formatRupiah(selectedKewajiban.target_bulanan)}/bulan.`);
        
        setShowFormBayar(false); 
        setSelectedKewajiban(null);
        setFormBayar({ nominal: '', dompet: 'TF_BRI_PUSAT', keterangan: '' });
      }
    } catch(e) {
      alert('Koneksi terputus. Gagal menyimpan.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSimulasiChange = (field, value) => {
    const val = Number(value);
    setSimSlider(prev => ({ ...prev, [field]: val }));
  };

  const totalSimulasi = simSlider.ayam + simSlider.ops + simSlider.komitmen + simSlider.profit;

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* 🚀 HEADS-UP DISPLAY (HUD) - RINGKASAN KEWAJIBAN BULAN INI */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-6 shadow-xl border border-slate-700 relative overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <Target className="absolute -right-4 -bottom-4 text-white/5 pointer-events-none" size={150} />
        
        <div className="relative z-10 w-full md:w-1/2">
          <h2 className="text-xl font-black text-white uppercase tracking-wider flex items-center gap-2 mb-1">
            <Activity className="text-blue-400"/> Pusat Komando Kewajiban
          </h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-6">Periode: {formatDate(todayStr).substring(3)}</p>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
               <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Target Bulan Ini</div>
               <div className="text-xl font-black text-white">{formatRupiah(metrikBulanIni.targetBulanIni)}</div>
             </div>
             <div>
               <div className="text-[9px] text-emerald-400 font-black uppercase tracking-wider">Sudah Terbayar</div>
               <div className="text-xl font-black text-emerald-400">{formatRupiah(metrikBulanIni.dibayarBulanIni)}</div>
             </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-700/50">
             <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-slate-300 mb-1.5">
               <span>Sisa Kewajiban: {formatRupiah(metrikBulanIni.sisaKewajiban)}</span>
               <span>Progress: {((metrikBulanIni.dibayarBulanIni / (metrikBulanIni.targetBulanIni || 1)) * 100).toFixed(0)}%</span>
             </div>
             <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
               <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${(metrikBulanIni.dibayarBulanIni / (metrikBulanIni.targetBulanIni || 1)) * 100}%` }}></div>
             </div>
          </div>
        </div>

        <div className="relative z-10 w-full md:w-1/3 space-y-4">
          <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl shadow-inner backdrop-blur-sm">
            <div className="text-[9px] text-slate-400 font-black uppercase tracking-wider mb-1 flex items-center gap-1.5"><Calendar size={12}/> Jatuh Tempo Terdekat</div>
            {metrikBulanIni.terdekat ? (
              <>
                <div className="text-sm font-black text-white uppercase tracking-wider">{metrikBulanIni.terdekat.nama}</div>
                <div className={`text-[10px] font-black uppercase tracking-widest mt-1 ${metrikBulanIni.terdekat.sisaHari <= 3 ? 'text-red-400 animate-pulse' : 'text-amber-400'}`}>
                  Tgl {metrikBulanIni.terdekat.tgl} (H-{metrikBulanIni.terdekat.sisaHari})
                </div>
              </>
            ) : (
              <div className="text-xs font-bold text-emerald-400">Semua Tagihan Aman</div>
            )}
          </div>

          <div className="bg-emerald-900/40 border border-emerald-800/50 p-4 rounded-2xl shadow-inner backdrop-blur-sm cursor-pointer hover:bg-emerald-900/60 transition-colors group" onClick={() => setShowSimulator(true)}>
            <div className="text-[9px] text-emerald-400 font-black uppercase tracking-wider mb-1 flex items-center gap-1.5"><ShieldAlert size={12}/> Kapasitas Dibebaskan</div>
            <div className="text-xl font-black text-emerald-400 tracking-tight">{formatRupiah(metrikBulanIni.kapasitasBebas)} <span className="text-[9px] text-emerald-500 uppercase tracking-widest">/ Bln</span></div>
            <div className="text-[8px] font-bold text-slate-400 mt-1 uppercase group-hover:text-emerald-300 flex items-center gap-1">Klik untuk Buka Simulator <ArrowRight size={10}/></div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-max shadow-inner">
        <button onClick={() => setActiveSubTab('DASHBOARD')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${activeSubTab === 'DASHBOARD' ? 'bg-white text-blue-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}><BarChart3 size={14}/> Kewajiban Aktif</button>
        <button onClick={() => setActiveSubTab('ARSIP')} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${activeSubTab === 'ARSIP' ? 'bg-white text-emerald-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}><CheckCircle2 size={14}/> Arsip Lunas</button>
      </div>

      {/* 🧾 TABEL KEWAJIBAN AKTIF */}
      {activeSubTab === 'DASHBOARD' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden border-t-4 border-t-blue-500">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <h3 className="font-black text-xs text-slate-800 uppercase tracking-wider">Daftar Komitmen &amp; Kewajiban Berjalan</h3>
            <button onClick={() => { setFormMaster({ id: '', nama_kewajiban: '', kategori: 'CICILAN', target_bulanan: '', jatuh_tempo: '15', mode_tracking: TRACKING_MODE.TENOR, sisa_tenor: '', sisa_pokok: '' }); setShowFormKewajiban(true); }} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm flex items-center gap-1.5 transition-colors cursor-pointer"><Plus size={12}/> Tambah Baru</button>
          </div>
          
          <div className="overflow-x-auto p-2 custom-scrollbar min-h-[40vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <tr><th className="px-5 py-4 font-black">Nama Kewajiban</th><th className="px-5 py-4 font-black text-center">Status Lacak</th><th className="px-5 py-4 font-black">Progress Bulan Ini</th><th className="px-5 py-4 font-black text-center">Aksi Hub</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs bg-white">
                {kewajibanAktif.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-16 text-slate-400 font-bold">Tidak ada kewajiban aktif.</td></tr>
                ) : (
                  kewajibanAktif.map(k => (
                    <tr key={k.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-black text-slate-800 text-sm uppercase tracking-wide mb-1">{k.nama_kewajiban}</div>
                        <span className="bg-slate-100 border border-slate-200 text-slate-600 px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider shadow-3xs">{k.kategori} • Tgl {k.jatuh_tempo}</span>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{k.mode_tracking.replace(/_/g, ' ')}</div>
                        <div className="font-black text-slate-800 mt-0.5">
                          {k.mode_tracking === TRACKING_MODE.PERMANEN ? '∞' 
                           : k.mode_tracking === TRACKING_MODE.TENOR ? `${k.sisa_tenor} Bulan` 
                           : formatRupiah(k.sisa_pokok)}
                        </div>
                      </td>
                      <td className="px-5 py-4 w-64">
                        <div className="flex justify-between text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
                          <span className={k.sisaBulanIni <= 0 ? 'text-emerald-600' : ''}>{formatRupiah(k.totalTrxBulanIni)} / {formatRupiah(k.target_bulanan)}</span>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                          <div className={`h-full transition-all ${k.progress >= 100 ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${k.progress}%` }}></div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => { setSelectedKewajiban(k); setShowFormBayar(true); }} disabled={k.sisaBulanIni <= 0} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-sm transition-transform active:scale-95 flex items-center gap-1.5 cursor-pointer ${k.sisaBulanIni <= 0 ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 opacity-50' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                            {k.sisaBulanIni <= 0 ? <CheckCircle2 size={12}/> : <Wallet size={12}/>}
                            {k.sisaBulanIni <= 0 ? 'Tuntas' : 'Bayar'}
                          </button>
                          <button onClick={() => { setSelectedKewajiban(k); setDetailHistory(trx_pembayaran_kewajiban.filter(t => !t.isDeleted && t.id_kewajiban === k.id)); }} className="p-2 text-slate-400 bg-white border border-slate-200 hover:border-blue-300 hover:text-blue-600 rounded-lg shadow-sm transition-colors cursor-pointer" title="Riwayat Pembayaran">
                            <History size={14}/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 🏆 TABEL ARSIP LUNAS (DANA BEBAS) */}
      {activeSubTab === 'ARSIP' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden border-t-4 border-t-emerald-500">
           <div className="p-5 bg-slate-50 border-b border-slate-100">
            <h3 className="font-black text-xs text-slate-800 uppercase tracking-wider text-emerald-800">Daftar Komitmen Lunas (Kapasitas Dibebaskan)</h3>
          </div>
          <div className="p-6">
            {kewajibanLunas.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs font-bold">Belum ada kewajiban yang lunas.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {kewajibanLunas.map(k => (
                  <div key={k.id} className="bg-emerald-50/30 border border-emerald-100 p-5 rounded-2xl shadow-sm">
                     <div className="flex justify-between items-start mb-3">
                       <span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-[8px] font-black uppercase tracking-wider border border-emerald-200"><CheckCircle2 size={10} className="inline mr-1"/>Lunas</span>
                     </div>
                     <div className="font-black text-slate-800 text-sm uppercase tracking-wide">{k.nama_kewajiban}</div>
                     <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-1">Kapasitas Bebas: <span className="text-emerald-600 font-black">{formatRupiah(k.target_bulanan)}/Bln</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODALS
         ========================================================================= */}

      {/* 1. MODAL TAMBAH MASTER KEWAJIBAN */}
      {showFormKewajiban && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 flex justify-between items-center text-white">
              <h3 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                <Target size={18} className="text-blue-400"/> Tambah Master Kewajiban
              </h3>
              <button onClick={() => setShowFormKewajiban(false)} className="text-slate-400 hover:text-white transition-colors cursor-pointer"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleSaveMaster} className="p-6 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Nama Kewajiban</label>
                <input type="text" required value={formMaster.nama_kewajiban} onChange={e => setFormMaster({...formMaster, nama_kewajiban: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500 uppercase" placeholder="Cth: KUR BRI / Mobil Operasional" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Target Bulanan (Rp)</label>
                  <input type="text" required value={formMaster.target_bulanan ? Number(formMaster.target_bulanan).toLocaleString('id-ID') : ''} onChange={e => setFormMaster({...formMaster, target_bulanan: e.target.value.replace(/\D/g, '')})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500" placeholder="Cth: 2500000" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Tgl Jatuh Tempo (1-31)</label>
                  <input type="number" required min="1" max="31" value={formMaster.jatuh_tempo} onChange={e => setFormMaster({...formMaster, jatuh_tempo: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500" placeholder="15" />
                </div>
              </div>

              <div className="pt-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Mode Lacak Kewajiban</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mode" value={TRACKING_MODE.TENOR} checked={formMaster.mode_tracking === TRACKING_MODE.TENOR} onChange={e => setFormMaster({...formMaster, mode_tracking: e.target.value})} className="accent-blue-600"/>
                    <span className="text-xs font-bold">Tenor (Bulan)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mode" value={TRACKING_MODE.POKOK} checked={formMaster.mode_tracking === TRACKING_MODE.POKOK} onChange={e => setFormMaster({...formMaster, mode_tracking: e.target.value})} className="accent-blue-600"/>
                    <span className="text-xs font-bold">Sisa Pokok (Rp)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="mode" value={TRACKING_MODE.PERMANEN} checked={formMaster.mode_tracking === TRACKING_MODE.PERMANEN} onChange={e => setFormMaster({...formMaster, mode_tracking: e.target.value})} className="accent-blue-600"/>
                    <span className="text-xs font-bold">Permanen (Sewa)</span>
                  </label>
                </div>
              </div>

              {formMaster.mode_tracking === TRACKING_MODE.TENOR && (
                <div className="animate-in fade-in">
                  <label className="text-[10px] font-black text-blue-600 uppercase tracking-wider block mb-1">Sisa Tenor (Bulan)</label>
                  <input type="number" required value={formMaster.sisa_tenor} onChange={e => setFormMaster({...formMaster, sisa_tenor: e.target.value})} className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-blue-500" placeholder="Cth: 18" />
                </div>
              )}

              {formMaster.mode_tracking === TRACKING_MODE.POKOK && (
                <div className="animate-in fade-in">
                  <label className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block mb-1">Sisa Hutang Pokok (Rp)</label>
                  <input type="text" required value={formMaster.sisa_pokok ? Number(formMaster.sisa_pokok).toLocaleString('id-ID') : ''} onChange={e => setFormMaster({...formMaster, sisa_pokok: e.target.value.replace(/\D/g, '')})} className="w-full p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-emerald-500" placeholder="Cth: 125000000" />
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 mt-4">
                <button type="button" onClick={() => setShowFormKewajiban(false)} className="px-6 py-2.5 rounded-xl text-slate-500 font-black text-xs uppercase tracking-wider hover:bg-slate-100 cursor-pointer">Batal</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider shadow-md disabled:opacity-50 cursor-pointer">
                  {isSubmitting ? 'Menyimpan...' : 'Simpan Master'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. MODAL BAYAR */}
      {showFormBayar && selectedKewajiban && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black text-sm uppercase tracking-wider">Eksekusi Pembayaran</h3>
              <button onClick={() => setShowFormBayar(false)} className="text-slate-400 hover:text-white cursor-pointer"><X size={18}/></button>
            </div>
            <form onSubmit={handleBayarCicilan} className="p-6 space-y-4">
               <div className="text-center mb-4">
                 <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Target Sisa Bulan Ini:</div>
                 <div className="text-2xl font-black text-slate-800">{formatRupiah(selectedKewajiban.sisaBulanIni)}</div>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Nominal Bayar (Rp)</label>
                 <input type="text" required value={formBayar.nominal ? Number(formBayar.nominal).toLocaleString('id-ID') : ''} onChange={e=>setFormBayar({...formBayar, nominal: e.target.value.replace(/\D/g, '')})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-center outline-none focus:bg-white focus:border-blue-500 shadow-inner" placeholder="0" />
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Potong Dompet Fisik</label>
                 <select value={formBayar.dompet} onChange={e=>setFormBayar({...formBayar, dompet: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 shadow-sm cursor-pointer uppercase tracking-wider">
                   <option value="TF_BRI_PUSAT">Rekening BRI Pusat (Rp {formatNumber(kasRiil.bri)})</option>
                   <option value="TF_BCA_PUSAT">Rekening BCA Pusat (Rp {formatNumber(kasRiil.bca)})</option>
                   <option value="CASH">Uang Tunai Laci (Rp {formatNumber(kasRiil.cash)})</option>
                 </select>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Keterangan Opsional</label>
                 <input type="text" value={formBayar.keterangan} onChange={e=>setFormBayar({...formBayar, keterangan: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-blue-500 shadow-sm" placeholder="Cth: Titip bayar via ATM..." />
               </div>
               <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-md disabled:opacity-50 transition-transform active:scale-95 mt-2 cursor-pointer">
                 {isSubmitting ? 'Memproses...' : 'Sahkan & Potong Kas'}
               </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. MODAL SIMULATOR KEPUTUSAN */}
      {showSimulator && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col h-[90vh]">
            <div className="p-6 bg-slate-950 text-white flex justify-between items-start shrink-0 relative overflow-hidden">
               <Lightbulb className="absolute right-0 top-0 opacity-10 text-emerald-400" size={100}/>
               <div className="relative z-10">
                 <h3 className="font-black text-lg uppercase tracking-wide flex items-center gap-2 text-emerald-400"><Lightbulb size={20}/> Simulator Keputusan Strategis</h3>
                 <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">Simulasikan dampak pembebasan dana {formatRupiah(metrikBulanIni.kapasitasBebas)}/bulan ke 4 Amplop.</p>
               </div>
               <button onClick={() => setShowSimulator(false)} className="text-slate-400 hover:text-white cursor-pointer relative z-10"><X size={20}/></button>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar bg-slate-50 space-y-6">
               <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl shadow-inner text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-start gap-2">
                 <AlertTriangle size={16} className="shrink-0 text-amber-600"/>
                 <div>Layar ini hanya untuk visualisasi prediksi (Sandbox). Angka di sini tidak akan otomatis merubah sistem. Gunakan layar ini untuk mengambil keputusan sebelum mengubah pengaturan di Master Aturan Konversi.</div>
               </div>

               <div className="space-y-4">
                 <div>
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2"><span>Ayam &amp; Bahan Baku (Amplop 1)</span><span className="text-blue-600">{simSlider.ayam}%</span></div>
                   <input type="range" min="0" max="100" value={simSlider.ayam} onChange={e=>handleSimulasiChange('ayam', e.target.value)} className="w-full accent-blue-600 cursor-pointer" />
                 </div>
                 <div>
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2"><span>Operasional &amp; Gaji (Amplop 2)</span><span className="text-emerald-600">{simSlider.ops}%</span></div>
                   <input type="range" min="0" max="100" value={simSlider.ops} onChange={e=>handleSimulasiChange('ops', e.target.value)} className="w-full accent-emerald-600 cursor-pointer" />
                 </div>
                 <div>
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2"><span>Komitmen &amp; Fix Cost (Amplop 3)</span><span className="text-orange-600">{simSlider.komitmen}%</span></div>
                   <input type="range" min="0" max="100" value={simSlider.komitmen} onChange={e=>handleSimulasiChange('komitmen', e.target.value)} className="w-full accent-orange-600 cursor-pointer" />
                 </div>
                 <div>
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2"><span>Profit Owner / Prive (Amplop 4)</span><span className="text-amber-600">{simSlider.profit}%</span></div>
                   <input type="range" min="0" max="100" value={simSlider.profit} onChange={e=>handleSimulasiChange('profit', e.target.value)} className="w-full accent-amber-600 cursor-pointer" />
                 </div>
               </div>

               <div className={`p-4 rounded-2xl border text-center font-black text-sm uppercase tracking-wider shadow-sm ${totalSimulasi === 100 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200 animate-pulse'}`}>
                 Total Rasio: {totalSimulasi}% {totalSimulasi !== 100 && '(Harus 100%)'}
               </div>

               <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm">
                 <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-4 border-b border-slate-100 pb-2">Proyeksi Asumsi Cash-In Rp 700.000.000 / Bulan</div>
                 <div className="space-y-3 text-xs font-bold uppercase text-slate-600">
                   <div className="flex justify-between"><span>Jatah Ayam:</span><span className="font-black text-blue-600">{formatRupiah(700000000 * (simSlider.ayam/100))}</span></div>
                   <div className="flex justify-between"><span>Jatah Operasional:</span><span className="font-black text-emerald-600">{formatRupiah(700000000 * (simSlider.ops/100))}</span></div>
                   <div className="flex justify-between items-center">
                      <span>Jatah Komitmen:</span>
                      <div className="text-right">
                        <div className="font-black text-orange-600">{formatRupiah(700000000 * (simSlider.komitmen/100))}</div>
                        {((700000000 * (simSlider.komitmen/100)) < metrikBulanIni.targetBulanIni) && <div className="text-[8px] text-red-500 mt-0.5">⚠️ Kurang dari target bulanan ({formatRupiah(metrikBulanIni.targetBulanIni)})</div>}
                      </div>
                   </div>
                   <div className="flex justify-between pt-2 border-t border-slate-100"><span>Proyeksi Hak Profit Bos:</span><span className="font-black text-amber-600 text-base">{formatRupiah(700000000 * (simSlider.profit/100))}</span></div>
                 </div>
               </div>
            </div>
            <div className="p-5 bg-white border-t border-slate-200 shrink-0 text-center">
              <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-3">Jika simulasi sudah ideal, ubah aturan secara permanen di menu Master Konversi (SSOT).</div>
              <button onClick={() => setShowSimulator(false)} className="px-8 py-3 bg-slate-900 text-white font-black text-[11px] uppercase tracking-wider rounded-xl shadow-md transition-transform active:scale-95 cursor-pointer">Tutup Simulator</button>
            </div>
          </div>
        </div>
      )}

      {/* 4. MODAL HISTORY BAYAR */}
      {detailHistory && selectedKewajiban && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[9999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h3 className="font-black text-sm text-slate-800 uppercase tracking-wider">Riwayat Cicilan</h3>
                <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{selectedKewajiban.nama_kewajiban}</p>
              </div>
              <button onClick={() => setDetailHistory(null)} className="text-slate-400 hover:text-red-500 cursor-pointer"><X size={18}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-white custom-scrollbar">
              {detailHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-400 font-bold text-xs">Belum ada riwayat pembayaran bulan ini.</div>
              ) : (
                <div className="space-y-3">
                  {detailHistory.sort((a,b) => new Date(b.tanggal_bayar) - new Date(a.tanggal_bayar)).map(t => (
                    <div key={t.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 shadow-3xs">
                      <div className="flex justify-between items-start mb-2 border-b border-slate-200 pb-2">
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">{formatDate(t.tanggal_bayar)}</span>
                        <span className="text-[9px] font-black text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 uppercase tracking-wider">{t.dompet_sumber.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.keterangan_opsional || 'Tanpa keterangan'}</span>
                        <span className="text-sm font-black text-slate-800 tracking-tight">{formatRupiah(t.nominal_dibayar)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
