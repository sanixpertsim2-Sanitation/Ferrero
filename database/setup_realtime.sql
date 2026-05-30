-- =============================================================================
-- SaniExpert Realtime Setup
-- =============================================================================
-- Enables realtime updates for key tables so the frontend receives
-- live updates when data changes. Essential for the area status board
-- and live cleaning progress views.
-- =============================================================================

BEGIN;
    -- Add production_lines to realtime publication
    -- Tracks line status changes (RAW -> CLEANING -> RTE)
    ALTER PUBLICATION supabase_realtime ADD TABLE production_lines;

    -- Add assignments to realtime publication
    -- Tracks who is assigned where, status changes
    ALTER PUBLICATION supabase_realtime ADD TABLE assignments;

    -- Add damage_reports to realtime publication
    -- Tracks new damage reports and resolution status
    ALTER PUBLICATION supabase_realtime ADD TABLE damage_reports;

    -- Add findings to realtime publication
    -- Tracks area lead findings and their resolution
    ALTER PUBLICATION supabase_realtime ADD TABLE findings;

    -- Add areas to realtime publication
    -- Tracks area lock status and cleaning progress
    ALTER PUBLICATION supabase_realtime ADD TABLE areas;

    -- Add area_lead_verifications to realtime publication
    -- Tracks final sign-off status
    ALTER PUBLICATION supabase_realtime ADD TABLE area_lead_verifications;

    -- Add checklist_responses to realtime publication
    -- Tracks checklist completion progress in real time
    ALTER PUBLICATION supabase_realtime ADD TABLE checklist_responses;
COMMIT;
