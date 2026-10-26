import React, { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { listMembers } from '../api/member'
import { createPhoto, getPhoto, updatePhoto } from '../api/photo'
import { refreshThumb } from '../api/image'
import type { Member, Photo, UploadResult } from '../api/types'
import { PageHeader, PageLoading, Spinner } from '../components/Feedback'
import Field from '../components/Field'
import Icon from '../components/Icon'
import SearchSelect from '../components/SearchSelect'
import UploadBox from '../components/UploadBox'
import { useToast } from '../components/ToastProvider'
import { getApiErrorMessage } from '../utils/errors'
import { formatQQ } from '../utils/format'

type FormState = {
  member_id: number | null
  desc: string
  temp_id: string
}

type FormErrors = Partial<Record<'member_id' | 'temp_id', string>>

export default function PhotoEditPage() {
  const { gallery_id: galleryIDParam, id: photoIDParam } = useParams<{
    gallery_id: string
    id?: string
  }>()
  const galleryID = Number(galleryIDParam)
  const photoID = Number(photoIDParam)
  // The explicit /photo/new route has no :id param; older links may also
  // carry id="new" through the dynamic route.
  const isNew = photoIDParam === undefined || photoIDParam === 'new'
  const navigate = useNavigate()
  const toast = useToast()

  const [members, setMembers] = useState<Member[]>([])
  const [form, setForm] = useState<FormState>({ member_id: null, desc: '', temp_id: '' })
  const [previewUrl, setPreviewUrl] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [refreshingThumb, setRefreshingThumb] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)

  const load = useCallback(async () => {
    if (!Number.isInteger(galleryID) || galleryID <= 0 || (!isNew && (!Number.isInteger(photoID) || photoID <= 0))) {
      setLoadError('无效的相册或相片 ID')
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError('')
    try {
      const [memberList, photo] = await Promise.all([
        listMembers(),
        isNew ? Promise.resolve<Photo | null>(null) : getPhoto(photoID),
      ])

      setMembers(Array.isArray(memberList) ? memberList : [])

      if (photo) {
        setForm({
          member_id: photo.member_id,
          desc: photo.desc ?? '',
          temp_id: '',
        })
        setPreviewUrl(photo.thumb_url)
      } else {
        setForm({ member_id: null, desc: '', temp_id: '' })
        setPreviewUrl('')
      }
      setErrors({})
    } catch (err) {
      setLoadError(getApiErrorMessage(err, '加载相片信息失败'))
    } finally {
      setLoading(false)
    }
  }, [galleryID, isNew, photoID])

  useEffect(() => {
    void load()
  }, [load])

  const handleUploaded = (result: UploadResult) => {
    setForm(current => ({ ...current, temp_id: result.temp_id }))
    setPreviewUrl(result.preview_url ?? '')
    setErrors(current => ({ ...current, temp_id: undefined }))
  }

  const validate = () => {
    const nextErrors: FormErrors = {}
    if (form.member_id === null) {
      nextErrors.member_id = '请选择相片作者'
    }
    if (isNew && !form.temp_id) {
      nextErrors.temp_id = '请上传相片'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleRefreshThumb = async () => {
    if (isNew || refreshingThumb || submitting || imageUploading) {
      return
    }
    setRefreshingThumb(true)
    try {
      await refreshThumb({ photo_id: photoID })
      const photo = await getPhoto(photoID)
      const separator = photo.thumb_url.includes('?') ? '&' : '?'
      setPreviewUrl(`${photo.thumb_url}${separator}refresh=${Date.now()}`)
      toast.success('缩略图已重新生成')
    } catch (err) {
      toast.error(getApiErrorMessage(err, '重新生成缩略图失败'))
    } finally {
      setRefreshingThumb(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || imageUploading || !validate()) {
      return
    }

    if (!Number.isInteger(galleryID) || form.member_id === null) {
      return
    }

    setSubmitting(true)
    try {
      if (isNew) {
        await createPhoto({
          gallery_id: galleryID,
          member_id: form.member_id,
          desc: form.desc,
          temp_id: form.temp_id,
        })
        toast.success('相片已创建')
      } else {
        await updatePhoto(photoID, {
          gallery_id: galleryID,
          member_id: form.member_id,
          desc: form.desc,
          ...(form.temp_id ? { temp_id: form.temp_id } : {}),
        })
        toast.success('相片已更新')
      }

      navigate(`/admin/gallery/${galleryID}/photo/list`, { replace: true })
    } catch (err) {
      toast.error(getApiErrorMessage(err, isNew ? '创建相片失败' : '更新相片失败'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <PageLoading label="正在加载相片…" />
  }

  const memberOptions = members.map(member => ({
    value: member.id,
    label: member.name,
    meta: formatQQ(member.qq_num),
  }))

  return (
    <div className="adm-page">
      <PageHeader
        title={isNew ? '创建相片' : '编辑相片'}
        subtitle={isNew ? `相册 ID：${galleryID}` : `相片 ID：${photoID}`}
        backTo={`/admin/gallery/${galleryID}/photo/list`}
        backLabel="返回相片列表"
        actions={!isNew ? (
          <button
            type="button"
            className="adm-button"
            disabled={refreshingThumb || submitting || imageUploading}
            onClick={() => void handleRefreshThumb()}
          >
            {refreshingThumb
              ? <><Spinner size={16} /> 生成中…</>
              : <><Icon name="refresh" size={16} /> 重新生成缩略图</>}
          </button>
        ) : undefined}
      />

      {loadError ? (
        <div className="adm-inline-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="adm-button adm-button--small" onClick={() => void load()}>
            重试
          </button>
        </div>
      ) : (
        <div className="adm-form-card">
          <form className="adm-form" onSubmit={handleSubmit} noValidate>
            <Field label="作者" required error={errors.member_id}>
              {members.length === 0 ? (
                <div className="adm-empty-inline">
                  还没有成员，请先
                  <Link to="/admin/member/new">创建成员</Link>
                  再回来投稿。
                </div>
              ) : (
                <SearchSelect
                  options={memberOptions}
                  value={form.member_id}
                  onChange={value => {
                    setForm(current => ({ ...current, member_id: value }))
                    setErrors(current => ({ ...current, member_id: undefined }))
                  }}
                  placeholder="搜索并选择作者"
                  disabled={!isNew}
                  required
                />
              )}
              {!isNew && <div className="adm-field__hint">相片创建后不能修改作者。</div>}
            </Field>

            <Field label="相片预览" required error={errors.temp_id}>
              <UploadBox
                previewUrl={previewUrl}
                onUploaded={handleUploaded}
                onUploadingChange={setImageUploading}
                disabled={submitting}
              />
            </Field>

            <Field label="相片描述" htmlFor="photo-desc" hint="可以留空">
              <textarea
                id="photo-desc"
                className="adm-textarea"
                rows={4}
                value={form.desc}
                onChange={event => setForm(current => ({ ...current, desc: event.target.value }))}
                placeholder="写一点关于这张相片的描述"
              />
            </Field>

            <div className="adm-form-actions">
              <Link className="adm-button" to={`/admin/gallery/${galleryID}/photo/list`}>取消</Link>
              <button type="submit" className="adm-button adm-button--primary" disabled={submitting || imageUploading}>
                {submitting
                  ? <><Spinner size={16} /> 保存中…</>
                  : <><Icon name="check" size={16} /> {isNew ? '创建相片' : '保存修改'}</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
