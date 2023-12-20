const assert = require('assert');
const mock = require('egg-mock');
const { getToken, createMember, getMemberById, removeMemberById, createApp } = require('./common');

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
});
