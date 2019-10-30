import React from 'react';
import { Form } from 'element-react';
import { Input } from 'element-react';
import { Button } from 'element-react';
import './Login.css';

const checkPassword = async (value) => {
    return await window._AXIOS({
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
            this.props.onLogin(response.data);
            window._HISTORY.push('/dashboard')
        }
        catch (error) {
            this.setState({password:''})
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