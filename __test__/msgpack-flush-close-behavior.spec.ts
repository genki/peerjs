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

describe("MsgPack flush close behavior", () => {
	it("close({flush:true})は即時解放せずopen状態を維持する", async () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { MsgPack } = require(
			"../lib/dataconnection/StreamConnection/MsgPack",
		);

		const provider = {
			_removeConnection: jest.fn(),
		};
		const conn = new MsgPack("peer", provider, {});
		const dc = new FakeDataChannel();
		// @ts-ignore
		conn._initializeDataChannel(dc);
		// @ts-ignore
		dc.onopen?.();

		expect(conn.open).toBe(true);

		conn.close({ flush: true });
		await sleep(20);

		expect(conn.open).toBe(true);
		expect(provider._removeConnection).toHaveBeenCalledTimes(0);
		expect(dc.send.mock.calls.length).toBeGreaterThan(0);

		conn.close();
		expect(conn.open).toBe(false);
		expect(provider._removeConnection).toHaveBeenCalledTimes(1);
	});
});
