const assert = require('assert');
const mock = require('egg-mock');
const { getToken, createMember, getMemberById, removeMemberById, createApp, createPhoto, commonCreateGallery, getPhotoById, removePhotoById, constructEnvironment, prepareData, submitVote } = require('./common');

describe('controller/admin/member', () => {
  let app
  let token

  before(async () => {
    app = await createApp()
    // app = mock.app()
    // // 等待 app 启动成功，才能执行测试用例
    // await app.ready()
    // await app.model.sync({
    //   force: true,
    // });
    token = await getToken(app)
  })

  it('should successfully create a member', async () => {
    const member = await createMember(token, app)
  })

  it('should successfully get a member infomation', async () => {
    const createdMember = await createMember(token, app, { name: 'get member', qq_num: 2333333 })
    const member = await getMemberById(token, app, createdMember.id)

    assert(member.id === createdMember.id)
    assert(member.name === createdMember.name)
  })

  it('should successfully delete a member', async () => {
    const createdMember = await createMember(token, app, { name: 'get member', qq_num: 141421 })
    const deletedMember = await removeMemberById(token, app, createdMember.id)
    assert(deletedMember.id === createdMember.id)

    getMemberById(token, app, deletedMember.id, 404)
  })

  it('should successfully get a member list', () => {
    return app.httpRequest()
      .get('/admin/member')
      .set('Authorization', token)
      .expect(200)
      .then(res => {
        const memberList = res.body
        assert(Array.isArray(memberList))
      })
  })

  function removeMemberGalleryVote(token, app, member_id, gallery_id, expect_code = 200) {
    console.warn(`/admin/member/${member_id}/gallery/${gallery_id}/vote`)
    return app.httpRequest()
      .delete(`/admin/member/${member_id}/gallery/${gallery_id}/vote`)
      .set('Authorization', token)
      .expect(expect_code)
  }

  it('should prevent remove member that member is voted', async () => {
    const { gallery, memberA, photoA, photoB } = await prepareData({ token, app, baseNum: 99 })

    await submitVote(app, memberA.qq_num, gallery.id, [ photoA.id, photoB.id ])

    await removeMemberById(token, app, memberA.id, 409)

    await removeMemberGalleryVote(token, app, memberA.id, gallery.id, 200)

    await removeMemberById(token, app, memberA.id, 200)
  })

  it('should prevent remove member that member has a submission', async () => {
    const member = await createMember(token, app, { name: 'get member', qq_num: 1141 })

    const gallery = await commonCreateGallery(token, app, {})
    const created_photo = await createPhoto(token, app, {
      gallery_id: gallery.id,
      member_id: member.id,
    })

    await removeMemberById(token, app, member.id, 409)

    await removePhotoById(token, app, created_photo.id, 200)

    await removeMemberById(token, app, member.id, 200)
  })
});
