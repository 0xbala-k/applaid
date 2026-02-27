import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "").trim();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    const title = body.title ? String(body.title).trim() : undefined;
    const location = body.location ? String(body.location).trim() : undefined;
    const minSalary =
      typeof body.minSalary === "number"
        ? body.minSalary
        : body.minSalary
        ? Number(body.minSalary)
        : undefined;
    const keywords = body.keywords ? String(body.keywords).trim() : undefined;

    const preference = await prisma.preference.upsert({
      where: { email },
      update: {
        title,
        location,
        minSalary,
        keywords
      },
      create: {
        email,
        title,
        location,
        minSalary,
        keywords
      }
    });

    return NextResponse.json({ preference });
  } catch (error) {
    console.error("Error saving preferences", error);
    return NextResponse.json(
      { error: "Failed to save preferences." },
      { status: 500 }
    );
  }
}

