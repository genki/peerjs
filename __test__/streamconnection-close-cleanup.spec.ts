import "./setup";
import { expect, describe, it, jest } from "@jest/globals";

jest.mock("../lib/negotiator", () => {
	return {
		Negotiator: class NegotiatorMock {
			startConnection() {}
			cleanup() {}
			async handleSDP() {}
			async handleCandidate() {}
		},
	};
});

// NOTE: jsdom環境ではTransformStreamが無い場合があるため補完する。
if (
	!("TransformStream" in globalThis) ||
	!("ReadableStream" in globalThis) ||
	!("WritableStream" in globalThis)
) {
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	const web = require("node:stream/web");
	// @ts-ignore
	globalThis.TransformStream = web.TransformStream;
	// @ts-ignore
	globalThis.ReadableStream = web.ReadableStream;
	// @ts-ignore
	globalThis.WritableStream = web.WritableStream;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class FakeDataChannel {
	bufferedAmount = 0;
	bufferedAmountLowThreshold = 0;
	binaryType = "arraybuffer";
	onopen = null;
	onmessage = null;
	onclose = null;

	addEventListener = jest.fn();
	removeEventListener = jest.fn();
	send = jest.fn();
}

const fakeProvider = () => ({
	// DataConnection.closeから呼ばれる。
	_removeConnection() {},
});

describe("StreamConnection close cleanup", () => {
	it("closeで_rawReadStreamが終了しreaderがdoneになる", async () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const {
			StreamConnection,
		} = require("../lib/dataconnection/StreamConnection/StreamConnection");

		class TestConn extends StreamConnection {
			serialization = "test";
			constructor() {
				super("peer", fakeProvider(), {});
			}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			protected _send(_data: any, _chunked: boolean) {}
		}

		const conn = new TestConn();
		const dc = new FakeDataChannel();
		// @ts-ignore
		conn._initializeDataChannel(dc);
		// @ts-ignore
		dc.onopen?.();

		expect(
			dc.addEventListener.mock.calls.filter((c) => c[0] === "message").length,
		).toBe(0);

		const reader = (conn as any)._rawReadStream.getReader();
		conn.close();
		expect(dc.onmessage).toBe(null);

		const r = await Promise.race([
			reader.read(),
			(async () => {
				await sleep(200);
				throw new Error("timeout");
			})(),
		]);
		expect(r.done).toBe(true);
	});

	it("open前closeでopen待ちlistenerを残さない", async () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const {
			StreamConnection,
		} = require("../lib/dataconnection/StreamConnection/StreamConnection");

		class TestConn extends StreamConnection {
			serialization = "test";
			constructor() {
				super("peer", fakeProvider(), {});
			}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			protected _send(_data: any, _chunked: boolean) {}
		}

		const conn = new TestConn();
		expect((conn as any).listenerCount("open")).toBe(1);

		const reader = (conn as any)._rawReadStream.getReader();
		conn.close();
		expect((conn as any).listenerCount("open")).toBe(0);

		const r = await Promise.race([
			reader.read(),
			(async () => {
				await sleep(200);
				throw new Error("timeout");
			})(),
		]);
		expect(r.done).toBe(true);
	});
});

