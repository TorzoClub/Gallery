import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import ImageUploadingImport, { type ImageType, type ImageListType } from 'react-images-uploading'

import { useSubmissionStore } from '.'
import { fetchClientPool, fetchMemberView, submitPhoto, updateSubmission } from 'api/client-pool'
import { uploadImage } from 'api/upload'
import { submittedPhotoView, type PhotoView } from 'pool/view'

import s from './PhotoCreateOrEdit.module.scss'
import { LoadingMask } from 'components/LoadingMask'
import { global_queue, useQueueload } from 'utils/queue-load'
import SkeuomorphismButton from 'components/SkeuomorphismButton'
import { PhotoCardPaper, photoCardBottomMin, photoCardCover, photoCardFrame } from 'components/PhotoCard'

// Vite's CJS interop for this package can expose the module exports object as
// the default import. Normalize both the CJS and ESM shapes to the component.
const ImageUploading = (
  (ImageUploadingImport as unknown as { default?: typeof ImageUploadingImport }).default
    ?? ImageUploadingImport
) as typeof ImageUploadingImport

type ImageSize = { width: number, height: number }
type WillUploadImage = null | { blob: Blob, filename: string, blob_url: string, size: ImageSize }

/** 表单这张拍立得的宽度；摆正、不贴纸胶带 */
const CARD_WIDTH = 320
/** 还没选图时，相纸上的空位按 4:3 */
const EMPTY_COVER: ImageSize = { width: 4, height: 3 }

function readImageSize(url: string): Promise<ImageSize> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 4, height: img.naturalHeight || 3 })
    img.onerror = () => resolve(EMPTY_COVER)
    img.src = url
  })
}

type Props = {
  /**
   * 投稿 / 修改成功。瀑布流里的相片由 SSE 推送更新（新相片贴上来的动画也由它触发），这里不发布数据；
   * 拉回来的数据只用来更新投稿剧本自己记着的那张相片。
   */
  onUpdateDone(data: PhotoView): void
}
export default function PhotoCreateOrEdit({ onUpdateDone }: Props) {
  const [ isProcessing, setProcessing ] = useState(false)

  // 不应该使用 setFiles，如果setFiles了的话，会无法修改图片
  // 这是 react-images-uploading 的 bug
  const [files] = useState<ImageListType>([])

  const { photo, gallery_id, qq_num } = useSubmissionStore.getState()
  const [description, setDescription] = useState(photo?.desc || '')
  const [will_upload_image, setWillUploadImage] = useState<WillUploadImage>(null)

  const is_edit_mode = Boolean(photo)

  async function handleSubmit() {
    if (!is_edit_mode && !will_upload_image) {
      alert('请选择一张图像')
      return
    }

    try {
      setProcessing(true)

      let temp_id: string | undefined
      if (will_upload_image) {
        const { blob, filename } = will_upload_image
        const file = new File([blob], filename, { type: blob.type })
        temp_id = (await uploadImage(file)).temp_id
      }

      const current_photo_id = photo?.id
      if (is_edit_mode && current_photo_id !== undefined) {
        await updateSubmission({
          photo_id: current_photo_id,
          qq_num: Number(qq_num),
          desc: description,
          ...(temp_id === undefined ? {} : { temp_id }),
        })
      } else {
        if (!temp_id) {
          throw new Error('请选择一张图像')
        }
        if (gallery_id === null) {
          throw new Error('缺少相册信息')
        }
        await submitPhoto({
          gallery_id,
          qq_num: Number(qq_num),
          desc: description,
          temp_id,
        })
      }

      const [member_view, pool] = await Promise.all([
        fetchMemberView(Number(qq_num)),
        fetchClientPool(),
      ])
      const updated_photo = submittedPhotoView(pool, member_view)
      if (updated_photo === null) {
        throw new Error('投稿成功，但无法读取投稿数据')
      }
      useSubmissionStore.setState({ photo: updated_photo })
      onUpdateDone(updated_photo)
    } catch (err) {
      alert(`错误: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setProcessing(false)
    }
  }

  const handleFile = useCallback(async (img: ImageType) => {
    if (img.file === undefined) {
      alert('failed in handleFile, img.file is undefined')
    } else {
      const { file } = img
      const array_buffer = await file.arrayBuffer()
      const blob = new Blob([new Uint8Array(array_buffer)], { type: file.type })

      const [type, image_type] = blob.type.split('/')
      const supported_type = ['webp', 'avif', 'jpeg', 'jpg', 'png', 'gif', 'heic']
      const is_supported_image = supported_type.includes(image_type)
      if (type === undefined) {
        alert(`看起来这不是一个图片格式（blob type: ${blob.type}），请重新选择`)
      } else if (!is_supported_image) {
        alert(`🧎对不起，目前暂不支持该格式(${image_type})，我们只支持这些格式：${supported_type.join('|')}`)
      } else {
        const is_heic = blob.type.includes('heic') || blob.type.includes('heif')
        if (is_heic) {
          const { default: heicConvert } = await import('heic-convert/browser')
          const jpg_buf = await heicConvert({
            buffer: new Uint8Array(array_buffer),
            format: 'JPEG',
            quality: 0.8,
          })
          const jpg_blob = new Blob([new Uint8Array(jpg_buf)], { type: 'image/jpeg' })
          const blob_url = URL.createObjectURL(jpg_blob)
          setWillUploadImage({
            filename: `img-${Date.now()}.jpg`,
            blob: jpg_blob,
            blob_url,
            size: await readImageSize(blob_url),
          })
        } else {
          const blob_url = URL.createObjectURL(blob)
          setWillUploadImage({ filename: file.name, blob, blob_url, size: await readImageSize(blob_url) })
        }
      }
    }
  }, [])

  const preview_url = selectPreviewPicture(photo ? photo.thumb_url : null, will_upload_image)
  const cover_size: ImageSize = will_upload_image !== null
    ? will_upload_image.size
    : (photo ? { width: photo.width, height: photo.height } : EMPTY_COVER)
  const frame = photoCardFrame(CARD_WIDTH)
  const { cover_width, cover_height, sideways } = photoCardCover(CARD_WIDTH, cover_size)

  return (
    <div>
      <ImageUploading
        value={files}
        maxNumber={1}
        onChange={(files) => {
          const file = files.pop()
          if (file === undefined) {
            alert('请选择文件')
          } else {
            handleFile(file).catch(e => {
              console.error('handleFile error', e)
              alert(`处理图片失败: ${e?.message}`)
            })
          }
        }}
        onError={(err, files) => {
          console.error('ImageUploading error', err, files)
          alert('文件上传处理出错')
        }}
      >
        {({ onImageUpload, isDragging, dragProps }) => (
          // 和瀑布流里同一张拍立得（PhotoCardPaper），只是摆正、不贴纸胶带
          <PhotoCardPaper className={s.Card} width={CARD_WIDTH} frame={frame} has_bottom tape={false}>
            <button
              type="button"
              className={['cover-area', s.CoverButton, isDragging ? s.IsDragging : ''].join(' ')}
              style={{ height: `${cover_height}px` }}
              aria-label="选择或更换投稿图片"
              onClick={onImageUpload}
              {...dragProps}
            >
              <FormCover
                previewURL={preview_url}
                isDragging={isDragging}
                // 横长图和瀑布流里一样转 90° 竖着放：<img> 按原图方向排（宽高对调），再转过来填满相片区域
                sideways={sideways ? { width: cover_height, height: cover_width } : null}
              />
            </button>
            <div className="bottom-area" style={{ minHeight: `${photoCardBottomMin(CARD_WIDTH)}px` }}>
              <textarea
                value={description}
                className={s.Desc}
                rows={3}
                aria-label="相片介绍"
                onChange={(e) => {
                  setDescription(e.target.value)
                }}
                placeholder="点击此处填写介绍（可不填）"
              />
            </div>
          </PhotoCardPaper>
        )}
      </ImageUploading>

      <div style={{ marginTop: '20px' }}>
        <SkeuomorphismButton onClick={handleSubmit}>提 交</SkeuomorphismButton>
      </div>

      {
        isProcessing && <LoadingMask opacity={0.7} />
      }
    </div>
  )
}

/** 拍立得上的相片位：没选图时是提示语，选了图就是预览 */
function FormCover({ previewURL, isDragging, sideways }: {
  previewURL: string | null
  isDragging: boolean
  sideways: { width: number, height: number } | null
}) {
  useEffect(() => {
    global_queue.startWorking()
  }, [previewURL])

  const [load_status, blob_url] = useQueueload(previewURL === null ? undefined : previewURL, true)

  if (previewURL === null) {
    return (
      <span className={s.CoverTips}>
        {isDragging ? '对，就是这样，该放手了' : '点击此处选择作品，或者拖拽文件到此处'}
      </span>
    )
  } else if (load_status === 'LOADED') {
    return sideways === null
      ? <img className={s.CoverImage} src={blob_url} alt="投稿相片预览" />
      : (
        <img
          className={`${s.CoverImage} ${s.CoverImageSideways}`}
          src={blob_url}
          alt="投稿相片预览"
          style={{ width: `${sideways.width}px`, height: `${sideways.height}px` }}
        />
      )
  } else if (load_status === 'FAILURE') {
    return <span className={s.CoverTips}>图片读取失败</span>
  } else {
    return <LoadingMask opacity={0.7} />
  }
}

function selectPreviewPicture(
  exists_photo_thumb_url: string | null,
  will_upload_image: WillUploadImage,
): string | null {
  if (will_upload_image !== null) {
    return will_upload_image.blob_url
  } else if (exists_photo_thumb_url !== null) {
    return exists_photo_thumb_url
  } else {
    return null
  }
}
