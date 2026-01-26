/**
 * @jest-environment node
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const readText = async (p: string) => await fs.readFile(p, "utf8");

const runPatchDist = (cwd: string) => {
	const r = spawnSync(process.execPath, ["tools/jotter/patch-dist.mjs"], {
		cwd,
		encoding: "utf8",
	});
	if (r.status !== 0) {
		throw new Error(`patch-dist failed: ${r.stdout}\n${r.stderr}`);
	}
};

describe("tools/jotter/patch-dist.mjs", () => {
	it("dist配下のパッチ適用とsourceMappingURL削除ができる", async () => {
		const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "peerjs-test-"));
		try {
			await fs.mkdir(path.join(tmp, "dist"), { recursive: true });
			await fs.mkdir(path.join(tmp, "tools/jotter"), { recursive: true });
			await fs.copyFile(
				"tools/jotter/patch-dist.mjs",
				path.join(tmp, "tools/jotter/patch-dist.mjs"),
			);

			await fs.writeFile(
				path.join(tmp, "dist/peerjs.min.js"),
				[
					"_bufferBuilder.append(192)",
					"this._bufferBuilder.append(192)",
					"_bufferBuilder.append(0xc0)",
					"this._bufferBuilder.append(0xc0)",
					"",
					"//# sourceMappingURL=peerjs.min.js.map",
					"",
				].join("\n"),
				"utf8",
			);
			await fs.writeFile(
				path.join(tmp, "dist/peerjs.js"),
				[
					"_bufferBuilder.append(192)",
					"this._bufferBuilder.append(0xc0)",
					"",
					"//# sourceMappingURL=peerjs.js.map",
					"",
				].join("\n"),
				"utf8",
			);
			await fs.writeFile(
				path.join(tmp, "dist/serializer.msgpack.mjs"),
				[
					"export class MsgPack{constructor(){this._encoder=new ee}}",
					"",
					"//# sourceMappingURL=serializer.msgpack.mjs.map",
					"",
				].join("\n"),
				"utf8",
			);

			runPatchDist(tmp);

			const peerjsMin = await readText(path.join(tmp, "dist/peerjs.min.js"));
			expect(peerjsMin).toContain("_bufferBuilder.append(193)");
			expect(peerjsMin).toContain("_bufferBuilder.append(0xc1)");
			expect(peerjsMin).not.toContain("sourceMappingURL");

			const peerjsJs = await readText(path.join(tmp, "dist/peerjs.js"));
			expect(peerjsJs).toContain("_bufferBuilder.append(193)");
			expect(peerjsJs).toContain("_bufferBuilder.append(0xc1)");
			expect(peerjsJs).not.toContain("sourceMappingURL");

			const serializer = await readText(
				path.join(tmp, "dist/serializer.msgpack.mjs"),
			);
			expect(serializer).toContain(
				"_encoder=new ee(void 0,void 0,void 0,void 0,void 0,void 0,true)",
			);
			expect(serializer).not.toContain("sourceMappingURL");

			const snapshot = {
				peerjsMin,
				peerjsJs,
				serializer,
			};

			runPatchDist(tmp);

			const peerjsMin2 = await readText(path.join(tmp, "dist/peerjs.min.js"));
			const peerjsJs2 = await readText(path.join(tmp, "dist/peerjs.js"));
			const serializer2 = await readText(
				path.join(tmp, "dist/serializer.msgpack.mjs"),
			);
			expect({
				peerjsMin: peerjsMin2,
				peerjsJs: peerjsJs2,
				serializer: serializer2,
			}).toEqual(snapshot);
		} finally {
			await fs.rm(tmp, { recursive: true, force: true });
		}
	});
});
