import React, { useId, useMemo, useRef } from 'react'
import useGalleryFloat, { type FloatTarget } from './useGalleryFloat'
import styles from './GalleryHeader.module.scss'

type Props = {
  name: string
  expanded: boolean
  controls?: string
  empty: boolean
  onToggle(): void
  sorting?: boolean
  dragging?: boolean
  dragOver?: boolean
  dropAfter?: boolean
  onDragHandlePointerDown?(event: React.PointerEvent<HTMLSpanElement>): void
}

type EmptyMaskRefs = {
  middle: React.RefObject<SVGGElement | null>
  front_in_back: React.RefObject<SVGGElement | null>
  front_in_middle: React.RefObject<SVGGElement | null>
}

type GalleryIconProps = {
  empty: boolean
  photo_refs?: readonly React.RefObject<SVGGElement | null>[]
  empty_mask_refs?: EmptyMaskRefs
}

function GalleryIcon({ empty, photo_refs, empty_mask_refs }: GalleryIconProps) {
  const uid = useId().replace(/:/g, '')
  const gradient_id = `gallery-icon-sky-${uid}`
  const back_mask_id = `gallery-icon-empty-back-${uid}`
  const middle_mask_id = `gallery-icon-empty-middle-${uid}`

  if (empty) {
    return (
      <svg
        className={styles.icon}
        viewBox='0 0 40 40'
        aria-hidden='true'
        focusable='false'
      >
        <defs>
          <mask id={back_mask_id} maskUnits='userSpaceOnUse' x='-6' y='-6' width='52' height='52'>
            <rect x='-6' y='-6' width='52' height='52' fill='#fff' />
            <g ref={empty_mask_refs?.middle}>
              <g transform='rotate(16 27 23)'>
                <rect x='21' y='11' width='17' height='23' rx='1.5' fill='#000' stroke='#000' strokeWidth='2' />
              </g>
            </g>
            <g ref={empty_mask_refs?.front_in_back}>
              <g transform='rotate(-4 22 20)'>
                <rect x='10' y='5' width='23' height='28' rx='1.5' fill='#000' stroke='#000' strokeWidth='2' />
              </g>
            </g>
          </mask>
          <mask id={middle_mask_id} maskUnits='userSpaceOnUse' x='-6' y='-6' width='52' height='52'>
            <rect x='-6' y='-6' width='52' height='52' fill='#fff' />
            <g ref={empty_mask_refs?.front_in_middle}>
              <g transform='rotate(-4 22 20)'>
                <rect x='10' y='5' width='23' height='28' rx='1.5' fill='#000' stroke='#000' strokeWidth='2' />
              </g>
            </g>
          </mask>
        </defs>
        <g mask={`url(#${back_mask_id})`}>
          <g ref={photo_refs?.[0]}>
            <g transform='rotate(-18 15 24)'>
              <rect x='4' y='13' width='18' height='24' rx='1.5' fill='none' stroke='#b9b3a4' strokeWidth='1' strokeDasharray='2.4 2.4' strokeLinecap='round' />
            </g>
          </g>
        </g>
        <g mask={`url(#${middle_mask_id})`}>
          <g ref={photo_refs?.[1]}>
            <g transform='rotate(16 27 23)'>
              <rect x='21' y='11' width='17' height='23' rx='1.5' fill='none' stroke='#b9b3a4' strokeWidth='1' strokeDasharray='2.4 2.4' strokeLinecap='round' />
            </g>
          </g>
        </g>
        <g ref={photo_refs?.[2]}>
          <g transform='rotate(-4 22 20)'>
            <rect x='10' y='5' width='23' height='28' rx='1.5' fill='none' stroke='#a9a292' strokeWidth='1.1' strokeDasharray='2.4 2.4' strokeLinecap='round' />
          </g>
        </g>
      </svg>
    )
  }

  return (
    <svg
      className={styles.icon}
      viewBox='0 0 40 40'
      aria-hidden='true'
      focusable='false'
    >
      <defs>
        <linearGradient id={gradient_id} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0' stopColor='#5cc9ff' />
          <stop offset='0.62' stopColor='#238de4' />
          <stop offset='1' stopColor='#bdeeff' />
        </linearGradient>
      </defs>

      <g ref={photo_refs?.[0]}>
        <g transform='rotate(-18 15 24)'>
          <rect x='4' y='13' width='18' height='24' rx='1.5' fill='#fffdf6' stroke='#b9b3a4' strokeWidth='0.8' />
          <rect x='6' y='15' width='14' height='17' rx='0.5' fill='#e7a13e' />
          <path d='M6 27c3-4 6-1 8-5 2 3 4 2 6 4v5H6z' fill='#8f4a19' opacity='0.8' />
          <path d='M7 31h12' stroke='#d6cfbd' strokeWidth='1.4' />
        </g>
      </g>

      <g ref={photo_refs?.[1]}>
        <g transform='rotate(16 27 23)'>
          <rect x='21' y='11' width='17' height='23' rx='1.5' fill='#fffdf6' stroke='#b9b3a4' strokeWidth='0.8' />
          <rect x='23' y='13' width='13' height='14' rx='0.5' fill='#2f3038' />
          <path d='M23 24c2-3 4-2 6-4 2 1 3 3 7 4v4H23z' fill='#5a5146' />
          <path d='M24 30h11' stroke='#d6cfbd' strokeWidth='1.4' />
        </g>
      </g>

      <g ref={photo_refs?.[2]}>
        <g transform='rotate(-4 22 20)'>
          <rect x='10' y='5' width='23' height='28' rx='1.5' fill='#fffdf6' stroke='#a9a292' strokeWidth='0.9' />
          <rect x='12' y='7' width='19' height='19' rx='0.5' fill={`url(#${gradient_id})`} />
          <path d='M14 16c2-2 4-1 5 0 2-2 4-1 5 0 2-2 4-1 5 0 2-2 4-1 5 0v4c-3 1-6 2-10 0-2-1-3-1-5-1z' fill='#fff' opacity='0.82' />
          <path d='M13 22c4 2 8 1 11 0 3-1 5-1 7 0v3H13z' fill='#fff' opacity='0.5' />
          <rect x='13' y='28' width='17' height='2' rx='0.8' fill='#e4ddcd' />
        </g>
      </g>
    </svg>
  )
}

export default function GalleryHeader({
  name,
  expanded,
  controls,
  empty,
  onToggle,
  sorting = false,
  dragging = false,
  dragOver = false,
  dropAfter = false,
  onDragHandlePointerDown,
}: Props) {
  const name_ref = useRef<HTMLSpanElement>(null)
  const handle_ref = useRef<HTMLSpanElement>(null)
  const photo_back_ref = useRef<SVGGElement>(null)
  const photo_middle_ref = useRef<SVGGElement>(null)
  const photo_front_ref = useRef<SVGGElement>(null)
  const empty_mask_middle_ref = useRef<SVGGElement>(null)
  const empty_mask_front_in_back_ref = useRef<SVGGElement>(null)
  const empty_mask_front_in_middle_ref = useRef<SVGGElement>(null)

  const photo_refs = useMemo(
    () => [photo_back_ref, photo_middle_ref, photo_front_ref],
    [],
  )
  const empty_mask_refs = useMemo<EmptyMaskRefs>(() => ({
    middle: empty_mask_middle_ref,
    front_in_back: empty_mask_front_in_back_ref,
    front_in_middle: empty_mask_front_in_middle_ref,
  }), [])
  const float_targets = useMemo<FloatTarget[]>(() => [
    { ref: name_ref },
    { ref: handle_ref },
    { ref: photo_back_ref, svg: true },
    {
      ref: photo_middle_ref,
      svg: true,
      linked_refs: [empty_mask_middle_ref],
    },
    {
      ref: photo_front_ref,
      svg: true,
      linked_refs: [empty_mask_front_in_back_ref, empty_mask_front_in_middle_ref],
    },
  ], [])

  useGalleryFloat(float_targets, sorting)

  const icon = (
    <GalleryIcon
      empty={empty}
      photo_refs={photo_refs}
      empty_mask_refs={empty_mask_refs}
    />
  )
  const name_node = <span ref={name_ref} className={styles.name}>{name}</span>

  if (sorting) {
    const sort_class = [
      styles.header,
      styles.sortHeader,
      dragging ? styles.dragging : '',
      dragOver ? (dropAfter ? styles.dragOverAfter : styles.dragOverBefore) : '',
    ].filter(Boolean).join(' ')

    return (
      <div className={sort_class}>
        {icon}
        <span
          ref={handle_ref}
          className={`${styles.chevron} ${styles.dragHandle}`}
          aria-hidden='true'
          onPointerDown={event => onDragHandlePointerDown?.(event)}
        >
          <svg viewBox='0 0 16 16' focusable='false'>
            <path d='M8 0.8 L12.2 4.6 L3.8 4.6 Z' />
            <rect x='2' y='6' width='12' height='1.7' rx='0.85' />
            <rect x='2' y='8.3' width='12' height='1.7' rx='0.85' />
            <rect x='2' y='10.6' width='12' height='1.7' rx='0.85' />
            <path d='M3.8 13.1 L12.2 13.1 L8 16 Z' />
          </svg>
        </span>
        {name_node}
      </div>
    )
  }

  return (
    <button
      type='button'
      className={styles.header}
      aria-expanded={expanded}
      aria-controls={controls}
      aria-label={expanded ? `收起相册 ${name}` : `展开相册 ${name}`}
      onClick={onToggle}
    >
      {icon}
      <span className={styles.chevron} aria-hidden='true'>
        <svg viewBox='0 0 16 16' focusable='false'>
          {expanded
            ? <path d='M3 6l5 5 5-5' />
            : <path d='M6 3l5 5-5 5' />}
        </svg>
      </span>
      {name_node}
    </button>
  )
}
