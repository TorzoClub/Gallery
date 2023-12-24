<template>
  <ElContainer
    v-loading="loading"
    style="padding-top: 20px; width: 1180px"
    direction="vertical"
  >
    <ElHeader height="2em">
      <ElButton
        size="small"
        type="primary"
        icon="el-icon-circle-plus-outline"
        @click="createGallery"
      >创建</ElButton>

      <ElButton size="small" type="primary" icon="el-icon-refresh" @click="refresh">刷新</ElButton>
    </ElHeader>

    <ElMain>
      <ElTable :data="list" border style="width: 100%" stripe>
        <ElTableColumn prop="id" label="id" align="right" width="48" />
        <ElTableColumn prop="name" label="相册名" align="center" />
        <ElTableColumn prop="vote_limit" label="限制票数" align="center" width="90" />
        <ElTableColumn prop="event_end" label="开始时间" align="center" width="150">
          <template slot-scope="scope">
            {{ toDateTime(scope.row.event_start) }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="event_end" label="投稿期限" align="center" width="150">
          <template slot-scope="scope">
            {{ toDateTime(scope.row.submission_expire) }}
          </template>
        </ElTableColumn>

        <ElTableColumn prop="event_end" label="结束时间" align="center" width="150">
          <template slot-scope="scope">
            {{ toDateTime(scope.row.event_end) }}
          </template>
        </ElTableColumn>

        <ElTableColumn label="编辑" align="center" width="300">
          <ElButtonGroup slot-scope="scope">
            <ElButton
              size="small"
              type="danger"
              icon="el-icon-delete"
              @click="deleteGallery(scope.$index)"
            >删除</ElButton>
            <ElButton
              size="small"
              type="primary"
              icon="el-icon-edit"
              @click="choosedGalleryIdx = scope.$index"
            >相册信息</ElButton>
            <ElButton
              size="small"
              type="success"
              icon="el-icon-picture"
              @click="$router.push(`${scope.row.id}/photo/list`)"
            >相片列表</ElButton>
          </ElButtonGroup>
        </ElTableColumn>
      </ElTable>

      <ElDialog :title="(choosedGalleryIdx === 'new') ? '创建相册' : '查看/编辑相册信息'" :visible="(choosedGalleryIdx === 'new') || (choosedGalleryIdx >= 0)">
        <ElForm ref="galleryForm" :model="choosedGalleryForm" :rules="rules">
          <ElFormItem label="相册名称" :label-width="'120px'" prop="name" required>
            <el-input v-model="choosedGalleryForm.name" autocomplete="off"></el-input>
          </ElFormItem>
          <ElFormItem label="活动时间范围" :label-width="'120px'" required prop="event_end">
            <ElDatePicker
              :value="[ new Date(choosedGalleryForm.event_start), new Date(choosedGalleryForm.event_end) ]"
              type="datetimerange"
              start-placeholder="活动开始时间"
              end-placeholder="活动结束时间"
              @input="daterangeChange"
            />
          </ElFormItem>
          <ElFormItem label="投稿期限" :label-width="'120px'" required prop="submission_expire">
            <ElDatePicker
              v-model="choosedGalleryForm.submission_expire"
              type="datetime"
              placeholder="请选择投稿截止时间"
              validate-event
            />
          </ElFormItem>
          <ElFormItem label="投票限制票数" :label-width="'120px'">
            <ElInputNumber v-model="choosedGalleryForm.vote_limit" :min="0" label="票数" />
          </ElFormItem>

          <ElFormItem label="" :label-width="'120px'">
            <div class="info-text"><i class="el-icon-info"></i> 投票限制票数为0时，则为不限制</div>
            <div class="info-text"><i class="el-icon-warning"></i> 投稿期限要在活动开始时间~活动结束时间以内</div>
          </ElFormItem>
        </ElForm>
        <div slot="footer" class="dialog-footer">
          <el-button @click="choosedGalleryIdx = -1">取 消</el-button>
          <el-button type="primary" @click="submitGalleryForm">确 定</el-button>
        </div>
      </ElDialog>
    </ElMain>
  </ElContainer>
</template>

<style scoped>
.line{
  text-align: center;
}
.info-text {
  color: hsl(220 3% 61% / 1);
  line-height: 1.5em;
}
::v-deep .el-dialog__body {
    /* width: 100%;
    height: 100%; */
    padding-top: 10px;
    padding-bottom: 0px;

    /* .el-upload-dragger {
      width: 100%;
      height: 100%;
    } */
  }
</style>

<script>
  import { toDateTimeWithMinuteString } from '@/utils/date-format'
  import { create, remove, getList, update } from '@/api/gallery'

  const plain_form = {
    name: '',
    vote_limit: 0,
    event_start: '',
    event_end: '',
    submission_expire: '',
  }
  const rules = {
    name: [{ required: true, message: '请输入相册名称', trigger: 'blur' }],
    event_start: [{ required: true, message: '请设置活动开始时间', trigger: 'blur' }],
    event_end: [{ required: true, message: '请设置活动结束时间', trigger: 'blur' }],
    submission_expire: [{ required: true, message: '请设置投稿时限', trigger: 'blur' }]
  }

  export default {
    data: () => ({
      loading: false,
      list: [],
      value: '',

      choosedGalleryIdx: -1,
      choosedGalleryForm: {
        ...plain_form,
      },
      rules,
    }),

    watch: {
      choosedGalleryIdx(idx) {
        if (idx === 'new') {
          Object.assign(this, {
            choosedGalleryForm: { ...plain_form }
          })
        } else if (idx >= 0) {
          const gallery = this.list[idx]

          Object.assign(this, {
            choosedGalleryForm: { ...gallery }
          })
        }
      }
    },

    mounted() {
      this.refresh()
    },

    methods: {
      daterangeChange(date_arr) {
        if (Array.isArray(date_arr)) {
          const [event_start, event_end] = date_arr
          Object.assign(this.choosedGalleryForm, {
            event_start,
            event_end
          })
        }
      },
      async submitGalleryForm() {
        const res = await this.$refs.galleryForm.validate()
        if (res !== true) {
          return
        }
        const {
          name,
          vote_limit,
          event_start,
          event_end,
          submission_expire,
        } = this.choosedGalleryForm

        try {
          this.loading = true

          const send_data = {
            name,
            vote_limit,
            event_start,
            event_end,
            submission_expire,
          }

          if (this.choosedGalleryIdx === 'new') {
            await create({
              ...send_data,
              index: this.list.length,
            })
            this.$message.success(`【${name}】已创建`)
          } else {
            const { id } = this.list[this.choosedGalleryIdx]
            await update(id, { ...send_data })
            this.$message.info(`【${name}】已更新`)
          }

          this.choosedGalleryIdx = -1

          this.refresh()
        } catch (err) {
          console.error('更新相册信息失败', err)
          this.$message.error(`更新相册信息失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      },
      toDateTime(jsonStr) {
        const d = new Date(jsonStr)

        return toDateTimeWithMinuteString(d)
      },

      confirm(title, content, appendOpt = {}) {
        const opt = Object.assign({
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          confirmButtonClass: 'el-button--warning',
          showClose: false,
        }, appendOpt)
        return this.$confirm(content, title, opt)
          .then(() => true)
          .catch(() => false)
      },

      async deleteGallery(idx) {
        console.warn('deleteGallery', idx)

        const gallery = this.list[idx]

        const confirm = await this.confirm('', `你确定要删除 ${gallery.name} 吗？`, {
          confirmButtonClass: 'el-button--warning',
        })
        if (!confirm) {
          return
        }

        try {
          this.loading = true
          await remove(gallery.id)
          this.$message.info(`【${gallery.name}】已删除`)
          this.refresh()
        } catch (err) {
          console.error('删除失败', err)
          this.$message.error(`删除失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      },

      async refresh() {
        try {
          this.loading = true
          this.list = await getList()
        } catch (err) {
          console.error('获取相册列表失败', err)
          this.$message.error(`获取相册列表失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      },

      createGallery() {
        this.choosedGalleryIdx = 'new'
      }
    }
  }
</script>
