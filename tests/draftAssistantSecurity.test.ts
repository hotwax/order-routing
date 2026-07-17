import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.fn();

vi.mock("@common", () => ({
  client: (...args: any[]) => client(...args),
}));

import {
  requestBrokeringRouteDraftOperations,
  requestBrokeringRunsListInquiry,
} from "../src/services/DraftAssistantService";

const manifest = {
  pageId: "order-routing.test",
  route: "/order-routing/TEST",
  visibleEntities: {},
  editableTargets: [],
  outputContract: { operations: [], operationShape: {} },
} as any;

describe("DraftAssistantService production trust boundary", () => {
  beforeEach(() => {
    client.mockReset();
    vi.stubEnv("VITE_DRAFT_ASSISTANT_ENABLED", "true");
    vi.stubEnv("VITE_MASTRA_URL", "https://circuit.example.test");
  });

  afterEach(() => vi.unstubAllEnvs());

  it("never forwards the browser's OMS URL or bearer token in route-assistant requests", async () => {
    client.mockResolvedValue({
      data: {
        schemaVersion: "brokering-route-assistant.v1",
        intent: "inquiry",
        message: "No changes requested.",
        questions: [],
      },
    });

    await requestBrokeringRouteDraftOperations("Explain this route", manifest);

    const request = client.mock.calls[0][0];
    expect(request.baseURL).toBe("https://circuit.example.test");
    expect(request.data).not.toHaveProperty("authToken");
    expect(request.data).not.toHaveProperty("omsBaseUrl");
    expect(Object.keys(request.headers)).toEqual(["Content-Type"]);
  });

  it("sends only safe variation context and strips live group scheduling state", async () => {
    client.mockResolvedValue({
      data: {
        schemaVersion: "brokering-route-assistant.v1",
        intent: "inquiry",
        message: "Variation context received.",
        questions: [],
      },
    });
    const variationManifest = {
      ...manifest,
      editableTargets: [
        { target: "route.statusId", label: "Route status", valueType: "string", editable: true },
        { target: "routingGroup.statusId", label: "Group status", valueType: "string", editable: true }
      ],
      context: { mode: "variation", variationId: "VM100005", routingGroupId: "M100255" },
      visibleEntities: {
        route: { orderRoutingId: "VM100005_100008" },
        brokeringRun: {
          routingGroupId: "M100255",
          schedule: { jobName: "live-job" },
          availableSiblingRoutings: []
        }
      }
    } as any;

    await requestBrokeringRouteDraftOperations("Explain this variation", variationManifest);

    const body = client.mock.calls[0][0].data;
    expect(body.pageCapabilityManifest.context).toEqual({
      mode: "variation",
      variationId: "VM100005",
      routingGroupId: "M100255",
      unavailableOperations: ["newRouting", "cloneRouting", "schedule", "liveRun", "groupStatus"]
    });
    expect(body.pageCapabilityManifest.visibleEntities.brokeringRun.schedule).toBeNull();
    expect(body.pageCapabilityManifest.editableTargets.map((target: any) => target.target)).toEqual(["route.statusId"]);
    expect(body.pageCapabilityManifest.context).not.toHaveProperty("authToken");
    expect(body.pageCapabilityManifest.context).not.toHaveProperty("omsBaseUrl");
  });

  it("never forwards OMS credentials in runs-list inquiry requests", async () => {
    client.mockResolvedValue({ data: { message: "", questions: [], summary: "" } });

    await requestBrokeringRunsListInquiry("Which groups are active?", manifest);

    const request = client.mock.calls[0][0];
    expect(request.data).toEqual({
      prompt: "Which groups are active?",
      conversationHistory: [],
      pageCapabilityManifest: manifest,
    });
  });

  it("makes no request when the assistant is not explicitly enabled", async () => {
    vi.stubEnv("VITE_DRAFT_ASSISTANT_ENABLED", "false");

    await expect(requestBrokeringRouteDraftOperations("Explain this route", manifest))
      .rejects.toThrow("VITE_DRAFT_ASSISTANT_ENABLED");
    expect(client).not.toHaveBeenCalled();
  });

  it("rejects an insecure remote assistant URL before network", async () => {
    vi.stubEnv("VITE_MASTRA_URL", "http://circuit.example.test");

    await expect(requestBrokeringRouteDraftOperations("Explain this route", manifest))
      .rejects.toThrow("must use HTTPS");
    expect(client).not.toHaveBeenCalled();
  });
});
