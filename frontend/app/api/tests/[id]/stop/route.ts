import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const test = await prisma.test.findUnique({ where: { id } });
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }
    if (test.status !== "RUNNING") {
      return NextResponse.json({ error: "Test is not running" }, { status: 409 });
    }

    // Find the active run and mark it as stopped
    const activeRun = await prisma.run.findFirst({
      where: { testId: id, status: "RUNNING" },
      orderBy: { startedAt: "desc" },
    });

    if (activeRun) {
      const duration = (Date.now() - activeRun.startedAt.getTime()) / 1000;
      await prisma.run.update({
        where: { id: activeRun.id },
        data: {
          status: "STOPPED",
          completedAt: new Date(),
          duration,
        },
      });
    }

    await prisma.test.update({
      where: { id },
      data: { status: "STOPPED" },
    });

    return NextResponse.json({ success: true, run: activeRun });
  } catch (error) {
    console.error("Failed to stop test:", error);
    return NextResponse.json({ error: "Failed to stop test" }, { status: 500 });
  }
}
