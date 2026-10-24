import React, { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { createMember, getMember, updateMember } from '../api/member'
import type { Member, MemberCreatePayload, MemberUpdatePayload, UploadResult } from '../api/types'
import { PageHeader, PageLoading, Spinner } from '../components/Feedback'
import Field from '../components/Field'
import Icon from '../components/Icon'
import UploadBox from '../components/UploadBox'
import { useToast } from '../components/ToastProvider'
import { getApiErrorMessage } from '../utils/errors'

type FormState = {
  name: string
  qq_num: string
  avatar_temp_id: string
}

type FormErrors = Partial<Record<'name' | 'qq_num' | 'avatar_temp_id', string>>

export default function MemberEditPage() {
  const { id } = useParams<{ id?: string }>()
  // The explicit /member/new route has no :id param; older links may also
  // carry id="new" through the dynamic route.
  const isNew = id === undefined || id === 'new'
  const numericID = Number(id)
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState<FormState>({ name: '', qq_num: '', avatar_temp_id: '' })
  const [previewUrl, setPreviewUrl] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const load = useCallback(async () => {
    if (isNew) {
      setForm({ name: '', qq_num: '', avatar_temp_id: '' })
      setPreviewUrl('')
      setErrors({})
      setLoadError('')
      setLoading(false)
      return
    }

    if (!Number.isInteger(numericID) || numericID <= 0) {
      setLoadError('无效的成员 ID')
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError('')
    try {
      const member: Member = await getMember(numericID)
      setForm({
        name: member.name,
        qq_num: String(member.qq_num),
        avatar_temp_id: '',
      })
      setPreviewUrl(member.avatar_thumb_url)
    } catch (err) {
      setLoadError(getApiErrorMessage(err, '获取成员信息失败'))
    } finally {
      setLoading(false)
    }
  }, [isNew, numericID])

  useEffect(() => {
    void load()
  }, [load])

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(current => ({ ...current, [key]: value }))
    setErrors(current => ({ ...current, [key]: undefined }))
  }

  const validate = () => {
    const nextErrors: FormErrors = {}
    if (!form.name.trim()) {
      nextErrors.name = '请输入成员名称'
    }
    if (isNew && (!/^\d+$/.test(form.qq_num.trim()) || Number(form.qq_num) <= 0)) {
      nextErrors.qq_num = 'QQ 号需要是大于 0 的整数'
    }
    if (isNew && !form.avatar_temp_id) {
      nextErrors.avatar_temp_id = '请上传成员头像'
    }
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleUploaded = (result: UploadResult) => {
    setForm(current => ({ ...current, avatar_temp_id: result.temp_id }))
    setPreviewUrl(result.preview_url ?? '')
    setErrors(current => ({ ...current, avatar_temp_id: undefined }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting || avatarUploading || !validate() || isNew === false && !Number.isInteger(numericID)) {
      return
    }

    const update_payload: MemberUpdatePayload = {
      name: form.name.trim(),
    }
    if (form.avatar_temp_id) {
      update_payload.avatar_temp_id = form.avatar_temp_id
    }

    setSubmitting(true)
    try {
      if (isNew) {
        const create_payload: MemberCreatePayload = {
          name: form.name.trim(),
          ...(form.avatar_temp_id ? { avatar_temp_id: form.avatar_temp_id } : {}),
          qq_num: Number(form.qq_num),
        }
        await createMember(create_payload)
        toast.success(`【${create_payload.name}】已创建`)
      } else {
        await updateMember(numericID, update_payload)
        toast.success(`【${update_payload.name}】已更新`)
      }
      navigate('/admin/member', { replace: true })
    } catch (err) {
      toast.error(getApiErrorMessage(err, isNew ? '创建成员失败' : '更新成员失败'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <PageLoading label="正在加载成员…" />
  }

  if (loadError) {
    return (
      <div className="adm-page">
        <PageHeader title={isNew ? '创建成员' : '编辑成员'} backTo="/admin/member" backLabel="返回成员列表" />
        <div className="adm-inline-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="adm-button adm-button--small" onClick={() => void load()}>
            重试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="adm-page">
      <PageHeader
        title={isNew ? '创建成员' : '编辑成员'}
        subtitle={isNew ? '新增投稿作者资料' : `成员 ID：${numericID}`}
        backTo="/admin/member"
        backLabel="返回成员列表"
      />

      <div className="adm-form-card">
        <form className="adm-form" onSubmit={handleSubmit} noValidate>
          <Field label="成员名称" htmlFor="member-name" required error={errors.name}>
            <input
              id="member-name"
              className="adm-input"
              value={form.name}
              onChange={event => setField('name', event.target.value)}
              placeholder="请输入成员名称"
            />
          </Field>

          <Field label="成员头像" required error={errors.avatar_temp_id} hint="建议使用正方形图片，上传后按后台配置生成头像缩略图">
            <UploadBox
              previewUrl={previewUrl}
              thumbSize={128}
              variant="avatar"
              onUploaded={handleUploaded}
              onUploadingChange={setAvatarUploading}
              disabled={submitting}
            />
          </Field>

          <Field
            label="成员 QQ 号"
            htmlFor="member-qq"
            required
            error={errors.qq_num}
            hint={isNew ? undefined : 'QQ 号创建后不可修改'}
          >
            <input
              id="member-qq"
              className="adm-input"
              inputMode="numeric"
              value={form.qq_num}
              onChange={event => setField('qq_num', event.target.value)}
              placeholder="请输入 QQ 号"
              disabled={!isNew}
            />
          </Field>

          <div className="adm-form-actions">
            <Link className="adm-button" to="/admin/member">取消</Link>
            <button type="submit" className="adm-button adm-button--primary" disabled={submitting || avatarUploading}>
              {submitting
                ? <><Spinner size={16} /> 保存中…</>
                : <><Icon name="check" size={16} /> {isNew ? '创建成员' : '保存修改'}</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
