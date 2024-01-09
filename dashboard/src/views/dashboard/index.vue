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
        <ElCol :span="9">
          <ElStatistic title="图片占用空间">
            <template slot="prefix">
              <ElLink style="opacity: 0" icon="el-icon-refresh" size="mini">清理</ElLink>
            </template>
            <template slot="formatter">{{ statistic.src_storage }}</template>
            <template slot="suffix">
              <el-popconfirm
                confirm-button-text="是的"
                cancel-button-text="不了"
                icon="el-icon-info"
                icon-color="red"
                title="你确定要清理吗？这将移除图片库中没有被引用的相片"
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
            <template slot="formatter">{{ statistic.thumb_storage }}</template>
            <template slot="suffix">
              <el-popconfirm
                confirm-button-text="是的"
                cancel-button-text="不了"
                icon="el-icon-info"
                icon-color="red"
                title="你确定要重新生成吗？（这将花费一些时间，在完成前请不要离开本页面）"
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
import { v4 as uuidv4 } from 'uuid'
import { getStatistic } from '@/api/statistic'
import { requestCleanUnusedImage } from '@/api/image'
import RefreshThumbs from './components/refresh-thumbs.vue'
import Operate_Mixins from '@/mixins/operate'

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

  mixins: [Operate_Mixins],

  data: () => ({
    loading: false,
    alerts: [],
    statistic: {
      available_photo_count: 'N/A',
      src_storage: 'N/A',
      thumb_storage: 'N/A',
    }
  }),

  mounted() {
    this.refresh()
  },

  methods: {
    refresh() {
      this.$operate('loading', async() => {
        try {
          this.statistic = await getStatistic()
        } catch (err) {
          this.handleError('获取主页信息失败', err)
        }
      })
    },

    async handleClickCleanImagePool() {
      await this.$operate('loading', async() => {
        try {
          const clean_list = await requestCleanUnusedImage()
          if (clean_list.length) {
            this.handleSuccess(`已清理${clean_list.length}个文件`)
          } else {
            this.handleInfo(`没有发现无用的图片，不用清理了`)
          }
        } catch (err) {
          this.handleError('请求清理无用图片失败', err)
        }
      })

      this.refresh()
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
