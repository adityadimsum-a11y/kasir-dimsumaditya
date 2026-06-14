import React, { useState, useMemo } from 'react';
import { 
  Coins, Wallet, ArrowDownRight, CheckCircle2, 
  XCircle, Clock, FileText, Landmark, AlertCircle 
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
  
  // 🔥 GEMBOK UTAMA ROLE: Cek apakah yang login adalah Admin Pusat/HQ
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT' || currentBranch === 'TANGERANG_PUSAT';

  // SINKRONISASI DATABASE 100% SINGLE SOURCE OF TRUTH
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realSettlements = useMemo(() => branch_settlements_data || branch_settlements || [], [branch_settlements, branch_settlements_data]);

  // STATE FORM INPUT KHUSUS CABANG
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

  // --- ACTIONS: SUBMIT BERKAS (Hanya Bisa Diisi Oleh Cabang) ---
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

  // --- ACTIONS: VALIDASI ACC BOS PUSAT (Hanya Muncul di Akun Pusat Ente) ---
  const handleValidasiPusat = async (settlementItem, statusBaru) => {
    const aksiTxt = statusBaru === 'DI_SETUJUI' ? 'MENYETUJUI & SAHKAN' : 'MENOLAK';
    if (!window.confirm(`Apakah Ente yakin ingin ${aksiTxt} setoran dari ${settlementItem.branch_id} sebesar ${formatRupiah(settlementItem.nominal)}?`)) return;

    const payload = {
      ...settlementItem,
      status: statusBaru,
      verified_date: new Date().toISOString()
    };

    if (await sendToSheet('update', payload, 'branch_settlements')) {
      showToast(`Setoran cabang resmi ${statusBaru === 'DI_SETUJUI' ? 'disahkan masuk pembukuan!' : 'ditolak balik!'}`, 'success');
    }
  };

  // Filter Tampilan Berkas Sesuai Hak Akses Radar
  const displayedSettlements = useMemo(() => {
    if (isHQ) {
      return realSettlements.filter(s => !s.isDeleted).reverse();
    }
    return realSettlements.filter(s => !s.isDeleted && s.branch_id === currentBranch).reverse();
  }, [realSettlements, isHQ, currentBranch]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* HEADER BAR STATUS */}
      <div className="card-holo p-5 bg-white border border-slate-200 flex justify-between items-center shadow-2xs">
        <div>
          <h2 className="text-sm font-extrabold text-slate-800 normal-case flex items-center gap-2">
            <Coins className="text-blue-600" size={18}/> Closing &amp; settlement node harian
          </h2>
          <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5">
            {isHQ ? 'Otoritas Komando Pusat: Pemeriksaan lembar fisik kliring setoran dari kulkas laci cabang.' : `Rekapitulasi berkas laci kasir harian cabang ${currentBranch}.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KIRI (5 KOLOM): KALKULASI SISTEM AUTOMATIS (Hanya Relevan buat Cabang) */}
        <div className="lg:col-span-5 card-holo p-5 bg-white border border-slate-200 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-black text-slate-800 normal-case mb-4 flex items-center gap-1.5"><FileText size={14}/> Kalkulasi sistem EOD (Hari ini)</h3>
            <div className="space-y-4">
              <div className="border-b pb-3">
                <span className="text-[10px] font-bold text-slate-400 block normal-case">Penjualan tunai bersih laci</span>
                <span className="text-lg font-extrabold text-slate-800">{formatRupiah(eodCalculation.tunaiLunas)}</span>
              </div>
              <div className="border-b pb-3">
                <span className="text-[10px] font-bold text-slate-400 block normal-case">Total beban keluar cabang</span>
                <span className="text-lg font-extrabold text-red-500">-{formatRupiah(eodCalculation.bebanKeluar)}</span>
              </div>
            </div>
          </div>
          
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
            <span className="text-[10px] font-bold text-slate-500 block normal-case">Ekspektasi uang fisik wajib ada</span>
            <span className="text-xl font-black text-blue-600">{formatRupiah(eodCalculation.ekspektasiLaci)}</span>
          </div>
        </div>

        {/* KANAN (7 KOLOM): SMART SWITCH (IF HQ -> ANTRIAN APPROVAL, IF BRANCH -> FORM INPUT) */}
        <div className="lg:col-span-7">
          {isHQ ? (
            /* 🔥 DISPLAY PUSAT: DAFTAR ANTREAN VALIDASI BERKAS MASUK */
            <div className="card-holo p-5 bg-white border border-slate-200 h-full overflow-hidden flex flex-col shadow-2xs">
              <h3 className="text-xs font-black text-slate-800 normal-case mb-3 flex items-center gap-1.5"><Landmark size={14} className="text-blue-600"/> Meja antrean validasi setoran cabang masuk</h3>
              <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar max-h-[350px] pr-1">
                {displayedSettlements.filter(s => s.status === 'PENDING_VALIDASI').length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-xs font-bold normal-case flex flex-col items-center justify-center h-full">
                    <CheckCircle2 size={36} className="text-emerald-500 mb-2 opacity-30"/>
                    Semua laporan kliring setoran cabang sudah rapi divalidasi, Bos!
                  </div>
                ) : (
                  displayedSettlements.filter(s => s.status === 'PENDING_VALIDASI').map(item => (
                    <div key={item.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:border-blue-300 transition-all shadow-2xs">
                      <div>
                        <div className="text-[9px] font-bold text-slate-400">{formatDate(item.date)} • ID: {item.id}</div>
                        <div className="text-xs font-black text-slate-800 uppercase mt-0.5">Asal: {item.branch_id.replace(/_/g, ' ')}</div>
                        <div className="text-lg font-black text-blue-600 my-1">{formatRupiah(item.nominal)}</div>
                        <div className="text-[10px] font-bold text-slate-500 normal-case">Jalur: <span className="text-slate-800 font-extrabold">{item.method.replace(/_/g, ' ')}</span></div>
                        <div className="text-[10px] font-medium text-slate-400 normal-case mt-1 italic">Catatan toko: "{item.notes}"</div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto shrink-0">
                        <button type="button" onClick={() => handleValidasiPusat(item, 'DI_TOLAK')} className="p-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-600 hover:text-white transition-colors cursor-pointer" title="Tolak Berkas"><XCircle size={16}/></button>
                        <button type="button" onClick={() => handleValidasiPusat(item, 'DI_SETUJUI')} className="flex-1 sm:flex-none bg-emerald-600 text-white font-black text-xs px-4 py-2.5 rounded-lg hover:bg-emerald-700 shadow-xs transition-colors normal-case cursor-pointer">Sahkan Setoran</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* 🏪 DISPLAY OUTLET: FORM INPUT SETORAN KASIR TOKO */
            <div className="card-holo p-5 bg-white border border-slate-200 shadow-2xs">
              <h3 className="text-xs font-black text-slate-800 normal-case mb-4 flex items-center gap-1.5"><ArrowDownRight size={16} className="text-blue-600"/> Lembar setoran cabang (Menunggu validasi pusat)</h3>
              <form onSubmit={handleKirimSetoran} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1">1. Hitung uang fisik riil di laci</label>
                    <input type="text" value={cashInHand ? Number(cashInHand).toLocaleString('id-ID') : ''} onChange={e=>setCashInHand(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 bg-slate-50 border rounded-lg font-bold text-xs shadow-inner" placeholder="Rp 0" />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1">2. Nominal uang disetor/transfer</label>
                    <input type="text" required value={amountSent ? Number(amountSent).toLocaleString('id-ID') : ''} onChange={e=>setAmountSent(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 bg-slate-50 border border-blue-200 rounded-lg font-black text-xs text-blue-700 focus:bg-white shadow-inner" placeholder="Rp 0" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1">Metode serah terima setoran</label>
                    <select value={method} onChange={e=>setMethod(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-lg font-bold text-xs cursor-pointer">
                      <option value="TRANSFER_BCA_PUSAT">Transfer Bank (BCA Pusat)</option>
                      <option value="TRANSFER_BRI_PUSAT">Transfer Bank (BRI Pusat)</option>
                      <option value="CASH_SETOR_LANGSUNG">Serah Fisik Tunai (Cash ke Bos)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-500 block mb-1">Catatan tambahan transaksi</label>
                    <input type="text" value={notes} onChange={e=>setNotes(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-lg text-xs" placeholder="Contoh: Titip lewat supir DO, transfer lunas..." />
                  </div>
                </div>
                <button type="submit" className="w-full bg-red-600 text-white font-bold py-3 rounded-lg text-xs hover:bg-red-700 shadow-md transition-colors normal-case cursor-pointer">
                  Kirim setoran &amp; tunggu validasi pusat
                </button>
              </form>
            </div>
          )}
        </div>

      </div>

      {/* HISTORI TRACKING KEUANGAN GLOBAL */}
      <div className="card-holo overflow-hidden bg-white border border-slate-200 shadow-2xs">
        <div className="p-4 bg-slate-50 border-b border-slate-200 font-extrabold text-xs text-slate-800">
          Histori catatan kliring berkas setoran harian
        </div>
        <div className="overflow-x-auto p-1 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="bg-slate-50/50 border-b text-[10px] text-slate-400 normal-case">
              <tr>
                <th className="px-5 py-3 font-bold">Tanggal &amp; ID</th>
                <th className="px-5 py-3 font-bold">Asal Cabang</th>
                <th className="px-5 py-3 font-bold">Metode Kirim</th>
                <th className="px-5 py-3 text-center font-bold">Nominal Disetor</th>
                <th className="px-5 py-3 text-right font-bold">Status Validasi Pusat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-bold bg-white">
              {displayedSettlements.length === 0 ? (
                <tr><td colSpan="5" className="text-center py-10 text-slate-400 font-medium normal-case">Belum ada riwayat mutasi berkas keuangan EOD.</td></tr>
              ) : (
                displayedSettlements.map((item, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4 whitespace-nowrap"><div>{formatDate(item.date)}</div><div className="text-[9px] text-slate-400 font-mono mt-0.5">{item.id}</div></td>
                    <td className="px-5 py-4 uppercase text-slate-700 whitespace-nowrap">{item.branch_id.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-4 text-slate-500 normal-case whitespace-nowrap">{item.method.replace(/_/g, ' ')}</td>
                    <td className="px-5 py-4 text-center text-blue-600 font-extrabold whitespace-nowrap">{formatRupiah(item.nominal)}</td>
                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-black normal-case border ${
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
