# تحقق من الـ Implementation - Admin Messages System

## ✅ قائمة التحقق الشاملة

### المرحلة 1: الملفات الأساسية

#### 1. صفحة الـ Admin Messages
**المسار:** `src/pages/admin/AdminMessages.jsx`

**التحقق:**
```javascript
// يجب أن تحتوي على:
- import من AdminPermissionsContext أو permission check مباشر
- صفحة permission denied إذا ما كان عند المستخدم صلاحية
- Form كامل لـ:
  ✓ اختيار نوع الرسالة (Chat / Notification)
  ✓ اختيار الـ segments (المستخدمين المستهدفين)
  ✓ طرق التوصيل (In-app / Push)
  ✓ جدولة مسبقة أو إرسال فوري
  ✓ رفع صورة أو فيديو
```

**الملف الصحيح:** `AdminMessagesPage-WITH-PERMISSION.jsx` من الـ scratchpad

---

#### 2. تحديث الـ Sidebar Navigation
**المسار:** `src/components/AdminLayout.jsx`

**التحقق:**
```javascript
// يجب أن يحتوي على:
✓ import { useAdminPermissions } from '@/contexts/AdminPermissionsContext';
✓ const userPermissions = useAdminPermissions();
✓ رابط جديد:
  <NavLink
    to="/admin/messages"
    className={...}
  >
    🔔 الإشعارات والرسائل
  </NavLink>

✓ الرابط يظهر فقط عند:
  {userPermissions?.can_manage_notifications && (
    // الرابط هنا
  )}
```

---

#### 3. تحديث الـ Admin Permissions Context
**المسار:** `src/contexts/AdminPermissionsContext.jsx`

**التحقق:**
```javascript
// يجب أن يحتوي على:
✓ استخراج can_manage_notifications من البيانات:
  const hasNotificationPermission = permissions?.can_manage_notifications || false;

✓ تمرير الصلاحية في Context value:
  <AdminPermissionsContext.Provider 
    value={{
      ...permissions,
      can_manage_notifications: hasNotificationPermission
    }}
  >

✓ Hook يرجع الصلاحيات:
  export const useAdminPermissions = () => {
    return useContext(AdminPermissionsContext);
  };
```

---

### المرحلة 2: API و Database

#### 4. API Endpoint
**المسار:** `app/api/admin/send-message/route.js`

**التحقق:**
```javascript
// يجب أن يحتوي على:
✓ Permission check (استخدام service role key)
✓ معالجة الـ segments المختلفة
✓ إنشاء entries في message_recipients table
✓ دعم scheduled و immediate sending
✓ error handling شامل
```

---

#### 5. Database Columns
**المسار:** Supabase Database

**التحقق:**
```sql
-- تأكد من أن جدول staff_user_permissions يحتوي على:
ALTER TABLE staff_user_permissions 
ADD COLUMN can_manage_notifications BOOLEAN DEFAULT FALSE;

-- تأكد من وجود هذه الـ tables:
✓ admin_messages (id, title, content, status, etc.)
✓ message_recipients (id, message_id, user_id, is_read, etc.)
✓ staff_user_permissions (user_id, can_manage_notifications, etc.)
```

---

#### 6. Notification Bell Component
**المسار:** `components/UserNotificationBell.jsx`

**التحقق:**
```javascript
// يجب أن يعرض:
✓ Bell icon مع عداد الرسائل غير المقروءة
✓ Dropdown بـ messages
✓ Real-time updates (Supabase subscription)
✓ Mark as read functionality
✓ Delete message functionality
```

---

### المرحلة 3: الاختبار الفعلي

#### اختبار 1: التحقق من الصلاحية
```
1. أذهب إلى لوحة المسؤول
2. شغّل Inspect Element وتحقق من المتغيرات
3. لو كانت can_manage_notifications = false
   → يجب ما تظهر الصفحة في الـ sidebar
4. لو كانت can_manage_notifications = true
   → يجب تظهر الصفحة في الـ sidebar
```

#### اختبار 2: الوصول إلى الصفحة
```
1. أضف can_manage_notifications = true للمستخدم من Supabase
2. قم بـ refresh للصفحة
3. تحقق من أن الرابط ظهر في الـ sidebar
4. اضغط على الرابط → يجب تذهب إلى /admin/messages
5. يجب تشوف الـ form كامل بدون "لا توجد صلاحية" message
```

#### اختبار 3: إرسال رسالة اختبار
```
1. ملئ الـ form:
   - اختر نوع الرسالة (مثلاً: Notification)
   - اختر segment (مثلاً: "للكل")
   - اختر delivery method (مثلاً: In-app)
   - اكتب محتوى الرسالة
   - اختر "إرسال فوري"
2. اضغط "إرسال الرسالة"
3. تأكد من عدم وجود errors في console
4. تحقق من Supabase:
   - admin_messages table → يجب تكون رسالتك موجودة
   - message_recipients table → يجب تكون recipients موجودين
```

#### اختبار 4: Real-time Notifications
```
1. سجل دخول مستخدم عادي (مش admin)
2. تأكد من أن NotificationBell موجود في الـ header
3. أرسل رسالة من admin إلى "للكل"
4. يجب تشوف الرسالة تظهر في الـ bell فوراً
5. الـ counter يجب يزداد
```

---

### المرحلة 4: Troubleshooting

#### الرابط ما يظهر في الـ sidebar
```
✓ تأكد من can_manage_notifications = true في database
✓ تأكد من أن AdminLayout.jsx محدّث
✓ تأكد من أن AdminPermissionsContext موجود ويحتوي على الـ field
✓ قم بـ full page refresh (Ctrl+Shift+R)
```

#### الصفحة تعرض "لا توجد صلاحية"
```
✓ تأكد من أن user_id محفوظ في AuthContext
✓ تأكد من أن جدول staff_user_permissions يحتوي على سجل للمستخدم
✓ تأكد من أن can_manage_notifications = true في السجل
✓ فعّل Browser DevTools Console → قدّم إذا في errors
```

#### الرسائل ما توصل للمستخدمين
```
✓ تحقق من API errors في server logs
✓ تأكد من أن segment query جارية بشكل صحيح
✓ تأكد من أن message_recipients table فيها entries
✓ تأكد من أن RLS policies تسمح بـ read/write
```

---

## 📋 الملخص النهائي

### الملفات اللي لازم تتنقل:
1. **AdminMessagesPage-WITH-PERMISSION.jsx** → `src/pages/admin/AdminMessages.jsx`
2. **send-message-api-FIXED.js** → `app/api/admin/send-message/route.js`
3. **UserNotificationBell.jsx** → `components/UserNotificationBell.jsx`

### الملفات اللي تحتاج تحديث:
1. **AdminLayout.jsx** → إضافة route جديد + permission check
2. **AdminPermissionsContext.jsx** → إضافة can_manage_notifications field
3. **Database** → إضافة can_manage_notifications column

### الملفات اللي محتاجة تكون موجودة بالفعل:
- AuthContext
- Toast component (ui/use-toast)
- CSS utilities (cn function)

---

## ✨ بعد ما تخلص من التحقق:

- [ ] كل الملفات في المكان الصحيح
- [ ] الـ sidebar يعرض الرابط الجديد للـ admins اللي عندهم الصلاحية
- [ ] الصفحة تفتح بدون errors
- [ ] الـ form بيعمل بشكل صحيح
- [ ] الرسائل توصل للمستخدمين
- [ ] Real-time notifications تشتغل
