import assert from "assert";
import {
  TOOL_FACTORIES,
  prefetchToolContext,
  resolveRequiredTools,
  type CanonicalToolId,
  type RunsListIntent
} from "../mastra/runsListInquiryContext";

const ALL_TOOLS: CanonicalToolId[] = [
  "facility_change_summary",
  "brokering_facility_groups",
  "product_store_settings",
  "facility_order_limits"
];

const OMS = "https://oms.example.test/api";
const TOKEN = "test-token";
const STORE = "STORE_1";

type FetchHandler = (url: string, init?: RequestInit) => Promise<Response>;

function installFetch(handler: FetchHandler): { restore: () => void; calls: string[] } {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    return handler(url, init);
  }) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = original;
    },
    calls
  };
}

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    url: "",
    json: async () => body,
    text: async () => JSON.stringify(body)
  } as unknown as Response;
}

function notFoundResponse(url: string): Response {
  return {
    ok: false,
    status: 404,
    url,
    json: async () => ({}),
    text: async () => "not found"
  } as unknown as Response;
}

(async () => {
  // resolveRequiredTools — intent defaults (no pattern match)

  assert.deepEqual(
    resolveRequiredTools({ intent: "config_lookup", matchedPatternId: null, patterns: [] }),
    []
  );

  assert.deepEqual(
    resolveRequiredTools({
      intent: "behavior_diagnostic",
      matchedPatternId: null,
      patterns: []
    }),
    ["facility_change_summary"]
  );

  assert.deepEqual(
    resolveRequiredTools({
      intent: "environmental_audit",
      matchedPatternId: null,
      patterns: []
    }),
    ["brokering_facility_groups", "product_store_settings", "facility_order_limits"]
  );

  assert.deepEqual(
    resolveRequiredTools({ intent: "recommendation", matchedPatternId: null, patterns: [] }),
    [
      "facility_change_summary",
      "brokering_facility_groups",
      "product_store_settings",
      "facility_order_limits"
    ]
  );

  // resolveRequiredTools — pattern match wins over intent default

  const patterns = [
    {
      id: "high_unfillable_rate",
      requires: ALL_TOOLS
    },
    {
      id: "facility_concentration",
      requires: [
        "facility_change_summary",
        "brokering_facility_groups",
        "facility_order_limits"
      ] as CanonicalToolId[]
    }
  ];

  assert.deepEqual(
    resolveRequiredTools({
      intent: "behavior_diagnostic",
      matchedPatternId: "high_unfillable_rate",
      patterns
    }),
    ALL_TOOLS
  );

  // Pattern returns its requires verbatim even when narrower than intent default.
  assert.deepEqual(
    resolveRequiredTools({
      intent: "recommendation",
      matchedPatternId: "facility_concentration",
      patterns
    }),
    ["facility_change_summary", "brokering_facility_groups", "facility_order_limits"]
  );

  // resolveRequiredTools — matchedPatternId set but not present in patterns array → intent default

  assert.deepEqual(
    resolveRequiredTools({
      intent: "behavior_diagnostic",
      matchedPatternId: "no_such_pattern",
      patterns
    }),
    ["facility_change_summary"]
  );

  // prefetchToolContext — all four succeed
  {
    const { restore, calls } = installFetch(async (url) => okResponse({ url, payload: "ok" }));
    const ctx = await prefetchToolContext({
      requiredTools: ALL_TOOLS,
      productStoreId: STORE,
      omsBaseUrl: OMS,
      authToken: TOKEN
    });
    restore();

    assert.equal(calls.length, ALL_TOOLS.length, "should have made one fetch per tool");
    for (const id of ALL_TOOLS) {
      const entry = ctx[id];
      assert.ok(entry, `expected ctx.${id} to exist`);
      if (!entry) continue;
      assert.equal(entry.ok, true);
      if (entry.ok) {
        assert.ok(entry.data, `expected ctx.${id}.data`);
      }
    }
  }

  // prefetchToolContext — one tool 404s, others succeed
  {
    const { restore } = installFetch(async (url) => {
      // The product-store settings endpoint URL contains "brokeringSettings"
      if (url.includes("brokeringSettings")) {
        return notFoundResponse(url);
      }
      return okResponse({ url });
    });

    const ctx = await prefetchToolContext({
      requiredTools: ALL_TOOLS,
      productStoreId: STORE,
      omsBaseUrl: OMS,
      authToken: TOKEN
    });
    restore();

    const settings = ctx.product_store_settings;
    assert.ok(settings, "settings entry must exist");
    if (settings) {
      assert.equal(settings.ok, false);
      if (!settings.ok) {
        assert.equal(settings.unavailable, true);
        assert.ok(
          typeof settings.reason === "string" && settings.reason.length > 0,
          "reason must be a non-empty string"
        );
      }
    }

    for (const id of ALL_TOOLS) {
      if (id === "product_store_settings") continue;
      const entry = ctx[id];
      assert.ok(entry, `expected ctx.${id} to exist`);
      if (entry) {
        assert.equal(entry.ok, true, `${id} should be ok`);
      }
    }
  }

  // prefetchToolContext — all four reject → four unavailable entries, no throw
  {
    const { restore } = installFetch(async (url) => notFoundResponse(url));
    let threw = false;
    let ctx: Awaited<ReturnType<typeof prefetchToolContext>> | null = null;
    try {
      ctx = await prefetchToolContext({
        requiredTools: ALL_TOOLS,
        productStoreId: STORE,
        omsBaseUrl: OMS,
        authToken: TOKEN
      });
    } catch {
      threw = true;
    }
    restore();

    assert.equal(threw, false, "prefetchToolContext must not throw on failures");
    assert.ok(ctx, "ctx must be returned");
    if (ctx) {
      for (const id of ALL_TOOLS) {
        const entry = ctx[id];
        assert.ok(entry, `expected ctx.${id} to exist`);
        if (!entry) continue;
        assert.equal(entry.ok, false);
        if (!entry.ok) {
          assert.equal(entry.unavailable, true);
          assert.equal(typeof entry.reason, "string");
        }
      }
    }
  }

  // prefetchToolContext — empty requiredTools → empty object, no fetch calls
  {
    const { restore, calls } = installFetch(async () => okResponse({}));
    const ctx = await prefetchToolContext({
      requiredTools: [],
      productStoreId: STORE,
      omsBaseUrl: OMS,
      authToken: TOKEN
    });
    restore();

    assert.deepEqual(ctx, {});
    assert.equal(calls.length, 0, "no fetch calls when requiredTools is empty");
  }

  // prefetchToolContext — unrequested tools are absent from the returned object
  {
    const { restore } = installFetch(async (url) => okResponse({ url }));
    const ctx = await prefetchToolContext({
      requiredTools: ["facility_change_summary"],
      productStoreId: STORE,
      omsBaseUrl: OMS,
      authToken: TOKEN
    });
    restore();

    assert.equal("facility_change_summary" in ctx, true);
    assert.equal("brokering_facility_groups" in ctx, false);
    assert.equal("product_store_settings" in ctx, false);
    assert.equal("facility_order_limits" in ctx, false);
  }

  // Exhaustiveness: TOOL_FACTORIES has exactly one entry per CanonicalToolId.
  {
    const expected: CanonicalToolId[] = [
      "brokering_facility_groups",
      "facility_change_summary",
      "facility_order_limits",
      "product_store_settings"
    ];
    const actual = (Object.keys(TOOL_FACTORIES) as CanonicalToolId[]).sort();
    assert.deepEqual(actual, expected.sort());
  }

  // Sanity: every intent has a default tool list defined (catches typos in the enum).
  {
    const intents: RunsListIntent[] = [
      "config_lookup",
      "behavior_diagnostic",
      "environmental_audit",
      "recommendation"
    ];
    for (const intent of intents) {
      const tools = resolveRequiredTools({ intent, matchedPatternId: null, patterns: [] });
      assert.ok(Array.isArray(tools), `${intent} must resolve to an array`);
    }
  }

  console.log("runsListInquiryContext tests passed");
})();
