"use client";

import { useState } from "react";
import { Target, Plus, Trash2, Play } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBenchmarkStore } from "@/store/benchmark-store";
import { useTestStore } from "@/store/test-store";

export function PerformanceBenchmark() {
  const [isCreating, setIsCreating] = useState(false);
  const configs = useBenchmarkStore((state) => state.configs);
  const results = useBenchmarkStore((state) => state.results);
  const createConfig = useBenchmarkStore((state) => state.createConfig);
  const deleteConfig = useBenchmarkStore((state) => state.deleteConfig);
  const runBenchmark = useBenchmarkStore((state) => state.runBenchmark);
  const tests = useTestStore((state) => state.tests);

  return (
    <section aria-labelledby="benchmark-heading">
      <Card className="gap-0 py-0">
        <CardHeader className="flex flex-row items-center justify-between px-5 py-4">
          <CardTitle id="benchmark-heading" className="text-base flex items-center gap-2">
            <Target className="size-4" />
            Performance Benchmarks
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setIsCreating(!isCreating)}>
            <Plus className="mr-1 size-4" />
            New Benchmark
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          {isCreating && (
            <BenchmarkForm
              tests={tests}
              onSubmit={(config) => {
                createConfig(config);
                setIsCreating(false);
              }}
              onCancel={() => setIsCreating(false)}
            />
          )}

          {configs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center text-slate-500">
              <Target className="size-8 text-slate-300" />
              <p className="font-medium text-slate-700">No benchmarks configured</p>
              <p className="text-sm">Create benchmarks to compare performance.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {configs.map((config) => (
                <div key={config.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{config.name}</p>
                    <p className="text-xs text-slate-500">
                      {config.testIds.length} test(s) · {config.iterations} iterations
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => runBenchmark(config.id)}
                      title="Run benchmark"
                    >
                      <Play className="size-4 text-emerald-600" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => deleteConfig(config.id)}>
                      <Trash2 className="size-4 text-slate-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recent Results */}
          {results.length > 0 && (
            <div className="mt-4 border-t pt-4">
              <h4 className="mb-2 text-sm font-medium">Recent Results</h4>
              <div className="space-y-2">
                {results.slice(0, 3).map((result) => (
                  <div key={result.id} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
                    <p className="text-sm font-medium">{result.testName}</p>
                    <div className="mt-1 flex gap-4 text-xs text-slate-500">
                      <span>Avg Response: {result.metrics.responseTime.avg}ms</span>
                      <span>Throughput: {result.metrics.throughput.avg} req/s</span>
                      <span>Errors: {result.metrics.errorRate.avg}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function BenchmarkForm({
  tests,
  onSubmit,
  onCancel,
}: {
  tests: Array<{ id: string; name: string }>;
  onSubmit: (config: Omit<import("@/types").BenchmarkConfig, "id" | "createdAt">) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [iterations, setIterations] = useState("3");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      description: "",
      testIds: tests.slice(0, 3).map((t) => t.id),
      metrics: ["responseTime", "throughput", "errorRate"],
      iterations: parseInt(iterations) || 3,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 space-y-3 rounded-lg border p-4">
      <div className="grid gap-2">
        <Label htmlFor="bench-name">Benchmark Name</Label>
        <Input id="bench-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Response Time Comparison" />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="iterations">Iterations</Label>
        <Input id="iterations" type="number" value={iterations} onChange={(e) => setIterations(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button type="submit" size="sm">Create</Button>
      </div>
    </form>
  );
}
