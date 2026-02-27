import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";

    if (!id) {
      return NextResponse.json({ error: "Task id is required." }, { status: 400 });
    }

    const client = prisma as any;

    const existing = await client.applyTask.findUnique({
      where: { id }
    });

    if (!existing) {
      return NextResponse.json({ error: "Apply task not found." }, { status: 404 });
    }

    const updated = await client.applyTask.update({
      where: { id },
      data: {
        status: "QUEUED",
        lastError: null,
        runAt: null
      },
      select: {
        id: true,
        status: true,
        lastError: true,
        updatedAt: true
      }
    });

    return NextResponse.json({ task: updated });
  } catch (error) {
    console.error("Error retrying apply task", error);
    return NextResponse.json(
      { error: "Failed to retry apply task." },
      { status: 500 }
    );
  }
}

