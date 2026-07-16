import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;

    const templates = await prisma.testTemplate.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("Failed to fetch templates:", error);
    return NextResponse.json({ error: "Failed to fetch templates" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, description, scriptType, targetUrl, virtualUsers, projectId } = body;

    if (!name || !scriptType || !targetUrl || !virtualUsers) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let actualProjectId = projectId;
    if (!actualProjectId) {
      const defaultProject = await prisma.project.findFirst();
      actualProjectId = defaultProject?.id;
    }

    const template = await prisma.testTemplate.create({
      data: {
        name,
        description,
        scriptType,
        targetUrl,
        virtualUsers: parseInt(virtualUsers),
        projectId: actualProjectId,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("Failed to create template:", error);
    return NextResponse.json({ error: "Failed to create template" }, { status: 500 });
  }
}
