// 解决 v-model 无法嵌套的问题

const prop = 'RECURSIVE_MODEL'
const event = 'RECURSIVE_MODEL_CHANGE'

export default value_name => ({
  model: { prop, event },

  props: [prop],

  data: ctx => ({
    [value_name]: ctx[prop]
  }),

  watch: {
    [prop](value) {
      this[value_name] = value
    },

    [value_name](value) {
      this.$triggerModelChange(value)
    }
  },

  methods: {
    $triggerModelChange(value) {
      this.$emit(event, value)
    }
  }
})
