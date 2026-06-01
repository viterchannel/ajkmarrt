import { useEffect, useRef, useState } from "react";
import { API_BASE } from "@/utils/api";

export function useLocationSuggestions({
  query,
  type,
  city,
}: {
  query: string;
  type: "city" | "area";
  city?: string;
}): string[] {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query, type });
        if (city) params.set("city", city);
        const res = await fetch(`${API_BASE}/locations/suggestions?${params.toString()}`);
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const json = (await res.json()) as { suggestions?: string[] };
        setSuggestions(json.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, type, city]);

  return suggestions;
}
