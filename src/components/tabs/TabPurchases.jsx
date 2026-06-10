import React, { useState, useMemo } from 'react';
import { ShoppingBag, Truck, Edit2, Trash2, Calendar, Plus, Wallet, FileText, CheckCircle2, ArrowUpRight, ArrowDownToLine, X, Printer, Landmark } from 'lucide-react';
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
  
  // --- STATE MANAGEMENT ---
  const [activeFormTab, setActiveFormTab] = useState('SUPPLIER'); // SUPPLIER atau OPERASIONAL_MANUAL
  const [isEditing, setIsEditing] = useState(false);
  const [tableDateFilter, setTableDateFilter] = useState(todayStr); // Default tabel kanan CUMA TAMPIL HARI INI

  // Form 1: Belanja Supplier Utama (Ayam, Mika, Bumbu)
  const [form, setForm] = useState({
    id: '', date: todayStr, supplierName: '', category: 'BAHAN_BAKU', itemName: '', 
    qty: '', qtyKg: '', unitPrice: '', paymentMethod: 'CASH', amountPaid: '', notes: ''
  });

  // Form 2: Kas Operasional & Manual (Suntikan Modal, Listrik, Bensin, Gaji)
  const [manualForm, setManualForm] = useState({
    date: todayStr, type: 'OUT', category: 'BIAYA OPERASIONAL', description: '', amount: '', method: 'CASH'
  });

  // --- SINKRONISASI DATABASE ---
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realCashflow = useMemo(() => cashflow_transactions_data || cashflow_transactions || [], [cashflow_transactions, cashflow_transactions_data]);
  const suppliers = useMemo(() => master_suppliers || masterSuppliers || [], [master_suppliers, masterSuppliers]);

  // --- COMBINED DATABASE FILTER (HANYA PILIHAN TANGGAL DI KALENDER KECIL) ---
  const combinedHistoryTable = useMemo(() => {
    let history = [];
    
    // Tarik data belanja supplier sesuai tanggal filter
    realPurchases.filter(p => !p.isDeleted && p.date.substring(0, 10) === tableDateFilter).forEach(p => {
      history.push({ ...p, isManual: false, sortDate: new Date(p.date) });
    });
    
    // Tarik data kas operasional manual sesuai tanggal filter
    realCashflow.filter(c => !c.isDeleted && c.date.substring(0, 10) === tableDateFilter).forEach(c => {
      history.push({ ...c, isManual: true, sortDate: new Date(c.date) });
    });
    
    return history.sort((a, b) => b.sortDate - a.sortDate);
  }, [realPurchases, realCashflow, tableDateFilter]);

  const perhitungan = useMemo(() => {
    const qty = Number(form.qty || 0);
    const price = Number(form.unitPrice || 0);
    const total = qty * price;
    return { totalTagihan: total, dibayar: form.paymentMethod === 'HUTANG' ? Number(form.amountPaid || 0) : total };
  }, [form]);

  // --- ACTIONS: SUBMIT BELANJA SUPPLIER ---
  const handleSubmitSupplier = async (e) => {
    e.preventDefault();
    if (Number(form.qty) <= 0) return alert("Jumlah kuantitas harus lebih dari 0!");
    
    const trxId = isEditing ? form.id : generateId('PO', form.date);
    const payload = {
      id: trxId, date: form.date, branch_id: currentBranch, supplier_name: form.supplierName.toUpperCase(), 
      category: form.category, item_name: form.itemName.toUpperCase(), qty: Number(form.qty), qty_kg: Number(form.qtyKg || 0),
      unit_price: Number(form.unitPrice), total_amount: perhitungan.totalTagihan, payment_method: form.paymentMethod, 
      amount_paid: perhitungan.dibayar, status: form.paymentMethod === 'HUTANG' ? 'BELUM_LUNAS' : 'LUNAS', notes: form.notes.toUpperCase()
    };

    if (await sendToSheet(isEditing ? 'update' : 'insert', payload, 'purchases')) {
      showToast('Data belanja supplier berhasil disimpan!', 'success');
      handleCancelEdit();
    }
  };

  // --- ACTIONS: SUBMIT KAS MANUAL / OPERASIONAL ---
  const handleSubmitManual = async (e) => {
    e.preventDefault();
    if (Number(manualForm.amount) <= 0) return alert("Nominal uang harus lebih dari 0!");
    
    const trxId = generateId('CSH', manualForm.date);
    const payload = {
      id: trxId, date: manualForm.date, branch_id: currentBranch, type: manualForm.type,
      category: manualForm.category.toUpperCase(), description: manualForm.description,
      amount: Number(manualForm.amount), method: manualForm.method
    };

    if (await sendToSheet('insert', payload, 'cashflow_transactions')) {
      showToast('Pencatatan kas operasional berhasil disimpan!', 'success');
      setManualForm({ date: todayStr, type: 'OUT', category: 'BIAYA OPERASIONAL', description: '', amount: '', method: 'CASH' });
      if (window.confirm("Cetak Bukti Kas Masuk/Keluar ini?")) handlePrintKas(payload);
    }
  };

  const handlePrintKas = (trx) => {
    triggerPrint('NOTA_DOTMATRIX', {
      title: trx.type === 'IN' ? 'BUKTI KAS MASUK (IN)' : 'BUKTI KAS KELUAR (OUT)', id: trx.id, date: formatDate(trx.date), 
      branch_name: trx.branch_id || currentBranch, admin_name: user?.name || 'ADMIN', customer_name: 'MANUAL ENTRY INTERNAL',
      items: [{ name: `KATEGORI: ${trx.category}\nKET: ${trx.description}`, qty: 1, subtotal: trx.amount }], amount: trx.amount, paymentMethod: trx.method
    });
  };

  const handleEditSupplier = (log) => {
    setForm({
      id: log.id, date: log.date.substring(0, 10), supplierName: log.supplier_name, category: log.category,
      itemName: log.item_name, qty: log.qty, qtyKg: log.qty_kg, unitPrice: log.unit_price,
      paymentMethod: log.payment_method, amountPaid: log.amount_paid, notes: log.notes || ''
    });
    setActiveFormTab('SUPPLIER');
    setIsEditing(true); window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setForm({ id: '', date: todayStr, supplierName: '', category: 'BAHAN_BAKU', itemName: '', qty: '', qtyKg: '', unitPrice: '', paymentMethod: 'CASH', amountPaid: '', notes: '' });
  };

  return (
    <div className="space-y-6 pb-10">
      
      {/* HEADER UTAMA */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-xl font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
          <ShoppingBag className="text-blue-600"/> Belanja &amp; Biaya Operasional
        </h2>
        <p className="text-xs font-bold text-slate-500 mt-1">Satu pintu utama pengeluaran usaha pabrik, pembelian bahan baku, dan kas internal.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* KIRI: DOUBLE FORM STATIS BERDAMPINGAN (UI SUPER SMOOTH & ELEGAN) */}
        <div className="flex flex-col space-y-4">
          
          {/* SAKLAR NAVIGASI FORM TAB */}
          <div className="bg-slate-200/70 p-1.5 rounded-2xl border border-slate-300/30 flex gap-1 shadow-inner">
            <button 
              type="button" 
              disabled={isEditing}
              onClick={() => setActiveFormTab('SUPPLIER')} 
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${activeFormTab === 'SUPPLIER' ? 'bg-white text-blue-700 shadow border' : 'text-slate-500 disabled:opacity-50'}`}
            >
              <Truck size={14}/> Belanja Supplier
            </button>
            <button 
              type="button" 
              disabled={isEditing}
              onClick={() => setActiveFormTab('MANUAL')} 
              className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${activeFormTab === 'MANUAL' ? 'bg-white text-slate-800 shadow border' : 'text-slate-500 disabled:opacity-50'}`}
            >
              <Wallet size={14}/> Kas &amp; Ops Manual
            </button>
          </div>

          {/* RUMAH KONTEN FORM 1: INPUT SUPPLIER */}
          {activeFormTab === 'SUPPLIER' && (
            <div className={`p-6 rounded-3xl border shadow-sm transition-all ${isEditing ? 'bg-amber-50/40 border-amber-300' : 'bg-white border-slate-200'}`}>
              <form onSubmit={handleSubmitSupplier} className="space-y-4">
                <div className="text-xs font-black uppercase text-slate-700 pb-3 border-b border-slate-100 flex items-center justify-between">
                  <span>{isEditing ? '⚠️ Mode Revisi Belanja' : '📦 Formulir Nota Supplier'}</span>
                  {isEditing && <button type="button" onClick={handleCancelEdit} className="text-[9px] bg-white border px-2 py-1 rounded text-rose-600 uppercase font-black">Batal</button>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama Supplier</label>
                    <input type="text" required list="supplier-datalist" value={form.supplierName} onChange={e=>setForm({...form, supplierName: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none focus:bg-white focus:border-blue-500" placeholder="Cth: NANA AYAM" />
                    <datalist id="supplier-datalist">{suppliers.map(s => <option key={s.id} value={s.supplier_name}/>)}</datalist>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Kategori Barang</label>
                    <select value={form.category} onChange={e=>setForm({...form, category: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-black bg-slate-50 outline-none uppercase cursor-pointer">
                      <option value="BAHAN_BAKU">Bahan Baku (Ayam)</option>
                      <option value="PACKAGING">Packaging (Mika)</option>
                      <option value="BUMBU">Bumbu &amp; Saus</option>
                      <option value="ASET">Alat / Mesin Pabrik</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Nama Item / Deskripsi</label>
                  <input type="text" required value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none focus:bg-white focus:border-blue-500" placeholder="Cth: Daging Fillet Dada / Mika Isi 50" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Volume Beli</label>
                    <input type="number" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-black text-center bg-slate-50 outline-none focus:bg-white focus:border-blue-500" placeholder="0" />
                  </div>
                  {form.category === 'BAHAN_BAKU' && (
                    <div>
                      <label className="text-[10px] font-black text-blue-500 uppercase tracking-widest block mb-1">Konversi Berat (KG)</label>
                      <input type="number" value={form.qtyKg} onChange={e=>setForm({...form, qtyKg: e.target.value})} className="w-full p-2.5 border border-blue-200 text-blue-700 rounded-xl text-sm font-black text-center bg-blue-50/50 outline-none" placeholder="0 KG" />
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Harga Per Satuan</label>
                  <input type="number" required value={form.unitPrice} onChange={e=>setForm({...form, unitPrice: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-black bg-slate-50 outline-none focus:bg-white focus:border-blue-500" placeholder="Rp 0" />
                </div>

                <div className="bg-slate-950 text-white p-4 rounded-xl border border-slate-800 shadow-inner">
                  <div className="flex justify-between items-end">
                    <span className="text-[9px] font-black uppercase text-slate-400">Total Tagihan Nota</span>
                    <span className="text-xl font-black text-emerald-400">{formatRupiah(perhitungan.totalTagihan)}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl border bg-slate-50">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase">Metode Pembayaran</label>
                    <div className="flex gap-1 bg-slate-200/50 p-1 rounded-md">
                      {['CASH', 'TF', 'HUTANG'].map(m => <button key={m} type="button" onClick={() => setForm({...form, paymentMethod: m})} className={`px-2.5 py-1 rounded text-[9px] font-black ${form.paymentMethod === m ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}>{m === 'HUTANG' ? 'TEMPO' : m}</button>)}
                    </div>
                  </div>
                  {form.paymentMethod === 'HUTANG' && (
                    <div className="mt-3 pt-3 border-t border-dashed border-slate-300">
                      <label className="text-[10px] font-black text-rose-500 uppercase block mb-1">Uang Muka / DP Awal</label>
                      <input type="number" value={form.amountPaid} onChange={e=>setForm({...form, amountPaid: e.target.value})} className="w-full p-2 border border-rose-200 rounded-lg text-right font-black bg-white" placeholder="0" />
                    </div>
                  )}
                </div>

                <button type="submit" className="w-full text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-widest shadow-md bg-blue-600 hover:bg-blue-700 transition-colors">
                  {isEditing ? 'Simpan Perubahan' : 'Simpan Pembelian'}
                </button>
              </form>
            </div>
          )}

          {/* RUMAH KONTEN FORM 2: INPUT KAS OPERASIONAL MANUAL (PINDAHAN DARI POP-UP) */}
          {activeFormTab === 'MANUAL' && (
            <div className="p-6 rounded-3xl border border-slate-200 shadow-sm bg-white animate-in fade-in duration-200">
              <form onSubmit={handleSubmitManual} className="space-y-4">
                <div className="text-xs font-black uppercase text-slate-800 pb-3 border-b border-slate-100"><Wallet size={14} className="inline mr-1 text-emerald-500"/> Aliran Kas Manual &amp; Operasional</div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Arah Arus Duit</label>
                    <select value={manualForm.type} onChange={e => setManualForm({...manualForm, type: e.target.value})} className={`w-full p-2.5 border rounded-xl text-xs font-black outline-none cursor-pointer ${manualForm.type === 'IN' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                      <option value="OUT">Uang Keluar (Beban/Biaya)</option>
                      <option value="IN">Uang Masuk (Suntikan/Setoran)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Tanggal</label>
                    <input type="date" required value={manualForm.date} onChange={e => setManualForm({...manualForm, date: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-black outline-none bg-slate-50" />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Kategori / Nama Beban</label>
                  <input type="text" required placeholder="Cth: BIAYA LISTRIK / SEWA FREEZER / GAJI KARYAWAN" value={manualForm.category} onChange={e => setManualForm({...manualForm, category: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold uppercase bg-slate-50 outline-none focus:border-blue-500" />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Keterangan Spesifik</label>
                  <input type="text" required placeholder="Cth: Bayar listrik token pabrik pusat Juni 2026" value={manualForm.description} onChange={e => setManualForm({...manualForm, description: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-bold bg-slate-50 outline-none focus:border-blue-500" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Jumlah Uang (Nominal)</label>
                    <input type="number" required placeholder="0" value={manualForm.amount} onChange={e => setManualForm({...manualForm, amount: e.target.value})} className="w-full p-2.5 border rounded-xl text-sm font-black text-slate-800 bg-slate-50 outline-none focus:border-blue-500" />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Dompet/Laci</label>
                    <select value={manualForm.method} onChange={e => setManualForm({...manualForm, method: e.target.value})} className="w-full p-2.5 border rounded-xl text-xs font-black outline-none cursor-pointer bg-slate-50">
                      <option value="CASH">Tunai (Cash)</option>
                      <option value="TF">Transfer Bank</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="w-full text-white font-black py-3.5 rounded-xl text-xs uppercase tracking-widest shadow-md bg-slate-900 hover:bg-slate-800 transition-colors">
                  Simpan &amp; Cetak Bukti Kas
                </button>
              </form>
            </div>
          )}

        </div>

        {/* KANAN: JURNAL RIWAYAT (HANYA HARI INI SECARA DEFAULT + KALENDER KECIL) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-700 tracking-widest">Jurnal Buku Kas Pengeluaran</h4>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase">Tampilan Data: {tableDateFilter === todayStr ? 'Hari Ini (Real-time)' : 'Histori Transaksi Lama'}</p>
            </div>
            
            {/* KALENDER KECIL FILTER JURNAL BIAR GAK BERAT */}
            <div className="flex items-center gap-2 bg-white border px-2.5 py-1.5 rounded-xl shadow-sm">
              <Calendar size={12} className="text-slate-400"/>
              <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black outline-none bg-transparent cursor-pointer text-slate-700" />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar">
            <table className="w-full text-sm text-left">
              <thead className="text-[10px] uppercase text-slate-400 bg-white">
                <tr>
                  <th className="px-4 py-3 font-black">Bukti &amp; Ref</th>
                  <th className="px-4 py-3 font-black">Detail Transaksi</th>
                  <th className="px-4 py-3 font-black text-right">Jumlah Uang</th>
                  <th className="px-4 py-3 font-black text-center">Jalur</th>
                  <th className="px-4 py-3 font-black text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {combinedHistoryTable.length === 0 ? (
                  <tr><td colSpan="5" className="text-center py-20 text-slate-400 font-bold uppercase">Tidak ada catatan pengeluaran/belanja untuk tanggal {formatDate(tableDateFilter)}</td></tr>
                ) : (
                  combinedHistoryTable.map(log => {
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition-colors group">
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-bold">{formatDate(log.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-0.5">{log.id}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-black text-slate-800 uppercase text-xs mb-1 line-clamp-1">
                            {log.isManual ? log.description : `${log.item_name} (Vol: ${formatNumber(log.qty)})`}
                          </div>
                          <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${log.isManual ? (log.type === 'IN' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100') : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                            {log.isManual ? log.category : `SUPPLIER: ${log.supplier_name}`}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right whitespace-nowrap">
                          {log.isManual && log.type === 'IN' ? (
                            <span className="text-emerald-600 font-black flex items-center justify-end gap-1"><ArrowDownToLine size={11}/> {formatRupiah(log.amount)}</span>
                          ) : (
                            <span className="text-rose-600 font-black flex items-center justify-end gap-1"><ArrowUpRight size={11}/> {formatRupiah(log.total_amount || log.amount)}</span>
                          )}
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          {!log.isManual && log.status === 'BELUM_LUNAS' ? 
                            <span className="text-[9px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 animate-pulse">TEMPO</span> : 
                            <span className="text-[9px] font-black uppercase text-slate-500 bg-slate-100 px-2 py-1 rounded-md shadow-sm border">{log.payment_method || log.method}</span>
                          }
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-center gap-1.5">
                            {log.isManual && <button type="button" onClick={() => handlePrintKas(log)} className="p-1.5 text-slate-400 hover:text-blue-600 rounded-md transition-colors" title="Cetak Kwitansi Kas"><Printer size={15}/></button>}
                            {!log.isManual && <button type="button" onClick={() => handleEditSupplier(log)} className="p-1.5 text-slate-400 hover:text-amber-500 rounded-md transition-colors" title="Revisi Nota Beli"><Edit2 size={13}/></button>}
                            <button type="button" onClick={() => { if(window.confirm("Void Transaksi ini?")) requestDelete(log.id); }} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md transition-colors" title="Hapus total"><Trash2 size={13}/></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
}
