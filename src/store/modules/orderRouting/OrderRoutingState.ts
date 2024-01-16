export default interface OrderRoutingState {
  groups: Array<any>; // runs
  routes: Array<any>;
  rule: Array<any>;
  currentGroupId: string;
  currentRouteId: string;
}