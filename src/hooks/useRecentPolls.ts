'use client';

import { useState, useEffect, useCallback } from 'react';

export interface RecentPoll {
  pollId: string;
  title: string;
  isAdmin: boolean;
  adminToken?: string;
  hasSubmitted?: boolean;
  deadline?: string | null;
  visitedAt: number;
}

const STORAGE_KEY = 'beaver_recent_polls';
const MAX_RECENT_POLLS = 10;

export function useRecentPolls() {
  const [recentPolls, setRecentPolls] = useState<RecentPoll[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const polls = JSON.parse(saved) as RecentPoll[];
        // Sort by most recent first
        polls.sort((a, b) => b.visitedAt - a.visitedAt);
        setRecentPolls(polls);
      }
    } catch (e) {
      console.error('Error loading recent polls:', e);
    }
    setIsLoaded(true);
  }, []);

  // Save a poll to recent history
  const addRecentPoll = useCallback((poll: Omit<RecentPoll, 'visitedAt'>) => {
    if (typeof window === 'undefined') return;

    setRecentPolls((prev) => {
      // Remove existing entry for this poll if exists
      const filtered = prev.filter((p) =>
        !(p.pollId === poll.pollId && p.isAdmin === poll.isAdmin)
      );

      // Add new entry at the beginning
      const newPoll: RecentPoll = {
        ...poll,
        visitedAt: Date.now(),
      };
      const updated = [newPoll, ...filtered].slice(0, MAX_RECENT_POLLS);

      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error('Error saving recent polls:', e);
      }

      return updated;
    });
  }, []);

  // Clear all recent polls
  const clearRecentPolls = useCallback(() => {
    if (typeof window === 'undefined') return;
    setRecentPolls([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.error('Error clearing recent polls:', e);
    }
  }, []);

  return {
    recentPolls,
    isLoaded,
    addRecentPoll,
    clearRecentPolls,
  };
}
