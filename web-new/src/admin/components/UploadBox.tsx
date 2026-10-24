import React, { useEffect, useRef, useState } from 'react'

import { uploadImage } from '../api/image'
import type { UploadResult } from '../api/types'
import { getApiErrorMessage } from '../utils/errors'
import Icon from './Icon'

const defaultAccept = '.jpg,.jpeg,.png,.gif,.webp,.avif,image/jpeg,image/png,image/gif,image/webp,image/avif'
const allowedTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
])
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']

type Props = {
  previewUrl?: string
  thumbSize?: number
  accept?: string
  disabled?: boolean
  variant?: 'photo' | 'avatar'
  onUploaded: (result: UploadResult) => void
  onUploadingChange?: (uploading: boolean) => void
}

function isSupportedImage(file: File) {
  if (allowedTypes.has(file.type.toLowerCase())) {
    return true
  }
  const name = file.name.toLowerCase()
  return allowedExtensions.some(extension => name.endsWith(extension))
}

export default function UploadBox({
  previewUrl,
  thumbSize,
  accept = defaultAccept,
  disabled = false,
  variant = 'photo',
  onUploaded,
  onUploadingChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const mountedRef = useRef(true)
  const objectURLRef = useRef<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [percent, setPercent] = useState(0)
  const [error, setError] = useState('')
  const [localPreview, setLocalPreview] = useState('')
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (objectURLRef.current) {
        URL.revokeObjectURL(objectURLRef.current)
      }
    }
  }, [])

  useEffect(() => {
    onUploadingChange?.(uploading)
  }, [onUploadingChange, uploading])

  const clearObjectURL = () => {
    if (objectURLRef.current) {
      URL.revokeObjectURL(objectURLRef.current)
      objectURLRef.current = null
    }
  }

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled || uploading) {
      return
    }

    if (!isSupportedImage(file)) {
      setError('不支持的图片格式，请选择 JPG / PNG / GIF / WebP / AVIF')
      return
    }

    setError('')
    setPercent(0)
    setUploading(true)
    clearObjectURL()

    const objectURL = URL.createObjectURL(file)
    objectURLRef.current = objectURL
    setLocalPreview(objectURL)

    try {
      const result = await uploadImage(file, {
        onProgress: value => {
          if (mountedRef.current) {
            setPercent(value)
          }
        },
      })

      if (!mountedRef.current) {
        return
      }

      onUploaded({
        ...result,
        preview_url: objectURL,
      })
    } catch (err) {
      if (!mountedRef.current) {
        return
      }
      clearObjectURL()
      setLocalPreview('')
      setError(getApiErrorMessage(err, '图片上传失败'))
    } finally {
      if (mountedRef.current) {
        setUploading(false)
        setPercent(0)
      }
      if (inputRef.current) {
        inputRef.current.value = ''
      }
    }
  }

  const preview = localPreview || previewUrl || ''

  return (
    <div className={`adm-upload adm-upload--${variant}`}>
      <input
        ref={inputRef}
        className="adm-upload__input"
        type="file"
        accept={accept}
        disabled={disabled || uploading}
        onChange={event => {
          void handleFile(event.target.files?.[0])
        }}
      />

      <button
        type="button"
        className={[
          'adm-upload__drop',
          dragActive ? 'adm-upload__drop--drag' : '',
          preview ? 'adm-upload__drop--has-preview' : '',
        ].filter(Boolean).join(' ')}
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        onDragEnter={event => {
          event.preventDefault()
          if (!disabled && !uploading) {
            setDragActive(true)
          }
        }}
        onDragOver={event => {
          event.preventDefault()
        }}
        onDragLeave={event => {
          event.preventDefault()
          setDragActive(false)
        }}
        onDrop={event => {
          event.preventDefault()
          setDragActive(false)
          void handleFile(event.dataTransfer.files?.[0])
        }}
      >
        {preview ? (
          <>
            <img className="adm-upload__preview" src={preview} alt="图片预览" />
            <span className="adm-upload__replace">点击更换图片</span>
          </>
        ) : (
          <span className="adm-upload__placeholder">
            <Icon name="upload" size={24} />
            <span>点击或拖拽上传</span>
          </span>
        )}

        {uploading && (
          <span className="adm-upload__progress">
            <span className="adm-upload__progress-bar" style={{ width: `${percent}%` }} />
            <span className="adm-upload__progress-text">{percent}%</span>
          </span>
        )}
      </button>

      {error && <div className="adm-field__error" role="alert">{error}</div>}
      <div className="adm-upload__hint">支持 JPG / PNG / GIF / WebP / AVIF</div>
    </div>
  )
}
