<template>
  <ElContainer v-loading="loading" style="width: 640px" direction="vertical">
    <ElMain height="auto">
      <ElRow :gutter="30">
        <ElCol :span="20">
          <ElAlert
            v-for="alert in alerts"
            :key="alert.id"
            style="margin-bottom: 10px;"
            show-icon
            :type="alert.type"
            :title="alert.title"
            :description="alert.description"
            @close="handleAlertClose(alert.id)"
          />
        </ElCol>
      </ElRow>

      <ElRow :gutter="20" style="padding: 20px 0">
        <ElCol :span="4">
          <ElStatistic title="总投稿数">
            <template slot="formatter">{{ statistic.available_photo_count }}</template>
          </ElStatistic>
        </ElCol>
        <ElCol :span="8">
          <ElStatistic title="图片占用空间">
            <template slot="prefix">
              <ElLink style="opacity: 0" icon="el-icon-refresh" size="mini">清理</ElLink>
            </template>
            <template slot="formatter">{{ statistic.src_total_size }}</template>
            <template slot="suffix">
              <el-popconfirm
                confirm-button-text="是的"
                cancel-button-text="不了"
                icon="el-icon-info"
                icon-color="red"
                title="你确定要清理吗？这将移除图片库中没有被引用的图片"
                @confirm="handleClickCleanImagePool"
              >
                <ElLink slot="reference" icon="el-icon-refresh" size="mini">清理</ElLink>
              </el-popconfirm>
            </template>
          </ElStatistic>
        </ElCol>

        <ElCol :span="10">
          <ElStatistic title="缩略图占用空间">
            <template slot="prefix">
              <ElLink style="opacity: 0" icon="el-icon-refresh" size="mini">重新生成</ElLink>
            </template>
            <template slot="formatter">{{ statistic.thumb_total_size }}</template>
            <template slot="suffix">
              <el-popconfirm
                confirm-button-text="是的"
                cancel-button-text="不了"
                icon="el-icon-info"
                icon-color="red"
                title="你确定要重新生成吗？（这将花费一些时间，请在完成前不要离开本页面）"
                @confirm="handleClickRefreshThumb"
              >
                <ElLink slot="reference" icon="el-icon-refresh" size="mini">重新生成</ElLink>
              </el-popconfirm>
            </template>
          </ElStatistic>
        </ElCol>
      </ElRow>

      <ElRow :gutter="30">
        <ElCol :span="20" direction="vertical">
          <RefreshThumbs ref="refreshThumbs" :show-button="false" @error="handleError" @warning="handleWarning" @success="handleSuccess" @info="handleInfo" />
        </ElCol>
      </ElRow>
    </ElMain>
  </ElContainer>
</template>

<script>
import { getStatistic } from '@/api/statistic'
import RefreshThumbs from './components/refresh-thumbs.vue'
import { v4 as uuidv4 } from 'uuid'

function ConsolePrint(alert_type) {
  switch (alert_type) {
    default: return console.log
    case 'error': return console.error
    case 'warning': return console.warn
  }
}

function HandleAlertEvent(alert_type) {
  const consolePrint = ConsolePrint(alert_type).bind(console)
  return function(title, err) {
    if (err instanceof Error) {
      consolePrint(`${title}`, err)
      this.addAlert(alert_type, title, err.message)
    } else {
      this.addAlert(alert_type, title, err)
    }
  }
}

export default {
  name: 'DashboardHome',

  components: { RefreshThumbs },

  data: () => ({
    loading: false,
    alerts: [],
    statistic: {
      available_photo_count: 'N/A',
      src_total_size: 'N/A',
      thumb_total_size: 'N/A',
    }
  }),

  mounted() {
    this.refresh()
  },

  methods: {
    async refresh() {
      try {
        this.loading = true
        this.statistic = await getStatistic()
      } finally {
        this.loading = false
      }
    },

    handleClickCleanImagePool() {
    },

    handleClickRefreshThumb() {
      this.$refs.refreshThumbs.refreshThumbsConfirmProcessing().finally(() => {
        this.refresh()
      })
    },

    handleAlertClose(remove_id) {},

    addAlert(type, title, description) {
      console.log('desc', description)
      this.alerts = [...this.alerts, { id: uuidv4(), type, title, description }]
    },

    handleError: HandleAlertEvent('error'),
    handleWarning: HandleAlertEvent('warning'),
    handleSuccess: HandleAlertEvent('success'),
    handleInfo: HandleAlertEvent('info'),
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
