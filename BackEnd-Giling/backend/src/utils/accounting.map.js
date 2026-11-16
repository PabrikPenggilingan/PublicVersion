/**
 * accounting.map.js
 * ─────────────────────────────────────────────────────────────────
 * Soft-hardcoded "Rules Engine" yang memetakan setiap kategori
 * transaksi ke dalam 5 kelompok akun akuntansi standar (CoA).
 *
 * Konsep: Operator lapangan tidak perlu tahu kode akun.
 * Mereka hanya menekan tombol ("Bayar Kuli", "Terima Cicilan").
 * File ini yang "menerjemahkan" aksi tersebut menjadi jurnal
 * akuntansi yang sah dan auditable.
 *
 * 5 Kelompok Akun (CoA Level 1):
 *   1 = ASET (Kas, Piutang, Persediaan)
 *   2 = KEWAJIBAN (Hutang ke Petani)
 *   3 = MODAL (Ekuitas Pemilik)
 *   4 = PENDAPATAN (Revenue)
 *   5 = BEBAN / BIAYA (OPEX & HPP)
 */

const ACCOUNTING_RULES = {
    // ── PENDAPATAN MASUK ────────────────────────────────────────
    'SALES': {
        group:        'REVENUE',
        accountCode:  '4-100',
        accountName:  'Pendapatan Penjualan Beras',
        debitSide:    'CASH',            // Kas bertambah
        creditSide:   'SALES_REVENUE',   // Pendapatan diakui
        description:  'Penjualan Beras & Produk Turunan'
    },
    'SECONDARY_REVENUE': {
        group:        'REVENUE',
        accountCode:  '4-200',
        accountName:  'Pendapatan Turunan & Limbah',
        debitSide:    'CASH',
        creditSide:   'OTHER_REVENUE',
        description:  'Penjualan Dedak, Menir, Sekam'
    },
    'AR_COLLECTION': {
        group:        'ASSET_SWAP',      // Piutang → Kas (tidak menambah revenue)
        accountCode:  '1-200',
        accountName:  'Pelunasan Piutang',
        debitSide:    'CASH',            // Kas bertambah
        creditSide:   'RECEIVABLE',      // Piutang berkurang
        description:  'Penerimaan Cicilan / Pelunasan Piutang Pelanggan'
    },
    'CAPITAL_IN': {
        group:        'EQUITY',
        accountCode:  '3-100',
        accountName:  'Modal Pemilik',
        debitSide:    'CASH',
        creditSide:   'EQUITY',
        description:  'Suntikan Modal / Setoran Awal Pemilik'
    },

    // ── HARGA POKOK (HPP / COGS) ─────────────────────────────────
    'COGS': {
        group:        'COGS',
        accountCode:  '5-100',
        accountName:  'Harga Pokok Penjualan (HPP)',
        debitSide:    'COGS',            // Beban HPP bertambah
        creditSide:   'INVENTORY',       // Stok gudang berkurang
        description:  'Harga Pokok Beras yang Terjual'
    },

    // ── HUTANG & PELUNASAN ────────────────────────────────────────
    'PURCHASE_PAYMENT': {
        group:        'LIABILITY',
        accountCode:  '2-100',
        accountName:  'Hutang Usaha (AP)',
        debitSide:    'ACCOUNTS_PAYABLE', // Hutang berkurang (dilunasi)
        creditSide:   'CASH',             // Kas berkurang
        description:  'Pembayaran Hutang Gabah ke Petani'
    },
    'BATCH_PAYMENT': {
        group:        'LIABILITY',
        accountCode:  '2-100',
        accountName:  'Hutang Usaha (AP)',
        debitSide:    'ACCOUNTS_PAYABLE', // Hutang batch berkurang (dicicil)
        creditSide:   'CASH',             // Kas berkurang
        description:  'Pembayaran Hutang Batch Pembelian Gabah'
    },

    // ── BIAYA OPERASIONAL (OPEX) ─────────────────────────────────
    'LOGISTICS': {
        group:        'OPEX',
        accountCode:  '5-200',
        accountName:  'Beban Logistik',
        debitSide:    'OPEX',
        creditSide:   'CASH',
        description:  'Biaya Kuli Bongkar / Muat Truk'
    },
    'CALO_PAYOUT': {
        group:        'OPEX',
        accountCode:  '5-500',
        accountName:  'Beban Komisi Calo',
        debitSide:    'OPEX',
        creditSide:   'CASH',
        description:  'Komisi makelar/calo penjualan (per tonase)'
    },
    'SALE_DEDUCTION': {
        group:        'OPEX',
        accountCode:  '5-700',
        accountName:  'Beban Kuli Bongkar & Potongan Penjualan',
        debitSide:    'OPEX',
        creditSide:   'RECEIVABLE',
        description:  'Potongan customer dari pembayaran nota (kuli bongkar, dll)'
    },
    'DRYING_COST': {
        group:        'OPEX',
        accountCode:  '5-300',
        accountName:  'Beban Pengeringan',
        debitSide:    'OPEX',
        creditSide:   'CASH',
        description:  'Biaya Kuli & Operasional Penjemuran Gabah'
    },
    'PROCESS_COST': {
        group:        'OPEX',
        accountCode:  '5-400',
        accountName:  'Beban Penggilingan',
        debitSide:    'OPEX',
        creditSide:   'CASH',
        description:  'Biaya Solar, Operasional Mesin Giling'
    },

    'OVERHEAD': {
        group:        'OPEX',
        accountCode:  '5-600',
        accountName:  'Beban Overhead Umum',
        debitSide:    'OPEX',
        creditSide:   'CASH',
        description:  'Pengeluaran Tak Terduga & Biaya Umum Pabrik'
    }
};

/**
 * Mendapatkan aturan akuntansi berdasarkan kategori transaksi.
 * @param {string} category - Kategori transaksi (e.g., 'SALES', 'OVERHEAD').
 * @returns {object} Aturan akuntansi yang sesuai.
 */
function getRule(category) {
    return ACCOUNTING_RULES[category] || {
        group:        'OPEX',
        accountCode:  '5-600',
        accountName:  'Beban Overhead Umum',
        debitSide:    'OPEX',
        creditSide:   'CASH',
        description:  'Pengeluaran Tidak Dikategorikan'
    };
}

/**
 * Menentukan apakah kategori termasuk ke dalam kelompok OPEX.
 * Digunakan oleh finance.service.js untuk menghitung total OPEX.
 */
const OPEX_CATEGORIES = ['LOGISTICS', 'CALO_PAYOUT', 'SALE_DEDUCTION', 'DRYING_COST', 'PROCESS_COST', 'OVERHEAD'];

/**
 * Menentukan apakah kategori termasuk ke dalam kelompok Revenue.
 */
const REVENUE_CATEGORIES = ['SALES', 'SECONDARY_REVENUE'];

module.exports = { ACCOUNTING_RULES, getRule, OPEX_CATEGORIES, REVENUE_CATEGORIES };
