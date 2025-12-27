import { CSSProperties, useCallback, useEffect, useMemo, useState } from 'react'
import ImageUploading, { ImageType, ImageListType } from 'react-images-uploading'
import heicConvert from 'heic-convert/browser'

import { useSubmissionStore } from '.'
import { PhotoInActive, PhotoNormal } from 'api/photo'

import s from './PhotoCreateOrEdit.module.scss'
import { LoadingMask } from 'components/Loading'
import { global_queue, useQueueload } from 'utils/queue-load'
import SkeuomorphismButton from 'components/SkeuomorphismButton'

function justUseTemplateString(strs: TemplateStringsArray, ...args: (number | string)[]) {
  const str = strs.reduce((a, b, idx) => {
      if (idx < args.length) {
        return `${a}${b}${args[idx]}`
      } else {
          return `${a}${b}`
      }
  }, '')
  return str
}

function baseURL(url_strs: TemplateStringsArray, ...args: (number | string)[]) {
  const url = justUseTemplateString(url_strs, ...args)

  const base_url = process.env.REACT_APP_API_PREFIX
  if (base_url === undefined) {
    throw new Error('REACT_APP_API_PREFIX missing')
  } else {
    if ('/' === base_url[base_url.length - 1]) {
      if (url[0] === '/') {
        return `${base_url.slice(0, base_url.length - 1)}${url}`
      } else {
        return `${base_url}${url}`
      }
    } else {
      if (url[0] === '/') {
        return `${base_url}${url}`
      } else {
        return `${base_url}/${url}`
      }
    }
  }
}

async function newSubmission(form_data: FormData): Promise<PhotoNormal> {
  const res = await fetch(baseURL`/photo`, {
    method: 'POST',
    body: form_data,
  })
  if (res.status !== 200) {
    throw new Error('submitNewPhoto failure: status is not 200')
  } else {
    return await res.json()
  }
}

async function editSubmission(photo_id: number | string, form_data: FormData): Promise<PhotoNormal> {
  const res = await fetch(baseURL`/photo/${photo_id}`, {
    method: 'PATCH',
    body: form_data,
  })
  if (res.status !== 200) {
    throw new Error('editPhoto failure: status is not 200')
  } else {
    return await res.json()
  }
}

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
    } else {
      const formData = new FormData()
      formData.append('desc', description)
      formData.append('gallery_id', `${gallery_id}`)
      formData.append('qq_num', `${qq_num}`)

      try {
        setProcessing(true)
        if (will_upload_image) {
          const { blob, filename } = will_upload_image
          formData.append('image', blob, filename)
          console.log('blob', blob)
        }

        if (is_edit_mode) {
          // 编辑请求
          const photo_id = (photo as PhotoInActive).id
          const edited_photo = await editSubmission(photo_id, formData)
          onUpdateDone(edited_photo)
        } else {
          // 创建请求
          const created_photo = await newSubmission(formData)
          onUpdateDone(created_photo)
        }
      } catch (err) {
        alert(`错误: ${err}`)
      } finally {
        setProcessing(false)
      }
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
            buffer: new Uint8Array(array_buffer) as unknown as ArrayBuffer,
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
