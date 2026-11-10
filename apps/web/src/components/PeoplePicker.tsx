"use client";

import type { UserLite } from "@gorev/shared";
import { ChevronDown } from "lucide-react";
import { cn, peopleText } from "@/lib/utils";
import { Avatar } from "./Avatar";
import { Popover } from "./Popover";
import { Button } from "./ui";

/**
 * "Kime?" seçici: görev bir ya da birden fazla kişiye verilir.
 * Düğmede seçilenlerin adı yazar; açılınca her kişinin yanında bir onay kutusu çıkar.
 */
export function PeoplePicker({
  users,
  meId,
  value,
  onChange,
  labelledBy,
  className,
}: {
  users: UserLite[];
  meId: string;
  value: string[];
  onChange: (ids: string[]) => void;
  labelledBy?: string;
  className?: string;
}) {
  const ordered = [...users].sort((a, b) => Number(b.id === meId) - Number(a.id === meId));
  const selected = ordered.filter((u) => value.includes(u.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <Popover
      triggerClassName={cn("flex w-full", className)}
      className="w-72"
      trigger={({ open, toggle: toggleOpen }) => (
        <button
          type="button"
          onClick={toggleOpen}
          aria-haspopup="true"
          aria-expanded={open}
          aria-labelledby={labelledBy}
          className={cn(
            "flex h-12 w-full cursor-pointer items-center gap-2 rounded-md border bg-surface px-3.5 text-left text-base text-ink",
            open ? "border-accent ring-3 ring-accent/20" : "border-line-strong",
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !selected.length && "text-ink-muted")}>
            {selected.length ? peopleText(selected, meId, "Ben", 2) : "Kişi seç"}
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-muted" aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col" role="group" aria-label="Görevi yapacak kişiler">
          <p className="px-3 pt-1.5 pb-1 text-sm font-semibold text-ink-muted">Bir ya da birden fazla kişi seç</p>
          {ordered.map((u) => {
            const checked = value.includes(u.id);
            return (
              <label key={u.id} className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-3 text-base text-ink hover:bg-sunken", checked && "bg-accent-soft")}>
                <input type="checkbox" checked={checked} onChange={() => toggle(u.id)} className="size-5 shrink-0" />
                <Avatar user={u} size="sm" />
                <span className="min-w-0 flex-1 truncate">{u.id === meId ? "Ben" : u.name}</span>
              </label>
            );
          })}
          <div className="mt-1 flex items-center gap-2 border-t border-line px-1.5 pt-2 pb-0.5">
            <span className="flex-1 text-sm text-ink-muted">{value.length ? `${value.length} kişi seçili` : "Kimse seçili değil"}</span>
            <Button size="sm" variant="primary" onClick={close}>
              Tamam
            </Button>
          </div>
        </div>
      )}
    </Popover>
  );
}
