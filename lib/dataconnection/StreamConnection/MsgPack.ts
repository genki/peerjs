import { decodeMultiStream, Encoder } from "@msgpack/msgpack";
import { StreamConnection } from "./StreamConnection.js";
import type { Peer } from "../../peer.js";

export class MsgPack extends StreamConnection {
	readonly serialization = "MsgPack";
  // null を無視するために true を渡す
	private _encoder = new Encoder(
    undefined, undefined, undefined, undefined, undefined, undefined, true);

	constructor(peerId: string, provider: Peer, options: any) {
		super(peerId, provider, options);

		(async () => {
			for await (const msg of decodeMultiStream(this._rawReadStream)) {
				// @ts-ignore
				if (msg.__peerData?.type === "close") {
					this.close();
					return;
				}
				this.emit("data", msg);
			}
		})();
	}

	protected override _send(data) {
		return this.writer.write(this._encoder.encode(data));
	}
}
