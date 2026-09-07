import React, { useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Send, X, Loader2, Upload, Clock, Zap, Bell, MessageSquare, Image as ImageIcon, Video } from 'lucide-react';
import { cn } from '@/lib/utils';

const AdminMessagesPage = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef(null);

  // Form State
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [mediaType, setMediaType] = useState(null); // 'image' or 'video'

  // Message Type Selection
  const [messageTypes, setMessageTypes] = useState({
    chat: false,
    notification: false,
  });

  // Recipient Segments
  const [selectedSegments, setSelectedSegments] = useState(new Set());
  const [showSegmentDropdown, setShowSegmentDropdown] = useState(false);

  const segments = [
    { id: 'all', label: '🌐 للكل', icon: '🌐' },
    { id: 'active_famous', label: '⭐ مستخدمين نشطين ومشاهير', icon: '⭐' },
    { id: 'recent_chargers', label: '💳 مستخدمين شحنوا مؤخراً', icon: '💳' },
    { id: 'inactive_chargers', label: '⏸️ توقفوا عن الشحن 5+ أشهر', icon: '⏸️' },
    { id: 'new_users', label: '🆕 مستخدمين جدد', icon: '🆕' },
    { id: 'agents', label: '👤 وكلاء', icon: '👤' },
    { id: 'recharge_agents', label: '💰 وكلاء الشحن', icon: '💰' },
  ];

  // Delivery Method
  const [deliveryMethods, setDeliveryMethods] = useState({
    in_app: true,
    push: false,
  });

  // Send Type
  const [sendType, setSendType] = useState('immediate');
  const [scheduledDateTime, setScheduledDateTime] = useState('');

  // Loading State
  const [sending, setSending] = useState(false);

  // Handle File Selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      toast({ title: 'اختر صورة أو فيديو فقط', variant: 'destructive' });
      return;
    }

    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      toast({
        title: isVideo ? 'الحد الأقصى للفيديو 100MB' : 'الحد الأقصى للصورة 10MB',
        variant: 'destructive'
      });
      return;
    }

    setMediaFile(file);
    setMediaType(isImage ? 'image' : 'video');
    setMediaPreview(URL.createObjectURL(file));
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreview(null);
    setMediaType(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle Segment Toggle
  const toggleSegment = (segmentId) => {
    const newSet = new Set(selectedSegments);
    if (newSet.has(segmentId)) {
      newSet.delete(segmentId);
    } else {
      newSet.add(segmentId);
    }
    setSelectedSegments(newSet);
  };

  // Validation
  const isValid = () => {
    const hasMessageType = messageTypes.chat || messageTypes.notification;
    const hasRecipients = selectedSegments.size > 0;
    const hasDelivery = deliveryMethods.in_app || deliveryMethods.push;
    const hasContent = content.trim().length > 0;

    if (!hasMessageType) {
      toast({ title: 'اختر نوع الرسالة (شات أو إشعار)', variant: 'destructive' });
      return false;
    }
    if (!hasRecipients) {
      toast({ title: 'اختر على الأقل فئة واحدة من المستخدمين', variant: 'destructive' });
      return false;
    }
    if (!hasDelivery) {
      toast({ title: 'اختر طريقة التوصيل', variant: 'destructive' });
      return false;
    }
    if (!hasContent) {
      toast({ title: 'اكتب محتوى الرسالة', variant: 'destructive' });
      return false;
    }
    if (sendType === 'scheduled' && !scheduledDateTime) {
      toast({ title: 'اختر التاريخ والوقت للرسالة المجدولة', variant: 'destructive' });
      return false;
    }

    return true;
  };

  // Handle Submit
  const handleSubmit = async () => {
    if (!isValid()) return;
    if (!user?.id) return;

    setSending(true);

    try {
      let mediaUrl = null;

      // Upload media if exists
      if (mediaFile) {
        const ext = mediaFile.name.split('.').pop();
        const fileName = `admin-messages/${user.id}/${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from('admin-content')
          .upload(fileName, mediaFile, { upsert: false });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('admin-content')
          .getPublicUrl(fileName);

        mediaUrl = urlData.publicUrl;
      }

      // Prepare message data
      const messageData = {
        created_by: user.id,
        title: title.trim() || null,
        content: content.trim(),
        media_url: mediaUrl,
        message_type: [
          messageTypes.chat && 'chat',
          messageTypes.notification && 'notification'
        ].filter(Boolean),
        delivery_method: [
          deliveryMethods.in_app && 'in_app',
          deliveryMethods.push && 'push'
        ].filter(Boolean),
        send_type: sendType,
        status: sendType === 'immediate' ? 'sent' : 'scheduled',
        scheduled_at: sendType === 'scheduled' ? new Date(scheduledDateTime).toISOString() : null,
        total_recipients: selectedSegments.size,
      };

      // Insert message
      const { data: messageResult, error: messageError } = await supabase
        .from('admin_messages')
        .insert([messageData])
        .select()
        .single();

      if (messageError) throw messageError;

      // Call API to send/schedule message
      const response = await fetch('/api/admin/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: messageResult.id,
          segments: Array.from(selectedSegments),
          sendType: sendType,
          scheduledAt: messageData.scheduled_at,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      // Reset form
      setTitle('');
      setContent('');
      handleRemoveMedia();
      setMessageTypes({ chat: false, notification: false });
      setSelectedSegments(new Set());
      setDeliveryMethods({ in_app: true, push: false });
      setSendType('immediate');
      setScheduledDateTime('');

      toast({
        title: sendType === 'immediate' ? '✅ تم إرسال الرسالة!' : '✅ تم جدولة الرسالة!',
        className: 'bg-green-50 border-green-200 text-green-800',
      });
    } catch (err) {
      console.error('[MESSAGE_ERROR]', err);
      toast({
        title: 'خطأ في إرسال الرسالة',
        description: err.message,
        variant: 'destructive'
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">🔔 رسائل وإشعارات النظام</h1>
        <p className="text-gray-600">أرسل رسائل وإشعارات للمستخدمين مباشرة</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

        {/* Content Editor */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            📝 محتوى الرسالة
          </label>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="العنوان (اختياري)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <textarea
              placeholder="اكتب محتوى الرسالة..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
            />
            <p className="text-xs text-gray-400 text-right">{content.length} حرف</p>
          </div>
        </div>

        {/* Media Upload */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            📸 الصور والفيديو (اختياري)
          </label>
          {!mediaPreview ? (
            <label className="cursor-pointer">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition">
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-600 font-medium">اسحب صورة أو فيديو هنا</p>
                <p className="text-xs text-gray-400 mt-1">أو اضغط لاختيار ملف</p>
                <p className="text-xs text-gray-400 mt-2">الصور: JPG, PNG (max 10MB) • الفيديو: MP4 (max 100MB)</p>
              </div>
            </label>
          ) : (
            <div className="relative rounded-xl overflow-hidden bg-gray-100">
              {mediaType === 'image' ? (
                <img src={mediaPreview} alt="preview" className="w-full max-h-64 object-cover" />
              ) : (
                <video src={mediaPreview} className="w-full max-h-64 object-cover" controls />
              )}
              <button
                onClick={handleRemoveMedia}
                className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full hover:bg-black/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Message Type Selection */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            💬 نوع الرسالة
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={messageTypes.chat}
                onChange={(e) => setMessageTypes({ ...messageTypes, chat: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">رسالة شات</span>
              </div>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={messageTypes.notification}
                onChange={(e) => setMessageTypes({ ...messageTypes, notification: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700">إشعار</span>
              </div>
            </label>
          </div>
        </div>

        {/* Recipient Segments */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            👥 نوعية المستخدمين
          </label>
          <div className="relative">
            <button
              onClick={() => setShowSegmentDropdown(!showSegmentDropdown)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-left flex items-center justify-between hover:bg-gray-50 transition"
            >
              <span className="text-gray-700">
                {selectedSegments.size === 0
                  ? 'اختر المستخدمين...'
                  : `${selectedSegments.size} فئة مختارة`}
              </span>
              <svg className={cn("w-5 h-5 transition", showSegmentDropdown && "rotate-180")} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>

            {showSegmentDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-96 overflow-y-auto">
                {segments.map((segment) => (
                  <label
                    key={segment.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSegments.has(segment.id)}
                      onChange={() => toggleSegment(segment.id)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium text-gray-700">{segment.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Selected Segments Display */}
          {selectedSegments.size > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {Array.from(selectedSegments).map((segmentId) => {
                const segment = segments.find((s) => s.id === segmentId);
                return (
                  <div
                    key={segmentId}
                    className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium"
                  >
                    <span>{segment.label}</span>
                    <button
                      onClick={() => toggleSegment(segmentId)}
                      className="hover:text-indigo-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Delivery Method */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            📲 طريقة التوصيل
          </label>
          <div className="flex gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deliveryMethods.in_app}
                onChange={(e) => setDeliveryMethods({ ...deliveryMethods, in_app: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">داخل التطبيق</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deliveryMethods.push}
                onChange={(e) => setDeliveryMethods({ ...deliveryMethods, push: e.target.checked })}
                className="w-4 h-4 rounded border-gray-300"
              />
              <span className="text-sm font-medium text-gray-700">إشعار الموبايل</span>
            </label>
          </div>
        </div>

        {/* Send Type */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            ⏰ طريقة الإرسال
          </label>
          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="sendType"
                value="immediate"
                checked={sendType === 'immediate'}
                onChange={(e) => setSendType(e.target.value)}
                className="w-4 h-4"
              />
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium text-gray-700">إرسال فوري</span>
              </div>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="sendType"
                value="scheduled"
                checked={sendType === 'scheduled'}
                onChange={(e) => setSendType(e.target.value)}
                className="w-4 h-4"
              />
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">جدولة الرسالة</span>
              </div>
            </label>
          </div>

          {sendType === 'scheduled' && (
            <div className="mt-3">
              <input
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(e) => setScheduledDateTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={sending || !content.trim()}
          className="w-full mt-6 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition flex items-center justify-center gap-2"
        >
          {sending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإرسال...</>
          ) : (
            <><Send className="w-4 h-4" /> إرسال الرسالة</>
          )}
        </button>
      </div>
    </div>
  );
};

export default AdminMessagesPage;
