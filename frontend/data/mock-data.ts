import type {
  InfrastructureStatus,
  Run,
  ScriptType,
  SeedData,
  Test,
  TestStatus,
  TrendPoint,
} from "@/types";

const minutesAgo = (minutes: number, now: number) =>
  new Date(now - minutes * 60_000).toISOString();

const testDefinitions: Array<{
  name: string;
  description: string;
  scriptType: ScriptType;
  targetUrl: string;
  virtualUsers: number;
  status: TestStatus;
  lastRunMinutesAgo: number | null;
}> = [
  {
    name: "Login Flow Load Test",
    description: "Measures authentication performance under sustained load.",
    scriptType: "HTTP",
    targetUrl: "https://api.example.com/v1/login",
    virtualUsers: 500,
    status: "running",
    lastRunMinutesAgo: 220,
  },
  {
    name: "Checkout Performance",
    description: "Validates cart and checkout transaction response times.",
    scriptType: "TruClient",
    targetUrl: "https://shop.example.com/checkout",
    virtualUsers: 250,
    status: "running",
    lastRunMinutesAgo: 410,
  },
  {
    name: "Search API Stress Test",
    description: "Stresses product search and filtering endpoints.",
    scriptType: "JMeter",
    targetUrl: "https://api.example.com/v1/search",
    virtualUsers: 1500,
    status: "running",
    lastRunMinutesAgo: 690,
  },
  {
    name: "Catalog Browse Load Test",
    description: "Exercises the product catalogue browse path.",
    scriptType: "HTTP",
    targetUrl: "https://shop.example.com/catalog",
    virtualUsers: 800,
    status: "running",
    lastRunMinutesAgo: 940,
  },
  {
    name: "Account Profile Concurrency",
    description: "Tests account profile updates at peak concurrency.",
    scriptType: "TruClient",
    targetUrl: "https://app.example.com/profile",
    virtualUsers: 100,
    status: "running",
    lastRunMinutesAgo: 1280,
  },
  {
    name: "API Health Check - Prod",
    description: "Regular production API health verification.",
    scriptType: "HTTP",
    targetUrl: "https://api.example.com/v1/health",
    virtualUsers: 50,
    status: "completed",
    lastRunMinutesAgo: 75,
  },
  {
    name: "Payment Gateway Baseline",
    description: "Captures baseline payment gateway throughput.",
    scriptType: "JMeter",
    targetUrl: "https://payments.example.com/charge",
    virtualUsers: 300,
    status: "completed",
    lastRunMinutesAgo: 1800,
  },
  {
    name: "Mobile Home Page Baseline",
    description: "Establishes a mobile home-page performance baseline.",
    scriptType: "HTTP",
    targetUrl: "https://m.example.com/home",
    virtualUsers: 150,
    status: "idle",
    lastRunMinutesAgo: null,
  },
  {
    name: "Inventory Sync Validation",
    description: "Validates inventory synchronization capacity.",
    scriptType: "JMeter",
    targetUrl: "https://api.example.com/v1/inventory/sync",
    virtualUsers: 700,
    status: "idle",
    lastRunMinutesAgo: 3300,
  },
];

function createTests(now: number): Test[] {
  return testDefinitions.map((test, index) => ({
    id: `seed-test-${index + 1}`,
    name: test.name,
    description: test.description,
    scriptType: test.scriptType,
    targetUrl: test.targetUrl,
    virtualUsers: test.virtualUsers,
    status: test.status,
    createdAt: minutesAgo(10_080 + index * 360, now),
    lastRunAt:
      test.lastRunMinutesAgo === null ? null : minutesAgo(test.lastRunMinutesAgo, now),
  }));
}

function createRuns(tests: Test[], now: number): Run[] {
  return Array.from({ length: 24 }, (_, index) => {
    const test = tests[(index + 5) % tests.length];
    const duration = 30 + ((index * 97) % 1_770);
    const completedAt = minutesAgo(index * 410 + 30, now);
    const startedAt = new Date(
      new Date(completedAt).getTime() - duration * 1_000,
    ).toISOString();

    return {
      id: `seed-run-${index + 1}`,
      testId: test.id,
      testName: test.name,
      status: index % 11 === 0 ? "failed" : index % 7 === 0 ? "stopped" : "completed",
      startedAt,
      completedAt,
      duration,
      throughput: 10 + ((index * 37) % 491),
      avgResponseTime: 80 + ((index * 53) % 721),
      errorRate: Number((((index * 7) % 51) / 10).toFixed(1)),
    };
  });
}

function createTrendData(now: number): TrendPoint[] {
  return Array.from({ length: 20 }, (_, index) => ({
    timestamp: minutesAgo((19 - index) * 6, now),
    responseTime: 310 + ((index * 41) % 160),
    throughput: 650 + ((index * 67) % 230),
  }));
}

function createInfrastructure(now: number): InfrastructureStatus[] {
  return [
    { component: "Controller", status: "healthy", lastChecked: minutesAgo(1, now) },
    {
      component: "Load Generator",
      status: "degraded",
      lastChecked: minutesAgo(2, now),
    },
    { component: "Database", status: "healthy", lastChecked: minutesAgo(1, now) },
  ];
}

export function createMockData(now = Date.now()): SeedData {
  const tests = createTests(now);
  return {
    tests,
    runs: createRuns(tests, now),
    trendData: createTrendData(now),
    infrastructure: createInfrastructure(now),
  };
}
