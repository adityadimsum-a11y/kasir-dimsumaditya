import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Truck,
} from 'lucide-react';
import { getTodayStr, generateId } from '../../utils/helpers';

const numberValue = (value) => {
  const parsed = Number(String(value ?? 0).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatNumber = (value) => Number(value || 0).toLocaleString('id-ID');
const formatMoney = (value) => `Rp ${Math.round(Number(value || 0)).toLocaleString('id-ID')}`;
const normalizeCode = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const safeArray = (value) => Array.isArray(value) ? value : [];
const pct = (ready, need) => need > 0 ? Math.min(100, Math.round((ready / need) * 100)) : 0;
const daysUntil = (date) => {
  if (!date) return null;
  const target = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  const today = new Date(`${getTodayStr()}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.round((target - today) / 86400000);
};
const bucketLabel = (bucket) => {
  const code = normalizeCode(bucket);
  if (code.includes('DAILY') || code.includes('HARIAN')) return 'PO Harian';
  if (code.includes('BORROW') || code.includes('PINJAM')) return 'Pinjam Stok';
  return 'Karantina PO';
};
const isActive = (row = {}) => {
  const status = normalizeCode(row.status || row.allocation_status || 'ACTIVE');
  return !['VOID', 'CANCELLED', 'CANCELED', 'DONE', 'CLOSED', 'PICKED_UP', 'COMPLETE'].includes(status);
};
const rowProductId = (row = {}) => normalizeCode(row.product_id || row.item_id || row.product_code || row.item_code || row.product_name || row.item_name || row.name);
const rowProductName = (row = {}) => row.product_name || row.item_name || row.name || row.product_code || row.product_id || '-';

const buildFinishedStock = ({ inventoryCostLayers = [], stockMovements = [], allocations = [] }) => {
  const total = {};
  const reserved = {};
  const add = (obj, key, qty) => {
    if (!key || !Number.isFinite(qty) || qty === 0) return;
    obj[key] = (obj[key] || 0) + qty;
  };

  [...safeArray(inventoryCostLayers), ...safeArray(stockMovements)].forEach((row) => {
    if (!isActive(row)) return;
    const cat = normalizeCode(row.category || row.item_type || row.stock_type || '');
    const isFinished = cat.includes('PRODUK') || cat.includes('FINISHED') || cat.includes('JADI') || normalizeCode(rowProductName(row)).includes('DIMSUM');
    if (!isFinished) return;
    const key = rowProductId(row);
    const rawQty = numberValue(row.qty_remaining ?? row.qty_effect ?? row.qty ?? row.quantity);
    const direction = normalizeCode(row.direction || (rawQty < 0 ? 'OUT' : 'IN'));
    const effect = direction === 'OUT' ? -Math.abs(rawQty) : rawQty;
    add(total, key, effect);
  });

  safeArray(allocations).forEach((row) => {
    if (!isActive(row)) return;
    const key = rowProductId(row);
    const q = Math.max(0, numberValue(row.qty_allocated || row.allocated_qty || row.reserved_qty || row.qty_reserved || row.required_qty_pcs || row.qty_pcs || row.qty));
    add(reserved, key, q);
  });

  return { total, reserved };
};

const ProgressBar = ({ ready, need, urgent = false }) => {
  const value = pct(ready, need);
  const color = value >= 100 ? 'bg-emerald-500' : urgent ? 'bg-red-500' : value >= 70 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="mt-3">
      <div className="mb-1 flex justify-between text-[10px] font-black text-slate-500">
        <span>{formatNumber(ready)} siap</span>
        <span>{value}%</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
};

export default function TabAntrianPO({
  masterProducts = [], master_products,
  masterCustomers = [], master_customers,
  inventoryCostLayers = [], inventory_cost_layers,
  stockMovements = [], stock_movements,
  stockAllocations = [], stock_allocations,
  poStockPlans = [], po_stock_plans,
  orders = [],
  sendToSheet,
  showToast,
  user,
}) {
  const today = getTodayStr();
  const locationId = user?.location_id || user?.branch_id || 'LOC-TGR';
  const products = useMemo(() => safeArray(master_products || masterProducts).filter(Boolean), [masterProducts, master_products]);
  const customers = useMemo(() => safeArray(master_customers || masterCustomers).filter(Boolean), [masterCustomers, master_customers]);
  const allocationRows = useMemo(() => [...safeArray(stock_allocations), ...safeArray(stockAllocations), ...safeArray(po_stock_plans), ...safeArray(poStockPlans)], [stockAllocations, stock_allocations, poStockPlans, po_stock_plans]);
  const stock = useMemo(() => buildFinishedStock({
    inventoryCostLayers: [...safeArray(inventory_cost_layers), ...safeArray(inventoryCostLayers)],
    stockMovements: [...safeArray(stock_movements), ...safeArray(stockMovements)],
    allocations: allocationRows,
  }), [inventoryCostLayers, inventory_cost_layers, stockMovements, stock_movements, allocationRows]);

  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    type: 'PO_QUARANTINE',
    customer_name: '',
    product_id: '',
    required_qty_pcs: '',
    pickup_date: today,
    payment_status: 'BELUM_TAHU',
    paid_amount: '0',
    notes: '',
    reserve_now: true,
  });

  const selectedProduct = products.find((p) => String(p.product_id || p.id || p.product_code) === String(form.product_id));
  const selectedKey = rowProductId(selectedProduct || {});
  const totalStock = Math.max(0, numberValue(stock.total[selectedKey] || 0));
  const alreadyReserved = Math.max(0, numberValue(stock.reserved[selectedKey] || 0));
  const freeStock = Math.max(0, totalStock - alreadyReserved);
  const requiredQty = Math.max(0, numberValue(form.required_qty_pcs));
  const autoReserve = form.reserve_now ? Math.min(freeStock, requiredQty) : 0;

  const planRows = useMemo(() => {
    const rows = allocationRows.filter(isActive).map((row) => {
      const key = rowProductId(row);
      const required = Math.max(0, numberValue(row.required_qty_pcs || row.qty_required || row.qty_pcs || row.qty));
      const allocated = Math.max(0, numberValue(row.qty_allocated || row.allocated_qty || row.reserved_qty || row.qty_reserved));
      const due = row.pickup_date || row.due_date || row.delivery_date || '';
      const dday = daysUntil(due);
      const shortage = Math.max(0, required - allocated);
      return {
        ...row,
        key,
        po_id: row.po_id || row.plan_id || row.source_id || row.allocation_id || row.id,
        customer_name: row.customer_name || row.customer || '-',
        product_name: row.product_name || row.item_name || row.name || '-',
        bucket: row.bucket_type || row.bucket || row.allocation_type || row.po_type || row.order_type || 'PO_QUARANTINE',
        required,
        allocated,
        shortage,
        due,
        dday,
      };
    });
    const q = normalizeCode(query);
    return rows
      .filter((row) => !q || normalizeCode([row.po_id, row.customer_name, row.product_name, row.bucket].join(' ')).includes(q))
      .sort((a, b) => String(a.due || '').localeCompare(String(b.due || '')));
  }, [allocationRows, query]);

  const summary = useMemo(() => {
    return planRows.reduce((acc, row) => {
      acc.totalNeed += row.required;
      acc.totalReady += row.allocated;
      acc.totalShort += row.shortage;
      if (normalizeCode(row.bucket).includes('DAILY') || normalizeCode(row.bucket).includes('HARIAN')) acc.daily += row.required;
      else if (normalizeCode(row.bucket).includes('BORROW') || normalizeCode(row.bucket).includes('PINJAM')) acc.borrowed += row.required;
      else acc.quarantine += row.required;
      if (row.dday !== null && row.dday <= 1 && row.shortage > 0) acc.urgent += 1;
      return acc;
    }, { totalNeed: 0, totalReady: 0, totalShort: 0, daily: 0, quarantine: 0, borrowed: 0, urgent: 0 });
  }, [planRows]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!selectedProduct) return showToast?.('Pilih produk dulu.', 'error');
    if (requiredQty <= 0) return showToast?.('Qty PO wajib lebih dari 0 pcs.', 'error');
    const poId = generateId(form.type === 'DAILY_PO' ? 'POH' : 'POKAR', today);
    const payload = {
      po_id: poId,
      plan_id: poId,
      location_id: locationId,
      bucket_type: form.type,
      customer_name: form.customer_name || 'Customer PO',
      product_id: selectedProduct.product_id || selectedProduct.id || selectedProduct.product_code || '',
      product_code: selectedProduct.product_code || selectedProduct.code || '',
      product_name: selectedProduct.product_name || selectedProduct.name || '',
      required_qty_pcs: requiredQty,
      qty_allocated: autoReserve,
      pickup_date: form.pickup_date,
      payment_status: form.payment_status,
      paid_amount: numberValue(form.paid_amount),
      status: autoReserve >= requiredQty ? 'READY_PICKUP' : autoReserve > 0 ? 'PARTLY_READY' : 'SHORTAGE',
      notes: form.notes,
      source: 'TAB_ANTRIAN_PO_5C',
    };
    const ok = await sendToSheet?.('insert', payload, 'po_stock_plans');
    if (ok) {
      setForm({ type: 'PO_QUARANTINE', customer_name: '', product_id: '', required_qty_pcs: '', pickup_date: today, payment_status: 'BELUM_TAHU', paid_amount: '0', notes: '', reserve_now: true });
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-red-600/20 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-amber-200"><Package size={18} /> Stok dengan Tujuan</div>
            <h1 className="text-3xl font-black tracking-tight">Antrian PO & Karantina Stok</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-relaxed text-slate-300">
              Pisahkan stok bebas, stok PO besar, PO harian, dan pinjam stok. Perpindahan bucket hanya menahan barang, belum jadi omzet sampai ada bayar/pickup.
            </p>
          </div>
          <div className="grid min-w-[320px] grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/10 p-4"><div className="text-[9px] font-black uppercase text-slate-400">Kebutuhan PO</div><div className="mt-1 text-2xl font-black">{formatNumber(summary.totalNeed)}</div><div className="text-[10px] text-slate-400">pcs</div></div>
            <div className="rounded-2xl bg-white/10 p-4"><div className="text-[9px] font-black uppercase text-slate-400">Kurang Produksi</div><div className="mt-1 text-2xl font-black text-red-300">{formatNumber(summary.totalShort)}</div><div className="text-[10px] text-slate-400">pcs</div></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><div className="text-[10px] font-black uppercase text-slate-400">Stok Karantina PO</div><div className="mt-2 text-2xl font-black text-slate-900">{formatNumber(summary.quarantine)}</div><div className="text-xs font-bold text-slate-400">pcs ditahan untuk PO besar</div></div>
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><div className="text-[10px] font-black uppercase text-slate-400">Stok PO Harian</div><div className="mt-2 text-2xl font-black text-blue-700">{formatNumber(summary.daily)}</div><div className="text-xs font-bold text-slate-400">pesanan pickup besok/hari ini</div></div>
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm"><div className="text-[10px] font-black uppercase text-slate-400">Pinjam Stok</div><div className="mt-2 text-2xl font-black text-orange-700">{formatNumber(summary.borrowed)}</div><div className="text-xs font-bold text-slate-400">wajib diganti produksi</div></div>
        <div className="rounded-3xl border border-red-100 bg-red-50 p-5 shadow-sm"><div className="text-[10px] font-black uppercase text-red-400">Mepet H-Day</div><div className="mt-2 text-2xl font-black text-red-700">{summary.urgent}</div><div className="text-xs font-bold text-red-500">PO kurang dan sudah dekat</div></div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <form onSubmit={handleSubmit} className="xl:col-span-4 rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-center gap-2"><Plus size={18} className="text-red-600" /><h2 className="text-sm font-black text-slate-900">Buat Rencana PO</h2></div>
          <div className="space-y-4">
            <div><label className="mb-1 block text-[10px] font-black uppercase text-slate-400">Jenis</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold"><option value="PO_QUARANTINE">Stok Karantina PO</option><option value="DAILY_PO">Stok PO Harian</option><option value="BORROWED">Pinjam Stok / Wajib Ganti</option></select></div>
            <div><label className="mb-1 block text-[10px] font-black uppercase text-slate-400">Customer</label><input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} list="po-customers" className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold" placeholder="Nama customer / reseller" /><datalist id="po-customers">{customers.map((c) => <option key={c.customer_id || c.id || c.name} value={c.customer_name || c.name || ''} />)}</datalist></div>
            <div><label className="mb-1 block text-[10px] font-black uppercase text-slate-400">Produk</label><select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold"><option value="">Pilih produk</option>{products.map((p) => <option key={p.product_id || p.id || p.product_code} value={p.product_id || p.id || p.product_code}>{p.product_name || p.name}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-[10px] font-black uppercase text-slate-400">Qty pcs</label><input value={form.required_qty_pcs} onChange={(e) => setForm({ ...form, required_qty_pcs: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold" placeholder="5000" /></div><div><label className="mb-1 block text-[10px] font-black uppercase text-slate-400">Pickup</label><input type="date" value={form.pickup_date} onChange={(e) => setForm({ ...form, pickup_date: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold" /></div></div>
            <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block text-[10px] font-black uppercase text-slate-400">Bayar</label><select value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold"><option value="BELUM_TAHU">Belum tahu</option><option value="DP">DP</option><option value="LUNAS">Lunas</option><option value="COD_PICKUP">Bayar saat pickup</option><option value="PIUTANG">Piutang</option></select></div><div><label className="mb-1 block text-[10px] font-black uppercase text-slate-400">Nominal masuk</label><input value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold" /></div></div>
            <label className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-xs font-bold text-emerald-800"><input type="checkbox" checked={form.reserve_now} onChange={(e) => setForm({ ...form, reserve_now: e.target.checked })} />Tahan stok bebas yang tersedia sekarang</label>
            <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-xs font-bold text-amber-900">Stok bebas produk ini: {formatNumber(freeStock)} pcs. Akan ditahan: {formatNumber(autoReserve)} pcs. Kurang produksi: {formatNumber(Math.max(0, requiredQty - autoReserve))} pcs.</div>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold" rows={3} placeholder="Catatan PO / alamat / jam pickup" />
            <button className="w-full rounded-2xl bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-wider text-white shadow-sm hover:bg-red-700">Simpan PO & Tahan Stok</button>
          </div>
        </form>

        <div className="xl:col-span-8 rounded-[2rem] border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 md:flex-row md:items-center md:justify-between"><div><h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Truck size={18} className="text-red-600" />Papan Progress PO</h2><p className="mt-1 text-[11px] font-bold text-slate-400">Progress ini membantu produksi mengejar kekurangan sebelum H-day.</p></div><div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(e) => setQuery(e.target.value)} className="rounded-2xl border border-slate-200 py-3 pl-9 pr-4 text-xs font-bold" placeholder="Cari PO/customer/produk" /></div></div>
          <div className="space-y-4 p-5">
            {planRows.length === 0 && <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center text-sm font-bold text-slate-400">Belum ada PO karantina / PO harian.</div>}
            {planRows.map((row) => {
              const urgent = row.dday !== null && row.dday <= 1 && row.shortage > 0;
              const ready = row.allocated;
              return (
                <div key={row.po_id} className={`rounded-3xl border p-5 shadow-sm ${urgent ? 'border-red-200 bg-red-50' : 'border-slate-100 bg-slate-50/70'}`}>
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-slate-900">{row.po_id}</span><span className="rounded-full bg-slate-900 px-2.5 py-1 text-[9px] font-black uppercase text-white">{bucketLabel(row.bucket)}</span>{urgent && <span className="rounded-full bg-red-600 px-2.5 py-1 text-[9px] font-black uppercase text-white">Mepet</span>}</div><div className="mt-2 text-xs font-bold text-slate-500">{row.customer_name} · {row.product_name}</div><div className="mt-1 flex flex-wrap gap-2 text-[11px] font-bold text-slate-400"><span><Calendar size={12} className="inline" /> Pickup {row.due || '-'}</span><span>{row.dday === null ? '' : row.dday >= 0 ? `H-${row.dday}` : `Lewat ${Math.abs(row.dday)} hari`}</span><span>{row.payment_status || 'BELUM_TAHU'}</span></div></div>
                    <div className="shrink-0 text-right"><div className="text-lg font-black text-slate-900">{formatNumber(row.required)} pcs</div><div className="text-[11px] font-bold text-slate-400">butuh</div></div>
                  </div>
                  <ProgressBar ready={ready} need={row.required} urgent={urgent} />
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[11px] font-bold"><div className="rounded-2xl bg-white p-3"><div className="text-slate-400">Siap</div><div className="text-emerald-700">{formatNumber(ready)} pcs</div></div><div className="rounded-2xl bg-white p-3"><div className="text-slate-400">Kurang</div><div className="text-red-600">{formatNumber(row.shortage)} pcs</div></div><div className="rounded-2xl bg-white p-3"><div className="text-slate-400">Uang Masuk</div><div className="text-slate-900">{formatMoney(row.paid_amount)}</div></div></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-900">
        Alur uang tetap aman: menahan stok untuk PO belum dihitung omzet. 4 Amplop berjalan hanya dari uang DP/lunas yang benar-benar masuk, sedangkan PO yang belum bayar tampil sebagai potensi uang masuk.
      </div>
    </div>
  );
}
