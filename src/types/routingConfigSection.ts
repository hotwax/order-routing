export type RoutingConfigSectionItem = {
  target: string;
  label: string;
  value: string;
  dirty: boolean;
};

export type RoutingConfigSectionKind = "filters" | "sort" | "partial" | "unavailable" | "routing" | "rule";

export type RoutingConfigSection = {
  key: string;
  eyebrow: string;
  title: string;
  kind: RoutingConfigSectionKind;
  items: RoutingConfigSectionItem[];
};
