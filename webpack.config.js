const HtmlWebpackPlugin = require('html-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
  context: __dirname + '/app',
  devtool: 'source-map',
  entry: './show.js',
  output: {
    path: __dirname + '/dist',
    filename: 'show.[chunkhash].js',
  },
  module: {
    rules: [
      {
        test: require.resolve('jquery'),
        use: [{
          loader: 'expose-loader',
          options: 'jQuery',
        }],
      },
      {
        test: /\.js$/,
        exclude: /\bnode_modules\b/,
        use: {
          loader: 'babel-loader',
          options: {
            //presets: [ [ 'env', {
            //  targets: {
            //    browsers: 'since 2017',
            //  },
            //} ] ],
            plugins: [
              require("babel-plugin-transform-es2015-template-literals"),
              require("babel-plugin-transform-es2015-literals"),
              require("babel-plugin-transform-es2015-function-name"),
              require("babel-plugin-transform-es2015-arrow-functions"),
              require("babel-plugin-transform-es2015-block-scoped-functions"),
              require("babel-plugin-transform-es2015-classes"),
              require("babel-plugin-transform-es2015-object-super"),
              require("babel-plugin-transform-es2015-shorthand-properties"),
              require("babel-plugin-transform-es2015-computed-properties"),
              require("babel-plugin-transform-es2015-for-of"),
              require("babel-plugin-transform-es2015-sticky-regex"),
              require("babel-plugin-transform-es2015-unicode-regex"),
              require("babel-plugin-check-es2015-constants"),
              require("babel-plugin-transform-es2015-spread"),
              require("babel-plugin-transform-es2015-parameters"),
              require("babel-plugin-transform-es2015-destructuring"),
              require("babel-plugin-transform-es2015-block-scoping"),
              require("babel-plugin-transform-es2015-typeof-symbol"),
              // Nix CommonJS-ness so Babel can do some tree-shaking
              //require("babel-plugin-transform-es2015-modules-commonjs"),
              [require("babel-plugin-transform-regenerator"), { async: false, asyncGenerators: false }],
            ],
          },
        },
      },
      {
        test: /\.(woff2|png)$/,
        use: 'base64-inline-loader',
      },
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [ 'css-loader' ],
        }),
      },
    ],
  },
  plugins: [
    new ExtractTextPlugin({
      filename: '[name].[contenthash].css',
    }),
    new HtmlWebpackPlugin({
      title: 'Word Cloud',
      filename: 'show',
      template: 'show.html',
      cache: false,
    }),
    new UglifyJsPlugin({
      uglifyOptions: {
        compress: {
          ecma: 6,
        },
        output: {
          ecma: 6,
        },
      },
    }),
  ]
}
