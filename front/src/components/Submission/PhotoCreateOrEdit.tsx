import React, { CSSProperties, useEffect, useMemo, useState } from 'react'
import ImageUploading, { ImageType, ImageListType } from 'react-images-uploading'
import { useSubmissionStore } from '.'
import { PhotoInActive, PhotoNormal } from 'api/photo'

import s from './PhotoCreateOrEdit.module.scss'
import PhotoBox from 'components/PhotoBox'
import Loading from 'components/Loading'
import { useQueueload } from 'utils/queue-load'

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

type Props = {
  onUpdateDone(data: PhotoNormal): void
}
export default function PhotoCreateOrEdit({ onUpdateDone }: Props) {
  const [ isProcessing, setProcessing ] = useState(false)
  const [files, setFiles] = React.useState<ImageListType>([])
  const { photo, gallery_id, qq_num } = useSubmissionStore.getState()
  const [description, setDescription] = useState(photo?.desc || '')
  const will_upload_image = useMemo(() => {
    if (files.length) {
      return files[0]
    } else {
      return null
    }
  }, [files])

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
          const { file } = will_upload_image
          if (!file) {
            alert('!file')
          } else {
            // onUpdateDone
            const arrayBuffer = await file.arrayBuffer()
            const blob = new Blob([new Uint8Array(arrayBuffer)], {type: file.type })
            formData.append('image', blob, file.name)
            console.log('blob', blob)
          }
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

  return (
    <div>
      <ImageUploading
        inputProps={{
          // style: { WebkitAppearance: 'none', display: 'none' }
        }}
        value={files}
        onChange={(e) => {
          console.log('onChange', e)
          setFiles(e)
        }}
      >
        {({
          imageList,
          onImageUpload,
          onImageRemoveAll,
          onImageUpdate,
          onImageRemove,
          isDragging,
          dragProps
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
                <PreviewBox
                  previewURL={ selectPreviewPicture(imageList, photo ? photo.thumb_url : null) }
                  isDragging={ isDragging }
                />
                {
                  // preview_image_url === null ? '点击选择作品，或者拖拽文件到此处' :(
                  //   imageList.map((image, index) => (
                  //     <div key={index} className="image-item">
                  //       <img src={image.dataURL} alt="" width="100" />
                        /* <div className="image-item__btn-wrapper">
                          <button onClick={() => onImageUpdate(index)}>Update</button>
                          <button onClick={() => onImageRemove(index)}>Remove</button>
                        </div> */
                  //     </div>
                  //   ))
                  // )
                }
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

      <div className={s.ButtonContainer}>
        <button
          className={s.ButtonBefore}
          onClick={handleSubmit}
          type="button"
        >提交</button>
      </div>

      {
        isProcessing && <div className="loading-wrapper">
          <Loading />
        </div>
      }
    </div>
  )
}

function selectPreviewPicture(
  imageList: ImageListType,
  exists_photo_thumb_url: string | null
): string | null {
  if (imageList.length) {
    const { dataURL } = imageList[0]
    if (dataURL === undefined) {
      return exists_photo_thumb_url
    } else {
      return dataURL
    }
  } else if (exists_photo_thumb_url !== null) {
    return exists_photo_thumb_url
  } else {
    return null
  }
}

export function PreviewBox({
  previewURL,
  isDragging,
  height,
  imageAppendClassName = '',
}: {
  imageAppendClassName?: HTMLElement['className']
  height?: CSSProperties['height'],
  previewURL: string | null
  isDragging: boolean
}) {
  const [ loaded, blob_url ] = useQueueload(
    (previewURL === null) ? undefined : previewURL,
    true
  )
  return (
    <div className={s.PreviewBox}>
      {
        useMemo(() => {
          if (previewURL === null) {
            return <div className={[s.EmptyTips, isDragging ? s.IsDragging : ''].join(' ')}>
              { isDragging ? '对，就是这样，该放手了' : '点击此处选择作品，或者拖拽文件到此处' }
            </div>
          } else {
            if (loaded) {
              return (
                <img
                  className={[s.PreviewImage, isDragging ? s.IsDragging : '', imageAppendClassName].join(' ')}
                  style={{ height }}
                  src={blob_url}
                />
              )
            } else {
              return (
                <div
                  className={[s.PreviewImage, isDragging ? s.IsDragging : '', imageAppendClassName].join(' ')}
                  style={{ height }}
                >
                  <div className="loading-wrapper">
                    <Loading />
                  </div>
                </div>
              )
            }
          }
        }, [blob_url, height, imageAppendClassName, isDragging, loaded, previewURL])
      }
    </div>
  )
}
