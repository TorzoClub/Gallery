import { ReactNode, useEffect, useLayoutEffect, useState } from "react";
import { Signal } from "vait";
import { ZeldaQuestBanner } from "./components/ZeldaQuestBanner";

export const zelda_quest_banner_sig = Signal<{ category: string; title: string }>()

if (import.meta.env.DEV) {
  Object.assign(window, { zelda_quest_banner_sig })
}

export default function ZeldaQuestBannerLayout({children}: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [
    opts,
    setOpts
  ] = useState<{ category: string; title: string }>({ category: '', title: '' })

  useLayoutEffect(() => (
    zelda_quest_banner_sig.receive((new_opts) => {
      setOpen(true)
      setOpts(new_opts)
    })
  ), [])

  return (
    <>
      {children}
      <ZeldaQuestBanner
        isOpen={open}
        {...opts}
      ></ZeldaQuestBanner>
    </>
  )
}
