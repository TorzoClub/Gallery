<template>
  <ElContainer
    v-loading="loading"
    style="padding-top: 20px; width: 1024px"
    direction="vertical"
  >
    <ElHeader height="2em">
      <ElButton
        size="small"
        type="primary"
        icon="el-icon-circle-plus-outline"
        @click="createMember"
      >创建</ElButton>

      <ElButton size="small" type="primary" icon="el-icon-refresh" @click="refresh">刷新</ElButton>
    </ElHeader>

    <ElMain>
      <ElTable :data="list" border style="width: 100%" stripe>
        <ElTableColumn prop="id" label="id" align="center" width="64" />
        <ElTableColumn prop="avatar" label="头像" align="center" width="128">
          <template slot-scope="scope">
            <ImageBox :src="scope.row.avatar_thumb" style="width: 64px; height: 64px;" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="name" label="成员名" align="center" />
        <ElTableColumn prop="qq_num" label="QQ号" align="center" width="128" />
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

        <ElTableColumn label="编辑" align="center" width="170">
          <ElButtonGroup slot-scope="scope">
            <ElButton
              size="small"
              type="danger"
              icon="el-icon-delete"
              @click="deleteMember(scope.$index)"
            >删除</ElButton>
            <ElButton
              size="small"
              type="success"
              icon="el-icon-edit"
              @click="$router.push(`${scope.row.id}`)"
            >查看</ElButton>
          </ElButtonGroup>

          <!-- <template slot-scope="scope">
            <ElButton>编辑</ElButton>
          </template> -->
        </ElTableColumn>
      </ElTable>
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
  import ImageBox from '@/components/Image'
  import { getList, remove } from '@/api/member'

  export default {
    components: {
      ImageBox
    },

    data: () => ({
      loading: false,
      list: [],
    }),

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

      async deleteMember(idx) {
        console.warn('deleteMember', idx)

        const member = this.list[idx]

        const confirm = await this.confirm('', `你确定要删除 ${member.name} 吗？`, {
          confirmButtonClass: 'el-button--warning',
        })
        if (!confirm) {
          return
        }

        try {
          this.loading = true
          await remove(member.id)
          this.$message.info(`【${member.name}】已删除`)
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
          console.error('获取成员列表失败', err)
          this.$message.error(`获取成员列表失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      },

      createMember() {
        this.$router.push('new')
      }
    }
  }
</script>
