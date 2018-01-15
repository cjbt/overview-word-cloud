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
