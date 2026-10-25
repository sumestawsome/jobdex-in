"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Menu, BookOpen } from "lucide-react";

export interface TocItem {
  id: string;
  title: string;
  subitems?: { id: string; title: string }[];
}

interface Props {
  items: TocItem[];
}

export function DocsTableOfContents({ items }: Props) {
  const [activeId, setActiveId] = useState<string>("");
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  useEffect(() => {
    // Collect all section ids
    const allIds: string[] = [];
    items.forEach((item) => {
      allIds.push(item.id);
      item.subitems?.forEach((sub) => allIds.push(sub.id));
    });

    const observer = new IntersectionObserver(
      (entries) => {
        // Find visible entries
        const visibleEntries = entries.filter((e) => e.isIntersecting);
        if (visibleEntries.length > 0) {
          // Take the one closest to the top of viewport
          const topEntry = visibleEntries.reduce((prev, curr) =>
            Math.abs(curr.boundingClientRect.top) < Math.abs(prev.boundingClientRect.top) ? curr : prev
          );
          setActiveId(topEntry.target.id);
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    );

    allIds.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [items]);

  function scrollToSection(id: string) {
    setIsMobileOpen(false);
    const el = document.getElementById(id);
    if (el) {
      const yOffset = -90; // offset for fixed header
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  }

  return (
    <>
      {/* ── MOBILE COLLAPSIBLE ACCORDION ── */}
      <div className="lg:hidden mb-6 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-none shadow-none">
        <button
          type="button"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between text-left text-xs font-bold text-zinc-900 dark:text-zinc-100 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <BookOpen size={14} className="text-primary" />
            <span>Daftar Isi Dokumentasi</span>
          </span>
          <ChevronDown
            size={14}
            className={`transition-transform duration-200 ${isMobileOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isMobileOpen && (
          <div className="px-4 pb-4 pt-1 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-xs">
            {items.map((item) => (
              <div key={item.id} className="space-y-1">
                <button
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className={`block text-left w-full transition-colors cursor-pointer ${
                    activeId === item.id
                      ? "text-primary font-bold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                >
                  {item.title}
                </button>
                {item.subitems && (
                  <div className="pl-3 border-l border-zinc-200 dark:border-zinc-800 space-y-1">
                    {item.subitems.map((sub) => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => scrollToSection(sub.id)}
                        className={`block text-left w-full text-[11px] transition-colors cursor-pointer ${
                          activeId === sub.id
                            ? "text-primary font-bold"
                            : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        }`}
                      >
                        {sub.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── DESKTOP STICKY SIDEBAR ── */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-24 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 rounded-none shadow-none space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <BookOpen size={15} className="text-primary shrink-0" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
              Daftar Isi
            </h4>
          </div>

          <nav className="space-y-2 text-xs" aria-label="Table of contents">
            {items.map((item) => {
              const isItemActive = activeId === item.id;
              const hasActiveSub = item.subitems?.some((sub) => sub.id === activeId);

              return (
                <div key={item.id} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    className={`block w-full text-left transition-colors cursor-pointer ${
                      isItemActive
                        ? "text-primary font-bold pl-2 border-l-2 border-primary bg-primary/5"
                        : hasActiveSub
                        ? "text-zinc-900 dark:text-zinc-100 font-semibold pl-2 border-l-2 border-zinc-300 dark:border-zinc-700"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 pl-2 border-l-2 border-transparent"
                    }`}
                  >
                    {item.title}
                  </button>

                  {item.subitems && (
                    <div className="pl-3 ml-2 border-l border-zinc-200 dark:border-zinc-800 space-y-1 py-0.5">
                      {item.subitems.map((sub) => {
                        const isSubActive = activeId === sub.id;
                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => scrollToSection(sub.id)}
                            className={`block w-full text-left text-[11px] transition-colors cursor-pointer ${
                              isSubActive
                                ? "text-primary font-bold pl-1.5 border-l-2 border-primary bg-primary/5"
                                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 pl-1.5 border-l-2 border-transparent"
                            }`}
                          >
                            {sub.title}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
