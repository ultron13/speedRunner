import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const run = await prisma.run.findUnique({
      where: { id },
      include: {
        test: true,
        metrics: {
          orderBy: { timestamp: "asc" },
        },
        slaResults: {
          include: { threshold: true },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json(run);
  } catch (error) {
    console.error("Failed to fetch run:", error);
    return NextResponse.json({ error: "Failed to fetch run" }, { status: 500 });
  }
}
