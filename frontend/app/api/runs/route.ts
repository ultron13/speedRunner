import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const testId = searchParams.get("testId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (testId) where.testId = testId;
    if (status) where.status = status;

    const [runs, total] = await Promise.all([
      prisma.run.findMany({
        where,
        include: {
          test: { select: { name: true, targetUrl: true } },
          _count: { select: { metrics: true } },
        },
        orderBy: { startedAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.run.count({ where }),
    ]);

    return NextResponse.json({ runs, total, limit, offset });
  } catch (error) {
    console.error("Failed to fetch runs:", error);
    return NextResponse.json({ error: "Failed to fetch runs" }, { status: 500 });
  }
}
