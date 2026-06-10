import React, { useState, useMemo } from 'react';
import { ShoppingBag, Truck, Edit2, Trash2, CalendarDays, Plus, Wallet, FileText, CheckCircle2, ArrowUpRight, ArrowDownToLine, X, Printer } from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabPurchases({ 
  purchases = [], purchases_data, cashflow_transactions = [], cashflow_transactions_data,
  masterSuppliers = [], master_suppliers, sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;
  
  const [isEditing, setIsEditing] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);

  // Form untuk Belanja Supplier Utama (Ayam, Tepung, dll)
  const [form, setForm] = useState({
    id: '', date: todayStr, supplierName: '', category: 'BAHAN_BAKU', itemName: '', 
    qty: '', qtyKg: '', unitPrice: '', paymentMethod: 'CASH', amountPaid: '', notes: ''
  });

  // Form untuk Kas Manual (Operasional Lain/Suntikan Dana)
  const [manualForm, setManualForm] = useState({
    date: todayStr, type: 'OUT', category: 'BIAYA OPERASIONAL', description: '', amount: '', method: 'CASH'
  });

  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);
  const suppliers = useMemo(() => master_suppliers || masterSuppliers || [], [master_suppliers, masterSuppliers]);

  // Gabungkan semua pengeluaran/pemasukan di tab ini
  const combinedHistory = useMemo(() => {
    let history = [];
    realPurchases.filter(p => !p.isDeleted && (p.branch_id === currentBranch || p.branch_id === 'PUSAT')).forEach(p => {
      history.push({ ...p, isManual: false, displayDate: new Date(p.date) });
    });
    realCashflow.filter(c => !c.isDeleted && (c.branch_id === currentBranch || c.branch_id === 'PUSAT')).forEach(c => {
      history.push({ ...c, isManual: true, displayDate: new Date(c.date) });
    });
    return history.sort((a, b) => b.displayDate - a.displayDate);
  }, [realPurchases, realCashflow, currentBranch]);

  const perhitungan = useMemo(() => {
    const qty = Number(form.qty || 0);
    const price = Number(form.unitPrice || 0);
    const total = qty * price;
    return { totalTagihan: total, dibayar: form.paymentMethod === 'HUTANG' ? Number(form.amountPaid || 0) : total };
  }, [form]);

  // --- SUBMIT BELANJA SUPPLIER ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (Number(form.qty) <= 0) return alert("Qty harus lebih dari 0!");
    const trxId = isEditing ? form.id : generateId('PO', form.date);
    const payload = {
      id: trxId, date: form.date, branch_id: currentBranch, supplier_name: form.supplierName.toUpperCase(), 
      category: form.category, item_name: form.itemName.toUpperCase(), qty: Number(form.qty), qty_kg: Number(form.qtyKg || 0),
      unit_price: Number(form.unitPrice), total_amount: perhitungan.totalTagihan, payment_method: form.paymentMethod, 
      amount_paid: perhitungan.dibayar, status: form.paymentMethod === 'HUTANG' ? 'BELUM_LUNAS' : 'LUNAS', notes: form.notes.toUpperCase()
    };
    if (await sendToSheet(isEditing ? 'update' : 'insert', payload, 'purchases')) {
      showToast('Data belanja logistik disimpan!', 'success');
      setIsEditing(false); setForm({ id: '', date: todayStr, supplierName: '', category: 'BAHAN_BAKU', itemName: '', qty: '', qtyKg: '', unitPrice: '', paymentMethod: 'CASH', amountPaid: '', notes: '' });
    }
  };

  // --- SUBMIT KAS MANUAL ---
  const handleSaveManual = async (e) => {
    e.preventDefault();
    if(Number(manualForm.amount) <= 0) return alert("Nominal harus lebih dari 0!");
    const trxId = generateId('CSH', manualForm.date);
    const payload = { ...manualForm, id: trxId, branch_id: currentBranch, amount: Number(manualForm.amount) };
    if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
      showToast('Mutasi kas berhasil dicatat!', 'success');
      setShowManualModal(false);
      setManualForm({ date: todayStr, type: 'OUT', category: 'BIAYA OPERASIONAL', description: '', amount: '', method: 'CASH' });
      if(window.confirm("Cetak Bukti Kas ini?")) handlePrintKas(payload);
    }
  };

  const handlePrintKas = (trx) => {
    triggerPrint('NOTA_DOTMATRIX', {
      title: trx.type === 'IN' ? 'BUKTI KAS MASUK' : 'BUKTI KAS KELUAR', id: trx.id, date: formatDate(trx.date), 
      branch_name: trx.branch_id || currentBranch, admin_name: user?.name || 'ADMIN', customer_name: 'INTERNAL KAS',
      items: [{ name: `${trx.category}\n${trx.description}`, qty: 1, subtotal: trx.amount }], amount: trx.amount, paymentMethod: trx.method || 'CASH'
    });
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* HEADER PAGE */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2"><ShoppingBag className="text-emerald-500"/> Belanja & Operasional</h2>
          <p className="text-xs font-bold text-slate-500 mt-1">Pusat pencatatan belanja supplier dan kas keluar/masuk pabrik.</p>
        </div>
        <button onClick={() => setShowManualModal(true)} className="bg-slate-900 text-white font-black text-xs uppercase tracking-widest px-5 py-3.5 rounded-2xl shadow-md hover:bg-slate-800 transition-colors flex items-center gap-2">
          <Wallet size={16} className="text-blue-400"/> + Catat Kas Manual Lainnya
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KIRI: FORM BELANJA SUPPLIER */}
        <div className={`p-6 rounded-3xl border shadow-sm transition-colors ${isEditing ? 'bg-amber-50/50 border-amber-300' : 'bg-white border-slate-200'}`}>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="flex justify-between items-center pb-4 mb-2 border-b border-slate-100">
              <h3 className={`font-black text-sm uppercase flex items-center gap-2 ${isEditing ? 'text-amber-700' : 'text-slate-800'}`}>
                {isEditing ? <Edit2 size={18}/> : <Truck size={18} className="text-blue-500"/>} 
                {isEditing ? 'Revisi Belanja' : 'Input Belanja Supplier'}
              </h3>
              {isEditing && (
                <button type="button" onClick={() => setIsEditing(false)} className="text-[10px] border border-amber-200 px-3 py-1.5 rounded-lg font-black uppercase text-amber-700 bg-white shadow-sm flex items-center gap-1 hover:bg-amber-50">Batalkan</button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nama Supplier</label>
                <input type="text" required list="supplier-list" value={form.supplierName} onChange={e=>setForm({...form, supplierName: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none focus:border-blue-400" placeholder="Cth: NANA AYAM" />
                <datalist id="supplier-list">{suppliers.map(s => <option key={s.id} value={s.supplier_name}/>)}</datalist>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Kategori</label>
                <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black bg-slate-50 outline-none cursor-pointer">
                  <option value="BAHAN_BAKU">Bahan Baku (Ayam)</option>
                  <option value="PACKAGING">Packaging (Mika)</option>
                  <option value="BUMBU">Bumbu Dapur</option>
                  <option value="ASET">Aset Mesin/Alat</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nama Barang / Deskripsi</label>
              <input type="text" required value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold uppercase bg-slate-50 outline-none focus:border-blue-400" placeholder="Ayam Giling Kualitas A" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Kuantitas Pembelian</label>
                <input type="number" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-base font-black text-center bg-slate-50 outline-none focus:border-blue-400" placeholder="0" />
              </div>
              {form.category === 'BAHAN_BAKU' && (
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Konversi (KG)</label>
                  <input type="number" value={form.qtyKg} onChange={e=>setForm({...form, qtyKg: e.target.value})} className="w-full p-3 border border-blue-200 rounded-xl text-base font-black text-center text-blue-700 bg-blue-50 outline-none" placeholder="0 KG" />
                </div>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Harga Satuan</label>
              <input type="number" required value={form.unitPrice} onChange={e=>setForm({...form, unitPrice: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-black bg-slate-50 outline-none focus:border-blue-400" placeholder="Rp 0" />
            </div>

            <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Tagihan Supplier</span>
                <span className="text-3xl font-black text-white">{formatRupiah(perhitungan.totalTagihan)}</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] font-black text-slate-500 tracking-widest uppercase">Status Bayar</label>
                <div className="flex gap-1 bg-slate-200/70 p-1 rounded-lg">
                  {['CASH', 'TF', 'HUTANG'].map(m => <button key={m} type="button" onClick={() => setForm({...form, paymentMethod: m})} className={`px-3 py-1.5 rounded-md text-[10px] font-black transition-colors ${form.paymentMethod === m ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:bg-slate-300/50'}`}>{m === 'HUTANG' ? 'TEMPO' : m}</button>)}
                </div>
              </div>
              {form.paymentMethod === 'HUTANG' && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1.5">Uang Muka (Bila Ada)</label>
                  <input type="number" value={form.amountPaid} onChange={e=>setForm({...form, amountPaid: e.target.value})} className="w-full p-3 border border-rose-200 rounded-xl text-base font-black text-rose-700 bg-white outline-none" placeholder="0" />
                </div>
              )}
            </div>

            <button type="submit" className={`w-full text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest shadow-lg transition-transform hover:scale-[1.02] active:scale-95 ${isEditing ? 'bg-amber-500' : 'bg-blue-600'}`}>
              {isEditing ? 'Simpan Revisi' : 'Simpan Transaksi'}
            </button>
          </form>
        </div>

        {/* KANAN: TABEL RIWAYAT SEMUA OPERASIONAL */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest">Riwayat Belanja & Operasional</h4>
          </div>
          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase text-slate-400 bg-white">
                <tr><th className="px-4 py-3 font-black">Tanggal & ID</th><th className="px-4 py-3 font-black">Deskripsi Mutasi</th><th className="px-4 py-3 font-black text-right">Nominal</th><th className="px-4 py-3 font-black text-center">Status/Metode</th><th className="px-4 py-3 font-black text-center">Aksi</th></tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {combinedHistory.slice(0, 50).map(log => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-slate-800 font-bold">{formatDate(log.date)}</div>
                        <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-black text-slate-800 uppercase text-xs mb-1">
                          {log.isManual ? log.description : `${log.item_name} (${log.qty})`}
                        </div>
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${log.isManual ? (log.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600') : 'bg-blue-50 text-blue-600'}`}>
                          {log.isManual ? log.category : `SUPPLIER: ${log.supplier_name}`}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        {log.isManual && log.type === 'IN' ? (
                          <div className="text-emerald-600 font-black flex items-center justify-end gap-1"><ArrowDownToLine size={12}/> {formatRupiah(log.amount)}</div>
                        ) : (
                          <div className="text-rose-600 font-black flex items-center justify-end gap-1"><ArrowUpRight size={12}/> {formatRupiah(log.total_amount || log.amount)}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                         {!log.isManual && log.status === 'BELUM_LUNAS' ? 
                          <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-1 rounded-md">HUTANG TEMPO</span> : 
                          <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded-md">{log.payment_method || log.method}</span>
                        }
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap opacity-50 group-hover:opacity-100 transition-opacity">
                        <div className="flex items-center justify-center gap-2">
                          {log.isManual && <button type="button" onClick={() => handlePrintKas(log)} className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg"><Printer size={16}/></button>}
                          {!log.isManual && <button type="button" onClick={() => { setForm({id: log.id, date: log.date.split('T')[0], supplierName: log.supplier_name||'', category: log.category||'BAHAN_BAKU', itemName: log.item_name||'', qty: log.qty||'', qtyKg: log.qty_kg||'', unitPrice: log.unit_price||'', paymentMethod: log.payment_method||'CASH', amountPaid: log.amount_paid||'', notes: log.notes||''}); setIsEditing(true); }} className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg"><Edit2 size={14}/></button>}
                          <button type="button" onClick={() => { if(window.confirm("Hapus data ini?")) requestDelete(log.id); }} className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL KAS MANUAL (Desain Baru) */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-[9999] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="p-5 bg-slate-900 text-white flex justify-between items-center">
              <h3 className="font-black flex items-center gap-2 uppercase tracking-widest text-xs"><FileText size={16} className="text-blue-400"/> Form Catat Kas Manual</h3>
              <button onClick={() => setShowManualModal(false)} className="hover:bg-slate-800 p-1.5 rounded-lg"><X size={20}/></button>
            </div>
            <form onSubmit={handleSaveManual} className="p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Jenis Mutasi</label>
                  <select value={manualForm.type} onChange={e => setManualForm({...manualForm, type: e.target.value})} className={`w-full p-3 rounded-xl text-xs font-black outline-none border transition-colors cursor-pointer ${manualForm.type === 'IN' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                    <option value="IN">Uang Masuk (IN)</option>
                    <option value="OUT">Uang Keluar (OUT)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Tanggal</label>
                  <input type="date" required value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black outline-none focus:border-blue-400" />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Kategori / Referensi</label>
                <input type="text" required placeholder="Contoh: SUNTIKAN MODAL / UANG BENSIN" value={manualForm.category} onChange={e => setManualForm({...manualForm, category: e.target.value.toUpperCase()})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Keterangan Detail</label>
                <input type="text" required placeholder="Jelaskan rincian keperluannya..." value={manualForm.description} onChange={e => setManualForm({...manualForm, description: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-blue-400" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Nominal Uang</label>
                  <input type="number" required placeholder="0" value={manualForm.amount} onChange={e => setManualForm({...manualForm, amount: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-lg font-black text-slate-800 outline-none focus:border-blue-400" />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">Jalur</label>
                  <select value={manualForm.method} onChange={e => setManualForm({...manualForm, method: e.target.value})} className="w-full p-3 border border-slate-200 rounded-xl text-xs font-black outline-none cursor-pointer">
                    <option value="CASH">Tunai (Cash)</option>
                    <option value="TF">Transfer Bank</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="w-full text-white font-black py-4 rounded-xl text-sm uppercase tracking-widest shadow-lg bg-blue-600 hover:bg-blue-700 transition-colors mt-2">Simpan Mutasi Manual</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
