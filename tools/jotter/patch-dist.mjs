import fs from "node:fs/promises";

const readText = async (path) => await fs.readFile(path, "utf8");
const writeText = async (path, text) => await fs.writeFile(path, text, "utf8");

const stripSourceMappingURL = (text) =>
  text.replace(/\n+\/\/# sourceMappingURL.*$/m, "");

const replaceOnce = (text, from, to, label) => {
  if (!text.includes(from)) return {changed: false, text};
  const out = text.replace(from, to);
  if (out === text) throw new Error(`[patch-dist] 置換に失敗: ${label}`);
  return {changed: true, text: out};
};

const patchPeerjs = (text) => {
  let out = text;
  const r0 = replaceOnce(
    out,
    "_bufferBuilder.append(192)",
    "_bufferBuilder.append(193)",
    "peerjs nil->ext",
  );
  out = r0.text;
  const r1 = replaceOnce(
    out,
    "this._bufferBuilder.append(192)",
    "this._bufferBuilder.append(193)",
    "peerjs nil->ext(this)",
  );
  out = r1.text;
  out = stripSourceMappingURL(out);
  return out;
};

const patchMsgpackSerializer = (text) => {
  let out = text;
  const r = replaceOnce(
    out,
    "_encoder=new ee",
    "_encoder=new ee(void 0,void 0,void 0,void 0,void 0,void 0,true)",
    "serializer encoder opt",
  );
  if (!r.changed) {
    throw new Error("[patch-dist] 対象文字列が見つかりません: MsgPack設定");
  }
  out = r.text;
  out = stripSourceMappingURL(out);
  return out;
};

const main = async () => {
  const targets = [
    {path: "dist/peerjs.min.js", patch: patchPeerjs},
    {path: "dist/peerjs.js", patch: patchPeerjs},
    {path: "dist/serializer.msgpack.mjs", patch: patchMsgpackSerializer},
  ];

  for (const t of targets) {
    const before = await readText(t.path);
    const after = t.patch(before);
    if (after === before) continue;
    await writeText(t.path, after);
  }
};

await main();
