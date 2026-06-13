import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, Calendar, FileText, Trash2, Printer, 
  Wallet, Truck, CheckCircle2, DollarSign, ArrowDownRight, Package
} from 'lucide-react';
import { getTodayStr, generateId, formatDate } from '../../utils/helpers';
import { triggerPrint } from '../../utils/PrintUtility';

const formatRupiah = (angka) => "Rp " + Number(angka || 0).toLocaleString('id-ID');
const formatNumber = (angka) => Number(angka || 0).toLocaleString('id-ID');

export default function TabPurchases({ 
  purchases = [], purchases_data,
  supplierInvoices = [], supplier_invoices,
  sendToSheet, showToast, user, requestDelete 
}) {
  const todayStr = getTodayStr();
  
  // 🔥 TOLERANSI KABEL: Kita bikin pencocokan cabang longgar biar TANGERANG_P atau TANGERANG_PUSAT tetap kebaca!
  const currentBranch = (user?.branch_id === 'PUSAT' || !user?.branch_id) ? 'TANGERANG_PUSAT' : user?.branch_id;

  // --- SINKRONISASI DATABASE KAMUS ---
  const realPurchases = useMemo(() => purchases_data || purchases || [], [purchases, purchases_data]);
  const realInvoices = useMemo(() => supplier_invoices || supplierInvoices || [], [supplier_invoices, supplierInvoices]);

  const [activeSubTab, setActiveTab] = useState('SUPPLIER');
  const [tableDateFilter, setTableDateFilter] = useState(todayStr);

  // --- STATE FORM NOTA SUPPLIER ---
  const [form, setForm] = useState({
    supplierName: '',
    category: 'BAHAN_BAKU',
    itemName: '',
    qty: '',
    price: '',
    paymentMethod: 'TEMPO' // Default TEMPO / HUTANG sesuai gambar spreadsheet Bos
  });

  // --- 1. LIVE CONVERSION ESTIMATOR ---
  const hitungBeratKg = useMemo(() => {
    const volume = Number(form.qty || 0);
    if (form.category === 'BAHAN_BAKU') {
      return volume * 10; // Rule #1: 1 Kantong = 10 KG Ayam Mentah
    }
    return 0;
  }, [form.qty, form.category]);

  const totalTagihanForm = useMemo(() => {
    return Number(form.qty || 0) * Number(form.price || 0);
  }, [form.qty, form.price]);

  // --- 2. JURNAL RIWAYAT BELANJA (KABEL FIX MUTALAK!) ---
  const historyPurchases = useMemo(() => {
    return realPurchases.filter(p => {
      if (p.isDeleted || String(p.isDeleted).toUpperCase() === 'TRUE') return false;
      
      // Ambil 10 digit pertama tanggal (YYYY-MM-DD)
      const dateMatch = p.date && p.date.substring(0, 10) === tableDateFilter;
      
      // 🔥 LOGIKA LONGGAR: Mau dia tulis TANGERANG_P atau TANGERANG_PUSAT, selama ada kata TANGERANG kita loloskan!
      const branchMatch = currentBranch === 'TANGERANG_PUSAT' 
        ? String(p.branch_id).toUpperCase().includes('TANGERANG')
        : String(p.branch_id).toUpperCase() === currentBranch.toUpperCase();

      return dateMatch && branchMatch;
    }).sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [realPurchases, tableDateFilter, currentBranch]);

  // --- ACTIONS: SUBMIT NOTA BELANJA SUPPLIER ---
  const handleSubmitBelanja = async (e) => {
    e.preventDefault();
    if (!form.supplierName) return alert("Nama supplier wajib diisi!");
    if (Number(form.qty) <= 0) return alert("Kuantitas beli harus lebih dari 0!");

    const purchaseId = generateId('PO-DMA', todayStr);
    const calculatedTotal = totalTagihanForm;

    // A. Payload untuk sheet 'purchases' / 'inventory_cost_layers'
    const payloadPurchase = {
      id: purchaseId,
      date: todayStr,
      branch_id: currentBranch, // Masuk sebagai standard resmi TANGERANG_PUSAT
      supplier_name: form.supplierName.toUpperCase(),
      item_name: form.itemName.toUpperCase(),
      qty: Number(form.qty),
      unit: form.category === 'BAHAN_BAKU' ? 'KANTONG' : 'PCS',
      price: Number(form.price || 0),
      total_amount: calculatedTotal,
      paid_amount: form.paymentMethod === 'LUNAS' ? calculatedTotal : 0,
      payment_status: form.paymentMethod === 'LUNAS' ? 'LUNAS' : 'BELUM_LUNAS',
      payment_method: form.paymentMethod === 'LUNAS' ? 'CASH' : 'HUTANG',
      isDeleted: false
    };

    const isSuccess = await sendToSheet('insert', payloadPurchase, 'purchases');

    if (isSuccess) {
      // Masuk ke Cost Layers Gudang Masak
      await sendToSheet('insert', {
        id: generateId('LAY', todayStr), date: todayStr, branch_id: currentBranch,
        category: form.category, item_name: form.itemName.toUpperCase(),
        qty_received: Number(form.qty), qty_remaining: Number(form.qty),
        unit_cost: Number(form.price || 0), reference_id: purchaseId, isDeleted: false
      }, 'inventory_cost_layers');

      // Jika Lunas, potong kas langsung
      if (form.paymentMethod === 'LUNAS') {
        await sendToSheet('insert', {
          id: generateId('CFO', todayStr), date: todayStr, branch_id: currentBranch, type: 'OUT',
          category: 'BELANJA LOGISTIK', description: `Beli ${form.itemName.toUpperCase()} ke ${form.supplierName.toUpperCase()}`,
          amount: calculatedTotal, method: 'CASH', reference_id: purchaseId
        }, 'cashflow_transactions');
      }

      showToast("Nota Belanja Supplier Berhasil Disimpan ke Cloud Sheet!", "success");
      setForm({ supplierName: '', category: 'BAHAN_BAKU', itemName: '', qty: '', price: '', paymentMethod: 'TEMPO' });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-800 animate-in fade-in duration-300">
      
      {/* HEADER UTAMA */}
      <div className="bg-[#151a25] rounded-3xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-rose-500"></div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <ShoppingBag size={20} className="text-amber-400"/>
          </div>
          <div>
            <h2 className="text-white font-black uppercase tracking-widest text-base">Belanja &amp; Biaya Operasional</h2>
            <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Satu pintu utama pengeluaran usaha pabrik, pembelian bahan baku, dan kas internal.</p>
          </div>
        </div>
      </div>

      {/* SUB TAB MENU */}
      <div className="flex gap-2 bg-slate-100 p-1.5 rounded-2xl border w-fit">
        <button onClick={() => setActiveTab('SUPPLIER')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeSubTab === 'SUPPLIER' ? 'bg-white text-blue-600 shadow-sm border' : 'text-slate-500 hover:text-slate-800'}`}><Truck size={14}/> Belanja Supplier</button>
        <button onClick={() => setActiveTab('MANUAL')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${activeSubTab === 'MANUAL' ? 'bg-white text-rose-600 shadow-sm border' : 'text-slate-500 hover:text-slate-800'}`}><Wallet size={14}/> Kas &amp; Ops Manual</button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        
        {/* KANTONG KIRI: FORMULIR INPUT */}
        <div className="xl:col-span-5 bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b bg-slate-50 font-black text-xs uppercase tracking-widest flex items-center gap-2 text-slate-700">
            <FileText size={16} className="text-blue-600"/> Formulir Nota Supplier
          </div>

          <form onSubmit={handleSubmitBelanja} className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Nama Supplier</label>
                <input type="text" required value={form.supplierName} onChange={e=>setForm({...form, supplierName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:bg-white focus:border-blue-400" placeholder="Cth: NANA AYAM" />
              </div>
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Kategori Barang</label>
                <select value={form.category} onChange={e=>setForm({...form, category: e.target.value, qty: '', price: ''})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs cursor-pointer outline-none focus:border-blue-400">
                  <option value="BAHAN_BAKU">BAHAN BAKU (AYAM)</option>
                  <option value="PACKAGING">PACKAGING / MIKA</option>
                  <option value="OPERASIONAL">BIAYA UMUM / OPS</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Nama Item / Deskripsi</label>
              <input type="text" required value={form.itemName} onChange={e=>setForm({...form, itemName: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-xs outline-none focus:bg-white focus:border-blue-400" placeholder="Cth: DAGING FILLET DADA / MIKA ISI 50" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">
                  {form.category === 'BAHAN_BAKU' ? 'Volume Beli (Kantong)' : 'Volume Beli (Pcs)'}
                </label>
                <input type="number" min="1" required value={form.qty} onChange={e=>setForm({...form, qty: e.target.value})} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm text-center outline-none focus:bg-white focus:border-blue-400" placeholder="0" />
              </div>
              <div>
                <label className="text-[9px] font-black text-blue-600 uppercase block mb-1">Konversi Berat (KG)</label>
                <div className="w-full p-3 bg-blue-50 border border-blue-200 rounded-xl font-black text-sm text-center text-blue-700">
                  {formatNumber(hitungBeratKg)} KG
                </div>
              </div>
            </div>

            <div>
              <label className="text-[9px] font-black text-slate-500 uppercase block mb-1">Harga Per Satuan (Kantong/Pcs)</label>
              <div className="relative">
                <span className="absolute left-3 top-3 font-black text-slate-400 text-sm">Rp</span>
                <input type="text" required value={form.price ? Number(form.price).toLocaleString('id-ID') : ''} onChange={e=>setForm({...form, price: e.target.value.replace(/\D/g, '')})} className="w-full pl-9 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-xl font-black text-sm outline-none focus:bg-white focus:border-blue-400" placeholder="0" />
              </div>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center shadow-inner">
              <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Total Tagihan Nota:</span>
              <span className="text-xl font-black text-emerald-400">{formatRupiah(totalTagihanForm)}</span>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={()=>setForm({...form, paymentMethod: 'TEMPO'})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${form.paymentMethod === 'TEMPO' ? 'bg-amber-500 text-white border-amber-600 shadow-md scale-102' : 'bg-slate-50 text-slate-500'}`}>TEMPO / BON</button>
              <button type="button" onClick={()=>setForm({...form, paymentMethod: 'LUNAS'})} className={`flex-1 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all ${form.paymentMethod === 'LUNAS' ? 'bg-emerald-600 text-white border-emerald-700 shadow-md scale-102' : 'bg-slate-50 text-slate-500'}`}>LUNAS (KAS POTONG)</button>
            </div>

            <button type="submit" className="w-full bg-slate-900 text-white font-black py-4 rounded-xl text-xs uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-all active:scale-95 flex items-center justify-center gap-2 mt-2">
              <CheckCircle2 size={16}/> Simpan Nota Belanja Supplier
            </button>
          </form>
        </div>

        {/* KANTONG KANAN: JURNAL BUKU KAS PENGELUARAN (RE-WIRED!) */}
        <div className="xl:col-span-7 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-5 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h4 className="font-black text-xs uppercase text-slate-800 tracking-widest flex items-center gap-2"><FileText size={16} className="text-blue-600"/> Jurnal Buku Kas Pengeluaran</h4>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Tampilan data harian real-time cloud sheet.</p>
            </div>
            <div className="flex items-center gap-2 bg-white border px-3 py-2 rounded-xl shadow-sm">
              <Calendar size={14} className="text-blue-500"/>
              <input type="date" value={tableDateFilter} onChange={e => setTableDateFilter(e.target.value || todayStr)} className="text-xs font-black text-slate-800 outline-none cursor-pointer" />
            </div>
          </div>

          <div className="overflow-x-auto flex-1 p-2 custom-scrollbar min-h-[50vh]">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-white text-[10px] uppercase text-slate-400 border-b border-slate-100 sticky top-0 shadow-sm">
                <tr>
                  <th className="px-5 py-4 font-black">Bukti &amp; Ref</th>
                  <th className="px-5 py-4 font-black">Detail Transaksi Belanja</th>
                  <th className="px-5 py-4 font-black text-right">Jumlah Uang</th>
                  <th className="px-5 py-4 font-black text-center">Jalur</th>
                  <th className="px-5 py-4 font-black text-center">Tindakan</th>
                </tr>
              </thead>
              <tbody className="text-xs font-bold divide-y divide-slate-50">
                {historyPurchases.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-20 text-slate-400 font-black uppercase tracking-widest bg-slate-50/50">
                      <div className="flex justify-center mb-3 opacity-20"><ShoppingBag size={40}/></div>
                      Tidak ada catatan pengeluaran/belanja untuk tanggal {formatDate(tableDateFilter)}.
                    </td>
                  </tr>
                ) : (
                  historyPurchases.map(p => {
                    const totalBill = Number(p.total_amount || p.amount || 0);
                    const isLunas = String(p.payment_status).toUpperCase() === 'LUNAS' || String(p.payment_method).toUpperCase() === 'CASH';

                    return (
                      <tr key={p.id} className="hover:bg-amber-50/30 transition-colors group">
                        <td className="px-5 py-4 whitespace-nowrap">
                          <div className="text-slate-800 font-black text-sm">{formatDate(p.date)}</div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1">{p.id}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-black text-blue-700 uppercase text-xs mb-1">{p.supplier_name || p.supplierName || 'SUPPLIER'}</div>
                          <div className="text-[10px] text-slate-700 uppercase font-black">{p.item_name || p.itemName}</div>
                          <div className="text-[9px] text-slate-400 mt-1">Volume Beli: {formatNumber(p.qty)} {p.unit || 'KANTONG'}</div>
                        </td>
                        <td className="px-5 py-4 text-right whitespace-nowrap font-black text-sm text-rose-600">
                          {formatRupiah(totalBill)}
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${isLunas ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                            {isLunas ? 'LUNAS CASH' : 'BON TEMPO'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-center whitespace-nowrap opacity-40 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => triggerPrint('NOTA_DOTMATRIX', {
                              title: 'BUKTI BON BELANJA LOGISTIK PABRIK', id: p.id, date: formatDate(p.date),
                              branch_name: p.branch_id, admin_name: user?.name || 'ADMIN LOGISTIK', customer_name: p.supplier_name,
                              items: [{ name: `BELANJA: ${p.item_name}\n(Jalur: ${p.payment_method})`, qty: p.qty, subtotal: totalBill }],
                              amount: totalBill, paymentMethod: isLunas ? 'LUNAS DIBAYAR' : 'HUTANG DAGANG', history: null
                            })} className="p-2 text-slate-500 bg-white border rounded-lg hover:text-blue-600 hover:bg-blue-50"><Printer size={14}/></button>
                            <button type="button" onClick={() => { if(window.confirm("PERINGATAN GLOBAL!\n\nMenghapus transaksi belanja ini akan menarik kembali layer modal HPP di gudang.\n\nYakin void data belanja?")) requestDelete(p.id); }} className="p-2 text-slate-500 bg-white border rounded-lg hover:text-rose-600 hover:bg-rose-50"><Trash2 size={14}/></button>
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
