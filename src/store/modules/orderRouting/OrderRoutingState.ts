import { Group, RouteFilter } from "@/types";

export default interface OrderRoutingState {
  groups: Array<any>; // runs
  routes: Array<any>;
  rules: Array<any>;
  currentGroup: any;
  currentRoute: any;
  currentRouteFilters: {
    [key: string]: {  // conditionTypeEnumId as key
      [key: string]: RouteFilter  // enumCode/fieldName as key
    }
  };
  ruleConditions: {};
  ruleActions: {}
}