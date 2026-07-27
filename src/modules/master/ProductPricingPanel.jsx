import { useEffect, useMemo, useState } from "react";

import {
  createProductPriceRule,
  getProductPricingBootstrap,
  productPricingHealth,
  resolveProductSellingPrice,
  setProductPriceRuleStatus,
  updateProductPriceRule,
} from "../../lib/api/actions";

import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";

const EMPTY_DRAFT = {
  product_id: "",
  location_id: "",
  customer_id: "",
  price_type: "NORMAL",
  unit: "pcs",
  min_qty: "1",
  max_qty: "",
  selling_price: "",
  effective_from: "",
  effective_to: "",
  priority: "",
  notes: "",
};

const EMPTY_RESOLVER = {
  product_id: "",
  location_id: "",
  customer_id: "",
  price_type: "NORMAL",
  unit: "pcs",
  qty: "1",
  transaction_date: "",
};

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanText(value) {
  return String(value ?? "").trim();
}

function numberValue(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) {
    return fallback;
  }

  const parsed = Number(
    String(value).replace(/[^0-9.-]/g, "")
  );

  return Number.isFinite(parsed) ? parsed : fallback;
}

function safeText(value, fallback = "-") {
  return cleanText(value) || fallback;
}

function localDateString() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function makeOperationId(action) {
  return [
    "OP-PRICING",
    cleanText(action || "WRITE").toUpperCase(),
    Date.now(),
    Math.random().toString(16).slice(2),
  ].join("-");
}

function isAuthRequired(result) {
  const message = String(
    result?.message || result?.error?.message || ""
  ).toUpperCase();

  const code = String(
    result?.error?.code || result?.code || ""
  ).toUpperCase();

  return (
    code.includes("AUTH_REQUIRED") ||
    message.includes("AUTH_REQUIRED") ||
    (message.includes("SESSION") &&
      (message.includes("TIDAK AKTIF") ||
        message.includes("KADALUWARSA")))
  );
}

function parseActive(row) {
  const raw =
    row?.active ?? row?.is_active ?? row?.status ?? "ACTIVE";

  const value = String(raw).trim().toUpperCase();

  return ![
    "FALSE",
    "0",
    "NO",
    "INACTIVE",
    "NONAKTIF",
    "DISABLED",
    "DELETED",
    "VOID",
    "ARCHIVED",
  ].includes(value);
}

function formatRupiah(value) {
  const amount = numberValue(value, 0);

  if (!amount) {
    return "-";
  }

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function normalizeProduct(row) {
  const productId = cleanText(
    row?.product_id || row?.id || row?.product_code
  );

  return {
    ...row,
    product_id: productId,
    product_code: cleanText(row?.product_code),
    product_name: cleanText(
      row?.product_name || row?.name || row?.product_code
    ),
    unit: cleanText(
      row?.unit || row?.selling_unit || row?.default_unit || "pcs"
    ),
    active: parseActive(row),
  };
}

function normalizeLocation(row) {
  const locationId = cleanText(
    row?.location_id || row?.id || row?.location_code
  );

  return {
    ...row,
    location_id: locationId,
    location_code: cleanText(row?.location_code),
    location_name: cleanText(
      row?.location_name || row?.name || row?.location_code
    ),
    active: parseActive(row),
  };
}

function normalizeCustomer(row) {
  const customerId = cleanText(
    row?.customer_id || row?.id || row?.customer_code
  );

  return {
    ...row,
    customer_id: customerId,
    customer_code: cleanText(row?.customer_code),
    customer_name: cleanText(
      row?.customer_name || row?.name || row?.customer_code
    ),
    price_type: cleanText(row?.price_type).toUpperCase(),
    active: parseActive(row),
  };
}

function normalizeRule(row) {
  const priceRuleId = cleanText(
    row?.price_rule_id ||
      row?.rule_id ||
      row?.price_id ||
      row?.id
  );

  const productId = cleanText(row?.product_id);
  const locationId = cleanText(row?.location_id);
  const customerId = cleanText(row?.customer_id);

  return {
    ...row,
    id: priceRuleId,
    price_rule_id: priceRuleId,
    rule_id: priceRuleId,
    product_id: productId,
    product_code: cleanText(row?.product_code),
    product_name: cleanText(
      row?.product_name || row?.product_code || productId
    ),
    location_id: locationId,
    location_code: cleanText(row?.location_code),
    location_name: cleanText(
      row?.location_name || row?.location_code || locationId
    ),
    customer_id: customerId,
    customer_code: cleanText(row?.customer_code),
    customer_name: cleanText(
      row?.customer_name || row?.customer_code || customerId
    ),
    price_type: cleanText(
      row?.price_type || row?.rule_type || row?.tier_type || "NORMAL"
    ).toUpperCase(),
    unit: cleanText(
      row?.unit || row?.selling_unit || row?.price_unit || "pcs"
    ).toLowerCase(),
    min_qty: numberValue(
      row?.min_qty ?? row?.minimum_qty ?? row?.qty_from,
      1
    ),
    max_qty:
      row?.max_qty === null ||
      row?.max_qty === undefined ||
      row?.max_qty === ""
        ? ""
        : numberValue(row?.max_qty ?? row?.maximum_qty ?? row?.qty_to),
    selling_price: numberValue(
      row?.selling_price ??
        row?.unit_price ??
        row?.price ??
        row?.amount,
      0
    ),
    effective_from: cleanText(
      row?.effective_from ||
        row?.effective_start ||
        row?.valid_from ||
        row?.start_date
    ),
    effective_to: cleanText(
      row?.effective_to ||
        row?.effective_end ||
        row?.valid_to ||
        row?.end_date
    ),
    priority: numberValue(row?.priority ?? row?.rule_priority, 0),
    notes: cleanText(row?.notes || row?.description),
    active: parseActive(row),
    status: parseActive(row) ? "ACTIVE" : "INACTIVE",
  };
}

function uniqueBy(rows, key) {
  const result = [];
  const seen = new Set();

  for (const row of rows) {
    const value = cleanText(row?.[key]);

    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    result.push(row);
  }

  return result;
}

function normalizeBootstrap(result, fallbackProducts = []) {
  const data = result?.data || result || {};

  const rules = asArray(
    data.rules ||
      data.price_rules ||
      data.product_price_rules ||
      data.rows ||
      data.items
  ).map(normalizeRule);

  const products = uniqueBy(
    [
      ...asArray(
        data.products || data.product_options || data.master_products
      ).map(normalizeProduct),
      ...asArray(fallbackProducts).map(normalizeProduct),
    ],
    "product_id"
  );

  const locations = uniqueBy(
    asArray(
      data.locations || data.location_options || data.master_locations
    ).map(normalizeLocation),
    "location_id"
  );

  const customers = uniqueBy(
    asArray(
      data.customers || data.customer_options || data.master_customers
    ).map(normalizeCustomer),
    "customer_id"
  );

  const explicitWritePolicy =
    data?.write_policy?.writes_enabled ??
    data?.writes_enabled ??
    data?.live_write_ready;

  return {
    rules,
    products,
    locations,
    customers,
    price_types: asArray(
      data.price_types || data.price_type_options
    ),
    units: asArray(data.units || data.unit_options),
    source_of_truth: cleanText(
      data.source_of_truth || "PHP_MYSQL"
    ),
    summary: {
      total_rules: numberValue(
        data?.summary?.total_rules ??
          data?.summary?.rule_count ??
          data?.pagination?.total ??
          rules.length,
        rules.length
      ),
      active_rules: numberValue(
        data?.summary?.active_rules ??
          data?.summary?.active_count ??
          rules.filter((row) => row.active).length,
        rules.filter((row) => row.active).length
      ),
      inactive_rules: numberValue(
        data?.summary?.inactive_rules ??
          data?.summary?.inactive_count ??
          rules.filter((row) => !row.active).length,
        rules.filter((row) => !row.active).length
      ),
    },
    write_policy: {
      writes_enabled:
        explicitWritePolicy === undefined
          ? null
          : Boolean(explicitWritePolicy),
      physical_delete_allowed: Boolean(
        data?.write_policy?.physical_delete_allowed
      ),
    },
  };
}

function normalizeHealth(result) {
  const data = result?.data || result || {};

  const ready = Boolean(
    data.ready ??
      data.pricing_ready ??
      data.engine_ready ??
      data.tables_ready ??
      result?.success
  );

  return {
    ready,
    read_ready: Boolean(data.read_ready ?? ready),
    write_ready: Boolean(
      data.write_ready ?? data.live_write_ready ?? ready
    ),
    source_of_truth: cleanText(
      data.source_of_truth || "PHP_MYSQL"
    ),
    table_name: cleanText(
      data.table_name || data.table || "product_price_rules"
    ),
  };
}

function ruleToDraft(rule) {
  return {
    product_id: cleanText(rule?.product_id),
    location_id: cleanText(rule?.location_id),
    customer_id: cleanText(rule?.customer_id),
    price_type: cleanText(rule?.price_type || "NORMAL").toUpperCase(),
    unit: cleanText(rule?.unit || "pcs").toLowerCase(),
    min_qty: String(rule?.min_qty ?? "1"),
    max_qty:
      rule?.max_qty === "" ||
      rule?.max_qty === null ||
      rule?.max_qty === undefined
        ? ""
        : String(rule.max_qty),
    selling_price:
      numberValue(rule?.selling_price, 0) > 0
        ? String(numberValue(rule.selling_price, 0))
        : "",
    effective_from: cleanText(rule?.effective_from),
    effective_to: cleanText(rule?.effective_to),
    priority:
      numberValue(rule?.priority, 0) > 0
        ? String(numberValue(rule.priority, 0))
        : "",
    notes: cleanText(rule?.notes),
  };
}

function scopeLabel(rule) {
  if (rule.customer_id) {
    return `Customer: ${safeText(rule.customer_name, rule.customer_id)}`;
  }

  if (rule.location_id) {
    return `Lokasi: ${safeText(rule.location_name, rule.location_id)}`;
  }

  return "Semua lokasi / customer";
}

function quantityLabel(rule) {
  if (rule.max_qty !== "" && numberValue(rule.max_qty, 0) > 0) {
    return `${rule.min_qty}–${rule.max_qty} ${rule.unit}`;
  }

  return `Mulai ${rule.min_qty} ${rule.unit}`;
}

function periodLabel(rule) {
  if (!rule.effective_from && !rule.effective_to) {
    return "Tanpa periode";
  }

  return `${safeText(rule.effective_from)} → ${safeText(
    rule.effective_to,
    "seterusnya"
  )}`;
}

export default function ProductPricingPanel({
  sessionToken,
  products = [],
  masterWriteEnabled = true,
  onSessionExpired,
  onPricingChanged,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusSaving, setStatusSaving] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [health, setHealth] = useState(() => normalizeHealth({}));
  const [bootstrap, setBootstrap] = useState(() =>
    normalizeBootstrap({}, products)
  );
  const [draft, setDraft] = useState(() => ({ ...EMPTY_DRAFT }));
  const [editingId, setEditingId] = useState("");
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("");
  const [resolver, setResolver] = useState(() => ({
    ...EMPTY_RESOLVER,
    transaction_date: localDateString(),
  }));
  const [resolverResult, setResolverResult] = useState(null);

  const productOptions = useMemo(
    () =>
      uniqueBy(
        [
          ...bootstrap.products,
          ...asArray(products).map(normalizeProduct),
        ],
        "product_id"
      ).filter((row) => row.active !== false),
    [bootstrap.products, products]
  );

  const locationOptions = useMemo(
    () => bootstrap.locations.filter((row) => row.active !== false),
    [bootstrap.locations]
  );

  const customerOptions = useMemo(
    () => bootstrap.customers.filter((row) => row.active !== false),
    [bootstrap.customers]
  );

  const priceTypeOptions = useMemo(() => {
    const values = [
      "NORMAL",
      "RESELLER",
      "MITRA",
      "KHUSUS",
      ...bootstrap.price_types.map((item) =>
        cleanText(
          typeof item === "string"
            ? item
            : item?.value || item?.code || item?.price_type
        ).toUpperCase()
      ),
      ...bootstrap.rules.map((row) => row.price_type),
    ].filter(Boolean);

    return [...new Set(values)];
  }, [bootstrap.price_types, bootstrap.rules]);

  const unitOptions = useMemo(() => {
    const values = [
      "pcs",
      "porsi",
      "mika",
      ...bootstrap.units.map((item) =>
        cleanText(
          typeof item === "string"
            ? item
            : item?.value || item?.code || item?.unit
        ).toLowerCase()
      ),
      ...productOptions.map((row) => row.unit),
      ...bootstrap.rules.map((row) => row.unit),
    ].filter(Boolean);

    return [...new Set(values)];
  }, [bootstrap.rules, bootstrap.units, productOptions]);

  const writeEnabled =
    masterWriteEnabled !== false &&
    health.ready &&
    health.write_ready &&
    bootstrap.write_policy.writes_enabled !== false;

  const filteredRules = useMemo(() => {
    const term = search.trim().toLowerCase();

    return bootstrap.rules.filter((row) => {
      if (statusFilter === "ACTIVE" && !row.active) {
        return false;
      }

      if (statusFilter === "INACTIVE" && row.active) {
        return false;
      }

      if (productFilter && row.product_id !== productFilter) {
        return false;
      }

      if (!term) {
        return true;
      }

      return JSON.stringify(row).toLowerCase().includes(term);
    });
  }, [bootstrap.rules, productFilter, search, statusFilter]);

  const columns = useMemo(
    () => [
      {
        key: "product_name",
        label: "Produk",
        render: (row) => (
          <div>
            <strong>{safeText(row.product_name, row.product_id)}</strong>
            <div className="da-muted">{safeText(row.price_rule_id)}</div>
          </div>
        ),
      },
      {
        key: "scope",
        label: "Cakupan",
        render: (row) => scopeLabel(row),
      },
      {
        key: "price_type",
        label: "Tipe / Qty",
        render: (row) => (
          <div>
            <strong>{safeText(row.price_type)}</strong>
            <div className="da-muted">{quantityLabel(row)}</div>
          </div>
        ),
      },
      {
        key: "selling_price",
        label: "Harga Jual",
        render: (row) => formatRupiah(row.selling_price),
      },
      {
        key: "period",
        label: "Berlaku",
        render: (row) => periodLabel(row),
      },
      {
        key: "status",
        label: "Status",
        render: (row) => (
          <Badge tone={row.active ? "success" : "warning"}>
            {row.active ? "Aktif" : "Nonaktif"}
          </Badge>
        ),
      },
    ],
    []
  );

  async function loadPricing() {
    setLoading(true);
    setError("");

    try {
      const [healthResult, pricingResult] = await Promise.all([
        productPricingHealth(sessionToken),
        getProductPricingBootstrap(sessionToken, {
          include_inactive: true,
          limit: 500,
        }),
      ]);

      if (
        isAuthRequired(healthResult) ||
        isAuthRequired(pricingResult)
      ) {
        onSessionExpired?.();
        return;
      }

      if (!healthResult?.success) {
        setError(
          healthResult?.message ||
            "Health Pricing Engine belum bisa dibaca."
        );
        return;
      }

      if (!pricingResult?.success) {
        setError(
          pricingResult?.message ||
            "Aturan harga belum bisa dibaca."
        );
        return;
      }

      setHealth(normalizeHealth(healthResult));
      setBootstrap(normalizeBootstrap(pricingResult, products));
    } catch (err) {
      setError(
        err?.message || "Gagal membaca Product Pricing Engine."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!sessionToken) {
      setLoading(false);
      setError("Session PHP/MySQL belum tersedia.");
      return;
    }

    loadPricing();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  function updateDraft(key, value) {
    setDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateResolver(key, value) {
    setResolver((current) => ({
      ...current,
      [key]: value,
    }));

    setResolverResult(null);
  }

  function resetDraft() {
    setDraft({ ...EMPTY_DRAFT });
    setEditingId("");
    setError("");
    setSuccess("");
  }

  function startEdit(rule) {
    if (!rule?.price_rule_id) {
      return;
    }

    setEditingId(rule.price_rule_id);
    setDraft(ruleToDraft(rule));
    setSelected(null);
    setError("");
    setSuccess("");

    requestAnimationFrame(() => {
      document
        .getElementById("product-pricing-live-form")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  }

  function validateDraft() {
    if (!cleanText(draft.product_id)) {
      return "Produk wajib dipilih.";
    }

    if (!cleanText(draft.price_type)) {
      return "Tipe harga wajib dipilih.";
    }

    if (!cleanText(draft.unit)) {
      return "Satuan harga wajib dipilih.";
    }

    if (numberValue(draft.min_qty, 0) < 1) {
      return "Minimum qty minimal 1.";
    }

    if (
      draft.max_qty !== "" &&
      numberValue(draft.max_qty, 0) < numberValue(draft.min_qty, 1)
    ) {
      return "Maximum qty tidak boleh lebih kecil dari minimum qty.";
    }

    if (numberValue(draft.selling_price, 0) <= 0) {
      return "Nominal harga jual wajib diisi lebih dari 0.";
    }

    if (!cleanText(draft.effective_from)) {
      return "Tanggal mulai berlaku wajib diisi.";
    }

    if (
      cleanText(draft.effective_to) &&
      cleanText(draft.effective_to) < cleanText(draft.effective_from)
    ) {
      return "Tanggal selesai tidak boleh sebelum tanggal mulai.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!writeEnabled) {
      setError(
        "Pricing LIVE WRITE belum siap. Refresh panel dan cek backend PHP/MySQL."
      );
      return;
    }

    const validationError = validateDraft();

    if (validationError) {
      setError(validationError);
      return;
    }

    const operationId = makeOperationId(
      editingId ? "UPDATE" : "CREATE"
    );

    const sellingPrice = numberValue(draft.selling_price, 0);
    const minQty = numberValue(draft.min_qty, 1);
    const maxQty =
      draft.max_qty === "" ? null : numberValue(draft.max_qty, 0);
    const priority =
      draft.priority === "" ? null : numberValue(draft.priority, 0);

    const payload = {
      product_id: cleanText(draft.product_id),
      location_id: cleanText(draft.location_id),
      customer_id: cleanText(draft.customer_id),
      price_type: cleanText(draft.price_type).toUpperCase(),
      unit: cleanText(draft.unit).toLowerCase(),
      min_qty: minQty,
      minimum_qty: minQty,
      max_qty: maxQty,
      maximum_qty: maxQty,
      selling_price: sellingPrice,
      unit_price: sellingPrice,
      price: sellingPrice,
      effective_from: cleanText(draft.effective_from),
      effective_start: cleanText(draft.effective_from),
      effective_to: cleanText(draft.effective_to),
      effective_end: cleanText(draft.effective_to),
      priority,
      notes: cleanText(draft.notes),
      operation_id: operationId,
      request_id: operationId,
      idempotency_key: operationId,
    };

    if (editingId) {
      payload.price_rule_id = editingId;
      payload.rule_id = editingId;
      payload.price_id = editingId;
    }

    setSaving(true);

    try {
      const result = editingId
        ? await updateProductPriceRule(sessionToken, payload)
        : await createProductPriceRule(sessionToken, payload);

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(
          result?.message || "Aturan harga belum bisa disimpan."
        );
        return;
      }

      setSuccess(
        result?.message ||
          (editingId
            ? "Aturan harga berhasil diperbarui."
            : "Aturan harga berhasil dibuat.")
      );

      setDraft({ ...EMPTY_DRAFT });
      setEditingId("");
      setResolverResult(null);
      await loadPricing();
      await onPricingChanged?.();
    } catch (err) {
      setError(
        err?.message || "Gagal menyimpan aturan harga."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(rule) {
    if (!rule?.price_rule_id || statusSaving) {
      return;
    }

    if (!writeEnabled) {
      setError("Pricing LIVE WRITE belum siap.");
      return;
    }

    const nextActive = !rule.active;
    const confirmed = window.confirm(
      nextActive
        ? `Aktifkan kembali aturan ${rule.price_rule_id}?`
        : `Nonaktifkan aturan ${rule.price_rule_id}?\n\nAturan tidak dihapus dan riwayat tetap tersimpan.`
    );

    if (!confirmed) {
      return;
    }

    const operationId = makeOperationId(
      nextActive ? "ACTIVATE" : "DEACTIVATE"
    );

    setStatusSaving(true);
    setError("");
    setSuccess("");

    try {
      const result = await setProductPriceRuleStatus(
        sessionToken,
        {
          price_rule_id: rule.price_rule_id,
          rule_id: rule.price_rule_id,
          price_id: rule.price_rule_id,
          active: nextActive,
          status: nextActive ? "ACTIVE" : "INACTIVE",
          reason: nextActive
            ? "Diaktifkan kembali dari Master Produk"
            : "Dinonaktifkan dari Master Produk",
          operation_id: operationId,
          request_id: operationId,
          idempotency_key: operationId,
        }
      );

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(
          result?.message || "Status aturan harga belum bisa diubah."
        );
        return;
      }

      setSuccess(
        result?.message || "Status aturan harga berhasil diubah."
      );
      setSelected(null);
      setResolverResult(null);
      await loadPricing();
      await onPricingChanged?.();
    } catch (err) {
      setError(
        err?.message || "Gagal mengubah status aturan harga."
      );
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleResolve(event) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setResolverResult(null);

    if (!cleanText(resolver.product_id)) {
      setError("Pilih produk untuk simulasi resolusi harga.");
      return;
    }

    if (numberValue(resolver.qty, 0) < 1) {
      setError("Qty simulasi minimal 1.");
      return;
    }

    setResolving(true);

    try {
      const result = await resolveProductSellingPrice(
        sessionToken,
        {
          product_id: cleanText(resolver.product_id),
          location_id: cleanText(resolver.location_id),
          customer_id: cleanText(resolver.customer_id),
          price_type: cleanText(resolver.price_type).toUpperCase(),
          unit: cleanText(resolver.unit).toLowerCase(),
          qty: numberValue(resolver.qty, 1),
          quantity: numberValue(resolver.qty, 1),
          transaction_date:
            cleanText(resolver.transaction_date) || localDateString(),
          effective_date:
            cleanText(resolver.transaction_date) || localDateString(),
          date:
            cleanText(resolver.transaction_date) || localDateString(),
        }
      );

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(
          result?.message || "Resolusi harga belum bisa dijalankan."
        );
        return;
      }

      setResolverResult(result?.data || {});
    } catch (err) {
      setError(err?.message || "Gagal menjalankan resolusi harga.");
    } finally {
      setResolving(false);
    }
  }

  const resolvedFound = Boolean(
    resolverResult?.resolved ??
      resolverResult?.found ??
      resolverResult?.matched ??
      resolverResult?.success
  );

  const resolvedRule =
    resolverResult?.rule ||
    resolverResult?.matched_rule ||
    resolverResult?.price_rule ||
    null;

  const resolvedPrice = numberValue(
    resolverResult?.selling_price ??
      resolverResult?.unit_price ??
      resolverResult?.price ??
      resolvedRule?.selling_price ??
      resolvedRule?.unit_price ??
      resolvedRule?.price,
    0
  );

  return (
    <div style={{ marginTop: 20 }}>
      <Card>
        <div className="da-backend-panel">
          <div>
            <div className="da-dashboard-banner-kicker">
              Product Pricing Engine
            </div>

            <div className="da-dashboard-banner-title">
              Aturan Harga Jual Bertingkat
            </div>

            <div className="da-dashboard-banner-desc">
              Produk → Cakupan → Qty → Harga → Order
            </div>

            <p className="da-muted">
              Harga jual dikelola sebagai rule terpisah dari HPP. Panel ini tidak
              membuat harga otomatis, tidak memasukkan seed, dan tidak mengubah
              modal historis produksi.
            </p>
          </div>

          <div className="da-dashboard-banner-actions">
            <Badge tone={health.ready ? "success" : "warning"}>
              {health.ready ? "Engine Ready" : "Engine Belum Siap"}
            </Badge>

            <Badge tone={writeEnabled ? "success" : "warning"}>
              {writeEnabled ? "Pricing Live Write" : "Read Only"}
            </Badge>

            <Button
              type="button"
              variant="ghost"
              onClick={loadPricing}
              disabled={loading}
            >
              {loading ? "Memuat..." : "Refresh Pricing"}
            </Button>
          </div>
        </div>
      </Card>

      {error ? <div className="da-form-warning">{error}</div> : null}
      {success ? <div className="da-form-success">{success}</div> : null}

      <div className="da-grid da-grid-3">
        <StatCard
          label="Total Aturan"
          value={bootstrap.summary.total_rules}
          description="Rule harga tersimpan di PHP/MySQL."
        />

        <StatCard
          label="Aktif"
          value={bootstrap.summary.active_rules}
          description="Rule yang dapat dipilih mesin harga."
        />

        <StatCard
          tone={bootstrap.summary.inactive_rules ? "warning" : "default"}
          label="Nonaktif"
          value={bootstrap.summary.inactive_rules}
          description="Tetap tersimpan untuk audit dan riwayat."
        />
      </div>

      <div id="product-pricing-live-form">
        <Card>
          <div className="da-section-heading">
            <div>
              <span>Pricing PHP/MySQL</span>
              <h2>
                {editingId
                  ? `Edit Aturan ${editingId}`
                  : "Tambah Aturan Harga"}
              </h2>
              <p>
                Isi hanya setelah harga resmi disetujui. Tidak ada nominal default
                di paket ini.
              </p>
            </div>

            <Badge tone={writeEnabled ? "success" : "warning"}>
              {editingId
                ? "Mode Edit"
                : writeEnabled
                ? "Live Write Siap"
                : "Terkunci"}
            </Badge>
          </div>

          <div className="da-form-warning">
            Belum boleh memasukkan harga nyata pada tahap pemasangan dan smoke test.
            Form disiapkan kosong agar tidak ada harga uji yang tertinggal di database.
          </div>

          <form onSubmit={handleSubmit}>
            <div className="da-form-grid">
              <label className="da-field">
                Produk
                <select
                  className="da-input"
                  value={draft.product_id}
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("product_id", event.target.value)
                  }
                >
                  <option value="">Pilih produk</option>
                  {productOptions.map((row) => (
                    <option key={row.product_id} value={row.product_id}>
                      {safeText(row.product_name, row.product_id)}
                      {row.product_code ? ` · ${row.product_code}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="da-field">
                Tipe Harga
                <select
                  className="da-input"
                  value={draft.price_type}
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("price_type", event.target.value)
                  }
                >
                  {priceTypeOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="da-field">
                Satuan
                <select
                  className="da-input"
                  value={draft.unit}
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("unit", event.target.value)
                  }
                >
                  {unitOptions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="da-field">
                Lokasi Khusus
                <select
                  className="da-input"
                  value={draft.location_id}
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("location_id", event.target.value)
                  }
                >
                  <option value="">Semua lokasi</option>
                  {locationOptions.map((row) => (
                    <option key={row.location_id} value={row.location_id}>
                      {safeText(row.location_name, row.location_id)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="da-field">
                Customer Khusus
                <select
                  className="da-input"
                  value={draft.customer_id}
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("customer_id", event.target.value)
                  }
                >
                  <option value="">Semua customer</option>
                  {customerOptions.map((row) => (
                    <option key={row.customer_id} value={row.customer_id}>
                      {safeText(row.customer_name, row.customer_id)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="da-field">
                Minimum Qty
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={draft.min_qty}
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("min_qty", event.target.value)
                  }
                />
              </label>

              <label className="da-field">
                Maximum Qty
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={draft.max_qty}
                  placeholder="Kosong = tanpa batas"
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("max_qty", event.target.value)
                  }
                />
              </label>

              <label className="da-field">
                Harga Jual
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={draft.selling_price}
                  placeholder="Kosong — isi setelah harga resmi disetujui"
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("selling_price", event.target.value)
                  }
                />
              </label>

              <label className="da-field">
                Mulai Berlaku
                <input
                  type="date"
                  value={draft.effective_from}
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("effective_from", event.target.value)
                  }
                />
              </label>

              <label className="da-field">
                Selesai Berlaku
                <input
                  type="date"
                  value={draft.effective_to}
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("effective_to", event.target.value)
                  }
                />
              </label>

              <label className="da-field">
                Prioritas
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={draft.priority}
                  placeholder="Opsional"
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("priority", event.target.value)
                  }
                />
              </label>

              <label className="da-field" style={{ gridColumn: "1 / -1" }}>
                Catatan
                <input
                  type="text"
                  value={draft.notes}
                  placeholder="Catatan aturan harga"
                  disabled={saving || !writeEnabled}
                  onChange={(event) =>
                    updateDraft("notes", event.target.value)
                  }
                />
              </label>
            </div>

            <div className="da-form-actions">
              <Button
                type="button"
                variant="ghost"
                onClick={resetDraft}
                disabled={saving}
              >
                {editingId ? "Batal Edit" : "Reset"}
              </Button>

              <Button
                type="submit"
                disabled={saving || !writeEnabled}
              >
                {saving
                  ? "Menyimpan..."
                  : editingId
                  ? "Simpan Perubahan"
                  : "Tambah Aturan"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <div className="da-section-heading">
          <div>
            <span>Resolver Read-Only</span>
            <h2>Cek Rule yang Akan Terpilih</h2>
            <p>
              Simulasi ini tidak menulis transaksi, tidak mengubah rule, dan tidak
              membuat harga fallback baru.
            </p>
          </div>

          <Badge tone="success">Safe Read</Badge>
        </div>

        <form onSubmit={handleResolve}>
          <div className="da-form-grid">
            <label className="da-field">
              Produk
              <select
                className="da-input"
                value={resolver.product_id}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("product_id", event.target.value)
                }
              >
                <option value="">Pilih produk</option>
                {productOptions.map((row) => (
                  <option key={row.product_id} value={row.product_id}>
                    {safeText(row.product_name, row.product_id)}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Tipe Harga
              <select
                className="da-input"
                value={resolver.price_type}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("price_type", event.target.value)
                }
              >
                {priceTypeOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Satuan
              <select
                className="da-input"
                value={resolver.unit}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("unit", event.target.value)
                }
              >
                {unitOptions.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Qty
              <input
                type="number"
                min="1"
                step="1"
                value={resolver.qty}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("qty", event.target.value)
                }
              />
            </label>

            <label className="da-field">
              Lokasi
              <select
                className="da-input"
                value={resolver.location_id}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("location_id", event.target.value)
                }
              >
                <option value="">Semua lokasi</option>
                {locationOptions.map((row) => (
                  <option key={row.location_id} value={row.location_id}>
                    {safeText(row.location_name, row.location_id)}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Customer
              <select
                className="da-input"
                value={resolver.customer_id}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("customer_id", event.target.value)
                }
              >
                <option value="">Semua customer</option>
                {customerOptions.map((row) => (
                  <option key={row.customer_id} value={row.customer_id}>
                    {safeText(row.customer_name, row.customer_id)}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Tanggal Transaksi
              <input
                type="date"
                value={resolver.transaction_date}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("transaction_date", event.target.value)
                }
              />
            </label>
          </div>

          <div className="da-form-actions">
            <Button type="submit" disabled={resolving}>
              {resolving ? "Mengecek..." : "Cek Resolusi Harga"}
            </Button>
          </div>
        </form>

        {resolverResult ? (
          <div
            className={
              resolvedFound ? "da-form-success" : "da-form-warning"
            }
            style={{ marginTop: 12 }}
          >
            {resolvedFound ? (
              <div>
                <strong>Rule ditemukan.</strong>
                <div>
                  {safeText(
                    resolvedRule?.price_rule_id ||
                      resolvedRule?.rule_id ||
                      resolverResult?.price_rule_id
                  )}
                  {resolvedPrice > 0
                    ? ` · ${formatRupiah(resolvedPrice)}`
                    : ""}
                </div>
              </div>
            ) : (
              <div>
                <strong>Belum ada rule yang cocok.</strong>
                <div>
                  Kondisi ini benar saat database pricing masih kosong. Sistem tidak
                  membuat atau menebak harga otomatis.
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="da-section-heading">
          <div>
            <span>Daftar Aturan Harga</span>
            <h2>Pricing Rules PHP/MySQL</h2>
            <p>
              Klik baris untuk melihat detail, mengedit, atau mengubah status tanpa
              menghapus riwayat.
            </p>
          </div>

          <Badge tone="success">Live Data</Badge>
        </div>

        <div className="da-filter-row">
          <input
            className="da-input"
            value={search}
            placeholder="Cari produk, rule, lokasi, customer..."
            onChange={(event) => setSearch(event.target.value)}
          />

          <select
            className="da-input"
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value)}
          >
            <option value="">Semua produk</option>
            {productOptions.map((row) => (
              <option key={row.product_id} value={row.product_id}>
                {safeText(row.product_name, row.product_id)}
              </option>
            ))}
          </select>

          <select
            className="da-input"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch("");
              setProductFilter("");
              setStatusFilter("ALL");
            }}
          >
            Reset
          </Button>
        </div>

        <DataTable
          columns={columns}
          rows={filteredRules}
          getRowKey={(row, index) =>
            row.price_rule_id || `pricing-rule-${index}`
          }
          onRowClick={(row) => setSelected(row)}
        />

        {!loading && filteredRules.length === 0 ? (
          <p className="da-muted" style={{ marginTop: 12 }}>
            Belum ada aturan harga tersimpan. Kondisi 0 rule aman dan sesuai
            checkpoint sebelum harga nyata dimasukkan.
          </p>
        ) : null}
      </Card>

      <Modal
        open={Boolean(selected)}
        title="Detail Aturan Harga"
        subtitle={safeText(selected?.price_rule_id)}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div>
            <div className="da-section-heading">
              <div>
                <span>Pricing Rule</span>
                <h2>{safeText(selected.product_name, selected.product_id)}</h2>
              </div>

              <Badge tone={selected.active ? "success" : "warning"}>
                {selected.active ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>

            <div className="da-detail-grid">
              {[
                ["price_rule_id", "ID Rule"],
                ["product_id", "ID Produk"],
                ["price_type", "Tipe Harga"],
                ["unit", "Satuan"],
                ["scope", "Cakupan"],
                ["quantity", "Rentang Qty"],
                ["price", "Harga Jual"],
                ["period", "Periode"],
                ["priority", "Prioritas"],
                ["notes", "Catatan"],
              ].map(([key, label]) => {
                let value = selected[key];

                if (key === "scope") value = scopeLabel(selected);
                if (key === "quantity") value = quantityLabel(selected);
                if (key === "price") value = formatRupiah(selected.selling_price);
                if (key === "period") value = periodLabel(selected);

                return (
                  <div className="da-detail-box" key={key}>
                    <div className="da-mini-info-label">{label}</div>
                    <div className="da-mini-info-value">
                      {safeText(value)}
                    </div>
                  </div>
                );
              })}

              <div
                className="da-modal-note da-detail-box"
                style={{ gridColumn: "1 / -1" }}
              >
                Rule tidak dihapus permanen. Perubahan status tetap menjaga data
                lama untuk audit dan transaksi historis.
              </div>
            </div>

            <div className="da-form-actions" style={{ marginTop: 16 }}>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSelected(null)}
              >
                Tutup
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => startEdit(selected)}
                disabled={!writeEnabled || statusSaving}
              >
                Edit Rule
              </Button>

              <Button
                type="button"
                onClick={() => handleStatus(selected)}
                disabled={!writeEnabled || statusSaving}
              >
                {statusSaving
                  ? "Memproses..."
                  : selected.active
                  ? "Nonaktifkan"
                  : "Aktifkan"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
