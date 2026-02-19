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

const fakeProvider = () => ({
	_removeConnection() {},
});

describe("MsgPack close cleanup", () => {
	it("旧挙動相当ではwriter.closedがtimeoutする", async () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { MsgPack } = require(
			"../lib/dataconnection/StreamConnection/MsgPack",
		);
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { DataConnection } = require("../lib/dataconnection/DataConnection");

		const conn = new MsgPack("peer", fakeProvider(), {});
		const dc = new FakeDataChannel();
		// @ts-ignore
		conn._initializeDataChannel(dc);
		// @ts-ignore
		dc.onopen?.();

		const oldWriter = (conn as any).writer;
		DataConnection.prototype.close.call(conn);

		const settled = await Promise.race([
			oldWriter.closed.then(
				() => "resolved",
				() => "rejected",
			),
			sleep(200).then(() => "timeout"),
		]);
		expect(settled).toBe("timeout");

		conn.close();
	});

	it("closeでwriter.closedが待機し続けない", async () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { MsgPack } = require(
			"../lib/dataconnection/StreamConnection/MsgPack",
		);

		const conn = new MsgPack("peer", fakeProvider(), {});
		const dc = new FakeDataChannel();
		// @ts-ignore
		conn._initializeDataChannel(dc);
		// @ts-ignore
		dc.onopen?.();

		await conn.send({
			payload: "x".repeat(128 * 1024),
		});

		const oldWriter = (conn as any).writer;
		conn.close();

		const settled = await Promise.race([
			oldWriter.closed.then(
				() => "resolved",
				() => "rejected",
			),
			sleep(200).then(() => "timeout"),
		]);
		expect(settled).not.toBe("timeout");
	});

	it("closeでencoder参照を解放する", () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const { MsgPack } = require(
			"../lib/dataconnection/StreamConnection/MsgPack",
		);

		const conn = new MsgPack("peer", fakeProvider(), {});
		const dc = new FakeDataChannel();
		// @ts-ignore
		conn._initializeDataChannel(dc);
		// @ts-ignore
		dc.onopen?.();

		expect((conn as any)._encoder).not.toBeNull();
		conn.close();
		expect((conn as any)._encoder).toBeNull();
	});
});
