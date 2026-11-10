import { test } from "node:test";
import assert from "node:assert/strict";
import { canAddNote, canChangeStatus, canEdit, permTask } from "./permissions";

const admin = { id: "a", role: "ADMIN" as const };
const ayse = { id: "ayse", role: "MEMBER" as const };
const mehmet = { id: "mehmet", role: "MEMBER" as const };
const zeynep = { id: "zeynep", role: "MEMBER" as const };

// Mehmet görevi Ayşe'ye verdi
const task = { creatorId: "mehmet", assigneeIds: ["ayse"] };

test("durumu yalnızca görevi yapan kişi değiştirir", () => {
  assert.equal(canChangeStatus(ayse, task), true);
  assert.equal(canChangeStatus(mehmet, task), false, "veren kişi değiştiremez");
  assert.equal(canChangeStatus(admin, task), false, "yönetici değiştiremez");
  assert.equal(canChangeStatus(zeynep, task), false);
});

test("birden fazla kişiye verilen görevde durumu bu kişilerden herhangi biri değiştirir", () => {
  const shared = { creatorId: "a", assigneeIds: ["ayse", "mehmet"] };
  assert.equal(canChangeStatus(ayse, shared), true);
  assert.equal(canChangeStatus(mehmet, shared), true);
  assert.equal(canChangeStatus(zeynep, shared), false, "görevde adı olmayan değiştiremez");
  assert.equal(canChangeStatus(admin, shared), false, "görevi veren yönetici de değiştiremez");
  assert.equal(canAddNote(mehmet, shared), true);
  assert.equal(canAddNote(zeynep, shared), false);
  assert.equal(canEdit(ayse, shared), false, "yapanlar görevi düzenleyemez");
});

test("düzenleme ve silme: veren kişi ya da yönetici", () => {
  assert.equal(canEdit(mehmet, task), true);
  assert.equal(canEdit(admin, task), true);
  assert.equal(canEdit(ayse, task), false, "yapan kişi başlığı/sorumluyu değiştiremez");
  assert.equal(canEdit(zeynep, task), false);
});

test("not: yapan, veren ya da yönetici", () => {
  assert.equal(canAddNote(ayse, task), true);
  assert.equal(canAddNote(mehmet, task), true);
  assert.equal(canAddNote(admin, task), true);
  assert.equal(canAddNote(zeynep, task), false);
});

test("kendine verilen görev", () => {
  const own = { creatorId: "ayse", assigneeIds: ["ayse"] };
  assert.equal(canChangeStatus(ayse, own), true);
  assert.equal(canEdit(ayse, own), true);
});

test("permTask TaskDTO alanlarından yetki girdisi üretir", () => {
  const dto = { creator: { id: "a" }, assignees: [{ id: "ayse" }, { id: "mehmet" }] };
  assert.deepEqual(permTask(dto), { creatorId: "a", assigneeIds: ["ayse", "mehmet"] });
});
