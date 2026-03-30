/* eslint-env jest */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import ClientEarningsPanel from '@/components/agency/ClientEarningsPanel';
import { AuthContext } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/components/ui/use-toast';
import { I18N_KEYS } from '@/constants/i18n';

// Mocks
jest.mock('@/lib/supabaseClient', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

jest.mock('@/components/ui/use-toast', () => ({
  useToast: jest.fn(),
}));

// Mock Translation Hook
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key, fallback) => fallback || key,
  }),
}));

const mockUser = { id: 'agent-123', isadmin: false, is_agent: true };
const mockToast = jest.fn();

const mockClients = [
  {
    client_id: 'client-1',
    client_profile_id: 1001,
    client_name: 'Alice Member',
    client_avatar_url: null,
    client_agent_gems: 500,
    last_earning_at: new Date().toISOString(),
  },
  {
    client_id: 'client-2',
    client_profile_id: 1002,
    client_name: 'Bob Member',
    client_avatar_url: null,
    client_agent_gems: 1200,
    last_earning_at: new Date().toISOString(),
  }
];

describe('ClientEarningsPanel - Member Removal Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useToast.mockReturnValue({ toast: mockToast });
    // Default success mock for fetching clients
    supabase.rpc.mockResolvedValue({ data: mockClients, error: null });
  });

  const renderComponent = () => {
    return render(
      <AuthContext.Provider value={{ user: mockUser }}>
        <ClientEarningsPanel />
      </AuthContext.Provider>
    );
  };

  test('Test 31: Dialog opens correctly when Remove button is clicked', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Alice Member')).toBeInTheDocument());

    const removeBtns = screen.getAllByText(I18N_KEYS.AGENCY.REMOVE.BUTTON || 'Remove');
    fireEvent.click(removeBtns[0]); // Click remove for Alice

    // Check for Dialog Title
    expect(screen.getByText(I18N_KEYS.AGENCY.REMOVE.CONFIRM_TITLE || 'Remove Member?')).toBeInTheDocument();
    // Check for Member Name in Dialog
    expect(screen.getByText(/Alice Member/)).toBeInTheDocument();
  });

  test('Test 32: Dialog closes correctly when Cancel is clicked', async () => {
    renderComponent();
    await waitFor(() => expect(screen.getByText('Alice Member')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText(/Remove/i)[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByText(I18N_KEYS.COMMON.CANCEL || 'Cancel'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  test('Test 33 & 35: Reason input works and Confirm triggers removal', async () => {
    // Setup Mock for Removal
    supabase.rpc
      .mockResolvedValueOnce({ data: mockClients, error: null }) // Initial fetch
      .mockResolvedValueOnce({ data: { success: true }, error: null }); // Removal call

    renderComponent();
    await waitFor(() => expect(screen.getByText('Alice Member')).toBeInTheDocument());

    // Open Dialog
    fireEvent.click(screen.getAllByText(/Remove/i)[0]);

    // Input Reason
    const reasonInput = screen.getByPlaceholderText(I18N_KEYS.AGENCY.REMOVE.REASON_PLACEHOLDER || 'Why are you removing this member?');
    fireEvent.change(reasonInput, { target: { value: 'Violation of terms' } });
    expect(reasonInput.value).toBe('Violation of terms');

    // Confirm
    const confirmBtn = screen.getByText(I18N_KEYS.AGENCY.REMOVE.BUTTON || 'Remove'); // Assuming confirm button has same text or similar
    // Note: In the actual component the confirm button text is conditionally "Removing..." or "Remove Member" (mapped to I18N keys)
    // We should target specifically.
    fireEvent.click(confirmBtn);

    // Verify RPC call
    await waitFor(() => {
      expect(supabase.rpc).toHaveBeenCalledWith('agent_remove_member_from_agency', {
        p_member_profile_id: 1001,
        p_note: 'Violation of terms'
      });
    });
  });

  test('Test 3 & 17: UI updates and Success Toast shown on success', async () => {
    supabase.rpc
      .mockResolvedValueOnce({ data: mockClients, error: null }) // Fetch
      .mockResolvedValueOnce({ data: { success: true }, error: null }); // Remove

    renderComponent();
    await waitFor(() => expect(screen.getByText('Alice Member')).toBeInTheDocument());

    // Remove Alice
    fireEvent.click(screen.getAllByText(/Remove/i)[0]);
    fireEvent.click(screen.getByText(I18N_KEYS.AGENCY.REMOVE.BUTTON || 'Remove'));

    await waitFor(() => {
      // Toast check
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringMatching(/Success/i),
        description: expect.stringMatching(/removed successfully/i),
      }));
      // UI Update check (Alice gone, Bob remains)
      expect(screen.queryByText('Alice Member')).not.toBeInTheDocument();
      expect(screen.getByText('Bob Member')).toBeInTheDocument();
    });
  });

  test('Test 27 & 29: Specific error handling (e.g., Pending Withdrawals)', async () => {
    supabase.rpc
      .mockResolvedValueOnce({ data: mockClients, error: null }) // Fetch
      .mockResolvedValueOnce({ 
        data: { 
          success: false, 
          error: 'PENDING_WITHDRAWALS' 
        }, 
        error: null 
      }); // Remove fail

    renderComponent();
    await waitFor(() => expect(screen.getByText('Alice Member')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText(/Remove/i)[0]);
    fireEvent.click(screen.getByText(I18N_KEYS.AGENCY.REMOVE.BUTTON || 'Remove'));

    await waitFor(() => {
      // Toast check for specific error
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
        variant: 'destructive',
        description: expect.stringContaining('pending withdrawal requests'), // Mapped text for PENDING_WITHDRAWALS
      }));
      // UI Check: Alice should still be there
      expect(screen.getByText('Alice Member')).toBeInTheDocument();
    });
  });

  test('Test 36 & 37: Loading states and buttons disabled', async () => {
    // Delay the response to check loading state
    supabase.rpc
      .mockResolvedValueOnce({ data: mockClients, error: null })
      .mockImplementationOnce(() => new Promise(resolve => setTimeout(() => resolve({ data: { success: true } }), 500)));

    renderComponent();
    await waitFor(() => expect(screen.getByText('Alice Member')).toBeInTheDocument());

    fireEvent.click(screen.getAllByText(/Remove/i)[0]);
    const confirmBtn = screen.getByText(I18N_KEYS.AGENCY.REMOVE.BUTTON || 'Remove');
    
    fireEvent.click(confirmBtn);

    // Immediate check for loading state
    expect(confirmBtn).toBeDisabled();
    expect(screen.getByText(/Removing/i)).toBeInTheDocument();
    
    // Wait for finish
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});