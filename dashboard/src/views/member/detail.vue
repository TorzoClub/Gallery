<template>
  <ElContainer
    v-loading="loading"
    style="padding-top: 20px; max-width: 480px"
    direction="vertical"
  >
    <ElMain>
      <ElForm ref="form" :model="form" class="tab-style" label-width="6em">
        <ElFormItem
          label="成员名称"
          prop="name"
          :rules="[{ required: true, message: '请输入成员名称' }]"
        >
          <ElInput v-model="form.name" />
        </ElFormItem>
        <ElFormItem
          label="成员头像"
          prop="avatar_src"
          :rules="[{ required: true, message: '请设置成员头像' }]"
        >
          <UploadImageBox
            ref="UploadImageBox"
            :thumb-size="avatar_thumb_size"
            :preview-url="preview_url"
            @upload-success="uploadSuccess"
          />
        </ElFormItem>
        <ElFormItem
          label="成员Q号"
          prop="qq_num"
          :rules="[{ required: true, message: '请输入成员Q号' }, { type: 'integer', message: '请输入大于0的整数', min: 1 }]"
        >
          <ElInput v-model.number="form.qq_num" />
        </ElFormItem>
      </ElForm>
    </ElMain>

    <ElFooter align="center">
      <ElButton @click="$router.back()">取消</ElButton>
      <ElButton v-if="isNew" @click="submitCreate">创建</ElButton>
      <ElButton v-else @click="submitEdit">提交</ElButton>
    </ElFooter>
  </ElContainer>
</template>

<script>
  import { __AVATAR_THUMB_SIZE__ } from '@/api/image'
  import { getDetail, create, update } from '@/api/member'

  import UploadImageBox from '@/components/UploadImageBox'

  export default {
    components: {
      UploadImageBox
    },

    data: () => ({
      avatar_thumb_size: __AVATAR_THUMB_SIZE__,
      loading: false,
      preview_url: '',
      form: {
        avatar_src: '',
        name: '',
        qq_num: ''
      }
    }),

    computed: {
      id() {
        return this.$route.params.id
      },

      isNew() {
        return this.id === 'new'
      }
    },

    mounted() {
      this.refresh()
    },

    methods: {
      async refresh() {
        if (this.isNew) {
          return
        }

        try {
          this.loading = true
          const detail = await getDetail(this.id)
          this.preview_url = detail.avatar_thumb_url
          Object.assign(this.form, {
            avatar_src: detail.avatar_src,
            name: detail.name,
            qq_num: detail.qq_num,
          })
          console.log('detial', detail)
        } catch (err) {
          console.error('获取成员信息失败', err)
          this.$message.error(`获取成员信息失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      },

      async submitCreate() {
        try {
          await this.$refs.form.validate()
        } catch (err) {
          console.log('validate failure', err)
          return
        }

        try {
          this.loading = true
          await create({
            name: this.form.name,
            avatar_src: this.form.avatar_src,
            qq_num: Number(this.form.qq_num)
          })
          this.$router.back()
          this.$message.success(`【${this.form.name}】已创建`)
        } catch (err) {
          console.error('创建失败', err)
          this.$message.error(`创建失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      },

      uploadSuccess(data) {
        this.form.avatar_src = data.src
        this.preview_url = data.thumb_url
      },

      async submitEdit() {
        try {
          await this.$refs.form.validate()
        } catch (err) {
          console.log('validate failure', err)
          return
        }

        try {
          this.loading = true
          const data = {
            name: this.form.name,
            qq_num: Number(this.form.qq_num)
          }

          if (this.$refs.UploadImageBox.img) {
            // 如果有选择了图片
            data.avatar_src = this.form.avatar_src
          }

          await update(this.id, data)
          this.$router.back()
          this.$message.success(`【${this.form.name}】已更新`)
        } catch (err) {
          console.error('创建失败', err)
          this.$message.error(`创建失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      }
    }
  }
</script>
