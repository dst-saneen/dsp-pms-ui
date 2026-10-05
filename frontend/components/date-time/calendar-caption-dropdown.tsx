"use client";

import * as React from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import type { DropdownProps } from "react-day-picker";

import { cn } from "@/lib/utils";

/**
 * In-calendar month/year menu (Sneat-style). Intentionally not a nested
 * Radix Popover — portals inside the date Popover close immediately.
 */
export function CalendarCaptionDropdown({
  options,
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
  className,
}: DropdownProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const selectedOption = options?.find(
    (option) => option.value === Number(value),
  );
  const isYearList = (options?.length ?? 0) > 12;

  React.useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const selected = listRef.current?.querySelector<HTMLElement>(
        '[data-selected="true"]',
      );
      selected?.scrollIntoView({ block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [open, value]);

  const scrollBy = (direction: "up" | "down") => {
    listRef.current?.scrollBy({
      top: direction === "up" ? -96 : 96,
      behavior: "smooth",
    });
  };

  const handlePick = (nextValue: number) => {
    onChange?.({
      target: { value: String(nextValue) },
    } as React.ChangeEvent<HTMLSelectElement>);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative z-20">
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-foreground transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
          "disabled:pointer-events-none disabled:opacity-50",
          open && "bg-muted",
          className,
        )}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        onPointerDown={(event) => {
          // Keep the parent date Popover from treating this as an outside dismiss.
          event.stopPropagation();
        }}
      >
        <span>{selectedOption?.label}</span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "absolute left-1/2 top-[calc(100%+6px)] z-50 -translate-x-1/2 overflow-hidden rounded-xl border border-border/80 bg-popover shadow-[0_8px_28px_rgba(16,24,40,0.12)] ring-1 ring-foreground/5",
            isYearList ? "w-[4.75rem]" : "w-[5.5rem]",
          )}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            aria-label="Scroll up"
            className="flex h-7 w-full items-center justify-center text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            onClick={() => scrollBy("up")}
          >
            <ChevronUpIcon className="size-3.5" />
          </button>

          <div
            ref={listRef}
            className="max-h-[11.5rem] overflow-y-auto overscroll-contain px-1.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <ul className="flex flex-col gap-0.5 py-0.5">
              {options?.map((option) => {
                const selected = option.value === Number(value);
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      disabled={option.disabled}
                      data-selected={selected}
                      onClick={() => handlePick(option.value)}
                      className={cn(
                        "flex w-full items-center justify-center rounded-lg px-2 py-2 text-sm leading-none transition-colors",
                        "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25",
                        "disabled:pointer-events-none disabled:opacity-40",
                        selected
                          ? "bg-primary-soft font-medium text-primary"
                          : "font-normal text-foreground",
                      )}
                    >
                      {option.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <button
            type="button"
            aria-label="Scroll down"
            className="flex h-7 w-full items-center justify-center text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
            onClick={() => scrollBy("down")}
          >
            <ChevronDownIcon className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
