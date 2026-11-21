/** Only non-sensitive, user-created reading and worship progress is synced across devices. */
export const SYNCABLE_PROGRESS_KEY = /^(?:quranPage|lastRead|favs|meethaq-quran-marks|meethaq-khatma-v2|meethaq-ward-cursor|kh-days|kh-read|tasbih|meethaq-tasbih-goal|meethaq-tasbih-phrase|meethaq-tasbih-stats|meethaq-adhkar-favorites|pr-\d{4}-\d{2}-\d{2}|adhkar-(?:morning|evening|sleep)-\d{4}-\d{1,2}-\d{1,2})$/u;

export function isSyncableProgressKey(key: string): boolean {
  return SYNCABLE_PROGRESS_KEY.test(key);
}
