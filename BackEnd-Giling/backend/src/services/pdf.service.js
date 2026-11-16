const pdfmake = require('pdfmake');
const path = require('path');
const { format } = require('date-fns');
const { id } = require('date-fns/locale');
const { getRule } = require('../utils/accounting.map');

const fonts = {
    Roboto: {
        normal:      path.join(__dirname, '../../node_modules/pdfmake/fonts/Roboto/Roboto-Regular.ttf'),
        bold:        path.join(__dirname, '../../node_modules/pdfmake/fonts/Roboto/Roboto-Medium.ttf'),
        italics:     path.join(__dirname, '../../node_modules/pdfmake/fonts/Roboto/Roboto-Italic.ttf'),
        bolditalics: path.join(__dirname, '../../node_modules/pdfmake/fonts/Roboto/Roboto-MediumItalic.ttf')
    }
};

pdfmake.setFonts(fonts);

// ── Formatting helpers ───────────────────────────────────────────────
const fmt = (amount) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount || 0);

const fmtDate = (d) => {
    try { return format(new Date(d), 'dd MMM yyyy', { locale: id }); }
    catch { return String(d); }
};
const fmtTime = (d) => {
    try { return format(new Date(d), 'HH:mm', { locale: id }); }
    catch { return ''; }
};

// ── Colour palette ───────────────────────────────────────────────────
const C = {
    green:    '#059669',
    greenBg:  '#ecfdf5',
    red:      '#dc2626',
    redBg:    '#fef2f2',
    gray:     '#6b7280',
    grayBg:   '#f3f4f6',
    dark:     '#111827',
    blue:     '#1d4ed8',
    amber:    '#d97706',
    border:   '#e5e7eb'
};

// ── Shared styles ────────────────────────────────────────────────────
const styles = {
    reportTitle:   { fontSize: 18, bold: true, color: C.dark },
    companyName:   { fontSize: 10, color: C.gray, italics: true },
    sectionTitle:  { fontSize: 12, bold: true, color: C.dark, margin: [0, 20, 0, 8] },
    tableHeader:   { bold: true, fontSize: 9, color: C.dark, fillColor: C.grayBg },
    groupRow:      { bold: true, fontSize: 10, color: C.dark, fillColor: C.grayBg },
    totalRow:      { bold: true, fontSize: 11, color: C.green },
    subtotalLabel: { bold: true, fontSize: 10, color: C.dark },
    redNum:        { color: C.red },
    greenNum:      { color: C.green, bold: true },
    disclaimer:    { fontSize: 8, color: C.gray, italics: true, margin: [0, 24, 0, 0] }
};

const hLine = () => ({ canvas: [{ type: 'line', x1: 0, y1: 6, x2: 515, y2: 6, lineWidth: 0.5, lineColor: C.border }], margin: [0, 4, 0, 12] });

// ── PDF Builder ──────────────────────────────────────────────────────
const pdfService = {

    /**
     * Main PDF: 3-part Financial Report (Income Statement, Balance Sheet, Ledger)
     */
    async generateFinancialReport(reportData, balanceSheet, requestor) {
        const { summary, startDate, endDate, ledger, overheads } = reportData;
        const bs = balanceSheet;
        const isRange = startDate !== endDate;
        const periodLabel = isRange
            ? `${fmtDate(startDate)} — ${fmtDate(endDate)}`
            : fmtDate(startDate);

        // ── OPEX Breakdown rows ──────────────────────────────────────
        const opexMap = {
            'LOGISTICS':    'Beban Pengiriman Penjualan (Transport)',
            'CALO_PAYOUT':  'Beban Komisi Makelar (Calo)',
            'SALE_DEDUCTION': 'Beban Kuli Bongkar & Potongan Penjualan',
            'DRYING_COST':  'Beban Pengeringan / Jemur',
            'PROCESS_COST': 'Beban Penggilingan',
            'OVERHEAD':     'Beban Overhead & Lain-lain'
        };
        // Known categories first, then every overhead category as recorded (Konsumsi, Utilities, …)
        const opexKeys = [
            ...Object.keys(opexMap),
            ...Object.keys(summary.opexBreakdown || {}).filter(k => !opexMap[k]),
        ];
        const opexRows = opexKeys
            .map(cat => {
                const val = parseFloat(summary.opexBreakdown?.[cat] || 0);
                if (val === 0) return null;
                const label = opexMap[cat] || `Overhead: ${cat}`;
                return [
                    { text: `     ${label}`, fontSize: 9, color: C.gray },
                    { text: `(${fmt(val)})`, alignment: 'right', fontSize: 9, color: C.red }
                ];
            })
            .filter(Boolean);

        const content = [
            // ══════════════════════════════════════════════
            // HEADER
            // ══════════════════════════════════════════════
            {
                columns: [
                    {
                        stack: [
                            { text: 'LAPORAN KEUANGAN', style: 'reportTitle' },
                            { text: 'Belanja Giling Management System', style: 'companyName' }
                        ]
                    },
                    {
                        stack: [
                            { text: `Periode: ${periodLabel}`, alignment: 'right', bold: true, fontSize: 10, color: C.dark },
                            { text: `Dibuat: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, alignment: 'right', fontSize: 8, color: C.gray },
                            { text: `Oleh: ${requestor?.full_name || requestor?.username || 'System'}`, alignment: 'right', fontSize: 8, color: C.gray }
                        ]
                    }
                ]
            },
            hLine(),

            // ══════════════════════════════════════════════
            // BAGIAN 1: LAPORAN LABA RUGI (INCOME STATEMENT)
            // ══════════════════════════════════════════════
            { text: '1. LAPORAN LABA RUGI', style: 'sectionTitle' },
            { text: `(Metode Akrual — Periode ${periodLabel})`, fontSize: 8, color: C.gray, margin: [0, -6, 0, 10] },
            {
                table: {
                    widths: ['*', 160],
                    body: [
                        // Header
                        [
                            { text: 'Keterangan', style: 'tableHeader', margin: [4, 6, 4, 6] },
                            { text: periodLabel, style: 'tableHeader', alignment: 'right', margin: [4, 6, 4, 6] }
                        ],
                        // Pendapatan
                        [{ text: 'Pendapatan Usaha', style: 'groupRow', margin: [4, 6, 4, 6] }, { text: '', style: 'groupRow' }],
                        [
                            { text: '     Penjualan Beras & Produk (4-100)', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: fmt(summary.revenue), alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }
                        ],
                        [
                            { text: '     Retur Penjualan (4-300)', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: `(${fmt(0)})`, alignment: 'right', fontSize: 9, color: C.red, margin: [4, 3, 4, 3] }
                        ],
                        [
                            { text: 'Penjualan Bersih', bold: true, margin: [4, 6, 4, 6] },
                            { text: fmt(summary.revenue), bold: true, alignment: 'right', margin: [4, 6, 4, 6] }
                        ],
                        // HPP
                        [
                            {
                                stack: [
                                    { text: 'Harga Pokok Penjualan — HPP (5-100)', fontSize: 9, color: C.gray },
                                    { text: 'HPP/kg stok sudah termasuk gabah, transport beli, jemur & giling', fontSize: 7, color: C.gray, italics: true },
                                ],
                                margin: [4, 3, 4, 3]
                            },
                            { text: `(${fmt(summary.hpp)})`, alignment: 'right', color: C.red, fontSize: 9, margin: [4, 3, 4, 3] }
                        ],
                        // Laba Kotor
                        [
                            { text: 'LABA KOTOR (Gross Profit)', style: 'subtotalLabel', margin: [4, 8, 4, 8] },
                            { text: fmt(summary.grossProfit), bold: true, color: summary.grossProfit >= 0 ? C.green : C.red, alignment: 'right', fontSize: 11, margin: [4, 8, 4, 8] }
                        ],
                        // Biaya Operasional Header
                        [{ text: 'Biaya Operasional (OPEX)', style: 'groupRow', margin: [4, 6, 4, 6] }, { text: '', style: 'groupRow' }],
                        // OPEX Breakdown rows
                        ...(opexRows.length > 0
                            ? opexRows.map(r => [{ ...r[0], margin: [4, 3, 4, 3] }, { ...r[1], margin: [4, 3, 4, 3] }])
                            : [[{ text: '     (Tidak ada biaya operasional)', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] }, { text: '-', alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }]]
                        ),
                        [
                            { text: 'Total OPEX', bold: true, margin: [4, 6, 4, 6] },
                            { text: `(${fmt(summary.opex)})`, bold: true, alignment: 'right', color: C.red, margin: [4, 6, 4, 6] }
                        ],
                        // Laba Operasional
                        [
                            { text: 'LABA OPERASIONAL (Operating Profit)', style: 'subtotalLabel', margin: [4, 6, 4, 6] },
                            { text: fmt(summary.operatingProfit), bold: true, color: (summary.operatingProfit >= 0) ? C.green : C.red, alignment: 'right', margin: [4, 6, 4, 6] }
                        ],
                        // Modal Belanja Gabah sebagai pengurang langsung
                        [{ text: 'Modal Usaha (Belanja Gabah)', style: 'groupRow', margin: [4, 6, 4, 6] }, { text: '', style: 'groupRow' }],
                        [
                            { text: '     Modal Belanja Gabah Periode Ini', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: `(${fmt(summary.procurement || 0)})`, alignment: 'right', fontSize: 9, color: C.amber, margin: [4, 3, 4, 3] }
                        ],
                        // Laba Bersih Real
                        [
                            { text: 'LABA BERSIH RIIL (Net Real Profit)', style: 'totalRow', margin: [4, 10, 4, 10] },
                            {
                                text: fmt((summary.operatingProfit || 0) - (summary.procurement || 0)),
                                style: 'totalRow',
                                alignment: 'right',
                                fontSize: 14,
                                color: ((summary.operatingProfit || 0) - (summary.procurement || 0)) >= 0 ? C.green : C.red,
                                margin: [4, 10, 4, 10]
                            }
                        ],
                        // Rasio
                        [{ text: 'Parameter Keuangan', style: 'groupRow', margin: [4, 6, 4, 6] }, { text: '', style: 'groupRow' }],
                        [
                            { text: 'Gross Margin', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: `${(summary.grossMarginPct || 0).toFixed(1)}%`, alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }
                        ],
                        [
                            { text: 'Net Margin', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: `${(summary.operatingMarginPct || 0).toFixed(1)}%`, alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }
                        ],
                        [
                            { text: 'Operating Ratio (OPEX/Revenue)', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: `${(summary.operatingRatioPct || 0).toFixed(1)}%`, alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }
                        ]
                    ]
                },
                layout: 'lightHorizontalLines'
            },

            // ══════════════════════════════════════════════
            // BAGIAN 2: NERACA (BALANCE SHEET)
            // ══════════════════════════════════════════════
            { text: '2. NERACA KEUANGAN (Balance Sheet)', style: 'sectionTitle' },
            { text: `(Snapshot per tanggal ${fmtDate(bs.asOfDate)})`, fontSize: 8, color: C.gray, margin: [0, -6, 0, 10] },
            {
                table: {
                    widths: ['*', 160],
                    body: [
                        [
                            { text: 'Keterangan', style: 'tableHeader', margin: [4, 6, 4, 6] },
                            { text: fmtDate(bs.asOfDate), style: 'tableHeader', alignment: 'right', margin: [4, 6, 4, 6] }
                        ],
                        // ASET
                        [{ text: 'Aset Lancar (Current Assets)', style: 'groupRow', margin: [4, 6, 4, 6] }, { text: '', style: 'groupRow' }],
                        [
                            { text: '     Kas & Setara Kas (1-100)', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: fmt(bs.assets.cash), alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }
                        ],
                        [
                            { text: '     Piutang Usaha (1-200)', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: fmt(bs.assets.receivable), alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }
                        ],
                        [
                            { text: '     Persediaan / Inventory (1-300)', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: fmt(bs.assets.inventory), alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }
                        ],
                        [
                            { text: 'Total Aset Lancar', style: 'subtotalLabel', margin: [4, 6, 4, 6] },
                            { text: fmt(bs.assets.totalCurrent), bold: true, alignment: 'right', margin: [4, 6, 4, 6] }
                        ],
                        [
                            { text: 'Aset Tetap (neto)', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: fmt(bs.assets.totalFixed), alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }
                        ],
                        [
                            { text: 'TOTAL ASET', style: 'totalRow', margin: [4, 8, 4, 8] },
                            { text: fmt(bs.assets.total), style: 'totalRow', alignment: 'right', margin: [4, 8, 4, 8] }
                        ],
                        // LIABILITAS
                        [{ text: 'Liabilitas (Kewajiban)', style: 'groupRow', margin: [4, 6, 4, 6] }, { text: '', style: 'groupRow' }],
                        [
                            { text: '     Hutang Usaha — AP ke Petani (2-100)', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: fmt(bs.liabilities.payable), alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }
                        ],
                        [
                            { text: 'Total Liabilitas', style: 'subtotalLabel', margin: [4, 6, 4, 6] },
                            { text: fmt(bs.liabilities.total), bold: true, alignment: 'right', margin: [4, 6, 4, 6] }
                        ],
                        // EKUITAS
                        [{ text: 'Ekuitas (Modal Pemilik)', style: 'groupRow', margin: [4, 6, 4, 6] }, { text: '', style: 'groupRow' }],
                        [
                            { text: '     Modal & Laba Ditahan (3-100 + 3-200)', fontSize: 9, color: C.gray, margin: [4, 3, 4, 3] },
                            { text: fmt(bs.equity), alignment: 'right', fontSize: 9, margin: [4, 3, 4, 3] }
                        ],
                        [
                            { text: 'TOTAL LIABILITAS & EKUITAS', style: 'totalRow', margin: [4, 8, 4, 8] },
                            { text: fmt(bs.totalLiabilitiesAndEquity), style: 'totalRow', alignment: 'right', margin: [4, 8, 4, 8] }
                        ],
                        // Balance Check
                        [
                            {
                                text: `✓ Selisih / Balance Check (ideal = 0)`,
                                fontSize: 9,
                                bold: true,
                                color: (bs.balanceCheck || 0) === 0 ? C.green : C.red,
                                margin: [4, 6, 4, 6]
                            },
                            {
                                text: fmt(bs.balanceCheck || 0),
                                alignment: 'right',
                                fontSize: 9,
                                bold: true,
                                color: (bs.balanceCheck || 0) === 0 ? C.green : C.red,
                                margin: [4, 6, 4, 6]
                            }
                        ]
                    ]
                },
                layout: 'lightHorizontalLines'
            },

            // ══════════════════════════════════════════════
            // BAGIAN 3: BUKU BESAR KAS (LEDGER)
            // ══════════════════════════════════════════════
            { text: '3. BUKU BESAR KAS (General Ledger — Cash Basis)', style: 'sectionTitle', pageBreak: 'before' },
            { text: `Hanya menampilkan transaksi berstatus APPROVED • Periode: ${periodLabel}`, fontSize: 8, color: C.gray, margin: [0, -6, 0, 10] },
            {
                table: {
                    headerRows: 1,
                    widths: [50, 40, 80, '*', 65, 65],
                    body: [
                        [
                            { text: 'Tanggal', style: 'tableHeader', margin: [3, 6, 3, 6] },
                            { text: 'Jam', style: 'tableHeader', margin: [3, 6, 3, 6] },
                            { text: 'Rekening', style: 'tableHeader', margin: [3, 6, 3, 6] },
                            { text: 'Keterangan', style: 'tableHeader', margin: [3, 6, 3, 6] },
                            { text: 'Debit (Masuk)', style: 'tableHeader', alignment: 'right', margin: [3, 6, 3, 6] },
                            { text: 'Kredit (Keluar)', style: 'tableHeader', alignment: 'right', margin: [3, 6, 3, 6] }
                        ],
                        ...(ledger && ledger.length > 0
                            ? ledger.map(t => {
                                const rule = getRule(t.category);
                                return [
                                    { text: fmtDate(t.transaction_date), fontSize: 8, margin: [3, 4, 3, 4] },
                                    { text: fmtTime(t.transaction_date), fontSize: 8, margin: [3, 4, 3, 4] },
                                    { text: t.account_name || '-', fontSize: 8, margin: [3, 4, 3, 4] },
                                    {
                                        stack: [
                                            { text: t.description || '-', fontSize: 8 },
                                            { text: `${rule.accountCode} · ${rule.accountName}`, fontSize: 7, color: C.gray }
                                        ],
                                        margin: [3, 4, 3, 4]
                                    },
                                    {
                                        text: t.transaction_type === 'IN' ? fmt(t.amount) : '-',
                                        alignment: 'right', fontSize: 8,
                                        color: t.transaction_type === 'IN' ? C.green : C.gray,
                                        margin: [3, 4, 3, 4]
                                    },
                                    {
                                        text: t.transaction_type === 'OUT' ? fmt(t.amount) : '-',
                                        alignment: 'right', fontSize: 8,
                                        color: t.transaction_type === 'OUT' ? C.red : C.gray,
                                        margin: [3, 4, 3, 4]
                                    }
                                ];
                            })
                            : [[
                                { text: '-', fontSize: 8, margin: [3, 8, 3, 8] },
                                { text: '-', fontSize: 8 }, { text: '-', fontSize: 8 },
                                { text: 'Tidak ada transaksi kas yang disetujui dalam periode ini.', fontSize: 8, color: C.gray },
                                { text: '-', fontSize: 8 }, { text: '-', fontSize: 8 }
                            ]]
                        )
                    ]
                },
                layout: {
                    hLineWidth: (i, node) => (i === 0 || i === 1 || i === node.table.body.length) ? 1 : 0.3,
                    vLineWidth: () => 0,
                    hLineColor: () => C.border
                }
            },

            // Disclaimer
            {
                text: `\n* Laporan Laba Rugi menggunakan Metode Akrual (pendapatan diakui saat penjualan terjadi, bukan saat diterima). `
                    + `Neraca menggunakan data saldo aktual per tanggal laporan. Buku Besar Kas hanya mencatat mutasi yang telah `
                    + `disetujui oleh Manajer Keuangan (APPROVED). Transaksi berstatus PENDING tidak dihitung.`,
                style: 'disclaimer'
            }
        ];

        const docDefinition = {
            content,
            footer: (currentPage, pageCount) => ({
                columns: [
                    { text: `Belanja Giling Management System  |  Laporan Keuangan Periode ${periodLabel}`, margin: [40, 0], fontSize: 7, color: C.gray },
                    { text: `Hal. ${currentPage} / ${pageCount}`, alignment: 'right', margin: [40, 0], fontSize: 7, color: C.gray }
                ]
            }),
            styles,
            defaultStyle: { font: 'Roboto', fontSize: 10, color: C.dark },
            pageMargins: [40, 40, 40, 60],
            pageSize: 'A4'
        };

        return pdfmake.createPdf(docDefinition);
    },

    // ── Legacy alias ─────────────────────────────────────────────────
    async generateDailyReport(data, requestor) {
        // Build minimal balanceSheet for legacy single-day calls
        const financeService = require('./finance.service');
        let balanceSheet;
        try { balanceSheet = await financeService.getBalanceSheet(data.date); }
        catch  { balanceSheet = { asOfDate: data.date, assets: { cash: 0, receivable: 0, inventory: 0, totalCurrent: 0, totalFixed: 0, total: 0 }, liabilities: { payable: 0, total: 0 }, equity: 0, totalLiabilitiesAndEquity: 0, balanceCheck: 0 }; }

        // Adapt legacy shape to new shape
        const adapted = {
            startDate: data.date,
            endDate: data.date,
            summary: { ...data.summary, opexBreakdown: {} },
            ledger: data.transactions || [],
            overheads: data.overheads || []
        };
        return this.generateFinancialReport(adapted, balanceSheet, requestor);
    }
};

module.exports = pdfService;
