import { createI18n, LocaleMessages, VueMessageType } from "vue-i18n"

/**
 * Load locale messages
 * 
 * The loaded `JSON` locale messages is pre-compiled by `@intlify/vue-i18n-loader`, which is integrated into `vue-cli-plugin-i18n`.
 * See: https://github.com/intlify/vue-i18n-loader#rocket-i18n-resource-pre-compilation
 */
function loadLocaleMessages(): LocaleMessages<VueMessageType> {
  const locales = import.meta.glob('./locales/*.json', { eager: true }) as Record<string, any>
  const messages: LocaleMessages<VueMessageType> = {}
  Object.keys(locales).forEach(key => {
    const matched = key.match(/([A-Za-z0-9-_]+)\./i)
    if (matched && matched.length > 1) {
      const locale = matched[1]
      messages[locale] = locales[key].default || locales[key]
    }
  })
  return messages
}

const i18n = createI18n({
  locale: import.meta.env.VITE_VUE_APP_I18N_LOCALE || "en",
  fallbackLocale: import.meta.env.VITE_VUE_APP_I18N_FALLBACK_LOCALE || "en",
  messages: loadLocaleMessages()
})

// TODO Check if this is needed in updated versions
// Currently this method is added to be used in ts files
const translate = (key: string) => {
  if (!key) {
    return "";
  }
  return i18n.global.t(key);
};

export { i18n as default, translate }