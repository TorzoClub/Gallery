<template>
  <el-upload
    class="upload-box"
    drag
    :name="uploadName"
    :headers="headers"
    :action="uploadUrl"
    :show-file-list="false"
    :on-error="uploadError"
    :on-progress="uploadProgress"
    :on-success="uploadSuccess"
    :before-upload="beforeUpload"
    :accept="accept"
  >
    <div
      v-if="(img && img.thumbUrl) || previewUrl"
      class="preview"
      :style="{
        backgroundImage: `url(${(img && img.thumbUrl) || previewUrl})`,
        backgroundSize: sizeMode
      }"
    ></div>
    <template v-else>
      <div v-if="promptType === 'big'" class="big">
        <div v-if="uploading" class="uploading">
          <span class="el-upload__text">上传中……{{ percent }}%</span>
        </div>
        <div v-else class="tips">
          <i class="el-icon-upload"></i>
          <div class="el-upload__text">将文件拖到此处，或<em>点击上传</em></div>
        </div>
      </div>

      <div v-else class="normal">
        <div v-if="uploading" class="uploading">
          <i class="el-icon-loading"></i>
        </div>
        <div v-else class="tips">
          <i class="el-icon-plus"></i>
        </div>
      </div>
    </template>
  </el-upload>
</template>

<style lang="scss" scoped>
  .upload-box {
    display: flex;
    align-items: center;
    align-content: center;
    justify-content: center;
    flex-direction: column;

    width: 128px;
    height: 128px;

    >>> .el-upload {
      width: 100%;
      height: 100%;

      .el-upload-dragger {
        width: 100%;
        height: 100%;
      }
    }

    .preview {
      width: 100%;
      height: 100%;

      background-repeat: no-repeat;
      background-position: center center;
      background-size: cover;
    }
  }

  .normal {
    width: 100%;
    height: 100%;

    .tips {
      display: flex;
      align-items: center;
      align-content: center;
      justify-content: center;
      width: 100%;
      height: 100%;

      color: #AAA;

      &:hover .el-icon-plus {
        color: #409EFF
      }

      .el-icon-plus {
        font-size: 54px;
      }
    }
  }

  .big {
    width: 100%;
    height: 100%;

    .uploading {
      height: 100%;
      width: 100%;
      display: flex;
      align-items: center;
      align-content: center;
      justify-content: center;
    }
  }
</style>

<script>
  import { getToken } from '@/utils/auth'

  import RecursiveModel from '@/mixins/recursive-model'
  export default {
    mixins: [RecursiveModel('img')],

    props: {
      uploadName: {
        type: String,
        default: 'UploadBox'
      },

      promptType: {
        type: String,
        enum: ['big', 'normal'],
        default: 'normal'
      },

      accept: {
        type: String,
        default: ''
      },

      uploadUrl: {
        type: String,
        default: `${process.env.VUE_APP_BASE_API}admin/image/upload`
      },

      previewUrl: {
        type: String,
        default: ''
      },

      sizeMode: {
        type: String,
        default: ''
      }
    },

    data: () => ({
      headers: {
        Authorization: getToken()
      },
      uploading: false,
      percent: 0
    }),

    methods: {
      resetUploading() {
        this.uploading = false
        this.percent = 0
      },

      uploadError(err) {
        this.resetUploading()
        console.warn(err)
        this.$message({
          type: 'error',
          message: err.message
        })
      },

      uploadSuccess(data, file, fileList) {
        this.resetUploading()
        try {
          console.log('uploadSuccess', data, file, fileList)
          // data = dataMiddleWare({ data })
          this.img = data

          this.$emit('upload-success', data)
        } catch (err) {
          this.uploadError(err)
        }
      },

      uploadProgress(info) {
        this.uploading = true
        this.percent = Math.floor(info.percent)
      },

      beforeUpload(file) {
        console.log('beforeUpload:', file)
        this.uploading = true
      }
    }
  }
</script>
