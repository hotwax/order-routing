import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const client = vi.fn();
const getMaargURL = vi.fn();
const getToken = vi.fn();
const isAuthenticated = vi.fn();

vi.mock("@common", () => ({
  client: (...args: any[]) => client(...args),
  commonUtil: { getMaargURL: () => getMaargURL(), getToken: () => getToken() },
  useAuth: () => ({ isAuthenticated: { value: isAuthenticated() } }),
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
    isAuthenticated.mockReturnValue(true);
    getMaargURL.mockReturnValue("https://maarg.example.test/rest/s1/");
    getToken.mockReturnValue("test-user-token");
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
    expect(request.data.pageCapabilityManifest).not.toHaveProperty("context");
    expect(request.data.pageCapabilityManifest.visibleEntities.assistantContext).toEqual({ mode: "live" });
    expect(Object.keys(request.headers)).toEqual(["Content-Type"]);
  });

  it("moves safe variation context into the extensible visible entities and strips live group scheduling state", async () => {
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
    expect(body.pageCapabilityManifest).not.toHaveProperty("context");
    expect(body.pageCapabilityManifest.visibleEntities.assistantContext).toEqual({
      mode: "variation",
      variationId: "VM100005",
      routingGroupId: "M100255",
      unavailableOperations: ["newRouting", "cloneRouting", "schedule", "liveRun", "groupStatus"]
    });
    expect(body.pageCapabilityManifest.visibleEntities.brokeringRun.schedule).toBeNull();
    expect(body.pageCapabilityManifest.editableTargets.map((target: any) => target.target)).toEqual(["route.statusId"]);
    expect(body.pageCapabilityManifest.visibleEntities.assistantContext).not.toHaveProperty("authToken");
    expect(body.pageCapabilityManifest.visibleEntities.assistantContext).not.toHaveProperty("omsBaseUrl");
  });

  it("delegates diagnostic reads through a header and a non-secret Maarg origin", async () => {
    client.mockResolvedValue({ data: { message: "", questions: [], summary: "" } });

    await requestBrokeringRunsListInquiry("Which groups are active?", manifest);

    const request = client.mock.calls[0][0];
    expect(request.data).toEqual({
      prompt: "Which groups are active?",
      conversationHistory: [],
      pageCapabilityManifest: manifest,
      omsInstance: "https://maarg.example.test",
    });
    expect(request.baseURL).toBe("https://circuit.example.test");
    expect(request.url).toBe("/brokering-runs-list-inquiry");
    expect(request.headers.Authorization).toBe("Bearer test-user-token");
    expect(JSON.stringify(request.data)).not.toContain("test-user-token");
    expect(request.data).not.toHaveProperty("authToken");
    expect(request.data).not.toHaveProperty("omsBaseUrl");
  });

  it.each([
    ["", "test-user-token"],
    ["https://maarg.example.test/rest/s1/", ""],
    ["not a URL", "test-user-token"],
    ["http://maarg.example.test/rest/s1/", "test-user-token"],
    ["https://user:password@maarg.example.test/rest/s1/", "test-user-token"],
  ])("omits diagnostic credentials for an unavailable or unsafe connection (%s)", async (maarg, token) => {
    getMaargURL.mockReturnValue(maarg);
    getToken.mockReturnValue(token);
    client.mockResolvedValue({ data: { message: "", questions: [], summary: "" } });

    await requestBrokeringRunsListInquiry("Explain the schedule", manifest);

    expect(client.mock.calls[0][0].data).not.toHaveProperty("omsInstance");
    expect(client.mock.calls[0][0].headers).toEqual({ "Content-Type": "application/json" });
  });

  it("refuses to pair a cached manifest with a changed user or OMS session", async () => {
    isAuthenticated.mockReturnValue(false);
    getMaargURL.mockReturnValue("https://second-maarg.example.test/rest/s1/");
    getToken.mockReturnValue("second-test-token");

    await expect(requestBrokeringRunsListInquiry("Show recent runs", manifest))
      .rejects.toThrow("Refresh this page");
    expect(client).not.toHaveBeenCalled();
  });

  it("reads the current session on each diagnostic request", async () => {
    client.mockResolvedValue({ data: { message: "", questions: [], summary: "" } });
    await requestBrokeringRunsListInquiry("Show recent runs", manifest);
    getMaargURL.mockReturnValue("https://second-maarg.example.test/rest/s1/");
    getToken.mockReturnValue("second-test-token");
    await requestBrokeringRunsListInquiry("Show recent runs", manifest);
    expect(client.mock.calls[1][0].data.omsInstance).toBe("https://second-maarg.example.test");
    expect(client.mock.calls[1][0].headers.Authorization).toBe("Bearer second-test-token");
  });

  it("makes no request when the assistant is not explicitly enabled", async () => {
    vi.stubEnv("VITE_DRAFT_ASSISTANT_ENABLED", "false");

    await expect(requestBrokeringRouteDraftOperations("Explain this route", manifest))
      .rejects.toThrow("VITE_DRAFT_ASSISTANT_ENABLED");
    await expect(requestBrokeringRunsListInquiry("Show recent runs", manifest))
      .rejects.toThrow("VITE_DRAFT_ASSISTANT_ENABLED");
    expect(client).not.toHaveBeenCalled();
  });

  it("rejects an insecure remote assistant URL before network", async () => {
    vi.stubEnv("VITE_MASTRA_URL", "http://circuit.example.test");

    await expect(requestBrokeringRouteDraftOperations("Explain this route", manifest))
      .rejects.toThrow("must use HTTPS");
    await expect(requestBrokeringRunsListInquiry("Show recent runs", manifest))
      .rejects.toThrow("must use HTTPS");
    expect(client).not.toHaveBeenCalled();
  });
});
