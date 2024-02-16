import OrderRoutingState from "./modules/orderRouting/OrderRoutingState";
import UtilState from "./modules/util/UtilState";

export default interface RootState {
  user: any;
  util: UtilState;
  orderRouting: OrderRoutingState;
}