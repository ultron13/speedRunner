import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { loadGeneratorManager } from "@/lib/load-generator-manager";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check test exists and isn't already running
    const test = await prisma.test.findUnique({ where: { id } });
    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }
    if (test.status === "RUNNING") {
      return NextResponse.json({ error: "Test is already running" }, { status: 409 });
    }

    // Create a new run
    const run = await prisma.run.create({
      data: {
        testId: id,
        status: "RUNNING",
        triggerType: "MANUAL",
      },
    });

    // Update test status
    await prisma.test.update({
      where: { id },
      data: { status: "RUNNING", lastRunAt: new Date() },
    });

    // Start real load generation
    const body = await request.json().catch(() => ({}));
    const duration = body.duration || 60;
    const rampUpDuration = body.rampUpDuration || 10;
    const thinkTime = body.thinkTime || 100;
    const method = body.method || "GET";

    // Start load generator in background
    loadGeneratorManager
      .startTest(
        run.id,
        id,
        {
          targetUrl: test.targetUrl,
          virtualUsers: test.virtualUsers,
          duration,
          rampUpDuration,
          thinkTime,
          method,
          headers: body.headers,
          body: body.body,
        },
        // On metrics callback
        (metrics) => {
          console.log(`Test ${id} metrics:`, metrics);
        },
        // On complete callback
        (result) => {
          console.log(`Test ${id} completed:`, result);
        }
      )
      .catch((error) => {
        console.error("Failed to start load generator:", error);
      });

    return NextResponse.json(run, { status: 201 });
  } catch (error) {
    console.error("Failed to start test:", error);
    return NextResponse.json({ error: "Failed to start test" }, { status: 500 });
  }
}
