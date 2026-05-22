type JobName = "matchScheduler" | "scoreUpdater";

type JobStatus = {
  ok: boolean;
  lastSuccessAt?: string;
  lastFailureAt?: string;
  lastError?: string;
  runs: number;
  failures: number;
};

const startedAt = new Date().toISOString();
const jobs: Record<JobName, JobStatus> = {
  matchScheduler: { ok: true, runs: 0, failures: 0 },
  scoreUpdater: { ok: true, runs: 0, failures: 0 }
};

export function recordJobSuccess(job: JobName) {
  jobs[job] = {
    ...jobs[job],
    ok: true,
    lastSuccessAt: new Date().toISOString(),
    runs: jobs[job].runs + 1,
    lastError: undefined
  };
}

export function recordJobFailure(job: JobName, error: unknown) {
  jobs[job] = {
    ...jobs[job],
    ok: false,
    lastFailureAt: new Date().toISOString(),
    runs: jobs[job].runs + 1,
    failures: jobs[job].failures + 1,
    lastError: errorMessage(error)
  };
}

export function getSystemStatus() {
  return {
    ok: Object.values(jobs).every((job) => job.ok),
    startedAt,
    uptimeSeconds: Math.floor(process.uptime()),
    jobs
  };
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}
