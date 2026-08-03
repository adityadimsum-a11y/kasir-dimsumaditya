export const uangKasDompetHutangUatPlan = {
  "title": "Uang Masuk / Kas Dompet / Hutang Nana Final Check",
  "version": "Part 7D",
  "mode": "Checklist Read-Only",
  "objective": "Pastikan uang harian aman: payment customer masuk dompet, kas keluar memotong dompet, bayar hutang Nana mengurangi hutang dan dompet, semua mutasi punya source ID dan masuk Arsip Digital.",
  "scenarios": [
    {
      "id": "7D-PRE",
      "title": "Persiapan Uang / Dompet / Hutang",
      "risk": "Low",
      "steps": [
        "Login sebagai Owner/Tangerang.",
        "Buka Data Health, pastikan Masalah Bahaya = 0.",
        "Buka Kas & Dompet, catat saldo awal Cash/BCA/BRI/dompet UAT.",
        "Buka Hutang Nana, catat sisa hutang awal supplier UAT.",
        "Buka Piutang, catat piutang awal jika ada.",
        "Siapkan Order/Invoice/Payment UAT dari Part 7B jika sudah ada."
      ],
      "expected": [
        "Saldo dompet awal tercatat.",
        "Sisa hutang Nana awal tercatat.",
        "Payment/order UAT punya ID jelas.",
        "Owner/Tangerang bisa melihat semua sumber."
      ]
    },
    {
      "id": "7D-01",
      "title": "Payment Customer → Dompet IN",
      "risk": "Blocker jika gagal",
      "steps": [
        "Buka order/invoice UAT yang lunas atau bayar sebagian.",
        "Input payment customer jika belum ada.",
        "Pilih dompet penerimaan: Cash/BCA/BRI sesuai test.",
        "Simpan payment jika data UAT disetujui.",
        "Buka Kas & Dompet dan cari mutasi dari Payment ID."
      ],
      "expected": [
        "Payment ID terbentuk.",
        "Wallet mutation IN terbentuk.",
        "Saldo dompet bertambah sebesar payment aktual.",
        "Source mutation menunjuk Payment/Invoice ID.",
        "Tidak ada uang masuk tanpa source."
      ]
    },
    {
      "id": "7D-02",
      "title": "Partial Payment → Piutang Remaining",
      "risk": "High",
      "steps": [
        "Buat/cek invoice UAT dengan pembayaran sebagian.",
        "Cek total invoice, payment, dan sisa.",
        "Buka Piutang customer.",
        "Cek Kas & Dompet hanya bertambah sebesar payment aktual."
      ],
      "expected": [
        "Piutang ID terbentuk jika belum lunas.",
        "Remaining = total invoice - total payment.",
        "Dompet hanya bertambah sebesar uang diterima.",
        "Status invoice/payment/piutang sinkron.",
        "Arsip menemukan invoice, payment, piutang."
      ]
    },
    {
      "id": "7D-03",
      "title": "Kas Keluar Operasional → Dompet OUT",
      "risk": "High",
      "steps": [
        "Buka Belanja & Kas Keluar.",
        "Input biaya UAT kecil atau biaya real yang disetujui.",
        "Pilih kategori biaya dan dompet pembayaran.",
        "Simpan kas keluar jika disetujui.",
        "Buka Kas & Dompet dan cari mutasi OUT dari Kas Keluar ID."
      ],
      "expected": [
        "Kas Keluar ID terbentuk.",
        "Wallet mutation OUT terbentuk.",
        "Saldo dompet berkurang sebesar biaya.",
        "Kategori biaya terbaca.",
        "Source mutation menunjuk Kas Keluar ID.",
        "Arsip Digital menemukan Kas Keluar ID."
      ]
    },
    {
      "id": "7D-04",
      "title": "Block Kas Keluar 0 / Kosong",
      "risk": "Blocker jika gagal",
      "steps": [
        "Buka Belanja & Kas Keluar.",
        "Input nominal 0 atau kosong.",
        "Klik simpan jika tombol tersedia."
      ],
      "expected": [
        "Kas keluar 0/kosong ditolak.",
        "Tidak ada Kas Keluar ID baru.",
        "Dompet tidak berubah.",
        "Tidak ada wallet mutation palsu."
      ]
    },
    {
      "id": "7D-05",
      "title": "Bayar Hutang Nana Current Note",
      "risk": "High",
      "steps": [
        "Buka Hutang Nana.",
        "Pilih hutang/nota supplier UAT dari DROP Ayam.",
        "Input pembayaran sebagian/lunas untuk nota berjalan.",
        "Pilih dompet pembayaran.",
        "Simpan pembayaran hutang jika disetujui.",
        "Buka Kas & Dompet dan cari mutasi OUT dari Hutang Payment ID."
      ],
      "expected": [
        "Hutang Payment ID terbentuk.",
        "Sisa hutang nota berjalan berkurang.",
        "Wallet mutation OUT terbentuk.",
        "Saldo dompet berkurang.",
        "Source mutation menunjuk Hutang Payment ID.",
        "Arsip menemukan Hutang Payment dan Hutang ID."
      ]
    },
    {
      "id": "7D-06",
      "title": "Bayar Hutang Nana + Selipan Old Debt",
      "risk": "High",
      "steps": [
        "Buka Hutang Nana.",
        "Pilih supplier Nana.",
        "Input pembayaran untuk nota berjalan plus selipan old debt jika fitur tersedia.",
        "Cek pemisahan current note vs old debt.",
        "Cek Kas & Dompet untuk total OUT."
      ],
      "expected": [
        "Pembayaran current note dan old debt terpisah jelas.",
        "Sisa nota berjalan berubah benar.",
        "Sisa old debt berubah benar.",
        "Wallet mutation OUT total sesuai uang keluar.",
        "Detail/arsip menunjukkan pembagian pembayaran."
      ]
    },
    {
      "id": "7D-07",
      "title": "Block Bayar Hutang Melebihi Saldo Dompet",
      "risk": "Blocker jika gagal",
      "steps": [
        "Pilih dompet dengan saldo kecil atau skenario nominal besar.",
        "Coba bayar hutang melebihi saldo dompet jika sistem memakai saldo strict.",
        "Amati respon UI/backend."
      ],
      "expected": [
        "Sistem memberi warning/menolak sesuai aturan saldo.",
        "Tidak ada saldo dompet minus tanpa approval khusus.",
        "Tidak ada hutang payment palsu.",
        "Tidak ada wallet mutation palsu."
      ]
    },
    {
      "id": "7D-08",
      "title": "Mutasi Dompet Drilldown Source ID",
      "risk": "Blocker jika gagal",
      "steps": [
        "Buka Kas & Dompet.",
        "Cari mutasi IN dari Payment customer.",
        "Cari mutasi OUT dari Kas Keluar.",
        "Cari mutasi OUT dari Bayar Hutang Nana.",
        "Klik source ID masing-masing jika tersedia."
      ],
      "expected": [
        "Setiap mutasi punya source ID.",
        "Source ID bisa dibuka/detail.",
        "Mutasi IN/OUT tidak yatim.",
        "Back/Kembali atau alur detail tidak membingungkan."
      ]
    },
    {
      "id": "7D-09",
      "title": "Papan Pantau / Radar Setelah Uang Berubah",
      "risk": "Medium",
      "steps": [
        "Buka Papan Pantau.",
        "Klik Refresh Data.",
        "Cek Uang Masuk Aktual, Kas/Dompet, Sisa Hutang Nana, Piutang, dan Radar Owner.",
        "Bandingkan dengan transaksi UAT."
      ],
      "expected": [
        "Uang Masuk Aktual naik hanya dari payment.",
        "Dompet berubah sesuai mutasi.",
        "Sisa Hutang Nana turun jika ada pembayaran.",
        "Piutang berubah sesuai pembayaran.",
        "Radar Owner membaca uang yang sudah benar-benar masuk/keluar."
      ]
    },
    {
      "id": "7D-10",
      "title": "Arsip Digital Uang / Hutang Drilldown",
      "risk": "High",
      "steps": [
        "Buka Arsip Digital.",
        "Cari Payment ID.",
        "Cari Wallet Mutation ID.",
        "Cari Kas Keluar ID.",
        "Cari Hutang ID dan Hutang Payment ID.",
        "Cek related IDs dan timeline."
      ],
      "expected": [
        "Semua ID bisa ditemukan.",
        "Related IDs tampil jelas.",
        "Timeline uang masuk/keluar masuk akal.",
        "Tidak ada angka yatim antara invoice, payment, dompet, hutang."
      ]
    }
  ],
  "blockers": [
    "Payment customer tersimpan tapi dompet tidak bertambah.",
    "Dompet bertambah tanpa Payment/Source ID.",
    "Kas keluar tersimpan tapi dompet tidak berkurang.",
    "Dompet berkurang tanpa Kas Keluar/Hutang Payment source.",
    "Bayar Hutang Nana tersimpan tapi sisa hutang tidak berubah.",
    "Sisa hutang berubah tapi dompet tidak berkurang.",
    "Payment sebagian tidak membuat piutang/remaining yang benar.",
    "Wallet mutation source ID kosong/tidak bisa dibuka.",
    "Saldo dompet bisa minus tanpa aturan approval.",
    "Arsip Digital tidak menemukan Payment/KasOut/Hutang Payment/Wallet Mutation ID."
  ]
};
