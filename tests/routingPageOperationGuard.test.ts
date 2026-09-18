import { describe, expect, it } from "vitest";
import {
  isStaleRoutingPageOperation,
  RoutingPageOperationGuard,
  StaleRoutingPageOperationError
} from "@/utils/routingPageOperationGuard";

const editorA = {};
const editorB = {};

function identity(overrides: any = {}) {
  return { routingGroupId: "G1", variationId: "", editor: editorA, ...overrides };
}

describe("RoutingPageOperationGuard", () => {
  it("accepts a continuation whose identity and generation are unchanged", () => {
    const guard = new RoutingPageOperationGuard();
    const token = guard.begin(identity());
    expect(guard.isCurrent(token, identity())).toBe(true);
  });

  it("rejects a continuation after the group id changes", () => {
    const guard = new RoutingPageOperationGuard();
    const token = guard.begin(identity());
    expect(guard.isCurrent(token, identity({ routingGroupId: "G2" }))).toBe(false);
  });

  it("rejects a continuation after the variation changes", () => {
    const guard = new RoutingPageOperationGuard();
    const token = guard.begin(identity());
    expect(guard.isCurrent(token, identity({ variationId: "V1" }))).toBe(false);
  });

  it("rejects a continuation targeting a different editor instance", () => {
    const guard = new RoutingPageOperationGuard();
    const token = guard.begin(identity());
    expect(guard.isCurrent(token, identity({ editor: editorB }))).toBe(false);
  });

  it("rejects a continuation once the guard is invalidated, even with an identical identity", () => {
    const guard = new RoutingPageOperationGuard();
    const token = guard.begin(identity());
    guard.invalidate();
    expect(guard.isCurrent(token, identity())).toBe(false);
  });

  it("rejects an earlier token once a newer operation begins", () => {
    const guard = new RoutingPageOperationGuard();
    const first = guard.begin(identity());
    const second = guard.begin(identity());
    expect(guard.isCurrent(first, identity())).toBe(false);
    expect(guard.isCurrent(second, identity())).toBe(true);
  });

  it("rejects a continuation when no identity is available anymore", () => {
    const guard = new RoutingPageOperationGuard();
    const token = guard.begin(identity());
    expect(guard.isCurrent(token, null)).toBe(false);
  });

  it("runCurrent re-checks identity after the awaited step settles", async () => {
    const guard = new RoutingPageOperationGuard();
    const token = guard.begin(identity());
    await expect(
      guard.runCurrent(token, () => identity(), async () => {
        guard.invalidate();
        return "value";
      })
    ).rejects.toBeInstanceOf(StaleRoutingPageOperationError);
  });

  it("runCurrent returns the step result while the operation stays current", async () => {
    const guard = new RoutingPageOperationGuard();
    const token = guard.begin(identity());
    await expect(guard.runCurrent(token, () => identity(), async () => "value")).resolves.toBe("value");
  });

  it("cancels a cached-page continuation that leaves and re-enters the same identity", async () => {
    const guard = new RoutingPageOperationGuard();
    const token = guard.begin(identity());
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    const continuation = guard.runCurrent(token, () => identity(), () => pending);

    // Ionic may restore the same group/editor identity, but leaving still starts a new ownership era.
    guard.invalidate();
    finish();

    await expect(continuation).rejects.toBeInstanceOf(StaleRoutingPageOperationError);
  });

  it("isStaleRoutingPageOperation identifies only the guard's own cancellation signal", () => {
    expect(isStaleRoutingPageOperation(new StaleRoutingPageOperationError())).toBe(true);
    expect(isStaleRoutingPageOperation(new Error("other"))).toBe(false);
  });
});
