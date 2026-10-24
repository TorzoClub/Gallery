import React, { useEffect, useState } from 'react'

import Icon from './Icon'

type Props = {
  src?: string | null
  alt?: string
  variant?: 'photo' | 'avatar'
  onClick?: () => void
  className?: string
}

export default function ImageThumb({
  src,
  alt = '',
  variant = 'photo',
  onClick,
  className,
}: Props) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  const classes = [
    'adm-thumb',
    `adm-thumb--${variant}`,
    onClick ? 'adm-thumb--clickable' : '',
    className,
  ].filter(Boolean).join(' ')

  const content = src && !failed
    ? <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
    : <span className="adm-thumb__fallback"><Icon name="gallery" size={variant === 'avatar' ? 16 : 20} /></span>

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={alt || '查看图片'}>
        {content}
      </button>
    )
  }

  return <span className={classes}>{content}</span>
}
