import { useEffect, useMemo, useState } from "react";

import {
  createMasterDataCoreRecord,
  getMasterDataCoreBootstrap,
  setMasterDataCoreStatus,
  updateMasterDataCoreRecord,
} from "../../lib/api/actions";

import Badge from "../../components/ui/Badge";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import DataTable from "../../components/ui/DataTable";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import StatCard from "../../components/ui/StatCard";

import ProductPricingPanel from "./ProductPricingPanel";
import PricingCutoverPanel from "./PricingCutoverPanel";
import TangerangGoLiveCutoverPanel from "./TangerangGoLiveCutoverPanel";
import BranchCommercePanel from "./BranchCommercePanel";

const PROTECTED_IDS = {
  produk: ["PRD-DIMSUM"],
  customer: [],
  supplier: ["SUP-001"],
  lokasi: ["LOC-TGR-001"],
};

const MODULE_CONFIG = {
  produk: {
    title: "Master Produk",
    badge: "Master Aktif",

    description:
      "Data produk/menu yang dipakai oleh produksi, stok, order, PO, dan laporan.",

    introTitle:
      "Produk Jadi & Menu Usaha",

    introFlow:
      "Produk → Harga → Stok → Order → Arsip",

    introDesc:
      "Nama dan kode produk harus konsisten supaya kabel stok, kasir, PO, dan HPP tidak putus.",

    tableTitle:
      "Produk yang Terdaftar",

    emptyText:
      "Belum ada produk terbaca.",

    idKey:
      "product_id",

    defaultDraft: {
      product_code: "",
      product_name: "",
      category: "Barang Jadi",
      unit: "pcs",
      notes:
        "Produk aktif untuk transaksi ERP.",
    },

    fields: [
      {
        key: "product_code",
        label: "Kode Produk",
        placeholder: "DIMSUM",
        lockedOnEdit: true,
      },

      {
        key: "product_name",
        label: "Nama Produk",
        placeholder: "Dimsum Ayam Mix",
        required: true,
      },

      {
        key: "category",
        label: "Kategori",
        placeholder: "Barang Jadi",
      },

      {
        key: "unit",
        label: "Satuan",
        placeholder: "pcs",
      },

      {
        key: "notes",
        label: "Catatan",
        placeholder: "Catatan produk",
      },
    ],

    columns: [
      {
        key: "product_code",
        label: "Kode",
      },

      {
        key: "product_name",
        label: "Produk",
      },

      {
        key: "category",
        label: "Kategori",
      },

      {
        key: "unit",
        label: "Satuan",
      },

      {
        key: "price_rule_count",
        label: "Aturan Harga",

        render: (row) =>
          `${Number(
            row.price_rule_count || 0
          )} aturan`,
      },

      {
        key: "status",
        label: "Status",

        render: (row) => (
          <Badge
            tone={
              row.active
                ? "success"
                : "warning"
            }
          >
            {row.active
              ? "Aktif"
              : "Nonaktif"}
          </Badge>
        ),
      },
    ],

    detailFields: [
      [
        "product_id",
        "ID Produk",
      ],

      [
        "product_code",
        "Kode Produk",
      ],

      [
        "product_name",
        "Nama Produk",
      ],

      [
        "category",
        "Kategori",
      ],

      [
        "unit",
        "Satuan",
      ],

      [
        "price_rule_count",
        "Aturan Harga",
      ],

      [
        "status",
        "Status",
      ],

      [
        "notes",
        "Catatan",
      ],
    ],

    formNote:
      "Harga jual tidak disimpan sebagai satu harga tetap di Master Produk. Harga akan dikelola per lokasi, tipe harga, satuan, dan customer. HPP tetap berasal dari DROP Ayam → Produksi/Adukan → modal historis.",
  },

  customer: {
    title:
      "Master Customer",

    badge:
      "Customer Aktif",

    description:
      "Data pelanggan untuk kasir/order, harga khusus, piutang, riwayat pembelian, dan follow-up.",

    introTitle:
      "Pelanggan & Riwayat Order",

    introFlow:
      "Customer → Order → Piutang → Uang Masuk → Arsip",

    introDesc:
      "Customer yang sama jangan dibuat berulang supaya riwayat pembelian dan piutang tetap menyatu.",

    tableTitle:
      "Customer yang Terdaftar",

    emptyText:
      "Belum ada customer terbaca.",

    idKey:
      "customer_id",

    defaultDraft: {
      customer_name: "",
      phone: "",
      area: "",
      price_type: "NORMAL",
      notes: "Customer aktif.",
    },

    fields: [
      {
        key: "customer_name",
        label: "Nama Customer",
        placeholder: "Nama pelanggan",
        required: true,
      },

      {
        key: "phone",
        label: "No HP / WA",
        placeholder: "08xxx",
      },

      {
        key: "area",
        label: "Area",
        placeholder:
          "Tangerang / Bogor",
      },

      {
        key: "price_type",
        label: "Tipe Harga",
        placeholder:
          "NORMAL / RESELLER / KHUSUS",
      },

      {
        key: "notes",
        label: "Catatan",
        placeholder:
          "Catatan customer",
      },
    ],

    columns: [
      {
        key: "customer_name",
        label: "Customer",
      },

      {
        key: "phone",
        label: "Kontak",
      },

      {
        key: "area",
        label: "Area",
      },

      {
        key: "price_type",
        label: "Tipe Harga",
      },

      {
        key: "status",
        label: "Status",

        render: (row) => (
          <Badge
            tone={
              row.active
                ? "success"
                : "warning"
            }
          >
            {row.active
              ? "Aktif"
              : "Nonaktif"}
          </Badge>
        ),
      },
    ],

    detailFields: [
      [
        "customer_id",
        "ID Customer",
      ],

      [
        "customer_code",
        "Kode Customer",
      ],

      [
        "customer_name",
        "Nama Customer",
      ],

      [
        "phone",
        "No HP / WA",
      ],

      [
        "area",
        "Area",
      ],

      [
        "price_type",
        "Tipe Harga",
      ],

      [
        "status",
        "Status",
      ],

      [
        "notes",
        "Catatan",
      ],
    ],

    formNote:
      "Customer tidak dibuat otomatis. Buat hanya customer nyata supaya order, piutang, pembayaran, dan riwayat pembelian tidak terpecah.",
  },

  supplier: {
    title:
      "Master Supplier",

    badge:
      "Supplier Aktif",

    description:
      "Data supplier untuk pembelian, hutang, pembayaran, dan arsip.",

    introTitle:
      "Supplier & Kewajiban",

    introFlow:
      "Supplier → Nota → Hutang → Bayar → Mutasi Dompet",

    introDesc:
      "Supplier harus konsisten supaya nota, hutang, pembayaran, dan arsip bisa ditelusuri.",

    tableTitle:
      "Supplier yang Terdaftar",

    emptyText:
      "Belum ada supplier terbaca.",

    idKey:
      "supplier_id",

    defaultDraft: {
      supplier_name: "",
      supplier_type:
        "Bahan Baku",
      phone: "",
      default_wallet: "",
      notes:
        "Supplier aktif.",
    },

    fields: [
      {
        key: "supplier_name",
        label: "Nama Supplier",
        placeholder:
          "Nama supplier",
        required: true,
      },

      {
        key: "supplier_type",
        label: "Jenis Supplier",
        placeholder:
          "Ayam / Bahan Baku / Packaging",
      },

      {
        key: "phone",
        label: "Kontak",
        placeholder: "08xxx",
      },

      {
        key: "default_wallet",
        label: "Jalur Bayar Biasa",
        placeholder:
          "BCA / BRI / Cash",
      },

      {
        key: "notes",
        label: "Catatan",
        placeholder:
          "Catatan supplier",
      },
    ],

    columns: [
      {
        key: "supplier_name",
        label: "Supplier",
      },

      {
        key: "supplier_type",
        label: "Jenis",
      },

      {
        key: "phone",
        label: "Kontak",
      },

      {
        key: "default_wallet",
        label: "Jalur Bayar",
      },

      {
        key: "status",
        label: "Status",

        render: (row) => (
          <Badge
            tone={
              row.active
                ? "success"
                : "warning"
            }
          >
            {row.active
              ? "Aktif"
              : "Nonaktif"}
          </Badge>
        ),
      },
    ],

    detailFields: [
      [
        "supplier_id",
        "ID Supplier",
      ],

      [
        "supplier_code",
        "Kode Supplier",
      ],

      [
        "supplier_name",
        "Nama Supplier",
      ],

      [
        "supplier_type",
        "Jenis Supplier",
      ],

      [
        "phone",
        "Kontak",
      ],

      [
        "default_wallet",
        "Jalur Bayar",
      ],

      [
        "status",
        "Status",
      ],

      [
        "notes",
        "Catatan",
      ],
    ],

    formNote:
      "SUP-001 NANA CHICKEN adalah supplier inti. Jangan membuat Nana kedua. Master inti dilindungi dari nonaktif.",
  },

  lokasi: {
    title:
      "Master Lokasi",

    badge:
      "Lokasi Aktif",

    description:
      "Data lokasi kerja, cabang, outlet, produksi, gudang, dan titik stok.",

    introTitle:
      "Lokasi Operasional & Titik Stok",

    introFlow:
      "Lokasi → Permission → Stok → Setoran → Monitoring",

    introDesc:
      "Setiap lokasi punya identitas sendiri. Owner/Tangerang tetap menjadi pusat monitoring dan kontrol.",

    tableTitle:
      "Lokasi yang Terdaftar",

    emptyText:
      "Belum ada lokasi terbaca.",

    idKey:
      "location_id",

    defaultDraft: {
      location_code: "",
      location_name: "",
      location_type:
        "BRANCH",
      parent_location: "TGR",
      notes:
        "Lokasi aktif.",
    },

    fields: [
      {
        key: "location_code",
        label: "Kode Lokasi",
        placeholder:
          "TGR / PML / CBN",
        required: true,
        lockedOnEdit: true,
      },

      {
        key: "location_name",
        label: "Nama Lokasi",
        placeholder:
          "Nama cabang / lokasi",
        required: true,
      },

      {
        key: "location_type",
        label: "Tipe",
        placeholder:
          "HQ / PRODUCTION / OUTLET / BRANCH / WAREHOUSE",
      },

      {
        key: "parent_location",
        label: "Induk",
        placeholder: "TGR",
      },

      {
        key: "notes",
        label: "Catatan",
        placeholder:
          "Catatan lokasi",
      },
    ],

    columns: [
      {
        key: "location_code",
        label: "Kode",
      },

      {
        key: "location_name",
        label: "Lokasi",
      },

      {
        key: "location_type",
        label: "Tipe",
      },

      {
        key: "parent_location",
        label: "Induk",
      },

      {
        key: "status",
        label: "Status",

        render: (row) => (
          <Badge
            tone={
              row.active
                ? "success"
                : "warning"
            }
          >
            {row.active
              ? "Aktif"
              : "Nonaktif"}
          </Badge>
        ),
      },
    ],

    detailFields: [
      [
        "location_id",
        "ID Lokasi",
      ],

      [
        "location_code",
        "Kode Lokasi",
      ],

      [
        "location_name",
        "Nama Lokasi",
      ],

      [
        "location_type",
        "Tipe",
      ],

      [
        "parent_location",
        "Induk",
      ],

      [
        "status",
        "Status",
      ],

      [
        "notes",
        "Catatan",
      ],
    ],

    formNote:
      "LOC-TGR-001 Tangerang HO adalah lokasi inti. Lokasi baru hanya dibuat untuk operasi nyata dan nantinya akun/permission mengikuti lokasi tersebut.",
  },
};

function asArray(value) {
  return Array.isArray(value)
    ? value
    : [];
}

function numberValue(value) {
  const parsed = Number(
    String(
      value ?? "0"
    ).replace(
      /[^0-9.-]/g,
      ""
    )
  );

  return Number.isFinite(
    parsed
  )
    ? parsed
    : 0;
}

function safeText(
  value,
  fallback = "-"
) {
  const text = String(
    value ?? ""
  ).trim();

  return text || fallback;
}

function cleanValue(value) {
  return String(
    value ?? ""
  ).trim();
}

function makeOperationId(
  moduleType,
  action
) {
  return [
    "OP-MASTER",
    String(
      moduleType || "MASTER"
    ).toUpperCase(),
    action,
    Date.now(),
    Math.random()
      .toString(16)
      .slice(2),
  ].join("-");
}

function isAuthRequired(
  result
) {
  const message = String(
    result?.message ||
      result?.error?.message ||
      ""
  ).toUpperCase();

  const code = String(
    result?.error?.code ||
      result?.code ||
      ""
  ).toUpperCase();

  return (
    code.includes(
      "AUTH_REQUIRED"
    ) ||
    message.includes(
      "AUTH_REQUIRED"
    ) ||
    (
      message.includes(
        "SESSION"
      ) &&
      message.includes(
        "TIDAK AKTIF"
      )
    )
  );
}

function normalizeRow(
  row,
  moduleType
) {
  const activeRaw =
    row?.active ??
    row?.is_active ??
    row?.status ??
    "TRUE";

  const activeText =
    String(
      activeRaw
    )
      .trim()
      .toUpperCase();

  const active =
    ![
      "FALSE",
      "NO",
      "0",
      "NONAKTIF",
      "INACTIVE",
      "DELETED",
      "DISABLED",
      "VOID",
    ].includes(
      activeText
    );

  if (
    moduleType === "produk"
  ) {
    const productId =
      cleanValue(
        row.product_id ||
          row.id
      );

    return {
      ...row,

      id:
        productId ||
        cleanValue(
          row.product_code
        ),

      master_id:
        productId,

      product_id:
        productId,

      product_code:
        cleanValue(
          row.product_code
        ),

      product_name:
        cleanValue(
          row.product_name
        ),

      category:
        cleanValue(
          row.category
        ),

      unit:
        cleanValue(
          row.unit
        ),

      price_rule_count:
        numberValue(
          row.price_rule_count
        ),

      active,

      notes:
        cleanValue(
          row.notes
        ),
    };
  }

  if (
    moduleType === "customer"
  ) {
    const customerId =
      cleanValue(
        row.customer_id ||
          row.id
      );

    return {
      ...row,

      id:
        customerId ||
        cleanValue(
          row.customer_name
        ),

      master_id:
        customerId,

      customer_id:
        customerId,

      customer_name:
        cleanValue(
          row.customer_name
        ),

      phone:
        cleanValue(
          row.phone
        ),

      area:
        cleanValue(
          row.area
        ),

      price_type:
        cleanValue(
          row.price_type
        ),

      active,

      notes:
        cleanValue(
          row.notes
        ),
    };
  }

  if (
    moduleType === "supplier"
  ) {
    const supplierId =
      cleanValue(
        row.supplier_id ||
          row.id
      );

    return {
      ...row,

      id:
        supplierId ||
        cleanValue(
          row.supplier_name
        ),

      master_id:
        supplierId,

      supplier_id:
        supplierId,

      supplier_code:
        cleanValue(
          row.supplier_code
        ),

      supplier_name:
        cleanValue(
          row.supplier_name
        ),

      supplier_type:
        cleanValue(
          row.supplier_type
        ),

      phone:
        cleanValue(
          row.phone
        ),

      default_wallet:
        cleanValue(
          row.default_wallet
        ),

      active,

      notes:
        cleanValue(
          row.notes
        ),
    };
  }

  const locationId =
    cleanValue(
      row.location_id ||
        row.id
    );

  return {
    ...row,

    id:
      locationId ||
      cleanValue(
        row.location_code
      ),

    master_id:
      locationId,

    location_id:
      locationId,

    location_code:
      cleanValue(
        row.location_code
      ),

    location_name:
      cleanValue(
        row.location_name
      ),

    location_type:
      cleanValue(
        row.location_type
      ),

    parent_location:
      cleanValue(
        row.parent_location
      ),

    active,

    notes:
      cleanValue(
        row.notes
      ),
  };
}

function normalizePayload(
  payload,
  moduleType
) {
  const data =
    payload?.data ||
    payload ||
    {};

  const rows =
    asArray(
      data.rows ||
        data.items ||
        data[moduleType] ||
        []
    ).map(
      (row) =>
        normalizeRow(
          row,
          moduleType
        )
    );

  return {
    rows,

    source_of_truth:
      data.source_of_truth ||
      "PHP_MYSQL",

    summary: {
      total_rows:
        numberValue(
          data.summary
            ?.total_rows ??
            rows.length
        ),

      active_rows:
        numberValue(
          data.summary
            ?.active_rows ??
            rows.filter(
              (row) =>
                row.active
            ).length
        ),

      inactive_rows:
        numberValue(
          data.summary
            ?.inactive_rows ??
            rows.filter(
              (row) =>
                !row.active
            ).length
        ),

      missing_id_rows:
        numberValue(
          data.summary
            ?.missing_id_rows ??
            rows.filter(
              (row) =>
                !row.master_id
            ).length
        ),
    },

    write_policy: {
      writes_enabled:
        Boolean(
          data.write_policy
            ?.writes_enabled
        ),

      legacy_seed_enabled:
        Boolean(
          data.write_policy
            ?.legacy_seed_enabled
        ),

      physical_delete_allowed:
        Boolean(
          data.write_policy
            ?.physical_delete_allowed
        ),
    },
  };
}

function rowToDraft(
  row,
  config
) {
  const next = {
    ...config.defaultDraft,
  };

  for (
    const field
    of config.fields
  ) {
    if (
      row?.[field.key] !==
        undefined &&
      row?.[field.key] !==
        null
    ) {
      next[field.key] =
        String(
          row[field.key]
        );
    }
  }

  return next;
}

export default function MasterDataPage({
  moduleType = "produk",
  session,
  onSessionExpired,
}) {
  const config =
    MODULE_CONFIG[
      moduleType
    ] ||
    MODULE_CONFIG.produk;

  const sessionToken =
    session?.sessionToken ||
    "";

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    statusSaving,
    setStatusSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    bootstrap,
    setBootstrap,
  ] = useState(
    () =>
      normalizePayload(
        {},
        moduleType
      )
  );

  const [
    draft,
    setDraft,
  ] = useState(
    () => ({
      ...config.defaultDraft,
    })
  );

  const [
    editingId,
    setEditingId,
  ] = useState("");

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    pricingRefreshKey,
    setPricingRefreshKey,
  ] = useState(0);

  const writeEnabled =
    bootstrap
      .write_policy
      .writes_enabled ===
    true;

  const viewColumns =
    useMemo(
      () =>
        (
          config.columns ||
          []
        ).map(
          (column) =>
            column.render
              ? column
              : {
                  ...column,

                  render:
                    (row) =>
                      safeText(
                        row[
                          column
                            .key
                        ]
                      ),
                }
        ),

      [config.columns]
    );

  const filteredRows =
    useMemo(
      () => {
        const term =
          search
            .trim()
            .toLowerCase();

        if (!term) {
          return bootstrap.rows;
        }

        return (
          bootstrap.rows ||
          []
        ).filter(
          (row) =>
            JSON.stringify(
              row
            )
              .toLowerCase()
              .includes(
                term
              )
        );
      },

      [
        bootstrap.rows,
        search,
      ]
    );

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const result =
        await getMasterDataCoreBootstrap(
          sessionToken,
          {
            module_type:
              moduleType,
          }
        );

      if (
        isAuthRequired(
          result
        )
      ) {
        onSessionExpired?.();
        return;
      }

      if (
        !result?.success
      ) {
        setError(
          result?.message ||
            "Data master belum bisa dibaca."
        );

        return;
      }

      setBootstrap(
        normalizePayload(
          result,
          moduleType
        )
      );
    } catch (err) {
      setError(
        err?.message ||
          "Gagal membaca master data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(
    () => {
      setDraft({
        ...config.defaultDraft,
      });

      setEditingId("");
      setSearch("");
      setSelected(null);
      setSuccess("");
      setError("");

      loadData();

      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [moduleType]
  );

  function updateDraft(
    key,
    value
  ) {
    setDraft(
      (current) => ({
        ...current,
        [key]: value,
      })
    );
  }

  function resetDraft() {
    setDraft({
      ...config.defaultDraft,
    });

    setEditingId("");
    setSuccess("");
    setError("");
  }

  function isProtected(
    row
  ) {
    const id = String(
      row?.master_id ||
        row?.id ||
        ""
    );

    return (
      PROTECTED_IDS[
        moduleType
      ] ||
      []
    ).includes(id);
  }

  function startEdit(row) {
    if (
      !row?.master_id
    ) {
      return;
    }

    setEditingId(
      row.master_id
    );

    setDraft(
      rowToDraft(
        row,
        config
      )
    );

    setSelected(null);
    setError("");
    setSuccess("");

    requestAnimationFrame(
      () => {
        document
          .getElementById(
            "master-live-form"
          )
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "start",
          });
      }
    );
  }

  async function handleSubmit(
    event
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !writeEnabled
    ) {
      setError(
        "Penyimpanan master belum siap. Refresh halaman lalu cek Data Health."
      );

      return;
    }

    const requiredField =
      config.fields.find(
        (field) =>
          field.required &&
          !String(
            draft[
              field.key
            ] ||
              ""
          ).trim()
      );

    if (
      requiredField
    ) {
      setError(
        `${requiredField.label} wajib diisi.`
      );

      return;
    }

    const operationId =
      makeOperationId(
        moduleType,

        editingId
          ? "UPDATE"
          : "CREATE"
      );

    const payload = {
      module_type:
        moduleType,

      ...draft,

      operation_id:
        operationId,

      request_id:
        operationId,

      idempotency_key:
        operationId,
    };

    if (editingId) {
      payload.master_id =
        editingId;

      payload[
        config.idKey
      ] = editingId;
    }

    setSaving(true);

    try {
      const result =
        editingId
          ? await updateMasterDataCoreRecord(
              sessionToken,
              payload
            )
          : await createMasterDataCoreRecord(
              sessionToken,
              payload
            );

      if (
        isAuthRequired(
          result
        )
      ) {
        onSessionExpired?.();
        return;
      }

      if (
        !result?.success
      ) {
        setError(
          result?.message ||
            "Master data belum bisa disimpan."
        );

        return;
      }

      setSuccess(
        result?.message ||
          (
            editingId
              ? "Master data berhasil diperbarui."
              : "Master data berhasil dibuat."
          )
      );

      setDraft({
        ...config.defaultDraft,
      });

      setEditingId("");

      await loadData();
    } catch (err) {
      setError(
        err?.message ||
          "Gagal menyimpan master data."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatus(
    row
  ) {
    if (
      !row?.master_id ||
      statusSaving
    ) {
      return;
    }

    const nextActive =
      !row.active;

    if (
      !nextActive &&
      isProtected(row)
    ) {
      setError(
        "Master inti ini dilindungi dan tidak boleh dinonaktifkan."
      );

      return;
    }

    const displayName =
      row.product_name ||
      row.customer_name ||
      row.supplier_name ||
      row.location_name ||
      row.master_id;

    const confirmed =
      window.confirm(
        nextActive
          ? `Aktifkan kembali ${displayName}?`
          : `Nonaktifkan ${displayName}?\n\nData tidak dihapus. Riwayat lama tetap tersimpan.`
      );

    if (!confirmed) {
      return;
    }

    const operationId =
      makeOperationId(
        moduleType,

        nextActive
          ? "ACTIVATE"
          : "DEACTIVATE"
      );

    setStatusSaving(
      true
    );

    setError("");
    setSuccess("");

    try {
      const result =
        await setMasterDataCoreStatus(
          sessionToken,
          {
            module_type:
              moduleType,

            master_id:
              row.master_id,

            [
              config.idKey
            ]:
              row.master_id,

            active:
              nextActive,

            reason:
              nextActive
                ? "Diaktifkan kembali dari Master Data"
                : "Dinonaktifkan dari Master Data",

            operation_id:
              operationId,

            request_id:
              operationId,

            idempotency_key:
              operationId,
          }
        );

      if (
        isAuthRequired(
          result
        )
      ) {
        onSessionExpired?.();
        return;
      }

      if (
        !result?.success
      ) {
        setError(
          result?.message ||
            "Status master belum bisa diubah."
        );

        return;
      }

      setSuccess(
        result?.message ||
          "Status master berhasil diubah."
      );

      setSelected(null);

      await loadData();
    } catch (err) {
      setError(
        err?.message ||
          "Gagal mengubah status master."
      );
    } finally {
      setStatusSaving(
        false
      );
    }
  }

  return (
    <div>
      <PageHeader
        title={
          config.title
        }

        description={
          config.description
        }

        badge={
          config.badge
        }
      />

      <Card>
        <div className="da-backend-panel">
          <div>
            <div className="da-dashboard-banner-kicker">
              Master Data Hidup
            </div>

            <div className="da-dashboard-banner-title">
              {
                config.introTitle
              }
            </div>

            <div className="da-dashboard-banner-desc">
              {
                config.introFlow
              }
            </div>

            <p className="da-muted">
              {
                config.introDesc
              }
            </p>
          </div>

          <div className="da-dashboard-banner-actions">
            <Badge
              tone={
                error
                  ? "danger"
                  : "success"
              }
            >
              {error
                ? "Perlu Cek"
                : "Terhubung"}
            </Badge>

            <Button
              variant="ghost"

              onClick={
                loadData
              }

              disabled={
                loading
              }
            >
              {loading
                ? "Memuat..."
                : "Refresh Data"}
            </Button>

            <Badge
              tone={
                writeEnabled
                  ? "success"
                  : "warning"
              }
            >
              {writeEnabled
                ? "Penyimpanan Aktif"
                : "Pantau"}
            </Badge>
          </div>
        </div>
      </Card>

      {error ? (
        <div className="da-form-warning">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="da-form-success">
          {success}
        </div>
      ) : null}

      <div className="da-grid da-grid-3">
        <StatCard
          label="Total Data"

          value={
            bootstrap
              .summary
              .total_rows
          }

          description="Master resmi yang tersimpan di sistem."
        />

        <StatCard
          label="Aktif"

          value={
            bootstrap
              .summary
              .active_rows
          }

          description="Data yang bisa dipakai transaksi."
        />

        <StatCard
          tone={
            bootstrap
              .summary
              .inactive_rows
              ? "warning"
              : "default"
          }

          label="Nonaktif"

          value={
            bootstrap
              .summary
              .inactive_rows
          }

          description="Tetap tersimpan untuk riwayat lama."
        />
      </div>

      <div id="master-live-form">
        <Card>
          <div className="da-section-heading">
            <div>
              <span>
                Master Data Terpusat
              </span>

              <h2>
                {editingId
                  ? `Edit ${config.title}`
                  : `Tambah ${config.title}`}
              </h2>

              <p>
                {editingId
                  ? `ID ${editingId} sedang diedit. ID/kode inti dikunci supaya hubungan transaksi tetap aman.`
                  : "Data baru langsung menjadi master hidup untuk transaksi berikutnya."}
              </p>
            </div>

            <Badge
              tone={
                writeEnabled
                  ? "success"
                  : "warning"
              }
            >
              {editingId
                ? "Mode Edit"
                : writeEnabled
                ? "Penyimpanan Aktif"
                : "Terkunci"}
            </Badge>
          </div>

          <div className="da-form-warning">
            {
              config.formNote
            }
          </div>

          <form
            onSubmit={
              handleSubmit
            }
          >
            <div className="da-form-grid">
              {config.fields.map(
                (field) => {
                  const locked =
                    Boolean(
                      editingId &&
                        field.lockedOnEdit
                    );

                  return (
                    <label
                      key={
                        field.key
                      }

                      className="da-field"
                    >
                      {
                        field.label
                      }

                      <input
                        type={
                          field.type ||
                          "text"
                        }

                        value={
                          draft[
                            field
                              .key
                          ] ||
                          ""
                        }

                        placeholder={
                          field.placeholder ||
                          ""
                        }

                        disabled={
                          saving ||
                          locked ||
                          !writeEnabled
                        }

                        onChange={(
                          event
                        ) =>
                          updateDraft(
                            field.key,
                            event
                              .target
                              .value
                          )
                        }
                      />

                      {locked ? (
                        <small className="da-muted">
                          Dikunci
                          saat edit
                          supaya
                          referensi
                          transaksi
                          tidak
                          berubah.
                        </small>
                      ) : null}
                    </label>
                  );
                }
              )}
            </div>

            <div className="da-form-actions">
              <Button
                type="button"

                variant="ghost"

                onClick={
                  resetDraft
                }

                disabled={
                  saving
                }
              >
                {editingId
                  ? "Batal Edit"
                  : "Reset"}
              </Button>

              <Button
                type="submit"

                disabled={
                  saving ||
                  !writeEnabled
                }
              >
                {saving
                  ? "Menyimpan..."
                  : editingId
                  ? "Simpan Perubahan"
                  : "Tambah Master"}
              </Button>
            </div>
          </form>
        </Card>
      </div>

      <Card>
        <div className="da-section-heading">
          <div>
            <span>
              Daftar Master
            </span>

            <h2>
              {
                config.tableTitle
              }
            </h2>

            <p>
              Klik baris
              untuk lihat
              detail, edit,
              atau
              aktif/nonaktifkan.
            </p>
          </div>

          <Badge tone="success">
            Data Aktual
          </Badge>
        </div>

        <div className="da-filter-row">
          <input
            className="da-input"

            value={
              search
            }

            placeholder="Cari nama, kode, area, supplier..."

            onChange={(
              event
            ) =>
              setSearch(
                event.target
                  .value
              )
            }
          />

          <Button
            variant="ghost"

            onClick={() =>
              setSearch("")
            }
          >
            Reset
          </Button>
        </div>

        <DataTable
          columns={
            viewColumns
          }

          rows={
            filteredRows
          }

          getRowKey={(
            row,
            index
          ) =>
            row.id ||
            `${moduleType}-${index}`
          }

          onRowClick={(
            row
          ) =>
            setSelected(
              row
            )
          }
        />

        {!loading &&
        filteredRows.length ===
          0 ? (
          <p
            className="da-muted"

            style={{
              marginTop: 12,
            }}
          >
            {
              config.emptyText
            }
          </p>
        ) : null}
      </Card>

      {moduleType === "produk" ? (
        <TangerangGoLiveCutoverPanel
          sessionToken={sessionToken}
          onSessionExpired={onSessionExpired}
          onCutoverChanged={async () => {
            await loadData();
            setPricingRefreshKey((value) => value + 1);
          }}
        />
      ) : null}

      {moduleType === "produk" ? (
        <ProductPricingPanel
          key={`product-pricing-${pricingRefreshKey}`}
          sessionToken={sessionToken}
          products={bootstrap.rows}
          masterWriteEnabled={writeEnabled}
          onSessionExpired={onSessionExpired}
          onPricingChanged={loadData}
        />
      ) : null}

      {moduleType === "produk" ? (
        <PricingCutoverPanel
          key={`pricing-readiness-${pricingRefreshKey}`}
          sessionToken={sessionToken}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      {moduleType === "lokasi" ? (
        <BranchCommercePanel
          sessionToken={sessionToken}
          onSessionExpired={onSessionExpired}
        />
      ) : null}

      <Modal
        open={
          Boolean(
            selected
          )
        }

        title={`Detail ${config.title}`}

        subtitle={
          safeText(
            selected?.master_id ||
              selected?.id
          )
        }

        onClose={() =>
          setSelected(
            null
          )
        }
      >
        {selected ? (
          <div>
            <div className="da-section-heading">
              <div>
                <span>
                  Data Hidup
                </span>

                <h2>
                  {safeText(
                    selected.product_name ||
                      selected.customer_name ||
                      selected.supplier_name ||
                      selected.location_name
                  )}
                </h2>
              </div>

              <div className="da-dashboard-banner-actions">
                {isProtected(
                  selected
                ) ? (
                  <Badge tone="warning">
                    Master
                    Inti
                  </Badge>
                ) : null}

                <Badge
                  tone={
                    selected.active
                      ? "success"
                      : "warning"
                  }
                >
                  {selected.active
                    ? "Aktif"
                    : "Nonaktif"}
                </Badge>
              </div>
            </div>

            <div className="da-detail-grid">
              {config.detailFields.map(
                ([
                  key,
                  label,
                ]) => (
                  <div
                    className="da-detail-box"

                    key={
                      key
                    }
                  >
                    <div className="da-mini-info-label">
                      {
                        label
                      }
                    </div>

                    <div className="da-mini-info-value">
                      {safeText(
                        selected[
                          key
                        ]
                      )}
                    </div>
                  </div>
                )
              )}

              <div
                className="da-modal-note da-detail-box"

                style={{
                  gridColumn:
                    "1 / -1",
                }}
              >
                Tidak ada
                hapus permanen.
                Nonaktif hanya
                menghentikan
                pemakaian untuk
                transaksi baru.
                Riwayat lama
                tetap tersimpan.
              </div>
            </div>

            <div
              className="da-form-actions"

              style={{
                marginTop: 16,
              }}
            >
              <Button
                type="button"

                variant="ghost"

                onClick={() =>
                  setSelected(
                    null
                  )
                }
              >
                Tutup
              </Button>

              <Button
                type="button"

                variant="ghost"

                onClick={() =>
                  startEdit(
                    selected
                  )
                }

                disabled={
                  !writeEnabled ||
                  statusSaving
                }
              >
                Edit Data
              </Button>

              <Button
                type="button"

                onClick={() =>
                  handleStatus(
                    selected
                  )
                }

                disabled={
                  !writeEnabled ||
                  statusSaving ||
                  (
                    selected.active &&
                    isProtected(
                      selected
                    )
                  )
                }

                title={
                  selected.active &&
                  isProtected(
                    selected
                  )
                    ? "Master inti dilindungi dan tidak boleh dinonaktifkan."
                    : ""
                }
              >
                {statusSaving
                  ? "Memproses..."
                  : selected.active
                  ? isProtected(
                      selected
                    )
                    ? "Dilindungi"
                    : "Nonaktifkan"
                  : "Aktifkan"}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
