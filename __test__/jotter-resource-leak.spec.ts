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

describe("resource leak protection", () => {
  let mockServer: Server;

  beforeEach(() => {
    mockServer = createMockServer();
  });

  afterEach(() => {
    mockServer.stop();
  });

  it("_removeConnectionは空配列になったpeerIdを_connectionsから消す", (done) => {
    const peer1 = new Peer("1", { port: 8080, host: "localhost" });

    peer1.once("open", () => {
      const p = peer1 as any;
      const conn = {
        peer: "2",
        connectionId: "dc_1",
        type: "data",
      };

      p._addConnection("2", conn);
      expect(p._connections.has("2")).toBe(true);
      p._removeConnection(conn);
      expect(p._connections.has("2")).toBe(false);

      peer1.destroy();
      done();
    });
  });
});

