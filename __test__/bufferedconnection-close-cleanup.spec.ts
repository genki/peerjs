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

describe("BufferedConnection close cleanup", () => {
	it("message handlerはaddEventListenerではなくonmessageを使う", () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const {
			BufferedConnection,
		} = require("../lib/dataconnection/BufferedConnection/BufferedConnection");

		class TestConn extends BufferedConnection {
			serialization = "test";
			constructor() {
				super("peer", fakeProvider(), {});
			}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			protected _send(_data: any, _chunked: boolean) {}
			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			protected _handleDataMessage(_e: MessageEvent) {}
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
		expect(typeof dc.onmessage).toBe("function");

		conn.close();
		expect(dc.onmessage).toBe(null);
	});
});

