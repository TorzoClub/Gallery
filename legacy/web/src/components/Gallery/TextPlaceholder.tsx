import { FC, FunctionComponent, memo, ReactNode } from 'react'

const TextPlaceholder: FC<{ children?: ReactNode }> = memo(({ children }) => (
  <div style={{
    textAlign: 'center',
    paddingTop: '30px',
    width: '100%',
    color: 'rgba(0, 0, 0, 0.4)',
  }}>{ children }</div>
))

export default TextPlaceholder
