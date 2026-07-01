---
trigger: always_on
---

# Ionic UI Dev

To maintain consistency and leverage the full power of the Ionic Framework, the following rules MUST be followed when writing CSS or styling components:

## 1. No Custom Typography
- **Prohibited**: Do not write CSS to customize `font-family`, `font-size`, `font-weight`, or `line-height` unless explicitly requested by the user for a specific brand requirement.
- **Preferred**: Use Ionic's built-in typography classes (e.g., `ion-text-capitalize`, `ion-text-center`) and reserve standard HTML headings (`h1`, `h2`, etc.) for real page, card, and section headings.
- **Variable Usage**: If adjustment is necessary, use Ionic's global CSS variables (e.g., `--ion-font-family`) instead of hardcoded values.

## 2. Leverage Native Ionic Components
- **Ionic First**: Always use native Ionic components (`ion-card`, `ion-button`, `ion-item`, etc.) instead of custom HTMl/CSS equivalents.
- **No Custom Stylings**: Do not apply custom CSS to modify the visual appearance (borders, box-shadows, padding, margins) of Ionic components like `ion-card` or `ion-list` without an explicit user request.
- **Attribute-Based Styling**: Use Ionic's component attributes (e.g., `color="primary"`, `fill="outline"`, `lines="none"`) to modify appearance.
- **Item Labels**: For ordinary `ion-item` rows, menu items, and list items, do not wrap the primary item string in `h1`, `h2`, `h3`, or other heading tags. Use Ionic's native label pattern: `ion-item > ion-label > {{ primaryText }}`, with secondary values in `<p>`.

## 3. Use Ionic CSS Variables
- When custom styling is unavoidable, you MUST use Ionic's CSS custom properties (variables) to ensure theme compatibility (e.g., `--ion-color-primary`, `--ion-background-color`).
- Avoid hardcoding hex or RGB colors.

## 4. Design System Consistency
- Ensure all UI elements adhere to the Material Design (MD) or iOS styling provided by Ionic based on the platform.
- Do not attempt to "override" the framework's default look and feel to make it look "premium" unless specifically directed to create a bespoke design.

## 5. Explicit Request Exception
- These rules only apply to autonomous code generation. If the user explicitly asks to "change the font to Inter" or "make the cards have a red border", you may proceed with the specific request.
