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
  const excerpt = getOrderRoutingDomainKnowledge("marketplace orders should only go to warehouses", 12000);
  assert.ok(excerpt.includes("marketplace"));
  assert.ok(excerpt.includes("warehouse"));
  assert.ok(excerpt.includes("hotwax_order_routing_domain_knowledge.yaml"));
  assert.ok(excerpt.includes("page capability manifest"));
}

{
  const excerpt = getOrderRoutingDomainKnowledge("add a filter to exclude unfillable orders", 18000);
  assert.ok(excerpt.includes("Options listed under the same filter are valid choices"));
  assert.ok(excerpt.includes("semantic_tags"));
  assert.ok(excerpt.includes("lifecycle_role"));
}

{
  const excerpt = requireOrderRoutingDomainKnowledge("marketplace orders should only go to warehouses", 12000);
  assert.ok(excerpt.includes("Order-routing knowledge base context."));
  assert.throws(
    () => requireOrderRoutingDomainKnowledge("marketplace orders should only go to warehouses", 1),
    /knowledge base is unavailable/
  );
}

console.log("Order routing domain knowledge tests passed");
