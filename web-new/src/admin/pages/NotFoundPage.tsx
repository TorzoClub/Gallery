import React from 'react'
import { Link } from 'react-router-dom'

import { PageHeader } from '../components/Feedback'
import Icon from '../components/Icon'

export default function NotFoundPage() {
  return (
    <div className="adm-page">
      <PageHeader title="页面不存在" subtitle="你访问的后台页面不存在，或者已经被移动。" />
      <div className="adm-empty adm-empty--page">
        <div className="adm-empty__code">404</div>
        <h3 className="adm-empty__title">没有找到这个页面</h3>
        <p className="adm-empty__description">检查一下地址，或者回到概览页继续操作。</p>
        <Link className="adm-button adm-button--primary" to="/admin/dashboard">
          <Icon name="home" size={16} />
          回到概览
        </Link>
      </div>
    </div>
  )
}
