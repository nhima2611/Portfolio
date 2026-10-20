import { useEffect, useState } from 'react';

const format = (timeZone: string) => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone });

/** Current HH:MM in `timeZone`, refreshed on the minute. */
export function useClock(timeZone: string): string {
  const [time, setTime] = useState(() => format(timeZone));
  useEffect(() => {
    let id = 0;
    const tick = () => {
      setTime(format(timeZone));
      id = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    tick();
    return () => window.clearTimeout(id);
  }, [timeZone]);
  return time;
}
