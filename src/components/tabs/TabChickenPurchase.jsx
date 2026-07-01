import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  FileText,
  History,
  Package,
  Truck,
  Wallet,
} from 'lucide-react';

const KG_PER_ADUKAN = 30;
const PCS_PER_ADUKAN = 1000;
const PCS_PER_PORSI = 4;
const MONITOR_PRICE_PER_PORSI = 8500;
const DEFAULT_CHICKEN_PRICE = 37500;

const formatMoney = (value) => `Rp${Math.round(Number(value || 0)).toLocaleString('id-ID')}`;
const formatNumber = (value) => Number(value || 0).toLocaleString('id-ID');
const todayString = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const normalizeText = (value) => String(value || '').trim().toUpperCase();
const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(String(value).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const activeRow = (row = {}) => {
  const status = normalizeText(row.status || row.is_active || 'ACTIVE');
  const deleted = row.isDeleted === true || normalizeText(row.isDeleted || row.is_deleted) === 'TRUE';
  return !deleted && !['VOID', 'CANCELLED', 'INACTIVE', 'NON_ACTIVE', 'FALSE', 'NO', 'CONSUMED'].includes(status);
};
const getSupplierName = (row = {}) => row.supplier_name || row.vendor_name || row.name || row.nama_supplier || '';
const getSupplierId = (row = {}) => row.supplier_id || row.vendor_id || row.id || getSupplierName(row);
const getRemainingKg = (lot = {}) => toNumber(lot.qty_kg_remaining || lot.remaining_kg || lot.qty_remaining || lot.qty_kg || lot.kg || lot.qty);
const getUnitCost = (lot = {}) => toNumber(lot.unit_cost || lot.price_per_kg || lot.hpp_ayam || lot.hpp_per_kg || lot.harga_kg || DEFAULT_CHICKEN_PRICE);
const getLotName = (lot = {}) => lot.lot_no || lot.chicken_lot_id || lot.lot_id || lot.id || lot.invoice_no || 'STOK-AYAM';

const Badge = ({ children, tone = 'slate' }) => {
  const tones = {
    red: 'border-red-100 bg-red-50 text-red-700',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    slate: 'border-slate-100 bg-slate-50 text-slate-600',
    dark: 'border-slate-800 bg-slate-950 text-white',
  };
  return <span className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${tones[tone] || tones.slate}`}>{children}</span>;
};

const Field = ({ label, children }) => (
  <div>
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</label>
    {children}
  </div>
);

const inputClass = 'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:border-red-500 focus:ring-4 focus:ring-red-50';

const MonitorCard = ({ title, value, subtitle, tone = 'white' }) => {
  const tones = {
    white: 'border-slate-100 bg-white text-slate-900',
    red: 'border-red-100 bg-red-50 text-red-900',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    dark: 'border-slate-800 bg-slate-950 text-white',
  };
  return (
    <div className={`rounded-[1.7rem] border p-4 shadow-sm ${tones[tone] || tones.white}`}>
      <div className="text-[9px] font-black uppercase tracking-[0.18em] opacity-60">{title}</div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      {subtitle && <div className="mt-1 text-[10px] font-bold leading-relaxed opacity-70">{subtitle}</div>}
    </div>
  );
};

export default function TabChickenPurchase({
  masterSuppliers = [],
  master_suppliers,
  suppliers,
  wallets = [],
  chickenLots = [],
  chicken_lots,
  purchases = [],
  payables = [],
  sendToSheet,
  showToast,
  user,
}) {
  const supplierRows = useMemo(() => {
    const rows = master_suppliers || masterSuppliers || suppliers || [];
    const active = rows.filter(activeRow);
    const nana = active.filter((row) => normalizeText(getSupplierName(row)).includes('NANA') || normalizeText(getSupplierName(row)).includes('AYAM'));
    return nana.length > 0 ? nana : active;
  }, [master_suppliers, masterSuppliers, suppliers]);

  const currentLocationId = user?.location_id || user?.branch_id || user?.branchId || 'LOC-TGR';
  const walletRows = useMemo(() => (wallets || []).filter((row) => activeRow(row) && (!row.location_id || String(row.location_id) === String(currentLocationId))), [wallets, currentLocationId]);
  const lotRows = useMemo(() => {
    const rows = chicken_lots || chickenLots || [];
    return rows
      .filter(activeRow)
      .map((lot) => ({ ...lot, _remainingKg: getRemainingKg(lot), _unitCost: getUnitCost(lot) }))
      .filter((lot) => lot._remainingKg > 0)
      .sort((a, b) => String(b.lot_date || b.created_at || '').localeCompare(String(a.lot_date || a.created_at || '')));
  }, [chicken_lots, chickenLots]);

  const nanaPayables = useMemo(() => (payables || []).filter((row) => {
    const text = normalizeText([row.vendor_name, row.supplier_name, row.payable_type, row.source_module].join(' '));
    return text.includes('NANA') || text.includes('AYAM') || text.includes('CHICKEN');
  }), [payables]);

  const chickenAsset = useMemo(() => {
    const remainingKg = lotRows.reduce((sum, lot) => sum + lot._remainingKg, 0);
    const modalAyam = lotRows.reduce((sum, lot) => sum + (lot._remainingKg * lot._unitCost), 0);
    const adukan = Math.floor(remainingKg / KG_PER_ADUKAN);
    const pcs = adukan * PCS_PER_ADUKAN;
    const porsi = Math.floor(pcs / PCS_PER_PORSI);
    const potensiJual = porsi * MONITOR_PRICE_PER_PORSI;
    const marginAyam = potensiJual - modalAyam;
    const avgCost = remainingKg > 0 ? modalAyam / remainingKg : 0;

    return {
      remainingKg,
      modalAyam,
      adukan,
      pcs,
      porsi,
      potensiJual,
      marginAyam,
      avgCost,
    };
  }, [lotRows]);

  const defaultSupplier = supplierRows[0] || {};
  const [form, setForm] = useState({
    purchase_date: todayString(),
    supplier_id: getSupplierId(defaultSupplier),
    supplier_name: getSupplierName(defaultSupplier) || 'NANA CHICKEN',
    invoice_no: '',
    qty_kg: '',
    unit_cost: String(DEFAULT_CHICKEN_PRICE),
    amount_paid: '0',
    wallet_id: '',
    due_date: '',
    notes: '',
  });

  const totalAmount = useMemo(() => toNumber(form.qty_kg) * toNumber(form.unit_cost), [form.qty_kg, form.unit_cost]);
  const remainingAmount = useMemo(() => Math.max(totalAmount - toNumber(form.amount_paid), 0), [totalAmount, form.amount_paid]);

  const setValue = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSupplierChange = (supplierId) => {
    const supplier = supplierRows.find((row) => String(getSupplierId(row)) === String(supplierId)) || {};
    setForm((prev) => ({ ...prev, supplier_id: supplierId, supplier_name: getSupplierName(supplier) || prev.supplier_name }));
  };

  const handleSubmit = async () => {
    if (!form.purchase_date) return alert('Tanggal beli/drop ayam wajib diisi.');
    if (!form.supplier_name) return alert('Supplier wajib diisi.');
    if (toNumber(form.qty_kg) <= 0) return alert('Qty ayam kg harus lebih dari 0.');
    if (toNumber(form.unit_cost) <= 0) return alert('Harga ayam per kg harus lebih dari 0.');
    if (toNumber(form.amount_paid) > 0 && !form.wallet_id) return alert('Kalau ada pembayaran saat beli ayam, pilih dompet/rekening sumber.');

    const confirmed = window.confirm(`Posting DROP ayam?\n\nSupplier: ${form.supplier_name}\nQty: ${formatNumber(form.qty_kg)} kg\nHarga: ${formatMoney(form.unit_cost)}/kg\nTotal: ${formatMoney(totalAmount)}\nSisa hutang: ${formatMoney(remainingAmount)}\n\nSistem akan membuat stok ayam gudang, harga beli terkunci, dan hutang supplier jika belum lunas.`);
    if (!confirmed) return;

    const payload = {
      ...form,
      location_id: currentLocationId,
      qty_kg: toNumber(form.qty_kg),
      unit_cost: toNumber(form.unit_cost),
      total_amount: totalAmount,
      amount_paid: toNumber(form.amount_paid),
      remaining_amount: remainingAmount,
      source: 'LEGACY_CHICKEN_PURCHASE_UI',
    };

    const ok = await sendToSheet?.('insert', payload, 'purchases');
    if (ok) {
      if (typeof showToast === 'function') showToast('DROP ayam berhasil. Stok ayam siap dipakai di Produksi / Adukan.', 'success');
      setForm((prev) => ({ ...prev, invoice_no: '', qty_kg: '', amount_paid: '0', notes: '' }));
    }
  };

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
        <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-red-600/30 blur-2xl" />
        <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <div className="rounded-2xl bg-red-600 p-2"><Truck size={20} /></div>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">Supplier Nana & Stok Ayam</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">Beli Ayam / DROP Ayam</h1>
            <p className="mt-2 max-w-3xl text-sm font-medium leading-relaxed text-slate-300">Gerbang resmi sebelum Produksi / Adukan. Setiap pembelian ayam membuat stok gudang, harga beli terkunci, dan hutang supplier bila belum lunas.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">Total Sisa Ayam</div>
            <div className="mt-1 text-3xl font-black text-emerald-300">{formatNumber(chickenAsset.remainingKg)} kg</div>
            <div className="mt-1 text-[10px] font-bold text-slate-300">≈ {formatNumber(chickenAsset.adukan)} kantong/adukan</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MonitorCard title="Sisa Ayam Gudang" value={`${formatNumber(chickenAsset.remainingKg)} kg`} subtitle={`≈ ${formatNumber(chickenAsset.adukan)} kantong/adukan`} tone="dark" />
        <MonitorCard title="Potensi Hasil" value={`${formatNumber(chickenAsset.porsi)} porsi`} subtitle={`${formatNumber(chickenAsset.pcs)} pcs · patokan 1 adukan = 1.000 pcs`} tone="white" />
        <MonitorCard title="Modal Ayam Tersisa" value={formatMoney(chickenAsset.modalAyam)} subtitle={`Rata-rata ${formatMoney(chickenAsset.avgCost)}/kg`} tone="amber" />
        <MonitorCard title="Potensi Nilai Jual" value={formatMoney(chickenAsset.potensiJual)} subtitle={`Patokan ${formatMoney(MONITOR_PRICE_PER_PORSI)}/porsi`} tone="green" />
        <MonitorCard title="Margin Ayam Saja" value={formatMoney(chickenAsset.marginAyam)} subtitle="Belum potong bumbu, plastik, gaji, listrik, logistik" tone={chickenAsset.marginAyam < 0 ? 'red' : 'white'} />
      </div>

      <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-5 text-xs font-bold leading-relaxed text-amber-800">
        <b>Catatan Monitor:</b> potensi nilai jual memakai patokan {formatMoney(MONITOR_PRICE_PER_PORSI)}/porsi. Angka margin di sini adalah estimasi setelah modal ayam saja, bukan laba bersih final.
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4">
              <Package size={18} className="text-red-600" />
              <div>
                <h2 className="text-sm font-black text-slate-900">Input DROP Ayam</h2>
                <p className="text-[11px] font-semibold text-slate-400">Beli ayam dulu, baru adukan bisa diproses.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Tanggal DROP">
                <input type="date" className={inputClass} value={form.purchase_date} onChange={(e) => setValue('purchase_date', e.target.value)} />
              </Field>
              <Field label="No Nota / Invoice">
                <input className={inputClass} value={form.invoice_no} onChange={(e) => setValue('invoice_no', e.target.value)} placeholder="Nota Nana" />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Supplier">
                <select className={inputClass} value={form.supplier_id} onChange={(e) => handleSupplierChange(e.target.value)}>
                  {supplierRows.length === 0 && <option value="">NANA CHICKEN</option>}
                  {supplierRows.map((supplier) => <option key={getSupplierId(supplier)} value={getSupplierId(supplier)}>{getSupplierName(supplier)}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Qty Ayam (kg)">
                <input className={inputClass} value={form.qty_kg} onChange={(e) => setValue('qty_kg', e.target.value.replace(/[^\d,.-]/g, ''))} placeholder="1020" />
              </Field>
              <Field label="Harga Beli / kg">
                <input className={inputClass} value={form.unit_cost} onChange={(e) => setValue('unit_cost', e.target.value.replace(/[^\d,.-]/g, ''))} placeholder="37500" />
              </Field>
            </div>

            <div className="mt-4 rounded-3xl border border-amber-100 bg-amber-50 p-4">
              <div className="grid grid-cols-2 gap-3 text-xs font-bold">
                <span className="text-amber-700">Total Pembelian</span><span className="text-right text-amber-950">{formatMoney(totalAmount)}</span>
                <span className="text-amber-700">Dibayar Sekarang</span><span className="text-right text-amber-950">{formatMoney(form.amount_paid)}</span>
                <span className="font-black text-red-700">Sisa Hutang Nana</span><span className="text-right font-black text-red-700">{formatMoney(remainingAmount)}</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Dibayar Sekarang">
                <input className={inputClass} value={form.amount_paid} onChange={(e) => setValue('amount_paid', e.target.value.replace(/[^\d,.-]/g, ''))} placeholder="0" />
              </Field>
              <Field label="Dompet/Rekening Bayar">
                <select className={inputClass} value={form.wallet_id} onChange={(e) => setValue('wallet_id', e.target.value)} disabled={toNumber(form.amount_paid) <= 0}>
                  <option value="">{toNumber(form.amount_paid) > 0 ? 'Pilih dompet' : 'Tidak ada pembayaran'}</option>
                  {walletRows.map((wallet) => <option key={wallet.wallet_id} value={wallet.wallet_id}>{wallet.wallet_name || wallet.name || wallet.wallet_id}</option>)}
                </select>
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Jatuh Tempo Hutang">
                <input type="date" className={inputClass} value={form.due_date} onChange={(e) => setValue('due_date', e.target.value)} />
              </Field>
            </div>

            <div className="mt-4">
              <Field label="Catatan">
                <textarea className={`${inputClass} resize-none`} rows={3} value={form.notes} onChange={(e) => setValue('notes', e.target.value)} placeholder="Contoh: turun ayam Nana, selipan hutang lama, nomor nota..." />
              </Field>
            </div>

            <button type="button" onClick={handleSubmit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-4 text-xs font-black uppercase tracking-widest text-white shadow-sm hover:bg-red-700">
              <CheckCircle size={16} /> Posting DROP Ayam & Buat Stok Ayam
            </button>
          </div>
        </div>

        <div className="xl:col-span-7 space-y-6">
          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><History size={17} className="text-red-600" /> Stok Ayam Aktif</h2>
              <Badge tone="green">{lotRows.length} stok</Badge>
            </div>
            <div className="p-5">
              {lotRows.length === 0 ? (
                <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5 text-sm font-bold text-amber-800"><AlertTriangle size={18} className="mb-2" /> Belum ada stok ayam. Produksi / Adukan akan menolak posting sampai DROP Ayam dicatat.</div>
              ) : (
                <div className="overflow-hidden rounded-3xl border border-slate-100">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400"><tr><th className="px-4 py-3">Stok Ayam</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3 text-right">Sisa</th><th className="px-4 py-3 text-right">Harga Beli</th><th className="px-4 py-3 text-right">Modal</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {lotRows.slice(0, 10).map((lot) => <tr key={lot.chicken_lot_id || lot.lot_id || lot.id}><td className="px-4 py-3 font-black text-slate-800">{getLotName(lot)}</td><td className="px-4 py-3 font-bold text-slate-500">{lot.supplier_name || '-'}</td><td className="px-4 py-3 text-right font-black text-emerald-700">{formatNumber(lot._remainingKg)} kg</td><td className="px-4 py-3 text-right font-black text-slate-900">{formatMoney(lot._unitCost)}/kg</td><td className="px-4 py-3 text-right font-black text-slate-900">{formatMoney(lot._remainingKg * lot._unitCost)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Wallet size={17} className="text-red-600" /> Hutang Ayam Nana</h2>
              <Badge tone="amber">{formatMoney(nanaPayables.reduce((s, p) => s + toNumber(p.remaining_amount || p.original_amount), 0))}</Badge>
            </div>
            <div className="p-5">
              {nanaPayables.length === 0 ? <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5 text-sm font-bold text-slate-500">Belum ada hutang supplier ayam.</div> : (
                <div className="space-y-3">
                  {nanaPayables.slice(0, 8).map((p) => <div key={p.payable_id} className="rounded-3xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-black text-slate-900">{p.payable_no || p.payable_id}</div><div className="mt-1 text-[11px] font-bold text-slate-400">{p.vendor_name || p.supplier_name} · {p.source_id}</div></div><div className="text-right"><div className="text-sm font-black text-red-700">{formatMoney(p.remaining_amount || p.original_amount)}</div><div className="mt-1 text-[10px] font-black text-slate-400">{p.status}</div></div></div></div>)}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-5 text-sm font-bold leading-relaxed text-emerald-800">
            <div className="mb-2 flex items-center gap-2 font-black"><FileText size={18} /> Alur Sistem</div>
            DROP Ayam membuat stok ayam gudang dan hutang supplier Nana bila belum lunas. Produksi / Adukan berikutnya mengambil stok ayam ini dan membuat stok barang jadi dengan modal terkunci.
          </div>
        </div>
      </div>
    </div>
  );
}
