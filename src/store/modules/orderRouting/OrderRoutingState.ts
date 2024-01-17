import { RouteFilter } from "@/types";

export default interface OrderRoutingState {
  groups: Array<any>; // runs
  routes: Array<any>;
  rules: Array<any>;
  currentGroupId: string;
  currentRouteId: string;
  currentRouteFilters: {
    [key: string]: {  // conditionTypeEnumId as key
      [key: string]: RouteFilter  // enumCode/fieldName as key
    }
  };
}