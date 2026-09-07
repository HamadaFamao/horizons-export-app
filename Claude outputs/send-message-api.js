// File: app/api/admin/send-message/route.js
// API endpoint for sending/scheduling admin messages

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

// Helper: Get users by segment
async function getUsersBySegment(segment) {
  console.log('[GET_USERS] Fetching users for segment:', segment);

  const queries = {
    all: `SELECT id FROM auth.users WHERE created_at IS NOT NULL`,

    active_famous: `
      SELECT DISTINCT u.id
      FROM auth.users u
      JOIN user_segments us ON u.id = us.user_id
      WHERE us.segment_type = 'active_famous'
    `,

    recent_chargers: `
      SELECT DISTINCT u.id
      FROM auth.users u
      WHERE EXISTS (
        SELECT 1 FROM recharge_transactions rt
        WHERE rt.user_id = u.id
        AND rt.created_at >= NOW() - INTERVAL '30 days'
      )
    `,

    inactive_chargers: `
      SELECT DISTINCT u.id
      FROM auth.users u
      WHERE u.id IN (
        SELECT DISTINCT user_id
        FROM recharge_transactions
      )
      AND u.id NOT IN (
        SELECT DISTINCT user_id
        FROM recharge_transactions
        WHERE created_at >= NOW() - INTERVAL '5 months'
      )
    `,

    new_users: `
      SELECT id
      FROM auth.users
      WHERE created_at >= NOW() - INTERVAL '30 days'
    `,

    agents: `
      SELECT DISTINCT u.id
      FROM auth.users u
      JOIN profiles p ON u.id = p.id
      WHERE p.staff_role = 'agent'
    `,

    recharge_agents: `
      SELECT DISTINCT user_id as id
      FROM recharge_agents
      WHERE is_active = true
    `,
  };

  try {
    const query = queries[segment];
    if (!query) {
      console.warn('[GET_USERS] Unknown segment:', segment);
      return [];
    }

    const { data, error } = await supabaseAdmin.rpc('execute_query', {
      query_text: query
    }).catch(() => {
      // Fallback: use direct query (if RPC not available)
      return supabaseAdmin
        .from('auth.users')
        .select('id')
        .then(result => {
          console.log('[GET_USERS] Fallback query result:', result);
          return result;
        });
    });

    if (error) {
      console.error('[GET_USERS_ERROR]', segment, error);
      return [];
    }

    return data.map(row => row.id) || [];
  } catch (err) {
    console.error('[GET_USERS_EXCEPTION]', segment, err);
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

  // Create message_recipients entries
  const recipients = userIds.map(userId => ({
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

  // TODO: Implement push notifications if 'push' is in deliveryMethods
  if (deliveryMethods.includes('push')) {
    console.log('[PUSH_NOTIFICATION] Feature coming soon');
    // Implement Expo/Firebase push notifications here
  }

  return recipients.length;
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
      // Store scheduled info for cron job to process later
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
