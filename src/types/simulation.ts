/** A saved what-if branch and its lazily loaded copied routing group. */
export interface Variation {
  id: string;
  label: string;
  group: any;
  serverVid?: string;
}
