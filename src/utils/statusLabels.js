/**
 * Status label mappings for the SaniExpert v2 sanitation control system.
 * Maps database status values to human-readable labels.
 */

export const statusLabels = {
  idle: 'Idle',
  pre_verification_in_progress: 'Pre-Verification',
  cleaning_in_progress: 'Cleaning',
  post_verification_pending: 'Post-Verification',
  area_lead_verification_pending: 'Lead Verification',
  released: 'Released',
  blocked: 'Blocked',
}

/**
 * Get a human-readable label for a status code.
 * @param {string} s - The status code from the database
 * @returns {string} Human-readable label, or the raw status if unknown
 */
export const getStatusLabel = (s) => statusLabels[s] || s || 'Unknown'

/**
 * Get the CSS badge class for a status code.
 * @param {string} s - The status code from the database
 * @returns {string} CSS class name for styling the badge
 */
export const statusBadgeClass = (s) => `badge-${s || 'idle'}`
