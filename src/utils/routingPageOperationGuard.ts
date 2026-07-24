export interface RoutingPageOperationIdentity {
  routingGroupId: string;
  variationId: string;
  editor: object;
}

export interface RoutingPageOperationToken extends RoutingPageOperationIdentity {
  generation: number;
}

/**
 * Raised when an async continuation no longer belongs to the visible routing editor that started it.
 * This is an expected cancellation signal, not a user-facing request failure.
 */
export class StaleRoutingPageOperationError extends Error {
  constructor() {
    super("Routing page operation is no longer current.");
    this.name = "StaleRoutingPageOperationError";
  }
}

/**
 * A generation + identity guard for the Ionic-cached routing detail page. A route instance may stay
 * mounted after it becomes hidden, so a generation alone is insufficient: continuations must still
 * target the same group, variation and concrete editor instance as the operation that started them.
 */
export class RoutingPageOperationGuard {
  private generation = 0;

  begin(identity: RoutingPageOperationIdentity): RoutingPageOperationToken {
    this.generation += 1;
    return { ...identity, generation: this.generation };
  }

  invalidate(): void {
    this.generation += 1;
  }

  isCurrent(
    token: RoutingPageOperationToken,
    identity: RoutingPageOperationIdentity | null
  ): boolean {
    return Boolean(
      identity
      && token.generation === this.generation
      && token.routingGroupId === identity.routingGroupId
      && token.variationId === identity.variationId
      && token.editor === identity.editor
    );
  }

  assertCurrent(
    token: RoutingPageOperationToken,
    identity: RoutingPageOperationIdentity | null
  ): void {
    if (!this.isCurrent(token, identity)) {
      throw new StaleRoutingPageOperationError();
    }
  }

  /** Check immediately before starting a step and again after its promise settles. */
  async runCurrent<T>(
    token: RoutingPageOperationToken,
    getIdentity: () => RoutingPageOperationIdentity | null,
    step: () => T | Promise<T>
  ): Promise<T> {
    this.assertCurrent(token, getIdentity());
    const result = await step();
    this.assertCurrent(token, getIdentity());
    return result;
  }
}

export function isStaleRoutingPageOperation(error: unknown): boolean {
  return error instanceof StaleRoutingPageOperationError;
}
