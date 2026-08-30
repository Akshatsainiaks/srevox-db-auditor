-- =============================================================================
-- AI Database Audit Platform - PostgreSQL CDC Setup Script (pgoutput)
-- =============================================================================

-- Step 1: Ensure WAL level is set to logical (Requires PG restart if modified in postgresql.conf)
SHOW wal_level;

-- Step 2: Create Publication for all tables to track column-level DML changes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'srevox_audit_pub') THEN
        CREATE PUBLICATION srevox_audit_pub FOR ALL TABLES;
        RAISE NOTICE 'Created publication srevox_audit_pub FOR ALL TABLES';
    ELSE
        RAISE NOTICE 'Publication srevox_audit_pub already exists';
    END IF;
END $$;

-- Step 3: Create Logical Replication Slot if not present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = 'srevox_cdc_slot') THEN
        PERFORM pg_create_logical_replication_slot('srevox_cdc_slot', 'pgoutput');
        RAISE NOTICE 'Created logical replication slot srevox_cdc_slot using pgoutput';
    ELSE
        RAISE NOTICE 'Replication slot srevox_cdc_slot already exists';
    END IF;
END $$;

-- Step 4: Verify Replication Setup
SELECT slot_name, plugin, slot_type, active FROM pg_replication_slots WHERE slot_name = 'srevox_cdc_slot';
SELECT pubname, puballtables FROM pg_publication WHERE pubname = 'srevox_audit_pub';
