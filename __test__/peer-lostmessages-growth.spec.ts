import "./setup";
import { Peer } from "../lib/peer";
import { Server } from "mock-socket";
import { ServerMessageType } from "../lib/enums";
import { expect, beforeEach, afterEach, describe, it } from "@jest/globals";

const createMockServer = (): Server => {
	const fakeURL = "ws://localhost:8080/peerjs?key=peerjs&id=1&token=testToken";
	const mockServer = new Server(fakeURL);
	mockServer.on("connection", (socket) => {
		socket.send(JSON.stringify({ type: ServerMessageType.Open }));
	});
	return mockServer;
};

describe("Peer lostMessages growth", () => {
	let mockServer: Server;

	beforeEach(() => {
		mockServer = createMockServer();
	});

	afterEach(() => {
		mockServer.stop();
	});

	it("未知connectionIdが増えると_lostMessagesが線形増加する", (done) => {
		const peer = new Peer("1", { port: 8080, host: "localhost" });

		peer.once("open", () => {
			const p = peer as any;
			const total = 300;
			for (let i = 0; i < total; i++) {
				p._handleMessage({
					type: ServerMessageType.Candidate,
					src: "peer-x",
					payload: {
						connectionId: `dc_missing_${i}`,
						candidate: {},
					},
				});
			}

			expect(p._lostMessages.size).toBe(total);
			peer.destroy();
			done();
		});
	});

	it("同一connectionIdへの連続受信で配列が伸び続ける", (done) => {
		const peer = new Peer("1", { port: 8080, host: "localhost" });

		peer.once("open", () => {
			const p = peer as any;
			const connId = "dc_missing_same";
			const total = 200;
			for (let i = 0; i < total; i++) {
				p._handleMessage({
					type: ServerMessageType.Answer,
					src: "peer-y",
					payload: {
						connectionId: connId,
						sdp: { type: "answer", sdp: "v=0" },
					},
				});
			}

			expect(p._lostMessages.size).toBe(1);
			expect(p._lostMessages.get(connId).length).toBe(total);
			peer.destroy();
			done();
		});
	});
});
