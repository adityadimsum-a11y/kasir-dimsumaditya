import React, { useState, useMemo } from 'react';
import { 
  Wallet, Coins, ArrowUpRight, ArrowDownRight, Safe, 
  Percent, Calendar, CheckCircle2, DollarSign, RefreshCw, AlertTriangle
} from 'lucide-react';
import { getTodayStr, generateId, formatDate, safeJsonParse } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');

export default function TabCashWarRoom({ 
  orders = [], orders_data,
  expenses = [], expenses_data,
  cashflowTransactions = [], cashflow_transactions_data,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const isHQ = user?.branch_type === 'HQ_FACTORY' || user?.branch_id === 'PUSAT';

  // --- FILTER RENTANG AUDIT OTOMATIS 14 HARI (2 MINGGU) ---
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14); // Otomatis ditarik 14 hari ke belakang (2 Minggu)
    return d.toISOString().substring(0, 10);
  });
  const [dateTo, setDateTo] = useState(todayStr);

  // --- FORM PENARIKAN CUAN 15% KE REKENING PRIBADI ---
  const [wdAmount, setWdAmount] = useState('');
  const [wdNotes, setWdNotes] = useState('');
  const [wdMethod, setWdMethod] = useState('TF_BCA_PUSAT');

  // SINKRONISASI DATABASE AMAN
  const realOrders = useMemo(() => orders_data || orders || [], [orders, orders_data]);
  const realExpenses = useMemo(() => expenses_data || expenses || [], [expenses, expenses_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflowTransactions || [], [cashflowTransactions, cashflow_transactions_data]);

  // --- KONSOLIDASI ENGINE RUNNING ALGORITHM 4 AMPLOPHOLDING ---
  const brankasHolding = useMemo(() => {
    const isInPeriod = (dStr) => {
      if (!dStr) return false;
      const c = dStr.substring(0, 10);
      return c >= dateFrom && c <= dateTo;
    };

    let totalOmsetHolding = 0;
    let totalWdTerbayar = 0;

    // Hitung total omset kotor masuk dari seluruh Indonesia yang statusnya LUNAS/DP
    realOrders.forEach(o => {
      if (!o.isDeleted && isInPeriod(o.date)) {
        totalOmsetHolding += Number(o.total_amount || 0);
      }
    });

    // Hitung berapa total cuan yang sudah benar-benar Ente tarik ke tabungan pribadi
    realCashflow.forEach(cf => {
      if (!cf.isDeleted && cf.category === 'TARIK_CUAN_PRIBADI_15' && isInPeriod(cf.date)) {
        totalWdTerbayar += Number(cf.amount || 0);
      }
    });

    // Alokasi Pembelahan Algoritma 4 Amplop Virtual Holding
    const amplopAyam55 = totalOmsetHolding * 0.55;
    const amplopOps20 = totalOmsetHolding * 0.20;
    const amplopCadangan10 = totalOmsetHolding * 0.10;
    const amplopPribadi15 = totalOmsetHolding * 0.15;

    // Sisa plafon jatah ke tabungan pribadi yang belum ditarik secara fisik
    const sisaPlafonPribadi = Math.max(0, amplopPribadi15 - totalWdTerbayar);

    return {
      totalOmsetHolding, amplopAyam55, amplopOps20, amplopCadangan10, 
      amplopPribadi15, totalWdTerbayar, sisaPlafonPribadi
    };
  }, [realOrders, realCashflow, dateFrom, dateTo]);

  // --- ACTION: EKSEKUSI MUTASI AMBIL CUAN KE REKENING PRIBADI ---
  const handleTarikCuan = async (e) => {
    e.preventDefault();
    const nominalTarik = Number(wdAmount);

    if (!isHQ) return alert("Otoritas Ditolak! Cuma Bos Besar yang bisa menarik dana amplop pribadi.");
    if (nominalTarik <= 0) return alert("Nominal penarikan tidak valid!");
    
    // Validasi preventif jika bos khilaf narik melampaui plafon kuota 15%
    if (nominalTarik > brankasHolding.sisaPlafonPribadi) {
      if (!window.confirm(`Peringatan: Nominal penarikan (${formatRupiah(nominalTarik)}) melebihi jatah 15% periode ini (${formatRupiah(brankasHolding.sisaPlafonPribadi)}).\n\nTetap lanjutkan sebagai penarikan darurat?`)) return;
    }

    if (!window.confirm(`Konfirmasi Penarikan Hak Cuan:\n\nUang sebesar ${formatRupiah(nominalTarik)} akan dikeluarkan dari kas operasional masuk ke rekening pribadi Ente.\n\nLanjutkan?`)) return;

    const cfId = generateId('CFO', todayStr);
    const payload = {
      id: cfId,
      date: todayStr,
      branch_id: 'TANGERANG_PUSAT',
      type: 'OUT',
      category: 'TARIK_CUAN_PRIBADI_15',
      description: `MUTASI CUAN 15%: Pengambilan hak profit pribadi periode ${formatDate(dateFrom)} s/d ${formatDate(dateTo)}. Memo: ${wdNotes || '-'}`,
      amount: nominalTarik,
      method: wdMethod,
      reference_id: 'BRANKAS_PRIBADI',
      isDeleted: false
    };

    if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
      showToast("Cuan berhasil bermutasi masuk tabungan pribadi Ente!", "success");
      setWdAmount(''); setWdNotes('');
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case animate-in fade-in duration-200">
      
      {/* BANNER AUDIT PERIODIK 2 MINGGUAN */}
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

      {/* MONITORING 4 AMPLOPHOLDING LIVE */}
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
        
        {/* PANEL SLIP TARIK DUIT (5 KOLOM) */}
        <div className="lg:col-span-5 card-holo p-5 bg-white border border-slate-200">
          <h3 className="text-xs font-black text-slate-800 normal-case mb-4 flex items-center gap-1.5"><Coins className="text-emerald-600"/> Tarik cuan jatah pribadi 15%</h3>
          
          <div className="mb-4 bg-emerald-50 text-emerald-800 p-3 rounded-xl border border-emerald-100 text-[10px] font-bold normal-case">
            Sisa plafon hak cuan Ente yang belum ditarik keluar dari sistem pada rentang ini: 
            <div className="text-base font-black text-emerald-700 mt-1">{formatRupiah(brankasHolding.sisaPlafonPribadi)}</div>
          </div>

          <form onSubmit={handleTarikCuan} className="space-y-4">
            <div>
              <label className="text-[9px] font-bold text-slate-500 block mb-1">Nominal uang fisik/transfer yang ditarik</label>
              <input type="text" required value={wdAmount ? Number(wdAmount).toLocaleString('id-ID') : ''} onChange={e=>setWdAmount(e.target.value.replace(/\D/g, ''))} className="w-full p-2.5 bg-slate-50 border font-black text-sm rounded-lg outline-none focus:bg-white focus:border-emerald-500" placeholder="Rp 0" />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-1">Sumber rekening asal laci</label>
                <select value={wdMethod} onChange={e=>setWdMethod(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-lg text-xs font-bold cursor-pointer">
                  <option value="TF_BCA_PUSAT">Rekening BCA Pusat</option>
                  <option value="TF_BRI_PUSAT">Rekening BRI Pusat</option>
                  <option value="CASH">Fisik Kas Tunai Pusat</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-500 block mb-1">Memo internal</label>
                <input type="text" value={wdNotes} onChange={e=>setWdNotes(e.target.value)} className="w-full p-2.5 bg-slate-50 border rounded-lg text-xs" placeholder="Misal: Masuk Rekening Bersih Pribadi" />
              </div>
            </div>

            <button type="submit" disabled={!isHQ} className="w-full bg-emerald-600 text-white font-black py-3 rounded-lg text-xs hover:bg-emerald-700 shadow-md transition-all normal-case disabled:opacity-50 cursor-pointer">
              Sahkan mutasi keluar &amp; ambil cuan pribadi
            </button>
          </form>
        </div>

        {/* PANEL AUDIT HISTORI MUTASI (7 KOLOM) */}
        <div className="lg:col-span-7 card-holo p-5 bg-white border border-slate-200 flex flex-col overflow-hidden">
          <h3 className="text-xs font-black text-slate-800 normal-case mb-3">Buku log mutasi penarikan dana pribadi bos</h3>
          <div className="flex-1 overflow-y-auto custom-scrollbar max-h-[340px] p-1">
            <div className="space-y-2">
              {realCashflow.filter(cf => !cf.isDeleted && cf.category === 'TARIK_CUAN_PRIBADI_15').length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-medium text-xs normal-case">Belum ada catatan pengambilan jatah 15% periode ini.</div>
              ) : (
                realCashflow.filter(cf => !cf.isDeleted && cf.category === 'TARIK_CUAN_PRIBADI_15').reverse().map(item => (
                  <div key={item.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center text-xs font-bold">
                    <div>
                      <div className="text-[9px] text-slate-400 font-bold">{formatDate(item.date)} • ID: {item.id}</div>
                      <div className="text-slate-600 text-[11px] font-medium mt-1 normal-case">{item.description}</div>
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
