// File: app/api/admin/send-message/route.js
// API endpoint for sending/scheduling admin messages (FIXED for actual schema)

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

// Helper: Get users by segment (FIXED queries)
async function getUsersBySegment(segment) {
  console.log('[GET_USERS] Fetching users for segment:', segment);

  try {
    let query = supabaseAdmin.from('auth.users').select('id').is('deleted_at', null);
    let profilesJoin = true;

    switch (segment) {
      case 'all':
        // All users
        const { data: allUsers, error: allError } = await supabaseAdmin
          .from('auth.users')
          .select('id')
          .is('deleted_at', null);

        if (allError) throw allError;
        return (allUsers || []).map(u => u.id);

      case 'active_famous':
        // VIP + Verified + Recently Active (last 7 days)
        const { data: activeFamous, error: activeError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .or('is_vip.eq.true,verified.eq.true,last_seen_at.gte.' + new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

        if (activeError) throw activeError;
        return (activeFamous || []).map(u => u.id);

      case 'recent_chargers':
        // Users who charged in last 30 days
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: recentChargers, error: recentError } = await supabaseAdmin
          .from('recharge_transactions')
          .select('distinct user_id')
          .gte('created_at', thirtyDaysAgo)
          .eq('status', 'completed');

        if (recentError) throw recentError;
        return (recentChargers || []).map(u => u.user_id).filter(Boolean);

      case 'inactive_chargers':
        // Users who charged 5+ months ago but not recently
        const fiveMonthsAgo = new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000).toISOString();

        // Get users who charged before 5 months
        const { data: oldChargers, error: oldError } = await supabaseAdmin
          .from('recharge_transactions')
          .select('distinct user_id')
          .lt('created_at', fiveMonthsAgo)
          .eq('status', 'completed');

        if (oldError) throw oldError;

        // Get users who charged recently
        const { data: recentChargers2 } = await supabaseAdmin
          .from('recharge_transactions')
          .select('distinct user_id')
          .gte('created_at', fiveMonthsAgo)
          .eq('status', 'completed');

        const recentIds = new Set((recentChargers2 || []).map(u => u.user_id));
        return (oldChargers || [])
          .map(u => u.user_id)
          .filter(id => !recentIds.has(id) && id)
          .filter(Boolean);

      case 'new_users':
        // Users created in last 30 days
        const thirtyDaysAgoDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data: newUsers, error: newError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .gte('created_at', thirtyDaysAgoDate);

        if (newError) throw newError;
        return (newUsers || []).map(u => u.id);

      case 'agents':
        // Users with is_agent = true
        const { data: agents, error: agentError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('is_agent', true);

        if (agentError) throw agentError;
        return (agents || []).map(u => u.id);

      case 'recharge_agents':
        // Users with staff_role in ('admin', 'manager', 'agent', 'moderator')
        const { data: rechargeAgents, error: rechargeError } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .in('staff_role', ['admin', 'manager', 'agent', 'moderator']);

        if (rechargeError) throw rechargeError;
        return (rechargeAgents || []).map(u => u.id);

      default:
        console.warn('[GET_USERS] Unknown segment:', segment);
        return [];
    }
  } catch (err) {
    console.error('[GET_USERS_ERROR]', segment, err);
    return [];
  }
}

// Helper: Get unique users from multiple segments (avoiding duplicates)
async function getUsersFromSegments(segments) {
  const userIds = new Set();

  for (const segment of segments) {
    const users = await getUsersBySegment(segment);
    users.forEach(id => userIds.add(id));
  }

  return Array.from(userIds);
}

// Helper: Send notifications to users
async function sendNotifications(messageId, userIds, message, deliveryMethods) {
  console.log(`[SEND_NOTIFICATIONS] Sending to ${userIds.length} users`);

  // Create message_recipients entries in chunks to avoid size limits
  const chunkSize = 100;
  let totalInserted = 0;

  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const recipients = chunk.map(userId => ({
      message_id: messageId,
      user_id: userId,
      recipient_segment: message.segment || 'all',
      is_read: false,
    }));

    const { error: recipientError } = await supabaseAdmin
      .from('message_recipients')
      .insert(recipients);

    if (recipientError) {
      console.error('[RECIPIENT_INSERT_ERROR]', recipientError);
      throw recipientError;
    }

    totalInserted += chunk.length;
  }

  // TODO: Implement push notifications if 'push' is in deliveryMethods
  if (deliveryMethods.includes('push')) {
    console.log('[PUSH_NOTIFICATION] Feature coming soon');
    // Implement Expo/Firebase push notifications here
  }

  return totalInserted;
}

export async function POST(req) {
  try {
    // Verify authorization
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    // Get request body
    const body = await req.json();
    const { messageId, segments, sendType, scheduledAt } = body;

    if (!messageId || !segments || segments.length === 0) {
      return NextResponse.json(
        { error: 'Missing required fields: messageId, segments' },
        { status: 400 }
      );
    }

    console.log('[SEND_MESSAGE_API]', { messageId, segments, sendType });

    // Get message details
    const { data: messageData, error: messageError } = await supabaseAdmin
      .from('admin_messages')
      .select('*')
      .eq('id', messageId)
      .single();

    if (messageError) {
      console.error('[MESSAGE_FETCH_ERROR]', messageError);
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    // Get users from segments
    const userIds = await getUsersFromSegments(segments);
    console.log(`[USERS_FETCHED] Found ${userIds.length} users to send to`);

    if (userIds.length === 0) {
      console.warn('[NO_USERS] No users found for segments:', segments);
      // Update message status to 'sent' even with 0 recipients
      await supabaseAdmin
        .from('admin_messages')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('id', messageId);

      return NextResponse.json({
        success: true,
        messageId,
        recipientCount: 0,
        message: 'No users found for segments'
      });
    }

    // Send/Schedule message
    if (sendType === 'immediate') {
      // Send immediately
      const sentCount = await sendNotifications(
        messageId,
        userIds,
        messageData,
        messageData.delivery_method || ['in_app']
      );

      // Update message status
      const { error: updateError } = await supabaseAdmin
        .from('admin_messages')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          total_recipients: sentCount
        })
        .eq('id', messageId);

      if (updateError) {
        console.error('[MESSAGE_UPDATE_ERROR]', updateError);
        throw updateError;
      }

      console.log('[MESSAGE_SENT]', { messageId, sentCount });

      return NextResponse.json({
        success: true,
        messageId,
        recipientCount: sentCount,
        message: 'Message sent successfully'
      });
    } else if (sendType === 'scheduled') {
      // Schedule message for later
      const { error: scheduleError } = await supabaseAdmin
        .from('admin_messages')
        .update({
          status: 'scheduled',
          scheduled_at: scheduledAt
        })
        .eq('id', messageId);

      if (scheduleError) {
        console.error('[SCHEDULE_ERROR]', scheduleError);
        throw scheduleError;
      }

      console.log('[MESSAGE_SCHEDULED]', { messageId, scheduledAt });

      return NextResponse.json({
        success: true,
        messageId,
        scheduledAt,
        message: 'Message scheduled successfully'
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid sendType: must be "immediate" or "scheduled"' },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error('[API_ERROR]', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET for health check
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
