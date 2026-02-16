export type RtcPeerConnectionStats = {
	active: number;
	maxActive: number;
	created: number;
	closed: number;
};

let active = 0;
let maxActive = 0;
let created = 0;
let closed = 0;

const tracked = new WeakSet<RTCPeerConnection>();
const untracked = new WeakSet<RTCPeerConnection>();

export const trackPeerConnection = (pc: RTCPeerConnection): void => {
	if (tracked.has(pc)) return;
	tracked.add(pc);

	active++;
	created++;
	maxActive = Math.max(maxActive, active);
};

export const untrackPeerConnection = (pc: RTCPeerConnection): void => {
	if (!tracked.has(pc)) return;
	if (untracked.has(pc)) return;
	untracked.add(pc);

	active = Math.max(0, active - 1);
	closed++;
};

export const rtcPeerConnectionStats = (): RtcPeerConnectionStats => ({
	active,
	maxActive,
	created,
	closed,
});

export const resetRtcPeerConnectionStats = (): void => {
	active = 0;
	maxActive = 0;
	created = 0;
	closed = 0;
};

