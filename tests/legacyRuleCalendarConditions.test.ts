import { describe, expect, it } from "vitest";

import {
  buildLegacyRuleConditions,
  getRuleConditionsToRemove,
} from "../src/utils/legacyRuleCalendarConditions";

describe("legacy rule calendar conditions", () => {
  it("keeps a persisted calendar condition when its comparison operator changes", () => {
    const currentConditions = [
      {
        conditionSeqId: "02",
        conditionTypeEnumId: "ENTCT_PSP_DATE_SINCE",
        fieldName: "releaseDate",
        operator: "less-than-equal-to",
        fieldValue: "14",
      },
    ];

    const updatedConditions = buildLegacyRuleConditions({
      ruleId: "CAL_TEST_RULE",
      generatedConditions: [],
      calendarConditions: [
        {
          conditionTypeEnumId: "ENTCT_PSP_DATE_SINCE",
          fieldName: "releaseDate",
          operator: "greater-than",
          fieldValue: "14",
        },
      ],
      currentConditions,
    });

    expect(updatedConditions).toEqual([
      {
        conditionSeqId: "02",
        conditionTypeEnumId: "ENTCT_PSP_DATE_SINCE",
        fieldName: "releaseDate",
        operator: "greater-than",
        fieldValue: "14",
        ruleId: "CAL_TEST_RULE",
      },
    ]);
    expect(getRuleConditionsToRemove(currentConditions, updatedConditions)).toEqual([]);
  });

  it("adds both calendar date directions alongside generated legacy conditions", () => {
    const generatedConditions = [
      {
        conditionTypeEnumId: "ENTCT_ATP_FACILITIES",
        fieldName: "facilityId",
        operator: "equals",
        fieldValue: "ALL",
      },
    ];

    const updatedConditions = buildLegacyRuleConditions({
      ruleId: "NEW_CALENDAR_RULE",
      generatedConditions,
      calendarConditions: [
        {
          conditionTypeEnumId: "ENTCT_PSP_DATE_SINCE",
          fieldName: "releaseDate",
          operator: "less-than-equal-to",
          fieldValue: "14",
        },
        {
          conditionTypeEnumId: "ENTCT_PSP_DATE_TILL",
          fieldName: "salesDiscontinuationDate",
          operator: "greater-than",
          fieldValue: "30",
        },
      ],
      currentConditions: [],
    });

    expect(updatedConditions).toEqual([
      { ...generatedConditions[0], ruleId: "NEW_CALENDAR_RULE" },
      {
        conditionTypeEnumId: "ENTCT_PSP_DATE_SINCE",
        fieldName: "releaseDate",
        operator: "less-than-equal-to",
        fieldValue: "14",
        ruleId: "NEW_CALENDAR_RULE",
      },
      {
        conditionTypeEnumId: "ENTCT_PSP_DATE_TILL",
        fieldName: "salesDiscontinuationDate",
        operator: "greater-than",
        fieldValue: "30",
        ruleId: "NEW_CALENDAR_RULE",
      },
    ]);
  });
});
