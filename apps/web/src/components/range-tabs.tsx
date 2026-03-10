import Link from "next/link";
import clsx from "clsx";

const ranges = ["7d", "30d", "90d"] as const;

type Props = {
  basePath: string;
  active: string;
  extraQuery?: string;
};

export function RangeTabs({ basePath, active, extraQuery }: Props) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      {ranges.map((range) => {
        const href = extraQuery
          ? `${basePath}?range=${range}&${extraQuery}`
          : `${basePath}?range=${range}`;
        return (
          <Link
            key={range}
            href={href}
            className={clsx(
              "rounded-full px-4 py-2 text-sm font-semibold transition",
              active === range
                ? "bg-ink text-white"
                : "text-slate-600 hover:text-aurora",
            )}
          >
            {range}
          </Link>
        );
      })}
    </div>
  );
}
