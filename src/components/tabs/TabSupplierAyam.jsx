import React, { useState, useMemo } from 'react';
import { Landmark, ArrowRightLeft, TrendingDown, ArrowDownToLine, Receipt, Printer, Send, Search, Calendar, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

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
    date: todayStr, amount: '', method: 'TF_BCA', notes: '' 
  });
  
  const [showInjectModal, setShowInjectModal] = useState(false);
  const [injectForm, setInjectForm] = useState({ amount: '', date: todayStr, notes: 'SALDO HUTANG MASA LALU (EXCEL)' });

  // --- SINKRONISASI DATABASE ---
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);

  // --- ALGORITMA REKENING KORAN (RUNNING BALANCE) ---
  const bukuRekeningKoran = useMemo(() => {
    let ledger = [];

    // 1. TARIK SEMUA DATA AYAM TURUN (Menambah Hutang / DEBIT)
    realPurchases.forEach(p => {
      if (p.isDeleted) return;
      // Filter khusus kategori BAHAN_BAKU atau nama supplier NANA AYAM
      if (p.category === 'BAHAN_BAKU' || String(p.supplier_name).toUpperCase().includes(CORE_SUPPLIER)) {
        ledger.push({
          id: p.id,
          date: p.date,
          type: 'TAGIHAN_MASUK',
          description: `Ayam Turun: ${p.qty_kg || p.qty} Kg (Nota: ${p.id})`,
          debit: Number(p.total_amount || 0), // Hutang Nambah
          kredit: 0,
          sortDate: new Date(p.date)
        });
      }
    });

    // 2. TARIK SEMUA DATA PEMBAYARAN & SELIPAN CICILAN (Mengurangi Hutang / KREDIT)
    realCashflow.forEach(c => {
      if (c.isDeleted || c.type !== 'OUT') return;
      // Filter pengeluaran yang berkaitan dengan pelunasan supplier ayam
      if (c.category === 'PELUNASAN HUTANG AYAM' || c.category === 'SALDO_AWAL_HUTANG_AYAM' || (c.category === 'PEMBELIAN BAHAN_BAKU' && c.description.includes(CORE_SUPPLIER))) {
        
        // Pengecualian khusus jika ini suntikan hutang awal (DEBIT)
        if (c.category === 'SALDO_AWAL_HUTANG_AYAM') {
           ledger.push({
             id: c.id, date: c.date, type: 'SALDO_AWAL',
             description: c.description,
             debit: Number(c.amount || 0), // Hutang Nambah
             kredit: 0,
             sortDate: new Date(c.date)
           });
        } else {
           ledger.push({
             id: c.id, date: c.date, type: 'PEMBAYARAN',
             description: `Bayar/Cicil (${String(c.method).replace('_', ' ')}): ${c.description}`,
             debit: 0,
             kredit: Number(c.amount || 0), // Hutang Berkurang
             sortDate: new Date(c.date)
           });
        }
      }
    });

    // 3. PROSES PENGHITUNGAN RUNNING BALANCE (SALDO BERJALAN)
    // Urutkan dari transaksi paling tua ke paling baru untuk menghitung saldo riil
    ledger.sort((a, b) => a.sortDate - b.sortDate);

    let currentBalance = 0;
    let totalAyamTurun = 0;
    let totalUangDibayar = 0;

    ledger.forEach(item => {
      currentBalance += item.debit;
      currentBalance -= item.kredit;
      item.saldoBerjalan = currentBalance;

      if (item.type === 'TAGIHAN_MASUK' || item.type === 'SALDO_AWAL') totalAyamTurun += item.debit;
      if (item.type === 'PEMBAYARAN') totalUangDibayar += item.kredit;
    });

    // Balik urutannya agar transaksi terbaru ada di paling atas tabel
    const finalLedger = [...ledger].reverse();

    return { 
      ledger: finalLedger, 
      sisaHutang: currentBalance,
      totalAyamTurun,
      totalUangDibayar
    };
  }, [realPurchases, realCashflow]);

  // --- ACTIONS: SUBMIT PEMBAYARAN (+ SELIPAN) ---
  const handleBayarCicilan = async (e) => {
    e.preventDefault();
    const nominal = Number(formBayar.amount);
    if (nominal <= 0) return alert("Nominal transfer tidak boleh kosong!");

    if (window.confirm(`Konfirmasi Transfer & Potong Saldo ${formBayar.method.replace('_', ' ')}:\n\nNominal: ${formatRupiah(nominal)}\n\nLanjutkan pembayaran ke Supplier ${CORE_SUPPLIER}?`)) {
      
      const trxId = generateId('CFO', formBayar.date);
      const payload = {
        id: trxId, date: formBayar.date, branch_id: currentBranch, type: 'OUT',
        category: 'PELUNASAN HUTANG AYAM',
        description: `Transfer Pembayaran Ayam / Cicilan Selipan: ${formBayar.notes.toUpperCase()}`,
        amount: nominal, method: formBayar.method
      };

      if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
        showToast(`Pembayaran Rp ${formatNumber(nominal)} berhasil! Sisa hutang gantung otomatis berkurang.`, 'success');
        setFormBayar({ date: todayStr, amount: '', method: 'TF_BCA', notes: '' });
      }
    }
  };

  // --- ACTIONS: SUNTIK SALDO HUTANG MASA LALU ---
  const handleInjectSaldoAwal = async (e) => {
    e.preventDefault();
    const nominal = Number(injectForm.amount);
    if (nominal <= 0) return;

    if (window.confirm(`PERINGATAN: Memasukkan Saldo Hutang Masa Lalu sebesar ${formatRupiah(nominal)}.\nData ini akan menjadi fondasi awal hutang pabrik. Lanjutkan?`)) {
      
      const payload = {
        id: generateId('LGCY', injectForm.date), date: injectForm.date, branch_id: currentBranch, type: 'OUT',
        category: 'SALDO_AWAL_HUTANG_AYAM', description: injectForm.notes.toUpperCase(),
        amount: nominal, method: 'SISTEM'
      };

      if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
        showToast('Saldo Hutang Masa Lalu berhasil disuntikkan ke sistem!', 'success');
        setShowInjectModal(false);
      }
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* BANNER UTAMA JANTUNG PABRIK */}
      <div className="bg-slate-900 rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between shadow-xl border border-slate-800 relative overflow-hidden text-white">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 w-full">
          <h2 className="text-xl md:text-3xl font-black uppercase tracking-widest text-white flex items-center gap-3">
            <ShieldAlert className="text-rose-500 animate-pulse" size={28}/> 
            BUKU JANTUNG PABRIK: SUPPLIER {CORE_SUPPLIER}
          </h2>
          <p className="text-xs font-bold text-slate-400 mt-2 uppercase tracking-widest">
            Rekening Koran Akumulasi Hutang Daging Ayam &amp; Histori Pembayaran Cicilan Lintas Waktu.
          </p>
        </div>
        <div className="relative z-10 mt-6 md:mt-0 text-left md:text-right shrink-0">
          <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest bg-rose-950/50 px-3 py-1 rounded-md border border-rose-900 inline-block mb-1.5">Grand Total Sisa Hutang Saat Ini</div>
          <div className="text-4xl md:text-5xl font-black text-white tracking-tighter">{formatRupiah(bukuRekeningKoran.sisaHutang)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORM TRANSFER PEMBAYARAN */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm border-t-4 border-t-emerald-500">
            <form onSubmit={handleBayarCicilan} className="space-y-5">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider pb-3 border-b flex items-center gap-2">
                <Send size={16} className="text-emerald-600"/> Bayar Ayam &amp; Selipan Cicilan
              </h3>

              <div>
                <label className="text-[10px] font-black text-emerald-700 uppercase block mb-1">Total Nominal Uang Transfer</label>
                <div className="relative">
                  <span className="absolute left-4 top-3.5 font-black text-emerald-500">Rp</span>
                  <input type="text" required value={formBayar.amount ? Number(formBayar.amount).toLocaleString('id-ID') : ''} onChange={e=>setFormBayar({...formBayar, amount: e.target.value.replace(/\D/g, '')})} className="w-full pl-11 pr-4 py-3 border-2 border-emerald-200 rounded-xl text-lg font-black text-emerald-900 bg-emerald-50/30 outline-none focus:bg-white focus:border-emerald-500 transition-colors" placeholder="0" />
                </div>
                <p className="text-[9px] font-bold text-slate-500 mt-2 uppercase leading-relaxed">Ket: Masukkan total transfer (Contoh: Beli ayam hari ini 38 Jt + Cicilan 5 Jt = Ketik 43.000.000).</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Tanggal TF</label>
                  <input type="date" required value={formBayar.date} onChange={e=>setFormBayar({...formBayar, date: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-black bg-slate-50 outline-none cursor-pointer focus:border-emerald-400" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Rekening Asal</label>
                  <select required value={formBayar.method} onChange={e=>setFormBayar({...formBayar, method: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-black uppercase bg-slate-50 outline-none cursor-pointer focus:border-emerald-400">
                    <option value="TF_BCA">BCA PUSAT</option>
                    <option value="TF_BRI">BRI PUSAT</option>
                    <option value="CASH">KAS TUNAI LACI</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Memo / Keterangan Transfer</label>
                <input type="text" required value={formBayar.notes} onChange={e=>setFormBayar({...formBayar, notes: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none focus:bg-white focus:border-emerald-400" placeholder="Cth: Bayar Ayam Turun + Cicil 5 Juta" />
              </div>

              <button type="submit" className="w-full text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest shadow-xl bg-slate-900 hover:bg-slate-800 transition-transform active:scale-95 flex items-center justify-center gap-2 mt-2">
                Sah! Kurangi Sisa Hutang
              </button>
            </form>
          </div>

          {/* KOTAK TOMBOL SUNTIK SALDO AWAL */}
          <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl flex flex-col justify-center items-center text-center shadow-inner">
            <AlertTriangle size={24} className="text-rose-500 mb-2"/>
            <div className="text-[10px] font-black uppercase text-rose-800 tracking-widest mb-1">Setup Hutang Legacy (Excel)</div>
            <div className="text-[9px] font-bold text-rose-600 uppercase leading-relaxed mb-3">Gunakan menu ini SATU KALI saja untuk memindahkan Sisa Tagihan Kemarin (Excel) ke dalam sistem ERP.</div>
            <button type="button" onClick={() => setShowInjectModal(true)} className="px-4 py-2 bg-rose-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md hover:bg-rose-700 transition">Input Saldo Awal</button>
          </div>
        </div>

        {/* KANTONG KANAN: TABEL REKENING KORAN */}
        <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-800 tracking-widest flex items-center gap-2">
                <Receipt size={16} className="text-blue-600"/> Buku Mutasi (Running Balance) Supplier
              </h4>
              <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-wider">Histori Ayam Turun vs Uang Dibayar (Otomatis)</p>
            </div>
            <div className="text-right">
               <div className="text-[9px] font-black text-slate-400 uppercase">Tota Ayam Turun: <span className="text-slate-700">{formatRupiah(bukuRekeningKoran.totalAyamTurun)}</span></div>
               <div className="text-[9px] font-black text-emerald-600 uppercase mt-0.5">Total Uang Dibayar: {formatRupiah(bukuRekeningKoran.totalUangDibayar)}</div>
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white border-b text-[10px] uppercase text-slate-400 sticky top-0 shadow-sm">
                <tr>
                  <th className="px-5 py-3 font-black">Tgl &amp; ID</th>
                  <th className="px-5 py-3 font-black min-w-[200px]">Deskripsi Transaksi</th>
                  <th className="px-5 py-3 text-right font-black">Tagihan (Debit)</th>
                  <th className="px-5 py-3 text-right font-black">Pembayaran (Kredit)</th>
                  <th className="px-5 py-3 text-right font-black bg-rose-50 text-rose-800">SISA HUTANG</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-xs">
                {bukuRekeningKoran.ledger.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-20 text-slate-400 uppercase font-black tracking-widest">Belum ada riwayat transaksi dengan supplier {CORE_SUPPLIER}.</td></tr>
                ) : (
                  bukuRekeningKoran.ledger.map((log, idx) => (
                    <tr key={log.id || idx} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-black">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-wider border shadow-sm mb-1.5 inline-block ${log.type === 'TAGIHAN_MASUK' ? 'bg-amber-50 text-amber-700 border-amber-200' : log.type === 'SALDO_AWAL' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                          {log.type.replace('_', ' ')}
                        </span>
                        <div className="text-slate-700 text-xs font-bold uppercase leading-relaxed">{log.description}</div>
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {log.debit > 0 ? <span className="text-amber-600 font-black">{formatRupiah(log.debit)}</span> : '-'}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {log.kredit > 0 ? <span className="text-emerald-600 font-black flex items-center justify-end gap-1"><ArrowDownToLine size={12}/> {formatRupiah(log.kredit)}</span> : '-'}
                      </td>
                      <td className="px-5 py-4 text-right whitespace-nowrap bg-rose-50/30">
                        <span className="text-rose-700 font-black text-sm tracking-tight">{formatRupiah(log.saldoBerjalan)}</span>
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
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[9999] flex justify-center items-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl border w-full max-w-md overflow-hidden flex flex-col">
             <div className="bg-rose-600 text-white px-6 py-4 flex items-center justify-between">
               <div className="flex items-center gap-2"><AlertTriangle size={18}/><h3 className="font-black text-sm uppercase tracking-wider">Setup Hutang Legacy</h3></div>
               <button onClick={() => setShowInjectModal(false)} className="hover:text-rose-200 transition"><X size={20}/></button>
             </div>
             <form onSubmit={handleInjectSaldoAwal} className="p-6 space-y-5">
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Tanggal Tercatat</label>
                 <input type="date" required value={injectForm.date} onChange={e=>setInjectForm({...injectForm, date: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-black bg-slate-50 outline-none" />
               </div>
               <div>
                 <label className="text-[10px] font-black text-rose-600 uppercase block mb-1">Total Sisa Tagihan Kemarin (Dari Excel)</label>
                 <div className="relative">
                   <span className="absolute left-4 top-3.5 font-black text-rose-400">Rp</span>
                   <input type="text" required value={injectForm.amount ? Number(injectForm.amount).toLocaleString('id-ID') : ''} onChange={e=>setInjectForm({...injectForm, amount: e.target.value.replace(/\D/g, '')})} className="w-full pl-11 pr-4 py-3 border-2 border-rose-200 rounded-xl text-lg font-black text-rose-700 bg-rose-50/50 outline-none focus:bg-white focus:border-rose-500 transition-colors" placeholder="0" />
                 </div>
               </div>
               <div>
                 <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Keterangan Referensi</label>
                 <input type="text" required value={injectForm.notes} onChange={e=>setInjectForm({...injectForm, notes: e.target.value})} className="w-full p-3 border rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none" />
               </div>
               <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-md bg-rose-600 hover:bg-rose-700 transition-transform active:scale-95">Suntik Saldo &amp; Kunci Sistem</button>
             </form>
          </div>
        </div>
      )}

    </div>
  );
}
