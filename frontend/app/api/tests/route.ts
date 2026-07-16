import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const [tests, total] = await Promise.all([
      prisma.test.findMany({
        where,
        include: {
          runs: {
            orderBy: { startedAt: "desc" },
            take: 1,
          },
          _count: { select: { runs: true } },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.test.count({ where }),
    ]);

    return NextResponse.json({ tests, total, limit, offset });
  } catch (error) {
    console.error("Failed to fetch tests:", error);
    return NextResponse.json({ error: "Failed to fetch tests" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, scriptType, targetUrl, virtualUsers, projectId } = body;

    if (!name || !scriptType || !targetUrl || !virtualUsers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Use default project if not specified
    let actualProjectId = projectId;
    if (!actualProjectId) {
      const defaultProject = await prisma.project.findFirst();
      if (!defaultProject) {
        // Create a default project
        const newProject = await prisma.project.create({
          data: { name: "Default Project", description: "Auto-created project" },
        });
        actualProjectId = newProject.id;
      } else {
        actualProjectId = defaultProject.id;
      }
    }

    const test = await prisma.test.create({
      data: {
        name,
        description,
        scriptType,
        targetUrl,
        virtualUsers: parseInt(virtualUsers),
        projectId: actualProjectId,
      },
    });

    return NextResponse.json(test, { status: 201 });
  } catch (error) {
    console.error("Failed to create test:", error);
    return NextResponse.json({ error: "Failed to create test" }, { status: 500 });
  }
}
