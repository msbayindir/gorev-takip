import type { Prisma, User } from "@prisma/client";
import {
  STATUS_META,
  canAddNote,
  canChangeStatus,
  canEdit,
  createTaskSchema,
  noteSchema,
  statusChangeSchema,
  updateTaskSchema,
  type ActivityType,
} from "@gorev/shared";
import { prisma } from "./prisma";
import { HttpError, forbidden, notFound } from "./http";
import { dateToKey, keyToDate } from "./dates";
import { taskInclude, toTaskDTO } from "./serialize";

/** Seçilen kişilerin hepsi var ve ekipte mi? Sırayı korur. */
async function activeUsers(ids: string[]) {
  const users = await prisma.user.findMany({ where: { id: { in: ids } } });
  const byId = new Map(users.map((u) => [u.id, u]));
  return ids.map((id) => {
    const u = byId.get(id);
    if (!u) throw new HttpError(400, "Seçilen kişilerden biri bulunamadı");
    if (!u.active) throw new HttpError(400, `${u.name} artık ekipte değil`);
    return u;
  });
}

async function loadTask(id: string) {
  const t = await prisma.task.findUnique({ where: { id }, include: { assignees: { include: { user: true } } } });
  if (!t) throw notFound("Görev");
  return { ...t, assigneeIds: t.assignees.map((a) => a.userId) };
}

const nameList = (users: { id: string; name: string }[]) => users.map((u) => ({ id: u.id, name: u.name }));

export async function createTask(actor: User, raw: unknown) {
  const input = createTaskSchema.parse(raw);
  const people = await activeUsers(input.assigneeIds);
  const task = await prisma.$transaction(async (tx) => {
    const t = await tx.task.create({
      data: {
        title: input.title,
        description: input.description?.trim() || null,
        dueDate: input.dueDate ? keyToDate(input.dueDate) : null,
        creatorId: actor.id,
        assignees: { create: people.map((u) => ({ userId: u.id })) },
      },
      include: taskInclude,
    });
    await tx.activity.create({
      data: { taskId: t.id, userId: actor.id, type: "CREATED", meta: { assignees: nameList(people) } },
    });
    return t;
  });
  return toTaskDTO(task);
}

type Draft = { type: ActivityType; meta?: Prisma.InputJsonValue; message?: string | null };

/** Başlık, açıklama, yapanlar, son tarih. Yalnızca görevi veren kişi ya da yönetici. */
export async function updateTask(actor: User, taskId: string, raw: unknown) {
  const input = updateTaskSchema.parse(raw);
  const current = await loadTask(taskId);
  if (!canEdit(actor, current)) throw forbidden("Bu görevi yalnızca veren kişi ya da yönetici düzenleyebilir");

  const data: Prisma.TaskUncheckedUpdateInput = {};
  const drafts: Draft[] = [];
  let addIds: string[] = [];
  let removeIds: string[] = [];

  if (input.title !== undefined && input.title !== current.title) {
    data.title = input.title;
    drafts.push({ type: "TITLE", meta: { from: current.title, to: input.title } });
  }
  if (input.description !== undefined) {
    const next = input.description?.trim() ? input.description : null;
    if (next !== current.description) {
      data.description = next;
      drafts.push({ type: "DESCRIPTION" });
    }
  }
  if (input.assigneeIds !== undefined) {
    addIds = input.assigneeIds.filter((id) => !current.assigneeIds.includes(id));
    removeIds = current.assigneeIds.filter((id) => !input.assigneeIds!.includes(id));
    if (addIds.length || removeIds.length) {
      const added = await activeUsers(addIds);
      const removed = current.assignees.filter((a) => removeIds.includes(a.userId)).map((a) => a.user);
      drafts.push({ type: "ASSIGNEE", meta: { added: nameList(added), removed: nameList(removed) } });
    }
  }
  if (input.dueDate !== undefined) {
    const prev = dateToKey(current.dueDate);
    const next = input.dueDate ?? null;
    if (next !== prev) {
      data.dueDate = next ? keyToDate(next) : null;
      drafts.push({ type: "DUE_DATE", meta: { from: prev, to: next } });
    }
  }

  if (!drafts.length) {
    return toTaskDTO(await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude }));
  }
  const updated = await prisma.$transaction(async (tx) => {
    if (removeIds.length) await tx.taskAssignee.deleteMany({ where: { taskId, userId: { in: removeIds } } });
    if (addIds.length) await tx.taskAssignee.createMany({ data: addIds.map((userId) => ({ taskId, userId })) });
    const t = await tx.task.update({ where: { id: taskId }, data: { ...data, updatedAt: new Date() }, include: taskInclude });
    await tx.activity.createMany({
      data: drafts.map((d) => ({ taskId, userId: actor.id, type: d.type, message: d.message ?? null, meta: d.meta })),
    });
    return t;
  });
  return toTaskDTO(updated);
}

/** Başla / Tamamla / Geri al. Yalnızca görevi yapanlardan biri; durum hepsi için ortaktır. */
export async function changeStatus(actor: User, taskId: string, raw: unknown) {
  const input = statusChangeSchema.parse(raw);
  const current = await loadTask(taskId);
  if (!canChangeStatus(actor, current)) throw forbidden("Bu görevin durumunu yalnızca görevi yapanlar değiştirebilir");
  if (input.status === current.status) {
    return toTaskDTO(await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude }));
  }
  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.task.update({
      where: { id: taskId },
      data: { status: input.status, completedAt: input.status === "DONE" ? new Date() : null },
      include: taskInclude,
    });
    await tx.activity.create({
      data: {
        taskId,
        userId: actor.id,
        type: "STATUS",
        message: input.note?.trim() || null,
        meta: { from: current.status, to: input.status, toLabel: STATUS_META[input.status].label },
      },
    });
    return t;
  });
  return toTaskDTO(updated);
}

/** Not ekle. Görevi yapanlar, veren ya da yönetici. */
export async function addNote(actor: User, taskId: string, raw: unknown) {
  const { message } = noteSchema.parse(raw);
  const current = await loadTask(taskId);
  if (!canAddNote(actor, current)) throw forbidden("Bu göreve yalnızca görevi yapanlar, veren ya da yönetici not ekleyebilir");
  await prisma.$transaction([
    prisma.activity.create({ data: { taskId, userId: actor.id, type: "COMMENT", message } }),
    prisma.task.update({ where: { id: taskId }, data: { updatedAt: new Date() } }),
  ]);
  return toTaskDTO(await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: taskInclude }));
}

export async function deleteTask(actor: User, taskId: string) {
  const current = await loadTask(taskId);
  if (!canEdit(actor, current)) throw forbidden("Bu görevi yalnızca veren kişi ya da yönetici silebilir");
  await prisma.task.delete({ where: { id: taskId } });
}
