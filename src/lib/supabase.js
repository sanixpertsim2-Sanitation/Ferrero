import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ── Auth (placeholder for Microsoft SSO + email override) ──
export const ADMIN_EMAIL = 'adarsh@sanixperts.com'

/**
 * Check if the current user is an admin.
 * Placeholder: Microsoft SSO integration point.
 * TODO: Implement Microsoft OAuth flow.
 * For now, admin check is done via email override on dashboard.
 */
export const isAdmin = async () => {
  // Placeholder: Microsoft SSO integration point
  // TODO: Implement Microsoft OAuth flow
  // For now, admin check is done via email override on dashboard
  return false
}

// ── Areas (called "lines" in the UI) ──

/**
 * Fetch all areas ordered by sequence.
 * In the UI these are displayed as "lines" (e.g., MACY Line 1, MACY Line 2).
 */
export const getLines = async () => {
  const { data, error } = await supabase
    .from('areas')
    .select('*')
    .order('sequence_order')
  if (error) throw error
  return data || []
}

// ── Checklist Templates ──

/**
 * Fetch checklist templates for a specific area and phase.
 * @param {string} areaId - The area ID
 * @param {string} phase - 'pre_clean' or 'post_clean'
 */
export const getChecklist = async (areaId, phase) => {
  const { data, error } = await supabase
    .from('checklist_templates')
    .select('*')
    .eq('area_id', areaId)
    .eq('phase', phase)
    .order('sequence_order')
  if (error) throw error
  return data || []
}

// ── Pre-Cleaning Logs ──

/**
 * Insert a pre-cleaning log entry.
 * @param {Object} log - The log data to insert
 */
export const insertPreCleanLog = async (log) => {
  const { data, error } = await supabase
    .from('pre_cleaning_logs')
    .insert(log)
    .select()
  if (error) throw error
  return data?.[0]
}

/**
 * Fetch pre-cleaning logs for a line, ordered by most recent first.
 * @param {string} lineId - The line ID
 */
export const getPreCleanLogs = async (lineId) => {
  const { data, error } = await supabase
    .from('pre_cleaning_logs')
    .select('*')
    .eq('line_id', lineId)
    .order('completed_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Post-Cleaning Logs ──

/**
 * Insert a post-cleaning log entry.
 * @param {Object} log - The log data to insert
 */
export const insertPostCleanLog = async (log) => {
  const { data, error } = await supabase
    .from('post_cleaning_logs')
    .insert(log)
    .select()
  if (error) throw error
  return data?.[0]
}

/**
 * Fetch post-cleaning logs for a line, ordered by most recent first.
 * @param {string} lineId - The line ID
 */
export const getPostCleanLogs = async (lineId) => {
  const { data, error } = await supabase
    .from('post_cleaning_logs')
    .select('*')
    .eq('line_id', lineId)
    .order('completed_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Damage Reports ──

/**
 * Insert a damage report.
 * @param {Object} report - The damage report data
 */
export const insertDamageReport = async (report) => {
  const { data, error } = await supabase
    .from('damage_reports')
    .insert(report)
    .select()
  if (error) throw error
  return data?.[0]
}

/**
 * Fetch damage reports for a line, ordered by most recent first.
 * @param {string} lineId - The line ID
 */
export const getDamageReports = async (lineId) => {
  const { data, error } = await supabase
    .from('damage_reports')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Update a damage report.
 * @param {string} id - The report ID
 * @param {Object} updates - The fields to update
 */
export const updateDamageReport = async (id, updates) => {
  const { data, error } = await supabase
    .from('damage_reports')
    .update(updates)
    .eq('id', id)
    .select()
  if (error) throw error
  return data?.[0]
}

// ── Handover Tasks ──

/**
 * Insert a handover task.
 * @param {Object} task - The handover task data
 */
export const insertHandoverTask = async (task) => {
  const { data, error } = await supabase
    .from('handover_tasks')
    .insert(task)
    .select()
  if (error) throw error
  return data?.[0]
}

/**
 * Fetch handover tasks for a line, ordered by most recent first.
 * @param {string} lineId - The line ID
 */
export const getHandoverTasks = async (lineId) => {
  const { data, error } = await supabase
    .from('handover_tasks')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

/**
 * Update a handover task.
 * @param {string} id - The task ID
 * @param {Object} updates - The fields to update
 */
export const updateHandoverTask = async (id, updates) => {
  const { data, error } = await supabase
    .from('handover_tasks')
    .update(updates)
    .eq('id', id)
    .select()
  if (error) throw error
  return data?.[0]
}

// ── Area Inspection Logs ──

/**
 * Insert an area inspection log.
 * @param {Object} log - The inspection log data
 */
export const insertInspectionLog = async (log) => {
  const { data, error } = await supabase
    .from('area_inspection_logs')
    .insert(log)
    .select()
  if (error) throw error
  return data?.[0]
}

/**
 * Fetch inspection logs for a line, ordered by most recent first.
 * @param {string} lineId - The line ID
 */
export const getInspectionLogs = async (lineId) => {
  const { data, error } = await supabase
    .from('area_inspection_logs')
    .select('*')
    .eq('line_id', lineId)
    .order('completed_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Line Release Logs ──

/**
 * Insert a line release log.
 * @param {Object} log - The release log data
 */
export const insertReleaseLog = async (log) => {
  const { data, error } = await supabase
    .from('line_release_logs')
    .insert(log)
    .select()
  if (error) throw error
  return data?.[0]
}

/**
 * Fetch release logs for a line, ordered by most recent first.
 * @param {string} lineId - The line ID
 */
export const getReleaseLogs = async (lineId) => {
  const { data, error } = await supabase
    .from('line_release_logs')
    .select('*')
    .eq('line_id', lineId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

// ── Dashboard Stats ──

/**
 * Fetch aggregate stats for the dashboard.
 * Returns counts and status data across all areas and activity tables.
 */
export const getDashboardStats = async () => {
  const [areasRes, preCleanRes, postCleanRes, damageRes, handoverRes, releaseRes] = await Promise.all([
    supabase.from('areas').select('id, name, status'),
    supabase.from('pre_cleaning_logs').select('line_id, completed_at'),
    supabase.from('post_cleaning_logs').select('line_id, completed_at'),
    supabase.from('damage_reports').select('id, line_id, status'),
    supabase.from('handover_tasks').select('id, line_id, status'),
    supabase.from('line_release_logs').select('line_id, created_at')
  ])
  return {
    areas: areasRes.data || [],
    preCleanLogs: preCleanRes.data || [],
    postCleanLogs: postCleanRes.data || [],
    damageReports: damageRes.data || [],
    handoverTasks: handoverRes.data || [],
    releaseLogs: releaseRes.data || []
  }
}
