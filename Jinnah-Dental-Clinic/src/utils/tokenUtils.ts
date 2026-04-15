import { QueueItem } from '@/types';
import { parseAnyDate } from './dateUtils';

/**
 * Robustly calculates the next available token number for today's queue.
 * Ensures the token is always a number and sequential for the current day.
 */
export const getNextToken = (queue: QueueItem[]): number => {
  if (!queue || !Array.isArray(queue)) return 1;

  const todayStr = new Date().toDateString();

  const todayTokens = queue
    .filter(item => {
      // Handle missing checkInTime
      if (!item.checkInTime) return false;
      
      try {
        const d = parseAnyDate(item.checkInTime);
        return d && d.toDateString() === todayStr;
      } catch (e) {
        return false;
      }
    })
    .map(item => {
      const token = Number(item.tokenNumber);
      return isNaN(token) ? 0 : token;
    })
    .filter(token => token > 0);

  return todayTokens.length > 0 ? Math.max(...todayTokens) + 1 : 1;
};
