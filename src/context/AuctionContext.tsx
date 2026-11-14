'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AuctionStatePayload } from '@/lib/auction-service';
import confetti from 'canvas-confetti';

interface AuctionContextType {
  state: AuctionStatePayload | null;
  isLoading: boolean;
  error: string | null;
  lastBidId: string | null;
  refreshState: () => Promise<void>;
  placeBid: (teamId: string, amount: number) => Promise<{ success: boolean; error?: string }>;
  startDraw: (category: string) => Promise<any>;
  confirmDraw: () => Promise<{ success: boolean; error?: string }>;
  startBidding: () => Promise<{ success: boolean; error?: string }>;
  declareSold: () => Promise<{ success: boolean; error?: string }>;
  declareUnsold: () => Promise<{ success: boolean; error?: string }>;
  nextRandomDraw: () => Promise<{ success: boolean; error?: string }>;
  reintroducePlayer: (playerId: string) => Promise<{ success: boolean; error?: string }>;
  controlAuction: (action: 'pause' | 'resume' | 'reset_timer' | 'set_timer_duration' | 'start_bidding' | 'next_random_draw', payload?: any) => Promise<{ success: boolean; error?: string }>;
}

const AuctionContext = createContext<AuctionContextType>({
  state: null,
  isLoading: true,
  error: null,
  lastBidId: null,
  refreshState: async () => {},
  placeBid: async () => ({ success: false }),
  startDraw: async () => ({}),
  confirmDraw: async () => ({ success: false }),
  startBidding: async () => ({ success: false }),
  declareSold: async () => ({ success: false }),
  declareUnsold: async () => ({ success: false }),
  nextRandomDraw: async () => ({ success: false }),
  reintroducePlayer: async () => ({ success: false }),
  controlAuction: async () => ({ success: false }),
});

export function AuctionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuctionStatePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastBidId, setLastBidId] = useState<string | null>(null);
  const prevSoldStatusRef = useRef<string>('NOT_STARTED');
  const lastStateDigestRef = useRef<string>('');

  const applyStateIfChanged = useCallback((newState: AuctionStatePayload) => {
    if (!newState || !newState.event) return;

    // Fast state digest to prevent duplicate React re-renders and screen flickering
    const digest = `${newState.event.id}_${newState.event.status}_${newState.event.current_player_id}_${newState.event.current_bid}_${newState.event.current_bid_team_id}_${newState.event.bid_timer}_${newState.event.updated_at}_${newState.recentBids?.[0]?.id}_${newState.soldCount}_${newState.unsoldCount}`;
    if (digest === lastStateDigestRef.current) {
      return; // No state change - prevent unneeded re-rendering
    }
    lastStateDigestRef.current = digest;

    setState(newState);

    const isSoldNow = newState.event.status === 'RESULT_COMPLETED' && newState.latestResult?.status === 'sold';
    const wasSoldBefore = prevSoldStatusRef.current === 'RESULT_COMPLETED';

    if (isSoldNow && !wasSoldBefore) {
      try {
        confetti({
          particleCount: 130,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'],
        });
      } catch {}
    }
    prevSoldStatusRef.current = newState.event.status;

    if (newState.recentBids && newState.recentBids.length > 0) {
      setLastBidId(newState.recentBids[0].id);
    }
  }, []);

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch('/api/auction/state');
      if (res.ok) {
        const data: AuctionStatePayload = await res.json();
        applyStateIfChanged(data);
        setError(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [applyStateIfChanged]);

  // Real-time synchronization with SSE and fallback
  useEffect(() => {
    let isUnmounted = false;
    let eventSource: EventSource | null = null;
    let pollInterval: NodeJS.Timeout | null = null;
    let isSseConnected = false;

    // Initial state fetch
    refreshState();

    const startPollingFallback = () => {
      if (pollInterval || isUnmounted) return;
      pollInterval = setInterval(() => {
        if (!isSseConnected && !isUnmounted) {
          refreshState();
        }
      }, 3000);
    };

    try {
      eventSource = new EventSource('/api/auction/stream');

      eventSource.onopen = () => {
        isSseConnected = true;
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };

      eventSource.onmessage = (event) => {
        if (isUnmounted) return;
        isSseConnected = true;
        try {
          const newState: AuctionStatePayload = JSON.parse(event.data);
          applyStateIfChanged(newState);
        } catch {
          // ignore parse error
        }
      };

      eventSource.onerror = () => {
        isSseConnected = false;
        startPollingFallback();
      };
    } catch {
      startPollingFallback();
    }

    return () => {
      isUnmounted = true;
      if (eventSource) {
        eventSource.close();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [refreshState, applyStateIfChanged]);

  const placeBid = async (teamId: string, amount: number) => {
    try {
      const res = await fetch('/api/auction/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamId, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || 'Bid rejected' };
      }
      applyStateIfChanged(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const startDraw = async (category: string) => {
    const res = await fetch('/api/auction/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Random draw failed');
    }
    await refreshState();
    return data;
  };

  const confirmDraw = async () => {
    try {
      const res = await fetch('/api/auction/confirm-draw', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      applyStateIfChanged(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const startBidding = async () => {
    try {
      const res = await fetch('/api/auction/start-bidding', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      applyStateIfChanged(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const declareSold = async () => {
    try {
      const res = await fetch('/api/auction/sold', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      applyStateIfChanged(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const declareUnsold = async () => {
    try {
      const res = await fetch('/api/auction/unsold', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      applyStateIfChanged(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const nextRandomDraw = async () => {
    try {
      const res = await fetch('/api/auction/next-draw', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      applyStateIfChanged(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const reintroducePlayer = async (playerId: string) => {
    try {
      const res = await fetch('/api/auction/reintroduce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      applyStateIfChanged(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const controlAuction = async (
    action: 'pause' | 'resume' | 'reset_timer' | 'set_timer_duration' | 'start_bidding' | 'next_random_draw',
    payload?: any
  ) => {
    try {
      const res = await fetch('/api/auction/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      applyStateIfChanged(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  return (
    <AuctionContext.Provider
      value={{
        state,
        isLoading,
        error,
        lastBidId,
        refreshState,
        placeBid,
        startDraw,
        confirmDraw,
        startBidding,
        declareSold,
        declareUnsold,
        nextRandomDraw,
        reintroducePlayer,
        controlAuction,
      }}
    >
      {children}
    </AuctionContext.Provider>
  );
}

export const useAuction = () => useContext(AuctionContext);
