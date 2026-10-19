import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { createVerifiedSession, newAccount, signIn, signUp, type Session, type TestAccount } from "../support/accounts";
import { readTargetEnv } from "../support/env";

const env = readTargetEnv();

function clientFor(session: Session): ConvexHttpClient {
  const client = new ConvexHttpClient(env.convexUrl);
  client.setAuth(session.token);
  return client;
}

async function expectAppError(promise: Promise<unknown>, code: string) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(ConvexError);
  expect((error as ConvexError<{ code: string }>).data.code).toBe(code);
}

describe("authentication against the deployed backend", () => {
  it("rejects sign-in until the email address is verified", async () => {
    const account = newAccount("unverified");
    await signUp(env, account);
    await expect(signIn(env, account)).rejects.toThrow(/HTTP 403/);
  });

  it("refuses anonymous access to protected queries", async () => {
    const anonymous = new ConvexHttpClient(env.convexUrl);
    await expectAppError(anonymous.query(api.projects.list, {}), "UNAUTHENTICATED");
  });
});

describe("projects, membership and tasks against the deployed backend", () => {
  let owner: TestAccount & Session;
  let member: TestAccount & Session;
  let outsider: TestAccount & Session;
  let projectId: Id<"projects">;

  beforeAll(async () => {
    [owner, member, outsider] = await Promise.all([
      createVerifiedSession(env, "owner"),
      createVerifiedSession(env, "member"),
      createVerifiedSession(env, "outsider"),
    ]);
    projectId = await clientFor(owner).mutation(api.projects.create, {
      name: "Integration board",
      description: "Created by the integration suite",
    });
  });

  afterAll(async () => {
    if (projectId) {
      await clientFor(owner)
        .mutation(api.projects.remove, { projectId, confirmName: "Integration board" })
        .catch(() => undefined);
    }
  });

  it("returns the signed-in profile", async () => {
    const me = await clientFor(owner).query(api.auth.me, {});
    expect(me?.email).toBe(owner.email);
  });

  it("lists the new project for its owner only", async () => {
    const mine = await clientFor(owner).query(api.projects.list, {});
    expect(mine.map((p) => p._id)).toContain(projectId);
    const theirs = await clientFor(outsider).query(api.projects.list, {});
    expect(theirs.map((p) => p._id)).not.toContain(projectId);
  });

  it("hides the board from non-members", async () => {
    await expectAppError(clientFor(outsider).query(api.projects.get, { projectId }), "NOT_FOUND");
    await expectAppError(clientFor(outsider).query(api.tasks.list, { projectId }), "NOT_FOUND");
  });

  it("lets the owner add a registered member by email and rejects unknown emails", async () => {
    await clientFor(owner).mutation(api.members.add, { projectId, email: member.email.toUpperCase() });
    const project = await clientFor(member).query(api.projects.get, { projectId });
    expect(project.role).toBe("member");
    expect(project.members.map((m) => m.email)).toEqual(expect.arrayContaining([owner.email, member.email]));
    await expectAppError(
      clientFor(owner).mutation(api.members.add, { projectId, email: "nobody-registered@example.test" }),
      "NOT_FOUND",
    );
  });

  it("restricts owner-only actions", async () => {
    await expectAppError(
      clientFor(member).mutation(api.projects.update, { projectId, name: "Hijacked", description: "" }),
      "FORBIDDEN",
    );
    await expectAppError(
      clientFor(member).mutation(api.members.add, { projectId, email: outsider.email }),
      "FORBIDDEN",
    );
  });

  it("creates, edits, moves, filters and deletes tasks with activity history", async () => {
    const ownerClient = clientFor(owner);
    const memberClient = clientFor(member);
    const project = await memberClient.query(api.projects.get, { projectId });
    const memberId = project.currentUserId;

    const taskId = await memberClient.mutation(api.tasks.create, {
      projectId,
      title: "Write release notes",
      description: "For the staging candidate",
      priority: "high",
      dueDate: "2026-10-22",
      assigneeId: memberId,
    });
    await ownerClient.mutation(api.tasks.create, {
      projectId,
      title: "Low priority chore",
      description: "",
      status: "review",
      priority: "low",
      dueDate: null,
      assigneeId: null,
    });

    await ownerClient.mutation(api.tasks.update, { taskId, priority: "urgent", dueDate: "2026-10-21" });
    await ownerClient.mutation(api.tasks.setStatus, { taskId, status: "in_progress" });

    const all = await ownerClient.query(api.tasks.list, { projectId });
    expect(all).toHaveLength(2);
    const updated = all.find((t) => t._id === taskId);
    expect(updated).toMatchObject({ status: "in_progress", priority: "urgent", dueDate: "2026-10-21", assigneeId: memberId });

    expect((await ownerClient.query(api.tasks.list, { projectId, priority: "urgent" })).map((t) => t._id)).toEqual([taskId]);
    expect((await ownerClient.query(api.tasks.list, { projectId, status: "review" })).map((t) => t.title)).toEqual([
      "Low priority chore",
    ]);
    expect((await ownerClient.query(api.tasks.list, { projectId, assignee: "unassigned" })).map((t) => t.title)).toEqual([
      "Low priority chore",
    ]);
    expect((await ownerClient.query(api.tasks.list, { projectId, assignee: memberId })).map((t) => t._id)).toEqual([taskId]);

    await expectAppError(
      ownerClient.mutation(api.tasks.update, { taskId, dueDate: "2026-02-30" }),
      "INVALID_INPUT",
    );
    await expectAppError(clientFor(outsider).mutation(api.tasks.setStatus, { taskId, status: "done" }), "NOT_FOUND");

    await memberClient.mutation(api.tasks.remove, { taskId });
    expect((await ownerClient.query(api.tasks.list, { projectId })).map((t) => t._id)).not.toContain(taskId);

    const activity = await ownerClient.query(api.activity.list, { projectId });
    const summaries = activity.map((entry) => entry.summary);
    expect(summaries).toEqual(
      expect.arrayContaining([
        expect.stringContaining('moved "Write release notes" from To do to In progress'),
        expect.stringContaining('deleted "Write release notes"'),
        expect.stringContaining("added"),
      ]),
    );
    expect(activity[0]?.createdAt).toBeGreaterThanOrEqual(activity.at(-1)?.createdAt ?? 0);
  });

  it("clears a member's assignments when they leave", async () => {
    const memberClient = clientFor(member);
    const { currentUserId } = await memberClient.query(api.projects.get, { projectId });
    const taskId = await memberClient.mutation(api.tasks.create, {
      projectId,
      title: "Assigned then orphaned",
      description: "",
      priority: "medium",
      dueDate: null,
      assigneeId: currentUserId,
    });
    await memberClient.mutation(api.members.leave, { projectId });
    await expectAppError(memberClient.query(api.projects.get, { projectId }), "NOT_FOUND");
    const task = (await clientFor(owner).query(api.tasks.list, { projectId })).find((t) => t._id === taskId);
    expect(task?.assigneeId).toBeNull();
  });
});
