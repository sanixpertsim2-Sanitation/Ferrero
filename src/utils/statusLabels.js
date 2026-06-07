/**
 * Status label mappings matching the Supabase schema CHECK constraint
 * Values: 'idle', 'pre_verification_in_progress', 'cleaning_in_progress',
 *         'post_verification_pending', 'area_lead_verification_pending',
 *         'released', 'blocked'
 */

export const statusLabels = {
  idle:                           'Idle',
  pre_verification_in_progress:   'Pre-Verification In Progress',
  cleaning_in_progress:           'Cleaning In Progress',
  post_verification_pending:      'Post-Verification Pending',
  area_lead_verification_pending: 'Area Lead Verification Pending',
  released:                       'Released',
  blocked:                        'Blocked',
};

export const statusBadgeClass = (status) => {
  return `badge-${status || 'idle'}`;
};

export const getStatusLabel = (status) => {
  return statusLabels[status] || status || 'Unknown';
};

// Short labels for compact displays
export const shortStatusLabels = {
  idle:                           'Idle',
  pre_verification_in_progress:   'Pre-Verif',
  cleaning_in_progress:           'Cleaning',
  post_verification_pending:      'Post-Verif',
  area_lead_verification_pending: 'Lead Verif',
  released:                       'Released',
  blocked:                        'Blocked',
};

export const getShortStatusLabel = (status) => {
  return shortStatusLabels[status] || status || 'Unknown';
};
