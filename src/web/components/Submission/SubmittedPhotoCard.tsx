import { useEffect } from 'react'
import PhotoCard from 'components/PhotoCard'
import type { PhotoView } from 'pool/view'
import { global_queue } from 'utils/queue-load'

/**
 * 成员自己的那张投稿：摆正、不贴纸胶带的 PhotoCard。
 * “你这不是已经投稿了吗？”、取消投稿确认页、碎纸机里都用它，和投稿表单是同一张相纸。
 */
export default function SubmittedPhotoCard({ photo, width = 320 }: { photo: PhotoView; width?: number }) {
  // 和原来的预览一样：这张可能先于瀑布流出现，图片队列要先开工
  useEffect(() => {
    global_queue.startWorking()
  }, [photo.thumb_url])

  return (
    <PhotoCard
      id={photo.id}
      anchor={false}
      width={width}
      tape={false}
      style={{ margin: '0 auto', textAlign: 'left' }}
      hideMember={!photo.member}
      name={photo.member ? photo.member.name : null}
      desc={photo.desc}
      photo={{
        width: photo.width,
        height: photo.height,
        src: photo.src_url,
        thumb: photo.thumb_url,
      }}
      avatar={photo.member ? {
        width: 0,
        height: 0,
        thumb: photo.member.avatar_thumb_url,
        src: photo.member.avatar_thumb_url,
      } : null}
    />
  )
}
