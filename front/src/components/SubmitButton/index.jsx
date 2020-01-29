import React from 'react'

import './index.scss'

export default ({ mode, clickButton }) => {
  return <div className={`button-frame ${mode}`} onClick={ clickButton }>
    <div className="button-loop">
      <div className="loop"></div>
    </div>
    <div className="button-click">
      <button> </button>
    </div>
  </div>
}
