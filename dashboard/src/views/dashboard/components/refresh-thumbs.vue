<template>
  <div>
    <ElProgress
      v-if="processing"
      :percentage="percentage"
      :color="color"
    />
    <ElButton
      v-else-if="showButton"
      size="small"
      type="primary"
      icon="el-icon-refresh"
      @click="processing || refreshThumbsConfirm()"
    >刷新缩略图</ElButton>
  </div>
</template>

<script>
import { refreshThumb, getAllAvailablePhoto, __AVATAR_THUMB_SIZE__ } from '@/api/image'
import { getList as getMemberList } from '@/api/member'

const initProgress = () => ({ total: 0, success: 0, failure: 0 })

export default {
  props: {
    showButton: { type: Boolean, default: true }
  },

  data: () => ({
    ...initProgress(),
    processing: false,
    show_progress: false,
  }),

  computed: {
    color() { return (this.failure > 0) ? '#e6a23c' : '#409eff' },
    current() { return this.success + this.failure },
    percentage() {
      return (this.total === 0) ? 0 : Math.ceil(
        100 * (this.current / this.total)
      )
    },
  },

  watch: {
    processing(val) {
      if (val === true) {
        this.show_progress = true
      }
    }
  },

  methods: {
    async refreshThumbs() {
      Object.assign(this, initProgress())

      const [photos, members] = await Promise.all([
        getAllAvailablePhoto(), getMemberList()
      ])

      const task_list = [
        ...photos.map(p => (
          [`相片(id=${p.id})`, p.src]
        )),
        ...members.map(m => (
          [`成员头像(id=${m.id})`, m.avatar_src, __AVATAR_THUMB_SIZE__]
        ))
      ]

      this.total = task_list.length

      for (const [name, ...args] of task_list) {
        try {
          await refreshThumb(...args)
          this.success = this.success + 1
        } catch (err) {
          this.failure = this.failure + 1
          this.$emit('warning', `${name}的缩略图生成失败`, err)
        }
      }
    },
    async refreshThumbsConfirmProcessing() {
      if (this.processing === false) {
        try {
          this.processing = true
          await this.refreshThumbs()
          if (this.failure === 0) {
            this.$emit('success', `所有缩略图已刷新`)
          }
        } catch (err) {
          this.$emit('error', '刷新缓存失败', err)
        } finally {
          this.processing = false
        }
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
