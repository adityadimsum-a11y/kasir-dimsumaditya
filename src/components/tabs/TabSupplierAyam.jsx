import React, { useState, useMemo } from 'react';
// 🔥 FIX CRASH: IKON 'X' SUDAH DITAMBAHKAN DI SINI
import { Landmark, ArrowDownToLine, Receipt, Send, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabSupplierAyam({ 
  purchases = [], purchases_data, cashflow_transactions = [], cashflow_transactions_data,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // Nama Supplier Patokan Jantung Pabrik
  const CORE_SUPPLIER = 'NANA AYAM';

  const [formBayar, setFormBayar] = useState({ 
    date: todayStr, method: 'TF_BCA_PUSAT', notes: '' 
  });
  
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [injectForm, setInjectForm] = useState({ date: todayStr, notes: 'Saldo hutang masa lalu (Excel)' });

  // 🔥 FIX: STATE RAW INPUT UNTUK MENCEGAH KURSOR LOMPAT
  const [rawBayarAmount, setRawBayarAmount] = useState('');
  const [displayBayarAmount, setDisplayBayarAmount] = useState('');
  const [rawInjectAmount, setRawInjectAmount] = useState('');
  const [displayInjectAmount, setDisplayInjectAmount] = useState('');

  const handleBayarAmountChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setRawBayarAmount(val);
    setDisplayBayarAmount(val ? Number(val).toLocaleString('id-ID') : '');
  };

  const handleInjectAmountChange = (e) => {
    const val = e.target.value.replace(/\D/g, '');
    setRawInjectAmount(val);
    setDisplayInjectAmount(val ? Number(val).toLocaleString('id-ID') : '');
  };

  // --- SINKRONISASI DATABASE ---
  const realOrders = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  // --- ALGORITMA REKENING KORAN (RUNNING BALANCE) ---
  const bukuRekeningKoran = useMemo(() => {
    let ledger = [];

    // 1. TARIK SEMUA DATA AYAM TURUN (Menambah Hutang / DEBIT)
    realOrders.forEach(p => {
      if (p.isDeleted) return;
      if (p.category === 'BAHAN_BAKU' || String(p.supplier_name).toUpperCase().includes(CORE_SUPPLIER)) {
        ledger.push({
          id: p.id,
          date: p.date,
          type: 'Tagihan Masuk',
          description: `Ayam turun: ${p.qty_kg || p.qty} Kg (Nota: ${p.id})`,
          debit: Number(p.total_amount || 0), 
          kredit: 0,
          sortDate: new Date(p.date)
        });
      }
    });

    // 2. TARIK SEMUA DATA PEMBAYARAN & SELIPAN CICILAN (Mengurangi Hutang / KREDIT)
    realCashflow.forEach(c => {
      if (c.isDeleted || c.type !== 'OUT') return;
      if (c.category === 'PELUNASAN HUTANG AYAM' || c.category === 'SALDO_AWAL_HUTANG_AYAM' || (c.category === 'PEMBELIAN BAHAN_BAKU' && c.description.includes(CORE_SUPPLIER))) {
        
        if (c.category === 'SALDO_AWAL_HUTANG_AYAM') {
           ledger.push({
             id: c.id, date: c.date, type: 'Saldo Awal',
             description: c.description,
             debit: Number(c.amount || 0), 
             kredit: 0,
             sortDate: new Date(c.date)
           });
        } else {
           ledger.push({
             id: c.id, date: c.date, type: 'Pembayaran',
             description: `Bayar / Cicil (${String(c.method).replace(/_/g, ' ').toLowerCase()}): ${c.description}`,
             debit: 0,
             kredit: Number(c.amount || 0), 
             sortDate: new Date(c.date)
           });
        }
      }
    });

    // 3. PROSES PENGHITUNGAN RUNNING BALANCE
    ledger.sort((a, b) => a.sortDate - b.sortDate);

    let currentBalance = 0;
    let totalAyamTurun = 0;
    let totalUangDibayar = 0;

    ledger.forEach(item => {
      currentBalance += item.debit;
      currentBalance -= item.kredit;
      item.saldoBerjalan = currentBalance;

      if (item.type === 'Tagihan Masuk' || item.type === 'Saldo Awal') totalAyamTurun += item.debit;
      if (item.type === 'Pembayaran') totalUangDibayar += item.kredit;
    });

    const finalLedger = [...ledger].reverse();

    return { 
      ledger: finalLedger, 
      sisaHutang: currentBalance,
      totalAyamTurun,
      totalUangDibayar
    };
  }, [realOrders, realCashflow]);

  // --- ACTIONS: SUBMIT PEMBAYARAN ---
  const handleBayarCicilan = async (e) => {
    e.preventDefault();
    const nominal = Number(rawBayarAmount);
    if (nominal <= 0) return alert("Nominal transfer tidak boleh kosong!");

    if (window.confirm(`Konfirmasi Transfer & Potong Saldo ${formBayar.method.replace(/_/g, ' ')}:\n\nNominal: ${formatRupiah(nominal)}\n\nLanjutkan pembayaran ke Supplier ${CORE_SUPPLIER}?`)) {
      
      const trxId = generateId('CFO', formBayar.date);
      const payload = {
        id: trxId, date: formBayar.date, branch_id: currentBranch, type: 'OUT',
        category: 'PELUNASAN HUTANG AYAM',
        description: `Transfer pembayaran ayam / cicilan selipan: ${formBayar.notes}`,
        amount: nominal, method: formBayar.method, isDeleted: false
      };

      if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
        showToast(`Pembayaran Rp ${formatNumber(nominal)} berhasil! Sisa hutang otomatis berkurang.`, 'success');
        setFormBayar({ date: todayStr, method: 'TF_BCA_PUSAT', notes: '' });
        setRawBayarAmount(''); setDisplayBayarAmount('');
      }
    }
  };

  // --- ACTIONS: SUNTIK SALDO HUTANG MASA LALU ---
  const handleInjectSaldoAwal = async (e) => {
    e.preventDefault();
    const nominal = Number(rawInjectAmount);
    if (nominal <= 0) return alert("Nominal hutang tidak valid!");

    if (window.confirm(`PERINGATAN: Memasukkan Saldo Hutang Masa Lalu sebesar ${formatRupiah(nominal)}.\nData ini akan menjadi fondasi awal hutang pabrik. Lanjutkan?`)) {
      
      const payload = {
        id: generateId('LGCY', injectForm.date), date: injectForm.date, branch_id: currentBranch, type: 'OUT',
        category: 'SALDO_AWAL_HUTANG_AYAM', description: injectForm.notes,
        amount: nominal, method: 'SISTEM', isDeleted: false
      };

      if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
        showToast('Saldo Hutang Masa Lalu berhasil disuntikkan ke sistem!', 'success');
        setShowInjectModal(false);
        setRawInjectAmount(''); setDisplayInjectAmount('');
      }
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 animate-in fade-in duration-300">
      
      {/* 🚀 BANNER UTAMA JANTUNG PABRIK - FLUID GRADIENT STYLE */}
      <div className="bg-gradient-to-r from-red-900 via-rose-900 to-red-950 p-6 lg:p-8 flex flex-col md:flex-row items-start md:items-center justify-between relative overflow-hidden rounded-3xl shadow-xl border border-red-800">
        <div className="absolute -top-32 -left-32 w-72 h-72 bg-red-600/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-32 -right-32 w-72 h-72 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 w-full md:w-1/2">
          <h2 className="text-white text-xl lg:text-2xl font-black uppercase tracking-tight flex items-center gap-3 mb-2">
            <ShieldAlert className="text-red-400" size={28}/> 
            Buku Hutang {CORE_SUPPLIER}
          </h2>
          <p className="text-[11px] font-bold text-slate-300 leading-relaxed normal-case max-w-sm">
            Rekening koran akumulasi hutang khusus daging ayam &amp; histori pembayaran cicilan lintas waktu (Running Balance).
          </p>
        </div>
        
        <div className="relative z-10 mt-6 md:mt-0 w-full md:w-auto bg-slate-900/60 border border-slate-700/50 p-5 rounded-2xl shadow-inner backdrop-blur-sm shrink-0">
          <div className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">Sisa Hutang Berjalan Aktif</div>
          <div className="text-3xl lg:text-4xl font-black text-white tracking-tighter">{formatRupiah(bukuRekeningKoran.sisaHutang)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM TRANSFER PEMBAYARAN */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-red-600 overflow-hidden">
            <form onSubmit={handleBayarCicilan} className="space-y-5">
              <h3 className="font-black text-slate-800 uppercase tracking-wider text-xs pb-3 border-b border-slate-100 flex items-center gap-2">
                <Send size={16} className="text-red-600"/> Bayar Ayam &amp; Selipan Cicilan
              </h3>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 shadow-inner">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Total Nominal Uang Transfer</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">Rp</span>
                  <input 
                    type="text" 
                    required 
                    value={displayBayarAmount} 
                    onChange={handleBayarAmountChange} 
                    className="w-full pl-12 pr-4 py-3.5 border-2 border-red-100 rounded-xl font-black text-xl text-red-700 bg-white focus:bg-white focus:border-red-500 outline-none transition-colors shadow-sm" 
                    placeholder="0" 
                  />
                </div>
                <p className="text-[9px] font-bold text-slate-400 mt-2 leading-relaxed normal-case">Ket: Masukkan total transfer harian sekaligus cicilan ke Nana Ayam.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Transfer</label>
                  <input type="date" required value={formBayar.date} onChange={e=>setFormBayar({...formBayar, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none cursor-pointer focus:border-red-500 focus:bg-white shadow-sm transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Rekening Asal Dompet</label>
                  <select required value={formBayar.method} onChange={e=>setFormBayar({...formBayar, method: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase tracking-wider bg-slate-50 outline-none cursor-pointer focus:border-red-500 focus:bg-white shadow-sm transition-colors">
                    <option value="TF_BCA_PUSAT">BCA Pusat</option>
                    <option value="TF_BRI_PUSAT">BRI Pusat</option>
                    <option value="CASH">Kas Tunai Laci</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Memo / Keterangan Transfer</label>
                <input type="text" required value={formBayar.notes} onChange={e=>setFormBayar({...formBayar, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 outline-none focus:bg-white focus:border-red-500 shadow-sm transition-colors normal-case" placeholder="Cth: Bayar ayam turun + cicil selipan" />
              </div>

              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl text-xs font-black uppercase tracking-widest shadow-md transition-transform active:scale-95 flex items-center justify-center gap-2 cursor-pointer mt-2">
                Sahkan &amp; Kurangi Sisa Hutang
              </button>
            </form>
          </div>

          {/* SUNTIK SALDO AWAL MASA LALU */}
          <div className="bg-red-50/50 border border-red-100 p-6 rounded-3xl flex flex-col justify-center items-center text-center shadow-sm">
            <AlertTriangle size={24} className="text-red-500 mb-2"/>
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-800 mb-1">Setup Hutang Legacy (Excel)</div>
            <div className="text-[10px] font-bold text-slate-500 leading-relaxed mb-4 normal-case max-w-[200px]">Pindahkan sisa tumpukan tagihan kemarin (Excel lama) ke dalam sistem ERP. Cukup input sekali saja untuk fondasi.</div>
            <button type="button" onClick={() => setShowInjectModal(true)} className="w-full py-2.5 bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-900 transition-colors shadow-md cursor-pointer">
              Input Saldo Awal Legacy
            </button>
          </div>
        </div>

        {/* KANTONG KANAN: TABEL REKENING KORAN */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden h-[75vh]">
          <div className="p-6 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
            <div>
              <h4 className="font-black text-sm uppercase tracking-wide text-slate-800 flex items-center gap-2">
                <Receipt size={18} className="text-red-600"/> Buku Mutasi (Running Balance) Supplier
              </h4>
              <p className="text-[10px] text-slate-500 font-bold mt-1 normal-case">Histori kronologis ayam turun (Hutang) vs Uang masuk (Pelunasan).</p>
            </div>
            <div className="bg-white border border-slate-200 p-3 rounded-xl shadow-sm text-right shrink-0 w-full sm:w-auto flex flex-col sm:items-end">
               <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Ayam Turun: <span className="text-slate-700 font-black">{formatRupiah(bukuRekeningKoran.totalAyamTurun)}</span></div>
               <div className="text-[9px] font-black text-emerald-600 uppercase tracking-wider mt-1">Total Uang Dibayar: {formatRupiah(bukuRekeningKoran.totalUangDibayar)}</div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50/50 border-b border-slate-100 text-[10px] uppercase tracking-wider text-slate-500 sticky top-0 shadow-sm z-10">
                <tr>
                  <th className="px-5 py-4 font-black">Tgl &amp; ID Laporan</th>
                  <th className="px-5 py-4 font-black min-w-[220px]">Deskripsi Riwayat Transaksi</th>
                  <th className="px-5 py-4 text-right font-black">Tagihan (Debit)</th>
                  <th className="px-5 py-4 text-right font-black">Pembayaran (Kredit)</th>
                  <th className="px-5 py-4 text-right font-black bg-red-50/50 text-red-800">Sisa Hutang Berjalan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs bg-white">
                {bukuRekeningKoran.ledger.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-24 text-slate-400 normal-case font-bold">
                       <div className="flex justify-center mb-3 opacity-20"><ShieldAlert size={40}/></div>
                       Belum ada riwayat transaksi dengan supplier {CORE_SUPPLIER}.
                    </td>
                  </tr>
                ) : (
                  bukuRekeningKoran.ledger.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-red-50/20 transition-colors bg-white">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black">{formatDate(log.date)}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-1">{log.id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider border mb-2 inline-block shadow-sm ${log.type === 'Tagihan Masuk' ? 'bg-amber-50 text-amber-700 border-amber-200' : log.type === 'Saldo Awal' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {log.type}
                        </span>
                        <div className="text-slate-700 text-xs font-bold normal-case leading-relaxed">{log.description}</div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {log.debit > 0 ? <span className="text-slate-800 font-black text-sm">{formatRupiah(log.debit)}</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {log.kredit > 0 ? <span className="text-emerald-600 font-black text-sm flex items-center justify-end gap-1"><ArrowDownToLine size={12}/> {formatRupiah(log.kredit)}</span> : <span className="text-slate-300">-</span>}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap bg-red-50/30">
                        <span className="text-red-600 font-black text-base tracking-tight">{formatRupiah(log.saldoBerjalan)}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* POP-UP MODAL INJECT SALDO AWAL MASA LALU */}
      {showInjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-[2px] z-[9999] flex justify-center items-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden flex flex-col">
             
             <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-2">
                 <AlertTriangle size={18} className="text-red-500"/>
                 <h3 className="font-black text-xs uppercase tracking-wider">Setup Hutang Legacy</h3>
               </div>
               <button onClick={() => setShowInjectModal(false)} className="text-slate-400 hover:text-white transition cursor-pointer"><X size={20}/></button>
             </div>
             
             <form onSubmit={handleInjectSaldoAwal} className="p-6 space-y-5 bg-slate-50">
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Tercatat (Excel)</label>
                 <input type="date" required value={injectForm.date} onChange={e=>setInjectForm({...injectForm, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:border-red-500 shadow-sm cursor-pointer" />
               </div>
               
               <div className="bg-white p-4 border border-slate-200 rounded-2xl shadow-inner">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-2">Total Sisa Tagihan Kemarin</label>
                 <div className="relative">
                   <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-red-400 text-base">Rp</span>
                   <input 
                     type="text" 
                     required 
                     value={displayInjectAmount} 
                     onChange={handleInjectAmountChange} 
                     className="w-full pl-12 pr-4 py-3 border-2 border-red-200 rounded-xl text-xl font-black text-red-600 bg-red-50/50 outline-none focus:bg-white focus:border-red-500 transition-colors shadow-inner" 
                     placeholder="0" 
                   />
                 </div>
               </div>
               
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Keterangan Referensi</label>
                 <input type="text" required value={injectForm.notes} onChange={e=>setInjectForm({...injectForm, notes: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold bg-white outline-none focus:border-red-500 shadow-sm normal-case" placeholder="Contoh: Sisa hutang buku bulan lalu..." />
               </div>
               
               <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-transform active:scale-95 cursor-pointer mt-2">
                 Suntik Saldo &amp; Kunci Sistem
               </button>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}
