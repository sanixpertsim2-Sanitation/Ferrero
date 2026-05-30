-- =============================================================================
-- SaniExpert Storage Bucket Setup & RLS Policies
-- =============================================================================
-- Creates the 'verification-photos' bucket and sets up RLS policies
-- for secure photo upload and retrieval by authenticated users.
-- =============================================================================

-- =============================================================================
-- STEP 1: Create the verification-photos bucket
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-photos', 'verification-photos', true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- STEP 2: Enable RLS on storage.objects
-- =============================================================================
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 3: Drop existing policies if any (idempotent)
-- =============================================================================
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated read" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated update" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;

-- =============================================================================
-- STEP 4: Create storage policies for verification-photos bucket
-- =============================================================================

-- Policy: Allow authenticated users to upload photos
CREATE POLICY "Allow authenticated uploads" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'verification-photos');

-- Policy: Allow authenticated users to read/download photos
CREATE POLICY "Allow authenticated read" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'verification-photos');

-- Policy: Allow authenticated users to update their own uploads
CREATE POLICY "Allow authenticated update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'verification-photos');

-- Policy: Allow admins to delete photos
CREATE POLICY "Allow admin delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'verification-photos'
        AND EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'supervisor')
        )
    );
