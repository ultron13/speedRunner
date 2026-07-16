import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const interval = searchParams.get("interval") || "1"; // seconds

    const metrics = await prisma.runMetric.findMany({
      where: { runId: id },
      orderBy: { timestamp: "asc" },
    });

    // Aggregate metrics by interval
    const aggregated = aggregateMetrics(metrics, parseInt(interval));

    return NextResponse.json(aggregated);
  } catch (error) {
    console.error("Failed to fetch metrics:", error);
    return NextResponse.json({ error: "Failed to fetch metrics" }, { status: 500 });
  }
}

function aggregateMetrics(metrics: Array<{ timestamp: Date; throughput: number; avgResponseTime: number; errorRate: number; activeVUsers: number }>, intervalSeconds: number) {
  if (metrics.length === 0) return [];

  const result: Array<{ timestamp: Date; throughput: number; avgResponseTime: number; errorRate: number; activeVUsers: number }> = [];
  let currentBucket = new Date(metrics[0].timestamp);
  let bucketMetrics: typeof metrics = [];

  for (const metric of metrics) {
    const metricTime = new Date(metric.timestamp);
    const diffSeconds = (metricTime.getTime() - currentBucket.getTime()) / 1000;

    if (diffSeconds >= intervalSeconds) {
      if (bucketMetrics.length > 0) {
        result.push({
          timestamp: currentBucket,
          throughput: bucketMetrics.reduce((sum, m) => sum + m.throughput, 0) / bucketMetrics.length,
          avgResponseTime: bucketMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / bucketMetrics.length,
          errorRate: bucketMetrics.reduce((sum, m) => sum + m.errorRate, 0) / bucketMetrics.length,
          activeVUsers: bucketMetrics[bucketMetrics.length - 1].activeVUsers,
        });
      }
      currentBucket = metricTime;
      bucketMetrics = [];
    }
    bucketMetrics.push(metric);
  }

  // Add the last bucket
  if (bucketMetrics.length > 0) {
    result.push({
      timestamp: currentBucket,
      throughput: bucketMetrics.reduce((sum, m) => sum + m.throughput, 0) / bucketMetrics.length,
      avgResponseTime: bucketMetrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / bucketMetrics.length,
      errorRate: bucketMetrics.reduce((sum, m) => sum + m.errorRate, 0) / bucketMetrics.length,
      activeVUsers: bucketMetrics[bucketMetrics.length - 1].activeVUsers,
    });
  }

  return result;
}
