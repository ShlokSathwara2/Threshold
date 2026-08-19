import { registerPlugin } from '@capacitor/core';
import type { OverallStats, SubjectAttendance } from '@/lib/attendance-calculator';

interface WidgetSyncApi {
  update(options: { data: string }): Promise<{ updated: boolean }>;
}

export const WidgetSync = registerPlugin<WidgetSyncApi>('WidgetSync');

export interface WidgetData {
  loggedIn: boolean;
  pct: number;
  classes: number;
  below75: number;
}

export async function syncWidget(
  overall: OverallStats | null,
  subjects: SubjectAttendance[],
  todayClasses: { courseCode?: string; courseTitle?: string }[] | null,
  loggedIn: boolean,
): Promise<void> {
  const data: WidgetData = {
    loggedIn,
    pct: overall ? Math.round(overall.overallPercentage * 10) / 10 : -1,
    classes: todayClasses?.length ?? 0,
    below75: subjects.filter((s) => s.percentage < 75).length,
  };
  try {
    await WidgetSync.update({ data: JSON.stringify(data) });
  } catch {
    // not in native shell — ignore
  }
}