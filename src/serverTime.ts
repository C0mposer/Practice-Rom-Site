import { useCallback, useEffect, useState } from 'react';

async function readGitHubTimeMs() {
  const response = await fetch('https://api.github.com', { method: 'HEAD', cache: 'no-store' });
  const dateHeader = response.headers.get('date');
  if (!response.ok || !dateHeader) {
    throw new Error('GitHub time unavailable');
  }

  return new Date(dateHeader).getTime();
}

async function readWorldTimeApiMs() {
  const response = await fetch('https://worldtimeapi.org/api/timezone/America/Los_Angeles', {
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error('WorldTimeAPI unavailable');
  }

  const data = (await response.json()) as { datetime?: string };
  if (!data.datetime) {
    throw new Error('WorldTimeAPI response missing datetime');
  }

  return new Date(data.datetime).getTime();
}

export async function fetchTrustedTimeMs() {
  const sources = [readGitHubTimeMs, readWorldTimeApiMs];
  let lastError: unknown;

  for (const source of sources) {
    try {
      return await source();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('Unable to verify current time');
}

export function useServerClock() {
  const [offsetMs, setOffsetMs] = useState(0);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchTrustedTimeMs()
      .then((serverMs) => {
        if (cancelled) return;
        setOffsetMs(serverMs - Date.now());
        setVerified(true);
      })
      .catch(() => {
        if (cancelled) return;
        setVerified(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const getNow = useCallback(() => Date.now() + offsetMs, [offsetMs]);

  return { getNow, verified };
}
