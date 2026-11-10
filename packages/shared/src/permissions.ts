/**
 * Yetki kuralları. API bunları zorunlu tutar; arayüz de aynı kurallarla düğmeleri gösterir ya da gizler.
 *
 * - Durumu (başla / tamamla / geri al) yalnızca görevi YAPANLAR değiştirir. Görev birden fazla
 *   kişiye verildiyse durum ortaktır; bu kişilerden herhangi biri değiştirebilir.
 *   Görevde adı olmayan biri (görevi veren ya da yönetici dahil) değiştiremez.
 * - Görevi düzenlemek ve silmek: görevi VEREN kişi ya da yönetici.
 * - Not eklemek: görevi yapanlar, veren ya da yönetici.
 */
export interface PermUser {
  id: string;
  role: "ADMIN" | "MEMBER";
}

export interface PermTask {
  creatorId: string;
  assigneeIds: string[];
}

/** TaskDTO'dan yetki için gereken alanlar */
export const permTask = (t: { creator: { id: string }; assignees: { id: string }[] }): PermTask => ({
  creatorId: t.creator.id,
  assigneeIds: t.assignees.map((a) => a.id),
});

export const canChangeStatus = (user: PermUser, task: PermTask) => task.assigneeIds.includes(user.id);

export const canEdit = (user: PermUser, task: PermTask) => task.creatorId === user.id || user.role === "ADMIN";

export const canAddNote = (user: PermUser, task: PermTask) =>
  task.assigneeIds.includes(user.id) || task.creatorId === user.id || user.role === "ADMIN";
