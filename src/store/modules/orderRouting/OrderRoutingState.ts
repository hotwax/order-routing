export default interface OrderRoutingState {
  groups: Array<any>; // runs
  routes: Array<any>;
  rules: Array<any>;
  currentGroupId: string;
  currentRouteId: string;
}