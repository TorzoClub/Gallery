import React from 'react';
import { Form } from 'element-react';
import { Input } from 'element-react';
import { Button } from 'element-react';
import { Message } from 'element-react';
import './Login.css';

import axios from '../axios';

// import { Select } from 'element-react';
// import { DatePicker } from 'element-react';
// import { Layout } from 'element-react';
// import { TimePicker } from 'element-react';
// import { Switch } from 'element-react';
// import { Checkbox } from 'element-react';
// import { Radio } from 'element-react';

const checkPassword = async (value) => {
    return await axios({
        method: 'post',
        url: 'api/admin/login',
        data: {
            pass: value
        }
    })
}


class Login extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            password: ''
        };

        this.onChange = this.onChange.bind(this);
        this.onSubmit = this.onSubmit.bind(this);
    }

    async onSubmit(e) {
        e.preventDefault();
        try {
            const response = await checkPassword(this.state.password);
            window.token = response.data;
            this.props.onLogin(response.data);
            window._HISTORY.push('/dashboard')
        }
        catch (error) {
            this.setState({password:''})
            Message({
                message:error.response.data.message,
                type:'error'
            })
        }
    }

    onChange(value) {
        this.setState({ password: value })
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