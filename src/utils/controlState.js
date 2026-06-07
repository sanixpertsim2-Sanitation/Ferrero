import { supabase } from '@/lib/supabase.js'

/**
 * Determine the current state of a line for the Control Page.
 * Queries pre_cleaning_logs, post_cleaning_logs, handover_tasks,
 * damage_reports, area_inspection_logs, line_release_logs.
 *
 * Returns: { state, buttons, canRelease, openHandovers, openDamages }
 *
 * States: idle | pre_done | post_done | handover_open | verified | released
 *
 * @param {string} lineId - The ID of the line to check
 * @returns {Promise<Object>} The control state with buttons and flags
 */
export const getLineControlState = async (lineId) => {
  const today = new Date().toISOString().split('T')[0]

  // Check each table for today's records
  const [preRes, postRes, handoverRes, damageRes, inspectRes, releaseRes] = await Promise.all([
    supabase.from('pre_cleaning_logs').select('*').eq('line_id', lineId).gte('completed_at', today).order('completed_at', { ascending: false }).limit(1),
    supabase.from('post_cleaning_logs').select('*').eq('line_id', lineId).gte('completed_at', today).order('completed_at', { ascending: false }).limit(1),
    supabase.from('handover_tasks').select('*').eq('line_id', lineId).eq('status', 'pending'),
    supabase.from('damage_reports').select('*').eq('line_id', lineId).eq('status', 'open'),
    supabase.from('area_inspection_logs').select('*').eq('line_id', lineId).gte('completed_at', today).order('completed_at', { ascending: false }).limit(1),
    supabase.from('line_release_logs').select('*').eq('line_id', lineId).gte('created_at', today).order('created_at', { ascending: false }).limit(1),
  ])

  const preClean = preRes.data?.[0] || null
  const postClean = postRes.data?.[0] || null
  const openHandovers = handoverRes.data || []
  const openDamages = damageRes.data || []
  const inspection = inspectRes.data?.[0] || null
  const release = releaseRes.data?.[0] || null

  // State machine
  if (release) {
    return { state: 'released', buttons: [], canRelease: false, openHandovers: [], openDamages: [], release }
  }

  if (inspection) {
    const canRel = openHandovers.length === 0 && openDamages.length === 0
    return { state: 'verified', buttons: canRel ? ['release'] : ['handover'], canRelease: canRel, openHandovers, openDamages, inspection }
  }

  if (postClean) {
    const hasOpen = openHandovers.length > 0 || openDamages.length > 0
    return { state: hasOpen ? 'handover_open' : 'post_done', buttons: hasOpen ? ['handover', 'damage'] : ['verify'], canRelease: false, openHandovers, openDamages, postClean }
  }

  if (preClean) {
    return { state: 'pre_done', buttons: ['post_clean'], canRelease: false, openHandovers, openDamages, preClean }
  }

  return { state: 'idle', buttons: ['pre_clean'], canRelease: false, openHandovers, openDamages }
}
