import React from 'react';
import logo from './logo.png';
import './App.css';

import Login from './Login';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="Header-holder">
          <div className="Header-item">
            <img src={logo} className="App-logo" alt="logo" />
            <span>
              TorzoGallary
            </span>
            <span className="Header-item-right">退出登录</span>
          </div>
        </div>
      </header>
      <div className="App-main">
        <Login />
      </div>
    </div>
  );
}

export default App;
