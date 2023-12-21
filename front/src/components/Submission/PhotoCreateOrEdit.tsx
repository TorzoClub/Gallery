import React, { useMemo, useState } from 'react'
import ImageUploading, { ImageType, ImageListType } from 'react-images-uploading'
import { useSubmissionStore } from '.'
import { PhotoNormal } from 'api/photo'

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
    const formData = new FormData()
    formData.append('desc', description)
    formData.append('gallery_id', `${gallery_id}`)
    formData.append('qq_num', `${qq_num}`)

    if (!is_edit_mode && !will_upload_image) {
      alert('请选择一张图像')
    } else {
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
        const photo_id = (photo as PhotoNormal).id
        const edited_photo = await editSubmission(photo_id, formData)
        onUpdateDone(edited_photo)
      } else {
        // 创建请求
        const created_photo = await newSubmission(formData)
        onUpdateDone(created_photo)
      }
    }
  }

  return (
    <div>
      <ImageUploading
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
                style={isDragging ? { color: 'red' } : undefined}
                onClick={onImageUpload}
                {...dragProps}
              >
                Click or Drop here
                {imageList.map((image, index) => (
                <div key={index} className="image-item">
                  <img src={image.dataURL} alt="" width="100" />
                  {/* <div className="image-item__btn-wrapper">
                    <button onClick={() => onImageUpdate(index)}>Update</button>
                    <button onClick={() => onImageRemove(index)}>Remove</button>
                  </div> */}
                </div>
              ))}
              </button>
              {/* <button onClick={onImageRemoveAll}>Remove all images</button> */}
            </div>
          )
        }}
      </ImageUploading>

      <textarea
        value={description}
        onChange={(e) => {
          setDescription(e.target.value)
        }}
        placeholder='相片介绍，选填'
      />

      <button onClick={handleSubmit}>提交</button>
    </div>
  )
}
