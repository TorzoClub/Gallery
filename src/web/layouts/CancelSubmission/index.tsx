import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import { cancelSubmission } from 'api/client-pool'
import type { PhotoView } from 'pool/view'
import { _EVENT_ } from 'components/Submission'

import styles from './index.module.scss'
import { PaperShredder } from '@/components/uibrik/paper-shredder/paper-shredder'

export type CancelSubmissionRouteState = {
  photo: PhotoView
  qq_num: number
  return_to: string
  test?: boolean
}

export default function CancelSubmissionApp({ thisIsDisplay }: { thisIsDisplay: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [auto, setAuto] = useState(false)
  const state = location.state as CancelSubmissionRouteState | null
  const photo = state?.photo ?? null
  const qq_num = state?.qq_num ?? null
  const test = state?.test === true

  const [error, setError] = useState<string | null>(null)
  const cancel_promise = useRef<Promise<unknown> | null>(null)

  useEffect(() => {
    if (!thisIsDisplay) {
      return
    }
    if (!photo || qq_num === null) {
      navigate('/explore', { replace: true })
      return
    }

    setError(null)
    if (!test) {
      const promise = cancelSubmission({
        qq_num,
        photo_id: photo.id,
      })
      cancel_promise.current = promise
      promise.catch(err => {
        setError(`取消投稿失败：${err instanceof Error ? err.message : String(err)}`)
      })
    }
  }, [navigate, photo, qq_num, test, thisIsDisplay])

  useEffect(() => {
    if (thisIsDisplay) {
      const h = setTimeout(() => setAuto(true), 2000)
      return () => clearTimeout(h)
    }
  }, [thisIsDisplay])

  const finish = () => {
    if (!photo) {
      navigate('/explore', { replace: true })
      return
    }
    void (async () => {
      if (!test) {
        try {
          await cancel_promise.current
          _EVENT_.canceled.trigger(photo.id)
        } catch {
          // The error is already visible above; leave the page after the
          // shredder has done its job.
        }
      }
      setTimeout(() => {
        navigate('/explore', { replace: true })
      }, 2000)
    })()
  }

  if (!thisIsDisplay) {
    return null
  }

  return (
    <section className={styles.page} aria-label='取消投稿'>
      <div className={styles.label}>cancelSubmission</div>

      <div className={styles.shredderLayer}>
        <PaperShredder auto={auto} speed={25} sound strips={5} onShred={finish}>
          {photo && <img src={photo.thumb_url} alt="" />}
        </PaperShredder>
      </div>

      {error && <div className={styles.error}>{error}</div>}
    </section>
  )
}
