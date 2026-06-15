import React, { useState, useMemo } from 'react';
import { 
  Wallet, Coins, ArrowUpRight, ArrowDownRight, Safe, 
  Percent, Calendar, CheckCircle2, DollarSign, RefreshCw, AlertTriangle, Printer, Landmark
} from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabCashWarRoom({ 
  orders = [], 
  expenses = [], 
  cashflow_transactions = [], // 🔥 FIX MUTLAK: Variabel disamakan persis dengan key database GAS
  sendToSheet, setPrintData, showToast, user 
}) {
  const todayStr = getTodayStr();
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT';

  // --- FILTER PERIODE EVALUASI KEUANGAN ---
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().substring(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayStr);

  // --- STATE ALOKASI PENARIKAN DANA GABUNGAN (SPLIT-MIX METHOD) ---
  const [cashAmount, setCashAmount] = useState('');
  const [tfAmount, setTfAmount] = useState('');
  const [tfBankMethod, setTfBankMethod] = useState('TF_BCA_PUSAT');
  const [wdNotes, setWdNotes] = useState('');

  // --- 🔥 SINKRONISASI SINGLE SOURCE OF TRUTH ---
  const realOrders = useMemo(() => orders || [], [orders]);
  const realCashflow = useMemo(() => cashflow_transactions || [], [cashflow_transactions]);

  // Kalkulasi live total nominal gabungan split input
  const totalWdInput = useMemo(() => {
    return Number(cashAmount || 0) + Number(tfAmount || 0);
  }, [cashAmount, tfAmount]);

  // --- ENGINE 1: KALKULASI LIQUIDITAS BANK LIVE (CASH, BCA, BRI) ---
  const liquiditas = useMemo(() => {
    let bca = 0, bri = 0, cash = 0;
    
    realCashflow.forEach(cf => {
      if (cf.isDeleted) return;
      const amt = Number(cf.amount || 0);
      const type = String(cf.type || '').toUpperCase();
      const method = String(cf.method || cf.payment_method || '').toUpperCase();
      
      // Jika type OUT (Keluar), nominal dikali -1 (mengurangi saldo)
      const sign = type === 'OUT' ? -1 : 1;

      if (method.includes('BCA')) bca += (amt * sign);
      else if (method.includes('BRI')) bri += (amt * sign);
      else if (method.includes('CASH') || method.includes('TUNAI')) cash += (amt * sign);
    });

    return { bca, bri, cash, totalGabungan: bca + bri + cash };
  }, [realCashflow]);

  // --- ENGINE 2: ALGORITMA ALOKASI 4 AMPLOP KOMPULSIF HOLDING ---
  const brankasHolding = useMemo(() => {
    const isInPeriod = (dStr) => {
      if (!dStr) return false;
      const c = dStr.substring(0, 10);
      return c >= dateFrom && c <= dateTo;
    };

    let totalOmsetHolding = 0;
    let totalWdTerbayar = 0;

    // 1. Akumulasi omset masuk
    realOrders.forEach(o => {
      if (!o.isDeleted && isInPeriod(o.date)) {
        totalOmsetHolding += Number(o.total_amount || 0);
      }
    });

    // 2. Akumulasi penarikan dividen jatah pribadi yang sudah sah ter-record
    realCashflow.forEach(cf => {
      if (!cf.isDeleted && isInPeriod(cf.date)) {
        const catUpper = String(cf.category || '').toUpperCase();
        const descUpper = String(cf.description || '').toUpperCase();
        if (catUpper === 'TARIK_CUAN_PRIBADI_15' || catUpper.includes('PRIBADI') || descUpper.includes('MUTASI CUAN 15%')) {
          totalWdTerbayar += Number(cf.amount || 0);
        }
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

  // --- TRANSAKSI PENARIKAN DANA MIX METHOD & PRINT NOTA ---
  const handleTarikCuan = async (e) => {
    e.preventDefault();
    const finalAmount = totalWdInput;

    if (!isHQ) return alert("Otoritas ditolak. Hanya akun manajemen pusat yang memiliki hak penarikan jatah dividen harian.");
    if (finalAmount <= 0) return alert("Nominal pencairan via tunai laci atau transfer bank tidak boleh kosong!");
    
    if (finalAmount > brankasHolding.sisaPlafonPribadi) {
      if (!window.confirm(`Perhatian: Total penarikan gabungan (${formatRupiah(finalAmount)}) melebihi jatah plafon berjalan (${formatRupiah(brankasHolding.sisaPlafonPribadi)}).\n\nTetap lanjutkan penarikan darurat?`)) return;
    }

    const confirmMessage = `Konfirmasi Pemindahan Dana Hak Pribadi:\n\n` +
      `- Penarikan Tunai Laci: ${formatRupiah(cashAmount)}\n` +
      `- Penarikan Transfer Bank: ${formatRupiah(tfAmount)} (${tfBankMethod.replace(/_/g, ' ')})\n` +
      `------------------------------------------ +\n` +
      `Total Mutasi Dana: ${formatRupiah(finalAmount)}\n\n` +
      `Sistem akan memotong kas perusahaan dan menerbitkan struk fisik otomatis. Lanjutkan?`;

    if (!window.confirm(confirmMessage)) return;

    const cfId = generateId('CFO', todayStr);
    const splitMethodLabel = Number(cashAmount || 0) > 0 && Number(tfAmount || 0) > 0 
      ? `MIX (CASH & ${tfBankMethod.replace('TF_', '')})` 
      : Number(cashAmount || 0) > 0 ? 'CASH' : tfBankMethod;

    const payload = {
      id: cfId,
      date: todayStr,
      branch_id: 'TANGERANG_PUSAT',
      type: 'OUT',
      category: 'TARIK_CUAN_PRIBADI_15',
      description: `Mutasi Cuan 15% [${splitMethodLabel}]: Penarikan profit periode ${formatDate(dateFrom)} s/d ${formatDate(dateTo)}. Rincian -> Tunai Laci: ${formatRupiah(cashAmount)}, Bank: ${formatRupiah(tfAmount)}. Catatan: ${wdNotes || 'Tanpa keterangan tambahan'}`,
      amount: finalAmount,
      method: splitMethodLabel,
      reference_id: 'BRANKAS_PRIBADI',
      isDeleted: false
    };

    if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
      showToast("Mutasi dana berhasil diproses dan terekam di ledger server!", "success");

      if (typeof setPrintData === 'function') {
        setPrintData({
          title: 'DOKUMEN PENARIKAN PROFIT BERSIH OWNER (15%)',
          id: cfId,
          date: formatDate(todayStr),
          branch_name: 'TANGERANG PUSAT (HQ)',
          admin_name: user?.name || 'Direksi Pusat',
          customer_name: 'ADITYA (OWNER)',
          items: [
            { name: 'Alokasi Dana Profit (Tunai Laci)', qty: Number(cashAmount || 0) > 0 ? 1 : 0, subtotal: Number(cashAmount || 0) },
            { name: `Alokasi Dana Profit (${tfBankMethod.replace(/_/g, ' ')})`, qty: Number(tfAmount || 0) > 0 ? 1 : 0, subtotal: Number(tfAmount || 0) }
          ].filter(item => item.subtotal > 0),
          amount: finalAmount,
          paymentMethod: splitMethodLabel.replace(/_/g, ' '),
          history: {
            labelLama: 'Plafon Alokasi Awal', nominalLama: brankasHolding.amplopPribadi15 + finalAmount,
            labelAksi: 'Total Diambil (Split-Mix)', nominalAksi: finalAmount,
            labelBaru: 'Sisa Plafon Berjalan', nominalBaru: Math.max(0, brankasHolding.sisaPlafonPribadi - finalAmount)
          }
        });
      }

      setCashAmount(''); setTfAmount(''); setWdNotes('');
    }
  };

  const filteredLogs = useMemo(() => {
    const isInPeriod = (dStr) => {
      if (!dStr) return false;
      const c = dStr.substring(0, 10);
      return c >= dateFrom && c <= dateTo;
    };

    return realCashflow.filter(cf => {
      if (cf.isDeleted || !isInPeriod(cf.date)) return false;
      const catUpper = String(cf.category || '').toUpperCase();
      const descUpper = String(cf.description || '').toUpperCase();
      return catUpper === 'TARIK_CUAN_PRIBADI_15' || catUpper.includes('PRIBADI') || descUpper.includes('MUTASI CUAN 15%');
    }).reverse();
  }, [realCashflow, dateFrom, dateTo]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* ========================================================= */}
      {/* 🚀 NEW: PANEL LIQUIDITAS KAS & BANK TERKINI (ALL TIME) */}
      {/* ========================================================= */}
      <div className="card-holo p-5 bg-white border border-slate-200 shadow-2xs">
        <div className="flex items-center gap-2 mb-4 border-b border-slate-100 pb-3">
          <Landmark className="text-blue-600" size={18} />
          <h2 className="text-sm font-black text-slate-800 normal-case">Liquiditas Kas &amp; Bank Holding (Live)</h2>
          <span className="ml-auto text-[9px] font-bold text-slate-400 normal-case bg-slate-100 px-2 py-1 rounded-md">Total Kas Aktif: {formatRupiah(liquiditas.totalGabungan)}</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 text-center">
          <div className="py-2 px-4 hover:bg-slate-50 transition-colors rounded-l-xl">
            <span className="text-[10px] font-black text-slate-400 block mb-1">SALDO BANK BCA</span>
            <div className={`text-xl font-black tracking-tight ${liquiditas.bca < 0 ? 'text-red-500' : 'text-blue-700'}`}>{formatRupiah(liquiditas.bca)}</div>
          </div>
          <div className="py-2 px-4 hover:bg-slate-50 transition-colors">
            <span className="text-[10px] font-black text-slate-400 block mb-1">SALDO BANK BRI</span>
            <div className={`text-xl font-black tracking-tight ${liquiditas.bri < 0 ? 'text-red-500' : 'text-indigo-700'}`}>{formatRupiah(liquiditas.bri)}</div>
          </div>
          <div className="py-2 px-4 hover:bg-slate-50 transition-colors rounded-r-xl">
            <span className="text-[10px] font-black text-slate-400 block mb-1">UANG FISIK (TUNAI LACI)</span>
            <div className={`text-xl font-black tracking-tight ${liquiditas.cash < 0 ? 'text-red-500' : 'text-emerald-700'}`}>{formatRupiah(liquiditas.cash)}</div>
          </div>
        </div>
      </div>

      {/* CONTROL BANNER - PROFESSIONAL LOOK */}
      <div className="card-holo p-5 bg-white border flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-2xs">
        <div>
          <h2 className="text-sm font-black text-slate-800 normal-case flex items-center gap-2">
            <Percent className="text-red-600" size={18} /> Ruang Kendali Distribusi Brankas 4 Amplop Holding
          </h2>
          <p className="text-[10px] font-bold text-slate-400 normal-case mt-0.5">
            Perhitungan real-time alokasi keuangan nasional berdasarkan penyerapan omset kotor lunas seluruh cabang.
          </p>
        </div>
        
        <div className="flex items-center gap-2 bg-slate-50 border px-3 py-1.5 rounded-xl shadow-inner">
          <span className="text-[10px] font-black text-slate-400 normal-case">Rentang Evaluasi:</span>
          <input type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
          <span className="text-slate-300 mx-1">-</span>
          <input type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)} className="text-xs font-bold text-slate-700 outline-none bg-transparent cursor-pointer" />
        </div>
      </div>

      {/* METRIK KANBAN 4 AMPLOPHOLDING */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-[9px] font-black text-slate-400 block mb-1">AMPLOP 1: ALOKASI KAS AYAM (55%)</span>
          <div className="text-lg font-black text-slate-800">{formatRupiah(brankasHolding.amplopAyam55)}</div>
          <p className="text-[8px] text-slate-400 font-medium mt-1">Anggaran khusus pembelanjaan daging suplier.</p>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-[9px] font-black text-slate-400 block mb-1">AMPLOP 2: OPERASIONAL &amp; payroll (20%)</span>
          <div className="text-lg font-black text-blue-600">{formatRupiah(brankasHolding.amplopOps20)}</div>
          <p className="text-[8px] text-slate-400 font-medium mt-1">Biaya mika packing, logistik, saus, dan upah tim.</p>
        </div>
        <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-2xs">
          <span className="text-[9px] font-black text-slate-400 block mb-1">AMPLOP 3: DANA CADANGAN HOLDING (10%)</span>
          <div className="text-lg font-black text-amber-600">{formatRupiah(brankasHolding.amplopCadangan10)}</div>
          <p className="text-[8px] text-slate-400 font-medium mt-1">Proteksi kedaruratan perbaikan aset/mesin freezer.</p>
        </div>
        <div className="bg-slate-900 border border-slate-950 p-4 rounded-2xl shadow-sm text-white">
          <span className="text-[9px] font-black text-slate-400 block mb-1 tracking-wider">AMPLOP 4: TABUNGAN PRIBADI OWNER (15%)</span>
          <div className="text-xl font-black text-emerald-400 tracking-tight">{formatRupiah(brankasHolding.amplopPribadi15)}</div>
          <div className="text-[9px] text-slate-300 font-semibold mt-1">Total akumulasi pencairan fisik: {formatRupiah(brankasHolding.totalWdTerbayar)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* SLIP PENARIKAN (5 KOLOM) */}
        <div className="lg:col-span-5 card-holo p-5 bg-white border border-slate-200 shadow-2xs">
          <h3 className="text-xs font-black text-slate-800 normal-case mb-4 flex items-center gap-1.5"><Coins className="text-emerald-600"/> Nota Penarikan Profit owner (Support Split-Mix)</h3>
          
          <div className="mb-4 bg-emerald-50 text-emerald-800 p-3 rounded-xl border border-emerald-100 text-[10px] font-bold normal-case">
            Sisa batas limit penarikan hak 15% berjalan untuk periode ini: 
            <div className="text-base font-black text-emerald-700 mt-1">{formatRupiah(brankasHolding.sisaPlafonPribadi)}</div>
          </div>

          <form onSubmit={handleTarikCuan} className="space-y-4">
            
            <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-inner">
              <div>
                <label className="text-[9px] font-bold text-slate-600 block mb-1">Pencairan via Tunai Laci</label>
                <input type="text" value={cashAmount ? Number(cashAmount).toLocaleString('id-ID') : ''} onChange={e=>setCashAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 bg-white border font-bold text-xs rounded-lg outline-none focus:border-emerald-500 shadow-3xs" placeholder="Rp 0" />
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-600 block mb-1">Pencairan via Transfer</label>
                <input type="text" value={tfAmount ? Number(tfAmount).toLocaleString('id-ID') : ''} onChange={e=>setTfAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 bg-white border font-bold text-xs rounded-lg outline-none focus:border-emerald-500 shadow-3xs" placeholder="Rp 0" />
              </div>
            </div>

            <div className="bg-slate-100 px-4 py-2.5 rounded-lg flex justify-between items-center text-xs font-black">
              <span className="text-slate-500 normal-case">Jumlah Gabungan Dana yang Bermutasi:</span>
              <span className="text-blue-600 text-sm font-black">{formatRupiah(totalWdInput)}</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-1">Tujuan Rekening Bank</label>
                <select value={tfBankMethod} onChange={e=>setTfBankMethod(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-lg text-xs font-bold cursor-pointer">
                  <option value="TF_BCA_PUSAT">Rekening BCA Pusat</option>
                  <option value="TF_BRI_PUSAT">Rekening BRI Pusat</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-1">Keterangan Internal</label>
                <input type="text" value={wdNotes} onChange={e=>setWdNotes(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-lg text-xs" placeholder="Contoh: Masuk Brankas Tabungan Mandiri" />
              </div>
            </div>

            <button type="submit" disabled={!isHQ} className="w-full bg-emerald-600 text-white font-black py-3.5 rounded-lg text-xs hover:bg-emerald-700 shadow-md transition-all normal-case disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
              <Printer size={14}/> Sahkan Mutasi Kas &amp; Cetak Dokumen Struk
            </button>
          </form>
        </div>

        {/* LOG RIWAYAT MUTASI SEBELAH KANAN (7 KOLOM) */}
        <div className="lg:col-span-7 card-holo p-5 bg-white border border-slate-200 flex flex-col overflow-hidden shadow-2xs">
          <h3 className="text-xs font-black text-slate-800 normal-case mb-3">Histori Log Transaksi Rekam Jejak Penarikan Dividen Owner</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[360px] p-1">
            <div className="space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-16 text-slate-400 font-bold text-xs normal-case h-full flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  Belum terdeteksi adanya riwayat mutasi penarikan jatah 15% pada rentang tanggal terpilih.
                </div>
              ) : (
                filteredLogs.map(item => (
                  <div key={item.id} className="bg-slate-50 p-3.5 border border-slate-200 rounded-xl flex justify-between items-center text-xs font-bold shadow-3xs hover:border-emerald-300 transition-colors group">
                    <div className="pr-2">
                      <div className="text-[9px] text-slate-400 font-bold">{formatDate(item.date)} • Kode Dokumen: {item.id}</div>
                      <div className="text-slate-600 text-[10px] font-bold mt-1 normal-case leading-relaxed">{item.description}</div>
                    </div>
                    <div className="text-red-600 text-sm font-black whitespace-nowrap pl-2 shrink-0">
                      -{formatRupiah(item.amount)}
                    </div>
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
