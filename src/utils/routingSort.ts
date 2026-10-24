export type RoutingSortDirection = "asc" | "desc";

function getDescendingSortFieldSet(descendingSortFields: string | string[] = "") {
  let fields: unknown = descendingSortFields;
  if (typeof fields === "string") {
    const value = fields.trim();
    if (!value) return new Set<string>();

    try {
      const parsed = JSON.parse(value);
      fields = Array.isArray(parsed) ? parsed : value.split(",");
    } catch {
      fields = value.split(",");
    }
  }

  return new Set(
    (Array.isArray(fields) ? fields : [])
      .filter((field): field is string => typeof field === "string")
      .map((field) => field.trim().replace(/\s+desc$/i, ""))
      .filter(Boolean)
  );
}

export function getRoutingSortDirection(condition: any, descendingSortFields: string | string[] = ""): RoutingSortDirection {
  if (condition?.sortDirection === "asc" || condition?.sortDirection === "desc") return condition.sortDirection;
  const fieldName = String(condition?.fieldName || "");
  return /\s+desc$/i.test(fieldName) || getDescendingSortFieldSet(descendingSortFields).has(fieldName) ? "desc" : "asc";
}

// Server field names encode direction. Keep map keys clean without losing that information.
export function normalizeRoutingSort(condition: any) {
  if (condition.conditionTypeEnumId !== "ENTCT_SORT_BY") return condition;
  return {
    ...condition,
    sortDirection: getRoutingSortDirection(condition),
    fieldName: String(condition.fieldName || "").replace(/\s+desc$/i, "")
  };
}

export function routingSortDirectionLabel(direction: RoutingSortDirection) {
  return direction === "desc" ? "Descending" : "Ascending";
}

export function routingSortFieldName(condition: any, descendingSortFields: string | string[] = "") {
  const name = String(condition.fieldName || "").replace(/\s+desc$/i, "");
  return getRoutingSortDirection(condition, descendingSortFields) === "desc" ? `${name} desc` : name;
}
