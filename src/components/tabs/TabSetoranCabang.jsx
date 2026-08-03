import React, { useState, useMemo } from 'react';
import { 
  Coins, Wallet, ArrowDownRight, CheckCircle2, 
  XCircle, Clock, FileText, Landmark, AlertCircle, ShieldCheck
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabSetoranCabang({ 
  orders = [], orders_data,
  expenses = [], expenses_data,
  branch_settlements = [], branch_settlements_data,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  
  // 🔥 GEMBOK UTAMA ROLE
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // SINKRONISASI DATABASE
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realSettlements = useMemo(() => branch_settlements_data || branch_settlements || [], [branch_settlements, branch_settlements_data]);

  const [cashInHand, setCashInHand] = useState('');
  const [amountSent, setAmountSent] = useState('');
  const [method, setMethod] = useState('TRANSFER_BCA_PUSAT');
  const [notes, setNotes] = useState('');

  // --- ENGINE HITUNG KAS EOD INTERNAL CABANG ---
  const eodCalculation = useMemo(() => {
    let tunaiLunas = 0;
    let bebanKeluar = 0;

    realOrders.forEach(o => {
      if (!o.isDeleted && o.branch_id === currentBranch && o.date === todayStr) {
        if (o.payment_method === 'CASH') {
          tunaiLunas += Number(o.amount_paid || 0);
        }
      }
    });

    realExpenses.forEach(e => {
      if (!e.isDeleted && e.branch_id === currentBranch && e.date === todayStr) {
        if (e.payment_method === 'CASH') {
          bebanKeluar += Number(e.amount || 0);
        }
      }
    });

    const ekspektasiLaci = Math.max(0, tunaiLunas - bebanKeluar);
    return { tunaiLunas, bebanKeluar, ekspektasiLaci };
  }, [realOrders, realExpenses, currentBranch, todayStr]);

  const handleKirimSetoran = async (e) => {
    e.preventDefault();
    if (!amountSent || Number(amountSent) <= 0) return alert("Nominal uang disetor harus valid!");

    if (!window.confirm(`Konfirmasi Kirim Berkas EOD:\n\nNominal: ${formatRupiah(amountSent)}\nMetode: ${method.replace(/_/g, ' ')}\n\nKirim ke pusat untuk divalidasi?`)) return;

    const payload = {
      id: generateId('SET', todayStr),
      date: todayStr,
      branch_id: currentBranch,
      cash_in_laci: Number(cashInHand || 0),
      nominal: Number(amountSent),
      method: method,
      status: 'PENDING_VALIDASI',
      notes: notes || '-',
      isDeleted: false
    };

    if (await sendToSheet('insert', payload, 'branch_settlements')) {
      showToast("Berkas laporan setoran berhasil dikirim ke Pusat!", "success");
      setCashInHand(''); setAmountSent(''); setNotes('');
    }
  };

  // 🔥 FIX BUG FATAL: MENAMBAHKAN UANG SETORAN KE ARUS KAS PUSAT JIKA DI_ACC
  const handleValidasiPusat = async (settlementItem, statusBaru) => {
    const aksiTxt = statusBaru === 'DI_SETUJUI' ? 'MENYETUJUI & SAHKAN' : 'MENOLAK';
    if (!window.confirm(`Apakah Anda yakin ingin ${aksiTxt} setoran dari ${settlementItem.branch_id} sebesar ${formatRupiah(settlementItem.nominal)}?\n\n(Jika disetujui, uang akan otomatis ditambahkan ke Kas/Bank Utama).`)) return;

    const payloadStatus = {
      ...settlementItem,
      status: statusBaru,
      verified_date: new Date().toISOString()
    };

    // Jika Acc, siapkan payload untuk masuk Arus Kas Utama
    let payloadCashflow = null;
    if (statusBaru === 'DI_SETUJUI') {
        payloadCashflow = {
            id: generateId('CFI', todayStr),
            date: todayStr,
            branch_id: 'TANGERANG_PUSAT',
            type: 'IN',
            category: 'SETORAN CABANG',
            description: `Validasi Setoran EOD dari ${settlementItem.branch_id.replace(/_/g, ' ')} (Ref: ${settlementItem.id})`,
            amount: Number(settlementItem.nominal),
            method: settlementItem.method,
            reference_id: settlementItem.id,
            isDeleted: false
        };
    }

    const isSuccess = await sendToSheet('update', payloadStatus, 'branch_settlements');
    if (isSuccess) {
      if (payloadCashflow) {
          await sendToSheet('insert', payloadCashflow, 'cashflow_transactions');
      }
      showToast(`Setoran cabang resmi ${statusBaru === 'DI_SETUJUI' ? 'disahkan masuk pembukuan pusat!' : 'ditolak balik!'}`, 'success');
    }
  };

  const displayedSettlements = useMemo(() => {
    if (isHQ) return realSettlements.filter(s => !s.isDeleted).reverse();
    return realSettlements.filter(s => !s.isDeleted && s.branch_id === currentBranch).reverse();
  }, [realSettlements, isHQ, currentBranch]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* 🚀 HEADER BAR STATUS - FLUID GRADIENT */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-blue-900 p-6 lg:p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-3xl shadow-xl border border-blue-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5"><Coins size={120} className="text-blue-400"/></div>
        <div className="relative z-10">
          <h2 className="text-xl font-black text-white flex items-center gap-3 tracking-wide mb-2 uppercase">
            <Coins className="text-blue-400" size={24}/> Closing &amp; Settlement Node Harian
          </h2>
          <p className="text-[11px] font-bold text-slate-400 max-w-lg leading-relaxed">
            {isHQ ? 'Otoritas Komando Pusat: Pemeriksaan dan validasi lembar fisik kliring setoran uang dari kulkas laci seluruh cabang. Uang akan otomatis di-inject ke Kas Pusat jika divalidasi.' : `Rekapitulasi berkas uang laci kasir harian cabang ${currentBranch.replace(/_/g, ' ')}.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KIRI (5 KOLOM): KALKULASI SISTEM AUTOMATIS (Hanya Relevan buat Cabang) */}
        {!isHQ && (
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-3xl shadow-sm flex flex-col overflow-hidden border-t-4 border-t-blue-500">
            <div className="p-6 flex-1">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-5 flex items-center gap-2"><FileText size={18} className="text-blue-600"/> Kalkulasi Sistem EOD (Hari Ini)</h3>
              <div className="space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <span className="text-[10px] font-black text-slate-500 block uppercase tracking-wider mb-1">Penjualan Tunai Bersih Laci</span>
                  <span className="text-2xl font-black text-slate-800 tracking-tight">{formatRupiah(eodCalculation.tunaiLunas)}</span>
                </div>
                <div className="border-b border-slate-100 pb-4">
                  <span className="text-[10px] font-black text-slate-500 block uppercase tracking-wider mb-1">Total Beban Keluar Cabang</span>
                  <span className="text-2xl font-black text-red-500 tracking-tight">-{formatRupiah(eodCalculation.bebanKeluar)}</span>
                </div>
              </div>
              
              <div className="bg-blue-50 p-5 rounded-2xl border border-blue-100 mt-6 shadow-inner">
                <span className="text-[10px] font-black text-blue-500 block uppercase tracking-wider mb-1">Ekspektasi Uang Fisik Wajib Ada</span>
                <span className="text-3xl font-black text-blue-700 tracking-tighter">{formatRupiah(eodCalculation.ekspektasiLaci)}</span>
              </div>
            </div>
          </div>
        )}

        {/* KANAN (7 KOLOM): SMART SWITCH (IF HQ -> ANTRIAN APPROVAL, IF BRANCH -> FORM INPUT) */}
        <div className={isHQ ? "lg:col-span-12" : "lg:col-span-7"}>
          {isHQ ? (
            /* 🔥 DISPLAY PUSAT: DAFTAR ANTREAN VALIDASI BERKAS MASUK */
            <div className="bg-white border border-slate-200 rounded-3xl h-full overflow-hidden flex flex-col shadow-sm">
              <div className="p-6 bg-slate-50 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2"><Landmark size={18} className="text-blue-600"/> Meja Antrean Validasi Setoran Cabang Masuk</h3>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 p-6 custom-scrollbar max-h-[500px]">
                {displayedSettlements.filter(s => s.status === 'PENDING_VALIDASI').length === 0 ? (
                  <div className="text-center py-20 text-slate-400 font-bold flex flex-col items-center justify-center h-full">
                    <ShieldCheck size={48} className="text-emerald-500 mb-3 opacity-30"/>
                    <span className="text-sm">Semua laporan kliring setoran cabang sudah rapi divalidasi, Bos!</span>
                  </div>
                ) : (
                  displayedSettlements.filter(s => s.status === 'PENDING_VALIDASI').map(item => (
                    <div key={item.id} className="bg-white border border-slate-200 p-5 rounded-2xl flex flex-col xl:flex-row justify-between items-start xl:items-center gap-5 hover:border-blue-400 transition-all shadow-sm">
                      <div className="w-full xl:w-auto">
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">{formatDate(item.date)} • Ref: {item.id}</div>
                        <div className="text-sm font-black text-slate-800 uppercase tracking-wide">Asal: {item.branch_id.replace(/_/g, ' ')}</div>
                        <div className="text-3xl font-black text-blue-600 my-2 tracking-tighter">{formatRupiah(item.nominal)}</div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">Jalur: <span className="text-slate-800">{item.method.replace(/_/g, ' ')}</span></div>
                        <div className="text-[11px] font-medium text-slate-500 italic bg-slate-50 p-2 rounded-lg mt-2 border border-slate-100">Catatan toko: "{item.notes}"</div>
                      </div>
                      <div className="flex gap-3 w-full xl:w-auto shrink-0 mt-2 xl:mt-0">
                        <button type="button" onClick={() => handleValidasiPusat(item, 'DI_TOLAK')} className="p-4 bg-red-50 text-red-600 border border-red-200 rounded-xl hover:bg-red-600 hover:text-white transition-colors cursor-pointer shadow-sm" title="Tolak Berkas"><XCircle size={20}/></button>
                        <button type="button" onClick={() => handleValidasiPusat(item, 'DI_SETUJUI')} className="flex-1 xl:flex-none bg-emerald-600 text-white font-black text-xs px-6 py-4 rounded-xl hover:bg-emerald-700 shadow-md transition-transform active:scale-95 uppercase tracking-wider cursor-pointer flex items-center justify-center gap-2"><CheckCircle2 size={16}/> Sahkan Setoran</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* 🏪 DISPLAY OUTLET: FORM INPUT SETORAN KASIR TOKO */
            <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 border-t-4 border-t-emerald-500">
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-5 flex items-center gap-2"><ArrowDownRight size={18} className="text-emerald-600"/> Lembar Setoran Cabang (Kirim ke Pusat)</h3>
              <form onSubmit={handleKirimSetoran} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">1. Hitung Fisik Riil Laci (Rp)</label>
                    <input type="text" value={cashInHand ? Number(cashInHand).toLocaleString('id-ID') : ''} onChange={e=>setCashInHand(e.target.value.replace(/\D/g, ''))} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-black text-base shadow-inner outline-none focus:border-emerald-500" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">2. Nominal Uang Disetor (Rp)</label>
                    <input type="text" required value={amountSent ? Number(amountSent).toLocaleString('id-ID') : ''} onChange={e=>setAmountSent(e.target.value.replace(/\D/g, ''))} className="w-full p-3.5 bg-emerald-50 border-2 border-emerald-200 rounded-xl font-black text-xl text-emerald-700 focus:bg-white shadow-inner outline-none focus:border-emerald-500 transition-colors" placeholder="0" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Metode Serah Terima</label>
                    <select value={method} onChange={e=>setMethod(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs cursor-pointer outline-none focus:border-emerald-500 uppercase tracking-wider">
                      <option value="TRANSFER_BCA_PUSAT">Transfer Bank (BCA Pusat)</option>
                      <option value="TRANSFER_BRI_PUSAT">Transfer Bank (BRI Pusat)</option>
                      <option value="CASH_SETOR_LANGSUNG">Serah Fisik Tunai (Ke Bos)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Catatan Tambahan Transaksi</label>
                    <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-emerald-500" placeholder="Contoh: Titip lewat supir DO..." />
                  </div>
                </div>
                <button type="submit" className="w-full bg-emerald-600 text-white font-black py-4 rounded-xl text-xs uppercase tracking-wider hover:bg-emerald-700 shadow-md transition-transform active:scale-95 cursor-pointer mt-2 flex items-center justify-center gap-2">
                  <CheckCircle2 size={16}/> Kirim Setoran &amp; Tunggu Validasi
                </button>
              </form>
            </div>
          )}
        </div>

      </div>

      {/* HISTORI TRACKING KEUANGAN GLOBAL */}
      <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center gap-2">
          <Clock size={18} className="text-slate-600"/>
          <h4 className="font-black text-sm text-slate-800 uppercase tracking-wider">Histori Catatan Kliring Berkas Setoran</h4>
        </div>
        <div className="overflow-x-auto p-2 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-5 py-4 font-black">Tanggal &amp; ID</th>
                <th className="px-5 py-4 font-black">Asal Cabang</th>
                <th className="px-5 py-4 font-black">Metode Kirim</th>
                <th className="px-5 py-4 text-center font-black">Nominal Disetor</th>
                <th className="px-5 py-4 text-right font-black">Status Validasi Pusat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
              {displayedSettlements.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-16 text-slate-400 font-medium text-sm">Belum ada riwayat mutasi berkas keuangan EOD.</td></tr>
              ) : (
                displayedSettlements.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="font-black text-slate-800">{formatDate(item.date)}</div>
                      <div className="text-[10px] text-slate-400 font-mono mt-1">Ref: {item.id}</div>
                    </td>
                    <td className="px-5 py-4 uppercase text-slate-800 font-black whitespace-nowrap tracking-wide">{item.branch_id.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-4 text-slate-500 font-bold uppercase tracking-wider whitespace-nowrap">{item.method.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-4 text-center text-blue-600 font-black text-base tracking-tight whitespace-nowrap">{formatRupiah(item.nominal)}</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <span className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider border shadow-3xs ${
                        item.status === 'DI_SETUJUI' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        item.status === 'DI_TOLAK' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse'
                      }`}>
                        {item.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
