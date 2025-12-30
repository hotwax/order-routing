import { Enumeration } from "@/types";

export default interface UtilState {
  enums: {
    [key: string]: {
      [key: string]: Enumeration
    }
  };
  categories: object;
  facilities: object;
  shippingMethods: object;
  facilityGroups: object;
  statuses: any;
  carriers: any;
}