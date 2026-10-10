// Temporary kill switch for scheduled rank checks while they are unreliable.
// While true the cron starts no scheduled runs and no config can switch onto a
// schedule. Existing configs keep their stored schedule, so flipping this back
// resumes them (overdue ones drain through the scheduler's per-tick budget).
// Manual checks are unaffected.
export const SCHEDULED_RANK_CHECKS_PAUSED = true;
