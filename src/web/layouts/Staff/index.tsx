import React, { useLayoutEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

import Navigator from '../../components/Navigator'
import { STAFF_HUMAN_NOTES, STAFF_ROBOT_NOTES, type StaffNote } from './notes'
import styles from './index.module.scss'

/**
 * 每张纸的基础倾角，按顺序轮换；相邻两张一左一右，不会排成一条斜线。
 * 这是纸高 ≤ SHEET_REF_HEIGHT 时的倾角，纸越长摆得越正，见 sheetAngle
 */
const SHEET_ANGLES = [-1, 0.9, -0.8, 1.3, -1.1, 0.5] as const
/** 纸高不超过这个值时用满基础倾角（px） */
const SHEET_REF_HEIGHT = 400

/**
 * 纸越长摆得越正：倾角与纸高成反比，angle = base × min(1, 400 / 高度)。
 * 这样纸的底边相对顶边横向错开的距离（高度 × sin 倾角）不随长度变大，最多约 400 × sin 1.4° ≈ 10px：
 * 400px 的短纸转满 1.4°，800px 转 0.7°，1600px 只转 0.35°
 */
function sheetAngle(base: number, height: number): number {
  return height > SHEET_REF_HEIGHT ? base * SHEET_REF_HEIGHT / height : base
}
/** 胶带颜色，按顺序轮换（黄、蓝、粉、绿） */
const TAPE_TINTS = ['yellow', 'blue', 'pink', 'green'] as const

type StaffGroup = {
  id: string
  title: string
  notes: readonly StaffNote[]
}

/** 人类组在前，AI 组在后；两组的纸共用同一套倾角/胶带轮换 */
const STAFF_GROUPS: readonly StaffGroup[] = [
  { id: 'human', title: '人类组', notes: STAFF_HUMAN_NOTES },
  { id: 'ai', title: 'AI组', notes: STAFF_ROBOT_NOTES },
]

/**
 * /staff：参与项目的人的留言（CH. Staff）。
 * 从 Behind 左上角的“D”按钮换台进来，右上角换台按钮回 /behind。
 * 一张纸一个人：信纸横线、上沿一条胶带、两个下角微微翘起；静态排版，没有动画。
 */
export default function StaffApp() {
  const navigate = useNavigate()

  return (
    <main className={styles.page} aria-label='Staff'>
      <Navigator scene='staff' onClickPushButton={() => navigate('/behind', { replace: true })} />

      <header className={styles.masthead}>
        <div className={styles.kicker}>Torzo Gallery · Credits</div>
        <h1 className={styles.title}>Staff</h1>
        <p className={styles.subtitle}>做这本摄影集的成员，留下的话</p>
      </header>

      {STAFF_GROUPS.map((group, group_index) => {
        const group_start = STAFF_GROUPS
          .slice(0, group_index)
          .reduce((total, item) => total + item.notes.length, 0)

        return (
          <section
            key={group.id}
            className={styles.group}
            aria-labelledby={`staff-group-${group.id}`}
          >
            <h2 id={`staff-group-${group.id}`} className={styles.groupTitle}>
              {group.title}
            </h2>
            <div className={styles.board}>
              {group.notes.map((note, note_index) => (
                <StaffSheet
                  key={note.id}
                  note={note}
                  index={group_start + note_index}
                />
              ))}
            </div>
          </section>
        )
      })}
    </main>
  )
}

function StaffSheet({ note, index }: { note: StaffNote; index: number }) {
  const base = SHEET_ANGLES[index % SHEET_ANGLES.length]
  const tint = TAPE_TINTS[index % TAPE_TINTS.length]
  const ref = useRef<HTMLElement>(null)

  // 按纸的实际高度定倾角：纸高取决于字数和屏宽（窄屏纸变窄、变长），只能量。
  // 在绘制前量好直接写进 CSS 变量，第一帧就是最终角度；屏宽变了、字体晚到导致纸高变化时重新算。
  // offsetHeight 不受 transform 影响，转了角也量得准
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) {
      return
    }
    const apply = () => {
      el.style.setProperty('--sheet-angle', `${sheetAngle(base, el.offsetHeight).toFixed(3)}deg`)
    }
    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => observer.disconnect()
  }, [base])

  return (
    <article
      ref={ref}
      className={styles.sheet}
      aria-label={`${note.name} 的留言`}
    >
      <div className={styles.paper}>
        <span className={styles.tape} data-tint={tint} aria-hidden='true' />
        <header className={styles.head}>
          <div className={styles.nameDate}>
            <h2 className={styles.name}>{note.name}</h2>
            <time className={styles.date}>{note.date}</time>
          </div>
          <div className={styles.role}>{note.role}</div>
        </header>
        <div className={styles.body}>
          {note.body.map((paragraph, i) => (
            <div key={i} className={styles.paragraph}>{paragraph}</div>
          ))}
          <p className={styles.signoff}>{note.signoff}</p>
        </div>
      </div>
    </article>
  )
}
