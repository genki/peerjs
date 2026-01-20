/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	testEnvironment: "jsdom",
	transform: {
		"^.+\\.(t|j)sx?$": ["@swc/jest"],
	},
	moduleNameMapper: {
		"^(\\.{1,2}/.*)\\.js$": "$1",
	},
	modulePathIgnorePatterns: ["e2e"],
};
