export function asArray(value) {
  return Array.isArray(value) ? value : [];
}

export function safeText(value, fallback = "-") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

export function compactText(value) {
  return String(value ?? "").trim();
}

export function isAuthRequired(result) {
  const message = String(result?.message || result?.error?.message || "").toUpperCase();
  const code = String(result?.error?.code || result?.code || "").toUpperCase();

  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") && message.includes("TIDAK AKTIF"))
  );
}

export function moduleLabel(value) {
  return safeText(String(value || "").replaceAll("_", " "));
}

export function getToneByStatus(status) {
  const text = String(status || "").toUpperCase();

  if (
    text.includes("AMAN") ||
    text.includes("LUNAS") ||
    text.includes("POSTED") ||
    text.includes("CLOSED") ||
    text.includes("APPROVED") ||
    text.includes("SELESAI") ||
    text.includes("TERCATAT") ||
    text.includes("ACTIVE")
  ) {
    return "success";
  }

  if (
    text.includes("BELUM") ||
    text.includes("OPEN") ||
    text.includes("PARTIAL") ||
    text.includes("DRAFT") ||
    text.includes("PENDING") ||
    text.includes("PERLU") ||
    text.includes("MENUNGGU")
  ) {
    return "warning";
  }

  if (
    text.includes("VOID") ||
    text.includes("CANCEL") ||
    text.includes("BATAL") ||
    text.includes("REJECT") ||
    text.includes("ERROR")
  ) {
    return "danger";
  }

  return "default";
}

export function normalizeUniversalDetail(rawDetail, fallback = {}) {
  const detail = rawDetail || {};
  const main = detail.main || detail.record || detail.data || {};
  const timeline = asArray(detail.timeline || detail.related_records || detail.relations || detail.rantai);
  const audit = asArray(detail.audit_trail || detail.audit || detail.logs);
  const relationIds = asArray(detail.relation_ids || detail.related_ids || detail.ids);

  const normalizedMain = {
    ...main,
    source_id:
      main.source_id ||
      main.id ||
      main.transaction_id ||
      fallback.sourceId ||
      fallback.focusId ||
      "",
    source_module:
      main.source_module ||
      main.module ||
      main.source_label ||
      fallback.sourceModule ||
      "ARSIP",
    title:
      main.title ||
      main.description ||
      main.product_name ||
      main.customer_name ||
      main.supplier_name ||
      fallback.title ||
      fallback.sourceId ||
      "Detail transaksi",
    description: main.description || main.title || fallback.message || "",
    date: main.date || main.created_at || main.tanggal || fallback.date || "",
    amount: main.amount || main.nominal || main.total || main.grand_total || 0,
    status: main.status || fallback.status || "Tercatat",
    raw: main.raw || main.record || main,
  };

  const relationSet = new Set();
  relationIds.forEach((id) => {
    const text = compactText(id);
    if (text) relationSet.add(text);
  });

  [
    normalizedMain.source_id,
    normalizedMain.order_id,
    normalizedMain.invoice_id,
    normalizedMain.payment_id,
    normalizedMain.stock_movement_id,
    normalizedMain.drop_id,
    normalizedMain.lot_id,
    normalizedMain.payable_id,
    normalizedMain.wallet_mutation_id,
  ].forEach((id) => {
    const text = compactText(id);
    if (text) relationSet.add(text);
  });

  timeline.forEach((row) => {
    const id = compactText(row.source_id || row.id || row.transaction_id || row.ref_id);
    if (id) relationSet.add(id);
  });

  return {
    ...detail,
    main: normalizedMain,
    timeline,
    related_records: timeline,
    audit_trail: audit,
    relation_ids: Array.from(relationSet),
  };
}

export function buildFallbackDetail({ sourceId, sourceModule, message }) {
  return normalizeUniversalDetail(
    {
      main: {
        source_id: sourceId,
        source_module: sourceModule || "ARSIP",
        title: message || "Detail transaksi belum ditemukan di arsip universal.",
        description: message || "Detail transaksi belum ditemukan di arsip universal.",
        amount: 0,
        status: "Perlu Dicek",
        raw: {
          source_id: sourceId,
          source_module: sourceModule || "",
          note: "Cek apakah ID sudah masuk Arsip Digital, source_id, atau search index.",
        },
      },
      timeline: [],
      relation_ids: sourceId ? [sourceId] : [],
      audit_trail: [],
    },
    { sourceId, sourceModule }
  );
}
