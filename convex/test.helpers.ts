/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";

export const modules = import.meta.glob("./**/*.ts");

export function setup() {
  return convexTest(schema, modules);
}

export type TestBackend = ReturnType<typeof setup>;

export async function createUser(t: TestBackend, name: string) {
  const authId = `auth-${name.toLowerCase()}`;
  const email = `${name.toLowerCase()}@example.test`;
  const userId: Id<"users"> = await t.run(async (ctx) =>
    ctx.db.insert("users", { authId, email, name }),
  );
  return { userId, email, name, as: t.withIdentity({ subject: authId, name, email }) };
}

export async function createProjectWithMember(t: TestBackend) {
  const owner = await createUser(t, "Olivia");
  const member = await createUser(t, "Max");
  const outsider = await createUser(t, "Eve");
  const projectId = await owner.as.mutation(api.projects.create, {
    name: "Capstone",
    description: "Semester project",
  });
  await owner.as.mutation(api.members.add, { projectId, email: member.email });
  return { owner, member, outsider, projectId };
}

export async function errorData(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    if (error && typeof error === "object" && "data" in error) return error.data;
    throw error;
  }
  throw new Error("Expected the call to fail.");
}
