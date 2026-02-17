import "./setup";
import { expect, describe, it, jest } from "@jest/globals";

describe("rtc debug (global store)", () => {
	it("別bundle想定でもRTC統計が共有される", () => {
		const pc = new RTCPeerConnection({});

		jest.isolateModules(() => {
			const m = require("../lib/rtcDebug") as typeof import("../lib/rtcDebug");
			m.resetRtcPeerConnectionStats();
			m.trackPeerConnection(pc);
		});

		jest.isolateModules(() => {
			const { util } = require("../lib/util") as typeof import("../lib/util");
			expect(util.rtcPeerConnectionStats()).toEqual({
				active: 1,
				maxActive: 1,
				created: 1,
				closed: 0,
			});
		});

		jest.isolateModules(() => {
			const m = require("../lib/rtcDebug") as typeof import("../lib/rtcDebug");
			m.untrackPeerConnection(pc);
		});

		jest.isolateModules(() => {
			const { util } = require("../lib/util") as typeof import("../lib/util");
			expect(util.rtcPeerConnectionStats()).toEqual({
				active: 0,
				maxActive: 1,
				created: 1,
				closed: 1,
			});
		});
	});
});

