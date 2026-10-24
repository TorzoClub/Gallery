const assert = require('assert');
const mock = require('egg-mock');
const { createApp } = require('./common');

describe('controller/admin/auth', () => {
  let app;
  before(async () => {
    app = await createApp()
    // app = mock.app();
    // 等待 app 启动成功，才能执行测试用例
    // return app.ready();
  });

  it('should successfully login with correct admin password', () => {
    return app.httpRequest()
      .post('/admin/login')
      .type('json')
      .send({
        pass: app.config.adminPass
      })
      .expect(200)
  })

  it('should prevent login with incorrect admin password', () => {
    return app.httpRequest()
      .post('/admin/login')
      .type('json')
      .send({
        pass: 'failure password'
      })
      .expect(403)
  })

  it('should successfully aceess admin API with admin token', () => {
    return app.httpRequest()
      .post('/admin/login')
      .type('json')
      .send({
        pass: app.config.adminPass
      })
      .expect(200)
      .then(res => {
        const { token } = res.body

        return app.httpRequest()
          .get('/admin/gallery')
          .set('Authorization', token)
          .expect(200)
      })
  })

  it('should prevent access admin API with incorrect admin token', () => {
    return app.httpRequest()
      .get('/admin/gallery')
      .set('Authorization', 'failure token')
      .expect(403)
  })
});
