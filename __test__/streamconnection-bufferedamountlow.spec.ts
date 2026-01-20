import "./setup";
import {expect, describe, it, jest} from "@jest/globals";

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

  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  send = jest.fn();
}

const fakeProvider = () => ({
  // DataConnection.closeから呼ばれる。
  _removeConnection() {},
});

describe("StreamConnection bufferedamountlow", () => {
  it("wait不要時はbufferedamountlow listenerを登録しない", async () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const {StreamConnection} = require(
      "../lib/dataconnection/StreamConnection/StreamConnection",
    );

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
      dc.addEventListener.mock.calls.filter(
        (c) => c[0] === "bufferedamountlow",
      ).length,
    ).toBe(0);
  });
});
