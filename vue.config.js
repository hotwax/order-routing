const path = require('path')
require("@hotwax/app-version-info")

module.exports = {
  pwa: {
    name: "Order Routing - HotWax Commerce",
    themeColor: "#FFFFFF",
    manifestOptions: {
      short_name: "Order Routing",
      start_url: "./"
    },
    id: "/",
    display: "standalone",
    background_color: "#000000"
  },
  configureWebpack: {
    resolve: {
      alias: {
        vue: path.resolve('./node_modules/vue')
      }
    }
  },
  runtimeCompiler: true,
  transpileDependencies: ['@hotwax/dxp-components']
}
