import React, { useState, useMemo } from 'react';
import { 
  Wallet, Coins, ArrowUpRight, ArrowDownRight, Safe, 
  Percent, Calendar, CheckCircle2, DollarSign, RefreshCw, AlertTriangle, Printer
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabCashWarRoom({ 
  orders = [], orders_data,
  expenses = [], expenses_data,
  cashflowTransactions = [], cashflow_transactions_data,
  sendToSheet, setPrintData, showToast, user 
}) {
  const todayStr = getTodayStr();
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT';

  // --- FILTER RENTANG AUDIT OTOMATIS 14 HARI (2 MINGGU) ---
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().substring(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayStr);

  // --- STATE SPLIT PAYMENT PENARIKAN MIX METHOD ---
  const [cashAmount, setCashAmount] = useState('');
  const [tfAmount, setTfAmount] = useState('');
  const [tfBankMethod, setTfBankMethod] = useState('TF_BCA_PUSAT');
  const [wdNotes, setWdNotes] = useState('');

  // SINKRONISASI DATABASE AMAN
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflowTransactions || [], [cashflowTransactions, cashflow_transactions_data]);

  // Hitung live total gabungan split input
  const totalWdInput = useMemo(() => {
    return Number(cashAmount || 0) + Number(tfAmount || 0);
  }, [cashAmount, tfAmount]);

  // --- KONSOLIDASI ENGINE RUNNING ALGORITHM 4 AMPLOPHOLDING ---
  const brankasHolding = useMemo(() => {
    const isInPeriod = (dStr) => {
      if (!dStr) return false;
      const c = dStr.substring(0, 10);
      return c >= dateFrom && c <= dateTo;
    };

    let totalOmsetHolding = 0;
    let totalWdTerbayar = 0;

    realOrders.forEach(o => {
      if (!o.isDeleted && isInPeriod(o.date)) {
        totalOmsetHolding += Number(o.total_amount || 0);
      }
    });

    realCashflow.forEach(cf => {
      if (!cf.isDeleted && cf.category === 'TARIK_CUAN_PRIBADI_15' && isInPeriod(cf.date)) {
        totalWdTerbayar += Number(cf.amount || 0);
      }
    });

    const amplopAyam55 = totalOmsetHolding * 0.55;
    const amplopOps20 = totalOmsetHolding * 0.20;
    const amplopCadangan10 = totalOmsetHolding * 0.10;
    const amplopPribadi15 = totalOmsetHolding * 0.15;
    const sisaPlafonPribadi = Math.max(0, amplopPribadi15 - totalWdTerbayar);

    return {
      totalOmsetHolding, amplopAyam55, amplopOps20, amplopCadangan10, 
      amplopPribadi15, totalWdTerbayar, sisaPlafonPribadi
    };
  }, [realOrders, realCashflow, dateFrom, dateTo]);

  // --- ACTION: EKSEKUSI MUTASI MIX METHOD & AUTO PRINT NOTA ---
  const handleTarikCuan = async (e) => {
    e.preventDefault();
    const finalAmount = totalWdInput;

    if (!isHQ) return alert("Otoritas Ditolak! Cuma Bos Besar yang bisa menarik dana amplop pribadi.");
    if (finalAmount <= 0) return alert("Nominal penarikan cash atau transfer tidak boleh kosong!");
    
    if (finalAmount > brankasHolding.sisaPlafonPribadi) {
      if (!window.confirm(`Peringatan: Total mix penarikan (${formatRupiah(finalAmount)}) melebihi jatah jatah 15% periode ini (${formatRupiah(brankasHolding.sisaPlafonPribadi)}).\n\nTetap lanjutkan sebagai penarikan darurat?`)) return;
    }

    const confirmMessage = `Konfirmasi Pemindahan Dana Hak Pribadi:\n\n` +
      `- Ambil Tunai Laci: ${formatRupiah(cashAmount)}\n` +
      `- Ambil Transfer Bank: ${formatRupiah(tfAmount)} (${tfBankMethod.replace(/_/g, ' ')})\n` +
      `------------------------------------------ +\n` +
      `Total Bermutasi: ${formatRupiah(finalAmount)}\n\n` +
      `Sistem akan memotong kas operasional dan menyiapkan struk cetak nota bukti fisik. Lanjutkan?`;

    if (!window.confirm(confirmMessage)) return;

    const cfId = generateId('CFO', todayStr);
    
    // Satukan informasi metode pembayaran mix ke dalam deskripsi sheet database
    const splitMethodLabel = Number(cashAmount || 0) > 0 && Number(tfAmount || 0) > 0 
      ? `MIX (CASH & ${tfBankMethod.replace('TF_', '')})` 
      : Number(cashAmount || 0) > 0 ? 'CASH' : tfBankMethod;

    const payload = {
      id: cfId,
      date: todayStr,
      branch_id: 'TANGERANG_PUSAT',
      type: 'OUT',
      category: 'TARIK_CUAN_PRIBADI_15',
      description: `MUTASI CUAN 15% [${splitMethodLabel}]: Penarikan profit periode ${formatDate(dateFrom)} s/d ${formatDate(dateTo)}. Rincian -> Tunai Laci: ${formatRupiah(cashAmount)}, Bank: ${formatRupiah(tfAmount)}. Memo: ${wdNotes || '-'}`,
      amount: finalAmount,
      method: splitMethodLabel,
      reference_id: 'BRANKAS_PRIBADI',
      isDeleted: false
    };

    if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
      showToast("Cuan mix berhasil diproses dan dicatat!", "success");

      // 🔥 AUTO TRIGGER CETAK NOTA STRUK STRUKTURAL UNTUK PRINTER BOS SULTAN
      if (typeof setPrintData === 'function') {
        setPrintData({
          title: 'NOTA PENARIKAN PROFIT PRIBADI HOLDING (15%)',
          id: cfId,
          date: formatDate(todayStr),
          branch_name: 'TANGERANG PUSAT (HQ)',
          admin_name: user?.name || 'Bos Sultan',
          customer_name: 'ADITYA (OWNER)',
          items: [
            { name: 'Alokasi Hak Cuan 15% (Cash Laci)', qty: Number(cashAmount || 0) > 0 ? 1 : 0, subtotal: Number(cashAmount || 0) },
            { name: `Alokasi Hak Cuan 15% (${tfBankMethod.replace(/_/g, ' ')})`, qty: Number(tfAmount || 0) > 0 ? 1 : 0, subtotal: Number(tfAmount || 0) }
          ].filter(item => item.subtotal > 0),
          amount: finalAmount,
          paymentMethod: splitMethodLabel.replace(/_/g, ' '),
          history: {
            labelLama: 'Plafon Jatah Periode Ini', nominalLama: brankasHolding.amplopPribadi15 + finalAmount,
            labelAksi: 'Total Diambil Fisik (Mix)', nominalAksi: finalAmount,
            labelBaru: 'Sisa Plafon Berjalan', nominalBaru: Math.max(0, brankasHolding.sisaPlafonPribadi - finalAmount)
          }
        });
      }

      // Reset Form Inputs
      setCashAmount('');
      setTfAmount('');
      setWdNotes('');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* CONTROL PANEL */}
      <div className="card-holo p-5 bg-white border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-2xs">
        <div>
          <h2 className="text-sm font-black text-slate-800 normal-case flex items-center gap-2">
            <Percent className="text-red-600" size={18} /> War Room Brankas 4 Amplop Holding
          </h2>
          <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5">
            Evaluasi otomatis sirkulasi dana gabungan seluruh Indonesia per rentang waktu 2 mingguan.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 border px-3 py-1.5 rounded-xl shadow-inner">
          <span className="text-[10px] font-black text-slate-400 normal-case">Rentang Evaluasi:</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
          <span className="text-slate-300 mx-1">-</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
        </div>
      </div>

      {/* MONITOR 4 AMPLOPHOLDING LIVE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-[9px] font-black text-slate-400 block mb-1">AMPLOP 1: KAS AYAM (55%)</span>
          <div className="text-lg font-black text-slate-800">{formatRupiah(brankasHolding.amplopAyam55)}</div>
          <p className="text-[8px] text-slate-400 font-medium mt-1">Uang belanja suplier daging esok hari.</p>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-[9px] font-black text-slate-400 block mb-1">AMPLOP 2: OPS &amp; GAJI (20%)</span>
          <div className="text-lg font-black text-blue-600">{formatRupiah(brankasHolding.amplopOps20)}</div>
          <p className="text-[8px] text-slate-400 font-medium mt-1">Alokasi operasional mika &amp; payroll staff.</p>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-[9px] font-black text-slate-400 block mb-1">AMPLOP 3: CADANGAN (10%)</span>
          <div className="text-lg font-black text-amber-600">{formatRupiah(brankasHolding.amplopCadangan10)}</div>
          <p className="text-[8px] text-slate-400 font-medium mt-1">Tabungan emergency kulkas/mesin holding.</p>
        </div>
        <div className="bg-slate-900 border border-slate-950 p-4 rounded-2xl shadow-sm text-white">
          <span className="text-[9px] font-black text-slate-400 block mb-1 tracking-wider">AMPLOP 4: TABUNGAN PRIBADI (15%)</span>
          <div className="text-xl font-black text-emerald-400 tracking-tight">{formatRupiah(brankasHolding.amplopPribadi15)}</div>
          <div className="text-[9px] text-slate-300 font-semibold mt-1">Total ditarik fisik: {formatRupiah(brankasHolding.totalWdTerbayar)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PANEL SLIP AMBIL CUAN MIX UPGRADEABLE (5 KOLOM) */}
        <div className="lg:col-span-5 card-holo p-5 bg-white border border-slate-200 shadow-2xs">
          <h3 className="text-xs font-black text-slate-800 normal-case mb-4 flex items-center gap-1.5"><Coins className="text-emerald-600"/> Tarik cuan jatah pribadi (Bisa split mix)</h3>
          
          <div className="mb-4 bg-emerald-50 text-emerald-800 p-3 rounded-xl border border-emerald-100 text-[10px] font-bold normal-case">
            Sisa jatah jatah 15% yang belum Ente tarik keluar dari sistem pada rentang ini: 
            <div className="text-base font-black text-emerald-700 mt-1">{formatRupiah(brankasHolding.sisaPlafonPribadi)}</div>
          </div>

          <form onSubmit={handleTarikCuan} className="space-y-4">
            
            {/* INPUT PECAHAN MIX PAYMENT */}
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
              <div>
                <label className="text-[9px] font-bold text-slate-600 block mb-1">Ambil via tunai laci (Cash)</label>
                <input type="text" value={cashAmount ? Number(cashAmount).toLocaleString('id-ID') : ''} onChange={e=>setCashAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 bg-white border font-bold text-xs rounded-lg outline-none focus:border-emerald-500" placeholder="Rp 0" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-600 block mb-1">Ambil via bank (Transfer)</label>
                <input type="text" value={tfAmount ? Number(tfAmount).toLocaleString('id-ID') : ''} onChange={e=>setTfAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 bg-white border font-bold text-xs rounded-lg outline-none focus:border-emerald-500" placeholder="Rp 0" />
              </div>
            </div>

            <div className="bg-slate-100 px-4 py-2 rounded-lg flex justify-between items-center text-xs font-black">
              <span className="text-slate-500 normal-case">Total gabungan mix yang ditarik:</span>
              <span className="text-blue-600 text-sm font-black">{formatRupiah(totalWdInput)}</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-1">Pilihan rekening bank transfer</label>
                <select value={tfBankMethod} onChange={e=>setTfBankMethod(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-lg text-xs font-bold cursor-pointer">
                  <option value="TF_BCA_PUSAT">Rekening BCA Pusat</option>
                  <option value="TF_BRI_PUSAT">Rekening BRI Pusat</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-1">Memo internal penarikan</label>
                <input type="text" value={wdNotes} onChange={e=>setWdNotes(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-lg text-xs" placeholder="Ketik catatan khusus..." />
              </div>
            </div>

            <button type="submit" disabled={!isHQ} className="w-full bg-emerald-600 text-white font-black py-3.5 rounded-lg text-xs hover:bg-emerald-700 shadow-md transition-all normal-case disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
              <Printer size={14}/> Sahkan mutasi &amp; cetak struk nota fisik
            </button>
          </form>
        </div>

        {/* PANEL AUDIT HISTORI MUTASI (7 KOLOM) */}
        <div className="lg:col-span-7 card-holo p-5 bg-white border border-slate-200 flex flex-col overflow-hidden shadow-2xs">
          <h3 className="text-xs font-black text-slate-800 normal-case mb-3">Buku log mutasi penarikan dana pribadi bos</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[360px] p-1">
            <div className="space-y-2">
              {realCashflow.filter(cf => !cf.isDeleted && cf.category === 'TARIK_CUAN_PRIBADI_15').length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium text-xs normal-case">Belum ada catatan pengambilan jatah 15% pada rentang ini.</div>
              ) : (
                realCashflow.filter(cf => !cf.isDeleted && cf.category === 'TARIK_CUAN_PRIBADI_15').reverse().map(item => (
                  <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold shadow-3xs">
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold">{formatDate(item.date)} • ID: {item.id}</div>
                      <div className="text-slate-600 text-[10px] font-semibold mt-1 normal-case">{item.description}</div>
                    </div>
                    <div className="text-red-600 text-sm font-black whitespace-nowrap pl-2">-{formatRupiah(item.amount)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
