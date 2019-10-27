import React from 'react';
import { Form } from 'element-react';
import { Input } from 'element-react';
import { Button } from 'element-react';
import './Login.css';

import axios from 'axios';

// import { Select } from 'element-react';
// import { DatePicker } from 'element-react';
// import { Layout } from 'element-react';
// import { TimePicker } from 'element-react';
// import { Switch } from 'element-react';
// import { Checkbox } from 'element-react';
// import { Radio } from 'element-react';




class Login extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            password: ''
        };

        this.onChange = this.onChange.bind(this);
        this.onSubmit = this.onSubmit.bind(this);
    }

    onSubmit(e) {
        e.preventDefault();
        
        
    }

    onChange(value) {
        this.setState({password:value})
        this.forceUpdate();
    }

    render() {
        return (
            <div className="Login-holder">
                <b>请输入管理密码</b>
                <br />
                <Form model={this.state.form} onSubmit={this.onSubmit}>
                    <Form.Item >
                        <Input type="password" value={this.state.password} placeholder="密码" onChange={this.onChange}></Input>
                    </Form.Item>
                    <Form.Item>
                        <Button type="primary" nativeType="submit">登录</Button>
                    </Form.Item>
                </Form>
            </div>
        )
    }

}

export default Login