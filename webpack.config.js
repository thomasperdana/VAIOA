const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'development', // Use 'production' for production builds
  entry: './frontend/src/index.js', // Entry point of the application
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'frontend', 'dist'), // Output directory
    clean: true, // Clean the output directory before each build
  },
  devServer: {
    static: './frontend/dist', // Serve files from this directory
    port: 8080, // Port for the dev server
    open: true, // Open the browser automatically
    hot: true, // Enable Hot Module Replacement
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './frontend/src/index.html', // Template HTML file
      title: 'Bible Study Tool', // Title for the generated HTML
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'], // Loaders for CSS files
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif)$/i,
        type: 'asset/resource', // Handle image assets
      },
    ],
  },
  devtool: 'inline-source-map', // Enable source maps for debugging
};