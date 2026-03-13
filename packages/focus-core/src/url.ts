import type { FocusCategory, FocusIntent, NormalizedUrl } from "./schema.js";

type CategorizationRule = {
  category: FocusCategory;
  intent: FocusIntent;
  test: (normalized: NormalizedUrl) => boolean;
};

function matchesHost(hostname: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(hostname));
}

function matchesPath(path: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(path));
}

const rules: CategorizationRule[] = [
  {
    category: "coding",
    intent: "productive",
    test: ({ hostname }) =>
      matchesHost(hostname, [
        /(^|\.)github\.com$/i,
        /(^|\.)gitlab\.com$/i,
        /(^|\.)bitbucket\.org$/i,
        /(^|\.)leetcode\.com$/i,
        /(^|\.)hackerrank\.com$/i,
        /(^|\.)codewars\.com$/i,
        /(^|\.)codeforces\.com$/i,
        /(^|\.)stackblitz\.com$/i,
        /(^|\.)codesandbox\.io$/i,
        /(^|\.)replit\.com$/i,
      ]),
  },
  {
    category: "docs",
    intent: "productive",
    test: ({ hostname, path }) =>
      matchesHost(hostname, [
        /(^|\.)developer\.mozilla\.org$/i,
        /(^|\.)docs\.github\.com$/i,
        /(^|\.)react\.dev$/i,
        /(^|\.)nextjs\.org$/i,
        /(^|\.)tailwindcss\.com$/i,
        /(^|\.)typescriptlang\.org$/i,
        /(^|\.)npmjs\.com$/i,
        /(^|\.)pypi\.org$/i,
        /(^|\.)stackoverflow\.com$/i,
        /(^|\.)devdocs\.io$/i,
      ]) || matchesPath(path, [/^\/docs(\/|$)/i]),
  },
  {
    category: "learning",
    intent: "productive",
    test: ({ hostname }) =>
      matchesHost(hostname, [
        /(^|\.)freecodecamp\.org$/i,
        /(^|\.)codecademy\.com$/i,
        /(^|\.)scrimba\.com$/i,
        /(^|\.)educative\.io$/i,
        /(^|\.)frontendmasters\.com$/i,
        /(^|\.)coursera\.org$/i,
        /(^|\.)edx\.org$/i,
        /(^|\.)udemy\.com$/i,
        /(^|\.)khanacademy\.org$/i,
      ]),
  },
  {
    category: "communication",
    intent: "neutral",
    test: ({ hostname }) =>
      matchesHost(hostname, [
        /(^|\.)mail\.google\.com$/i,
        /(^|\.)slack\.com$/i,
        /(^|\.)discord\.com$/i,
        /(^|\.)teams\.microsoft\.com$/i,
        /(^|\.)zoom\.us$/i,
        /(^|\.)meet\.google\.com$/i,
      ]),
  },
  {
    category: "social",
    intent: "distracting",
    test: ({ hostname }) =>
      matchesHost(hostname, [
        /(^|\.)reddit\.com$/i,
        /(^|\.)x\.com$/i,
        /(^|\.)twitter\.com$/i,
        /(^|\.)facebook\.com$/i,
        /(^|\.)instagram\.com$/i,
        /(^|\.)tiktok\.com$/i,
        /(^|\.)threads\.net$/i,
      ]),
  },
  {
    category: "entertainment",
    intent: "distracting",
    test: ({ hostname }) =>
      matchesHost(hostname, [
        /(^|\.)youtube\.com$/i,
        /(^|\.)netflix\.com$/i,
        /(^|\.)spotify\.com$/i,
        /(^|\.)twitch\.tv$/i,
        /(^|\.)hulu\.com$/i,
      ]),
  },
  {
    category: "search",
    intent: "neutral",
    test: ({ hostname }) =>
      matchesHost(hostname, [
        /(^|\.)google\.[a-z.]+$/i,
        /(^|\.)bing\.com$/i,
        /(^|\.)duckduckgo\.com$/i,
        /(^|\.)perplexity\.ai$/i,
        /(^|\.)chatgpt\.com$/i,
        /(^|\.)claude\.ai$/i,
      ]),
  },
  {
    category: "admin",
    intent: "neutral",
    test: ({ hostname }) =>
      matchesHost(hostname, [
        /(^|\.)linear\.app$/i,
        /(^|\.)jira\.com$/i,
        /(^|\.)atlassian\.net$/i,
        /(^|\.)trello\.com$/i,
        /(^|\.)notion\.so$/i,
        /(^|\.)calendar\.google\.com$/i,
        /(^|\.)drive\.google\.com$/i,
        /(^|\.)docs\.google\.com$/i,
      ]),
  },
];

export function normalizeTrackableUrl(urlValue: string): NormalizedUrl | null {
  try {
    const parsed = new URL(urlValue);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    const path =
      parsed.pathname === "/" || parsed.pathname === ""
        ? "/"
        : parsed.pathname.replace(/\/+$/, "") || "/";

    return {
      origin: `${parsed.protocol}//${parsed.host}`,
      path,
      hostname: parsed.hostname.toLowerCase(),
    };
  } catch {
    return null;
  }
}

export function categorizeUrl(
  normalized: NormalizedUrl,
): Pick<NormalizedUrl, "hostname"> & {
  category: FocusCategory;
  intent: FocusIntent;
} {
  for (const rule of rules) {
    if (rule.test(normalized)) {
      return {
        hostname: normalized.hostname,
        category: rule.category,
        intent: rule.intent,
      };
    }
  }

  return {
    hostname: normalized.hostname,
    category: "uncategorized",
    intent: "neutral",
  };
}
