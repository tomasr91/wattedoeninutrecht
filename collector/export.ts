import type { Activity } from '../src/domain/types.ts';
import { dedupe } from '../src/domain/dedupe.ts';
import { activityEndDate } from '../src/domain/filters.ts';

/** Wat de app krijgt: actuele en toekomstige activiteiten, ontdubbeld, zonder interne administratie. */
export function buildExport(all: (Activity & { contentHash?: string; missingCount?: number })[], today: string): { activities: Activity[]; merged: number } {
  const current = all
    .filter((a) => a.status !== 'verlopen' && activityEndDate(a) >= today && !a.isTestData)
    .map(({ contentHash: _h, missingCount: _m, ...a }) => a as Activity)
    .sort((x, y) => (x.start < y.start ? -1 : x.start > y.start ? 1 : x.title.localeCompare(y.title)));
  return dedupe(current);
}

