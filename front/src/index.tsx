import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import App from './App'
import * as serviceWorker from './serviceWorker'

// const VConsole = require('vconsole')
//   window.vConsole = new VConsole()

const mount_el = document.getElementById('root')
if (mount_el === null) {
  alert('没有找到#root元素！')
} else {
  ReactDOM.createRoot(mount_el).render(<App />)
}

// ReactDOM.render(<App />, )

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
