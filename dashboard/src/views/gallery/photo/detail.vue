<template>
  <ElContainer
    v-loading="loading"
    style="padding-top: 20px;"
    direction="vertical"
  >
    <ElMain v-if="inited" style="width: 640px">
      <ElForm ref="form" :model="form" label-width="6em" class="tab-style">
        <ElFormItem
          label="作者"
          prop="member_id"
          :rules="[{ required: true, message: '请选择作者' }]"
        >
          <ElSelect v-model.number="form.member_id" :disabled="!isNew" filterable placeholder="请选择">
            <ElOption
              v-for="member in memberList"
              :key="member.id"
              :label="member.name"
              :value="member.id"
            ></ElOption>
          </ElSelect>
          <!-- <ElInput v-model.number="form.qq_num" /> -->
        </ElFormItem>

        <ElFormItem
          label="相片预览"
          prop="src"
          :rules="[{ required: true, message: '请设置成员头像' }]"
        >
          <UploadImageBox
            ref="UploadImageBox"
            :preview-url="form.src"
            size-mode="contain"
            style="width: 382px; height: 382px;"
            @upload-success="data => form.src = data.src"
          />
        </ElFormItem>

        <ElFormItem
          label="相片描述"
          prop="desc"
          :rules="[{ required: false, message: '请输入相片描述' }]"
        >
          <ElInput v-model="form.desc" :autosize="{ minRows: 3, maxRows: 6 }" type="textarea" />
        </ElFormItem>
      </ElForm>
    </ElMain>

    <ElFooter style="width: 640px" align="center">
      <ElButton @click="$router.back()">取消</ElButton>
      <ElButton v-if="isNew" @click="submitCreate">创建</ElButton>
      <ElButton v-else @click="submitEdit">提交</ElButton>
    </ElFooter>
  </ElContainer>
</template>

<script>
  import { getList as getMemberList } from '@/api/member'
  import { getDetail, create, update } from '@/api/photo'

  import UploadImageBox from '@/components/UploadImageBox'

  export default {
    components: {
      UploadImageBox
    },

    data: () => ({
      inited: false,
      loading: false,

      memberList: [],

      form: {
        src: '',
        desc: '',
        qq_num: ''
      }
    }),

    computed: {
      gallery_id() {
        return this.$route.params.gallery_id
      },

      id() {
        return this.$route.params.id
      },

      isNew() {
        return this.id === 'new'
      }
    },

    async mounted() {
      window.$d = this

      await this.refresh()
      await this.init()
    },

    methods: {
      async init() {
        try {
          this.loading = true
          this.memberList = await getMemberList()
          this.inited = true
          return this.memberList
        } catch (err) {
          console.error('初始化成员信息失败', err)
          this.$message.error(`初始化成员信息失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      },

      async refresh() {
        if (this.isNew) {
          return
        }

        try {
          this.loading = true
          const detail = await getDetail(this.id)
          Object.assign(this.form, {
            src: detail.src,
            desc: detail.desc,
            member_id: detail.member_id,
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
            desc: this.form.desc,
            src: this.form.src,
            gallery_id: Number(this.gallery_id),
            member_id: Number(this.form.member_id)
          })
          this.$router.back()
          this.$message.success(`相片已创建`)
        } catch (err) {
          console.error('创建失败', err)
          this.$message.error(`创建失败: ${err.message}`)
        } finally {
          this.loading = false
        }
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
            desc: this.form.desc,
            // src: this.form.src,
            gallery_id: Number(this.gallery_id),
            member_id: Number(this.form.member_id)
          }

          if (this.$refs.UploadImageBox.img) {
            // 如果有选择了图片
            data.src = this.form.src
          }

          await update(this.id, data)
          this.$router.back()
          this.$message.success(`相片已更新`)
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
