import { Enumeration } from "@/types";

export default interface UtilState {
  enums: {
    [key: string]: {
      [key: string]: Enumeration
    }
  };
  facilities: object;
}