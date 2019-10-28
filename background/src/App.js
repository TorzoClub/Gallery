import React from 'react';
import logo from './logo.png';
import './App.css';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  // Link
} from "react-router-dom";

import Login from './Login';

class App extends React.Component {
  constructor(props) {
    super(props);

    this.state = { token: '' }

    this.myRef = React.createRef();

    this.handleLogin = this.handleLogin.bind(this);
  }

  componentDidMount(){
    window._HISTORY = this.myRef.current.history
  }

  handleLogin(val) {
    this.setState({ token: val });
  }

  render() {

    return (
      <Router ref={this.myRef}>
        <div className="App">
          <header className="App-header">
            <div className="Header-holder">
              <div className="Header-item">
                <img src={logo} className="App-logo" alt="logo" />
                <span>TorzoGallary</span>
                {this.state.token ? <span className="Header-item-right">退出登录</span> : null}
              </div>
            </div>
          </header>
          <div className="App-main">
            <div>
              <Switch>
                <Route exact path="/">
                  <Home />
                </Route>
                <Route path="/login">
                  <Login onLogin={this.handleLogin} />
                </Route>
                <Route path="/dashboard">
                  <Dashboard />
                </Route>
              </Switch>
            </div>

          </div>
        </div>
      </Router>
    )
  }
}

function Home() {
  return (
    <div>
      <h2>Home</h2>
    </div>
  );
}

function Dashboard() {
  return (
    <div>
      <h2>Dashboard</h2>
    </div>
  );
}



export default App;
