import { useEffect, useMemo, useState } from "react";

import {
  createProductPriceRule,
  getMasterDataCoreBootstrap,
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
  price_name: "",
  product_id: "",
  location_id: "",
  customer_id: "",
  price_tier: "NORMAL",
  channel_code: "",
  unit_type: "PCS",
  min_qty: "1",
  price_per_unit: "",
  effective_from: "",
  effective_to: "",
  notes: "",
};

const EMPTY_RESOLVER = {
  product_id: "",
  location_id: "",
  customer_id: "",
  price_tier: "NORMAL",
  channel_code: "",
  unit_type: "PCS",
  qty: "1",
  price_date: "",
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

  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
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

function isActive(row) {
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
  ].includes(String(row?.status ?? row?.active ?? "ACTIVE").toUpperCase());
}

function formatRupiah(value) {
  const amount = numberValue(value, 0);

  if (amount <= 0) {
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
      row?.product_name || row?.name || row?.product_code || productId
    ),
    unit: cleanText(row?.unit || "PCS").toUpperCase(),
    active: isActive(row),
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
      row?.location_name || row?.name || row?.location_code || locationId
    ),
    active: isActive(row),
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
      row?.customer_name || row?.name || row?.customer_code || customerId
    ),
    price_type: cleanText(row?.price_type || "NORMAL").toUpperCase(),
    active: isActive(row),
  };
}

function normalizeRule(row) {
  const priceId = cleanText(
    row?.price_id || row?.price_rule_id || row?.rule_id || row?.id
  );

  return {
    ...row,
    id: priceId,
    price_id: priceId,
    price_name: cleanText(row?.price_name),
    product_id: cleanText(row?.product_id),
    product_code: cleanText(row?.product_code),
    product_name: cleanText(
      row?.product_name || row?.product_code || row?.product_id
    ),
    location_id: cleanText(row?.location_id),
    location_code: cleanText(row?.location_code),
    location_name: cleanText(
      row?.location_name || row?.location_code || row?.location_id
    ),
    customer_id: cleanText(row?.customer_id),
    customer_name: cleanText(
      row?.customer_name || row?.customer_id
    ),
    price_tier: cleanText(row?.price_tier || "NORMAL").toUpperCase(),
    channel_code: cleanText(row?.channel_code).toUpperCase(),
    unit_type: cleanText(row?.unit_type || "PCS").toUpperCase(),
    min_qty: numberValue(row?.min_qty, 1),
    price_per_unit: numberValue(row?.price_per_unit, 0),
    effective_from: cleanText(row?.effective_from),
    effective_to: cleanText(row?.effective_to),
    notes: cleanText(row?.notes),
    status: isActive(row) ? "ACTIVE" : "INACTIVE",
    active: isActive(row),
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

function normalizeHealth(result) {
  const data = result?.data || result || {};
  const ready = Boolean(
    data.ready ??
      data.pricing_ready ??
      data.engine_ready ??
      result?.success
  );

  return {
    ready,
    source_of_truth: cleanText(data.source_of_truth || "PHP_MYSQL"),
    migration_applied: Boolean(data.migration_applied ?? ready),
    counts: {
      price_rules: numberValue(data?.counts?.price_rules, 0),
      unit_conversions: numberValue(data?.counts?.unit_conversions, 0),
    },
  };
}

function extractMasterRows(result, moduleType) {
  const data = result?.data || result || {};

  return asArray(
    data.rows ||
      data.items ||
      data[moduleType] ||
      data.master_rows ||
      []
  );
}

function normalizeBootstrap(result, fallbackProducts = []) {
  const data = result?.data || result || {};
  const rules = asArray(data.price_rules || data.rules || data.rows).map(
    normalizeRule
  );

  const products = uniqueBy(
    [
      ...asArray(data.products || data.master_products).map(normalizeProduct),
      ...asArray(fallbackProducts).map(normalizeProduct),
    ],
    "product_id"
  );

  const locations = uniqueBy(
    asArray(data.locations || data.master_locations).map(normalizeLocation),
    "location_id"
  );

  const customers = uniqueBy(
    asArray(data.customers || data.master_customers).map(normalizeCustomer),
    "customer_id"
  );

  const priceTiers = uniqueBy(
    [
      ...asArray(data.price_tiers || data.price_types).map((value) => ({
        value: cleanText(value?.value || value?.code || value).toUpperCase(),
      })),
      ...customers.map((row) => ({ value: row.price_type })),
      ...rules.map((row) => ({ value: row.price_tier })),
      { value: "NORMAL" },
    ],
    "value"
  )
    .map((row) => row.value)
    .filter(Boolean);

  const units = uniqueBy(
    [
      ...asArray(data.units || data.unit_types).map((value) => ({
        value: cleanText(value?.value || value?.code || value).toUpperCase(),
      })),
      ...products.map((row) => ({ value: row.unit })),
      ...rules.map((row) => ({ value: row.unit_type })),
      { value: "PCS" },
    ],
    "value"
  )
    .map((row) => row.value)
    .filter(Boolean);

  const activeRules = rules.filter((row) => row.active).length;

  return {
    rules,
    products,
    locations,
    customers,
    price_tiers: priceTiers,
    units,
    source_of_truth: cleanText(data.source_of_truth || "PHP_MYSQL"),
    summary: {
      total_rules: numberValue(data?.summary?.total_rules, rules.length),
      active_rules: numberValue(data?.summary?.active_rules, activeRules),
      inactive_rules: numberValue(
        data?.summary?.inactive_rules,
        Math.max(0, rules.length - activeRules)
      ),
    },
    write_policy: {
      writes_enabled:
        data?.write_policy?.writes_enabled === undefined
          ? true
          : Boolean(data.write_policy.writes_enabled),
      physical_delete_allowed: Boolean(
        data?.write_policy?.physical_delete_allowed
      ),
    },
  };
}

function ruleToDraft(rule) {
  return {
    price_name: cleanText(rule?.price_name),
    product_id: cleanText(rule?.product_id),
    location_id: cleanText(rule?.location_id),
    customer_id: cleanText(rule?.customer_id),
    price_tier: cleanText(rule?.price_tier || "NORMAL").toUpperCase(),
    channel_code: cleanText(rule?.channel_code).toUpperCase(),
    unit_type: cleanText(rule?.unit_type || "PCS").toUpperCase(),
    min_qty: String(rule?.min_qty ?? 1),
    price_per_unit:
      numberValue(rule?.price_per_unit, 0) > 0
        ? String(numberValue(rule.price_per_unit, 0))
        : "",
    effective_from: cleanText(rule?.effective_from),
    effective_to: cleanText(rule?.effective_to),
    notes: cleanText(rule?.notes),
  };
}

function scopeLabel(rule) {
  const parts = [safeText(rule.location_name, rule.location_id)];

  if (rule.customer_id) {
    parts.push(`Customer: ${safeText(rule.customer_name, rule.customer_id)}`);
  }

  if (rule.channel_code) {
    parts.push(`Channel: ${rule.channel_code}`);
  }

  return parts.join(" · ");
}

function periodLabel(rule) {
  return `${safeText(rule.effective_from)} → ${safeText(
    rule.effective_to,
    "seterusnya"
  )}`;
}

function messageBox(message, tone = "warning") {
  if (!message) {
    return null;
  }

  const styles = {
    success: {
      background: "#ecfdf3",
      border: "1px solid #a7f3d0",
      color: "#166534",
    },
    error: {
      background: "#fff1f2",
      border: "1px solid #fecdd3",
      color: "#9f1239",
    },
    warning: {
      background: "#fffbeb",
      border: "1px solid #fde68a",
      color: "#92400e",
    },
  };

  return (
    <div
      style={{
        ...styles[tone],
        borderRadius: 12,
        padding: "12px 14px",
        marginTop: 12,
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
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
  const [health, setHealth] = useState({
    ready: false,
    source_of_truth: "PHP_MYSQL",
    migration_applied: false,
    counts: { price_rules: 0, unit_conversions: 0 },
  });
  const [bootstrap, setBootstrap] = useState(() =>
    normalizeBootstrap({}, products)
  );
  const [draft, setDraft] = useState({ ...EMPTY_DRAFT });
  const [resolver, setResolver] = useState({
    ...EMPTY_RESOLVER,
    price_date: localDateString(),
  });
  const [resolverResult, setResolverResult] = useState(null);
  const [editingId, setEditingId] = useState("");
  const [selected, setSelected] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const writeEnabled = Boolean(
    masterWriteEnabled &&
      health.ready &&
      bootstrap.write_policy.writes_enabled
  );

  async function loadPricing() {
    if (!sessionToken) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [
        healthResult,
        bootstrapResult,
        masterProductResult,
        masterLocationResult,
      ] = await Promise.all([
        productPricingHealth(sessionToken),
        getProductPricingBootstrap(sessionToken),
        getMasterDataCoreBootstrap(sessionToken, { module_type: "produk" }),
        getMasterDataCoreBootstrap(sessionToken, { module_type: "lokasi" }),
      ]);

      if (
        isAuthRequired(healthResult) ||
        isAuthRequired(bootstrapResult) ||
        isAuthRequired(masterProductResult) ||
        isAuthRequired(masterLocationResult)
      ) {
        onSessionExpired?.();
        return;
      }

      if (!healthResult?.success) {
        throw new Error(
          healthResult?.message || "Pricing health belum bisa dibaca."
        );
      }

      if (!bootstrapResult?.success) {
        throw new Error(
          bootstrapResult?.message || "Aturan harga belum bisa dibaca."
        );
      }

      const nextHealth = normalizeHealth(healthResult);
      const masterProducts = masterProductResult?.success
        ? extractMasterRows(masterProductResult, "produk")
        : [];
      const masterLocations = masterLocationResult?.success
        ? extractMasterRows(masterLocationResult, "lokasi")
        : [];

      const nextBootstrap = normalizeBootstrap(bootstrapResult, [
        ...asArray(products),
        ...masterProducts,
      ]);

      nextBootstrap.locations = uniqueBy(
        [
          ...asArray(nextBootstrap.locations),
          ...masterLocations.map(normalizeLocation),
        ],
        "location_id"
      );

      setHealth(nextHealth);
      setBootstrap(nextBootstrap);

      const firstProduct = nextBootstrap.products.find((row) => row.active);
      const firstLocation = nextBootstrap.locations.find((row) => row.active);

      setDraft((current) => ({
        ...current,
        product_id: current.product_id || firstProduct?.product_id || "",
        location_id: current.location_id || firstLocation?.location_id || "",
        unit_type: current.unit_type || firstProduct?.unit || "PCS",
      }));

      setResolver((current) => ({
        ...current,
        product_id: current.product_id || firstProduct?.product_id || "",
        location_id: current.location_id || firstLocation?.location_id || "",
        unit_type: current.unit_type || firstProduct?.unit || "PCS",
        price_date: current.price_date || localDateString(),
      }));
    } catch (err) {
      setError(err?.message || "Aturan harga belum bisa dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPricing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken]);

  // MasterDataPage dan Pricing Engine dimuat paralel. Pada render pertama,
  // daftar produk dari parent bisa masih kosong. Ketika master produk selesai
  // dibaca, gabungkan props terbaru tanpa memanggil ulang Pricing API dan
  // tanpa menghapus rules/lokasi/customer yang sudah ada.
  useEffect(() => {
    const incomingProducts = asArray(products).map(normalizeProduct);

    if (incomingProducts.length === 0) {
      return;
    }

    setBootstrap((current) => {
      const mergedProducts = uniqueBy(
        [...asArray(current.products), ...incomingProducts],
        "product_id"
      );

      if (
        mergedProducts.length === asArray(current.products).length &&
        mergedProducts.every(
          (row, index) =>
            row.product_id === current.products[index]?.product_id &&
            row.product_name === current.products[index]?.product_name &&
            row.active === current.products[index]?.active
        )
      ) {
        return current;
      }

      return {
        ...current,
        products: mergedProducts,
      };
    });

    const firstActiveProduct = incomingProducts.find((row) => row.active);

    if (!firstActiveProduct) {
      return;
    }

    setDraft((current) =>
      current.product_id
        ? current
        : {
            ...current,
            product_id: firstActiveProduct.product_id,
            unit_type: firstActiveProduct.unit || current.unit_type || "PCS",
          }
    );

    setResolver((current) =>
      current.product_id
        ? current
        : {
            ...current,
            product_id: firstActiveProduct.product_id,
            unit_type: firstActiveProduct.unit || current.unit_type || "PCS",
          }
    );
  }, [products]);

  const productOptions = useMemo(
    () => bootstrap.products.filter((row) => row.active),
    [bootstrap.products]
  );

  const locationOptions = useMemo(
    () => bootstrap.locations.filter((row) => row.active),
    [bootstrap.locations]
  );

  const customerOptions = useMemo(
    () => bootstrap.customers.filter((row) => row.active),
    [bootstrap.customers]
  );

  const filteredRules = useMemo(() => {
    const query = cleanText(search).toLowerCase();

    return bootstrap.rules.filter((row) => {
      if (productFilter && row.product_id !== productFilter) {
        return false;
      }

      if (statusFilter && row.status !== statusFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        row.price_id,
        row.price_name,
        row.product_code,
        row.product_name,
        row.location_code,
        row.location_name,
        row.customer_name,
        row.price_tier,
        row.channel_code,
        row.unit_type,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [bootstrap.rules, productFilter, search, statusFilter]);

  function updateDraft(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateResolver(key, value) {
    setResolver((current) => ({ ...current, [key]: value }));
    setResolverResult(null);
  }

  function resetDraft() {
    const firstProduct = productOptions[0];
    const firstLocation = locationOptions[0];

    setDraft({
      ...EMPTY_DRAFT,
      product_id: firstProduct?.product_id || "",
      location_id: firstLocation?.location_id || "",
      unit_type: firstProduct?.unit || "PCS",
    });
    setEditingId("");
    setError("");
    setSuccess("");
  }

  function startEdit(rule) {
    if (!rule?.price_id) {
      return;
    }

    setDraft(ruleToDraft(rule));
    setEditingId(rule.price_id);
    setSelected(null);
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function validateDraft() {
    if (!cleanText(draft.price_name)) {
      return "Nama aturan harga wajib diisi.";
    }

    if (!cleanText(draft.product_id)) {
      return "Produk wajib dipilih.";
    }

    if (!cleanText(draft.location_id)) {
      return "Lokasi wajib dipilih.";
    }

    if (!cleanText(draft.price_tier)) {
      return "Tipe harga wajib dipilih.";
    }

    if (!cleanText(draft.unit_type)) {
      return "Satuan harga wajib dipilih.";
    }

    if (numberValue(draft.min_qty, 0) <= 0) {
      return "Minimal qty harus lebih dari 0.";
    }

    if (numberValue(draft.price_per_unit, 0) <= 0) {
      return "Nominal harga jual wajib lebih dari 0.";
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
      setError("Penyimpanan harga belum siap.");
      return;
    }

    const validationError = validateDraft();

    if (validationError) {
      setError(validationError);
      return;
    }

    const operationId = makeOperationId(editingId ? "UPDATE" : "CREATE");
    const payload = {
      price_name: cleanText(draft.price_name),
      product_id: cleanText(draft.product_id),
      location_id: cleanText(draft.location_id),
      customer_id: cleanText(draft.customer_id),
      price_tier: cleanText(draft.price_tier).toUpperCase(),
      channel_code: cleanText(draft.channel_code).toUpperCase(),
      unit_type: cleanText(draft.unit_type).toUpperCase(),
      min_qty: numberValue(draft.min_qty, 1),
      price_per_unit: numberValue(draft.price_per_unit, 0),
      effective_from: cleanText(draft.effective_from),
      effective_to: cleanText(draft.effective_to),
      notes: cleanText(draft.notes),
      operation_id: operationId,
      request_id: operationId,
      idempotency_key: operationId,
    };

    if (editingId) {
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
        setError(result?.message || "Aturan harga belum bisa disimpan.");
        return;
      }

      setSuccess(
        result?.message ||
          (editingId
            ? "Aturan harga berhasil diperbarui."
            : "Aturan harga berhasil dibuat.")
      );
      setEditingId("");
      setDraft({ ...EMPTY_DRAFT });
      setFormOpen(false);
      setResolverResult(null);
      await loadPricing();
      await onPricingChanged?.();
    } catch (err) {
      setError(err?.message || "Aturan harga belum bisa disimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(rule) {
    if (!rule?.price_id || statusSaving) {
      return;
    }

    const nextActive = !rule.active;
    setStatusSaving(true);
    setError("");
    setSuccess("");

    try {
      const operationId = makeOperationId(
        nextActive ? "ACTIVATE" : "DEACTIVATE"
      );
      const result = await setProductPriceRuleStatus(sessionToken, {
        price_id: rule.price_id,
        active: nextActive,
        reason: nextActive
          ? "Diaktifkan kembali dari Master Produk"
          : "Dinonaktifkan dari Master Produk",
        operation_id: operationId,
        request_id: operationId,
        idempotency_key: operationId,
      });

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Status aturan belum bisa diubah.");
        return;
      }

      setSuccess(result?.message || "Status aturan berhasil diubah.");
      setSelected(null);
      setStatusTarget(null);
      await loadPricing();
      await onPricingChanged?.();
    } catch (err) {
      setError(err?.message || "Status aturan belum bisa diubah.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleResolve(event) {
    event.preventDefault();
    setError("");
    setResolverResult(null);

    if (!cleanText(resolver.product_id)) {
      setError("Pilih produk untuk simulasi harga.");
      return;
    }

    if (!cleanText(resolver.location_id)) {
      setError("Pilih lokasi untuk simulasi harga.");
      return;
    }

    if (numberValue(resolver.qty, 0) <= 0) {
      setError("Qty simulasi harus lebih dari 0.");
      return;
    }

    setResolving(true);

    try {
      const result = await resolveProductSellingPrice(sessionToken, {
        product_id: cleanText(resolver.product_id),
        location_id: cleanText(resolver.location_id),
        customer_id: cleanText(resolver.customer_id),
        price_tier: cleanText(resolver.price_tier || "NORMAL").toUpperCase(),
        channel_code: cleanText(resolver.channel_code).toUpperCase(),
        unit_type: cleanText(resolver.unit_type || "PCS").toUpperCase(),
        qty: numberValue(resolver.qty, 1),
        price_date: cleanText(resolver.price_date) || localDateString(),
      });

      if (isAuthRequired(result)) {
        onSessionExpired?.();
        return;
      }

      if (!result?.success) {
        setError(result?.message || "Resolusi harga belum bisa dijalankan.");
        return;
      }

      setResolverResult(result?.data || result);
    } catch (err) {
      setError(err?.message || "Resolusi harga belum bisa dijalankan.");
    } finally {
      setResolving(false);
    }
  }

  const resolvedFound = Boolean(resolverResult?.resolved);
  const resolvedPrice = numberValue(resolverResult?.price_per_unit, 0);
  const resolvedRule = resolverResult?.price_rule
    ? normalizeRule(resolverResult.price_rule)
    : null;

  const columns = [
    {
      key: "price_name",
      label: "Aturan",
      render: (row) => (
        <div>
          <strong>{safeText(row.price_name)}</strong>
          <div className="da-muted">{safeText(row.price_id)}</div>
        </div>
      ),
    },
    {
      key: "product",
      label: "Produk",
      render: (row) => (
        <div>
          <strong>{safeText(row.product_name)}</strong>
          <div className="da-muted">{safeText(row.product_code)}</div>
        </div>
      ),
    },
    {
      key: "scope",
      label: "Cakupan",
      render: (row) => scopeLabel(row),
    },
    {
      key: "tier_qty",
      label: "Tipe / Qty",
      render: (row) => (
        <div>
          <strong>{safeText(row.price_tier)}</strong>
          <div className="da-muted">
            Mulai {row.min_qty} {row.unit_type}
          </div>
        </div>
      ),
    },
    {
      key: "price_per_unit",
      label: "Harga Jual",
      render: (row) => formatRupiah(row.price_per_unit),
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
  ];

  return (
    <div style={{ display: "grid", gap: 16, marginTop: 18 }}>
      <Card>
        <div className="da-section-heading">
          <div>
            <span>HARGA JUAL</span>
            <h2>Aturan Harga Jual Bertingkat</h2>
            <p>
              Produk → Lokasi → Tipe Harga → Satuan → Qty → Harga Jual. HPP
              tetap terpisah dan tidak diambil dari halaman ini.
            </p>
          </div>
          <Badge tone={health.ready ? "success" : "warning"}>
            {health.ready ? "Siap Dikelola" : "Perlu Dilengkapi"}
          </Badge>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
          }}
        >
          
          <Badge tone={writeEnabled ? "success" : "warning"}>
            {writeEnabled ? "Penyimpanan Aktif" : "Belum Siap Disimpan"}
          </Badge>
          <Badge tone={health.migration_applied ? "success" : "warning"}>
            Harga Sistem {health.migration_applied ? "Aktif" : "Belum Aktif"}
          </Badge>
          <Button variant="ghost" onClick={loadPricing} disabled={loading}>
            {loading ? "Memuat..." : "Perbarui"}
          </Button>
          <Button
            type="button"
            onClick={() => {
              resetDraft();
              setFormOpen(true);
            }}
            disabled={!writeEnabled || saving}
          >
            + Tambah Aturan Harga
          </Button>
        </div>

        {messageBox(error, "error")}
        {messageBox(success, "success")}
      </Card>

      <div className="da-stat-grid">
        <StatCard
          label="Total Aturan"
          value={bootstrap.summary.total_rules}
          description="Aturan harga resmi tersimpan di sistem."
        />
        <StatCard
          label="Aktif"
          value={bootstrap.summary.active_rules}
          description="Aturan yang dapat dipakai transaksi."
          tone="success"
        />
        <StatCard
          label="Nonaktif"
          value={bootstrap.summary.inactive_rules}
          description="Tetap tersimpan untuk audit dan riwayat."
          tone="warning"
        />
      </div>

      <Card>
        <div className="da-section-heading">
          <div>
            <span>Simulasi Harga</span>
            <h2>Simulasi Harga Transaksi</h2>
            <p>
              Simulasikan harga yang akan dipilih sistem tanpa membuat transaksi.
            </p>
          </div>
          <Badge tone="success">Simulasi</Badge>
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
              Lokasi Wajib
              <select
                className="da-input"
                value={resolver.location_id}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("location_id", event.target.value)
                }
              >
                <option value="">Pilih lokasi</option>
                {locationOptions.map((row) => (
                  <option key={row.location_id} value={row.location_id}>
                    {safeText(row.location_name, row.location_id)}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Tipe Harga
              <select
                className="da-input"
                value={resolver.price_tier}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("price_tier", event.target.value)
                }
              >
                {bootstrap.price_tiers.map((value) => (
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
                value={resolver.unit_type}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("unit_type", event.target.value)
                }
              >
                {bootstrap.units.map((value) => (
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
                min="0.01"
                step="0.01"
                value={resolver.qty}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("qty", event.target.value)
                }
              />
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
                <option value="">Customer umum</option>
                {customerOptions.map((row) => (
                  <option key={row.customer_id} value={row.customer_id}>
                    {safeText(row.customer_name, row.customer_id)}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Channel
              <input
                type="text"
                value={resolver.channel_code}
                placeholder="Opsional"
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("channel_code", event.target.value.toUpperCase())
                }
              />
            </label>

            <label className="da-field">
              Tanggal Harga
              <input
                type="date"
                value={resolver.price_date}
                disabled={resolving}
                onChange={(event) =>
                  updateResolver("price_date", event.target.value)
                }
              />
            </label>
          </div>

          <div className="da-form-actions">
            <Button type="submit" disabled={resolving || loading}>
              {resolving ? "Mengecek..." : "Cek Resolusi Harga"}
            </Button>
          </div>
        </form>

        {resolverResult
          ? messageBox(
              resolvedFound
                ? `Rule ${safeText(
                    resolverResult.price_rule_id
                  )} ditemukan: ${formatRupiah(resolvedPrice)} per ${safeText(
                    resolverResult.unit_type
                  )}.`
                : resolverResult.message ||
                    "Belum ada aturan harga yang cocok. Sistem tidak menebak harga.",
              resolvedFound ? "success" : "warning"
            )
          : null}
      </Card>

      <Card>
        <div className="da-section-heading">
          <div>
            <span>Daftar Aturan Harga</span>
            <h2>Aturan Harga Resmi</h2>
            <p>
              Klik baris untuk detail, edit, atau mengubah status tanpa menghapus
              riwayat.
            </p>
          </div>
          <Badge tone="success">Data Aktual</Badge>
        </div>

        <div className="da-toolbar">
          <input
            type="search"
            value={search}
            placeholder="Cari ID, nama aturan, produk, lokasi..."
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
            <option value="">Semua status</option>
            <option value="ACTIVE">Aktif</option>
            <option value="INACTIVE">Nonaktif</option>
          </select>
          <Button
            variant="ghost"
            onClick={() => {
              setSearch("");
              setProductFilter("");
              setStatusFilter("");
            }}
          >
            Reset
          </Button>
        </div>

        <DataTable
          columns={columns}
          rows={filteredRules}
          getRowKey={(row, index) => row.price_id || `price-${index}`}
          onRowClick={setSelected}
        />

        {bootstrap.rules.length === 0 ? (
          <p className="da-muted" style={{ marginTop: 10 }}>
            Belum ada aturan harga resmi. Tambahkan aturan saat harga operasional sudah ditetapkan.
          </p>
        ) : null}
      </Card>

      <Modal
        open={formOpen}
        title={editingId ? "Edit Aturan Harga" : "Tambah Aturan Harga"}
        subtitle="Harga resmi per produk, lokasi, tipe harga, qty, customer, dan periode berlaku."
        onClose={() => {
          if (saving) return;
          resetDraft();
          setFormOpen(false);
        }}
        size="lg"
      >
        {bootstrap.rules.length === 0
          ? messageBox(
              "Belum ada aturan harga resmi. Tambahkan hanya setelah harga operasional disetujui.",
              "warning"
            )
          : null}
        <form id="product-pricing-live-form" onSubmit={handleSubmit}>
          <div className="da-form-grid" style={{ marginTop: 14 }}>
            <label className="da-field">
              Nama Aturan Harga
              <input
                type="text"
                value={draft.price_name}
                placeholder="Contoh nama internal setelah disetujui"
                disabled={saving || !writeEnabled}
                onChange={(event) =>
                  updateDraft("price_name", event.target.value)
                }
              />
            </label>

            <label className="da-field">
              Produk
              <select
                className="da-input"
                value={draft.product_id}
                disabled={saving || !writeEnabled}
                onChange={(event) => {
                  const productId = event.target.value;
                  const product = productOptions.find(
                    (row) => row.product_id === productId
                  );
                  setDraft((current) => ({
                    ...current,
                    product_id: productId,
                    unit_type: product?.unit || current.unit_type || "PCS",
                  }));
                }}
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
              Lokasi Wajib
              <select
                className="da-input"
                value={draft.location_id}
                disabled={saving || !writeEnabled}
                onChange={(event) =>
                  updateDraft("location_id", event.target.value)
                }
              >
                <option value="">Pilih lokasi</option>
                {locationOptions.map((row) => (
                  <option key={row.location_id} value={row.location_id}>
                    {safeText(row.location_name, row.location_id)}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Tipe Harga
              <select
                className="da-input"
                value={draft.price_tier}
                disabled={saving || !writeEnabled}
                onChange={(event) =>
                  updateDraft("price_tier", event.target.value)
                }
              >
                {bootstrap.price_tiers.map((value) => (
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
                value={draft.unit_type}
                disabled={saving || !writeEnabled}
                onChange={(event) =>
                  updateDraft("unit_type", event.target.value)
                }
              >
                {bootstrap.units.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Minimal Qty
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={draft.min_qty}
                disabled={saving || !writeEnabled}
                onChange={(event) =>
                  updateDraft("min_qty", event.target.value)
                }
              />
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
                <option value="">Umum / tidak khusus customer</option>
                {customerOptions.map((row) => (
                  <option key={row.customer_id} value={row.customer_id}>
                    {safeText(row.customer_name, row.customer_id)}
                  </option>
                ))}
              </select>
            </label>

            <label className="da-field">
              Channel Khusus
              <input
                type="text"
                value={draft.channel_code}
                placeholder="Opsional, mis. POS / WA / OUTLET"
                disabled={saving || !writeEnabled}
                onChange={(event) =>
                  updateDraft("channel_code", event.target.value.toUpperCase())
                }
              />
            </label>

            <label className="da-field">
              Harga Jual per Satuan
              <input
                type="number"
                min="1"
                step="1"
                value={draft.price_per_unit}
                placeholder="Kosong sampai harga resmi disetujui"
                disabled={saving || !writeEnabled}
                onChange={(event) =>
                  updateDraft("price_per_unit", event.target.value)
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

            <label className="da-field" style={{ gridColumn: "1 / -1" }}>
              Catatan
              <input
                type="text"
                value={draft.notes}
                placeholder="Catatan internal aturan harga"
                disabled={saving || !writeEnabled}
                onChange={(event) => updateDraft("notes", event.target.value)}
              />
            </label>
          </div>

          <div className="da-modal-sticky-actions">
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                resetDraft();
                setFormOpen(false);
              }}
              disabled={saving}
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving || !writeEnabled}>
              {saving
                ? "Menyimpan..."
                : editingId
                ? "Simpan Perubahan"
                : "Tambah Aturan"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(selected)}
        title={safeText(selected?.price_name, "Detail Aturan Harga")}
        subtitle={safeText(selected?.price_id)}
        onClose={() => setSelected(null)}
      >
        {selected ? (
          <div style={{ display: "grid", gap: 14 }}>
            <div className="da-detail-grid">
              {[
                ["Produk", selected.product_name],
                ["Lokasi", selected.location_name],
                ["Tipe Harga", selected.price_tier],
                ["Satuan", selected.unit_type],
                ["Minimal Qty", selected.min_qty],
                ["Harga Jual", formatRupiah(selected.price_per_unit)],
                ["Customer", selected.customer_name || "Umum"],
                ["Channel", selected.channel_code || "Semua channel"],
                ["Mulai", selected.effective_from],
                ["Selesai", selected.effective_to || "Seterusnya"],
                ["Status", selected.status],
                ["Catatan", selected.notes || "-"],
              ].map(([label, value]) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>{safeText(value)}</strong>
                </div>
              ))}
            </div>

            <div className="da-form-actions">
              <Button
                variant="ghost"
                onClick={() => startEdit(selected)}
                disabled={!writeEnabled || statusSaving}
              >
                Edit
              </Button>
              <Button
                variant={selected.active ? "ghost" : "primary"}
                onClick={() => setStatusTarget(selected)}
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

      <Modal
        open={Boolean(statusTarget)}
        title={statusTarget?.active ? "Nonaktifkan Aturan Harga?" : "Aktifkan Aturan Harga?"}
        subtitle={safeText(statusTarget?.price_id)}
        onClose={() => !statusSaving && setStatusTarget(null)}
        size="md"
      >
        {statusTarget ? (
          <div style={{ display: "grid", gap: 16 }}>
            <div className="da-modal-note">
              {statusTarget.active
                ? "Aturan ini tidak lagi dipilih untuk transaksi baru. Riwayat harga pada transaksi lama tetap terkunci."
                : "Aturan ini kembali tersedia untuk transaksi sesuai lokasi, tipe harga, satuan, customer, qty, dan tanggal berlaku."}
            </div>
            <div className="da-modal-sticky-actions">
              <Button variant="ghost" onClick={() => setStatusTarget(null)} disabled={statusSaving}>
                Batal
              </Button>
              <Button onClick={() => handleStatus(statusTarget)} disabled={statusSaving}>
                {statusSaving ? "Memproses..." : statusTarget.active ? "Ya, Nonaktifkan" : "Ya, Aktifkan"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
