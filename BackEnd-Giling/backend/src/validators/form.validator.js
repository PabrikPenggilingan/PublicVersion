const { AppError } = require('../utils/errors');

class ValidationError extends AppError {
    constructor(message, field) {
        super(message, 400);
        this.field = field;
    }
}

// Regex patterns
const PATTERNS = {
    // Only letters, spaces, dots, commas, and common Indonesian chars
    name: /^[a-zA-Z\s.,'\-]+$/,
    // More permissive for people involved (allows numbers, counts, and newlines)
    peopleText: /^[a-zA-Z0-9\s.,'\-:()/\n\r]+$/,
    // Vendor name - letters, numbers, spaces, common business chars
    vendorName: /^[a-zA-Z0-9\s.,'\-&()]+$/,
    // Notes - very permissive
    notes: /^[a-zA-Z0-9\s.,'\-:;!?()@#%&*+=\[\]{}|\\/<>]+$/,
    // Date format YYYY-MM-DD
    date: /^\d{4}-\d{2}-\d{2}$/,
    // Time format HH:MM
    time: /^\d{2}:\d{2}$/,
    // Link code - alphanumeric
    linkCode: /^[a-zA-Z0-9]+$/,
};

// Limits
const LIMITS = {
    name: { min: 2, max: 100 },
    peopleText: { min: 0, max: 500 },
    vendorName: { min: 2, max: 200 },
    notes: { min: 0, max: 1000 },
    tonnage: { min: 1, max: 999999999 },
    percentage: { min: 0, max: 100 },
    linkCode: { min: 6, max: 20 },
};

// Rate limits per entity type
const RATE_LIMITS = {
    batch: 10,
    drying: 5,
    process: 3,
};

/**
 * Sanitize string - remove potentially dangerous characters
 */
function sanitizeString(str) {
    if (typeof str !== 'string') return '';
    return str
        .trim()
        .replace(/[<>]/g, '') // Remove HTML tags
        .replace(/\\/g, '')    // Remove backslashes
        .substring(0, 2000);   // Max length safety
}

/**
 * Validate required string field
 */
function validateRequired(value, fieldName) {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
        throw new ValidationError(`${fieldName} wajib diisi`, fieldName);
    }
    return true;
}

/**
 * Validate string with pattern and length
 */
function validateString(value, fieldName, options = {}) {
    const {
        required = false,
        pattern = null,
        minLength = 0,
        maxLength = 1000,
        sanitize = true
    } = options;

    if (required) {
        validateRequired(value, fieldName);
    }

    if (value === undefined || value === null || value === '') {
        return sanitize ? '' : value;
    }

    let str = String(value);
    if (sanitize) {
        str = sanitizeString(str);
    }

    if (str.length < minLength) {
        throw new ValidationError(`${fieldName} minimal ${minLength} karakter`, fieldName);
    }

    if (str.length > maxLength) {
        throw new ValidationError(`${fieldName} maksimal ${maxLength} karakter`, fieldName);
    }

    if (pattern && !pattern.test(str)) {
        throw new ValidationError(`${fieldName} mengandung karakter tidak valid`, fieldName);
    }

    return str;
}

/**
 * Validate integer
 */
function validateInteger(value, fieldName, options = {}) {
    const { required = false, min = 0, max = Number.MAX_SAFE_INTEGER } = options;

    if (required) {
        validateRequired(value, fieldName);
    }

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const num = parseInt(value, 10);

    if (isNaN(num)) {
        throw new ValidationError(`${fieldName} harus berupa angka bulat`, fieldName);
    }

    if (num < min) {
        throw new ValidationError(`${fieldName} minimal ${min}`, fieldName);
    }

    if (num > max) {
        throw new ValidationError(`${fieldName} maksimal ${max}`, fieldName);
    }

    return num;
}

/**
 * Validate float/decimal
 */
function validateFloat(value, fieldName, options = {}) {
    const { required = false, min = 0, max = Number.MAX_VALUE, precision = 2 } = options;

    if (required) {
        validateRequired(value, fieldName);
    }

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const num = parseFloat(value);

    if (isNaN(num)) {
        throw new ValidationError(`${fieldName} harus berupa angka`, fieldName);
    }

    if (num < min) {
        throw new ValidationError(`${fieldName} minimal ${min}`, fieldName);
    }

    if (num > max) {
        throw new ValidationError(`${fieldName} maksimal ${max}`, fieldName);
    }

    return parseFloat(num.toFixed(precision));
}

/**
 * Validate date string (YYYY-MM-DD)
 */
function validateDate(value, fieldName, options = {}) {
    const { required = false } = options;

    if (required) {
        validateRequired(value, fieldName);
    }

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const str = String(value).trim();

    if (!PATTERNS.date.test(str)) {
        throw new ValidationError(`${fieldName} format tidak valid (YYYY-MM-DD)`, fieldName);
    }

    const date = new Date(str);
    if (isNaN(date.getTime())) {
        throw new ValidationError(`${fieldName} bukan tanggal valid`, fieldName);
    }

    return str;
}

/**
 * Validate time string (HH:MM)
 */
function validateTime(value, fieldName, options = {}) {
    const { required = false } = options;

    if (required) {
        validateRequired(value, fieldName);
    }

    if (value === undefined || value === null || value === '') {
        return null;
    }

    const str = String(value).trim();

    if (!PATTERNS.time.test(str)) {
        throw new ValidationError(`${fieldName} format tidak valid (HH:MM)`, fieldName);
    }

    const [hours, minutes] = str.split(':').map(Number);
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
        throw new ValidationError(`${fieldName} bukan waktu valid`, fieldName);
    }

    return str;
}

/**
 * Validate link code
 */
function validateLinkCode(value, fieldName = 'Link Code') {
    validateRequired(value, fieldName);

    const str = String(value).trim();

    if (str.length < LIMITS.linkCode.min || str.length > LIMITS.linkCode.max) {
        throw new ValidationError(`${fieldName} tidak valid`, fieldName);
    }

    if (!PATTERNS.linkCode.test(str)) {
        throw new ValidationError(`${fieldName} tidak valid`, fieldName);
    }

    return str;
}

/**
 * Validate drying session form data
 */
function validateDryingSessionData(data) {
    const validated = {};

    // PIC - required, name pattern
    validated.pic = validateString(data.pic, 'PIC', {
        required: true,
        pattern: PATTERNS.name,
        minLength: LIMITS.name.min,
        maxLength: LIMITS.name.max,
    });

    // People involved - optional, more permissive
    validated.peopleInvolved = validateString(data.peopleInvolved, 'Orang Terlibat', {
        required: false,
        pattern: PATTERNS.peopleText,
        minLength: LIMITS.peopleText.min,
        maxLength: LIMITS.peopleText.max,
    });

    // Session date - required
    validated.sessionDate = validateDate(data.sessionDate, 'Tanggal', { required: true });

    // Session time - required
    validated.sessionTime = validateTime(data.sessionTime, 'Jam', { required: true });

    // Tonnage - required, integer
    validated.tonnageKg = validateInteger(data.tonnageKg, 'Tonase', {
        required: true,
        min: LIMITS.tonnage.min,
        max: LIMITS.tonnage.max,
    });

    // Moisture content - optional, percentage
    validated.moistureContent = validateFloat(data.moistureContent, 'Kadar Air', {
        required: false,
        min: LIMITS.percentage.min,
        max: LIMITS.percentage.max,
        precision: 2,
    });

    return validated;
}

/**
 * Validate purchase form data (for batch)
 */
function validatePurchaseData(data) {
    const validated = {};

    // Seller name - required
    validated.sellerName = validateString(data.sellerName, 'Nama Penjual', {
        required: true,
        pattern: PATTERNS.name,
        minLength: LIMITS.name.min,
        maxLength: LIMITS.name.max,
    });

    // Weight - required integer
    validated.weightKg = validateInteger(data.weightKg, 'Berat', {
        required: true,
        min: 1,
        max: LIMITS.tonnage.max,
    });

    // Price per kg - optional integer
    validated.pricePerKg = validateInteger(data.pricePerKg, 'Harga per KG', {
        required: false,
        min: 0,
        max: LIMITS.tonnage.max,
    });

    // Notes - optional
    validated.notes = validateString(data.notes, 'Catatan', {
        required: false,
        pattern: PATTERNS.notes,
        minLength: LIMITS.notes.min,
        maxLength: LIMITS.notes.max,
    });

    // Kondisi gabah - optional string (enum)
    if (data.kondisiGabah) {
        const allowedKondisi = ['basah', 'kering'];
        if (!allowedKondisi.includes(data.kondisiGabah)) {
            throw new ValidationError('Kondisi gabah tidak valid', 'kondisiGabah');
        }
        validated.kondisiGabah = data.kondisiGabah;
    }

    return validated;
}

/**
 * Validate drying creation data (admin)
 */
function validateDryingCreationData(data) {
    const validated = {};

    // Name - required
    validated.name = validateString(data.name, 'Nama Pengeringan', {
        required: true,
        minLength: LIMITS.name.min,
        maxLength: 200,
    });

    // Notes - optional
    validated.notes = validateString(data.notes, 'Catatan', {
        required: false,
        pattern: PATTERNS.notes,
        minLength: LIMITS.notes.min,
        maxLength: LIMITS.notes.max,
    });

    // Drying type - required enum
    const allowedTypes = ['oven_mandiri', 'oven_vendor', 'jemur_mandiri', 'jemur_vendor'];
    if (data.dryingType && !allowedTypes.includes(data.dryingType)) {
        throw new ValidationError('Tipe pengeringan tidak valid', 'dryingType');
    }
    validated.dryingType = data.dryingType || 'oven_mandiri';

    // Vendor name - required if vendor type
    if (validated.dryingType.includes('vendor')) {
        validated.vendorName = validateString(data.vendorName, 'Nama Vendor', {
            required: true,
            pattern: PATTERNS.vendorName,
            minLength: LIMITS.vendorName.min,
            maxLength: LIMITS.vendorName.max,
        });
    } else {
        validated.vendorName = null;
    }

    // Batch IDs - optional array of UUIDs/integers
    if (data.batchIds && Array.isArray(data.batchIds)) {
        validated.batchIds = data.batchIds.filter(id => id && (typeof id === 'string' || typeof id === 'number'));
    }

    return validated;
}

module.exports = {
    ValidationError,
    PATTERNS,
    LIMITS,
    RATE_LIMITS,
    sanitizeString,
    validateRequired,
    validateString,
    validateInteger,
    validateFloat,
    validateDate,
    validateTime,
    validateLinkCode,
    validateDryingSessionData,
    validatePurchaseData,
    validateDryingCreationData,
};
