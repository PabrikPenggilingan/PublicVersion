import type {
    LoginResponse,
    ApiResponse,
    PaginatedResponse,
    User,
    Batch,
    Purchase,
    Process,
    ProcessBatch,
    AllSales,
    SalesBeras,
    SalesSimplified,
    Customer,
    CustomerTier,
    PriceList,
    SaleV2,
    SaleItem,
    SaleDelivery,
    SalePayment,
    SaleReturn
} from '@/types'
import { AppError, getCleanErrorMessage } from '@/errors'

export { AppError, getCleanErrorMessage }

const API_BASE = '/api'

export const getCsrfHeaders = (): Record<string, string> => {
    const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)
    return csrfMatch ? { 'x-csrf-token': csrfMatch[1] } : {}
}


async function parseResponseJson(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
        if (!response.ok) {
            if (response.status === 413) {
                throw new AppError('Ukuran file/foto terlalu besar (maksimal 25MB).', 413)
            }
            if (response.status >= 500) {
                throw new AppError(`Server error (${response.status}): Layanan sedang sibuk atau mengalami kendala.`, response.status)
            }
            throw new AppError(`Request gagal dengan status ${response.status}.`, response.status)
        }
        return {}
    }
    return response.json()
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {

    const config: RequestInit = {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        credentials: 'include',
        ...options,
    }

    // Auto-attach CSRF token from cookie for state-altering requests
    if (config.method && !['GET', 'HEAD', 'OPTIONS'].includes(config.method.toUpperCase())) {
        const csrfMatch = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]*)/)
        if (csrfMatch) {
            config.headers = {
                ...config.headers,
                'x-csrf-token': csrfMatch[1]
            }
        }
    }

    const response = await fetch(`${API_BASE}${endpoint}`, config)
    const data = await parseResponseJson(response)

    if (!response.ok) {
        // 4xx errors carry an explicit, human-readable message from the backend
        // that is safe to show the user — wrap them as operational AppErrors.
        if (response.status >= 400 && response.status < 500) {
            const msg = data.error || data.message
            if (msg) throw new AppError(msg, response.status)
        }
        // 5xx or unexpected errors: treat as system errors (getCleanErrorMessage
        // will log them and return the generic fallback).
        throw new Error(data.error || data.message || 'An error occurred')
    }

    return data
}

// Auth API
export const authAPI = {
    login: (username: string, password: string) =>
        apiRequest<LoginResponse>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        }),

    register: (username: string, password: string, role = 'operator') =>
        apiRequest<ApiResponse<User>>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ username, password, role }),
        }),

    me: () => apiRequest<ApiResponse<User>>('/auth/me'),

    logout: () => apiRequest<ApiResponse<null>>('/auth/logout', { method: 'POST' }),
}

// Users API (Admin)
export const usersAPI = {
    getAll: () => apiRequest<ApiResponse<User[]>>('/users'),
    create: (data: Record<string, any>) =>
        apiRequest<ApiResponse<User>>('/users', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updateModules: (id: string, modules: string[]) =>
        apiRequest<ApiResponse<User>>(`/users/${id}/modules`, {
            method: 'PUT',
            body: JSON.stringify({ modules }),
        }),
}

// Dashboard API
export const dashboardAPI = {
    getTimeline: () => apiRequest<ApiResponse<any[]>>('/dashboard/timeline'),
}

// Batch Debt (Hutang Pembelian per Batch)
export interface BatchDebtPayment {
    id: string
    payment_date: string
    amount: number | string
    payment_method: string
    reference_no: string | null
    notes: string | null
    bukti_nota_path: string | null
    created_at: string
    created_by_name?: string | null
    approval_status: 'PENDING' | 'APPROVED' | 'REJECTED' | null
    source: 'BATCH' | 'PURCHASE'
}

export interface BatchDebt {
    batchId: string
    totalOwed: number
    totalPaid: number
    remaining: number
    status: 'UNPAID' | 'PARTIAL' | 'PAID'
    payments: BatchDebtPayment[]
}

export interface PaymentInput {
    paymentDate?: string
    amount: number
    paymentMethod: string
    referenceNo?: string
    notes?: string
    buktiNota?: File | null
}

// Batches API
export const batchesAPI = {
    getAll: (params: Record<string, string | number> = {}) => {
        const query = new URLSearchParams(params as Record<string, string>).toString()
        return apiRequest<PaginatedResponse<Batch>>(`/batches${query ? `?${query}` : ''}`)
    },

    getById: (id: string) => apiRequest<ApiResponse<Batch>>(`/batches/${id}`),

    create: (data: { batchDate: string; jenisGabah: string }) =>
        apiRequest<ApiResponse<Batch>>('/batches', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: Record<string, unknown>) =>
        apiRequest<ApiResponse<Batch>>(`/batches/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        apiRequest<ApiResponse<Batch>>(`/batches/${id}`, { method: 'DELETE' }),

    getMarginReport: (id: string) => apiRequest<ApiResponse<any>>(`/batches/${id}/margin-report`),
    getAllMarginReports: () => apiRequest<ApiResponse<any>>(`/batches/margins/reports`),
    getCompletion: (id: string) => apiRequest<ApiResponse<any>>(`/batches/${id}/completion`),

    // Debt (Hutang Pembelian)
    getDebt: (id: string) => apiRequest<ApiResponse<BatchDebt>>(`/batches/${id}/debt`),
    createPayment: async (id: string, data: PaymentInput) => {
        if (data.buktiNota) {
            const formData = new FormData()
            formData.append('amount', String(data.amount))
            formData.append('paymentMethod', data.paymentMethod)
            if (data.paymentDate) formData.append('paymentDate', data.paymentDate)
            if (data.referenceNo) formData.append('referenceNo', data.referenceNo)
            if (data.notes) formData.append('notes', data.notes)
            formData.append('buktiNota', data.buktiNota)

            const response = await fetch(`/api/batches/${id}/payments`, {
                credentials: 'include',
                method: 'POST',
                headers: { ...getCsrfHeaders() },
                body: formData,
            })
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error || result.message || 'Failed to create payment')
            }
            return result as ApiResponse<BatchDebt>
        } else {
            const { buktiNota: _buktiNota, ...body } = data
            return apiRequest<ApiResponse<BatchDebt>>(`/batches/${id}/payments`, {
                method: 'POST',
                body: JSON.stringify(body),
            })
        }
    },
}

// Purchases API
export const purchasesAPI = {
    getAll: (params: Record<string, string | number> = {}) => {
        const query = new URLSearchParams(params as Record<string, string>).toString()
        return apiRequest<PaginatedResponse<Purchase>>(`/purchases${query ? `?${query}` : ''}`)
    },
    
    getByBatchId: (batchId: string, params: Record<string, string | number> = {}) => {
        const query = new URLSearchParams(params as Record<string, string>).toString()
        return apiRequest<PaginatedResponse<Purchase>>(`/batches/${batchId}/purchases${query ? `?${query}` : ''}`)
    },

    getById: (id: string) => apiRequest<ApiResponse<Purchase>>(`/purchases/${id}`),

    create: (batchId: string, data: Record<string, unknown>) =>
        apiRequest<ApiResponse<Purchase>>(`/batches/${batchId}/purchases`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: Record<string, unknown>) =>
        apiRequest<ApiResponse<Purchase>>(`/purchases/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        apiRequest<ApiResponse<Purchase>>(`/purchases/${id}`, { method: 'DELETE' }),

    uploadPhoto: async (id: string, file: File) => {
        const formData = new FormData()
        formData.append('file', file)

        const response = await fetch(`${API_BASE}/purchases/${id}/photos`, {
            credentials: 'include',
            method: 'POST',
            headers: {
                ...getCsrfHeaders()
            },
            body: formData,
        })
        const data = await response.json()
        if (!response.ok) {
            if (response.status >= 400 && response.status < 500 && (data.message || data.error)) {
                throw new AppError(data.message || data.error, response.status)
            }
            throw new Error(data.message || 'Upload failed')
        }
        return data as ApiResponse<unknown>
    },
}

// Processes API
export const processesAPI = {
    getAll: (params: Record<string, string | number> = {}) => {
        const query = new URLSearchParams(params as Record<string, string>).toString()
        return apiRequest<PaginatedResponse<Process>>(`/processes${query ? `?${query}` : ''}`)
    },

    getById: (id: string) => apiRequest<ApiResponse<Process>>(`/processes/${id}`),

    create: (data: {
        inventoryItemId: string
        gabahReservedKg: number
        processDate?: string
        notes?: string
    }) =>
        apiRequest<ApiResponse<Process>>('/processes', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: Record<string, unknown>) =>
        apiRequest<ApiResponse<Process>>(`/processes/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        apiRequest<ApiResponse<Process>>(`/processes/${id}`, { method: 'DELETE' }),

    cancel: (id: string, reason?: string) =>
        apiRequest<ApiResponse<Process>>(`/processes/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify({ reason }),
        }),

    complete: (id: string, data: {
        outputs: {
            category: string
            weight_kg: number
            sacks: number
            packaging_size_kg?: number
            notes?: string
        }[]
        notes?: string
        sekam_kg?: number
        sekam_notes?: string
        waste_kg?: number
        waste_reason?: string
    }) =>
        apiRequest<ApiResponse<any>>(`/processes/${id}/complete`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    // Legacy batch support
    attachBatch: (processId: string, batchId: string, qtyUsedKg: number) =>
        apiRequest<ApiResponse<ProcessBatch>>(`/processes/${processId}/batches`, {
            method: 'POST',
            body: JSON.stringify({ batchId, qtyUsedKg }),
        }),

    detachBatch: (processId: string, batchId: string) =>
        apiRequest<ApiResponse<ProcessBatch>>(`/processes/${processId}/batches/${batchId}`, { method: 'DELETE' }),

    getBatches: (processId: string) =>
        apiRequest<ApiResponse<ProcessBatch[]>>(`/processes/${processId}/batches`),

    // HPP Costs
    getCosts: (processId: string) =>
        apiRequest<ApiResponse<any[]>>(`/processes/${processId}/costs`),

    addCost: (processId: string, data: { costType: string; description?: string; amount: number }) =>
        apiRequest<ApiResponse<any>>(`/processes/${processId}/costs`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    deleteCost: (processId: string, costId: string) =>
        apiRequest<ApiResponse<any>>(`/processes/${processId}/costs/${costId}`, { method: 'DELETE' }),

    // Milling Sessions
    generateMillingLink: (processId: string) =>
        apiRequest<ApiResponse<any>>(`/processes/${processId}/milling-link`, { method: 'POST' }),

    getMillingSummary: (processId: string) =>
        apiRequest<ApiResponse<any>>(`/processes/${processId}/milling-summary`),

    finalizeProduction: (processId: string, data: { corrections?: any }) =>
        apiRequest<ApiResponse<any>>(`/processes/${processId}/finalize`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
}


// Sales API
export const salesAPI = {
    getByProcessId: (processId: string) =>
        apiRequest<ApiResponse<AllSales>>(`/processes/${processId}/sales`),

    createBeras: (processId: string, data: Record<string, unknown>) =>
        apiRequest<ApiResponse<SalesBeras>>(`/processes/${processId}/sales/beras`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    createSimplified: (processId: string, type: string, data: Record<string, unknown>) =>
        apiRequest<ApiResponse<SalesSimplified>>(`/processes/${processId}/sales/${type}`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (type: string, id: string, data: Record<string, unknown>) =>
        apiRequest<ApiResponse<SalesBeras | SalesSimplified>>(`/sales/${type}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (type: string, id: string) =>
        apiRequest<ApiResponse<SalesBeras | SalesSimplified>>(`/sales/${type}/${id}`, { method: 'DELETE' }),
}

// File type for uploaded files
export interface FileData {
    id: string
    purchase_id?: string
    process_id?: string
    sale_id?: string
    sale_type?: string
    file_type: string
    r2_key: string
    original_name: string
    mime_type: string
    size_bytes: number
    url?: string
    created_at: string
}

// Files API
export const filesAPI = {
    upload: async (file: File, fileType: string, association: { purchaseId?: string; processId?: string; saleId?: string; saleType?: string }) => {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('fileType', fileType)
        if (association.purchaseId) formData.append('purchaseId', association.purchaseId)
        if (association.processId) formData.append('processId', association.processId)
        if (association.saleId) formData.append('saleId', association.saleId)
        if (association.saleType) formData.append('saleType', association.saleType)

        const response = await fetch(`${API_BASE}/files`, {
            credentials: 'include',
            method: 'POST',
            headers: {
                ...getCsrfHeaders()
            },
            body: formData,
        })
        const data = await response.json()
        if (!response.ok) {
            if (response.status >= 400 && response.status < 500 && (data.message || data.error)) {
                throw new AppError(data.message || data.error, response.status)
            }
            throw new Error(data.message || 'Upload failed')
        }
        return data as ApiResponse<FileData>
    },

    getById: (id: string) => apiRequest<ApiResponse<FileData>>(`/files/${id}`),
    getByPurchase: (purchaseId: string) => apiRequest<ApiResponse<FileData[]>>(`/files/purchase/${purchaseId}`),
    getByProcess: (processId: string) => apiRequest<ApiResponse<FileData[]>>(`/files/process/${processId}`),
    getBySale: (saleType: string, saleId: string) => apiRequest<ApiResponse<FileData[]>>(`/files/sale/${saleType}/${saleId}`),
    delete: (id: string) => apiRequest<ApiResponse<FileData>>(`/files/${id}`, { method: 'DELETE' }),
}

// Wizard State type
export interface WizardState {
    id: string
    user_id: string
    entity_type: 'batch' | 'process'
    entity_id: string
    current_step: string
    step_data: Record<string, unknown>
    entity_info?: string
    created_at: string
    updated_at: string
}

export interface WizardStep {
    id: string
    name: string
    description: string
}

// Wizard API
export const wizardAPI = {
    getActiveWizards: () => apiRequest<ApiResponse<WizardState[]>>('/wizard/active'),
    getSteps: (entityType: 'batch' | 'process') => apiRequest<ApiResponse<WizardStep[]>>(`/wizard/steps/${entityType}`),
    getState: (entityType: string, entityId: string) => apiRequest<ApiResponse<WizardState>>(`/wizard/${entityType}/${entityId}`),
    saveState: (entityType: string, entityId: string, currentStep: string, stepData: Record<string, unknown>) =>
        apiRequest<ApiResponse<WizardState>>(`/wizard/${entityType}/${entityId}`, {
            method: 'PUT',
            body: JSON.stringify({ currentStep, stepData }),
        }),
    advance: (entityType: string, entityId: string, nextStep: string, additionalData: Record<string, unknown> = {}) =>
        apiRequest<ApiResponse<WizardState>>(`/wizard/${entityType}/${entityId}/advance`, {
            method: 'POST',
            body: JSON.stringify({ nextStep, additionalData }),
        }),
    complete: (entityType: string, entityId: string) =>
        apiRequest<ApiResponse<null>>(`/wizard/${entityType}/${entityId}`, { method: 'DELETE' }),
}

// Log Entry type
export interface LogEntry {
    id: string
    user_id: string
    username?: string
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    entity_type: string
    entity_id: string
    old_data?: Record<string, unknown>
    new_data?: Record<string, unknown>
    ip_address?: string
    user_agent?: string
    created_at: string
}

export interface ActivitySummary {
    daily: { action: string; entity_type: string; count: number; date: string }[]
    byAction: { action: string; count: number }[]
    byEntityType: { entity_type: string; count: number }[]
}

// Logs API
export const logsAPI = {
    getAll: (params: Record<string, string | number> = {}) => {
        const query = new URLSearchParams(params as Record<string, string>).toString()
        return apiRequest<PaginatedResponse<LogEntry>>(`/logs${query ? `?${query}` : ''}`)
    },
    getByEntity: (entityType: string, entityId: string) =>
        apiRequest<ApiResponse<LogEntry[]>>(`/logs/${entityType}/${entityId}`),
    getMyLogs: () => apiRequest<ApiResponse<LogEntry[]>>('/logs/me'),
    getSummary: (days = 7) => apiRequest<ApiResponse<ActivitySummary>>(`/logs/summary?days=${days}`),
}

// Batch Links API (Admin)
export interface BatchLink {
    id: string
    batch_id: string
    link_code: string
    form_type: 'PURCHASE' | 'DRYING' | 'MILLING' | 'SALES'
    is_active: boolean
    created_by: string
    created_by_name?: string
    created_at: string
    expires_at: string | null
}

export const batchLinksAPI = {
    create: (batchId: string, data: { formType?: string; expiresAt?: string }) =>
        apiRequest<ApiResponse<BatchLink>>(`/batches/${batchId}/links`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getByBatch: (batchId: string) =>
        apiRequest<ApiResponse<BatchLink[]>>(`/batches/${batchId}/links`),
    toggle: (linkId: string, isActive: boolean) =>
        apiRequest<ApiResponse<BatchLink>>(`/batch-links/${linkId}`, {
            method: 'PUT',
            body: JSON.stringify({ isActive }),
        }),
    delete: (linkId: string) =>
        apiRequest<ApiResponse<null>>(`/batch-links/${linkId}`, { method: 'DELETE' }),
}

// Forms API (Employee)
export interface FormInfo {
    linkCode: string
    formType: string
    batchId: string
    batchDate: string
    batchStatus: string
    purchaseCount: number
    totalTonnage: number
    maxPurchases: number
    isCompleted: boolean
}

export interface PurchaseFormData {
    calo: string
    lokasiBelanja: string
    koordinat?: string
    hargaPerKg: number
    beratGabahKg: number
    /** Harga sampai tempat: total actually paid to the seller, incl. transport */
    totalDibayar?: number
    kadarAir?: number
    kadarHampa?: number
    kualitasGabah: 'jelek' | 'biasa' | 'bagus' | 'sangat_bagus'
    kondisiGabah?: 'kering' | 'basah'
    photos: File[]
    driverName?: string
    crewNames?: string
    origin?: string
    destination?: string
    operationalCost?: number | string
    durationHours?: number | string
}

export interface PurchasePhoto {
    id: string
    file_path: string
    file_name: string
}

export interface PurchaseWithPhotos extends Purchase {
    photo_count: number
    photos?: PurchasePhoto[]
}

export interface BatchCompletion {
    id: string
    batch_id: string
    struk_photo_path: string
    lapangan_photo_path: string
    total_tonnage: number
    total_entries: number
    completed_by: string
    completed_at: string
}

export interface BatchSummary {
    batchId: string
    batchDate: string
    batchStatus: string
    entries: PurchaseWithPhotos[]
    totalEntries: number
    totalTonnage: number
    totalPhotos: number
    maxPurchases: number
    completion: BatchCompletion | null
    canViewBatch?: boolean
    /** Σ harga × berat (goods value) */
    totalNilaiGabah?: number
    /** Σ total dibayar (harga sampai tempat, incl. transport) */
    totalDibayar?: number
    /** max(0, totalDibayar − totalNilaiGabah): suggested batch transport cost */
    suggestedTransportCost?: number
}

export const formsAPI = {
    getInfo: (linkCode: string) =>
        apiRequest<ApiResponse<FormInfo>>(`/forms/batch/${linkCode}`),

    submitPurchase: async (linkCode: string, data: PurchaseFormData) => {
        const formData = new FormData()

        // Append text fields
        formData.append('calo', data.calo)
        formData.append('lokasiBelanja', data.lokasiBelanja)
        if (data.koordinat) formData.append('koordinat', data.koordinat)
        formData.append('hargaPerKg', data.hargaPerKg.toString())
        formData.append('beratGabahKg', data.beratGabahKg.toString())
        if (data.totalDibayar !== undefined && data.totalDibayar !== null) formData.append('totalDibayar', data.totalDibayar.toString())
        if (data.kadarAir) formData.append('kadarAir', data.kadarAir.toString())
        if (data.kadarHampa) formData.append('kadarHampa', data.kadarHampa.toString())
        formData.append('kualitasGabah', data.kualitasGabah)
        formData.append('kondisiGabah', data.kondisiGabah || 'kering')
        
        // Append photos
        data.photos.forEach(photo => {
            formData.append('photos', photo)
        })

        const response = await fetch(`/api/forms/batch/${linkCode}`, {
            credentials: 'include',
            method: 'POST',
            headers: {
                ...getCsrfHeaders()
            },
            body: formData,
        })

        const result = await parseResponseJson(response)
        if (!response.ok) {
            if (response.status >= 400 && response.status < 500 && (result.error || result.message)) {
                throw new AppError(result.error || result.message, response.status)
            }
            throw new Error(result.error || result.message || 'Failed to submit')
        }
        return result as ApiResponse<Purchase> & { purchaseCount: number; totalTonnage: number; maxPurchases: number }
    },

    getSummary: (linkCode: string) =>
        apiRequest<ApiResponse<BatchSummary>>(`/forms/batch/${linkCode}/summary`),

    completeBatch: async (linkCode: string, strukPhoto: File | null, lapanganPhoto: File | null, data?: Record<string, any>) => {
        const formData = new FormData()
        if (strukPhoto) formData.append('struk', strukPhoto)
        if (lapanganPhoto) formData.append('lapangan', lapanganPhoto)
        
        if (data) {
            if (data.driverName) formData.append('driverName', data.driverName)
            if (data.crewNames) formData.append('crewNames', data.crewNames)
            if (data.origin) formData.append('origin', data.origin)
            if (data.destination) formData.append('destination', data.destination)
            if (data.operationalCost) formData.append('operationalCost', data.operationalCost.toString())
            if (data.durationHours) formData.append('durationHours', data.durationHours.toString())
        }

        const response = await fetch(`/api/forms/batch/${linkCode}/complete`, {
            credentials: 'include',
            method: 'POST',
            headers: {
                ...getCsrfHeaders()
            },
            body: formData,
        })

        const result = await parseResponseJson(response)
        if (!response.ok) {
            if (response.status >= 400 && response.status < 500 && (result.error || result.message)) {
                throw new AppError(result.error || result.message, response.status)
            }
            throw new Error(result.error || result.message || 'Failed to complete batch')
        }
        return result as ApiResponse<any>
    },

    updatePurchase: (linkCode: string, purchaseId: string, data: Record<string, unknown>) =>
        apiRequest<ApiResponse<Purchase>>(`/forms/batch/${linkCode}/purchases/${purchaseId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    deletePurchase: (linkCode: string, purchaseId: string) =>
        apiRequest<ApiResponse<null>>(`/forms/batch/${linkCode}/purchases/${purchaseId}`, { method: 'DELETE' }),

    getMySubmissions: (params: { limit?: number; page?: number } = {}) => {
        const query = new URLSearchParams(params as Record<string, string>).toString()
        return apiRequest<PaginatedResponse<PurchaseWithPhotos>>(`/forms/my-submissions${query ? `?${query}` : ''}`)
    },
}

// Drying API (Admin)
export const dryingAPI = {
    getAll: (params: Record<string, string | number> = {}) => {
        const query = new URLSearchParams(params as Record<string, string>).toString()
        return apiRequest<PaginatedResponse<unknown>>(`/drying${query ? `?${query}` : ''}`)
    },

    getById: (id: string) => apiRequest<ApiResponse<unknown>>(`/drying/${id}`),

    create: (data: { name?: string; notes?: string; batchIds?: string[]; dryingType?: string; vendorName?: string; titipanInventoryId?: string }) =>
        apiRequest<ApiResponse<unknown>>('/drying', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        apiRequest<ApiResponse<unknown>>(`/drying/${id}`, { method: 'DELETE' }),

    updateBatches: (id: string, batchIds: string[]) =>
        apiRequest<ApiResponse<unknown>>(`/drying/${id}/batches`, {
            method: 'PUT',
            body: JSON.stringify({ batchIds }),
        }),

    getLinks: (id: string) => apiRequest<ApiResponse<unknown[]>>(`/drying/${id}/links`),

    createLink: (id: string, expiresAt?: string) =>
        apiRequest<ApiResponse<unknown>>(`/drying/${id}/links`, {
            method: 'POST',
            body: JSON.stringify({ expiresAt }),
        }),

    toggleActive: (id: string, isActive: boolean) =>
        apiRequest<ApiResponse<unknown>>(`/drying/${id}/active`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive }),
        }),

    approve: (id: string) =>
        apiRequest<ApiResponse<unknown>>(`/drying/${id}/approve`, { method: 'POST' }),

    reject: (id: string) =>
        apiRequest<ApiResponse<unknown>>(`/drying/${id}/reject`, { method: 'POST' }),

    toggleLink: (dryingId: string, linkId: string, isActive: boolean) =>
        apiRequest<ApiResponse<unknown>>(`/drying/${dryingId}/links/${linkId}`, {
            method: 'PATCH',
            body: JSON.stringify({ isActive }),
        }),

    deleteLink: (dryingId: string, linkId: string) =>
        apiRequest<ApiResponse<unknown>>(`/drying/${dryingId}/links/${linkId}`, { method: 'DELETE' }),

    getCosts: (dryingId: string) =>
        apiRequest<ApiResponse<any[]>>(`/drying/${dryingId}/costs`),

    addCost: (dryingId: string, data: { costType: string; description?: string; amount: number }) =>
        apiRequest<ApiResponse<any>>(`/drying/${dryingId}/costs`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    deleteCost: (dryingId: string, costId: string) =>
        apiRequest<ApiResponse<any>>(`/drying/${dryingId}/costs/${costId}`, { method: 'DELETE' }),
}

// Drying Forms API (Shareable)
export const dryingFormsAPI = {
    getFormInfo: (linkCode: string) =>
        apiRequest<ApiResponse<unknown>>(`/drying-forms/${linkCode}`),

    submitStart: async (linkCode: string, data: Record<string, unknown>, photos: File[]) => {
        const formData = new FormData()

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, String(value))
            }
        })

        photos.forEach(photo => {
            formData.append('photos', photo)
        })

        const response = await fetch(`/api/drying-forms/${linkCode}/start`, {
            credentials: 'include',
            method: 'POST',
            headers: {
                ...getCsrfHeaders()
            },
            body: formData,
        })

        const result = await parseResponseJson(response)
        if (!response.ok) {
            if (response.status >= 400 && response.status < 500 && (result.error || result.message)) {
                throw new AppError(result.error || result.message, response.status)
            }
            throw new Error(result.error || result.message || 'Failed to submit')
        }
        return result
    },

    submitEnd: async (linkCode: string, data: Record<string, unknown>, photos: File[], adminMode = false) => {
        const formData = new FormData()

        Object.entries(data).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                formData.append(key, String(value))
            }
        })

        photos.forEach(photo => {
            formData.append('photos', photo)
        })

        const response = await fetch(`/api/drying-forms/${linkCode}/end${adminMode ? '?mode=admin' : ''}`, {
            credentials: 'include',
            method: 'POST',
            headers: {
                ...getCsrfHeaders()
            },
            body: formData,
        })

        const result = await parseResponseJson(response)
        if (!response.ok) {
            if (response.status >= 400 && response.status < 500 && (result.error || result.message)) {
                throw new AppError(result.error || result.message, response.status)
            }
            throw new Error(result.error || result.message || 'Failed to submit')
        }
        return result
    },

    getSummary: (linkCode: string) =>
        apiRequest<ApiResponse<unknown>>(`/drying-forms/${linkCode}/summary`),
}

// Inventory API
export const inventoryAPI = {
    getAll: (params?: { status?: string; sourceType?: string; categoryCode?: string; processId?: string; isTitipan?: boolean | string; titipanSubtype?: string; page?: number; limit?: number; fifo?: boolean }) => {
        const query = new URLSearchParams()
        if (params?.status) query.set('status', params.status)
        if (params?.sourceType) query.set('sourceType', params.sourceType)
        if (params?.categoryCode) query.set('categoryCode', params.categoryCode)
        if (params?.processId) query.set('processId', params.processId)
        if (params?.isTitipan !== undefined && params?.isTitipan !== '') query.set('isTitipan', String(params.isTitipan))
        if (params?.titipanSubtype) query.set('titipanSubtype', params.titipanSubtype)
        if (params?.fifo) query.set('fifo', 'true')
        if (params?.page) query.set('page', String(params.page))
        if (params?.limit) query.set('limit', String(params.limit))
        return apiRequest<PaginatedResponse<unknown>>(`/inventory${query.toString() ? `?${query}` : ''}`)
    },

    getAvailable: (limit?: number) => {
        const ts = Date.now();
        return apiRequest<ApiResponse<unknown[]>>(`/inventory/available?_t=${ts}${limit ? `&limit=${limit}` : ''}`);
    },

    getStats: () => apiRequest<ApiResponse<unknown>>('/inventory/stats'),

    getCategories: () => apiRequest<ApiResponse<unknown[]>>('/inventory/categories'),

    getCategoryStats: () => apiRequest<ApiResponse<unknown[]>>('/inventory/category-stats'),

    getById: (id: string) => apiRequest<ApiResponse<unknown>>(`/inventory/${id}`),

    create: (data: {
        sourceType: string
        batchId?: string
        dryingId?: string
        area?: string
        tanda?: string
        kualitas?: string
        jenisGabah?: string
        productCategoryCode?: string
        avgPricePerKg?: number
        packagingSizeKg?: number
        notes?: string
        sacks?: { weightKg: number }[]
        // Titipan fields (used when sourceType is 'titipan_basah' or 'titipan_kering')
        weightKg?: number
        titipanData?: { pemilikNama: string; jenisGabah: string; beratKg: number }
    }) =>
        apiRequest<ApiResponse<unknown>>('/inventory', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    createFromDrying: (dryingId: string, data: { area?: string; tanda?: string; notes?: string }) =>
        apiRequest<ApiResponse<unknown>>(`/inventory/from-drying/${dryingId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    createFromBatch: (batchId: string, data: { tonnageKg: number; area?: string; tanda?: string; notes?: string }) =>
        apiRequest<ApiResponse<unknown>>(`/inventory/from-batch/${batchId}`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: { area?: string; tanda?: string; notes?: string; kualitas?: string }) =>
        apiRequest<ApiResponse<unknown>>(`/inventory/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        apiRequest<ApiResponse<unknown>>(`/inventory/${id}`, { method: 'DELETE' }),

    addSacks: (id: string, sacks: { weightKg: number }[]) =>
        apiRequest<ApiResponse<unknown>>(`/inventory/${id}/sacks`, {
            method: 'POST',
            body: JSON.stringify({ sacks }),
        }),

    takeSacks: (id: string, sackIds: string[], takenFor: 'process' | 'sale', referenceId?: string) =>
        apiRequest<ApiResponse<unknown>>(`/inventory/${id}/take`, {
            method: 'POST',
            body: JSON.stringify({ sackIds, takenFor, referenceId }),
        }),

    takeWeight: (id: string, weightKg: number, takenFor: 'process' | 'sale', referenceId?: string) =>
        apiRequest<ApiResponse<unknown>>(`/inventory/${id}/take-weight`, {
            method: 'POST',
            body: JSON.stringify({ weightKg, takenFor, referenceId }),
        }),

    getAvailableTitipanBasah: () =>
        apiRequest<ApiResponse<unknown[]>>('/inventory/titipan-basah'),
        
    returnToPenitip: (id: string, data?: { feeAmount?: number; feeNotes?: string }) =>
        apiRequest<ApiResponse<unknown>>(`/inventory/${id}/return-to-penitip`, { 
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined
        }),
}

// Pendataan Gabah API (R&D Internal Data Collection)
export interface PendataanGabah {
    id: string
    purchase_id: string
    jenis_gabah?: string
    varietas?: string
    kondisi_gabah?: string
    kadar_air?: number
    kadar_hampa?: number
    butir_rusak?: number
    benda_asing?: number
    notes?: string
    created_by?: string
    created_by_name?: string
    purchase_name?: string
    tanggal_belanja?: string
    berat_gabah_kg?: number
    created_at: string
    updated_at: string
}

export const pendataanAPI = {
    getAll: (params: { limit?: number; offset?: number } = {}) => {
        const query = new URLSearchParams()
        if (params.limit) query.set('limit', String(params.limit))
        if (params.offset) query.set('offset', String(params.offset))
        return apiRequest<ApiResponse<{ data: PendataanGabah[]; total: number }>>(`/pendataan${query.toString() ? `?${query}` : ''}`)
    },

    getById: (id: string) =>
        apiRequest<ApiResponse<PendataanGabah>>(`/pendataan/${id}`),

    getByPurchaseId: (purchaseId: string) =>
        apiRequest<ApiResponse<PendataanGabah | null>>(`/pendataan/by-purchase/${purchaseId}`),

    create: (data: {
        purchaseId: string
        jenisGabah?: string
        varietas?: string
        kondisiGabah?: string
        kadarAir?: number
        kadarHampa?: number
        butirRusak?: number
        bendaAsing?: number
        notes?: string
    }) =>
        apiRequest<ApiResponse<PendataanGabah>>('/pendataan', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    update: (id: string, data: {
        jenisGabah?: string
        varietas?: string
        kondisiGabah?: string
        kadarAir?: number
        kadarHampa?: number
        butirRusak?: number
        bendaAsing?: number
        notes?: string
    }) =>
        apiRequest<ApiResponse<PendataanGabah>>(`/pendataan/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),

    delete: (id: string) => apiRequest<ApiResponse<null>>(`/pendataan/${id}`, { method: 'DELETE' }),
}

// Customers API
export const customersAPI = {
    getAll: (params: { isActive?: boolean; tierId?: string; search?: string } = {}) => {
        const query = new URLSearchParams()
        if (params.isActive !== undefined) query.set('isActive', String(params.isActive))
        if (params.tierId) query.set('tierId', params.tierId)
        if (params.search) query.set('search', params.search)
        return apiRequest<ApiResponse<Customer[]>>(`/sales-v2/customers${query.toString() ? `?${query}` : ''}`)
    },
    getById: (id: string) => apiRequest<ApiResponse<Customer>>(`/sales-v2/customers/${id}`),
    create: (data: Partial<Customer>) => apiRequest<ApiResponse<Customer>>('/sales-v2/customers', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id: string, data: Partial<Customer>) => apiRequest<ApiResponse<Customer>>(`/sales-v2/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id: string) => apiRequest<ApiResponse<Customer>>(`/sales-v2/customers/${id}`, { method: 'DELETE' }),
}

// Price List API
export const priceListAPI = {
    getTiers: () => apiRequest<ApiResponse<CustomerTier[]>>('/sales-v2/tiers'),
    createTier: (data: { name: string; description?: string }) => apiRequest<ApiResponse<CustomerTier>>('/sales-v2/tiers', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    getAll: (tierId?: string) => {
        const query = tierId ? `?tierId=${tierId}` : ''
        return apiRequest<ApiResponse<PriceList[]>>(`/sales-v2/price-list${query}`)
    },
    getActivePrice: (tierId: string, categoryId: string, date?: string) => {
        const query = new URLSearchParams({ tierId, categoryId })
        if (date) query.set('date', date)
        return apiRequest<ApiResponse<PriceList | null>>(`/sales-v2/price-list/active?${query.toString()}`)
    },
    create: (data: Partial<PriceList>) => apiRequest<ApiResponse<PriceList>>('/sales-v2/price-list', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    delete: (id: string) => apiRequest<ApiResponse<PriceList>>(`/sales-v2/price-list/${id}`, { method: 'DELETE' }),
}

// Sales V2 API
export const salesV2API = {
    getAll: (params: { status?: string; paymentStatus?: string; customerId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {}) => {
        const query = new URLSearchParams()
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) query.set(key, String(value))
        })
        return apiRequest<PaginatedResponse<SaleV2>>(`/sales-v2/sales${query.toString() ? `?${query}` : ''}`)
    },
    getById: (id: string) => apiRequest<ApiResponse<SaleV2>>(`/sales-v2/sales/${id}?_t=${Date.now()}`),
    getStats: () => apiRequest<ApiResponse<any>>('/sales-v2/sales/stats'),
    create: (data: { customerId?: string; saleDate?: string; notes?: string; items?: any[] }) =>
        apiRequest<ApiResponse<SaleV2>>('/sales-v2/sales', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    updateCustomer: (id: string, customerId: string) =>
        apiRequest<ApiResponse<SaleV2>>(`/sales-v2/sales/${id}/customer`, {
            method: 'PUT',
            body: JSON.stringify({ customerId }),
        }),
    confirm: (id: string) => apiRequest<ApiResponse<SaleV2>>(`/sales-v2/sales/${id}/confirm`, {
        method: 'POST',
    }),
    setDeduction: (id: string, data: { amount: number; note?: string }) =>
        apiRequest<ApiResponse<SaleV2>>(`/sales-v2/sales/${id}/deduction`, {
            method: 'PUT',
            body: JSON.stringify(data),
        }),
    void: (id: string, voidReason: string) => apiRequest<ApiResponse<SaleV2>>(`/sales-v2/sales/${id}/void`, {
        method: 'POST',
        body: JSON.stringify({ voidReason }),
    }),
    close: (id: string) => apiRequest<ApiResponse<SaleV2>>(`/sales-v2/sales/${id}/close`, { method: 'POST' }),
    addItem: (id: string, data: any) => apiRequest<ApiResponse<SaleItem>>(`/sales-v2/sales/${id}/items`, {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    removeItem: (id: string, itemId: string) => apiRequest<ApiResponse<any>>(`/sales-v2/sales/${id}/items/${itemId}`, { method: 'DELETE' }),

    // Deliveries
    createDelivery: (id: string, data: { deliveryDate?: string; notes?: string; items: { saleItemId: string; qtyDelivered: number }[] }) =>
        apiRequest<ApiResponse<SaleDelivery>>(`/sales-v2/sales/${id}/deliveries`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    deleteDelivery: (id: string, deliveryId: string) => apiRequest<ApiResponse<any>>(`/sales-v2/sales/${id}/deliveries/${deliveryId}`, { method: 'DELETE' }),

    // Payments
    createPayment: async (id: string, data: { paymentDate?: string; amount: number; paymentMethod: string; referenceNo?: string; notes?: string; buktiNota?: File | null }) => {
        if (data.buktiNota) {
            const formData = new FormData()
            formData.append('amount', String(data.amount))
            formData.append('paymentMethod', data.paymentMethod)
            if (data.paymentDate) formData.append('paymentDate', data.paymentDate)
            if (data.referenceNo) formData.append('referenceNo', data.referenceNo)
            if (data.notes) formData.append('notes', data.notes)
            formData.append('buktiNota', data.buktiNota)

            const response = await fetch(`/api/sales-v2/sales/${id}/payments`, {
                credentials: 'include',
                method: 'POST',
                headers: { ...getCsrfHeaders() },
                body: formData,
            })
            const result = await response.json()
            if (!response.ok) {
                throw new Error(result.error || result.message || 'Failed to create payment')
            }
            return result as ApiResponse<SalePayment>
        } else {
            return apiRequest<ApiResponse<SalePayment>>(`/sales-v2/sales/${id}/payments`, {
                method: 'POST',
                body: JSON.stringify(data),
            })
        }
    },
    deletePayment: (id: string, paymentId: string) => apiRequest<ApiResponse<any>>(`/sales-v2/sales/${id}/payments/${paymentId}`, { method: 'DELETE' }),

    // Returns
    createReturn: (id: string, data: { returnType: string; reason: string; biayaTambahan?: number; items?: { saleItemId: string; qtyReturned: number }[] }) =>
        apiRequest<ApiResponse<SaleReturn>>(`/sales-v2/sales/${id}/returns`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    deleteReturn: (id: string, returnId: string) => apiRequest<ApiResponse<any>>(`/sales-v2/sales/${id}/returns/${returnId}`, { method: 'DELETE' }),
}

// Finance API
export interface CashVoucherItem {
    journal_id: string
    amount: number | string
    account_id: string | null
    account_name: string | null
    category: string
    description: string
    status: string
    transaction_date: string
}

/** Bukti Kas Keluar (BKK) / Masuk (BKM): beberapa transaksi dibayar/diterima sekaligus */
export interface CashVoucher {
    id: string
    voucher_no: string
    voucher_type: 'IN' | 'OUT'
    voucher_date: string
    total_amount: number | string
    notes: string | null
    created_at: string
    created_by_name: string | null
    items: CashVoucherItem[]
}

export const financeAPI = {
    getDashboard: () => apiRequest<ApiResponse<any>>('/finance/dashboard'),
    getAccounts: (params?: { category?: string, type?: string }) => {
        const query = params ? `?${new URLSearchParams(params as any).toString()}` : ''
        return apiRequest<ApiResponse<any[]>>(`/finance/accounts${query}`)
    },
    createAccount: (data: any) => apiRequest<ApiResponse<any>>('/finance/accounts', { method: 'POST', body: JSON.stringify(data) }),
    updateAccount: (id: string, data: any) => apiRequest<ApiResponse<any>>(`/finance/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Legacy: single-day report
    getDailyReport: (date?: string) => {
        const query = date ? `?date=${date}` : ''
        return apiRequest<ApiResponse<any>>(`/finance/daily-report${query}`)
    },

    // NEW: date range report
    getReport: (startDate?: string, endDate?: string) => {
        const query = new URLSearchParams()
        if (startDate) query.set('startDate', startDate)
        if (endDate) query.set('endDate', endDate)
        return apiRequest<ApiResponse<any>>(`/finance/report${query.toString() ? `?${query}` : ''}`)
    },

    // NEW: download report as PDF (date range)
    downloadReport: (startDate?: string, endDate?: string) => {
        const query = new URLSearchParams()
        if (startDate) query.set('startDate', startDate)
        if (endDate) query.set('endDate', endDate)
        const token = localStorage.getItem('token')
        if (token) query.set('token', token)
        window.open(`/api/finance/report/download?${query.toString()}`, '_blank')
    },

    // Legacy: download daily report as PDF
    downloadDailyReport: (date?: string) => {
        const query = date ? `?date=${date}` : ''
        window.open(`/api/finance/daily-report/download${query}`, '_blank')
    },

    createOverhead: (data: {
        expenseDate: string
        category: string
        description?: string
        amount: number
        frequency: string
        paymentMethod: string
        financeAccountId?: string
    }) => apiRequest<ApiResponse<any>>('/finance/overhead', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    recordPurchasePayment: (data: {
        purchaseId: string
        paymentDate: string
        amount: number
        paymentMethod: string
        financeAccountId?: string
        referenceNo?: string
        notes?: string
    }) => apiRequest<ApiResponse<any>>('/finance/purchase-payments', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    getBalanceSheet: (asOfDate?: string) => {
        const query = asOfDate ? `?asOfDate=${asOfDate}` : ''
        return apiRequest<ApiResponse<any>>(`/finance/balance-sheet${query}`)
    },

    getCaloAnalytics: () => apiRequest<ApiResponse<any[]>>('/finance/calo-analytics'),

    // ── Approval Center (NEW) ──────────────────────────────────────────
    getApprovals: () => apiRequest<ApiResponse<any[]>>('/finance/approvals'),

    approveTransaction: (transactionId: string, accountId: string) =>
        apiRequest<ApiResponse<any>>(`/finance/transactions/${transactionId}/approve`, {
            method: 'PUT',
            body: JSON.stringify({ accountId }),
        }),
        
    /** Bukti kas: approve several pending transactions as one cash movement (BKK/BKM) */
    payBatch: (data: { items: { journalId: string; accountId: string }[]; voucherDate?: string; notes?: string }) =>
        apiRequest<ApiResponse<CashVoucher>>('/finance/vouchers', {
            method: 'POST',
            body: JSON.stringify(data),
        }),
    getVouchers: (limit = 30) => apiRequest<ApiResponse<CashVoucher[]>>(`/finance/vouchers?limit=${limit}`),

    rejectTransaction: (transactionId: string) =>
        apiRequest<ApiResponse<any>>(`/finance/transactions/${transactionId}/reject`, {
            method: 'PUT',
        }),

    getTransactionDetail: (transactionId: string) =>
        apiRequest<ApiResponse<any>>(`/finance/transactions/${transactionId}`),

    transferFunds: (data: {
        fromAccountId: string
        toAccountId: string
        amount: number
        description?: string
    }) => apiRequest<ApiResponse<any>>('/finance/transfer', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    recordManualTransaction: (data: {
        accountId: string
        transactionType: 'IN' | 'OUT'
        amount: number
        category: string
        description?: string
    }) => apiRequest<ApiResponse<any>>('/finance/transactions/manual', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    getRecentActivity: (limit?: number) => {
        const query = limit ? `?limit=${limit}` : ''
        return apiRequest<ApiResponse<any[]>>(`/finance/recent-activity${query}`)
    },
}

// AI Analysis API
export interface AIAnalysisReport {
    id: string
    from_date: string
    to_date: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    report_content?: string
    created_by?: string
    created_at: string
    updated_at: string
}

export const aiAnalysisAPI = {
    getAll: (params: { page?: number; limit?: number } = {}) => {
        const query = new URLSearchParams()
        if (params.page) query.set('page', String(params.page))
        if (params.limit) query.set('limit', String(params.limit))
        return apiRequest<PaginatedResponse<AIAnalysisReport>>(
            `/ai-analysis${query.toString() ? `?${query}` : ''}`
        )
    },

    getById: (id: string) =>
        apiRequest<ApiResponse<AIAnalysisReport>>(`/ai-analysis/${id}`),

    create: (data: { fromDate: string; toDate: string }) =>
        apiRequest<ApiResponse<AIAnalysisReport>>('/ai-analysis', {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    delete: (id: string) =>
        apiRequest<ApiResponse<null>>(`/ai-analysis/${id}`, { method: 'DELETE' }),
}


// Logistics API
export interface LogisticsTask {
    id: string;
    reference_type: 'PURCHASE' | 'SALE';
    reference_id: string;
    driver_name: string;
    crew_names?: string;
    origin?: string;
    destination?: string;
    duration_hours?: number;
    operational_cost: number;
    finance_transaction_id?: string;
    status: string;
    notes?: string;
    reference_name?: string;
    reference_date?: string;
    created_at: string;
}

export const settingsAPI = {
    getLockDate: () => apiRequest<ApiResponse<any>>('/settings/lock-date'),
    updateLockDate: (data: { lockDate: string | null }) => apiRequest<ApiResponse<any>>('/settings/lock-date', {
        method: 'PUT',
        body: JSON.stringify(data)
    })
}

export const logisticsAPI = {
    getAll: (params?: { referenceType?: string; status?: string }) => {
        const query = new URLSearchParams()
        if (params?.referenceType) query.set('referenceType', params.referenceType)
        if (params?.status) query.set('status', params.status)
        return apiRequest<ApiResponse<LogisticsTask[]>>(`/logistics${query.toString() ? `?${query}` : ''}`)
    },

    getById: (id: string) => apiRequest<ApiResponse<LogisticsTask>>(`/logistics/${id}`),

    create: (data: {
        referenceType: string;
        referenceId: string;
        driverName: string;
        crewNames?: string;
        origin?: string;
        destination?: string;
        durationHours?: number;
        operationalCost?: number;
        notes?: string;
    }) => apiRequest<ApiResponse<LogisticsTask>>('/logistics', {
        method: 'POST',
        body: JSON.stringify(data),
    }),

    update: (id: string, data: Record<string, unknown>) => apiRequest<ApiResponse<LogisticsTask>>(`/logistics/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),

    getAvailableReferences: (type: 'PURCHASE' | 'SALE') =>
        apiRequest<ApiResponse<{ id: string, name: string, date: string, weight?: number, amount?: number }[]>>(`/logistics/references?type=${type}`)
}

// ─── Pengiriman penjualan (1 mobil, bisa banyak nota) ─────────────────────────
export interface ShipmentSale {
    id: string
    sale_no: string
    sale_date: string
    status: string
    customer_name?: string | null
    total_amount: number | string
    total_kg: number | string
}

export interface SaleShipment extends LogisticsTask {
    shipment_date?: string | null
    commission_rate_per_kg: number | string
    commission_amount: number | string
    commission_recipient?: string | null
    commission_transaction_id?: string | null
    transport_journal_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null
    commission_journal_status?: 'PENDING' | 'APPROVED' | 'REJECTED' | null
    total_kg: number | string
    sales: ShipmentSale[]
}

export interface SaleShipmentInput {
    saleIds: string[]
    shipmentDate?: string
    driverName: string
    crewNames?: string
    origin?: string
    destination?: string
    durationHours?: number | null
    operationalCost?: number
    commissionRatePerKg?: number
    /** Omit to let the server use tarif/kg × total kg */
    commissionAmount?: number | null
    commissionRecipient?: string
    notes?: string
}

export const shipmentsAPI = {
    getAll: () => apiRequest<ApiResponse<SaleShipment[]>>('/logistics/shipments'),
    getById: (id: string) => apiRequest<ApiResponse<SaleShipment>>(`/logistics/shipments/${id}`),
    getAvailableSales: (excludeShipmentId?: string) =>
        apiRequest<ApiResponse<ShipmentSale[]>>(
            `/logistics/shipments/available-sales${excludeShipmentId ? `?excludeShipmentId=${excludeShipmentId}` : ''}`
        ),
    create: (data: SaleShipmentInput) => apiRequest<ApiResponse<SaleShipment>>('/logistics/shipments', {
        method: 'POST',
        body: JSON.stringify(data),
    }),
    update: (id: string, data: SaleShipmentInput) => apiRequest<ApiResponse<SaleShipment>>(`/logistics/shipments/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    }),
    delete: (id: string) => apiRequest<ApiResponse<{ id: string }>>(`/logistics/shipments/${id}`, {
        method: 'DELETE',
    }),
}

// ─── Admin Monitoring API ─────────────────────────────────────────────────────
// All endpoints require is_super_admin = true in the database.
export const adminMonitoringAPI = {
    getOverview: () =>
        apiRequest<ApiResponse<any>>('/admin/overview'),

    getUsers: () =>
        apiRequest<ApiResponse<any[]>>('/admin/users'),

    getUserDetail: (id: string) =>
        apiRequest<ApiResponse<any>>(`/admin/users/${id}`),

    getDatabaseStats: () =>
        apiRequest<ApiResponse<any>>('/admin/database'),

    getStorageStats: () =>
        apiRequest<ApiResponse<any>>('/admin/storage'),

    getComputingMetrics: (windowMinutes = 60, service?: string) =>
        apiRequest<ApiResponse<any>>(`/admin/computing?window=${windowMinutes}${service ? `&service=${encodeURIComponent(service)}` : ''}`),

    invalidateCache: (key?: string) =>
        apiRequest<ApiResponse<any>>('/admin/cache/invalidate', {
            method: 'POST',
            body: JSON.stringify({ key }),
        }),
}
