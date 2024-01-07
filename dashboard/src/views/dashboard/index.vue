<template>
  <ElContainer
    v-loading="loading"
    style="padding-top: 20px; width: 640px"
    direction="vertical"
  >
    <ElMain>
      <ElAlert v-for="alert in alerts" :key="alert.id" :type="alert.type" :title="alert.title" style="margin-bottom: 10px;" />
      <RefreshThumbs @error="handleError" @warning="handleWarning" @success="handleSuccess" @info="handleInfo" />
    </ElMain>
  </ElContainer>
</template>

<script>
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
    if (err) {
      consolePrint(`${title}`, err)
      this.addAlert(alert_type, `${title}: ${err.message}`)
    } else {
      this.addAlert(alert_type, title)
    }
  }
}

export default {
  name: 'DashboardHome',

  components: { RefreshThumbs },

  data: () => ({
    loading: false,
    alerts: [],
  }),

  methods: {
    addAlert(type, title) {
      this.alerts = [...this.alerts, { id: uuidv4(), type, title }]
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
