/**
 * Firebase Reporter for Playwright
 * 
 * Sends test results to Firebase for Test Plan app integration.
 * Also outputs JSON file for offline import.
 * 
 * Usage in playwright.config.ts:
 *   reporter: [['./firebase-reporter.ts', { outputFile: 'results.json' }]]
 */

import type { Reporter, TestCase, TestResult, FullResult, Suite } from '@playwright/test/reporter';
import * as fs from 'fs';

interface TestResultData {
  id: string;
  title: string;
  status: 'passed' | 'failed' | 'skipped' | 'timedOut';
  duration: number;
  error?: string;
  file: string;
  timestamp: number;
}

interface ReportData {
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    timestamp: string;
    runner: string;
  };
  results: TestResultData[];
}

class FirebaseReporter implements Reporter {
  private results: TestResultData[] = [];
  private outputFile: string;
  private startTime: number = 0;

  constructor(options: { outputFile?: string } = {}) {
    this.outputFile = options.outputFile || 'playwright-results.json';
  }

  onBegin() {
    this.startTime = Date.now();
    this.results = [];
  }

  onTestEnd(test: TestCase, result: TestResult) {
    // Extract test ID from name (e.g., "SH1: Referral link...")
    const match = test.title.match(/^([A-Z]+\d+):/);
    const testId = match ? match[1] : test.title;
    
    const testData: TestResultData = {
      id: testId,
      title: test.title,
      status: result.status,
      duration: result.duration,
      error: result.error?.message,
      file: test.location.file.split('/').pop() || '',
      timestamp: Date.now()
    };

    this.results.push(testData);
    
    // Log to console
    const icon = result.status === 'passed' ? '✅' : 
                 result.status === 'failed' ? '❌' : 
                 result.status === 'skipped' ? '⏭️' : '⏱️';
    console.log(`${icon} ${testId}: ${result.status} (${result.duration}ms)`);
  }

  async onEnd(result: FullResult) {
    const report: ReportData = {
      summary: {
        total: this.results.length,
        passed: this.results.filter(r => r.status === 'passed').length,
        failed: this.results.filter(r => r.status === 'failed').length,
        skipped: this.results.filter(r => r.status === 'skipped').length,
        duration: Date.now() - this.startTime,
        timestamp: new Date().toISOString(),
        runner: 'playwright'
      },
      results: this.results
    };

    // Write JSON file
    fs.writeFileSync(this.outputFile, JSON.stringify(report, null, 2));
    console.log(`\n📊 Results saved to ${this.outputFile}`);
    console.log(`   Total: ${report.summary.total} | ✅ ${report.summary.passed} | ❌ ${report.summary.failed} | ⏭️ ${report.summary.skipped}`);

    // TODO: Optional Firebase upload
    // await this.uploadToFirebase(report);
  }

  // Future: Upload to Firebase
  // private async uploadToFirebase(report: ReportData) {
  //   const firebaseConfig = { ... };
  //   const app = initializeApp(firebaseConfig);
  //   const db = getDatabase(app);
  //   await set(ref(db, `playwright-runs/${Date.now()}`), report);
  // }
}

export default FirebaseReporter;
