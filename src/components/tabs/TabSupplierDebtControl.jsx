import React, { useMemo, useState } from 'react';

const asArray = (value) => Array.isArray(value) ? value : [];
const toNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value === undefined || value === null || value === '') return 0;
  const parsed = Number(String(value).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : 0;
};
const formatMoney = (value) => `Rp ${Math.round(toNumber(value)).toLocaleString('id-ID')}`;
const formatNumber = (value) => Math.round(toNumber(value)).toLocaleString('id-ID');
const normalizeCode = (value) => String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const normalizeDate = (value) => {
  if (!value) return '';
  const raw = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 10);
};
const formatDate = (value) => {
  const d = normalizeDate(value);
  if (!d) return '-';
  const date = new Date(`${d}T00:00:00`);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
};
const todayStr = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};
const daysBetween = (from, to) => {
  if (!from || !to) return 0;
  const a = new Date(`${normalizeDate(from)}T00:00:00`);
  const b = new Date(`${normalizeDate(to)}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b - a) / 86400000);
};
const isOpenStatus = (row = {}) => {
  const s = normalizeCode(row.payment_status || row.status || row.payable_status || 'OPEN');
  return !['PAID', 'LUNAS', 'CLOSED', 'VOID', 'CANCELLED', 'BATAL'].includes(s);
};
const getUserLocationId = (user = {}) => user.location_id || user.branch_id || user.location_code || 'LOC-TGR';
const sameLocation = (a, b) => {
  const x = normalizeCode(a);
  const y = normalizeCode(b);
  if (!x || !y) return true;
  if (x === y) return true;
  const aliases = {
    LOC_TGR: ['TANGERANG_PUSAT', 'PUSAT', 'TGR', 'HO_TANGERANG'],
    TANGERANG_PUSAT: ['LOC_TGR', 'PUSAT', 'TGR', 'HO_TANGERANG'],
    PUSAT: ['LOC_TGR', 'TANGERANG_PUSAT', 'TGR', 'HO_TANGERANG'],
  };
  return (aliases[x] || []).includes(y) || (aliases[y] || []).includes(x);
};
const includesAyamSupplier = (row = {}) => {
  const text = normalizeCode([
    row.supplier_name,
    row.vendor_name,
    row.payee,
    row.supplier,
    row.notes,
    row.description,
    row.source_module,
    row.purchase_type,
  ].join(' '));
  return text.includes('AYAM') || text.includes('NANA') || text.includes('BANG_ITEM') || text.includes('CHICKEN') || !text;
};

const Card = ({ title, value, subtitle, tone = 'white' }) => {
  const toneMap = {
    white: 'bg-white border-slate-100 text-slate-900',
    red: 'bg-red-50 border-red-100 text-red-900',
    green: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    gold: 'bg-amber-50 border-amber-100 text-amber-900',
    dark: 'bg-slate-950 border-slate-950 text-white',
  };
  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneMap[tone] || toneMap.white}`}>
      <div className="text-[10px] font-black uppercase tracking-[0.18em] opacity-60">{title}</div>
      <div className="mt-2 text-2xl font-black tracking-tight">{value}</div>
      {subtitle && <div className="mt-1 text-[11px] font-bold opacity-70 leading-relaxed">{subtitle}</div>}
    </div>
  );
};

const Badge = ({ children, tone = 'slate' }) => {
  const tones = {
    slate: 'bg-slate-50 text-slate-600 border-slate-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    gold: 'bg-amber-50 text-amber-700 border-amber-100',
    dark: 'bg-slate-950 text-white border-slate-950',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${tones[tone] || tones.slate}`}>{children}</span>;
};

export default function TabSupplierDebtControl({
  user = {},
  payables = [],
  supplier_ledger = [],
  payable_payments = [],
  purchases = [],
  purchase_items = [],
  chickenLots = [],
  chicken_lots = [],
  stockMovements = [],
  stock_movements = [],
  production_batches = [],
  productionBatches = [],
  orders = [],
  payments = [],
  wallet_mutations = [],
  cashflow_transactions = [],
}) {
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState('OPEN');
  const today = todayStr();
  const locationId = getUserLocationId(user);

  const sourcePayables = useMemo(() => {
    const combined = [...asArray(payables), ...asArray(supplier_ledger)];
    const seen = new Set();
    return combined.filter((row) => {
      const id = row.payable_id || row.id || row.reference_id || row.source_id;
      if (id && seen.has(id)) return false;
      if (id) seen.add(id);
      const rowLocation = row.location_id || row.branch_id || row.source_location_id || '';
      if (rowLocation && !sameLocation(rowLocation, locationId)) return false;
      return includesAyamSupplier(row);
    });
  }, [payables, supplier_ledger, locationId]);

  const paymentsByPayable = useMemo(() => {
    const map = new Map();
    asArray(payable_payments).forEach((payment) => {
      const id = payment.payable_id || payment.source_id || payment.reference_id || '';
      if (!id) return;
      if (!map.has(id)) map.set(id, []);
      map.get(id).push(payment);
    });
    return map;
  }, [payable_payments]);

  const activeChickenLots = useMemo(() => {
    const rows = [...asArray(chicken_lots), ...asArray(chickenLots)];
    return rows.filter((lot) => {
      const s = normalizeCode(lot.status || 'ACTIVE');
      const remaining = toNumber(lot.qty_kg_remaining || lot.remaining_kg || lot.qty_remaining || lot.qty_kg || lot.kg);
      const rowLocation = lot.location_id || lot.branch_id || '';
      return !['VOID', 'CANCELLED', 'CLOSED'].includes(s) && remaining > 0 && (!rowLocation || sameLocation(rowLocation, locationId));
    });
  }, [chicken_lots, chickenLots, locationId]);

  const lotBySource = useMemo(() => {
    const map = new Map();
    activeChickenLots.forEach((lot) => {
      const keys = [lot.source_id, lot.purchase_id, lot.drop_id, lot.payable_id, lot.chicken_lot_id, lot.lot_id, lot.id, lot.reference_id].filter(Boolean);
      keys.forEach((key) => map.set(String(key), lot));
    });
    return map;
  }, [activeChickenLots]);

  const rows = useMemo(() => {
    return sourcePayables.map((payable) => {
      const id = payable.payable_id || payable.id || payable.reference_id || payable.source_id || '';
      const pays = paymentsByPayable.get(id) || [];
      const paidByHistory = pays.reduce((sum, item) => sum + toNumber(item.amount || item.payment_amount || item.nominal), 0);
      const total = toNumber(payable.original_amount || payable.amount || payable.total_amount || payable.total_purchase || payable.nominal);
      const paid = toNumber(payable.paid_amount) || paidByHistory;
      const remaining = toNumber(payable.remaining_amount || payable.outstanding_amount || Math.max(total - paid, 0));
      const dueDate = normalizeDate(payable.due_date || payable.payable_due_date || payable.jatuh_tempo || '');
      const age = daysBetween(payable.payable_date || payable.date || payable.created_at, today);
      const overdueDays = dueDate && dueDate < today ? daysBetween(dueDate, today) : 0;
      const sourceKeys = [payable.source_id, payable.purchase_id, payable.drop_id, payable.reference_id, payable.invoice_no, id].filter(Boolean);
      const lot = sourceKeys.map((key) => lotBySource.get(String(key))).find(Boolean) || null;
      const lotRemainingKg = lot ? toNumber(lot.qty_kg_remaining || lot.remaining_kg || lot.qty_remaining || lot.qty_kg || lot.kg) : 0;
      return {
        ...payable,
        id,
        total,
        paid,
        remaining,
        dueDate,
        age,
        overdueDays,
        lot,
        lotRemainingKg,
        statusLabel: remaining <= 0 ? 'Lunas' : overdueDays > 0 ? 'Lewat tempo' : paid > 0 ? 'Sebagian' : 'Open',
        supplierName: payable.supplier_name || payable.vendor_name || payable.payee || payable.supplier || 'Nana / Bang Item Ayam',
        dropId: payable.source_id || payable.purchase_id || payable.drop_id || payable.reference_id || '',
      };
    }).filter((row) => {
      if (mode === 'OPEN' && row.remaining <= 0) return false;
      if (mode === 'OVERDUE' && row.overdueDays <= 0) return false;
      const q = normalizeCode(search);
      if (!q) return true;
      const haystack = normalizeCode([row.id, row.dropId, row.supplierName, row.notes, row.description, row.statusLabel].join(' '));
      return haystack.includes(q);
    }).sort((a, b) => b.remaining - a.remaining);
  }, [sourcePayables, paymentsByPayable, lotBySource, today, mode, search]);

  const recovery = useMemo(() => {
    const cashRows = [...asArray(payments), ...asArray(wallet_mutations), ...asArray(cashflow_transactions)];
    const last7 = cashRows.filter((row) => {
      const d = normalizeDate(row.payment_date || row.mutation_date || row.date || row.created_at);
      const diff = daysBetween(d, today);
      const direction = normalizeCode(row.direction || row.type || 'IN');
      const rowLocation = row.location_id || row.branch_id || '';
      return diff >= 0 && diff <= 7 && direction !== 'OUT' && (!rowLocation || sameLocation(rowLocation, locationId));
    });
    const cashIn7 = last7.reduce((sum, row) => sum + toNumber(row.amount || row.payment_amount || row.nominal), 0);
    const danaAyam55 = cashIn7 * 0.55;
    const paid7 = asArray(payable_payments).filter((row) => {
      const d = normalizeDate(row.payment_date || row.date || row.created_at);
      const diff = daysBetween(d, today);
      return diff >= 0 && diff <= 7;
    }).reduce((sum, row) => sum + toNumber(row.amount || row.payment_amount || row.nominal), 0);
    return { cashIn7, danaAyam55, paid7, rekomendasiBayar: Math.max(danaAyam55 - paid7, 0) };
  }, [payments, wallet_mutations, cashflow_transactions, payable_payments, today, locationId]);

  const summary = useMemo(() => {
    const open = rows.filter((row) => row.remaining > 0);
    const totalOpen = open.reduce((sum, row) => sum + row.remaining, 0);
    const overdue = open.filter((row) => row.overdueDays > 0);
    const lotKg = activeChickenLots.reduce((sum, lot) => sum + toNumber(lot.qty_kg_remaining || lot.remaining_kg || lot.qty_remaining || lot.qty_kg || lot.kg), 0);
    const notaBerjalan = open[0] || null;
    const paidThisMonth = asArray(payable_payments).filter((row) => normalizeDate(row.payment_date || row.date || row.created_at).startsWith(today.slice(0, 7))).reduce((sum, row) => sum + toNumber(row.amount || row.payment_amount || row.nominal), 0);
    const status = recovery.rekomendasiBayar >= (notaBerjalan?.remaining || 0) && notaBerjalan ? 'AMAN BAYAR NOTA' : recovery.rekomendasiBayar > 0 ? 'BAYAR SEBAGIAN' : 'TAHAN DULU';
    return { open, totalOpen, overdue, lotKg, notaBerjalan, paidThisMonth, status };
  }, [rows, activeChickenLots, payable_payments, today, recovery.rekomendasiBayar]);

  const paymentHistory = useMemo(() => {
    return asArray(payable_payments)
      .filter((row) => includesAyamSupplier(row) || rows.some((payable) => payable.id === row.payable_id))
      .slice()
      .sort((a, b) => String(b.payment_date || b.date || b.created_at || '').localeCompare(String(a.payment_date || a.date || a.created_at || '')))
      .slice(0, 8);
  }, [payable_payments, rows]);

  return (
    <div className="space-y-6 pb-10 text-slate-700 normal-case">
      <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
        <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-red-600/30 blur-3xl" />
        <div className="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.24em] text-amber-200">Ruang Kontrol Supplier Ayam</div>
            <h1 className="text-2xl font-black tracking-tight lg:text-3xl">Hutang Supplier Ayam Nana</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-relaxed text-slate-300">
              Pantau nota ayam berjalan, sisa hutang, stok ayam yang masih muter, uang masuk penjualan, dan saran pembayaran aman.
            </p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/10 p-5 text-right">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-300">Status Pembayaran</div>
            <div className="mt-1 text-2xl font-black text-emerald-400">{summary.status}</div>
            <div className="mt-1 text-[11px] font-bold text-slate-300">berdasarkan uang masuk 7 hari terakhir</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card title="Sisa Hutang Nana" value={formatMoney(summary.totalOpen)} subtitle={`${summary.open.length} nota masih terbuka`} tone={summary.totalOpen > 0 ? 'red' : 'green'} />
        <Card title="Nota Lewat Tempo" value={formatMoney(summary.overdue.reduce((s, r) => s + r.remaining, 0))} subtitle={`${summary.overdue.length} nota perlu perhatian`} tone={summary.overdue.length ? 'gold' : 'white'} />
        <Card title="Sisa Ayam dari Nota" value={`${formatNumber(summary.lotKg)} kg`} subtitle={`≈ ${formatNumber(summary.lotKg / 30)} adukan tersisa`} tone="white" />
        <Card title="Uang Masuk 7 Hari" value={formatMoney(recovery.cashIn7)} subtitle={`Dana ayam 55%: ${formatMoney(recovery.danaAyam55)}`} tone="dark" />
        <Card title="Saran Bayar Aman" value={formatMoney(recovery.rekomendasiBayar)} subtitle={`Sudah bayar 7 hari: ${formatMoney(recovery.paid7)}`} tone="green" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8 rounded-[2rem] border border-slate-100 bg-white shadow-sm overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-900">Daftar Nota Ayam Berjalan</h2>
              <p className="mt-1 text-[11px] font-bold text-slate-400">Setiap baris terhubung ke DROP ayam, sisa stok ayam, pembayaran, dan status hutang.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {['OPEN', 'OVERDUE', 'ALL'].map((item) => (
                <button key={item} type="button" onClick={() => setMode(item)} className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-wider ${mode === item ? 'bg-red-600 text-white' : 'border border-slate-200 bg-white text-slate-500'}`}>{item}</button>
              ))}
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nota/supplier..." className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-bold outline-none focus:border-red-500" />
            </div>
          </div>

          <div className="overflow-x-auto p-5">
            <table className="w-full min-w-[900px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  <th className="py-3">Nota / DROP</th>
                  <th className="py-3">Supplier</th>
                  <th className="py-3 text-right">Total Nota</th>
                  <th className="py-3 text-right">Dibayar</th>
                  <th className="py-3 text-right">Sisa Hutang</th>
                  <th className="py-3">Jatuh Tempo</th>
                  <th className="py-3 text-right">Sisa Ayam</th>
                  <th className="py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan="8" className="py-12 text-center text-sm font-bold text-slate-400">Belum ada hutang supplier ayam sesuai filter.</td></tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id || row.dropId} className="border-b border-slate-50 align-top">
                    <td className="py-4 font-black text-slate-900">
                      {row.id || '-'}
                      <div className="mt-1 text-[10px] font-bold text-slate-400">{row.dropId || 'Belum link DROP'}</div>
                    </td>
                    <td className="py-4 font-bold text-slate-600">{row.supplierName}</td>
                    <td className="py-4 text-right font-black text-slate-900">{formatMoney(row.total)}</td>
                    <td className="py-4 text-right font-bold text-emerald-700">{formatMoney(row.paid)}</td>
                    <td className="py-4 text-right font-black text-red-700">{formatMoney(row.remaining)}</td>
                    <td className="py-4 font-bold text-slate-600">
                      {formatDate(row.dueDate)}
                      <div className="mt-1 text-[10px] text-slate-400">Umur nota {row.age} hari</div>
                    </td>
                    <td className="py-4 text-right font-black text-slate-900">
                      {row.lot ? `${formatNumber(row.lotRemainingKg)} kg` : '-'}
                      {row.lot && <div className="mt-1 text-[10px] font-bold text-slate-400">≈ {formatNumber(row.lotRemainingKg / 30)} adukan</div>}
                    </td>
                    <td className="py-4">
                      <Badge tone={row.remaining <= 0 ? 'green' : row.overdueDays > 0 ? 'red' : row.paid > 0 ? 'gold' : 'slate'}>{row.statusLabel}</Badge>
                      {row.overdueDays > 0 && <div className="mt-2 text-[10px] font-bold text-red-600">Lewat {row.overdueDays} hari</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-4 space-y-6">
          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50 p-6 shadow-sm">
            <h3 className="text-sm font-black text-emerald-900">Siklus Pembayaran Nana</h3>
            <div className="mt-4 space-y-3 text-xs font-bold text-emerald-800">
              <div className="flex justify-between"><span>Uang masuk 7 hari</span><b>{formatMoney(recovery.cashIn7)}</b></div>
              <div className="flex justify-between"><span>Jatah aman ayam 55%</span><b>{formatMoney(recovery.danaAyam55)}</b></div>
              <div className="flex justify-between"><span>Sudah dibayar</span><b>{formatMoney(recovery.paid7)}</b></div>
              <div className="border-t border-emerald-200 pt-3 flex justify-between text-sm"><span>Saran bayar</span><b>{formatMoney(recovery.rekomendasiBayar)}</b></div>
            </div>
            <p className="mt-4 rounded-2xl bg-white/70 p-3 text-[11px] font-bold leading-relaxed text-emerald-900">
              Ini bukan laba bersih. Ini radar uang ayam supaya nota berjalan dan selipan hutang lama tidak lepas kontrol.
            </p>
          </div>

          <div className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-black text-slate-900">Pembayaran Terakhir</h3>
            <div className="mt-4 space-y-3">
              {paymentHistory.length === 0 && <div className="rounded-2xl bg-slate-50 p-4 text-xs font-bold text-slate-400">Belum ada histori pembayaran supplier.</div>}
              {paymentHistory.map((payment, index) => (
                <div key={`${payment.payment_id || payment.id || index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="text-xs font-black text-slate-900">{payment.payment_id || payment.id || payment.payable_id || '-'}</div>
                      <div className="mt-1 text-[10px] font-bold text-slate-400">{formatDate(payment.payment_date || payment.date || payment.created_at)}</div>
                    </div>
                    <div className="text-right text-sm font-black text-emerald-700">{formatMoney(payment.amount || payment.payment_amount || payment.nominal)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-amber-100 bg-amber-50 p-6 shadow-sm">
            <h3 className="text-sm font-black text-amber-900">Alur di Belakang Layar</h3>
            <p className="mt-3 text-xs font-bold leading-relaxed text-amber-800">
              Beli ayam menambah stok ayam dan hutang. Produksi mengubah ayam menjadi stok jadi. Order mengubah stok jadi menjadi uang/piutang. Pembayaran Nana mengurangi hutang dan dompet.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
