const HtmlWebpackPlugin = require('html-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')

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
        test: require.resolve('./app/vendor/jquery'),
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
            presets: [ [ 'env', {
              targets: {
                browsers: 'since 2017',
              },
            } ] ],
          },
        },
      },
      {
        test: /\.woff2$/,
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
    })
  ]
}
