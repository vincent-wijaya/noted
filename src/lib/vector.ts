export function toVectorLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

export function isValidEmbedding(
  value: unknown,
  dimensions = 384,
): value is number[] {
  return (
    Array.isArray(value) &&
    value.length === dimensions &&
    value.every((n) => typeof n === "number" && Number.isFinite(n))
  );
}
