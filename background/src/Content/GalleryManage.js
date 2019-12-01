import React from 'react';
import { Table, Button, Dialog, Form, Input, Message, MessageBox, DatePicker, InputNumber } from 'element-react';

class GalleryManage extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            data: [],
            columns: [
                {
                    type: 'expand',
                    expandPannel: function (data) {
                        return (
                            <div>{JSON.stringify(data)}</div>
                        )
                    }
                },
                {
                    label: "相册名称",
                    prop: "name"
                },
                {
                    label: "投票截止时间",
                    prop: "vote_expire",
                    width: 280,
                    render:data=>{
                        return (
                            data.vote_expire.toLocaleString()
                        )
                    }
                },

                {
                    label: "投票数限制",
                    prop: "vote_limit"
                },
                {
                    label: "操作",
                    prop: "id",
                    render: (row) => {
                        return (
                            <span>
                                <Button type="text" size="small" onClick={() => { this.onEditClick(row) }}>编辑属性</Button>
                                <Button type="text" size="small" onClick={() => { this.onDeleteClick(row) }}>删除</Button>
                            </span>
                        )
                    }
                }
            ],
            dialogVisible: false,
            form: {
                name: '',
                vote_expire: null,
                vote_limit: 1,
                index: null
            }
        }

        this.onDeleteClick = this.onDeleteClick.bind(this);
        this.onEditClick = this.onEditClick.bind(this);
        this.onDialogClose = this.onDialogClose.bind(this);
        this.onOperateSuccess = this.onOperateSuccess.bind(this);
    }

    async componentDidMount() {
        await this.getList();
    }

    async getList() {
        const response = await window._AXIOS.get('api/admin/gallery');
        const data = response.data.map(item => {
            item.created_at = new Date(item.created_at);
            item.updated_at = new Date(item.updated_at);
            item.vote_expire = new Date(item.vote_expire);
            return item;
        })
        this.setState({ data });
    }

    onDeleteClick(value) {
        MessageBox.confirm(`删除名为 ${value.name} 的相册吗？`, '提示', {
            type: 'warning'
        }).then(async () => {
            try {
                await window._AXIOS.delete(`api/admin/gallery/${value.id}`)
                this.getList();
                Message({
                    type: 'success',
                    message: '删除成功!'
                });
            }
            catch (e) {

            }
        }).catch(() => {
            Message({
                type: 'info',
                message: '已取消删除'
            });
        });
    }

    onEditClick(value) {
        this.setState({ form: value })
        this.setState({ dialogVisible: true })
    }

    onDialogClose() {
        this.setState({ dialogVisible: false });
        this.setState({
            form: {
                name: '',
                vote_expire: null,
                vote_limit: 1,
                index: null
            }
        })
    }

    onOperateSuccess() {
        this.onDialogClose();
        Message({
            message: '操作成功',
            type: 'success',
            customClass: 'Message-style'
        });
        this.getList();
    }

    render() {
        return (
            <div>
                <span className='Button-holder'>
                    <Button onClick={() => this.setState({ dialogVisible: true })} type="text">添加相册</Button>
                </span>
                <Table
                    style={{ width: '100%' }}
                    columns={this.state.columns}
                    data={this.state.data}
                    border={true}
                />

                {this.state.dialogVisible ? <EditDialog
                    title="编辑相册"
                    visible={this.state.dialogVisible}
                    form={this.state.form}
                    onCancel={this.onDialogClose}
                    onOperateSuccess={this.onOperateSuccess}
                    dataLength={this.state.data.length}
                /> : null}


            </div>
        )
    }
}

class EditDialog extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            form: {
                name: '',
                vote_expire: null,
                vote_limit: 1,
                index: this.props.dataLength
            },
            rules: {
                name: [
                    { required: true, message: '请输入名字', trigger: 'blur' }
                ],
                vote_expire: [
                    { required: true, message: '请选择过期时间', trigger: 'blur', type: 'date' },
                ],
                vote_limit: [
                    { required: true, message: '请选输入投票限制', trigger: 'blur', type: 'number' },
                ],
                index: [
                    { required: true, message: '请输入排序', trigger: 'blur', type: 'number' }
                ]
            },
            bool: false
        }

        this.onInputChange = this.onInputChange.bind(this);
        this.onCancel = this.onCancel.bind(this);
        this.onAddConfirm = this.onAddConfirm.bind(this);
        this.onEditConfirm = this.onEditConfirm.bind(this);
    }

    onInputChange(key, value) {
        this.setState(state => {
            state.form[value] = key;
            return state
        })
    }

    onCancel() {
        this.setState({
            form: {
                name: '',
                vote_expire: null,
                vote_limit: 1,
                index: null
            }
        })
        this.props.onCancel();
    }


    async onAddConfirm() {
        this.refs.form.validate(async valid => {
            if (valid) {
                try {
                    await window._AXIOS({
                        method: 'post',
                        url: 'api/admin/gallery',
                        data: this.state.form
                    });
                    this.props.onOperateSuccess();
                }
                catch (e) {
                }
            }
        });
    }

    async onEditConfirm() {
        this.refs.form.validate(async valid => {
            if (valid) {
                try {
                    await window._AXIOS({
                        method: 'patch',
                        url: `api/admin/gallery/${this.state.form.id}`,
                        data: this.state.form
                    });
                    this.props.onOperateSuccess();
                }
                catch (e) {
                    this.setState(state => {
                        state = {
                            name: '',
                            vote_expire: null,
                            vote_limit: 1,
                            index: this.props.dataLength
                        };
                        return state;
                    })
                }
            }
        });
    }

    componentDidMount() {
        this.setState({ form: this.props.form });
    }

    render() {

        return (
            <Dialog
                title={this.props.title}
                visible={this.props.visible}
                onCancel={this.onCancel}
            >
                <Dialog.Body>
                    <Form ref="form" model={this.state.form} rules={this.state.rules} labelPosition='top'>
                        <Form.Item label="相册名称" prop="name" >
                            <Input value={this.state.form.name} onChange={k => { this.onInputChange(k, 'name') }}></Input>
                        </Form.Item>
                        <Form.Item label="投票过期时间" prop="vote_expire" >
                            <DatePicker
                                value={this.state.form.vote_expire}
                                isShowTime={true}
                                placeholder="选择过期时间"
                                onChange={date => {
                                    this.setState(state => {
                                        state.form.vote_expire = date;
                                        return state;
                                    })
                                }}
                                disabledDate={time => time.getTime() < Date.now() - 8.64e7}
                            />
                        </Form.Item>
                        <Form.Item label="投票数限制" prop="vote_limit">
                            <InputNumber defaultValue={1} onChange={(value) => { this.onInputChange(value, 'vote_limit') }} min="1" max="10"></InputNumber>
                        </Form.Item>
                        <Form.Item label="排序" prop="index">
                            <InputNumber defaultValue={this.props.dataLength} onChange={(value) => { this.onInputChange(value, 'index') }} ></InputNumber>
                        </Form.Item>
                    </Form>
                </Dialog.Body>

                <div>{JSON.stringify(this.state.form)}</div>

                <Dialog.Footer className="dialog-footer">
                    <Button onClick={this.onCancel}>取 消</Button>
                    {this.state.form.id ?
                        <Button type="primary" onClick={this.onEditConfirm}>确认修改</Button> :
                        <Button type="primary" onClick={this.onAddConfirm}>添 加</Button>}
                </Dialog.Footer>
            </Dialog>
        )
    }
}

export default GalleryManage