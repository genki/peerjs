/**
 * @jest-environment node
 */

import fs from "node:fs/promises";

const readText = async (path: string) => await fs.readFile(path, "utf8");

const expectNoSourceMapUrl = (text: string) => {
	expect(text).not.toContain("sourceMappingURL");
};

describe("distのパッチ済み成果物", () => {
	it("peerjs.min.jsがパッチ済みでsourceMappingURLがない", async () => {
		const text = await readText("dist/peerjs.min.js");
		expect(text).toContain("_bufferBuilder.append(193)");
		expect(text).toMatch(/_bufferBuilder\.append\((0xc1|193)\)/);
		expectNoSourceMapUrl(text);
	});

	it("peerjs.jsがパッチ済みでsourceMappingURLがない", async () => {
		const text = await readText("dist/peerjs.js");
		expect(text).toMatch(/_bufferBuilder\.append\((0xc1|193)\)/);
		expectNoSourceMapUrl(text);
	});

	it("serializer.msgpack.mjsがパッチ済みでsourceMappingURLがない", async () => {
		const text = await readText("dist/serializer.msgpack.mjs");
		expectNoSourceMapUrl(text);
		expect(text).toMatch(
			/_encoder=new (ee|F)\(void 0,void 0,void 0,void 0,void 0,void 0,true\)/,
		);
	});
});
