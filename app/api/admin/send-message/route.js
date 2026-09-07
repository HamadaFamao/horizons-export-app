import { createClient } from '@supabase/supabase-js';

const env = globalThis.process?.env || {};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
});

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const jsonError = (error, status = 500) =>
  jsonResponse({ error }, status);

async function getUsersBySegment(segment) {
  switch (segment) {
    case 'all': {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id');
      if (error) throw error;
      return (data || []).map(({ id }) => id).filter(Boolean);
    }
    case 'active_famous': {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .or(`is_vip.eq.true,verified.eq.true,last_seen_at.gte.${cutoff}`);
      if (error) throw error;
      return (data || []).map(({ id }) => id).filter(Boolean);
    }
    case 'recent_chargers': {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from('recharge_transactions')
        .select('user_id')
        .gte('created_at', cutoff)
        .eq('status', 'completed');
      if (error) throw error;
      return (data || []).map(({ user_id }) => user_id).filter(Boolean);
    }
    case 'inactive_chargers': {
      const cutoff = new Date(Date.now() - 5 * 30 * 24 * 60 * 60 * 1000).toISOString();
      const [{ data: oldData, error: oldError }, { data: recentData, error: recentError }] = await Promise.all([
        supabaseAdmin
          .from('recharge_transactions')
          .select('user_id')
          .lt('created_at', cutoff)
          .eq('status', 'completed'),
        supabaseAdmin
          .from('recharge_transactions')
          .select('user_id')
          .gte('created_at', cutoff)
          .eq('status', 'completed'),
      ]);
      if (oldError) throw oldError;
      if (recentError) throw recentError;
      const recentIds = new Set((recentData || []).map(({ user_id }) => user_id));
      return (oldData || [])
        .map(({ user_id }) => user_id)
        .filter((id) => id && !recentIds.has(id));
    }
    case 'new_users': {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .gte('created_at', cutoff);
      if (error) throw error;
      return (data || []).map(({ id }) => id).filter(Boolean);
    }
    case 'agents': {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('is_agent', true);
      if (error) throw error;
      return (data || []).map(({ id }) => id).filter(Boolean);
    }
    case 'recharge_agents': {
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('staff_role', ['admin', 'manager', 'agent', 'moderator']);
      if (error) throw error;
      return (data || []).map(({ id }) => id).filter(Boolean);
    }
    default:
      throw new Error(`Unknown segment: ${segment}`);
  }
}

async function getUsersFromSegments(segments) {
  const userIds = new Set();
  for (const segment of segments) {
    const ids = await getUsersBySegment(segment);
    ids.forEach((id) => userIds.add(id));
  }
  return Array.from(userIds);
}

async function insertRecipients(messageId, userIds, segments) {
  const recipientSegment = segments.length === 1 ? segments[0] : 'all';
  const recipients = userIds.map((userId) => ({
    message_id: messageId,
    user_id: userId,
    recipient_segment: recipientSegment,
    is_read: false,
  }));

  for (let index = 0; index < recipients.length; index += 100) {
    const { error } = await supabaseAdmin
      .from('message_recipients')
      .insert(recipients.slice(index, index + 100));
    if (error) throw error;
  }

  return recipients.length;
}

async function requireNotificationPermission(request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { error: jsonError('Missing or invalid authorization header', 401) };

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !authData?.user?.id) {
    return { error: jsonError('Invalid or expired authorization token', 401) };
  }

  const { data: staff, error: staffError } = await supabaseAdmin
    .from('v_staff_users')
    .select('can_manage_notifications, can_send_notifications, staff_role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (staffError) return { error: jsonError('Unable to verify permissions', 500) };

  let allowed = staff?.can_manage_notifications ?? staff?.can_send_notifications ?? false;
  if (!staff) {
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('isadmin, admin_role, staff_role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) return { error: jsonError('Unable to verify permissions', 500) };
    allowed = profile?.isadmin === true || ['admin', 'manager', 'super_admin'].includes(profile?.admin_role);
  }

  return allowed
    ? { userId: authData.user.id }
    : { error: jsonError('You do not have permission to manage notifications', 403) };
}

export async function POST(request) {
  try {
    const permission = await requireNotificationPermission(request);
    if (permission.error) return permission.error;

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 400);
    }

    const { messageId, segments, sendType = 'immediate', scheduledAt } = body || {};
    if (!messageId || !Array.isArray(segments) || segments.length === 0) {
      return jsonError('Missing required fields: messageId and segments', 400);
    }
    if (!['immediate', 'scheduled'].includes(sendType)) {
      return jsonError('Invalid sendType: must be "immediate" or "scheduled"', 400);
    }
    if (sendType === 'scheduled' && (!scheduledAt || Number.isNaN(Date.parse(scheduledAt)))) {
      return jsonError('scheduledAt is required for scheduled messages', 400);
    }

    const { data: message, error: messageError } = await supabaseAdmin
      .from('admin_messages')
      .select('id, delivery_method')
      .eq('id', messageId)
      .maybeSingle();
    if (messageError) throw messageError;
    if (!message) return jsonError('Message not found', 404);

    const userIds = await getUsersFromSegments(segments);
    const update = sendType === 'scheduled'
      ? { status: 'scheduled', scheduled_at: new Date(scheduledAt).toISOString(), total_recipients: userIds.length }
      : { status: 'sent', sent_at: new Date().toISOString(), total_recipients: userIds.length };

    const recipientCount = await insertRecipients(messageId, userIds, segments);
    const { error: updateError } = await supabaseAdmin
      .from('admin_messages')
      .update(update)
      .eq('id', messageId);
    if (updateError) throw updateError;

    return jsonResponse({
      success: true,
      messageId,
      recipientCount,
      sendType,
      scheduledAt: sendType === 'scheduled' ? update.scheduled_at : null,
      deliveryMethods: message.delivery_method || ['in_app'],
    });
  } catch (error) {
    console.error('[SEND_MESSAGE_API_ERROR]', error);
    return jsonError(error?.message || 'Internal server error', 500);
  }
}

export async function GET() {
  return jsonResponse({ status: 'ok' });
}
