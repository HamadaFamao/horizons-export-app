# Admin Messages & Notifications System - Implementation Guide

## 📋 Overview

System for admins to send messages and notifications to users with granular targeting, scheduling, and delivery method control.

---

## 🗄️ Phase 1: Database Setup

### Step 1: Run SQL Schema
Execute `01-admin-messages-schema.sql` in Supabase SQL Editor:

```sql
-- Creates:
-- 1. admin_messages table
-- 2. message_recipients table
-- 3. user_segments table
-- 4. RLS policies
-- 5. Indexes and triggers
-- 6. Helper functions
```

**Verify:**
```sql
SELECT * FROM admin_messages LIMIT 1;
SELECT * FROM message_recipients LIMIT 1;
SELECT * FROM user_segments LIMIT 1;
```

### Step 2: Create Storage Bucket (if needed)

If `admin-content` bucket doesn't exist:

```sql
INSERT INTO storage.buckets (id, name, public, owner)
VALUES ('admin-content', 'admin-content', true, (SELECT id FROM auth.users LIMIT 1))
ON CONFLICT (id) DO NOTHING;
```

Create storage policy:

```sql
CREATE POLICY "admins can upload admin-content" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'admin-content'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND staff_role IN ('admin', 'manager', 'super_admin', 'moderator')
    )
  );

CREATE POLICY "public can read admin-content" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'admin-content');
```

---

## 🎨 Phase 2: Admin UI Component

### Step 1: Add Page to Admin Navigation

In your admin layout/navigation component, add:

```javascript
import AdminMessagesPage from '@/pages/admin/AdminMessages';

// In your routes/navigation:
{
  path: '/admin/messages',
  element: <AdminMessagesPage />,
  label: '📬 الرسائل والإشعارات'
}
```

### Step 2: Place Component Files

Copy files to your project:
- `AdminMessagesPage.jsx` → `src/pages/admin/AdminMessages.jsx`

### Step 3: Update Imports

Ensure these imports work:
```javascript
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
```

---

## 🔧 Phase 3: Backend API

### Step 1: Create API Endpoint

Create file: `app/api/admin/send-message/route.js`

Copy content from `send-message-api.js`

### Step 2: Verify Environment Variables

Ensure these are set in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Step 3: Test API

```bash
curl -X POST http://localhost:3000/api/admin/send-message \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "messageId": "uuid",
    "segments": ["all"],
    "sendType": "immediate"
  }'
```

---

## 👥 Phase 4: User Notification Display

### Option 1: Chat Messages Display

Add to chat/messages component:

```javascript
// Fetch admin messages
const { data: adminMessages } = await supabase
  .from('message_recipients')
  .select('admin_messages(*)')
  .eq('user_id', user.id)
  .in('admin_messages.message_type', ['chat']);

// Display in chat interface
adminMessages.forEach(msg => {
  // Show in messages list
});
```

### Option 2: Notification Bell

```javascript
import { Bell } from 'lucide-react';

export function NotificationBell() {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // Get unread admin messages
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'message_recipients',
        filter: `user_id=eq.${user.id}&is_read=eq.false`
      }, (payload) => {
        setUnread(prev => prev + 1);
      })
      .subscribe();

    return () => channel.unsubscribe();
  }, [user.id]);

  return (
    <div className="relative">
      <Bell className="w-5 h-5" />
      {unread > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
          {unread}
        </span>
      )}
    </div>
  );
}
```

---

## ⏰ Phase 5: Scheduled Messages (Cron Job)

### Create a Scheduled Task

Option A: Using a Cron Library

```javascript
// lib/cron/sendScheduledMessages.js
import cron from 'node-cron';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Run every minute
cron.schedule('* * * * *', async () => {
  console.log('[CRON] Checking for scheduled messages...');

  const { data: messages, error } = await supabaseAdmin
    .from('admin_messages')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', new Date().toISOString())
    .limit(10);

  if (error) {
    console.error('[CRON_ERROR]', error);
    return;
  }

  for (const msg of messages) {
    // Call send-message API to send
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/send-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: msg.id,
        segments: msg.recipient_segments || ['all'],
        sendType: 'immediate'
      })
    });
  }
});
```

Option B: Using Vercel Cron (serverless)

```javascript
// pages/api/cron/send-scheduled-messages.js
export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send('Unauthorized');
  }

  // Process scheduled messages...
  return res.status(200).send('OK');
}
```

Deploy to Vercel with `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/send-scheduled-messages",
    "schedule": "* * * * *"
  }]
}
```

---

## 🎯 User Segments Logic

### Active & Famous
Users marked with `segment_type = 'active_famous'` (manually via admin dashboard)

### Recent Chargers
Users with recharge transactions in last 30 days

### Inactive Chargers
Users who recharged before but not in last 5 months

### New Users
Created account in last 30 days

### Agents / Recharge Agents
Users with `staff_role = 'agent'` or in `recharge_agents` table

---

## 📊 Message Status Flow

```
DRAFT → (Admin clicks Send)
  ↓
SCHEDULED (if scheduled) → (Cron detects time) → SENT
  ↓
SENT (if immediate)

Status tracking:
- draft: Still editing
- scheduled: Waiting for scheduled time
- sent: Successfully sent/processed
- failed: Error occurred
```

---

## 🧪 Testing Checklist

- [ ] Database tables created ✅
- [ ] Admin UI page accessible
- [ ] Can upload images/videos
- [ ] Message type selection works
- [ ] Segment multi-select works
- [ ] Delivery method selection works
- [ ] Send immediately works
- [ ] Schedule with datetime works
- [ ] API endpoint receives message
- [ ] message_recipients entries created
- [ ] Users see messages/notifications
- [ ] Scheduled messages send at correct time

---

## 🚀 Going Live

1. **Deploy Database**
   - Run SQL schema
   - Create storage bucket
   - Verify RLS policies

2. **Deploy Admin UI**
   - Add page to admin navigation
   - Test form functionality

3. **Deploy Backend**
   - Push API endpoint
   - Set environment variables
   - Verify API works

4. **Deploy Cron Job**
   - Set up scheduled task runner
   - Test with scheduled message

5. **Deploy User Display**
   - Add notification bell
   - Add chat message display
   - Test real-time updates

---

## 📝 Notes

- Message content supports markdown
- Media uploads use Supabase Storage
- RLS ensures users see only their own messages
- Service role key used server-side for sending
- Cron job processes scheduled messages automatically
- Real-time subscriptions for notification updates

---

## 🐛 Troubleshooting

**Q: Messages not sending?**
- Check API endpoint is deployed
- Verify service role key in .env
- Check browser console for errors

**Q: Scheduled messages not running?**
- Verify cron job is running
- Check logs for errors
- Ensure database connection works

**Q: Storage upload failing?**
- Verify 'admin-content' bucket exists
- Check storage RLS policies
- Ensure file size within limits

**Q: Users not seeing messages?**
- Verify message_recipients entries created
- Check user notification component subscribed to channel
- Test real-time updates in Supabase
