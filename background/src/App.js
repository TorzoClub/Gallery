import React from 'react';
import logo from './logo.png';
import './App.css';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect
} from "react-router-dom";

import { Message } from 'element-react';

import cookie from 'react-cookies';

import Login from './Login';
import Content from './Content';


class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = { token: '' }
    this.myRef = React.createRef();
    this.handleLogin = this.handleLogin.bind(this);
    this.handleLogout = this.handleLogout.bind(this);
  }

  componentDidMount() {
    this.setState({ token: cookie.load('token') })
    window._HISTORY = this.myRef.current.history;
    window._AXIOS.interceptors.request.use(config => {
      if (this.state.token) {
        config.headers['Authorization'] = this.state.token;
      }
      else {
        window._HISTORY.push('./login');
      }
      return config;
    });
    window._AXIOS.interceptors.response.use(config => config, error => {
      if (error.response) {
        Message({
          message: error.response.data.message,
          type: 'error'
        });
        if (error.response.status === 401) {
          window._HISTORY.push('/login', { message: error.response.data.message });
        }
      }
      return Promise.reject(error);
    });
  }

  handleLogin(val) {
    this.setState({ token: val });
    cookie.save('token', val)
  }

  handleLogout() {
    this.setState({ token: '' });
    cookie.save('token', '');
    window._HISTORY.push('/login');
  }

  render() {

    return (
      <div className="App">
        <header className="App-header">
          <div className="Header-holder">
            <div className="Header-item">
              <img src={logo} className="App-logo" alt="logo" />
              <span>TorzoGallary</span>
              {this.state.token !== '' ? <span className="Header-item-right" onClick={this.handleLogout}>退出登录</span> : null}
            </div>
          </div>
        </header>
        <Router ref={this.myRef}>

          <div className="App-main">
            <Switch>
              <Route path="/login">
                <Login onLogin={this.handleLogin} />
                {this.state.token !== '' ? <Redirect to='/' /> : null}
              </Route>
              <Route exact path="/">
                {this.state.token !== '' ? <Content /> : <Redirect to='/login' />}
              </Route>
              <Route path="**">
                {this.state.token !== '' ? <Redirect to="/" /> : <Redirect to="/login" />}
              </Route>
            </Switch>
          </div>
        </Router>
      </div>
    )
  }
}


export default App;