// Application constants
module.exports = {
  USER_ROLES: {
    ADMIN: 'admin',
    OPERATOR: 'operator',
    VIEWER: 'viewer'
  },

  BATCH_STATUS: {
    OPEN: 'OPEN',
    CLOSED: 'CLOSED'
  },

  PROCESS_STATUS: {
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED'
  },

  KUALITAS_GABAH: {
    JELEK: 'jelek',
    BIASA: 'biasa',
    BAGUS: 'bagus',
    SANGAT_BAGUS: 'sangat_bagus'
  },

  KONDISI_GABAH: {
    KERING: 'kering',
    BASAH: 'basah'
  },

  HASIL_KUALITAS: {
    JELEK: 'jelek',
    BIASA: 'biasa',
    BAGUS: 'bagus',
    SANGAT_BAGUS: 'sangat_bagus'
  },

  FILE_TYPES: {
    STRUK: 'struk',
    GABAH: 'gabah',
    PROSES: 'proses',
    HASIL: 'hasil',
    RETUR: 'retur'
  },

  SALE_TYPES: {
    BERAS: 'beras',
    DEDAK: 'dedak',
    SEKAM: 'sekam',
    MENIR: 'menir',
    BROKEN: 'broken'
  },

  ENTITY_TYPES: {
    BATCH: 'batch',
    PROCESS: 'process'
  },

  UPLOAD_STATUS: {
    PENDING: 'pending',
    COMPLETED: 'completed',
    EXPIRED: 'expired'
  },

  LOG_ACTIONS: {
    CREATE: 'CREATE',
    UPDATE: 'UPDATE',
    DELETE: 'DELETE'
  },

  // Business rules
  BATCH_MIN_PURCHASES: 1,
  BATCH_MAX_PURCHASES: 8,
  PROCESS_MIN_BATCHES: 1,
  PROCESS_MAX_BATCHES: 3,
  PROCESS_MAX_DURATION_DAYS: 2,

  // File upload limits
  FILE_LIMITS: {
    struk: 1,
    gabah: 3,
    proses: 3,
    hasil: 3
  },

  // Pagination
  DEFAULT_PAGE_SIZE: 30,
  MAX_PAGE_SIZE: 100
};
