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
        <ElTableColumn prop="id" label="id" align="center" width="64" />
        <ElTableColumn prop="name" label="相册名" align="center" />
        <ElTableColumn prop="vote_limit" label="限制票数" align="center" width="90" />
        <ElTableColumn prop="vote_expire" label="投票截止时间" align="center" width="150">
          <template slot-scope="scope">
            {{ toDateTime(scope.row.vote_expire) }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="created_at" label="创建时间" align="center" width="150">
          <template slot-scope="scope">
            {{ toDateTime(scope.row.created_at) }}
          </template>
        </ElTableColumn>
        <ElTableColumn prop="updated_at" label="修改时间" align="center" width="150">
          <template slot-scope="scope">
            {{ toDateTime(scope.row.updated_at) }}
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
        <ElForm :model="choosedGalleryForm">
          <ElFormItem label="相册名称" :label-width="'120px'">
            <el-input v-model="choosedGalleryForm.name" autocomplete="off"></el-input>
          </ElFormItem>
          <ElFormItem label="投票限制票数" :label-width="'120px'">
            <ElInputNumber v-model="choosedGalleryForm.vote_limit" :min="0" :max="10" label="票数" />
          </ElFormItem>
          <ElFormItem label="投票截止日期" :label-width="'120px'">
            <ElDatePicker
              v-model="choosedGalleryForm.vote_expire"
              type="datetime"
              placeholder="选择日期时间"
            ></ElDatePicker>
          </ElFormItem>
        </ElForm>
        <div slot="footer" class="dialog-footer">
          <el-button @click="choosedGalleryIdx = -1">取 消</el-button>
          <el-button type="primary" @click="submitGalleryInfomation">确 定</el-button>
        </div>
      </ElDialog>
    </ElMain>
  </ElContainer>
</template>

<style scoped>
.line{
  text-align: center;
}
</style>

<script>
  import { toDateTimeWithMinuteString } from '@/utils/date-format'
  import { create, remove, getList, update } from '@/api/gallery'

  export default {
    data: () => ({
      loading: false,
      list: [],

      choosedGalleryIdx: -1,
      choosedGalleryForm: {
        name: '',
        vote_limit: 0,
        vote_expire: ''
      },
    }),

    watch: {
      choosedGalleryIdx(idx) {
        if (idx === 'new') {
          Object.assign(this, {
            choosedGalleryForm: {
              name: '',
              vote_limit: 0,
              vote_expire: ''
            }
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

      async submitGalleryInfomation() {
        const {
          name,
          vote_limit,
          vote_expire
        } = this.choosedGalleryForm

        try {
          this.loading = true

          if (this.choosedGalleryIdx === 'new') {
            await create({
              name,
              vote_limit,
              vote_expire, // (typeof vote_expire === 'object') ? JSON.stringify(vote_expire) : vote_expire
              index: this.list.length
            })
            this.$message.success(`【${name}】已创建`)
          } else {
            const { id } = this.list[this.choosedGalleryIdx]
            await update(id, {
              name,
              vote_limit,
              vote_expire // (typeof vote_expire === 'object') ? JSON.stringify(vote_expire) : vote_expire
            })
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

      createGallery() {
        this.choosedGalleryIdx = 'new'
      }
    }
  }
</script>
