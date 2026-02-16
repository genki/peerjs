import "./setup";
import { expect, describe, it } from "@jest/globals";
import { ConnectionType } from "../lib/enums";
import { Negotiator } from "../lib/negotiator";
import { util } from "../lib/util";

describe("rtc debug", () => {
	it("Negotiator経由のRTCPeerConnection作成/closeでカウントできる", () => {
		util.resetRtcPeerConnectionStats();
		expect(util.rtcPeerConnectionStats()).toEqual({
			active: 0,
			maxActive: 0,
			created: 0,
			closed: 0,
		});

		const conn: any = {
			peer: "peer",
			connectionId: "dc_test",
			type: ConnectionType.Data,
			provider: {
				options: { config: {} },
				socket: { send() {} },
				getConnection() {},
			},
			emitError() {},
			close() {},
			emit() {},
		};

		const n = new Negotiator(conn);
		const pc = (n as any)._startPeerConnection();
		conn.peerConnection = pc;

		expect(util.rtcPeerConnectionStats()).toEqual({
			active: 1,
			maxActive: 1,
			created: 1,
			closed: 0,
		});

		n.cleanup();
		expect(util.rtcPeerConnectionStats()).toEqual({
			active: 0,
			maxActive: 1,
			created: 1,
			closed: 1,
		});

		// 多重cleanupでも負値にならない。
		n.cleanup();
		expect(util.rtcPeerConnectionStats()).toEqual({
			active: 0,
			maxActive: 1,
			created: 1,
			closed: 1,
		});
	});
});

