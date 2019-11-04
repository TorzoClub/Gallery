import React from 'react';
import { Table, Button, Dialog, Form, Input, Message, MessageBox, Upload } from 'element-react';

class MemberManager extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            data: [],
            columns: [
                {
                    label: "QQ 号",
                    prop: "qq_num"
                },
                {
                    label: "名称",
                    prop: "name"
                },
                {
                    label: "头像",
                    prop: "avatar_src",
                    width: 186,
                    render: (row) => {
                        return (
                            <img src={`${row.avatar_thumb} `} alt={row.name} />
                        )
                    }
                },
                {
                    label: "操作",
                    prop: "id",
                    render: (row) => {
                        return (
                            <span>
                                <Button type="text" size="small" onClick={() => { this.onEditClick(row) }}>编辑</Button>
                                <Button type="text" size="small" onClick={() => { this.onDeleteClick(row) }}>删除</Button>
                            </span>
                        )
                    }
                }
            ],
            dialogVisible: false,
            form: {
                name: '',
                qq_num: null,
                avatar_thumb: ''
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
        const response = await window._AXIOS.get('api/admin/member');
        const data = response.data.map(item => {
            item.created_at = new Date(item.created_at);
            item.updated_at = new Date(item.updated_at);
            item.avatar_src = item.avatar_src.replace(':\\', '://').replace(/\\/g, '/');
            item.avatar_thumb = item.avatar_thumb.replace(':\\', '://').replace(/\\/g, '/');
            return item;
        })
        this.setState({ data });
    }

    onDeleteClick(value) {
        MessageBox.confirm(`确认删除QQ号为 ${value.qq_num}，名字是 ${value.name} 的成员吗？`, '提示', {
            type: 'warning'
        }).then(async () => {
            try {
                await window._AXIOS.delete(`api/admin/member/${value.id}`)
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
                qq_num: null,
                avatar_thumb: ''
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
                    <Button onClick={() => this.setState({ dialogVisible: true })} type="text">添加成员</Button>
                </span>
                <Table
                    style={{ width: '100%' }}
                    columns={this.state.columns}
                    data={this.state.data}
                    border={true}
                />

                {this.state.dialogVisible ? <EditDialog
                    title="编辑成员"
                    visible={this.state.dialogVisible}
                    form={this.state.form}
                    onCancel={this.onDialogClose}
                    onOperateSuccess={this.onOperateSuccess}
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
                qq_num: null,
                avatar_src: '',
            },
            rules: {
                name: [
                    { required: true, message: '请输入名字', trigger: 'blur' }
                ],
                qq_num: [
                    { required: true, message: '请输入QQ号码', trigger: 'change', type: 'number' },
                ],
                avatar_src: [
                    { required: true, message: '请上传图片', trigger: 'change' }
                ]
            }
        }

        this.onChange = this.onInputChange.bind(this);
        this.onCancel = this.onCancel.bind(this);
        this.onAddConfirm = this.onAddConfirm.bind(this);
        this.onEditConfirm = this.onEditConfirm.bind(this);
        this.onImageUploadSuccess = this.onImageUploadSuccess.bind(this);
    }

    onInputChange(key, value) {
        this.setState(state => {
            state.form[value] = key
            return state
        })
    }

    onCancel() {
        this.setState({
            form: {
                name: '',
                qq_num: null,
                avatar_src: ''
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
                        url: 'api/admin/member',
                        data: this.state.form
                    });
                    this.props.onOperateSuccess();
                }
                catch (e) {
                    this.setState(state => {
                        state.form.qq_num = null;
                        return state
                    })
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
                        url: `api/admin/member/${this.state.form.id}`,
                        data: this.state.form
                    });
                    this.props.onOperateSuccess();
                }
                catch (e) {
                    this.setState(state => {
                        state.form.qq_num = null;
                        return state
                    })
                }
            }
        });
    }

    onImageUploadSuccess(imgUrl) {
        this.setState(state => {
            state.form.avatar_src = imgUrl;
            return state
        });
    }

    componentDidMount() {
        this.setState(state => {
            state.form.name = this.props.form.name;
            state.form.qq_num = this.props.form.qq_num;
            if (state.form.id) {
                state.form.id = this.props.form.id;
                state.form.avatar_src = this.props.form.avatar_src.split('/').pop();
            }
            return state
        })
    }

    render() {

        return (
            <Dialog
                title={this.props.title}
                visible={this.props.visible}
                onCancel={this.onCancel}
            >
                <Dialog.Body>
                    <Form ref="form" model={this.state.form} rules={this.state.rules}>
                        <Form.Item label="成员名称" prop="name" >
                            <Input value={this.state.form.name} onChange={k => { this.onInputChange(k, 'name') }}></Input>
                        </Form.Item>
                        <Form.Item label="成员QQ号码" prop="qq_num">
                            <Input value={this.state.form.qq_num} onChange={k => { const numK = Number.parseInt(k); if (k === '') { this.onInputChange(null, 'qq_num') } else { if (Number.isInteger(numK)) { this.onInputChange(numK, 'qq_num') } } }}></Input>
                        </Form.Item>
                        <Form.Item label="成员头像" prop="avatar_src">
                            <br />
                            <ImageUpload onUploadSuccess={this.onImageUploadSuccess} imageUrl={this.props.form.avatar_src} />
                        </Form.Item>
                    </Form>
                </Dialog.Body>

                <div>{JSON.stringify(this.state)}</div>

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

class ImageUpload extends React.Component {
    constructor(props) {
        super(props)

        this.state = {
            imageUrl: ''
        }

        this.uploadImage = this.uploadImage.bind(this);
        this.handleImageUploadScucess = this.handleImageUploadScucess.bind(this);
    }

    async uploadImage(rawRequest) {
        const formDate = new FormData();
        formDate.append('', rawRequest.file)
        const response = await window._AXIOS({
            url: 'api/admin/image/upload',
            method: 'post',
            data: formDate
        })
        rawRequest.onSuccess(response);
    }

    handleImageUploadScucess(res, file) {
        this.setState({ imageUrl: `${res.data.imagePrefix}/${res.data.src}` })
        this.props.onUploadSuccess(`${res.data.src}`);
    }

    componentDidMount() {
        this.setState({ imageUrl: this.props.imageUrl })
    }

    render() {
        return (
            <Upload
                className={'avatar-uploader'}
                action={''}
                showFileList={false}
                drag={true}
                onSuccess={this.handleImageUploadScucess}
                httpRequest={this.uploadImage}
            >
                {this.state.imageUrl ? <img src={this.state.imageUrl} className="avatar" alt="上传的图片" /> : <div className="el-upload__text"><i className="el-icon-plus avatar-uploader-icon">拖动或点击以上传图片</i> </div>}
            </Upload>
        )
    }
}

export default MemberManager