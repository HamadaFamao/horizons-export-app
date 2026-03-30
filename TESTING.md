# Agency Member Removal - Test Plan & Checklist

## Overview
This document outlines the testing strategy for the Agency Member Removal feature. It covers unit testing of UI components, integration testing of the removal flow, and security validation of the RPC endpoints.

## Test Environment Requirements
- **Frameworks**: Jest, React Testing Library, Vitest (recommended for Vite)
- **Mocking**: Supabase client mock, Auth context mock, Toast hook mock
- **User Roles**: 
  - Agency Admin (Caller)
  - Agency Member (Target)
  - Non-Agent User (Unauthorized)
  - Unauthenticated User (Unauthorized)

---

## 1. Unit Test Checklist (UI Components)
**File**: `src/tests/agency/removeMember.test.js`

### UI Rendering & State
- [ ] **Test 31**: Dialog opens correctly when "Remove" button is clicked.
- [ ] **Test 32**: Dialog closes correctly when "Cancel" is clicked.
- [ ] **Test 33**: Reason input field accepts text and updates state.
- [ ] **Test 36**: Loading state (spinner) is shown on the button during removal process.
- [ ] **Test 37**: "Confirm" and "Cancel" buttons are disabled during removal.
- [ ] **Test 40**: "Remove" button on member row is disabled if another action is in progress (optional logic).

### Interaction & Feedback
- [ ] **Test 3**: Success toast is shown when RPC returns success.
- [ ] **Test 7**: Dialog closes automatically after successful removal.
- [ ] **Test 17**: UI updates: Member row is removed from the list immediately on success.
- [ ] **Test 18**: UI updates: Member count (if displayed) decreases.
- [ ] **Test 20**: Search filter works correctly on the remaining list after a removal.
- [ ] **Test 27**: Error toast shown for "MEMBER_NOT_FOUND".
- [ ] **Test 29**: Toast messages match the specific error codes (e.g., PENDING_WITHDRAWALS).
- [ ] **Test 34**: Cancel button resets the dialog state (reason cleared).
- [ ] **Test 35**: Confirm button triggers the removal function.

### Accessibility
- [ ] **Test 38**: Dialog supports keyboard navigation (Tab, Escape).
- [ ] **Test 39**: Screen readers can read the warning message in the dialog.
- [ ] **Test 41**: Buttons have proper `aria-label` attributes.
- [ ] **Test 43**: Dialog renders correctly on mobile viewports.

---

## 2. Integration Test Checklist (Logic & RPC Flow)
**File**: `src/tests/integration/removeMemberIntegration.test.js`

### Happy Path
- [ ] **Test 1**: Agent calls `agent_remove_member_from_agency` -> Backend sets `referred_by` to NULL.
- [ ] **Test 2**: Successful removal returns `success: true` and removed member ID.
- [ ] **Test 5**: Audit log entry is created for the removal action.

### Business Logic & Validation
- [ ] **Test 21**: **Pending Withdrawals**: Removal denied if member has 'pending' withdrawal requests.
- [ ] **Test 22**: **Active Cycle**: Removal denied if member is locked in an 'open' withdrawal cycle (if applicable).
- [ ] **Test 24**: **Member Not Found**: Error returned if profile_id does not exist.
- [ ] **Test 25**: **Already Removed**: Error returned if member is not in the agent's agency (double-submit race condition).
- [ ] **Test 26**: **RPC Validation**: Ensure `p_note` is passed correctly to audit logs.

### Security & Permissions (RLS)
- [ ] **Test 6**: **Cross-Agency Protection**: Agent A tries to remove Member B (who belongs to Agent C) -> Denied.
- [ ] **Test 9**: **Self-Removal**: Agent tries to remove themselves -> Denied (CANNOT_REMOVE_SELF).
- [ ] **Test 12**: **Role Check**: Non-agent user calls RPC -> Denied (NOT_AN_AGENT).
- [ ] **Test 15**: **Auth Check**: Unauthenticated user calls RPC -> Denied (NOT_AUTHENTICATED).
- [ ] **Test 23**: **Inactive Agent**: Blocked/Suspended agent tries to remove member -> Denied.

### Error Handling
- [ ] **Test 7**: Error message for cross-agency removal is clear ("Member is not in your agency").
- [ ] **Test 10**: Error message for self-removal is clear.
- [ ] **Test 30**: All backend error codes map to user-friendly frontend messages.

---

## 3. Manual Verification Steps
1. **Login** as an Agency Admin.
2. **Navigate** to Agency Dashboard -> Earnings Panel.
3. **Identify** a member to remove.
4. **Click** "Remove". Verify Dialog opens with Warning.
5. **Type** a reason "Test reason".
6. **Click** "Confirm". Verify Loading spinner.
7. **Verify** Success Toast appears.
8. **Verify** Member disappears from list.
9. **Check Database**:
   - `profiles` table: `referred_by` for that user should be NULL.
   - `member_removal_audit` table: New row with `reason='Test reason'`.
   - `audit_log` table: New row with `action='REMOVE'`.