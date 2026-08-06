/**
 * App actions mapped to the server permissions they require.
 *
 * Views, components and routes should always refer to an action from this file instead of
 * hardcoding a server permission, so that a permission change is a one line change here.
 *
 * The value is the permission expression evaluated by `hasPermission` of the user store.
 * It supports the `OR` and `AND` operators, and an empty value means the action is allowed
 * for every logged in user.
 */
export default {
  APP_TEST_DRIVE_VIEW: "ROUTING_TEST_DRIVE_VIEW",
  APP_PRODUCT_IDENTIFIER_UPDATE: "COMMON_ADMIN",
  APP_PWA_STANDALONE_ACCESS: "COMMON_ADMIN"
} as const satisfies Record<string, string>
