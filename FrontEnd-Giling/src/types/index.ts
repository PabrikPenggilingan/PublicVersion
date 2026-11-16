// User types
export interface User {
    id: string
    username: string
    role: 'admin' | 'owner' | 'operator' | 'viewer'
    accessible_modules?: string[]
    is_super_admin?: boolean
    created_at?: string
    updated_at?: string
}

// Batch types
export type BatchStatus = 'OPEN' | 'CLOSED'

export interface Batch {
    id: string
    created_by: string
    batch_date: string
    status: BatchStatus
    total_qty_kg: number
    remaining_kg: number
    total_berat_bersih?: number // Calculated field from purchases
    farmers?: string
    jenis_gabah?: string
    areas?: string
    created_at: string
    updated_at: string
}

// Purchase types
export type KualitasGabah = 'jelek' | 'biasa' | 'bagus' | 'sangat_bagus'

export interface Purchase {
    id: string
    batch_id: string
    nama: string                    // nama pengisi (dari user login)
    tanggal_belanja: string | null
    calo: string                    // nama petani/calo
    harga_per_kg: number
    total_harga: number
    /** Harga sampai tempat (incl. transport); null = same as total_harga */
    total_dibayar?: number | null
    lokasi_belanja: string          // alamat sawah
    koordinat: string | null
    berat_gabah_kg: number          // berat
    jenis_gabah: string
    kadar_air: number | null
    kadar_hampa: number | null
    kualitas_gabah: KualitasGabah
    filled_by: string | null        // employee user id
    created_at: string
    updated_at: string
    // Legacy aliases for compatibility
    nama_petani?: string
    alamat_sawah?: string
    berat_kotor?: number
}

// Process types
export type ProcessStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'IN_WAREHOUSE'

export interface ProcessCost {
    id: string
    cost_type: string
    description?: string
    amount: number
    created_by_name?: string
    created_at: string
}

export interface Process {
    id: string
    created_by: string
    process_date: string
    end_date: string | null
    status: ProcessStatus
    total_input_kg?: number
    notes: string | null
    created_at: string
    updated_at: string
    
    // v2 fields
    inventory_item_id?: string
    gabah_reserved_kg?: number
    gabah_used_kg?: number
    gabah_price_per_kg?: number
    sekam_kg?: number
    sekam_notes?: string
    rendemen_pct?: number
    hpp_per_kg?: number
    
    // joined fields
    gabah_category?: string
    gabah_total_kg?: number
    gabah_remaining_kg?: number
    gabah_status?: string
    gabah_area?: string
    gabah_tanda?: string
    gabah_batch_date?: string
    gabah_drying_name?: string

    costs?: ProcessCost[]
    batches?: ProcessBatch[]
}

export interface ProcessBatch {
    id: string
    process_id: string
    batch_id: string
    qty_used_kg: number
    batch_date?: string
    batch_status?: BatchStatus
    total_qty_kg?: number
    remaining_kg?: number
    created_at: string
}

// Sales types
export type HasilKualitas = 'jelek' | 'biasa' | 'bagus' | 'sangat_bagus'
export type SaleType = 'beras' | 'dedak' | 'sekam' | 'menir' | 'broken'

export interface SalesBeras {
    id: string
    process_id: string
    hasil_kualitas: HasilKualitas
    qty_kg: number
    harga_per_kg: number
    total_harga: number
    pembeli_name: string | null
    pembeli_phone: string | null
    notes: string | null
    created_at: string
    updated_at: string
}

export interface SalesSimplified {
    id: string
    process_id: string
    qty_kg: number
    harga_per_kg: number
    total_harga: number
    pembeli_name: string | null
    pembeli_phone: string | null
    notes: string | null
    created_at: string
    updated_at: string
}

export interface AllSales {
    beras: SalesBeras[]
    dedak: SalesSimplified[]
    sekam: SalesSimplified[]
    menir: SalesSimplified[]
    broken: SalesSimplified[]
}

// API Response types
export interface ApiResponse<T> {
    success: boolean
    data: T
    message?: string
}

export interface PaginatedResponse<T> {
    success: boolean
    data: T[]
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
        hasNext: boolean
        hasPrev: boolean
    }
}

export interface LoginResponse {
    success: boolean
    data: {
        user: User
        token: string
    }
}

// Form types
export interface PurchaseFormData {
    nama: string
    tanggalBelanja: string
    calo: string
    lokasiBelanja: string
    beratGabahKg: string
    hargaPerKg: string
    /** Harga sampai tempat; '' = same as harga × berat */
    totalDibayar?: string
    jenisGabah: string
    kadarAir: string
    kadarHampa: string
    kualitasGabah: KualitasGabah
    kondisiGabah?: 'kering' | 'basah'
}

export interface BerasSaleFormData {
    nama: string
    tanggalJual: string
    calo: string
    hargaJualPerKg: string
    jualKemana: string
    berat: string
    rendemen: string
    hasilAkhir: HasilKualitas
}

export interface SimplifiedSaleFormData {
    nama: string
    tanggalJual: string
    berat: string
    hargaPerKg: string
}

// Sales V2 types
export type SaleV2Status = 'DRAFT' | 'CONFIRMED' | 'PARTIAL_DELIVERED' | 'COMPLETED' | 'VOID'
export type PaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID'
export type SaleUnitType = 'KG' | 'SACK'
export type PaymentMethod = 'CASH' | 'TRANSFER' | 'GIRO' | 'CEK' | 'OTHER'
export type ReturnType = 'PRICE_REDUCTION' | 'PARTIAL_REFUND' | 'FULL_REFUND'

export interface CustomerTier {
    id: string
    name: string
    description: string
    sort_order: number
    is_active: boolean
}

export interface Customer {
    id: string
    name: string
    phone: string | null
    address: string | null
    tier_id: string | null
    tier_name?: string
    notes: string | null
    is_active: boolean
    created_at: string
}

export interface PriceList {
    id: string
    tier_id: string
    category_id: string
    price_per_kg: number | null
    price_per_sack: number | null
    effective_date: string
    tier_name?: string
    category_name?: string
    category_code?: string
    notes?: string | null
}

export interface SaleV2 {
    id: string
    sale_no: string
    customer_id: string | null
    customer_name?: string
    tier_name?: string
    sale_date: string
    status: SaleV2Status
    payment_status: PaymentStatus
    subtotal: number
    adjustment: number
    total_amount: number
    paid_amount: number
    /** Potongan yang dipotong customer dari pembayaran (kuli bongkar, dll); beban pabrik, nota tetap utuh */
    customer_deduction?: number | string
    deduction_note?: string | null
    deduction_journal_id?: string | null
    /** Status + bukti kas (BKK) of the money leaving for this nota */
    cash_flow?: Partial<Record<'transport' | 'commission' | 'deduction', { status: string; voucher_no?: string | null; voucher_date?: string | null }>>
    /** total_amount - paid_amount - customer_deduction */
    outstanding: number
    notes: string | null
    void_reason?: string
    void_at?: string
    created_by_name?: string
    created_at: string
    items?: SaleItem[]
    deliveries?: SaleDelivery[]
    payments?: SalePayment[]
    returns?: SaleReturn[]
    /** Pengiriman (1 mobil) yang membawa nota ini; bisa berisi nota lain juga */
    shipment?: import('@/api/client').SaleShipment | null
}

export interface InventoryItem {
    id: string
    source_type: 'batch' | 'drying' | string
    batch_id?: string
    drying_id?: string
    batch_date?: string
    drying_name?: string
    jenis_gabah?: string
    jenisGabah?: string
    area?: string
    tanda?: string
    kualitas?: string
    total_weight_kg: number
    remaining_weight_kg: number
    available_weight_kg?: number
    total_sacks: number
    remaining_sacks: number
    status: 'AVAILABLE' | 'RESERVED' | 'DEPLETED' | string
    entry_date: string
    created_at: string
    product_category_code?: string
    category_name?: string
    category_color?: string
    category_icon?: string
    is_titipan?: boolean
    titipan_subtype?: string
    notes?: string
}

export interface SaleItem {
    id: string
    sale_id: string
    inventory_item_id: string | null
    item_name: string
    category_code: string
    unit_type: SaleUnitType
    unit_price: number
    qty_ordered: number
    qty_delivered: number
    subtotal: number
    hpp_per_unit?: number
    stock_remaining?: number
}

export interface SaleDelivery {
    id: string
    sale_id: string
    delivery_date: string
    notes: string | null
    created_by_name?: string
    created_at: string
    items?: {
        id: string
        sale_item_id: string
        qty_delivered: number
        item_name: string
        unit_type: SaleUnitType
    }[]
}

export interface SalePayment {
    id: string
    sale_id: string
    payment_date: string
    amount: number
    method: PaymentMethod
    reference_no: string | null
    notes: string | null
    created_by_name?: string
    created_at: string
}

export interface SaleReturn {
    id: string
    sale_id: string
    return_date: string
    return_type: ReturnType
    reason: string
    qty_returned: number
    amount_adjusted: number
    restocked: boolean
    sale_item_id?: string | null
    item_name?: string
    unit_price?: number
    created_by_name?: string
    created_at: string
}
