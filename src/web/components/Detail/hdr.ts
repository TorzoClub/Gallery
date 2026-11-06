export type DetailSource = {
  src: string
  srcHdr?: string | null
}

/** 选 HDR 或 SDR，并记录 HDR 失败时回退的 SDR URL */
export function chooseDetailSource(
  source: DetailSource,
  hdr_supported: boolean,
): { src: string; fallback_src: string | null } {
  const hdr = source.srcHdr ?? null
  if (hdr !== null && hdr.length > 0 && hdr_supported) {
    return { src: hdr, fallback_src: source.src }
  }
  return { src: source.src, fallback_src: null }
}
