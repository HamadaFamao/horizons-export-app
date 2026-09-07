# دليل النشر النهائي - Admin Messages System

## 📦 الملفات المطلوبة والمسارات

### القسم 1️⃣: ملفات جديدة (Create New)

#### 1. صفحة إدارة الرسائل
**المسار:** `src/pages/admin/AdminMessages.jsx`
**المصدر:** `AdminMessagesPage-WITH-PERMISSION.jsx` من scratchpad
**الخطوات:**
```
1. اذهب إلى VS Code
2. انشئ مجلد إذا لم يكن موجود: src/pages/admin/
3. انشئ ملف جديد: AdminMessages.jsx
4. انسخ محتوى AdminMessagesPage-WITH-PERMISSION.jsx
5. احفظ الملف
```

**مطالبة VS Code:**
```
الجديد: src/pages/admin/AdminMessages.jsx
← انسخ محتوى AdminMessagesPage-WITH-PERMISSION.jsx كاملاً
```

---

#### 2. API Endpoint للرسائل
**المسار:** `app/api/admin/send-message/route.js`
**المصدر:** `send-message-api-FIXED.js` من scratchpad
**الخطوات:**
```
1. انشئ مجلد إذا لم يكن موجود: app/api/admin/
2. انشئ ملف جديد: send-message/route.js
3. انسخ محتوى send-message-api-FIXED.js
4. احفظ الملف
```

**مطالبة VS Code:**
```
الجديد: app/api/admin/send-message/route.js
← انسخ محتوى send-message-api-FIXED.js كاملاً
```

---

#### 3. Notification Bell Component
**المسار:** `components/UserNotificationBell.jsx`
**المصدر:** `UserNotificationBell.jsx` من scratchpad
**الخطوات:**
```
1. انشئ ملف جديد: components/UserNotificationBell.jsx
2. انسخ محتوى UserNotificationBell.jsx
3. احفظ الملف
```

**مطالبة VS Code:**
```
الجديد: components/UserNotificationBell.jsx
← انسخ محتوى UserNotificationBell.jsx كاملاً
```

---

### القسم 2️⃣: ملفات موجودة (Update Existing)

#### 1. تحديث الـ Sidebar Navigation
**المسار:** `src/components/AdminLayout.jsx`

**التغيير المطلوب:**
أضف هذا الرابط الجديد في قسم الـ navigation:

```javascript
// ابحث عن القسم الذي يحتوي على NavLinks الموجودة
// أضف هذا الرابط بعد رابط آخر:

{userPermissions?.can_manage_notifications && (
  <NavLink
    to="/admin/messages"
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-2 rounded-lg transition ${
        isActive
          ? 'bg-indigo-100 text-indigo-600 font-semibold'
          : 'text-gray-700 hover:bg-gray-100'
      }`
    }
  >
    🔔 الإشعارات والرسائل
  </NavLink>
)}
```

**مطالبة VS Code:**
```
عدّل: src/components/AdminLayout.jsx
← أضف رابط جديد في قسم navigation:
  المسار: /admin/messages
  النص: 🔔 الإشعارات والرسائل
  شرط الظهور: userPermissions?.can_manage_notifications
```

---

#### 2. تحديث الـ Admin Permissions Context
**المسار:** `src/contexts/AdminPermissionsContext.jsx`

**التغيير المطلوب:**
تأكد من أن الـ context يشمل `can_manage_notifications`:

```javascript
// في جزء حيث يتم جلب الصلاحيات:
const permissions = data?.user_permissions || {};

// في جزء حيث يتم تمرير الـ value:
const contextValue = {
  can_manage_notifications: permissions?.can_manage_notifications || false,
  // ... باقي الصلاحيات
};

// تأكد من أن Hook موجود:
export const useAdminPermissions = () => {
  const context = useContext(AdminPermissionsContext);
  return context;
};
```

**مطالبة VS Code:**
```
عدّل: src/contexts/AdminPermissionsContext.jsx
← أضف can_manage_notifications في:
  1. استخراج الصلاحيات من البيانات
  2. تمرير الصلاحية في context value
  3. التأكد من أن Hook useAdminPermissions موجود
```

---

#### 3. إضافة UserNotificationBell في Header (إذا لم تكن موجودة)
**المسار:** أي ملف header (مثل `src/components/Header.jsx` أو `src/layouts/MainLayout.jsx`)

**التغيير المطلوب:**
```javascript
import UserNotificationBell from '@/components/UserNotificationBell';

export default function Header() {
  return (
    <header>
      {/* محتوى آخر */}
      <UserNotificationBell />
    </header>
  );
}
```

**مطالبة VS Code:**
```
عدّل: [اسم ملف الـ Header بتاعك]
← استيراد وإضافة UserNotificationBell في المكان المناسب
```

---

### القسم 3️⃣: Database Changes (SQL)

#### قاعدة البيانات - Supabase

**الخطوات:**
1. اذهب إلى Supabase Dashboard
2. اضغط على SQL Editor
3. شغّل هذا الـ Query:

```sql
-- تأكد من وجود column في جدول staff_user_permissions
ALTER TABLE staff_user_permissions 
ADD COLUMN IF NOT EXISTS can_manage_notifications BOOLEAN DEFAULT FALSE;

-- تأكد من وجود الـ tables
-- جدول admin_messages (يجب يكون موجود بالفعل)
CREATE TABLE IF NOT EXISTS admin_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255),
  content TEXT,
  message_type VARCHAR(50),
  media_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'draft',
  scheduled_at TIMESTAMP,
  sent_at TIMESTAMP,
  total_recipients INTEGER DEFAULT 0,
  delivery_method VARCHAR(50)[] DEFAULT ARRAY['in_app'],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- جدول message_recipients (يجب يكون موجود بالفعل)
CREATE TABLE IF NOT EXISTS message_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES admin_messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_segment VARCHAR(50),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**مطالبة Supabase:**
```
SQL Query:
← شغّل الـ queries أعلاه في Supabase SQL Editor
← تأكد من أن الـ columns والـ tables موجودة
← لا توجد أخطاء في التنفيذ
```

---

## 🚀 خطوات التنفيذ بالترتيب

### المرحلة 1: الملفات الجديدة (15 دقيقة)
```
1. [ ] انشئ src/pages/admin/AdminMessages.jsx
2. [ ] انسخ محتوى AdminMessagesPage-WITH-PERMISSION.jsx
3. [ ] انشئ app/api/admin/send-message/route.js
4. [ ] انسخ محتوى send-message-api-FIXED.js
5. [ ] انشئ components/UserNotificationBell.jsx
6. [ ] انسخ محتوى UserNotificationBell.jsx
```

### المرحلة 2: تحديثات الملفات الموجودة (10 دقائق)
```
1. [ ] عدّل src/components/AdminLayout.jsx
2. [ ] أضف رابط جديد في الـ sidebar
3. [ ] تأكد من import useAdminPermissions
4. [ ] عدّل src/contexts/AdminPermissionsContext.jsx
5. [ ] أضف can_manage_notifications field
6. [ ] أضف import في Header للـ NotificationBell
```

### المرحلة 3: Database Changes (5 دقائق)
```
1. [ ] اذهب إلى Supabase Dashboard
2. [ ] افتح SQL Editor
3. [ ] شغّل الـ SQL queries أعلاه
4. [ ] تأكد من عدم وجود أخطاء
```

### المرحلة 4: الاختبار (10 دقائق)
```
1. [ ] قم بـ npm run dev أو restart الـ dev server
2. [ ] سجّل دخول كمسؤول
3. [ ] تحقق من أن الرابط الجديد يظهر في الـ sidebar
4. [ ] اضغط على الرابط وتأكد من فتح الصفحة
5. [ ] حاول إرسال رسالة اختبار
```

---

## ⚠️ ملاحظات هامة

### إذا حصلت مشاكل:

**1. الرابط ما يظهر في الـ sidebar:**
```
السبب المحتمل:
- can_manage_notifications = false في database
- لم تقم بـ refresh للصفحة

الحل:
1. تأكد من أن admin user عنده can_manage_notifications = true
2. قم بـ Ctrl+Shift+R لـ hard refresh
3. قم بـ logout و login مرة أخرى
```

**2. الصفحة تعرض "لا توجد صلاحية":**
```
السبب المحتمل:
- المستخدم مش موجود في staff_user_permissions table
- قيمة can_manage_notifications = false

الحل:
1. اذهب إلى Supabase
2. جدول staff_user_permissions
3. تأكد من وجود سجل للمستخدم
4. غيّر can_manage_notifications إلى true
```

**3. الـ import files not found:**
```
السبب المحتمل:
- المسارات النسبية غير صحيحة

الحل:
1. تأكد من أن جميع الـ imports تستخدم @/ prefix
2. تأكد من وجود jsconfig.json في root
3. تحقق من الـ paths في jsconfig.json
```

**4. API endpoint returns errors:**
```
السبب المحتمل:
- NEXT_PUBLIC_SUPABASE_URL غير موجود
- SUPABASE_SERVICE_ROLE_KEY غير موجود

الحل:
1. تأكد من وجود هذه المتغيرات في .env.local
2. تحقق من القيم صحيحة
3. أعد تشغيل الـ dev server
```

---

## 📱 اختبار سريع بعد النشر

```javascript
// اختبر الـ API من Browser Console:
fetch('/api/admin/send-message', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messageId: 'test-123',
    segments: ['all'],
    sendType: 'immediate'
  })
})
.then(r => r.json())
.then(d => console.log('Success:', d))
.catch(e => console.error('Error:', e));
```

---

## ✅ علامات النجاح

- [ ] الرابط يظهر في الـ sidebar للـ admins المخولين
- [ ] الصفحة تفتح بدون أخطاء
- [ ] الـ form كاملة وتقبل الإدخال
- [ ] الرسائل تُحفظ في database
- [ ] الـ notification bell يظهر الرسائل الجديدة
- [ ] Real-time updates تعمل

---

## 🎯 هدف هذا الـ Setup

بعد انتهائك من هذا الدليل:
✅ سيكون لديك نظام رسائل admin كامل
✅ تتحكم في من يمكنه الوصول (عبر permissions)
✅ يمكنك إرسال رسائل مجدولة أو فورية
✅ المستخدمون سيستقبلون الرسائل فوراً
✅ يمكنك تتبع من قرأ الرسالة

---

**آخر تحديث:** 2026-09-07
**الحالة:** جاهز للنشر
