import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/prisma";
import { isValidEmbedding, toVectorLiteral } from "@/src/lib/vector";

export const runtime = "nodejs";

export async function GET() {
  const notes = await prisma.note.findMany({
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(notes);
}

export async function POST(request: Request) {
  const body = await request.json();
  const title = typeof body.title === "string" ? body.title : "";
  const content = typeof body.content === "string" ? body.content : "";

  if (!content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const note = await prisma.note.create({
    data: { title, content },
  });

  if (isValidEmbedding(body.embedding)) {
    const embedding = toVectorLiteral(body.embedding);

    await prisma.$executeRaw`
      UPDATE notes
      SET embedding = ${embedding}::vector
      WHERE id = ${note.id}
    `;
  }

  return NextResponse.json(note, { status: 201 });
}
