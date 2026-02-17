export type RtcPeerConnectionStats = {
	active: number;
	maxActive: number;
	created: number;
	closed: number;
};

type RtcPeerConnectionStatsStore = {
	active: number;
	maxActive: number;
	created: number;
	closed: number;
	tracked: WeakSet<RTCPeerConnection>;
	untracked: WeakSet<RTCPeerConnection>;
};

const getStore = (): RtcPeerConnectionStatsStore => {
	const g = globalThis as unknown as Record<string, unknown>;
	const key = "__peerjs_rtc_peer_connection_stats_store__";

	const store = g[key] as RtcPeerConnectionStatsStore | undefined;
	if (store) return store;

	const newStore: RtcPeerConnectionStatsStore = {
		active: 0,
		maxActive: 0,
		created: 0,
		closed: 0,
		tracked: new WeakSet(),
		untracked: new WeakSet(),
	};
	g[key] = newStore;

	return newStore;
};

export const trackPeerConnection = (pc: RTCPeerConnection): void => {
	const store = getStore();

	const tracked = store.tracked;
	if (tracked.has(pc)) return;
	tracked.add(pc);

	store.active++;
	store.created++;
	store.maxActive = Math.max(store.maxActive, store.active);
};

export const untrackPeerConnection = (pc: RTCPeerConnection): void => {
	const store = getStore();

	const tracked = store.tracked;
	const untracked = store.untracked;
	if (!tracked.has(pc)) return;
	if (untracked.has(pc)) return;
	untracked.add(pc);

	store.active = Math.max(0, store.active - 1);
	store.closed++;
};

export const rtcPeerConnectionStats = (): RtcPeerConnectionStats => {
	const store = getStore();
	return {
		active: store.active,
		maxActive: store.maxActive,
		created: store.created,
		closed: store.closed,
	};
};

export const resetRtcPeerConnectionStats = (): void => {
	const store = getStore();
	store.active = 0;
	store.maxActive = 0;
	store.created = 0;
	store.closed = 0;
	store.tracked = new WeakSet();
	store.untracked = new WeakSet();
};
