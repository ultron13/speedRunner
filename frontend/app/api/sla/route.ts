import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;

    const thresholds = await prisma.sLAThreshold.findMany({
      where,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(thresholds);
  } catch (error) {
    console.error("Failed to fetch SLA thresholds:", error);
    return NextResponse.json({ error: "Failed to fetch SLA thresholds" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, metric, condition, value, projectId } = body;

    if (!name || !metric || !condition || value === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Use default project if not specified
    let actualProjectId = projectId;
    if (!actualProjectId) {
      const defaultProject = await prisma.project.findFirst();
      actualProjectId = defaultProject?.id;
    }

    const threshold = await prisma.sLAThreshold.create({
      data: {
        name,
        metric,
        condition,
        value: parseFloat(value),
        projectId: actualProjectId,
      },
    });

    return NextResponse.json(threshold, { status: 201 });
  } catch (error) {
    console.error("Failed to create SLA threshold:", error);
    return NextResponse.json({ error: "Failed to create SLA threshold" }, { status: 500 });
  }
}
