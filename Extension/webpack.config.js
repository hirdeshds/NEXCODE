const path = require("path");

module.exports = {
	mode: "production",
	target: "node",
	entry: "./src/extension.ts",
	devtool: "nosources-source-map",
	externals: {
		vscode: "commonjs vscode",
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: "ts-loader",
			},
		],
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	output: {
		path: path.resolve(__dirname, "dist"),
		filename: "extension.js",
		libraryTarget: "commonjs2",
		clean: true,
	},
};
