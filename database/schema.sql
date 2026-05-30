-- =============================================================================
-- SaniExpert Complete Database Schema
-- Supabase PostgreSQL with Row Level Security
-- 13 Tables | RLS Policies | Triggers | Indexes
-- =============================================================================

-- =============================================================================
-- 1. CLIENTS
-- Clients served by SaniExpert (e.g., SaniExpert, Ferrero, Give and Go)
-- =============================================================================
CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    contact_email TEXT,
    contact_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON clients;
CREATE POLICY "Allow authenticated read" ON clients
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON clients;
CREATE POLICY "Allow authenticated insert" ON clients
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON clients;
CREATE POLICY "Allow admin/lead update" ON clients
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 2. FACILITIES
-- Production facilities belonging to each client
-- =============================================================================
CREATE TABLE IF NOT EXISTS facilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON facilities;
CREATE POLICY "Allow authenticated read" ON facilities
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON facilities;
CREATE POLICY "Allow authenticated insert" ON facilities
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON facilities;
CREATE POLICY "Allow admin/lead update" ON facilities
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 3. PRODUCTION_LINES
-- Individual production lines within a facility (e.g., MACY)
-- =============================================================================
CREATE TABLE IF NOT EXISTS production_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'RAW' CHECK (status IN ('RAW', 'CLEANING', 'RTE', 'OTHER')),
    last_cleaned_at TIMESTAMPTZ,
    next_cleaning_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE production_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON production_lines;
CREATE POLICY "Allow authenticated read" ON production_lines
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON production_lines;
CREATE POLICY "Allow authenticated insert" ON production_lines
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON production_lines;
CREATE POLICY "Allow admin/lead update" ON production_lines
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 4. AREAS
-- Zones within a production line (5 MACY areas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES production_lines(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'RAW' CHECK (status IN ('RAW', 'CLEANING', 'RTE', 'OTHER', 'COMPLETED')),
    locked_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    locked_at TIMESTAMPTZ,
    sequence_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON areas;
CREATE POLICY "Allow authenticated read" ON areas
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON areas;
CREATE POLICY "Allow authenticated insert" ON areas
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON areas;
CREATE POLICY "Allow admin/lead update" ON areas
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 5. CHECKLIST_TEMPLATES
-- Checklist items for each area and phase (53 items for MACY)
-- =============================================================================
CREATE TABLE IF NOT EXISTS checklist_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
    phase TEXT NOT NULL CHECK (phase IN ('pre-cleaning', 'post-cleaning')),
    item_text TEXT NOT NULL,
    item_type TEXT DEFAULT 'yes_no' CHECK (item_type IN ('yes_no', 'photo', 'count')),
    sequence_order INTEGER DEFAULT 0,
    has_count BOOLEAN DEFAULT false,
    count_label TEXT,
    help_text TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON checklist_templates;
CREATE POLICY "Allow authenticated read" ON checklist_templates
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON checklist_templates;
CREATE POLICY "Allow authenticated insert" ON checklist_templates
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON checklist_templates;
CREATE POLICY "Allow admin/lead update" ON checklist_templates
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 6. ASSIGNMENTS
-- Who is working on what area + shift + phase
-- =============================================================================
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES production_lines(id) ON DELETE CASCADE,
    area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    shift TEXT NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night', 'sunday')),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    phase TEXT CHECK (phase IN ('pre-cleaning', 'post-cleaning')),
    status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
    started_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(area_id, date, phase)
);

-- RLS
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON assignments;
CREATE POLICY "Allow authenticated read" ON assignments
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON assignments;
CREATE POLICY "Allow authenticated insert" ON assignments
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON assignments;
CREATE POLICY "Allow admin/lead update" ON assignments
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 7. CHECKLIST_RESPONSES
-- YES / NO / N/A responses + photos + counts
-- =============================================================================
CREATE TABLE IF NOT EXISTS checklist_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assignment_id UUID REFERENCES assignments(id) ON DELETE CASCADE,
    checklist_item_id UUID REFERENCES checklist_templates(id) ON DELETE CASCADE,
    response TEXT CHECK (response IN ('YES', 'NO', 'N/A')),
    photo_url TEXT,
    count_value INTEGER,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE checklist_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON checklist_responses;
CREATE POLICY "Allow authenticated read" ON checklist_responses
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON checklist_responses;
CREATE POLICY "Allow authenticated insert" ON checklist_responses
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON checklist_responses;
CREATE POLICY "Allow admin/lead update" ON checklist_responses
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 8. DAMAGE_REPORTS
-- Photo + area + description + severity tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS damage_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES production_lines(id) ON DELETE CASCADE,
    area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    photo_url TEXT NOT NULL,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
    reported_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON damage_reports;
CREATE POLICY "Allow authenticated read" ON damage_reports
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON damage_reports;
CREATE POLICY "Allow authenticated insert" ON damage_reports
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON damage_reports;
CREATE POLICY "Allow admin/lead update" ON damage_reports
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 9. FINDINGS
-- Area lead findings during verification
-- =============================================================================
CREATE TABLE IF NOT EXISTS findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES production_lines(id) ON DELETE CASCADE,
    area_id UUID REFERENCES areas(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    severity TEXT DEFAULT 'minor' CHECK (severity IN ('minor', 'major', 'critical')),
    status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
    photo_url TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON findings;
CREATE POLICY "Allow authenticated read" ON findings
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON findings;
CREATE POLICY "Allow authenticated insert" ON findings
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON findings;
CREATE POLICY "Allow admin/lead update" ON findings
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 10. AREA_LEAD_VERIFICATIONS
-- Final area lead sign-off after post-cleaning verification
-- =============================================================================
CREATE TABLE IF NOT EXISTS area_lead_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID REFERENCES production_lines(id) ON DELETE CASCADE,
    verified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    shift TEXT NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT DEFAULT 'verified' CHECK (status IN ('verified', 'needs_reclean')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE area_lead_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON area_lead_verifications;
CREATE POLICY "Allow authenticated read" ON area_lead_verifications
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON area_lead_verifications;
CREATE POLICY "Allow authenticated insert" ON area_lead_verifications
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON area_lead_verifications;
CREATE POLICY "Allow admin/lead update" ON area_lead_verifications
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 11. ACTIVITY_LOGS
-- Audit trail for all significant actions
-- =============================================================================
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT,
    record_id UUID,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON activity_logs;
CREATE POLICY "Allow authenticated read" ON activity_logs
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON activity_logs;
CREATE POLICY "Allow authenticated insert" ON activity_logs
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow admin/lead update" ON activity_logs;
CREATE POLICY "Allow admin/lead update" ON activity_logs
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- =============================================================================
-- 12. PROFILES
-- Extends auth.users with role, shift, and contact info
-- =============================================================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT,
    role TEXT DEFAULT 'employee' CHECK (role IN ('employee', 'area_lead', 'supervisor', 'admin')),
    shift TEXT CHECK (shift IN ('morning', 'afternoon', 'night', 'sunday')),
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated read" ON profiles;
CREATE POLICY "Allow authenticated read" ON profiles
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated insert" ON profiles;
CREATE POLICY "Allow authenticated insert" ON profiles
    FOR INSERT TO authenticated WITH CHECK (
        id = auth.uid() OR
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Allow admin/lead update" ON profiles;
CREATE POLICY "Allow admin/lead update" ON profiles
    FOR UPDATE TO authenticated USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'area_lead', 'supervisor'))
    );

-- Users can update their own profile
DROP POLICY IF EXISTS "Allow own profile update" ON profiles;
CREATE POLICY "Allow own profile update" ON profiles
    FOR UPDATE TO authenticated USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Facilities
CREATE INDEX IF NOT EXISTS idx_facilities_client_id ON facilities(client_id);

-- Production lines
CREATE INDEX IF NOT EXISTS idx_production_lines_facility_id ON production_lines(facility_id);
CREATE INDEX IF NOT EXISTS idx_production_lines_status ON production_lines(status);

-- Areas
CREATE INDEX IF NOT EXISTS idx_areas_line_id ON areas(line_id);
CREATE INDEX IF NOT EXISTS idx_areas_locked_by ON areas(locked_by);

-- Checklist templates
CREATE INDEX IF NOT EXISTS idx_checklist_templates_area_id ON checklist_templates(area_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_area_phase ON checklist_templates(area_id, phase);

-- Assignments
CREATE INDEX IF NOT EXISTS idx_assignments_line_id ON assignments(line_id);
CREATE INDEX IF NOT EXISTS idx_assignments_area_id ON assignments(area_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

-- Checklist responses
CREATE INDEX IF NOT EXISTS idx_checklist_responses_assignment_id ON checklist_responses(assignment_id);
CREATE INDEX IF NOT EXISTS idx_checklist_responses_checklist_item_id ON checklist_responses(checklist_item_id);

-- Damage reports
CREATE INDEX IF NOT EXISTS idx_damage_reports_line_id ON damage_reports(line_id);
CREATE INDEX IF NOT EXISTS idx_damage_reports_area_id ON damage_reports(area_id);
CREATE INDEX IF NOT EXISTS idx_damage_reports_status ON damage_reports(status);

-- Findings
CREATE INDEX IF NOT EXISTS idx_findings_line_id ON findings(line_id);
CREATE INDEX IF NOT EXISTS idx_findings_area_id ON findings(area_id);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);

-- Verifications
CREATE INDEX IF NOT EXISTS idx_verifications_line_id ON area_lead_verifications(line_id);
CREATE INDEX IF NOT EXISTS idx_verifications_date ON area_lead_verifications(date);

-- Activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- Profiles
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_shift ON profiles(shift);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Trigger: auto-update updated_at on profiles
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger: auto-update area status when assignment is completed
CREATE OR REPLACE FUNCTION update_area_on_assignment_completion()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE areas SET status = 'COMPLETED' WHERE id = NEW.area_id;
    ELSIF NEW.status = 'in_progress' AND OLD.status != 'in_progress' THEN
        UPDATE areas SET status = 'CLEANING' WHERE id = NEW.area_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_area_status_on_assignment ON assignments;
CREATE TRIGGER update_area_status_on_assignment
    AFTER UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION update_area_on_assignment_completion();

-- Trigger: auto-log activity on assignments
CREATE OR REPLACE FUNCTION log_assignment_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_logs (user_id, action, table_name, record_id, details)
        VALUES (NEW.user_id, 'assignment_created', 'assignments', NEW.id,
                jsonb_build_object('area_id', NEW.area_id, 'phase', NEW.phase, 'shift', NEW.shift));
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'completed' AND OLD.status != 'completed' THEN
        INSERT INTO activity_logs (user_id, action, table_name, record_id, details)
        VALUES (NEW.user_id, 'assignment_completed', 'assignments', NEW.id,
                jsonb_build_object('area_id', NEW.area_id, 'phase', NEW.phase));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_assignment_trigger ON assignments;
CREATE TRIGGER log_assignment_trigger
    AFTER INSERT OR UPDATE ON assignments
    FOR EACH ROW
    EXECUTE FUNCTION log_assignment_activity();

-- Trigger: auto-log activity on damage reports
CREATE OR REPLACE FUNCTION log_damage_report_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_logs (user_id, action, table_name, record_id, details)
        VALUES (NEW.reported_by, 'damage_report_created', 'damage_reports', NEW.id,
                jsonb_build_object('area_id', NEW.area_id, 'severity', NEW.severity));
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        INSERT INTO activity_logs (user_id, action, table_name, record_id, details)
        VALUES (NEW.resolved_by, 'damage_report_resolved', 'damage_reports', NEW.id,
                jsonb_build_object('area_id', NEW.area_id));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_damage_report_trigger ON damage_reports;
CREATE TRIGGER log_damage_report_trigger
    AFTER INSERT OR UPDATE ON damage_reports
    FOR EACH ROW
    EXECUTE FUNCTION log_damage_report_activity();

-- Trigger: auto-log activity on findings
CREATE OR REPLACE FUNCTION log_finding_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_logs (user_id, action, table_name, record_id, details)
        VALUES (NEW.created_by, 'finding_created', 'findings', NEW.id,
                jsonb_build_object('area_id', NEW.area_id, 'severity', NEW.severity));
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'resolved' AND OLD.status != 'resolved' THEN
        INSERT INTO activity_logs (user_id, action, table_name, record_id, details)
        VALUES (NEW.resolved_by, 'finding_resolved', 'findings', NEW.id,
                jsonb_build_object('area_id', NEW.area_id));
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_finding_trigger ON findings;
CREATE TRIGGER log_finding_trigger
    AFTER INSERT OR UPDATE ON findings
    FOR EACH ROW
    EXECUTE FUNCTION log_finding_activity();

-- Trigger: auto-log area lead verifications
CREATE OR REPLACE FUNCTION log_verification_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO activity_logs (user_id, action, table_name, record_id, details)
        VALUES (NEW.verified_by, 'area_verified', 'area_lead_verifications', NEW.id,
                jsonb_build_object('line_id', NEW.line_id, 'status', NEW.status, 'shift', NEW.shift));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS log_verification_trigger ON area_lead_verifications;
CREATE TRIGGER log_verification_trigger
    AFTER INSERT ON area_lead_verifications
    FOR EACH ROW
    EXECUTE FUNCTION log_verification_activity();

-- Trigger: auto-create profile on auth.user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, full_name, role)
    VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', 'employee')
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();
