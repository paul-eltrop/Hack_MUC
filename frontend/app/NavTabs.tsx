"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  {
    label: "Investigations",
    href: "/",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 4.5A2.5 2.5 0 014.5 2h6A2.5 2.5 0 0113 4.5v6a2.5 2.5 0 01-2.5 2.5h-6A2.5 2.5 0 012 10.5v-6z" stroke="currentColor" strokeWidth="1.2"/>
        <path d="M5 7.5h5M5 5h5M5 10h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "Analyse",
    href: "/analyse",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 11.5l3-4 2.5 2.5 3-5 2.5 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    label: "Archive",
    href: "/archive",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 4h11v1.5H2V4zM3 5.5h9V12H3V5.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
        <path d="M5.5 8h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function NavTabs() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/" || pathname.startsWith("/investigations");
    return pathname.startsWith(href);
  }

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="relative flex justify-center px-6 py-3">
        <Link
          href="/"
          aria-label="Maniax Home"
          className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center"
        >
          <img
            src="/brand/maniax-wordmark-dark.svg"
            alt="Maniax"
            className="h-6 w-auto"
          />
        </Link>
        <div className="flex items-center gap-1 bg-gray-100 rounded-2xl p-1">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive(tab.href)
                  ? "bg-gray-950 text-white shadow-sm"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab.icon}
              {tab.label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
