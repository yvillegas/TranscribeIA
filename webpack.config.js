const path = require("path");
const webpack = require("webpack");
const Dotenv = require("dotenv-webpack");

module.exports = {
  entry: "./src/app.js",
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "/public"),
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        resolve: {
          fullySpecified: false, // Desactiva el requisito de fully specified para importar módulos
        },
      },
    ],
  },
  resolve: {
    extensions: [".js", ".mjs", ".json"],
    fallback: {
      buffer: require.resolve("buffer/"), // Polyfill buffer
      process: require.resolve("process/browser"), // Polyfill process
      fs: false,
      os: false,
      path: false,
      crypto: false,
    },
  },
  plugins: [
    new Dotenv(),
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"], // Provide Buffer globally
      process: "process/browser", // Provide process globally
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, "/public"),
    },
    port: 3000,
  },
  mode: "production",
};
