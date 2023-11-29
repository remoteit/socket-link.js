const {RawSource} = require('webpack-sources')
const path = require('path')

module.exports = {
  target: 'node',
  mode: 'production',
  entry: {
    index: './src/index.ts',
    cli: './src/cli.ts'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
    library: {type: 'commonjs'}
  },
  optimization: {
    minimize: true
  },
  plugins: [
    {
      apply: (compiler) => {
        compiler.hooks.emit.tapAsync('AddShebangPlugin', (compilation, callback) => {
          const assetName = 'cli.js'
          if (compilation.assets[assetName]) {
            let originalSource = compilation.assets[assetName].source()
            originalSource = '#!/usr/bin/env node\n' + originalSource
            compilation.assets[assetName] = new RawSource(originalSource)
          }
          callback()
        })
      }
    }
  ]
}
