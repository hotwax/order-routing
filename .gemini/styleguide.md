# Order Routing Style Guide

## Ionic Item Labels

- Do not wrap the primary text of an `ion-item` in heading tags such as `h1`, `h2`, or `h3`.
- Use the default Ionic item label pattern for row/menu/list primary text:

```vue
<ion-item>
  <ion-label>
    {{ primaryText }}
    <p>{{ secondaryText }}</p>
  </ion-label>
</ion-item>
```

- Use real section-heading components for actual sections, such as `ion-list-header`, `ion-item-divider`, `ion-card-title`, or a heading outside the `ion-item`.
- If an editable item title needs conditional display, keep the visible string as raw label content, for example with `template v-if`, and keep the input as the editing control.
