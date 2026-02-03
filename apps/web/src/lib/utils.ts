import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { User } from "../types";
import { parseDate, isDateBefore, now } from "./date-utils";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatUsername(
  username: string | undefined,
  fallback: string = ""
): string {
  if (!username) return fallback;
  return username
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function formatDisplayName(
  user: User | null | undefined,
  fallback: string = ""
): string {
  if (!user) return fallback;
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
  if (fullName && fullName.trim()) {
    return fullName
      .split(" ")
      .map(
        (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
      )
      .join(" ");
  }
  return user.email || fallback;
}

export function getUserFirstName(
  user: User | null | undefined,
  fallback: string = ""
): string {
  if (!user) return fallback;
  if (user.first_name && user.first_name.trim()) {
    return user.first_name.charAt(0).toUpperCase() + user.first_name.slice(1).toLowerCase();
  }
  return user.email || fallback;
}

export function getOrdinalSuffix(day: number, language: string = "en"): string {
  if (language === "fr") return "";
  if (day === 1 || day === 21 || day === 31) return "st";
  if (day === 2 || day === 22) return "nd";
  if (day === 3 || day === 23) return "rd";
  return "th";
}

export function formatAmount(amount: number): string {
  return `${amount.toFixed(2)}$`;
}

export function formatCronTrigger(trigger: string, language: string = "en"): string {
  const minuteMatch = trigger.match(/minute=['"]([^'"]+)['"]/);
  const hourMatch = trigger.match(/hour=['"]([^'"]+)['"]/);
  const dayMatch = trigger.match(/day=['"]([^'"]+)['"]/);
  const monthMatch = trigger.match(/month=['"]([^'"]+)['"]/);

  const minute = minuteMatch ? minuteMatch[1] : null;
  const hour = hourMatch ? hourMatch[1] : null;
  const day = dayMatch ? dayMatch[1] : null;
  const month = monthMatch ? monthMatch[1] : null;

  if (minute && minute.startsWith("*/")) {
    const interval = minute.substring(2);
    return language === "fr"
      ? `à tous les ${interval} minutes`
      : `every ${interval} minutes`;
  }

  if (hour && minute && day === "1" && (month === "*" || !month)) {
    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);

    if (language === "fr") {
      return hourNum === 0 && minuteNum === 0
        ? "à minuit le 1er de chaque mois"
        : `à ${hourNum}h le 1er de chaque mois`;
    }

    if (hourNum === 0 && minuteNum === 0) {
      return "at midnight on the 1st of each month";
    }
    const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    const ampm = hourNum < 12 ? "AM" : "PM";
    return `at ${hour12}:${minute.toString().padStart(2, "0")} ${ampm} on the 1st of each month`;
  }

  if (hour && minute) {
    const hourNum = parseInt(hour, 10);
    const minuteNum = parseInt(minute, 10);

    if (language === "fr") {
      return hourNum === 0 && minuteNum === 0
        ? "à minuit à tous les jours"
        : `à ${hourNum}h à tous les jours`;
    }

    if (hourNum === 0 && minuteNum === 0) {
      return "at midnight daily";
    }
    const hour12 = hourNum === 0 ? 12 : hourNum > 12 ? hourNum - 12 : hourNum;
    const ampm = hourNum < 12 ? "AM" : "PM";
    return `at ${hour12}:${minute.toString().padStart(2, "0")} ${ampm} daily`;
  }

  return trigger;
}

export function isChoreOverdue(
  reminderDatetime: string | null | undefined,
  completed: boolean
): boolean {
  if (!reminderDatetime || completed) return false;
  const reminderDate = parseDate(reminderDatetime);
  if (!reminderDate) return false;
  return isDateBefore(reminderDate, now());
}

