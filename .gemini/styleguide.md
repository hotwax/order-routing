# Order Routing Style Guide

## Ionic Item Labels

- In ordinary `ion-item` rows, menu items, and list items, do not wrap the primary item string in `h1`, `h2`, `h3`, or other heading tags.
- Use Ionic's native label structure for item text: `ion-item > ion-label > {{ primaryText }}`:

```vue
<ion-item>
  <ion-label>
    {{ primaryText }}
    <p>{{ secondaryText }}</p>
  </ion-label>
</ion-item>
```

- Keep secondary item details in `<p>` inside the same `ion-label`.
- Use real section-heading components for actual sections, such as `ion-list-header`, `ion-item-divider`, `ion-card-title`, or a heading outside the `ion-item`. Reserve heading tags for real page, card, and section headings. If a heading-like label is only identifying a row in a list or menu, it should use the default `ion-label` text instead.
- If an editable item title needs conditional display, keep the visible string as raw label content, for example with `template v-if`, and keep the input as the editing control.
- Before making app-wide typography edits, classify each `ion-item` heading as either an ordinary item label or an intentional page/section/detail title. Do not mechanically rewrite all headings.
