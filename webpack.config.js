/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
'use strict';

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require('path');

const browserClientConfig = /** @type WebpackConfig */ {
	context: path.join(__dirname),
	mode: 'none',
	target: 'webworker', // web extensions run in a webworker context
	entry: {
		browserClientMain: './src/worker-extension.ts',
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, 'dist', 'web', 'client'),
		libraryTarget: 'commonjs',
	},
	resolve: {
		mainFields: ['module', 'main'],
		extensions: ['.ts', '.js'], // support ts-files and js-files
		alias: {},
		fallback: {
			path: require.resolve('path-browserify'),
		},
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
					},
				],
			},
		],
	},
	externals: {
		vscode: 'commonjs vscode', // ignored because it doesn't exist
	},
	performance: {
		hints: false,
	},
	devtool: 'source-map',
};

const browserServerConfig = /** @type WebpackConfig */ {
	context: path.join(__dirname, 'node_modules', '@lifeart/ember-language-server'),
	mode: 'none',
	target: 'webworker', // web extensions run in a webworker context
	entry: {
		browserServerMain: './src/start-worker-server.ts',
	},
	output: {
		filename: '[name].js',
		path: path.join(__dirname, 'dist',  'web', 'server'),
		libraryTarget: 'var',
		library: 'serverExportVar',
	},
	resolve: {
		mainFields: ['module', 'main'],
		extensions: ['.ts', '.js'], // support ts-files and js-files
		alias: {},
		fallback: {
			path: require.resolve("path-browserify"),
      util: require.resolve("util"),
      os: require.resolve("os-browserify/browser"),
      fs: require.resolve("browserify-fs"),
      tty: false,
      assert: false,
      debug: false,
      net: false,
      stream: false,
      'is-typed-array': require.resolve('is-typed-array'),
      'which-typed-array': require.resolve('which-typed-array'),
      'is-generator-function': require.resolve('is-generator-function'),
      'is-arguments': require.resolve('is-arguments'),
      'available-typed-arrays': require.resolve('available-typed-arrays'),
      'foreach': require.resolve('foreach'),
      'array-filter': require.resolve('array-filter'),
		},
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: 'ts-loader',
					},
				],
			},
		],
	},
	externals: {
		vscode: 'commonjs vscode', // ignored because it doesn't exist
	},
	performance: {
		hints: false,
	},
	devtool: 'source-map',
};

// browserServerConfig
module.exports = [browserClientConfig];
