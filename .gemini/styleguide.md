# Gemini Style Guide

## Ionic Item Labels

- In ordinary `ion-item` rows, menu items, and list items, do not wrap the primary item string in `h1`, `h2`, `h3`, or other heading tags.
- Use Ionic's native label structure for item text: `ion-item > ion-label > {{ primaryText }}`.
- Keep secondary item details in `<p>` inside the same `ion-label`.
- Reserve heading tags for real page, card, and section headings. If a heading-like label is only identifying a row in a list or menu, it should use the default `ion-label` text instead.
- Before making app-wide typography edits, classify each `ion-item` heading as either an ordinary item label or an intentional page/section/detail title. Do not mechanically rewrite all headings.
