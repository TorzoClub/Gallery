import axios from 'axios'
import { MessageBox, /* Message*/ } from 'element-ui'
import store from '@/store'
import { getToken } from '@/utils/auth'

// create an axios instance
const service = axios.create({
  baseURL: process.env.VUE_APP_BASE_API, // url = base url + request url
  // withCredentials: true, // send cookies when cross-domain requests
  timeout: 5000 // request timeout
})

// request interceptor
service.interceptors.request.use(
  requestOption => {
    if (!requestOption.noToken) {
      const token = getToken()
      if (token) {
        requestOption.headers['Authorization'] = `${token}`
      }
    }

    return requestOption
  },

  err => {
    return Promise.reject(err)
  }
)

service.interceptors.response.use(
  response => {
    const { data, status } = response

    Object.defineProperties(data, {
      _response: {
        get() {
          return response
        }
      },

      _status: {
        get() {
          return status
        }
      }
    })

    return data
  },

  axiosErr => {
    if (!axiosErr.response) {
      return Promise.reject(axiosErr)
    }

    const { response } = axiosErr
    const { data, status } = response

    const err = data.message ? Error(data.message) : Error(axiosErr.message)

    if (status === 401) {
      // 或许是 token 过期

      MessageBox.confirm('You have been logged out, you can cancel to stay on this page, or log in again', 'Confirm logout', {
        confirmButtonText: 'Re-Login',
        cancelButtonText: 'Cancel',
        type: 'warning'
      }).then(() => {
        store.dispatch('user/resetToken').then(() => {
          location.reload()
        })
      })

      throw Object.assign(
        Error('INVALID_TOKEN'),
        { SILENT: true }
      )
    }

    Object.assign(err, {
      data,
      response,
      status
    })

    return Promise.reject(err)
  }
)

// response interceptor
// service.interceptors.response.use(
//   /**
//    * If you want to get http information such as headers or status
//    * Please return  response => response
//   */
//
//   /**
//    * Determine the request status by custom code
//    * Here is just an example
//    * You can also judge the status by HTTP Status Code
//    */
//   response => {
//     const res = response.data
//
//     // if the custom code is not 20000, it is judged as an error.
//     if (res.code !== 20000) {
//       Message({
//         message: res.message || 'Error',
//         type: 'error',
//         duration: 5 * 1000
//       })
//
//       // 50008: Illegal token; 50012: Other clients logged in; 50014: Token expired;
//       if (res.code === 50008 || res.code === 50012 || res.code === 50014) {
//         // to re-login
//         MessageBox.confirm('You have been logged out, you can cancel to stay on this page, or log in again', 'Confirm logout', {
//           confirmButtonText: 'Re-Login',
//           cancelButtonText: 'Cancel',
//           type: 'warning'
//         }).then(() => {
//           store.dispatch('user/resetToken').then(() => {
//             location.reload()
//           })
//         })
//       }
//       return Promise.reject(new Error(res.message || 'Error'))
//     } else {
//       return res
//     }
//   },
//   error => {
//     console.log('err' + error) // for debug
//     Message({
//       message: error.message,
//       type: 'error',
//       duration: 5 * 1000
//     })
//     return Promise.reject(error)
//   }
// )

export default service
