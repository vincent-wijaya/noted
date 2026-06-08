import { NextResponse } from "next/server";

import { prisma } from "@/src/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;

  const note = await prisma.note.findUnique({ where: { id } });

  if (!note) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 });
  }

  await prisma.$transaction([
    prisma.note.update({ where: { id }, data: { deletedAt: new Date() } }),
  ]);

  return NextResponse.json({ success: true });
}
