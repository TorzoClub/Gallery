import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import ImageUploadingImport, { type ImageType, type ImageListType } from 'react-images-uploading'
import heicConvert from 'heic-convert/browser'

import { useSubmissionStore } from '.'
import { PhotoInActive, PhotoNormal, submitPhoto, updateSubmission } from 'api/photo'
import { uploadImage } from 'api/upload'

import s from './PhotoCreateOrEdit.module.scss'
import { LoadingMask } from 'components/Loading'
import { global_queue, useQueueload } from 'utils/queue-load'
import SkeuomorphismButton from 'components/SkeuomorphismButton'

// Vite's CJS interop for this package can expose the module exports object as
// the default import. Normalize both the CJS and ESM shapes to the component.
const ImageUploading = (
  (ImageUploadingImport as unknown as { default?: typeof ImageUploadingImport }).default
    ?? ImageUploadingImport
) as typeof ImageUploadingImport

type WillUploadImage = null | { blob: Blob, filename: string, blob_url: string }

type Props = {
  onUpdateDone(data: PhotoNormal): void
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

      if (is_edit_mode) {
        const photo_id = (photo as PhotoInActive).id
        const edited_photo = await updateSubmission({
          photo_id,
          qq_num: Number(qq_num),
          desc: description,
          ...(temp_id === undefined ? {} : { temp_id }),
        })
        onUpdateDone(edited_photo)
      } else {
        if (!temp_id) {
          throw new Error('请选择一张图像')
        }
        if (gallery_id === null) {
          throw new Error('缺少相册信息')
        }
        const created_photo = await submitPhoto({
          gallery_id,
          qq_num: Number(qq_num),
          desc: description,
          temp_id,
        })
        onUpdateDone(created_photo)
      }
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
          const jpg_buf = await heicConvert({
            buffer: new Uint8Array(array_buffer),
            format: 'JPEG',
            quality: 0.8,
          })
          const jpg_blob = new Blob([new Uint8Array(jpg_buf)], { type: 'image/jpeg' })
          setWillUploadImage({
            filename: `img-${Date.now()}.jpg`,
            blob: jpg_blob,
            blob_url: URL.createObjectURL(jpg_blob)
          })
        } else {
          setWillUploadImage({ filename: file.name, blob, blob_url: URL.createObjectURL(blob) })
        }
      }
    }
  }, [])

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
        {({
          // imageList,
          onImageUpload,
          onImageRemoveAll,
          onImageUpdate,
          onImageRemove,
          isDragging,
          dragProps,
          errors
        }) => {
          return (
            <div className="upload__image-wrapper">
              <button
                type="button"
                className={s.UploadButton}
                aria-label="选择或更换投稿图片"
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  background: 'transparent',
                  border: 'none',
                  margin: '0',
                  padding: '0',
                }}
                onClick={onImageUpload}
                {...dragProps}
              >
                {/* {errors && <div>
                  {errors.maxNumber && <span>Number of selected images exceed maxNumber</span>}
                  {errors.acceptType && <span>Your selected file type is not allow</span>}
                  {errors.maxFileSize && <span>Selected file size exceed maxFileSize</span>}
                  {errors.resolution && <span>Selected file is not match your desired resolution</span>}
                </div>} */}
                <PreviewBox
                  canClick={is_edit_mode}
                  previewURL={ selectPreviewPicture(photo ? photo.thumb_url : null, will_upload_image) }
                  isDragging={ isDragging }
                />
              </button>
              {/* <button onClick={onImageRemoveAll}>Remove all images</button> */}
            </div>
          )
        }}
      </ImageUploading>

      <textarea
        value={description}
        className={s.Textarea}
        onChange={(e) => {
          setDescription(e.target.value)
        }}
        placeholder='相片介绍，选填'
      />

      <div style={{ marginTop: '20px' }}>
        <SkeuomorphismButton onClick={handleSubmit}>提 交</SkeuomorphismButton>
      </div>

      {
        isProcessing && <LoadingMask />
      }
    </div>
  )
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

export function PreviewBox({
  previewURL,
  canClick,
  isDragging,
  height,
  imageAppendClassName = '',
}: {
  imageAppendClassName?: HTMLElement['className']
  height?: CSSProperties['height'],
  previewURL: string | null
  canClick: boolean,
  isDragging: boolean
}) {

  useEffect(() => {
    global_queue.startWorking()
  }, [previewURL])

  const [ load_status, blob_url ] = useQueueload(
    (previewURL === null) ? undefined : previewURL,
    true
  )

  return (
    <div className={s.PreviewBox} style={{ cursor: canClick ? 'pointer' : '' }}>
      {
        useMemo(() => {
          if (previewURL === null) {
            return <div className={[s.EmptyTips, isDragging ? s.IsDragging : ''].join(' ')}>
              { isDragging ? '对，就是这样，该放手了' : '点击此处选择作品，或者拖拽文件到此处' }
            </div>
          } else {
            if (load_status === 'LOADED') {
              return (
                <img
                  className={[s.PreviewImage, isDragging ? s.IsDragging : '', imageAppendClassName].join(' ')}
                  style={{ height }}
                  src={blob_url}
                />
              )
            } else if (load_status === 'FAILURE') {
              return (<>图片读取失败</>)
            } else {
              return (
                <div
                  className={[s.PreviewImage, isDragging ? s.IsDragging : '', imageAppendClassName].join(' ')}
                  style={{ height }}
                >
                  <LoadingMask />
                </div>
              )
            }
          }
        }, [previewURL, blob_url, height, imageAppendClassName, isDragging, load_status])
      }
    </div>
  )
}
