<template>
  <ElContainer
    v-loading="loading"
    style="padding-top: 20px;"
    direction="vertical"
  >
    <ElHeader height="32px">
      <ElButton size="small" type="primary" icon="el-icon-refresh" @click="refresh">刷新</ElButton>

      <ElButton size="small" icon="el-icon-tickets">总人数: {{ totalPeopleCount }}</ElButton>

      <ElButton size="small" icon="el-icon-check">已投 {{ votedPeopleCount }}</ElButton>

      <ElButton size="small" icon="el-icon-close">未投 {{ totalPeopleCount - votedPeopleCount }}</ElButton>
    </ElHeader>

    <ElMain>
      <ElTable :data="list" border style="width: 100%" stripe :max-height="$parent.getMaxHeight() - 32 - 20 - 20 * 2">
        <ElTableColumn prop="id" label="成员id" align="center" width="64" />
        <ElTableColumn prop="name" label="名称" align="center" width="128">
          <router-link slot-scope="scope" :to="{ name: 'MemberDetail', params: { id: scope.row.id } }" style="color: #46a0fc; text-decoration: underline;">
            {{ scope.row.name }}
          </router-link>
        </ElTableColumn>
        <ElTableColumn
          prop="votes"
          label="投票状况"
          align="left"
          :filters="[
            {text: '已投', value: true },
            {text: '未投', value: false }
          ]"
          :filter-multiple="false"
          :filter-method="filterHandler"
          filter-placement="bottom-end"
          sortable
        >
          <template slot-scope="scope">
            <template v-if="!scope.row.votes || !scope.row.votes.length">
              未投
            </template>
            <template v-else>
              <template v-for="vote in scope.row.votes">
                <template v-if="getPhotoById(vote.photo_id)">
                  <ImageBox
                    :key="vote.id"
                    :src="getPhotoById(vote.photo_id).thumb"
                    style="margin: 0 4px; width: 64px; height: 64px;"
                    @click="$router.push({
                      name: 'GalleryPhotoDetail',
                      params: { gallery_id: gallery_id, id: vote.photo_id }
                    })"
                  />
                </template>
                <template v-else>
                  照片不存在！
                </template>
              </template>
            </template>
          </template>
        </ElTableColumn>
        <ElTableColumn label="编辑" align="center" width="170">
          <ElButtonGroup slot-scope="scope">
            <ElButton
              size="small"
              type="danger"
              icon="el-icon-tickets"
              @click="setRetryVote(scope.$index)"
            >设置重投</ElButton>
          </ElButtonGroup>
        </ElTableColumn>
      </ElTable>
    </ElMain>
  </ElContainer>
</template>

<script>
  import { setRetryVote } from '@/api/member'
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
      list: []
    }),

    computed: {
      gallery_id() {
        return this.$route.params.gallery_id
      },

      totalPeopleCount() {
        return this.list.length
      },

      votedPeopleCount() {
        const votedArr = this.list.map(member => {
          return Boolean(member.votes.length)
        }).filter(isVote => isVote)

        return votedArr.length
      }
    },

    mounted() {
      this.refresh()
    },

    methods: {
      filterHandler(filterValue, row, column) {
        return filterValue === Boolean(row.votes && row.votes.length)
      },

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

      async setRetryVote(idx) {
        const member = this.list[idx]

        const confirm = await this.confirm('', `你确定要让【${member.name}】重投吗？`, {
          confirmButtonClass: 'el-button--warning',
        })

        if (!confirm) {
          return
        }

        try {
          this.loading = true
          await setRetryVote({
            id: member.id,
            gallery_id: this.gallery_id
          })
          this.$message.success(`操作成功，【${member.name}】已经可以重新投票`)
          this.refresh()
        } catch (err) {
          console.error('设置失败', err)
          this.$message.error(`设置失败: ${err.message}`)
        } finally {
          this.loading = false
        }
      }
    }
  }
</script>
