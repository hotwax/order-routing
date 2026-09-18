// Imported by subpath rather than through the @common barrel so this stays usable from tests that
// need the real helpers instead of a mocked module.
import { commonUtil } from "@common/utils/commonUtil";

/**
 * Whether a Quartz expression is safe to persist as a schedule.
 *
 * commonUtil.getCronString() catches its own error and returns "", so wrapping it in a try/catch
 * reports every non-empty string as valid. Validity has to come from parseCronExpression(), which
 * does throw, and a describable expression is required on top of that because a form such as
 * "* * * *" parses but yields no cron string. This is the same pair of checks ScheduleModal.vue
 * applies before enabling its save action.
 */
export function isCronExpressionValid(expression: string, timeZone?: string): boolean {
  if (!expression) return false;
  try {
    commonUtil.parseCronExpression(expression, timeZone);
  } catch (_error) {
    return false;
  }
  return Boolean(commonUtil.getCronString(expression));
}
