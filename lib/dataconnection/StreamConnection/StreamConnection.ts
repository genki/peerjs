import logger from "../../logger.js";
import type { Peer } from "../../peer.js";
import { DataConnection } from "../DataConnection.js";

export abstract class StreamConnection extends DataConnection {
	private _CHUNK_SIZE = 1024 * 8 * 4;
	private _bufferedAmountLowWait: Promise<void> | null = null;
	private _splitStream = new TransformStream<Uint8Array>({
		transform: (chunk, controller) => {
			for (let split = 0; split < chunk.length; split += this._CHUNK_SIZE) {
				controller.enqueue(chunk.subarray(split, split + this._CHUNK_SIZE));
			}
		},
	});
	private _rawSendStream = new WritableStream<ArrayBuffer>({
		write: async (chunk, controller) => {
			const dc = this.dataChannel;
			if (!dc) {
				controller.error(new Error("DataChannel is closed"));
				this.close();
				return;
			}
			// if we can send the chunk now, send it
			// if not, we wait until at least half of the sending buffer is free again
			const needWait =
				dc.bufferedAmount >
				DataConnection.MAX_BUFFERED_AMOUNT - chunk.byteLength;
			if (needWait) await this._waitForBufferedAmountLow();

			const dc2 = this.dataChannel;
			if (!dc2) {
				controller.error(new Error("DataChannel is closed"));
				this.close();
				return;
			}
			// TODO: what can go wrong here?
			try {
				dc2.send(chunk);
			} catch (e) {
				logger.error(`DC#:${this.connectionId} Error when sending:`, e);
				controller.error(e);
				this.close();
			}
		},
	});
	protected writer = this._splitStream.writable.getWriter();

	protected _rawReadStream = new ReadableStream<ArrayBuffer>({
		start: (controller) => {
			this.once("open", () => {
				this.dataChannel.addEventListener("message", (e) => {
					controller.enqueue(e.data);
				});
			});
		},
	});

	protected constructor(peerId: string, provider: Peer, options: any) {
		super(peerId, provider, { ...options, reliable: true });

		void this._splitStream.readable.pipeTo(this._rawSendStream)
			.catch(() => {});
	}

	private _waitForBufferedAmountLow(): Promise<void> {
		if (this._bufferedAmountLowWait) return this._bufferedAmountLowWait;
		const dc = this.dataChannel;
		if (!dc) return Promise.resolve();
		this._bufferedAmountLowWait = new Promise((resolve) => {
			let done = false;
			const finish = () => {
				if (done) return;
				done = true;
				this._bufferedAmountLowWait = null;
				resolve();
			};
			const onLow = () => finish();
			dc.addEventListener("bufferedamountlow", onLow, { once: true });
			this.once("close", () => {
				try {
					dc.removeEventListener("bufferedamountlow", onLow);
				} catch {
					// 無視する。
				}
				finish();
			});
		});
		return this._bufferedAmountLowWait;
	}

	public override _initializeDataChannel(dc) {
		super._initializeDataChannel(dc);
		this.dataChannel.binaryType = "arraybuffer";
		this.dataChannel.bufferedAmountLowThreshold =
			DataConnection.MAX_BUFFERED_AMOUNT / 2;
	}
}
