import React from 'react';
import { Upload } from 'element-react';


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

export default ImageUpload