# Database Schema Documentation

## Overview

The database consists of 14 tables organized into logical groups:
- **Core:** users, batches, purchases
- **Processing:** processes, process_batches
- **Sales:** sales_beras, sales_dedak, sales_sekam, sales_menir, sales_broken
- **Files:** files, upload_intents
- **Workflow:** wizard_states
- **Audit:** log_history

## Entity Relationship Diagram

```
users ─────┐
           │
           ├──► batches ──► purchases
           │        │
           │        └──► process_batches ──► processes ──┬──► sales_beras
           │                                              ├──► sales_dedak
           │                                              ├──► sales_sekam
           │                                              ├──► sales_menir
           │                                              └──► sales_broken
           │
           ├──► wizard_states
           ├──► upload_intents
           └──► log_history

files ──► [polymorphic] ──► purchases / processes / sales_*
```

## Tables

### 1. users
Authentication and user management.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'viewer',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE user_role AS ENUM ('admin', 'operator', 'viewer');
```

**Indexes:**
- `idx_users_username` on username

**Business Rules:**
- Username must be unique
- Password stored as bcrypt hash
- Three roles: admin (full access), operator (read/write), viewer (read-only)

---

### 2. batches
Main entity for grouping grain purchases.

```sql
CREATE TABLE batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    batch_date DATE NOT NULL,
    status batch_status NOT NULL DEFAULT 'OPEN',
    total_qty_kg DECIMAL(10, 2) DEFAULT 0.00,
    remaining_kg DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE batch_status AS ENUM ('OPEN', 'CLOSED');
```

**Indexes:**
- `idx_batches_status` on status
- `idx_batches_batch_date` on batch_date
- `idx_batches_created_by` on created_by

**Business Rules:**
- Can have 1-8 purchases
- Status OPEN until remaining_kg <= 0, then auto-closes
- total_qty_kg and remaining_kg auto-updated via triggers

---

### 3. purchases
Individual grain purchases per supplier within a batch.

```sql
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    nama VARCHAR(255) NOT NULL,
    tanggal_belanja DATE,
    calo VARCHAR(255) NOT NULL,
    harga_per_kg DECIMAL(10, 2) NOT NULL,
    total_harga DECIMAL(12, 2),
    lokasi_belanja VARCHAR(255) NOT NULL,
    koordinat VARCHAR(100),
    berat_gabah_kg DECIMAL(10, 2) NOT NULL,
    jenis_gabah VARCHAR(100) NOT NULL,
    kadar_air DECIMAL(5, 2),
    kadar_hampa DECIMAL(5, 2),
    kualitas_gabah kualitas_gabah NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE kualitas_gabah AS ENUM ('jelek', 'biasa', 'bagus', 'sangat_bagus');
```

**Indexes:**
- `idx_purchases_batch_id` on batch_id
- `idx_purchases_tanggal_belanja` on tanggal_belanja

**Business Rules:**
- Max 8 purchases per batch
- total_harga auto-calculated if not provided (berat_gabah_kg * harga_per_kg)
- Updates batch quantities via triggers

**Triggers:**
- Auto-calculate total_harga
- Update batch total_qty_kg and remaining_kg on INSERT/UPDATE/DELETE

---

### 4. processes
Milling process records.

```sql
CREATE TABLE processes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    process_date DATE NOT NULL,
    end_date DATE,
    status process_status NOT NULL DEFAULT 'IN_PROGRESS',
    total_input_kg DECIMAL(10, 2) DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_end_date_after_process_date CHECK (end_date IS NULL OR end_date >= process_date),
    CONSTRAINT check_max_duration CHECK (end_date IS NULL OR end_date <= process_date + INTERVAL '2 days')
);

CREATE TYPE process_status AS ENUM ('IN_PROGRESS', 'COMPLETED');
```

**Business Rules:**
- Must use 1-3 batches
- Maximum duration: 2 days
- total_input_kg auto-updated via process_batches triggers

---

### 5. process_batches
Junction table linking processes and batches.

```sql
CREATE TABLE process_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    qty_used_kg DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_process_batch UNIQUE (process_id, batch_id)
);
```

**Business Rules:**
- Each batch can only be used once per process
- Validates batch has enough remaining_kg before insert
- Updates process.total_input_kg and batch.remaining_kg via triggers

**Triggers:**
- Update process total_input_kg
- Update batch remaining_kg
- Auto-close batch when remaining <= 0

---

### 6. sales_beras
Detailed rice sales records.

```sql
CREATE TABLE sales_beras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    nama VARCHAR(255) NOT NULL,
    tanggal_jual DATE,
    calo VARCHAR(255) NOT NULL,
    harga_jual_per_kg DECIMAL(10, 2) NOT NULL,
    harga_jual_total DECIMAL(12, 2),
    jual_kemana VARCHAR(255),
    tonase DECIMAL(10, 2) NOT NULL,
    rendemen DECIMAL(5, 2) NOT NULL,
    hasil_akhir hasil_kualitas NOT NULL,
    derajat_sosoh DECIMAL(5, 2),
    butir_patah DECIMAL(5, 2),
    butir_kepala DECIMAL(5, 2),
    kadar_air DECIMAL(5, 2),
    benda_asing DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE hasil_kualitas AS ENUM ('jelek', 'biasa', 'bagus', 'sangat_bagus');
```

**Business Rules:**
- 1-2 transactions per process
- harga_jual_total auto-calculated if not provided
- rendemen (yield): (output_kg / input_kg * 100)

---

### 7-10. sales_dedak, sales_sekam, sales_menir, sales_broken
Simplified sales records for by-products.

```sql
CREATE TABLE sales_[type] (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    process_id UUID NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
    nama VARCHAR(255) NOT NULL,
    tanggal_jual DATE,
    tonase DECIMAL(10, 2) NOT NULL,
    harga_per_kg DECIMAL(10, 2) NOT NULL,
    harga_total DECIMAL(12, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Business Rules:**
- 1-2 transactions per product type per process
- harga_total auto-calculated if not provided

---

### 11. files
Metadata for files stored in R2.

```sql
CREATE TABLE files (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    purchase_id UUID REFERENCES purchases(id) ON DELETE CASCADE,
    process_id UUID REFERENCES processes(id) ON DELETE CASCADE,
    sale_id UUID,
    sale_type sale_type_enum,
    file_type file_type_enum NOT NULL,
    r2_key VARCHAR(500) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100),
    size_bytes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE file_type_enum AS ENUM ('struk', 'gabah', 'proses', 'hasil');
CREATE TYPE sale_type_enum AS ENUM ('beras', 'dedak', 'sekam', 'menir', 'broken');
```

**Business Rules:**
- Polymorphic association (one of purchase_id, process_id, or sale_id must be set)
- Upload limits: struk (1), gabah (3), proses (3), hasil (3)

---

### 12. wizard_states
Tracks wizard progress for batch/process creation.

```sql
CREATE TABLE wizard_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type entity_type_enum NOT NULL,
    entity_id UUID NOT NULL,
    current_step VARCHAR(100) NOT NULL,
    step_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_entity UNIQUE (user_id, entity_type, entity_id)
);

CREATE TYPE entity_type_enum AS ENUM ('batch', 'process');
```

---

### 13. upload_intents
Tracks presigned upload URLs for R2.

```sql
CREATE TABLE upload_intents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    r2_key VARCHAR(500) NOT NULL,
    status upload_status NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TYPE upload_status AS ENUM ('pending', 'completed', 'expired');
```

---

### 14. log_history
Audit trail for all operations.

```sql
CREATE TABLE log_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

**Actions:** CREATE, UPDATE, DELETE

---

## Constraints Summary

### Check Constraints
- `purchases`: berat_gabah_kg > 0, harga_per_kg > 0
- `processes`: end_date >= process_date, max 2 days duration
- `process_batches`: qty_used_kg > 0
- `sales_*`: tonase > 0, prices > 0
- `sales_beras`: rendemen 0-100%

### Foreign Keys
- All foreign keys use CASCADE on delete (except user references which use SET NULL)
- Ensures referential integrity

### Unique Constraints
- `users.username`
- `process_batches.(process_id, batch_id)`
- `wizard_states.(user_id, entity_type, entity_id)`

## Triggers

1. **update_updated_at_column**: Auto-update updated_at timestamp
2. **calculate_purchase_total_harga**: Auto-calculate purchase total
3. **update_batch_quantities**: Update batch totals when purchases change
4. **auto_close_batch**: Close batch when remaining_kg <= 0
5. **update_process_total_input**: Update process input when batches attached
6. **update_batch_remaining**: Update batch remaining when used in process
7. **validate_batch_availability**: Prevent using more than available
8. **calculate_sales_*_total**: Auto-calculate sales totals

## Timezone

All timestamps use `TIMESTAMP WITH TIME ZONE` set to Asia/Jakarta (WIB).
