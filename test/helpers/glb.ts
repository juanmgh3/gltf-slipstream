/** The GLB's JSON chunk, parsed without decoding — extension assertions need the
 * raw `extensionsUsed` (reading through NodeIO decodes DRACO away). */
export function glbJson(glb: Uint8Array): { extensionsUsed?: string[] } {
  const view = new DataView(glb.buffer, glb.byteOffset);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB: bad magic');
  const jsonLength = view.getUint32(12, true);
  return JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength)));
}
