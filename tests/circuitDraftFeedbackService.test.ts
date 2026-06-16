import assert from "assert";
import {
  buildDiscardFeedbackPrompt,
  buildFeedbackRevisionMessage,
  buildFeedbackRevisionPrompt,
  buildFeedbackSavedMessage
} from "../src/util/circuitFeedback";

{
  const message = buildDiscardFeedbackPrompt({ summary: "Queue: Brokering Queue" });
  assert.ok(message.includes("Proposal discarded."));
  assert.ok(message.includes("Queue: Brokering Queue"));
  assert.ok(message.includes("What should Circuit change next time?"));
}

{
  const message = buildDiscardFeedbackPrompt({});
  assert.ok(message.includes("Proposal discarded."));
  assert.ok(message.includes("What should Circuit change next time?"));
}

{
  assert.equal(buildFeedbackSavedMessage(), "Feedback saved. I will use it to improve future proposals.");
}

{
  const message = buildFeedbackRevisionPrompt(
    "i only want to ship orders out of my warehouse",
    "I do not want to filter orders. just inventory location",
    { summary: "Queue filter: Brokering Queue; Inventory facility group filter: All Warehouses" }
  );
  assert.ok(message.includes("Original request: i only want to ship orders out of my warehouse"));
  assert.ok(message.includes("Discarded proposal: Queue filter: Brokering Queue; Inventory facility group filter: All Warehouses"));
  assert.ok(message.includes("User feedback: I do not want to filter orders. just inventory location"));
  assert.ok(message.includes("Do not include changes that the feedback rejected."));
}

{
  const message = buildFeedbackRevisionMessage("Proposed draft changes:\n- Inventory facility group filter: All Warehouses", true);
  assert.ok(message.startsWith("Feedback saved. I created a revised proposal from your original request."));
  assert.ok(message.includes("Inventory facility group filter: All Warehouses"));
}

console.log("Circuit draft feedback service tests passed");
