export type { MediaDTO } from "@/lib/media/serialize";

export interface LibraryFilters {
  q: string;
  status: "" | "TO_SORT" | "SORTED";
  type: "" | "PHOTO" | "VIDEO";
  category: string;
  activity: string;
  photographer: string;
  dateMode: "" | "date" | "range" | "month" | "year";
  dateField: "capture" | "upload";
  date: string;
  from: string;
  to: string;
  month: string;
  year: string;
  sort: string;
}

export const EMPTY_FILTERS: LibraryFilters = {
  q: "",
  status: "",
  type: "",
  category: "",
  activity: "",
  photographer: "",
  dateMode: "",
  dateField: "capture",
  date: "",
  from: "",
  to: "",
  month: "",
  year: "",
  sort: "capture_desc",
};

/** Filtres → paramètres d'URL (partagés par l'API et la barre d'adresse). */
export function filtersToParams(filters: LibraryFilters): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string) => value && params.set(key, value);
  set("q", filters.q.trim());
  set("status", filters.status);
  set("type", filters.type);
  set("category", filters.category);
  set("activity", filters.activity);
  set("photographer", filters.photographer.trim());
  if (filters.dateMode) {
    params.set("dateMode", filters.dateMode);
    if (filters.dateField === "upload") params.set("dateField", "upload");
    if (filters.dateMode === "date") set("date", filters.date);
    if (filters.dateMode === "range") {
      set("from", filters.from);
      set("to", filters.to);
    }
    if (filters.dateMode === "month") set("month", filters.month);
    if (filters.dateMode === "year") set("year", filters.year);
  }
  if (filters.sort !== EMPTY_FILTERS.sort) params.set("sort", filters.sort);
  return params;
}

export function paramsToFilters(params: URLSearchParams): LibraryFilters {
  const get = (key: string) => params.get(key) ?? "";
  const status = get("status");
  const type = get("type");
  const dateMode = get("dateMode");
  return {
    q: get("q"),
    status: status === "TO_SORT" || status === "SORTED" ? status : "",
    type: type === "PHOTO" || type === "VIDEO" ? type : "",
    category: get("category"),
    activity: get("activity"),
    photographer: get("photographer"),
    dateMode: (["date", "range", "month", "year"].includes(dateMode) ? dateMode : "") as LibraryFilters["dateMode"],
    dateField: get("dateField") === "upload" ? "upload" : "capture",
    date: get("date"),
    from: get("from"),
    to: get("to"),
    month: get("month"),
    year: get("year"),
    sort: get("sort") || EMPTY_FILTERS.sort,
  };
}

export function activeFilterCount(filters: LibraryFilters): number {
  return [filters.status, filters.type, filters.category, filters.activity, filters.photographer.trim(), filters.dateMode].filter(Boolean)
    .length;
}
