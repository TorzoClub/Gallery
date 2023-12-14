<template>
  <ElContainer
    v-loading="loading"
    style="padding-top: 20px; width: 1180px"
    direction="vertical"
  >
    <ElHeader height="2em">
      torzo gallery dashboard beta
    </ElHeader>

    <ElMain>
      <ElButton size="small" type="primary" icon="el-icon-refresh" @click="refreshThumbs">刷新缩略图</ElButton>
    </ElMain>
  </ElContainer>
</template>

<script>
import { mapGetters } from 'vuex'
import { refreshThumbs as refreshThumbsApi } from '@/api/image'

export default {
  name: 'Dashboard',
  data: () => ({
    loading: false,
  }),
  computed: {
    ...mapGetters([
      'name'
    ])
  },
  methods: {
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

    async refreshThumbs() {
      const confirm = await this.confirm('', `你确定要刷新吗？`, {
        confirmButtonClass: 'el-button--warning',
      })
      if (!confirm) {
        return
      }
      try {
        this.loading = true
        await refreshThumbsApi()
        this.$message.success(`缩略图已刷新`)
      } catch (err) {
        console.error('刷新失败', err)
        this.$message.error(`刷新失败: ${err.message}`)
      } finally {
        this.loading = false
      }
    },
  }
}
</script>

<style lang="scss" scoped>
.dashboard {
  &-container {
    margin: 30px;
  }
  &-text {
    font-size: 30px;
    line-height: 46px;
  }
}
</style>
