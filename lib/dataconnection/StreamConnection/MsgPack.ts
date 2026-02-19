import { decodeMultiStream, Encoder } from "@msgpack/msgpack";
import { StreamConnection } from "./StreamConnection.js";
import type { Peer } from "../../peer.js";

export class MsgPack extends StreamConnection {
	readonly serialization = "MsgPack";
	private _encoder: Encoder | null = new Encoder();

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
		const encoder = this._encoder;
		if (!encoder) return Promise.resolve();
		return this.writer.write(encoder.encode(data));
	}

	public override close(options?: { flush?: boolean }): void {
		super.close(options);
		if (!options?.flush) {
			this._encoder = null;
		}
	}
}
