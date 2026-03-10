type Primitive = string | number | boolean | null;

export function serializeValue(value: unknown): Primitive | Primitive[] | object {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeValue(item)) as Primitive[];
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeValue(item)]),
    );
  }

  return (value as Primitive) ?? null;
}

export function serializeRows<T extends object>(rows: T[]) {
  return rows.map((row) => serializeValue(row)) as T[];
}
