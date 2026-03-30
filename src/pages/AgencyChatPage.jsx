import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import AgencyChatSection from "@/components/AgencyChatSection";

export default function AgencyChatPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setLoading(true);
        setError("");
        setProfile(null);

        // ✅ safest auth check (no context)
        const { data: authRes, error: authErr } = await supabase.auth.getUser();
        if (authErr) throw authErr;

        const user = authRes?.user;
        if (!user?.id) {
          if (!mounted) return;
          setAuthed(false);
          return;
        }

        if (!mounted) return;
        setAuthed(true);

        // ✅ load minimal profile for chat section
        const { data, error } = await supabase
          .from("profiles")
          .select("id, profile_id, name, avatar_url, is_agent, referred_by, referral_code")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        if (!mounted) return;

        setProfile(data);
      } catch (e) {
        console.error("[AgencyChatPage] error:", e);
        if (mounted) setError(e?.message || "Failed to load agency chat");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-24">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-lg text-gray-900">Agency Chat</h1>
              <p className="text-xs text-gray-500">Official agency channel</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate("/profile")}>
            Back to Profile
          </Button>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          </div>
        ) : error ? (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-sm text-red-600 whitespace-pre-line">{error}</div>
          </div>
        ) : !authed ? (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="text-sm text-gray-700 mb-3">You must be logged in to open the chat.</div>
            <Button onClick={() => navigate("/auth")}>Go to Login</Button>
          </div>
        ) : (
          // ✅ لو الـ AgencyChatSection فيه مشكلة، مش هنسيب الصفحة توقع:
          <SafeRender>
            <AgencyChatSection embedded={false} profile={profile} />
          </SafeRender>
        )}
      </div>
    </div>
  );
}

/**
 * ✅ Prevent full app crash if child component throws
 */
function SafeRender({ children }) {
  try {
    return children;
  } catch (e) {
    console.error("[SafeRender] crash:", e);
    return (
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="text-sm text-red-600">
          A UI error happened while rendering the chat section.
          <br />
          Check console for details.
        </div>
      </div>
    );
  }
}