<template>
  <div>
    <ElMain>
      <ElProgress
        v-if="total !== 0"
        :status="progress_status"
        :percentage="success_percentage"
        :color="color"
      />
      <ElButton
        v-else-if="showButton"
        size="small"
        type="primary"
        icon="el-icon-refresh"
        @click="processing || refreshThumbsConfirm()"
      >刷新缩略图</ElButton>
    </ElMain>
    <ElMain>
      <ElButton
        v-if="has_failure"
        icon="el-icon-video-play"
        :type="processing ? 'text' : 'button'"
        :loading="processing"
        :disabled="processing"
        @click="handleRetry"
      >
        {{ processing ? `正在重试 (${success_count + 1} / ${total})` : '重试失败的图片' }}
      </ElButton>
      <ElButton
        v-else-if="processing"
        icon="el-icon-video-play"
        type="text"
        :loading="processing"
        disabled
        @click="handleRetry"
      >
        正在生成缩略图 ({{ total_task_count + 1 }} / {{ total }})
      </ElButton>
    </ElMain>
    <ElMain>
      <ElAlert
        v-for="task in failures"
        :key="task.id"
        style="margin-bottom: 10px;"
        show-icon
        type="warning"
        :title="task.title"
        :description="task.desc"
      />
    </ElMain>
  </div>
</template>

<script>
import { refreshThumb, getAllAvailablePhoto, __AVATAR_THUMB_SIZE__ } from '@/api/image'
import { getList as getMemberList } from '@/api/member'

const initProgress = () => ({
  total: 0,
  has_failure: false,
  found_failure: false,
  successes: [],
  failures: [],
})

const addTask = (queue, task) => [task, ...queue]

const removeTask = (queue, will_remove_task) => (
  queue.filter(task => {
    return task !== will_remove_task
  })
)

const count = (arr) => arr.length

async function requestRefreshThumb(task) {
  if (task.type === 'photo') {
    await refreshThumb({
      src: task.src,
    })
  } else if (task.type === 'member_avatar') {
    await refreshThumb({
      src: task.src,
      target_size: task.target_size,
    })
  } else {
    throw new TypeError('unknown task.type')
  }
}

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
    progress_status() {
      if (this.processing) {
        return undefined
      } else if (this.success_percentage === 100) {
        return 'success'
      } else if (this.has_failure) {
        return 'warning'
      } else {
        return undefined
      }
    },

    color() {
      const blue = '#409eff'
      const green = '#6db546'
      const yellow = '#e6a23c'
      if (this.found_failure) {
        return yellow
      } else if (this.success_percentage === 100) {
        return green
      } else {
        return blue
      }
    },

    total_task_count() {
      return count(this.successes) + count(this.failures)
    },

    success_count() {
      return count(this.successes)
    },

    success_percentage() {
      const started = Boolean(this.total_task_count)
      const p = 100 * (this.success_count / this.total)
      if ((p < 1) && started) {
        return 1
      } else {
        return Math.floor(p)
      }
    },
  },

  watch: {
    processing(processing) {
      if (processing === true) {
        this.show_progress = true
      }
    }
  },

  methods: {
    startProcessing(asyncFn) {
      console.log('startProcessing', this.processing)
      if (this.processing === false) {
        this.processing = true
        asyncFn().finally(() => {
          console.warn('finally')
          this.processing = false
          if (count(this.failures) === 0) {
            this.has_failure = false
            this.$emit('success', `所有缩略图已刷新`)
          } else {
            this.has_failure = true
          }
        })
      }
    },

    handleRetry() {
      this.startProcessing(this.retry.bind(this))
    },

    async retry() {
      this.found_failure = false
      for (const fail_task of this.failures) {
        this.failures = removeTask(this.failures, fail_task)

        try {
          await refreshThumb(fail_task)
          this.successes = addTask(this.successes, fail_task)
        } catch (err) {
          this.found_failure = true
          this.failures = addTask(this.failures, {
            ...fail_task,
            title: `${fail_task.name} 再次处理失败`,
            desc: err.message,
          })
        }
      }
    },

    async handleThumbsRefresh() {
      this.startProcessing(this.refreshThumbs.bind(this))
    },

    async refreshThumbs() {
      Object.assign(this, initProgress())

      const [photos, members] = await Promise.all([
        getAllAvailablePhoto(), getMemberList()
      ])

      const task_list = [
        ...photos.map(p => ({
          type: 'photo',
          id: `p-${p.id}`,
          name: `相片(id=${p.id})`,
          src: p.src,
        })),
        ...members.map(m => ({
          type: 'member_avatar',
          id: `m-${m.id}`,
          name: `成员头像(id=${m.id})`,
          src: m.avatar_src,
          target_size: __AVATAR_THUMB_SIZE__,
        }))
      ]

      this.total = task_list.length

      for (const task of task_list) {
        try {
          // console.log('task', task)
          await requestRefreshThumb(task)
          // console.log('success')
          this.successes = addTask(this.successes, task)
        } catch (err) {
          // console.log('failure')
          this.found_failure = true
          this.failures = addTask(this.failures, {
            ...task,
            title: `${task.name} 处理失败`,
            desc: err.message,
          })
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
