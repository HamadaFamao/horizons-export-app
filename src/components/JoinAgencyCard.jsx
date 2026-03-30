import React from 'react';

/**
 * JoinAgencyCard (LEGACY - DISABLED)
 * ---------------------------------
 * This component used to allow joining via referral code (old flow).
 * We intentionally disable it now to enforce the new "Request to Join" flow.
 *
 * IMPORTANT:
 * - Do NOT call join_agency RPC anymore.
 * - Keep the component exported because ProfilePage may still render it.
 * - Returning null removes the legacy UI completely.
 */
export function JoinAgencyCard() {
  return null;
}