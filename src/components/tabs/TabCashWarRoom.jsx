import React, { useState, useMemo } from 'react';
import { CalendarDays, Plus, Printer, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp. " + Number(angka || 0).toLocaleString('id-ID');

// KATEGORI TRANSAKSI KEUANGAN
const CATEGORIES = {
  INFLOW: [
    { id: 'MODAL_AWAL', label: '💰 MODAL AWAL / INJEKSI DANA' },
    { id: 'PENJUALAN_OMSET', label: '🛒 PENJUALAN / OMSET POS' },
    { id: 'LAINNYA_IN', label: '📥 PENDAPATAN LAINNYA' }
  ],
  OUTFLOW: [
    { id: 'BAHAN_BAKU', label: '🛒 BELI BAHAN BAKU (AYAM, TEPUNG, DLL)' },
    { id: 'LOGISTIK', label: '🚚 BIAYA LOGISTIK (BENSIN, TOL, KURIR)' },
    { id: 'MAINTENANCE', label: '⚙️ MAINTENANCE & PERBAIKAN ALAT' },
    { id: 'UTILITAS', label: '💡 UTILITAS (LISTRIK, AIR, GAS)' },
    { id: 'PACKAGING', label: '📦 KEMASAN (MIKA, PLASTIK, LAKBAN)' },
    { id: 'OPERATIONAL_EXPENSE', label: '👥 BIAYA SDM & OPERASIONAL LAINNYA' }
  ]
};

export default function TabCashWarRoom({ 
  cashflowTransactions = [], cashflow_transactions, 
  masterBranches = [], master_branches,
  sendToSheet, showToast, user 
}) {
  const todayStr = getTodayStr();
  const currentBranch = user?.branch_id || 'PUSAT';
  const isHQ = user?.branch_type === 'HQ_FACTORY' || currentBranch === 'PUSAT';

  const realCashflow = cashflow_transactions || cashflowTransactions || [];
  const realMasterBranches = master_branches || masterBranches || [];

  const [activeBranchFilter, setActiveBranchFilter] = useState(isHQ ? 'SEMUA_CABANG' : currentBranch);
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState(new Set());
  const [isEditing, setIsEditing] = useState(false);

  const [form, setForm] = useState({
    id: '', date: todayStr, branchId: currentBranch, 
    type: 'OUTFLOW', category: 'BAHAN_BAKU', 
    amount: '', paymentMethod: 'CASH', notes: ''
  });

  const daftarCabangId = useMemo(() => {
    return realMasterBranches.filter(b => b && !b.isDeleted && b.branch_id).map(b => b.branch_id);
  }, [realMasterBranches]);

  // FILTER & URUTKAN TRANSAKSI
  const filteredLog = useMemo(() => {
    return realCashflow.filter(c => {
      if (!c || c.isDeleted || optimisticDeletedIds.has(c.id)) return false;
      if (activeBranchFilter !== 'SEMUA_CABANG' && c.branch_id !== activeBranchFilter) return false;
      return true;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realCashflow, activeBranchFilter, optimisticDeletedIds]);

  // KALKULATOR SALDO REAL-TIME
  const metrikKas = useMemo(() => {
    let saldoCash = 0; let saldoTf = 0;
    let inBulanIni = 0; let outBulanIni = 0;
    const curMonth = todayStr.substring(0, 7);

    filteredLog.forEach(c => {
      const isThisMonth = c.date && c.date.startsWith(curMonth);
      const nominal = Number(c.amount || 0);

      if (c.transaction_type === 'INFLOW') {
        if (c.payment_method === 'CASH') saldoCash += nominal;
        else saldoTf += nominal;
        if (isThisMonth) inBulanIni += nominal;
      } 
      else if (c.transaction_type === 'OUTFLOW') {
        if (c.payment_method === 'CASH') saldoCash -= nominal;
        else saldoTf -= nominal;
        if (isThisMonth) outBulanIni += nominal;
      }
    });

    return { saldoCash, saldoTf, totalSaldo: saldoCash + saldoTf, inBulanIni, outBulanIni };
  }, [filteredLog, todayStr]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.amount) <= 0) return alert("Nominal harus lebih dari Rp 0!");

    const trxId = isEditing ? form.id : generateId(form.type === 'INFLOW' ? 'CFI' : 'CFO', form.date);
    
    const payload = {
      id: trxId,
      date: form.date,
      branch_id: form.branchId,
      transaction_type: form.type,
      category: form.category,
      amount: Number(form.amount),
      payment_method: form.paymentMethod,
      reference_id: '-',
      description: form.notes.toUpperCase()
    };

    let success = false;
    if (isEditing) { success = await sendToSheet('update', payload, 'cashflow_transactions'); } 
    else { success = await sendToSheet('insert', payload, 'cashflow_transactions'); }

    if (success) {
      if (showToast) showToast(isEditing ? 'Transaksi Kas diupdate!' : 'Transaksi Kas berhasil dicatat!', 'success');
      setForm({ id: '', date: todayStr, branchId: currentBranch, type: 'OUTFLOW', category: 'BAHAN_BAKU', amount: '', paymentMethod: 'CASH', notes: '' });
      setIsEditing(false);
    }
  };

  const handleEdit = (log) => {
    setForm({
      id: log.id, date: log.date.split('T')[0], branchId: log.branch_id || currentBranch,
      type: log.transaction_type || 'OUTFLOW', category: log.category || '',
      amount: String(log.amount || 0), paymentMethod: log.payment_method || 'CASH', notes: log.description || ''
    });
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id) => {
    if(window.confirm("AWAS! Menghapus data ini akan merubah Total Saldo Laci Kasir. Yakin ingin membatalkan?")) {
      setOptimisticDeletedIds(prev => new Set(prev).add(id));
      const success = await sendToSheet('delete', { id }, 'cashflow_transactions');
      if(success) { if(showToast) showToast('Transaksi Kas divoid.', 'success'); } 
      else { setOptimisticDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n; }); }
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in pb-10">
      
      {/* 📊 RADAR KEUANGAN & SALDO */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-950 p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden text-white md:col-span-2">
          <div className="absolute -right-4 -bottom-6 text-emerald-500 opacity-20 text-[120px]">💰</div>
          <div className="relative z-10 flex justify-between items-start">
            <div>
              <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">💵 UANG TUNAI LACI (CASH)</div>
              <div className="text-3xl font-black mt-1">{formatRupiah(metrikKas.saldoCash)}</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest justify-end">💳 SALDO BANK (TF)</div>
              <div className="text-xl font-black mt-1">{formatRupiah(metrikKas.saldoTf)}</div>
            </div>
          </div>
          <div className="relative z-10 mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-400 font-bold">
            Total Aset Likuid: <span className="text-white">{formatRupiah(metrikKas.totalSaldo)}</span> (Modal + Omset - Pengeluaran)
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-emerald-500 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-6 text-emerald-50 opacity-50 text-[100px]">📈</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Total Uang Masuk Bulan Ini</div>
          <div className="text-xl font-black text-emerald-600 mt-1 relative z-10">{formatRupiah(metrikKas.inBulanIni)}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border shadow-sm border-l-4 border-l-rose-500 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-6 text-rose-50 opacity-50 text-[100px]">📉</div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">Total Uang Keluar Bulan Ini</div>
          <div className="text-xl font-black text-rose-600 mt-1 relative z-10">{formatRupiah(metrikKas.outBulanIni)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 📝 FORM INPUT BUKU KAS (MANUAL) */}
        <div className={`p-6 rounded-2xl border border-t-4 transition-all h-max shadow-sm ${isEditing ? 'bg-amber-50/50 border-t-amber-500 border-amber-200' : 'bg-white border-t-blue-600'}`}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-black text-sm uppercase text-slate-800 flex items-center gap-2">
                💳 {isEditing ? 'Revisi Transaksi Kas' : 'Input Transaksi Manual'}
              </h3>
            </div>

            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
              <button type="button" onClick={() => setForm({...form, type: 'INFLOW', category: 'MODAL_AWAL'})} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${form.type === 'INFLOW' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-500'}`}>📈 Pemasukan</button>
              <button type="button" onClick={() => setForm({...form, type: 'OUTFLOW', category: 'BAHAN_BAKU'})} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1 ${form.type === 'OUTFLOW' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-500'}`}>📉 Pengeluaran</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tanggal</label><input type="date" required value={form.date} onChange={e=>setForm({...form, date: e.target.value})} className="w-full p-2.5 mt-1 border rounded-xl text-xs font-bold outline-none bg-slate-50" /></div>
              {isHQ && (
                <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">🏢 Cabang Trx</label><select value={form.branchId} onChange={e=>setForm({...form, branchId: e.target.value})} className="w-full p-2.5 mt-1 border rounded-xl text-xs font-black uppercase outline-none bg-slate-50 cursor-pointer">
                  {daftarCabangId.map(b => <option key={b} value={b}>{b}</option>)}
                </select></div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Kategori Dana</label>
              <select required value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full p-3 mt-1 border border-slate-300 rounded-xl font-black text-[11px] uppercase outline-none bg-white shadow-sm cursor-pointer">
                {(form.type === 'INFLOW' ? CATEGORIES.INFLOW : CATEGORIES.OUTFLOW).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Metode</label>
                <select value={form.paymentMethod} onChange={e=>setForm({...form, paymentMethod: e.target.value})} className="w-full p-3 mt-1 border border-slate-300 rounded-xl font-black text-xs bg-white outline-none">
                  <option value="CASH">CASH</option>
                  <option value="TF">TRANSFER</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nominal (Rp)</label>
                <input type="text" required value={formatRupiah(form.amount)} onChange={e=>setForm({...form, amount: e.target.value.replace(/\D/g, '')})} className={`w-full p-3 mt-1 border-2 rounded-xl font-black text-lg outline-none text-right ${form.type === 'INFLOW' ? 'border-emerald-300 text-emerald-700 focus:border-emerald-500 bg-emerald-50' : 'border-rose-300 text-rose-700 focus:border-rose-500 bg-rose-50'}`} placeholder="Rp 0" />
              </div>
            </div>

            <div><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Deskripsi (Laporan)</label><input type="text" required value={form.notes} onChange={e=>setForm({...form, notes: e.target.value})} placeholder="Contoh: Beli Bensin..." className="w-full p-2.5 mt-1 border rounded-xl text-xs uppercase outline-none bg-slate-50" /></div>
            
            <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 ${isEditing ? 'bg-amber-500 hover:bg-amber-600' : 'bg-blue-600 hover:bg-blue-700'}`}>
              <Plus size={16}/> {isEditing ? 'Simpan Revisi' : 'Catat ke Buku Kas'}
            </button>
          </form>
        </div>
        
        {/* 📚 TABEL ARSIP BUKU KAS (CONSOLIDATION) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest flex items-center gap-2"><CalendarDays size={14} className="text-blue-600"/> Buku Jurnal Arus Kas</h4>
            {isHQ && (
              <select value={activeBranchFilter} onChange={e => setActiveBranchFilter(e.target.value)} className="text-[10px] font-black uppercase bg-white border rounded-lg px-2 py-1 outline-none text-slate-600 cursor-pointer shadow-sm">
                <option value="SEMUA_CABANG">🌍 KONSOLIDASI NASIONAL</option>
                {daftarCabangId.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
          </div>
          <div className="overflow-x-auto flex-1 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-400 border-b border-slate-200">
                <tr><th className="px-4 py-3 whitespace-nowrap">Tgl &amp; TRX ID</th><th className="px-4 py-3 whitespace-nowrap">Kategori / Deskripsi</th><th className="px-4 py-3 whitespace-nowrap text-center">Metode</th><th className="px-4 py-3 whitespace-nowrap text-right">Mutasi Saldo</th><th className="px-4 py-3 whitespace-nowrap text-center">Aksi</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-bold">
                {filteredLog.map(log => {
                  const isInflow = log.transaction_type === 'INFLOW';
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-slate-800">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="uppercase text-slate-700 font-black">{log.category?.replace(/_/g, ' ')}</div>
                        <div className="text-[9px] text-slate-500 mt-0.5 line-clamp-1">{log.description}</div>
                        {activeBranchFilter === 'SEMUA_CABANG' && <div className="text-[8px] font-black text-indigo-500 mt-1 uppercase">LOK: {log.branch_id}</div>}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <span className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase border ${log.payment_method === 'CASH' ? 'bg-slate-100 text-slate-700 border-slate-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>{log.payment_method}</span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className={`font-black text-sm flex items-center justify-end gap-1 ${isInflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isInflow ? '+' : '-'}{formatRupiah(log.amount)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isInflow && (
                            <button type="button" onClick={() => {
                              triggerPrint('NOTA_DOTMATRIX', {
                                title: 'VOUCHER PENGELUARAN KAS', id: log.id, date: formatDate(log.date), periode: '-',
                                branch_name: log.branch_id, admin_name: user?.name || 'KASIR', customer_name: 'DANA OPERASIONAL', position: '-',
                                items: [{ name: log.description || log.category, qty: 1, subtotal: log.amount }],
                                amount: log.amount, paymentMethod: `POTONG ${log.payment_method === 'CASH' ? 'LACI TUNAI' : 'SALDO BANK'}`
                              });
                            }} className="p-1.5 text-white bg-slate-800 hover:bg-slate-900 shadow rounded-lg" title="Cetak Voucher OPEX"><Printer size={12}/></button>
                          )}
                          {isHQ && (
                            <>
                              {!log.reference_id || log.reference_id === '-' ? (
                                <button type="button" onClick={() => handleEdit(log)} className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg"><Edit2 size={12}/></button>
                              ) : null}
                              <button type="button" onClick={() => handleDelete(log.id)} className="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg"><Trash2 size={12}/></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredLog.length === 0 && (
                  <tr><td colSpan="5" className="px-4 py-12 text-center text-slate-400 font-black uppercase tracking-widest bg-slate-50/50"><AlertTriangle size={24} className="mx-auto mb-2 opacity-50"/>Buku Kas Kosong</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
