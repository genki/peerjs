import fs from "node:fs/promises";

const readText = async (path) => await fs.readFile(path, "utf8");
const writeText = async (path, text) => await fs.writeFile(path, text, "utf8");

const stripSourceMappingURL = (text) =>
  text.replace(/\n+\/\/# sourceMappingURL.*$/m, "");

const replaceAllText = (text, from, to, label) => {
  if (!text.includes(from)) return {changed: false, text};
  const out = text.replaceAll(from, to);
  if (out === text) throw new Error(`[patch-dist] 置換に失敗: ${label}`);
  return {changed: true, text: out};
};

const patchPeerjs = (text) => {
  let out = text;
  const r0 = replaceAllText(
    out,
    "_bufferBuilder.append(192)",
    "_bufferBuilder.append(193)",
    "peerjs nil->ext",
  );
  out = r0.text;
  const r1 = replaceAllText(
    out,
    "this._bufferBuilder.append(192)",
    "this._bufferBuilder.append(193)",
    "peerjs nil->ext(this)",
  );
  out = r1.text;
  const r2 = replaceAllText(
    out,
    "_bufferBuilder.append(0xc0)",
    "_bufferBuilder.append(0xc1)",
    "peerjs nil->ext(hex)",
  );
  out = r2.text;
  const r3 = replaceAllText(
    out,
    "this._bufferBuilder.append(0xc0)",
    "this._bufferBuilder.append(0xc1)",
    "peerjs nil->ext(this hex)",
  );
  out = r3.text;
  out = stripSourceMappingURL(out);
  return out;
};

const patchMsgpackSerializer = (text) => {
  let out = text;
  const eePatched =
    "_encoder=new ee(void 0,void 0,void 0,void 0,void 0,void 0,true)";
  const fPatched =
    "_encoder=new F(void 0,void 0,void 0,void 0,void 0,void 0,true)";
  if (out.includes(eePatched) || out.includes(fPatched)) {
    return stripSourceMappingURL(out);
  }
  const r0 = replaceAllText(
    out,
    "_encoder=new ee",
    eePatched,
    "serializer encoder opt(ee)",
  );
  out = r0.text;
  const r1 = replaceAllText(
    out,
    "_encoder=new F",
    fPatched,
    "serializer encoder opt(F)",
  );
  out = r1.text;
  if (!r0.changed && !r1.changed) {
    throw new Error("[patch-dist] 対象文字列が見つかりません: MsgPack設定");
  }
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
