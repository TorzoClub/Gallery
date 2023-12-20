import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App'
import * as serviceWorker from './serviceWorker'

// const VConsole = require('vconsole')
//   window.vConsole = new VConsole()

// ReactDOM.render(<App />, document.getElementById('root'))

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()

import('./App').then(AppLoaded => {
  import('react-dom').then((ReactDOMLoaded) => {
    const ReactDOM = ReactDOMLoaded.default as any
    const App = AppLoaded.default as any
    ReactDOM.render(<App />, document.getElementById('root'))
  })
})

document.getElementById('root')
