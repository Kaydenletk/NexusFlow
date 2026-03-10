import Link from "next/link";
import clsx from "clsx";
import React from "react";

const links = [
  { href: "/", label: "Overview" },
  { href: "/coding", label: "Coding" },
  { href: "/listening", label: "Listening" },
  { href: "/health", label: "Health" },
  { href: "/integrations", label: "Integrations" },
  { href: "/goals", label: "Goals" },
  { href: "/imports", label: "Imports" },
];

export function Navigation() {
  return (
    <nav className="flex flex-wrap items-center gap-3">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={clsx(
            "rounded-full border border-white/70 bg-white/80 px-4 py-2 text-sm font-semibold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-aurora/30 hover:text-aurora",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
