import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App, { appInitInfomation } from './App'
import * as serviceWorker from './serviceWorker'
import { Memo, OutterPromise } from 'new-vait'

// const VConsole = require('vconsole')
//   window.vConsole = new VConsole()

initPictureSupportInfomation()
  .then(picutre_support => {
    const [ getAppInitInfo, setAppInitInfo ] = appInitInfomation
    setAppInitInfo({
      ...getAppInitInfo(),
      picutre_support,
    })
    const mount_el = document.getElementById('root')
    if (mount_el === null) {
      alert('没有找到#root元素！')
    } else {
      ReactDOM.createRoot(mount_el).render(<App />)
    }
  })
  .catch(err => {
    alert(`页面初始化错误：${err?.message}`)
  })

function PictureTypeSupported(base64sample: string) {
  return () => {
    const [res, rej, promise] = OutterPromise<boolean>()

    const image = new Image()
    image.onerror = () => rej(false)
    image.onload = () => res(true)
    image.src = base64sample

    return promise
  }
}

export async function initPictureSupportInfomation() {
  const [avif, webp] = await Promise.all([
    PictureTypeSupported('data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=')(),
    PictureTypeSupported('data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoCAAEAAQAcJaQAA3AA/v3AgAA=')()
  ])
  return { avif, webp } as const
}

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()

// import('./App').then(AppLoaded => {
//   import('react-dom/client').then((ReactDOMLoaded) => {
//     const ReactDOM = ReactDOMLoaded.default as any
//     const App = AppLoaded.default as any
//     const mount_el = document.getElementById('root')
//     if (mount_el === null) {
//       alert('没有找到#root元素！')
//     } else {
//       ReactDOM.createRoot(mount_el).render(<App />)
//     }
//   })
// })
