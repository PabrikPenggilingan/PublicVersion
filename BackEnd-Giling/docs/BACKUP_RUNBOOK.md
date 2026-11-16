# Backup & Recovery Runbook

## Overview

This document provides procedures for backing up and recovering the Belanja Giling Management System database and files.

## Backup Strategy

### Full Backup Schedule
- **Frequency:** Daily at 2:00 AM WIB
- **Retention:** 30 days
- **Storage:** Local + offsite (recommended)

### Incremental Backup
- **Frequency:** Every 6 hours
- **Retention:** 7 days

## PostgreSQL Backup

### Manual Backup

#### Full Database Backup
```bash
# Backup main database
docker-compose exec postgres pg_dump -U gabah_user gabah_db | gzip > backup_$(date +%Y%m%d_%H%M%S).sql.gz

# Backup log database
docker-compose exec postgres pg_dump -U gabah_user gabah_logs | gzip > backup_logs_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### Backup Specific Table
```bash
docker-compose exec postgres pg_dump -U gabah_user -t batches gabah_db | gzip > batches_backup_$(date +%Y%m%d_%H%M%S).sql.gz
```

#### Backup Schema Only
```bash
docker-compose exec postgres pg_dump -U gabah_user --schema-only gabah_db > schema_backup_$(date +%Y%m%d).sql
```

### Automated Backup Script

Create `/root/backup_gabah.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/backups/gabah"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup main database
docker-compose -f /path/to/docker-compose.yml exec -T postgres \
  pg_dump -U gabah_user gabah_db | gzip > $BACKUP_DIR/gabah_db_$DATE.sql.gz

# Backup log database
docker-compose -f /path/to/docker-compose.yml exec -T postgres \
  pg_dump -U gabah_user gabah_logs | gzip > $BACKUP_DIR/gabah_logs_$DATE.sql.gz

# Delete old backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Log backup completion
echo "[$(date)] Backup completed: $DATE" >> $BACKUP_DIR/backup.log

# Optional: Upload to remote storage
# rsync -avz $BACKUP_DIR/ user@remote:/backups/gabah/
# aws s3 sync $BACKUP_DIR/ s3://your-bucket/backups/gabah/
```

Make it executable:
```bash
chmod +x /root/backup_gabah.sh
```

Add to crontab:
```bash
crontab -e

# Add this line for daily backup at 2 AM
0 2 * * * /root/backup_gabah.sh
```

## Database Restore

### Full Database Restore

```bash
# Stop the application
docker-compose stop api

# Drop existing database (CAUTION!)
docker-compose exec postgres psql -U gabah_user -c "DROP DATABASE IF EXISTS gabah_db;"
docker-compose exec postgres psql -U gabah_user -c "CREATE DATABASE gabah_db;"

# Restore from backup
gunzip -c backup_20240115_020000.sql.gz | \
  docker-compose exec -T postgres psql -U gabah_user gabah_db

# Restore log database
docker-compose exec postgres psql -U gabah_user -c "DROP DATABASE IF EXISTS gabah_logs;"
docker-compose exec postgres psql -U gabah_user -c "CREATE DATABASE gabah_logs;"
gunzip -c backup_logs_20240115_020000.sql.gz | \
  docker-compose exec -T postgres psql -U gabah_user gabah_logs

# Restart application
docker-compose start api
```

### Point-in-Time Recovery (PITR)

Enable WAL archiving in PostgreSQL:

```yaml
# docker-compose.yml - add to postgres environment
environment:
  POSTGRES_INITDB_ARGS: "-c wal_level=replica -c archive_mode=on -c archive_command='cp %p /backups/wal/%f'"

volumes:
  - ./backups/wal:/backups/wal
```

Restore to specific point:
```bash
# Restore base backup
gunzip -c backup_20240115_020000.sql.gz | \
  docker-compose exec -T postgres psql -U gabah_user gabah_db

# Apply WAL files up to specific timestamp
docker-compose exec postgres pg_waldump /backups/wal/
# Follow PostgreSQL PITR documentation for detailed steps
```

## File Backup (R2/Cloudflare)

### Backup File Metadata
```bash
# Export files table
docker-compose exec postgres psql -U gabah_user gabah_db -c \
  "COPY files TO STDOUT CSV HEADER" > files_metadata_$(date +%Y%m%d).csv
```

### Sync R2 Files (when implemented)
```bash
# Using rclone (configure rclone for R2)
rclone sync r2:your-bucket /local/backup/r2 --progress

# Or using AWS CLI (S3-compatible)
aws s3 sync s3://your-bucket /local/backup/r2 --endpoint-url=https://your-endpoint.r2.cloudflarestorage.com
```

## Verification

### Test Backup Integrity
```bash
# Check if backup file is valid
gunzip -t backup_20240115_020000.sql.gz && echo "Backup is valid" || echo "Backup is corrupted"

# Test restore to temporary database
docker-compose exec postgres psql -U gabah_user -c "CREATE DATABASE test_restore;"
gunzip -c backup_20240115_020000.sql.gz | \
  docker-compose exec -T postgres psql -U gabah_user test_restore

# Verify table counts
docker-compose exec postgres psql -U gabah_user test_restore -c "
  SELECT schemaname, tablename, 
         (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
  FROM (
    SELECT table_schema AS schemaname, table_name AS tablename, 
           query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '') AS xml_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
  ) t;
"

# Drop test database
docker-compose exec postgres psql -U gabah_user -c "DROP DATABASE test_restore;"
```

## Disaster Recovery Procedures

### Complete System Failure

1. **Provision new VPS**
   ```bash
   # Install Docker and Docker Compose
   curl -fsSL https://get.docker.com | sh
   apt-get install docker-compose
   ```

2. **Clone repository**
   ```bash
   git clone https://github.com/PabrikPenggilingan/belanja-giling-management-system.git
   cd belanja-giling-management-system
   ```

3. **Restore configuration**
   ```bash
   cp .env.backup .env
   # Edit .env with correct values
   ```

4. **Start services**
   ```bash
   docker-compose up -d postgres
   # Wait for PostgreSQL to be ready
   sleep 10
   ```

5. **Restore databases**
   ```bash
   # Create databases
   docker-compose exec postgres psql -U gabah_user -c "CREATE DATABASE gabah_db;"
   docker-compose exec postgres psql -U gabah_user -c "CREATE DATABASE gabah_logs;"
   
   # Restore from backup
   gunzip -c /path/to/backup_latest.sql.gz | \
     docker-compose exec -T postgres psql -U gabah_user gabah_db
   gunzip -c /path/to/backup_logs_latest.sql.gz | \
     docker-compose exec -T postgres psql -U gabah_user gabah_logs
   ```

6. **Start application services**
   ```bash
   docker-compose up -d
   ```

7. **Verify functionality**
   ```bash
   curl http://localhost:3000/health
   # Test login and critical operations
   ```

### Data Corruption

1. **Identify corruption scope**
   ```bash
   # Check database integrity
   docker-compose exec postgres psql -U gabah_user gabah_db -c "
     SELECT tablename, schemaname 
     FROM pg_tables 
     WHERE schemaname = 'public';
   "
   
   # Check for constraint violations
   docker-compose exec postgres psql -U gabah_user gabah_db -c "
     SELECT conname, contype, conrelid::regclass 
     FROM pg_constraint 
     WHERE contype IN ('c', 'f');
   "
   ```

2. **Restore affected tables only**
   ```bash
   # Extract specific table from backup
   gunzip -c backup_20240115_020000.sql.gz | \
     docker-compose exec -T postgres pg_restore -U gabah_user -d gabah_db -t batches
   ```

3. **Verify data integrity**
   ```bash
   # Run data validation queries
   docker-compose exec postgres psql -U gabah_user gabah_db -c "
     SELECT COUNT(*) FROM batches WHERE total_qty_kg < 0;
     SELECT COUNT(*) FROM purchases WHERE berat_gabah_kg <= 0;
   "
   ```

## Monitoring & Alerts

### Disk Space Monitoring
```bash
# Check available space
df -h /backups

# Set up alert when space < 10GB
if [ $(df /backups | tail -1 | awk '{print $4}' | sed 's/G//') -lt 10 ]; then
  echo "WARNING: Backup disk space low" | mail -s "Backup Alert" admin@example.com
fi
```

### Backup Success Monitoring
```bash
# Check if backup ran successfully
LATEST_BACKUP=$(ls -t /backups/gabah/*.sql.gz | head -1)
BACKUP_AGE=$(( $(date +%s) - $(stat -c %Y "$LATEST_BACKUP") ))

# Alert if backup is older than 26 hours
if [ $BACKUP_AGE -gt 93600 ]; then
  echo "WARNING: Last backup is older than 26 hours" | \
    mail -s "Backup Alert" admin@example.com
fi
```

## Security Best Practices

1. **Encrypt backups**
   ```bash
   # Encrypt with GPG
   gpg --symmetric --cipher-algo AES256 backup_20240115_020000.sql.gz
   ```

2. **Secure backup storage**
   ```bash
   chmod 600 /backups/gabah/*.sql.gz
   chown root:root /backups/gabah/*.sql.gz
   ```

3. **Test restores regularly**
   - Monthly: Full restore test on staging
   - Quarterly: Disaster recovery drill

4. **Offsite backups**
   - Store copies in different geographic location
   - Use cloud storage (S3, R2, etc.)
   - Maintain 3-2-1 rule: 3 copies, 2 different media, 1 offsite

## Recovery Time Objectives (RTO)

- **Database restore:** < 30 minutes
- **Full system recovery:** < 2 hours
- **Point-in-time recovery:** < 1 hour

## Recovery Point Objectives (RPO)

- **Maximum data loss:** 6 hours (incremental backup interval)
- **Target data loss:** < 1 hour (with WAL archiving)

## Emergency Contacts

- System Administrator: [contact info]
- Database Administrator: [contact info]
- DevOps Team: [contact info]
- Vendor Support: [contact info]

## Appendix

### Useful Commands

```bash
# Check database size
docker-compose exec postgres psql -U gabah_user -c "\l+"

# Check table sizes
docker-compose exec postgres psql -U gabah_user gabah_db -c "
  SELECT schemaname, tablename, 
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables 
  WHERE schemaname = 'public' 
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Vacuum and analyze
docker-compose exec postgres psql -U gabah_user gabah_db -c "VACUUM ANALYZE;"

# Check active connections
docker-compose exec postgres psql -U gabah_user -c "
  SELECT datname, count(*) 
  FROM pg_stat_activity 
  GROUP BY datname;
"
```
