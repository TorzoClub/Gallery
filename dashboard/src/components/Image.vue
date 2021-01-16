<template>
  <div
    class="image"
    :style="{
      backgroundImage: `url(${src})`
    }"
    @click="$emit('click')"
  >
    <!-- <img class="img" :src="src" /> -->
  </div>
</template>

<style scoped>
  .image {
    display: inline-flex;
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center center;
    border-radius: 4px;
    box-shadow: 0px 1px 2px rgba(0, 0, 0, 0.2);
  }
</style>

<script>
  export default {
    props: {
      src: {
        type: undefined,
        default: ''
      }
    }
  }
</script>
