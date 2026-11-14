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
  declareSold: () => Promise<{ success: boolean; error?: string }>;
  declareUnsold: () => Promise<{ success: boolean; error?: string }>;
  reintroducePlayer: (playerId: string) => Promise<{ success: boolean; error?: string }>;
  controlAuction: (action: 'pause' | 'resume' | 'reset_timer' | 'set_timer_duration', payload?: any) => Promise<{ success: boolean; error?: string }>;
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
  declareSold: async () => ({ success: false }),
  declareUnsold: async () => ({ success: false }),
  reintroducePlayer: async () => ({ success: false }),
  controlAuction: async () => ({ success: false }),
});

export function AuctionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuctionStatePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastBidId, setLastBidId] = useState<string | null>(null);
  const prevSoldStatusRef = useRef<string>('not_started');

  const refreshState = useCallback(async () => {
    try {
      const res = await fetch('/api/auction/state');
      if (res.ok) {
        const data: AuctionStatePayload = await res.json();
        setState(data);

        // Check if recently sold to trigger celebration
        if (data.event?.status === 'sold' && prevSoldStatusRef.current !== 'sold') {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'],
          });
        }
        prevSoldStatusRef.current = data.event?.status || 'not_started';

        if (data.recentBids && data.recentBids.length > 0) {
          setLastBidId(data.recentBids[0].id);
        }
        setError(null);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and SSE stream setup
  useEffect(() => {
    refreshState();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/auction/stream');
      eventSource.onmessage = (event) => {
        try {
          const newState: AuctionStatePayload = JSON.parse(event.data);
          setState(newState);

          if (newState.event?.status === 'sold' && prevSoldStatusRef.current !== 'sold') {
            confetti({
              particleCount: 150,
              spread: 90,
              origin: { y: 0.6 },
              colors: ['#f59e0b', '#3b82f6', '#10b981', '#ef4444', '#8b5cf6'],
            });
          }
          prevSoldStatusRef.current = newState.event?.status || 'not_started';

          if (newState.recentBids && newState.recentBids.length > 0) {
            setLastBidId(newState.recentBids[0].id);
          }
        } catch {
          // parse error
        }
      };

      eventSource.onerror = () => {
        // SSE disconnected or errored, fallback polling remains active
      };
    } catch {
      // SSE not supported
    }

    // Polling fallback to guarantee 100% sync
    const pollInterval = setInterval(() => {
      refreshState();
    }, 2500);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(pollInterval);
    };
  }, [refreshState]);

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
      setState(data);
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
      setState(data);
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
      setState(data);
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
      setState(data);
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
      setState(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const controlAuction = async (action: 'pause' | 'resume' | 'reset_timer' | 'set_timer_duration', payload?: any) => {
    try {
      const res = await fetch('/api/auction/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, payload }),
      });
      const data = await res.json();
      if (!res.ok) return { success: false, error: data.error };
      setState(data);
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
        declareSold,
        declareUnsold,
        reintroducePlayer,
        controlAuction,
      }}
    >
      {children}
    </AuctionContext.Provider>
  );
}

export const useAuction = () => useContext(AuctionContext);
