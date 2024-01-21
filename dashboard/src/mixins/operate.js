export default {
  methods: {
    async $operate(property, fn) {
      if (this[property] !== true) {
        this[property] = true
        try {
          await fn()
        } finally {
          this[property] = false
        }
      }
    }
  }
}
