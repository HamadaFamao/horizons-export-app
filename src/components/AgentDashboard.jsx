import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Users, MessageCircle, RefreshCw, UserPlus, Trash2 } from "lucide-react";

export default function AgentDashboard({ profile: profileProp = null, embedded = true }) {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(profileProp);

  const [agencyId, setAgencyId] = useState(null);
  const [agencyName, setAgencyName] = useState(null);

  const [admins, setAdmins] = useState([]);
  const [adminsLoading, setAdminsLoading] = useState(false);

  const [addProfileId, setAddProfileId] = useState("");
  const [addRole, setAddRole] = useState("mod");
  const [adding, setAdding] = useState(false);

  const [error, setError] = useState("");

  const isAgent = useMemo(() => {
    return (
      profile?.is_agent === true ||
      profile?.agent === true ||
      profile?.role === "agent" ||
      profile?.account_type === "agent" ||
      false
    );
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        if (profileProp) {
          setProfile(profileProp);
          setLoading(false);
          return;
        }

        setLoading(true);
        setError("");

        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user?.id) {
          setError("Not authenticated");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("id, profile_id, name, avatar_url, is_agent, agency_id, agency_name, family_id, family_name")
          .eq("id", user.id)
          .single();

        if (error) throw error;
        if (!mounted) return;
        setProfile(data);
      } catch (e) {
        if (mounted) setError(e?.message || "Failed to load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [profileProp]);

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        setError("");

        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user?.id) return;

        const { data: ua, error: uaErr } = await supabase
          .from("v_user_agency")
          .select("agency_id, agency_name")
          .eq("user_id", user.id)
          .maybeSingle();

        if (uaErr) {
          console.warn("[AgentDashboard] v_user_agency error:", uaErr.message);
        }

        const aId = ua?.agency_id ?? profile?.agency_id ?? profile?.family_id ?? null;
        const aName = ua?.agency_name ?? profile?.agency_name ?? profile?.family_name ?? null;

        if (!mounted) return;
        setAgencyId(aId);
        setAgencyName(aName);
      } catch (e) {
        if (mounted) setError(e?.message || "Failed to load agency");
      }
    };

    if (!profile) return;
    run();

    return () => {
      mounted = false;
    };
  }, [profile]);

  const refreshAdmins = async () => {
    if (!agencyId) return;
    setAdminsLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.rpc("list_agency_chat_admins", {
        p_agency_id: agencyId,
      });

      if (error) throw error;

      setAdmins(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Failed to load moderators");
      setAdmins([]);
    } finally {
      setAdminsLoading(false);
    }
  };

  useEffect(() => {
    if (!agencyId) return;
    refreshAdmins();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agencyId]);

  const onAdd = async () => {
    try {
      const pid = parseInt(String(addProfileId || "").trim(), 10);
      if (!pid || Number.isNaN(pid)) {
        setError("Enter a valid Profile ID (numbers only).");
        return;
      }
      if (!agencyId) {
        setError("Missing agency_id");
        return;
      }

      setAdding(true);
      setError("");

      const { data, error } = await supabase.rpc("set_agency_chat_admin", {
        p_agency_id: agencyId,
        p_target_profile_id: pid,
        p_role: addRole,
      });

      if (error) throw error;

      if (data?.success !== true) {
        throw new Error(data?.error || "Failed to add moderator");
      }

      setAddProfileId("");
      await refreshAdmins();
    } catch (e) {
      setError(e?.message || "Failed to add moderator");
    } finally {
      setAdding(false);
    }
  };

  const onRevoke = async (targetUserId) => {
    try {
      if (!agencyId) return;
      if (!targetUserId) return;

      const ok = window.confirm("Remove this moderator?");
      if (!ok) return;

      setError("");
      const { data, error } = await supabase.rpc("revoke_agency_chat_admin", {
        p_agency_id: agencyId,
        p_target_user_id: targetUserId,
      });

      if (error) throw error;
      if (data?.success !== true) {
        throw new Error(data?.error || "Failed to remove moderator");
      }

      await refreshAdmins();
    } catch (e) {
      setError(e?.message || "Failed to remove moderator");
    }
  };

  if (loading) {
    return (
      <div className={embedded ? "" : "bg-white rounded-2xl shadow-lg p-6"}>
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading agency dashboard...
        </div>
      </div>
    );
  }

  if (!isAgent) return null;

  return (
    <div className={embedded ? "" : "bg-white rounded-2xl shadow-lg p-6"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Agency Dashboard</h2>
          <p className="text-sm text-gray-600 mt-1">
            Agency: <span className="font-semibold">{agencyName || "—"}</span>
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => navigate("/agency/chat")}
          className="flex items-center gap-2"
        >
          <MessageCircle className="w-4 h-4" />
          Open Agency Chat
        </Button>
      </div>

      {error ? <div className="mt-3 text-sm text-red-600 whitespace-pre-line">{error}</div> : null}

      <div className="mt-5 border rounded-xl bg-white overflow-hidden">
        <div className="p-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-gray-900">
            <Users className="w-4 h-4" />
            Chat Moderators
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={refreshAdmins}
            disabled={adminsLoading}
            className="flex items-center gap-2"
          >
            {adminsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Refresh
          </Button>
        </div>

        <div className="p-4">
          {!agencyId ? (
            <div className="text-sm text-gray-600">No agency found for this agent.</div>
          ) : (
            <>
              <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
                <Input
                  value={addProfileId}
                  onChange={(e) => setAddProfileId(e.target.value)}
                  placeholder="Target Profile ID (e.g. 200150)"
                  className="md:max-w-xs"
                />

                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                  className="border rounded-md px-3 py-2 text-sm bg-white"
                >
                  <option value="mod">mod</option>
                  <option value="admin">admin</option>
                </select>

                <Button onClick={onAdd} disabled={adding} className="flex items-center gap-2">
                  {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  Add
                </Button>
              </div>

              <div className="mt-4">
                {adminsLoading ? (
                  <div className="text-sm text-gray-600 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading moderators...
                  </div>
                ) : admins.length === 0 ? (
                  <div className="text-sm text-gray-500">No moderators yet.</div>
                ) : (
                  <div className="space-y-2">
                    {admins.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-3 border rounded-xl p-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={a.avatar_url || "/placeholder-avatar.png"}
                            alt={a.name || "User"}
                            className="w-10 h-10 rounded-full object-cover bg-gray-100 border"
                          />
                          <div className="min-w-0">
                            <div className="font-semibold text-gray-900 truncate">
                              {a.name || "—"}
                              <span className="ml-2 text-xs font-medium text-gray-500">({a.role})</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              Profile ID: <span className="font-mono">{a.profile_id}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span
                            className={`text-xs px-2 py-1 rounded-full border ${
                              a.is_active
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-gray-50 text-gray-600 border-gray-200"
                            }`}
                          >
                            {a.is_active ? "Active" : "Revoked"}
                          </span>

                          {a.is_active ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onRevoke(a.user_id)}
                              className="flex items-center gap-2"
                            >
                              <Trash2 className="w-4 h-4" />
                              Remove
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}