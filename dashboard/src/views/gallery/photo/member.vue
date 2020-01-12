<template>
  <ElContainer
    v-loading="loading"
    style="padding-top: 20px; width: 1024px"
    direction="vertical"
  >
    <ElHeader height="32px">
      <ElButton size="small" type="primary" icon="el-icon-refresh" @click="refresh">刷新</ElButton>
    </ElHeader>

    <ElMain>
      <ElTable :data="list" border style="width: 100%" stripe :max-height="$parent.getMaxHeight() - 32 - 20 - 20 * 2">
        <ElTableColumn prop="id" label="成员id" align="center" width="64" />
        <ElTableColumn prop="name" label="名称" align="center" width="128" />
        <ElTableColumn prop="votes" label="投票状况" align="left" sortable>
          <template slot-scope="scope">
            <template v-if="!scope.row.votes || !scope.row.votes.length">
              此人未投，可以鄙视
            </template>
            <template v-else>
              <template v-for="vote in scope.row.votes">
                <template v-if="getPhotoById(vote.photo_id)">
                  <ImageBox :key="vote.id" :src="getPhotoById(vote.photo_id).thumb" style="margin: 0 4px; width: 64px; height: 64px;" />
                </template>
                <template v-else>
                  照片不存在！
                </template>
              </template>
            </template>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElMain>
  </ElContainer>
</template>

<script>
  import { getList as getPhotoList } from '@/api/photo'
  import { getMemberVoteList } from '@/api/gallery'
  import ImageBox from '@/components/Image'

  export default {
    components: {
      ImageBox
    },

    data: () => ({
      loading: false,
      photoList: [],
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
      getPhotoById(photo_id) {
        const idx = this.photoList.map(photo => photo.id).indexOf(photo_id)
        if (idx !== -1) {
          return this.photoList[idx]
        } else {
          return null
        }
      },

      async refresh() {
        try {
          this.loading = true
          this.photoList = await getPhotoList(this.gallery_id)
          this.list = await getMemberVoteList(this.gallery_id)
        } catch (err) {
          console.error('获取成员列表失败', err)
          this.$message.error(`获取成员列表失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      },
    }
  }
</script>
