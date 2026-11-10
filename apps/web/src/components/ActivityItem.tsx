"use client";

import { longDate, type ActivityDTO, type TaskStatus } from "@gorev/shared";
import { useSession } from "@/hooks/useSession";
import { fullDateTime, peopleText, timeAgo } from "@/lib/utils";

/** "Ayşe Yılmaz tamamladı" / "Sen tamamladın" */
function sentence(a: ActivityDTO, meId: string): string {
  const self = a.user.id === meId;
  const v = (third: string, second: string) => (self ? second : third);
  const m = (a.meta ?? {}) as Record<string, unknown>;
  type P = { id: string; name: string };
  const list = (x: unknown): P[] => (Array.isArray(x) ? (x as P[]) : []);
  const names = (people: P[]) => peopleText(people, meId, "Sen", 4);
  switch (a.type) {
    case "CREATED": {
      // Yeni kayıtlar: { assignees: [...] } · eski kayıtlar: { assigneeId, assigneeName }
      const people = m.assignees ? list(m.assignees) : m.assigneeId ? [{ id: String(m.assigneeId), name: String(m.assigneeName) }] : [];
      const onlySelf = people.length === 0 || (people.length === 1 && people[0].id === a.user.id);
      return onlySelf ? v("görevi oluşturdu", "görevi oluşturdun") : `${v("görevi verdi", "görevi verdin")}: ${names(people)}`;
    }
    case "STATUS": {
      const to = m.to as TaskStatus;
      if (to === "DONE") return v("tamamladı", "tamamladın");
      if (to === "IN_PROGRESS") return v("başladı", "başladın");
      return v("yeniden açtı", "yeniden açtın");
    }
    case "COMMENT":
      return v("not ekledi", "not ekledin");
    case "ASSIGNEE": {
      if (!m.added && !m.removed) {
        // eski tek-sorumlu kaydı
        return `${v("görevi verdi", "görevi verdin")}: ${m.toId === meId ? "Sen" : String(m.toName)}`;
      }
      const added = list(m.added);
      const removed = list(m.removed);
      if (added.length && removed.length) {
        return `${v("yapanları değiştirdi", "yapanları değiştirdin")} · eklenen: ${names(added)} · çıkan: ${names(removed)}`;
      }
      if (added.length) return `${v("yapanlara ekledi", "yapanlara ekledin")}: ${names(added)}`;
      return `${v("yapanlardan çıkardı", "yapanlardan çıkardın")}: ${names(removed)}`;
    }
    case "DUE_DATE":
      return m.to ? `son tarihi ${longDate(String(m.to))} ${v("yaptı", "yaptın")}` : v("son tarihi kaldırdı", "son tarihi kaldırdın");
    case "TITLE":
      return v("başlığı değiştirdi", "başlığı değiştirdin");
    case "DESCRIPTION":
      return v("açıklamayı güncelledi", "açıklamayı güncelledin");
    default:
      return "";
  }
}

export function ActivityItem({ a }: { a: ActivityDTO }) {
  const me = useSession();
  return (
    <article className="flex flex-col gap-1.5">
      <p className="text-base text-ink">
        <b className="font-semibold">{a.user.id === me.id ? "Sen" : a.user.name}</b> {sentence(a, me.id)}{" "}
        <time dateTime={a.createdAt} title={fullDateTime(a.createdAt)} className="text-sm text-ink-muted">
          · {timeAgo(a.createdAt)}
        </time>
      </p>
      {a.message && <p className="rounded-md border border-line bg-surface px-3 py-2.5 text-base whitespace-pre-wrap break-words text-ink">{a.message}</p>}
    </article>
  );
}
