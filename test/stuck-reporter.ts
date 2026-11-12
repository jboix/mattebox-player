/**
 * Names a test that never ends. Playwright's WebKit on the CI runner now and
 * then locks a test page up: not even the test timeout fires, and the step
 * runs into its own timeout without saying which test held it. This
 * reporter runs in Node, outside the page, so a locked page cannot stop it.
 * When nothing has been reported for `LIMIT_MS`, it prints the tests that
 * started and did not end, the last test that ended in each browser, and
 * fails the run. A page sends its reports in batches, so a page that locks
 * up right after a batch shows as the last test that ended.
 */
import type { Reporter, TestCase } from 'vitest/node';

/** Far past any test's own timeout, so only a locked page reaches it. */
const LIMIT_MS = 60_000;
const CHECK_MS = 5_000;

function named(test: TestCase): string {
  return `${test.project.name} ${test.module.relativeModuleId} > ${test.fullName}`;
}

export default class StuckReporter implements Reporter {
  private readonly running = new Map<string, TestCase>();
  private readonly last = new Map<string, string>();
  private heard = Date.now();
  private timer: ReturnType<typeof setInterval> | null = null;

  onTestRunStart(): void {
    this.heard = Date.now();
    this.timer = setInterval(() => {
      this.check();
    }, CHECK_MS);
    this.timer.unref();
  }

  onTestModuleStart(): void {
    this.heard = Date.now();
  }

  onTestCaseReady(test: TestCase): void {
    this.heard = Date.now();
    this.running.set(test.id, test);
  }

  onTestCaseResult(test: TestCase): void {
    this.heard = Date.now();
    this.running.delete(test.id);
    this.last.set(test.project.name, named(test));
  }

  onTestRunEnd(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  private check(): void {
    const quiet = Date.now() - this.heard;
    if (quiet < LIMIT_MS) return;
    const lines = [`\nNo test reported for ${Math.round(quiet / 1000)} s.`];
    for (const test of this.running.values()) lines.push(`Started, never ended: ${named(test)}`);
    for (const [project, test] of this.last) lines.push(`Last test ended in ${project}: ${test}`);
    process.stderr.write(`${lines.join('\n')}\n`);
    process.exit(1);
  }
}
