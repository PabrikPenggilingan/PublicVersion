# API Reference

Base URL: `http://localhost:3000/api`

## Authentication

All endpoints except `/auth/register` and `/auth/login` require authentication via JWT token in the Authorization header:

```
Authorization: Bearer <token>
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... }
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 30,
    "total": 100,
    "totalPages": 4,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message"
}
```

---

## Authentication Endpoints

### Register User
```
POST /api/auth/register
```

**Body:**
```json
{
  "username": "john_doe",
  "password": "securepassword",
  "role": "operator"  // optional: admin, operator, viewer
}
```

**Response:** 201 Created
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "john_doe",
      "role": "operator"
    },
    "token": "jwt_token"
  }
}
```

---

### Login
```
POST /api/auth/login
```

**Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "admin",
      "role": "admin"
    },
    "token": "jwt_token"
  }
}
```

---

### Get Current User
```
GET /api/auth/me
```

**Headers:** `Authorization: Bearer <token>`

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "admin",
    "role": "admin",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Logout
```
POST /api/auth/logout
```

**Headers:** `Authorization: Bearer <token>`

**Response:** 200 OK
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## Batch Endpoints

### List Batches
```
GET /api/batches?page=1&limit=30&status=OPEN
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 30, max: 100)
- `status` (optional): Filter by status (OPEN, CLOSED)

**Response:** 200 OK (paginated)

---

### Get Batch by ID
```
GET /api/batches/:id
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "created_by": "uuid",
    "batch_date": "2024-01-01",
    "status": "OPEN",
    "total_qty_kg": 3500.00,
    "remaining_kg": 3500.00,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### Create Batch
```
POST /api/batches
```

**Permissions:** Admin, Operator

**Body:**
```json
{
  "batchDate": "2024-01-15",
  "status": "OPEN"  // optional
}
```

**Response:** 201 Created

---

### Update Batch
```
PUT /api/batches/:id
```

**Permissions:** Admin, Operator

**Body:**
```json
{
  "batchDate": "2024-01-16",
  "status": "CLOSED"
}
```

**Response:** 200 OK

---

### Delete Batch
```
DELETE /api/batches/:id
```

**Permissions:** Admin only

**Response:** 200 OK

---

## Purchase Endpoints

### List Purchases by Batch
```
GET /api/batches/:batchId/purchases?page=1&limit=30
```

**Response:** 200 OK (paginated)

---

### Get Purchase by ID
```
GET /api/purchases/:id
```

**Response:** 200 OK
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "batch_id": "uuid",
    "nama": "Pak Budi",
    "tanggal_belanja": "2024-01-15",
    "calo": "Ibu Siti",
    "harga_per_kg": 7500.00,
    "total_harga": 11250000.00,
    "lokasi_belanja": "Sawah Indah",
    "koordinat": "-6.123456,106.123456",
    "berat_gabah_kg": 1500.00,
    "jenis_gabah": "IR64",
    "kadar_air": 14.50,
    "kadar_hampa": 2.30,
    "kualitas_gabah": "bagus",
    "created_at": "2024-01-15T00:00:00Z",
    "updated_at": "2024-01-15T00:00:00Z"
  }
}
```

---

### Create Purchase
```
POST /api/batches/:batchId/purchases
```

**Permissions:** Admin, Operator

**Body:**
```json
{
  "nama": "Pak Budi",
  "tanggalBelanja": "2024-01-15",
  "calo": "Ibu Siti",
  "hargaPerKg": 7500,
  "totalHarga": 11250000,  // optional, auto-calculated
  "lokasiBelanja": "Sawah Indah, Desa Makmur",
  "koordinat": "-6.123456,106.123456",  // optional
  "beratGabahKg": 1500,
  "jenisGabah": "IR64",
  "kadarAir": 14.5,  // optional
  "kadarHampa": 2.3,  // optional
  "kualitasGabah": "bagus"  // jelek, biasa, bagus, sangat_bagus
}
```

**Response:** 201 Created

---

### Update Purchase
```
PUT /api/purchases/:id
```

**Permissions:** Admin, Operator

**Body:** Same as create (all fields optional)

**Response:** 200 OK

---

### Delete Purchase
```
DELETE /api/purchases/:id
```

**Permissions:** Admin only

**Response:** 200 OK

---

## Process Endpoints

### List Processes
```
GET /api/processes?page=1&limit=30&status=IN_PROGRESS
```

**Status:** ⚠️ Not yet implemented

---

### Get Process by ID
```
GET /api/processes/:id
```

**Status:** ⚠️ Not yet implemented

---

### Create Process
```
POST /api/processes
```

**Permissions:** Admin, Operator

**Status:** ⚠️ Not yet implemented

---

### Update Process
```
PUT /api/processes/:id
```

**Permissions:** Admin, Operator

**Status:** ⚠️ Not yet implemented

---

### Delete Process
```
DELETE /api/processes/:id
```

**Permissions:** Admin only

**Status:** ⚠️ Not yet implemented

---

### Attach Batch to Process
```
POST /api/processes/:id/batches
```

**Permissions:** Admin, Operator

**Body:**
```json
{
  "batchId": "uuid",
  "qtyUsedKg": 1500.00
}
```

**Status:** ⚠️ Not yet implemented

---

### Detach Batch from Process
```
DELETE /api/processes/:id/batches/:batchId
```

**Permissions:** Admin, Operator

**Status:** ⚠️ Not yet implemented

---

## Sales Endpoints

### Get Sales by Process
```
GET /api/processes/:processId/sales
```

**Status:** ⚠️ Not yet implemented

---

### Create Beras Sale
```
POST /api/processes/:processId/sales/beras
```

**Permissions:** Admin, Operator

**Body:**
```json
{
  "nama": "Toko Beras Jaya",
  "tanggalJual": "2024-01-20",
  "calo": "Pak Hasan",
  "hargaJualPerKg": 12000,
  "hargaJualTotal": 18000000,  // optional
  "jualKemana": "Pasar Induk",
  "tonase": 1500,
  "rendemen": 65.5,
  "hasilAkhir": "bagus",
  "derajatSosoh": 95,
  "butirPatah": 5,
  "butirKepala": 90,
  "kadarAir": 13,
  "bendaAsing": 0.5
}
```

**Status:** ⚠️ Not yet implemented

---

### Create Simplified Sale (Dedak, Sekam, Menir, Broken)
```
POST /api/processes/:processId/sales/{type}
```

**Type:** dedak, sekam, menir, broken

**Permissions:** Admin, Operator

**Body:**
```json
{
  "nama": "Pak Karno",
  "tanggalJual": "2024-01-20",
  "tonase": 200,
  "hargaPerKg": 3000,
  "hargaTotal": 600000  // optional
}
```

**Status:** ⚠️ Not yet implemented

---

### Update Sale
```
PUT /api/sales/:type/:id
```

**Permissions:** Admin, Operator

**Status:** ⚠️ Not yet implemented

---

### Delete Sale
```
DELETE /api/sales/:type/:id
```

**Permissions:** Admin only

**Status:** ⚠️ Not yet implemented

---

## File Endpoints

### Generate Presigned Upload URL
```
POST /api/files/presign
```

**Permissions:** Admin, Operator

**Status:** ⚠️ Not yet implemented (R2 integration pending)

---

### Attach File Metadata
```
POST /api/files/attach
```

**Permissions:** Admin, Operator

**Status:** ⚠️ Not yet implemented (R2 integration pending)

---

### Get File by ID
```
GET /api/files/:id
```

**Status:** ⚠️ Not yet implemented (R2 integration pending)

---

### Delete File
```
DELETE /api/files/:id
```

**Permissions:** Admin only

**Status:** ⚠️ Not yet implemented (R2 integration pending)

---

## Wizard Endpoints

### Get Wizard State
```
GET /api/wizard/:type/:entityId
```

**Type:** batch, process

**Status:** ⚠️ Not yet implemented

---

### Update Wizard Step
```
PUT /api/wizard/:type/:entityId/step
```

**Permissions:** Admin, Operator

**Status:** ⚠️ Not yet implemented

---

### Complete Wizard
```
POST /api/wizard/:type/:entityId/complete
```

**Permissions:** Admin, Operator

**Status:** ⚠️ Not yet implemented

---

## Error Codes

- `400` - Bad Request (validation error)
- `401` - Unauthorized (no token or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate entry)
- `422` - Unprocessable Entity (business rule violation)
- `500` - Internal Server Error
- `501` - Not Implemented

## Rate Limiting

Currently not implemented. Will be added in future versions.

## Pagination

Default page size: 30
Maximum page size: 100

Query parameters:
- `page`: Page number (starting from 1)
- `limit`: Items per page
