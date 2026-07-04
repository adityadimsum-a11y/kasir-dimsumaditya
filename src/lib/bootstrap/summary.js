import { formatRupiah } from "../format/money";

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function numberValue(value) {
  const clean = String(value ?? "0").replace(/[^0-9.-]/g, "");
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumRows(rows, fields) {
  return asArray(rows).reduce((total, row) => {
    for (const field of fields) {
      if (row?.[field] !== undefined && row?.[field] !== "") {
        return total + numberValue(row[field]);
      }
    }

    return total;
  }, 0);
}

function isOpenStatus(row) {
  const status = String(
    row?.status ||
      row?.payment_status ||
      row?.approval_status ||
      row?.payable_status ||
      ""
  ).toUpperCase();

  return (
    !status.includes("LUNAS") &&
    !status.includes("PAID") &&
    !status.includes("SELESAI") &&
    !status.includes("COMPLETED") &&
    !status.includes("CLOSED") &&
    !status.includes("VOID")
  );
}

export function buildBootstrapSummary(bootstrap) {
  const data = bootstrap || {};

  const payments = asArray(data.payments);
  const receivables = asArray(data.receivables);
  const payables = asArray(data.payables);
  const walletMutations = asArray(data.wallet_mutations);

  const openReceivables = receivables.filter(isOpenStatus);
  const openPayables = payables.filter(isOpenStatus);

  const totalUangMasuk = sumRows(payments, [
    "amount",
    "payment_amount",
    "paid_amount",
    "total_paid",
  ]);

  const totalMutasiMasuk = sumRows(
    walletMutations.filter((row) => {
      return String(row?.direction || "").toUpperCase() === "IN";
    }),
    ["amount"]
  );

  const totalPiutangTerbuka = sumRows(openReceivables, [
    "remaining_amount",
    "outstanding_amount",
    "amount",
    "total_amount",
  ]);

  const totalHutangTerbuka = sumRows(openPayables, [
    "remaining_amount",
    "outstanding_amount",
    "original_amount",
    "amount",
    "total_amount",
  ]);

  return {
    bridgeVersion: data.bridge_version || "-",
    homeLocationId: data.home_location_id || "-",

    counts: {
      lokasi: asArray(data.locations).length,
      produk: asArray(data.products).length,
      customer: asArray(data.customers).length,
      supplier: asArray(data.suppliers).length,
      dompet: asArray(data.wallets).length,

      dropAyam: asArray(data.purchases).length,
      lotAyam: asArray(data.chicken_lots).length,
      produksi: asArray(data.production_batches).length,
      stokGerak: asArray(data.stock_movements).length,
      stokJadiLayer: asArray(data.inventory_cost_layers).length,

      order: asArray(data.orders).length,
      invoice: asArray(data.invoices).length,
      payment: payments.length,
      piutang: receivables.length,
      hutang: payables.length,

      kasKeluar: asArray(data.cash_expenses).length,
      setoranCabang: asArray(data.branch_deposits).length,
      arsip: asArray(data.archives).length,
      searchIndex: asArray(data.search_index).length,
    },

    money: {
      totalUangMasuk,
      totalUangMasukLabel: formatRupiah(totalUangMasuk),

      totalMutasiMasuk,
      totalMutasiMasukLabel: formatRupiah(totalMutasiMasuk),

      totalPiutangTerbuka,
      totalPiutangTerbukaLabel: formatRupiah(totalPiutangTerbuka),

      totalHutangTerbuka,
      totalHutangTerbukaLabel: formatRupiah(totalHutangTerbuka),
    },
  };
}
