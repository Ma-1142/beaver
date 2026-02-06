'use client';

import { useState, useEffect, useCallback } from 'react';
import { nanoid } from 'nanoid';

const STORAGE_KEY_PREFIX = 'beaver_respondent_';

interface UseRespondentTokenReturn {
  token: string | null;
  isLoading: boolean;
  getOrCreateToken: (pollId: string) => string;
}

export function useRespondentToken(pollId: string): UseRespondentTokenReturn {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = `${STORAGE_KEY_PREFIX}${pollId}`;

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      const storedToken = localStorage.getItem(storageKey);
      if (storedToken) {
        setToken(storedToken);
      }
    } catch (error) {
      console.error('Error reading respondent token from localStorage:', error);
    }
    setIsLoading(false);
  }, [storageKey]);

  const getOrCreateToken = useCallback((pollId: string): string => {
    const key = `${STORAGE_KEY_PREFIX}${pollId}`;

    try {
      const existingToken = localStorage.getItem(key);
      if (existingToken) {
        return existingToken;
      }

      const newToken = nanoid(24);
      localStorage.setItem(key, newToken);
      setToken(newToken);
      return newToken;
    } catch (error) {
      console.error('Error managing respondent token:', error);
      return nanoid(24);
    }
  }, []);

  return {
    token,
    isLoading,
    getOrCreateToken,
  };
}
