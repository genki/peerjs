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

class FakeDataChannel {
	bufferedAmount = 0;
	bufferedAmountLowThreshold = 0;
	binaryType = "arraybuffer";
	onopen = null;
	onmessage = null;
	onclose = null;
	private _handlers = new Map<string, Set<() => void>>();

	addEventListener = jest.fn((type: string, cb: () => void) => {
		const set = this._handlers.get(type) ?? new Set();
		set.add(cb);
		this._handlers.set(type, set);
	});
	removeEventListener = jest.fn((type: string, cb: () => void) => {
		const set = this._handlers.get(type);
		if (!set) return;
		set.delete(cb);
	});
	emit(type: string) {
		const set = this._handlers.get(type);
		if (!set) return;
		for (const cb of Array.from(set)) cb();
	}
	send = jest.fn();
}

const fakeProvider = () => ({
	// DataConnection.closeから呼ばれる。
	_removeConnection() {},
});

describe("StreamConnection bufferedamountlow", () => {
	it("wait不要時はbufferedamountlow listenerを登録しない", async () => {
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

		dc.bufferedAmount = 0;
		await (conn as any).writer.write(new Uint8Array(1024));

		expect(
			dc.addEventListener.mock.calls.filter((c) => c[0] === "bufferedamountlow")
				.length,
		).toBe(0);
	});

	it("close後のwriteはTypeErrorにならない", async () => {
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

		conn.close();

		const p = (conn as any).writer.write(new Uint8Array(1024));
		await expect(p).resolves.toBeUndefined();
		expect(dc.send.mock.calls.length).toBe(0);
	});

	it("bufferedamountlow待機のcloseリスナは蓄積しない", async () => {
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

		for (let i = 0; i < 5; i++) {
			dc.bufferedAmount = 9 * 1024 * 1024;
			const p = (conn as any).writer.write(new Uint8Array(16));
			for (let spin = 0; spin < 20; spin++) {
				const registered =
					dc.addEventListener.mock.calls.filter(
						(c) => c[0] === "bufferedamountlow",
					).length >=
					i + 1;
				if (registered) break;
				await Promise.resolve();
			}
			dc.emit("bufferedamountlow");
			await p;
		}

		expect((conn as any).listenerCount("close")).toBe(0);
		conn.close();
	});
});
