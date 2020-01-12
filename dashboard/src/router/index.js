import Vue from 'vue'
import Router from 'vue-router'

Vue.use(Router)

/* Layout */
import Layout from '@/layout'
/**
 * Note: sub-menu only appear when route children.length >= 1
 * Detail see: https://panjiachen.github.io/vue-element-admin-site/guide/essentials/router-and-nav.html
 *
 * hidden: true                   if set true, item will not show in the sidebar(default is false)
 * alwaysShow: true               if set true, will always show the root menu
 *                                if not set alwaysShow, when item has more than one children route,
 *                                it will becomes nested mode, otherwise not show the root menu
 * redirect: noRedirect           if set noRedirect will no redirect in the breadcrumb
 * name:'router-name'             the name is used by <keep-alive> (must set!!!)
 * meta : {
    roles: ['admin','editor']    control the page roles (you can set multiple roles)
    title: 'title'               the name show in sidebar and breadcrumb (recommend set)
    icon: 'svg-name'             the icon show in the sidebar
    breadcrumb: false            if set false, the item will hidden in breadcrumb(default is true)
    activeMenu: '/example/list'  if set path, the sidebar will highlight the path you set
  }
 */

/**
 * constantRoutes
 * a base page that does not have permission requirements
 * all roles can be accessed
 */
export const constantRoutes = [
  {
    path: '/login',
    component: () => import('@/views/login/index'),
    hidden: true
  },

  {
    path: '/404',
    component: () => import('@/views/404'),
    hidden: true
  },

  {
    path: '/',
    component: Layout,
    redirect: '/dashboard',
    children: [{
      path: 'dashboard',
      name: 'Dashboard',
      component: () => import('@/views/dashboard/index'),
      meta: { title: 'Dashboard', icon: 'dashboard' }
    }]
  },

  {
    path: '/member',
    redirect: '/gallery/list',
    component: Layout,
    name: 'Gallery',
    meta: { title: '相册', icon: 'example' },
    children: [
      {
        path: 'list',
        name: 'MemberList',
        component: () => import('@/views/member/index'),
        meta: { title: '成员管理', icon: 'user' }
      },
      {
        hidden: true,
        path: ':id',
        name: 'MemberDetail',
        component: () => import('@/views/member/detail'),
        meta: { title: '成员详情', icon: 'user' }
      }
    ]
  },

  {
    path: '/gallery',
    redirect: '/gallery/list',
    component: Layout,
    name: 'Gallery',
    meta: { title: '相册', icon: 'example' },
    // alwaysShow: true,
    children: [
      {
        path: 'list',
        name: 'GalleryList',
        component: () => import('@/views/gallery/index'),
        meta: { title: '相册列表', icon: 'table' }
      },
      {
        hidden: true,
        path: ':gallery_id/photo/list',
        name: 'GalleryPhotoList',
        component: () => import('@/views/gallery/photo/list'),
        meta: { title: '相片列表', icon: 'table' }
      },
      {
        hidden: true,
        path: ':gallery_id/photo/member',
        name: 'GalleryPhotoMemberList',
        component: () => import('@/views/gallery/photo/member'),
        meta: { title: '成员投票情况', icon: 'table' }
      },
      {
        hidden: true,
        path: ':gallery_id/photo/:id',
        name: 'GalleryPhotoDetail',
        component: () => import('@/views/gallery/photo/detail'),
        meta: { title: '相片详情', icon: 'table' }
      }
    ]
  },

  {
    path: 'external-link',
    component: Layout,
    children: [
      {
        path: 'https://pache.blog/torzo-gallery/index.html',
        meta: { title: '跳转到同装相册', icon: 'link' }
      }
    ]
  },

  // 404 page must be placed at the end !!!
  { path: '*', redirect: '/404', hidden: true }
]

const createRouter = () => new Router({
  // mode: 'history', // require service support
  scrollBehavior: () => ({ y: 0 }),
  routes: constantRoutes
})

const router = createRouter()

// Detail see: https://github.com/vuejs/vue-router/issues/1234#issuecomment-357941465
export function resetRouter() {
  const newRouter = createRouter()
  router.matcher = newRouter.matcher // reset router
}

export default router
