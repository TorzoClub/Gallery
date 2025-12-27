import React from 'react'
import s from './index.module.css'
import DialogLayout from 'components/DialogLayout'
import { SubmitButton } from 'layouts/GalleryHome/components/ActivityLayout'

export type Props = {
  in: boolean
  handleClickAnyWhere: () => void
}

export default (props: Props) => {
  const { in: inProp, handleClickAnyWhere } = props

  return (
    <DialogLayout in={Boolean(inProp)} onClickAnyWhere={handleClickAnyWhere}>
      <div className={s.isDone}>
        可别忘了点下面的
        <div style={{ margin: '0 5px' }}>
          <SubmitButton buttonState='highlight' />
        </div>
        了，朋友
      </div>

      <div className={s.anywhere}>点击任意位置以继续</div>
    </DialogLayout>
  )
}
