import "./setup";
import { Peer } from "../lib/peer";
import { Server } from "mock-socket";
import { ServerMessageType } from "../lib/enums";
import {
	expect,
	beforeEach,
	afterEach,
	describe,
	it,
	jest,
} from "@jest/globals";

const createMockServer = (): Server => {
	const fakeURL = [
		"ws://localhost:8080/peerjs",
		"?key=peerjs&id=1&token=testToken",
	].join("");
	const mockServer = new Server(fakeURL);
	mockServer.on("connection", (socket) => {
		socket.send(JSON.stringify({ type: ServerMessageType.Open }));
	});
	return mockServer;
};

describe("Peer cleanup", () => {
	let mockServer: Server;

	beforeEach(() => {
		mockServer = createMockServer();
	});

	afterEach(() => {
		mockServer.stop();
	});

	it("Leaveで複数connectionが全てcloseされる", (done) => {
		const peer1 = new Peer("1", { port: 8080, host: "localhost" });

		peer1.once("open", () => {
			const p = peer1 as any;
			const peerId = "2";

			const mkConn = (id: string) => {
				const conn: any = {
					peer: peerId,
					connectionId: id,
					type: "data",
					close: jest.fn(() => {
						p._removeConnection(conn);
					}),
				};
				return conn;
			};

			const c1 = mkConn("dc_1");
			const c2 = mkConn("dc_2");
			p._addConnection(peerId, c1);
			p._addConnection(peerId, c2);
			expect(p._connections.get(peerId).length).toBe(2);

			p._handleMessage({
				type: ServerMessageType.Leave,
				src: peerId,
				payload: {},
			});

			expect(c1.close).toHaveBeenCalledTimes(1);
			expect(c2.close).toHaveBeenCalledTimes(1);
			peer1.destroy();
			done();
		});
	});

	it("destroyで複数connectionが全てcloseされる", (done) => {
		const peer1 = new Peer("1", { port: 8080, host: "localhost" });

		peer1.once("open", () => {
			const p = peer1 as any;
			const peerId = "2";

			const mkConn = (id: string) => {
				const conn: any = {
					peer: peerId,
					connectionId: id,
					type: "data",
					close: jest.fn(() => {
						p._removeConnection(conn);
					}),
				};
				return conn;
			};

			const c1 = mkConn("dc_1");
			const c2 = mkConn("dc_2");
			p._addConnection(peerId, c1);
			p._addConnection(peerId, c2);

			peer1.destroy();

			expect(c1.close).toHaveBeenCalledTimes(1);
			expect(c2.close).toHaveBeenCalledTimes(1);
			done();
		});
	});
});
