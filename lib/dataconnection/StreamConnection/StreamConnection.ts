import logger from "../../logger.js";
import type { Peer } from "../../peer.js";
import { DataConnection } from "../DataConnection.js";

export abstract class StreamConnection extends DataConnection {
	private static readonly NOOP_WRITER =
		{
			write: async () => undefined,
			close: async () => undefined,
			abort: async () => undefined,
			releaseLock: () => undefined,
			desiredSize: null,
			ready: Promise.resolve(),
			closed: Promise.resolve(),
		} as unknown as WritableStreamDefaultWriter<Uint8Array>;
	private static readonly WAIT_POLL_INTERVAL = 50;

	private _CHUNK_SIZE = 1024 * 8 * 4;
	private _bufferedAmountLowWait: Promise<void> | null = null;
	private _rawReadController:
		| ReadableStreamDefaultController<ArrayBuffer>
		| null = null;
	private _rawReadOnOpen: (() => void) | null = null;
	private _sendPipeAbortController = new AbortController();
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
			this._rawReadController = controller;
			const onOpen = () => {
				const dc = this.dataChannel;
				if (!dc) return;
				dc.onmessage = (e) => {
					try {
						controller.enqueue(e.data);
					} catch {
						// 無視する。
					}
				};
			};
			this._rawReadOnOpen = onOpen;
			this.once("open", onOpen);
		},
		cancel: () => {
			this._rawReadController = null;
		},
	});

	protected constructor(peerId: string, provider: Peer, options: any) {
		super(peerId, provider, { ...options, reliable: true });

		void this._splitStream.readable
			.pipeTo(this._rawSendStream, {
				signal: this._sendPipeAbortController.signal,
			})
			.catch(() => {});
	}

	private _waitForBufferedAmountLow(): Promise<void> {
		if (this._bufferedAmountLowWait) return this._bufferedAmountLowWait;
		const dc = this.dataChannel;
		if (!dc) return Promise.resolve();
		const threshold = Math.max(0, dc.bufferedAmountLowThreshold || 0);
		if (dc.bufferedAmount <= threshold) return Promise.resolve();
		this._bufferedAmountLowWait = new Promise((resolve) => {
			let done = false;
			const cleanup = () => {
				this.off("close", onClose);
				try {
					dc.removeEventListener("bufferedamountlow", onLow);
				} catch {
					// 無視する。
				}
				clearInterval(pollId);
			};
			const finish = () => {
				if (done) return;
				done = true;
				this._bufferedAmountLowWait = null;
				cleanup();
				resolve();
			};
			const onLow = () => finish();
			const onClose = () => finish();
			const pollId = setInterval(() => {
				const current = this.dataChannel;
				if (!current) return finish();
				const low = Math.max(
					0,
					current.bufferedAmountLowThreshold || 0,
				);
				if (current.bufferedAmount <= low) finish();
			}, StreamConnection.WAIT_POLL_INTERVAL);
			dc.addEventListener("bufferedamountlow", onLow, { once: true });
			this.once("close", onClose);
		});
		return this._bufferedAmountLowWait;
	}

	public override _initializeDataChannel(dc) {
		super._initializeDataChannel(dc);
		this.dataChannel.binaryType = "arraybuffer";
		this.dataChannel.bufferedAmountLowThreshold =
			DataConnection.MAX_BUFFERED_AMOUNT / 2;
	}

	public override close(options?: { flush?: boolean }): void {
		if (options?.flush) {
			super.close(options);
			return;
		}

		super.close(options);

		if (this._rawReadOnOpen) {
			this.off("open", this._rawReadOnOpen);
			this._rawReadOnOpen = null;
		}

		const c = this._rawReadController;
		if (c) {
			this._rawReadController = null;
			try {
				c.close();
			} catch {
				// 無視する。
			}
		}

		if (!this._sendPipeAbortController.signal.aborted) {
			this._sendPipeAbortController.abort();
		}

		const writer = this.writer;
		this.writer = StreamConnection.NOOP_WRITER;
		void writer.abort().catch(() => {});
		try {
			writer.releaseLock();
		} catch {
			// 無視する。
		}
	}
}
