-- User Segment Queries for Admin Messages System (FIXED for actual schema)
-- Use these to get users for each segment type

-- ============================================
-- 1. ALL USERS
-- ============================================
SELECT u.id, p.name, u.email, p.created_at
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
WHERE u.deleted_at IS NULL
ORDER BY p.created_at DESC;

-- ============================================
-- 2. ACTIVE & FAMOUS USERS (VIP + Verified + Recently Active)
-- ============================================
SELECT DISTINCT u.id, p.name, u.email, p.is_vip, p.verified, p.last_seen_at
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE (
  p.is_vip = true
  OR p.verified = true
  OR (p.last_seen_at IS NOT NULL AND p.last_seen_at >= NOW() - INTERVAL '7 days')
)
AND u.deleted_at IS NULL
ORDER BY
  CASE WHEN p.is_vip THEN 0 ELSE 1 END,
  p.last_seen_at DESC NULLS LAST;

-- ============================================
-- 3. RECENT CHARGERS (Last 30 days)
-- ============================================
SELECT DISTINCT u.id, p.name, u.email, MAX(rt.created_at) as last_charge
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN recharge_transactions rt ON u.id = rt.user_id
WHERE rt.created_at >= NOW() - INTERVAL '30 days'
  AND rt.status = 'completed'
  AND u.deleted_at IS NULL
GROUP BY u.id, p.name, u.email
ORDER BY MAX(rt.created_at) DESC;

-- ============================================
-- 4. INACTIVE CHARGERS (5+ months inactive)
-- ============================================
-- Users who charged before but inactive for 5+ months
SELECT DISTINCT u.id, p.name, u.email, MAX(rt.created_at) as last_charge
FROM auth.users u
JOIN profiles p ON u.id = p.id
JOIN recharge_transactions rt ON u.id = rt.user_id
WHERE rt.status = 'completed'
  -- Has charged in the past but not recent
  AND rt.created_at < NOW() - INTERVAL '5 months'
  -- No recent charges (not in recent chargers list)
  AND u.id NOT IN (
    SELECT DISTINCT user_id
    FROM recharge_transactions
    WHERE created_at >= NOW() - INTERVAL '5 months'
      AND status = 'completed'
  )
  AND u.deleted_at IS NULL
GROUP BY u.id, p.name, u.email
ORDER BY MAX(rt.created_at) DESC;

-- ============================================
-- 5. NEW USERS (Created in last 30 days)
-- ============================================
SELECT u.id, p.name, u.email, p.created_at
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.created_at >= NOW() - INTERVAL '30 days'
  AND u.deleted_at IS NULL
ORDER BY p.created_at DESC;

-- ============================================
-- 6. AGENTS (is_agent = true)
-- ============================================
SELECT DISTINCT u.id, p.name, u.email, p.is_agent
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.is_agent = true
  AND u.deleted_at IS NULL
ORDER BY p.created_at DESC;

-- ============================================
-- 7. RECHARGE AGENTS (staff_role includes agent)
-- ============================================
SELECT DISTINCT u.id, p.name, u.email, p.staff_role
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.staff_role IN ('admin', 'manager', 'agent', 'moderator')
  AND u.deleted_at IS NULL
ORDER BY p.created_at DESC;

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
  WHERE (
    p.is_vip = true
    OR p.verified = true
    OR (p.last_seen_at >= NOW() - INTERVAL '7 days')
  )

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
  JOIN profiles p ON u.id = p.id
  WHERE p.created_at >= NOW() - INTERVAL '30 days'

  UNION ALL

  SELECT 'agents' as segment, COUNT(DISTINCT u.id) as count
  FROM profiles p
  WHERE p.is_agent = true

  UNION ALL

  SELECT 'recharge_agents' as segment, COUNT(DISTINCT u.id) as count
  FROM profiles p
  WHERE p.staff_role IN ('admin', 'manager', 'agent', 'moderator')
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

-- ============================================
-- HELPER: Test segment queries
-- ============================================
-- Run this to see how many users in each segment
SELECT
  'all' as segment,
  COUNT(DISTINCT u.id) as users_count
FROM auth.users u
WHERE u.deleted_at IS NULL

UNION ALL

SELECT
  'active_famous' as segment,
  COUNT(DISTINCT u.id) as users_count
FROM auth.users u
JOIN profiles p ON u.id = p.id
WHERE p.is_vip = true OR p.verified = true OR (p.last_seen_at >= NOW() - INTERVAL '7 days')

UNION ALL

SELECT
  'recent_chargers' as segment,
  COUNT(DISTINCT u.id) as users_count
FROM auth.users u
LEFT JOIN recharge_transactions rt ON u.id = rt.user_id
WHERE rt.created_at >= NOW() - INTERVAL '30 days' AND rt.status = 'completed'

UNION ALL

SELECT
  'new_users' as segment,
  COUNT(DISTINCT u.id) as users_count
FROM profiles p
WHERE p.created_at >= NOW() - INTERVAL '30 days'

UNION ALL

SELECT
  'agents' as segment,
  COUNT(DISTINCT u.id) as users_count
FROM profiles p
WHERE p.is_agent = true

ORDER BY users_count DESC;
