-- User Segment Queries for Admin Messages System
-- Use these to get users for each segment type

-- ============================================
-- 1. ALL USERS
-- ============================================
SELECT id, email, created_at
FROM auth.users
WHERE deleted_at IS NULL
ORDER BY created_at DESC;

-- ============================================
-- 2. ACTIVE & FAMOUS USERS
-- ============================================
-- Users who have high engagement/followers count
SELECT DISTINCT u.id, u.email, p.is_famous
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.followers_count > 100  -- Adjust threshold as needed
   OR p.is_famous = true
   OR p.is_verified = true
ORDER BY p.followers_count DESC;

-- ============================================
-- 3. RECENT CHARGERS (Last 30 days)
-- ============================================
SELECT DISTINCT u.id, u.email, MAX(rt.created_at) as last_charge
FROM auth.users u
LEFT JOIN recharge_transactions rt ON u.id = rt.user_id
WHERE rt.created_at >= NOW() - INTERVAL '30 days'
  AND rt.status = 'completed'
GROUP BY u.id, u.email
ORDER BY MAX(rt.created_at) DESC;

-- ============================================
-- 4. INACTIVE CHARGERS (5+ months inactive)
-- ============================================
-- Users who charged before but inactive for 5+ months
SELECT DISTINCT u.id, u.email, MAX(rt.created_at) as last_charge
FROM auth.users u
JOIN recharge_transactions rt ON u.id = rt.user_id
WHERE rt.status = 'completed'
  -- Has charged in the past
  AND rt.created_at < NOW() - INTERVAL '5 months'
  -- No recent charges
  AND u.id NOT IN (
    SELECT DISTINCT user_id
    FROM recharge_transactions
    WHERE created_at >= NOW() - INTERVAL '5 months'
      AND status = 'completed'
  )
GROUP BY u.id, u.email
ORDER BY MAX(rt.created_at) DESC;

-- ============================================
-- 5. NEW USERS (Created in last 30 days)
-- ============================================
SELECT id, email, created_at
FROM auth.users
WHERE created_at >= NOW() - INTERVAL '30 days'
  AND deleted_at IS NULL
ORDER BY created_at DESC;

-- ============================================
-- 6. AGENTS
-- ============================================
SELECT DISTINCT u.id, u.email, p.staff_role
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.staff_role = 'agent'
  AND p.is_active = true
ORDER BY p.created_at DESC;

-- ============================================
-- 7. RECHARGE AGENTS
-- ============================================
SELECT DISTINCT u.id, u.email, ra.is_active
FROM auth.users u
JOIN recharge_agents ra ON u.id = ra.user_id
WHERE ra.is_active = true
ORDER BY ra.created_at DESC;

-- ============================================
-- HELPER: Count users per segment
-- ============================================
WITH segment_counts AS (
  SELECT 'all' as segment, COUNT(DISTINCT u.id) as count
  FROM auth.users u
  WHERE u.deleted_at IS NULL

  UNION ALL

  SELECT 'active_famous' as segment, COUNT(DISTINCT u.id) as count
  FROM auth.users u
  JOIN profiles p ON u.id = p.id
  WHERE (p.followers_count > 100 OR p.is_famous = true)

  UNION ALL

  SELECT 'recent_chargers' as segment, COUNT(DISTINCT u.id) as count
  FROM auth.users u
  JOIN recharge_transactions rt ON u.id = rt.user_id
  WHERE rt.created_at >= NOW() - INTERVAL '30 days'
    AND rt.status = 'completed'

  UNION ALL

  SELECT 'inactive_chargers' as segment, COUNT(DISTINCT u.id) as count
  FROM auth.users u
  JOIN recharge_transactions rt ON u.id = rt.user_id
  WHERE rt.created_at < NOW() - INTERVAL '5 months'
    AND u.id NOT IN (
      SELECT DISTINCT user_id FROM recharge_transactions
      WHERE created_at >= NOW() - INTERVAL '5 months'
        AND status = 'completed'
    )

  UNION ALL

  SELECT 'new_users' as segment, COUNT(DISTINCT u.id) as count
  FROM auth.users u
  WHERE u.created_at >= NOW() - INTERVAL '30 days'

  UNION ALL

  SELECT 'agents' as segment, COUNT(DISTINCT u.id) as count
  FROM profiles p
  WHERE p.staff_role = 'agent' AND p.is_active = true

  UNION ALL

  SELECT 'recharge_agents' as segment, COUNT(DISTINCT u.id) as count
  FROM recharge_agents ra
  WHERE ra.is_active = true
)
SELECT segment, count
FROM segment_counts
ORDER BY count DESC;

-- ============================================
-- HELPER: Get message statistics
-- ============================================
SELECT
  am.id,
  am.title,
  am.status,
  am.total_recipients,
  COUNT(mr.id) as actual_recipients,
  COUNT(CASE WHEN mr.is_read THEN 1 END) as read_count,
  ROUND(100.0 * COUNT(CASE WHEN mr.is_read THEN 1 END) / NULLIF(COUNT(mr.id), 0), 2) as read_percentage,
  am.created_at,
  am.sent_at
FROM admin_messages am
LEFT JOIN message_recipients mr ON am.id = mr.message_id
WHERE am.status IN ('sent', 'scheduled')
GROUP BY am.id, am.title, am.status, am.total_recipients, am.created_at, am.sent_at
ORDER BY am.created_at DESC
LIMIT 20;
