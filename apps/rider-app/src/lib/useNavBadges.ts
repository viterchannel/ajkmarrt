import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { api } from "./api";
import { useSocket } from "./socket";

const CHAT_SEEN_KEY = "ajkmart_rider_chat_seen_count";
const EARNINGS_SEEN_KEY = "ajkmart_rider_earnings_seen";

function getStoredInt(key: string): number {
  try {
    return parseInt(localStorage.getItem(key) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function getStoredFloat(key: string): number {
  try {
    return parseFloat(localStorage.getItem(key) ?? "0") || 0;
  } catch {
    return 0;
  }
}

function storeStr(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — degrade silently */
  }
}

export function useNavBadges() {
  const [location] = useLocation();
  const { adminChatMessages } = useSocket();
  const [chatBadge, setChatBadge] = useState(0);
  const [earningsBadge, setEarningsBadge] = useState(false);

  /* Chat badge — count admin messages received since the rider last opened /active */
  useEffect(() => {
    const total = adminChatMessages.length;
    if (location === "/active") {
      storeStr(CHAT_SEEN_KEY, String(total));
      setChatBadge(0);
    } else {
      const seen = getStoredInt(CHAT_SEEN_KEY);
      setChatBadge(Math.max(0, total - seen));
    }
  }, [adminChatMessages.length, location]);

  /* Earnings badge — show a dot when today's earnings changed since the rider
     last viewed the Earnings screen. Polled infrequently to keep it lightweight. */
  const { data: summary } = useQuery({
    queryKey: ["rider-earnings-summary-badge"],
    queryFn: () => api.getEarningsSummary(),
    refetchInterval: 120_000,
    staleTime: 90_000,
  });

  useEffect(() => {
    if (summary === undefined) return;
    const today = summary?.todayEarned ?? 0;
    if (location === "/earnings") {
      storeStr(EARNINGS_SEEN_KEY, String(today));
      setEarningsBadge(false);
    } else {
      const seen = getStoredFloat(EARNINGS_SEEN_KEY);
      setEarningsBadge(today !== seen);
    }
  }, [summary, location]);

  return { chatBadge, earningsBadge };
}
