<template>
  <ElContainer
    v-loading="loading"
    style="padding-top: 20px; width: 1120px"
    direction="vertical"
  >
    <ElHeader height="32px">
      <ElButton
        size="small"
        type="primary"
        icon="el-icon-circle-plus-outline"
        @click="createPhoto"
      >创建</ElButton>

      <ElButton size="small" type="primary" icon="el-icon-refresh" @click="refresh">刷新</ElButton>

      <ElButton size="small" type="primary" icon="el-icon-view" @click="$router.push('member')">成员投票情况</ElButton>

      <ElButton size="small" type="primary" icon="el-icon-sort" @click="clickReSortByVoteCount">按投票数设定排序</ElButton>
    </ElHeader>

    <ElMain>
      <ElTable :data="list" border style="width: 100%" stripe :max-height="$parent.getMaxHeight() - 32 - 20 - 20 * 2">
        <ElTableColumn prop="id" label="id" align="center" width="64" />
        <ElTableColumn prop="index" label="index" align="center" width="96" sortable />
        <ElTableColumn prop="avatar" label="预览" align="center" width="164">
          <template slot-scope="scope">
            <ImageBox :src="scope.row.thumb" style="width: 128px; height: 128px;" />
          </template>
        </ElTableColumn>
        <ElTableColumn prop="member.name" label="作者" align="center" />
        <ElTableColumn prop="vote_count" label="票数" align="center" width="96" sortable />
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
              @click="deletePhoto(scope.$index)"
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
  .line {
    text-align: center;
  }
</style>

<script>
  import { toDateTimeWithMinuteString } from '@/utils/date-format'
  import ImageBox from '@/components/Image'
  import { getList, remove, sortByVoteCount } from '@/api/photo'

  export default {
    components: {
      ImageBox
    },

    data: () => ({
      loading: false,
      list: [],
    }),

    computed: {
      gallery_id() {
        return this.$route.params.gallery_id
      },
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

      async deletePhoto(idx) {
        console.warn('deletePhoto', idx)

        const photo = this.list[idx]

        const confirm = await this.confirm('', `你确定要删除这张由 ${photo.member.name} 上传的相片吗？`, {
          confirmButtonClass: 'el-button--warning',
        })
        if (!confirm) {
          return
        }

        try {
          this.loading = true
          await remove(photo.id)
          this.$message.info(`由【${photo.member.name}】上传的相片已删除`)
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
          this.list = await getList(this.gallery_id)
          return this.list
        } catch (err) {
          console.error('获取成员列表失败', err)
          this.$message.error(`获取成员列表失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      },

      createPhoto() {
        this.$router.push('new')
      },

      async clickReSortByVoteCount() {
        const confirm = await this.confirm('', `你确定要按照当前票数的设定排序吗？（票数越高，在前台网站上排名越前）`, {
          confirmButtonClass: 'el-button--primary',
        })
        if (!confirm) {
          return
        }

        try {
          this.loading = true
          await sortByVoteCount({ gallery_id: this.gallery_id })

          if (await this.refresh()) {
            this.$message.success(`已排序`)
          }
        } catch (err) {
          console.error('排序失败', err)
          this.$message.error(`排序失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      }
    }
  }
</script>
