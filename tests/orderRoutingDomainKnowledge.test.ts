import assert from "assert";
import {
  getOrderRoutingDomainKnowledge,
  loadOrderRoutingDomainKnowledge,
  requireOrderRoutingDomainKnowledge
} from "../mastra/orderRoutingDomainKnowledge";

{
  const knowledge = loadOrderRoutingDomainKnowledge();
  assert.ok(knowledge.includes("HotWax Commerce"));
  assert.ok(knowledge.includes("Order Routing Engine"));
}

{
  // The full YAML is now returned uncached-trimmed; verify wrapper preamble
  // and a representative content marker are present.
  const excerpt = getOrderRoutingDomainKnowledge();
  assert.ok(excerpt.includes("Order-routing knowledge base context."));
  assert.ok(excerpt.includes("hotwax_order_routing_domain_knowledge.yaml"));
  assert.ok(excerpt.includes("page capability manifest"));
  assert.ok(excerpt.includes("marketplace"));
  assert.ok(excerpt.includes("warehouse"));
}

{
  const excerpt = requireOrderRoutingDomainKnowledge();
  assert.ok(excerpt.includes("Order-routing knowledge base context."));
}

console.log("Order routing domain knowledge tests passed");
